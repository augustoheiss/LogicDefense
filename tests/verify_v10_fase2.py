import json
import os
import socket
import subprocess
import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 4197
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


def run_v10_fase2_verification():
    spawned_proc = ensure_dev_server()
    artifacts_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "test_artifacts_v10")
    )
    os.makedirs(artifacts_dir, exist_ok=True)

    report = {
        "suite": "MASTER_PLAN_V10_FASE2_OPEN_WORLD_3D_VERIFICATION",
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
            time.sleep(0.5)

            # Garantir reserva generosa na Carteira Compartilhada e voltar para a Base Principal 3D
            page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    window.__lbStore.setState({
                        playerBridgeTowerLevels: [2, 2, 1, 1],
                        save: {
                            ...st.save,
                            reserveTroops: 350,
                            selectedRegionId: 'reg_ponte_leste',
                        },
                        snapshot: {
                            ...st.snapshot,
                            phase: 'PAUSED',
                        },
                    });
                }"""
            )
            page.click('[data-testid="lb-tab-world-realm"]')
            page.wait_for_selector('[data-testid="logic-battle-realm-stage"]', timeout=5000)
            page.wait_for_selector('[data-testid="lb-open-world-base-3d"]', timeout=5000)
            page.wait_for_selector('[data-testid="lb-openworld-command-bar"]', timeout=5000)
            time.sleep(0.4)

            # =========================================================================
            # 1. UAT-V10-FASE2-OPEN-WORLD-3D-STAGE: Palco 3D e Movimentação do Comandante
            # =========================================================================
            tel_initial = page.evaluate("() => window.__lbOpenWorld3DTelemetry")
            assert tel_initial is not None, "window.__lbOpenWorld3DTelemetry nao foi exposto!"

            # Clicar em uma província diferente e mover o Comandante 3D no Mundo Aberto
            page.click('[data-testid="lb-region-node-reg_vila_balanca"]')
            time.sleep(0.35)
            tel_after_click = page.evaluate("() => window.__lbOpenWorld3DTelemetry")
            assert tel_after_click["commanderTargetZ"] > tel_initial["commanderTargetZ"], (
                f"Comandante 3D nao atualizou rota ao clicar em reg_vila_balanca: {tel_initial} -> {tel_after_click}"
            )

            # Testar também steer direto do Comandante 3D no Mundo Aberto
            page.evaluate("() => window.__lbSteerOpenWorldCommander(3.5, -2.0)")
            tel_steered = page.evaluate("() => window.__lbOpenWorld3DTelemetry")
            assert tel_steered["commanderX"] == 3.5 and tel_steered["commanderZ"] == -2.0, (
                f"Falha ao posicionar Comandante 3D no Mundo Aberto: {tel_steered}"
            )

            report["checks"]["UAT_V10_FASE2_OPEN_WORLD_3D_STAGE"] = {
                "status": "PASS",
                "initialTelemetry": tel_initial,
                "afterRegionClickTelemetry": tel_after_click,
                "steeredTelemetry": tel_steered,
            }

            # =========================================================================
            # 2. SIT-V10-FASE2-TERRITORIAL-WAR-AND-EXPEDITIONS: Expedições 3D & Conquista
            # =========================================================================
            page.evaluate("() => window.__lbStore.getState().setActiveRealmSheet('none')")
            time.sleep(0.1)
            page.click('[data-testid="lb-region-node-reg_ponte_leste"]')
            time.sleep(0.15)
            page.evaluate("() => window.__lbStore.getState().setActiveRealmSheet('none')")
            time.sleep(0.1)
            conquered_before = page.evaluate(
                "() => [...window.__lbStore.getState().save.conqueredRegionIds]"
            )
            assert "reg_ponte_leste" not in conquered_before

            # Clicar no botão de Expedição 3D na barra do Mundo Aberto
            page.click('[data-testid="lb-openworld-dispatch-btn"]')
            time.sleep(0.25)

            expedition_tel = page.evaluate("() => window.__lbOpenWorld3DTelemetry")
            conquered_after = page.evaluate(
                "() => [...window.__lbStore.getState().save.conqueredRegionIds]"
            )
            assert expedition_tel["expeditionsDispatchedCount"] >= 1, (
                f"Nenhuma expedição 3D despachada: {expedition_tel}"
            )
            assert "reg_ponte_leste" in conquered_after, (
                f"Território reg_ponte_leste deveria ter sido conquistado pela Expedição 3D: {conquered_after}"
            )

            shot_openworld = os.path.join(
                artifacts_dir, "v10_03_openworld_3d_expedition_and_territory.png"
            )
            page.screenshot(path=shot_openworld)
            report["screenshots"].append(shot_openworld)

            report["checks"]["SIT_V10_FASE2_TERRITORIAL_WAR_AND_EXPEDITIONS"] = {
                "status": "PASS",
                "conqueredBefore": conquered_before,
                "conqueredAfter": conquered_after,
                "expeditionsDispatchedCount": expedition_tel["expeditionsDispatchedCount"],
                "sharedWalletBalanceAfterConquest": expedition_tel["sharedWalletBalance"],
            }

            # =========================================================================
            # 3. QAR1-V10-FASE2-ENEMY-COUNTER-ATTACKS-AND-CITADEL-DEFENSE:
            #    Evolução do Território Inimigo + Ondas de Cerco Inimigas + Defesa 3D da Cidadela
            # =========================================================================
            evo_res = page.evaluate("() => window.__lbEvolveEnemyRealmForAudit()")
            assert evo_res["enemyRealmThreatLevel"] >= 2, (
                f"Território inimigo não evoluiu no Mundo Aberto: {evo_res}"
            )

            # Posicionar o Comandante na fronteira e aguardar as Torres 3D da Cidadela + Comandante repelirem a invasão
            page.evaluate("() => window.__lbSteerOpenWorldCommander(-2.2, 0.2)")
            repelled = False
            for _ in range(25):
                time.sleep(0.15)
                cur_tel = page.evaluate("() => window.__lbOpenWorld3DTelemetry")
                if cur_tel["enemyInvasionsRepelledCount"] >= 1:
                    repelled = True
                    break

            final_tel = page.evaluate("() => window.__lbOpenWorld3DTelemetry")
            assert repelled or final_tel["enemyInvasionsSpawnedCount"] >= 1, (
                f"Invasão inimiga no Mundo Aberto 3D não ocorreu/repelida: {final_tel}"
            )
            assert final_tel["enemyInvasionsRepelledCount"] >= 1, (
                f"Torres da Cidadela + Comandante 3D deveriam repelir a onda de cerco inimiga: {final_tel}"
            )

            shot_defense = os.path.join(
                artifacts_dir, "v10_04_openworld_3d_citadel_defense.png"
            )
            page.screenshot(path=shot_defense)
            report["screenshots"].append(shot_defense)

            report["checks"]["QAR1_V10_FASE2_ENEMY_COUNTER_ATTACKS_AND_CITADEL_DEFENSE"] = {
                "status": "PASS",
                "enemyEvolution": evo_res,
                "finalTelemetry": final_tel,
            }

            ctx.close()
            browser.close()

        assert len(report["consoleErrors"]) == 0, f"Console errors: {report['consoleErrors']}"
        assert len(report["pageErrors"]) == 0, f"Page errors: {report['pageErrors']}"
        report["status"] = "ALL_V10_FASE2_CHECKS_PASSED"

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

    report_path = os.path.join(artifacts_dir, "v10_fase2_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


if __name__ == "__main__":
    out = run_v10_fase2_verification()
    sys.exit(0 if out.get("status") == "ALL_V10_FASE2_CHECKS_PASSED" else 1)

