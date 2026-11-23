import { PARTIDA } from './partidaPolicies'

/**
 * Como o jogador manda uma tropa para OUTRO mapa (pedido do usuário, 23/11: «pode fazer tropas atravessar de mapa»; a escolha dele, em AskUserQuestion: «clicar na borda do chão manda atravessar»).
 * O chão clicável tem exatamente o tamanho do mapa (112 × 112), então um clique nunca devolve um ponto de fora: sem um gesto, a travessia ficava implementada e sem botão (medido: nenhum caminho da
 * interface chamava `ordenar` com destino fora do quadrado). Os últimos `LARGURA_DA_FAIXA` m de cada lado são uma FAIXA: um clique ali vira «ir para o mapa vizinho daquele lado».
 */

/** Largura da faixa, em metros [D-minha]: 3 m na câmera do Império (≈ 48 px em x), larga o bastante para acertar com o mouse e estreita para não roubar o chão útil. */
export const LARGURA_DA_FAIXA = 3

/**
 * Quanto além da borda fica o destino de fora, em metros [D-minha]: 8 m, o bastante para a regra do `ordenar` (|x| ≥ 56 grava `alem`) valer com folga e para a tropa, ao chegar ao vizinho, ter uns 8 m a andar
 * para dentro. Depois da conversão do atlas o destino cai a 8 m da borda do mapa novo.
 */
export const ALCANCE_ALEM = 8

/** Um eixo sujo (NaN, ±Infinity) nunca vira «ir embora»: um clique com lixo não pode mandar a tropa para outro mapa. */
function eixo(v: number): { v: number; alem: boolean } {
  if (!Number.isFinite(v)) return { v, alem: false }
  const meio = PARTIDA.radius
  if (v >= meio - LARGURA_DA_FAIXA) return { v: meio + ALCANCE_ALEM, alem: true }
  if (v <= -(meio - LARGURA_DA_FAIXA)) return { v: -(meio + ALCANCE_ALEM), alem: true }
  return { v, alem: false }
}

/**
 * O destino que um clique no chão em `(x, z)` produz. Fora da faixa devolve o próprio ponto (andar até ali, como sempre). Na faixa devolve o ponto empurrado para fora no eixo da faixa, mantendo o outro
 * eixo (a tropa chega ao vizinho na mesma linha); no canto os dois eixos saem (diagonal). `alem` diz se o clique virou «ir para outro mapa».
 */
export function destinoDoClique(x: number, z: number): { x: number; z: number; alem: boolean } {
  const ex = eixo(x)
  const ez = eixo(z)
  return { x: ex.v, z: ez.v, alem: ex.alem || ez.alem }
}

/** Uma caixa alinhada aos eixos: centro `(cx, cz)` e meia-largura `(hx, hz)`, em metros no chão do mapa. */
export interface CaixaDaBorda {
  chave: 'leste' | 'oeste' | 'norte' | 'sul'
  cx: number
  cz: number
  hx: number
  hz: number
}

/**
 * As quatro caixas que o jogador VÊ como a faixa da borda (o muro âmbar de `BordaDoMapa`). Mora aqui, ao lado de `destinoDoClique`, porque os dois têm de descrever a MESMA região: o que o jogador vê pintado é
 * exatamente onde o clique manda atravessar. Leste e oeste têm o lado todo; norte e sul são mais curtos (`lado − 2·largura`) para não se sobrepor aos de leste e oeste nos cantos (dois blocos translúcidos
 * empilhados ficariam mais opacos ali). A união das quatro é a moldura de `LARGURA_DA_FAIXA` m de largura que `destinoDoClique` lê.
 */
export function caixasDaBorda(): CaixaDaBorda[] {
  const meio = PARTIDA.radius
  const l = LARGURA_DA_FAIXA
  const lado = PARTIDA.ladoMapa
  return [
    { chave: 'leste', cx: meio - l / 2, cz: 0, hx: l / 2, hz: lado / 2 },
    { chave: 'oeste', cx: -(meio - l / 2), cz: 0, hx: l / 2, hz: lado / 2 },
    { chave: 'norte', cx: 0, cz: meio - l / 2, hx: (lado - 2 * l) / 2, hz: l / 2 },
    { chave: 'sul', cx: 0, cz: -(meio - l / 2), hx: (lado - 2 * l) / 2, hz: l / 2 },
  ]
}
