import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import { Color, DataTexture, DoubleSide, LinearFilter, RedFormat, ShaderMaterial, UnsignedByteType } from 'three'
import type { Olhar } from '../partidaPolicies'
import type { PartidaState } from '../partidaSim'
import { semRaycast } from '../raycastCena'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { DECLARACOES_DA_NEVOA, OPACIDADE_MINIMA_DA_NEVOA } from './glslDaNevoa'
import { dadosDaNevoa, LADO_NEVOA, misturarNevoa } from './nevoaDeGuerra'
import { Y_SOLO_VISUAL } from './suporteFundacao'

/**
 * A névoa de guerra PINTADA no chão (24/11/2026, estilo Age of Empires). Um ÚNICO plano translúcido sobre o terreno, com uma textura de 113×113 que diz, para cada célula de 1 m, se ela nunca foi
 * vista (escura), já foi vista (escurecida e fria) ou está à vista agora (clara). Substitui as 12.769 colunas cinza (141.120 triângulos, 98,9 % da cena, medido) por 2 triângulos.
 *
 * DECISÃO DE PROJETO: é um plano SEPARADO, e não uma injeção no shader do material PBR do terreno (`onBeforeCompile`, o risco 11 do plano). Assim o terreno de F2 (relevo) pode trocar de material
 * sem reescrever a névoa, a chave `PARTIDA.nevoaPintada` liga e desliga o plano sem tocar em material nenhum, e um erro de shader aqui não derruba o chão. O plano só pinta o CHÃO: esconder o que
 * está em cima dele (inimigos, obras e árvores fora da vista) continua sendo trabalho da simulação (`cobertoAgora`, `paisagemNaturalVisivel`), como já é hoje.
 *
 * `raycast={semRaycast}`: o plano NUNCA captura o clique, que segue para o chão de baixo (o mesmo contrato do muro da borda).
 */

/**
 * Altura do plano acima do chão visual (m). Tem de ficar ACIMA do topo de tudo o que é raso no chão, senão esse cenário aparece através da névoa (visto na foto de 24/11: a estrada de pedra
 * cruzava a região «nunca vista»). A estrada é uma caixa de 0,2 m centrada em −0,35 (topo em −0,25) e os MEIOS-FIOS são caixas de 0,28 m centradas em −0,31 (topo em −0,17: sobem mais que a
 * estrada). O comentário antigo só falava da estrada e o plano ficou em −0,22: os meios-fios furavam a névoa e desenhavam duas linhas claras nas bordas da estrada «nunca vista» (visto em 24/11,
 * medido na cena viva). Agora o plano fica em −0,12: 5 cm ACIMA do meio-fio (sem z-fighting) e 12 cm ABAIXO do pé de quem anda (y = 0; a névoa nunca corta o herói nem as tropas).
 * `flagstone.test.ts` LÊ as alturas do código do terreno e trava as duas fronteiras: quem subir um cenário raso acima de −0,12 verá o teste falhar. As margens das lagoas e as fundações ficam
 * abaixo disso. As colunas antigas escondiam a estrada «de graça» (eram altas); o plano raso precisa fazer isso de propósito.
 */
// EXPORTADA (25/11): o terreno com relevo monta a SAIA que fecha o «fio azul» com esta MESMA constante (uma parede da quina do terreno até o plano). Se o plano subir ou descer e a saia
// ficar com outro número, o fio volta em silêncio; por isso o terreno IMPORTA daqui e um teste trava que o topo da saia é este valor, não um literal.
export const ALTURA_DO_PLANO = 0.33

/**
 * O plano é MAIOR que o quadrado (112 m): a câmera do Império olha muito além da borda do mapa e, com um plano do tamanho exato, o fundo da cena (o céu) aparecia nos cantos como um triângulo
 * azul (visto na foto de 24/11). A textura continua 113×113 e cobre só o quadrado: o vertex shader calcula a UV pela POSIÇÃO NO MUNDO (`x / 112 + 0,5`), e não pela UV do plano (que
 * esticaria a textura sobre o plano grande). Fora do quadrado a UV sai de [0, 1] e o `ClampToEdge` repete o texel da borda, que fica «nunca visto» (escuro) nas quatro beiras. O fator 6
 * cobre a câmera mais alta (zoom máximo 1,8 → 61 m de altura) com folga.
 */
const FATOR_DO_PLANO = 6

/** A cor e a opacidade da névoa por olhar. 1ª e 3ª pessoa: a bruma tem a COR DO HORIZONTE do bioma e dissolve o limite, sem parede. Império: escuro de verdade (preto quente), como no jogo de referência. */
export interface ConfigNevoa {
  readonly corNunca: string
  readonly opacidadeNunca: number
  readonly corJa: string
  readonly opacidadeJa: number
}

export function configNevoa(olhar: Olhar, corBruma: string): ConfigNevoa {
  if (olhar === 'imperio') {
    return { corNunca: '#06070c', opacidadeNunca: 0.94, corJa: '#0e1424', opacidadeJa: 0.5 }
  }
  return { corNunca: corBruma, opacidadeNunca: 0.9, corJa: '#1b2336', opacidadeJa: 0.42 }
}

export interface NevoaPintadaProps {
  /**
   * A REF do estado da cena, e não o estado por valor. `sim.current` é reescrita pelo laço do jogo a cada passo, mas `Cena` só re-renderiza quando o React decide: guardar o valor recebido no
   * render deixaria a névoa lendo um estado VELHO nos quadros sem render (e congelada sem erro nenhum). Lê-se `sim.current` dentro do `useFrame`, como `TropasCena` faz.
   */
  readonly sim: React.MutableRefObject<PartidaState>
  /**
   * Uma SEGUNDA REF (F2, 25/11/2026): `true` quando o relevo está VISÍVEL e cobre o quadrado (a chave ligada E o campo pronto, a mesma condição de `CenaBiomaVisual`). Então o plano é recortado em todo
   * o quadrado e o chão com relevo cuida da névoa ali (o plano fica só no anel de fora). É REF e não valor pela mesma razão de `sim`: um valor guardado no render ficaria velho quando `Cena` não re-renderiza.
   * Desligado (`false`, o inicial) o plano é o de hoje, inteiro (I1).
   */
  readonly relevoCobre: React.MutableRefObject<boolean>
  /**
   * A SAÍDA (F2, passo (a4), 25/11/2026): a névoa PUBLICA aqui `material.uniforms` (o MESMO objeto, não uma cópia), e o chão com relevo (`TerrenoRelevoCena`, um irmão em `Cena`) as COPIA a cada quadro
   * para injetar a mesma névoa no próprio shader. Opcional (a cena de antes, sem relevo, não passa e nada muda). É REF pelo mesmo motivo das outras: `CenaBiomaVisual` monta ANTES desta névoa, então
   * o chão não pode contar com a ref já cheia no 1º compile; o estado seguro dele é «tudo coberto».
   */
  readonly uniformsPublicas?: React.MutableRefObject<Record<string, { value: unknown }> | null>
}

const VERTEX = /* glsl */ `
  uniform float uLadoMundo;
  varying vec2 vUv;
  void main() {
    // O plano está deitado (rotação −90° em X): position.x é o leste e position.y é o NORTE do mundo com o sinal trocado pela rotação. A UV da textura é a posição normalizada pelo lado do
    // QUADRADO, não do plano: o quadrado ocupa [0, 1] e o excedente cai fora, onde o ClampToEdge repete a borda.
    vUv = vec2(position.x / uLadoMundo + 0.5, -position.y / uLadoMundo + 0.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * O fragmento lê a máscara (0 = nunca visto, 0,5 = já visto, 1 = visível agora) e a SUAVIZA por filtro linear (a textura é 113×113 para um plano de 113 m: um texel por metro). A borda ganha um
 * leve ruído animado em baixa velocidade para parecer nuvem viva avançando, e nunca um círculo geométrico duro.
 */
const FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uRelevoCobre;
  ${DECLARACOES_DA_NEVOA}

  void main() {
    // Com o relevo cobrindo, o chão (o próprio terreno) cuida da névoa DENTRO do quadrado inteiro; o plano só continua FORA dele (a câmera do Império olha além da borda). Desligado
    // (uRelevoCobre = 0) este teste nunca dispara e o plano é o de hoje.
    if (uRelevoCobre > 0.5 && vUv.x >= 0.0 && vUv.x <= 1.0 && vUv.y >= 0.0 && vUv.y <= 1.0) discard;
    vec4 nevoa = corDaNevoa(vUv);
    if (nevoa.a < ${OPACIDADE_MINIMA_DA_NEVOA}) discard;
    gl_FragColor = nevoa;
  }
`

export const NevoaPintada: React.FC<NevoaPintadaProps> = ({ sim, relevoCobre, uniformsPublicas }) => {
  const alvoRef = useRef<Uint8Array>(new Uint8Array(LADO_NEVOA * LADO_NEVOA))
  const versaoRef = useRef(-1)
  const olharRef = useRef<Olhar | null>(null)
  const ultimaMarca = useRef(0)

  const textura = useMemo(() => {
    const dados = new Uint8Array(LADO_NEVOA * LADO_NEVOA)
    const t = new DataTexture(dados, LADO_NEVOA, LADO_NEVOA, RedFormat, UnsignedByteType)
    t.magFilter = LinearFilter
    t.minFilter = LinearFilter
    t.generateMipmaps = false
    t.needsUpdate = true
    return t
  }, [])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uMapa: { value: textura },
          uLadoMundo: { value: LADO_NEVOA - 1 },
          uTempo: { value: 0 },
          uRelevoCobre: { value: 0 },
          uCorNunca: { value: new Color('#06070c') },
          uOpNunca: { value: 0.94 },
          uCorJa: { value: new Color('#0e1424') },
          uOpJa: { value: 0.5 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
      }),
    [textura],
  )

  useEffect(
    () => () => {
      textura.dispose()
      material.dispose()
    },
    [textura, material],
  )

  // Publica as uniforms para o chão com relevo copiar (efeito, não render: escrever numa ref no render é impuro e o StrictMode o repetiria). A limpeza só zera a ref se ela ainda for a DESTE
  // material: se uma instância nova já publicou as dela, não a apaga.
  useEffect(() => {
    if (!uniformsPublicas) return undefined
    uniformsPublicas.current = material.uniforms
    return () => {
      if (uniformsPublicas.current === material.uniforms) uniformsPublicas.current = null
    }
  }, [material, uniformsPublicas])

  useFrame((_, dt) => {
    // O ESTADO é lido AQUI, a cada quadro (`sim.current`), e o olhar e a cor da bruma se derivam dele: nada vem do render de `Cena`, que pode estar atrasado. Mesma regra de desenho da
    // `CenaBiomaVisual` (`semCorpo` ⇒ Império), e a bruma tem a cor do horizonte do bioma ATUAL.
    const s = sim.current
    const olhar: Olhar = s.semCorpo ? 'imperio' : s.olhar
    const cfg = configNevoa(olhar, BIOMA_VISUAL_CATALOG[s.bioma].ceuHorizonte)
    const u = material.uniforms
    u.uCorNunca.value.set(cfg.corNunca)
    u.uOpNunca.value = cfg.opacidadeNunca
    u.uCorJa.value.set(cfg.corJa)
    u.uOpJa.value = cfg.opacidadeJa
    u.uTempo.value += Math.min(dt, 0.05)
    u.uRelevoCobre.value = relevoCobre.current ? 1 : 0

    // a máscara só é recalculada quando o chão visto muda (versaoChao) ou quando o corpo se move para outra célula; o herói e as tropas se movem sempre, então recalcula a cada ~0,1 s
    const agora = performance.now()
    if (versaoRef.current !== s.versaoChao || olharRef.current !== olhar || agora - ultimaMarca.current > 100) {
      alvoRef.current = dadosDaNevoa(s)
      versaoRef.current = s.versaoChao
      olharRef.current = olhar
      ultimaMarca.current = agora
    }
    const dados = textura.image.data as Uint8Array
    if (misturarNevoa(dados, alvoRef.current, Math.min(dt, 0.05), 0.35)) textura.needsUpdate = true
  })

  return (
    <mesh
      name="nevoa-pintada"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, Y_SOLO_VISUAL + ALTURA_DO_PLANO, 0]}
      material={material}
      raycast={semRaycast}
      renderOrder={4}
    >
      <planeGeometry args={[(LADO_NEVOA - 1) * FATOR_DO_PLANO, (LADO_NEVOA - 1) * FATOR_DO_PLANO]} />
    </mesh>
  )
}
