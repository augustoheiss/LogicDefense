import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo } from 'react'
import { Color, DoubleSide, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import type { BiomaId } from '../biomaRecursos'
import { semRaycast } from '../raycastCena'
import { direcaoDoSol } from './ceuEIbl'
import { GLSL_NUVENS_FBM, perfilNuvensBioma } from './nuvensFbm'

export interface NuvensBiomaProps {
  readonly bioma: BiomaId
  readonly focoX: number
  readonly focoZ: number
  readonly velocidadeTempo: number
}

export const NuvensBioma: React.FC<NuvensBiomaProps> = ({
  bioma,
  focoX,
  focoZ,
  velocidadeTempo,
}) => {
  const geometria = useMemo(() => new PlaneGeometry(280, 280, 1, 1), [])
  useEffect(() => {
    return () => {
      geometria.dispose()
    }
  }, [geometria])

  const material = useMemo(() => {
    const p = perfilNuvensBioma(bioma)
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTempo: { value: 0 },
        uSolDir: { value: new Vector3(0.4, 0.6, 0.4) },
        uCorNuvem: { value: new Color(p.corNuvem) },
        uCorBordaSol: { value: new Color(p.corBordaSol) },
        uCobertura: { value: p.cobertura },
        uOpacidade: { value: p.opacidade },
        uVelocidade: { value: p.velocidade },
      },
      vertexShader: GLSL_NUVENS_FBM.vertice,
      fragmentShader: GLSL_NUVENS_FBM.fragmento,
    })
    // o material vive entre trocas de bioma; os valores reativos são atualizados no efeito abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const p = perfilNuvensBioma(bioma)
    material.uniforms.uCorNuvem.value.set(p.corNuvem)
    material.uniforms.uCorBordaSol.value.set(p.corBordaSol)
    material.uniforms.uCobertura.value = p.cobertura
    material.uniforms.uOpacidade.value = p.opacidade
    material.uniforms.uVelocidade.value = p.velocidade
  }, [material, bioma])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame((state, dt) => {
    if (velocidadeTempo > 0) {
      material.uniforms.uTempo.value += Math.min(dt, 0.05) * velocidadeTempo
    }
    const d = direcaoDoSol(bioma, state.clock.elapsedTime)
    material.uniforms.uSolDir.value.set(d[0], d[1], d[2])
  })

  return (
    <mesh
      name="nuvens-bioma"
      geometry={geometria}
      material={material}
      position={[focoX, 42, focoZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={semRaycast}
      renderOrder={-1}
    />
  )
}
