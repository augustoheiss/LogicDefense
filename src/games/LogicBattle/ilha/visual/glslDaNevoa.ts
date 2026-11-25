/**
 * O GLSL DA NÉVOA COMPARTILHADO (F2, passo (a1), 25/11/2026). A névoa pintada é desenhada por DOIS materiais que têm de parecer UM: o plano grande de fora do quadrado (`NevoaPintada`) e, com o
 * relevo ligado, o próprio chão (a névoa injetada no shader do terreno). Cada um com a sua cópia do cálculo faria aparecer uma costura a 56 m do centro no dia em que alguém afinasse só um deles.
 * Por isso a função vive aqui, num único texto, e os dois materiais a incluem.
 *
 * O texto é o do `NevoaPintada.tsx` de 24/11 SEM MUDANÇA DE COMPORTAMENTO (I1: com a chave do relevo desligada o jogo tem de ser o de hoje): só foi movido para cá, com o nome `corDaNevoa`, e a
 * saída passou de `gl_FragColor` + `discard` para um `vec4` (rgb, opacidade) para a mesma função servir ao terreno OPACO (que não descarta: mistura a cor).
 *
 * LIMITE HONESTO: o ruído (`hash` com `sin(dot(…)) · 43758.5453`) depende da precisão de float da GPU e não é reproduzível em JS bit a bit. O avaliador `nevoaSemRuido` reproduz só a parte determinística.
 */

/** O que o fragmento declara: as uniforms (com os MESMOS nomes nos dois materiais), o ruído e `corDaNevoa`. */
export const DECLARACOES_DA_NEVOA = /* glsl */ `
  uniform sampler2D uMapa;
  uniform float uTempo;
  uniform vec3 uCorNunca;
  uniform float uOpNunca;
  uniform vec3 uCorJa;
  uniform float uOpJa;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruido(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // (rgb, opacidade) da névoa neste ponto. A máscara vale 0 (nunca visto), 0,5 (já visto) e 1 (visível agora). A opacidade 0 (ou abaixo de 0,004) significa «chão limpo».
  vec4 corDaNevoa(vec2 uvDaNevoa) {
    float m = texture2D(uMapa, uvDaNevoa).r;
    // A BORDA é o que fica ENTRE os patamares (0, 0,5 e 1): o filtro linear a deixa com ~1 m de largura. Ali o ruído lento (±0,07) a faz ondular como nuvem viva; no CENTRO de uma região
    // (m exatamente num patamar) a «distância ao patamar» é 0 e o ruído não age, então a névoa nunca vaza para dentro do que está limpo.
    float distPatamar = abs(m - floor(m * 2.0 + 0.5) * 0.5);
    float naBorda = smoothstep(0.0, 0.12, distPatamar);
    float onda = (ruido(uvDaNevoa * 113.0 * 0.35 + vec2(uTempo * 0.05, -uTempo * 0.04)) - 0.5) * 0.14;
    m = clamp(m + onda * naBorda, 0.0, 1.0);

    // 0 → nunca visto, 0,5 → já visto, 1 → visível agora
    float visto = smoothstep(0.02, 0.5, m);
    float agora = smoothstep(0.5, 0.98, m);
    vec3 cor = mix(uCorNunca, uCorJa, visto);
    float opac = mix(uOpNunca, uOpJa, visto);
    opac = mix(opac, 0.0, agora);
    return vec4(cor, opac);
  }
`

/** A opacidade abaixo da qual o plano descarta o pixel (o chão aparece limpo). O fragmento do plano a compara; o do terreno a usa para não misturar um fio de cor. */
export const OPACIDADE_MINIMA_DA_NEVOA = 0.004

export interface ConfigDaNevoaJs {
  readonly corNunca: readonly number[]
  readonly opNunca: number
  readonly corJa: readonly number[]
  readonly opJa: number
}

function smoothstepJs(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * O MESMO cálculo de `corDaNevoa` SEM o ruído (a parte determinística), para o Node provar os patamares e as misturas. Devolve `null` quando o GLSL descartaria o pixel (opacidade abaixo de
 * `OPACIDADE_MINIMA_DA_NEVOA`). Com `m` exatamente num patamar o ruído nem age (`naBorda` = 0), então para esses valores o resultado é o do GLSL inteiro.
 */
export function nevoaSemRuido(m: number, cfg: ConfigDaNevoaJs): { cor: number[]; opacidade: number } | null {
  const visto = smoothstepJs(0.02, 0.5, m)
  const agora = smoothstepJs(0.5, 0.98, m)
  const cor = cfg.corNunca.map((c, i) => c + (cfg.corJa[i] - c) * visto)
  let opac = cfg.opNunca + (cfg.opJa - cfg.opNunca) * visto
  opac = opac + (0 - opac) * agora
  return opac < OPACIDADE_MINIMA_DA_NEVOA ? null : { cor, opacidade: opac }
}
