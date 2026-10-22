import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")


def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def wait_for_http(url: str, timeout_sec: float = 30.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.4)
    return False


def launch_browser(p):
    try:
        return p.chromium.launch(headless=True)
    except Exception:
        return p.chromium.launch(channel="msedge", headless=True)


def run_logic_tetris_e2e_suite() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    screenshots_dir = os.path.join(
        repo_root, "src", "games", "LogicTetris", "master-plan", "qa-screenshots"
    )
    os.makedirs(screenshots_dir, exist_ok=True)

    port = 5179
    server_proc = None
    if is_port_open("127.0.0.1", 5173):
        port = 5173
        print(f"[SERVER] Reutilizando servidor ativo na porta {port}.")
    elif not is_port_open("127.0.0.1", port):
        dist_index = os.path.join(repo_root, "dist", "index.html")
        if os.path.exists(dist_index):
            print(f"[SERVER] Iniciando Vite preview server (dist) na porta {port}...")
            cmd = f"npx vite preview --port {port} --strictPort"
        else:
            print(f"[SERVER] Iniciando Vite dev server na porta {port}...")
            cmd = f"npx vite --port {port} --strictPort"
        server_proc = subprocess.Popen(
            cmd,
            cwd=repo_root,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    base_url = f"http://localhost:{port}"
    if not wait_for_http(f"{base_url}/", timeout_sec=35.0):
        if server_proc:
            server_proc.terminate()
        raise RuntimeError(f"Servidor não respondeu em {base_url}/ dentro do tempo limite.")

    console_errors: list[str] = []
    page_errors: list[str] = []
    telemetry_report: dict = {
        "suite": "Logic Tetris (Genesis Edition) — QAR1 / SIT / UAT E2E Suite",
        "baseUrl": base_url,
        "checks": {},
        "screenshots": [],
        "consoleErrors": [],
        "pageErrors": [],
    }

    try:
        with sync_playwright() as p:
            browser = launch_browser(p)

            # =========================================================================
            # PARTE 1: DESKTOP VIEWPORT (1440x900) — PORTAL, BAB, 3 MODOS & 3 MILAGRES
            # =========================================================================
            desktop_ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = desktop_ctx.new_page()

            def on_console(msg):
                if msg.type == "error":
                    console_errors.append(f"[DESKTOP CONSOLE ERROR] {msg.text}")

            def on_page_error(err):
                page_errors.append(f"[DESKTOP PAGE ERROR] {str(err)}")

            page.on("console", on_console)
            page.on("pageerror", on_page_error)

            # 1.1 Navegação Portal (/jogos -> /jogos/logic-tetris) [Melhoria 09-D]
            print("[1/8] Testando navegação pelo Portal (/jogos -> /jogos/logic-tetris)...")
            page.goto(f"{base_url}/jogos", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector('a[href="/jogos/logic-tetris"]', timeout=20000)
            games_menu_text = page.content()
            assert "5 Jogos" in games_menu_text, "GamesMenu deve exibir '5 Jogos'"
            assert "Logic Tetris · Genesis Edition" in games_menu_text, (
                "Card do Logic Tetris não encontrado em /jogos"
            )

            tetris_link = page.locator('a[href="/jogos/logic-tetris"]').first
            assert tetris_link.is_visible(), "Link para /jogos/logic-tetris deve estar visível"
            tetris_link.click()
            page.wait_for_url("**/jogos/logic-tetris", timeout=15000)
            page.wait_for_selector('[data-testid="logic-tetris-page"]', timeout=20000)
            telemetry_report["checks"]["portalNavigationToLogicTetris"] = "PASS"

            # 1.2 Verificação da Página Educacional BAB & 8 Lentes [Melhoria 08-A / 09-C]
            print("[2/8] Auditando estrutura BAB, 8 Lentes e layout Desktop (1440x900)...")
            assert page.locator('[data-testid="bab-before-after-section"]').is_visible()
            assert page.locator('[data-testid="bab-lenses-bridge-section"]').is_visible()
            assert page.locator('[data-testid="btn-focus-arena"]').is_visible()

            bab_lens_cards = page.locator('[data-testid^="bridge-lesson-link-"]').count()
            assert bab_lens_cards == 8, f"Esperados 8 links de lentes BAB, encontrados {bab_lens_cards}"

            desktop_overflow = page.evaluate(
                "() => document.documentElement.scrollWidth > window.innerWidth"
            )
            assert not desktop_overflow, "Não deve haver overflow horizontal em Desktop (1440x900)"

            shot_hub = os.path.join(screenshots_dir, "01_desktop_start_hub_and_arena.png")
            page.screenshot(path=shot_hub, full_page=False)
            telemetry_report["screenshots"].append(shot_hub)

            # 1.3 Teste dos 3 Modos no Start Hub + Faixa de Maestria + Modo Zen (Escudos Infinitos) + Mute [Melhoria 09-B / 10-B]
            print("[3/8] Testando seleção dos 3 Modos, Faixa de Maestria e persistência de Mute...")
            assert page.locator('[data-testid="start-hub-overlay"]').is_visible()
            assert page.locator('[data-testid="hub-mastery-banner"]').is_visible(), (
                "Faixa de Memória de Maestria (hub-mastery-banner) deve estar visível no Start Hub"
            )
            page.locator('[data-testid="mode-select-zen"]').click()
            page.locator('[data-testid="mode-select-master"]').click()
            page.locator('[data-testid="mode-select-zen"]').click()
            page.locator('[data-testid="btn-start-match"]').click()

            assert not page.locator('[data-testid="start-hub-overlay"]').is_visible()
            zen_shields_text = page.locator('[data-testid="hud-phoenix-shields"]').inner_text()
            assert "∞" in zen_shields_text, (
                f"Modo Zen deve exibir escudos infinitos '∞', recebido: {zen_shields_text}"
            )

            # Testar persistência de Mute em localStorage
            mute_btn = page.locator('[data-testid="btn-toggle-mute"]')
            mute_btn.click()
            muted_val = page.evaluate("() => localStorage.getItem('logic_tetris_v1_muted')")
            assert muted_val == "true", f"Esperado logic_tetris_v1_muted='true', recebido {muted_val}"
            mute_btn.click()
            unmuted_val = page.evaluate("() => localStorage.getItem('logic_tetris_v1_muted')")
            assert unmuted_val == "false", (
                f"Esperado logic_tetris_v1_muted='false', recebido {unmuted_val}"
            )
            telemetry_report["checks"]["threeModesAndMutePersistence"] = "PASS"

            # Alternar para o Modo Gênesis Arcade para testar os 3 Milagres Matemáticos e Fênix
            page.locator('[data-testid="btn-toggle-pause"]').click()
            assert page.locator('[data-testid="paused-overlay"]').is_visible()
            page.locator('[data-testid="btn-pause-return-hub"]').click()
            page.locator('[data-testid="mode-select-arcade"]').click()
            page.locator('[data-testid="btn-start-match"]').click()

            # Verificar boundingBox do Canvas em Desktop [Melhoria 09-C]
            canvas_el = page.locator('[data-testid="logic-tetris-canvas"]')
            canvas_box = canvas_el.bounding_box()
            assert canvas_box is not None, "Canvas deve possuir boundingBox válido"
            assert canvas_box["width"] > 200 and canvas_box["height"] > 350, (
                f"Dimensões inválidas do Canvas Desktop: {canvas_box}"
            )
            telemetry_report["checks"]["desktopCanvasBoundingBox"] = canvas_box

            # 1.4 Milagre #1: Metamorfose de Peça ([M] / Alquimia da Forma) [Melhoria 09-A]
            print("[4/8] Testando Milagre #1: Metamorfose da Peça em Queda ([M] -> Barra I)...")
            page.locator('[data-testid="alchemy-piece-I"]').click()
            modal = page.locator('[data-testid="math-intervention-modal"]')
            assert modal.is_visible(), "Modal de intervenção matemática deve abrir ao clicar em Peça I"

            lens_badge = page.locator('[data-testid="modal-lens-badge"]').inner_text()
            math_expr = page.locator('[data-testid="modal-math-expression"]').inner_text()
            guiding_light = page.locator('[data-testid="modal-guiding-light"]').inner_text()
            assert len(lens_badge) > 3 and len(math_expr) > 3 and len(guiding_light) > 5, (
                "Modal deve exibir Lente, Expressão e Luz Guia"
            )

            # Auditoria Computada de Contraste e Tipografia (AUD-09-01 / Melhoria 10-D)
            style_audit = page.evaluate("""() => {
                const choiceEl = document.querySelector('[data-testid="math-choice-label-0"]');
                const guideEl = document.querySelector('[data-testid="modal-guiding-light"]');
                const choiceStyle = choiceEl ? window.getComputedStyle(choiceEl) : null;
                const guideStyle = guideEl ? window.getComputedStyle(guideEl) : null;
                return {
                    choiceFontSizePx: choiceStyle ? parseFloat(choiceStyle.fontSize) : 0,
                    choiceColor: choiceStyle ? choiceStyle.color : '',
                    guideColor: guideStyle ? guideStyle.color : '',
                };
            }""")
            assert style_audit["choiceFontSizePx"] >= 20, (
                f"AUD-09-01 FALHOU: fontSize de math-choice-label-0 ({style_audit['choiceFontSizePx']}px) < 20px!"
            )
            assert "0.06" not in style_audit["choiceColor"], (
                f"AUD-09-01 FALHOU: colisão de cor .mt-2 detectada em math-choice-label-0: {style_audit['choiceColor']}"
            )
            assert "0.06" not in style_audit["guideColor"], (
                f"AUD-09-01 FALHOU: colisão de cor .mt-2 detectada em modal-guiding-light: {style_audit['guideColor']}"
            )
            telemetry_report["checks"]["typographyAndContrastAuditAUD0901"] = {
                "status": "PASS",
                **style_audit,
            }

            shot_morph = os.path.join(screenshots_dir, "02_math_morph_modal_desktop.png")
            page.screenshot(path=shot_morph, full_page=False)
            telemetry_report["screenshots"].append(shot_morph)

            # Clicar na alternativa correta na 1ª tentativa
            correct_btn = page.locator('[data-choice-correct="true"]').first
            correct_btn.click()
            assert not modal.is_visible(), "Modal deve fechar após acertar a conta de Metamorfose"
            telemetry_report["checks"]["miracleMorphFirstAttempt"] = {
                "status": "PASS",
                "expression": math_expr,
                "lens": lens_badge,
            }

            # 1.5 Milagre #2: Tapar Buraco ([B]) + Feedback Elástico de 2ª Chance (RT-09) [Melhoria 09-A]
            print("[5/8] Testando Milagre #2: Tapar Buraco ([B]) + Segunda Chance Elástica (RT-09)...")
            page.locator('[data-testid="btn-trigger-fill-hole"]').click()
            assert modal.is_visible(), "Modal de Tapar Buraco ([B]) deve abrir"

            # Clicar primeiro em um distrator incorreto para validar Feedback Elástico inline (RT-09)
            wrong_btn = page.locator('[data-choice-correct="false"]').first
            wrong_btn.click()

            # O modal NÃO deve fechar e deve exibir math-trap-diagnosis acolhedor!
            assert modal.is_visible(), (
                "RT-09 FALHOU: O modal fechou no 1º erro em vez de oferecer a 2ª chance elástica!"
            )
            trap_diag = page.locator('[data-testid="math-trap-diagnosis"]')
            assert trap_diag.is_visible(), (
                "Diagnóstico empático (math-trap-diagnosis) deve ficar visível após o 1º erro"
            )
            trap_text = trap_diag.inner_text()
            assert "Segunda Chance Ativa" in trap_text, (
                f"Texto de diagnóstico empático inesperado: {trap_text}"
            )

            shot_elastic = os.path.join(
                screenshots_dir, "03_elastic_bounce_second_chance_diagnosis.png"
            )
            page.screenshot(path=shot_elastic, full_page=False)
            telemetry_report["screenshots"].append(shot_elastic)

            # Agora clicar na resposta correta na 2ª chance e conquistar o milagre!
            page.locator('[data-choice-correct="true"]').first.click()
            assert not modal.is_visible(), (
                "Modal deve fechar e conceder o milagre ao acertar na 2ª tentativa!"
            )
            telemetry_report["checks"]["miracleFillHoleAndElasticSecondChance"] = {
                "status": "PASS",
                "trapDiagnosisSample": trap_text[:120],
            }

            # 1.6 Milagre #3: Salvação Fênix 142857 (Top-Out Second Wind) [Melhoria 09-A]
            print("[6/8] Empilhando peças até o topo para acionar o Protocolo Fênix 142857...")
            phoenix_triggered = False
            for _ in range(18):
                if modal.is_visible():
                    phoenix_triggered = True
                    break
                page.keyboard.press("Space")
                time.sleep(0.08)
                if modal.is_visible():
                    phoenix_triggered = True
                    break

            assert phoenix_triggered and modal.is_visible(), (
                "Protocolo Fênix 142857 (MATH_SECOND_WIND) deve disparar automaticamente ao atingir o topo!"
            )
            modal_text = modal.inner_text()
            assert "Protocolo Fênix 142857" in modal_text, (
                f"Modal de Second Wind deve exibir 'Protocolo Fênix 142857', recebido: {modal_text[:120]}"
            )

            shot_phoenix = os.path.join(screenshots_dir, "04_phoenix_142857_second_wind_modal.png")
            page.screenshot(path=shot_phoenix, full_page=False)
            telemetry_report["screenshots"].append(shot_phoenix)

            # Resolver a conta do Protocolo Fênix para purificar as 4 linhas inferiores!
            page.locator('[data-choice-correct="true"]').first.click()
            assert not modal.is_visible(), (
                "Modal do Protocolo Fênix deve fechar e continuar a partida após acertar a conta"
            )
            shields_after = page.locator('[data-testid="hud-phoenix-shields"]').inner_text()
            assert "×1" in shields_after, (
                f"Escudos Fênix devem decrementar de ×2 para ×1 após salvação, recebido: {shields_after}"
            )
            telemetry_report["checks"]["miraclePhoenixSecondWind142857"] = {
                "status": "PASS",
                "shieldsRemaining": shields_after,
            }

            # 1.7 Códice Pedagógico Retrátil ([H]) — Histórico + 8 Lentes [Melhoria 09-A]
            print("[7/8] Auditando Códice Pedagógico Heiss-Lab ([H]) — Diário da Sessão e 8 Lentes...")
            page.locator('[data-testid="btn-toggle-codex"]').click()
            codex_drawer = page.locator('[data-testid="logic-codex-drawer"]')
            assert codex_drawer.is_visible(), "Gaveta do Códice deve abrir ao clicar em btn-toggle-codex"

            codex_history_text = codex_drawer.inner_text()
            assert "Resolvido de Primeira!" in codex_history_text, (
                "Diário da Sessão no Códice deve registrar conquistas de 1ª Tentativa"
            )
            assert "2ª Chance Conquistada!" in codex_history_text, (
                "Diário da Sessão no Códice deve registrar conquistas de 2ª Chance"
            )

            page.locator('[data-testid="codex-tab-lenses"]').click()
            lenses_list = page.locator('[data-testid="codex-lenses-list"]')
            assert lenses_list.is_visible(), "Lista das 8 lentes no Códice deve estar visível"
            lenses_articles_count = lenses_list.locator("article").count()
            assert lenses_articles_count == 8, (
                f"Códice deve exibir exatamente 8 lentes, encontrado: {lenses_articles_count}"
            )

            shot_codex = os.path.join(screenshots_dir, "05_codex_drawer_8_lenses.png")
            page.screenshot(path=shot_codex, full_page=False)
            telemetry_report["screenshots"].append(shot_codex)

            page.locator('[data-testid="btn-close-codex"]').click()
            assert not codex_drawer.is_visible(), "Códice deve fechar ao clicar em btn-close-codex"
            telemetry_report["checks"]["codexHistoryAnd8Lenses"] = "PASS"

            desktop_ctx.close()

            # =========================================================================
            # PARTE 2: MOBILE VIEWPORT (390x844) — TOUCH PAD & BOUNDING BOX [Melhoria 09-C]
            # =========================================================================
            print("[8/8] Auditando Viewport Mobile (390x844), TouchControlPad e ausência de overflow...")
            mobile_ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
            )
            m_page = mobile_ctx.new_page()

            m_page.on(
                "console",
                lambda msg: console_errors.append(f"[MOBILE CONSOLE ERROR] {msg.text}")
                if msg.type == "error"
                else None,
            )
            m_page.on(
                "pageerror",
                lambda err: page_errors.append(f"[MOBILE PAGE ERROR] {str(err)}"),
            )

            m_page.goto(
                f"{base_url}/jogos/logic-tetris", wait_until="domcontentloaded", timeout=30000
            )
            m_page.wait_for_selector('[data-testid="btn-start-match"]', timeout=20000)
            m_page.locator('[data-testid="btn-start-match"]').click()

            m_canvas_box = m_page.locator('[data-testid="logic-tetris-canvas"]').bounding_box()
            assert m_canvas_box is not None, "Canvas Mobile deve possuir boundingBox válido"
            assert m_canvas_box["width"] > 200 and m_canvas_box["height"] > 350, (
                f"Dimensões inválidas do Canvas Mobile: {m_canvas_box}"
            )

            # Testar botões do TouchControlPad
            touch_pad = m_page.locator('[data-testid="touch-control-pad"]')
            assert touch_pad.is_visible(), "TouchControlPad deve estar visível no Mobile"
            m_page.locator('[data-testid="touch-left"]').click()
            m_page.locator('[data-testid="touch-rotate-cw"]').click()
            m_page.locator('[data-testid="touch-right"]').click()
            m_page.locator('[data-testid="touch-soft-drop"]').click()
            m_page.locator('[data-testid="touch-hold"]').click()

            mobile_overflow = m_page.evaluate(
                "() => document.documentElement.scrollWidth > window.innerWidth"
            )
            assert not mobile_overflow, "Não deve haver overflow horizontal no Mobile (390x844)"

            shot_mobile = os.path.join(screenshots_dir, "06_mobile_390x844_arena_and_touchpad.png")
            m_page.screenshot(path=shot_mobile, full_page=False)
            telemetry_report["screenshots"].append(shot_mobile)
            telemetry_report["checks"]["mobileViewportAndTouchControlPad"] = {
                "status": "PASS",
                "canvasBoundingBox": m_canvas_box,
                "horizontalOverflow": mobile_overflow,
            }

            mobile_ctx.close()
            browser.close()

        # Verificar Zero Console Errors e Zero Page Errors [Melhoria 09-D]
        telemetry_report["consoleErrors"] = console_errors
        telemetry_report["pageErrors"] = page_errors
        assert len(console_errors) == 0, f"Foram detectados erros de console: {console_errors}"
        assert len(page_errors) == 0, f"Foram detectados erros de página: {page_errors}"
        telemetry_report["overallVerdict"] = "PASS (100%)"

        report_path = os.path.join(screenshots_dir, "logic_tetris_e2e_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(telemetry_report, f, ensure_ascii=False, indent=2)

        print(f"\n✅ SUÍTE E2E LOGIC TETRIS (GENESIS EDITION) 100% APROVADA!")
        print(f"📄 Relatório JSON salvo em: {report_path}")
        return 0

    finally:
        if server_proc is not None:
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(server_proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                server_proc.terminate()


if __name__ == "__main__":
    sys.exit(run_logic_tetris_e2e_suite())
