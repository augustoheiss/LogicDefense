# -*- coding: utf-8 -*-
"""
Suite E2E Playwright — Logic Battle (Genesis Edition V2: Menos é Mais & Combate Visível)
Valida QAR1 (Contratos, Zero Console Error, Save Recovery .bak, Orçamento de Texto DOM),
SIT (Integração Portal /jogos, /jogos/logic-battle, Álbum, Códice, Mundo 1 <-> Mundo 2)
e UAT (3 Viewports: 360x740, 768x1024, 1440x900, Pegadinha + Resgate 3 níveis, Vai-Um, Fase BATTLE e Screenshots).
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 4185
BASE_URL = f"http://127.0.0.1:{PORT}"


def wait_for_server(url: str, timeout: float = 35.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def run_suite() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    evid_dir = os.path.join(
        repo_root, "src", "games", "LogicBattle", "master-plan", "evidencias"
    )
    os.makedirs(evid_dir, exist_ok=True)

    server_proc = subprocess.Popen(
        f"npx vite --host 127.0.0.1 --port {PORT} --strictPort",
        cwd=repo_root,
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    results = {
        "viewports": {},
        "functional": {},
        "screenshots": [],
        "consoleErrors": [],
        "pageErrors": [],
    }

    try:
        if not wait_for_server(f"{BASE_URL}/"):
            raise RuntimeError("Servidor Vite nao respondeu a tempo.")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # 1. UAT Multi-Viewport Check (360x740, 768x1024, 1440x900) + Orçamento de Texto V2
            for vp_name, width, height in [
                ("mobile_360x740", 360, 740),
                ("tablet_768x1024", 768, 1024),
                ("desktop_1440x900", 1440, 900),
            ]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=2 if width <= 768 else 1,
                )
                page = ctx.new_page()
                page.on("console", lambda msg: results["consoleErrors"].append(msg.text) if msg.type == "error" else None)
                page.on("pageerror", lambda err: results["pageErrors"].append(str(err)))

                page.goto(f"{BASE_URL}/jogos/logic-battle?seed=42", wait_until="domcontentloaded", timeout=30000)
                page.wait_for_selector('[data-testid="logic-battle-game"]', timeout=15000)
                time.sleep(0.35)

                layout_metrics = page.evaluate(
                    """() => {
                        const doc = document.documentElement;
                        const canvas = document.querySelector('[data-testid="logic-battle-canvas"]');
                        const hud = document.querySelector('[data-testid="logic-battle-hud"]');
                        const dock = document.querySelector('[data-testid="lb-tactical-dock"]');
                        const cRect = canvas ? canvas.getBoundingClientRect() : null;
                        const hudText = hud ? hud.innerText.replace(/\\s+/g, '') : '';
                        const dockText = dock ? dock.innerText.replace(/\\s+/g, '') : '';
                        return {
                            scrollWidth: doc.scrollWidth,
                            innerWidth: window.innerWidth,
                            horizontalOverflowPx: Math.max(0, doc.scrollWidth - window.innerWidth),
                            canvasVisible: Boolean(cRect && cRect.width >= 200 && cRect.height >= 200),
                            hudVisible: Boolean(hud),
                            dockVisible: Boolean(dock),
                            hudTextLen: hudText.length,
                            dockTextLen: dockText.length,
                        };
                    }"""
                )
                assert layout_metrics["horizontalOverflowPx"] <= 2, f"Overflow horizontal em {vp_name}: {layout_metrics}"
                assert layout_metrics["canvasVisible"], f"Canvas invisivel em {vp_name}"
                assert layout_metrics["hudTextLen"] <= 45, f"HUD excedeu orcamento de texto V2 em {vp_name}: {layout_metrics}"
                assert layout_metrics["dockTextLen"] <= 15, f"Dock excedeu orcamento de texto V2 em {vp_name}: {layout_metrics}"
                results["viewports"][vp_name] = layout_metrics

                shot_path = os.path.join(evid_dir, f"v2_mundo1_{vp_name}.png")
                page.screenshot(path=shot_path)
                results["screenshots"].append(shot_path)
                ctx.close()

            # 2. Suite Funcional Completa (Mundo 1, Pegadinha, Resgate 3 Niveis, Album, Codice, Fase BATTLE, Mundo 2, Save .bak)
            ctx = browser.new_context(viewport={"width": 1280, "height": 860})
            page = ctx.new_page()
            page.on("console", lambda msg: results["consoleErrors"].append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda err: results["pageErrors"].append(str(err)))

            # 2.1 Menu de Jogos (/jogos) -> Card Logic Battle
            page.goto(f"{BASE_URL}/jogos", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector('a[href="/jogos/logic-battle"]', timeout=15000)
            assert page.locator('a[href="/jogos/logic-battle"]').count() >= 1, "Link /jogos/logic-battle ausente em /jogos"
            results["functional"]["gamesMenuCard"] = "PASS"

            # 2.2 Carregar Logic Battle com seed determinística 42 e debug=1
            page.goto(f"{BASE_URL}/jogos/logic-battle?seed=42&debug=1", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector('[data-testid="lb-debug-strip"]', timeout=15000)
            debug_text = page.locator('[data-testid="lb-debug-strip"]').inner_text()
            assert "SEED: 42" in debug_text, f"Seed 42 nao refletida no debug strip: {debug_text}"
            debug_lines = {
                line.split(":")[0].strip(): int(line.split(":")[1].strip().rstrip("%"))
                for line in debug_text.splitlines()
                if ":" in line
            }
            assert 80 <= debug_lines.get("ORACLE BEST", 0) <= 220, f"ORACLE BEST fora da janela calibrada [80, 220]: {debug_text}"
            assert debug_lines.get("ORACLE WORST", 999) < debug_lines.get("ENEMY", 0), f"ORACLE WORST >= ENEMY: {debug_text}"
            results["functional"]["deterministicSeed42"] = debug_text

            # Recarregar sem debug=1 para capturar evidencias visuais limpas de jogador
            page.goto(f"{BASE_URL}/jogos/logic-battle?seed=42", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector('[data-testid="logic-battle-game"]', timeout=15000)

            # 2.3 Alternar Pausa, Modo Calmo e Notação Científica
            page.click('[data-testid="lb-toggle-pause"]')
            assert "Retomar" in page.locator('[data-testid="lb-toggle-pause"]').inner_text()
            page.click('[data-testid="lb-toggle-pause"]')
            page.click('[data-testid="lb-toggle-calm"]')
            assert "ON" in page.locator('[data-testid="lb-toggle-calm"]').inner_text()
            page.click('[data-testid="lb-toggle-calm"]')
            page.click('[data-testid="lb-toggle-notation"]')
            page.click('[data-testid="lb-toggle-notation"]')
            results["functional"]["hudToggles"] = "PASS"

            # 2.4 Usar Luneta Tática no primeiro segmento e validar prévia nos botões da Barra Tática
            page.click('[data-testid="lb-luneta-btn"]')
            page.wait_for_selector('[data-testid="lb-gate-luneta-preview-0"]', timeout=5000)
            results["functional"]["lunetaTatica"] = "PASS"

            # 2.5 Abrir Álbum de Pegadinhas (20 Pegadinhas + 6 Gêmeos) e Códice Heiss-Lab
            page.click('[data-testid="lb-open-album"]')
            page.wait_for_selector('[data-testid="lb-trap-album-drawer"]', timeout=5000)
            trap_cards_count = page.locator('[data-testid^="lb-album-card-"]').count()
            assert trap_cards_count == 20, f"Esperado 20 cards de pegadinha no Album, encontrado {trap_cards_count}"

            page.click('[data-testid="lb-album-tab-twins"]')
            twin_cards_count = page.locator('[data-testid^="lb-album-twin-"]').count()
            assert twin_cards_count == 6, f"Esperado 6 cards de gemeos no Album, encontrado {twin_cards_count}"

            page.click('[data-testid="lb-album-tab-traps"]')
            page.click('[data-testid="lb-album-codex-btn-T01"]')
            page.wait_for_selector('[data-testid="lb-codex-drawer"]', timeout=5000)
            codex_href = page.locator('[data-testid="lb-codex-full-page-link"]').get_attribute("href")
            assert codex_href and "/repositorio/" in codex_href, f"Href invalido no Codice: {codex_href}"
            page.click('[data-testid="lb-close-codex-btn"]')
            page.click('[data-testid="lb-close-album-btn"]')
            results["functional"]["albumAndCodex"] = "PASS"

            # 2.5.1 Validar tiro contínuo desde o início da ponte (progress < 0.5)
            active_projectiles_start = page.evaluate("() => window.__lbActiveProjectiles || 0")
            assert active_projectiles_start >= 1, (
                f"Exército deve atirar continuamente desde o início da ponte (projéteis ativos={active_projectiles_start})"
            )
            results["functional"]["continuousShootingFromStart"] = f"PASS ({active_projectiles_start} active projectiles)"

            # 2.6 Atravessar segmentos até encontrar Pegadinha ou Batalha Final
            trap_triggered = False
            redemption_tested = False

            for _ in range(20):
                if page.locator('[data-testid="lb-trap-alert-overlay"]').count() > 0:
                    trap_triggered = True
                    overlay_pe = page.evaluate(
                        """() => {
                          const el = document.querySelector('[data-testid="lb-trap-alert-overlay"]');
                          return el ? getComputedStyle(el).pointerEvents : 'auto';
                        }"""
                    )
                    assert overlay_pe == "none", f"TrapAlertOverlay deve ser não-bloqueante (pointer-events: none), encontrado {overlay_pe}"
                    results["functional"]["nonBlockingTrapFlow"] = "PASS (pointer-events: none, zero forced pause)"
                    assert page.locator('[data-testid="lb-ghost-rewind-banner"]').count() > 0, "Banner Ghost Rewind ausente no TrapAlertOverlay"
                    page.click('[data-testid="lb-trap-redeem-now-btn"]')
                    page.wait_for_selector('[data-testid="lb-redemption-modal"]', timeout=5000)

                    # Testar Andaime Vygotskiano: clicar nas opções até acertar (sem nunca perder a ficha!)
                    for c_id in ["c1", "c2", "c3"]:
                        btn = page.locator(f'[data-testid="lb-redemption-choice-{c_id}"]')
                        if btn.count() > 0 and page.locator('[data-testid="lb-redemption-modal"]').count() > 0:
                            btn.click()
                            time.sleep(0.1)
                    redemption_tested = True
                    break

                if (
                    page.locator('[data-testid="lb-battle-overlay-victory"]').count() > 0
                    or page.locator('[data-testid="lb-battle-overlay-defeat"]').count() > 0
                ):
                    break

                gate0 = page.locator('[data-testid="lb-gate-choice-0"]')
                if gate0.count() > 0:
                    gate0.click()
                    time.sleep(0.08)

            # Continuar atravessando até a Batalha Final caso tenha saído após testar a pegadinha
            legion_shot_saved = False
            for step_i in range(32):
                if (
                    page.locator('[data-testid="lb-battle-overlay-victory"]').count() > 0
                    or page.locator('[data-testid="lb-battle-overlay-defeat"]').count() > 0
                ):
                    break
                if page.locator('[data-testid="lb-trap-alert-overlay"]').count() > 0:
                    page.click('[data-testid="lb-trap-continue-bridge-btn"]')
                if page.locator('[data-testid="lb-redemption-modal"]').count() > 0:
                    page.click('[data-testid="lb-redemption-close-btn"]')
                if step_i == 4 and not legion_shot_saved:
                    legion_shot = os.path.join(evid_dir, "v2_mundo1_legiao_com_estandartes.png")
                    page.screenshot(path=legion_shot)
                    results["screenshots"].append(legion_shot)
                    legion_shot_saved = True
                gate1 = page.locator('[data-testid="lb-gate-choice-1"]')
                if gate1.count() > 0 and gate1.is_visible():
                    gate1.click(force=True)
                    time.sleep(0.08)

            # Aguardar o Combate Visível (Fase BATTLE) concluir (com fast-forward 3x via pointerdown)
            time.sleep(0.35)
            battle_shot = os.path.join(evid_dir, "v2_mundo1_combate_visivel.png")
            page.screenshot(path=battle_shot)
            results["screenshots"].append(battle_shot)

            page.dispatch_event('[data-testid="logic-battle-run-stage"]', "pointerdown")
            for _ in range(30):
                if (
                    page.locator('[data-testid="lb-battle-overlay-victory"]').count() > 0
                    or page.locator('[data-testid="lb-battle-overlay-defeat"]').count() > 0
                ):
                    break
                time.sleep(0.15)
            page.dispatch_event('[data-testid="logic-battle-run-stage"]', "pointerup")

            battle_reached = (
                page.locator('[data-testid="lb-battle-overlay-victory"]').count() > 0
                or page.locator('[data-testid="lb-battle-overlay-defeat"]').count() > 0
            )
            assert battle_reached, "Nao alcancou o overlay de Batalha Final apos o Combate Visivel"
            # SIT-06: lb-tactical-dock deve estar desmontado quando o resultado aparece
            assert page.locator('[data-testid="lb-tactical-dock"]').count() == 0, (
                "SIT-06: lb-tactical-dock nao deve continuar montado sob o modal de resultado"
            )
            # R1-08: HUD nao deve conter botoes extras de atalho dentro do <header data-testid="logic-battle-hud">
            hud_extra_btns = page.locator('[data-testid="logic-battle-hud"] [data-testid="lb-toggle-calm"]').count()
            assert hud_extra_btns == 0, "R1-08: lb-toggle-calm nao deve ficar dentro do header logic-battle-hud"
            results["functional"]["runAndTrapFlow"] = {
                "trapTriggered": trap_triggered,
                "redemptionTested": redemption_tested,
                "battleReached": battle_reached,
                "sit06DockUnmountedOnOverlay": True,
                "r108CleanHudHeader": True,
            }

            # Fechar overlay de batalha indo para o Mundo 2 (O Reino)
            page.click('[data-testid="lb-battle-go-realm-btn"]')
            page.wait_for_selector('[data-testid="logic-battle-realm-stage"]', timeout=5000)
            time.sleep(0.25)
            realm_shot = os.path.join(evid_dir, "v2_mundo2_reino_desktop.png")
            page.screenshot(path=realm_shot)
            results["screenshots"].append(realm_shot)

            # 2.6b Testar Bioma de 3 Faixas (Deserto dos Decimais) e invariante de 3 botões na Barra Tática
            page.click('[data-testid="lb-biome-btn-deserto_decimais"]')
            page.wait_for_selector('[data-testid="lb-lane-choice-grid"]', timeout=5000)
            lane_btns_3 = page.locator('[data-testid^="lb-gate-choice-"]').count()
            assert lane_btns_3 == 3, f"Esperado 3 faixas no bioma deserto_decimais, encontrado {lane_btns_3}"
            results["functional"]["threeLaneBiomeCardinality"] = "PASS"

            # Voltar ao Mundo 2 para testar Mapa e Cidadela
            page.click('[data-testid="lb-tab-world-realm"]')
            page.wait_for_selector('[data-testid="logic-battle-realm-stage"]', timeout=5000)

            # 2.7 Mundo 2: Mapa de 12 Províncias, Cidadela e Upgrade
            region_nodes = page.locator('[data-testid^="lb-region-node-"]').count()
            assert region_nodes == 12, f"Esperado 12 nos de regiao no SVG do Mundo 2, encontrado {region_nodes}"
            building_cards = page.locator('[data-testid^="lb-building-card-"]').count()
            assert building_cards == 5, f"Esperado 5 construcoes na Cidadela, encontrado {building_cards}"

            academia_btn = page.locator('[data-testid="lb-upgrade-btn-academia"]')
            if not academia_btn.is_disabled():
                academia_btn.click()
            results["functional"]["realmAndCitadel"] = "PASS"

            # 2.7b V4: Verificar as 6 Engines + Execução Contínua desde t=0s + Movimento Suave sem Teletransporte + Serpente Toroidal
            engine_btns = page.locator('[data-testid^="lb-engine-btn-"]').count()
            assert engine_btns == 6, f"Esperado 6 engines no seletor do Reino, encontrado {engine_btns}"
            for eng_id in ["cerco_torres", "forte_bandeira", "pedreira_rei", "arena_ondas", "serpente_numeros"]:
                page.click(f'[data-testid="lb-engine-btn-{eng_id}"]')
                page.wait_for_selector('[data-testid="lb-active-engine-badge"]', timeout=5000)
                time.sleep(0.25)

                # UAT-01 / UAT-02: Tiro contínuo desde t=0s sem exigir clique em placa matemática
                active_proj_eng = page.evaluate("() => window.__lbActiveProjectiles || 0")
                assert active_proj_eng >= 1, f"Engine {eng_id} deve atirar continuamente desde t=0s"

                # SIT-05: HUD sincronizado com a forca inicial do exercito
                hud_army_txt = page.locator('[data-testid="lb-current-army-value"]').inner_text().strip()
                assert len(hud_army_txt) >= 1, f"SIT-05: HUD army vazio na engine {eng_id}"

                if eng_id == "serpente_numeros":
                    # UAT-04: Minimapa toroidal 64x64, 3 corações e joystick 360° presentes
                    assert page.locator('[data-testid="lb-serpent-minimap"]').count() == 1, "UAT-04: lb-serpent-minimap ausente"
                    assert page.locator('[data-testid="lb-serpent-hearts"]').count() == 1, "UAT-04: lb-serpent-hearts ausente"
                    assert page.locator('[data-testid="lb-serpent-joystick"]').count() == 1, "UAT-04: lb-serpent-joystick ausente"
                    serp_shot = os.path.join(evid_dir, "v4_engine_serpente_labirinto.png")
                    page.screenshot(path=serp_shot)
                    results["screenshots"].append(serp_shot)

                # Verificar Movimento Suave em passos na tela (sem teletransporte!)
                pos0 = page.evaluate("() => window.__lbHeroPos ? {...window.__lbHeroPos} : null")
                if page.locator('[data-testid="lb-gate-choice-0"]').count() > 0:
                    page.click('[data-testid="lb-gate-choice-0"]')
                if page.locator('[data-testid="lb-gate-choice-1"]').count() > 0 and eng_id != "serpente_numeros":
                    page.click('[data-testid="lb-gate-choice-1"]')
                pos1 = page.evaluate("() => window.__lbHeroPos ? {...window.__lbHeroPos} : null")
                time.sleep(0.45)
                pos2 = page.evaluate("() => window.__lbHeroPos ? {...window.__lbHeroPos} : null")

                eng_shot_v5 = os.path.join(evid_dir, f"v5_engine_{eng_id}_25d.png")
                page.screenshot(path=eng_shot_v5)
                results["screenshots"].append(eng_shot_v5)
                if pos0 and pos1 and pos2:
                    step_delta = ((pos1["x"] - pos0["x"]) ** 2 + (pos1["y"] - pos0["y"]) ** 2) ** 0.5
                    max_allowed_instant_step = 1.8 if eng_id == "serpente_numeros" else 0.35
                    assert step_delta <= max_allowed_instant_step, (
                        f"Movimento em {eng_id} nao pode teletransportar instantaneamente (step_delta={step_delta:.3f})"
                    )

                if eng_id == "cerco_torres":
                    # Caminhar pelas 3 ondas em cerco_torres até concluir a partida e validar SIT-06 + SIT-07
                    for _ in range(18):
                        if (
                            page.locator('[data-testid="lb-battle-overlay-victory"]').count() > 0
                            or page.locator('[data-testid="lb-battle-overlay-defeat"]').count() > 0
                        ):
                            break
                        if page.locator('[data-testid="lb-gate-choice-0"]').count() > 0:
                            page.click('[data-testid="lb-gate-choice-0"]')
                        time.sleep(0.16)
                    assert page.locator('[data-testid="lb-tactical-dock"]').count() == 0, (
                        "SIT-06: lb-tactical-dock deve desmontar ao concluir engine arcade"
                    )
                    page.click('[data-testid="lb-battle-go-realm-btn"]')
                else:
                    if page.locator('[data-testid="lb-battle-go-realm-btn"]').count() > 0:
                        page.click('[data-testid="lb-battle-go-realm-btn"]')
                    else:
                        page.click('[data-testid="lb-tab-world-realm"]')

                page.wait_for_selector('[data-testid="logic-battle-realm-stage"]', timeout=5000)
            page.click('[data-testid="lb-engine-btn-ponte_portoes"]')
            page.wait_for_selector('[data-testid="logic-battle-run-stage"]', timeout=5000)
            results["functional"]["sixEnginesPlayable"] = "PASS (smooth non-teleporting steps + real-time action + serpent torus)"

            # 2.8 Resiliência de Save Corrompido (.bak recovery)
            page.evaluate(
                """() => {
                    const valid = localStorage.getItem('logicBattle.save.v1');
                    if (valid) {
                        localStorage.setItem('logicBattle.save.v1.bak', valid);
                    }
                    localStorage.setItem('logicBattle.save.v1', '{corrupted_json_syntax');
                }"""
            )
            page.reload(wait_until="domcontentloaded")
            page.wait_for_selector('[data-testid="logic-battle-game"]', timeout=10000)
            page.wait_for_selector('[data-testid="lb-backup-recovered-strip"]', timeout=5000)
            recovered_raw = page.evaluate("() => localStorage.getItem('logicBattle.save.v1')")
            recovered_obj = json.loads(recovered_raw)
            assert recovered_obj["version"] == 1, "Falha ao restaurar save v1 a partir do .bak"
            results["functional"]["corruptedSaveRecovery"] = "PASS"

            ctx.close()
            browser.close()

        assert len(results["consoleErrors"]) == 0, f"Erros de console detectados: {results['consoleErrors']}"
        assert len(results["pageErrors"]) == 0, f"Erros de pagina detectados: {results['pageErrors']}"
        results["status"] = "ALL_E2E_SUITES_PASSED"
        return results

    finally:
        if os.name == "nt":
            subprocess.run(
                f"taskkill /F /T /PID {server_proc.pid}",
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except Exception:
                server_proc.kill()


if __name__ == "__main__":
    out = run_suite()
    print(json.dumps(out, indent=2, ensure_ascii=False))
    sys.exit(0)
