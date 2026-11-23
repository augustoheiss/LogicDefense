import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  type Group,
  type Mesh,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
} from 'three'
import { haloDoInimigo, RAIO_DO_HALO } from './haloInimigo'
import { PARTIDA } from './partidaPolicies'
import type { PartidaState, Unidade } from './partidaSim'
import { inimigoVisivel } from './partidaSim'
import { raycastCondicional, semRaycast } from './raycastCena'
import { perfilVisualDaUnidade, type PerfilVisualUnidade } from './visual/perfilUnidadeVisual'
import { Y_SOLO_VISUAL } from './visual/suporteFundacao'

interface TropasCenaProps {
  sim: React.MutableRefObject<PartidaState>
  unidades: readonly Unidade[]
  selectedIds: readonly number[]
  unidadesRef: React.MutableRefObject<Map<number, Group>>
  aneisRef: React.MutableRefObject<Map<number, Mesh>>
  corposRef: React.MutableRefObject<Map<string, Mesh>>
  modoBloco: 'adicionar' | 'remover' | null
  modoBlocoRef: React.MutableRefObject<'adicionar' | 'remover' | null>
  sombrasAtivas?: boolean
  deveIgnorarClique?: () => boolean
  /**
   * O jogador tem tropa ou herói selecionados E não está num modo de construção (blocos, linha, consagrar): só então as tropas inimigas ganham o halo de clique (`haloDoInimigo`). Calculado em
   * `IlhaRua` (que conhece os 3 modos e a seleção); aqui só se aplica a regra por tropa (lado, vida, visibilidade).
   */
  haloAtivo?: boolean
  onUnit: (id: number, lado: 'aliado' | 'inimigo', shiftKey?: boolean) => void
}

/** Renderiza tropas aliadas e inimigos com silhuetas distintas, aterradas ao solo e animadas. */
export const TropasCena: React.FC<TropasCenaProps> = ({
  sim,
  unidades,
  selectedIds,
  unidadesRef,
  aneisRef,
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
      sombraContato: new CircleGeometry(0.46, 16),
      botas: new BoxGeometry(0.34, 0.28, 0.28),
      torso: new BoxGeometry(0.44, 0.54, 0.3),
      peitoralLargo: new BoxGeometry(0.62, 0.64, 0.42),
      nucleoFornalha: new OctahedronGeometry(0.14, 0),
      manto: new BoxGeometry(0.38, 0.52, 0.07),
      ombreiraCone: new ConeGeometry(0.16, 0.26, 5),
      cabeca: new SphereGeometry(0.17, 10, 10),
      elmo: new BoxGeometry(0.37, 0.16, 0.37),
      capuz: new ConeGeometry(0.24, 0.34, 6),
      chifre: new ConeGeometry(0.055, 0.24, 5),
      visorOlhos: new BoxGeometry(0.24, 0.06, 0.08),
      penacho: new BoxGeometry(0.08, 0.18, 0.24),
      escudoCavaleiro: new BoxGeometry(0.09, 0.42, 0.3),
      escudoBoss: new SphereGeometry(0.07, 8, 8),
      broquel: new CylinderGeometry(0.22, 0.22, 0.06, 8),
      escudoTorre: new BoxGeometry(0.12, 0.72, 0.46),
      espada: new BoxGeometry(0.07, 0.64, 0.07),
      caboArma: new CylinderGeometry(0.032, 0.032, 0.78, 6),
      laminaMachado: new BoxGeometry(0.06, 0.28, 0.26),
      cabecaMartelo: new BoxGeometry(0.28, 0.24, 0.38),
      anelSel: new RingGeometry(0.44, 0.62, 22),
      anelInimigo: new RingGeometry(0.65, 0.83, 24),
      dragaoCorpo: new BoxGeometry(1.1, 0.72, 1.35),
      dragaoFocinho: new BoxGeometry(0.62, 0.42, 0.7),
      dragaoCrista: new ConeGeometry(0.14, 0.36, 4),
      dragaoAsa: new BoxGeometry(1.15, 0.05, 0.68),
      dragaoGarraAsa: new BoxGeometry(1.22, 0.08, 0.1),
      segDragao: new BoxGeometry(0.85, 0.7, 1.05),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose())
    }
  }, [geos])

  const selectedSet = new Set(selectedIds)
  const bloquearClique = Boolean(modoBloco)
  const rmbInimigoRef = useRef<{ id: number; x: number; y: number; pointerId: number } | null>(null)
  const corposAnimRef = useRef<Map<number, Group>>(new Map())
  const asasEsqRef = useRef<Map<number, Group>>(new Map())
  const asasDirRef = useRef<Map<number, Group>>(new Map())
  const perfisRef = useRef<Map<number, PerfilVisualUnidade>>(new Map())

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
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
    // Impede que o chão abaixo capture rmbDrag e sobrescreva a ordem de ataque com mover.
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

  return (
    <>
      {unidades.map((unidade) => {
        const selecionada = unidade.lado === 'aliado' && selectedSet.has(unidade.id)
        const perfil = perfilVisualDaUnidade(unidade.lado, unidade.papel, selecionada)
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
            {/* Visual aterrado exatamente sobre y = -0.45 mantendo a posição lógica em unidadesRef */}
            <group position={[0, Y_SOLO_VISUAL, 0]}>
              <mesh
                position={[0, 0.015, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[perfil.escala[0] * 1.05, perfil.escala[2] * 1.05, 1]}
                geometry={geos.sombraContato}
                raycast={semRaycast}
              >
                <meshBasicMaterial color="#090d16" transparent opacity={0.28} depthWrite={false} />
              </mesh>

              {selecionada && (
                <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={geos.anelSel} raycast={semRaycast}>
                  <meshBasicMaterial color="#facc15" depthWrite={false} />
                </mesh>
              )}

              <group
                ref={(node) => {
                  if (node) corposAnimRef.current.set(unidade.id, node)
                  else corposAnimRef.current.delete(unidade.id)
                }}
                scale={[perfil.escala[0], perfil.escala[1], perfil.escala[2]]}
              >
                {perfil.arquetipo === 'inimigo_dragao' && (
                  <group position={[0, 0.72, 0]}>
                    {/* Corpo principal da serpe */}
                    <mesh geometry={geos.dragaoCorpo} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial
                        color={perfil.corArmadura}
                        metalness={perfil.metalness}
                        roughness={perfil.roughness}
                      />
                    </mesh>
                    {/* Focinho blindado */}
                    <mesh position={[0, 0.08, 0.85]} geometry={geos.dragaoFocinho} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corDetalhes} roughness={0.45} metalness={0.5} />
                    </mesh>
                    {/* Olhos brilhantes */}
                    <mesh position={[0, 0.2, 1.05]} geometry={geos.visorOlhos} raycast={semRaycast}>
                      <meshStandardMaterial
                        color={perfil.corOlhosEmissive}
                        emissive={perfil.corOlhosEmissive}
                        emissiveIntensity={perfil.intensidadeOlhos}
                      />
                    </mesh>
                    {/* Chifres e crista dorsal */}
                    <mesh position={[-0.26, 0.48, 0.35]} rotation={[-0.55, 0, 0.25]} geometry={geos.chifre} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArma} metalness={0.6} roughness={0.3} />
                    </mesh>
                    <mesh position={[0.26, 0.48, 0.35]} rotation={[-0.55, 0, -0.25]} geometry={geos.chifre} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArma} metalness={0.6} roughness={0.3} />
                    </mesh>
                    <mesh position={[0, 0.48, -0.22]} rotation={[-0.35, 0, 0]} geometry={geos.dragaoCrista} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} roughness={0.35} />
                    </mesh>
                    {/* Asas articuladas */}
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
                )}

                {perfil.arquetipo === 'inimigo_saqueador' && (
                  <>
                    <mesh position={[0, 0.14, 0]} geometry={geos.botas} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#090d16" roughness={0.7} />
                    </mesh>
                    <mesh position={[0, 0.52, 0]} geometry={geos.torso} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmadura} metalness={perfil.metalness} roughness={perfil.roughness} />
                    </mesh>
                    {/* Manto carmesim nas costas */}
                    <mesh position={[0, 0.5, -0.18]} rotation={[0.12, 0, 0]} geometry={geos.manto} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} roughness={0.85} />
                    </mesh>
                    {/* Ombreiras pontudas */}
                    <mesh position={[-0.27, 0.74, 0]} rotation={[0, 0, 0.55]} geometry={geos.ombreiraCone} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} metalness={0.55} roughness={0.38} />
                    </mesh>
                    <mesh position={[0.27, 0.74, 0]} rotation={[0, 0, -0.55]} geometry={geos.ombreiraCone} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} metalness={0.55} roughness={0.38} />
                    </mesh>
                    <mesh position={[0, 0.92, 0]} geometry={geos.cabeca} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#27272a" roughness={0.7} />
                    </mesh>
                    <mesh position={[0, 1.03, 0]} geometry={geos.elmo} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmadura} metalness={0.75} roughness={0.3} />
                    </mesh>
                    {/* Visor com olhos incandescentes + par de chifres */}
                    <mesh position={[0, 0.93, 0.16]} geometry={geos.visorOlhos} raycast={semRaycast}>
                      <meshStandardMaterial
                        color={perfil.corOlhosEmissive}
                        emissive={perfil.corOlhosEmissive}
                        emissiveIntensity={perfil.intensidadeOlhos}
                      />
                    </mesh>
                    <mesh position={[-0.14, 1.16, 0.02]} rotation={[0.15, 0, 0.35]} geometry={geos.chifre} raycast={semRaycast}>
                      <meshStandardMaterial color="#cbd5e1" roughness={0.35} />
                    </mesh>
                    <mesh position={[0.14, 1.16, 0.02]} rotation={[0.15, 0, -0.35]} geometry={geos.chifre} raycast={semRaycast}>
                      <meshStandardMaterial color="#cbd5e1" roughness={0.35} />
                    </mesh>
                    {/* Broquel cravado na mão esquerda */}
                    <group position={[-0.31, 0.52, 0.09]} rotation={[0, 0, Math.PI / 2]}>
                      <mesh geometry={geos.broquel} raycast={rayUnidade}>
                        <meshStandardMaterial color={perfil.corEscudo} metalness={0.5} roughness={0.45} />
                      </mesh>
                      <mesh position={[0, 0.05, 0]} geometry={geos.escudoBoss} raycast={semRaycast}>
                        <meshStandardMaterial color={perfil.corDetalhes} metalness={0.75} roughness={0.3} />
                      </mesh>
                    </group>
                    {/* Machado de combate largo na mão direita */}
                    <group position={[0.31, 0.58, 0.14]} rotation={[0.32, 0, -0.15]}>
                      <mesh geometry={geos.caboArma} raycast={rayUnidade}>
                        <meshStandardMaterial color="#451a03" roughness={0.85} />
                      </mesh>
                      <mesh position={[0, 0.28, 0.1]} geometry={geos.laminaMachado} raycast={rayUnidade}>
                        <meshStandardMaterial color={perfil.corArma} metalness={0.85} roughness={0.22} />
                      </mesh>
                    </group>
                  </>
                )}

                {perfil.arquetipo === 'inimigo_ariete' && (
                  <>
                    <mesh position={[0, 0.15, 0]} geometry={geos.botas} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#090d16" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 0.56, 0]} geometry={geos.peitoralLargo} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmadura} metalness={perfil.metalness} roughness={perfil.roughness} />
                    </mesh>
                    {/* Núcleo de fornalha incandescente no peito */}
                    <mesh position={[0, 0.58, 0.22]} geometry={geos.nucleoFornalha} raycast={semRaycast}>
                      <meshStandardMaterial
                        color="#fb923c"
                        emissive={perfil.corOlhosEmissive}
                        emissiveIntensity={perfil.intensidadeOlhos}
                      />
                    </mesh>
                    <mesh position={[-0.36, 0.84, 0]} rotation={[0, 0, 0.45]} geometry={geos.ombreiraCone} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} metalness={0.7} roughness={0.35} />
                    </mesh>
                    <mesh position={[0.36, 0.84, 0]} rotation={[0, 0, -0.45]} geometry={geos.ombreiraCone} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} metalness={0.7} roughness={0.35} />
                    </mesh>
                    <mesh position={[0, 0.99, 0]} geometry={geos.cabeca} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#18181b" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 1.09, 0]} geometry={geos.elmo} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} metalness={0.75} roughness={0.28} />
                    </mesh>
                    <mesh position={[0, 1.0, 0.17]} geometry={geos.visorOlhos} raycast={semRaycast}>
                      <meshStandardMaterial
                        color={perfil.corOlhosEmissive}
                        emissive={perfil.corOlhosEmissive}
                        emissiveIntensity={perfil.intensidadeOlhos}
                      />
                    </mesh>
                    <mesh position={[-0.17, 1.24, 0]} rotation={[0, 0, 0.45]} geometry={geos.chifre} raycast={semRaycast}>
                      <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.35} />
                    </mesh>
                    <mesh position={[0.17, 1.24, 0]} rotation={[0, 0, -0.45]} geometry={geos.chifre} raycast={semRaycast}>
                      <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.35} />
                    </mesh>
                    {/* Escudo-torre maciço */}
                    <mesh position={[-0.4, 0.56, 0.12]} geometry={geos.escudoTorre} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corEscudo} metalness={0.65} roughness={0.38} />
                    </mesh>
                    {/* Martelo de cerco */}
                    <group position={[0.4, 0.64, 0.15]} rotation={[0.25, 0, -0.1]}>
                      <mesh geometry={geos.caboArma} raycast={rayUnidade}>
                        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.4} />
                      </mesh>
                      <mesh position={[0, 0.34, 0]} geometry={geos.cabecaMartelo} raycast={rayUnidade}>
                        <meshStandardMaterial color={perfil.corArma} metalness={0.8} roughness={0.28} />
                      </mesh>
                    </group>
                  </>
                )}

                {perfil.arquetipo === 'inimigo_batedor' && (
                  <>
                    <mesh position={[0, 0.14, 0]} geometry={geos.botas} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#090d16" roughness={0.7} />
                    </mesh>
                    <mesh position={[0, 0.5, 0]} geometry={geos.torso} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmadura} roughness={perfil.roughness} />
                    </mesh>
                    <mesh position={[0, 0.5, -0.17]} rotation={[0.18, 0, 0]} geometry={geos.manto} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} roughness={0.85} />
                    </mesh>
                    <mesh position={[0, 0.9, 0]} geometry={geos.cabeca} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#18181b" roughness={0.75} />
                    </mesh>
                    <mesh position={[0, 1.04, -0.02]} rotation={[-0.18, 0, 0]} geometry={geos.capuz} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} roughness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.9, 0.16]} geometry={geos.visorOlhos} raycast={semRaycast}>
                      <meshStandardMaterial
                        color={perfil.corOlhosEmissive}
                        emissive={perfil.corOlhosEmissive}
                        emissiveIntensity={perfil.intensidadeOlhos}
                      />
                    </mesh>
                    <mesh position={[0.28, 0.56, 0.12]} rotation={[0.45, 0, 0]} geometry={geos.espada} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArma} metalness={0.7} roughness={0.3} />
                    </mesh>
                  </>
                )}

                {perfil.arquetipo === 'aliado_cavaleiro' && (
                  <>
                    <mesh position={[0, 0.14, 0]} geometry={geos.botas} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#0f172a" roughness={0.65} />
                    </mesh>
                    <mesh position={[0, 0.5, 0]} geometry={geos.torso} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmadura} metalness={perfil.metalness} roughness={perfil.roughness} />
                    </mesh>
                    <mesh position={[0, 0.9, 0]} geometry={geos.cabeca} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color="#fde68a" roughness={0.55} />
                    </mesh>
                    <mesh position={[0, 1.01, 0]} geometry={geos.elmo} castShadow={sombrasAtivas} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArmaduraSecundaria} metalness={0.65} roughness={0.32} />
                    </mesh>
                    <mesh position={[0, 1.15, -0.02]} geometry={geos.penacho} raycast={semRaycast}>
                      <meshStandardMaterial color={perfil.corDetalhes} roughness={0.45} />
                    </mesh>
                    <group position={[-0.27, 0.5, 0.06]}>
                      <mesh geometry={geos.escudoCavaleiro} raycast={rayUnidade}>
                        <meshStandardMaterial color={perfil.corEscudo} metalness={0.4} roughness={0.45} />
                      </mesh>
                      <mesh position={[-0.04, 0, 0]} geometry={geos.escudoBoss} raycast={semRaycast}>
                        <meshStandardMaterial color="#facc15" metalness={0.7} roughness={0.25} />
                      </mesh>
                    </group>
                    <mesh position={[0.27, 0.58, 0.09]} rotation={[0.18, 0, 0]} geometry={geos.espada} raycast={rayUnidade}>
                      <meshStandardMaterial color={perfil.corArma} metalness={0.82} roughness={0.22} />
                    </mesh>
                  </>
                )}
              </group>

              {perfil.arquetipo !== 'inimigo_dragao' &&
                haloDoInimigo({
                  lado: unidade.lado,
                  hp: unidade.hp,
                  visivel: unidade.lado === 'inimigo' && inimigoVisivel(sim.current, unidade),
                  temSelecao: haloAtivo,
                  modoDeBlocos: bloquearClique,
                }) && (
                  // Halo de clique (pedido do usuário, 22/11): um cilindro INVISÍVEL maior que o corpo (raio `RAIO_DO_HALO`, altura do soldado). `opacity={0}` e NÃO `visible={false}`: o three.js não faz
                  // raycast em malha invisível. Fica no mesmo grupo e herda `onClick`/`onPointerDown`/`onPointerUp`: nenhuma ordem nova, só um alvo maior.
                  <mesh position={[0, 0.9, 0]} userData={{ halo: true }} raycast={rayUnidade}>
                    <cylinderGeometry args={[RAIO_DO_HALO, RAIO_DO_HALO, 1.8, 12]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                  </mesh>
                )}
            </group>
          </group>
        )
      })}
      {unidades
        .filter((unidade) => unidade.lado === 'inimigo')
        .map((unidade) => (
          <mesh
            key={`anel-${unidade.id}`}
            ref={(node) => {
              if (node) aneisRef.current.set(unidade.id, node)
              else aneisRef.current.delete(unidade.id)
            }}
            visible={false}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={semRaycast}
          >
            <ringGeometry args={[0.65, 0.83, 24]} />
            <meshBasicMaterial color="#facc15" depthWrite={false} />
          </mesh>
        ))}
      {unidades
        .filter((unidade) => unidade.papel === 'dragao' && inimigoVisivel(sim.current, unidade))
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
