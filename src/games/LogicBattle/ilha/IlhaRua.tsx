import { Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'
import {
  generateInfiniteChallenge,
  InfiniteMathChallenge,
  MATH_CHALLENGE_TIER_POLICIES,
  MathDifficultyTier,
} from '../domain/infiniteMathEngine'
import {
  applyTierPower,
  COMBAT,
  createRua,
  ENEMY_COUNT,
  aimRua,
  OBSTACLES,
  restartLoop,
  RuaState,
  shoot,
  stepRua,
} from './ruaSim'
import './ilha.css'

function compassLetter(yaw: number): string {
  const angle = Math.atan2(Math.sin(yaw), Math.cos(yaw))
  if (angle >= -0.4 && angle <= 0.4) return 'N'
  if (angle > 0.4 && angle < 2.4) return 'L'
  if (angle < -0.4 && angle > -2.4) return 'O'
  return 'S'
}

function StreetScene(props: {
  sim: React.MutableRefObject<RuaState>
  timeScale: React.MutableRefObject<number>
  pitch: React.MutableRefObject<number>
  keys: React.MutableRefObject<{ forward: boolean; back: boolean; strafe: -1 | 0 | 1 }>
  onHud: (state: RuaState) => void
}) {
  const avatar = useRef<Group>(null)
  const flash = useRef<Mesh>(null)
  const enemyRefs = useRef<Array<Mesh | null>>([])
  const { camera } = useThree()
  useFrame((_, dt) => {
    const keys = props.keys.current
    props.sim.current = stepRua(
      props.sim.current,
      {
        forward: keys.forward,
        back: keys.back,
        strafe: keys.strafe,
      },
      Math.min(dt, 0.05),
      props.timeScale.current,
    )
    const state = props.sim.current
    if (avatar.current) {
      avatar.current.position.set(state.x, 0.9, state.z)
      avatar.current.rotation.y = -state.yaw
    }
    if (flash.current) {
      flash.current.visible = state.shootCooldown > COMBAT.shootCooldown * 0.55
    }
    state.enemies.forEach((enemy, index) => {
      const mesh = enemyRefs.current[index]
      if (!mesh) return
      mesh.visible = enemy.alive
      mesh.position.set(enemy.x, 0.45, enemy.z)
    })
    const fx = -Math.sin(state.yaw)
    const fz = Math.cos(state.yaw)
    const pitch = props.pitch.current
    camera.position.set(state.x - fx * 8, 5.2 + pitch * 1.5, state.z - fz * 8)
    camera.lookAt(state.x + fx * 5, 1.3 + pitch * 4, state.z + fz * 5)
    props.onHud(state)
  })
  return (
    <>
      <color attach="background" args={['#8ecff0']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} />
      <mesh position={[0, -0.4, 24]} receiveShadow>
        <boxGeometry args={[8, 0.8, 56]} />
        <meshStandardMaterial color="#7d8ea3" />
      </mesh>
      <mesh position={[0, -0.2, 4]}>
        <boxGeometry args={[16, 0.6, 10]} />
        <meshStandardMaterial color="#d5dee8" />
      </mesh>
      <group ref={avatar}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.7, 1.1, 0.5]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshStandardMaterial color="#f2b544" />
        </mesh>
        <mesh position={[0, 0.2, 0.55]}>
          <boxGeometry args={[0.22, 0.22, 0.4]} />
          <meshStandardMaterial color="#1d4ed8" />
        </mesh>
        <mesh ref={flash} position={[0, 0.35, 1.05]} visible={false}>
          <boxGeometry args={[0.12, 0.12, 0.45]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.4} />
        </mesh>
      </group>
      {OBSTACLES.map((obstacle) => (
        <mesh key={`${obstacle.x}-${obstacle.z}`} position={[obstacle.x, 0.7, obstacle.z]}>
          <boxGeometry args={[obstacle.hx * 2, 1.4, obstacle.hz * 2]} />
          <meshStandardMaterial color="#c47a3a" />
        </mesh>
      ))}
      <group position={[0, 0, 20]}>
        <mesh position={[-1.4, 1.2, 0]}>
          <boxGeometry args={[0.4, 2.4, 0.4]} />
          <meshStandardMaterial color="#1a8f5c" />
        </mesh>
        <mesh position={[1.4, 1.2, 0]}>
          <boxGeometry args={[0.4, 2.4, 0.4]} />
          <meshStandardMaterial color="#1a8f5c" />
        </mesh>
        <mesh position={[0, 2.3, 0]}>
          <boxGeometry args={[3.2, 0.4, 0.4]} />
          <meshStandardMaterial color="#3ecf8e" />
        </mesh>
        <Html position={[0, 2.8, 0]} center>
          <div className="ilha-plate">+10</div>
        </Html>
      </group>
      <Html position={[-5.2, 2, 8]} center>
        <div className="ilha-plate">Cerco<br />fechado</div>
      </Html>
      <Html position={[5.2, 2, 8]} center>
        <div className="ilha-plate">Serpente<br />fechado</div>
      </Html>
      {Array.from({ length: ENEMY_COUNT }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            enemyRefs.current[index] = node
          }}
        >
          <boxGeometry args={[0.5, 0.9, 0.5]} />
          <meshStandardMaterial color="#e11d48" />
        </mesh>
      ))}
      {[-6, 6].map((x) =>
        [2, 14, 28, 38].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.4, 0]}>
              <cylinderGeometry args={[0.15, 0.2, 0.8, 6]} />
              <meshStandardMaterial color="#6b4f2a" />
            </mesh>
            <mesh position={[0, 1.5, 0]}>
              <coneGeometry args={[0.7, 1.6, 6]} />
              <meshStandardMaterial color="#1f7a45" />
            </mesh>
          </group>
        )),
      )}
    </>
  )
}

export const IlhaRua: React.FC = () => {
  const sim = useRef(createRua())
  const timeScale = useRef(1)
  const modalOpen = useRef(false)
  const keys = useRef({ forward: false, back: false, strafe: 0 as -1 | 0 | 1 })
  const pitch = useRef(0)
  const lookDrag = useRef<{ x: number; y: number } | null>(null)
  const [hud, setHud] = useState(sim.current)
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<MathDifficultyTier>(1)
  const [challenge, setChallenge] = useState<InfiniteMathChallenge | null>(null)
  const [note, setNote] = useState('')
  const [power, setPower] = useState('')

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        if (modalOpen.current || sim.current.defeated || sim.current.finished) return
        sim.current = shoot(sim.current)
        setHud(sim.current)
        return
      }
      if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.current.forward = true
      if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.current.back = true
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.current.strafe = -1
      if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.current.strafe = 1
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.current.forward = false
      if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.current.back = false
      if (
        (event.code === 'KeyA' || event.code === 'ArrowLeft') &&
        keys.current.strafe === -1
      ) {
        keys.current.strafe = 0
      }
      if (
        (event.code === 'KeyD' || event.code === 'ArrowRight') &&
        keys.current.strafe === 1
      ) {
        keys.current.strafe = 0
      }
    }
    const moveLook = (event: PointerEvent) => {
      const drag = lookDrag.current
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      lookDrag.current = { x: event.clientX, y: event.clientY }
      sim.current = aimRua(sim.current, dx * 0.005)
      pitch.current = Math.min(0.55, Math.max(-0.7, pitch.current - dy * 0.004))
    }
    const stopLook = () => {
      lookDrag.current = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('pointermove', moveLook)
    window.addEventListener('pointerup', stopLook)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('pointermove', moveLook)
      window.removeEventListener('pointerup', stopLook)
    }
  }, [])

  const openConta = (nextTier: MathDifficultyTier) => {
    setTier(nextTier)
    setChallenge(generateInfiniteChallenge({ tier: nextTier, seed: 42 + nextTier }))
    setNote('')
    setOpen(true)
  }

  const answer = (choiceId: string) => {
    if (!challenge) return
    const choice = challenge.choices.find((item) => item.id === choiceId)
    if (!choice) return
    if (!choice.isCorrect) {
      setNote(choice.diagnosticPt)
      return
    }
    sim.current = applyTierPower(sim.current, tier)
    setHud(sim.current)
    setPower(MATH_CHALLENGE_TIER_POLICIES[tier].engineRewardSummary.ponte_portoes)
    setOpen(false)
  }

  timeScale.current = open ? COMBAT.slowScale : 1
  modalOpen.current = open

  const fire = () => {
    if (sim.current.defeated || sim.current.finished) return
    sim.current = shoot(sim.current)
    setHud(sim.current)
  }

  const continueLoop = () => {
    sim.current = restartLoop(sim.current)
    setHud(sim.current)
    setPower('')
    setOpen(false)
    setNote('')
  }

  const retry = () => {
    sim.current = createRua()
    setHud(sim.current)
    setPower('')
    setOpen(false)
    setNote('')
  }

  return (
    <div
      className="ilha-shell"
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('button, .ilha-modal, .ilha-olhar')) return
        lookDrag.current = { x: event.clientX, y: event.clientY }
      }}
    >
      <Canvas camera={{ position: [0, 6, -8], fov: 55 }}>
        <StreetScene
          sim={sim}
          timeScale={timeScale}
          pitch={pitch}
          keys={keys}
          onHud={(state) => {
            setHud((previous) =>
              previous.army === state.army &&
              previous.enemiesAlive === state.enemiesAlive &&
              previous.finished === state.finished &&
              previous.defeated === state.defeated &&
              compassLetter(previous.yaw) === compassLetter(state.yaw) &&
              Math.abs(previous.z - state.z) < 0.4
                ? previous
                : state,
            )
          }}
        />
      </Canvas>
      <div className="ilha-hud">
        <div className="ilha-army" data-testid="ilha-exercito">
          Exército {hud.army}
        </div>
        <div className="ilha-enemies">Inimigos {hud.enemiesAlive}</div>
        <div className="ilha-compass" data-testid="ilha-bussola">
          {compassLetter(hud.yaw)}
        </div>
        {hud.defeated ? (
          <>
            <div className="ilha-fim">O exército caiu.</div>
            <button type="button" className="ilha-continuar" onClick={retry}>
              Tentar de novo
            </button>
          </>
        ) : (
          hud.finished && (
            <>
              <div className="ilha-fim" data-testid="ilha-fim">
                A rua acabou.
              </div>
              <button type="button" className="ilha-continuar" onClick={continueLoop}>
                Continuar na rua
              </button>
            </>
          )
        )}
        {power && <div className="ilha-power">{power}</div>}
        <button type="button" className="ilha-atirar" onClick={fire}>
          Atirar
        </button>
        <button type="button" className="ilha-conta" onClick={() => openConta(tier)}>
          Fazer conta
        </button>
        <div
          className="ilha-olhar"
          onPointerDown={(event) => {
            event.stopPropagation()
            lookDrag.current = { x: event.clientX, y: event.clientY }
          }}
        >
          Olhar
        </div>
      </div>
      {open && challenge && (
        <div className="ilha-modal" role="dialog" aria-modal="true">
          <div className="ilha-card">
            <div className="ilha-tiers">
              {([1, 2, 3, 4] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={item === tier}
                  onClick={() => openConta(item)}
                >
                  {MATH_CHALLENGE_TIER_POLICIES[item].badgePt}
                </button>
              ))}
            </div>
            <p className="ilha-slow">Eles andam a 10% da velocidade.</p>
            <p>{challenge.questionPt}</p>
            <div className="ilha-choices">
              {challenge.choices.map((choice) => (
                <button key={choice.id} type="button" onClick={() => answer(choice.id)}>
                  {choice.label}
                </button>
              ))}
            </div>
            {note && <p>{note}</p>}
            <button
              type="button"
              className="ilha-fechar"
              onClick={() => {
                setOpen(false)
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
