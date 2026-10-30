import json
import os
import socket
import subprocess
import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 4196
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


def run_v10_fase1_verification():
    spawned_proc = ensure_dev_server()
    artifacts_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "test_artifacts_v10")
    )
    os.makedirs(artifacts_dir, exist_ok=True)

    report = {
        "suite": "MASTER_PLAN_V10_FASE1_VERIFICATION",
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
            time.sleep(0.45)

            # =========================================================================
            # 1. UAT-V10-CENTER-CADENCE-10S: 1 Único Par de Portões por Vez (~9s)
            # =========================================================================
            cadence_tel = page.evaluate("() => window.__lbBridge3DTelemetry || {}")
            assert cadence_tel.get("visibleCenterSegmentsCount") == 1, (
                f"UAT-V10-CENTER-CADENCE-10S FALHOU: esperado apenas 1 segmento central visivel por vez, "
                f"obtido {cadence_tel.get('visibleCenterSegmentsCount')}"
            )
            assert cadence_tel.get("centerTargetGateIntervalSec") == 9.0, (
                f"UAT-V10-CENTER-CADENCE-10S FALHOU: esperado intervalo alvo de 9.0s, "
                f"obtido {cadence_tel.get('centerTargetGateIntervalSec')}"
            )
            report["checks"]["UAT_V10_CENTER_CADENCE_10S"] = {
                "status": "PASS",
                "visibleCenterSegmentsCount": cadence_tel.get("visibleCenterSegmentsCount"),
                "centerTargetGateIntervalSec": cadence_tel.get("centerTargetGateIntervalSec"),
                "centerFirstVisibleGateZ": cadence_tel.get("centerFirstVisibleGateZ"),
            }

            # =========================================================================
            # 2. QAR1-V10-AUTHENTIC-DEBUFFS: Redução Real de Soldados em Portões Negativos
            # =========================================================================
            debuff_audit = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    // Inflar exército como se viesse da Rota Direita (ex.: 1500 soldados)
                    const snap0 = st.snapshot;
                    const seg0 = snap0.segments[0];
                    // Encontrar qual faixa do segmento 0 é redutora/pior
                    const g0 = seg0.lanes[0][0];
                    const g1 = seg0.lanes[1][0];
                    const badLaneIdx = (
                        g0.op === '−' ||
                        g0.op === '%−' ||
                        (g0.op === '×' && g0.operand.num < g0.operand.den) ||
                        (g0.op === '÷' && g0.operand.num > g0.operand.den)
                    ) ? 0 : 1;
                    const badGateLabel = seg0.lanes[badLaneIdx][0].label;

                    // Testar com exército inflado (1500 soldados) atravessando o portão vermelho
                    window.__lbStore.setState({
                        mathChallengesSolvedInRun: 3,
                        snapshot: {
                            ...snap0,
                            currentArmy: 1500,
                        },
                    });
                    const armyBeforeInflated = window.__lbStore.getState().snapshot.currentArmy;
                    window.__lbStore.getState().chooseLaneAndAdvance(badLaneIdx);
                    if (window.__lbStore.getState().snapshot.activeSegmentIndex === 0) {
                        window.__lbStore.getState().chooseLaneAndAdvance(badLaneIdx);
                    }
                    const armyAfterInflated = window.__lbStore.getState().snapshot.currentArmy;

                    // Testar também com exército normal (50 soldados) em um portão proporcional × 1/2 e − 20%
                    st.startNewRun({ biomeId: 'planicie_pedra', seed: 42 });
                    const snap1 = window.__lbStore.getState().snapshot;
                    const seg1 = snap1.segments[0];
                    const badLane1 = (
                        seg1.lanes[0][0].op === '−' ||
                        seg1.lanes[0][0].op === '%−' ||
                        (seg1.lanes[0][0].op === '×' && seg1.lanes[0][0].operand.num < seg1.lanes[0][0].operand.den)
                    ) ? 0 : 1;
                    window.__lbStore.setState({
                        snapshot: {
                            ...snap1,
                            currentArmy: 80,
                        },
                    });
                    const armyBeforeNormal = window.__lbStore.getState().snapshot.currentArmy;
                    window.__lbStore.getState().chooseLaneAndAdvance(badLane1);
                    if (window.__lbStore.getState().snapshot.activeSegmentIndex === 0) {
                        window.__lbStore.getState().chooseLaneAndAdvance(badLane1);
                    }
                    const armyAfterNormal = window.__lbStore.getState().snapshot.currentArmy;

                    // Testar matriz exaustiva de todas as famílias de debuff com exército inflado (1500 -> 1,5k)
                    const debuffFamilies = [
                        { id: 'sub', op: '−', operand: { num: 18, den: 1, value: 18, display: '18' }, value: 18, label: '− 18' },
                        { id: 'pct_sub', op: '%−', operand: { num: 25, den: 1, value: 25, display: '25%' }, value: 25, label: '− 25%' },
                        { id: 'frac_lt_1', op: '×', operand: { num: 1, den: 2, value: 0.5, display: '1/2' }, value: 0.5, label: '× 1/2' },
                        { id: 'dec_lt_1', op: '×', operand: { num: 4, den: 5, value: 0.8, display: '0,8' }, value: 0.8, label: '× 0,8' },
                        { id: 'div_gt_1', op: '÷', operand: { num: 2, den: 1, value: 2, display: '2' }, value: 2, label: '÷ 2' },
                        { id: 'pow_zero', op: '^', operand: { num: 0, den: 1, value: 0, display: '0' }, value: 0, label: '^ 0' },
                        { id: 'sqrt', op: '√', operand: { num: 2, den: 1, value: 2, display: '2' }, value: 2, label: '√' },
                    ];
                    const familyResults = [];
                    for (const fam of debuffFamilies) {
                        st.startNewRun({ biomeId: 'planicie_pedra', seed: 42 });
                        const s = window.__lbStore.getState().snapshot;
                        const customSeg0 = {
                            ...s.segments[0],
                            lanes: [
                                [{ ...s.segments[0].lanes[0][0], op: fam.op, operand: fam.operand, value: fam.value, label: fam.label, isTrap: true }],
                                s.segments[0].lanes[1],
                            ],
                        };
                        window.__lbStore.setState({
                            snapshot: {
                                ...s,
                                currentArmy: 1500,
                                segments: [customSeg0, ...s.segments.slice(1)],
                            },
                        });
                        window.__lbStore.getState().chooseLaneAndAdvance(0);
                        if (window.__lbStore.getState().snapshot.activeSegmentIndex === 0) {
                            window.__lbStore.getState().chooseLaneAndAdvance(0);
                        }
                        const afterFam = window.__lbStore.getState().snapshot.currentArmy;
                        familyResults.push({
                            family: fam.id,
                            label: fam.label,
                            before: 1500,
                            after: afterFam,
                            droppedVisiblyBelow1400: afterFam <= 1350,
                        });
                    }

                    return {
                        badGateLabel,
                        armyBeforeInflated,
                        armyAfterInflated,
                        inflatedDrop: armyBeforeInflated - armyAfterInflated,
                        armyBeforeNormal,
                        armyAfterNormal,
                        normalDrop: armyBeforeNormal - armyAfterNormal,
                        familyResults,
                    };
                }"""
            )
            assert debuff_audit["armyAfterInflated"] < debuff_audit["armyBeforeInflated"], (
                f"QAR1-V10-AUTHENTIC-DEBUFFS FALHOU (exército inflado): {debuff_audit}"
            )
            assert debuff_audit["inflatedDrop"] >= 150, (
                f"QAR1-V10-AUTHENTIC-DEBUFFS FALHOU: queda em exército de 1500 deveria ser perceptível (>=150), obtido {debuff_audit}"
            )
            assert debuff_audit["armyAfterNormal"] < debuff_audit["armyBeforeNormal"], (
                f"QAR1-V10-AUTHENTIC-DEBUFFS FALHOU (exército normal): {debuff_audit}"
            )
            assert all(r["droppedVisiblyBelow1400"] for r in debuff_audit["familyResults"]), (
                f"QAR1-V10-AUTHENTIC-DEBUFFS FALHOU em alguma familia de operador: {debuff_audit['familyResults']}"
            )
            report["checks"]["QAR1_V10_AUTHENTIC_DEBUFFS"] = {
                "status": "PASS",
                **debuff_audit,
            }

            # =========================================================================
            # 3. SIT-V10-LIVING-BASES-AND-SHARED-WALLET: Base Inimiga Viva + Torres + Carteira Compartilhada
            # =========================================================================
            page.evaluate("() => window.__lbStore.getState().startNewRun({ biomeId: 'planicie_pedra', seed: 42 })")
            time.sleep(0.3)

            # 3.1 Evoluir a Base Inimiga no meio da partida e validar Torres de Debuff 3D + dano real de pulso
            enemy_evo_audit = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    window.__lbStore.setState({
                        snapshot: {
                            ...st.snapshot,
                            currentArmy: 200,
                            bridgeCoinsEarned: 120,
                        },
                    });
                    const evo1 = window.__lbEvolveEnemyBaseForAudit
                        ? window.__lbEvolveEnemyBaseForAudit()
                        : { enemyBaseLevel: st.evolveEnemyBaseInMatch(), activeTowersCount: 2 };
                    const evo2 = window.__lbEvolveEnemyBaseForAudit
                        ? window.__lbEvolveEnemyBaseForAudit()
                        : { enemyBaseLevel: st.evolveEnemyBaseInMatch(), activeTowersCount: 3 };
                    const armyBeforePulse = window.__lbStore.getState().snapshot.currentArmy;
                    if (window.__lbForceEnemyDebuffHitForAudit) {
                        window.__lbForceEnemyDebuffHitForAudit(0.15, '−15% MALDIÇÃO');
                    } else {
                        window.__lbStore.getState().applyEnemyDebuffTowerHit(0.15, '−15% MALDIÇÃO');
                    }
                    const armyAfterPulse = window.__lbStore.getState().snapshot.currentArmy;
                    return {
                        enemyBaseLevel: window.__lbStore.getState().enemyBaseLevel,
                        enemyDebuffTowersActive: window.__lbStore.getState().enemyDebuffTowersActive,
                        armyBeforePulse,
                        armyAfterPulse,
                        evo1,
                        evo2,
                    };
                }"""
            )
            assert enemy_evo_audit["enemyBaseLevel"] >= 3, (
                f"Base Inimiga deveria evoluir para >= 3, obtido {enemy_evo_audit}"
            )
            assert enemy_evo_audit["enemyDebuffTowersActive"] >= 3, (
                f"Base Inimiga deveria ativar >= 3 Torres de Debuff, obtido {enemy_evo_audit}"
            )
            assert enemy_evo_audit["armyAfterPulse"] < enemy_evo_audit["armyBeforePulse"], (
                f"Pulso de Torre de Debuff Inimiga deve reduzir soldados de verdade: {enemy_evo_audit}"
            )

            # 3.2 Evoluir Torre da Ponte Aliada + Cidadela da Base Principal dentro da mesma partida usando a Carteira Compartilhada
            page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    if (st.snapshot.phase !== 'PAUSED') st.togglePauseRun();
                }"""
            )
            wallet_before_upgrades = page.evaluate(
                "() => window.__lbStore.getState().getSharedWalletBalance()"
            )
            quartel_lvl_before = page.evaluate(
                "() => window.__lbStore.getState().save.citadelLevels.quartel"
            )
            towers_before = page.evaluate(
                "() => [...window.__lbStore.getState().playerBridgeTowerLevels]"
            )

            # Clicar no botão rápido 1-clique para construir/evoluir Torre da Ponte
            page.click('[data-testid="lb-quick-upgrade-bridge-tower-btn"]')
            time.sleep(0.15)
            towers_after = page.evaluate(
                "() => [...window.__lbStore.getState().playerBridgeTowerLevels]"
            )
            assert sum(towers_after) > sum(towers_before), (
                f"Torre da Ponte nao evoluiu ao clicar em lb-quick-upgrade-bridge-tower-btn: {towers_before} -> {towers_after}"
            )

            # Abrir a gaveta simultânea da Base Principal + Ponte dentro da partida e evoluir o Quartel
            page.click('[data-testid="lb-open-shared-citadel-btn"]')
            page.wait_for_selector('[data-testid="lb-shared-citadel-drawer"]', timeout=5000)
            shot_drawer = os.path.join(artifacts_dir, "v10_01_shared_wallet_and_living_bases.png")
            page.screenshot(path=shot_drawer)
            report["screenshots"].append(shot_drawer)

            page.click('[data-testid="lb-match-upgrade-citadel-quartel"]')
            time.sleep(0.15)
            quartel_lvl_after = page.evaluate(
                "() => window.__lbStore.getState().save.citadelLevels.quartel"
            )
            wallet_after_upgrades = page.evaluate(
                "() => window.__lbStore.getState().getSharedWalletBalance()"
            )
            assert quartel_lvl_after == quartel_lvl_before + 1, (
                f"Quartel da Base Principal deveria evoluir dentro da partida: {quartel_lvl_before} -> {quartel_lvl_after}"
            )
            assert wallet_after_upgrades < wallet_before_upgrades, (
                f"Carteira Compartilhada deve descontar atomicamente os custos: {wallet_before_upgrades} -> {wallet_after_upgrades}"
            )

            # Validar que o HUD minimalista continua respeitando R1-08 (<= 45 chars) e Tactical Dock (<= 15 chars)
            hud_text_len = page.evaluate(
                """() => {
                    const el = document.querySelector('[data-testid="logic-battle-hud"]');
                    return el ? el.innerText.replace(/\\s+/g, '').length : 999;
                }"""
            )
            dock_text_len = page.evaluate(
                """() => {
                    const el = document.querySelector('[data-testid="lb-tactical-dock"]');
                    return el ? el.innerText.replace(/\\s+/g, '').length : 999;
                }"""
            )
            assert hud_text_len <= 45, f"R1-08 violado: hud_text_len={hud_text_len} > 45"
            assert dock_text_len <= 15, f"Dock minimalista violado: dock_text_len={dock_text_len} > 15"

            report["checks"]["SIT_V10_LIVING_BASES_AND_SHARED_WALLET"] = {
                "status": "PASS",
                "enemyEvolution": enemy_evo_audit,
                "towersBefore": towers_before,
                "towersAfter": towers_after,
                "quartelLevelBefore": quartel_lvl_before,
                "quartelLevelAfter": quartel_lvl_after,
                "sharedWalletBefore": wallet_before_upgrades,
                "sharedWalletAfter": wallet_after_upgrades,
                "hudTextLen": hud_text_len,
                "dockTextLen": dock_text_len,
            }

            # =========================================================================
            # 4. UAT-V10-BRIDGE-DECONSTRUCTION-TRANSITION: Animação 3D de Desconstrução ao Voltar
            # =========================================================================
            wallet_before_return = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    window.__lbStore.setState({
                        snapshot: {
                            ...st.snapshot,
                            phase: 'PAUSED',
                        },
                    });
                    return window.__lbStore.getState().getSharedWalletBalance();
                }"""
            )
            page.click('[data-testid="lb-tab-world-realm"]')
            # Capturar estado intermediário da desconstrução 3D
            time.sleep(0.08)
            deconstruct_mid = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    return {
                        isDeconstructingBridge: st.isDeconstructingBridge,
                        deconstructionProgress: st.deconstructionProgress,
                    };
                }"""
            )
            page.wait_for_selector('[data-testid="logic-battle-realm-stage"]', timeout=5000)
            time.sleep(0.25)
            after_return = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    return {
                        world: st.world,
                        reserveTroops: st.save.reserveTroops,
                        quartelLevel: st.save.citadelLevels.quartel,
                        playerBridgeTowerLevels: st.save.playerBridgeTowerLevels,
                        deconstructionCompletedCount: st.deconstructionCompletedCount,
                        deconstructionProgress: st.deconstructionProgress,
                    };
                }"""
            )
            assert after_return["world"] == "realm", f"Esperado world === 'realm', obtido {after_return}"
            assert after_return["reserveTroops"] == wallet_before_return, (
                f"Carteira Compartilhada dessincronizada ao chegar na Base Principal! "
                f"Na ponte={wallet_before_return}, na Base={after_return['reserveTroops']}"
            )
            assert after_return["quartelLevel"] == quartel_lvl_after, (
                f"Nivel do Quartel evoluido na ponte nao persistiu na Base Principal: {after_return}"
            )
            assert after_return["deconstructionCompletedCount"] >= 1, (
                f"Transição de desconstrução 3D da ponte não completou: {after_return}"
            )
            shot_realm = os.path.join(artifacts_dir, "v10_02_realm_after_bridge_deconstruction.png")
            page.screenshot(path=shot_realm)
            report["screenshots"].append(shot_realm)

            report["checks"]["UAT_V10_BRIDGE_DECONSTRUCTION_TRANSITION"] = {
                "status": "PASS",
                "deconstructMidState": deconstruct_mid,
                "afterReturnState": after_return,
            }

            ctx.close()
            browser.close()

        assert len(report["consoleErrors"]) == 0, f"Console errors: {report['consoleErrors']}"
        assert len(report["pageErrors"]) == 0, f"Page errors: {report['pageErrors']}"
        report["status"] = "ALL_V10_FASE1_CHECKS_PASSED"

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

    report_path = os.path.join(artifacts_dir, "v10_fase1_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    return report


if __name__ == "__main__":
    out = run_v10_fase1_verification()
    print(json.dumps(out, indent=2, ensure_ascii=False))
    sys.exit(0)
