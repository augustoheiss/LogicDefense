import React, { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, Uint32BufferAttribute } from 'three'
import { type BiomaId, corDoChaoBioma } from '../biomaRecursos'
import { semRaycast } from '../raycastCena'
import { geometriaDoHorizonte } from '../relevo/geometriaDoHorizonte'
import { alturaDeBaseDoMundo } from '../relevo/geradorRelevo'
import { passoDaMalha } from '../relevo/geometriaDoTerreno'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import { Y_SOLO_VISUAL } from './suporteFundacao'

/**
 * O HORIZONTE DO RELEVO (F2, Task 8, 26/11/2026): um ANEL de terra em volta do quadrado, de 56 m (a borda) até 104 m do centro, para o terreno NÃO acabar numa borda reta (a foto da serra em terceira pessoa mostrava o morro
 * terminando numa faixa lisa até o céu). A altura é a do mundo PURO (`alturaDeBaseDoMundo`, sem lagoa e sem rio: existe em QUALQUER ponto, sem gerar os 8 campos dos vizinhos). A perspectiva atmosférica vem do `scene.fog` que o
 * `AtmosferaBioma` já liga (um `MeshStandardMaterial` participa do fog sozinho): o anel desbota para `fogCor` ao longe e some no `fogFar`. SÓ desenho: não recebe clique (`raycast={semRaycast}`) e não projeta sombra.
 * A primeira fileira usa o passo da MALHA da qualidade em uso (1 m Ultra, 2 m Bonito, 4 m Leve): é com ele que a emenda com o terreno fecha (vão ≤ 1e-4; com o passo errado abre 5–15 cm).
 */
export interface HorizonteRelevoProps {
  readonly bioma: BiomaId
  /** O quadrado (as coordenadas do anel são LOCAIS a ele). */
  readonly i: number
  readonly j: number
  readonly spec: SpecQualidadeGrafica
}

export const HorizonteRelevo: React.FC<HorizonteRelevoProps> = ({ bioma, i, j, spec }) => {
  const passo = passoDaMalha(spec.efetiva)
  const geometria = useMemo(() => {
    const g = geometriaDoHorizonte(alturaDeBaseDoMundo, { i, j }, passo)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(g.posicoes, 3))
    geo.setAttribute('uv', new Float32BufferAttribute(g.uvs, 2))
    geo.setIndex(new Uint32BufferAttribute(g.indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [i, j, passo])
  const material = useMemo(() => new MeshStandardMaterial({ color: corDoChaoBioma(bioma), roughness: 0.95, metalness: 0.02 }), [bioma])
  useEffect(() => {
    return () => {
      geometria.dispose()
    }
  }, [geometria])
  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])
  return <mesh name="horizonte-relevo" geometry={geometria} material={material} position={[0, Y_SOLO_VISUAL, 0]} raycast={semRaycast} />
}
