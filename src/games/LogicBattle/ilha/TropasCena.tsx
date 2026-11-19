import { Html } from '@react-three/drei'
import React, { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { PARTIDA } from './partidaPolicies'
import type { PartidaState, Unidade } from './partidaSim'
import { inimigoVisivel } from './partidaSim'

const semRaycast = () => null

interface TropasCenaProps {
  sim: React.MutableRefObject<PartidaState>
  unidades: readonly Unidade[]
  selectedIds: readonly number[]
  unidadesRef: React.MutableRefObject<Map<number, Group>>
  aneisRef: React.MutableRefObject<Map<number, Mesh>>
  corposRef: React.MutableRefObject<Map<string, Mesh>>
  modoBloco: 'adicionar' | 'remover' | null
  modoBlocoRef: React.MutableRefObject<'adicionar' | 'remover' | null>
  deveIgnorarClique?: () => boolean
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
  deveIgnorarClique,
  onUnit,
}) => {
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
              <mesh position={[0, 0.8, 0]} raycast={bloquearClique ? semRaycast : undefined}>
                <boxGeometry args={[1.2, 1.1, 1.4]} />
                <meshStandardMaterial color={corArmadura} />
              </mesh>
            ) : (
              <>
                <mesh position={[0, 0.14, 0]} raycast={bloquearClique ? semRaycast : undefined}>
                  <boxGeometry args={[0.34, 0.28, 0.26]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0, 0.5, 0]} raycast={bloquearClique ? semRaycast : undefined}>
                  <boxGeometry args={[0.42, 0.52, 0.28]} />
                  <meshStandardMaterial color={corArmadura} />
                </mesh>
                <mesh position={[0, 0.9, 0]} raycast={bloquearClique ? semRaycast : undefined}>
                  <sphereGeometry args={[0.17, 10, 10]} />
                  <meshStandardMaterial color={unidade.lado === 'aliado' ? '#fde68a' : '#fca5a5'} />
                </mesh>
                <mesh position={[0, 1.01, 0]} raycast={bloquearClique ? semRaycast : undefined}>
                  <boxGeometry args={[0.36, 0.13, 0.36]} />
                  <meshStandardMaterial
                    color={
                      selecionada ? '#facc15' : unidade.lado === 'aliado' ? '#334155' : '#1f2937'
                    }
                  />
                </mesh>
                <mesh position={[-0.27, 0.5, 0.05]} raycast={bloquearClique ? semRaycast : undefined}>
                  <boxGeometry args={[0.09, 0.38, 0.28]} />
                  <meshStandardMaterial color={unidade.lado === 'aliado' ? '#15803d' : '#7f1d1d'} />
                </mesh>
                <mesh position={[0.27, 0.58, 0.08]} raycast={bloquearClique ? semRaycast : undefined}>
                  <boxGeometry args={[0.07, 0.62, 0.07]} />
                  <meshStandardMaterial color={unidade.lado === 'aliado' ? '#e2e8f0' : '#fda4af'} />
                </mesh>
                {selecionada && (
                  <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={semRaycast}>
                    <ringGeometry args={[0.42, 0.58, 22]} />
                    <meshBasicMaterial color="#facc15" depthWrite={false} />
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
              raycast={bloquearClique ? semRaycast : undefined}
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
