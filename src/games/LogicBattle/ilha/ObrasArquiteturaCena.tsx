import type { ThreeEvent } from '@react-three/fiber'
import React, { useLayoutEffect, useMemo, useRef } from 'react'
import type { Group, InstancedMesh } from 'three'
import { Object3D } from 'three'
import { centroBlocoMundo, indiceVoxelLocal, VOXEL_NV5 } from './biomaRecursos'
import {
  BlocoMaterial,
  BlocoMundo,
  blocoMundoParaCentro,
  MapaBlocos,
  PASSO_BLOCO_MUNDO,
  PlanoLinhaBlocos,
  SPEC_BLOCO_MATERIAL,
} from './blocosMundo'
import { DIMENSOES_OBRA, PARTIDA, PecaId } from './partidaPolicies'
import { chaoRevelado, cobertoAgora, Obra, obraEmConstrucao, PartidaState } from './partidaSim'
import { raycastCondicional, semRaycast } from './raycastCena'
import { alturaSapataMuralha, Y_SOLO_VISUAL } from './visual/suporteFundacao'
import type { PacoteTexturasBlocos } from './visual/texturasPbrProcedural'

const MAX_BLOCOS_INST = 1024
const MAX_VOXEIS_NV5_INST = 2048
const MAX_PREVIEW_LINHA = 256

export interface IndiceVoxelNv5 {
  obraId: number
  bx: number
  by: number
  bz: number
  lado: 'nosso' | 'inimigo'
  centro: { x: number; y: number; z: number }
}

export interface IndiceBlocoMundo {
  gx: number
  gy: number
  gz: number
  material: BlocoMaterial
  lado: 'nosso' | 'inimigo'
  obraId?: number
  centro: { x: number; y: number; z: number }
}

const MATERIAIS_BLOCO: readonly BlocoMaterial[] = ['madeira', 'pedra', 'ouro']

export const BlocosMundoInstanced: React.FC<{
  blocosMapa: MapaBlocos
  versaoSolidos: number
  versaoChao: number
  state: PartidaState
  groupRef?: React.RefObject<Group | null>
  texturasBlocos?: PacoteTexturasBlocos | null
  sombrasAtivas?: boolean
}> = ({ blocosMapa, versaoSolidos, versaoChao, state, groupRef, texturasBlocos = null, sombrasAtivas = false }) => {
  const refs = useRef<Record<BlocoMaterial, InstancedMesh | null>>({
    madeira: null,
    pedra: null,
    ouro: null,
  })
  const sapataRef = useRef<InstancedMesh | null>(null)
  const molde = useMemo(() => new Object3D(), [])
  const sapata = useMemo(() => alturaSapataMuralha(), [])

  useLayoutEffect(() => {
    const porMat: Record<BlocoMaterial, IndiceBlocoMundo[]> = {
      madeira: [],
      pedra: [],
      ouro: [],
    }
    const basesTerreo: IndiceBlocoMundo[] = []
    const lista = Object.values(blocosMapa)
    for (const b of lista) {
      if (b.hp <= 0) continue
      if (PARTIDA.nuvem && !chaoRevelado(state, b.x, b.z)) continue
      const bucket = porMat[b.material]
      if (bucket.length >= MAX_BLOCOS_INST) continue
      const centro = blocoMundoParaCentro(b.x, b.y, b.z)
      const item: IndiceBlocoMundo = {
        gx: b.x,
        gy: b.y,
        gz: b.z,
        material: b.material,
        lado: b.lado,
        centro,
      }
      bucket.push(item)
      if (b.y === 0 && basesTerreo.length < MAX_BLOCOS_INST) basesTerreo.push(item)
    }

    for (const mat of MATERIAIS_BLOCO) {
      const mesh = refs.current[mat]
      if (!mesh) continue
      const itens = porMat[mat]
      for (let i = 0; i < itens.length; i += 1) {
        const c = itens[i].centro
        molde.position.set(c.x, c.y, c.z)
        molde.scale.set(1, 1, 1)
        molde.updateMatrix()
        mesh.setMatrixAt(i, molde.matrix)
      }
      mesh.count = itens.length
      mesh.userData.blocoMundoIndices = itens
      mesh.instanceMatrix.needsUpdate = true
      if (itens.length > 0) mesh.computeBoundingSphere()
    }

    const meshSapata = sapataRef.current
    if (meshSapata) {
      for (let i = 0; i < basesTerreo.length; i += 1) {
        const c = basesTerreo[i].centro
        molde.position.set(c.x, sapata.centroY, c.z)
        molde.scale.set(1, 1, 1)
        molde.updateMatrix()
        meshSapata.setMatrixAt(i, molde.matrix)
      }
      meshSapata.count = basesTerreo.length
      meshSapata.instanceMatrix.needsUpdate = true
      if (basesTerreo.length > 0) meshSapata.computeBoundingSphere()
    }
  }, [blocosMapa, versaoSolidos, versaoChao, molde, state, sapata.centroY])

  const texSapata = texturasBlocos?.fundacaoPedra
  return (
    <group ref={groupRef} name="blocos-mundo">
      <instancedMesh
        ref={sapataRef}
        args={[undefined, undefined, MAX_BLOCOS_INST]}
        receiveShadow={sombrasAtivas}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <boxGeometry args={[PASSO_BLOCO_MUNDO * 1.06, sapata.altura, PASSO_BLOCO_MUNDO * 1.06]} />
        <meshStandardMaterial
          key={`sapata-mundo-${texSapata ? 'pbr' : 'solid'}-${texturasBlocos?.resolucao ?? 0}`}
          color={texSapata ? '#cbd5e1' : '#94a3b8'}
          map={texSapata?.map ?? null}
          normalMap={texSapata?.normalMap ?? null}
          roughnessMap={texSapata?.roughnessMap ?? null}
          roughness={0.88}
          metalness={0.06}
        />
      </instancedMesh>
      {MATERIAIS_BLOCO.map((mat) => {
        const spec = SPEC_BLOCO_MATERIAL[mat]
        const trio = texturasBlocos?.[mat]
        return (
          <instancedMesh
            key={mat}
            ref={(node) => {
              refs.current[mat] = node
            }}
            args={[undefined, undefined, MAX_BLOCOS_INST]}
            castShadow={sombrasAtivas}
            receiveShadow={sombrasAtivas}
            frustumCulled={false}
          >
            <boxGeometry args={[PASSO_BLOCO_MUNDO * 0.98, PASSO_BLOCO_MUNDO * 0.98, PASSO_BLOCO_MUNDO * 0.98]} />
            <meshStandardMaterial
              key={`bloco-${mat}-${trio ? 'pbr' : 'solid'}-${texturasBlocos?.resolucao ?? 0}`}
              color={trio ? '#ffffff' : spec.cor}
              map={trio?.map ?? null}
              normalMap={trio?.normalMap ?? null}
              roughnessMap={trio?.roughnessMap ?? null}
              roughness={mat === 'ouro' ? 0.3 : mat === 'pedra' ? 0.85 : 0.78}
              metalness={mat === 'ouro' ? 0.68 : 0.08}
            />
          </instancedMesh>
        )
      })}
    </group>
  )
}

export const ObrasLivresInstanced: React.FC<{
  state: PartidaState
  versaoSolidos: number
  versaoChao: number
  groupRef?: React.RefObject<Group | null>
  texturasBlocos?: PacoteTexturasBlocos | null
  sombrasAtivas?: boolean
  bloqueiaCliqueObra?: boolean
  onSelectObra?: (obraId: number, lado: 'nosso' | 'inimigo', button: number) => void
  /** O ponteiro tocou esta obra (antes do `click`): quem decide se o container deve atirar é `IlhaRua`. */
  /** Devolve `true` para a malha parar a propagação do raycast (obra inimiga à frente: nada atrás captura o clique, OBS-F2-5). */
  onTocarObra?: (obraId: number, pointerId: number, button: number) => boolean | void
}> = ({ state, versaoSolidos, versaoChao, groupRef, texturasBlocos = null, sombrasAtivas = false, bloqueiaCliqueObra, onSelectObra, onTocarObra }) => {
  const refs = useRef<Record<BlocoMaterial, InstancedMesh | null>>({
    madeira: null,
    pedra: null,
    ouro: null,
  })
  const sapataRef = useRef<InstancedMesh | null>(null)
  const molde = useMemo(() => new Object3D(), [])
  const sapata = useMemo(() => alturaSapataMuralha(), [])

  useLayoutEffect(() => {
    const porMat: Record<BlocoMaterial, IndiceBlocoMundo[]> = {
      madeira: [],
      pedra: [],
      ouro: [],
    }
    const basesTerreo: IndiceBlocoMundo[] = []
    for (const obra of state.obras) {
      const livres = (obra as Obra & { blocosLivres?: readonly BlocoMundo[] }).blocosLivres
      if (!livres || livres.length === 0 || obra.hp <= 0 || obraEmConstrucao(obra)) continue
      if (obra.lado === 'inimigo' && PARTIDA.nuvem && !cobertoAgora(state, obra.x, obra.z)) continue
      for (const b of livres) {
        if (b.hp <= 0) continue
        const bucket = porMat[b.material]
        if (bucket.length >= MAX_BLOCOS_INST) continue
        const centro = blocoMundoParaCentro(b.x, b.y, b.z)
        const item: IndiceBlocoMundo = {
          gx: b.x,
          gy: b.y,
          gz: b.z,
          material: b.material,
          lado: obra.lado,
          obraId: obra.id,
          centro,
        }
        bucket.push(item)
        if (b.y === 0 && basesTerreo.length < MAX_BLOCOS_INST) basesTerreo.push(item)
      }
    }

    for (const mat of MATERIAIS_BLOCO) {
      const mesh = refs.current[mat]
      if (!mesh) continue
      const itens = porMat[mat]
      for (let i = 0; i < itens.length; i += 1) {
        const c = itens[i].centro
        molde.position.set(c.x, c.y, c.z)
        molde.scale.set(1, 1, 1)
        molde.updateMatrix()
        mesh.setMatrixAt(i, molde.matrix)
      }
      mesh.count = itens.length
      mesh.userData.blocoObraLivreIndices = itens
      mesh.instanceMatrix.needsUpdate = true
      if (itens.length > 0) mesh.computeBoundingSphere()
    }

    const meshSapata = sapataRef.current
    if (meshSapata) {
      for (let i = 0; i < basesTerreo.length; i += 1) {
        const c = basesTerreo[i].centro
        molde.position.set(c.x, sapata.centroY, c.z)
        molde.scale.set(1, 1, 1)
        molde.updateMatrix()
        meshSapata.setMatrixAt(i, molde.matrix)
      }
      meshSapata.count = basesTerreo.length
      meshSapata.instanceMatrix.needsUpdate = true
      if (basesTerreo.length > 0) meshSapata.computeBoundingSphere()
    }
  }, [state, versaoSolidos, versaoChao, molde, sapata.centroY])

  const texSapata = texturasBlocos?.fundacaoPedra
  return (
    <group ref={groupRef} name="obras-livres">
      <instancedMesh
        ref={sapataRef}
        args={[undefined, undefined, MAX_BLOCOS_INST]}
        receiveShadow={sombrasAtivas}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <boxGeometry args={[PASSO_BLOCO_MUNDO * 1.06, sapata.altura, PASSO_BLOCO_MUNDO * 1.06]} />
        <meshStandardMaterial
          key={`sapata-livre-${texSapata ? 'pbr' : 'solid'}-${texturasBlocos?.resolucao ?? 0}`}
          color={texSapata ? '#cbd5e1' : '#94a3b8'}
          map={texSapata?.map ?? null}
          normalMap={texSapata?.normalMap ?? null}
          roughnessMap={texSapata?.roughnessMap ?? null}
          roughness={0.88}
          metalness={0.06}
        />
      </instancedMesh>
      {MATERIAIS_BLOCO.map((mat) => {
        const spec = SPEC_BLOCO_MATERIAL[mat]
        const trio = texturasBlocos?.[mat]
        return (
          <instancedMesh
            key={`livre-${mat}`}
            ref={(node) => {
              refs.current[mat] = node
            }}
            args={[undefined, undefined, MAX_BLOCOS_INST]}
            castShadow={sombrasAtivas}
            receiveShadow={sombrasAtivas}
            frustumCulled={false}
            onPointerDown={(event) => {
              if (bloqueiaCliqueObra || !onTocarObra) return
              const lista = event.object.userData?.blocoObraLivreIndices as IndiceBlocoMundo[] | undefined
              const meta = event.instanceId !== undefined && lista ? lista[event.instanceId] : undefined
              if (!meta || meta.obraId === undefined) return
              if (onTocarObra(meta.obraId, event.pointerId, event.nativeEvent.button)) event.stopPropagation()
            }}
            onPointerUp={(event) => {
              if (bloqueiaCliqueObra || !onSelectObra || event.nativeEvent.button !== 2) return
              const lista = event.object.userData?.blocoObraLivreIndices as IndiceBlocoMundo[] | undefined
              const meta = event.instanceId !== undefined && lista ? lista[event.instanceId] : undefined
              if (!meta || meta.obraId === undefined || meta.lado !== 'inimigo') return
              event.stopPropagation()
              onSelectObra(meta.obraId, meta.lado, 2)
            }}
            onClick={(event) => {
              if (bloqueiaCliqueObra || !onSelectObra) return
              const lista = event.object.userData?.blocoObraLivreIndices as IndiceBlocoMundo[] | undefined
              const meta = event.instanceId !== undefined && lista ? lista[event.instanceId] : undefined
              if (!meta || meta.obraId === undefined) return
              event.stopPropagation()
              onSelectObra(meta.obraId, meta.lado, event.nativeEvent.button)
            }}
          >
            <boxGeometry args={[PASSO_BLOCO_MUNDO * 0.98, PASSO_BLOCO_MUNDO * 0.98, PASSO_BLOCO_MUNDO * 0.98]} />
            <meshStandardMaterial
              key={`livre-${mat}-${trio ? 'pbr' : 'solid'}-${texturasBlocos?.resolucao ?? 0}`}
              color={trio ? '#ffffff' : spec.cor}
              map={trio?.map ?? null}
              normalMap={trio?.normalMap ?? null}
              roughnessMap={trio?.roughnessMap ?? null}
              emissive={mat === 'ouro' ? '#854d0e' : '#0f172a'}
              emissiveIntensity={0.12}
              roughness={mat === 'ouro' ? 0.28 : 0.75}
              metalness={mat === 'ouro' ? 0.65 : 0.12}
            />
          </instancedMesh>
        )
      })}
    </group>
  )
}

type TomNv5 = 'pedra' | 'madeira' | 'coroa'
const TONS_NV5: readonly { id: TomNv5; cor: string }[] = [
  { id: 'pedra', cor: '#cbd5e1' },
  { id: 'madeira', cor: '#d97706' },
  { id: 'coroa', cor: '#facc15' },
]

export const ObrasNv5Instanced: React.FC<{
  state: PartidaState
  versaoSolidos: number
  versaoChao: number
  groupRef?: React.RefObject<Group | null>
  texturasBlocos?: PacoteTexturasBlocos | null
  sombrasAtivas?: boolean
  bloqueiaCliqueObra?: boolean
  onSelectObra?: (obraId: number, lado: 'nosso' | 'inimigo', button: number) => void
  /** O ponteiro tocou esta obra (antes do `click`): quem decide se o container deve atirar é `IlhaRua`. */
  /** Devolve `true` para a malha parar a propagação do raycast (obra inimiga à frente: nada atrás captura o clique, OBS-F2-5). */
  onTocarObra?: (obraId: number, pointerId: number, button: number) => boolean | void
}> = ({ state, versaoSolidos, versaoChao, groupRef, texturasBlocos = null, sombrasAtivas = false, bloqueiaCliqueObra, onSelectObra, onTocarObra }) => {
  const refs = useRef<Record<TomNv5, InstancedMesh | null>>({
    pedra: null,
    madeira: null,
    coroa: null,
  })
  const molde = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const buckets: Record<TomNv5, IndiceVoxelNv5[]> = {
      pedra: [],
      madeira: [],
      coroa: [],
    }
    const { nx, ny, nz } = VOXEL_NV5
    for (const obra of state.obras) {
      const blocos = obra.blocosNv5
      if (!blocos || obra.hp <= 0 || obraEmConstrucao(obra)) continue
      if (obra.lado === 'inimigo' && PARTIDA.nuvem && !cobertoAgora(state, obra.x, obra.z)) continue
      for (let by = 0; by < ny; by += 1) {
        for (let bz = 0; bz < nz; bz += 1) {
          for (let bx = 0; bx < nx; bx += 1) {
            const val = blocos[indiceVoxelLocal(bx, by, bz)]
            if (val === 0) continue
            const tom: TomNv5 = val === 2 ? 'madeira' : by === 4 ? 'coroa' : 'pedra'
            const lista = buckets[tom]
            if (lista.length >= MAX_VOXEIS_NV5_INST) continue
            const centro = centroBlocoMundo(obra.x, obra.z, bx, by, bz)
            lista.push({ obraId: obra.id, bx, by, bz, lado: obra.lado, centro })
          }
        }
      }
    }

    for (const { id } of TONS_NV5) {
      const mesh = refs.current[id]
      if (!mesh) continue
      const itens = buckets[id]
      for (let i = 0; i < itens.length; i += 1) {
        const c = itens[i].centro
        molde.position.set(c.x, c.y, c.z)
        molde.scale.set(1, 1, 1)
        molde.updateMatrix()
        mesh.setMatrixAt(i, molde.matrix)
      }
      mesh.count = itens.length
      mesh.userData.voxelNv5Indices = itens
      mesh.instanceMatrix.needsUpdate = true
      if (itens.length > 0) mesh.computeBoundingSphere()
    }
  }, [state, versaoSolidos, versaoChao, molde])

  return (
    <group ref={groupRef} name="voxeis-nv5">
      {TONS_NV5.map(({ id, cor }) => {
        const trio = id === 'madeira' ? texturasBlocos?.madeira : id === 'coroa' ? texturasBlocos?.ouro : texturasBlocos?.pedra
        return (
        <instancedMesh
          key={id}
          ref={(node) => {
            refs.current[id] = node
          }}
          args={[undefined, undefined, MAX_VOXEIS_NV5_INST]}
          castShadow={sombrasAtivas}
          receiveShadow={sombrasAtivas}
          frustumCulled={false}
          onPointerDown={(event) => {
            if (bloqueiaCliqueObra || !onTocarObra) return
            const lista = event.object.userData?.voxelNv5Indices as IndiceVoxelNv5[] | undefined
            const meta = event.instanceId !== undefined && lista ? lista[event.instanceId] : undefined
            if (!meta) return
            if (onTocarObra(meta.obraId, event.pointerId, event.nativeEvent.button)) event.stopPropagation()
          }}
          onPointerUp={(event) => {
            // Botão direito sobre uma obra INIMIGA Nv5: ordem de ataque, como nas outras duas malhas. Sem este handler o
            // `pointerdown` já para a propagação (OBS-F2-5) e o clique direito não chegava a lugar nenhum: antes caía no
            // chão e virava `mover`, errado; depois do OBS-F2-5 sumia (OBS-F2-6, achado do T2).
            if (bloqueiaCliqueObra || !onSelectObra || event.nativeEvent.button !== 2) return
            const lista = event.object.userData?.voxelNv5Indices as IndiceVoxelNv5[] | undefined
            const meta = event.instanceId !== undefined && lista ? lista[event.instanceId] : undefined
            if (!meta || meta.lado !== 'inimigo') return
            event.stopPropagation()
            onSelectObra(meta.obraId, meta.lado, 2)
          }}
          onClick={(event) => {
            if (bloqueiaCliqueObra || !onSelectObra) return
            const lista = event.object.userData?.voxelNv5Indices as IndiceVoxelNv5[] | undefined
            const meta = event.instanceId !== undefined && lista ? lista[event.instanceId] : undefined
            if (!meta) return
            event.stopPropagation()
            onSelectObra(meta.obraId, meta.lado, event.nativeEvent.button)
          }}
        >
          <boxGeometry args={[VOXEL_NV5.passo * 0.98, VOXEL_NV5.passo * 0.98, VOXEL_NV5.passo * 0.98]} />
          <meshStandardMaterial
            key={`nv5-${id}-${trio ? 'pbr' : 'solid'}-${texturasBlocos?.resolucao ?? 0}`}
            color={trio ? '#ffffff' : cor}
            map={trio?.map ?? null}
            normalMap={trio?.normalMap ?? null}
            roughnessMap={trio?.roughnessMap ?? null}
            roughness={0.74}
            metalness={id === 'coroa' ? 0.55 : 0.08}
          />
        </instancedMesh>
        )
      })}
    </group>
  )
}

export const PreviewLinhaBlocos: React.FC<{
  plano: PlanoLinhaBlocos | null
  temRecurso: boolean
}> = ({ plano, temRecurso }) => {
  const meshRef = useRef<InstancedMesh>(null)
  const wireRef = useRef<InstancedMesh>(null)
  const baseRef = useRef<InstancedMesh>(null)
  const molde = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const celulas = plano?.celulas ?? []
    const qtd = Math.min(celulas.length, MAX_PREVIEW_LINHA)
    for (const alvo of [meshRef.current, wireRef.current]) {
      if (!alvo) continue
      for (let i = 0; i < qtd; i += 1) {
        const c = blocoMundoParaCentro(celulas[i].x, celulas[i].y, celulas[i].z)
        molde.position.set(c.x, c.y, c.z)
        molde.scale.set(1, 1, 1)
        molde.updateMatrix()
        alvo.setMatrixAt(i, molde.matrix)
      }
      alvo.count = qtd
      alvo.instanceMatrix.needsUpdate = true
    }

    const alvoBase = baseRef.current
    if (alvoBase) {
      let nb = 0
      for (let i = 0; i < qtd && nb < MAX_PREVIEW_LINHA; i += 1) {
        if (celulas[i].y !== 0) continue
        const c = blocoMundoParaCentro(celulas[i].x, 0, celulas[i].z)
        molde.position.set(c.x, Y_SOLO_VISUAL + 0.225, c.z)
        molde.scale.set(1, 1, 1)
        molde.updateMatrix()
        alvoBase.setMatrixAt(nb++, molde.matrix)
      }
      alvoBase.count = nb
      alvoBase.instanceMatrix.needsUpdate = true
    }
  }, [plano, molde])

  if (!plano || plano.celulas.length === 0) return null

  return (
    <group name="preview-linha-blocos">
      <instancedMesh
        ref={baseRef}
        args={[undefined, undefined, MAX_PREVIEW_LINHA]}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <boxGeometry args={[PASSO_BLOCO_MUNDO * 1.02, 0.45, PASSO_BLOCO_MUNDO * 1.02]} />
        <meshBasicMaterial
          color={temRecurso ? '#0ea5e9' : '#dc2626'}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_PREVIEW_LINHA]}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <boxGeometry args={[PASSO_BLOCO_MUNDO * 0.96, PASSO_BLOCO_MUNDO * 0.96, PASSO_BLOCO_MUNDO * 0.96]} />
        <meshBasicMaterial
          color={temRecurso ? '#22d3ee' : '#ef4444'}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={wireRef}
        args={[undefined, undefined, MAX_PREVIEW_LINHA]}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <boxGeometry args={[PASSO_BLOCO_MUNDO * 1.01, PASSO_BLOCO_MUNDO * 1.01, PASSO_BLOCO_MUNDO * 1.01]} />
        <meshBasicMaterial
          color={temRecurso ? '#e0f2fe' : '#fecaca'}
          wireframe
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  )
}

function SilhuetaPeca({
  tipo,
  nivel,
  corBase,
  corDetalhe,
  corTelhado,
  transparente = false,
  opacidade = 1,
  semColisaoRay = false,
}: {
  tipo: PecaId
  nivel: number
  corBase: string
  corDetalhe: string
  corTelhado: string
  transparente?: boolean
  opacidade?: number
  semColisaoRay?: boolean
}) {
  // `raycastCondicional`, nunca `undefined`: o R3F ignora `undefined` e a malha ficava sem clique para sempre (F2-D7).
  const ray = raycastCondicional(Boolean(semColisaoRay))
  const matProps = transparente
    ? { transparent: true, opacity: opacidade, depthWrite: false }
    : { roughness: 0.72 }
  const bonusAltura = Math.min(3, Math.max(0, nivel - 1)) * 0.24

  if (tipo === 'nucleo') {
    return (
      <group>
        {/* Base da cidadela */}
        <mesh position={[0, 0.75 + bonusAltura * 0.35, 0]} raycast={ray}>
          <boxGeometry args={[2.0, 1.5 + bonusAltura * 0.7, 2.0]} />
          <meshStandardMaterial color={corBase} {...matProps} />
        </mesh>
        {/* 4 torretas de canto */}
        {([-0.82, 0.82] as const).map((cx) =>
          ([-0.82, 0.82] as const).map((cz) => (
            <mesh key={`${cx}-${cz}`} position={[cx, 0.95 + bonusAltura * 0.55, cz]} raycast={ray}>
              <boxGeometry args={[0.48, 1.9 + bonusAltura, 0.48]} />
              <meshStandardMaterial color={corDetalhe} {...matProps} />
            </mesh>
          )),
        )}
        {/* Pináculo central / coroa conforme nível */}
        <mesh position={[0, 1.8 + bonusAltura * 0.9, 0]} raycast={ray}>
          <coneGeometry args={[0.68, 0.75 + bonusAltura * 0.4, 4]} />
          <meshStandardMaterial color={corTelhado} {...matProps} />
        </mesh>
        {nivel >= 3 && (
          <mesh position={[0, 2.35 + bonusAltura, 0]} raycast={ray}>
            <octahedronGeometry args={[0.24, 0]} />
            <meshStandardMaterial color="#fef08a" emissive="#ca8a04" emissiveIntensity={0.45} {...matProps} />
          </mesh>
        )}
      </group>
    )
  }

  if (tipo === 'torre') {
    const hCorpo = 2.0 + bonusAltura * 1.15
    return (
      <group>
        {/* Pedestal largo */}
        <mesh position={[0, 0.22, 0]} raycast={ray}>
          <boxGeometry args={[1.38, 0.44, 1.38]} />
          <meshStandardMaterial color={corDetalhe} {...matProps} />
        </mesh>
        {/* Corpo cilíndrico/prismático alto */}
        <mesh position={[0, hCorpo / 2 + 0.2, 0]} raycast={ray}>
          <cylinderGeometry args={[0.52, 0.64, hCorpo, 8]} />
          <meshStandardMaterial color={corBase} {...matProps} />
        </mesh>
        {/* Mirante de coroa no topo */}
        <mesh position={[0, hCorpo + 0.32, 0]} raycast={ray}>
          <boxGeometry args={[1.32, 0.32, 1.32]} />
          <meshStandardMaterial color={corDetalhe} {...matProps} />
        </mesh>
        {/* Ameias / telhado */}
        {nivel >= 2 ? (
          <mesh position={[0, hCorpo + 0.72, 0]} raycast={ray}>
            <coneGeometry args={[0.78, 0.68, 8]} />
            <meshStandardMaterial color={corTelhado} {...matProps} />
          </mesh>
        ) : (
          <mesh position={[0, hCorpo + 0.56, 0]} raycast={ray}>
            <boxGeometry args={[0.92, 0.18, 0.92]} />
            <meshStandardMaterial color={corTelhado} {...matProps} />
          </mesh>
        )}
      </group>
    )
  }

  if (tipo === 'portao') {
    const hPilar = 2.05 + bonusAltura * 0.65
    return (
      <group>
        {/* Pilares gêmeos com vão central livre */}
        <mesh position={[-1.02, hPilar / 2, 0]} raycast={ray}>
          <boxGeometry args={[0.52, hPilar, 0.62]} />
          <meshStandardMaterial color={corBase} {...matProps} />
        </mesh>
        <mesh position={[1.02, hPilar / 2, 0]} raycast={ray}>
          <boxGeometry args={[0.52, hPilar, 0.62]} />
          <meshStandardMaterial color={corBase} {...matProps} />
        </mesh>
        {/* Viga superior do arco */}
        <mesh position={[0, hPilar + 0.16, 0]} raycast={ray}>
          <boxGeometry args={[2.68, 0.42, 0.72]} />
          <meshStandardMaterial color={corDetalhe} {...matProps} />
        </mesh>
        {/* Brasão / coroa no topo */}
        <mesh position={[0, hPilar + 0.52, 0]} raycast={ray}>
          <boxGeometry args={[1.1 + nivel * 0.16, 0.34, 0.46]} />
          <meshStandardMaterial color={corTelhado} {...matProps} />
        </mesh>
      </group>
    )
  }

  if (tipo === 'quartel') {
    return (
      <group>
        {/* Salão militar */}
        <mesh position={[0, 0.68 + bonusAltura * 0.3, 0]} raycast={ray}>
          <boxGeometry args={[2.05, 1.36 + bonusAltura * 0.6, 1.9]} />
          <meshStandardMaterial color={corBase} {...matProps} />
        </mesh>
        {/* Telhado de duas águas (prisma 4 faces rotacionado) */}
        <mesh position={[0, 1.62 + bonusAltura * 0.65, 0]} rotation={[0, Math.PI / 4, 0]} raycast={ray}>
          <coneGeometry args={[1.55, 0.68 + bonusAltura * 0.25, 4]} />
          <meshStandardMaterial color={corTelhado} {...matProps} />
        </mesh>
        {/* Escudo / estandarte frontal */}
        <mesh position={[0, 0.85, 0.99]} raycast={ray}>
          <boxGeometry args={[0.62, 0.74, 0.08]} />
          <meshStandardMaterial color={corDetalhe} {...matProps} />
        </mesh>
        {nivel >= 2 && (
          <mesh position={[0.78, 1.9 + bonusAltura * 0.7, 0.72]} raycast={ray}>
            <cylinderGeometry args={[0.04, 0.04, 1.1, 6]} />
            <meshStandardMaterial color="#e2e8f0" {...matProps} />
          </mesh>
        )}
      </group>
    )
  }

  if (tipo === 'britador') {
    return (
      <group>
        {/* Base de pedra industrial */}
        <mesh position={[0, 0.55, 0]} raycast={ray}>
          <boxGeometry args={[2.0, 1.1, 2.0]} />
          <meshStandardMaterial color={corBase} {...matProps} />
        </mesh>
        {/* Tambor/moinho de trituração */}
        <mesh position={[0, 1.3 + bonusAltura * 0.35, 0]} rotation={[0, 0, Math.PI / 2]} raycast={ray}>
          <cylinderGeometry args={[0.52, 0.52, 1.3, 10]} />
          <meshStandardMaterial color={corDetalhe} {...matProps} />
        </mesh>
        {/* Chaminé lateral */}
        <mesh position={[0.68, 1.45 + bonusAltura * 0.7, -0.62]} raycast={ray}>
          <cylinderGeometry args={[0.2, 0.26, 1.3 + bonusAltura * 0.9, 8]} />
          <meshStandardMaterial color={corTelhado} {...matProps} />
        </mesh>
      </group>
    )
  }

  if (tipo === 'serraria') {
    return (
      <group>
        {/* Galpão de madeira */}
        <mesh position={[0, 0.6, 0]} raycast={ray}>
          <boxGeometry args={[1.95, 1.2, 1.85]} />
          <meshStandardMaterial color={corBase} {...matProps} />
        </mesh>
        {/* Cobertura inclinada verde-floresta */}
        <mesh position={[0, 1.44 + bonusAltura * 0.35, 0]} rotation={[0, 0, 0.16]} raycast={ray}>
          <boxGeometry args={[2.22, 0.24, 2.08]} />
          <meshStandardMaterial color={corTelhado} {...matProps} />
        </mesh>
        {/* Pilha de toras ao lado */}
        <mesh position={[-0.78, 0.22, 0.98]} rotation={[0, 0, Math.PI / 2]} raycast={ray}>
          <cylinderGeometry args={[0.16, 0.16, 0.78, 8]} />
          <meshStandardMaterial color={corDetalhe} {...matProps} />
        </mesh>
        <mesh position={[-0.78, 0.44, 0.98]} rotation={[0, 0, Math.PI / 2]} raycast={ray}>
          <cylinderGeometry args={[0.14, 0.14, 0.72, 8]} />
          <meshStandardMaterial color={corDetalhe} {...matProps} />
        </mesh>
      </group>
    )
  }

  // mina
  return (
    <group>
      {/* Entrada de túnel em arco */}
      <mesh position={[0, 0.64, 0]} raycast={ray}>
        <boxGeometry args={[2.08, 1.28, 2.08]} />
        <meshStandardMaterial color={corBase} {...matProps} />
      </mesh>
      {/* Boca escura da galeria */}
      <mesh position={[0, 0.48, 1.05]} raycast={ray}>
        <boxGeometry args={[0.88, 0.9, 0.08]} />
        <meshStandardMaterial color="#090d16" {...matProps} />
      </mesh>
      {/* Torre de guincho de mineração */}
      <mesh position={[0, 1.65 + bonusAltura * 0.6, 0]} raycast={ray}>
        <coneGeometry args={[0.92, 0.9 + bonusAltura * 0.6, 4]} />
        <meshStandardMaterial color={corDetalhe} {...matProps} />
      </mesh>
      {/* Cristal/pepita de ouro no topo */}
      <mesh position={[0, 2.15 + bonusAltura * 0.9, 0]} raycast={ray}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={corTelhado} emissive="#ca8a04" emissiveIntensity={0.45} {...matProps} />
      </mesh>
    </group>
  )
}

export const GhostBlueprintObra: React.FC<{
  tipo: PecaId
  x: number
  z: number
  valido: boolean
  sobreAgua?: boolean
}> = ({ tipo, x, z, valido, sobreAgua = false }) => {
  const cor = valido ? (sobreAgua ? '#38bdf8' : '#22c55e') : '#ef4444'
  const corBorda = valido ? (sobreAgua ? '#bae6fd' : '#86efac') : '#fecaca'
  const dim = DIMENSOES_OBRA[tipo]
  const ySolo = sobreAgua ? -0.36 : -0.43

  return (
    <group position={[x, 0, z]} name="ghost-blueprint-obra">
      <SilhuetaPeca
        tipo={tipo}
        nivel={1}
        corBase={cor}
        corDetalhe={corBorda}
        corTelhado={cor}
        transparente
        opacidade={0.42}
        semColisaoRay
      />
      {/* Base de marcação no solo ou na lâmina d'água */}
      <mesh position={[0, ySolo, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={semRaycast}>
        <planeGeometry args={[dim[0] + 0.9, dim[2] + 0.9]} />
        <meshBasicMaterial color={cor} transparent opacity={0.34} depthWrite={false} />
      </mesh>
      {sobreAgua ? (
        ([-dim[0] * 0.44, dim[0] * 0.44] as const).map((px) =>
          ([-dim[2] * 0.44, dim[2] * 0.44] as const).map((pz) => (
            <mesh key={`gp-${px}-${pz}`} position={[px, -0.22, pz]} raycast={semRaycast}>
              <cylinderGeometry args={[0.09, 0.1, 0.46, 6]} />
              <meshBasicMaterial color={corBorda} transparent opacity={0.55} depthWrite={false} />
            </mesh>
          )),
        )
      ) : (
        <mesh position={[0, -0.22, 0]} raycast={semRaycast}>
          <boxGeometry args={[dim[0] + 0.35, 0.44, dim[2] + 0.35]} />
          <meshBasicMaterial color={cor} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, dim[1] / 2, 0]} raycast={semRaycast}>
        <boxGeometry args={[dim[0] + 0.12, dim[1] + 0.12, dim[2] + 0.12]} />
        <meshBasicMaterial color={corBorda} wireframe transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  )
}

function paletaObra(obra: Obra): { base: string; detalhe: string; telhado: string } {
  if (obra.lado === 'inimigo') {
    return obra.tipo === 'nucleo'
      ? { base: '#7f1d1d', detalhe: '#450a0a', telhado: '#ef4444' }
      : { base: '#9f1239', detalhe: '#4c0519', telhado: '#f43f5e' }
  }
  switch (obra.tipo) {
    case 'nucleo':
      return { base: '#eab308', detalhe: '#cbd5e1', telhado: '#2563eb' }
    case 'torre':
      return { base: '#0284c7', detalhe: '#e2e8f0', telhado: '#1d4ed8' }
    case 'portao':
      return { base: '#16a34a', detalhe: '#d1fae5', telhado: '#facc15' }
    case 'quartel':
      return { base: '#d97706', detalhe: '#fef3c7', telhado: '#b91c1c' }
    case 'britador':
      return { base: '#57534e', detalhe: '#a8a29e', telhado: '#292524' }
    case 'serraria':
      return { base: '#92400e', detalhe: '#d97706', telhado: '#15803d' }
    case 'mina':
      return { base: '#44403c', detalhe: '#eab308', telhado: '#facc15' }
  }
}

export const ObraArquiteturaMesh: React.FC<{
  obra: Obra
  visivel: boolean
  modoBloco: boolean
  sombrasAtivas?: boolean
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void
  onPointerUp: (event: ThreeEvent<PointerEvent>) => void
  onClick: (event: ThreeEvent<MouseEvent>) => void
}> = ({ obra, visivel, modoBloco, onPointerDown, onPointerUp, onClick }) => {
  const ruina = obra.hp <= 0
  const construindo = obraEmConstrucao(obra)
  const temBlocosLivres = Boolean((obra as Obra & { blocosLivres?: readonly BlocoMundo[] }).blocosLivres?.length)
  const usaMalhaBlocos = (Boolean(obra.blocosNv5) || temBlocosLivres) && !ruina && !construindo
  if (usaMalhaBlocos || !visivel) return null

  const dim = DIMENSOES_OBRA[obra.tipo]
  const total = Math.max(0.01, obra.construindoTotal ?? 1)
  const progresso = construindo ? Math.max(0.18, 1 - (obra.construindoRestante ?? 0) / total) : 1
  const pal = paletaObra(obra)

  if (ruina) {
    return (
      <group position={[obra.x, 0, obra.z]}>
        <mesh position={[0, -0.08, 0]} raycast={semRaycast}>
          <boxGeometry args={[dim[0] * 0.92, 0.28, dim[2] * 0.92]} />
          <meshStandardMaterial color={obra.lado === 'inimigo' ? '#292524' : '#57534e'} roughness={0.95} />
        </mesh>
        <mesh position={[-0.35, 0.12, 0.2]} rotation={[0.2, 0.4, -0.3]} raycast={semRaycast}>
          <boxGeometry args={[0.55, 0.32, 0.48]} />
          <meshStandardMaterial color="#44403c" roughness={0.95} />
        </mesh>
      </group>
    )
  }

  return (
    <group
      position={[obra.x, 0, obra.z]}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={onClick}
    >
      <group scale={[1, construindo ? progresso : 1, 1]}>
        <SilhuetaPeca
          tipo={obra.tipo}
          nivel={obra.nivel}
          corBase={construindo ? (obra.lado === 'inimigo' ? '#b45309' : '#f59e0b') : pal.base}
          corDetalhe={pal.detalhe}
          corTelhado={pal.telhado}
          semColisaoRay={modoBloco}
        />
      </group>
      {/* Andaimes visuais ancorados até o chão durante a fase de construção */}
      {construindo && (
        <group>
          {([-dim[0] * 0.56, dim[0] * 0.56] as const).map((px) =>
            ([-dim[2] * 0.56, dim[2] * 0.56] as const).map((pz) => (
              <mesh key={`and-${px}-${pz}`} position={[px, (dim[1] - 0.45) * 0.5, pz]} raycast={semRaycast}>
                <cylinderGeometry args={[0.055, 0.065, dim[1] + 0.45, 6]} />
                <meshStandardMaterial color="#92400e" roughness={0.9} />
              </mesh>
            )),
          )}
          <mesh position={[0, dim[1] * 0.45, dim[2] * 0.56]} raycast={semRaycast}>
            <boxGeometry args={[dim[0] * 1.18, 0.08, 0.08]} />
            <meshStandardMaterial color="#d97706" roughness={0.85} />
          </mesh>
          <mesh position={[0, dim[1] * 0.45, -dim[2] * 0.56]} raycast={semRaycast}>
            <boxGeometry args={[dim[0] * 1.18, 0.08, 0.08]} />
            <meshStandardMaterial color="#d97706" roughness={0.85} />
          </mesh>
        </group>
      )}
    </group>
  )
}
