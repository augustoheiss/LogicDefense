import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, DataTexture, Float32BufferAttribute, ShaderMaterial, Uint32BufferAttribute } from 'three'
import type { BiomaId } from '../biomaRecursos'
import { semRaycast } from '../raycastCena'
import type { Rio } from '../relevo/aguaDoMundo'
import { geometriaDaFita, LARGURA_DA_FITA, PASSO_DA_FITA } from '../relevo/geometriaDaAgua'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { DECLARACOES_DA_NEVOA } from './glslDaNevoa'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import { Y_SOLO_VISUAL } from './suporteFundacao'

/**
 * A FITA D'ÁGUA DO RIO (F2, Task 4, 26/11/2026): a água de UM rio dentro de UM quadrado, só desenho. Um `ShaderMaterial` PRÓPRIO, e não o `waterShader` das lagoas, por três razões medidas no código (auditoria externa):
 * (1) o `waterShader` não lê a névoa de guerra: com o relevo ligado o plano da `NevoaPintada` faz `discard` dentro do quadrado (a névoa passa a morar no shader do chão), e uma fita ordenada por `renderOrder` brilharia
 * INTEIRA sobre a área preta; esta aplica a névoa no PRÓPRIO fragmento (`corDaNevoa`) e a água SOME onde ela cobre; (2) o `waterShader` é RADIAL (`r = length(p)`): numa fita `vUv.y` varia ao longo do rio e `r` estoura até
 * no centro (espuma no meio); aqui a margem é `abs(vUv.x * 2.0 - 1.0)`; (3) a altura: o `<mesh>` fica em `Y_SOLO_VISUAL` como o terreno, e a geometria guarda o nível NA ESCALA DO CAMPO (somar `Y_AGUA_VISUAL` subiria a
 * água 7,5 cm acima da valeta que o gerador escavou).
 */

/** A opacidade da água onde a névoa não a cobre: a mesma do `waterShader` das lagoas. */
export const ALFA_DA_AGUA = 0.78

/**
 * O ESCURECIMENTO da água do rio (proposta, 26/11/2026, da revisão independente): o ciano do catálogo do bosque (`#2dd4bf`) é ~3× mais claro que a grama (luminância mediana 132 contra ~40, medido nas fotos 03/06/07). O fator
 * multiplica a cor da água SÓ na fita, ANTES da mistura com a névoa: o catálogo é COMPARTILHADO com as lagoas de hoje e mexer nele mudaria o jogo com a chave desligada (I1). É decisão de ARTE do usuário: 1,0 devolve a cor de antes.
 * MEDIDO na foto de Império (Bonito), luminância mediana da água contra a da grama: fator 1,00 → 1,89× (ciano vibrante); fator 0,62 → 1,18× (a água quase some: a primeira proposta, passou do ponto); fator 0,80 → ~1,5× (previsto por
 * extrapolação linear, que reproduziu a foto velha: 1,91 previsto contra 1,89 medido). Trocar o número é UMA linha.
 */
export const ESCURECER_O_RIO = 0.80

/** O GLSL do rio, em texto (o contrato de texto o lê): o vértice calcula a UV da névoa a partir da posição LOCAL, como `nevoaNoTerreno.ts`; o fragmento mistura a cor da água com a névoa. */
export const GLSL_DO_RIO = {
  vertice: /* glsl */ `
    varying vec2 vUv;
    varying vec2 vUvNevoa;
    void main() {
      vUv = uv;
      vUvNevoa = vec2(position.x / 112.0 + 0.5, position.z / 112.0 + 0.5);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmento: /* glsl */ `
    ${DECLARACOES_DA_NEVOA}
    uniform float uTempoDaAgua;
    uniform vec3 uRasa;
    uniform vec3 uFunda;
    uniform vec3 uEspuma;
    uniform float uCongelada;
    uniform float uEmissiva;
    varying vec2 vUv;
    varying vec2 vUvNevoa;
    const float ALFA_DA_AGUA = ${ALFA_DA_AGUA.toFixed(2)};
    const float LARGURA_DA_FITA_M = ${LARGURA_DA_FITA.toFixed(1)};
    const float ESCURECER_O_RIO = ${ESCURECER_O_RIO.toFixed(2)};
    void main() {
      float margem = abs(vUv.x * 2.0 - 1.0);
      // as ONDAS são ruído de valor 2D em METROS globais, em DUAS oitavas que andam em direções diferentes (a corrente e a ondulação): vUv.y já é metro global (contínuo nas emendas) e vUv.x * LARGURA_DA_FITA_M
      // põe o ruído em metros também em x. ond é a mistura 0,65/0,35, a fórmula MEDIDA; onda1 e onda2 ficam definidas (o ramo CONGELADO as usa: tundra). Sem crases aqui: este texto mora num template literal.
      float xm = vUv.x * LARGURA_DA_FITA_M;
      float onda1 = ruido(vec2(xm * 0.55 + uTempoDaAgua * 0.07, vUv.y * 0.55 - uTempoDaAgua * 0.35));
      float onda2 = ruido(vec2(xm * 1.3 - uTempoDaAgua * 0.11, vUv.y * 1.3 - uTempoDaAgua * 0.52 + 17.0));
      float ond = onda1 * 0.65 + onda2 * 0.35;
      vec3 cor = mix(uFunda, uRasa, clamp(margem * 0.85 + ond * 0.18, 0.0, 1.0));
      float borda = smoothstep(0.76, 0.98, margem + (ond - 0.5) * 0.07);
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
      cor *= ESCURECER_O_RIO;
      vec4 nevoa = corDaNevoa(vUvNevoa);
      gl_FragColor = vec4(mix(cor, nevoa.rgb, nevoa.a), ALFA_DA_AGUA * (1.0 - smoothstep(0.5, 0.9, nevoa.a)) * (1.0 - smoothstep(0.82, 1.0, margem)));
    }
  `,
}

/** Os nomes das 6 uniforms da névoa (os MESMOS de `DECLARACOES_DA_NEVOA`): a fita as copia da `NevoaPintada` pelo nome, como o terreno. */
const UNIFORMS_DA_NEVOA = ['uMapa', 'uTempo', 'uCorNunca', 'uOpNunca', 'uCorJa', 'uOpJa'] as const

export interface OpcoesDoMaterialDoRio {
  readonly bioma: BiomaId
}

/**
 * O material do rio: as 6 uniforms da névoa nascem num ESTADO SEGURO («tudo coberto»: `uOpNunca` = 0,94, a água some), nunca vazias, porque no 1º compile a `NevoaPintada` pode ainda não ter montado (a `CenaBiomaVisual` monta
 * ANTES dela em `Cena`). Por um quadro o erro é esconder demais, nunca revelar o que o jogador não viu.
 */
export function criarMaterialDoRio({ bioma }: OpcoesDoMaterialDoRio): ShaderMaterial {
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  const vazio = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  vazio.needsUpdate = true
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMapa: { value: vazio },
      uTempo: { value: 0 },
      uCorNunca: { value: new Color('#06070c') },
      uOpNunca: { value: 0.94 },
      uCorJa: { value: new Color('#0c1018') },
      uOpJa: { value: 0.5 },
      uTempoDaAgua: { value: 0 },
      uRasa: { value: new Color(cat.aguaCorRasa) },
      uFunda: { value: new Color(cat.aguaCorFunda) },
      uEspuma: { value: new Color(cat.aguaEspumaCor) },
      uCongelada: { value: cat.aguaCongelada ? 1.0 : 0.0 },
      uEmissiva: { value: cat.aguaEmissiva ? 1.0 : 0.0 },
    },
    vertexShader: GLSL_DO_RIO.vertice,
    fragmentShader: GLSL_DO_RIO.fragmento,
  })
}

export interface FitaDoRioProps {
  readonly rio: Rio
  readonly i: number
  readonly j: number
  readonly bioma: BiomaId
  readonly spec: SpecQualidadeGrafica
  /** As uniforms da NÉVOA pintada, publicadas pela `NevoaPintada`: a MESMA ref que o terreno lê (nenhuma cópia). */
  readonly nevoaUniforms?: React.MutableRefObject<Record<string, { value: unknown }> | null>
}

export const FitaDoRio: React.FC<FitaDoRioProps> = ({ rio, i, j, bioma, spec, nevoaUniforms }) => {
  const geometria = useMemo(() => {
    const g = geometriaDaFita(rio, { i, j }, PASSO_DA_FITA)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(g.posicoes, 3))
    geo.setAttribute('uv', new Float32BufferAttribute(g.uvs, 2))
    geo.setIndex(new Uint32BufferAttribute(g.indices, 1))
    return geo
  }, [rio, i, j])
  const material = useMemo(() => criarMaterialDoRio({ bioma }), [bioma])
  useEffect(() => {
    return () => {
      geometria.dispose()
    }
  }, [geometria])
  useEffect(() => {
    // A textura 1×1 que o material criou, CAPTURADA AGORA: depois do 1º quadro o `useFrame` troca `uniforms.uMapa.value` pela textura VIVA da `NevoaPintada` (a mesma que o terreno lê), e descartar
    // `uniforms.uMapa.value` no cleanup apagaria o mapa de névoa do jogo inteiro (e a 1×1 vazaria na GPU). É a mesma forma do `TerrenoRelevoCena`.
    const vazio = material.uniforms.uMapa.value as DataTexture
    return () => {
      vazio.dispose()
      material.dispose()
    }
  }, [material])

  useFrame((_, dt) => {
    // a névoa: copia o que a `NevoaPintada` publicou (textura viva, tempo, cores, opacidades). Sem ela (ainda não montou) o estado seguro fica.
    const publicas = nevoaUniforms?.current
    if (publicas) {
      for (const nome of UNIFORMS_DA_NEVOA) {
        const fonte = publicas[nome]
        if (fonte) material.uniforms[nome].value = fonte.value
      }
    }
    // a água só anima com `spec.aguaAnimada` (o Leve não anima, como o `AguaBiomaShader`)
    if (spec.aguaAnimada) material.uniforms.uTempoDaAgua.value += Math.min(dt, 0.05)
  })

  if (geometria.index === null || geometria.index.count === 0) return null
  return <mesh name="rio" geometry={geometria} material={material} position={[0, Y_SOLO_VISUAL, 0]} raycast={semRaycast} />
}
