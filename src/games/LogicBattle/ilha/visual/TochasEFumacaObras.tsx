import { useFrame } from '@react-three/fiber'
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  DodecahedronGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  ShaderMaterial,
} from 'three'
import type { PartidaState } from '../partidaSim'
import { semRaycast } from '../raycastCena'
import type { ChaoDoDesenho } from '../relevo/alturaVisual'
import { MAX_TOCHAS_CENA, posicoesTochasObras } from './efeitosAmbiente'
import { paisagemNaturalVisivel } from './suporteFundacao'

export interface TochasEFumacaObrasProps {
  readonly state: PartidaState
  readonly campo?: ChaoDoDesenho
  readonly velocidadeTempo: number
}

const MAX_FUMACAS = MAX_TOCHAS_CENA * 2

export const TochasEFumacaObras: React.FC<TochasEFumacaObrasProps> = ({
  state,
  campo,
  velocidadeTempo,
}) => {
  const chamasRef = useRef<InstancedMesh>(null)
  const fumacasRef = useRef<InstancedMesh>(null)
  const molde = useMemo(() => new Object3D(), [])
  const tempoRef = useRef(0)

  const pontos = useMemo(
    () =>
      posicoesTochasObras(state.obras, campo, state.lagoas).filter((p) =>
        paisagemNaturalVisivel(state, p.x, p.z),
      ),
    [state, state.obras, state.lagoas, state.versaoSolidos, state.versaoChao, state.semCorpo, campo],
  )

  const fasesAttr = useMemo(() => new InstancedBufferAttribute(new Float32Array(MAX_TOCHAS_CENA), 1), [])
  const coresAttr = useMemo(() => new InstancedBufferAttribute(new Float32Array(MAX_TOCHAS_CENA * 3), 3), [])

  const chamaGeo = useMemo(() => {
    const geo = new OctahedronGeometry(0.14, 0)
    geo.setAttribute('aFase', fasesAttr)
    geo.setAttribute('aCorHdr', coresAttr)
    return geo
  }, [fasesAttr, coresAttr])

  const fumacaGeo = useMemo(() => new DodecahedronGeometry(0.14, 0), [])

  const chamaMat = useMemo(() => {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTempo: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aFase;
        attribute vec3 aCorHdr;
        uniform float uTempo;
        varying vec3 vCorHdr;
        void main() {
          vCorHdr = aCorHdr;
          vec3 p = position;
          float pulso = 1.0 + sin(uTempo * 9.5 + aFase) * 0.22;
          p.y *= 1.45 * pulso;
          p.xz *= 0.9 + sin(uTempo * 7.2 + aFase * 1.7) * 0.14;
          vec4 wp = vec4(p, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCorHdr;
        void main() {
          gl_FragColor = vec4(vCorHdr, 0.92);
        }
      `,
    })
  }, [])

  const fumacaMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#cbd5e1',
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      chamaGeo.dispose()
      fumacaGeo.dispose()
      chamaMat.dispose()
      fumacaMat.dispose()
    }
  }, [chamaGeo, fumacaGeo, chamaMat, fumacaMat])

  useLayoutEffect(() => {
    const mesh = chamasRef.current
    if (!mesh) return
    const n = Math.min(pontos.length, MAX_TOCHAS_CENA)
    const fases = fasesAttr.array as Float32Array
    const cores = coresAttr.array as Float32Array
    for (let k = 0; k < n; k += 1) {
      const p = pontos[k]
      molde.position.set(p.x, p.y, p.z)
      molde.rotation.set(0, p.fase, 0)
      molde.scale.setScalar(1)
      molde.updateMatrix()
      mesh.setMatrixAt(k, molde.matrix)
      fases[k] = p.fase
      if (p.ehInimiga) {
        cores[k * 3] = 1.75
        cores[k * 3 + 1] = 0.35
        cores[k * 3 + 2] = 0.15
      } else {
        cores[k * 3] = 1.85
        cores[k * 3 + 1] = 0.95
        cores[k * 3 + 2] = 0.25
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    fasesAttr.needsUpdate = true
    coresAttr.needsUpdate = true
  }, [pontos, fasesAttr, coresAttr, molde])

  useFrame((_, dt) => {
    if (pontos.length === 0) return
    if (velocidadeTempo > 0) {
      tempoRef.current += Math.min(dt, 0.05) * velocidadeTempo
    }
    chamaMat.uniforms.uTempo.value = tempoRef.current

    const fumaca = fumacasRef.current
    if (!fumaca) return
    if (velocidadeTempo <= 0) {
      fumaca.count = 0
      return
    }
    const n = Math.min(pontos.length, MAX_TOCHAS_CENA)
    let outIdx = 0
    for (let k = 0; k < n; k += 1) {
      const p = pontos[k]
      for (let f = 0; f < 2; f += 1) {
        if (outIdx >= MAX_FUMACAS) break
        const ciclo = (tempoRef.current * 0.55 + p.fase * 0.17 + f * 0.5) % 1
        const alt = ciclo * 1.4
        const esc = 0.65 + ciclo * 0.95
        const oscX = Math.sin(ciclo * 5.0 + p.fase) * 0.12
        const oscZ = Math.cos(ciclo * 4.2 + p.fase) * 0.1
        molde.position.set(p.x + oscX, p.y + 0.18 + alt, p.z + oscZ)
        molde.rotation.set(ciclo, p.fase + f, 0)
        molde.scale.setScalar(esc * (1 - ciclo * 0.45))
        molde.updateMatrix()
        fumaca.setMatrixAt(outIdx++, molde.matrix)
      }
    }
    fumaca.count = outIdx
    fumaca.instanceMatrix.needsUpdate = true
  })

  if (pontos.length === 0) return null
  return (
    <group name="tochas-e-fumaca-obras">
      <instancedMesh
        ref={chamasRef}
        args={[chamaGeo, chamaMat, MAX_TOCHAS_CENA]}
        frustumCulled={false}
        raycast={semRaycast}
      />
      <instancedMesh
        ref={fumacasRef}
        args={[fumacaGeo, fumacaMat, MAX_FUMACAS]}
        frustumCulled={false}
        raycast={semRaycast}
      />
    </group>
  )
}
