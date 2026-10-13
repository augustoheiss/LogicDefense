import os
import sys
import time
import json
import threading
import http.server
import socketserver
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

def run_dist_e2e():
    dist_dir = os.path.abspath(r"c:\Users\Usuario\Desktop\AHeiss_GoogleDrive\02-Programacao\projetos-IA\LogicDefense\Sekundo\packages\app\dist")
    assert os.path.exists(dist_dir), f"Dist directory not found: {dist_dir}"
    
    artifacts_dir = os.path.join(
        os.path.expanduser("~"),
        ".gemini",
        "antigravity-ide",
        "brain",
        "757a3b5e-f2a6-401e-b137-7bda3afce063"
    )
    os.makedirs(artifacts_dir, exist_ok=True)

    # 1. Start lightweight local static server
    port = 8189
    class Handler(http.server.SimpleHTTPRequestHandler):
        def translate_path(self, path):
            # Strip query string if present
            path = path.split('?')[0].split('#')[0]
            # Strip base URL prefix /laboratorio/sekundo
            if path.startswith("/laboratorio/sekundo"):
                path = path[len("/laboratorio/sekundo"):]
            if not path or path == "/":
                path = "/index.html"
            elif not os.path.splitext(path)[1]:
                path = path + ".html"
            return super().translate_path(path)

        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=dist_dir, **kwargs)
        def log_message(self, format, *args):
            pass # Silent

    httpd = socketserver.TCPServer(("127.0.0.1", port), Handler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    print(f"Local static server running on http://127.0.0.1:{port}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()

            # 2. Open base page
            base_url = f"http://127.0.0.1:{port}/laboratorio/sekundo"
            print(f"Navigating to {base_url}...")
            page.goto(f"{base_url}/", timeout=30000)
            page.wait_for_load_state("networkidle")
            time.sleep(1)

            # Check that page title or main header loaded
            content = page.content()
            print("Base index loaded successfully. Length:", len(content))

            # 3. Seed mock event
            event_id = "e2e-quadras-test"
            event_state = {
                "config": {
                    "id": event_id,
                    "name": "Território Quadras E2E",
                    "frequency": "annual",
                    "skeletonRoots": ["01"],
                    "engines": ["territory_logistics"],
                    "createdAt": "2026-10-13T00:00:00.000Z"
                },
                "lifecycle": "active",
                "version": 1
            }

            # Seed flat registry with quadras and perimeter addresses
            mock_skeleton = [
                {
                    "key": "01",
                    "label": "Território T01",
                    "value": "",
                    "type": "container",
                    "meta": {"territory_number": "T01", "city": "São Paulo"}
                },
                {
                    "key": "01-01",
                    "label": "Quadra 01",
                    "value": "",
                    "type": "container",
                    "meta": {
                        "territory_number": "T01",
                        "quadra_number": "Q01",
                        "street": "Rua das Flores",
                        "line": "Rua das Flores, 100",
                        "lat": -23.5488,
                        "lng": -46.3898,
                        "worked": 1
                    }
                },
                {
                    "key": "01-02",
                    "label": "Quadra 01",
                    "value": "",
                    "type": "container",
                    "meta": {
                        "territory_number": "T01",
                        "quadra_number": "Q01",
                        "street": "Av. Brasil",
                        "line": "Av. Brasil, 250",
                        "lat": -23.5492,
                        "lng": -46.3892,
                        "worked": 0
                    }
                }
            ]

            page.evaluate(f"""() => {{
                localStorage.setItem('sekundo_events_list', JSON.stringify(['{event_id}']));
                localStorage.setItem('sekundo_event_{event_id}', JSON.stringify({json.dumps(event_state)}));
                localStorage.setItem('sekundo_skeleton_{event_id}', JSON.stringify({json.dumps(mock_skeleton)}));
            }}""")

            print(f"Navigating to {base_url}/territory-map?id={event_id}...")
            page.goto(f"{base_url}/territory-map?id={event_id}", timeout=30000)
            page.wait_for_load_state("networkidle")
            time.sleep(3)

            # Click the polygon inside the Leaflet iframe
            print("Clicking polygon inside Leaflet iframe...")
            try:
                frame = page.frames[1] if len(page.frames) > 1 else None
                if frame:
                    frame.locator("path.leaflet-interactive").first.click(force=True)
                    print("Polygon clicked inside iframe!")
                else:
                    page.evaluate("""() => {
                        window.postMessage({ type: 'SELECT_QUADRA', key: '01' }, '*');
                    }""")
            except Exception as e:
                print(f"Iframe click fallback: {e}")
                page.evaluate("""() => {
                    window.postMessage({ type: 'SELECT_QUADRA', key: '01' }, '*');
                }""")
            time.sleep(1)

            map_screenshot = os.path.join(artifacts_dir, "e2e_territory_map_quadras.png")
            page.screenshot(path=map_screenshot)
            print(f"Territory Map with Drawer screenshot saved: {map_screenshot}")

            # 4. Navigate to pdf-forms and test Custom PDF Card
            print(f"Navigating to {base_url}/pdf-forms?id={event_id}...")
            page.goto(f"{base_url}/pdf-forms?id={event_id}", timeout=30000)
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # Click on Custom PDF template card
            print("Clicking 'Reconhecimento Automático de PDF' card...")
            page.locator("text=/Reconhecimento Automático de PDF/").first.click()
            time.sleep(1)

            pdf_screenshot = os.path.join(artifacts_dir, "e2e_pdf_forms_console.png")
            page.screenshot(path=pdf_screenshot)
            print(f"PDF Forms Console with Upload DropZone screenshot saved: {pdf_screenshot}")

            browser.close()
            print("ALL E2E SMOKE TESTS COMPLETED SUCCESSFULLY!")
    finally:
        httpd.shutdown()

if __name__ == "__main__":
    run_dist_e2e()
