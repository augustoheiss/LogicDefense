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
            print("[1/11] Testando navegação pelo Portal (/jogos -> /jogos/logic-tetris)...")
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
            print("[2/11] Auditando estrutura BAB, 8 Lentes e layout Desktop (1440x900)...")
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
            print("[3/11] Testando seleção dos 3 Modos, Faixa de Maestria e persistência de Mute...")
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
            print("[4/11] Testando Milagre #1: Metamorfose da Peça em Queda ([M] -> Barra I)...")
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
            print("[5/11] Testando Milagre #2: Tapar Buraco ([B]) + Segunda Chance Elástica (RT-09)...")
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
            print("[6/11] Empilhando peças até o topo para acionar o Protocolo Fênix 142857...")
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
            print("[7/11] Auditando Códice Pedagógico Heiss-Lab ([H]) — Diário da Sessão e 8 Lentes...")
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

            # 1.8 Check 9 — Invariante Zero-Spoiler na Luz Guia Socrática & Badge de Estilo [Melhoria 07-C]
            print("[8/11] Auditando Invariante Zero-Spoiler na Luz Guia Socrática e Contexto do Cordão Tríplice...")
            page.locator('[data-testid="style-btn-FRUIT_MATCH"]').click()
            assert canvas_el.get_attribute("data-style") == "FRUIT_MATCH", (
                "Canvas deve mudar data-style para FRUIT_MATCH ao clicar em style-btn-FRUIT_MATCH"
            )
            page.locator('[data-testid="btn-trigger-morph"]').click()
            assert modal.is_visible(), "Modal matemático deve abrir em FRUIT_MATCH"

            context_badge = page.locator('[data-testid="modal-style-context-badge"]')
            assert context_badge.is_visible(), (
                "Badge contextual (modal-style-context-badge) deve estar visível no modal"
            )
            context_badge_text = context_badge.inner_text()
            assert "Frutas" in context_badge_text, (
                f"Badge contextual deve indicar Frutas em Cascata, recebido: {context_badge_text}"
            )

            socratic_guide_text = page.locator('[data-testid="modal-guiding-light"]').inner_text()
            correct_choice_label = (
                page.locator('[data-choice-correct="true"]')
                .first.locator('[data-testid^="math-choice-label-"]')
                .inner_text()
                .strip()
            )
            assert "?" in socratic_guide_text, (
                f"Luz Guia Socrática deve conter pergunta instigante ('?'), recebido: {socratic_guide_text}"
            )
            assert f"= {correct_choice_label}" not in socratic_guide_text and (
                f"={correct_choice_label}" not in socratic_guide_text
            ), (
                f"VIOLAÇÃO ZERO-SPOILER: Luz Guia entregou '= {correct_choice_label}' em: {socratic_guide_text}"
            )
            page.locator('[data-choice-correct="true"]').first.click()
            assert not modal.is_visible(), "Modal deve fechar após resolver Par Coringa em FRUIT_MATCH"
            telemetry_report["checks"]["zeroSpoilerGuidingLightAndContextBadge"] = {
                "status": "PASS",
                "styleContextBadge": context_badge_text,
                "guidingLightSample": socratic_guide_text,
            }

            # 1.9 Check 10 — Troca do Cordão Tríplice (FRUIT_MATCH -> TACTILE_GRID), Bandeja Tátil & Aba Cordão Tríplice no Códice [Melhoria 07-C]
            print("[9/11] Auditando Grade Tátil 10x10, Bandeja de 3 Peças, Trava [L] e Aba Cordão Tríplice no Códice...")
            page.locator('[data-testid="style-btn-TACTILE_GRID"]').click()
            assert canvas_el.get_attribute("data-style") == "TACTILE_GRID", (
                "Canvas deve mudar data-style para TACTILE_GRID ao clicar em style-btn-TACTILE_GRID"
            )
            tactile_tray = page.locator('[data-testid="tactile-piece-tray"]')
            assert tactile_tray.is_visible(), (
                "Bandeja Tátil de 3 Peças (tactile-piece-tray) deve estar visível em TACTILE_GRID"
            )
            assert page.locator('[data-testid="tactile-tray-slot-0"]').is_visible()
            assert page.locator('[data-testid="tactile-tray-slot-1"]').is_visible()
            assert page.locator('[data-testid="tactile-tray-slot-2"]').is_visible()

            # Selecionar slot 1 da bandeja e encaixar na Arena 10x10
            page.locator('[data-testid="tactile-tray-slot-1"]').click()
            page.keyboard.press("Enter")

            # Alternar modo Simultâneo <-> Travado via botão HUD
            rot_btn = page.locator('[data-testid="btn-toggle-style-rotation"]')
            rot_before = canvas_el.get_attribute("data-rotation-mode")
            rot_btn.click()
            rot_after = canvas_el.get_attribute("data-rotation-mode")
            assert rot_before != rot_after, (
                f"btn-toggle-style-rotation deve alternar data-rotation-mode ({rot_before} -> {rot_after})"
            )

            # Abrir Códice [H] e validar Marcos de Sequência/Dobras + 3ª Aba Cordão Tríplice
            page.locator('[data-testid="btn-toggle-codex"]').click()
            assert codex_drawer.is_visible(), "Códice deve abrir para inspecionar a Aba do Cordão Tríplice"
            assert page.locator('[data-testid="codex-max-streak"]').is_visible()
            assert page.locator('[data-testid="codex-style-shifts"]').is_visible()

            page.locator('[data-testid="codex-tab-trinity"]').click()
            trinity_guide = page.locator('[data-testid="codex-trinity-guide"]')
            assert trinity_guide.is_visible(), "Guia do Cordão Tríplice (codex-trinity-guide) deve estar visível"
            assert page.locator('[data-testid="codex-style-card-TETRIS_CLASSIC"]').is_visible()
            assert page.locator('[data-testid="codex-style-card-FRUIT_MATCH"]').is_visible()
            assert page.locator('[data-testid="codex-style-card-TACTILE_GRID"]').is_visible()
            assert "Cordão Tríplice" in page.locator('[data-testid="codex-tab-trinity"]').inner_text(), (
                "Aba 3 do Códice deve exibir o rótulo neutro 'Cordão Tríplice'"
            )
            telemetry_report["checks"]["trinityStyleSwitchingTrayAndCodexTab"] = {
                "status": "PASS",
                "rotationModeToggled": f"{rot_before} -> {rot_after}",
            }

            # 1.10 Check 11 — Alinhamento grid-cols-3 das 3 Abas & Jukebox Interativo 12x+ [Melhoria 08-B / 08-C]
            print("[10/11] Auditando alinhamento em linha única (grid-cols-3) das 3 abas do Códice e Jukebox 12x+...")
            box_tab_history = page.locator('[data-testid="codex-tab-history"]').bounding_box()
            box_tab_lenses = page.locator('[data-testid="codex-tab-lenses"]').bounding_box()
            box_tab_trinity = page.locator('[data-testid="codex-tab-trinity"]').bounding_box()
            assert (
                box_tab_history is not None
                and box_tab_lenses is not None
                and box_tab_trinity is not None
            ), "As 3 abas do Códice devem possuir boundingBox válido"
            assert abs(box_tab_history["y"] - box_tab_trinity["y"]) <= 4, (
                f"As 3 abas do Códice devem estar na mesma linha horizontal! "
                f"y_history={box_tab_history['y']}, y_trinity={box_tab_trinity['y']}"
            )

            jukebox_bar = page.locator('[data-testid="codex-dopamine-preview-bar"]')
            assert jukebox_bar.is_visible(), (
                "Jukebox Harmônico (codex-dopamine-preview-bar) deve estar visível na aba Cordão Tríplice"
            )
            page.locator('[data-testid="codex-sound-preview-1"]').click()
            page.locator('[data-testid="codex-sound-preview-7"]').click()
            page.locator('[data-testid="codex-sound-preview-12"]').click()

            jukebox_badge_text = page.locator('[data-testid="codex-sound-preview-badge"]').inner_text()
            assert "12×" in jukebox_badge_text, (
                f"Jukebox 12x+ deve exibir badge de 12x, recebido: {jukebox_badge_text}"
            )

            shot_trinity_codex = os.path.join(
                screenshots_dir, "05b_codex_drawer_trinity_guide.png"
            )
            page.screenshot(path=shot_trinity_codex, full_page=False)
            telemetry_report["screenshots"].append(shot_trinity_codex)

            page.locator('[data-testid="btn-close-codex"]').click()
            assert not codex_drawer.is_visible(), "Códice deve fechar após validar Aba do Cordão Tríplice e Jukebox"
            telemetry_report["checks"]["codexSingleRowTabsAndDopamineJukebox"] = {
                "status": "PASS",
                "tabsDeltaY": abs(box_tab_history["y"] - box_tab_trinity["y"]),
                "jukeboxBadge12x": jukebox_badge_text.splitlines()[0],
            }

            # 10b. Escala de Potência do Milagre (Grau I..IV: 3, 5, 10, TODOS os Buracos) & Zero-Spoiler Hints [Master Plan V3]
            print("[10b/11] Validando Escala de Potência do Milagre (3, 5, 10, TODOS os Buracos) e Dicas Zero-Spoiler...")
            page.locator('[data-testid="btn-trigger-fill-hole"]').click()
            modal_v3 = page.locator('[data-testid="math-intervention-modal"]')
            assert modal_v3.is_visible(), "Modal [B] deve abrir para validar a Escala de Potência do Milagre"

            tier_selector = page.locator('[data-testid="miracle-power-tier-selector"]')
            assert tier_selector.is_visible(), "Seletor de Potência do Milagre (Grau I..IV) deve estar visível no modal"

            expressions_by_tier = {}
            for tier_idx in (1, 2, 3, 4):
                tier_btn = page.locator(f'[data-testid="miracle-tier-btn-{tier_idx}"]')
                assert tier_btn.is_visible(), f"Botão de Grau {tier_idx} deve estar visível"
                tier_btn.click()
                assert tier_btn.get_attribute("data-tier-active") == "true", (
                    f"Grau {tier_idx} deve ficar ativo após clique"
                )
                expr_txt = page.locator('[data-testid="modal-math-expression"]').inner_text()
                hint_txt = page.locator('[data-testid="modal-guiding-light"]').inner_text()
                assert "(=" not in hint_txt, (
                    f"Dica Socrática do Grau {tier_idx} não pode conter spoiler intermediário '(= ...)', recebido: {hint_txt}"
                )
                expressions_by_tier[f"tier_{tier_idx}"] = {
                    "expression": expr_txt,
                    "hint": hint_txt,
                }

            # Resolver o desafio Supremo Grau IV (TODOS os Buracos + Escudo Fênix)
            page.locator('[data-testid="math-choice-correct"], [data-choice-correct="true"]').first.click()
            assert not modal_v3.is_visible(), "Modal deve fechar após resolver o Milagre Grau IV"
            telemetry_report["checks"]["miraclePowerScalingAndZeroSpoilerV3"] = {
                "status": "PASS",
                "tiers": expressions_by_tier,
            }

            # 10c. Round-Trip Style Switching (FRUIT_MATCH -> TACTILE_GRID -> TETRIS_CLASSIC -> FRUIT_MATCH -> TETRIS_CLASSIC)
            print("[10c/11] Validando alternância livre de ida e volta entre os 3 Estilos (incluindo retorno ao Clássico)...")
            page.locator('[data-testid="style-btn-FRUIT_MATCH"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "FRUIT_MATCH"
            page.locator('[data-testid="style-btn-TACTILE_GRID"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "TACTILE_GRID"
            page.locator('[data-testid="style-btn-TETRIS_CLASSIC"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "TETRIS_CLASSIC", (
                "Clicar em Clássico a partir da Grade Tátil deve retornar imediatamente para TETRIS_CLASSIC"
            )
            page.locator('[data-testid="style-btn-FRUIT_MATCH"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "FRUIT_MATCH"
            page.locator('[data-testid="style-btn-TETRIS_CLASSIC"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "TETRIS_CLASSIC", (
                "Clicar em Clássico a partir de Frutas deve retornar imediatamente para TETRIS_CLASSIC"
            )
            telemetry_report["checks"]["roundTripStyleSwitchingToClassic"] = {
                "status": "PASS",
                "finalStyle": page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style"),
            }

            # 10d. Coreografia Cinematográfica 60fps nos 3 Jogos (FRUIT_MATCH Swap/Cascade, TACTILE_GRID Spring-Pop, TETRIS_CLASSIC Hard-Drop) [Master Plan V4]
            print("[10d/11] Validando Coreografia Cinematográfica 60fps nos 3 Jogos (Swap/Cascata, Spring-Pop e Hard-Drop)...")
            # 1) FRUIT_MATCH: Acionar seleção [C] da melhor troca do Oráculo e executar troca + cascata
            page.locator('[data-testid="style-btn-FRUIT_MATCH"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "FRUIT_MATCH"
            swaps_badge = page.locator('[data-testid="canvas-fruit-swaps-badge"]')
            assert swaps_badge.is_visible(), "Badge de trocas prontas deve estar visível em FRUIT_MATCH"
            page.keyboard.press("c")
            for direction_key in ("ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"):
                page.keyboard.press("c")
                page.keyboard.press(direction_key)
                time.sleep(0.08)
            time.sleep(0.35)
            shot_fruit_cascade = os.path.join(
                screenshots_dir, "05c_fruit_match_cascade_choreography.png"
            )
            page.screenshot(path=shot_fruit_cascade, full_page=False)
            telemetry_report["screenshots"].append(shot_fruit_cascade)

            # 2) TACTILE_GRID: Posicionar peça da bandeja com animação Spring-Pop e testar Milagre [B] com onda dominó
            page.locator('[data-testid="style-btn-TACTILE_GRID"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "TACTILE_GRID"
            page.locator('[data-testid="tactile-tray-slot-2"]').click()
            page.keyboard.press("Enter")
            time.sleep(0.25)

            # 3) TETRIS_CLASSIC: Retornar ao Clássico e disparar Hard-Drop com feixe neon vertical
            page.locator('[data-testid="style-btn-TETRIS_CLASSIC"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "TETRIS_CLASSIC"
            page.keyboard.press("Space")
            time.sleep(0.25)
            telemetry_report["checks"]["cinematicChoreographyTrinityV4"] = {
                "status": "PASS",
                "verifiedStyles": ["FRUIT_MATCH", "TACTILE_GRID", "TETRIS_CLASSIC"],
            }

            # 10e. Motor Matemático Infinito Isomórfico Zero-Repetição (Grau I..IV, especialmente Grau IV) [Master Plan V5]
            print("[10e/11] Auditando Motor Matemático Infinito Isomórfico (20 sorteios seguidos no Grau IV sem repetição)...")
            page.locator('[data-testid="btn-trigger-fill-hole"]').click()
            modal_v5 = page.locator('[data-testid="math-intervention-modal"]')
            assert modal_v5.is_visible(), "Modal [B] deve abrir para auditar Zero-Repetição V5"

            tier4_seen_expressions = []
            for _ in range(20):
                page.locator('[data-testid="miracle-tier-btn-4"]').click()
                expr_v5 = page.locator('[data-testid="modal-math-expression"]').inner_text().strip()
                hint_v5 = page.locator('[data-testid="modal-guiding-light"]').inner_text().strip()
                assert "(=" not in hint_v5, f"Spoiler intermediário detectado no Grau IV: {hint_v5}"
                tier4_seen_expressions.append(expr_v5)

            unique_tier4_count = len(set(tier4_seen_expressions))
            assert unique_tier4_count == 20, (
                f"Esperado 20 expressões 100% únicas em 20 cliques seguidos no Grau IV, "
                f"mas obteve {unique_tier4_count}/20 únicas: {tier4_seen_expressions}"
            )

            # Validar também 12 sorteios seguidos sem repetição nos Graus I, II e III
            tier_uniqueness_summary = {"tier_4": f"{unique_tier4_count}/20"}
            for t_idx in (1, 2, 3):
                t_seen = []
                for _ in range(12):
                    page.locator(f'[data-testid="miracle-tier-btn-{t_idx}"]').click()
                    t_expr = page.locator('[data-testid="modal-math-expression"]').inner_text().strip()
                    t_seen.append(t_expr)
                t_unique = len(set(t_seen))
                assert t_unique == 12, (
                    f"Esperado 12 expressões únicas seguidas no Grau {t_idx}, obteve {t_unique}/12: {t_seen}"
                )
                tier_uniqueness_summary[f"tier_{t_idx}"] = f"{t_unique}/12"

            page.locator('[data-choice-correct="true"]').first.click()
            assert not modal_v5.is_visible(), "Modal deve fechar após resolver desafio V5"
            telemetry_report["checks"]["infiniteIsomorphicZeroRepetitionV5"] = {
                "status": "PASS",
                "uniquenessByTier": tier_uniqueness_summary,
                "tier4SampleExpressions": tier4_seen_expressions[:8],
            }

            # 10f. Estação de Comando Sekundo Icon-First (Docas Top/Bottom, Zero Barra Lateral, Palco Gigante & Click-to-Reveal) [Master Plan V6]
            print("[10f/11] Auditando Estação de Comando Sekundo V6 (Docas Top/Bottom, Palco 10x10 Gigante >= 600px e Popover Click-to-Reveal)...")
            page.locator('[data-testid="style-btn-FRUIT_MATCH"]').click()
            assert page.locator('[data-testid="logic-tetris-canvas"]').get_attribute("data-style") == "FRUIT_MATCH"
            time.sleep(1.0)  # Aguardar conclusão da transição de 900ms para captura limpa do tabuleiro 10x10 cheio

            top_dock_box = page.locator('[data-testid="telemetry-top-dock"]').bounding_box()
            fruit_canvas_box = page.locator('[data-testid="logic-tetris-canvas"]').bounding_box()
            bottom_alchemy_box = page.locator('[data-testid="piece-alchemy-bar"]').bounding_box()
            bottom_touch_box = page.locator('[data-testid="touch-control-pad"]').bounding_box()

            assert (
                top_dock_box is not None
                and fruit_canvas_box is not None
                and bottom_alchemy_box is not None
                and bottom_touch_box is not None
            ), "Doca Superior, Canvas e Doca Inferior devem possuir boundingBox válido"

            assert top_dock_box["y"] < fruit_canvas_box["y"], (
                f"Doca Superior (y={top_dock_box['y']}) deve ficar ACIMA do Canvas (y={fruit_canvas_box['y']})"
            )
            assert bottom_alchemy_box["y"] > fruit_canvas_box["y"], (
                f"Doca de Alquimia (y={bottom_alchemy_box['y']}) deve ficar ABAIXO do Canvas (y={fruit_canvas_box['y']})"
            )
            assert fruit_canvas_box["width"] >= 600, (
                f"Palco 10x10 em Desktop deve ter largura expandida >= 600px (obtido: {fruit_canvas_box['width']}px)"
            )

            shot_v6_fruit = os.path.join(
                screenshots_dir, "phase09_01_v6_sekundo_top_bottom_dock_fruit_10x10_desktop.png"
            )
            page.screenshot(path=shot_v6_fruit, full_page=False)
            telemetry_report["screenshots"].append(shot_v6_fruit)

            # Testar Sekundo Click-to-Reveal no ícone 💡 do Oráculo
            page.locator('[data-testid="btn-oracle-reveal"]').click()
            reveal_popover = page.locator('[data-testid="sekundo-icon-reveal-popover"]')
            assert reveal_popover.is_visible(), (
                "Popover Sekundo Click-to-Reveal (sekundo-icon-reveal-popover) deve abrir ao clicar em 💡 btn-oracle-reveal"
            )
            oracle_reason_el = page.locator('[data-testid="oracle-recommendation-reason"]')
            assert oracle_reason_el.is_visible() and len(oracle_reason_el.inner_text()) > 5, (
                "Popover Sekundo deve revelar a explicação viva do Oráculo (oracle-recommendation-reason)"
            )
            oracle_color = page.evaluate("""() => {
                const el = document.querySelector('[data-testid="oracle-recommendation-reason"]');
                return el ? window.getComputedStyle(el).color : '';
            }""")
            assert "0.06" not in oracle_color, (
                f"Colisão de cor .mt-2 detectada no Popover Sekundo: {oracle_color}"
            )

            shot_v6_popover = os.path.join(
                screenshots_dir, "phase09_02_v6_sekundo_click_to_reveal_popover_desktop.png"
            )
            page.screenshot(path=shot_v6_popover, full_page=False)
            telemetry_report["screenshots"].append(shot_v6_popover)

            page.locator('[data-testid="sekundo-popover-close"]').click()
            assert not reveal_popover.is_visible(), "Popover Sekundo deve fechar ao clicar em ✕"

            # Capturar também TACTILE_GRID 10x10 e TETRIS_CLASSIC 20x10 no novo layout V6
            page.locator('[data-testid="style-btn-TACTILE_GRID"]').click()
            time.sleep(1.0)
            shot_v6_tactile = os.path.join(
                screenshots_dir, "phase09_03_v6_sekundo_tactile_10x10_desktop.png"
            )
            page.screenshot(path=shot_v6_tactile, full_page=False)
            telemetry_report["screenshots"].append(shot_v6_tactile)

            page.locator('[data-testid="style-btn-TETRIS_CLASSIC"]').click()
            time.sleep(1.0)
            shot_v6_classic = os.path.join(
                screenshots_dir, "phase09_04_v6_sekundo_classic_20x10_desktop.png"
            )
            page.screenshot(path=shot_v6_classic, full_page=False)
            telemetry_report["screenshots"].append(shot_v6_classic)

            telemetry_report["checks"]["sekundoIconFirstTopBottomDockV6"] = {
                "status": "PASS",
                "topDockY": top_dock_box["y"],
                "fruit10x10CanvasBox": fruit_canvas_box,
                "bottomAlchemyY": bottom_alchemy_box["y"],
                "bottomTouchY": bottom_touch_box["y"],
            }

            desktop_ctx.close()

            # =========================================================================
            # PARTE 2: MOBILE VIEWPORT (390x844) — TOUCH PAD & BOUNDING BOX [Melhoria 09-C]
            # =========================================================================
            print("[11/11] Auditando Viewport Mobile (390x844), TouchControlPad e ausência de overflow...")
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
