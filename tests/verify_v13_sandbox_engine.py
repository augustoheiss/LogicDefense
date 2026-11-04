# -*- coding: utf-8 -*-
"""
tests/verify_v13_sandbox_engine.py
Auditoria E2E Playwright do LogicBattle V13 (Unified 3D Voxel Sandbox Engine):
1. Escala canônica 48x12x48 Voxels renderizada via THREE.InstancedMesh (instancedVoxelCount > 500).
2. Alternância Diegética por Bloco-Portal Físico (Stepping-Block Portal):
   - Pisar no Bloco-Portal dispara a animação 3D (portalTransitionActive === True) e alterna entre
     as diferentes Engines e Bases compartilhando a mesma Carteira (sharedWalletBalance).
3. 100% dos Minigames (ponte_portoes, cerco_torres, forte_bandeira, pedreira_rei, arena_ondas,
   serpente_numeros) e a Base Cidadela (realm) compartilham o mesmo motor 3D Voxel Sandbox.
4. Pincel Voxel Volumétrico (Width × Height × Depth), Combate 3D (Sword/Dash/Jump/Hoverboard)
   e preservação de hudTextLen <= 45 e dockTextLen <= 15.
"""

import os
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 4199
BASE_URL = f"http://127.0.0.1:{PORT}/jogos/logic-battle?seed=42"
ROOT_URL = f"http://127.0.0.1:{PORT}/"


def is_server_running(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


def wait_for_server(url: str, timeout: float = 35.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_server_running(url):
            return True
        time.sleep(0.35)
    return False


def run_audit() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    spawned_proc = None
    if not is_server_running(ROOT_URL):
        spawned_proc = subprocess.Popen(
            f"npx vite --host 127.0.0.1 --port {PORT} --strictPort",
            cwd=repo_root,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    try:
        if not wait_for_server(ROOT_URL):
            raise RuntimeError(f"Servidor Vite em {ROOT_URL} nao respondeu a tempo.")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()

            print(f"[V13-AUDIT] Abrindo {BASE_URL} ...")
            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_selector("[data-testid='logic-battle-game']", timeout=15000)
            time.sleep(1.2)

            # 1. Verificar orçamentos de texto minimalistas na HUD e no Dock
            hud_text = page.locator(".lb-minimal-hud").inner_text()
            dock_text = page.locator("[data-testid='lb-tactical-dock']").inner_text()
            hud_len = len(hud_text.strip())
            dock_len = len(dock_text.strip())
            print(f"[V13-AUDIT] hudTextLen={hud_len} (<=45), dockTextLen={dock_len} (<=15)")
            assert hud_len <= 45, f"hudTextLen excedeu 45: {hud_len} ({hud_text!r})"
            assert dock_len <= 15, f"dockTextLen excedeu 15: {dock_len} ({dock_text!r})"

            # 2. Verificar Telemetria Inicial do Sandbox 3D na Ponte dos Portões (48x12x48 InstancedMesh)
            sbx_init = page.evaluate("() => window.__lbSandboxTelemetry")
            print("[V13-AUDIT] Telemetria Sandbox inicial (ponte_portoes):", sbx_init)
            assert sbx_init is not None, "__lbSandboxTelemetry não encontrada na Ponte!"
            assert sbx_init["gridDimensions"] == "48x12x48", (
                f"Dimensão incorreta: {sbx_init['gridDimensions']}"
            )
            assert sbx_init["instancedVoxelCount"] > 500, (
                f"Poucos voxels instanciados: {sbx_init['instancedVoxelCount']}"
            )
            assert sbx_init["steppingPortalsCount"] == 7, (
                f"Esperados 7 Blocos-Portais: {sbx_init['steppingPortalsCount']}"
            )
            wallet_before = sbx_init["sharedWalletBalance"]

            # 3. Testar Voxel Brush (Width × Height × Depth) e compressão RLE
            brush_res = page.evaluate(
                "() => window.__lbApplySandboxVoxelBrush(3, 2, 3, 6, 'ADD')"
            )
            print("[V13-AUDIT] Resultado do Voxel Brush (3x2x3):", brush_res)
            assert brush_res["terrainVersion"] >= 2
            assert brush_res["rleLength"] > 20

            # 4. Testar Ações de Combate 3D (Sword Slash, Dash, Jump, Hoverboard)
            page.evaluate("() => window.__lbTriggerSandboxCombatAction('sword')")
            page.evaluate("() => window.__lbTriggerSandboxCombatAction('dash')")
            page.evaluate("() => window.__lbTriggerSandboxCombatAction('jump')")
            page.evaluate("() => window.__lbTriggerSandboxCombatAction('hoverboard')")
            time.sleep(0.1)
            sbx_combat = page.evaluate("() => window.__lbSandboxTelemetry")
            print(
                "[V13-AUDIT] Combate 3D:",
                {
                    "swordSlashCount": sbx_combat["swordSlashCount"],
                    "dashCount": sbx_combat["dashCount"],
                    "jumpCount": sbx_combat["jumpCount"],
                    "hoverboardActive": sbx_combat["hoverboardActive"],
                },
            )
            assert sbx_combat["swordSlashCount"] >= 1
            assert sbx_combat["dashCount"] >= 1
            assert sbx_combat["hoverboardActive"] is True

            # 5. Testar Transição Diegética por Bloco-Portal (Stepping-Block Portal Transition)
            #    para TODAS as outras Engines e Base, verificando a Animação 3D e os Gráficos 3D Voxel Unificados!
            zones_to_visit = [
                ("cerco_torres", "run"),
                ("forte_bandeira", "run"),
                ("pedreira_rei", "run"),
                ("arena_ondas", "run"),
                ("serpente_numeros", "run"),
                ("cidadela_realm", "realm"),
            ]

            for target_zone, expected_world in zones_to_visit:
                step_res = page.evaluate(
                    f"() => window.__lbStepOnSandboxPortal('{target_zone}')"
                )
                print(f"[V13-AUDIT] Pisou no Bloco-Portal -> {target_zone}:", step_res)
                assert step_res["triggered"] is True, f"Falha ao pisar no portal {target_zone}"

                # Verifica que a animação de transição de portal está ativa imediatamente após pisar
                sbx_during = page.evaluate("() => window.__lbSandboxTelemetry")
                assert sbx_during["portalTransitionActive"] is True, (
                    f"Animação de transição não ativou para {target_zone}"
                )

                # Aguarda a conclusão da animação de travessia do Bloco-Portal (~750ms)
                time.sleep(0.95)
                sbx_after = page.evaluate("() => window.__lbSandboxTelemetry")
                print(
                    f"[V13-AUDIT] Chegou em {target_zone}:",
                    {
                        "zoneKey": sbx_after["zoneKey"],
                        "world": sbx_after["world"],
                        "activeEngineId": sbx_after["activeEngineId"],
                        "instancedVoxelCount": sbx_after["instancedVoxelCount"],
                        "sharedWalletBalance": sbx_after["sharedWalletBalance"],
                    },
                )
                assert sbx_after["zoneKey"] == target_zone, (
                    f"Esperava zoneKey={target_zone}, obteve {sbx_after['zoneKey']}"
                )
                assert sbx_after["world"] == expected_world, (
                    f"Esperava world={expected_world}, obteve {sbx_after['world']}"
                )
                assert sbx_after["instancedVoxelCount"] > 500, (
                    f"Minigame {target_zone} não está renderizando a grade Voxel 3D!"
                )
                assert sbx_after["sharedWalletBalance"] > 0, (
                    f"Carteira compartilhada inválida ao cruzar portal: {sbx_after['sharedWalletBalance']}"
                )

            print("ALL_V13_SANDBOX_CHECKS_PASSED")
            browser.close()
    finally:
        if spawned_proc is not None:
            subprocess.call(
                f"taskkill /F /T /PID {spawned_proc.pid}",
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )


if __name__ == "__main__":
    try:
        run_audit()
    except Exception as exc:
        print(f"[V13-AUDIT-FAILED] {exc}", file=sys.stderr)
        sys.exit(1)
