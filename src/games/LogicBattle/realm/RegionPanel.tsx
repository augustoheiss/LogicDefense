// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/RegionPanel.tsx — Painel de Expedição & Precisão Cirúrgica
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react'
import { BIOMES } from '../config/biomes'
import { REGIONS } from '../config/regions'
import { canAttackRegion } from '../domain/economy'
import { formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const RegionPanel: React.FC = () => {
  const save = useLogicBattleStore((s) => s.save)
  const lastDirectResult = useLogicBattleStore((s) => s.lastDirectAttackResult)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)
  const attackRegionDirect = useLogicBattleStore((s) => s.attackRegionDirect)

  const region = REGIONS[save.selectedRegionId] ?? REGIONS.r01_ponte_aurora
  const biome = BIOMES[region.biomeId]
  const isConquered = save.conqueredRegionIds.includes(region.id)
  const isAttackable = canAttackRegion(region.id, save.conqueredRegionIds)
  const surgicalTarget = region.garrison + 1
  const canAffordSurgical = save.reserveTroops >= surgicalTarget

  const [customTroops, setCustomTroops] = useState<number>(surgicalTarget)

  useEffect(() => {
    setCustomTroops(region.garrison + 1)
  }, [region.id, region.garrison])

  return (
    <section className="lb-region-panel" data-testid="lb-region-panel">
      <div className="lb-panel-badge-row">
        <span className="lb-badge-region">{biome.name}</span>
        <span className="lb-badge-type">{region.type.toUpperCase()}</span>
      </div>

      <h3 className="lb-panel-title" data-testid="lb-selected-region-name">
        {region.name}
      </h3>
      <p className="lb-panel-sub">
        Comandante Inimigo: <strong>{region.bossName}</strong> ({region.bossTitle})
      </p>

      <div className="lb-region-stats-grid">
        <div className="lb-stat-box">
          <span>Guarnição Regional</span>
          <strong>{formatArmy(region.garrison, save.settings.notationMode)}</strong>
        </div>
        <div className="lb-stat-box">
          <span>Força na Ponte (Horda+Chefe)</span>
          <strong>
            {formatArmy(region.garrison + region.bossHp, save.settings.notationMode)}
          </strong>
        </div>
        <div className="lb-stat-box">
          <span>Recompensa de Conquista</span>
          <strong>+{formatArmy(region.rewardTroops, save.settings.notationMode)}</strong>
        </div>
        <div className="lb-stat-box">
          <span>Tributo Passivo / Corrida</span>
          <strong>+{formatArmy(region.tributePerRun, save.settings.notationMode)}</strong>
        </div>
      </div>

      {/* Opção 1: Jogar a Corrida Matemática na Ponte (Mundo 1) */}
      <div className="lb-panel-action-block">
        <button
          type="button"
          data-testid="lb-launch-bridge-run-btn"
          className="lb-btn-primary"
          disabled={!isAttackable}
          onClick={() => startNewRun({ regionId: region.id })}
        >
          🌉 Marchar pela Ponte dos Portões ({region.name})
        </button>
      </div>

      {/* Opção 2: Conquista Direta com Bônus de Precisão Cirúrgica (Guarnição + 1) */}
      <div className="lb-surgical-box" data-testid="lb-surgical-box">
        <h4>🎯 Conquista por Precisão Cirúrgica (Garrison + 1)</h4>
        <p className="lb-surgical-desc">
          Envie exatamente <strong>{surgicalTarget} soldados</strong> ({region.garrison} + 1) da
          sua Reserva ({formatArmy(save.reserveTroops, save.settings.notationMode)}) para vencer
          sem desperdício e ganhar <strong>+25% de tropas bônus e +2 ★</strong>!
        </p>

        <div className="lb-surgical-controls">
          <input
            type="number"
            min={1}
            max={Math.max(1, save.reserveTroops)}
            value={customTroops}
            onChange={(e) => setCustomTroops(Math.max(1, Number(e.target.value) || 1))}
            className="lb-troop-input"
            data-testid="lb-direct-attack-input"
            aria-label="Quantidade de soldados para enviar"
          />

          <button
            type="button"
            data-testid="lb-surgical-preset-btn"
            className="lb-btn-secondary lb-btn-sm"
            onClick={() => setCustomTroops(surgicalTarget)}
          >
            Fixar {surgicalTarget} (G+1)
          </button>

          <button
            type="button"
            data-testid="lb-direct-attack-btn"
            className="lb-btn-primary lb-btn-gold"
            disabled={!isAttackable || save.reserveTroops < customTroops}
            onClick={() => attackRegionDirect(region.id, customTroops)}
          >
            ⚔ Enviar Expedição ({customTroops})
          </button>
        </div>

        {!canAffordSurgical && (
          <p className="lb-surgical-hint">
            💡 Vença corridas na Ponte para acumular {surgicalTarget} soldados na Reserva!
          </p>
        )}

        {isConquered && (
          <p className="lb-conquered-tag" data-testid="lb-region-conquered-tag">
            ✓ Província já integrada ao seu Reino!
          </p>
        )}

        {lastDirectResult && (
          <div
            className={`lb-direct-result-banner ${lastDirectResult.success ? 'is-win' : 'is-fail'}`}
            data-testid="lb-direct-attack-result"
          >
            {lastDirectResult.success
              ? lastDirectResult.surgicalPrecision
                ? `🎯 PRECISÃO CIRÚRGICA! +${lastDirectResult.rewardTroops + lastDirectResult.surgicalBonusTroops} soldados e +2 ★!`
                : `✓ Vitória Direta! +${lastDirectResult.rewardTroops} soldados adicionados.`
              : `Tropas insuficientes: é preciso enviar mais que a guarnição (${lastDirectResult.garrison}).`}
          </div>
        )}
      </div>
    </section>
  )
}
