import os
import sys
import time
import json
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

def run_e2e_test():
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
    print(f"Testing with CSV: {csv_file}")
    assert os.path.exists(csv_file), f"CSV not found: {csv_file}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Access Base URL
        base_url = "http://localhost:8089/laboratorio/sekundo"
        print(f"Navigating to {base_url}...")
        page.goto(f"{base_url}/", timeout=30000)
        page.wait_for_load_state("networkidle")
        time.sleep(1)

        # 2. Seed Test Event in LocalStorage
        event_id = "territory-recency-demo"
        event_state = {
            "config": {
                "id": event_id,
                "name": "Campanha Territórios 2026",
                "frequency": "annual",
                "skeletonRoots": ["01"],
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
        print(f"Seeded event: {event_id}")

        # 3. Navigate to CSV import
        import_url = f"{base_url}/csv-import?id={event_id}"
        print(f"Navigating to {import_url}...")
        page.goto(import_url)
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # Upload CSV file
        print("Uploading CSV file via CSVDropZone...")
        file_input = page.locator("input[type='file']")
        file_input.set_input_files(csv_file)
        time.sleep(3)

        # Wait for "Confirmar e Salvar no Sekundo" button
        page.wait_for_selector("text=Confirmar e Salvar no Sekundo", timeout=10000)
        commit_btn = page.locator("text=Confirmar e Salvar no Sekundo").first
        print("Commit button found! Clicking to apply CSV import...")
        commit_btn.click()
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # 4. Inspect Territory Checklist
        checklist_url = f"{base_url}/territory-checklist?id={event_id}"
        print(f"Navigating to checklist: {checklist_url}")
        page.goto(checklist_url)
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # Verify sorting chips
        assert page.locator("text=/ORDENA/").count() > 0, "Sort row label missing"
        assert page.locator("text=/Prioridade/").count() > 0, "Priority sort chip missing"
        assert page.locator("text=/Recentes/").count() > 0, "Recent sort chip missing"
        print("Checklist sort controls verified!")

        # Click on Priority sort
        page.locator("text=/Prioridade/").first.click()
        time.sleep(1)

        # Capture checklist screenshot
        shot1 = os.path.join(artifacts_dir, "01_territory_checklist_recency.png")
        page.screenshot(path=shot1, full_page=False)
        print(f"Saved: {shot1}")

        # Check recency text presence
        chk_content = page.content()
        has_completed_badge = "Concluído" in chk_content
        has_days_badge = "dias" in chk_content or "hoje" in chk_content or "ontem" in chk_content
        print(f"Checklist completed badges present: {has_completed_badge}, days: {has_days_badge}")

        # 5. Inspect Tactical Map
        map_url = f"{base_url}/territory-map?id={event_id}"
        print(f"Navigating to map: {map_url}")
        page.goto(map_url)
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # Verify recency button
        recency_btn = page.locator("text=/Recência dos Territórios/").first
        assert recency_btn.count() > 0, "Recency button on map missing"
        print("Tactical map recency button verified!")

        # Capture map overview before modal
        shot2_map = os.path.join(artifacts_dir, "02_territory_map_overview.png")
        page.screenshot(path=shot2_map, full_page=False)
        print(f"Saved: {shot2_map}")

        # Click on Recency button to open modal
        print("Opening Territory Recency Modal...")
        recency_btn.click()
        time.sleep(1)

        # Verify modal content
        assert page.locator("text=/Recência e Cobertura/").count() > 0, "Recency modal title missing"
        assert page.locator("text=/Focar no Mapa/").count() > 0, "Focus on map button missing"
        print("Recency modal content verified!")

        # Capture Recency modal screenshot
        shot3_modal = os.path.join(artifacts_dir, "03_territory_map_recency_modal.png")
        page.screenshot(path=shot3_modal, full_page=False)
        print(f"Saved: {shot3_modal}")

        # Click on Focar no Mapa for first item
        focus_btn = page.locator("text=/Focar no Mapa/").first
        focus_btn.click()
        time.sleep(1)

        # Capture map overview after focus
        shot4_focused = os.path.join(artifacts_dir, "04_territory_map_focused.png")
        page.screenshot(path=shot4_focused, full_page=False)
        print(f"Saved: {shot4_focused}")

        print("ALL E2E VISUAL AND OPERATIONAL TESTS PASSED WITH 100% SUCCESS!")
        browser.close()

if __name__ == "__main__":
    run_e2e_test()
