import React, { useState } from 'react'
import { GameMode, SubGameStyle } from '../types'
import { FRUIT_CATALOG } from '../engine/fruitMatchEngine'
import { getPieceDefinition } from '../engine/tetrominoes'
import { toggleLogicTetrisFullscreen } from '../hooks/useGameLoop'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'
import { MiniPieceMatrixPreview } from './PieceAlchemyBar'
import { SekundoIconPopover, SekundoRevealSpec } from './SekundoIconPopover'

export interface TelemetryHUDProps {
  className?: string
}

const MODE_META: Record<
  GameMode,
  { icon: string; title: string; color: string; description: string }
> = {
  zen: {
    icon: '🌱',
    title: 'Modo Zen Passatempo',
    color: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
    description:
      'Gravidade suave, Escudos Fênix ilimitados (∞) e desafios acolhedores de arredondamento e Amigos do 10.',
  },
  arcade: {
    icon: '⚡',
    title: 'Modo Gênesis Arcade',
    color: 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200',
    description:
      'Experiência canônica! 2 Escudos Fênix iniciais (+1 a cada 10 linhas) e as 4 operações dinâmicas.',
  },
  master: {
    icon: '🔥',
    title: 'Modo Mestre da Balança',
    color: 'bg-amber-500/20 border-amber-300/50 text-amber-200',
    description:
      'Ritmo intenso e desafios mentais de 2 dígitos com as 8 Lentes completas do Heiss-Lab.',
  },
}

const STYLE_BUTTONS: ReadonlyArray<{
  style: SubGameStyle
  icon: string
  shortBadge: string
  title: string
  description: string
}> = [
  {
    style: 'TETRIS_CLASSIC',
    icon: '🧱',
    shortBadge: '20×10',
    title: 'Tetris Clássico (Torre 20×10)',
    description:
      'Tetrominós em queda vertical Base-10. Use [M] para transmutar a peça em queda ou [B] para selar buracos soterrados com Ouro!',
  },
  {
    style: 'FRUIT_MATCH',
    icon: '🍎',
    shortBadge: '10×10',
    title: 'Frutas 10×10 (Troca & Cascata)',
    description:
      'Arena 10×10 cheia! Clique ou arraste 2 frutas vizinhas (H×V) para formar 3, 4 ou 5 iguais, ou use [M] Estrelas Coringa e [B] Imã!',
  },
  {
    style: 'TACTILE_GRID',
    icon: '🧩',
    shortBadge: '10×10',
    title: 'Grade Tátil 10×10 (Macro-Blocos H×V)',
    description:
      'Sem gravidade! Escolha uma peça da Bandeja [1][2][3] na doca inferior e encaixe na Arena 10×10 para fechar linhas H e colunas V!',
  },
]

/**
 * Sekundo Icon-First Top Command & Telemetry Dock (`TelemetryHUD.tsx`).
 *
 * Replaces the old 556-line right-hand text sidebar with a compact horizontal Top Dock (`~48px`):
 * - Every metric and style control is rendered as a compact icon button / micro-pill.
 * - Clicking any icon opens the anchored `<SekundoIconPopover />` ("Click-to-Reveal")
 *   explaining its exact function, keyboard shortcut, and live Oracle insight.
 * - Preserves 100% of E2E `data-testid` contracts.
 */
export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ className = '' }) => {
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null)

  const phase = useLogicTetrisStore((s) => s.phase)
  const mode = useLogicTetrisStore((s) => s.mode)
  const score = useLogicTetrisStore((s) => s.score)
  const lines = useLogicTetrisStore((s) => s.lines)
  const level = useLogicTetrisStore((s) => s.level)
  const rawCombo = useLogicTetrisStore((s) => s.combo)
  const combo = Math.max(0, rawCombo)
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
  const topology = useLogicTetrisStore((s) => s.topology)
  const tactileTopology = useLogicTetrisStore((s) => s.tactileTopology)
  const tactileTray = useLogicTetrisStore((s) => s.tactileTray)
  const selectedTraySlot = useLogicTetrisStore((s) => s.selectedTraySlot)

  const holdCurrentPiece = useLogicTetrisStore((s) => s.holdCurrentPiece)
  const rotatePiece = useLogicTetrisStore((s) => s.rotatePiece)
  const setSubGameStyle = useLogicTetrisStore((s) => s.setSubGameStyle)
  const toggleStyleRotationMode = useLogicTetrisStore((s) => s.toggleStyleRotationMode)
  const togglePause = useLogicTetrisStore((s) => s.togglePause)
  const toggleCodex = useLogicTetrisStore((s) => s.toggleCodex)
  const toggleMute = useLogicTetrisStore((s) => s.toggleMute)
  const returnToHub = useLogicTetrisStore((s) => s.returnToHub)

  const modeInfo = MODE_META[mode]
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

  const liveOracleHint =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? fruitOracle.pedagogicalHint
      : activeSubGameStyle === 'TACTILE_GRID'
        ? tactileTopology.pedagogicalHint
        : topology.recommendationReason

  const togglePopover = (id: string) => {
    setActivePopoverId((prev) => (prev === id ? null : id))
  }

  const handleHoldOrStyleAction = () => {
    if (phase !== 'PLAYING') {
      togglePopover('hold')
      return
    }
    if (activeSubGameStyle === 'TACTILE_GRID') {
      rotatePiece('CW')
      return
    }
    holdCurrentPiece()
  }

  const resolveActivePopoverSpec = (): SekundoRevealSpec | null => {
    if (!activePopoverId) return null

    switch (activePopoverId) {
      case 'mode':
        return {
          id: 'mode',
          icon: modeInfo.icon,
          title: modeInfo.title,
          badge: mode.toUpperCase(),
          description: modeInfo.description,
          oracleHint: liveOracleHint,
          accentColor: mode === 'zen' ? 'emerald' : mode === 'master' ? 'amber' : 'cyan',
          actionLabel: '⇄ Trocar Modo de Jogo (Hub)',
          onAction: returnToHub,
        }
      case 'score':
        return {
          id: 'score',
          icon: '🏆',
          title: `Pontuação: ${score.toLocaleString('pt-BR')} pts`,
          badge: `Recorde: ${highScore.toLocaleString('pt-BR')}`,
          description:
            'Ganhe pontos fechando linhas Base-10, cascatas de frutas 3+ ou resolvendo desafios matemáticos de Grau I a IV.',
          oracleHint: liveOracleHint,
          accentColor: 'amber',
        }
      case 'lines':
        return {
          id: 'lines',
          icon: '📏',
          title: `Linhas Base-10: ${lines} · Nível ${level}`,
          badge: `Nv.${level}`,
          description:
            'Cada linha ou coluna fechada soma 10 blocos exatos! A cada 10 linhas você sobe de nível e ganha +1 Escudo Fênix.',
          oracleHint: liveOracleHint,
          accentColor: 'emerald',
        }
      case 'streak':
        return {
          id: 'streak',
          icon: combo >= 12 ? '👑' : '🔥',
          title: `Sequência Harmônica: ×${combo}`,
          badge: `Máx Sessão: ×${maxStreakInSession}`,
          description:
            combo > 0
              ? `Sequência ativa! Você tem ${comboGraceDropsLeft} encaixe(s) preparatório(s) de tolerância antes de esfriar o ritmo.`
              : 'Encaixe linhas ou cascatas seguidas para subir a escala musical pentatônica até o Êxtase 12×+!',
          oracleHint: liveOracleHint,
          accentColor: 'amber',
        }
      case 'shields':
        return {
          id: 'shields',
          icon: '🛡️',
          title:
            mode === 'zen'
              ? 'Escudos Fênix: ∞ (Ilimitados)'
              : `Escudos Fênix: ×${phoenixShields}`,
          badge: mode === 'zen' ? 'Zen Sem Game Over' : `+1 em ${linesToNextShield} linha(s)`,
          description:
            'Aciona automaticamente o Protocolo Fênix 142857 se os blocos chegarem ao topo ou se a bandeja travar, salvando sua partida!',
          oracleHint: liveOracleHint,
          accentColor: 'purple',
        }
      case 'charge':
        return {
          id: 'charge',
          icon: '⚡',
          title: `Carga Lógica: ${logicCharge}%`,
          badge: `${solvedCount} conta(s) na sessão`,
          description:
            'Energia acumulada pelos seus encaixes e contas! Use [M] ou [B] na doca inferior para moldar o tabuleiro com Matemática.',
          oracleHint: liveOracleHint,
          accentColor: 'cyan',
        }
      case 'rotation':
        return {
          id: 'rotation',
          icon: styleRotationMode === 'SIMULTANEOUS' ? '🌀' : '🔒',
          title:
            styleRotationMode === 'SIMULTANEOUS'
              ? `Modo Simultâneo 3-em-1 (${styleShiftProgress}/${styleShiftTarget})`
              : 'Estilo Travado Manualmente',
          shortcut: '[L]',
          description:
            styleRotationMode === 'SIMULTANEOUS'
              ? 'Alterna automaticamente entre Clássico 20×10, Frutas 10×10 e Grade Tátil 10×10 a cada 4 conquistas mantendo seu combo!'
              : 'Permanece fixo no estilo atual até você clicar em outro estilo [G] ou destravar [L].',
          oracleHint: liveOracleHint,
          accentColor: styleRotationMode === 'SIMULTANEOUS' ? 'cyan' : 'amber',
        }
      case 'next-queue':
        return {
          id: 'next-queue',
          icon: '⏭️',
          title:
            activeSubGameStyle === 'FRUIT_MATCH'
              ? 'Oráculo de Troca 10×10 (Cascata 3+)'
              : activeSubGameStyle === 'TACTILE_GRID'
                ? 'Arena Tátil 10×10 H×V'
                : 'Fila de Próximas Peças (7-Bag)',
          shortcut: '[C] / [M]',
          description:
            activeSubGameStyle === 'FRUIT_MATCH'
              ? `Par em destaque: ${recommendedFruitMeta.emoji} ${recommendedFruitMeta.namePt} ⇄ ${fragmentedFruitMeta.emoji} ${fragmentedFruitMeta.namePt} (${fruitOracle.validSwapsCount} trocas prontas).`
              : activeSubGameStyle === 'TACTILE_GRID'
                ? 'Selecione as 3 peças da Bandeja Tátil na doca inferior ([1], [2], [3]) e clique na Arena 10×10 para encaixar!'
                : 'Mostra as próximas 3 peças da bolsa 7-Bag. Pressione [C] para guardar na Reserva ou [M] para escolher outra peça!',
          oracleHint: liveOracleHint,
          accentColor: 'cyan',
          customContent:
            activeSubGameStyle === 'TETRIS_CLASSIC' ? (
              <div className="flex items-center justify-around gap-2 py-1.5 px-2 rounded-xl bg-slate-900/90 border border-slate-800">
                {nextThree.map((type, idx) => {
                  const def = getPieceDefinition(type)
                  return (
                    <div key={`${type}_${idx}`} className="flex flex-col items-center gap-1">
                      <MiniPieceMatrixPreview def={def} cellSizePx={idx === 0 ? 7 : 5.5} />
                      <span className="text-[9px] font-mono text-slate-300">
                        {def.label} {def.symbol}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : undefined,
        }
      case 'style-TETRIS_CLASSIC':
      case 'style-FRUIT_MATCH':
      case 'style-TACTILE_GRID': {
        const targetStyle = activePopoverId.replace('style-', '') as SubGameStyle
        const spec = STYLE_BUTTONS.find((s) => s.style === targetStyle) ?? STYLE_BUTTONS[0]
        return {
          id: activePopoverId,
          icon: spec.icon,
          title: spec.title,
          shortcut: '[G]',
          badge: spec.shortBadge,
          description: spec.description,
          oracleHint: liveOracleHint,
          accentColor: 'cyan',
        }
      }
      default:
        return null
    }
  }

  return (
    <header
      className={`relative w-full lt-glass-panel rounded-2xl px-2.5 py-1.5 flex items-center justify-between gap-1 flex-wrap lg:flex-nowrap select-none z-30 ${className}`}
      aria-label="Doca Superior de Comando e Telemetria Sekundo Icon-First"
      data-testid="telemetry-top-dock"
    >
      {/* =====================================================================
          GROUP 1: COMPACT TELEMETRY ICON PILLS (CLICK-TO-REVEAL)
          ===================================================================== */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Mode Pill Icon */}
        <button
          type="button"
          onClick={() => togglePopover('mode')}
          title={`${modeInfo.title} — Clique para revelar detalhes ou trocar modo`}
          className={`h-8 px-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${modeInfo.color}`}
        >
          <span>{modeInfo.icon}</span>
        </button>

        {/* Score Pill (`data-testid="hud-score"`) */}
        <button
          type="button"
          onClick={() => togglePopover('score')}
          title={`Pontuação: ${score.toLocaleString('pt-BR')} (Recorde: ${highScore.toLocaleString('pt-BR')}) — Clique p/ detalhes`}
          className="h-8 px-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-xs font-mono font-extrabold text-white flex items-center gap-1.5 transition cursor-pointer"
        >
          <span className="text-amber-300">🏆</span>
          <span data-testid="hud-score">{score.toLocaleString('pt-BR')}</span>
        </button>

        {/* Lines & Level Pill (`data-testid="hud-lines"`) */}
        <button
          type="button"
          onClick={() => togglePopover('lines')}
          title={`Linhas Base-10: ${lines} · Nível ${level} — Clique p/ detalhes`}
          className="h-8 px-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-emerald-400/50 text-xs font-mono font-extrabold text-emerald-300 flex items-center gap-1 transition cursor-pointer"
        >
          <span>📏</span>
          <span data-testid="hud-lines">{lines}</span>
          <span className="text-[10px] text-slate-400 font-normal">·N{level}</span>
        </button>

        {/* Streak Counter Pill (`data-testid="hud-streak-counter"`) */}
        <button
          type="button"
          onClick={() => togglePopover('streak')}
          data-testid="hud-streak-counter"
          title={`Sequência ativa ×${combo} (Máx: ×${maxStreakInSession}) — Clique p/ detalhes`}
          className={`h-8 px-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-800 text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
            combo >= 12
              ? 'text-yellow-300 border-yellow-400/60 animate-bounce'
              : combo > 0
                ? 'text-amber-300 border-amber-400/40'
                : 'text-slate-400'
          }`}
        >
          <span>{combo >= 12 ? '👑' : '🔥'}</span>
          <span>×{combo}</span>
        </button>

        {/* Phoenix Shields Pill (`data-testid="hud-phoenix-shields"`) */}
        <button
          type="button"
          onClick={() => togglePopover('shields')}
          title="Escudos do Protocolo Fênix 142857 — Clique p/ revelar funcionamento"
          className="h-8 px-2 rounded-xl bg-purple-950/55 hover:bg-purple-900/60 border border-purple-500/45 text-xs font-mono font-bold text-amber-300 flex items-center gap-1 transition cursor-pointer"
        >
          <span>🛡️</span>
          <span data-testid="hud-phoenix-shields">
            {mode === 'zen' ? '∞' : `×${phoenixShields}`}
          </span>
        </button>

        {/* Logic Charge Compact Icon Pill */}
        <button
          type="button"
          onClick={() => togglePopover('charge')}
          title={`Carga Lógica: ${logicCharge}% — Clique p/ revelar detalhes`}
          className="hidden sm:flex h-8 px-2 rounded-xl bg-cyan-950/45 hover:bg-cyan-900/50 border border-cyan-500/40 text-[11px] font-mono font-bold text-cyan-300 items-center gap-1 transition cursor-pointer"
        >
          <span>⚡</span>
          <span>{logicCharge}%</span>
        </button>
      </div>

      {/* =====================================================================
          GROUP 2: TRINITY STYLE ICON SWITCHER (`data-testid="trinity-style-hud"`)
          ===================================================================== */}
      <div
        className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-xl p-0.5"
        data-testid="trinity-style-hud"
      >
        {STYLE_BUTTONS.map((btn) => {
          const isActive = activeSubGameStyle === btn.style
          return (
            <button
              key={btn.style}
              type="button"
              onClick={() => {
                if (isActive) {
                  togglePopover(`style-${btn.style}`)
                } else {
                  setSubGameStyle(btn.style)
                  setActivePopoverId(null)
                }
              }}
              data-testid={`style-btn-${btn.style}`}
              title={`${btn.title} — Clique para ativar e revelar funcionamento`}
              className={`h-7 px-2 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                isActive
                  ? 'bg-cyan-950/95 border-cyan-400 text-white shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                  : 'bg-slate-900/70 hover:bg-slate-800 border-transparent text-slate-300'
              }`}
            >
              <span>{btn.icon}</span>
              <span className="text-[10px] hidden md:inline">{btn.shortBadge}</span>
            </button>
          )
        })}

        {/* Rotation Mode Lock / Simultaneous Toggle (`data-testid="btn-toggle-style-rotation"`) */}
        <button
          type="button"
          onClick={() => {
            toggleStyleRotationMode()
            setActivePopoverId(null)
          }}
          data-testid="btn-toggle-style-rotation"
          title={
            styleRotationMode === 'SIMULTANEOUS'
              ? `Modo Simultâneo (${styleShiftProgress}/${styleShiftTarget}) [L] — Clique p/ travar ou revelar`
              : 'Estilo Travado [L] — Clique p/ alternar para Simultâneo 3-em-1'
          }
          className={`h-7 px-2 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
            styleRotationMode === 'SIMULTANEOUS'
              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
              : 'bg-amber-500/20 border-amber-400/70 text-amber-200'
          }`}
        >
          {styleRotationMode === 'SIMULTANEOUS' ? (
            <>
              <span>🌀</span>
              <span>
                {styleShiftProgress}/{styleShiftTarget}
              </span>
            </>
          ) : (
            <span>🔒</span>
          )}
        </button>
      </div>

      {/* =====================================================================
          GROUP 3: RESERVE [C], NEXT QUEUE CAPSULE & SYSTEM UTILITY ICONS
          ===================================================================== */}
      <div className="flex items-center gap-1">
        {/* Hold / Rotate / Oracle Focus Button (`data-testid="btn-hold-piece"`) */}
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
              ? 'Girar peça selecionada da bandeja [R]'
              : activeSubGameStyle === 'FRUIT_MATCH'
                ? 'Focar melhor troca do Oráculo 10×10 [C]'
                : 'Reserva de Peça [C]'
          }
          className="h-8 px-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-cyan-400/60 flex items-center justify-center gap-1 text-xs font-mono text-cyan-200 transition cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
        >
          {activeSubGameStyle === 'FRUIT_MATCH' ? (
            <span className="text-xs">
              {recommendedFruitMeta.emoji}⇄{fragmentedFruitMeta.emoji}
            </span>
          ) : activeSubGameStyle === 'TACTILE_GRID' ? (
            <span>↻</span>
          ) : holdDef ? (
            <MiniPieceMatrixPreview def={holdDef} cellSizePx={4.5} />
          ) : (
            <span>📦</span>
          )}
          <span className="text-[9px] font-bold text-cyan-300">
            {activeSubGameStyle === 'TACTILE_GRID' ? '[R]' : '[C]'}
          </span>
        </button>

        {/* Next Queue / Stage Preview Capsule (`data-testid="hud-next-queue"`) */}
        <button
          type="button"
          onClick={() => togglePopover('next-queue')}
          data-testid="hud-next-queue"
          title="Próximas Peças / Status da Arena — Clique p/ revelar detalhes"
          className="h-8 px-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-cyan-400/50 flex items-center gap-1 transition cursor-pointer"
        >
          {activeSubGameStyle === 'TETRIS_CLASSIC' ? (
            <div className="flex items-center gap-1">
              {nextThree.slice(0, 2).map((type, idx) => {
                const def = getPieceDefinition(type)
                return (
                  <MiniPieceMatrixPreview
                    key={`${type}_${idx}`}
                    def={def}
                    cellSizePx={4}
                  />
                )
              })}
            </div>
          ) : activeSubGameStyle === 'FRUIT_MATCH' ? (
            <span className="text-[11px] font-mono font-bold text-fuchsia-200">
              🍎 {fruitOracle.validSwapsCount}
            </span>
          ) : (
            <span className="text-[11px] font-mono font-bold text-emerald-300">
              🧩 { selectedTrayDef ? selectedTrayDef.symbol : '10×10' }
            </span>
          )}
        </button>

        {/* Mute Toggle Icon (`data-testid="btn-toggle-mute"`) */}
        <button
          type="button"
          onClick={toggleMute}
          data-testid="btn-toggle-mute"
          title={isMuted ? 'Ativar Som Pentatônico' : 'Silenciar Áudio'}
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs flex items-center justify-center transition cursor-pointer"
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        {/* Codex Drawer Toggle Icon (`data-testid="btn-toggle-codex"`) */}
        <button
          type="button"
          onClick={() => toggleCodex()}
          data-testid="btn-toggle-codex"
          title="Abrir Códice Pedagógico e Histórico de Contas [H]"
          className="relative h-8 px-2 rounded-xl bg-cyan-950/85 hover:bg-cyan-900 border border-cyan-500/50 text-xs font-mono font-bold text-cyan-200 flex items-center justify-center gap-1 transition cursor-pointer"
        >
          <span>📚</span>
          {solvedCount > 0 && (
            <span className="px-1 rounded-full bg-cyan-400 text-slate-950 text-[9px] font-extrabold">
              {solvedCount}
            </span>
          )}
        </button>

        {/* Fullscreen Toggle Icon (`data-testid="btn-toggle-fullscreen"`) */}
        <button
          type="button"
          onClick={() => toggleLogicTetrisFullscreen()}
          data-testid="btn-toggle-fullscreen"
          title={isFullscreen ? 'Sair da Tela Cheia [F]' : 'Tela Cheia [F]'}
          className={`w-8 h-8 rounded-xl border text-xs font-mono font-bold flex items-center justify-center transition cursor-pointer ${
            isFullscreen
              ? 'bg-purple-950/90 border-purple-400 text-purple-100'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
          }`}
        >
          ⛶
        </button>

        {/* Pause Toggle Icon (`data-testid="btn-toggle-pause"`) */}
        {(phase === 'PLAYING' || phase === 'PAUSED') && (
          <button
            type="button"
            onClick={togglePause}
            data-testid="btn-toggle-pause"
            title={phase === 'PAUSED' ? 'Retomar Partida [P]' : 'Pausar Partida [P]'}
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs flex items-center justify-center transition cursor-pointer"
          >
            {phase === 'PAUSED' ? '▶️' : '⏸️'}
          </button>
        )}

        {/* Return to Mode Hub Icon (`data-testid="btn-return-hub"`) */}
        {phase !== 'START_HUB' && (
          <button
            type="button"
            onClick={returnToHub}
            data-testid="btn-return-hub"
            title="Trocar Modo de Jogo (Zen / Arcade / Mestre)"
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-cyan-300 flex items-center justify-center transition cursor-pointer"
          >
            ⇄
          </button>
        )}
      </div>

      {/* Sekundo Click-to-Reveal Floating Popover */}
      <SekundoIconPopover
        spec={resolveActivePopoverSpec()}
        onClose={() => setActivePopoverId(null)}
        dockPosition="top"
      />
    </header>
  )
}
