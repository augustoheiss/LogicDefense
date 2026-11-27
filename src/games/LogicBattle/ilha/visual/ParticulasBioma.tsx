import { useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
} from 'three'
import type { BiomaId } from '../biomaRecursos'
import { semRaycast } from '../raycastCena'
import { desnivelDoChao, type ChaoDoDesenho } from '../relevo/alturaVisual'
import { gerarParticulasBioma, perfilParticulaBioma } from './efeitosAmbiente'
import { DECLARACOES_DA_NEVOA } from './glslDaNevoa'
import { Y_SOLO_VISUAL } from './suporteFundacao'

const UNIFORMS_DA_NEVOA = ['uMapa', 'uTempo', 'uCorNunca', 'uOpNunca', 'uCorJa', 'uOpJa'] as const

export interface ParticulasBiomaProps {
  readonly mapaI: number
  readonly mapaJ: number
  readonly bioma: BiomaId
  readonly quantidade: number
  readonly campo?: ChaoDoDesenho
  readonly nevoaUniforms?: React.MutableRefObject<Record<string, { value: unknown }> | null>
}

export const ParticulasBioma: React.FC<ParticulasBiomaProps> = ({
  mapaI,
  mapaJ,
  bioma,
  quantidade,
  campo,
  nevoaUniforms,
}) => {
  const { gl } = useThree()
  const perfil = perfilParticulaBioma(bioma)

  const geometria = useMemo(() => {
    const lista = gerarParticulasBioma(mapaI, mapaJ, bioma, quantidade)
    const count = lista.length
    const posicoes = new Float32Array(count * 3)
    const fases = new Float32Array(count)
    const escalas = new Float32Array(count)
    const cores = new Float32Array(count * 3)
    const c1 = new Color(perfil.corPrimaria)
    const c2 = new Color(perfil.corSecundaria)
    const tmp = new Color()

    for (let k = 0; k < count; k += 1) {
      const p = lista[k]
      const chao = Y_SOLO_VISUAL + desnivelDoChao(campo, p.x, p.z)
      posicoes[k * 3] = p.x
      posicoes[k * 3 + 1] = chao + p.y
      posicoes[k * 3 + 2] = p.z
      fases[k] = p.fase
      escalas[k] = p.escala
      tmp.copy(c1).lerp(c2, p.misturaCor)
      cores[k * 3] = tmp.r
      cores[k * 3 + 1] = tmp.g
      cores[k * 3 + 2] = tmp.b
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(posicoes, 3))
    geo.setAttribute('aFase', new Float32BufferAttribute(fases, 1))
    geo.setAttribute('aEscala', new Float32BufferAttribute(escalas, 1))
    geo.setAttribute('aCor', new Float32BufferAttribute(cores, 3))
    geo.computeBoundingSphere()
    return geo
  }, [mapaI, mapaJ, bioma, quantidade, campo, perfil.corPrimaria, perfil.corSecundaria])

  useEffect(() => {
    return () => {
      geometria.dispose()
    }
  }, [geometria])

  const material = useMemo(() => {
    const vazio = new DataTexture(new Uint8Array([0]), 1, 1, RedFormat, UnsignedByteType)
    vazio.magFilter = LinearFilter
    vazio.minFilter = LinearFilter
    vazio.generateMipmaps = false
    vazio.needsUpdate = true

    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMapa: { value: vazio },
        uTempo: { value: 0 },
        uCorNunca: { value: new Color('#06070c') },
        uOpNunca: { value: 0.94 },
        uCorJa: { value: new Color('#0e1424') },
        uOpJa: { value: 0.5 },
        uTempoParticula: { value: 0 },
        uVelV: { value: perfil.velocidadeVertical },
        uDeriva: { value: perfil.derivaHorizontal },
        uTamanho: { value: perfil.tamanhoBase },
        uFaixaAltura: { value: Math.max(0.5, perfil.alturaMax - perfil.alturaMin) },
        uPixelRatio: { value: Math.min(2, gl.getPixelRatio()) },
      },
      vertexShader: /* glsl */ `
        attribute float aFase;
        attribute float aEscala;
        attribute vec3 aCor;
        uniform float uTempoParticula;
        uniform float uVelV;
        uniform float uDeriva;
        uniform float uTamanho;
        uniform float uFaixaAltura;
        uniform float uPixelRatio;
        varying vec3 vCor;
        varying vec2 vUvNevoa;
        void main() {
          vCor = aCor;
          vec3 p = position;
          float t = uTempoParticula + aFase * 1.7;
          p.x += sin(t * 0.7 + aFase) * uDeriva;
          p.z += cos(t * 0.55 + aFase * 1.3) * uDeriva;
          float deslocY = mod(uVelV * uTempoParticula + aFase * 0.9, uFaixaAltura);
          p.y += deslocY - uFaixaAltura * 0.25;
          vUvNevoa = vec2(p.x / 112.0 + 0.5, p.z / 112.0 + 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aEscala * uTamanho * uPixelRatio * (190.0 / max(-mv.z, 1.0)), 1.5, 20.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${DECLARACOES_DA_NEVOA}
        varying vec3 vCor;
        varying vec2 vUvNevoa;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float r = length(c);
          if (r > 0.5) discard;
          float brilho = smoothstep(0.5, 0.08, r);
          vec4 nevoa = corDaNevoa(vUvNevoa);
          float vis = 1.0 - smoothstep(0.45, 0.9, nevoa.a);
          if (vis <= 0.01) discard;
          gl_FragColor = vec4(mix(vCor, nevoa.rgb, nevoa.a * 0.5), brilho * 0.85 * vis);
        }
      `,
    })
    // uniforms dinâmicos atualizados pelo efeito abaixo; o vazio fica isolado até o cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])

  useEffect(() => {
    material.uniforms.uVelV.value = perfil.velocidadeVertical
    material.uniforms.uDeriva.value = perfil.derivaHorizontal
    material.uniforms.uTamanho.value = perfil.tamanhoBase
    material.uniforms.uFaixaAltura.value = Math.max(0.5, perfil.alturaMax - perfil.alturaMin)
  }, [material, perfil.velocidadeVertical, perfil.derivaHorizontal, perfil.tamanhoBase, perfil.alturaMax, perfil.alturaMin])

  useEffect(() => {
    // Captura a textura 1×1 criada aqui antes de o `useFrame` copiar a textura viva da `NevoaPintada`, evitando descartar o mapa compartilhado.
    const vazio = material.uniforms.uMapa.value as DataTexture
    return () => {
      vazio.dispose()
      material.dispose()
    }
  }, [material])

  useFrame((_, dt) => {
    const publicas = nevoaUniforms?.current
    if (publicas) {
      for (const nome of UNIFORMS_DA_NEVOA) {
        const fonte = publicas[nome]
        if (fonte) material.uniforms[nome].value = fonte.value
      }
    }
    material.uniforms.uTempoParticula.value += Math.min(dt, 0.05)
  })

  if (quantidade <= 0) return null
  return <points name="particulas-bioma" geometry={geometria} material={material} frustumCulled={false} raycast={semRaycast} />
}
