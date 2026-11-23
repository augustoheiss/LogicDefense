import { Html } from '@react-three/drei'
import React, { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, type Group, type Mesh, RingGeometry, SphereGeometry } from 'three'
import { PARTIDA } from './partidaPolicies'
import type { PartidaState, Unidade } from './partidaSim'
import { inimigoVisivel } from './partidaSim'
import { haloDoInimigo, RAIO_DO_HALO } from './haloInimigo'
import { raycastCondicional, semRaycast } from './raycastCena'

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

/** Renderiza cada tropa como soldado distinto com anel de seleção individual e inimigos/dragão. */
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
      dragao: new BoxGeometry(1.2, 1.1, 1.4),
      botas: new BoxGeometry(0.34, 0.28, 0.26),
      torso: new BoxGeometry(0.42, 0.52, 0.28),
      cabeca: new SphereGeometry(0.17, 10, 10),
      elmo: new BoxGeometry(0.36, 0.13, 0.36),
      escudo: new BoxGeometry(0.09, 0.38, 0.28),
      espada: new BoxGeometry(0.07, 0.62, 0.07),
      anelSel: new RingGeometry(0.42, 0.58, 22),
      anelInimigo: new RingGeometry(0.65, 0.83, 24),
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

  return (
    <>
      {unidades.map((unidade) => {
        const selecionada = unidade.lado === 'aliado' && selectedSet.has(unidade.id)
        const corArmadura =
          unidade.lado === 'aliado'
            ? selecionada
              ? '#22c55e'
              : '#16a34a'
            : unidade.papel === 'dragao'
              ? '#7c3aed'
              : unidade.papel === 'sitiante'
                ? '#9f1239'
                : '#e11d48'

        return (
          <group
            key={unidade.id}
            ref={(node) => {
              if (node) unidadesRef.current.set(unidade.id, node)
              else unidadesRef.current.delete(unidade.id)
            }}
            onClick={(event) => lidarCliqueUnidade(event, unidade)}
            onPointerDown={(event) => iniciarRmbInimigo(event, unidade)}
            onPointerUp={(event) => concluirRmbInimigo(event, unidade)}
          >
            {unidade.papel === 'dragao' ? (
              <mesh position={[0, 0.8, 0]} geometry={geos.dragao} castShadow={sombrasAtivas} raycast={raycastCondicional(bloquearClique)}>
                <meshStandardMaterial color={corArmadura} />
              </mesh>
            ) : (
              <>
                <mesh position={[0, 0.14, 0]} geometry={geos.botas} castShadow={sombrasAtivas} raycast={raycastCondicional(bloquearClique)}>
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0, 0.5, 0]} geometry={geos.torso} castShadow={sombrasAtivas} raycast={raycastCondicional(bloquearClique)}>
                  <meshStandardMaterial color={corArmadura} />
                </mesh>
                <mesh position={[0, 0.9, 0]} geometry={geos.cabeca} castShadow={sombrasAtivas} raycast={raycastCondicional(bloquearClique)}>
                  <meshStandardMaterial color={unidade.lado === 'aliado' ? '#fde68a' : '#fca5a5'} />
                </mesh>
                <mesh position={[0, 1.01, 0]} geometry={geos.elmo} castShadow={sombrasAtivas} raycast={raycastCondicional(bloquearClique)}>
                  <meshStandardMaterial
                    color={
                      selecionada ? '#facc15' : unidade.lado === 'aliado' ? '#334155' : '#1f2937'
                    }
                  />
                </mesh>
                <mesh position={[-0.27, 0.5, 0.05]} geometry={geos.escudo} raycast={raycastCondicional(bloquearClique)}>
                  <meshStandardMaterial color={unidade.lado === 'aliado' ? '#15803d' : '#7f1d1d'} />
                </mesh>
                <mesh position={[0.27, 0.58, 0.08]} geometry={geos.espada} raycast={raycastCondicional(bloquearClique)}>
                  <meshStandardMaterial color={unidade.lado === 'aliado' ? '#e2e8f0' : '#fda4af'} />
                </mesh>
                {selecionada && (
                  <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={geos.anelSel} raycast={semRaycast}>
                    <meshBasicMaterial color="#facc15" depthWrite={false} />
                  </mesh>
                )}
                {haloDoInimigo({
                  lado: unidade.lado,
                  hp: unidade.hp,
                  visivel: unidade.lado === 'inimigo' && inimigoVisivel(sim.current, unidade),
                  temSelecao: haloAtivo,
                  modoDeBlocos: bloquearClique,
                }) && (
                  // Halo de clique (pedido do usuário, 22/11): um cilindro INVISÍVEL maior que o corpo (raio `RAIO_DO_HALO`, altura do soldado). `opacity={0}` e NÃO `visible={false}`: o three.js não faz
                  // raycast em malha invisível. Fica no mesmo grupo e herda `onClick`/`onPointerDown`/`onPointerUp`: nenhuma ordem nova, só um alvo maior. `data-halo` para a sonda de navegador achar.
                  <mesh position={[0, 0.9, 0]} userData={{ halo: true }} raycast={raycastCondicional(bloquearClique)}>
                    <cylinderGeometry args={[RAIO_DO_HALO, RAIO_DO_HALO, 1.8, 12]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                  </mesh>
                )}
              </>
            )}
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
              position={[unidade.x, 1.35 + indice * 0.38, unidade.z]}
              ref={(node) => {
                const chave = `${unidade.id}:${numero}`
                if (node) corposRef.current.set(chave, node)
                else corposRef.current.delete(chave)
              }}
              raycast={raycastCondicional(bloquearClique)}
              onClick={(event) => {
                if (modoBlocoRef.current) return
                event.stopPropagation()
                onUnit(unidade.id, unidade.lado, Boolean(event.nativeEvent?.shiftKey))
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
    </>
  )
}
