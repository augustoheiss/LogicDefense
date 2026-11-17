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
import { GRAU_PARTIDA, OBSTACULOS, PARTIDA, PecaId } from './partidaPolicies'
import {
  abrirAltar,
  aplicarConta,
  atirar,
  continuarNaRua,
  createPartida,
  criarTropa,
  definirOlhar,
  evoluir,
  fecharAltar,
  fundar,
  idsNoRetangulo,
  mira,
  ordenar,
  ordenarHeroi,
  PartidaState,
  postura,
  stepPartida,
} from './partidaSim'
import './ilha.css'

function compassLetter(yaw: number): string {
  const angle = Math.atan2(Math.sin(yaw), Math.cos(yaw))
  if (angle >= -0.4 && angle <= 0.4) return 'N'
  if (angle > 0.4 && angle < 2.4) return 'L'
  if (angle < -0.4 && angle > -2.4) return 'O'
  return 'S'
}

function yawDoHeroi(group: Group, state: { yaw: number }) {
  group.rotation.y = -state.yaw
}

function documentoAceitaLock(): boolean {
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature: (nome: string) => boolean }
    featurePolicy?: { allowsFeature: (nome: string) => boolean }
  }
  const politica = doc.permissionsPolicy ?? doc.featurePolicy
  if (politica && !politica.allowsFeature('pointer-lock')) return false
  return document.hasFocus()
}

function pedirLock(canvas: HTMLCanvasElement | null) {
  if (!canvas || document.pointerLockElement || !documentoAceitaLock()) return
  try {
    const pedido = canvas.requestPointerLock() as void | Promise<void>
    if (pedido && typeof pedido.catch === 'function') {
      void pedido.catch(() => undefined)
    }
  } catch {
    // Este documento não aceita pointer lock. O botão Olhar continua valendo.
  }
}

function olharNome(olhar: PartidaState['olhar']): string {
  if (olhar === 'primeira') return 'Primeira'
  if (olhar === 'imperio') return 'Império'
  return 'Terceira'
}

function Cena(props: {
  sim: React.MutableRefObject<PartidaState>
  timeScale: React.MutableRefObject<number>
  keys: React.MutableRefObject<{ forward: boolean; back: boolean; strafe: -1 | 0 | 1 }>
  cam: React.MutableRefObject<{ x: number; z: number }>
  tool: React.MutableRefObject<PecaId | null>
  dragou: React.MutableRefObject<boolean>
  onHud: (state: PartidaState) => void
  onGround: (x: number, z: number) => void
  onUnit: (id: number, lado: 'aliado' | 'inimigo') => void
  onObra: (id: number) => void
  onRect: (x0: number, z0: number, x1: number, z1: number) => void
  onCaixa: (caixa: { x: number; y: number; x2: number; y2: number } | null) => void
  onHeroi: () => void
  heroiEscolhido: boolean
}) {
  const avatar = useRef<Group>(null)
  const flash = useRef<Mesh>(null)
  const unidades = useRef(new Map<number, Mesh>())
  const obras = useRef(new Map<number, Mesh>())
  const arrasto = useRef<{ x: number; y: number } | null>(null)
  const { camera, gl, raycaster } = useThree()
  const soloNoChao = (clientX: number, clientY: number) => {
    const retangulo = gl.domElement.getBoundingClientRect()
    raycaster.setFromCamera(
      {
        x: ((clientX - retangulo.left) / retangulo.width) * 2 - 1,
        y: -((clientY - retangulo.top) / retangulo.height) * 2 + 1,
      },
      camera,
    )
    const dirY = raycaster.ray.direction.y
    if (Math.abs(dirY) < 1e-5) return null
    const t = -raycaster.ray.origin.y / dirY
    if (t < 0) return null
    return {
      x: raycaster.ray.origin.x + raycaster.ray.direction.x * t,
      z: raycaster.ray.origin.z + raycaster.ray.direction.z * t,
    }
  }
  useFrame((_, dt) => {
    const keys = props.keys.current
    const bruto = Math.min(dt, 0.05)
    props.sim.current = stepPartida(
      props.sim.current,
      { forward: keys.forward, back: keys.back, strafe: keys.strafe },
      bruto,
      props.timeScale.current,
    )
    const state = props.sim.current
    if (avatar.current) {
      avatar.current.position.set(state.heroi.x, 0.9, state.heroi.z)
      yawDoHeroi(avatar.current, { yaw: state.heroi.yaw })
      avatar.current.visible = state.olhar !== 'primeira'
    }
    if (flash.current) {
      flash.current.visible = state.heroi.shootCooldown > PARTIDA.shootCooldown * 0.55
    }
    state.unidades.forEach((unidade) => {
      const mesh = unidades.current.get(unidade.id)
      if (!mesh) return
      mesh.visible = unidade.hp > 0
      mesh.position.set(unidade.x, unidade.papel === 'dragao' ? 0.8 : 0.45, unidade.z)
      const corpo = unidade.papel === 'dragao' ? 0.8 + unidade.segmentos.length * 0.45 : 1
      mesh.scale.set(1, 1, corpo)
    })
    state.obras.forEach((obra) => {
      const mesh = obras.current.get(obra.id)
      if (!mesh) return
      mesh.visible = obra.hp > 0
      mesh.position.set(obra.x, 0.8, obra.z)
    })
    const yaw = state.heroi.yaw
    const pitch = state.heroi.pitch
    const fx = -Math.sin(yaw)
    const fz = Math.cos(yaw)
    if (state.olhar === 'imperio') {
      const pan = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0)
      props.cam.current.x += keys.strafe * 16 * bruto
      props.cam.current.z += pan * 16 * bruto
      camera.position.set(props.cam.current.x, 34, props.cam.current.z + 24)
      camera.lookAt(props.cam.current.x, 0, props.cam.current.z)
    } else if (state.olhar === 'primeira') {
      camera.position.set(state.heroi.x, PARTIDA.eyeY, state.heroi.z)
      camera.lookAt(
        state.heroi.x + fx * Math.cos(pitch),
        PARTIDA.eyeY + Math.sin(pitch),
        state.heroi.z + fz * Math.cos(pitch),
      )
    } else {
      const chase = pitch * 0.35
      camera.position.set(state.heroi.x - fx * 8, 5.2 + chase * 1.5, state.heroi.z - fz * 8)
      camera.lookAt(state.heroi.x + fx * 5, 1.3 + chase * 4, state.heroi.z + fz * 5)
    }
    props.onHud(state)
  })

  const altar = props.sim.current.altar
  const pisos = altar
    ? [
        { nome: 'N', x: altar.cx, z: altar.cz + PARTIDA.altarPasso },
        { nome: 'L', x: altar.cx + PARTIDA.altarPasso, z: altar.cz },
        { nome: 'S', x: altar.cx, z: altar.cz - PARTIDA.altarPasso },
        { nome: 'O', x: altar.cx - PARTIDA.altarPasso, z: altar.cz },
      ]
    : []

  return (
    <>
      <color attach="background" args={['#8ecff0']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[12, 18, 8]} intensity={1.15} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.45, 0]}
        onPointerDown={(event) => {
          if (props.sim.current.olhar !== 'imperio' || props.tool.current) return
          arrasto.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMove={(event) => {
          const inicio = arrasto.current
          if (!inicio) return
          if (Math.hypot(event.clientX - inicio.x, event.clientY - inicio.y) < 8) return
          props.dragou.current = true
          props.onCaixa({ x: inicio.x, y: inicio.y, x2: event.clientX, y2: event.clientY })
        }}
        onPointerUp={(event) => {
          const inicio = arrasto.current
          arrasto.current = null
          if (!inicio || !props.dragou.current) return
          const a = soloNoChao(inicio.x, inicio.y)
          const b = soloNoChao(event.clientX, event.clientY)
          props.onCaixa(null)
          if (a && b) props.onRect(a.x, a.z, b.x, b.z)
        }}
        onClick={(event) => {
          if (props.dragou.current) {
            props.dragou.current = false
            return
          }
          event.stopPropagation()
          props.onGround(event.point.x, event.point.z)
        }}
      >
        <circleGeometry args={[PARTIDA.radius, 64]} />
        <meshStandardMaterial color="#7f9b72" />
      </mesh>
      <mesh position={[0, -0.35, 20]}>
        <boxGeometry args={[8, 0.2, 42]} />
        <meshStandardMaterial color="#7d8ea3" />
      </mesh>
      <mesh position={[PARTIDA.pedraX, 0.35, PARTIDA.pedraZ]}>
        <boxGeometry args={[0.8, 0.7, 0.8]} />
        <meshStandardMaterial color="#78716c" />
      </mesh>
      <group
        ref={avatar}
        onClick={(event) => {
          event.stopPropagation()
          if (props.sim.current.olhar === 'imperio') props.onHeroi()
        }}
      >
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.7, 1.1, 0.5]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshStandardMaterial color="#f2b544" />
        </mesh>
        <mesh ref={flash} position={[0, 0.35, 1.05]} visible={false}>
          <boxGeometry args={[0.12, 0.12, 0.45]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.4} />
        </mesh>
        {props.heroiEscolhido && props.sim.current.olhar === 'imperio' && (
          <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.75, 20]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.6} />
          </mesh>
        )}
      </group>
      {OBSTACULOS.map((caixa) => (
        <mesh key={`${caixa.x}-${caixa.z}`} position={[caixa.x, 0.7, caixa.z]}>
          <boxGeometry args={[caixa.hx * 2, 1.4, caixa.hz * 2]} />
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
      {props.sim.current.obras.map((obra) => (
        <mesh
          key={obra.id}
          ref={(node) => {
            if (node) obras.current.set(obra.id, node)
            else obras.current.delete(obra.id)
          }}
          position={[obra.x, 0.8, obra.z]}
          onClick={(event) => {
            event.stopPropagation()
            if (props.sim.current.olhar === 'imperio') props.onObra(obra.id)
          }}
        >
          <boxGeometry
            args={
              obra.tipo === 'portao'
                ? [2.4, 2.2, 0.4]
                : obra.tipo === 'torre'
                  ? [1.1, 2.4, 1.1]
                  : [2, 1.6, 2]
            }
          />
          <meshStandardMaterial
            color={
              obra.tipo === 'nucleo'
                ? '#facc15'
                : obra.tipo === 'torre'
                  ? '#0284c7'
                  : obra.tipo === 'portao'
                    ? '#16a34a'
                    : obra.tipo === 'quartel'
                      ? '#d97706'
                      : '#57534e'
            }
          />
        </mesh>
      ))}
      {props.sim.current.unidades.map((unidade) => (
        <mesh
          key={unidade.id}
          ref={(node) => {
            if (node) unidades.current.set(unidade.id, node)
            else unidades.current.delete(unidade.id)
          }}
          onClick={(event) => {
            event.stopPropagation()
            props.onUnit(unidade.id, unidade.lado)
          }}
        >
          <boxGeometry args={unidade.papel === 'dragao' ? [1.2, 1.1, 1.4] : [0.55, 0.9, 0.55]} />
          <meshStandardMaterial
            color={
              unidade.lado === 'aliado'
                ? '#16a34a'
                : unidade.papel === 'dragao'
                  ? '#7c3aed'
                  : unidade.papel === 'sitiante'
                    ? '#9f1239'
                    : '#e11d48'
            }
          />
        </mesh>
      ))}
      {pisos.map((piso) => (
        <mesh key={piso.nome} position={[piso.x, 0.05, piso.z]}>
          <cylinderGeometry args={[0.7, 0.7, 0.12, 12]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
    </>
  )
}

export const IlhaRua: React.FC = () => {
  const sim = useRef(createPartida())
  const timeScale = useRef(1)
  const modalOpen = useRef(false)
  const keys = useRef({ forward: false, back: false, strafe: 0 as -1 | 0 | 1 })
  const lookDrag = useRef<{ x: number; y: number } | null>(null)
  const cam = useRef({ x: 0, z: 18 })
  const tool = useRef<PecaId | null>(null)
  const dragou = useRef(false)
  const evoluirId = useRef<number | null>(null)
  const [heroiEscolhido, setHeroiEscolhido] = useState(false)
  const [caixa, setCaixa] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null)
  const selected = useRef<number[]>([])
  const [hud, setHud] = useState(sim.current)
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<MathDifficultyTier>(1)
  const [challenge, setChallenge] = useState<InfiniteMathChallenge | null>(null)
  const [note, setNote] = useState('')
  const [power, setPower] = useState('')
  const [ferramenta, setFerramenta] = useState('')

  const publicar = (next: PartidaState) => {
    sim.current = next
    setHud((previous) => {
      const mudou =
        previous.olhar !== next.olhar ||
        previous.heroi.army !== next.heroi.army ||
        previous.credito !== next.credito ||
        previous.derrota !== next.derrota ||
        previous.ruaPercorrida !== next.ruaPercorrida ||
        previous.obras.length !== next.obras.length ||
        previous.unidades.length !== next.unidades.length ||
        previous.unidades
          .map((unidade) => `${unidade.id}:${unidade.postura}:${unidade.ordem?.tipo ?? ''}:${unidade.hp}:${unidade.rota?.semCaminho ? 1 : 0}`)
          .join() !==
          next.unidades
            .map((unidade) => `${unidade.id}:${unidade.postura}:${unidade.ordem?.tipo ?? ''}:${unidade.hp}:${unidade.rota?.semCaminho ? 1 : 0}`)
            .join() ||
        previous.lingotes !== next.lingotes ||
        previous.resto !== next.resto ||
        previous.heroi.carregandoKg !== next.heroi.carregandoKg ||
        previous.altar?.resolvido !== next.altar?.resolvido ||
        previous.altar?.aviso !== next.altar?.aviso ||
        compassLetter(previous.heroi.yaw) !== compassLetter(next.heroi.yaw) ||
        Math.ceil(PARTIDA.ondaPeriodo - previous.ondaRelogio) !==
          Math.ceil(PARTIDA.ondaPeriodo - next.ondaRelogio)
      return mudou ? next : previous
    })
  }

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (modalOpen.current) return
      if (event.code === 'Digit1') publicar(definirOlhar(sim.current, 'primeira'))
      if (event.code === 'Digit2') publicar(definirOlhar(sim.current, 'terceira'))
      if (event.code === 'Digit3') {
        document.exitPointerLock?.()
        publicar(definirOlhar(sim.current, 'imperio'))
      }
      if (event.code === 'Space') {
        event.preventDefault()
        if (sim.current.olhar === 'imperio' || sim.current.derrota) return
        publicar(atirar(sim.current))
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
      if ((event.code === 'KeyA' || event.code === 'ArrowLeft') && keys.current.strafe === -1) {
        keys.current.strafe = 0
      }
      if ((event.code === 'KeyD' || event.code === 'ArrowRight') && keys.current.strafe === 1) {
        keys.current.strafe = 0
      }
    }
    const moveLook = (event: PointerEvent) => {
      if (sim.current.olhar === 'imperio' || modalOpen.current) return
      if (document.pointerLockElement) {
        sim.current = mira(sim.current, event.movementX * 0.003, -event.movementY * 0.003)
        return
      }
      const drag = lookDrag.current
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      lookDrag.current = { x: event.clientX, y: event.clientY }
      sim.current = mira(sim.current, dx * 0.005, -dy * 0.004)
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

  const escolherFerramenta = (peca: PecaId, nome: string) => {
    tool.current = peca
    setFerramenta(nome)
    publicar(definirOlhar(sim.current, 'imperio'))
    document.exitPointerLock?.()
  }

  const openConta = (nextTier: MathDifficultyTier) => {
    setTier(nextTier)
    const proxima = generateInfiniteChallenge({ tier: nextTier, seed: 42 + nextTier + sim.current.tempo })
    setChallenge(proxima)
    setNote('')
    setOpen(true)
    const correta = proxima.choices.findIndex((item) => item.isCorrect)
    const indice = (correta < 0 ? 0 : correta) % 4
    publicar(abrirAltar(sim.current, nextTier, indice as 0 | 1 | 2 | 3))
    document.exitPointerLock?.()
  }

  const answer = (choiceId: string) => {
    if (!challenge) return
    const choice = challenge.choices.find((item) => item.id === choiceId)
    if (!choice) return
    if (!choice.isCorrect) {
      setNote(choice.diagnosticPt)
      return
    }
    publicar(aplicarConta(sim.current, tier))
    setPower(`${GRAU_PARTIDA[tier].bonus} soldados e ${GRAU_PARTIDA[tier].credito} licença`)
    setOpen(false)
  }

  timeScale.current = open ? 0.1 : 1
  modalOpen.current = open

  const nucleoQualquer = hud.obras.find((obra) => obra.tipo === 'nucleo')
  const nucleo = nucleoQualquer && nucleoQualquer.hp > 0 ? nucleoQualquer : undefined
  const tropasVivas = hud.unidades.filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
  const emOrdens = tropasVivas.filter((unidade) => unidade.postura === 'ordens').length
  const emAuto = tropasVivas.filter((unidade) => unidade.postura === 'automatico').length

  return (
    <div
      className="ilha-shell"
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('button, .ilha-modal, .ilha-olhar, .ilha-barra')) return
        if (sim.current.olhar === 'imperio') return
        lookDrag.current = { x: event.clientX, y: event.clientY }
        pedirLock(event.currentTarget.querySelector('canvas'))
      }}
    >
      <Canvas camera={{ position: [0, 6, -8], fov: 55 }}>
        <Cena
          sim={sim}
          timeScale={timeScale}
          keys={keys}
          cam={cam}
          tool={tool}
          dragou={dragou}
          onHud={(state) => {
            if (state.altar?.resolvido && modalOpen.current) {
              setOpen(false)
              setPower(`${GRAU_PARTIDA[state.altar.tier].bonus} soldados pelo piso certo`)
            }
            if (state.altar?.aviso) setNote(state.altar.aviso)
            publicar(state)
          }}
          onGround={(x, z) => {
            if (sim.current.olhar !== 'imperio' || sim.current.derrota) return
            if (tool.current) {
              publicar(fundar(sim.current, tool.current, x, z))
              tool.current = null
              setFerramenta('')
              return
            }
            let atual = sim.current
            if (heroiEscolhido) atual = ordenarHeroi(atual, { tipo: 'mover', x, z })
            if (selected.current.length > 0) atual = ordenar(atual, selected.current, { tipo: 'mover', x, z })
            publicar(atual)
          }}
          onUnit={(id, lado) => {
            if (sim.current.olhar !== 'imperio') return
            if (lado === 'aliado') {
              selected.current = selected.current.includes(id)
                ? selected.current.filter((item) => item !== id)
                : [...selected.current, id]
              setFerramenta(`${selected.current.length} selecionados`)
              return
            }
            if (selected.current.length > 0) {
              publicar(ordenar(sim.current, selected.current, { tipo: 'atacar', alvoId: id }))
            }
            if (heroiEscolhido) {
              publicar(ordenarHeroi(sim.current, { tipo: 'atacar', alvoId: id }))
            }
          }}
          onObra={(id) => {
            evoluirId.current = id
            const obra = sim.current.obras.find((item) => item.id === id)
            setFerramenta(obra ? obra.tipo : '')
          }}
          onRect={(x0, z0, x1, z1) => {
            selected.current = idsNoRetangulo(sim.current, x0, z0, x1, z1)
            setFerramenta(`${selected.current.length} no retângulo`)
          }}
          onCaixa={setCaixa}
          onHeroi={() => {
            setHeroiEscolhido((valor) => !valor)
            setFerramenta('Herói')
          }}
          heroiEscolhido={heroiEscolhido}
        />
      </Canvas>
      <div className="ilha-hud">
        <div className="ilha-barra">
          <button type="button" data-testid="ilha-olhar-primeira" onClick={() => publicar(definirOlhar(sim.current, 'primeira'))}>
            Primeira
          </button>
          <button type="button" data-testid="ilha-olhar-terceira" onClick={() => publicar(definirOlhar(sim.current, 'terceira'))}>
            Terceira
          </button>
          <button
            type="button"
            data-testid="ilha-olhar-imperio"
            onClick={() => {
              document.exitPointerLock?.()
              publicar(definirOlhar(sim.current, 'imperio'))
            }}
          >
            Império
          </button>
          <span data-testid="ilha-olhar">{olharNome(hud.olhar)}</span>
        </div>
        <div className="ilha-army" data-testid="ilha-exercito">
          Exército {hud.heroi.army}
        </div>
        <div className="ilha-base" data-testid="ilha-base">
          {nucleoQualquer
            ? `Núcleo nível ${nucleoQualquer.nivel} · vida ${Math.max(0, Math.ceil(nucleoQualquer.hp))} · tropas ${tropasVivas.length} · ${emOrdens} em ordens · ${emAuto} no automático`
            : 'Sem base'}
          {hud.unidades.some((unidade) => unidade.rota?.semCaminho) ? ' · sem caminho' : ''}
          {nucleoQualquer && nucleoQualquer.hp > 0
            ? ` · Leva em ${Math.max(0, Math.ceil(PARTIDA.ondaPeriodo - hud.ondaRelogio))}s`
            : ''}
        </div>
        <div className="ilha-enemies">
          Licenças {hud.credito}
          {hud.lingotes > 0 ? ` · Lingotes ${hud.lingotes} resto ${hud.resto}` : ''}
          {hud.heroi.carregandoKg > 0 ? ` · Pedra ${hud.heroi.carregandoKg} kg` : ''}
        </div>
        <div className="ilha-compass" data-testid="ilha-bussola">
          {compassLetter(hud.heroi.yaw)}
        </div>
        {hud.olhar !== 'imperio' && <div className="ilha-mira" data-testid="ilha-mira" />}
        {hud.olhar === 'imperio' && (
          <div className="ilha-ferramentas">
            {([
              ['nucleo', 'Núcleo'],
              ['torre', 'Torre'],
              ['portao', 'Portão'],
              ['quartel', 'Quartel'],
              ['britador', 'Britador'],
            ] as const).map(([id, nome]) => (
              <button key={id} type="button" onClick={() => escolherFerramenta(id, nome)}>
                {nome}
              </button>
            ))}
            <button
              type="button"
              data-testid="ilha-evoluir"
              onClick={() => {
                const id = evoluirId.current ?? nucleo?.id
                if (!id) return
                publicar(evoluir(sim.current, id))
              }}
            >
              Evoluir
            </button>
            <button
              type="button"
              data-testid="ilha-tropa"
              onClick={() => {
                const casa =
                  hud.obras.find((obra) => obra.tipo === 'quartel' && obra.hp > 0) ?? nucleo
                if (!casa) return
                publicar(criarTropa(sim.current, casa.id))
              }}
            >
              Tropa
            </button>
            <button
              type="button"
              data-testid="ilha-todas"
              onClick={() => {
                selected.current = sim.current.unidades
                  .filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
                  .map((unidade) => unidade.id)
                setFerramenta(`${selected.current.length} selecionados`)
              }}
            >
              Todas
            </button>
            <button
              type="button"
              data-testid="ilha-atacar"
              onClick={() => {
                if (selected.current.length === 0 && !heroiEscolhido) return
                const vivos = sim.current.unidades.filter(
                  (unidade) => unidade.lado === 'inimigo' && unidade.hp > 0 && unidade.papel !== 'isca',
                )
                if (vivos.length === 0) return
                const origem = nucleoQualquer ?? { x: sim.current.heroi.x, z: sim.current.heroi.z }
                const alvo = [...vivos].sort(
                  (a, b) =>
                    Math.hypot(a.x - origem.x, a.z - origem.z) - Math.hypot(b.x - origem.x, b.z - origem.z),
                )[0]
                let atual = sim.current
                if (selected.current.length > 0) atual = ordenar(atual, selected.current, { tipo: 'atacar', alvoId: alvo.id })
                if (heroiEscolhido) atual = ordenarHeroi(atual, { tipo: 'atacar', alvoId: alvo.id })
                publicar(atual)
              }}
            >
              Atacar
            </button>
            <button
              type="button"
              data-testid="ilha-automatico"
              onClick={() => publicar(postura(sim.current, selected.current, 'automatico'))}
            >
              Automático
            </button>
            <p>{ferramenta || 'Clique no chão para fundar. Clique na tropa e depois no inimigo.'}</p>
          </div>
        )}
        {hud.derrota ? (
          <>
            <div className="ilha-fim">
              {nucleoQualquer && nucleoQualquer.hp <= 0 ? 'A base caiu.' : 'O exército caiu.'}
            </div>
            <button
              type="button"
              className="ilha-continuar"
              onClick={() => {
                selected.current = []
                publicar(createPartida())
                setPower('')
                setOpen(false)
              }}
            >
              Tentar de novo
            </button>
          </>
        ) : (
          hud.ruaPercorrida && (
            <>
              <div className="ilha-fim" data-testid="ilha-fim">
                A rua acabou.
              </div>
              <button
                type="button"
                className="ilha-continuar"
                onClick={() => publicar(continuarNaRua(sim.current))}
              >
                Continuar na rua
              </button>
            </>
          )
        )}
        {power && <div className="ilha-power">{power}</div>}
        <button
          type="button"
          className="ilha-atirar"
          onClick={() => {
            if (sim.current.derrota || sim.current.olhar === 'imperio') return
            publicar(atirar(sim.current))
          }}
        >
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
      {caixa && (
        <div
          className="ilha-retangulo"
          style={{
            left: Math.min(caixa.x, caixa.x2),
            top: Math.min(caixa.y, caixa.y2),
            width: Math.abs(caixa.x2 - caixa.x),
            height: Math.abs(caixa.y2 - caixa.y),
          }}
        />
      )}
      {open && challenge && (
        <div className="ilha-modal" role="dialog" aria-modal="true">
          <div className="ilha-card">
            <div className="ilha-tiers">
              {([1, 2, 3, 4] as const).map((item) => (
                <button key={item} type="button" aria-pressed={item === tier} onClick={() => openConta(item)}>
                  {MATH_CHALLENGE_TIER_POLICIES[item].badgePt}
                </button>
              ))}
            </div>
            <p className="ilha-slow">Eles andam a 10% da velocidade. Os pisos N L S O no chão também respondem.</p>
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
                publicar(fecharAltar(sim.current))
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
