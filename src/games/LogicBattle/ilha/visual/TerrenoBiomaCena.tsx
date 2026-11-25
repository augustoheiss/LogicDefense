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
  /**
   * Decide se o marco de fronteira em `(x, z)` pode aparecer. AUSENTE = todos aparecem, como sempre (I1). Com a névoa pintada ligada a cena passa `chaoRevelado`: os marcos a ±54,8 m eram
   * escondidos «de graça» pelas colunas cinza, e sem elas revelariam as bordas do quadrado antes de o jogador chegar lá (visto na foto de 24/11: dois pontos pretos no horizonte).
   */
  readonly marcoVisivel?: (x: number, z: number) => boolean
  readonly sombrasAtivas: boolean
  /**
   * Sem o PLANO principal do chão (F2, 25/11/2026): com o relevo ligado o chão é a malha do `TerrenoRelevoCena`, e os marcos de fronteira continuam vindo daqui. AUSENTE = `false` = o terreno de hoje (I1),
   * com o plano em −0,45.
   */
  readonly semPlano?: boolean
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
  marcoVisivel,
  sombrasAtivas,
  semPlano = false,
  onPointerDown,
  onClick,
}) => {
  const cat = BIOMA_VISUAL_CATALOG[bioma]

  const matKey = texturas ? `pbr-${texturas.bioma}-${texturas.resolucao}` : `solid-${bioma}`

  return (
    <group name="terreno-bioma">
      {/* Plano principal interativo (preserva exatamente y = -0.45 e eventos de clique/arrasto) */}
      {!semPlano && (
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

      )}

      {/* Marcos rúnicos discretos nas fronteiras do quadrado */}
      {MARCOS_FRONTEIRA.map(([bx, bz], idx) => [bx, bz, idx] as const).filter(([bx, bz]) => !marcoVisivel || marcoVisivel(bx, bz)).map(([bx, bz, idx]) => (
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
