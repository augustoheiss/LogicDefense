import { biomaDoQuadrado } from '../biomaRecursos'
import { lugarDaBaseInimiga } from '../partidaSim'

/**
 * A ÁGUA DO MUNDO (F2, 26/11/2026): os RIOS, valetas escavadas com água dentro. SÓ DESENHO: o rio NÃO é uma lagoa para a regra (`state.lagoas`, `emAguaRasa`), então o herói o atravessa na velocidade normal; a lentidão de
 * vadear (0,55×, custo 2,2) e os lagos nas bordas são a F3, com «ok» separado. É a PORTA do protótipo medido (`.superpowers/agua/agua-modelo.mjs`, controles verdes no gerador real); `aguaDoMundo.referencia.ts` guarda a lista
 * dos 13 rios dele e o teste prova que a porta é fiel.
 *
 * Tudo é função do PONTO GLOBAL `(X, Z) = (112·i + x, 112·j + z)`, como a altura do relevo: os dois quadrados de uma emenda amostram a MESMA função no MESMO ponto, então a emenda fecha por construção (I3).
 *
 * COMO O RIO É DESENHADO NO MUNDO: «corridas» em PISTAS. Uma pista H é a fileira `j` de quadrados (a aresta `k` liga `(k, j)` e `(k+1, j)`); uma pista V é a coluna. Cada pista é cortada em segmentos de `L = 6` arestas (a última
 * é um VÃO, então dois segmentos nunca se tocam); o segmento está ATIVO por hash. Dentro dele o rio atravessa cada aresta num VAU (o centro de uma janela de passagem plana, a ±14 ou ±42 m do meio) e nunca cruza o centro do
 * quadrado. Pistas V são iguais (colunas); H ganha de V (uma aresta V encostada num quadrado que já tem rio H é cortada), então rios nunca se cruzam. Serra e basalto são SECOS, o quadrado (0, 0) não tem rio, e as zonas de
 * nascimento, pedra e base inimiga cortam a corrida (a base CRUZA para o quadrado vizinho: `livre` varre os 9 quadrados em volta, medido: sem isso o rio chegava a 25,2 m da base).
 *
 * A PONTA do rio é uma vala de fim ARREDONDADO (a escavação mede a distância ao último ponto): era assim o protótipo medido e fotografado. NÃO há bacia escavada: o parâmetro `bacia` (6 × 5 m) que o plano previa nunca
 * teve geometria no protótipo e saiu daqui em vez de ficar morto (se a foto do jogo mostrar a ponta feia, a bacia é uma decisão de desenho do usuário, não um achado de teste).
 *
 * O NÍVEL d'água só DESCE rio abaixo (o mínimo corrente do chão em volta menos 0,2 m, suavizado), e é CONTÍNUO no ponto: uma MÉDIA SUAVE dos níveis dos pontos do rio perto, não o nível «do ponto mais próximo» (que SALTAVA
 * 1,7 mm no empate de distância, medido na emenda (3, 0)).
 */

export const PARAMETROS_DA_AGUA = Object.freeze({
  /** Arestas por segmento de uma pista (a última é um vão). */
  arestasPorSegmento: 6,
  /** A chance de um segmento estar ativo, por eixo (≈ 1 rio a cada 5 quadrados, 19 % dos quadrados). */
  chanceDoSegmento: Object.freeze({ H: 0.5, V: 0.4 }),
  /** O braço de rio que sai do vau até a ponta (m). */
  braco: 16,
  /** As zonas onde o rio não entra (m), contadas do centro de cada uma. */
  zonaProibida: Object.freeze({ base: 28, claro: 12, pedra: 18 }),
  /** A meia largura do corredor de margem plana em volta do rio (m). */
  margemPlana: 5,
  /** Quanto o terreno leva para voltar ao relevo original depois da margem (m). */
  retorno: 11,
  /** A meia largura do fundo do canal (m) e a largura da parede (m). */
  fundo: 1.0,
  parede: 2.6,
  /** O meandro (m), que some nas pontas (sin²). */
  meandro: 3,
})

const P = PARAMETROS_DA_AGUA
const LADO = 112
const MEIA = 56
const LIMITE_DA_MEMORIA = 512

/** Um rio: a poligonal GLOBAL (amostras de ~1 m, do braço inicial ao braço final) e o nível d'água em cada ponto. O mesmo rio é o MESMO objeto em todo quadrado que ele toca. */
export interface Rio {
  readonly id: string
  readonly eixo: 'H' | 'V'
  readonly pontos: ReadonlyArray<{ readonly X: number; readonly Z: number }>
  readonly niveis: Float64Array
}

type Eixo = 'H' | 'V'
interface Travessia {
  readonly k: number
  readonly w: number
}
interface Cadeia {
  readonly eixo: Eixo
  readonly lane: number
  readonly s: number
  readonly edges: readonly Travessia[]
}

// ── funções puras de apoio ──
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
function sm(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)
}
function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(c ^ 0x165667b1, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
const u01 = (a: number, b: number, c = 0): number => hash(a, b, c) / 4294967296

const quad = (eixo: Eixo, lane: number, k: number): [number, number] => (eixo === 'H' ? [k, lane] : [lane, k])
const loc = (eixo: Eixo, a: number, c: number): { x: number; z: number } => (eixo === 'H' ? { x: a, z: c } : { x: c, z: a })
const seco = (b: string): boolean => b === 'serra_ouro' || b === 'basalto_brasa'

/** O ponto local `(x, z)` do quadrado `(i, j)` está livre das zonas (nascimento, pedra e a base inimiga DE QUALQUER dos 9 quadrados em volta)? `folga` alarga as zonas (m). */
export function livre(i: number, j: number, x: number, z: number, folga = 0): boolean {
  for (let di = -1; di <= 1; di += 1) {
    for (let dj = -1; dj <= 1; dj += 1) {
      const b = lugarDaBaseInimiga(i + di, j + dj)
      if (Math.hypot(x - LADO * di - b.x, z - LADO * dj - b.z) < P.zonaProibida.base + folga) return false
      if (Math.hypot(x - LADO * di, z - LADO * dj) < P.zonaProibida.claro + folga) return false
      if (Math.hypot(x - LADO * di + 8, z - LADO * dj - 10) < P.zonaProibida.pedra + folga) return false
    }
  }
  return true
}

/** A aresta `k` da pista não pode ter rio: toca o quadrado de nascimento (0, 0) ou um quadrado de bioma seco. Exportada só para o teste (a regra «sem rio em (0, 0)» não é exercida pelo mundo medido). */
export function arestaBloqueada(eixo: 'H' | 'V', lane: number, k: number): boolean {
  const [ia, ja] = quad(eixo, lane, k)
  const [ib, jb] = quad(eixo, lane, k + 1)
  return (ia === 0 && ja === 0) || (ib === 0 && jb === 0) || seco(biomaDoQuadrado(ia, ja)) || seco(biomaDoQuadrado(ib, jb))
}

const SAL = {
  H: { off: 11, seg: 21, sinal: 22, mag: 23, fase: 31 },
  V: { off: 12, seg: 24, sinal: 25, mag: 26, fase: 32 },
} as const

function segDe(eixo: Eixo, lane: number, k: number): { off: number; s: number } {
  const off = hash(lane, SAL[eixo].off) % P.arestasPorSegmento
  return { off, s: Math.floor((k - off) / P.arestasPorSegmento) }
}

/** O rio dentro do quadrado `k` da pista, da janela `w0` (aresta k−1) à janela `w1` (aresta k): Bézier cúbica com tangentes ao longo da pista e um meandro que some nas pontas (sin²: tangente contínua na emenda). */
function curvaAtravessa(eixo: Eixo, lane: number, k: number, w0: number, w1: number): Array<{ a: number; c: number }> {
  const [iq, jq] = quad(eixo, lane, k)
  const fase = 2 * Math.PI * u01(iq, jq, SAL[eixo].fase)
  const pts: Array<{ a: number; c: number }> = []
  const N = LADO
  for (let n = 0; n <= N; n += 1) {
    const t = n / N
    const mt = 1 - t
    const a = mt ** 3 * -MEIA + 3 * mt * mt * t * -19 + 3 * mt * t * t * 19 + t ** 3 * MEIA
    let c = mt ** 3 * w0 + 3 * mt * mt * t * w0 + 3 * mt * t * t * w1 + t ** 3 * w1
    c += P.meandro * Math.sin(Math.PI * t) ** 2 * Math.sin(3 * Math.PI * t + fase)
    pts.push({ a, c })
  }
  return pts
}

// ── a MEMÓRIA, com LIMITE (o mundo é ilimitado): descartar uma entrada e recalculá-la dá o MESMO resultado (tudo é puro), então o limite só custa tempo ──
class MemoriaComLimite<V> {
  private readonly mapa = new Map<string, V>()
  constructor(private readonly aoDescartar?: (valor: V) => void) {}
  get(chave: string): V | undefined {
    const v = this.mapa.get(chave)
    if (v === undefined) return undefined
    this.mapa.delete(chave)
    this.mapa.set(chave, v)
    return v
  }
  set(chave: string, v: V): void {
    // trocar o valor guardado sob a MESMA chave também descarta o antigo (o rio calculado com outra função de altura não pode ficar na grade)
    const anterior = this.mapa.get(chave)
    this.mapa.delete(chave)
    this.mapa.set(chave, v)
    if (anterior !== undefined && anterior !== v) this.aoDescartar?.(anterior)
    if (this.mapa.size > LIMITE_DA_MEMORIA) {
      const velho = this.mapa.keys().next().value
      if (velho !== undefined) {
        const valor = this.mapa.get(velho)
        this.mapa.delete(velho)
        if (valor !== undefined) this.aoDescartar?.(valor)
      }
    }
  }
  /** Lê sem mexer na ordem de uso (o `get` a reordenaria). Só para a inspeção do teste. */
  espiar(chave: string): V | undefined {
    return this.mapa.get(chave)
  }
  get tamanho(): number {
    return this.mapa.size
  }
  limpar(): void {
    if (this.aoDescartar) for (const v of this.mapa.values()) this.aoDescartar(v)
    this.mapa.clear()
  }
}

// Sobe quando a memória descarta um rio ou é limpa: invalida a lembrança do último quadrado registrado (`garantirOsRiosEmVolta`).
let carimboDaMemoria = 0
let ultimoQuadrado: { i: number; j: number; alturaBase: AlturaDeBase | null; carimbo: number } = { i: NaN, j: NaN, alturaBase: null, carimbo: -1 }

const memoriaDeCorridas = new MemoriaComLimite<Cadeia[]>()
// Um rio descartado da memória SAI da grade de 10 m (declarada mais abaixo): sem isso a grade guardaria referências a rios mortos e VAZARIA num mundo ilimitado (medido: ficou 649 > 512 entradas).
const memoriaDeRios = new MemoriaComLimite<Rio>((rio) => {
  carimboDaMemoria += 1
  esquecerNaGrade(rio)
})

export function limparMemoriaDaAgua(): void {
  memoriaDeCorridas.limpar()
  memoriaDeRios.limpar()
  gradeDeRios.clear()
  carimboDaMemoria += 1
  ultimoQuadrado = { i: NaN, j: NaN, alturaBase: null, carimbo: -1 }
}
/** As corridas e os rios guardados: cada memória tem limite de 512 PRÓPRIO; o teste olha cada uma (e a grade) e a SOMA é o que mede o vazamento total. */
export function tamanhoDaMemoriaDaAgua(): { corridas: number; rios: number } {
  return { corridas: memoriaDeCorridas.tamanho, rios: memoriaDeRios.tamanho }
}
/** Quantas CÉLULAS de 10 m a grade de rios tem: o teste prova que ela acompanha a memória dos rios (não cresce sem limite). */
export function celulasDaGradeDaAgua(): number {
  return gradeDeRios.size
}
/** Quantas entradas da grade apontam para um rio que a MEMÓRIA já descartou (deve ser 0: o descarte tira o rio da grade). Só para o teste. */
export function entradasOrfasDaGrade(): number {
  const guardados = new Set<Rio>()
  for (const lista of gradeDeRios.values()) for (const e of lista) guardados.add(e.rio)
  let orfas = 0
  for (const rio of guardados) if (memoriaDeRios.espiar(rio.id) !== rio) orfas += 1
  return orfas
}

function corrida(eixo: Eixo, lane: number, s: number): Cadeia[] {
  const chave = `${eixo}${lane}:${s}`
  const guardada = memoriaDeCorridas.get(chave)
  if (guardada) return guardada
  const off = hash(lane, SAL[eixo].off) % P.arestasPorSegmento
  const k0 = off + P.arestasPorSegmento * s
  let cadeias: Travessia[][] = []
  if (u01(lane, s, SAL[eixo].seg) < P.chanceDoSegmento[eixo]) {
    const sinal = u01(lane, s, SAL[eixo].sinal) < 0.5 ? -1 : 1
    let cad: Travessia[] = []
    const fechar = (): void => {
      if (cad.length) cadeias.push(cad)
      cad = []
    }
    for (let k = k0; k < k0 + P.arestasPorSegmento - 1; k += 1) {
      if (arestaBloqueada(eixo, lane, k) || (eixo === 'V' && cortaPorH(lane, k))) {
        fechar()
        continue
      }
      const [ia, ja] = quad(eixo, lane, k)
      const [ib, jb] = quad(eixo, lane, k + 1)
      const ordem = hash(lane, k, SAL[eixo].mag) & 1 ? [42, 14] : [14, 42]
      let escolhida: Travessia | null = null
      for (const m of ordem) {
        const w = sinal * m
        const pa = loc(eixo, MEIA, w)
        const pb = loc(eixo, -MEIA, w)
        if (!livre(ia, ja, pa.x, pa.z) || !livre(ib, jb, pb.x, pb.z)) continue
        if (cad.length) {
          // a curva entre o vau ANTERIOR (aresta k−1) e este (aresta k) vive no quadrado A desta aresta (`ia, ja`): é onde `livre` precisa olhar
          const cv = curvaAtravessa(eixo, lane, k, cad[cad.length - 1].w, w)
          if (!cv.every((p) => { const q = loc(eixo, p.a, p.c); return livre(ia, ja, q.x, q.z) })) continue
        }
        // o BRAÇO que chega a este vau pelo lado A e o que sai pelo lado B também têm de estar livres, mesmo na PRIMEIRA e na ÚLTIMA travessia
        let bracoLivre = true
        for (let a2 = 0; a2 <= P.braco && bracoLivre; a2 += 2) {
          const qa = loc(eixo, MEIA - a2, w)
          const qb = loc(eixo, -MEIA + a2, w)
          if (!livre(ia, ja, qa.x, qa.z) || !livre(ib, jb, qb.x, qb.z)) bracoLivre = false
        }
        if (!bracoLivre) continue
        escolhida = { k, w }
        break
      }
      if (!escolhida) {
        fechar()
        continue
      }
      cad.push(escolhida)
    }
    fechar()
    // as pontas: a BACIA fica a 16 m da aresta; se ela não cabe (zona proibida), a travessia da ponta sai da corrida
    cadeias = cadeias
      .map((cadeia) => {
        let c = cadeia
        while (c.length >= 2) {
          const ini = c[0]
          const fim = c[c.length - 1]
          const [ia, ja] = quad(eixo, lane, ini.k)
          const [ib, jb] = quad(eixo, lane, fim.k + 1)
          const hi = loc(eixo, MEIA - P.braco, ini.w)
          const hf = loc(eixo, -MEIA + P.braco, fim.w)
          const okI = livre(ia, ja, hi.x, hi.z, 8)
          const okF = livre(ib, jb, hf.x, hf.z, 8)
          if (okI && okF) break
          c = okI ? c.slice(0, -1) : c.slice(1)
        }
        return c
      })
      .filter((c) => c.length >= 2)
  }
  const out: Cadeia[] = cadeias.map((edges) => ({ eixo, lane, s, edges }))
  memoriaDeCorridas.set(chave, out)
  return out
}

function ativaAresta(eixo: Eixo, lane: number, k: number): boolean {
  const { s } = segDe(eixo, lane, k)
  return corrida(eixo, lane, s).some((c) => c.edges.some((e) => e.k === k))
}
const temH = (i: number, j: number): boolean => ativaAresta('H', j, i - 1) || ativaAresta('H', j, i)
function cortaPorH(i: number, k: number): boolean {
  return temH(i, k) || temH(i, k + 1)
}
function toca(c: Cadeia, i: number, j: number): boolean {
  const a = c.edges[0].k
  const b = c.edges[c.edges.length - 1].k + 1
  return c.eixo === 'H' ? j === c.lane && i >= a && i <= b : i === c.lane && j >= a && j <= b
}
function cadeiasDoQuadrado(i: number, j: number): Cadeia[] {
  const out: Cadeia[] = []
  for (const k of [i - 1, i]) for (const c of corrida('H', j, segDe('H', j, k).s)) if (toca(c, i, j) && !out.includes(c)) out.push(c)
  for (const k of [j - 1, j]) for (const c of corrida('V', i, segDe('V', i, k).s)) if (toca(c, i, j) && !out.includes(c)) out.push(c)
  return out
}

/** A poligonal GLOBAL da corrida (amostras de ~1 m): braço inicial, quadrados atravessados, braço final. */
function poligonal(c: Cadeia): Array<{ X: number; Z: number }> {
  const { eixo, lane, edges } = c
  const pts: Array<{ X: number; Z: number }> = []
  const G = (i: number, j: number, a: number, cc: number): { X: number; Z: number } => {
    const q = loc(eixo, a, cc)
    return { X: LADO * i + q.x, Z: LADO * j + q.z }
  }
  const ini = edges[0]
  const fim = edges[edges.length - 1]
  {
    const [i, j] = quad(eixo, lane, ini.k)
    for (let a = MEIA - P.braco; a <= MEIA; a += 1) pts.push(G(i, j, a, ini.w))
  }
  for (let m = 1; m < edges.length; m += 1) {
    const [i, j] = quad(eixo, lane, edges[m].k)
    const cv = curvaAtravessa(eixo, lane, edges[m].k, edges[m - 1].w, edges[m].w)
    for (let n = 1; n < cv.length; n += 1) pts.push(G(i, j, cv[n].a, cv[n].c))
  }
  {
    const [i, j] = quad(eixo, lane, fim.k + 1)
    for (let a = -MEIA + 1; a <= -MEIA + P.braco; a += 1) pts.push(G(i, j, a, fim.w))
  }
  return pts
}

/** O nível d'água ao longo do rio: só DESCE rio abaixo (o mínimo corrente do chão em volta menos 0,2 m, suavizado). `alturaBase` é a altura do relevo SEM rio, entregue pelo gerador. */
function niveisDoRio(pts: ReadonlyArray<{ X: number; Z: number }>, alturaBase: (X: number, Z: number) => number): Float64Array {
  const N = pts.length
  const anel = (X: number, Z: number): number => {
    let s = alturaBase(X, Z)
    for (let q = 0; q < 8; q += 1) s += alturaBase(X + 8 * Math.cos((q / 8) * 2 * Math.PI), Z + 8 * Math.sin((q / 8) * 2 * Math.PI))
    return s / 9
  }
  const idx: number[] = []
  for (let k = 0; k < N; k += 4) idx.push(k)
  if (idx[idx.length - 1] !== N - 1) idx.push(N - 1)
  const B = new Float64Array(N)
  for (const k of idx) B[k] = anel(pts[k].X, pts[k].Z)
  for (let q = 0; q + 1 < idx.length; q += 1) {
    const a = idx[q]
    const b = idx[q + 1]
    for (let k = a + 1; k < b; k += 1) B[k] = lerp(B[a], B[b], (k - a) / (b - a))
  }
  const lv0 = new Float64Array(N)
  let corr = Infinity
  for (let k = 0; k < N; k += 1) {
    corr = Math.min(corr, B[k] - 0.2)
    lv0[k] = corr
  }
  const lv = new Float64Array(N)
  corr = Infinity
  for (let k = 0; k < N; k += 1) {
    let s = 0
    let n = 0
    for (let d = -6; d <= 6; d += 1) {
      const kk = k + d
      if (kk >= 0 && kk < N) {
        s += lv0[kk]
        n += 1
      }
    }
    corr = Math.min(corr, s / n)
    lv[k] = corr
  }
  return lv
}

/** A função que entrega a altura do relevo SEM rio num ponto global `(X, Z)`: o gerador a passa (`alturaGlobal · (1 − mascaraPlana)`). O módulo NÃO a replica. */
export type AlturaDeBase = (X: number, Z: number) => number

/**
 * Os rios que TOCAM o quadrado `(i, j)`. O nível d'água de um rio depende da altura de base (o mínimo corrente do chão em volta), então ela entra POR PARÂMETRO, sem registro global: o módulo não guarda estado escondido.
 * A memória guarda o `Rio` junto com a função `alturaBase` que o calculou e SÓ o reaproveita se for a MESMA referência (o gerador passa sempre a mesma função, definida uma vez); com outra função o nível é recalculado.
 */
export function riosDoQuadrado(i: number, j: number, alturaBase: AlturaDeBase): readonly Rio[] {
  return cadeiasDoQuadrado(i, j).map((c) => rioDaCadeia(c, alturaBase))
}

/** As poligonais globais dos rios que tocam `(i, j)`, sem tocar na `memoriaDeRios`. */
export function poligonaisDosRiosNoQuadrado(
  i: number,
  j: number,
): ReadonlyArray<ReadonlyArray<{ readonly X: number; readonly Z: number }>> {
  return cadeiasDoQuadrado(i, j).map(poligonal)
}

const funcaoDoRio = new WeakMap<Rio, AlturaDeBase>()
function rioDaCadeia(c: Cadeia, alturaBase: AlturaDeBase): Rio {
  const id = `${c.eixo}${c.lane}:${c.s}:${c.edges[0].k}`
  const guardado = memoriaDeRios.get(id)
  if (guardado && funcaoDoRio.get(guardado) === alturaBase) return guardado
  const pontos = poligonal(c)
  const rio: Rio = { id, eixo: c.eixo, pontos, niveis: niveisDoRio(pontos, alturaBase) }
  funcaoDoRio.set(rio, alturaBase)
  memoriaDeRios.set(id, rio)
  return rio
}

// ── a ESCAVAÇÃO: a grade de 10 m dos pontos de rio, registrada SOB DEMANDA (o gerador consulta ponto a ponto, sem «registrar a região» antes) ──
const CEL = 10

interface PontoDaGrade {
  readonly rio: Rio
  readonly k: number
}
/** A chave de uma célula da grade de 10 m: um INTEIRO único (as chaves de texto alocavam 50 strings por ponto e eram ~85 % do custo). Cobre ±327 km de células. */
export const chaveDaCelula = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768)
const gradeDeRios = new Map<number, PontoDaGrade[]>()
const rioRegistrado = new WeakSet<Rio>()

function esquecerNaGrade(rio: Rio): void {
  if (!rioRegistrado.has(rio)) return
  const vistas = new Set<number>()
  for (const p of rio.pontos) vistas.add(chaveDaCelula(Math.floor(p.X / CEL), Math.floor(p.Z / CEL)))
  for (const chave of vistas) {
    const lista = gradeDeRios.get(chave)
    if (!lista) continue
    const resto = lista.filter((s) => s.rio !== rio)
    if (resto.length === 0) gradeDeRios.delete(chave)
    else gradeDeRios.set(chave, resto)
  }
  rioRegistrado.delete(rio)
}

function registrar(rio: Rio): void {
  if (rioRegistrado.has(rio)) return
  rio.pontos.forEach((p, k) => {
    const chave = chaveDaCelula(Math.floor(p.X / CEL), Math.floor(p.Z / CEL))
    let lista = gradeDeRios.get(chave)
    if (!lista) {
      lista = []
      gradeDeRios.set(chave, lista)
    }
    lista.push({ rio, k })
  })
  rioRegistrado.add(rio)
}

/**
 * Registra os rios dos quadrados em volta do ponto: um rio que passa a 16 m (o alcance da influência: margem 5 + retorno 11) de uma aresta é visto pelos DOIS lados dela, então o ponto precisa conhecer os rios do
 * próprio quadrado e dos 8 vizinhos. A memória descarta rios antigos; a grade guarda REFERÊNCIAS, então um rio descartado e recalculado é OUTRO objeto (a grade nova o registra de novo) e o resultado é o mesmo.
 */
function garantirOsRiosEmVolta(X: number, Z: number, alturaBase: AlturaDeBase): void {
  const i0 = Math.round(X / LADO)
  const j0 = Math.round(Z / LADO)
  // O gerador consulta ponto a ponto e quase todos os pontos seguidos são do MESMO quadrado: refazer os 9 `riosDoQuadrado` a cada ponto custava ~4 µs dos ~5 µs por ponto (medido). O resultado só pode mudar se o
  // quadrado, a função de altura ou a memória mudaram; o `carimbo` sobe em todo descarte de rio e em `limparMemoriaDaAgua`, então um rio descartado nunca fica «registrado» só na lembrança.
  if (ultimoQuadrado.i === i0 && ultimoQuadrado.j === j0 && ultimoQuadrado.alturaBase === alturaBase && ultimoQuadrado.carimbo === carimboDaMemoria) return
  for (let di = -1; di <= 1; di += 1) for (let dj = -1; dj <= 1; dj += 1) for (const r of riosDoQuadrado(i0 + di, j0 + dj, alturaBase)) registrar(r)
  ultimoQuadrado = { i: i0, j: j0, alturaBase, carimbo: carimboDaMemoria }
}

function distanciaAoSegmento(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const L2 = dx * dx + dz * dz
  let t = L2 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

/** O rio mais perto de `(X, Z)`: a distância e o NÍVEL, este como uma MÉDIA SUAVE dos níveis dos pontos a menos de `d + 3 m` (contínuo no ponto), ou `null` se nenhum rio está ao alcance da influência. */
function rioMaisPerto(X: number, Z: number): { d: number; lv: number } | null {
  const cx = Math.floor(X / CEL)
  const cz = Math.floor(Z / CEL)
  let dm = Infinity
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      const lista = gradeDeRios.get(chaveDaCelula(cx + dx, cz + dz))
      if (!lista) continue
      for (const s of lista) {
        const p = s.rio.pontos
        let d = Math.hypot(p[s.k].X - X, p[s.k].Z - Z)
        if (d > dm + 2) continue
        if (s.k > 0) d = Math.min(d, distanciaAoSegmento(X, Z, p[s.k - 1].X, p[s.k - 1].Z, p[s.k].X, p[s.k].Z))
        if (s.k < p.length - 1) d = Math.min(d, distanciaAoSegmento(X, Z, p[s.k].X, p[s.k].Z, p[s.k + 1].X, p[s.k + 1].Z))
        if (d < dm) dm = d
      }
    }
  }
  if (dm > P.margemPlana + P.retorno) return null
  // O NÍVEL tem de ser CONTÍNUO no ponto: o nível do ponto mais perto SALTA quando dois trechos do rio empatam em distância (medido: 1,7 mm na emenda (3, 0), t = −56, d = 14,000000 dos dois lados com níveis −0,2288 e −0,2541).
  let somaPeso = 0
  let somaLv = 0
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      const lista = gradeDeRios.get(chaveDaCelula(cx + dx, cz + dz))
      if (!lista) continue
      for (const s of lista) {
        const d = Math.hypot(s.rio.pontos[s.k].X - X, s.rio.pontos[s.k].Z - Z)
        const w = 1 - sm((d - dm) / 3)
        if (w > 0) {
          somaPeso += w
          somaLv += w * s.rio.niveis[s.k]
        }
      }
    }
  }
  return { d: dm, lv: somaLv / somaPeso }
}

/**
 * A ALTURA NOVA no ponto global `(X, Z)` e o NÍVEL d'água ali (ou `null` fora do rio). `alturaBase` é a altura do relevo SEM rio (o gerador a entrega: a mesma conta de `calcularLinha`); `zonaPlana` é a máscara das zonas
 * SEM as janelas de passagem (o rio atravessa a janela: com a máscara inteira ele seria zerado justamente nos vaus). A escavação CEDE à zona plana, como a bacia das lagoas do gerador: o rio nunca invade a base inimiga.
 * Margem plana de 5 m, retorno de 11 m ao relevo original, fundo de 1 m e parede de 2,6 m, abaixo do nível; o terreno ao lado é levado ao nível da margem (nível + 0,18 m), então a água só aparece DENTRO do canal.
 */
export function escavacaDoRio(
  X: number,
  Z: number,
  alturaBase: AlturaDeBase,
  zonaPlana: (X: number, Z: number) => number,
): { readonly altura: number; readonly nivel: number | null } {
  return escavacaDoRioComBase(X, Z, alturaBase(X, Z), alturaBase, zonaPlana)
}

/**
 * A mesma escavação com o `h0` (a altura de base NESTE ponto) já calculado. O gerador do relevo tem o `h0` em mãos (calcula `alturaGlobal · (1 − máscara)` em todo ponto): recalculá-lo aqui custava 185 ms por
 * quadrado (235 % do gerador, medido com a altura de base real). `alturaBase` só é chamada para CALCULAR UM RIO (o anel do nível), uma vez por rio, nunca por ponto.
 */
export function escavacaDoRioComBase(
  X: number,
  Z: number,
  h0: number,
  alturaBase: AlturaDeBase,
  zonaPlana: (X: number, Z: number) => number,
): { readonly altura: number; readonly nivel: number | null } {
  garantirOsRiosEmVolta(X, Z, alturaBase)
  const rio = rioMaisPerto(X, Z)
  if (!rio) return { altura: h0, nivel: null }
  const wz = 1 - zonaPlana(X, Z)
  const margem = rio.lv + 0.18
  const q = (1 - sm((rio.d - P.margemPlana) / P.retorno)) * wz
  const p = (1 - sm((rio.d - P.fundo) / P.parede)) * wz
  const altura = lerp(h0, margem, q) - (margem - (rio.lv - 0.5)) * p
  return { altura, nivel: rio.d < 6.5 ? rio.lv : null }
}

/** O nível d'água que vale em `(X, Z)` (para o desenho), ou `null` fora da água. */
export function nivelDaAguaEm(X: number, Z: number, alturaBase: AlturaDeBase, zonaPlana: (X: number, Z: number) => number): number | null {
  return escavacaDoRio(X, Z, alturaBase, zonaPlana).nivel
}
