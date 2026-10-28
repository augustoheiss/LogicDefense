# -*- coding: utf-8 -*-
"""
Auditoria Final QAR1 + SIT + UAT e Testes Visuais da Fase 3 (Master Plan V8) — Logic Battle
Valida:
  a) QAR1 Fim do Rubber-Banding: comprova que o HP do Boss no Setor S é 100% idêntico quer o
     jogador tenha 10 soldados ou 500.000 soldados (computeSectorBossHp(S)), enquanto o poder
     de tiro do jogador escala genuinamente com o exército.
  b) SIT/UAT Marcha do Boss + Golpe Corpo a Corpo + Derrota Real (Fim da Imortalidade):
     comprova que bossZ avança continuamente em direção ao jogador (-68 -> +7.7), entra em
     MELEE_CLASH, causa dano pesado real e leva um jogador fraco/AFK à derrota real
     (phase === 'DEFEAT', currentArmy === 0, lb-battle-overlay-defeat visível, screenshot capturada).
  c) SIT/UAT Morte Real do Boss + Desaparecimento por 7.5s (INTERMISSION) + Caravana Dourada:
     com um exército forte, derrota o Boss na ponte e comprova que no instante da morte
     bossLifecycle === 'INTERMISSION', bossHp === 0, bossRespawnTimerMs > 0,
     supplyCaravanActive === true (com screenshot da Caravana Dourada na ponte sem o Boss!),
     e que após os 7.5s nasce o Boss do próximo Setor lá no fundo (Z < -50) com
     bossLifecycle === 'MARCHING'.
  d) SIT/UAT 5 Arquétipos 3D de Boss: valida e captura screenshots dos 5 arquétipos ciclando
     entre os Setores 1 a 5 (bossArchetypeIndex 0, 1, 2, 3, 4).
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

PORT = 5173
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


def run_v8_fase3_audit() -> dict:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    artifacts_dir = os.path.join(repo_root, "artifacts", "playwright", "v8_fase3")
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
        "phase": "V8_FASE_3",
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

            # =========================================================================
            # TESTE A (QAR1): Fim do Rubber-Banding do Boss (10 vs 500.000 soldados)
            # =========================================================================
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

            qar1_sectors = [1, 2, 3, 4, 5, 10]
            qar1_matrix = []
            for target_sector in qar1_sectors:
                # Medir com 10 soldados
                page.evaluate(
                    """(s) => {
                        if (s === 1) {
                            window.__lbStore.setState((prev) => ({
                                bridgeSectorIndex: 1,
                                snapshot: { ...prev.snapshot, currentArmy: 10 },
                            }));
                            window.__lbStore.getState().startNewRun({ seed: 42 });
                            window.__lbStore.setState((prev) => ({
                                snapshot: { ...prev.snapshot, currentArmy: 10 },
                            }));
                        } else {
                            window.__lbStore.setState((prev) => ({
                                bridgeSectorIndex: s - 1,
                                snapshot: { ...prev.snapshot, currentArmy: 10 },
                            }));
                            window.__lbStore.getState().advanceInfiniteBridgeSector();
                            window.__lbStore.setState((prev) => ({
                                snapshot: { ...prev.snapshot, currentArmy: 10 },
                            }));
                        }
                    }""",
                    target_sector,
                )
                page.wait_for_function(
                    f"() => window.__lbBridge3DTelemetry?.sectorIndex === {target_sector}",
                    timeout=4000,
                )
                low_sample = page.evaluate(
                    """() => ({
                        telBossMaxHp: window.__lbBridge3DTelemetry.bossMaxHp,
                        storeBossHp: window.__lbStore.getState().snapshot.enemy.bossHp,
                        damagePerShot: window.__lbBridge3DTelemetry.damagePerShot,
                        parallelBarrels: window.__lbBridge3DTelemetry.parallelBarrels,
                    })"""
                )

                # Medir com 500.000 soldados no mesmo Setor S
                page.evaluate(
                    """(s) => {
                        if (s === 1) {
                            window.__lbStore.setState((prev) => ({
                                bridgeSectorIndex: 1,
                                snapshot: { ...prev.snapshot, currentArmy: 500000 },
                            }));
                            window.__lbStore.getState().startNewRun({ seed: 42 });
                            window.__lbStore.setState((prev) => ({
                                snapshot: { ...prev.snapshot, currentArmy: 500000 },
                            }));
                        } else {
                            window.__lbStore.setState((prev) => ({
                                bridgeSectorIndex: s - 1,
                                snapshot: { ...prev.snapshot, currentArmy: 500000 },
                            }));
                            window.__lbStore.getState().advanceInfiniteBridgeSector();
                            window.__lbStore.setState((prev) => ({
                                snapshot: { ...prev.snapshot, currentArmy: 500000 },
                            }));
                        }
                    }""",
                    target_sector,
                )
                page.wait_for_function(
                    f"() => window.__lbBridge3DTelemetry?.sectorIndex === {target_sector} && window.__lbBridge3DTelemetry?.parallelBarrels === 6",
                    timeout=4000,
                )
                high_sample = page.evaluate(
                    """() => ({
                        telBossMaxHp: window.__lbBridge3DTelemetry.bossMaxHp,
                        storeBossHp: window.__lbStore.getState().snapshot.enemy.bossHp,
                        damagePerShot: window.__lbBridge3DTelemetry.damagePerShot,
                        parallelBarrels: window.__lbBridge3DTelemetry.parallelBarrels,
                    })"""
                )

                assert low_sample["telBossMaxHp"] == high_sample["telBossMaxHp"], (
                    f"QAR1 Falhou no Setor {target_sector}: Boss MaxHP variou entre 10 ({low_sample}) e 500k ({high_sample})"
                )
                assert low_sample["storeBossHp"] == high_sample["storeBossHp"], (
                    f"QAR1 Falhou no Setor {target_sector}: Store enemy.bossHp variou entre 10 ({low_sample}) e 500k ({high_sample})"
                )
                assert high_sample["damagePerShot"] > low_sample["damagePerShot"] * 100, (
                    f"QAR1 Falhou no Setor {target_sector}: Poder de tiro deveria crescer massivamente com 500k soldados ({low_sample} vs {high_sample})"
                )

                qar1_matrix.append(
                    {
                        "sectorIndex": target_sector,
                        "bossHpWith10Army": low_sample["telBossMaxHp"],
                        "bossHpWith500kArmy": high_sample["telBossMaxHp"],
                        "damagePerShot10Army": low_sample["damagePerShot"],
                        "damagePerShot500kArmy": high_sample["damagePerShot"],
                        "identicalBossHp": low_sample["telBossMaxHp"]
                        == high_sample["telBossMaxHp"],
                    }
                )

            report["checks"]["qar1_zero_rubber_banding"] = {
                "status": "PASS",
                "sectorComparisons": qar1_matrix,
            }

            # =========================================================================
            # TESTE B (SIT/UAT): Marcha do Boss (-68 -> +7.7) + MELEE_CLASH + Derrota Real (AFK)
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

            # Posicionar jogador fraco/AFK (5 soldados iniciais) no centro da ponte sem coletar buffs
            # para medir a marcha contínua do Boss (-68 -> +7.7), o MELEE_CLASH e a derrota real (DEFEAT)
            z0_sample = page.evaluate(
                """() => {
                    window.__lbStore.getState().resetSaveData();
                    window.__lbStore.getState().startNewRun({ seed: 42 });
                    window.__lbStore.setState((prev) => ({
                        snapshot: {
                            ...prev.snapshot,
                            currentArmy: 5,
                            laneX: 0.0,
                            // Manter placas reais visíveis mas já marcadas como resolvidas para simular AFK puro com 5 soldados
                            resolvedSegments: Object.fromEntries(
                                prev.snapshot.segments.map((s) => [s.id, { chosenLane: -1, resultArmy: 5 }])
                            ),
                        },
                    }));
                    return {
                        bossZ: window.__lbBridge3DTelemetry.bossZ,
                        bossLifecycle: window.__lbBridge3DTelemetry.bossLifecycle,
                        bossHp: window.__lbBridge3DTelemetry.bossHp,
                        army: window.__lbStore.getState().snapshot.currentArmy,
                    };
                }"""
            )

            # Aguardar o Boss marchar além de Z = -40
            page.wait_for_function(
                "() => (window.__lbBridge3DTelemetry?.bossZ ?? -68) > -40",
                timeout=16000,
            )
            z1_sample = page.evaluate(
                """() => ({
                    bossZ: window.__lbBridge3DTelemetry.bossZ,
                    bossLifecycle: window.__lbBridge3DTelemetry.bossLifecycle,
                    bossHp: window.__lbBridge3DTelemetry.bossHp,
                    army: window.__lbStore.getState().snapshot.currentArmy,
                })"""
            )

            # Aguardar o Boss marchar até o meio/frente da ponte (Z > -18) e capturar screenshot da marcha
            page.wait_for_function(
                "() => (window.__lbBridge3DTelemetry?.bossZ ?? -68) > -18",
                timeout=14000,
            )
            z2_sample = page.evaluate(
                """() => ({
                    bossZ: window.__lbBridge3DTelemetry.bossZ,
                    bossLifecycle: window.__lbBridge3DTelemetry.bossLifecycle,
                    bossHp: window.__lbBridge3DTelemetry.bossHp,
                    army: window.__lbStore.getState().snapshot.currentArmy,
                })"""
            )
            shot_marching = os.path.join(
                artifacts_dir, "01a_boss_marching_on_bridge.png"
            )
            page.screenshot(path=shot_marching)
            report["screenshots"].append(shot_marching)

            # Aguardar o Boss alcançar a linha de frente (Z = +7.7) e entrar em MELEE_CLASH!
            page.wait_for_function(
                "() => window.__lbBridge3DTelemetry?.bossLifecycle === 'MELEE_CLASH' && window.__lbBridge3DTelemetry?.bossZ === 7.7",
                timeout=16000,
            )
            z3_melee_sample = page.evaluate(
                """() => ({
                    bossZ: window.__lbBridge3DTelemetry.bossZ,
                    bossLifecycle: window.__lbBridge3DTelemetry.bossLifecycle,
                    bossHp: window.__lbBridge3DTelemetry.bossHp,
                    army: window.__lbStore.getState().snapshot.currentArmy,
                    phase: window.__lbStore.getState().snapshot.phase,
                })"""
            )
            shot_melee = os.path.join(
                artifacts_dir, "01b_boss_melee_clash_frontline.png"
            )
            page.screenshot(path=shot_melee)
            report["screenshots"].append(shot_melee)

            # Aguardar o golpe corpo a corpo pesado do Boss zerar currentArmy e acionar phase === 'DEFEAT'!
            page.wait_for_function(
                "() => window.__lbStore.getState().snapshot.phase === 'DEFEAT' && window.__lbStore.getState().snapshot.currentArmy === 0",
                timeout=6000,
            )
            page.wait_for_selector(
                '[data-testid="lb-battle-overlay-defeat"]', timeout=5000
            )

            shot_defeat = os.path.join(
                artifacts_dir, "01c_afk_weak_player_real_defeat_overlay.png"
            )
            page.screenshot(path=shot_defeat)
            report["screenshots"].append(shot_defeat)

            defeat_state = page.evaluate(
                """() => {
                    const st = window.__lbStore.getState();
                    return {
                        phase: st.snapshot.phase,
                        currentArmy: st.snapshot.currentArmy,
                        battleOutcome: st.battleResolution?.outcome ?? null,
                        overlayVisible: document.querySelectorAll('[data-testid="lb-battle-overlay-defeat"]').length === 1,
                        telAtDefeat: { ...window.__lbBridge3DTelemetry },
                    };
                }"""
            )

            assert (
                z0_sample["bossZ"]
                < z1_sample["bossZ"]
                < z2_sample["bossZ"]
                < z3_melee_sample["bossZ"]
            ), (
                f"SIT/UAT Falhou: bossZ deve avancar monotonicamente em direcao ao jogador: "
                f"{z0_sample['bossZ']} -> {z1_sample['bossZ']} -> {z2_sample['bossZ']} -> {z3_melee_sample['bossZ']}"
            )
            assert (
                z3_melee_sample["bossLifecycle"] == "MELEE_CLASH"
                and z3_melee_sample["bossZ"] == 7.7
            ), f"SIT/UAT Falhou: Boss nao entrou em MELEE_CLASH em Z=7.7: {z3_melee_sample}"
            assert (
                defeat_state["phase"] == "DEFEAT"
                and defeat_state["currentArmy"] == 0
                and defeat_state["battleOutcome"] == "DEFEAT"
                and defeat_state["overlayVisible"] is True
            ), f"SIT/UAT Falhou: Jogador fraco/AFK deveria sofrer DEFEAT real com currentArmy=0: {defeat_state}"

            report["checks"]["sit_uat_boss_march_melee_and_real_defeat"] = {
                "status": "PASS",
                "marchTrajectoryZ": [
                    z0_sample["bossZ"],
                    z1_sample["bossZ"],
                    z2_sample["bossZ"],
                    z3_melee_sample["bossZ"],
                ],
                "meleeClashSample": z3_melee_sample,
                "defeatState": {
                    "phase": defeat_state["phase"],
                    "currentArmy": defeat_state["currentArmy"],
                    "battleOutcome": defeat_state["battleOutcome"],
                    "overlayVisible": defeat_state["overlayVisible"],
                },
            }

            # =========================================================================
            # TESTE C (SIT/UAT): Morte Real do Boss + INTERMISSION (7.5s) + Caravana Dourada + Respawn S2
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

            # Dar um exército forte (2.500 soldados) no centro da ponte no Setor 1 limpo para derrotar o Boss na ponte
            page.evaluate(
                """() => {
                    window.__lbStore.getState().resetSaveData();
                    window.__lbStore.getState().startNewRun({ seed: 42 });
                    window.__lbStore.setState((prev) => ({
                        bridgeSectorIndex: 1,
                        snapshot: {
                            ...prev.snapshot,
                            currentArmy: 2500,
                            laneX: 0.0,
                        },
                    }));
                }"""
            )

            # Aguardar o Boss morrer e entrar em INTERMISSION (7.5s sem Boss + Caravana Dourada ativa)
            page.wait_for_function(
                "() => window.__lbBridge3DTelemetry?.bossLifecycle === 'INTERMISSION'",
                timeout=12000,
            )
            intermission_start = page.evaluate(
                """() => ({
                    tel: { ...window.__lbBridge3DTelemetry },
                    storeSector: window.__lbStore.getState().bridgeSectorIndex,
                    storeArmy: window.__lbStore.getState().snapshot.currentArmy,
                    captainText: window.__lbStore.getState().captainSpeech.text,
                })"""
            )

            assert intermission_start["tel"]["bossLifecycle"] == "INTERMISSION", (
                f"SIT/UAT Falhou: bossLifecycle deveria ser INTERMISSION: {intermission_start}"
            )
            assert intermission_start["tel"]["bossHp"] == 0, (
                f"SIT/UAT Falhou: bossHp deve ser 0 durante INTERMISSION: {intermission_start}"
            )
            assert intermission_start["tel"]["bossRespawnTimerMs"] > 4500, (
                f"SIT/UAT Falhou: bossRespawnTimerMs deve iniciar em ~7500ms: {intermission_start}"
            )
            assert intermission_start["tel"]["supplyCaravanActive"] is True, (
                f"SIT/UAT Falhou: supplyCaravanActive deve ser true durante INTERMISSION: {intermission_start}"
            )

            # Capturar screenshot da Caravana Dourada na ponte sem o Boss!
            shot_caravan = os.path.join(
                artifacts_dir, "02a_boss_dead_intermission_golden_caravan.png"
            )
            page.screenshot(path=shot_caravan)
            report["screenshots"].append(shot_caravan)

            # Comprovar que 2 segundos depois o Boss continua em INTERMISSION com bossHp === 0 (não renasce no mesmo frame!)
            t_start_respawn = intermission_start["tel"]["bossRespawnTimerMs"]
            page.wait_for_function(
                f"() => window.__lbBridge3DTelemetry?.bossLifecycle === 'INTERMISSION' && window.__lbBridge3DTelemetry?.bossRespawnTimerMs < {t_start_respawn - 1500}",
                timeout=5000,
            )
            intermission_mid = page.evaluate(
                "() => ({ ...window.__lbBridge3DTelemetry })"
            )
            assert (
                intermission_mid["bossLifecycle"] == "INTERMISSION"
                and intermission_mid["bossHp"] == 0
                and intermission_mid["supplyCaravanActive"] is True
            ), f"SIT/UAT Falhou: Boss ou Caravana perderam estado no meio dos 7.5s: {intermission_mid}"

            # Aguardar os 7.5s de INTERMISSION terminarem e o Boss do próximo Setor nascer lá no fundo (Z < -50) com MARCHING!
            page.wait_for_function(
                "() => window.__lbBridge3DTelemetry?.bossLifecycle === 'MARCHING' && window.__lbBridge3DTelemetry?.bossRespawnTimerMs === 0",
                timeout=12000,
            )
            respawned_boss = page.evaluate(
                "() => ({ ...window.__lbBridge3DTelemetry })"
            )

            assert respawned_boss["bossLifecycle"] == "MARCHING", (
                f"SIT/UAT Falhou: Novo Boss deveria nascer em MARCHING: {respawned_boss}"
            )
            assert respawned_boss["bossZ"] < -50, (
                f"SIT/UAT Falhou: Novo Boss deve nascer no fundo da ponte (Z < -50), obtido Z={respawned_boss['bossZ']}"
            )
            assert respawned_boss["bossHp"] > 150, (
                f"SIT/UAT Falhou: Novo Boss do Setor 2 deve ter HP escalado (>150): {respawned_boss}"
            )
            assert respawned_boss["bossArchetypeIndex"] == 1, (
                f"SIT/UAT Falhou: Novo Boss do Setor 2 deve ter bossArchetypeIndex=1: {respawned_boss}"
            )
            assert respawned_boss["supplyCaravanActive"] is False, (
                f"SIT/UAT Falhou: Caravana deve encerrar quando o novo Boss nasce: {respawned_boss}"
            )

            shot_respawned = os.path.join(
                artifacts_dir, "02b_next_sector_boss_spawned_at_fortress.png"
            )
            page.screenshot(path=shot_respawned)
            report["screenshots"].append(shot_respawned)

            report["checks"]["sit_uat_boss_death_intermission_7500ms_and_caravan"] = {
                "status": "PASS",
                "intermissionStart": {
                    "bossLifecycle": intermission_start["tel"]["bossLifecycle"],
                    "bossHp": intermission_start["tel"]["bossHp"],
                    "bossRespawnTimerMs": intermission_start["tel"][
                        "bossRespawnTimerMs"
                    ],
                    "supplyCaravanActive": intermission_start["tel"][
                        "supplyCaravanActive"
                    ],
                    "supplyCaravanZ": intermission_start["tel"]["supplyCaravanZ"],
                },
                "intermissionMid": {
                    "bossLifecycle": intermission_mid["bossLifecycle"],
                    "bossHp": intermission_mid["bossHp"],
                    "bossRespawnTimerMs": intermission_mid["bossRespawnTimerMs"],
                    "supplyCaravanActive": intermission_mid["supplyCaravanActive"],
                    "supplyCaravanZ": intermission_mid["supplyCaravanZ"],
                },
                "nextBossSpawnedAfter7500ms": {
                    "sectorIndex": respawned_boss["sectorIndex"],
                    "bossLifecycle": respawned_boss["bossLifecycle"],
                    "bossZ": respawned_boss["bossZ"],
                    "bossHp": respawned_boss["bossHp"],
                    "bossMaxHp": respawned_boss["bossMaxHp"],
                    "bossArchetypeIndex": respawned_boss["bossArchetypeIndex"],
                    "bossArchetypeId": respawned_boss["bossArchetypeId"],
                    "bossArchetypeName": respawned_boss["bossArchetypeName"],
                },
            }

            # =========================================================================
            # TESTE D (SIT/UAT): 5 Arquétipos 3D de Boss nos Setores 1 a 5 (0..4)
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
            page.evaluate(
                """() => {
                    window.__lbStore.getState().resetSaveData();
                    window.__lbStore.getState().startNewRun({ seed: 42 });
                }"""
            )

            expected_archetypes = [
                (1, 0, "colosso_rubro", "Brutus, Colosso Rubro", "WARHAMMER"),
                (2, 1, "tita_crio_gelido", "Vórtex, Titã Crio-Gélido", "ICE_TRIDENT"),
                (3, 2, "senhor_magma", "Ignis, Senhor de Magma", "MAGMA_DUAL_CLUB"),
                (4, 3, "aracno_mecha", "Aracno-Mecha Imperial", "SPIDER_CANNONS"),
                (
                    5,
                    4,
                    "imperador_quiliarca",
                    "Imperador Quiliarca Dourado",
                    "SOLAR_LONGSWORD",
                ),
            ]
            archetype_records = []

            for (
                sec_num,
                exp_idx,
                exp_id,
                exp_name,
                exp_weapon,
            ) in expected_archetypes:
                if sec_num > 1:
                    page.evaluate(
                        "() => window.__lbStore.getState().advanceInfiniteBridgeSector()"
                    )
                page.evaluate(
                    """() => {
                        const st = window.__lbStore.getState();
                        window.__lbStore.setState({
                            snapshot: { ...st.snapshot, currentArmy: 5 }
                        });
                        window.__lbStore.getState().steerToRoute('LEFT');
                    }"""
                )
                page.wait_for_function(
                    f"() => window.__lbBridge3DTelemetry?.sectorIndex === {sec_num} && window.__lbBridge3DTelemetry?.bossArchetypeIndex === {exp_idx}",
                    timeout=5000,
                )
                spawn_z = page.evaluate("() => window.__lbBridge3DTelemetry.bossZ")
                assert spawn_z < -50, (
                    f"Setor {sec_num}: Boss deve nascer em Z < -50, obtido {spawn_z}"
                )

                # Avançar Boss até Z = -15 para capturar screenshot em close-up nítido do Arquétipo 3D na ponte
                page.evaluate(
                    "() => window.__lbSetBossZForAudit && window.__lbSetBossZForAudit(-15)"
                )
                page.wait_for_function(
                    "() => Math.abs((window.__lbBridge3DTelemetry?.bossZ ?? -68) - (-15)) < 3.5",
                    timeout=3000,
                )
                page.wait_for_timeout(160)
                arch_tel = page.evaluate("() => ({ ...window.__lbBridge3DTelemetry })")

                assert arch_tel["bossArchetypeIndex"] == exp_idx, (
                    f"SIT/UAT Falhou no Setor {sec_num}: bossArchetypeIndex esperado {exp_idx}, obtido {arch_tel}"
                )
                assert arch_tel["bossArchetypeId"] == exp_id, (
                    f"SIT/UAT Falhou no Setor {sec_num}: bossArchetypeId esperado {exp_id}, obtido {arch_tel}"
                )
                assert arch_tel["bossArchetypeName"] == exp_name, (
                    f"SIT/UAT Falhou no Setor {sec_num}: bossArchetypeName esperado {exp_name}, obtido {arch_tel}"
                )
                assert arch_tel.get("bossWeaponType") == exp_weapon, (
                    f"SIT/UAT Falhou no Setor {sec_num}: bossWeaponType esperado {exp_weapon}, obtido {arch_tel}"
                )

                shot_arch = os.path.join(
                    artifacts_dir,
                    f"0{sec_num + 2}_arch{exp_idx}_sector{sec_num}_{exp_id}.png",
                )
                page.screenshot(path=shot_arch)
                report["screenshots"].append(shot_arch)

                archetype_records.append(
                    {
                        "sectorIndex": sec_num,
                        "bossArchetypeIndex": arch_tel["bossArchetypeIndex"],
                        "bossArchetypeId": arch_tel["bossArchetypeId"],
                        "bossArchetypeName": arch_tel["bossArchetypeName"],
                        "bossWeaponType": arch_tel.get("bossWeaponType"),
                        "bossMaxHp": arch_tel["bossMaxHp"],
                        "screenshot": shot_arch,
                    }
                )

            report["checks"]["sit_uat_five_3d_boss_archetypes"] = {
                "status": "PASS",
                "archetypes": archetype_records,
            }

            ctx.close()
            browser.close()

        assert len(report["consoleErrors"]) == 0, (
            f"Erros de console encontrados: {report['consoleErrors']}"
        )
        assert len(report["pageErrors"]) == 0, (
            f"Erros de pagina encontrados: {report['pageErrors']}"
        )
        report["status"] = "ALL_V8_FASE3_CHECKS_PASSED"

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
    out = run_v8_fase3_audit()
    print(json.dumps(out, indent=2, ensure_ascii=False))
    sys.exit(0)
