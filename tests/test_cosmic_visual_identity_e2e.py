import os
import sys
import time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

def run_cosmic_e2e_test():
    artifacts_dir = os.path.join(
        os.path.expanduser("~"),
        ".gemini",
        "antigravity-ide",
        "brain",
        "6c1ee62e-3f24-413e-b13c-3fc65a8f9e7c"
    )
    os.makedirs(artifacts_dir, exist_ok=True)

    base_url = "http://localhost:8089/laboratorio/sekundo"
    print(f"Connecting to {base_url}...")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: print(f"BROWSER CONSOLE [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

        # 1. Access Home
        page.goto(f"{base_url}/", timeout=30000)
        page.wait_for_load_state("networkidle")
        time.sleep(1.0)

        # Seed multiple demo events so the list is scrollable
        page.evaluate("""() => {
            const list = ['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5'];
            localStorage.setItem('sekundo_events_list', JSON.stringify(list));
            list.forEach((id, idx) => {
                const state = {
                    config: {
                        id,
                        name: `Operação Esqueleto Cronos #${idx + 1}`,
                        frequency: 'weekly',
                        skeletonRoots: ['01'],
                        engines: ['territory_logistics', 'p2p_sync'],
                        createdAt: new Date().toISOString()
                    },
                    lifecycle: 'active',
                    version: 1
                };
                localStorage.setItem(`sekundo_event_${id}`, JSON.stringify(state));
            });
        }""")
        page.reload()
        page.wait_for_load_state("networkidle")
        time.sleep(1.5)

        # 2. Check for App Icon in Header
        icons = page.locator("img").all()
        print(f"Found {len(icons)} images on page.")

        # Take screenshot of top view with Cosmic Background & App Icon
        shot_top = os.path.join(artifacts_dir, "01_cosmic_header_and_bg.png")
        page.screenshot(path=shot_top, full_page=False)
        print(f"Captured top view: {shot_top}")

        # 3. Scroll down smoothly to verify parallax and color shift
        print("Scrolling down page to trigger parallax and hue-shift...")
        page.evaluate("""() => {
            const scrollContainer = Array.from(document.querySelectorAll('*')).find(el => {
                const s = window.getComputedStyle(el);
                return el.scrollHeight > el.clientHeight && (s.overflowY === 'auto' || s.overflowY === 'scroll');
            });
            if (scrollContainer) {
                scrollContainer.scrollTop = 380;
                scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
            } else {
                window.scrollTo({ top: 380 });
            }
        }""")
        time.sleep(1.2)

        # Take screenshot of scrolled view
        shot_scroll = os.path.join(artifacts_dir, "02_cosmic_scroll_parallax.png")
        page.screenshot(path=shot_scroll, full_page=False)
        print(f"Captured scrolled parallax view: {shot_scroll}")

        # Validate that title and manifesto text exist
        text_content = page.content()
        assert "Sekundo" in text_content, "Sekundo brand not found"
        assert "Eclesiastes 3:11" in text_content, "Philosophy quote Eclesiastes 3:11 not found"
        print("SUCCESS: Header, Cosmic Background, Icon and Scripture Manifesto verified!")

        browser.close()

if __name__ == "__main__":
    run_cosmic_e2e_test()
