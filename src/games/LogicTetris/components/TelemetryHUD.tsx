import React from 'react'
import { GameMode, SubGameStyle } from '../types'
import { FRUIT_CATALOG } from '../engine/fruitMatchEngine'
import { getPieceDefinition } from '../engine/tetrominoes'
import { toggleLogicTetrisFullscreen } from '../hooks/useGameLoop'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'
import { MiniPieceMatrixPreview } from './PieceAlchemyBar'

export interface TelemetryHUDProps {
  className?: string
}

const MODE_LABELS: Record<GameMode, { badge: string; color: string }> = {
  zen: {
    badge: '🌱 Zen Passatempo',
    color: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
  },
  arcade: {
    badge: '⚡ Gênesis Arcade',
    color: 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200',
  },
  master: {
    badge: '🔥 Mestre da Balança',
    color: 'bg-amber-500/20 border-amber-300/50 text-amber-200',
  },
}

const STYLE_BUTTONS: ReadonlyArray<{
  style: SubGameStyle
  label: string
  shortHint: string
}> = [
  {
    style: 'TETRIS_CLASSIC',
    label: '🧱 Clássico',
    shortHint: 'Torre 20×10',
  },
  {
    style: 'FRUIT_MATCH',
    label: '🍎 Frutas',
    shortHint: 'Troca 10×10',
  },
  {
    style: 'TACTILE_GRID',
    label: '🧩 Grade 10×10',
    shortHint: 'Macro H×V',
  },
]

/**
 * Telemetry HUD, Trinity Style Switcher & Interactive Tactile Tray (`TelemetryHUD.tsx`).
 *
 * Incorporates Auditor Improvements & Master Plan V2:
 * - `Melhoria 06-B`: Adds `data-testid="trinity-style-hud"` with 3 instant style switcher buttons
 *   (`style-btn-TETRIS_CLASSIC`, `style-btn-FRUIT_MATCH`, `style-btn-TACTILE_GRID`),
 *   rotation mode toggle (`btn-toggle-style-rotation`: `"🌀 Simultâneo (X/4) [L]"` vs. `"🔒 Estilo Travado [L]"`),
 *   and polymorphic Reserve/Queue panel (`btn-hold-piece` + `hud-next-queue` containing `tactile-piece-tray`
 *   with `tactile-tray-slot-0..2` when in `TACTILE_GRID`).
 * - `Master Plan V2`: Fullscreen button (`btn-toggle-fullscreen` `[F]`) + 10×10 Swap-Fruit Oracle card in `FRUIT_MATCH`.
 * - Preserves 100% of existing `data-testid` attributes (`hud-score`, `hud-lines`, `hud-streak-counter`,
 *   `hud-phoenix-shields`, `btn-hold-piece`, `hud-next-queue`, `btn-toggle-codex`, `btn-toggle-mute`, `btn-toggle-pause`).
 */
export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ className = '' }) => {
  const phase = useLogicTetrisStore((s) => s.phase)
  const mode = useLogicTetrisStore((s) => s.mode)
  const score = useLogicTetrisStore((s) => s.score)
  const lines = useLogicTetrisStore((s) => s.lines)
  const level = useLogicTetrisStore((s) => s.level)
  const combo = useLogicTetrisStore((s) => s.combo)
  const comboGraceDropsLeft = useLogicTetrisStore((s) => s.comboGraceDropsLeft)
  const maxStreakInSession = useLogicTetrisStore((s) => s.maxStreakInSession)
  const logicCharge = useLogicTetrisStore((s) => s.logicCharge)
  const phoenixShields = useLogicTetrisStore((s) => s.phoenixShields)
  const holdPieceType = useLogicTetrisStore((s) => s.holdPieceType)
  const canHold = useLogicTetrisStore((s) => s.canHold)
  const nextQueue = useLogicTetrisStore((s) => s.nextQueue)
  const solvedCount = useLogicTetrisStore((s) => s.solvedHistory.length)
  const isMuted = useLogicTetrisStore((s) => s.isMuted)
  const isFullscreen = useLogicTetrisStore((s) => s.isFullscreen)
  const highScore = useLogicTetrisStore((s) => s.stats.highScore)

  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const styleRotationMode = useLogicTetrisStore((s) => s.styleRotationMode)
  const styleShiftProgress = useLogicTetrisStore((s) => s.styleShiftProgress)
  const styleShiftTarget = useLogicTetrisStore((s) => s.styleShiftTarget)
  const fruitOracle = useLogicTetrisStore((s) => s.fruitOracle)
  const tactileTray = useLogicTetrisStore((s) => s.tactileTray)
  const selectedTraySlot = useLogicTetrisStore((s) => s.selectedTraySlot)

  const holdCurrentPiece = useLogicTetrisStore((s) => s.holdCurrentPiece)
  const rotatePiece = useLogicTetrisStore((s) => s.rotatePiece)
  const setSubGameStyle = useLogicTetrisStore((s) => s.setSubGameStyle)
  const toggleStyleRotationMode = useLogicTetrisStore((s) => s.toggleStyleRotationMode)
  const selectTactileTraySlot = useLogicTetrisStore((s) => s.selectTactileTraySlot)
  const togglePause = useLogicTetrisStore((s) => s.togglePause)
  const toggleCodex = useLogicTetrisStore((s) => s.toggleCodex)
  const toggleMute = useLogicTetrisStore((s) => s.toggleMute)
  const returnToHub = useLogicTetrisStore((s) => s.returnToHub)

  const modeInfo = MODE_LABELS[mode]
  const holdDef = holdPieceType ? getPieceDefinition(holdPieceType) : null
  const nextThree = nextQueue.slice(0, 3)
  const linesToNextShield = 10 - (lines % 10)

  const recommendedFruitMeta =
    FRUIT_CATALOG[fruitOracle.recommendedFruit] ?? FRUIT_CATALOG.APPLE_RUBY
  const fragmentedFruitMeta =
    FRUIT_CATALOG[fruitOracle.mostFragmentedFruit] ?? FRUIT_CATALOG.CITRUS_GOLD

  const selectedTrayOption = tactileTray[selectedTraySlot]
  const selectedTrayDef = selectedTrayOption
    ? getPieceDefinition(selectedTrayOption.type)
    : null

  const handleHoldOrStyleAction = () => {
    if (phase !== 'PLAYING') return
    if (activeSubGameStyle === 'TACTILE_GRID') {
      rotatePiece('CW')
      return
    }
    holdCurrentPiece()
  }

  return (
    <aside
      className={`flex flex-col gap-3 ${className}`}
      aria-label="Painel de Telemetria, Cordão Tríplice dos Blocos, Fila de Peças e Escudos Fênix"
    >
      {/* Top Action & Mode Bar */}
      <div className="lt-glass-panel rounded-2xl p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold ${modeInfo.color}`}
          >
            {modeInfo.badge}
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => toggleLogicTetrisFullscreen()}
              data-testid="btn-toggle-fullscreen"
              title={
                isFullscreen
                  ? 'Sair da Tela Cheia (Tecla [F] ou [Esc])'
                  : 'Expandir Arena em Tela Cheia (Tecla [F])'
              }
              className={`px-2 py-1 rounded-lg border text-xs font-mono font-semibold transition cursor-pointer ${
                isFullscreen
                  ? 'bg-purple-950/90 hover:bg-purple-900 border-purple-400 text-purple-100'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              {isFullscreen ? '⛶ Sair [F]' : '⛶ Tela Cheia [F]'}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              data-testid="btn-toggle-mute"
              title={isMuted ? 'Ativar Som Pentatônico' : 'Silenciar Áudio'}
              className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 transition cursor-pointer"
            >
              {isMuted ? '🔇 Mudo' : '🔊 Som'}
            </button>

            <button
              type="button"
              onClick={() => toggleCodex()}
              data-testid="btn-toggle-codex"
              title="Abrir Códice Pedagógico e Histórico de Contas [H]"
              className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/50 text-xs font-mono font-semibold text-cyan-200 transition cursor-pointer flex items-center gap-1"
            >
              <span>📚 Códice [H]</span>
              {solvedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-extrabold">
                  {solvedCount}
                </span>
              )}
            </button>

            {(phase === 'PLAYING' || phase === 'PAUSED') && (
              <button
                type="button"
                onClick={togglePause}
                data-testid="btn-toggle-pause"
                className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 transition cursor-pointer"
              >
                {phase === 'PAUSED' ? '▶️ [P]' : '⏸️ [P]'}
              </button>
            )}
          </div>
        </div>

        {/* =====================================================================
            TRINITY STYLE CONTROL PANEL (`data-testid="trinity-style-hud"` — Melhoria 06-B)
            ===================================================================== */}
        <div
          className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5 flex flex-col gap-2"
          data-testid="trinity-style-hud"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">
              🧶 Cordão Tríplice [G]
            </span>

            <button
              type="button"
              onClick={toggleStyleRotationMode}
              data-testid="btn-toggle-style-rotation"
              title="Alternar entre Modo Simultâneo 3-em-1 e Travar no Estilo Atual [L]"
              className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                styleRotationMode === 'SIMULTANEOUS'
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/30'
                  : 'bg-amber-500/20 border-amber-400/70 text-amber-200 hover:bg-amber-500/30'
              }`}
            >
              {styleRotationMode === 'SIMULTANEOUS' ? (
                <>
                  <span>
                    🌀 Simultâneo ({styleShiftProgress}/{styleShiftTarget}) [L]
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    {Array.from({ length: styleShiftTarget }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i < styleShiftProgress ? 'bg-amber-300' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </span>
                </>
              ) : (
                <span>🔒 Estilo Travado [L]</span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {STYLE_BUTTONS.map((btn) => {
              const isActive = activeSubGameStyle === btn.style
              return (
                <button
                  key={btn.style}
                  type="button"
                  onClick={() => setSubGameStyle(btn.style)}
                  data-testid={`style-btn-${btn.style}`}
                  className={`px-2 py-1.5 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    isActive
                      ? 'bg-cyan-950/90 border-cyan-400 text-white shadow-[0_0_12px_rgba(34,211,238,0.28)]'
                      : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[11px] font-mono font-bold leading-tight">
                    {btn.label}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 leading-tight">
                    {btn.shortHint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Score, Lines, Level & Phoenix Shields Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Pontuação (Recorde: {highScore.toLocaleString('pt-BR')})
            </div>
            <div
              className="text-lg font-extrabold font-mono text-white tracking-tight"
              data-testid="hud-score"
            >
              {score.toLocaleString('pt-BR')}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Linhas Base-10 · Nível {level}
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span
                className="text-lg font-extrabold font-mono text-emerald-300"
                data-testid="hud-lines"
              >
                {lines}
              </span>
              <span
                data-testid="hud-streak-counter"
                title={
                  combo > 0
                    ? `Sequência ativa ×${combo} (Janela de ritmo: ${comboGraceDropsLeft} encaixe(s) preparatório(s) · Recorde da sessão: ×${maxStreakInSession})`
                    : `Sequência pronta (Recorde da sessão: ×${maxStreakInSession})`
                }
                className={`text-[11px] font-mono font-bold transition ${
                  combo >= 12
                    ? 'text-yellow-300 animate-bounce'
                    : combo > 0
                      ? 'text-amber-300 animate-pulse'
                      : 'text-slate-400'
                }`}
              >
                {combo >= 12
                  ? `👑 Sequência ×${combo}!`
                  : combo > 0
                    ? `🔥 Sequência ×${combo} (${comboGraceDropsLeft}⏳)`
                    : `🔥 Sequência ×0`}
              </span>
            </div>
          </div>
        </div>

        {/* Phoenix Shields (Protocolo 142857) & Logic Charge */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-purple-950/40 border border-purple-500/40 px-3 py-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-purple-200">
              <span>ESCUDO FÊNIX</span>
              <span className="text-amber-300 font-bold" data-testid="hud-phoenix-shields">
                {mode === 'zen' ? '🛡️ ∞ (Zen)' : `🛡️ ×${phoenixShields}`}
              </span>
            </div>
            <div className="text-[10px] text-purple-200/80 mt-0.5 leading-tight">
              {mode === 'zen'
                ? 'Salvação Fênix ilimitada no topo!'
                : `+1 escudo em ${linesToNextShield} linha(s)`}
            </div>
          </div>

          <div className="rounded-xl bg-cyan-950/40 border border-cyan-500/40 px-3 py-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-cyan-200">
              <span>CARGA LÓGICA</span>
              <span className="font-bold text-cyan-300">{logicCharge}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden mt-[4px] border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, logicCharge))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Polymorphic Hold [C] & Next Queue / Tactile 3-Piece Tray (`Melhoria 06-B`) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Hold Piece Slot / Fruit Swap Oracle Focus / Rotate Tactile Piece */}
        <button
          type="button"
          disabled={
            phase !== 'PLAYING' ||
            (activeSubGameStyle === 'TETRIS_CLASSIC' && !canHold)
          }
          onClick={handleHoldOrStyleAction}
          data-testid="btn-hold-piece"
          title={
            activeSubGameStyle === 'TACTILE_GRID'
              ? 'Girar peça selecionada da bandeja (Tecla [R])'
              : activeSubGameStyle === 'FRUIT_MATCH'
                ? 'Focar cursor na melhor troca do Oráculo 10×10 (Tecla [C])'
                : 'Guardar peça atual para usar depois (Tecla [C] ou [Shift])'
          }
          className="lt-glass-panel rounded-2xl p-3 flex flex-col items-center justify-between text-center hover:border-cyan-400/60 transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-300">
            <span>
              {activeSubGameStyle === 'TACTILE_GRID'
                ? 'GIRAR PEÇA'
                : activeSubGameStyle === 'FRUIT_MATCH'
                  ? 'ORÁCULO 10×10'
                  : 'RESERVA'}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-bold">
              {activeSubGameStyle === 'TACTILE_GRID' ? '↻ [R]' : '[C]'}
            </span>
          </div>

          <div className="my-2 min-h-[44px] flex items-center justify-center">
            {activeSubGameStyle === 'FRUIT_MATCH' ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-purple-500/40">
                <span className="text-lg" title={recommendedFruitMeta.namePt}>
                  {recommendedFruitMeta.emoji}
                </span>
                <span className="text-xs font-mono text-amber-300">⇄</span>
                <span className="text-lg" title={fragmentedFruitMeta.namePt}>
                  {fragmentedFruitMeta.emoji}
                </span>
              </div>
            ) : activeSubGameStyle === 'TACTILE_GRID' ? (
              selectedTrayDef && selectedTrayOption ? (
                <MiniPieceMatrixPreview
                  def={selectedTrayDef}
                  rotation={selectedTrayOption.rotation}
                  cellSizePx={selectedTrayDef.matrices[0].length >= 5 ? 5.5 : 8}
                />
              ) : (
                <span className="text-[11px] font-mono text-slate-500">Selecione slot</span>
              )
            ) : holdDef ? (
              <MiniPieceMatrixPreview def={holdDef} cellSizePx={8} />
            ) : (
              <span className="text-[11px] font-mono text-slate-500">Vazio (Clique)</span>
            )}
          </div>

          <div className="text-[10px] font-mono text-slate-300">
            {activeSubGameStyle === 'FRUIT_MATCH'
              ? `${fruitOracle.validSwapsCount} trocas · [C] Focar Dica`
              : activeSubGameStyle === 'TACTILE_GRID'
                ? selectedTrayDef && selectedTrayOption
                  ? `${selectedTrayDef.namePt} (${selectedTrayOption.rotation * 90}°)`
                  : 'Girar peça da bandeja'
                : holdDef
                  ? `${holdDef.namePt} (${holdDef.areaFormula})`
                  : 'Guarda 1 peça'}
          </div>
        </button>

        {/* Next 3 Pieces Queue / 10x10 Fruit Swap Status / Interactive 3-Piece Tactile Tray */}
        <div
          className="lt-glass-panel rounded-2xl p-3 flex flex-col justify-between"
          data-testid="hud-next-queue"
        >
          {activeSubGameStyle === 'TACTILE_GRID' ? (
            <div
              className="flex flex-col justify-between h-full"
              data-testid="tactile-piece-tray"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1.5">
                <span>BANDEJA TÁTIL</span>
                <span className="text-emerald-300">[1] [2] [3]</span>
              </div>

              <div className="grid grid-cols-3 gap-1 my-auto">
                {tactileTray.map((opt, idx) => {
                  const def = getPieceDefinition(opt.type)
                  const isSelected = selectedTraySlot === idx && !opt.isUsed
                  const matrixDim = def.matrices[0]?.length ?? 4
                  return (
                    <button
                      key={`${opt.type}_${idx}`}
                      type="button"
                      disabled={opt.isUsed}
                      onClick={() => selectTactileTraySlot(idx as 0 | 1 | 2)}
                      data-testid={`tactile-tray-slot-${idx}`}
                      title={`${def.namePt} (${def.areaFormula})`}
                      className={`p-1 rounded-xl border flex flex-col items-center justify-between transition cursor-pointer ${
                        opt.isUsed
                          ? 'opacity-35 border-slate-800 bg-slate-950/40 pointer-events-none'
                          : isSelected
                            ? 'border-emerald-400 bg-emerald-950/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-[9px] font-mono font-bold text-cyan-300">
                        [{idx + 1}] {def.label}
                      </span>
                      <div className="my-1 min-h-[26px] flex items-center justify-center">
                        <MiniPieceMatrixPreview
                          def={def}
                          rotation={opt.rotation}
                          cellSizePx={matrixDim >= 5 ? 3.5 : 5}
                        />
                      </div>
                      <span className="text-[8px] font-mono text-slate-300">
                        {opt.isUsed ? '✓ Usada' : def.areaFormula}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="text-[9px] font-mono text-emerald-300/90 text-center mt-[4px]">
                Clique na Arena 10×10 p/ encaixar!
              </div>
            </div>
          ) : activeSubGameStyle === 'FRUIT_MATCH' ? (
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1.5">
                <span>ARENA 10×10 CHEIA</span>
                <span className="text-purple-300">CASCATA 3+</span>
              </div>

              <div className="flex items-center justify-center gap-2.5 my-auto py-1">
                <div className="flex flex-col items-center">
                  <span className="text-xl">{recommendedFruitMeta.emoji}</span>
                  <span className="text-[9px] font-mono text-slate-300">
                    {recommendedFruitMeta.namePt}
                  </span>
                </div>
                <span className="text-xs font-mono text-amber-300 font-bold">⇄ 3+</span>
                <div className="flex flex-col items-center">
                  <span className="text-xl">{fragmentedFruitMeta.emoji}</span>
                  <span className="text-[9px] font-mono text-slate-300">
                    {fragmentedFruitMeta.namePt}
                  </span>
                </div>
              </div>

              <div className="text-[9px] font-mono text-amber-300/90 text-center mt-[4px]">
                Troque 2 frutas vizinhas (Clique/Arraste)!
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1.5">
                <span>PRÓXIMAS (7-BAG)</span>
                <span className="text-emerald-300">3 PEÇAS</span>
              </div>

              <div className="flex items-center justify-around gap-1 my-auto">
                {nextThree.map((type, idx) => {
                  const def = getPieceDefinition(type)
                  return (
                    <div
                      key={`${type}_${idx}`}
                      className="flex flex-col items-center gap-1"
                      title={`${def.namePt} (${def.areaFormula})`}
                    >
                      <MiniPieceMatrixPreview def={def} cellSizePx={idx === 0 ? 7 : 5.5} />
                      <span className="text-[9px] font-mono text-slate-300">
                        {def.label}
                        <span style={{ color: def.borderColor }} className="ml-0.5">
                          {def.symbol}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="text-[9px] font-mono text-slate-400 text-center mt-[4px]">
                Ou pressione [M] p/ escolher!
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mode Hub Return Button when playing */}
      {phase !== 'START_HUB' && (
        <button
          type="button"
          onClick={returnToHub}
          data-testid="btn-return-hub"
          className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 underline underline-offset-2 self-end cursor-pointer"
        >
          ⇄ Trocar Modo de Jogo (Zen / Arcade / Mestre)
        </button>
      )}
    </aside>
  )
}
