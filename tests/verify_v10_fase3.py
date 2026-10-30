# -*- coding: utf-8 -*-
"""
Verificação E2E Playwright — MASTER PLAN V10 (Fase 3):
Bases Vivas Próprias + Sprites 2.5D/3D + Carteira Compartilhada nas Outras 5 Engines
(`cerco_torres`, `forte_bandeira`, `pedreira_rei`, `arena_ondas`, `serpente_numeros`).
"""
import json
import os
import socket
import subprocess
import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 4198
BASE_URL = f"http://127.0.0.1:{PORT}"


def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def ensure_dev_server():
    if is_port_open(PORT):
        return None
    proc = subprocess.Popen(
        f"npx vite --host 127.0.0.1 --port {PORT} --strictPort",
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True,
    )
    for _ in range(60):
        if is_port_open(PORT):
            return proc
        time.sleep(0.5)
    raise RuntimeError(f"Vite dev server did not start on port {PORT}")


def run_v10_fase3_verification():
    spawned_proc = ensure_dev_server()
    artifacts_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "test_artifacts_v10")
    )
    os.makedirs(artifacts_dir, exist_ok=True)

    report = {
        "suite": "MASTER_PLAN_V10_FASE3_FIVE_ENGINES_VERIFICATION",
        "checks": {},
        "screenshots": [],
        "consoleErrors": [],
        "pageErrors": [],
    }

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()

            page.on(
                "console",
                lambda msg: report["consoleErrors"].append(msg.text)
                if msg.type == "error"
                else None,
            )
            page.on("pageerror", lambda err: report["pageErrors"].append(str(err)))

            page.goto(
                f"{BASE_URL}/jogos/logic-battle?seed=42",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            page.wait_for_selector('[data-testid="logic-battle-game"]', timeout=15000)
            time.sleep(0.4)

            # Garantir saldo generoso na Carteira Compartilhada para testar upgrades nas 5 engines
            page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    window.__lbStore.setState({
                        enemyBaseLevel: 1,
                        enemyDebuffTowersActive: 1,
                        playerBridgeTowerLevels: [1, 0, 0, 0],
                        save: {
                            ...st.save,
                            reserveTroops: 600,
                        },
                    });
                }"""
            )

            arcade_engines = [
                "cerco_torres",
                "forte_bandeira",
                "pedreira_rei",
                "arena_ondas",
            ]
            arcade_results = {}

            for eng_id in arcade_engines:
                page.evaluate(
                    f"""() => {{
                        window.__lbStore.getState().selectEngine('{eng_id}');
                        window.__lbStore.setState({{ world: 'run' }});
                    }}"""
                )
                page.wait_for_selector('[data-testid="arcade-engine-stage"]', timeout=5000)
                page.wait_for_selector('[data-testid="lb-bridge-base-command-bar"]', timeout=5000)
                time.sleep(0.35)

                tel0 = page.evaluate("() => window.__lbArcadeEngineTelemetry")
                assert tel0 is not None, f"Telemetria __lbArcadeEngineTelemetry ausente em {eng_id}"
                assert tel0["activeEngineId"] == eng_id, f"Engine incorreta na telemetria: {tel0}"
                assert tel0["activeProjectiles"] >= 1, f"Engine {eng_id} deve atirar desde t=0s: {tel0}"

                # Evoluir Base Inimiga Viva dentro da engine
                evo = page.evaluate("() => window.__lbEvolveEnemyBaseForAudit()")
                time.sleep(0.2)
                tel1 = page.evaluate("() => window.__lbArcadeEngineTelemetry")
                assert tel1["enemyBaseLevel"] >= 2, f"Base Inimiga nao evoluiu em {eng_id}: {tel1}"

                if eng_id == "cerco_torres":
                    # Evoluir Torre Aliada compartilhada em 1-clique dentro de cerco_torres
                    wallet_before = tel1["sharedWalletBalance"]
                    towers_before = sum(tel1["playerBridgeTowerLevels"])
                    force_before = tel1["playerForce"]
                    page.click('[data-testid="lb-quick-upgrade-bridge-tower-btn"]')
                    time.sleep(0.25)
                    tel_after_tower = page.evaluate("() => window.__lbArcadeEngineTelemetry")
                    store_army_after = page.evaluate("() => window.__lbStore.getState().snapshot.currentArmy")
                    assert sum(tel_after_tower["playerBridgeTowerLevels"]) > towers_before, (
                        f"Torre Aliada nao evoluiu em cerco_torres: {tel1} -> {tel_after_tower}"
                    )
                    assert tel_after_tower["sharedWalletBalance"] < wallet_before, (
                        f"Carteira Compartilhada nao descontou em cerco_torres: {wallet_before} -> {tel_after_tower['sharedWalletBalance']}"
                    )
                    assert tel_after_tower["playerForce"] >= force_before + 4 and tel_after_tower["playerForce"] == store_army_after, (
                        f"playerForce dessincronizado com snapshot.currentArmy em cerco_torres: {tel_after_tower['playerForce']} vs {store_army_after}"
                    )
                    shot_cerco = os.path.join(
                        artifacts_dir, "v10_05_arcade_cerco_torres_living_bases.png"
                    )
                    page.screenshot(path=shot_cerco)
                    report["screenshots"].append(shot_cerco)

                if eng_id == "forte_bandeira":
                    # Abrir gaveta da Base Principal dentro de forte_bandeira e evoluir Academia
                    acad_before = tel1["citadelLevels"]["academia"]
                    page.click('[data-testid="lb-open-shared-citadel-btn"]')
                    page.wait_for_selector('[data-testid="lb-shared-citadel-drawer"]', timeout=5000)
                    shot_forte = os.path.join(
                        artifacts_dir, "v10_06_arcade_forte_bandeira_shared_wallet.png"
                    )
                    page.screenshot(path=shot_forte)
                    report["screenshots"].append(shot_forte)
                    page.click('[data-testid="lb-match-upgrade-citadel-academia"]')
                    time.sleep(0.2)
                    tel_after_acad = page.evaluate("() => window.__lbArcadeEngineTelemetry")
                    assert tel_after_acad["citadelLevels"]["academia"] == acad_before + 1, (
                        f"Academia da Base Principal nao evoluiu dentro de forte_bandeira: {tel_after_acad}"
                    )
                    page.click('[data-testid="lb-close-shared-citadel-btn"]')

                if eng_id == "pedreira_rei":
                    shot_pedreira = os.path.join(
                        artifacts_dir, "v10_08_arcade_pedreira_rei_living_bases.png"
                    )
                    page.screenshot(path=shot_pedreira)
                    report["screenshots"].append(shot_pedreira)

                if eng_id == "arena_ondas":
                    shot_arena = os.path.join(
                        artifacts_dir, "v10_09_arcade_arena_ondas_living_bases.png"
                    )
                    page.screenshot(path=shot_arena)
                    report["screenshots"].append(shot_arena)

                arcade_results[eng_id] = page.evaluate("() => window.__lbArcadeEngineTelemetry")

            report["checks"]["SIT_V10_FASE3_FOUR_ARCADE_ENGINES_SHARED_WALLET"] = {
                "status": "PASS",
                "engines": arcade_results,
            }

            # =========================================================================
            # 2. Engine F: Serpente do Labirinto Infinito (`serpente_numeros`)
            # =========================================================================
            page.evaluate(
                """() => {
                    window.__lbStore.getState().selectEngine('serpente_numeros');
                    window.__lbStore.setState({ world: 'run' });
                }"""
            )
            page.wait_for_selector('[data-testid="lb-serpent-minimap"]', timeout=5000)
            page.wait_for_selector('[data-testid="lb-bridge-base-command-bar"]', timeout=5000)
            time.sleep(0.35)

            serp_tel0 = page.evaluate("() => window.__lbSerpentEngineTelemetry")
            assert serp_tel0 is not None, "Telemetria __lbSerpentEngineTelemetry ausente!"
            assert serp_tel0["activeEngineId"] == "serpente_numeros"
            assert serp_tel0["aliveDragonSegments"] >= 1

            # Evoluir Forja da Base Principal dentro da Serpente do Labirinto
            forja_before = serp_tel0["citadelLevels"]["forja"]
            page.click('[data-testid="lb-open-shared-citadel-btn"]')
            page.wait_for_selector('[data-testid="lb-shared-citadel-drawer"]', timeout=5000)
            page.click('[data-testid="lb-match-upgrade-citadel-forja"]')
            time.sleep(0.2)
            serp_tel1 = page.evaluate("() => window.__lbSerpentEngineTelemetry")
            assert serp_tel1["citadelLevels"]["forja"] == forja_before + 1, (
                f"Forja nao evoluiu dentro de serpente_numeros: {serp_tel0} -> {serp_tel1}"
            )
            page.click('[data-testid="lb-close-shared-citadel-btn"]')

            # Validar QAR1-V10-AUTHENTIC-DEBUFFS na Serpente (placa negativa reduz armyPower e snapshot.currentArmy)
            neg_pad_res = page.evaluate("() => window.__lbApplySerpentNegativePadForAudit()")
            assert neg_pad_res["armyAfter"] < neg_pad_res["armyBefore"], (
                f"Pad negativo na Serpente nao reduziu armyPower: {neg_pad_res}"
            )

            shot_serp = os.path.join(
                artifacts_dir, "v10_07_serpente_numeros_living_bases.png"
            )
            page.screenshot(path=shot_serp)
            report["screenshots"].append(shot_serp)

            # Validar retorno para a Base Principal em Mundo Aberto 3D com Carteira Compartilhada e upgrades sincronizados
            page.click('[data-testid="lb-tab-world-realm"]')
            page.wait_for_selector('[data-testid="lb-open-world-base-3d"]', timeout=5000)
            time.sleep(0.3)
            ow_tel = page.evaluate("() => window.__lbOpenWorld3DTelemetry")
            assert ow_tel is not None, "Telemetria do Mundo Aberto 3D ausente apos retorno!"
            assert ow_tel["citadelLevels"]["academia"] >= 1 and ow_tel["citadelLevels"]["forja"] >= 1, (
                f"Upgrades feitos dentro das engines nao persistiram no Mundo Aberto 3D: {ow_tel}"
            )

            report["checks"]["UAT_V10_FASE3_SERPENT_LABYRINTH_LIVING_BASE_AND_WALLET"] = {
                "status": "PASS",
                "telemetryBefore": serp_tel0,
                "telemetryAfter": serp_tel1,
                "negativePadAudit": neg_pad_res,
                "openWorldSyncAfterReturn": ow_tel,
            }

            ctx.close()
            browser.close()

        assert len(report["consoleErrors"]) == 0, f"Console errors: {report['consoleErrors']}"
        assert len(report["pageErrors"]) == 0, f"Page errors: {report['pageErrors']}"
        report["status"] = "ALL_V10_FASE3_CHECKS_PASSED"

    finally:
        if spawned_proc is not None:
            if os.name == "nt":
                subprocess.run(
                    f"taskkill /F /T /PID {spawned_proc.pid}",
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                spawned_proc.terminate()

    report_path = os.path.join(artifacts_dir, "v10_fase3_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


if __name__ == "__main__":
    out = run_v10_fase3_verification()
    sys.exit(0 if out.get("status") == "ALL_V10_FASE3_CHECKS_PASSED" else 1)
