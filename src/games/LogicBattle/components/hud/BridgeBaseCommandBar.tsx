// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/hud/BridgeBaseCommandBar.tsx
// V10 Fase 1: Barra Tática Compacta das Bases Vivas (Inimiga vs. Aliada)
// e Carteira Compartilhada em Tempo Real (Evolução Simultânea da Ponte + Cidadela)
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { CITADEL_BUILDING_LIST, getUpgradeCost } from '../../config/upgrades'
import { formatArmy } from '../../domain/notation'
import {
  computeAlliedBridgeTowerStats,
  getBridgeTowerUpgradeCost,
  PLAYER_BRIDGE_BASE_POLICY,
} from '../../run/bridge3d/bridge3dPolicies'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'

export const BridgeBaseCommandBar: React.FC = () => {
  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const currentArmy = useLogicBattleStore((s) => s.snapshot.currentArmy)
  const bridgeCoinsEarned = useLogicBattleStore((s) => s.snapshot.bridgeCoinsEarned ?? 0)
  const reserveTroops = useLogicBattleStore((s) => s.save.reserveTroops)
  const citadelLevels = useLogicBattleStore((s) => s.save.citadelLevels)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const enemyBaseLevel = useLogicBattleStore((s) => s.enemyBaseLevel)
  const enemyDebuffTowersActive = useLogicBattleStore((s) => s.enemyDebuffTowersActive)
  const playerBridgeTowerLevels = useLogicBattleStore((s) => s.playerBridgeTowerLevels)
  const bridgeBaseDrawerOpen = useLogicBattleStore((s) => s.bridgeBaseDrawerOpen)
  const isDeconstructingBridge = useLogicBattleStore((s) => s.isDeconstructingBridge)
  const deconstructionProgress = useLogicBattleStore((s) => s.deconstructionProgress)

  const getSharedWalletBalance = useLogicBattleStore((s) => s.getSharedWalletBalance)
  const toggleBridgeBaseDrawer = useLogicBattleStore((s) => s.toggleBridgeBaseDrawer)
  const upgradeBridgeTowerInMatch = useLogicBattleStore((s) => s.upgradeBridgeTowerInMatch)
  const upgradeCitadelBuilding = useLogicBattleStore((s) => s.upgradeCitadelBuilding)

  // Recomputa carteira reativamente sempre que exército, moedas ou reserva mudam
  const sharedBalance = React.useMemo(() => {
    void currentArmy
    void bridgeCoinsEarned
    void reserveTroops
    return getSharedWalletBalance()
  }, [currentArmy, bridgeCoinsEarned, reserveTroops, getSharedWalletBalance])

  const alliedStats = computeAlliedBridgeTowerStats(playerBridgeTowerLevels)

  // Escolhe o slot de Torre da Ponte mais barato ainda abaixo do nível máximo para o botão rápido 1-clique
  const nextTowerCandidate = React.useMemo(() => {
    let bestSlot: 0 | 1 | 2 | 3 = 0
    let bestLvl = 999
    for (let i = 0; i < 4; i++) {
      const idx = i as 0 | 1 | 2 | 3
      const lvl = playerBridgeTowerLevels[idx] ?? 0
      if (lvl < bestLvl) {
        bestLvl = lvl
        bestSlot = idx
      }
    }
    const cost = getBridgeTowerUpgradeCost(bestLvl)
    return {
      slotIndex: bestSlot,
      currentLevel: bestLvl,
      cost,
      canAfford:
        bestLvl < PLAYER_BRIDGE_BASE_POLICY.maxTowerLevel && sharedBalance >= cost,
      isMaxed: bestLvl >= PLAYER_BRIDGE_BASE_POLICY.maxTowerLevel,
    }
  }, [playerBridgeTowerLevels, sharedBalance])

  if (phase === 'VICTORY' || phase === 'DEFEAT') {
    return null
  }

  return (
    <>
      {isDeconstructingBridge && (
        <div
          data-testid="lb-bridge-deconstruction-banner"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 48,
            padding: '10px 18px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid #38bdf8',
            color: '#f8fafc',
            fontSize: '0.85rem',
            fontWeight: 700,
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)',
          }}
        >
          🏗️ Desconstruindo Ponte 3D ({Math.round(deconstructionProgress * 100)}%) ·
          Carteira Sincronizada!
        </div>
      )}

      <div
        className="lb-bridge-base-command-bar"
        data-testid="lb-bridge-base-command-bar"
        style={{
          position: 'absolute',
          left: activeEngineId === 'serpente_numeros' ? '116px' : '12px',
          bottom: activeEngineId === 'serpente_numeros' ? '68px' : '74px',
          zIndex: 26,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'auto',
        }}
      >
        <div
          data-testid="lb-shared-wallet-badge"
          title="Carteira Compartilhada (Reserva da Base Principal + Ganhos na Ponte em Tempo Real)"
          style={{
            padding: '4px 9px',
            minWidth: '88px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            borderRadius: '999px',
            background: 'rgba(15, 23, 42, 0.86)',
            border: '1px solid rgba(250, 204, 21, 0.55)',
            color: '#fef08a',
            fontSize: '0.74rem',
            fontWeight: 700,
          }}
        >
          💰 {formatArmy(sharedBalance, notationMode)}
        </div>

        <div
          data-testid="lb-enemy-base-status"
          title="Base Viva Inimiga: evolui durante a partida e constrói Torres de Debuff nos parapeitos"
          style={{
            padding: '4px 9px',
            borderRadius: '999px',
            background: 'rgba(69, 10, 10, 0.88)',
            border: '1px solid rgba(248, 113, 113, 0.6)',
            color: '#fecaca',
            fontSize: '0.73rem',
            fontWeight: 700,
          }}
        >
          💀 Base Inimiga Nv.{enemyBaseLevel} · {enemyDebuffTowersActive}T
        </div>

        <button
          type="button"
          data-testid="lb-quick-upgrade-bridge-tower-btn"
          disabled={!nextTowerCandidate.canAfford}
          onClick={() => upgradeBridgeTowerInMatch(nextTowerCandidate.slotIndex)}
          title="Construir/Evoluir Torre Defensiva da Ponte usando a Carteira Compartilhada"
          style={{
            padding: '4px 10px',
            borderRadius: '999px',
            background: nextTowerCandidate.canAfford
              ? 'linear-gradient(135deg, #0284c7, #0369a1)'
              : 'rgba(30, 41, 59, 0.82)',
            border: '1px solid rgba(125, 211, 252, 0.6)',
            color: nextTowerCandidate.canAfford ? '#ffffff' : '#94a3b8',
            fontSize: '0.73rem',
            fontWeight: 700,
            cursor: nextTowerCandidate.canAfford ? 'pointer' : 'not-allowed',
          }}
        >
          🗼 +Torre Ponte (Nv.{alliedStats.totalLevel}) ·{' '}
          {nextTowerCandidate.isMaxed
            ? 'MÁX'
            : formatArmy(nextTowerCandidate.cost, notationMode)}
        </button>

        <button
          type="button"
          data-testid="lb-open-shared-citadel-btn"
          onClick={() => toggleBridgeBaseDrawer()}
          title="Evoluir Base da Ponte e Base Principal simultaneamente com a mesma Carteira"
          style={{
            padding: '4px 10px',
            borderRadius: '999px',
            background: bridgeBaseDrawerOpen
              ? 'linear-gradient(135deg, #d97706, #b45309)'
              : 'rgba(15, 23, 42, 0.88)',
            border: '1px solid rgba(251, 191, 36, 0.65)',
            color: '#fde68a',
            fontSize: '0.73rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🏰 Bases ({alliedStats.activeTowersCount}/4)
        </button>
      </div>

      {bridgeBaseDrawerOpen && (
        <aside
          data-testid="lb-shared-citadel-drawer"
          aria-label="Comando Simultâneo: Base da Ponte e Base Principal"
          style={{
            position: 'absolute',
            left: activeEngineId === 'serpente_numeros' ? '116px' : '12px',
            bottom: '112px',
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: '62vh',
            overflowY: 'auto',
            zIndex: 35,
            padding: '12px',
            borderRadius: '14px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            color: '#f8fafc',
            boxShadow: '0 14px 32px rgba(0, 0, 0, 0.55)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <strong style={{ fontSize: '0.82rem', color: '#7dd3fc' }}>
              ⚡ Carteira Compartilhada: {formatArmy(sharedBalance, notationMode)} 🛡️
            </strong>
            <button
              type="button"
              data-testid="lb-close-shared-citadel-btn"
              onClick={() => toggleBridgeBaseDrawer(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(148, 163, 184, 0.4)',
                color: '#cbd5e1',
                borderRadius: '6px',
                padding: '2px 7px',
                cursor: 'pointer',
                fontSize: '0.72rem',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: '0.73rem', color: '#bae6fd', marginBottom: '6px' }}>
            🗼 <strong>Torres Defensivas da Ponte</strong> (Atiram na Horda + Escudo Anti-Debuff)
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              marginBottom: '10px',
            }}
          >
            {PLAYER_BRIDGE_BASE_POLICY.slots.map((slot) => {
              const lvl = playerBridgeTowerLevels[slot.slotIndex] ?? 0
              const isMax = lvl >= PLAYER_BRIDGE_BASE_POLICY.maxTowerLevel
              const cost = getBridgeTowerUpgradeCost(lvl)
              const canBuy = !isMax && sharedBalance >= cost
              return (
                <button
                  key={slot.id}
                  type="button"
                  data-testid={`lb-match-upgrade-tower-${slot.slotIndex}`}
                  disabled={!canBuy}
                  onClick={() => upgradeBridgeTowerInMatch(slot.slotIndex)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    background: canBuy
                      ? 'rgba(2, 132, 199, 0.25)'
                      : 'rgba(30, 41, 59, 0.65)',
                    border: `1px solid ${canBuy ? '#38bdf8' : 'rgba(100,116,139,0.35)'}`,
                    color: canBuy ? '#f0f9ff' : '#94a3b8',
                    fontSize: '0.7rem',
                    cursor: canBuy ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div>
                    <strong>{slot.namePt}</strong> · Nv.{lvl}
                  </div>
                  <div style={{ fontSize: '0.66rem', opacity: 0.9 }}>
                    {isMax ? 'MÁX' : `Custo: ${formatArmy(cost, notationMode)}`}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: '0.73rem', color: '#fde68a', marginBottom: '6px' }}>
            🏰 <strong>Base Principal (Cidadela)</strong> — Evolução Simultânea na Partida
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {CITADEL_BUILDING_LIST.map((b) => {
              const lvl = citadelLevels[b.id] ?? 0
              const isMax = lvl >= b.maxLevel
              const cost = getUpgradeCost(b.id, lvl)
              const canBuy = !isMax && sharedBalance >= cost
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    background: 'rgba(30, 41, 59, 0.72)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    fontSize: '0.71rem',
                  }}
                >
                  <span>
                    {b.icon} <strong>{b.name}</strong> Nv.{lvl}/{b.maxLevel}
                  </span>
                  <button
                    type="button"
                    data-testid={`lb-match-upgrade-citadel-${b.id}`}
                    disabled={!canBuy}
                    onClick={() => upgradeCitadelBuilding(b.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: canBuy ? '#d97706' : 'rgba(51, 65, 85, 0.8)',
                      border: 'none',
                      color: canBuy ? '#fffbeb' : '#64748b',
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      cursor: canBuy ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isMax ? 'MÁX' : `Evoluir (${formatArmy(cost, notationMode)})`}
                  </button>
                </div>
              )
            })}
          </div>
        </aside>
      )}
    </>
  )
}
