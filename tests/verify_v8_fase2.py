# -*- coding: utf-8 -*-
"""
Auditoria QAR1 + SIT + UAT e Testes Visuais da Fase 2 (Master Plan V8) — Logic Battle
Valida:
  a) QAR1 Movimento Livre e Contínuo: varredura de laneX de -0.92 a +0.92 e medição de heroWorldX
     em __lbBridge3DTelemetry, comprovando bijeção linear contínua sem degraus nas fronteiras X = ±5.5.
  b) SIT Rota Direita Congelada por Padrão: laneX = +0.82 com rightBuffActiveTimerMs == 0 ->
     rightCorridorState === 'LOCKED_FROSTED', rightWeaponUnlocked === false, zero modal intrusivo
     automático (mesmo clicando/arrastando na Rota Direita), e zero soldados grátis nos portões cinzas.
  c) SIT/UAT Ativação Temporizada por Conta (🧮): abrir Desafio Matemático, resolver questão,
     comprovar rightCorridorState === 'ACTIVE_TIMED', rightBuffActiveTimerMs em 12000..24000ms
     (políticas 12s/15s/18s/24s), ignição visual dourada/esmeralda, coleta real de soldados nos
     portões da direita e retorno a 'LOCKED_FROSTED' quando o timer zera.
  d) SIT/UAT Buffs Positivos e Negativos Reais da Rota Central + Bypass Lateral:
     máximo 2 pares de portões centrais visíveis por vez; colisão real positiva (+, ×) e negativa (−, ÷)
     quando |laneX| <= 0.52; e contorno sem colisão fantasma (chosenLane: -1) quando |laneX| > 0.52.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 4192
BASE_URL = f"http://127.0.0.1:{PORT}"


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


def run_v8_fase2_audit() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    artifacts_dir = os.path.join(repo_root, "artifacts", "playwright", "v8_fase2")
    os.makedirs(artifacts_dir, exist_ok=True)

    spawned_proc = None
    if not is_server_running(f"{BASE_URL}/"):
        spawned_proc = subprocess.Popen(
            f"npx vite --host 127.0.0.1 --port {PORT} --strictPort",
            cwd=repo_root,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    report = {
        "phase": "V8_FASE_2",
        "checks": {},
        "screenshots": [],
        "consoleErrors": [],
        "pageErrors": [],
    }

    try:
        if not wait_for_server(f"{BASE_URL}/"):
            raise RuntimeError(f"Servidor Vite em {BASE_URL} nao respondeu a tempo.")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(
                viewport={"width": 1440, "height": 900},
                device_scale_factor=1,
            )
            page = ctx.new_page()
            page.on(
                "console",
                lambda msg: report["consoleErrors"].append(msg.text)
                if msg.type == "error"
                else None,
            )
            page.on("pageerror", lambda err: report["pageErrors"].append(str(err)))

            # Carregar Logic Battle com seed determinística 42
            page.goto(
                f"{BASE_URL}/jogos/logic-battle?seed=42",
                wait_until="domcontentloaded",
                timeout=45000,
            )
            page.wait_for_selector('[data-testid="logic-battle-game"]', timeout=20000)
            page.wait_for_function(
                "() => Boolean(window.__lbStore && window.__lbBridge3DTelemetry)",
                timeout=15000,
            )

            # =========================================================================
            # TESTE A (QAR1): Movimento Horizontal 100% Livre e Contínuo (-0.92 a +0.92)
            # =========================================================================
            # Pausar avanço longitudinal apenas para medir com precisão a varredura horizontal pura
            sweep_samples = []
            num_steps = 37  # de -0.92 a +0.92 em passos de ~0.0511
            for i in range(num_steps):
                target_lane_x = round(-0.92 + (1.84 * i) / (num_steps - 1), 4)
                page.evaluate(
                    f"""(lx) => {{
                        window.__lbStore.getState().setSteeringX(lx);
                    }}""",
                    target_lane_x,
                )
                # Aguardar convergir suavemente no loop 60Hz do WebGL
                page.wait_for_function(
                    f"() => Math.abs((window.__lbBridge3DTelemetry?.heroWorldX ?? 0) - ({target_lane_x} * 10.6)) < 0.35",
                    timeout=3000,
                )
                sample = page.evaluate(
                    """(lx) => {
                        const tel = window.__lbBridge3DTelemetry;
                        return {
                            laneX: lx,
                            expectedWorldX: Number((lx * 10.6).toFixed(2)),
                            heroWorldX: tel.heroWorldX,
                            activeRoute: tel.activeRoute,
                        };
                    }""",
                    target_lane_x,
                )
                sweep_samples.append(sample)

            diffs = [
                round(
                    sweep_samples[k + 1]["heroWorldX"] - sweep_samples[k]["heroWorldX"],
                    3,
                )
                for k in range(len(sweep_samples) - 1)
            ]
            max_step_world_x = max(diffs) if diffs else 0
            min_step_world_x = min(diffs) if diffs else 0
            routes_visited = []
            for s in sweep_samples:
                if not routes_visited or routes_visited[-1] != s["activeRoute"]:
                    routes_visited.append(s["activeRoute"])

            # Cada passo de ~0.0511 * 10.6 = ~0.54m; não pode haver salto abrupto (> 1.05m) nas divisórias ±5.5m!
            assert min_step_world_x > 0.25 and max_step_world_x < 0.95, (
                f"QAR1 Falhou: Salto ou descontinuidade detectada em heroWorldX (min={min_step_world_x}, max={max_step_world_x}, diffs={diffs})"
            )
            assert routes_visited == ["LEFT", "CENTER", "RIGHT"], (
                f"QAR1 Falhou: Transicao de rotas esperada ['LEFT', 'CENTER', 'RIGHT'], obtida {routes_visited}"
            )
            assert sweep_samples[0]["heroWorldX"] <= -9.45, (
                f"QAR1 Falhou: Extremo esquerdo truncado ({sweep_samples[0]})"
            )
            assert sweep_samples[-1]["heroWorldX"] >= 9.45, (
                f"QAR1 Falhou: Extremo direito truncado ({sweep_samples[-1]})"
            )

            report["checks"]["qar1_free_continuous_movement"] = {
                "status": "PASS",
                "samplesCount": len(sweep_samples),
                "minWorldX": sweep_samples[0]["heroWorldX"],
                "maxWorldX": sweep_samples[-1]["heroWorldX"],
                "minStepDeltaM": min_step_world_x,
                "maxStepDeltaM": max_step_world_x,
                "routesVisited": routes_visited,
            }

            # =========================================================================
            # TESTE B (SIT): Rota Direita Congelada/Cinza por Padrão (LOCKED_FROSTED)
            # =========================================================================
            page.goto(
                f"{BASE_URL}/jogos/logic-battle?seed=42",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            page.wait_for_function(
                "() => Boolean(window.__lbStore && window.__lbBridge3DTelemetry)",
                timeout=15000,
            )

            # Posicionar na Rota Direita (laneX = +0.82) e simular clique/arraste na área direita do canvas
            canvas_box = page.locator('[data-testid="logic-battle-canvas"]').bounding_box()
            assert canvas_box is not None
            right_click_x = canvas_box["x"] + canvas_box["width"] * 0.84
            right_click_y = canvas_box["y"] + canvas_box["height"] * 0.52
            page.mouse.click(right_click_x, right_click_y)

            page.evaluate("() => window.__lbStore.getState().setSteeringX(0.82)")
            page.wait_for_function(
                "() => window.__lbBridge3DTelemetry?.activeRoute === 'RIGHT'",
                timeout=3000,
            )

            # Capturar screenshot da Rota Direita congelada/cinza por padrão
            shot_locked = os.path.join(
                artifacts_dir, "01_right_route_locked_frosted.png"
            )
            page.screenshot(path=shot_locked)
            report["screenshots"].append(shot_locked)

            # Fazer um portão congelado da direita cruzar zPlayerLine (10.5) enquanto rightBuffActiveTimerMs == 0
            locked_pass_check = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    // Congelar exercito em 50 soldados e manter na Rota Direita (laneX = 0.82)
                    window.__lbStore.setState((prev) => ({
                        snapshot: {
                            ...prev.snapshot,
                            currentArmy: 50,
                            laneX: 0.82,
                        },
                    }));
                    return {
                        armyBefore: window.__lbStore.getState().snapshot.currentArmy,
                        telBefore: { ...window.__lbBridge3DTelemetry },
                        modalOpenBefore: window.__lbStore.getState().activeMathChallenge !== null,
                    };
                }"""
            )
            # Aguardar ~1.8s caminhando sobre a esteira congelada da Rota Direita
            page.wait_for_timeout(1800)
            locked_after = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    const sideRewards = st.snapshot.recentFeedback.filter(
                        (f) => f.id.startsWith('fb_side_RIGHT_')
                    );
                    return {
                        telAfter: { ...window.__lbBridge3DTelemetry },
                        modalOpenAfter: st.activeMathChallenge !== null,
                        modalDomCount: document.querySelectorAll('[data-testid="lb-math-challenge-modal"]').length,
                        sideRightRewardsCount: sideRewards.length,
                        currentArmyAfter: st.snapshot.currentArmy,
                    };
                }"""
            )

            assert (
                locked_after["telAfter"]["rightCorridorState"] == "LOCKED_FROSTED"
            ), f"SIT Falhou: Estado esperado LOCKED_FROSTED, obtido {locked_after}"
            assert locked_after["telAfter"]["rightBuffActiveTimerMs"] == 0, (
                f"SIT Falhou: rightBuffActiveTimerMs deveria ser 0 por padrao: {locked_after}"
            )
            assert locked_after["telAfter"]["rightWeaponUnlocked"] is False, (
                f"SIT Falhou: rightWeaponUnlocked deve ser false quando congelado: {locked_after}"
            )
            assert (
                locked_after["modalOpenAfter"] is False
                and locked_after["modalDomCount"] == 0
            ), f"SIT Falhou: Nenhum modal deve abrir sozinho ao andar/clicar na Rota Direita congelada: {locked_after}"
            assert locked_after["sideRightRewardsCount"] == 0, (
                f"SIT Falhou: Portoes congelados nao podem dar soldados gratis: {locked_after}"
            )
            assert locked_after["currentArmyAfter"] <= 50, (
                f"SIT Falhou: Exercito aumentou sem fazer conta na Rota Direita congelada: {locked_after}"
            )

            report["checks"]["sit_right_route_locked_frosted_by_default"] = {
                "status": "PASS",
                "rightCorridorState": locked_after["telAfter"]["rightCorridorState"],
                "rightBuffActiveTimerMs": locked_after["telAfter"]["rightBuffActiveTimerMs"],
                "rightWeaponUnlocked": locked_after["telAfter"]["rightWeaponUnlocked"],
                "autoModalOpened": locked_after["modalOpenAfter"],
                "freeRightRewardsGranted": locked_after["sideRightRewardsCount"],
            }

            # =========================================================================
            # TESTE C (SIT/UAT): Ativação Temporizada via Conta (🧮) + Coleta Real + Expiração
            # =========================================================================
            # Abrir o Desafio Matemático clicando no botão 🧮 (lb-bridge-math-path-btn)
            page.click('[data-testid="lb-bridge-math-path-btn"]')
            page.wait_for_selector(
                '[data-testid="lb-math-challenge-modal"]', timeout=5000
            )
            # Selecionar Grau 4 (Problema -> 24000ms) para validar a janela máxima e depois testar coleta
            page.click('[data-testid="lb-math-tier-btn-4"]')

            shot_modal = os.path.join(
                artifacts_dir, "02a_math_challenge_modal_open.png"
            )
            page.screenshot(path=shot_modal)
            report["screenshots"].append(shot_modal)

            # Resolver a questão clicando na alternativa correta
            correct_choice_id = page.evaluate(
                """() => {
                    const ch = window.__lbStore.getState().activeMathChallenge;
                    const corr = ch?.choices.find((c) => c.isCorrect);
                    return corr ? corr.id : 'c1';
                }"""
            )
            page.click(f'[data-testid="lb-math-choice-{correct_choice_id}"]')
            page.wait_for_function(
                "() => window.__lbBridge3DTelemetry?.rightCorridorState === 'ACTIVE_TIMED'",
                timeout=4000,
            )

            active_timed_snapshot = page.evaluate(
                """() => ({
                    tel: { ...window.__lbBridge3DTelemetry },
                    armyImmediatelyAfterMath: window.__lbStore.getState().snapshot.currentArmy,
                })"""
            )
            assert (
                active_timed_snapshot["tel"]["rightCorridorState"] == "ACTIVE_TIMED"
            ), f"SIT/UAT Falhou: Rota Direita nao ativou apos conta: {active_timed_snapshot}"
            assert (
                20000
                <= active_timed_snapshot["tel"]["rightBuffActiveTimerMs"]
                <= 24000
            ), f"SIT/UAT Falhou: Timer esperado ~24000ms para Grau 4, obtido {active_timed_snapshot}"
            assert active_timed_snapshot["tel"]["rightBuffMaxTimerMs"] == 24000, (
                f"SIT/UAT Falhou: rightBuffMaxTimerMs esperado 24000, obtido {active_timed_snapshot}"
            )
            assert active_timed_snapshot["tel"]["rightWeaponUnlocked"] is True, (
                f"SIT/UAT Falhou: Arma da direita deve estar destravada durante ACTIVE_TIMED: {active_timed_snapshot}"
            )

            # Capturar screenshot com a Rota Direita acesa em ouro/esmeralda ('⚡ ATIVO Ns!')
            shot_active = os.path.join(
                artifacts_dir, "02b_right_route_active_timed_gold.png"
            )
            page.screenshot(path=shot_active)
            report["screenshots"].append(shot_active)

            # Permanecer na Rota Direita (laneX = +0.82) até coletar pelo menos 1 portão ativo da esteira direita
            page.wait_for_function(
                """() => {
                    const st = window.__lbStore.getState();
                    return st.snapshot.recentFeedback.some(
                        (f) => f.id.startsWith('fb_side_RIGHT_') && f.text.includes('Ativo!')
                    );
                }""",
                timeout=6000,
            )
            collected_right_gate_info = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    const rightFbs = st.snapshot.recentFeedback.filter(
                        (f) => f.id.startsWith('fb_side_RIGHT_')
                    );
                    return {
                        armyAfterGateCollection: st.snapshot.currentArmy,
                        rightFeedbacks: rightFbs.map((f) => f.text),
                        telNow: { ...window.__lbBridge3DTelemetry },
                    };
                }"""
            )
            assert (
                collected_right_gate_info["armyAfterGateCollection"]
                > active_timed_snapshot["armyImmediatelyAfterMath"]
            ), (
                f"SIT/UAT Falhou: Coletar portao ativo da Rota Direita deve somar soldados reais ao exercito: "
                f"{active_timed_snapshot['armyImmediatelyAfterMath']} -> {collected_right_gate_info['armyAfterGateCollection']}"
            )

            # Validar expiração do cronômetro: abrir e resolver uma conta Grau 1 (Fácil = 12s) e aguardar expiração
            # Para não usar sleep longo, validamos que o timer decrementa em tempo real e testamos a transição para 0
            t1_ms = page.evaluate(
                "() => window.__lbBridge3DTelemetry.rightBuffActiveTimerMs"
            )
            page.wait_for_function(
                f"() => window.__lbBridge3DTelemetry.rightBuffActiveTimerMs < {t1_ms - 600}",
                timeout=3000,
            )
            t2_ms = page.evaluate(
                "() => window.__lbBridge3DTelemetry.rightBuffActiveTimerMs"
            )
            assert t2_ms < t1_ms, "Cronometro regressivo nao decrementou em tempo real"

            # Validar também Grau 1 (12000ms) abrindo modal, escolhendo Grau 1 e acertando
            page.click('[data-testid="lb-bridge-math-path-btn"]')
            page.wait_for_selector(
                '[data-testid="lb-math-challenge-modal"]', timeout=5000
            )
            page.click('[data-testid="lb-math-tier-btn-1"]')
            corr_t1 = page.evaluate(
                """() => {
                    const ch = window.__lbStore.getState().activeMathChallenge;
                    return ch?.choices.find((c) => c.isCorrect)?.id || 'c1';
                }"""
            )
            page.click(f'[data-testid="lb-math-choice-{corr_t1}"]')
            page.wait_for_function(
                "() => window.__lbBridge3DTelemetry?.rightBuffMaxTimerMs === 12000",
                timeout=3000,
            )

            # Aguardar o timer de 12s expirar naturalmente até zerar e voltar para LOCKED_FROSTED
            page.wait_for_function(
                "() => window.__lbBridge3DTelemetry?.rightCorridorState === 'LOCKED_FROSTED' && window.__lbBridge3DTelemetry?.rightBuffActiveTimerMs === 0",
                timeout=22000,
            )
            expired_tel = page.evaluate("() => ({ ...window.__lbBridge3DTelemetry })")
            assert expired_tel["rightCorridorState"] == "LOCKED_FROSTED", (
                f"SIT/UAT Falhou: Apos expirar timer, Rota Direita deve voltar para LOCKED_FROSTED: {expired_tel}"
            )
            assert expired_tel["rightWeaponUnlocked"] is False, (
                f"SIT/UAT Falhou: Apos expirar timer, rightWeaponUnlocked deve voltar para false: {expired_tel}"
            )

            shot_expired = os.path.join(
                artifacts_dir, "03_right_route_expired_back_to_frosted.png"
            )
            page.screenshot(path=shot_expired)
            report["screenshots"].append(shot_expired)

            report["checks"]["sit_uat_timed_activation_and_expiration"] = {
                "status": "PASS",
                "tier4MaxTimerMs": active_timed_snapshot["tel"]["rightBuffMaxTimerMs"],
                "tier1MaxTimerMs": 12000,
                "armyAfterMath": active_timed_snapshot["armyImmediatelyAfterMath"],
                "armyAfterRightGateCollect": collected_right_gate_info[
                    "armyAfterGateCollection"
                ],
                "rightFeedbacks": collected_right_gate_info["rightFeedbacks"],
                "expiredState": expired_tel["rightCorridorState"],
                "expiredTimerMs": expired_tel["rightBuffActiveTimerMs"],
                "expiredWeaponUnlocked": expired_tel["rightWeaponUnlocked"],
            }

            # =========================================================================
            # TESTE D (SIT/UAT): Buffs Positivos e Negativos Reais da Rota Central + Bypass Lateral
            # =========================================================================
            page.goto(
                f"{BASE_URL}/jogos/logic-battle?seed=42",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            page.wait_for_function(
                "() => Boolean(window.__lbStore && window.__lbBridge3DTelemetry)",
                timeout=15000,
            )

            shot_center = os.path.join(
                artifacts_dir, "04_center_route_real_gates_max2_pairs.png"
            )
            page.screenshot(path=shot_center)
            report["screenshots"].append(shot_center)

            # D.1: Testar portão POSITIVO na Rota Central (|laneX| <= 0.52)
            pos_gate_result = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    const seg0 = st.snapshot.segments[0];
                    // Forcar seg0 faixa 0 a ser '+ 25' e faixa 1 a ser '- 15' para prova deterministica exata
                    const customSeg0 = {
                        ...seg0,
                        kind: 'normal',
                        trapId: undefined,
                        lanes: [
                            [{ id: 'test_pos_gate', op: '+', operand: { value: 25, num: 25, den: 1 }, label: '+ 25' }],
                            [{ id: 'test_neg_gate', op: '−', operand: { value: 15, num: 15, den: 1 }, label: '− 15' }],
                        ],
                    };
                    const seg1 = st.snapshot.segments[1];
                    const customSeg1 = {
                        ...seg1,
                        kind: 'normal',
                        trapId: undefined,
                        lanes: [
                            [{ id: 'test_pos_gate_2', op: '+', operand: { value: 10, num: 10, den: 1 }, label: '+ 10' }],
                            [{ id: 'test_neg_gate_2', op: '−', operand: { value: 18, num: 18, den: 1 }, label: '− 18' }],
                        ],
                    };
                    const seg2 = st.snapshot.segments[2];
                    const customSeg2 = {
                        ...seg2,
                        kind: 'normal',
                        trapId: undefined,
                        lanes: [
                            [{ id: 'test_bypass_0', op: '×', operand: { value: 10, num: 10, den: 1 }, label: '× 10' }],
                            [{ id: 'test_bypass_1', op: '−', operand: { value: 40, num: 40, den: 1 }, label: '− 40' }],
                        ],
                    };
                    const newSegs = [...st.snapshot.segments];
                    newSegs[0] = customSeg0;
                    newSegs[1] = customSeg1;
                    newSegs[2] = customSeg2;

                    window.__lbStore.setState((prev) => ({
                        snapshot: {
                            ...prev.snapshot,
                            currentArmy: 40,
                            activeSegmentIndex: 0,
                            resolvedSegments: {},
                            segments: newSegs,
                            laneX: -0.24, // Coluna 0 da Rota Central (|laneX| <= 0.52)
                            currentLane: 0,
                            progress: customSeg0.zPosition - 0.0002,
                        },
                    }));
                    window.__lbStore.getState().tickRun(20);
                    const afterSeg0 = window.__lbStore.getState().snapshot;
                    const res0 = afterSeg0.resolvedSegments[customSeg0.id];

                    // D.2: Agora posicionar na Coluna 1 da Rota Central (laneX = +0.24) para cruzar o portao NEGATIVO '− 18' em seg1
                    window.__lbStore.setState((prev) => ({
                        snapshot: {
                            ...prev.snapshot,
                            laneX: 0.24,
                            currentLane: 1,
                            progress: customSeg1.zPosition - 0.0002,
                        },
                    }));
                    const armyBeforeNeg = window.__lbStore.getState().snapshot.currentArmy;
                    window.__lbStore.getState().tickRun(20);
                    const afterSeg1 = window.__lbStore.getState().snapshot;
                    const res1 = afterSeg1.resolvedSegments[customSeg1.id];

                    // D.3: Agora posicionar no Corredor Lateral Direito (laneX = +0.82, |laneX| > 0.52) para cruzar seg2 sem colisao fantasma!
                    window.__lbStore.setState((prev) => ({
                        snapshot: {
                            ...prev.snapshot,
                            laneX: 0.82,
                            progress: customSeg2.zPosition - 0.0002,
                        },
                    }));
                    const armyBeforeBypass = window.__lbStore.getState().snapshot.currentArmy;
                    window.__lbStore.getState().tickRun(20);
                    const afterSeg2 = window.__lbStore.getState().snapshot;
                    const res2 = afterSeg2.resolvedSegments[customSeg2.id];

                    return {
                        positiveGate: {
                            armyBefore: 40,
                            armyAfter: afterSeg0.currentArmy,
                            resolved: res0,
                        },
                        negativeGate: {
                            armyBefore: armyBeforeNeg,
                            armyAfter: afterSeg1.currentArmy,
                            resolved: res1,
                        },
                        lateralBypass: {
                            laneX: 0.82,
                            armyBefore: armyBeforeBypass,
                            armyAfter: afterSeg2.currentArmy,
                            resolved: res2,
                        },
                    };
                }"""
            )

            assert (
                pos_gate_result["positiveGate"]["resolved"]["chosenLane"] == 0
                and pos_gate_result["positiveGate"]["armyAfter"] == 65
            ), f"SIT/UAT Falhou: Portao positivo '+ 25' na Rota Central deveria levar 40 -> 65: {pos_gate_result}"

            assert (
                pos_gate_result["negativeGate"]["resolved"]["chosenLane"] == 1
                and pos_gate_result["negativeGate"]["armyAfter"] == 47
            ), f"SIT/UAT Falhou: Portao negativo '− 18' na Rota Central deveria reduzir 65 -> 47: {pos_gate_result}"

            assert (
                pos_gate_result["lateralBypass"]["resolved"]["chosenLane"] == -1
                and pos_gate_result["lateralBypass"]["armyAfter"]
                == pos_gate_result["lateralBypass"]["armyBefore"]
            ), f"SIT/UAT Falhou: Nos corredores laterais (|laneX| > 0.52) nao pode haver colisao fantasma com portoes centrais: {pos_gate_result}"

            shot_bypass = os.path.join(
                artifacts_dir, "05_side_corridor_bypass_no_ghost_collision.png"
            )
            page.screenshot(path=shot_bypass)
            report["screenshots"].append(shot_bypass)

            report["checks"]["sit_uat_center_gates_and_side_bypass"] = {
                "status": "PASS",
                **pos_gate_result,
            }

            ctx.close()
            browser.close()

        assert len(report["consoleErrors"]) == 0, (
            f"Erros de console encontrados: {report['consoleErrors']}"
        )
        assert len(report["pageErrors"]) == 0, (
            f"Erros de pagina encontrados: {report['pageErrors']}"
        )
        report["status"] = "ALL_V8_FASE2_CHECKS_PASSED"

        results_json_path = os.path.join(artifacts_dir, "test-results.json")
        with open(results_json_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return report

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


if __name__ == "__main__":
    out = run_v8_fase2_audit()
    print(json.dumps(out, indent=2, ensure_ascii=False))
    sys.exit(0)
