import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  type InstancedMesh,
  Object3D,
  ShaderMaterial,
} from 'three'
import type { BiomaId } from '../biomaRecursos'
import { semRaycast } from '../raycastCena'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { gerarBandoPassaros } from './efeitosAmbiente'

export interface PassarosBiomaProps {
  readonly mapaI: number
  readonly mapaJ: number
  readonly bioma: BiomaId
  readonly quantidade: number
  readonly velocidadeTempo: number
}

function criarGeometriaPassaroV(fases: Float32Array): BufferGeometry {
  const geo = new BufferGeometry()
  // Silhueta V-wing com 4 triângulos simétricos (asas + cauda curta)
  const vertices = new Float32Array([
    0.0, 0.0, 0.24,   -0.26, 0.02, 0.02,   0.0, 0.0, -0.14,
    -0.26, 0.02, 0.02, -0.52, -0.02, -0.18, 0.0, 0.0, -0.14,
    0.0, 0.0, 0.24,    0.0, 0.0, -0.14,    0.26, 0.02, 0.02,
    0.26, 0.02, 0.02,  0.0, 0.0, -0.14,    0.52, -0.02, -0.18,
  ])
  geo.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geo.setAttribute('aFaseAsa', new InstancedBufferAttribute(fases, 1))
  geo.computeVertexNormals()
  return geo
}

export const PassarosBioma: React.FC<PassarosBiomaProps> = ({
  mapaI,
  mapaJ,
  bioma,
  quantidade,
  velocidadeTempo,
}) => {
  const meshRef = useRef<InstancedMesh>(null)
  const molde = useMemo(() => new Object3D(), [])
  const tempoRef = useRef(0)
  const cat = BIOMA_VISUAL_CATALOG[bioma]

  const bando = useMemo(() => gerarBandoPassaros(mapaI, mapaJ, quantidade), [mapaI, mapaJ, quantidade])

  const geometria = useMemo(() => {
    const fases = new Float32Array(Math.max(1, bando.length))
    for (let k = 0; k < bando.length; k += 1) fases[k] = bando[k].faseAsa
    return criarGeometriaPassaroV(fases)
  }, [bando])

  useEffect(() => {
    return () => {
      geometria.dispose()
    }
  }, [geometria])

  const material = useMemo(() => {
    return new ShaderMaterial({
      side: DoubleSide,
      uniforms: {
        uTempo: { value: 0 },
        uCor: { value: new Color(cat.troncoCor).multiplyScalar(0.55) },
      },
      vertexShader: /* glsl */ `
        attribute float aFaseAsa;
        uniform float uTempo;
        void main() {
          vec3 p = position;
          float batida = sin(uTempo * 7.5 + aFaseAsa);
          p.y += batida * abs(p.x) * 0.62;
          vec4 wp = vec4(p, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCor;
        void main() {
          gl_FragColor = vec4(uCor, 1.0);
        }
      `,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    material.uniforms.uCor.value.set(cat.troncoCor).multiplyScalar(0.55)
  }, [material, cat.troncoCor])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame((_, dt) => {
    const mesh = meshRef.current
    if (!mesh || bando.length === 0) return
    if (velocidadeTempo > 0) {
      tempoRef.current += Math.min(dt, 0.05) * velocidadeTempo
    }
    const t = tempoRef.current
    material.uniforms.uTempo.value = t

    for (let k = 0; k < bando.length; k += 1) {
      const b = bando[k]
      const ang = b.anguloInicial + t * b.velocidadeAngular
      const x = b.centroX + Math.cos(ang) * b.raioOrbita
      const z = b.centroZ + Math.sin(ang) * b.raioOrbita
      const y = b.altitude + Math.sin(t * 0.9 + b.faseAsa) * 0.7
      const vx = -Math.sin(ang) * b.velocidadeAngular
      const vz = Math.cos(ang) * b.velocidadeAngular
      molde.position.set(x, y, z)
      molde.rotation.set(0, Math.atan2(vx, vz), b.velocidadeAngular > 0 ? 0.14 : -0.14)
      molde.scale.setScalar(b.escala)
      molde.updateMatrix()
      mesh.setMatrixAt(k, molde.matrix)
    }
    mesh.count = bando.length
    mesh.instanceMatrix.needsUpdate = true
  })

  if (bando.length === 0) return null
  return (
    <instancedMesh
      ref={meshRef}
      name="passaros-bioma"
      args={[geometria, material, Math.max(1, bando.length)]}
      frustumCulled={false}
      raycast={semRaycast}
    />
  )
}
