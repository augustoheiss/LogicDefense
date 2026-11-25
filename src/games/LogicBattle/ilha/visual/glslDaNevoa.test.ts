import { DECLARACOES_DA_NEVOA, nevoaSemRuido, OPACIDADE_MINIMA_DA_NEVOA } from './glslDaNevoa'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const sem = (t: string): string => t.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

/**
 * O GLSL DA NÉVOA COMPARTILHADO (F2, passo (a1), 25/11/2026). A névoa pintada é desenhada por DOIS materiais que têm de parecer UM: o plano grande de fora do quadrado (`NevoaPintada`) e, com o
 * relevo ligado, o próprio chão (injeção no shader do terreno). Se cada um tivesse a sua cópia do cálculo, a costura a 56 m do centro apareceria assim que alguém afinasse um dos dois. Por isso a
 * função vive num ÚNICO módulo de texto, e os dois a incluem.
 *
 * LIMITE HONESTO: o ruído (`hash` com `sin(dot(…)) · 43758.5453`) depende da precisão de float da GPU e NÃO é reproduzível em JS bit a bit. O Node não pode provar o ruído; prova (1) a FORMA do
 * GLSL (o que é declarado, o que é chamado, em que ordem), (2) a matemática SEM ruído (os patamares 0 / 0,5 / 1, as duas misturas e o descarte) contra o avaliador `nevoaSemRuido`, e (3) que
 * o ruído é LIMITADO (±0,07) por construção. A prova do efeito visual é a foto do Império lado a lado.
 */
export function run(): void {
  const decl = sem(DECLARACOES_DA_NEVOA)

  // FORMA: o que o módulo declara e o nome de cada peça (os dois materiais usam os MESMOS nomes de uniform: é isso que permite a mesma função servir aos dois)
  for (const u of ['uniform sampler2D uMapa;', 'uniform float uTempo;', 'uniform vec3 uCorNunca;', 'uniform float uOpNunca;', 'uniform vec3 uCorJa;', 'uniform float uOpJa;']) {
    assert(decl.includes(u), `as declarações trazem \`${u}\` (o MESMO nome nos dois materiais)`)
  }
  assert(/float hash\(vec2 p\)/.test(decl) && /float ruido\(vec2 p\)/.test(decl), 'as declarações trazem `hash` e `ruido` (o ruído que faz a borda ondular como nuvem viva)')
  assert(/vec4 corDaNevoa\(vec2 uvDaNevoa\)/.test(decl), 'a função `vec4 corDaNevoa(vec2 uvDaNevoa)` devolve (rgb, opacidade): UMA função para os dois materiais')
  assert((decl.match(/vec4 corDaNevoa\(/g) ?? []).length === 1, '`corDaNevoa` é definida UMA vez')

  // a MATEMÁTICA do patamar, lida do GLSL e comparada com o avaliador JS: extraio as constantes do texto, não as repito
  const lerNumero = (re: RegExp, nome: string): number => {
    const m = re.exec(decl)
    assert(m !== null, `o GLSL tem ${nome}`)
    return Number(m[1])
  }
  const limiarVisto = lerNumero(/float visto = smoothstep\(0\.0?2, ([\d.]+), m\)/, '`smoothstep(0.02, X, m)` do «já visto»')
  const agoraDe = lerNumero(/float agora = smoothstep\(([\d.]+), [\d.]+, m\)/, 'o início do «visível agora»')
  const agoraAte = lerNumero(/float agora = smoothstep\([\d.]+, ([\d.]+), m\)/, 'o fim do «visível agora»')
  assert(limiarVisto === 0.5 && agoraDe === 0.5 && agoraAte === 0.98, `os patamares do GLSL são 0,02→0,5 (visto) e 0,5→0,98 (agora); vieram ${limiarVisto}, ${agoraDe}, ${agoraAte}`)
  // O DESCARTE mudou de lugar de propósito: o GLSL original fazia `if (opac < 0.004) discard;` DENTRO do fragmento; agora `corDaNevoa` devolve a opacidade e quem chama decide (o plano descarta, o
  // terreno opaco mistura). O valor 0,004 é o do original e vive na constante exportada, que o fragmento do plano usa.
  assert(OPACIDADE_MINIMA_DA_NEVOA === 0.004, `o limite de descarte é 0,004 de opacidade, o do shader original de 24/11 (veio ${OPACIDADE_MINIMA_DA_NEVOA})`)
  assert(!/discard/.test(decl), '`corDaNevoa` NÃO descarta: devolve a opacidade (o terreno opaco precisa de uma cor, não de um buraco)')

  // O GLSL, e não só o avaliador JS: o avaliador é uma CÓPIA escrita à mão da mesma matemática, e um teste que só o compara consigo mesmo deixa o texto do GLSL mudar sem ninguém ver (os mutantes G5 a
  // G8 de 25/11, que trocavam cor/opacidade nunca↔já e tiravam o zeramento do «visível agora» DENTRO do GLSL, sobreviveram). Aqui leio as TRÊS linhas do texto e confiro a ORDEM dos argumentos.
  const mixCor = /vec3 cor = mix\((\w+), (\w+), visto\);/.exec(decl)
  assert(mixCor !== null && mixCor[1] === 'uCorNunca' && mixCor[2] === 'uCorJa', 'a COR é `mix(uCorNunca, uCorJa, visto)`: a de «nunca» em m = 0 e a de «já» em m = 0,5 (trocadas, o chão nunca visto ficaria com a cor do já visto)')
  const mixOpac = /float opac = mix\((\w+), (\w+), visto\);/.exec(decl)
  assert(mixOpac !== null && mixOpac[1] === 'uOpNunca' && mixOpac[2] === 'uOpJa', 'a OPACIDADE é `mix(uOpNunca, uOpJa, visto)`: 0,94 em m = 0 e 0,5 em m = 0,5 (trocadas, a névoa clarearia onde nunca se viu)')
  const zera = /opac = mix\(opac, ([\d.]+), agora\);/.exec(decl)
  assert(zera !== null && Number(zera[1]) === 0, 'o «visível agora» ZERA a opacidade: `opac = mix(opac, 0.0, agora)` (com outro valor o chão à vista continuaria coberto, ou não limparia)')
  assert((decl.match(/\bagora\b/g) ?? []).length >= 2, 'a variável `agora` é declarada E usada (sem o uso, o chão à vista nunca limparia)')
  assert(/return vec4\(cor, opac\);/.test(decl), '`corDaNevoa` devolve `vec4(cor, opac)`, nessa ordem')

  const cfg = { corNunca: [0.02, 0.03, 0.05], opNunca: 0.94, corJa: [0.05, 0.08, 0.14], opJa: 0.5 }
  // a faixa ENTRE «já visto» e «visível agora» (m de 0,5 a 0,98) é onde o limiar do «agora» importa: em m = 0,55 e 0,75 o valor distingue um início em 0,5 de um em 0,6, e um fim em 0,98 de um em 1,0
  // Valores CALCULADOS por código fora do teste (um `node -e` com o smoothstep escrito à parte), não de cabeça: a 1ª versão deste teste escreveu `0,1/0,48` onde o numerador é `0,55 − 0,5 = 0,05`
  // e falhou contra o módulo CERTO. Com o `visto` já em 1 (m ≥ 0,5) a opacidade base é a do «já visto» (0,5), e o `agora` a reduz: m = 0,55 → agora 0,0302915220 → 0,4848542390; m = 0,75 → agora
  // 0,5312319155 → 0,2343840422. Um início do «agora» em 0,6 daria 0,5 em m = 0,55; um fim em 1,0 daria outro valor em m = 0,75.
  const noMeio = nevoaSemRuido(0.55, cfg)
  assert(noMeio !== null && Math.abs(noMeio.opacidade - 0.4848542390) < 1e-9, `em m = 0,55 a opacidade é 0,4848542390 (veio ${noMeio?.opacidade})`)
  const noMeio2 = nevoaSemRuido(0.75, cfg)
  assert(noMeio2 !== null && Math.abs(noMeio2.opacidade - 0.2343840422) < 1e-9, `em m = 0,75 a opacidade é 0,2343840422 (veio ${noMeio2?.opacidade})`)
  // m = 0 (nunca visto): cor e opacidade de «nunca» (0,94 no Império)
  const nunca = nevoaSemRuido(0, cfg)
  assert(nunca !== null && Math.abs(nunca.opacidade - 0.94) < 1e-9 && nunca.cor.every((c, i) => Math.abs(c - cfg.corNunca[i]) < 1e-9), 'm = 0 (nunca visto): a cor e a opacidade de «nunca»')
  // m = 0,5 (já visto): cor e opacidade de «já»
  const ja = nevoaSemRuido(0.5, cfg)
  assert(ja !== null && Math.abs(ja.opacidade - 0.5) < 1e-9 && ja.cor.every((c, i) => Math.abs(c - cfg.corJa[i]) < 1e-9), 'm = 0,5 (já visto): a cor e a opacidade de «já»')
  // m = 1 (visível agora): opacidade ZERO, então descarta (null): é o chão limpo
  assert(nevoaSemRuido(1, cfg) === null, 'm = 1 (visível agora): a opacidade é 0 e o pixel é DESCARTADO (o chão aparece limpo)')
  assert(nevoaSemRuido(0.98, cfg) === null, 'm = 0,98 (o fim do «agora»): ainda descarta')
  // monotonia: a opacidade NUNCA sobe quando o chão fica mais visível (de 0 a 1 só desce ou fica igual)
  let anterior = 2
  for (let m = 0; m <= 1.0001; m += 0.01) {
    const r = nevoaSemRuido(Math.min(1, m), cfg)
    const op = r === null ? 0 : r.opacidade
    assert(op <= anterior + 1e-9, `a opacidade não pode SUBIR quando o chão fica mais visível (m=${m.toFixed(2)}: ${op} depois de ${anterior})`)
    anterior = op
  }
  // a faixa do meio é uma mistura contínua (sem salto): entre m = 0,02 e 0,5 a opacidade vai de 0,94 a 0,5 sem degrau maior que 0,02 por passo de 0,005
  let saltoMax = 0
  let ult = nevoaSemRuido(0.02, cfg)?.opacidade ?? 0
  for (let m = 0.025; m <= 0.5; m += 0.005) {
    const op = nevoaSemRuido(m, cfg)?.opacidade ?? 0
    saltoMax = Math.max(saltoMax, Math.abs(op - ult))
    ult = op
  }
  assert(saltoMax < 0.02 && saltoMax > 0.001, `na faixa «já visto» a opacidade muda de forma contínua (maior salto ${saltoMax.toFixed(4)}: um degrau daria ~0,44 e uma função morta, 0)`)

  // o RUÍDO é limitado: o GLSL soma `(ruido − 0,5) · 0,14` com ruido em [0, 1], logo no máximo ±0,07, e só na BORDA (`naBorda`), nunca no centro de uma região
  assert(/\* 0\.14/.test(decl) && /\* naBorda/.test(decl), 'o ruído é multiplicado por 0,14 (±0,07) e por `naBorda` (zero no centro de uma região: a névoa nunca vaza para dentro do que está limpo)')
  assert(/m = clamp\(m \+ onda \* naBorda, 0\.0, 1\.0\)/.test(decl), 'o m ruidoso é preso a [0, 1]')
}
