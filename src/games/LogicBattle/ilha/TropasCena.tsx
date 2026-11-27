import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type Group,
  type InstancedMesh,
  type Mesh,
  Object3D,
  RingGeometry,
  SphereGeometry,
} from 'three'
import { haloDoInimigo, RAIO_DO_HALO } from './haloInimigo'
import { PARTIDA } from './partidaPolicies'
import { desnivelDoAtor } from './relevo/alturaDoAtor'
import { elevacaoDaLinha, elevacaoDoAnel } from './relevo/segmentosDaPatrulha'
import type { ChaoDoDesenho } from './relevo/alturaVisual'
import type { PartidaState, Unidade } from './partidaSim'
import { inimigoVisivel } from './partidaSim'
import { raycastCondicional, semRaycast } from './raycastCena'
import { perfilVisualDaUnidade, type PerfilVisualUnidade } from './visual/perfilUnidadeVisual'
import { Y_SOLO_VISUAL } from './visual/suporteFundacao'

const MAX_TROPAS_INSTANCIADAS = 64

interface TropasCenaProps {
  sim: React.MutableRefObject<PartidaState>
  unidades: readonly Unidade[]
  selectedIds: readonly number[]
  unidadesRef: React.MutableRefObject<Map<number, Group>>
  /**
   * O campo do relevo do quadrado (F2, Task 5), por REF e lido no `useFrame`: a tropa ANDA, e a ref que a `Cena` já mantém só guarda um campo com a chave LIGADA e pronto. OPCIONAL: sem ela, ou com `undefined`, o desnível é +0 exato e o jogo é o de hoje (I1).
   */
  campoRef?: React.MutableRefObject<ChaoDoDesenho | undefined>
  corposRef: React.MutableRefObject<Map<string, Mesh>>
  modoBloco: 'adicionar' | 'remover' | null
  modoBlocoRef: React.MutableRefObject<'adicionar' | 'remover' | null>
  sombrasAtivas?: boolean
  deveIgnorarClique?: () => boolean
  /**
   * O jogador tem tropa ou herói selecionados E não está num modo de construção (blocos, linha, consagrar): só então as tropas inimigas ganham o halo de clique (`haloDoInimigo`).
   */
  haloAtivo?: boolean
  onUnit: (id: number, lado: 'aliado' | 'inimigo', shiftKey?: boolean) => void
}

/**
 * Renderiza tropas aliadas e inimigas normais via GPU Instancing (~9 draw calls fixos mesmo com 24+ tropas)
 * mantendo os Dragões em malhas articuladas dedicadas.
 */
export const TropasCena: React.FC<TropasCenaProps> = ({
  sim,
  unidades,
  selectedIds,
  unidadesRef,
  campoRef,
  corposRef,
  modoBloco,
  modoBlocoRef,
  sombrasAtivas = false,
  deveIgnorarClique,
  haloAtivo = false,
  onUnit,
}) => {
  const geos = useMemo(
    () => ({
      sombraContato: new CircleGeometry(0.46, 14),
      botas: new BoxGeometry(0.34, 0.28, 0.28),
      torso: new BoxGeometry(0.44, 0.54, 0.3),
      cabeca: new SphereGeometry(0.17, 10, 8),
      elmo: new BoxGeometry(0.37, 0.18, 0.37),
      escudo: new BoxGeometry(0.09, 0.44, 0.32),
      arma: new BoxGeometry(0.08, 0.68, 0.08),
      anelSel: new RingGeometry(0.44, 0.62, 18),
      hitbox: new CylinderGeometry(0.48, 0.48, 1.8, 10),
      chifre: new ConeGeometry(0.055, 0.24, 5),
      visorOlhos: new BoxGeometry(0.24, 0.06, 0.08),
      dragaoCorpo: new BoxGeometry(1.1, 0.72, 1.35),
      dragaoFocinho: new BoxGeometry(0.62, 0.42, 0.7),
      dragaoCrista: new ConeGeometry(0.14, 0.36, 4),
      dragaoAsa: new BoxGeometry(1.15, 0.05, 0.68),
      dragaoGarraAsa: new BoxGeometry(1.22, 0.08, 0.1),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose())
    }
  }, [geos])

  const selectedRef = useRef(new Set(selectedIds))
  selectedRef.current = new Set(selectedIds)
  const haloAtivoRef = useRef(haloAtivo)
  haloAtivoRef.current = haloAtivo

  const bloquearClique = Boolean(modoBloco)
  const rmbInimigoRef = useRef<{ id: number; x: number; y: number; pointerId: number } | null>(null)
  const corposAnimRef = useRef<Map<number, Group>>(new Map())
  const asasEsqRef = useRef<Map<number, Group>>(new Map())
  const asasDirRef = useRef<Map<number, Group>>(new Map())
  const perfisRef = useRef<Map<number, PerfilVisualUnidade>>(new Map())

  const instBotasRef = useRef<InstancedMesh | null>(null)
  const instTorsoRef = useRef<InstancedMesh | null>(null)
  const instCabecaRef = useRef<InstancedMesh | null>(null)
  const instElmoRef = useRef<InstancedMesh | null>(null)
  const instEscudoRef = useRef<InstancedMesh | null>(null)
  const instArmaRef = useRef<InstancedMesh | null>(null)
  const instAnelRef = useRef<InstancedMesh | null>(null)
  const instSombraRef = useRef<InstancedMesh | null>(null)
  const instHitboxRef = useRef<InstancedMesh | null>(null)

  const instanciaUnidadesRef = useRef<Unidade[]>([])
  const dummyRef = useRef(new Object3D())
  const corTempRef = useRef(new Color('#ffffff'))

  useEffect(() => {
    const meshes = [
      instBotasRef.current,
      instTorsoRef.current,
      instCabecaRef.current,
      instElmoRef.current,
      instEscudoRef.current,
      instArmaRef.current,
    ]
    const branca = new Color('#ffffff')
    meshes.forEach((m) => {
      if (!m) return
      for (let i = 0; i < MAX_TROPAS_INSTANCIADAS; i += 1) {
        m.setColorAt(i, branca)
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.count = 0
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const state = sim.current
    const olharDesenho = state.posse ? state.posse.modo : state.semCorpo ? 'imperio' : state.olhar
    const dummy = dummyRef.current
    const cor = corTempRef.current
    const selSet = selectedRef.current
    const haloLigado = haloAtivoRef.current
    const bloqueio = Boolean(modoBlocoRef.current)

    // Atualiza instâncias para todas as unidades não-dragão
    let n = 0
    const listaMapeada = instanciaUnidadesRef.current
    for (const unidade of state.unidades) {
      if (unidade.papel === 'dragao' || unidade.hp <= 0) continue
      const possuidaAgora = Boolean(state.posse && state.posse.unidadeId === unidade.id)
      const ocultaPosse = possuidaAgora && olharDesenho === 'primeira'
      if (ocultaPosse) continue
      if (unidade.lado === 'inimigo' && !inimigoVisivel(state, unidade)) continue
      if (n >= MAX_TROPAS_INSTANCIADAS) break

      const selecionada = unidade.lado === 'aliado' && selSet.has(unidade.id)
      const perfil = perfilVisualDaUnidade(unidade.lado, unidade.papel, selecionada)
      const fase = t * perfil.frequenciaMarcha + unidade.id * 1.13
      const marchY = Math.abs(Math.sin(fase)) * perfil.amplitudeMarcha
      // O chão da tropa (a MALHA que o GPU desenha, por REF) lido UMA vez por tropa por quadro: o `baseY` e a elevação dos DOIS discos horizontais (a sombra e o anel) usam a MESMA leitura.
      const chaoDaTropa = campoRef?.current
      const baseY = Y_SOLO_VISUAL + (possuidaAgora && state.posse ? state.posse.y : 0) + desnivelDoAtor(chaoDaTropa, unidade.x, unidade.z, possuidaAgora && state.posse ? state.posse.y : 0)

      let yaw = 0
      if (possuidaAgora && state.posse) {
        yaw = -state.posse.yaw
      } else if (unidade.ordem?.tipo === 'mover') {
        const dx = unidade.ordem.x - unidade.x
        const dz = unidade.ordem.z - unidade.z
        if (Math.hypot(dx, dz) > 0.1) yaw = Math.atan2(dx, dz)
      } else if (unidade.ordem?.tipo === 'attackMove') {
        const dx = unidade.ordem.x - unidade.x
        const dz = unidade.ordem.z - unidade.z
        if (Math.hypot(dx, dz) > 0.1) yaw = Math.atan2(dx, dz)
      }

      const sx = perfil.escala[0]
      const sy = perfil.escala[1]
      const sz = perfil.escala[2]
      const cosY = Math.cos(yaw)
      const sinY = Math.sin(yaw)

      const porLocal = (lx: number, ly: number, lz: number, rx = 0, ry = 0, rz = 0, ex = 1, ey = 1, ez = 1) => {
        const wx = unidade.x + (lx * cosY + lz * sinY) * sx
        const wz = unidade.z + (-lx * sinY + lz * cosY) * sz
        const wy = baseY + (ly + marchY) * sy
        dummy.position.set(wx, wy, wz)
        dummy.rotation.set(rx, yaw + ry, rz)
        dummy.scale.set(sx * ex, sy * ey, sz * ez)
        dummy.updateMatrix()
      }

      // 1. Sombra de contato (sem marchY)
      dummy.position.set(unidade.x, baseY + 0.015 + elevacaoDaLinha(chaoDaTropa), unidade.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.set(sx * 1.05, sz * 1.05, 1)
      dummy.updateMatrix()
      instSombraRef.current?.setMatrixAt(n, dummy.matrix)

      // 2. Anel de seleção
      dummy.position.set(unidade.x, baseY + 0.025 + elevacaoDoAnel(chaoDaTropa), unidade.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      if (selecionada) dummy.scale.set(1, 1, 1)
      else dummy.scale.set(0, 0, 0)
      dummy.updateMatrix()
      instAnelRef.current?.setMatrixAt(n, dummy.matrix)

      // 3. Botas
      porLocal(0, 0.14, 0)
      instBotasRef.current?.setMatrixAt(n, dummy.matrix)
      cor.set(unidade.lado === 'aliado' ? '#0f172a' : '#090d16')
      instBotasRef.current?.setColorAt(n, cor)

      // 4. Torso (diferencia Soldado/Arqueiro/Lanceiro por cor sutil)
      porLocal(0, 0.5, 0, 0, 0, Math.sin(fase * 0.5) * 0.045, unidade.papel === 'sitiante' ? 1.25 : 1, 1, 1)
      instTorsoRef.current?.setMatrixAt(n, dummy.matrix)
      if (unidade.lado === 'aliado') {
        if (unidade.tipoTropa === 'arqueiro') cor.set(selecionada ? '#38bdf8' : '#0284c7')
        else if (unidade.tipoTropa === 'lanceiro') cor.set(selecionada ? '#c084fc' : '#7e22ce')
        else cor.set(perfil.corArmadura)
      } else {
        cor.set(perfil.corArmadura)
      }
      instTorsoRef.current?.setColorAt(n, cor)

      // 5. Cabeça
      porLocal(0, 0.9, 0)
      instCabecaRef.current?.setMatrixAt(n, dummy.matrix)
      cor.set(unidade.lado === 'aliado' ? '#fde68a' : '#18181b')
      instCabecaRef.current?.setColorAt(n, cor)

      // 6. Elmo / Capuz
      porLocal(0, 1.02, 0, 0, 0, 0, 1, unidade.papel === 'isca' ? 1.3 : 1, 1)
      instElmoRef.current?.setMatrixAt(n, dummy.matrix)
      cor.set(perfil.corArmaduraSecundaria)
      instElmoRef.current?.setColorAt(n, cor)

      // 7. Escudo (Soldado e Sitiante têm escudo visível; demais escala 0)
      const usaEscudo = unidade.lado === 'aliado' ? (unidade.tipoTropa ?? 'soldado') === 'soldado' : unidade.papel === 'sitiante'
      if (usaEscudo) {
        porLocal(-0.27, 0.5, 0.06, 0, 0, 0, 1, unidade.papel === 'sitiante' ? 1.35 : 1, unidade.papel === 'sitiante' ? 1.2 : 1)
      } else {
        dummy.position.set(unidade.x, baseY, unidade.z)
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
      }
      instEscudoRef.current?.setMatrixAt(n, dummy.matrix)
      cor.set(perfil.corEscudo)
      instEscudoRef.current?.setColorAt(n, cor)

      // 8. Arma (Lança maior para Lanceiro, Arco curvo/vertical para Arqueiro, Espada para Soldado)
      const ehLanceiro = unidade.lado === 'aliado' && unidade.tipoTropa === 'lanceiro'
      const ehArqueiro = unidade.lado === 'aliado' && unidade.tipoTropa === 'arqueiro'
      porLocal(
        0.27,
        ehLanceiro ? 0.78 : 0.58,
        ehLanceiro ? 0.16 : 0.09,
        ehLanceiro ? 0.45 : 0.18,
        0,
        0,
        ehArqueiro ? 0.85 : 1,
        ehLanceiro ? 1.9 : ehArqueiro ? 1.35 : 1,
        ehArqueiro ? 1.5 : 1,
      )
      instArmaRef.current?.setMatrixAt(n, dummy.matrix)
      cor.set(ehArqueiro ? '#d97706' : ehLanceiro ? '#cbd5e1' : perfil.corArma)
      instArmaRef.current?.setColorAt(n, cor)

      // 9. Hitbox de clique (inclui Halo ampliado do inimigo quando haloAtivo)
      const usarHalo = haloDoInimigo({
        lado: unidade.lado,
        hp: unidade.hp,
        visivel: unidade.lado === 'inimigo',
        temSelecao: haloLigado,
        modoDeBlocos: bloqueio,
      })
      const escalaHalo = usarHalo ? RAIO_DO_HALO / 0.48 : 1
      dummy.position.set(unidade.x, baseY + 0.9, unidade.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(escalaHalo, 1, escalaHalo)
      dummy.updateMatrix()
      instHitboxRef.current?.setMatrixAt(n, dummy.matrix)

      listaMapeada[n] = unidade
      n += 1
    }
    listaMapeada.length = n

    const allInstanced = [
      instSombraRef.current,
      instAnelRef.current,
      instBotasRef.current,
      instTorsoRef.current,
      instCabecaRef.current,
      instElmoRef.current,
      instEscudoRef.current,
      instArmaRef.current,
      instHitboxRef.current,
    ]
    allInstanced.forEach((m) => {
      if (!m) return
      m.count = n
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })

    // Animação dedicada de Dragões
    corposAnimRef.current.forEach((grupo, id) => {
      const perfil = perfisRef.current.get(id)
      if (!perfil) return
      const fase = t * perfil.frequenciaMarcha + id * 1.13
      grupo.position.y = Math.abs(Math.sin(fase)) * perfil.amplitudeMarcha
      grupo.rotation.z = Math.sin(fase * 0.5) * 0.045
      if (perfil.arquetipo === 'inimigo_dragao') {
        const asaE = asasEsqRef.current.get(id)
        const asaD = asasDirRef.current.get(id)
        const bater = Math.sin(t * 7.2 + id * 0.9) * 0.38
        if (asaE) asaE.rotation.z = bater + 0.18
        if (asaD) asaD.rotation.z = -bater - 0.18
      }
    })
  })

  const lidarCliqueUnidade = (
    event: { stopPropagation: () => void; nativeEvent?: MouseEvent },
    unidade: Unidade,
  ) => {
    if (modoBlocoRef.current) return
    if (deveIgnorarClique?.()) return
    const atual = sim.current
    const item = atual.unidades.find((u) => u.id === unidade.id)
    if (!item || item.hp <= 0 || (item.lado === 'inimigo' && !inimigoVisivel(atual, item))) return
    event.stopPropagation()
    onUnit(unidade.id, unidade.lado, Boolean(event.nativeEvent?.shiftKey))
  }

  const iniciarRmbInimigo = (
    event: { stopPropagation: () => void; clientX: number; clientY: number; pointerId: number; nativeEvent: PointerEvent },
    unidade: Unidade,
  ) => {
    if (modoBlocoRef.current || event.nativeEvent.button !== 2 || unidade.lado !== 'inimigo') return
    const atual = sim.current
    const item = atual.unidades.find((u) => u.id === unidade.id)
    if (!item || item.hp <= 0 || !inimigoVisivel(atual, item)) return
    event.stopPropagation()
    rmbInimigoRef.current = { id: unidade.id, x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  }

  const concluirRmbInimigo = (
    event: { stopPropagation: () => void; clientX: number; clientY: number; pointerId: number; nativeEvent: PointerEvent },
    unidade: Unidade,
  ) => {
    if (modoBlocoRef.current || event.nativeEvent.button !== 2 || unidade.lado !== 'inimigo') return
    const inicio = rmbInimigoRef.current
    rmbInimigoRef.current = null
    if (!inicio || inicio.id !== unidade.id || inicio.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - inicio.x, event.clientY - inicio.y) > PARTIDA.limiarArrastoRmbPx) return
    const atual = sim.current
    const item = atual.unidades.find((u) => u.id === unidade.id)
    if (!item || item.hp <= 0 || !inimigoVisivel(atual, item)) return
    event.stopPropagation()
    onUnit(unidade.id, 'inimigo', false)
  }

  const rayUnidade = raycastCondicional(bloquearClique)
  const dragoes = unidades.filter((u) => u.papel === 'dragao')

  return (
    <>
      <instancedMesh ref={instSombraRef} args={[geos.sombraContato, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} raycast={semRaycast}>
        <meshBasicMaterial color="#090d16" transparent opacity={0.28} depthWrite={false} />
      </instancedMesh>
      {/* O ANEL de seleção é OPACO e, com o relevo LIGADO, a névoa pintada (renderOrder 4, transparente) o cobria: ele NUNCA aparecia (foto `12-comparacao-anel.png`). Só com o relevo ligado é desenhado depois dela; sem relevo é 0, o de hoje (I1). */}
      <instancedMesh ref={instAnelRef} args={[geos.anelSel, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} raycast={semRaycast} renderOrder={PARTIDA.relevo.visual ? 5 : 0}>
        <meshBasicMaterial color="#facc15" depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={instBotasRef} args={[geos.botas, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} castShadow={sombrasAtivas} raycast={semRaycast}>
        <meshStandardMaterial color="#ffffff" roughness={0.68} />
      </instancedMesh>
      <instancedMesh ref={instTorsoRef} args={[geos.torso, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} castShadow={sombrasAtivas} raycast={semRaycast}>
        <meshStandardMaterial color="#ffffff" metalness={0.45} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={instCabecaRef} args={[geos.cabeca, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} castShadow={sombrasAtivas} raycast={semRaycast}>
        <meshStandardMaterial color="#ffffff" roughness={0.58} />
      </instancedMesh>
      <instancedMesh ref={instElmoRef} args={[geos.elmo, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} castShadow={sombrasAtivas} raycast={semRaycast}>
        <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={instEscudoRef} args={[geos.escudo, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} raycast={semRaycast}>
        <meshStandardMaterial color="#ffffff" metalness={0.45} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={instArmaRef} args={[geos.arma, undefined, MAX_TROPAS_INSTANCIADAS]} frustumCulled={false} raycast={semRaycast}>
        <meshStandardMaterial color="#ffffff" metalness={0.78} roughness={0.25} />
      </instancedMesh>
      <instancedMesh
        ref={instHitboxRef}
        args={[geos.hitbox, undefined, MAX_TROPAS_INSTANCIADAS]}
        frustumCulled={false}
        raycast={rayUnidade}
        onClick={(event) => {
          const idx = event.instanceId
          const unidade = idx !== undefined ? instanciaUnidadesRef.current[idx] : undefined
          if (unidade) lidarCliqueUnidade(event, unidade)
        }}
        onPointerDown={(event) => {
          const idx = event.instanceId
          const unidade = idx !== undefined ? instanciaUnidadesRef.current[idx] : undefined
          if (unidade) iniciarRmbInimigo(event, unidade)
        }}
        onPointerUp={(event) => {
          const idx = event.instanceId
          const unidade = idx !== undefined ? instanciaUnidadesRef.current[idx] : undefined
          if (unidade) concluirRmbInimigo(event, unidade)
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {dragoes.map((unidade) => {
        const perfil = perfilVisualDaUnidade(unidade.lado, unidade.papel, false)
        perfisRef.current.set(unidade.id, perfil)
        return (
          <group
            key={unidade.id}
            ref={(node) => {
              if (node) unidadesRef.current.set(unidade.id, node)
              else {
                unidadesRef.current.delete(unidade.id)
                perfisRef.current.delete(unidade.id)
              }
            }}
            onClick={(event) => lidarCliqueUnidade(event, unidade)}
            onPointerDown={(event) => iniciarRmbInimigo(event, unidade)}
            onPointerUp={(event) => concluirRmbInimigo(event, unidade)}
          >
            <group position={[0, Y_SOLO_VISUAL, 0]}>
              <group
                ref={(node) => {
                  if (node) corposAnimRef.current.set(unidade.id, node)
                  else corposAnimRef.current.delete(unidade.id)
                }}
                scale={[perfil.escala[0], perfil.escala[1], perfil.escala[2]]}
              >
                <group position={[0, 0.72, 0]}>
                  <mesh geometry={geos.dragaoCorpo} castShadow={sombrasAtivas} raycast={rayUnidade}>
                    <meshStandardMaterial color={perfil.corArmadura} metalness={perfil.metalness} roughness={perfil.roughness} />
                  </mesh>
                  <mesh position={[0, 0.08, 0.85]} geometry={geos.dragaoFocinho} castShadow={sombrasAtivas} raycast={rayUnidade}>
                    <meshStandardMaterial color={perfil.corDetalhes} roughness={0.45} metalness={0.5} />
                  </mesh>
                  <mesh position={[0, 0.2, 1.05]} geometry={geos.visorOlhos} raycast={semRaycast}>
                    <meshStandardMaterial
                      color={perfil.corOlhosEmissive}
                      emissive={perfil.corOlhosEmissive}
                      emissiveIntensity={perfil.intensidadeOlhos}
                    />
                  </mesh>
                  <mesh position={[-0.26, 0.48, 0.35]} rotation={[-0.55, 0, 0.25]} geometry={geos.chifre} raycast={semRaycast}>
                    <meshStandardMaterial color={perfil.corArma} metalness={0.6} roughness={0.3} />
                  </mesh>
                  <mesh position={[0.26, 0.48, 0.35]} rotation={[-0.55, 0, -0.25]} geometry={geos.chifre} raycast={semRaycast}>
                    <meshStandardMaterial color={perfil.corArma} metalness={0.6} roughness={0.3} />
                  </mesh>
                  <mesh position={[0, 0.48, -0.22]} rotation={[-0.35, 0, 0]} geometry={geos.dragaoCrista} raycast={semRaycast}>
                    <meshStandardMaterial color={perfil.corArmaduraSecundaria} roughness={0.35} />
                  </mesh>
                  <group
                    position={[-0.52, 0.22, 0]}
                    ref={(node) => {
                      if (node) asasEsqRef.current.set(unidade.id, node)
                      else asasEsqRef.current.delete(unidade.id)
                    }}
                  >
                    <mesh position={[-0.55, 0, -0.06]} geometry={geos.dragaoAsa} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corEscudo} roughness={0.6} />
                    </mesh>
                    <mesh position={[-0.55, 0.04, 0.26]} geometry={geos.dragaoGarraAsa} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corDetalhes} metalness={0.5} roughness={0.4} />
                    </mesh>
                  </group>
                  <group
                    position={[0.52, 0.22, 0]}
                    ref={(node) => {
                      if (node) asasDirRef.current.set(unidade.id, node)
                      else asasDirRef.current.delete(unidade.id)
                    }}
                  >
                    <mesh position={[0.55, 0, -0.06]} geometry={geos.dragaoAsa} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corEscudo} roughness={0.6} />
                    </mesh>
                    <mesh position={[0.55, 0.04, 0.26]} geometry={geos.dragaoGarraAsa} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corDetalhes} metalness={0.5} roughness={0.4} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          </group>
        )
      })}
      {dragoes
        .filter((unidade) => inimigoVisivel(sim.current, unidade))
        .flatMap((unidade) =>
          unidade.segmentos.map((numero, indice) => (
            <mesh
              key={`${unidade.id}-${numero}`}
              position={[unidade.x, 0.95 + indice * 0.36, unidade.z]}
              ref={(node) => {
                const chave = `${unidade.id}:${numero}`
                if (node) corposRef.current.set(chave, node)
                else corposRef.current.delete(chave)
              }}
              raycast={rayUnidade}
              onClick={(event) => {
                if (modoBlocoRef.current) return
                event.stopPropagation()
                onUnit(unidade.id, unidade.lado, Boolean(event.nativeEvent?.shiftKey))
              }}
            >
              <boxGeometry args={[0.85, 0.7, 1.05]} />
              <meshStandardMaterial color="#581c87" metalness={0.45} roughness={0.38} />
              <Html center sprite style={{ pointerEvents: 'none' }} zIndexRange={[1, 0]}>
                <div className="ilha-numero" data-testid={`ilha-dragao-${numero}`}>
                  {numero}
                </div>
              </Html>
            </mesh>
          )),
        )}
    </>
  )
}
