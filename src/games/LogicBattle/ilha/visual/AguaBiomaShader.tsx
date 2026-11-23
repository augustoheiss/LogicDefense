import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo } from 'react'
import { Color, ShaderMaterial } from 'three'
import type { BiomaId, LagoaRasa } from '../biomaRecursos'
import { PARTIDA } from '../partidaPolicies'
import { chaoRevelado, type PartidaState } from '../partidaSim'
import { semRaycast } from '../raycastCena'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import type { PacoteTexturasBioma } from './texturasPbrProcedural'

export interface AguaBiomaShaderProps {
  readonly state: PartidaState
  readonly bioma: BiomaId
  readonly lagoas: readonly LagoaRasa[]
  readonly texturas: PacoteTexturasBioma | null
  readonly spec: SpecQualidadeGrafica
}

export const AguaBiomaShader: React.FC<AguaBiomaShaderProps> = ({
  state,
  bioma,
  lagoas,
  texturas,
  spec,
}) => {
  const cat = BIOMA_VISUAL_CATALOG[bioma]

  const waterShader = useMemo(() => {
    return new ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uRasa: { value: new Color(cat.aguaCorRasa) },
        uFunda: { value: new Color(cat.aguaCorFunda) },
        uEspuma: { value: new Color(cat.aguaEspumaCor) },
        uCongelada: { value: cat.aguaCongelada ? 1.0 : 0.0 },
        uEmissiva: { value: cat.aguaEmissiva ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uRasa;
        uniform vec3 uFunda;
        uniform vec3 uEspuma;
        uniform float uCongelada;
        uniform float uEmissiva;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float onda1 = sin(p.x * 11.0 + uTime * 2.1 + p.y * 5.0) * 0.5 + 0.5;
          float onda2 = cos(p.y * 13.0 - uTime * 1.7 + p.x * 4.0) * 0.5 + 0.5;
          float ond = (onda1 + onda2) * 0.5;
          vec3 cor = mix(uFunda, uRasa, clamp(r * 0.85 + ond * 0.18, 0.0, 1.0));
          float borda = smoothstep(0.76, 0.98, r + (ond - 0.5) * 0.07);
          cor = mix(cor, uEspuma, borda * (uCongelada > 0.5 ? 0.65 : 0.48));
          if (uCongelada > 0.5) {
            float brilhoGelo = smoothstep(0.65, 0.95, onda1 * onda2);
            cor += vec3(0.25, 0.35, 0.45) * brilhoGelo;
          } else if (uEmissiva > 0.5) {
            cor += uEspuma * (0.25 + 0.25 * ond);
          } else {
            float reflexo = smoothstep(0.78, 0.98, ond);
            cor += vec3(0.22, 0.28, 0.32) * reflexo;
          }
          float alpha = uCongelada > 0.5 ? 0.88 : (uEmissiva > 0.5 ? 0.92 : 0.78);
          gl_FragColor = vec4(cor, alpha);
        }
      `,
    })
  }, [])

  useEffect(() => {
    waterShader.uniforms.uRasa.value.set(cat.aguaCorRasa)
    waterShader.uniforms.uFunda.value.set(cat.aguaCorFunda)
    waterShader.uniforms.uEspuma.value.set(cat.aguaEspumaCor)
    waterShader.uniforms.uCongelada.value = cat.aguaCongelada ? 1.0 : 0.0
    waterShader.uniforms.uEmissiva.value = cat.aguaEmissiva ? 1.0 : 0.0
  }, [waterShader, cat.aguaCorRasa, cat.aguaCorFunda, cat.aguaEspumaCor, cat.aguaCongelada, cat.aguaEmissiva])

  useEffect(() => {
    return () => {
      waterShader.dispose()
    }
  }, [waterShader])

  useFrame((_, dt) => {
    if (!spec.aguaAnimada) return
    waterShader.uniforms.uTime.value += Math.min(dt, 0.05)
  })

  const matKey = texturas ? `pbr-${texturas.bioma}-${texturas.resolucao}` : `solid-${bioma}`

  return (
    <group name="agua-bioma">
      {lagoas.map((lagoa, idx) => {
        const visivel = !PARTIDA.nuvem || chaoRevelado(state, lagoa.x, lagoa.z)
        if (!visivel) return null
        return (
          <group key={`lagoa-vis-${idx}`} position={[lagoa.x, -0.41, lagoa.z]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[lagoa.rx + 0.65, lagoa.rz + 0.65, 1]}
              receiveShadow={spec.sombrasAtivas}
              raycast={semRaycast}
            >
              <circleGeometry args={[1, 28]} />
              <meshStandardMaterial
                key={`margem-${idx}-${matKey}`}
                color={texturas ? '#ffffff' : cat.margemCorBase}
                map={texturas?.margem.map ?? null}
                normalMap={texturas?.margem.normalMap ?? null}
                roughness={0.92}
              />
            </mesh>
            {spec.aguaAnimada ? (
              <mesh
                position={[0, 0.035, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[lagoa.rx, lagoa.rz, 1]}
                raycast={semRaycast}
                material={waterShader}
              >
                <circleGeometry args={[1, 28]} />
              </mesh>
            ) : (
              <mesh
                position={[0, 0.035, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[lagoa.rx, lagoa.rz, 1]}
                raycast={semRaycast}
              >
                <circleGeometry args={[1, 20]} />
                <meshStandardMaterial
                  color={cat.aguaCorRasa}
                  transparent
                  opacity={0.78}
                  roughness={0.22}
                  metalness={0.15}
                />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}
