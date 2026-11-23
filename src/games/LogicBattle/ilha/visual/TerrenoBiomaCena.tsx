import type { ThreeEvent } from '@react-three/fiber'
import React from 'react'
import { corDoChaoBioma, type BiomaId } from '../biomaRecursos'
import { PARTIDA } from '../partidaPolicies'
import { semRaycast } from '../raycastCena'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import type { PacoteTexturasBioma } from './texturasPbrProcedural'

export interface TerrenoBiomaCenaProps {
  readonly bioma: BiomaId
  readonly texturas: PacoteTexturasBioma | null
  readonly mostrarEstrada: boolean
  readonly sombrasAtivas: boolean
  readonly onPointerDown: (event: ThreeEvent<PointerEvent>) => void
  readonly onClick: (event: ThreeEvent<MouseEvent>) => void
}

const MARCOS_FRONTEIRA: readonly [number, number][] = [
  [-54.8, -54.8],
  [54.8, -54.8],
  [-54.8, 54.8],
  [54.8, 54.8],
  [0, -54.8],
  [0, 54.8],
  [-54.8, 0],
  [54.8, 0],
]

export const TerrenoBiomaCena: React.FC<TerrenoBiomaCenaProps> = ({
  bioma,
  texturas,
  mostrarEstrada,
  sombrasAtivas,
  onPointerDown,
  onClick,
}) => {
  const cat = BIOMA_VISUAL_CATALOG[bioma]

  const matKey = texturas ? `pbr-${texturas.bioma}-${texturas.resolucao}` : `solid-${bioma}`

  return (
    <group name="terreno-bioma">
      {/* Plano principal interativo (preserva exatamente y = -0.45 e eventos de clique/arrasto) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.45, 0]}
        receiveShadow={sombrasAtivas}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <planeGeometry args={[PARTIDA.ladoMapa, PARTIDA.ladoMapa]} />
        <meshStandardMaterial
          key={`solo-${matKey}`}
          color={texturas ? '#ffffff' : corDoChaoBioma(bioma)}
          map={texturas?.solo.map ?? null}
          normalMap={texturas?.solo.normalMap ?? null}
          roughnessMap={texturas?.solo.roughnessMap ?? null}
          roughness={texturas ? 1 : 0.92}
          metalness={0.04}
        />
      </mesh>

      {/* Estrada antiga de pedra lavrada + meio-fio + praça inicial (apenas visual, semRaycast) */}
      {mostrarEstrada && (
        <group>
          <mesh position={[0, -0.35, 20]} receiveShadow={sombrasAtivas} raycast={semRaycast}>
            <boxGeometry args={[8, 0.2, 42]} />
            <meshStandardMaterial
              key={`est-${matKey}`}
              color={texturas ? '#ffffff' : cat.estradaCorBase}
              map={texturas?.estrada.map ?? null}
              normalMap={texturas?.estrada.normalMap ?? null}
              roughnessMap={texturas?.estrada.roughnessMap ?? null}
              roughness={0.86}
              metalness={0.06}
            />
          </mesh>
          {/* Meio-fios laterais da estrada */}
          {([-4.12, 4.12] as const).map((mx) => (
            <mesh key={`guia-${mx}`} position={[mx, -0.31, 20]} receiveShadow={sombrasAtivas} raycast={semRaycast}>
              <boxGeometry args={[0.28, 0.28, 42.2]} />
              <meshStandardMaterial
                key={`guia-mat-${mx}-${matKey}`}
                color={cat.estradaCorRejunte}
                normalMap={texturas?.rocha.normalMap ?? null}
                roughness={0.88}
              />
            </mesh>
          ))}
          {/* Praça circular de nascimento em (0, 0) */}
          <mesh position={[0, -0.42, 0]} receiveShadow={sombrasAtivas} raycast={semRaycast}>
            <cylinderGeometry args={[3.4, 3.65, 0.08, 24]} />
            <meshStandardMaterial
              key={`praca-${matKey}`}
              color={texturas ? '#e2e8f0' : cat.estradaCorBase}
              map={texturas?.estrada.map ?? null}
              normalMap={texturas?.estrada.normalMap ?? null}
              roughness={0.84}
            />
          </mesh>
        </group>
      )}

      {/* Marcos rúnicos discretos nas fronteiras do quadrado */}
      {MARCOS_FRONTEIRA.map(([bx, bz], idx) => (
        <group key={`marco-${idx}`} position={[bx, -0.45, bz]}>
          <mesh position={[0, 0.45, 0]} castShadow={sombrasAtivas} raycast={semRaycast}>
            <boxGeometry args={[0.42, 0.9, 0.42]} />
            <meshStandardMaterial
              key={`marco-mat-${idx}-${matKey}`}
              color={cat.rochaCor}
              map={texturas?.rocha.map ?? null}
              normalMap={texturas?.rocha.normalMap ?? null}
              roughness={0.85}
            />
          </mesh>
          <mesh position={[0, 0.98, 0]} raycast={semRaycast}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial
              color={cat.ouroCor}
              emissive={cat.ouroEmissivo}
              emissiveIntensity={0.4}
              roughness={0.25}
              metalness={0.65}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
