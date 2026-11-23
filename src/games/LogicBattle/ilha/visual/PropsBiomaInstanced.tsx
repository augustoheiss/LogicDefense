import { useFrame } from '@react-three/fiber'
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type InstancedMesh,
  MeshLambertMaterial,
  Object3D,
} from 'three'
import type { BiomaId, LagoaRasa, RecursoNatural } from '../biomaRecursos'
import { PARTIDA } from '../partidaPolicies'
import { chaoRevelado, type PartidaState } from '../partidaSim'
import { semRaycast } from '../raycastCena'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { gerarPropsDecorativos } from './propsDecorativos'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import type { PacoteTexturasBioma } from './texturasPbrProcedural'

export interface PropsBiomaInstancedProps {
  readonly state: PartidaState
  readonly mapaI: number
  readonly mapaJ: number
  readonly bioma: BiomaId
  readonly recursos: readonly RecursoNatural[]
  readonly lagoas: readonly LagoaRasa[]
  readonly texturas: PacoteTexturasBioma | null
  readonly spec: SpecQualidadeGrafica
}

const MAX_ARVORES = 32
const MAX_OURO = 24
const MAX_GRAMA = 2600
const MAX_FLORES = 320
const MAX_PEDRAS = 200
const MAX_MARGENS = 120

function criarGeometriaTufoGrama(): BufferGeometry {
  const geo = new BufferGeometry()
  const w = 0.09
  const h = 0.34
  const positions = new Float32Array([
    -w, 0, 0, w, 0, 0, 0, h, 0.04,
    0, 0, -w, 0, 0, w, -0.04, h, 0,
  ])
  const normals = new Float32Array([
    0, 0.5, 0.86, 0, 0.5, 0.86, 0, 0.8, 0.6,
    0.86, 0.5, 0, 0.86, 0.5, 0, 0.6, 0.8, 0,
  ])
  const uvs = new Float32Array([
    0, 0, 1, 0, 0.5, 1,
    0, 0, 1, 0, 0.5, 1,
  ])
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return geo
}

export const PropsBiomaInstanced: React.FC<PropsBiomaInstancedProps> = ({
  state,
  mapaI,
  mapaJ,
  bioma,
  recursos,
  lagoas,
  texturas,
  spec,
}) => {
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  const noSubsolo = !state.semCorpo && state.heroi.y < -0.9
  const molde = useMemo(() => new Object3D(), [])

  const troncosRef = useRef<InstancedMesh>(null)
  const copas1Ref = useRef<InstancedMesh>(null)
  const copas2Ref = useRef<InstancedMesh>(null)
  const tocosRef = useRef<InstancedMesh>(null)

  const rochasOuroRef = useRef<InstancedMesh>(null)
  const cristais1Ref = useRef<InstancedMesh>(null)
  const cristais2Ref = useRef<InstancedMesh>(null)
  const ouroVazioRef = useRef<InstancedMesh>(null)

  const gramasRef = useRef<InstancedMesh>(null)
  const floresRef = useRef<InstancedMesh>(null)
  const pedrasRef = useRef<InstancedMesh>(null)
  const juncosRef = useRef<InstancedMesh>(null)
  const vitoriasRef = useRef<InstancedMesh>(null)

  const gramaGeo = useMemo(() => criarGeometriaTufoGrama(), [])
  const ventoUniformRef = useRef({ value: 0 })

  const gramaMat = useMemo(() => {
    const mat = new MeshLambertMaterial({
      color: cat.gramaCorPonta,
      side: DoubleSide,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = ventoUniformRef.current
      shader.vertexShader =
        'uniform float uWindTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float topo = clamp(position.y / 0.34, 0.0, 1.0);
          vec3 worldSeed = vec3(0.0);
          #ifdef USE_INSTANCING
            worldSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #endif
          float sway = sin(uWindTime * 2.3 + worldSeed.x * 0.45 + worldSeed.z * 0.35) * 0.09 * topo * topo;
          transformed.x += sway;
          transformed.z += sway * 0.55;
          `,
        )
    }
    return mat
  }, [])

  useEffect(() => {
    gramaMat.color.set(cat.gramaCorPonta)
  }, [gramaMat, cat.gramaCorPonta])

  useEffect(() => {
    return () => {
      gramaGeo.dispose()
      gramaMat.dispose()
    }
  }, [gramaGeo, gramaMat])

  const decor = useMemo(
    () =>
      gerarPropsDecorativos(mapaI, mapaJ, bioma, lagoas, recursos, {
        maxGrama: spec.maxGrama,
        maxFlores: spec.maxFlores,
        maxPedras: spec.maxPedras,
      }),
    [mapaI, mapaJ, bioma, lagoas, recursos, spec.maxGrama, spec.maxFlores, spec.maxPedras],
  )

  useFrame((_, dt) => {
    if (spec.maxGrama > 0) {
      ventoUniformRef.current.value += Math.min(dt, 0.05)
    }
  })

  // 1. Atualiza instâncias de Árvores e Veios de Ouro (superfície)
  useLayoutEffect(() => {
    let nArv = 0
    let nToco = 0
    let nOuro = 0
    let nOuroVazio = 0

    for (const rec of recursos) {
      if (rec.yBase < -0.9) continue
      if (PARTIDA.nuvem && !chaoRevelado(state, rec.x, rec.z)) continue
      const rot = ((rec.id * 1.618) % (Math.PI * 2))
      const escala = 0.88 + ((rec.id * 37) % 30) / 100

      if (rec.tipo === 'arvore') {
        if (rec.hp <= 0) {
          if (tocosRef.current && nToco < MAX_ARVORES) {
            molde.position.set(rec.x, rec.yBase + 0.14, rec.z)
            molde.rotation.set(0, rot, 0)
            molde.scale.set(escala, 1, escala)
            molde.updateMatrix()
            tocosRef.current.setMatrixAt(nToco++, molde.matrix)
          }
        } else if (nArv < MAX_ARVORES) {
          if (troncosRef.current) {
            molde.position.set(rec.x, rec.yBase + 0.68 * escala, rec.z)
            molde.rotation.set(0, rot, 0)
            molde.scale.set(escala, escala, escala)
            molde.updateMatrix()
            troncosRef.current.setMatrixAt(nArv, molde.matrix)
          }
          if (copas1Ref.current) {
            molde.position.set(rec.x, rec.yBase + 1.5 * escala, rec.z)
            molde.rotation.set(0, rot + 0.4, 0)
            const sx = cat.copaFormato === 'retorcida' ? escala * 1.15 : escala
            molde.scale.set(sx, escala, sx)
            molde.updateMatrix()
            copas1Ref.current.setMatrixAt(nArv, molde.matrix)
          }
          if (copas2Ref.current) {
            molde.position.set(rec.x, rec.yBase + 2.15 * escala, rec.z)
            molde.rotation.set(0, rot + 1.1, 0)
            molde.scale.set(escala * 0.78, escala * 0.86, escala * 0.78)
            molde.updateMatrix()
            copas2Ref.current.setMatrixAt(nArv, molde.matrix)
          }
          nArv += 1
        }
      } else {
        if (rec.hp <= 0) {
          if (ouroVazioRef.current && nOuroVazio < MAX_OURO) {
            molde.position.set(rec.x, rec.yBase + 0.08, rec.z)
            molde.rotation.set(0, rot, 0)
            molde.scale.set(1, 1, 1)
            molde.updateMatrix()
            ouroVazioRef.current.setMatrixAt(nOuroVazio++, molde.matrix)
          }
        } else if (nOuro < MAX_OURO) {
          if (rochasOuroRef.current) {
            molde.position.set(rec.x, rec.yBase + 0.36, rec.z)
            molde.rotation.set(0.08, rot, -0.06)
            molde.scale.set(escala, escala * 0.9, escala)
            molde.updateMatrix()
            rochasOuroRef.current.setMatrixAt(nOuro, molde.matrix)
          }
          if (cristais1Ref.current) {
            molde.position.set(rec.x + 0.18, rec.yBase + 0.66, rec.z + 0.1)
            molde.rotation.set(0.3, rot + 0.4, -0.2)
            molde.scale.set(escala, escala, escala)
            molde.updateMatrix()
            cristais1Ref.current.setMatrixAt(nOuro, molde.matrix)
          }
          if (cristais2Ref.current) {
            molde.position.set(rec.x - 0.2, rec.yBase + 0.56, rec.z - 0.14)
            molde.rotation.set(-0.2, rot + 0.9, 0.35)
            molde.scale.set(escala, escala, escala)
            molde.updateMatrix()
            cristais2Ref.current.setMatrixAt(nOuro, molde.matrix)
          }
          nOuro += 1
        }
      }
    }

    const atualizar = (mesh: InstancedMesh | null, count: number) => {
      if (!mesh) return
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
      if (count > 0) mesh.computeBoundingSphere()
    }
    atualizar(troncosRef.current, nArv)
    atualizar(copas1Ref.current, nArv)
    atualizar(copas2Ref.current, nArv)
    atualizar(tocosRef.current, nToco)
    atualizar(rochasOuroRef.current, nOuro)
    atualizar(cristais1Ref.current, nOuro)
    atualizar(cristais2Ref.current, nOuro)
    atualizar(ouroVazioRef.current, nOuroVazio)
  }, [recursos, state, state.versaoChao, state.versaoRecursos, cat.copaFormato, molde])

  // 2. Atualiza instâncias de micro-natureza (grama, flores, pedras, margens)
  useLayoutEffect(() => {
    if (noSubsolo) return

    if (gramasRef.current) {
      let n = 0
      for (const g of decor.gramas) {
        if (n >= MAX_GRAMA) break
        if (PARTIDA.nuvem && !chaoRevelado(state, g.x, g.z)) continue
        molde.position.set(g.x, -0.45, g.z)
        molde.rotation.set(0, g.rotY, 0)
        molde.scale.set(g.escala, g.altura, g.escala)
        molde.updateMatrix()
        gramasRef.current.setMatrixAt(n++, molde.matrix)
      }
      gramasRef.current.count = n
      gramasRef.current.instanceMatrix.needsUpdate = true
      if (n > 0) gramasRef.current.computeBoundingSphere()
    }

    if (floresRef.current) {
      const corTmp = new Color()
      let n = 0
      for (const fl of decor.flores) {
        if (n >= MAX_FLORES) break
        if (PARTIDA.nuvem && !chaoRevelado(state, fl.x, fl.z)) continue
        molde.position.set(fl.x, -0.34, fl.z)
        molde.rotation.set(0, fl.rotY, 0)
        molde.scale.set(fl.escala, fl.escala, fl.escala)
        molde.updateMatrix()
        floresRef.current.setMatrixAt(n, molde.matrix)
        corTmp.set(cat.coresFlores[fl.corIndex])
        floresRef.current.setColorAt(n, corTmp)
        n += 1
      }
      floresRef.current.count = n
      floresRef.current.instanceMatrix.needsUpdate = true
      if (floresRef.current.instanceColor) floresRef.current.instanceColor.needsUpdate = true
      if (n > 0) floresRef.current.computeBoundingSphere()
    }

    if (pedrasRef.current) {
      let n = 0
      for (const p of decor.pedras) {
        if (n >= MAX_PEDRAS) break
        if (PARTIDA.nuvem && !chaoRevelado(state, p.x, p.z)) continue
        molde.position.set(p.x, -0.42 + p.escalaY * 0.35, p.z)
        molde.rotation.set(0.15, p.rotY, 0.1)
        molde.scale.set(p.escalaX, p.escalaY, p.escalaZ)
        molde.updateMatrix()
        pedrasRef.current.setMatrixAt(n++, molde.matrix)
      }
      pedrasRef.current.count = n
      pedrasRef.current.instanceMatrix.needsUpdate = true
      if (n > 0) pedrasRef.current.computeBoundingSphere()
    }

    if (juncosRef.current && vitoriasRef.current) {
      let nj = 0
      let nv = 0
      for (const m of decor.margens) {
        if (PARTIDA.nuvem && !chaoRevelado(state, m.x, m.z)) continue
        if (m.tipo === 'junco' && nj < MAX_MARGENS) {
          molde.position.set(m.x, -0.25, m.z)
          molde.rotation.set(0.08, m.rotY, 0)
          molde.scale.set(m.escala, m.escala, m.escala)
          molde.updateMatrix()
          juncosRef.current.setMatrixAt(nj++, molde.matrix)
        } else if (m.tipo === 'vitoria' && nv < MAX_MARGENS) {
          molde.position.set(m.x, -0.36, m.z)
          molde.rotation.set(0, m.rotY, 0)
          molde.scale.set(m.escala, 1, m.escala)
          molde.updateMatrix()
          vitoriasRef.current.setMatrixAt(nv++, molde.matrix)
        }
      }
      juncosRef.current.count = nj
      juncosRef.current.instanceMatrix.needsUpdate = true
      vitoriasRef.current.count = nv
      vitoriasRef.current.instanceMatrix.needsUpdate = true
    }
  }, [decor, noSubsolo, state, state.versaoChao, cat.coresFlores, molde])

  if (noSubsolo) return null

  const usarConeCopa = cat.copaFormato === 'pinheiro' || cat.copaFormato === 'nevada'
  const matKey = texturas ? `pbr-${texturas.bioma}-${texturas.resolucao}` : `solid-${bioma}`

  return (
    <group name="props-bioma-instanced">
      {/* Árvores vivas */}
      <instancedMesh
        ref={troncosRef}
        args={[undefined, undefined, MAX_ARVORES]}
        castShadow={spec.sombrasAtivas}
        receiveShadow={spec.sombrasAtivas}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <cylinderGeometry args={[0.24, 0.34, 1.38, 8]} />
        <meshStandardMaterial
          key={`tronco-${matKey}`}
          color={texturas ? '#ffffff' : cat.troncoCor}
          map={texturas?.tronco.map ?? null}
          normalMap={texturas?.tronco.normalMap ?? null}
          roughness={0.88}
        />
      </instancedMesh>
      <instancedMesh
        ref={copas1Ref}
        args={[undefined, undefined, MAX_ARVORES]}
        castShadow={spec.sombrasAtivas}
        receiveShadow={spec.sombrasAtivas}
        frustumCulled={false}
        raycast={semRaycast}
      >
        {usarConeCopa ? <coneGeometry args={[1.05, 1.35, 8]} /> : <dodecahedronGeometry args={[0.92, 0]} />}
        <meshStandardMaterial
          key={`copa1-${matKey}`}
          color={texturas ? '#ffffff' : cat.copaCorPrimaria}
          map={texturas?.copa.map ?? null}
          normalMap={texturas?.copa.normalMap ?? null}
          roughness={0.82}
        />
      </instancedMesh>
      <instancedMesh
        ref={copas2Ref}
        args={[undefined, undefined, MAX_ARVORES]}
        castShadow={spec.sombrasAtivas}
        receiveShadow={spec.sombrasAtivas}
        frustumCulled={false}
        raycast={semRaycast}
      >
        {usarConeCopa ? <coneGeometry args={[0.78, 1.05, 8]} /> : <dodecahedronGeometry args={[0.72, 0]} />}
        <meshStandardMaterial
          key={`copa2-${matKey}`}
          color={cat.copaCorSecundaria}
          normalMap={texturas?.copa.normalMap ?? null}
          roughness={0.78}
        />
      </instancedMesh>
      <instancedMesh ref={tocosRef} args={[undefined, undefined, MAX_ARVORES]} frustumCulled={false} raycast={semRaycast}>
        <cylinderGeometry args={[0.28, 0.34, 0.28, 8]} />
        <meshStandardMaterial color={cat.troncoCor} roughness={0.9} />
      </instancedMesh>

      {/* Veios de Ouro */}
      <instancedMesh
        ref={rochasOuroRef}
        args={[undefined, undefined, MAX_OURO]}
        castShadow={spec.sombrasAtivas}
        receiveShadow={spec.sombrasAtivas}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <dodecahedronGeometry args={[0.58, 0]} />
        <meshStandardMaterial
          key={`rocha-${matKey}`}
          color={texturas ? '#ffffff' : cat.rochaCor}
          map={texturas?.rocha.map ?? null}
          normalMap={texturas?.rocha.normalMap ?? null}
          roughness={0.85}
        />
      </instancedMesh>
      <instancedMesh ref={cristais1Ref} args={[undefined, undefined, MAX_OURO]} frustumCulled={false} raycast={semRaycast}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial
          color={cat.ouroCor}
          emissive={cat.ouroEmissivo}
          emissiveIntensity={0.48}
          metalness={0.72}
          roughness={0.22}
        />
      </instancedMesh>
      <instancedMesh ref={cristais2Ref} args={[undefined, undefined, MAX_OURO]} frustumCulled={false} raycast={semRaycast}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color={cat.ouroCor}
          emissive={cat.ouroEmissivo}
          emissiveIntensity={0.38}
          metalness={0.72}
          roughness={0.22}
        />
      </instancedMesh>
      <instancedMesh ref={ouroVazioRef} args={[undefined, undefined, MAX_OURO]} frustumCulled={false} raycast={semRaycast}>
        <cylinderGeometry args={[0.42, 0.5, 0.16, 7]} />
        <meshStandardMaterial color="#44403c" roughness={0.95} />
      </instancedMesh>

      {/* Grama animada por vento no vertex shader */}
      <instancedMesh
        ref={gramasRef}
        args={[gramaGeo, gramaMat, MAX_GRAMA]}
        frustumCulled={false}
        raycast={semRaycast}
      />

      {/* Flores silvestres */}
      <instancedMesh ref={floresRef} args={[undefined, undefined, MAX_FLORES]} frustumCulled={false} raycast={semRaycast}>
        <dodecahedronGeometry args={[0.09, 0]} />
        <meshLambertMaterial color="#ffffff" />
      </instancedMesh>

      {/* Pedrinhas */}
      <instancedMesh
        ref={pedrasRef}
        args={[undefined, undefined, MAX_PEDRAS]}
        receiveShadow={spec.sombrasAtivas}
        frustumCulled={false}
        raycast={semRaycast}
      >
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={cat.rochaCor} roughness={0.9} />
      </instancedMesh>

      {/* Juncos e vitórias-régias nas margens */}
      <instancedMesh ref={juncosRef} args={[undefined, undefined, MAX_MARGENS]} frustumCulled={false} raycast={semRaycast}>
        <cylinderGeometry args={[0.03, 0.05, 0.55, 5]} />
        <meshLambertMaterial color={cat.gramaCorBase} />
      </instancedMesh>
      <instancedMesh ref={vitoriasRef} args={[undefined, undefined, MAX_MARGENS]} frustumCulled={false} raycast={semRaycast}>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 10]} />
        <meshLambertMaterial color={cat.copaCorPrimaria} />
      </instancedMesh>
    </group>
  )
}
