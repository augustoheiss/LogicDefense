import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import {
  CircleGeometry,
  Color,
  DataTexture,
  LinearFilter,
  RedFormat,
  RingGeometry,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
} from 'three'
import type { PartidaState } from '../partidaSim'
import { semRaycast } from '../raycastCena'
import { desnivelDoChao, type ChaoDoDesenho } from '../relevo/alturaVisual'
import { DECLARACOES_DA_NEVOA } from './glslDaNevoa'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import { avaliarRespostasDoMundo } from './respostasDoMundo'
import { Y_SOLO_VISUAL } from './suporteFundacao'

const UNIFORMS_DA_NEVOA = ['uMapa', 'uTempo', 'uCorNunca', 'uOpNunca', 'uCorJa', 'uOpJa'] as const

export interface EfeitosDeJogoProps {
  readonly state: PartidaState
  readonly campo?: ChaoDoDesenho
  readonly spec: SpecQualidadeGrafica
  readonly ativo: boolean
  readonly movimentoReduzido: boolean
  readonly noSubsolo: boolean
  readonly nevoaUniforms?: React.MutableRefObject<Record<string, { value: unknown }> | null>
}

export const EfeitosDeJogo: React.FC<EfeitosDeJogoProps> = ({
  state,
  campo,
  spec,
  ativo,
  movimentoReduzido,
  noSubsolo,
  nevoaUniforms,
}) => {
  const resp = avaliarRespostasDoMundo(state, {
    ativo,
    movimentoReduzido,
    noSubsolo,
    qualidade: spec.efetiva,
  })

  const discoGeo = useMemo(() => new CircleGeometry(1, 32), [])
  const anelGeo = useMemo(() => new RingGeometry(0.76, 1.0, 36), [])
  useEffect(() => {
    return () => {
      discoGeo.dispose()
      anelGeo.dispose()
    }
  }, [discoGeo, anelGeo])

  const corrupcaoMat = useMemo(() => {
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
        uIntensidade: { value: 0.4 },
        uTempoF5: { value: 0 },
        uCentro: { value: new Vector2(0, 0) },
        uRaio: { value: 6 },
      },
      vertexShader: /* glsl */ `
        uniform vec2 uCentro;
        uniform float uRaio;
        varying vec2 vUvLocal;
        varying vec2 vUvNevoa;
        void main() {
          vUvLocal = (uv - vec2(0.5)) * 2.0;
          vec2 mundoXZ = uCentro + position.xy * uRaio;
          vUvNevoa = vec2(mundoXZ.x / 112.0 + 0.5, mundoXZ.y / 112.0 + 0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${DECLARACOES_DA_NEVOA}
        uniform float uIntensidade;
        uniform float uTempoF5;
        varying vec2 vUvLocal;
        varying vec2 vUvNevoa;
        void main() {
          float dist = length(vUvLocal);
          if (dist > 1.0) discard;
          float n = ruido(vUvLocal * 7.5 + vec2(uTempoF5 * 0.08, -uTempoF5 * 0.06));
          float veia = smoothstep(0.68, 0.9, abs(n - 0.5) * 2.0);
          float borda = 1.0 - smoothstep(0.55, 1.0, dist);
          vec3 baseEscura = vec3(0.08, 0.04, 0.09);
          vec3 brasaHdr = vec3(1.55, 0.35, 0.14);
          vec3 cor = mix(baseEscura, brasaHdr, veia * uIntensidade);
          vec4 nevoa = corDaNevoa(vUvNevoa);
          float vis = 1.0 - smoothstep(0.5, 0.9, nevoa.a);
          float alpha = borda * uIntensidade * 0.68 * vis;
          if (alpha <= 0.004) discard;
          gl_FragColor = vec4(mix(cor, nevoa.rgb, nevoa.a), alpha);
        }
      `,
    })
  }, [])

  useEffect(() => {
    // Captura a textura 1×1 criada na montagem antes de `useFrame` copiar `uMapa` de `NevoaPintada`.
    const vazio = corrupcaoMat.uniforms.uMapa.value as DataTexture
    return () => {
      vazio.dispose()
      corrupcaoMat.dispose()
    }
  }, [corrupcaoMat])

  const pulsoAltarMat = useMemo(() => {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCor: { value: new Color(1.75, 1.25, 0.32) },
        uProgresso: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uCor;
        uniform float uProgresso;
        varying vec2 vUv;
        void main() {
          float fade = 1.0 - smoothstep(0.0, 1.0, uProgresso);
          if (fade <= 0.01) discard;
          gl_FragColor = vec4(uCor, fade * 0.85);
        }
      `,
    })
  }, [])

  const ondaMat = useMemo(() => {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTempo: { value: 0 },
        uIntensidade: { value: 0 },
      },
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTempo;
        uniform float uIntensidade;
        void main() {
          if (uIntensidade <= 0.01) discard;
          float pulso = 0.65 + 0.35 * sin(uTempo * 6.0);
          gl_FragColor = vec4(1.65, 0.22, 0.2, uIntensidade * pulso * 0.6);
        }
      `,
    })
  }, [])

  const nucleoMat = useMemo(() => {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTempo: { value: 0 },
        uAtivo: { value: 0 },
      },
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTempo;
        uniform float uAtivo;
        void main() {
          if (uAtivo <= 0.01) discard;
          float pulso = 0.55 + 0.45 * sin(uTempo * 3.8);
          gl_FragColor = vec4(0.45, 1.15, 1.75, pulso * 0.65);
        }
      `,
    })
  }, [])

  useEffect(() => {
    return () => {
      pulsoAltarMat.dispose()
      ondaMat.dispose()
      nucleoMat.dispose()
    }
  }, [pulsoAltarMat, ondaMat, nucleoMat])

  const ultimaAssinaturaRef = useRef<string | null>(null)
  const progressoPulsoRef = useRef(1)
  const tempoF5Ref = useRef(0)

  useEffect(() => {
    if (!resp.pulsoAltar) return
    if (ultimaAssinaturaRef.current === resp.pulsoAltar.assinatura) return
    ultimaAssinaturaRef.current = resp.pulsoAltar.assinatura
    progressoPulsoRef.current = 0
    if (resp.pulsoAltar.tipo === 'erro') {
      pulsoAltarMat.uniforms.uCor.value.setRGB(1.65, 0.28, 0.22)
    } else {
      pulsoAltarMat.uniforms.uCor.value.setRGB(1.85, 1.35, 0.35)
    }
  }, [resp.pulsoAltar, pulsoAltarMat])

  useFrame((_, dt) => {
    const passo = Math.min(dt, 0.05)
    if (resp.animado) {
      tempoF5Ref.current += passo
    }

    const publicas = nevoaUniforms?.current
    if (publicas) {
      for (const nome of UNIFORMS_DA_NEVOA) {
        const fonte = publicas[nome]
        if (fonte) corrupcaoMat.uniforms[nome].value = fonte.value
      }
    }

    corrupcaoMat.uniforms.uTempoF5.value = tempoF5Ref.current
    if (resp.corrupcao) {
      corrupcaoMat.uniforms.uIntensidade.value = resp.corrupcao.intensidade
      corrupcaoMat.uniforms.uCentro.value.set(resp.corrupcao.x, resp.corrupcao.z)
      corrupcaoMat.uniforms.uRaio.value = resp.corrupcao.raio
    }

    ondaMat.uniforms.uTempo.value = tempoF5Ref.current
    ondaMat.uniforms.uIntensidade.value = resp.intensidadeOnda

    nucleoMat.uniforms.uTempo.value = tempoF5Ref.current
    nucleoMat.uniforms.uAtivo.value = resp.pulsoNucleo ? 1 : 0

    if (progressoPulsoRef.current < 1) {
      progressoPulsoRef.current = Math.min(1, progressoPulsoRef.current + (resp.animado ? passo / 1.8 : 0.08))
      pulsoAltarMat.uniforms.uProgresso.value = progressoPulsoRef.current
    }
  })

  if (!resp.corrupcao && !resp.pulsoAltar && !resp.pulsoNucleo) return null

  const yCorrupcao = resp.corrupcao ? Y_SOLO_VISUAL + 0.05 + desnivelDoChao(campo, resp.corrupcao.x, resp.corrupcao.z) : 0
  const yAltar = resp.pulsoAltar ? Y_SOLO_VISUAL + 0.07 + desnivelDoChao(campo, resp.pulsoAltar.cx, resp.pulsoAltar.cz) : 0
  const yNucleo = resp.pulsoNucleo ? Y_SOLO_VISUAL + 0.08 + desnivelDoChao(campo, resp.pulsoNucleo.x, resp.pulsoNucleo.z) : 0
  const escalaPulso = 1.6 + progressoPulsoRef.current * 9.5

  return (
    <group name="efeitos-de-jogo-f5">
      {resp.corrupcao && (
        <mesh
          name="corrupcao-base-inimiga"
          geometry={discoGeo}
          material={corrupcaoMat}
          position={[resp.corrupcao.x, yCorrupcao, resp.corrupcao.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[resp.corrupcao.raio, resp.corrupcao.raio, 1]}
          raycast={semRaycast}
        />
      )}
      {resp.corrupcao && resp.intensidadeOnda > 0 && (
        <mesh
          name="alerta-onda-iminente"
          geometry={anelGeo}
          material={ondaMat}
          position={[resp.corrupcao.x, yCorrupcao + 0.02, resp.corrupcao.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[resp.corrupcao.raio * 0.92, resp.corrupcao.raio * 0.92, 1]}
          raycast={semRaycast}
        />
      )}
      {resp.pulsoAltar && (
        <mesh
          name="pulso-altar-conta"
          geometry={anelGeo}
          material={pulsoAltarMat}
          position={[resp.pulsoAltar.cx, yAltar, resp.pulsoAltar.cz]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[escalaPulso, escalaPulso, 1]}
          raycast={semRaycast}
        />
      )}
      {resp.pulsoNucleo && (
        <mesh
          name="pulso-ressurreicao-nucleo"
          geometry={anelGeo}
          material={nucleoMat}
          position={[resp.pulsoNucleo.x, yNucleo, resp.pulsoNucleo.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[4.2, 4.2, 1]}
          raycast={semRaycast}
        />
      )}
    </group>
  )
}
