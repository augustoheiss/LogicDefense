import { useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import { BackSide, Color, type DirectionalLight, ShaderMaterial } from 'three'
import type { BiomaId } from '../biomaRecursos'
import type { Olhar } from '../partidaPolicies'
import { semRaycast } from '../raycastCena'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'

export interface AtmosferaBiomaProps {
  readonly bioma: BiomaId
  readonly olhar: Olhar
  readonly spec: SpecQualidadeGrafica
  readonly focoX: number
  readonly focoZ: number
}

export const AtmosferaBioma: React.FC<AtmosferaBiomaProps> = ({
  bioma,
  olhar,
  spec,
  focoX,
  focoZ,
}) => {
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  const dirLightRef = useRef<DirectionalLight>(null)
  const { camera } = useThree()

  const skyMaterial = useMemo(() => {
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTopo: { value: new Color(cat.ceuTopo) },
        uHorizonte: { value: new Color(cat.ceuHorizonte) },
        uSolCor: { value: new Color(cat.corSol) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopo;
        uniform vec3 uHorizonte;
        uniform vec3 uSolCor;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y * 0.9 + 0.12, 0.0, 1.0);
          vec3 sky = mix(uHorizonte, uTopo, pow(h, 0.72));
          float sunDot = max(dot(dir, normalize(vec3(0.45, 0.62, 0.32))), 0.0);
          sky += uSolCor * pow(sunDot, 28.0) * 0.45;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
  }, [])

  useEffect(() => {
    skyMaterial.uniforms.uTopo.value.set(cat.ceuTopo)
    skyMaterial.uniforms.uHorizonte.value.set(cat.ceuHorizonte)
    skyMaterial.uniforms.uSolCor.value.set(cat.corSol)
  }, [skyMaterial, cat.ceuTopo, cat.ceuHorizonte, cat.corSol])

  useEffect(() => {
    return () => {
      skyMaterial.dispose()
    }
  }, [skyMaterial])

  useFrame(() => {
    const luz = dirLightRef.current
    if (!luz || !spec.sombrasAtivas) return
    const q = 2
    const cx = Math.round(focoX / q) * q
    const cz = Math.round(focoZ / q) * q
    const raio = olhar === 'imperio' ? 50 : 26
    luz.position.set(cx + cat.posicaoSol[0], cat.posicaoSol[1], cz + cat.posicaoSol[2])
    luz.target.position.set(cx, 0, cz)
    luz.target.updateMatrixWorld()
    if (luz.shadow.camera.right !== raio) {
      luz.shadow.camera.left = -raio
      luz.shadow.camera.right = raio
      luz.shadow.camera.top = raio
      luz.shadow.camera.bottom = -raio
      luz.shadow.camera.near = 4
      luz.shadow.camera.far = 140
      luz.shadow.camera.updateProjectionMatrix()
    }
    void camera
  })

  const fogNear = olhar === 'imperio' ? cat.fogNearImperio : cat.fogNearCorpo
  const fogFar = olhar === 'imperio' ? cat.fogFarImperio : cat.fogFarCorpo
  const shadowSize = spec.sombrasAtivas ? spec.shadowMapSize : 512

  return (
    <>
      <color attach="background" args={[cat.ceuHorizonte]} />
      <fog attach="fog" args={[cat.fogCor, fogNear, fogFar]} />
      {spec.ceuProcedural && (
        <mesh raycast={semRaycast} material={skyMaterial}>
          <sphereGeometry args={[210, 20, 12]} />
        </mesh>
      )}
      <hemisphereLight args={[cat.luzCeu, cat.luzChao, cat.intensidadeHemisf]} />
      <directionalLight
        ref={dirLightRef}
        position={[cat.posicaoSol[0], cat.posicaoSol[1], cat.posicaoSol[2]]}
        intensity={cat.intensidadeSol}
        color={cat.corSol}
        castShadow={spec.sombrasAtivas}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-18, 14, -22]} intensity={0.34} color={cat.luzCeu} />
    </>
  )
}
