import { fbmTileable } from './ruidoTileavel'

/**
 * O PISO DE LAJES IRREGULARES (24/11/2026, F1 Task 9): lógica PURA, testada no Node (`flagstone.test.ts`). `texturasPbrProcedural.ts` só pergunta «que cor, que altura e que rugosidade tem este pixel».
 *
 * POR QUE NÃO O TIJOLO REGULAR. A estrada era `pedraLavradaSample` com 4 colunas × 6 fileiras de lajes retangulares do mesmo tamanho e juntas deslocadas de meio bloco, repetida 3 × 14 vezes numa
 * caixa de 8 × 42 m. Cada laje media ~0,67 × 0,5 m e o padrão de 24 lajes voltava a cada ~3 m: o «xadrez» das fotos. Aqui as lajes saem de um diagrama de VORONOI com jitter (cada laje tem um
 * tamanho e uma forma) e a junta é a distância EXATA do ponto à borda da laje (o plano mediador entre o centro mais próximo e cada vizinho), que vale ZERO na fronteira entre duas lajes e tem a mesma largura em todo lugar. A diferença `F2 − F1` foi a 1ª tentativa e engordava nos vértices agudos.
 *
 * A textura é PERIÓDICA e SEM EMENDA (o vizinho de uma célula na borda é a célula do outro lado, na posição certa): o chão repete o ladrilho e uma emenda visível seria um defeito pior que o xadrez.
 */

/** Lajes por lado do ladrilho. 8 × 8 = 64 lajes. Com 5 por lado (a 1ª versão) as lajes mediam ~1,6 m numa estrada de 8 m: mosaico de pedras gigantes, não uma estrada antiga. */
export const LAJES_POR_LADO = 8

/** Quantas vezes o ladrilho se repete na estrada de 8 × 42 m (largura × comprimento). Antes: 3 × 14 de um ladrilho de 24 lajes pequenas (o padrão voltava a cada ~3 m). Agora 8 lajes cruzam a largura de 8 m (~1 m cada) e o padrão só volta a cada ~7 m. */
export const REPETICAO_DO_LADRILHO = { largura: 1, comprimento: 6 } as const

/**
 * Quanto cada centro de laje pode se afastar do meio da sua célula (em fração da célula). 0 = grade regular (o xadrez); 0,5 = pode encostar na célula vizinha. MEDIDO em 24/11 (forma de cada laje
 * = raio circunscrito / inscrito; a grade regular mede 1,44): jitter 0,42 → pior laje 4,67 e p90 4,32 (LASCAS compridas e finas); 0,34 → 3,75 e 3,21; **0,28 → 3,13 e 2,67**; 0,22 → 2,61 e 2,28
 * (quase regular). 0,28 mantém as lajes irregulares (mediana ~1,97) sem lascas.
 */
const JITTER = 0.28

/** Hash determinístico de uma célula (periódico em `LAJES_POR_LADO`), em [0, 1). Duas saídas independentes por célula, para o deslocamento em x e em y. */
function hashCelula(ix: number, iy: number, seed: number, canal: number): number {
  const px = ((ix % LAJES_POR_LADO) + LAJES_POR_LADO) % LAJES_POR_LADO
  const py = ((iy % LAJES_POR_LADO) + LAJES_POR_LADO) % LAJES_POR_LADO
  let h = Math.imul(px ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(py ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(seed | 0, 0x165667b1) ^ Math.imul(canal + 1, 0x61c88647)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** O centro da laje da célula (ix, iy), em coordenadas de ladrilho [0, 1): o meio da célula mais um deslocamento determinístico. */
function centroDaCelula(ix: number, iy: number, seed: number): readonly [number, number] {
  const cx = (ix + 0.5 + (hashCelula(ix, iy, seed, 0) - 0.5) * 2 * JITTER) / LAJES_POR_LADO
  const cy = (iy + 0.5 + (hashCelula(ix, iy, seed, 1) - 0.5) * 2 * JITTER) / LAJES_POR_LADO
  return [cx, cy]
}

/** Todos os centros de laje do ladrilho (a lista que o teste usa para provar que NÃO é uma grade). */
export function centrosDeLaje(seed: number): ReadonlyArray<readonly [number, number]> {
  const lista: Array<readonly [number, number]> = []
  for (let iy = 0; iy < LAJES_POR_LADO; iy += 1) for (let ix = 0; ix < LAJES_POR_LADO; ix += 1) lista.push(centroDaCelula(ix, iy, seed))
  return lista
}

export interface AmostraFlagstone {
  /** 0 = junta funda, 1 = topo da laje. */
  readonly altura: number
  /** Distância EXATA (em fração do ladrilho) do ponto à borda da laje. 0 = em cima da junta. */
  readonly juntaDistancia: number
  /** Tom da laje em [0, 1]: cada laje tem o seu (uma mais clara, outra mais escura). */
  readonly tom: number
}

/**
 * A espessura da junta, em fração do ladrilho: a distância EXATA do ponto à borda da laje. Abaixo de `JUNTA` é junta funda; acima de `JUNTA + BORDA`, topo plano da laje. Com 8 lajes por lado a
 * laje mede ~0,125 do ladrilho, então 0,004 + 0,012 é uma junta de ~3% da laje e uma borda suave de ~10%.
 */
const JUNTA = 0.004
const BORDA = 0.012

/**
 * O que há no ponto (u, v) do ladrilho: a laje de Voronoi que o contém. `u` e `v` se repetem com período 1 (qualquer valor é reduzido ao ladrilho).
 *
 * A junta é a distância EXATA do ponto à borda da laje, e NÃO `F2 − F1`. `F2 − F1` é zero na fronteira, mas mede a diferença entre duas distâncias a centros, não a distância à borda: perto de um
 * vértice agudo (onde a fronteira entre duas lajes faz um ângulo fechado) ela cresce devagar e a junta ENGORDA, deixando manchas borradas em forma de fuso (visto em 24/11, ladrilho 3 × 3). A
 * distância ao plano mediador entre o centro mais próximo `c1` e cada vizinho `cj` é `(|p − cj|² − |p − c1|²) / (2 · |cj − c1|)`; o mínimo sobre os vizinhos é a distância real à borda e é UNIFORME.
 * `juntaDistancia` guarda essa distância (0 = em cima da junta).
 */
export function amostrarFlagstone(u: number, v: number, seed: number): AmostraFlagstone {
  const uu = ((u % 1) + 1) % 1
  const vv = ((v % 1) + 1) % 1
  const cx = Math.floor(uu * LAJES_POR_LADO)
  const cy = Math.floor(vv * LAJES_POR_LADO)
  // os centros dos 3 × 3 vizinhos. BASTA com `JITTER` 0,28 e 8 lajes por lado: MEDIDO em 24/11, 0 de 187.500 pontos (3 sementes) diferem da busca de 5 × 5, e `flagstone.test.ts` compara com uma referência
  // exaustiva de 7 × 7. A textura é gerada pixel a pixel na troca de bioma: 9 centros em vez de 25 por pixel cortam ~64% do trabalho. Se o jitter subir, o teste de referência avisa.
  const vizinhos: Array<{ x: number; y: number; ix: number; iy: number }> = []
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const ix = cx + dx
      const iy = cy + dy
      // `centroDaCelula(ix, iy)` usa o `ix` BRUTO (fora de [0, N) para os vizinhos do outro lado do ladrilho) na posição, então o centro do vizinho já sai no lugar certo do toro; só o HASH
      // reduz `ix` ao ladrilho, para o jitter ser o da célula original. Somar o deslocamento do ladrilho aqui contaria ele DUAS vezes e criaria uma EMENDA (visto em 24/11: 35% dos cortes de
      // cada borda saltavam; o teste de periodicidade antigo era verdadeiro por construção e não via).
      const [px, py] = centroDaCelula(ix, iy, seed)
      vizinhos.push({
        x: px,
        y: py,
        ix: ((ix % LAJES_POR_LADO) + LAJES_POR_LADO) % LAJES_POR_LADO,
        iy: ((iy % LAJES_POR_LADO) + LAJES_POR_LADO) % LAJES_POR_LADO,
      })
    }
  }
  let proximo = vizinhos[0]
  let d1 = Infinity
  for (const c of vizinhos) {
    const d = Math.hypot(uu - c.x, vv - c.y)
    if (d < d1) {
      d1 = d
      proximo = c
    }
  }
  let borda = Infinity
  for (const c of vizinhos) {
    if (c === proximo) continue
    const separacao = Math.hypot(c.x - proximo.x, c.y - proximo.y)
    if (separacao < 1e-9) continue
    const dj = Math.hypot(uu - c.x, vv - c.y)
    const distancia = (dj * dj - d1 * d1) / (2 * separacao)
    if (distancia < borda) borda = distancia
  }
  const junta = Math.max(0, borda)
  // 0 na junta, sobe suave até 1 no topo da laje; um degrau suave (smoothstep), não uma quina
  const t = Math.min(1, Math.max(0, (junta - JUNTA) / BORDA))
  const altura = t * t * (3 - 2 * t)
  // o tom é da LAJE (a célula do centro mais próximo), não do pixel: cada laje tem uma cor só, e as lajes vizinhas diferem
  const tom = hashCelula(proximo.ix, proximo.iy, seed, 2)
  return { altura, juntaDistancia: junta, tom }
}

// ── O CAMPO DO LADRILHO (calculado uma vez) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface CampoDoLadrilho {
  /** Lado do ladrilho em pixels. */
  readonly res: number
  /** Altura por pixel (0 junta, 1 topo da laje), linha a linha. */
  readonly altura: Float32Array
  /** Tom da laje por pixel, em [0, 1]. */
  readonly tom: Float32Array
  /** O GRÃO fino da pedra (`fbmTileable(u, v, 24, 3, seed + 17)`), em [0, 1]. Só depende de (u, v, semente), NUNCA do bioma: calculado uma vez para os 6 biomas. É a MESMA função, sem aproximação (96 ciclos em 512 px: uma grade violaria Nyquist).
   */
  readonly grao: Float32Array
}

/** Quantos campos o cache guarda. O jogo tem 3 resoluções e a semente da estrada é uma só (303), mas um cache sem limite seguraria memória por semente para sempre. */
const CAPACIDADE_DO_CACHE = 4
const cacheDoLadrilho = new Map<string, CampoDoLadrilho>()

/** Resolução válida: inteiro de 1 a 2048. NaN, zero, negativo e fracionário caem em algo seguro (um array de tamanho estranho quebraria a textura). */
function resolucaoValida(res: number): number {
  if (!Number.isFinite(res)) return 1
  return Math.min(2048, Math.max(1, Math.floor(res)))
}

/**
 * O desenho das lajes (altura e tom por pixel) de um ladrilho `res × res`. NÃO depende do bioma: a semente é a mesma em todos (303) e só a COR muda, então o campo é calculado UMA vez e guardado
 * (cache de `CAPACIDADE_DO_CACHE` entradas, o mais antigo sai). MEDIDO em 24/11: amostrar 512 × 512 pixels custa ~139 ms, oito vezes a estrada antiga (~17 ms), e a troca de bioma já custava ~156 ms;
 * recalcular o mesmo desenho a cada bioma seriam ~120 ms jogados fora a cada troca. A convenção é a da textura: o pixel (x, y) amostra `u = x / res`, `v = y / res`.
 */
export function campoDoLadrilho(res: number, seed: number): CampoDoLadrilho {
  const lado = resolucaoValida(res)
  const chave = `${lado}:${seed | 0}`
  const guardado = cacheDoLadrilho.get(chave)
  if (guardado) {
    // reinsere para virar o mais recente (a ordem de inserção do Map é a ordem de uso)
    cacheDoLadrilho.delete(chave)
    cacheDoLadrilho.set(chave, guardado)
    return guardado
  }
  const altura = new Float32Array(lado * lado)
  const tom = new Float32Array(lado * lado)
  const grao = new Float32Array(lado * lado)
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const s = amostrarFlagstone(x / lado, y / lado, seed)
      altura[y * lado + x] = s.altura
      tom[y * lado + x] = s.tom
      grao[y * lado + x] = fbmTileable(x / lado, y / lado, 24, 3, seed + 17)
    }
  }
  const campo: CampoDoLadrilho = { res: lado, altura, tom, grao }
  cacheDoLadrilho.set(chave, campo)
  while (cacheDoLadrilho.size > CAPACIDADE_DO_CACHE) {
    const maisAntigo = cacheDoLadrilho.keys().next().value
    if (maisAntigo === undefined) break
    cacheDoLadrilho.delete(maisAntigo)
  }
  return campo
}

/** Esvazia o cache e devolve quantos campos ele guardava (para o teste medir o limite). */
export function limparCacheDoLadrilho(): number {
  const n = cacheDoLadrilho.size
  cacheDoLadrilho.clear()
  return n
}

// ── O MOSAICO RADIAL da praça ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quantos anéis a praça tem do centro à borda. */
const ANEIS = 5

export interface AmostraMosaico {
  readonly altura: number
  readonly tom: number
}

/** Valor de [0, 1] a partir de dois inteiros (o anel e a cunha), determinístico. */
function hashAnel(anel: number, cunha: number, seed: number): number {
  let h = Math.imul(anel ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(cunha ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(seed | 0, 0x165667b1)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * O piso da PRAÇA: anéis concêntricos, e dentro de cada anel lajes em cunha. O número de cunhas cresce com o anel (`6 + 6 × anel`), para a laje continuar quase quadrada do centro à borda.
 * `raio` em [0, 1] (0 = centro, 1 = borda da praça); `anguloRad` em radianos (qualquer valor: 0 ≡ 2π, e o negativo volta pelo outro lado). Entrada que não é número vale 0.
 * A cunha é a mesma em 0 e em 2π por construção (o ângulo é reduzido a [0, 2π) antes de escolher a cunha), então não há fresta radial.
 */
export function amostrarMosaicoRadial(raio: number, anguloRad: number, seed: number): AmostraMosaico {
  const r = Number.isFinite(raio) ? Math.min(1, Math.max(0, raio)) : 0
  const ang = Number.isFinite(anguloRad) ? anguloRad : 0
  const volta = 2 * Math.PI
  const a = (((ang % volta) + volta) % volta) / volta // [0, 1)
  const posAnel = r * ANEIS
  const anel = Math.min(ANEIS - 1, Math.floor(posAnel))
  const cunhas = 6 + 6 * anel
  const posCunha = a * cunhas
  const cunha = Math.min(cunhas - 1, Math.floor(posCunha))
  const dentroAnel = posAnel - anel // [0, 1]: 0 = borda interna do anel, 1 = externa
  const dentroCunha = posCunha - cunha // [0, 1)
  // junta: perto da borda do anel (radial) e da borda da cunha (angular); a junta angular é mais fina no centro, onde a cunha é estreita
  const distRadial = Math.min(dentroAnel, 1 - dentroAnel)
  const distAngular = Math.min(dentroCunha, 1 - dentroCunha) * (cunhas / (6 * Math.max(r, 0.15) * ANEIS))
  const d = Math.min(distRadial, Math.min(distAngular, 1))
  const t = Math.min(1, Math.max(0, (d - 0.04) / 0.12))
  const altura = t * t * (3 - 2 * t)
  const tom = hashAnel(anel, cunha, seed)
  return { altura, tom }
}
