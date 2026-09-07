"""
download_cv_fonts.py
====================
Downloads the optimized Latin WOFF2 subsets for the core fonts used in CV Maker:
- Inter (400, 600, 700)
- Plus Jakarta Sans (500, 600, 700)
- Merriweather (400, 700)
- Fira Code (400, 600)
- Outfit (400, 600, 700)
- Poppins (400, 600)
- Caveat (700)
- Cinzel (700)
"""

import os
import re
import urllib.request

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)

TARGET_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "public", "fonts")
)
os.makedirs(TARGET_DIR, exist_ok=True)

FONTS_TO_FETCH = [
    {"family": "Inter", "weights": [400, 600, 700]},
    {"family": "Plus Jakarta Sans", "weights": [500, 600, 700]},
    {"family": "Merriweather", "weights": [400, 700]},
    {"family": "Fira Code", "weights": [400, 600]},
    {"family": "Outfit", "weights": [400, 600, 700]},
    {"family": "Poppins", "weights": [400, 600]},
    {"family": "Caveat", "weights": [700]},
    {"family": "Cinzel", "weights": [700]},
]


def fetch_css(family: str, weights: list[int]) -> str:
    family_query = family.replace(" ", "+")
    weights_query = ";".join(str(w) for w in sorted(weights))
    url = f"https://fonts.googleapis.com/css2?family={family_query}:wght@{weights_query}&display=swap"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8")


def parse_and_download(css: str, family: str):
    # Matches blocks of @font-face and extracts weight, subset comment, and woff2 url
    blocks = re.findall(
        r"(/\*\s*([^*]+)\s*\*/\s*@font-face\s*\{[^}]+\})", css, re.DOTALL
    )
    downloaded = {}

    for full_block, subset in blocks:
        subset = subset.strip().lower()
        # We focus on the latin subset (contains full standard alphabet, digits, punctuation, and pt-br chars)
        if subset != "latin":
            continue

        weight_match = re.search(r"font-weight:\s*(\d+)", full_block)
        url_match = re.search(r"src:\s*url\((https://[^)]+\.woff2)\)", full_block)

        if weight_match and url_match:
            weight = int(weight_match.group(1))
            woff2_url = url_match.group(1)

            family_slug = family.replace(" ", "")
            filename = f"{family_slug}-{weight}.woff2"
            file_path = os.path.join(TARGET_DIR, filename)

            if filename not in downloaded:
                print(f"Downloading {family} ({weight}) -> {filename}...")
                req = urllib.request.Request(woff2_url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    content = resp.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                downloaded[filename] = len(content)
                print(f"  Saved {filename} ({len(content)} bytes)")

    return downloaded


def main():
    print(f"Target directory: {TARGET_DIR}")
    total_files = 0
    total_bytes = 0

    for item in FONTS_TO_FETCH:
        family = item["family"]
        weights = item["weights"]
        try:
            print(f"\nProcessing {family} weights {weights}...")
            css = fetch_css(family, weights)
            res = parse_and_download(css, family)
            total_files += len(res)
            total_bytes += sum(res.values())
        except Exception as e:
            print(f"Error fetching {family}: {e}")

    print(f"\nCompleted! Total downloaded: {total_files} font files ({total_bytes / 1024:.1f} KB).")


if __name__ == "__main__":
    main()
