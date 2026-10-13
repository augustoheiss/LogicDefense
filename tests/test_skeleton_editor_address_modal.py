import os
import sys
import time
import json
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

def run_test():
    artifacts_dir = os.path.join(
        os.path.expanduser("~"),
        ".gemini",
        "antigravity-ide",
        "brain",
        "6c1ee62e-3f24-413e-b13c-3fc65a8f9e7c"
    )
    os.makedirs(artifacts_dir, exist_ok=True)
    
    csv_file = os.path.abspath(r"..\territorios\territorios_sekundo_import.csv")
    if not os.path.exists(csv_file):
        csv_file = os.path.abspath(r"territorios\territorios_sekundo_import.csv")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        base_url = "http://localhost:8089/laboratorio/sekundo"
        page.goto(f"{base_url}/", timeout=30000)
        page.wait_for_load_state("networkidle")

        event_id = "territory-recency-demo"
        event_state = {
            "config": {
                "id": event_id,
                "name": "Campanha Territórios 2026",
                "frequency": "annual",
                "skeletonRoots": ["01"],
                "engineId": "territory_logistics",
                "engines": ["territory_logistics"],
                "createdAt": "2026-10-12T00:00:00.000Z"
            },
            "lifecycle": "active",
            "version": 1
        }
        
        page.evaluate(f"""() => {{
            const listRaw = localStorage.getItem('sekundo_events_list');
            let list = listRaw ? JSON.parse(listRaw) : [];
            if (!list.includes('{event_id}')) {{
                list.push('{event_id}');
            }}
            localStorage.setItem('sekundo_events_list', JSON.stringify(list));
            localStorage.setItem('sekundo_event_{event_id}', JSON.stringify({json.dumps(event_state)}));
            if (!localStorage.getItem('sekundo_skeleton_{event_id}')) {{
                localStorage.setItem('sekundo_skeleton_{event_id}', JSON.stringify([]));
            }}
        }}""")

        # Import CSV
        page.goto(f"{base_url}/csv-import?id={event_id}")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        file_input = page.locator("input[type='file']")
        file_input.set_input_files(csv_file)
        time.sleep(3)

        commit_btn = page.locator("text=Confirmar e Salvar no Sekundo").first
        commit_btn.click()
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # Go to skeleton-editor
        editor_url = f"{base_url}/skeleton-editor?id={event_id}"
        print(f"Navigating to skeleton editor: {editor_url}")
        page.goto(editor_url)
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # Look for Edit buttons in TreeView
        edit_btns = page.locator("text=Edit")
        count = edit_btns.count()
        print(f"Found {count} Edit buttons in Skeleton Editor")
        assert count > 0, "No Edit buttons found!"

        # Click on an address node edit button (e.g. 4th button, which is the first leaf under 01-01-01)
        print("Clicking Edit button for address node...")
        edit_btns.nth(3).click()
        time.sleep(1)

        # Verify AddressEditModal
        modal_title = page.locator("text=/Editar Informações do Endereço/").first
        print(f"AddressEditModal header found: {modal_title.count()}")
        assert modal_title.count() > 0, "AddressEditModal did not open!"

        # Verify sections inside modal
        assert page.locator("text=/LOCALIZAÇÃO & ENDEREÇO/").count() > 0, "Location section missing"
        assert page.locator("text=/CARACTERÍSTICAS DO IMÓVEL/").count() > 0, "Characteristics section missing"
        assert page.locator("text=/GEOLOCALIZAÇÃO/").count() > 0, "Geolocation section missing"
        assert page.locator("text=/CRONOGRAMA & DATAS DE COBERTURA/").count() > 0, "Schedule section missing"
        assert page.locator("text=/COBERTURA & OBSERVAÇÕES DE CAMPO/").count() > 0, "Coverage section missing"

        # Capture screenshot of AddressEditModal inside skeleton-editor
        shot_path = os.path.join(artifacts_dir, "05_skeleton_editor_address_modal.png")
        page.screenshot(path=shot_path)
        print(f"Saved screenshot to: {shot_path}")

        browser.close()
        print("SKELETON EDITOR ADDRESS MODAL TEST PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    run_test()
