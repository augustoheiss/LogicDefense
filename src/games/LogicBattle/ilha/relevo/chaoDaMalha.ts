import { alturaEm, MEIA_RELEVO, type CampoRelevo } from './campoRelevo'

/**
 * O CHÃO VISTO (F2, 26/11/2026). A foto da patrulha achou que o chão que o jogador VÊ não é o campo `alturaEm` entre os vértices da malha: a malha tem passo de 1 m (Ultra), 2 m (Bonito) ou 4 m (Leve),
 * cada vértice vale `alturaEm`, mas ENTRE os vértices o GPU desenha 2 triângulos por célula (linear por partes) e o campo é bilinear. Medido nos 6 biomas: desvio máximo 0,22 / 0,85 / 1,08 m e a malha fica
 * mais de 5 cm ACIMA do campo em 0,5 / 14,9 / 38,5 % dos pontos, o que enterra tudo que o desenho posiciona por `alturaEm` (herói, tropas, props, obras, anéis, linhas).
 *
 * A decisão (do usuário, 26/11): o desenho passa a amostrar a MALHA, a mesma função que o GPU desenha. O campo CONTINUA sendo o campo (o clique, o A* e a névoa o leem e não dependem do preset gráfico):
 * o passo vive numa VISÃO separada, `ChaoDaMalha = { campo, passo }`, que só o desenho produz (um lugar, `IlhaRua`) e que `desnivelDaMalha` consome. Sem campo não há chão visto e o desnível é +0 EXATO (I1).
 */
export interface ChaoDaMalha {
  readonly campo: CampoRelevo
  /** O passo (m) da malha em uso: 1 (Ultra), 2 (Bonito) ou 4 (Leve). Os três dividem 112, então a borda de ±56 m é sempre um vértice. */
  readonly passo: 1 | 2 | 4
}

// Um `ChaoDaMalha` por (campo, passo): a cena pergunta a cada quadro, e criar um objeto por pergunta geraria lixo (e quebraria a igualdade `===` de que os efeitos do React dependem). O `WeakMap`
// solta a entrada junto com o campo quando o cache LRU do relevo o descarta.
const cache = new WeakMap<CampoRelevo, Map<number, ChaoDaMalha>>()

export function chaoDaMalha(campo: CampoRelevo | undefined, passo: 1 | 2 | 4): ChaoDaMalha | undefined {
  if (!campo) return undefined
  let porPasso = cache.get(campo)
  if (!porPasso) {
    porPasso = new Map()
    cache.set(campo, porPasso)
  }
  let visto = porPasso.get(passo)
  if (!visto) {
    visto = { campo, passo }
    porPasso.set(passo, visto)
  }
  return visto
}

function preso(valor: number): number {
  return valor < -MEIA_RELEVO ? -MEIA_RELEVO : valor > MEIA_RELEVO ? MEIA_RELEVO : valor
}

/**
 * A altura (m acima da rua) da MALHA em `(x, z)`: a célula de `passo` m que contém o ponto, escolhida pela diagonal `b–c` (de `(x+p, z)` a `(x, z+p)`), a MESMA que `geometriaDoTerreno` usa (`a→c→b` e
 * `b→c→d`). Fora do quadrado (finito) prende na borda, como `alturaEm`.
 */
function alturaDaMalha(chao: ChaoDaMalha, x: number, z: number): number {
  const p = chao.passo
  const px = preso(x)
  const pz = preso(z)
  const n = (2 * MEIA_RELEVO) / p
  const cx = Math.min(n - 1, Math.floor((px + MEIA_RELEVO) / p))
  const cz = Math.min(n - 1, Math.floor((pz + MEIA_RELEVO) / p))
  const x0 = -MEIA_RELEVO + cx * p
  const z0 = -MEIA_RELEVO + cz * p
  const fx = (px - x0) / p
  const fz = (pz - z0) / p
  const ha = alturaEm(chao.campo, x0, z0)
  const hb = alturaEm(chao.campo, x0 + p, z0)
  const hc = alturaEm(chao.campo, x0, z0 + p)
  if (fx + fz <= 1) return ha + (hb - ha) * fx + (hc - ha) * fz // o triângulo a, b, c
  const hd = alturaEm(chao.campo, x0 + p, z0 + p)
  return hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz) // o triângulo b, c, d
}

/**
 * O DESNÍVEL do chão que se VÊ em `(x, z)`: a altura da malha acima do plano de hoje. Sem chão visto (sem campo), ou com `x`/`z` que não são números finitos, é EXATAMENTE `+0` (I1: o jogo de hoje; e a
 * entrada corrompida não eleva o objeto à altura do centro do quadrado, como `desnivelDoChao`).
 */
export function desnivelDaMalha(chao: ChaoDaMalha | undefined, x: number, z: number): number {
  if (!chao || !Number.isFinite(x) || !Number.isFinite(z)) return 0
  return alturaDaMalha(chao, x, z)
}
