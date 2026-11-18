import { Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Group, InstancedMesh, Mesh } from 'three'
import { BufferAttribute, BufferGeometry, Object3D, Vector2 } from 'three'
import {
  generateInfiniteChallenge,
  InfiniteMathChallenge,
  MATH_CHALLENGE_TIER_POLICIES,
  MathDifficultyTier,
} from '../domain/infiniteMathEngine'
import { corDoChaoBioma } from './biomaRecursos'
import { DIMENSOES_OBRA, GRAU_PARTIDA, OBRA_CENTRO_Y, OBSTACULOS, PARTIDA, PecaId } from './partidaPolicies'
import {
  abrirAltar,
  alcanceDoTiro,
  alternarSubsolo,
  alvoDoBotao,
  alvoDoBotaoObra,
  aplicarConta,
  atirar,
  CELULAS_DO_DISCO,
  chaoRevelado,
  cobertoAgora,
  continuarNaRua,
  criarTropa,
  definirOlhar,
  editarBlocoObra,
  evoluir,
  fecharAltar,
  idsNoRetangulo,
  iniciarObra,
  inimigoVisivel,
  marcadoPelaTorre,
  mira,
  obraEmConstrucao,
  ordenar,
  ordenarHeroi,
  pular,
  repararObra,
  pontosDoCorpo,
  folgaDoTiro,
  vetorDoOlhar,
  PartidaState,
  postura,
} from './partidaSim'
import {
  abrirMapa,
  criarAtlas,
  definirPoliticaMinimapas,
  escreverCena,
  estadoCena,
  estadoCorpo,
  fichaEm,
  resumoAtlas,
  stepAtlas,
  voltarAoCorpo,
} from './atlas'
import { IconeId, IconeSvg, META_INTENCOES } from './ilhaIcones'
import { MundoSandboxCena } from './MundoSandboxCena'
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

function distanciaTerceira(pitch: number, confinado = false): number {
  const sobe = Math.sin(pitch)
  let dist = confinado ? 2.25 : 6.5
  if (sobe > 0.02) {
    const cabe = (PARTIDA.eyeY - 0.5) / sobe
    if (dist > cabe) dist = Math.max(1.15, cabe)
  }
  return dist
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

function assinaturaPenumbra(state: PartidaState): string {
  const quantizado = (valor: number) => Math.round(valor * 2)
  const partes: string[] = []
  if (!state.semCorpo) partes.push(`h${quantizado(state.heroi.x)},${quantizado(state.heroi.z)}`)
  for (const unidade of state.unidades) {
    if (unidade.lado === 'aliado' && unidade.hp > 0) {
      partes.push(`u${unidade.id}:${quantizado(unidade.x)},${quantizado(unidade.z)}`)
    }
  }
  for (const obra of state.obras) {
    if (obra.lado !== 'inimigo' && obra.hp > 0) {
      partes.push(`o${obra.id}:${quantizado(obra.x)},${quantizado(obra.z)}:${obraEmConstrucao(obra) ? 0 : 1}`)
    }
  }
  return partes.join('|')
}

function olharNome(olhar: PartidaState['olhar']): string {
  if (olhar === 'primeira') return 'Primeira'
  if (olhar === 'imperio') return 'Império'
  return 'Terceira'
}

type Controle = {
  forward: boolean
  back: boolean
  strafe: -1 | 0 | 1
  eixoX?: number
  eixoY?: number
}

const RAIO_MANCHE = 56

function Cena(props: {
  sim: React.MutableRefObject<PartidaState>
  timeScale: React.MutableRefObject<number>
  keys: React.MutableRefObject<Controle>
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
  atlas: React.MutableRefObject<ReturnType<typeof criarAtlas>>
  mapa: string
  onQuadro: (texto: string) => void
  modoBloco: 'adicionar' | 'remover' | null
  onEditarBloco: (obraId: number, bx: number, by: number, bz: number, acao: 'adicionar' | 'remover') => void
  onPedirSubsolo: () => void
}) {
  const avatar = useRef<Group>(null)
  const flash = useRef<Mesh>(null)
  const campo = useRef<Mesh>(null)
  const campoGrupo = useRef<Group>(null)
  const nuvem = useRef<InstancedMesh>(null)
  const penumbra = useRef<InstancedMesh>(null)
  const pedra = useRef<Mesh>(null)
  const marcaNuvem = useRef({ versao: -1, olhar: '', mapa: '' })
  const marcaPenumbra = useRef({ versao: -1, olhar: '', mapa: '', assinatura: '' })
  const moldeNuvem = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => {
    const mesh = campo.current
    if (!mesh) return
    const fatias = 8
    const posicoes = new Float32Array((fatias + 1) * 2 * 3)
    const indices: number[] = []
    for (let i = 0; i < fatias; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const geom = new BufferGeometry()
    geom.setAttribute('position', new BufferAttribute(posicoes, 3))
    geom.setIndex(indices)
    mesh.geometry = geom
    if (penumbra.current) penumbra.current.count = 0
    if (nuvem.current) nuvem.current.count = 0
    return () => geom.dispose()
  }, [])
  const unidades = useRef(new Map<number, Mesh>())
  const aneis = useRef(new Map<number, Mesh>())
  const corpos = useRef(new Map<string, Mesh>())
  const obras = useRef(new Map<number, Mesh>())
  const arrasto = useRef<{ x: number; y: number } | null>(null)
  const { camera, gl, raycaster } = useThree()
  const soloNoChao = (clientX: number, clientY: number) => {
    const retangulo = gl.domElement.getBoundingClientRect()
    raycaster.setFromCamera(
      new Vector2(
        ((clientX - retangulo.left) / retangulo.width) * 2 - 1,
        -((clientY - retangulo.top) / retangulo.height) * 2 + 1,
      ),
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
    props.atlas.current = escreverCena(props.atlas.current, props.sim.current)
    props.atlas.current = stepAtlas(
      props.atlas.current,
      {
        forward: keys.forward,
        back: keys.back,
        strafe: keys.strafe,
        ...(keys.eixoX !== undefined || keys.eixoY !== undefined
          ? { eixoX: keys.eixoX ?? 0, eixoY: keys.eixoY ?? 0 }
          : {}),
      },
      bruto,
      props.timeScale.current,
      dt * 1000,
    )
    props.sim.current = estadoCena(props.atlas.current)
    const state = props.sim.current
    const olharDesenho = state.semCorpo ? 'imperio' : state.olhar
    if (avatar.current) {
      avatar.current.position.set(state.heroi.x, 0.9 + state.heroi.y, state.heroi.z)
      yawDoHeroi(avatar.current, { yaw: state.heroi.yaw })
      avatar.current.visible =
        !state.semCorpo &&
        (olharDesenho === 'imperio' || (olharDesenho === 'terceira' && distanciaTerceira(state.heroi.pitch) > 2.2))
    }
    if (flash.current) {
      flash.current.visible = state.heroi.shootCooldown > PARTIDA.shootCooldown * 0.55
    }
    state.unidades.forEach((unidade) => {
      const mesh = unidades.current.get(unidade.id)
      if (!mesh) return
      const mostra = unidade.lado === 'inimigo' ? inimigoVisivel(state, unidade) : unidade.hp > 0
      mesh.visible = mostra
      mesh.position.set(unidade.x, unidade.papel === 'dragao' ? 0.8 : 0.45, unidade.z)
      mesh.scale.set(1, 1, 1)
      const anel = aneis.current.get(unidade.id)
      if (anel) {
        anel.visible = marcadoPelaTorre(state, unidade)
        anel.position.set(unidade.x, 0.06, unidade.z)
      }
      if (unidade.papel === 'dragao') {
        const pontos = pontosDoCorpo(unidade)
        unidade.segmentos.forEach((numero, indice) => {
          const segmento = corpos.current.get(`${unidade.id}:${numero}`)
          const ponto = pontos[indice + 1]
          if (!segmento || !ponto) return
          const esticado = Math.hypot(ponto.x - unidade.x, ponto.z - unidade.z) > 0.6
          segmento.visible = mostra
          segmento.position.set(ponto.x, esticado ? 0.55 : 1.35 + indice * 0.38, ponto.z)
        })
      }
    })
    state.obras.forEach((obra) => {
      const mesh = obras.current.get(obra.id)
      if (!mesh) return
      const ruina = obra.hp <= 0
      const construindo = obraEmConstrucao(obra)
      const usaVoxelNv5 = Boolean(obra.blocosNv5) && !ruina && !construindo
      if (usaVoxelNv5) {
        mesh.visible = false
        return
      }
      const total = Math.max(0.01, obra.construindoTotal ?? 1)
      const progresso = construindo ? Math.max(0, 1 - (obra.construindoRestante ?? 0) / total) : 1
      const lembrada = chaoRevelado(state, obra.x, obra.z)
      mesh.visible = obra.lado === 'inimigo'
        ? ruina ? lembrada : cobertoAgora(state, obra.x, obra.z)
        : ruina ? lembrada : true
      const escalaY = ruina ? 0.16 : construindo ? 0.25 + 0.75 * progresso : 1
      mesh.scale.y = escalaY
      const alturaPeca = DIMENSOES_OBRA[obra.tipo][1]
      mesh.position.set(
        obra.x,
        ruina ? alturaPeca * 0.08 + 0.02 : construindo ? (alturaPeca * escalaY) / 2 : OBRA_CENTRO_Y,
        obra.z,
      )
    })
    const yaw = state.heroi.yaw
    const pitch = state.heroi.pitch
    const olhar = vetorDoOlhar(yaw, pitch)
    const dentroDeFortaleza = state.obras.some(
      (o) => Boolean(o.blocosNv5) && o.hp > 0 && Math.abs(state.heroi.x - o.x) < 3.1 && Math.abs(state.heroi.z - o.z) < 3.1 && state.heroi.y < 2.5,
    )
    const confinado = state.heroi.y < -0.9 || dentroDeFortaleza
    if (olharDesenho === 'imperio') {
      const anda = keys.eixoY !== undefined ? keys.eixoY : (keys.forward ? 1 : 0) - (keys.back ? 1 : 0)
      const lado = keys.eixoX !== undefined ? keys.eixoX : keys.strafe
      props.cam.current.x += lado * 16 * bruto
      props.cam.current.z += anda * 16 * bruto
      camera.position.set(props.cam.current.x, 34, props.cam.current.z + 24)
      camera.lookAt(props.cam.current.x, 0, props.cam.current.z)
    } else if (olharDesenho === 'primeira') {
      camera.position.set(state.heroi.x, PARTIDA.eyeY + state.heroi.y, state.heroi.z)
      camera.lookAt(state.heroi.x + olhar.x, PARTIDA.eyeY + state.heroi.y + olhar.y, state.heroi.z + olhar.z)
    } else {
      const dist = distanciaTerceira(pitch, confinado)
      const ombro = Math.min(0.8, dist * 0.14)
      const direitaX = -Math.cos(yaw)
      const direitaZ = -Math.sin(yaw)
      const camX = state.heroi.x - olhar.x * dist + direitaX * ombro
      const camY = PARTIDA.eyeY + state.heroi.y - olhar.y * dist
      const camZ = state.heroi.z - olhar.z * dist + direitaZ * ombro
      camera.position.set(camX, camY, camZ)
      camera.lookAt(camX + olhar.x, camY + olhar.y, camZ + olhar.z)
    }
    if (campoGrupo.current) {
      const grupo = campoGrupo.current
      grupo.visible = olharDesenho !== 'imperio'
      if (grupo.visible) {
        const alcance = alcanceDoTiro(state.heroi.x, state.heroi.z, yaw)
        const fx = -Math.sin(yaw)
        const fz = Math.cos(yaw)
        grupo.position.set(state.heroi.x, 0.08 + state.heroi.y, state.heroi.z)
        grupo.rotation.y = Math.atan2(fx, fz)
        const posicoes = campo.current?.geometry.getAttribute('position')
        if (posicoes) {
          const fatias = posicoes.count / 2 - 1
          for (let i = 0; i <= fatias; i++) {
            const along = (alcance * i) / Math.max(1, fatias)
            const folga = folgaDoTiro(along)
            posicoes.setXYZ(i * 2, folga, 0, along)
            posicoes.setXYZ(i * 2 + 1, -folga, 0, along)
          }
          posicoes.needsUpdate = true
          campo.current?.geometry.computeBoundingSphere()
        }
      }
    }
    if (nuvem.current) {
      const malhaNuvem = nuvem.current
      if (!PARTIDA.nuvem) {
        malhaNuvem.visible = false
      } else if (
        marcaNuvem.current.versao !== state.versaoChao ||
        marcaNuvem.current.olhar !== olharDesenho ||
        marcaNuvem.current.mapa !== props.mapa
      ) {
        const altura = olharDesenho === 'imperio' ? 4 : 24
        let n = 0
        for (const celula of CELULAS_DO_DISCO) {
          if (state.chaoVisto[celula.i] === 1) continue
          moldeNuvem.position.set(celula.x, altura / 2, celula.z)
          moldeNuvem.scale.set(1, altura, 1)
          moldeNuvem.updateMatrix()
          malhaNuvem.setMatrixAt(n, moldeNuvem.matrix)
          n += 1
        }
        malhaNuvem.count = n
        malhaNuvem.instanceMatrix.needsUpdate = true
        marcaNuvem.current = { versao: state.versaoChao, olhar: olharDesenho, mapa: props.mapa }
        malhaNuvem.visible = true
      }
    }
    if (pedra.current) {
      pedra.current.visible = state.pedraNoChao && chaoRevelado(state, PARTIDA.pedraX, PARTIDA.pedraZ)
    }
    if (penumbra.current && PARTIDA.nuvem) {
      const malhaPenumbra = penumbra.current
      const assinatura = assinaturaPenumbra(state)
      const marca = marcaPenumbra.current
      if (
        marca.versao !== state.versaoChao ||
        marca.olhar !== olharDesenho ||
        marca.mapa !== props.mapa ||
        marca.assinatura !== assinatura
      ) {
        const altura = olharDesenho === 'imperio' ? 1.2 : 8
        let n = 0
        for (const celula of CELULAS_DO_DISCO) {
          if (state.chaoVisto[celula.i] !== 1 || cobertoAgora(state, celula.x, celula.z)) continue
          moldeNuvem.position.set(celula.x, altura / 2, celula.z)
          moldeNuvem.scale.set(1, altura, 1)
          moldeNuvem.updateMatrix()
          malhaPenumbra.setMatrixAt(n, moldeNuvem.matrix)
          n += 1
        }
        malhaPenumbra.count = n
        malhaPenumbra.instanceMatrix.needsUpdate = true
        malhaPenumbra.visible = true
        marcaPenumbra.current = { versao: state.versaoChao, olhar: olharDesenho, mapa: props.mapa, assinatura }
      }
    }
    props.onQuadro(
      resumoAtlas(props.atlas.current)
        .map((ficha) => `${ficha.i},${ficha.j},${ficha.alerta},${ficha.ritmo},${ficha.cena ? 1 : 0},${ficha.corpo ? 1 : 0}`)
        .join('|') +
        `:${props.atlas.current.politica}:${props.atlas.current.cotaDinamica}:${estadoCorpo(props.atlas.current).derrota ? 1 : 0}:${estadoCorpo(props.atlas.current).heroi.army}`,
    )
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
          if ((!props.sim.current.semCorpo && props.sim.current.olhar !== 'imperio') || props.tool.current) return
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
        <planeGeometry args={[PARTIDA.ladoMapa, PARTIDA.ladoMapa]} />
        <meshStandardMaterial color={corDoChaoBioma(props.sim.current.bioma)} />
      </mesh>
      <MundoSandboxCena
        state={props.sim.current}
        lagoas={props.sim.current.lagoas}
        recursos={props.sim.current.recursos}
        subsoloCentro={props.sim.current.subsoloCentro}
        modoBloco={props.modoBloco}
        onEditarBloco={props.onEditarBloco}
        onPedirSubsolo={props.onPedirSubsolo}
      />
      {(props.sim.current.semCorpo || props.sim.current.heroi.y >= -0.9) && (
        <mesh position={[0, -0.35, 20]}>
          <boxGeometry args={[8, 0.2, 42]} />
          <meshStandardMaterial color="#7d8ea3" />
        </mesh>
      )}
      <mesh ref={pedra} position={[PARTIDA.pedraX, PARTIDA.pedraAltura / 2, PARTIDA.pedraZ]}>
        <boxGeometry args={[PARTIDA.pedraMeio * 2, PARTIDA.pedraAltura, PARTIDA.pedraMeio * 2]} />
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
        <mesh key={`${caixa.x}-${caixa.z}`} position={[caixa.x, caixa.altura / 2, caixa.z]}>
          <boxGeometry args={[caixa.hx * 2, caixa.altura, caixa.hz * 2]} />
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
        {(props.sim.current.semCorpo || props.sim.current.heroi.y >= -0.9) && cobertoAgora(props.sim.current, 0, 20) && (
          <Html position={[0, 2.8, 0]} center>
            <div className="ilha-plate">+10</div>
          </Html>
        )}
      </group>
      {props.sim.current.obras.map((obra) => (
        <mesh
          key={obra.id}
          ref={(node) => {
            if (node) obras.current.set(obra.id, node)
            else obras.current.delete(obra.id)
          }}
          position={[obra.x, OBRA_CENTRO_Y, obra.z]}
          onClick={(event) => {
            const atual = props.sim.current
            const peca = atual.obras.find((item) => item.id === obra.id)
            if (!peca || peca.hp <= 0 || (peca.lado === 'inimigo' && !cobertoAgora(atual, peca.x, peca.z))) return
            event.stopPropagation()
            if (atual.semCorpo || atual.olhar === 'imperio') props.onObra(obra.id)
          }}
        >
          <boxGeometry args={DIMENSOES_OBRA[obra.tipo]} />
          <meshStandardMaterial
            color={
              obra.hp <= 0
                ? obra.lado === 'inimigo'
                  ? '#292524'
                  : '#57534e'
                : obraEmConstrucao(obra)
                  ? obra.lado === 'inimigo'
                    ? '#b45309'
                    : '#f59e0b'
                  : obra.lado === 'inimigo'
                ? obra.tipo === 'nucleo'
                  ? '#7f1d1d'
                  : '#9f1239'
                : obra.tipo === 'nucleo'
                  ? '#facc15'
                  : obra.tipo === 'torre'
                    ? '#0284c7'
                    : obra.tipo === 'portao'
                      ? '#16a34a'
                      : obra.tipo === 'quartel'
                        ? '#d97706'
                        : obra.tipo === 'serraria'
                          ? '#15803d'
                          : obra.tipo === 'mina'
                            ? '#eab308'
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
      {props.sim.current.unidades.filter((unidade) => unidade.lado === 'inimigo').map((unidade) => (
        <mesh
          key={`anel-${unidade.id}`}
          ref={(node) => {
            if (node) aneis.current.set(unidade.id, node)
            else aneis.current.delete(unidade.id)
          }}
          visible={false}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[0.65, 0.83, 24]} />
          <meshBasicMaterial color="#facc15" depthWrite={false} />
        </mesh>
      ))}
      {props.sim.current.unidades
        .filter((unidade) => unidade.papel === 'dragao' && inimigoVisivel(props.sim.current, unidade))
        .flatMap((unidade) =>
          unidade.segmentos.map((numero, indice) => (
            <mesh
              key={`${unidade.id}-${numero}`}
              position={[unidade.x, 1.35 + indice * 0.38, unidade.z]}
              ref={(node) => {
                const chave = `${unidade.id}:${numero}`
                if (node) corpos.current.set(chave, node)
                else corpos.current.delete(chave)
              }}
              onClick={(event) => {
                event.stopPropagation()
                props.onUnit(unidade.id, unidade.lado)
              }}
            >
              <boxGeometry args={[0.85, 0.7, 1.05]} />
              <meshStandardMaterial color="#6d28d9" />
              <Html center sprite style={{ pointerEvents: 'none' }} zIndexRange={[1, 0]}>
                <div className="ilha-numero" data-testid={`ilha-dragao-${numero}`}>
                  {numero}
                </div>
              </Html>
            </mesh>
          )),
        )}
      {pisos.map((piso) => (
        <mesh key={piso.nome} position={[piso.x, 0.05, piso.z]}>
          <cylinderGeometry args={[0.7, 0.7, 0.12, 12]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
      <group ref={campoGrupo}>
        <mesh ref={campo} renderOrder={3} raycast={() => null} frustumCulled={false}>
          <meshBasicMaterial color="#facc15" transparent opacity={0.45} depthWrite={false} side={2} />
        </mesh>
      </group>
      <instancedMesh
        ref={penumbra}
        args={[undefined, undefined, CELULAS_DO_DISCO.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0b1220" transparent opacity={0.72} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={nuvem}
        args={[undefined, undefined, CELULAS_DO_DISCO.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d5e2ea" transparent opacity={0.92} depthWrite />
      </instancedMesh>
    </>
  )
}

export const IlhaRua: React.FC = () => {
  const atlasRef = useRef(criarAtlas())
  const sim = useRef(estadoCena(atlasRef.current))
  const camadaMini = useRef<HTMLDivElement>(null)
  const miniEscala = useRef(168 / (PARTIDA.ladoMapa * 5))
  const quadro = useRef('')
  const [mapaTick, setMapaTick] = useState(0)
  const timeScale = useRef(1)
  const modalOpen = useRef(false)
  const keys = useRef<Controle>({ forward: false, back: false, strafe: 0 })
  const lookDrag = useRef<{ x: number; y: number } | null>(null)
  const lookPonteiro = useRef<number | null>(null)
  const stickPonteiro = useRef<number | null>(null)
  const stickOrigem = useRef<{ x: number; y: number } | null>(null)
  const stickEl = useRef<HTMLDivElement>(null)
  const knobEl = useRef<HTMLSpanElement>(null)
  const segurandoTiro = useRef(false)
  const tiroPonteiro = useRef<number | null>(null)
  const [celular, setCelular] = useState(() => window.matchMedia('(pointer: coarse)').matches)
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
  const [intencao, setIntencao] = useState<IconeId | null>(null)
  const [menuMiniAberto, setMenuMiniAberto] = useState(true)
  const [painelBlocosAberto, setPainelBlocosAberto] = useState(false)
  const [modoBloco, setModoBloco] = useState<'adicionar' | 'remover' | null>(null)
  const modoBlocoRef = useRef<'adicionar' | 'remover' | null>(null)
  modoBlocoRef.current = modoBloco
  const mapaInteracao = useRef('0,0')

  const limparInteracao = (preservarMovimento = false) => {
    if (!preservarMovimento) {
      keys.current = { forward: false, back: false, strafe: 0 }
      lookDrag.current = null
      lookPonteiro.current = null
      stickPonteiro.current = null
      stickOrigem.current = null
      segurandoTiro.current = false
      tiroPonteiro.current = null
      stickEl.current?.classList.remove('ativo')
      document.exitPointerLock?.()
    }
    selected.current = []
    evoluirId.current = null
    tool.current = null
    dragou.current = false
    setHeroiEscolhido(false)
    setCaixa(null)
    setFerramenta('')
    setIntencao(null)
    setModoBloco(null)
    setOpen(false)
  }

  const podeComandar = () => !estadoCorpo(atlasRef.current).derrota && (sim.current.semCorpo || sim.current.olhar === 'imperio')

  const publicar = (next: PartidaState) => {
    sim.current = next
    atlasRef.current = escreverCena(atlasRef.current, next)
    setHud((previous) => {
      const mudou =
        previous.olhar !== next.olhar ||
        previous.semCorpo !== next.semCorpo ||
        previous.heroi.army !== next.heroi.army ||
        previous.credito !== next.credito ||
        previous.derrota !== next.derrota ||
        previous.ruaPercorrida !== next.ruaPercorrida ||
        previous.obras.length !== next.obras.length ||
        previous.obras.map((obra) => `${obra.id}:${obra.lado}:${obra.hp}:${obra.nivel}:${Math.ceil((obra.construindoRestante ?? 0) * 2)}`).join() !==
          next.obras.map((obra) => `${obra.id}:${obra.lado}:${obra.hp}:${obra.nivel}:${Math.ceil((obra.construindoRestante ?? 0) * 2)}`).join() ||
        previous.unidades.length !== next.unidades.length ||
        previous.unidades
            .map((unidade) => `${unidade.id}:${unidade.postura}:${unidade.ordem?.tipo ?? ''}:${unidade.hp}:${unidade.segmentos.join('.')}:${inimigoVisivel(previous, unidade) ? 1 : 0}:${unidade.rota?.semCaminho ? 1 : 0}`)
            .join() !==
          next.unidades
            .map((unidade) => `${unidade.id}:${unidade.postura}:${unidade.ordem?.tipo ?? ''}:${unidade.hp}:${unidade.segmentos.join('.')}:${inimigoVisivel(next, unidade) ? 1 : 0}:${unidade.rota?.semCaminho ? 1 : 0}`)
            .join() ||
        previous.lingotes !== next.lingotes ||
        previous.resto !== next.resto ||
        previous.madeira !== next.madeira ||
        previous.ouro !== next.ouro ||
        previous.bioma !== next.bioma ||
        previous.versaoRecursos !== next.versaoRecursos ||
        Math.round(previous.heroi.y * 10) !== Math.round(next.heroi.y * 10) ||
        previous.heroi.carregandoKg !== next.heroi.carregandoKg ||
        previous.altar?.resolvido !== next.altar?.resolvido ||
        previous.altar?.aviso !== next.altar?.aviso ||
        compassLetter(previous.heroi.yaw) !== compassLetter(next.heroi.yaw) ||
        Math.ceil(PARTIDA.ondaPeriodo - previous.ondaRelogio) !==
          Math.ceil(PARTIDA.ondaPeriodo - next.ondaRelogio) ||
        previous.versaoChao !== next.versaoChao
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
        if (event.repeat || sim.current.olhar === 'imperio' || sim.current.derrota || sim.current.semCorpo) return
        publicar(pular(sim.current))
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
    const moverManche = (clientX: number, clientY: number) => {
      const origem = stickOrigem.current
      if (!origem) return
      const dx = clientX - origem.x
      const dy = clientY - origem.y
      const dist = Math.hypot(dx, dy)
      const escala = dist > RAIO_MANCHE ? RAIO_MANCHE / dist : 1
      const px = dx * escala
      const py = dy * escala
      let eixoX = px / RAIO_MANCHE
      let eixoY = -py / RAIO_MANCHE
      if (Math.hypot(eixoX, eixoY) < 0.18) {
        eixoX = 0
        eixoY = 0
      }
      keys.current.eixoX = eixoX
      keys.current.eixoY = eixoY
      if (knobEl.current) knobEl.current.style.transform = `translate(${px}px, ${py}px)`
    }
    const soltarManche = () => {
      stickPonteiro.current = null
      stickOrigem.current = null
      delete keys.current.eixoX
      delete keys.current.eixoY
      stickEl.current?.classList.remove('ativo')
    }
    const moveLook = (event: PointerEvent) => {
      if (stickPonteiro.current === event.pointerId) {
        moverManche(event.clientX, event.clientY)
        return
      }
      if (sim.current.semCorpo || sim.current.olhar === 'imperio' || modalOpen.current) return
      if (document.pointerLockElement && event.pointerType !== 'touch') {
        sim.current = mira(sim.current, event.movementX * 0.003, -event.movementY * 0.003)
        return
      }
      if (lookPonteiro.current !== null && event.pointerId !== lookPonteiro.current) return
      const drag = lookDrag.current
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      lookDrag.current = { x: event.clientX, y: event.clientY }
      sim.current = mira(sim.current, dx * 0.005, -dy * 0.004)
    }
    const stopLook = (event: PointerEvent) => {
      if (stickPonteiro.current === event.pointerId) soltarManche()
      if (lookPonteiro.current === event.pointerId) {
        lookDrag.current = null
        lookPonteiro.current = null
      }
      if (tiroPonteiro.current === event.pointerId) {
        segurandoTiro.current = false
        tiroPonteiro.current = null
      }
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up)
    window.addEventListener('pointermove', moveLook)
    window.addEventListener('pointerup', stopLook)
    window.addEventListener('pointercancel', stopLook)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up)
      window.removeEventListener('pointermove', moveLook)
      window.removeEventListener('pointerup', stopLook)
      window.removeEventListener('pointercancel', stopLook)
    }
  }, [])

  const escolherFerramenta = (peca: PecaId, nome: string) => {
    if (!podeComandar()) return
    tool.current = peca
    setFerramenta(nome)
    publicar(definirOlhar(sim.current, 'imperio'))
    document.exitPointerLock?.()
  }

  const openConta = (nextTier: MathDifficultyTier) => {
    if (sim.current.semCorpo || estadoCorpo(atlasRef.current).derrota) return
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

  useEffect(() => {
    if (!power) return
    const timer = window.setTimeout(() => setPower(''), 3500)
    return () => window.clearTimeout(timer)
  }, [power])

  timeScale.current = open ? 0.1 : 1
  modalOpen.current = open

  const nucleoQualquer = hud.obras.find((obra) => obra.tipo === 'nucleo' && obra.lado !== 'inimigo')
  const nucleo = nucleoQualquer && nucleoQualquer.hp > 0 ? nucleoQualquer : undefined
  const ruinaNossa =
    hud.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0) ??
    hud.obras.find((obra) => obra.lado !== 'inimigo' && obra.hp <= 0)
  const tropasVivas = hud.unidades.filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
  const emOrdens = tropasVivas.filter((unidade) => unidade.postura === 'ordens').length
  const emAuto = tropasVivas.filter((unidade) => unidade.postura === 'automatico').length
  const dragaoVivo = hud.unidades.find((unidade) => unidade.papel === 'dragao' && inimigoVisivel(hud, unidade))
  const corpoAtual = estadoCorpo(atlasRef.current)
  const derrotado = corpoAtual.derrota
  const tatico = hud.semCorpo || hud.olhar === 'imperio'

  const confirmarIntencao = (acao: IconeId) => {
    setIntencao(null)
    if (
      acao === 'nucleo' ||
      acao === 'torre' ||
      acao === 'portao' ||
      acao === 'quartel' ||
      acao === 'britador' ||
      acao === 'serraria' ||
      acao === 'mina'
    ) {
      escolherFerramenta(acao, META_INTENCOES[acao].titulo)
      return
    }
    if (acao === 'evoluir') {
      const id = evoluirId.current ?? nucleo?.id
      if (!id) return
      publicar(evoluir(sim.current, id))
      return
    }
    if (acao === 'tropa') {
      const casa =
        sim.current.obras.find(
          (obra) => obra.lado !== 'inimigo' && obra.tipo === 'quartel' && obra.hp > 0 && !obraEmConstrucao(obra),
        ) ?? nucleo
      if (!casa) return
      publicar(criarTropa(sim.current, casa.id))
      return
    }
    if (acao === 'todas') {
      selected.current = sim.current.unidades
        .filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
        .map((unidade) => unidade.id)
      setFerramenta(`${selected.current.length} selecionados`)
      return
    }
    if (acao === 'atacar') {
      const ids =
        selected.current.length > 0
          ? selected.current
          : sim.current.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0).map((u) => u.id)
      if (ids.length === 0 && !heroiEscolhido) return
      selected.current = ids
      const alvoId = alvoDoBotao(sim.current)
      if (alvoId !== null) {
        let atual = sim.current
        if (ids.length > 0) atual = ordenar(atual, ids, { tipo: 'atacar', alvoId })
        if (heroiEscolhido) atual = ordenarHeroi(atual, { tipo: 'atacar', alvoId })
        publicar(atual)
        return
      }
      const obraId = alvoDoBotaoObra(sim.current)
      if (obraId === null) return
      let atual = sim.current
      if (ids.length > 0) atual = ordenar(atual, ids, { tipo: 'atacarObra', obraId })
      if (heroiEscolhido) atual = ordenarHeroi(atual, { tipo: 'atacarObra', obraId })
      publicar(atual)
      return
    }
    if (acao === 'automatico') {
      const ids =
        selected.current.length > 0
          ? selected.current
          : sim.current.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0).map((u) => u.id)
      selected.current = ids
      publicar(postura(sim.current, ids, 'automatico'))
      return
    }
    if (acao === 'reparar') {
      const ruina =
        sim.current.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0) ??
        sim.current.obras.find((obra) => obra.lado !== 'inimigo' && obra.hp <= 0)
      if (!ruina) return
      publicar(repararObra(sim.current, ruina.id))
      return
    }
    if (acao === 'subsolo') {
      document.exitPointerLock?.()
      publicar(alternarSubsolo(sim.current))
      return
    }
    if (acao === 'editarBlocos') {
      setPainelBlocosAberto((aberto) => {
        if (aberto) setModoBloco(null)
        return !aberto
      })
      return
    }
    if (acao === 'blocoAdicionar') {
      document.exitPointerLock?.()
      setPainelBlocosAberto(true)
      setModoBloco((atual) => (atual === 'adicionar' ? null : 'adicionar'))
      setFerramenta('Modo Bloco: Adicionar')
      return
    }
    if (acao === 'blocoRemover') {
      document.exitPointerLock?.()
      setPainelBlocosAberto(true)
      setModoBloco((atual) => (atual === 'remover' ? null : 'remover'))
      setFerramenta('Modo Bloco: Remover')
      return
    }
    if (acao === 'menuMinimapas') {
      setMenuMiniAberto((aberto) => !aberto)
      return
    }
    if (acao === 'minimapaAtual' || acao === 'minimapaAlguns' || acao === 'minimapaTodos') {
      const politica = acao === 'minimapaAtual' ? 'atual' : acao === 'minimapaTodos' ? 'todos' : 'alguns'
      atlasRef.current = definirPoliticaMinimapas(atlasRef.current, politica)
      sim.current = estadoCena(atlasRef.current)
      publicar(sim.current)
      setMapaTick((valor) => valor + 1)
    }
  }

  const temMinaPronta = hud.obras.some(
    (obra) => obra.lado !== 'inimigo' && obra.tipo === 'mina' && obra.hp > 0 && !obraEmConstrucao(obra),
  )
  const noSubsoloHud = !hud.semCorpo && hud.heroi.y < -0.9
  const temFortalezaNv5 = hud.obras.some(
    (obra) => obra.lado !== 'inimigo' && obra.hp > 0 && !obraEmConstrucao(obra) && Boolean(obra.blocosNv5),
  )

  return (
    <div
      className={celular ? 'ilha-shell ilha-celular' : 'ilha-shell'}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (
          target.closest(
            'button, .ilha-modal, .ilha-confirmar-card, .ilha-acoes-campo, .ilha-olhar, .ilha-barra, .ilha-minimapa, .ilha-base, .ilha-ferramentas',
          )
        )
          return
        const toque = event.pointerType === 'touch'
        if (toque) setCelular(true)
        if (toque) {
          const retangulo = event.currentTarget.getBoundingClientRect()
          const localX = event.clientX - retangulo.left
          if (localX < retangulo.width * 0.45) {
            event.preventDefault()
            stickPonteiro.current = event.pointerId
            stickOrigem.current = { x: event.clientX, y: event.clientY }
            keys.current.eixoX = 0
            keys.current.eixoY = 0
            if (stickEl.current) {
              stickEl.current.classList.add('ativo')
              stickEl.current.style.left = `${event.clientX - retangulo.left}px`
              stickEl.current.style.top = `${event.clientY - retangulo.top}px`
            }
            if (knobEl.current) knobEl.current.style.transform = 'translate(0px, 0px)'
            return
          }
          if (sim.current.olhar === 'imperio' || sim.current.semCorpo || modoBlocoRef.current) return
          event.preventDefault()
          lookDrag.current = { x: event.clientX, y: event.clientY }
          lookPonteiro.current = event.pointerId
          return
        }
        if (sim.current.olhar === 'imperio' || sim.current.semCorpo) return
        if (modoBlocoRef.current) return
        if (event.button === 0 && !sim.current.derrota) {
          segurandoTiro.current = true
          tiroPonteiro.current = event.pointerId
          publicar(atirar(sim.current))
        }
        lookDrag.current = { x: event.clientX, y: event.clientY }
        lookPonteiro.current = event.pointerId
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
          modoBloco={modoBloco}
          onEditarBloco={(obraId, bx, by, bz, acao) => {
            publicar(editarBlocoObra(sim.current, obraId, bx, by, bz, acao))
          }}
          onPedirSubsolo={() => setIntencao('subsolo')}
          onHud={(state) => {
            const corpo = fichaEm(atlasRef.current, atlasRef.current.heroiI, atlasRef.current.heroiJ)
            const camada = camadaMini.current
            if (corpo && camada) {
              const escala = miniEscala.current
              const hx = atlasRef.current.heroiI * PARTIDA.ladoMapa + corpo.state.heroi.x
              const hz = atlasRef.current.heroiJ * PARTIDA.ladoMapa + corpo.state.heroi.z
              camada.style.transform = `translate(${84 - hx * escala}px, ${84 + hz * escala}px)`
            }
            if (state.altar?.resolvido && modalOpen.current) {
              setOpen(false)
              setPower(`${GRAU_PARTIDA[state.altar.tier].bonus} soldados pelo piso certo`)
            }
            if (state.altar?.aviso) setNote(state.altar.aviso)
            const tiro =
              segurandoTiro.current && state.olhar !== 'imperio' && !state.semCorpo && !state.derrota && state.heroi.shootCooldown <= 0
                ? atirar(state)
                : state
            publicar(tiro)
          }}
          onGround={(x, z) => {
            if (!podeComandar()) return
            if (tool.current) {
              if (!chaoRevelado(sim.current, x, z)) return
              publicar(iniciarObra(sim.current, tool.current, x, z))
              tool.current = null
              setFerramenta('')
              return
            }
            let atual = sim.current
            if (heroiEscolhido && !atual.semCorpo) atual = ordenarHeroi(atual, { tipo: 'mover', x, z })
            if (selected.current.length > 0) atual = ordenar(atual, selected.current, { tipo: 'mover', x, z })
            publicar(atual)
          }}
          onUnit={(id, lado) => {
            if (!podeComandar()) return
            const unidade = sim.current.unidades.find((item) => item.id === id)
            if (!unidade || unidade.hp <= 0 || (lado === 'inimigo' && !inimigoVisivel(sim.current, unidade))) return
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
            if (!podeComandar()) return
            const obra = sim.current.obras.find((item) => item.id === id)
            if (!obra || obra.hp <= 0) return
            if (obra.lado === 'inimigo') {
              if (selected.current.length === 0 && (!heroiEscolhido || sim.current.semCorpo)) return
              let atual = sim.current
              if (heroiEscolhido && !atual.semCorpo) atual = ordenarHeroi(atual, { tipo: 'atacarObra', obraId: obra.id })
              if (selected.current.length > 0) atual = ordenar(atual, selected.current, { tipo: 'atacarObra', obraId: obra.id })
              publicar(atual)
              return
            }
            evoluirId.current = id
            setFerramenta(obra.tipo)
          }}
          onRect={(x0, z0, x1, z1) => {
            if (!podeComandar()) return
            selected.current = idsNoRetangulo(sim.current, x0, z0, x1, z1)
            setFerramenta(`${selected.current.length} no retângulo`)
          }}
          onCaixa={setCaixa}
          onHeroi={() => {
            if (!podeComandar() || sim.current.semCorpo) return
            setHeroiEscolhido((valor) => !valor)
            setFerramenta('Herói')
          }}
          heroiEscolhido={heroiEscolhido}
          atlas={atlasRef}
          mapa={`${atlasRef.current.cenaI},${atlasRef.current.cenaJ}`}
          onQuadro={(texto) => {
            const indice = `${atlasRef.current.cenaI},${atlasRef.current.cenaJ}`
            if (mapaInteracao.current !== indice) {
              mapaInteracao.current = indice
              limparInteracao(!sim.current.semCorpo)
              setHud(sim.current)
            }
            if (texto === quadro.current) return
            quadro.current = texto
            setMapaTick((valor) => valor + 1)
          }}
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
          <span data-testid="ilha-olhar">{hud.semCorpo ? 'Observando · Império' : olharNome(hud.olhar)}</span>
        </div>
        <div className="ilha-army" data-testid="ilha-exercito">
          Exército {corpoAtual.heroi.army}
        </div>
        <div className="ilha-base" data-testid="ilha-base">
          {nucleoQualquer
            ? `Núcleo nível ${nucleoQualquer.nivel} · vida ${Math.max(0, Math.ceil(nucleoQualquer.hp))} · tropas ${tropasVivas.length} · ${emOrdens} em ordens · ${emAuto} no automático`
            : 'Sem base'}
          {hud.obras.some((obra) => obra.lado !== 'inimigo' && obraEmConstrucao(obra))
            ? ` · ${hud.obras.filter((obra) => obra.lado !== 'inimigo' && obraEmConstrucao(obra)).length} em obras (frágil!)`
            : ''}
          {hud.unidades.some((unidade) => unidade.rota?.semCaminho) ? ' · sem caminho' : ''}
          {nucleoQualquer && nucleoQualquer.hp > 0 && hud.obras.some((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo' && obra.hp > 0)
            ? ` · Leva em ${Math.max(0, Math.ceil(PARTIDA.ondaPeriodo - hud.ondaRelogio))}s`
            : ''}
          {dragaoVivo ? ` · Dragão ${dragaoVivo.segmentos.join(' ')}` : ''}
          {nucleoQualquer && nucleoQualquer.hp <= 0 ? ' · Base destruída' : ''}
          {hud.obras.some((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0)
            ? ' · Núcleo inimigo destruído · sem novas levas'
            : ''}
        </div>
        <div className="ilha-enemies" data-testid="ilha-recursos">
          Licenças {hud.credito} · Madeira {hud.madeira} · Ouro {hud.ouro}
          {hud.lingotes > 0 ? ` · Lingotes ${hud.lingotes} resto ${hud.resto}` : ''}
          {hud.heroi.carregandoKg > 0 ? ` · Pedra ${hud.heroi.carregandoKg} kg` : ''}
          {noSubsoloHud ? ' · Subsolo' : ''}
          {modoBloco ? ` · Blocos (${modoBloco})` : ''}
        </div>
        <div className="ilha-compass" data-testid="ilha-bussola">
          {compassLetter(hud.heroi.yaw)}
        </div>
        {!tatico && <div className="ilha-mira" data-testid="ilha-mira" />}
        {!tatico && !derrotado && (temMinaPronta || noSubsoloHud || temFortalezaNv5) && (
          <div className="ilha-acoes-campo" data-testid="ilha-acoes-campo">
            {(temMinaPronta || noSubsoloHud) && (
              <button
                type="button"
                className={noSubsoloHud || intencao === 'subsolo' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-subsolo"
                aria-label={META_INTENCOES.subsolo.titulo}
                onClick={() => setIntencao('subsolo')}
              >
                <IconeSvg id="subsolo" size={18} />
              </button>
            )}
            {temFortalezaNv5 && (
              <>
                <button
                  type="button"
                  className={painelBlocosAberto || intencao === 'editarBlocos' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid="ilha-editar-blocos"
                  aria-label={META_INTENCOES.editarBlocos.titulo}
                  onClick={() => setIntencao('editarBlocos')}
                >
                  <IconeSvg id="editarBlocos" size={18} />
                </button>
                {painelBlocosAberto && (
                  <>
                    <button
                      type="button"
                      className={modoBloco === 'adicionar' || intencao === 'blocoAdicionar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                      data-testid="ilha-bloco-adicionar"
                      aria-label={META_INTENCOES.blocoAdicionar.titulo}
                      onClick={() => setIntencao('blocoAdicionar')}
                    >
                      <IconeSvg id="blocoAdicionar" size={18} />
                    </button>
                    <button
                      type="button"
                      className={modoBloco === 'remover' || intencao === 'blocoRemover' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                      data-testid="ilha-bloco-remover"
                      aria-label={META_INTENCOES.blocoRemover.titulo}
                      onClick={() => setIntencao('blocoRemover')}
                    >
                      <IconeSvg id="blocoRemover" size={18} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {tatico && !derrotado && (
          <div className="ilha-ferramentas" data-testid="ilha-ferramentas">
            <div className="ilha-ferramentas-grade">
              {(['nucleo', 'torre', 'portao', 'quartel', 'britador', 'serraria', 'mina'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={tool.current === id || intencao === id ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid={`ilha-construir-${id}`}
                  aria-label={META_INTENCOES[id].titulo}
                  onClick={() => setIntencao(id)}
                >
                  <IconeSvg id={id} size={18} />
                </button>
              ))}
              <button
                type="button"
                className={intencao === 'evoluir' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-evoluir"
                aria-label={META_INTENCOES.evoluir.titulo}
                onClick={() => setIntencao('evoluir')}
              >
                <IconeSvg id="evoluir" size={18} />
              </button>
              <button
                type="button"
                className={intencao === 'tropa' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-tropa"
                aria-label={META_INTENCOES.tropa.titulo}
                onClick={() => setIntencao('tropa')}
              >
                <IconeSvg id="tropa" size={18} />
              </button>
              <button
                type="button"
                className={intencao === 'todas' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-todas"
                aria-label={META_INTENCOES.todas.titulo}
                onClick={() => setIntencao('todas')}
              >
                <IconeSvg id="todas" size={18} />
              </button>
              <button
                type="button"
                className={intencao === 'atacar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-atacar"
                aria-label={META_INTENCOES.atacar.titulo}
                onClick={() => setIntencao('atacar')}
              >
                <IconeSvg id="atacar" size={18} />
              </button>
              <button
                type="button"
                className={intencao === 'automatico' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-automatico"
                aria-label={META_INTENCOES.automatico.titulo}
                onClick={() => setIntencao('automatico')}
              >
                <IconeSvg id="automatico" size={18} />
              </button>
              {(temMinaPronta || noSubsoloHud) && (
                <button
                  type="button"
                  className={noSubsoloHud || intencao === 'subsolo' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid="ilha-subsolo"
                  aria-label={META_INTENCOES.subsolo.titulo}
                  onClick={() => setIntencao('subsolo')}
                >
                  <IconeSvg id="subsolo" size={18} />
                </button>
              )}
              {temFortalezaNv5 && (
                <>
                  <button
                    type="button"
                    className={painelBlocosAberto || intencao === 'editarBlocos' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                    data-testid="ilha-editar-blocos"
                    aria-label={META_INTENCOES.editarBlocos.titulo}
                    onClick={() => setIntencao('editarBlocos')}
                  >
                    <IconeSvg id="editarBlocos" size={18} />
                  </button>
                  {painelBlocosAberto && (
                    <>
                      <button
                        type="button"
                        className={modoBloco === 'adicionar' || intencao === 'blocoAdicionar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                        data-testid="ilha-bloco-adicionar"
                        aria-label={META_INTENCOES.blocoAdicionar.titulo}
                        onClick={() => setIntencao('blocoAdicionar')}
                      >
                        <IconeSvg id="blocoAdicionar" size={18} />
                      </button>
                      <button
                        type="button"
                        className={modoBloco === 'remover' || intencao === 'blocoRemover' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                        data-testid="ilha-bloco-remover"
                        aria-label={META_INTENCOES.blocoRemover.titulo}
                        onClick={() => setIntencao('blocoRemover')}
                      >
                        <IconeSvg id="blocoRemover" size={18} />
                      </button>
                    </>
                  )}
                </>
              )}
              {ruinaNossa && (
                <button
                  type="button"
                  className={intencao === 'reparar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid="ilha-reparar"
                  aria-label={META_INTENCOES.reparar.titulo}
                  onClick={() => setIntencao('reparar')}
                >
                  <IconeSvg id="reparar" size={18} />
                </button>
              )}
            </div>
            <p>{ferramenta || 'Toque num ícone para ver a descrição e confirmar.'}</p>
          </div>
        )}
        {derrotado ? (
          <>
            <div className="ilha-fim">
              {corpoAtual.obras.some((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0) ? 'A base caiu.' : 'O exército caiu.'}
            </div>
            <button
              type="button"
              className="ilha-continuar"
              onClick={() => {
                atlasRef.current = criarAtlas()
                sim.current = estadoCena(atlasRef.current)
                limparInteracao()
                publicar(sim.current)
                setPower('')
                setOpen(false)
              }}
            >
              Tentar de novo
            </button>
          </>
        ) : (
          PARTIDA.atlas !== 'grade' && hud.ruaPercorrida && (
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
        {!tatico && (
          <>
            <button
              type="button"
              className="ilha-pular"
              data-testid="ilha-pular"
              onPointerDown={(event) => {
                event.stopPropagation()
                event.preventDefault()
                publicar(pular(sim.current))
              }}
            >
              Pular
            </button>
            <button
              type="button"
              className="ilha-atirar"
              data-testid="ilha-atirar"
              onPointerDown={(event) => {
                event.stopPropagation()
                event.preventDefault()
                if (sim.current.derrota || sim.current.olhar === 'imperio' || sim.current.semCorpo) return
                segurandoTiro.current = true
                tiroPonteiro.current = event.pointerId
                publicar(atirar(sim.current))
              }}
              onPointerUp={(event) => {
                if (tiroPonteiro.current === event.pointerId) {
                  segurandoTiro.current = false
                  tiroPonteiro.current = null
                }
              }}
              onPointerCancel={(event) => {
                if (tiroPonteiro.current === event.pointerId) {
                  segurandoTiro.current = false
                  tiroPonteiro.current = null
                }
              }}
            >
              Atirar
            </button>
          </>
        )}
        <button type="button" className="ilha-conta" onClick={() => openConta(tier)}>
          Fazer conta
        </button>
        <div
          className="ilha-olhar"
          onPointerDown={(event) => {
            event.stopPropagation()
            lookDrag.current = { x: event.clientX, y: event.clientY }
            lookPonteiro.current = event.pointerId
          }}
        >
          Olhar
        </div>
        <div className="ilha-joystick" ref={stickEl} data-testid="ilha-joystick">
          <span ref={knobEl} />
        </div>
      </div>
      {intencao && (
        <div className="ilha-confirmar-card" data-testid="ilha-confirmar-card" role="dialog" aria-label={META_INTENCOES[intencao].titulo}>
          <div className="ilha-confirmar-topo">
            <span className="ilha-confirmar-selo">
              <IconeSvg id={intencao} size={22} />
            </span>
            <strong data-testid="ilha-confirmar-titulo">{META_INTENCOES[intencao].titulo}</strong>
          </div>
          <p className="ilha-confirmar-resumo">{META_INTENCOES[intencao].resumo}</p>
          <p className="ilha-confirmar-detalhe">{META_INTENCOES[intencao].detalhe}</p>
          <div className="ilha-confirmar-acoes">
            <button
              type="button"
              className="ilha-confirmar-nao"
              data-testid="ilha-confirmar-nao"
              onClick={() => setIntencao(null)}
            >
              <IconeSvg id="cancelar" size={15} />
              Cancelar
            </button>
            <button
              type="button"
              className="ilha-confirmar-sim"
              data-testid="ilha-confirmar-sim"
              onClick={() => confirmarIntencao(intencao)}
            >
              <IconeSvg id="confirmar" size={15} />
              Confirmar
            </button>
          </div>
        </div>
      )}
      {mapaTick >= 0 && (
        <div className="ilha-minimapa" data-testid="ilha-minimapa">
          <div className="ilha-mini-cabecalho">
            <button
              type="button"
              className={menuMiniAberto || intencao === 'menuMinimapas' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
              style={{ width: 30, height: 30 }}
              data-testid="ilha-menu-minimapas"
              aria-label={META_INTENCOES.menuMinimapas.titulo}
              onClick={(event) => {
                event.stopPropagation()
                setIntencao('menuMinimapas')
              }}
            >
              <IconeSvg id="menuMinimapas" size={16} />
            </button>
            {menuMiniAberto && (
              <div className="ilha-mini-modos" data-testid="ilha-minimapa-opcoes">
                {([
                  ['minimapaAtual', 'atual'],
                  ['minimapaAlguns', 'alguns'],
                  ['minimapaTodos', 'todos'],
                ] as const).map(([icone, modo]) => (
                  <button
                    key={icone}
                    type="button"
                    className={
                      atlasRef.current.politica === modo || intencao === icone ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'
                    }
                    style={{ width: 30, height: 30 }}
                    data-testid={`ilha-minimapa-${modo}`}
                    aria-label={META_INTENCOES[icone].titulo}
                    onClick={(event) => {
                      event.stopPropagation()
                      setIntencao(icone)
                    }}
                  >
                    <IconeSvg id={icone} size={15} />
                  </button>
                ))}
              </div>
            )}
            <span className="ilha-mini-status" data-testid="ilha-minimapa-status">
              {atlasRef.current.fichas.filter((f) => f.ritmo === 'cheio').length}/{atlasRef.current.fichas.length}
            </span>
          </div>
          <div className="ilha-mini-janela">
            <div className="ilha-mini-camada" ref={camadaMini}>
              {(() => {
                const atlasAgora = atlasRef.current
                const resumo = resumoAtlas(atlasAgora)
                const porChave = new Map(resumo.map((ficha) => [`${ficha.i},${ficha.j}`, ficha]))
                let minI = atlasAgora.heroiI - 2
                let maxI = atlasAgora.heroiI + 2
                let minJ = atlasAgora.heroiJ - 2
                let maxJ = atlasAgora.heroiJ + 2
                for (const ficha of resumo) {
                  minI = Math.min(minI, ficha.i)
                  maxI = Math.max(maxI, ficha.i)
                  minJ = Math.min(minJ, ficha.j)
                  maxJ = Math.max(maxJ, ficha.j)
                }
                minI = Math.min(minI, atlasAgora.cenaI)
                maxI = Math.max(maxI, atlasAgora.cenaI)
                minJ = Math.min(minJ, atlasAgora.cenaJ)
                maxJ = Math.max(maxJ, atlasAgora.cenaJ)
                const span = Math.max(maxI - minI + 1, maxJ - minJ + 1, 5)
                const escala = 168 / (span * PARTIDA.ladoMapa)
                miniEscala.current = escala
                const ladoPx = PARTIDA.ladoMapa * escala
                const quadrados = []
                for (let j = maxJ; j >= minJ; j -= 1) {
                  for (let i = minI; i <= maxI; i += 1) quadrados.push({ i, j, ficha: porChave.get(`${i},${j}`) })
                }
                return quadrados.map(({ i, j, ficha }) => (
                  <button
                    key={`${i}-${j}`}
                    type="button"
                    data-testid={`ilha-mapa-${i}-${j}`}
                    title={`${i}, ${j}`}
                    className={[
                      'ilha-mini-quadrado',
                      ficha ? '' : 'ilha-mapa-vazio',
                      ficha?.ritmo === 'cheio' ? 'ilha-mapa-cheio' : '',
                      ficha?.corpo ? 'ilha-mapa-corpo' : '',
                      ficha?.cena ? 'ilha-mapa-vendo' : '',
                      ficha?.alerta === 'verde' ? 'ilha-alerta-verde' : '',
                      ficha?.alerta === 'vermelho' ? 'ilha-alerta-vermelho' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: i * PARTIDA.ladoMapa * escala - ladoPx / 2,
                      top: -(j * PARTIDA.ladoMapa * escala) - ladoPx / 2,
                      width: ladoPx,
                      height: ladoPx,
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      limparInteracao()
                      atlasRef.current = abrirMapa(atlasRef.current, i, j)
                      sim.current = estadoCena(atlasRef.current)
                      cam.current = { x: 0, z: 0 }
                      publicar(sim.current)
                    }}
                  />
                ))
              })()}
            </div>
            <div className="ilha-pipa" />
          </div>
          <button
            type="button"
            className="ilha-voltar"
            data-testid="ilha-voltar-corpo"
            onClick={(event) => {
              event.stopPropagation()
              limparInteracao()
              atlasRef.current = voltarAoCorpo(atlasRef.current)
              sim.current = estadoCena(atlasRef.current)
              cam.current = { x: sim.current.heroi.x, z: sim.current.heroi.z }
              publicar(sim.current)
            }}
          >
            Voltar ao corpo
          </button>
        </div>
      )}
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
