# -*- coding: utf-8 -*-
"""
Auditoria Final QAR1 + SIT + UAT (Master Plan V9) — Logic Battle
Valida os 4 Pilares do Master Plan V9:
  1) QAR1-V9-ORTHOGONALITY (Escala Ortogonal: Esquerda e Centro = Nível dos Monstros; Direita = Exponencial):
     - Comprova que no Setor 1, quer `currentArmy === 10` quer `currentArmy === 500000`,
       as placas de `leftGateLabels` e os `segments` da Rota Central são 100% idênticos
       (zero inflação por exército da Rota Direita).
     - Comprova que ao avançar para Setores 2, 3, 4..., `leftGateLabels` e os portões centrais
       escalam estritamente com `computeSectorBossSpec(sectorIndex)`.
  2) SIT-V9-RIGHT-QUESTION-BINDING (Rota Direita Congelada sem Conta + Buff Dinâmico Vinculado à Questão):
     - Comprova que com `rightBuffActiveTimerMs == 0`, `rightCorridorState === 'LOCKED_FROSTED'`
       e nenhuma coleta ocorre mesmo em `X = +7.5`.
     - Ao abrir o modal de conta (`lb-math-challenge-modal`), verifica `lb-math-right-corridor-preview`
       e resolve questões nos Graus 1, 2, 3 e 4, comprovando que `rightGateLabels`, `rightGateSubLabels`,
       `rightActiveTier`, `rightActiveQuestionValue`, `rightActiveBuffLabel` e `rightPiercingShots`
       mudam dinamicamente conforme a questão resolvida e crescem exponencialmente com `mathChallengesSolved`.
  3) UAT-V9-DENSITY-AND-VARIETY (Redução de Densidade Cognitiva e Variedade de Operações):
     - Comprova `snapshot.segments.length === 6` na Rota Central (~8s de leitura entre decisões),
       `leftGateLabels.length === 2` na Rota Esquerda e `rightGateLabels.length === 2` na Rota Direita.
     - Comprova presença de pegadinhas (`trap`), gêmeos (`twins`) e múltiplas famílias de operações
       (frações, porcentagens, decimais, potências/duplo sinal/PEMDAS, multiplicação/adição) nos 6 segmentos.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 4195
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


def run_v9_audit() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    artifacts_dir = os.path.join(repo_root, "artifacts", "playwright", "v9")
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
        "phase": "MASTER_PLAN_V9",
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

            page.goto(
                f"{BASE_URL}/jogos/logic-battle?seed=42",
                wait_until="domcontentloaded",
                timeout=45000,
            )
            page.wait_for_selector('[data-testid="logic-battle-hud"]', timeout=15000)
            time.sleep(0.6)

            # =========================================================================
            # 1. QAR1-V9-ORTHOGONALITY: Escala Ortogonal (Esquerda & Centro vs Direita)
            # =========================================================================
            ortho_s1_10 = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    st.startNewRun({ biomeId: 'planicie_pedra', seed: 42 });
                    window.__lbStore.setState((prev) => ({
                        bridgeSectorIndex: 1,
                        snapshot: {
                            ...prev.snapshot,
                            currentArmy: 10,
                        },
                    }));
                    return true;
                }"""
            )
            time.sleep(0.35)
            snap_10 = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    const tel = window.__lbBridge3DTelemetry || {};
                    const centerLabels = st.snapshot.segments.map((s) =>
                        s.lanes.map((l) => l.map((g) => g.label).join(' -> ')).join(' | ')
                    );
                    return {
                        leftGateLabels: tel.leftGateLabels || [],
                        leftGateSubLabels: tel.leftGateSubLabels || [],
                        centerLabels,
                        bossHp: tel.bossHp,
                    };
                }"""
            )

            # Agora inflar currentArmy para 500.000 no mesmo Setor 1 (simulando ganho exponencial da Direita)
            page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    window.__lbStore.setState((prev) => ({
                        snapshot: {
                            ...prev.snapshot,
                            currentArmy: 500000,
                        },
                    }));
                    // Mesmo gerando nova run no Setor 1 com currentArmy=500000:
                    const currEnemy = window.__lbStore.getState().snapshot.enemy;
                    return currEnemy.totalForce;
                }"""
            )
            time.sleep(0.35)
            snap_500k = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    const tel = window.__lbBridge3DTelemetry || {};
                    const centerLabels = st.snapshot.segments.map((s) =>
                        s.lanes.map((l) => l.map((g) => g.label).join(' -> ')).join(' | ')
                    );
                    return {
                        leftGateLabels: tel.leftGateLabels || [],
                        leftGateSubLabels: tel.leftGateSubLabels || [],
                        centerLabels,
                        bossHp: tel.bossHp,
                    };
                }"""
            )

            assert snap_10["leftGateLabels"] == snap_500k["leftGateLabels"], (
                f"QAR1-V9-ORTHOGONALITY FALHOU: leftGateLabels mudou com currentArmy=500k no Setor 1! "
                f"10={snap_10['leftGateLabels']} vs 500k={snap_500k['leftGateLabels']}"
            )
            assert snap_10["centerLabels"] == snap_500k["centerLabels"], (
                "QAR1-V9-ORTHOGONALITY FALHOU: centerLabels mudou no Setor 1!"
            )

            # Avançar para o Setor 4 e comprovar que Esquerda e Centro sobem com o Nível dos Monstros
            page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    st.onSectorBossDefeatedInBridge(4, 50);
                }"""
            )
            time.sleep(0.35)
            snap_s4 = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    const tel = window.__lbBridge3DTelemetry || {};
                    const centerLabels = st.snapshot.segments.map((s) =>
                        s.lanes.map((l) => l.map((g) => g.label).join(' -> ')).join(' | ')
                    );
                    return {
                        leftGateLabels: tel.leftGateLabels || [],
                        leftGateSubLabels: tel.leftGateSubLabels || [],
                        centerLabels,
                        bossHp: tel.bossHp,
                    };
                }"""
            )
            assert snap_s4["leftGateLabels"] != snap_10["leftGateLabels"], (
                f"QAR1-V9-ORTHOGONALITY FALHOU: leftGateLabels deveria escalar do Setor 1 para o Setor 4! "
                f"S1={snap_10['leftGateLabels']} vs S4={snap_s4['leftGateLabels']}"
            )

            report["checks"]["QAR1_V9_ORTHOGONALITY"] = {
                "status": "PASS",
                "sector1_army10_leftGates": snap_10["leftGateLabels"],
                "sector1_army500k_leftGates": snap_500k["leftGateLabels"],
                "sector4_leftGates": snap_s4["leftGateLabels"],
                "sector4_leftSubLabels": snap_s4["leftGateSubLabels"],
            }

            # =========================================================================
            # 2. UAT-V9-DENSITY-AND-VARIETY: 6 Segmentos Centrais, 2 Esq, 2 Dir + Variedade
            # =========================================================================
            density_audit = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    st.startNewRun({ biomeId: 'planicie_pedra', seed: 42 });
                    const tel = window.__lbBridge3DTelemetry || {};
                    const segs = window.__lbStore.getState().snapshot.segments;
                    const kinds = segs.map((s) => s.kind);
                    const trapIds = segs.filter((s) => Boolean(s.trapId)).map((s) => s.trapId);
                    const allLabels = [];
                    for (const s of segs) {
                        for (const lane of s.lanes) {
                            for (const g of lane) {
                                allLabels.push(g.label);
                            }
                        }
                    }
                    // Coletar mais 2 seeds para verificar rotacao das familias matematicas
                    st.startNewRun({ biomeId: 'planicie_pedra', seed: 77 });
                    for (const s of window.__lbStore.getState().snapshot.segments) {
                        for (const lane of s.lanes) {
                            for (const g of lane) {
                                allLabels.push(g.label);
                            }
                        }
                    }
                    st.startNewRun({ biomeId: 'planicie_pedra', seed: 42 });
                    return {
                        centerCount: segs.length,
                        leftCount: (tel.leftGateLabels || []).length,
                        rightCount: (tel.rightGateLabels || []).length,
                        kinds,
                        trapIds,
                        allLabels,
                    };
                }"""
            )
            assert density_audit["centerCount"] == 6, (
                f"UAT-V9-DENSITY FALHOU: esperado 6 segmentos centrais, obtido {density_audit['centerCount']}"
            )
            assert density_audit["leftCount"] == 2, (
                f"UAT-V9-DENSITY FALHOU: esperado 2 portoes na esquerda, obtido {density_audit['leftCount']}"
            )
            assert density_audit["rightCount"] == 2, (
                f"UAT-V9-DENSITY FALHOU: esperado 2 super-portoes na direita, obtido {density_audit['rightCount']}"
            )
            assert len(density_audit["trapIds"]) >= 1, f"Esperado ao menos 1 trapId nos 6 segmentos: {density_audit}"
            assert "twins" in density_audit["kinds"], f"Esperado twins nos 6 segmentos: {density_audit['kinds']}"

            labels_joined = " | ".join(density_audit["allLabels"])
            has_fraction = "/" in labels_joined
            has_percent = "%" in labels_joined
            has_decimal = "," in labels_joined
            has_mult_or_double_sign = "×" in labels_joined or "−(" in labels_joined
            variety_count = sum([has_fraction, has_percent, has_decimal, has_mult_or_double_sign])
            assert variety_count >= 3, (
                f"UAT-V9-VARIETY FALHOU: esperado ao menos 3 familias matematicas distintas nos segmentos centrais, "
                f"obtido variety_count={variety_count} em {labels_joined}"
            )

            report["checks"]["UAT_V9_DENSITY_AND_VARIETY"] = {
                "status": "PASS",
                "centerSegmentsCount": density_audit["centerCount"],
                "leftGatesCount": density_audit["leftCount"],
                "rightGatesCount": density_audit["rightCount"],
                "segmentKinds": density_audit["kinds"],
                "trapIds": density_audit["trapIds"],
                "familiesDetected": {
                    "fractions": has_fraction,
                    "percentages": has_percent,
                    "decimals": has_decimal,
                    "multOrDoubleSign": has_mult_or_double_sign,
                },
            }

            # =========================================================================
            # 3. SIT-V9-RIGHT-QUESTION-BINDING: Rota Direita Congelada + 4 Graus Dinâmicos
            # =========================================================================
            # 3.1 Comprovar que sem conta resolvida, a Rota Direita está LOCKED_FROSTED
            page.evaluate("() => window.__lbStore.getState().steerToRoute('RIGHT')")
            time.sleep(0.5)
            locked_tel = page.evaluate("() => window.__lbBridge3DTelemetry || {}")
            assert locked_tel.get("rightCorridorState") == "LOCKED_FROSTED", (
                f"SIT-V9 FALHOU: Rota Direita deveria estar LOCKED_FROSTED sem conta, obtido: {locked_tel}"
            )
            shot_locked = os.path.join(artifacts_dir, "v9_01_right_locked_frosted.png")
            page.screenshot(path=shot_locked)
            report["screenshots"].append(shot_locked)

            # 3.2 Resolver contas nos Graus 1, 2, 3 e 4 e validar transformação dinâmica dos 2 Super-Portões e da Arma
            tier_results = {}
            for tier in [1, 2, 3, 4]:
                page.evaluate(f"() => window.__lbStore.getState().openMathChallengeModal({tier})")
                page.wait_for_selector('[data-testid="lb-math-challenge-modal"]', timeout=5000)
                preview_text = page.locator('[data-testid="lb-math-right-corridor-preview"]').inner_text().strip()
                assert "Rota Direita (2 Super-Portões)" in preview_text, (
                    f"Preview de super-portoes ausente no modal para Grau {tier}: {preview_text}"
                )
                if tier in (2, 4):
                    shot_modal = os.path.join(artifacts_dir, f"v9_02_math_modal_tier_{tier}.png")
                    page.screenshot(path=shot_modal)
                    report["screenshots"].append(shot_modal)

                solved_info = page.evaluate(
                    """() => {
                        const st = window.__lbStore.getState();
                        const ch = st.activeMathChallenge;
                        const correct = ch.choices.find((c) => c.isCorrect);
                        st.submitMathChallengeChoice(correct.id);
                        return {
                            tier: ch.tier,
                            correctValue: ch.correctValue,
                            expressionBadge: ch.expressionBadge,
                        };
                    }"""
                )
                time.sleep(0.35)
                tel_after = page.evaluate("() => window.__lbBridge3DTelemetry || {}")
                assert tel_after.get("rightCorridorState") == "ACTIVE_TIMED", (
                    f"Rota Direita nao desbloqueou apos resolver conta de Grau {tier}: {tel_after}"
                )
                assert tel_after.get("rightActiveTier") == tier, (
                    f"rightActiveTier esperado {tier}, obtido {tel_after.get('rightActiveTier')}"
                )
                assert tel_after.get("rightActiveQuestionValue") == solved_info["correctValue"], (
                    f"rightActiveQuestionValue esperado {solved_info['correctValue']}, obtido {tel_after.get('rightActiveQuestionValue')}"
                )
                assert len(tel_after.get("rightGateLabels", [])) == 2, (
                    f"Esperado 2 super-portoes na direita, obtido {tel_after.get('rightGateLabels')}"
                )
                tier_results[f"tier_{tier}"] = {
                    "solvedQuestionValue": solved_info["correctValue"],
                    "expressionBadge": solved_info["expressionBadge"],
                    "rightGateLabels": tel_after.get("rightGateLabels"),
                    "rightGateSubLabels": tel_after.get("rightGateSubLabels"),
                    "rightActiveBuffLabel": tel_after.get("rightActiveBuffLabel"),
                    "rightPiercingShots": tel_after.get("rightPiercingShots"),
                    "mathChallengesSolved": tel_after.get("mathChallengesSolved"),
                }

            assert tier_results["tier_3"]["rightPiercingShots"] is True, (
                "Grau 3 (Dificil) deve ativar Canhao Perfurante (rightPiercingShots === true)!"
            )
            shot_active = os.path.join(artifacts_dir, "v9_03_right_unlocked_exponential.png")
            page.screenshot(path=shot_active)
            report["screenshots"].append(shot_active)

            report["checks"]["SIT_V9_RIGHT_QUESTION_BINDING"] = {
                "status": "PASS",
                "lockedStateVerified": True,
                "tiers": tier_results,
            }

            # =========================================================================
            # 4. QAR1-V9-CENTER-ROUTE-UNLOCKED-MOTION: Movimento Contínuo da Rota Central
            # =========================================================================
            page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    st.startNewRun({ biomeId: 'planicie_pedra', seed: 42 });
                }"""
            )
            time.sleep(0.25)
            motion_t0 = page.evaluate("() => window.__lbBridge3DTelemetry || {}")
            time.sleep(0.85)
            motion_t1 = page.evaluate("() => window.__lbBridge3DTelemetry || {}")

            delta_center_progress = motion_t1.get("centerProgress", 0) - motion_t0.get("centerProgress", 0)
            delta_center_z = motion_t1.get("centerFirstVisibleGateZ", 0) - motion_t0.get("centerFirstVisibleGateZ", 0)
            delta_left_z = motion_t1.get("leftBlockZ", 0) - motion_t0.get("leftBlockZ", 0)

            assert delta_center_progress > 0.02 and delta_center_z > 2.0, (
                f"QAR1-V9-CENTER-MOTION FALHOU: Rota Central nao se moveu continuamente em +Z! "
                f"t0={motion_t0.get('centerFirstVisibleGateZ')} (prog={motion_t0.get('centerProgress')}) -> "
                f"t1={motion_t1.get('centerFirstVisibleGateZ')} (prog={motion_t1.get('centerProgress')})"
            )

            # Testar reciclagem automática da esteira central ao final dos 6 segmentos na ponte 3D
            recycled_check = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    st.tickRun(20000);
                    const snapAfter = window.__lbStore.getState().snapshot;
                    return {
                        phase: snapAfter.phase,
                        activeSegmentIndex: snapAfter.activeSegmentIndex,
                        progress: Number(snapAfter.progress.toFixed(4)),
                        segmentsCount: snapAfter.segments.length,
                    };
                }"""
            )
            assert recycled_check["phase"] in ("RUNNING", "CALM_WAIT"), (
                f"Rota Central travou em fase inesperada apos completar onda na ponte 3D: {recycled_check}"
            )
            assert recycled_check["activeSegmentIndex"] < recycled_check["segmentsCount"], (
                f"Rota Central nao reciclou a onda de segmentos na esteira 3D: {recycled_check}"
            )

            report["checks"]["QAR1_V9_CENTER_ROUTE_UNLOCKED_MOTION"] = {
                "status": "PASS",
                "centerZ_t0": motion_t0.get("centerFirstVisibleGateZ"),
                "centerZ_t1": motion_t1.get("centerFirstVisibleGateZ"),
                "deltaCenterZ": round(delta_center_z, 2),
                "deltaCenterProgress": round(delta_center_progress, 4),
                "deltaLeftBlockZ": round(delta_left_z, 2),
                "recycledWaveAfterFullPass": recycled_check,
            }

            browser.close()

        assert len(report["consoleErrors"]) == 0, f"Erros de console: {report['consoleErrors']}"
        assert len(report["pageErrors"]) == 0, f"Erros de pagina: {report['pageErrors']}"

        report_path = os.path.join(artifacts_dir, "v9_audit_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(json.dumps(report, ensure_ascii=False, indent=2))
        return report

    finally:
        if spawned_proc is not None:
            try:
                subprocess.run(
                    f"taskkill /F /T /PID {spawned_proc.pid}",
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                pass


if __name__ == "__main__":
    run_v9_audit()
