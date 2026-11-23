import type { PecaId } from './partidaPolicies'

/**
 * A TABELA DE EVOLUÇÃO das obras (pedido do usuário, 23/11): evoluir tem de FAZER DIFERENÇA e custar proporcionalmente mais. MEDIDO antes (23/11): o nível só mudava a vida máxima (+30 no Nv4, +50 no Nv5), o alcance
 * (+2 m por nível) e o dano (+1 por nível) da torre; serraria, mina, quartel e núcleo produziam e recrutavam IGUAL no nível 1 e no 5; o preço era fixo em qualquer nível.
 *
 * Regra [D-minha, o usuário ajusta]: cada nível custa 1,5× o anterior e rende 1,5× o anterior, no MESMO fator (`FATOR_POR_NIVEL`). Este módulo é PURO e é a ÚNICA fonte da tabela: a simulação (`partidaSim`), o painel
 * da obra e a lista de construções leem daqui, então o preço que o jogador lê é o que a simulação cobra. Tudo aceita entrada suja: um nível NaN, infinito, negativo ou fracionário vira um nível válido, e nenhum
 * valor sai NaN, infinito ou negativo.
 */

/** Quanto cada nível rende e custa a mais que o anterior [D-minha: o pedido do usuário foi «tipo 1,5 vezes»]. */
export const FATOR_POR_NIVEL = 1.5

/** O último nível: do 5 não se evolui mais. */
export const NIVEL_MAXIMO = 5

/** O que a evolução de nível 1 → 2 custa (o preço de HOJE). Os níveis seguintes multiplicam isto por `fatorDoNivel(nivel)`. */
const CUSTO_BASE = { credito: 1, madeira: 2, ouro: 2 } as const

/**
 * Base do dano da torre no nível 1, da vida da tropa recrutada (era 16 fixo) e do alcance da torre (a visão dela, 22 m). O dano base é 7: a fórmula antiga era `PARTIDA.torreDano (6) + nível`, ou seja, 7 no nível 1. A tabela
 * NÃO muda o nível 1 de nada (o usuário pediu que evoluir fosse melhor, não que o nível 1 enfraquecesse): preço, tropa, produção e dano do nível 1 são os de hoje; só o ALCANCE sobe, por pedido dele (22 m).
 */
const DANO_BASE_DA_TORRE = 7
const VIDA_BASE_DA_TROPA = 16
const ALCANCE_BASE_DA_TORRE = 22
/** Cada nível acrescenta tantos metros ao alcance da torre: o alcance NÃO é multiplicado por 1,5 (a torre do Nv5 chegaria a 100 m, mais que o mapa), cresce em passo fixo, como era. */
const ALCANCE_POR_NIVEL = 2

/** O nível válido: inteiro entre 1 e `NIVEL_MAXIMO`. NaN, infinito, negativo, zero e fração viram o inteiro de baixo (fração) ou o nível 1 (lixo); acima do teto vale o teto. */
function nivelValido(nivel: number): number {
  if (typeof nivel !== 'number' || Number.isNaN(nivel)) return 1
  if (nivel === Number.POSITIVE_INFINITY) return 1
  const inteiro = Math.floor(nivel)
  if (inteiro < 1) return 1
  return Math.min(inteiro, NIVEL_MAXIMO)
}

/** O fator do nível N: `1,5^(N−1)` (1, 1,5, 2,25, 3,375, 5,0625). É o mesmo número no preço e no ganho. */
export function fatorDoNivel(nivel: number): number {
  return FATOR_POR_NIVEL ** (nivelValido(nivel) - 1)
}

/**
 * O preço de subir do nível `nivel` para o `nivel + 1`: o preço base × `fatorDoNivel(nivel)`, arredondado PARA CIMA (evoluir nunca sai de graça por arredondamento), e `null` no nível máximo (não há
 * próximo). O jogador paga com licenças OU com madeira e ouro (como já era): os dois jeitos crescem juntos.
 */
export function custoDeEvoluir(nivel: number): { credito: number; madeira: number; ouro: number } | null {
  const n = nivelValido(nivel)
  if (n >= NIVEL_MAXIMO) return null
  const f = fatorDoNivel(n)
  // Arredondar o PRODUTO com uma folga minúscula para baixo antes do ceil: 2 × 1,5^2 = 4,5 é exato, mas 1,5^3 × 1 = 3,375 não é um problema; a folga evita que um erro de ponto flutuante (2,0000000000000004)
  // vire 3 por um bit de erro.
  const teto = (valor: number) => Math.ceil(valor - 1e-9)
  return { credito: teto(CUSTO_BASE.credito * f), madeira: teto(CUSTO_BASE.madeira * f), ouro: teto(CUSTO_BASE.ouro * f) }
}

/** A vida máxima de uma obra no nível `nivel`, a partir da vida do nível 1 (`vidaBase`): `vidaBase × 1,5^(N−1)`. Uma vida base inválida (NaN, ≤ 0) dá 0, nunca NaN. */
export function vidaMaximaNoNivel(vidaBase: number, nivel: number): number {
  if (!Number.isFinite(vidaBase) || vidaBase <= 0) return 0
  return vidaBase * fatorDoNivel(nivel)
}

/** O dano de UM tiro da torre no nível `nivel`: `7 × 1,5^(N−1)` (7, 10,5, 15,75, 23,6, 35,4). O nível 1 é o de hoje (7). */
export function danoDaTorreNoNivel(nivel: number): number {
  return DANO_BASE_DA_TORRE * fatorDoNivel(nivel)
}

/** O alcance da torre no nível `nivel`, em metros: 22 m (a visão dela, mais que os 18 m do tiro do herói) no nível 1, mais 2 m por nível (30 m no nível 5). */
export function alcanceDaTorreNoNivel(nivel: number): number {
  return ALCANCE_BASE_DA_TORRE + (nivelValido(nivel) - 1) * ALCANCE_POR_NIVEL
}

/** A vida com que uma tropa NASCE recrutada numa obra de nível `nivel` (quartel ou núcleo): `16 × 1,5^(N−1)`. */
export function tropaVidaNoNivel(nivel: number): number {
  return VIDA_BASE_DA_TROPA * fatorDoNivel(nivel)
}

/** O que uma serraria ou mina de nível `nivel` produz por ciclo, a partir da produção do nível 1 (`base`, 1 ou 2): `base × 1,5^(N−1)`. Base inválida (NaN, ≤ 0) dá 0. */
export function producaoNoNivel(base: number, nivel: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0
  return base * fatorDoNivel(nivel)
}

/** De quantas em quantas ondas a base inimiga sobe um nível da tabela [D-minha: o usuário disse «evolui»; 3 ondas dão 4 níveis nos primeiros 12 minutos]. */
const ONDAS_POR_NIVEL_DA_BASE = 3

/**
 * O NÍVEL DA TABELA da base inimiga no estágio `estagio` (a onda em que ela está): `min(5, 1 + floor(estágio / 3))` → ondas 0 a 2 são nível 1, 3 a 5 nível 2, 6 a 8 nível 3, 9 a 11 nível 4, 12 em diante nível 5 (o teto da tabela).
 * É o nível que decide a FORÇA das peças inimigas (torre com mais dano e alcance) e o tamanho da leva. O `nivel` do núcleo inimigo continua marcando o ESTÁGIO inteiro (o M2 copia os vizinhos por ele). Entrada suja
 * (NaN, negativo, fração) vale o nível 1; infinito vale o teto.
 */
export function nivelDaBaseInimiga(estagio: number): number {
  if (typeof estagio !== 'number' || Number.isNaN(estagio) || estagio < 0) return 1
  if (estagio === Number.POSITIVE_INFINITY) return NIVEL_MAXIMO
  return nivelValido(1 + Math.floor(estagio / ONDAS_POR_NIVEL_DA_BASE))
}

/**
 * Quantos inimigos a leva da onda `onda` traz (pedido do usuário, 23/11: «ele recrutar mais inimigos»; escolha dele: a leva cresce com o nível do núcleo). A PRIMEIRA onda traz `primeira` (4, como sempre) e as seguintes
 * `1 + floor((nível − 1) / 2)` → 1 nos níveis 1 e 2, 2 nos níveis 3 e 4, 3 no nível 5. O limite de inimigos vivos do mapa (12) continua valendo e é aplicado por quem chama. Onda inválida (NaN, ≤ 0) traz 1: nunca zero.
 */
export function quantidadeDaLevaNaOnda(onda: number, primeira: number, seguinte: number): number {
  if (typeof onda !== 'number' || Number.isNaN(onda) || onda < 1) return Math.max(1, seguinte)
  if (onda === 1) return primeira
  return Math.max(1, seguinte) + Math.floor((nivelDaBaseInimiga(onda) - 1) / 2)
}

const arredonda1 = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))

/**
 * O que o PRÓXIMO nível dá a uma obra do tipo `tipo` que está no nível `nivel`, em uma frase para a tela (a lista de construções e o painel). Fala do que muda DE VERDADE para aquele tipo, com os números da tabela
 * (nunca escritos à mão em outro lugar). `null` no nível máximo.
 */
export function descricaoDaEvolucao(tipo: PecaId, nivel: number): string | null {
  const n = nivelValido(nivel)
  if (n >= NIVEL_MAXIMO) return null
  const f = fatorDoNivel(n + 1) / fatorDoNivel(n)
  const mais = `+${Math.round((f - 1) * 100)} %`
  switch (tipo) {
    case 'torre':
      return `alcance ${alcanceDaTorreNoNivel(n)} → ${alcanceDaTorreNoNivel(n + 1)} m, dano ${arredonda1(danoDaTorreNoNivel(n))} → ${arredonda1(danoDaTorreNoNivel(n + 1))}, vida ${mais}`
    case 'serraria':
      return `produz ${mais} de madeira por ciclo, vida ${mais}`
    case 'mina':
      return `produz ${mais} de ouro por ciclo, vida ${mais}`
    case 'quartel':
      return `a tropa nasce com ${arredonda1(tropaVidaNoNivel(n))} → ${arredonda1(tropaVidaNoNivel(n + 1))} de vida, vida da obra ${mais}`
    case 'nucleo':
      return `a tropa nasce com ${arredonda1(tropaVidaNoNivel(n))} → ${arredonda1(tropaVidaNoNivel(n + 1))} de vida, vida da base ${mais}`
    case 'portao':
    case 'britador':
      return `vida ${mais}`
  }
}
