// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/ArcadeEnginesCanvas.tsx
// Implementação jogável e contínua (zero pausa) das Engines B, C, D, E e F
// Fiel aos conceitos em src/games/LogicBattle/master-plan/conceitos/
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react'
import { soundEngine } from '../audio/soundEngine'
import { formatArmy } from '../domain/notation'
import { ParticlePool } from '../run/renderer/fxParticles'
import { ProjectilePool } from '../run/renderer/projectilePool'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import {
  ENGINE_CATALOG,
  EngineId,
  getComboMultiplier,
} from './engineContract'

interface ChoiceOption {
  label: string
  op: '+' | '×' | '−' | '÷'
  operand: number
  isOptimal: boolean
  isTrap?: boolean
  trapReason?: string
}

interface EngineRoundSpec {
  promptLabel: string
  targetLabel: string
  options: [ChoiceOption, ChoiceOption, ChoiceOption]
}

function buildRoundsForEngine(engineId: EngineId): EngineRoundSpec[] {
  switch (engineId) {
    case 'cerco_torres':
      return [
        {
          promptLabel: 'Torre Inimiga (12 🛡️)',
          targetLabel: 'Rota da Torre Norte',
          options: [
            { label: '+ 8 🛡️', op: '+', operand: 8, isOptimal: false },
            { label: '× 2 ⚡', op: '×', operand: 2, isOptimal: true },
            { label: '− 5 💀', op: '−', operand: 5, isOptimal: false, isTrap: true, trapReason: 'Rota minada reduz tropas antes do assalto.' },
          ],
        },
        {
          promptLabel: 'Torre Leste (25 🛡️)',
          targetLabel: 'Balão Bônus ×2',
          options: [
            { label: '× 2 🎈', op: '×', operand: 2, isOptimal: true },
            { label: '+ 10 🛡️', op: '+', operand: 10, isOptimal: false },
            { label: '÷ 2 💀', op: '÷', operand: 2, isOptimal: false, isTrap: true, trapReason: 'Dividir por 2 reduz a coluna pela metade.' },
          ],
        },
        {
          promptLabel: 'Torre Chefe (40 🛡️)',
          targetLabel: 'Assalto Final',
          options: [
            { label: '+ 15 🛡️', op: '+', operand: 15, isOptimal: false },
            { label: '× 2 👑', op: '×', operand: 2, isOptimal: true },
            { label: '− 8 💀', op: '−', operand: 8, isOptimal: false, isTrap: true, trapReason: 'Fosso de espinhos subtrai 8 unidades.' },
          ],
        },
      ]
    case 'forte_bandeira':
      return [
        {
          promptLabel: 'Onda 1/3 · Portão Oeste (15 💀)',
          targetLabel: 'Bandeira 🏳️ 20',
          options: [
            { label: 'Oeste + 8', op: '+', operand: 8, isOptimal: false },
            { label: 'Norte × 2', op: '×', operand: 2, isOptimal: true },
            { label: 'Sul − 4', op: '−', operand: 4, isOptimal: false, isTrap: true, trapReason: 'Portão danificado drena a guarnição.' },
          ],
        },
        {
          promptLabel: 'Onda 2/3 · Portão Leste (24 💀)',
          targetLabel: 'Bandeira 🏳️ 35',
          options: [
            { label: 'Leste + 10', op: '+', operand: 10, isOptimal: false },
            { label: 'Norte × 2', op: '×', operand: 2, isOptimal: true },
            { label: 'Brecha ÷ 2', op: '÷', operand: 2, isOptimal: false, isTrap: true, trapReason: 'Divisão dispersa metade dos besteiros.' },
          ],
        },
        {
          promptLabel: 'Onda 3/3 · Cerco Total (30 💀)',
          targetLabel: 'Bandeira 🏳️ 60',
          options: [
            { label: 'Bastião × 2', op: '×', operand: 2, isOptimal: true },
            { label: 'Reserva + 12', op: '+', operand: 12, isOptimal: false },
            { label: 'Recuo − 6', op: '−', operand: 6, isOptimal: false, isTrap: true, trapReason: 'Recuar sob fogo reduz a guarnição.' },
          ],
        },
      ]
    case 'pedreira_rei':
      return [
        {
          promptLabel: 'Veio de Cristal (Bloco 12 🧱)',
          targetLabel: 'Britador ×2',
          options: [
            { label: 'Bloco + 12', op: '+', operand: 12, isOptimal: false },
            { label: 'Britador × 2', op: '×', operand: 2, isOptimal: true },
            { label: 'Refugo − 5', op: '−', operand: 5, isOptimal: false, isTrap: true, trapReason: 'Pedra rachada desperdiça carga.' },
          ],
        },
        {
          promptLabel: 'Filão Real (Bloco 25 🧱)',
          targetLabel: 'Guindaste 25/40',
          options: [
            { label: 'Esteira × 2', op: '×', operand: 2, isOptimal: true },
            { label: 'Vagão + 15', op: '+', operand: 15, isOptimal: false },
            { label: 'Fenda ÷ 2', op: '÷', operand: 2, isOptimal: false, isTrap: true, trapReason: 'Divisão parte os blocos ao meio.' },
          ],
        },
        {
          promptLabel: 'Monólito Dourado (Bloco 50 🧱)',
          targetLabel: 'Muralha Real 40/40',
          options: [
            { label: 'Polia × 2', op: '×', operand: 2, isOptimal: true },
            { label: 'Bloco + 20', op: '+', operand: 20, isOptimal: false },
            { label: 'Deslizamento − 8', op: '−', operand: 8, isOptimal: false, isTrap: true, trapReason: 'Cascalho solto reduz a extração.' },
          ],
        },
      ]
    case 'arena_ondas':
      return [
        {
          promptLabel: 'Onda 1/3 · Enxame Radial (15 💀)',
          targetLabel: 'Anel de Fogo 360°',
          options: [
            { label: '+ 10 🛡️', op: '+', operand: 10, isOptimal: false },
            { label: '× 2 ⚡', op: '×', operand: 2, isOptimal: true },
            { label: '÷ 2 💀', op: '÷', operand: 2, isOptimal: false, isTrap: true, trapReason: 'Totem amaldiçoado divide o esquadrão.' },
          ],
        },
        {
          promptLabel: 'Onda 2/3 · Horda Rubra (30 💀)',
          targetLabel: 'Supernova ×2',
          options: [
            { label: '× 2 ⚡', op: '×', operand: 2, isOptimal: true },
            { label: '+ 12 🛡️', op: '+', operand: 12, isOptimal: false },
            { label: '− 6 💀', op: '−', operand: 6, isOptimal: false, isTrap: true, trapReason: 'Zona de lava subtrai 6 guerreiros.' },
          ],
        },
        {
          promptLabel: 'Onda 3/3 · Campeão da Arena (45 💀)',
          targetLabel: 'Coroa da Arena',
          options: [
            { label: '× 2 👑', op: '×', operand: 2, isOptimal: true },
            { label: '+ 18 🛡️', op: '+', operand: 18, isOptimal: false },
            { label: '÷ 2 💀', op: '÷', operand: 2, isOptimal: false, isTrap: true, trapReason: 'Selo rubro reduz o poder pela metade.' },
          ],
        },
      ]
    case 'serpente_numeros':
    default:
      return [
        {
          promptLabel: 'Barreira 1/3 · Bloco 15 💀',
          targetLabel: 'Cabeça da Serpente',
          options: [
            { label: '+ 8 🐍', op: '+', operand: 8, isOptimal: false },
            { label: '× 2 ⚡', op: '×', operand: 2, isOptimal: true },
            { label: '− 6 💀', op: '−', operand: 6, isOptimal: false, isTrap: true, trapReason: 'Rocha espinhosa encurta a cauda da serpente.' },
          ],
        },
        {
          promptLabel: 'Barreira 2/3 · Bloco 30 💀',
          targetLabel: 'Segmentos 24 → 12 → 6',
          options: [
            { label: '× 2 🐍', op: '×', operand: 2, isOptimal: true },
            { label: '+ 14 🐍', op: '+', operand: 14, isOptimal: false },
            { label: '÷ 2 💀', op: '÷', operand: 2, isOptimal: false, isTrap: true, trapReason: 'Guilhotina divide os anéis numéricos.' },
          ],
        },
        {
          promptLabel: 'Portão Chefe · Bloco 80 💀',
          targetLabel: 'Fusão Real da Serpente',
          options: [
            { label: '× 2 👑', op: '×', operand: 2, isOptimal: true },
            { label: '+ 20 🐍', op: '+', operand: 20, isOptimal: false },
            { label: '− 10 💀', op: '−', operand: 10, isOptimal: false, isTrap: true, trapReason: 'Muro blindado absorve 10 elos.' },
          ],
        },
      ]
  }
}

export const ArcadeEnginesCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const projectilePoolRef = useRef<ProjectilePool>(new ProjectilePool())
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool())
  const animClockMsRef = useRef<number>(0)
  const volleyTimerMsRef = useRef<number>(180)

  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const enemy = useLogicBattleStore((s) => s.snapshot.enemy)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const reducedMotion = useLogicBattleStore((s) => s.save.settings.reducedMotion)
  const completeEngineRun = useLogicBattleStore((s) => s.completeEngineRun)

  const engineMeta = ENGINE_CATALOG[activeEngineId] ?? ENGINE_CATALOG.cerco_torres
  const rounds = buildRoundsForEngine(activeEngineId)

  const [roundIdx, setRoundIdx] = useState(0)
  const [armyPower, setArmyPower] = useState<number>(18)
  const [comboStreak, setComboStreak] = useState<number>(0)
  const [tokensEarned, setTokensEarned] = useState<number>(0)
  const [coinsEarned, setCoinsEarned] = useState<number>(12)
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null)
  const [trapsTriggered, setTrapsTriggered] = useState<
    { segmentId: string; gateLabel: string; trapReason: string; lostArmy: number }[]
  >([])

  const stateRef = useRef({
    roundIdx,
    armyPower,
    comboStreak,
    tokensEarned,
    coinsEarned,
    activeEngineId,
    phase,
    reducedMotion,
    notationMode,
  })
  stateRef.current = {
    roundIdx,
    armyPower,
    comboStreak,
    tokensEarned,
    coinsEarned,
    activeEngineId,
    phase,
    reducedMotion,
    notationMode,
  }

  // Reset state when switching engine
  useEffect(() => {
    setRoundIdx(0)
    setArmyPower(18)
    setComboStreak(0)
    setTokensEarned(0)
    setCoinsEarned(12)
    setTrapsTriggered([])
    setFeedbackBanner(`${engineMeta.icon} ${engineMeta.name} — Tiro Contínuo Ativo!`)
    projectilePoolRef.current.clear()
  }, [activeEngineId, engineMeta.icon, engineMeta.name])

  const finishEngine = (finalArmy: number, finalStreak: number, finalTokens: number, finalCoins: number) => {
    const targetForce = Math.max(30, Math.round(enemy.totalForce * 0.65))
    const safeArmy = Math.max(0, finalArmy)
    const victory = safeArmy >= targetForce
    completeEngineRun({
      engineId: activeEngineId,
      outcome: victory ? 'VICTORY' : 'DEFEAT',
      playerArmy: safeArmy,
      enemyForce: targetForce,
      survivors: victory ? Math.max(1, safeArmy - Math.floor(targetForce * 0.4)) : 0,
      coinsEarned: finalCoins,
      starsEarned: victory ? 3 : 0,
      tokensEarned: finalTokens,
      remaindersEarned:
        activeEngineId === 'pedreira_rei'
          ? Math.max(15, Math.round(safeArmy * 0.45))
          : Math.max(4, Math.round(safeArmy * 0.15)),
      maxCombo: getComboMultiplier(finalStreak),
      optimalChoices: finalStreak,
      trapHits: [],
      practicedConcepts: ['ponto_de_virada'],
      durationMs: 3600,
    })
  }

  const handleSelectOption = (opt: ChoiceOption) => {
    if (phase === 'PAUSED') return
    let nextArmy = armyPower
    if (opt.op === '+') nextArmy = armyPower + opt.operand
    else if (opt.op === '×') nextArmy = armyPower * opt.operand
    else if (opt.op === '−') nextArmy = Math.max(0, armyPower - opt.operand)
    else if (opt.op === '÷') nextArmy = Math.max(0, Math.floor(armyPower / Math.max(1, opt.operand)))

    const nextStreak = opt.isOptimal && !opt.isTrap ? comboStreak + 1 : 0
    const mult = getComboMultiplier(nextStreak)
    if (opt.isOptimal && mult > 1 && nextArmy > armyPower) {
      nextArmy = Math.round(nextArmy * (1 + (mult - 1) * 0.15))
    }
    nextArmy = Math.max(0, nextArmy)

    let nextTokens = tokensEarned
    let nextTraps = trapsTriggered
    if (opt.isTrap) {
      nextTokens += 1
      const lost = Math.max(0, armyPower - nextArmy)
      nextTraps = [
        ...trapsTriggered,
        {
          segmentId: `${activeEngineId}_r${roundIdx + 1}`,
          gateLabel: opt.label,
          trapReason: opt.trapReason ?? 'Operação desfavorável na rota escolhida.',
          lostArmy: lost,
        },
      ]
      setTrapsTriggered(nextTraps)
      setFeedbackBanner(`−${lost} 🛡️ · +1 Ficha Bônus 🪙`)
      soundEngine.playTrapOpaAlert()
      // Flash red in store for HUD shield pill
      useLogicBattleStore.setState((st) => ({
        snapshot: {
          ...st.snapshot,
          currentArmy: nextArmy,
          lastTrapFlashAtMs: performance.now(),
          calcComboStreak: 0,
          calcComboMultiplier: 1,
        },
      }))
    } else {
      const delta = nextArmy - armyPower
      setFeedbackBanner(
        `${delta >= 0 ? `+${delta}` : delta} 🛡️${mult > 1 ? ` · Combo ×${mult}!` : ''}`,
      )
      soundEngine.playGatePass(Math.max(1, delta), true)
      useLogicBattleStore.setState((st) => ({
        snapshot: {
          ...st.snapshot,
          currentArmy: nextArmy,
          calcComboStreak: nextStreak,
          calcComboMultiplier: mult,
        },
      }))
    }

    const nextCoins = coinsEarned + 10
    setArmyPower(nextArmy)
    setComboStreak(nextStreak)
    setTokensEarned(nextTokens)
    setCoinsEarned(nextCoins)

    if (roundIdx + 1 >= rounds.length) {
      finishEngine(nextArmy, nextStreak, nextTokens, nextCoins)
    } else {
      setRoundIdx(roundIdx + 1)
    }
  }

  // Loop 60 FPS do Canvas 2D específico de cada Engine (B, C, D, E, F)
  useEffect(() => {
    let rafId = 0
    let lastNow = performance.now()

    const renderLoop = (now: number) => {
      const dtMs = Math.min(64, Math.max(8, now - lastNow))
      lastNow = now
      const st = stateRef.current

      if (st.phase !== 'PAUSED') {
        animClockMsRef.current += dtMs
        volleyTimerMsRef.current += dtMs
      }

      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          const rect = canvas.getBoundingClientRect()
          const w = Math.max(320, Math.round(rect.width || 420))
          const h = Math.max(420, Math.round(rect.height || 680))
          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr
            canvas.height = h * dpr
          }

          ctx.save()
          ctx.scale(dpr, dpr)

          // Fundo temático por engine
          const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
          if (st.activeEngineId === 'pedreira_rei') {
            bgGrad.addColorStop(0, '#0f172a')
            bgGrad.addColorStop(0.5, '#1e293b')
            bgGrad.addColorStop(1, '#334155')
          } else if (st.activeEngineId === 'arena_ondas') {
            bgGrad.addColorStop(0, '#1e1b4b')
            bgGrad.addColorStop(0.5, '#311042')
            bgGrad.addColorStop(1, '#0f172a')
          } else {
            bgGrad.addColorStop(0, '#38bdf8')
            bgGrad.addColorStop(0.45, '#0284c7')
            bgGrad.addColorStop(1, '#0f172a')
          }
          ctx.fillStyle = bgGrad
          ctx.fillRect(0, 0, w, h)

          const cx = w * 0.5
          const cy = h * 0.46
          const tSec = animClockMsRef.current / 1000

          // Desenho específico de cada Engine fiel às artes-conceito
          let shooterX = cx
          let shooterY = cy + 70
          let targetX = cx
          let targetY = cy - 90

          if (st.activeEngineId === 'cerco_torres') {
            // Engine B: Cerco das Torres — Torre Azul vs Torres Vermelhas + Balão ×2
            shooterX = w * 0.25
            shooterY = cy + 45
            targetX = w * 0.74
            targetY = cy - 35

            // Pontes conectando as torres
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'
            ctx.lineWidth = 14
            ctx.beginPath()
            ctx.moveTo(shooterX, shooterY)
            ctx.lineTo(targetX, targetY)
            ctx.moveTo(shooterX, shooterY)
            ctx.lineTo(w * 0.72, cy + 65)
            ctx.stroke()

            // Torre Azul do Jogador
            ctx.fillStyle = '#0284c7'
            ctx.strokeStyle = '#e0f2fe'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.roundRect(shooterX - 32, shooterY - 52, 64, 78, 10)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#ffffff'
            ctx.font = '900 16px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(`🛡️ ${formatArmy(st.armyPower, st.notationMode)}`, shooterX, shooterY - 12)

            // Torres Inimigas Vermelhas (12, 25, 40)
            const enemyTowers = [
              { x: targetX, y: targetY, hp: '25' },
              { x: w * 0.72, y: cy + 65, hp: '40' },
            ]
            for (const et of enemyTowers) {
              ctx.fillStyle = '#dc2626'
              ctx.strokeStyle = '#fecaca'
              ctx.lineWidth = 2.5
              ctx.beginPath()
              ctx.roundRect(et.x - 28, et.y - 46, 56, 68, 8)
              ctx.fill()
              ctx.stroke()
              ctx.fillStyle = '#fef08a'
              ctx.font = '900 14px Inter, system-ui, sans-serif'
              ctx.fillText(`💀 ${et.hp}`, et.x, et.y - 10)
            }

            // Balão Bônus Dourado ×2 flutuando
            const bx = cx
            const by = cy - 82 + Math.sin(tSec * 2.5) * 8
            ctx.fillStyle = '#facc15'
            ctx.strokeStyle = '#78350f'
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.arc(bx, by, 22, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#0f172a'
            ctx.font = '900 14px Inter, system-ui, sans-serif'
            ctx.fillText('×2', bx, by + 4)
          } else if (st.activeEngineId === 'forte_bandeira') {
            // Engine C: Forte da Bandeira — Bastião Circular com Bandeira Dourada e 3 Portões
            shooterX = cx
            shooterY = cy
            const angle = (tSec * 1.4) % (Math.PI * 2)
            targetX = cx + Math.cos(angle) * 115
            targetY = cy + Math.sin(angle) * 95

            // Muralha circular do forte
            ctx.fillStyle = 'rgba(30, 41, 59, 0.88)'
            ctx.strokeStyle = '#94a3b8'
            ctx.lineWidth = 8
            ctx.beginPath()
            ctx.arc(cx, cy, 68, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()

            // Portões Norte (×2), Oeste (+8), Leste (+10)
            const gateBadges = [
              { x: cx, y: cy - 68, txt: '×2', col: '#38bdf8' },
              { x: cx - 68, y: cy, txt: '+8', col: '#22c55e' },
              { x: cx + 68, y: cy, txt: '+10', col: '#22c55e' },
            ]
            for (const gb of gateBadges) {
              ctx.fillStyle = gb.col
              ctx.beginPath()
              ctx.roundRect(gb.x - 18, gb.y - 11, 36, 22, 6)
              ctx.fill()
              ctx.fillStyle = '#0f172a'
              ctx.font = '900 12px Inter, system-ui, sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText(gb.txt, gb.x, gb.y + 4)
            }

            // Bandeira central dourada
            ctx.fillStyle = '#facc15'
            ctx.font = '900 16px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(`🏳️ ${formatArmy(st.armyPower, st.notationMode)}`, cx, cy + 5)

            // Inimigos cercando o forte
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + tSec * 0.4
              const ex = cx + Math.cos(a) * 115
              const ey = cy + Math.sin(a) * 95
              ctx.fillStyle = '#ef4444'
              ctx.beginPath()
              ctx.arc(ex, ey, 11, 0, Math.PI * 2)
              ctx.fill()
            }
          } else if (st.activeEngineId === 'pedreira_rei') {
            // Engine D: Pedreira do Rei — Blocos numerados + Britador ×2 + Guindaste
            shooterX = cx - 65
            shooterY = cy + 35
            targetX = cx + 55
            targetY = cy - 35

            // Esteira rolante e Britador Central ×2
            ctx.strokeStyle = '#facc15'
            ctx.lineWidth = 10
            ctx.beginPath()
            ctx.moveTo(shooterX, shooterY)
            ctx.lineTo(cx, cy)
            ctx.lineTo(targetX, targetY)
            ctx.stroke()

            // Blocos de pedra/cristal (12, 25, 50)
            const blocks = [
              { x: cx - 75, y: cy - 45, val: '12', col: '#38bdf8' },
              { x: cx, y: cy - 75, val: '25', col: '#a855f7' },
              { x: cx + 75, y: cy - 45, val: '50', col: '#facc15' },
            ]
            for (const b of blocks) {
              ctx.fillStyle = b.col
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.roundRect(b.x - 24, b.y - 24, 48, 48, 8)
              ctx.fill()
              ctx.stroke()
              ctx.fillStyle = '#0f172a'
              ctx.font = '900 15px Inter, system-ui, sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText(`🧱${b.val}`, b.x, b.y + 5)
            }

            // Britador central
            ctx.fillStyle = '#1e293b'
            ctx.strokeStyle = '#facc15'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.roundRect(cx - 42, cy - 18, 84, 36, 8)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#fef08a'
            ctx.font = '900 13px Inter, system-ui, sans-serif'
            ctx.fillText(`⚙️ ${formatArmy(st.armyPower, st.notationMode)} 🧱`, cx, cy + 5)
          } else if (st.activeEngineId === 'arena_ondas') {
            // Engine E: Arena das Ondas — Tiro Radial 360° + Pílulas de Operação
            shooterX = cx
            shooterY = cy
            const waveAngle = tSec * 2.2
            targetX = cx + Math.cos(waveAngle) * 110
            targetY = cy + Math.sin(waveAngle) * 90

            // Anel de energia radial
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.arc(cx, cy, 48 + Math.sin(tSec * 5) * 5, 0, Math.PI * 2)
            ctx.stroke()

            // Esquadrão central
            ctx.fillStyle = '#0284c7'
            ctx.beginPath()
            ctx.arc(cx, cy, 28, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#ffffff'
            ctx.font = '900 14px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(`🛡️${formatArmy(st.armyPower, st.notationMode)}`, cx, cy + 5)

            // Horda radial ao redor
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2 - tSec * 0.5
              const hx = cx + Math.cos(a) * 112
              const hy = cy + Math.sin(a) * 92
              ctx.fillStyle = '#dc2626'
              ctx.beginPath()
              ctx.arc(hx, hy, 12, 0, Math.PI * 2)
              ctx.fill()
            }
          } else {
            // Engine F: Serpente dos Números — Cadeia segmentada (24 → 12 → 6 → 3)
            shooterX = cx
            shooterY = cy + 25
            targetX = cx
            targetY = cy - 85

            const segValues = [
              st.armyPower,
              Math.max(1, Math.floor(st.armyPower / 2)),
              Math.max(1, Math.floor(st.armyPower / 4)),
              Math.max(1, Math.floor(st.armyPower / 8)),
            ]
            for (let i = segValues.length - 1; i >= 0; i--) {
              const sy = cy + 25 + i * 32
              const sx = cx + Math.sin(tSec * 4 + i * 0.9) * 26
              if (i === 0) {
                shooterX = sx
                shooterY = sy
              }
              ctx.fillStyle = i === 0 ? '#38bdf8' : '#0284c7'
              ctx.strokeStyle = '#e0f2fe'
              ctx.lineWidth = 2.5
              ctx.beginPath()
              ctx.arc(sx, sy, 20 - i * 2, 0, Math.PI * 2)
              ctx.fill()
              ctx.stroke()
              ctx.fillStyle = '#ffffff'
              ctx.font = '900 12px Inter, system-ui, sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText(String(segValues[i]), sx, sy + 4)
            }

            // Barreira Vermelha à frente da Serpente
            ctx.fillStyle = '#dc2626'
            ctx.strokeStyle = '#fef08a'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.roundRect(cx - 75, targetY - 22, 150, 42, 8)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#ffffff'
            ctx.font = '900 15px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('🧱 Barreira Rubra 💀 30', cx, targetY + 4)
          }

          // Disparo automático contínuo desde t = 0s (§2.3: máx 40 projéteis no pool)
          if (
            st.phase !== 'PAUSED' &&
            (volleyTimerMsRef.current >= 165 ||
              projectilePoolRef.current.getActiveCount() === 0)
          ) {
            volleyTimerMsRef.current = 0
            for (let i = 0; i < 2; i++) {
              projectilePoolRef.current.spawnProjectile(
                i === 0 ? 'cannon' : 'arrow',
                shooterX + (i - 0.5) * 14,
                shooterY - 8,
                targetX + (Math.random() - 0.5) * 32,
                targetY + (Math.random() - 0.5) * 18,
                250,
              )
            }
          }

          projectilePoolRef.current.updateAndDraw(
            ctx,
            st.phase === 'PAUSED' ? 0 : dtMs,
            (hitX, hitY) => {
              particlePoolRef.current.spawnBurst(
                hitX,
                hitY,
                '#facc15',
                4,
                st.reducedMotion,
              )
            },
          )

          ;(
            window as unknown as { __lbActiveProjectiles?: number }
          ).__lbActiveProjectiles = projectilePoolRef.current.getActiveCount()

          particlePoolRef.current.updateAndDraw(
            ctx,
            st.phase === 'PAUSED' ? 0 : dtMs,
          )
          ctx.restore()
        }
      }

      rafId = window.requestAnimationFrame(renderLoop)
    }

    rafId = window.requestAnimationFrame(renderLoop)
    return () => window.cancelAnimationFrame(rafId)
  }, [])

  const currentRound = rounds[Math.min(roundIdx, rounds.length - 1)]

  return (
    <div className="lb-run-stage" data-testid="logic-battle-run-stage">
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        data-testid="logic-battle-canvas"
        aria-label={`${engineMeta.name} — Modo de Jogo Ativo`}
      />

      {/* Badge compacto identificando a Engine ativa e a Onda/Etapa */}
      <div
        className="lb-vai-um-banner"
        data-testid="lb-active-engine-badge"
        style={{ top: '54px' }}
      >
        <strong>
          {engineMeta.icon} {engineMeta.shortName} · Etapa {roundIdx + 1}/{rounds.length}
        </strong>
      </div>

      {feedbackBanner && (
        <div
          className="lb-floating-feedback lb-tone-positive"
          data-testid="lb-floating-feedback"
        >
          <span className="lb-fb-main">{feedbackBanner}</span>
        </div>
      )}

      {/* Dock Tático com as 3 escolhas matemáticas da Engine atual */}
      <div className="lb-tactical-dock" data-testid="lb-tactical-dock">
        <div
          className="lb-lane-choice-grid lb-lanes-3 is-visible-pills"
          data-testid="lb-lane-choice-grid"
        >
          {currentRound.options.map((opt, idx) => (
            <button
              key={`eng_opt_${idx}_${opt.label}`}
              type="button"
              data-testid={`lb-gate-choice-${idx}`}
              className={`lb-gate-choice-btn ${opt.isOptimal ? 'is-selected' : ''}`}
              onClick={() => handleSelectOption(opt)}
            >
              <strong className="lb-gate-choice-label">{opt.label}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
