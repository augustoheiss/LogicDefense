import { biomaDoQuadrado, gerarPaisagemBioma, type BiomaId } from '../biomaRecursos'
import { lugarDaBaseInimiga } from '../partidaSim'
import { type CampoRelevo, LADO_RELEVO, MEIA_RELEVO, RELEVO_REGRAS } from './campoRelevo'
import { fbm, ridged, suave } from './ruidoRelevo'

/**
 * O gerador do relevo (24/11/2026). Entrada: o índice `(i, j)` do quadrado e nada mais. Saída: o `CampoRelevo` dele. PURO e determinístico (I6): sem `Math.random`, sem `Date`, então um
 * quadrado descartado do cache renasce IGUAL, e o mundo ilimitado não precisa guardar nada.
 *
 * Como a emenda entre quadrados não mostra degrau (I3): a altura de um ponto é uma função GLOBAL `altura(X, Z)` com `X = 112·i + x`, `Z = 112·j + z`, definida para todo o plano. As bordas de
 * dois quadrados vizinhos amostram o MESMO ponto global (a grade inclui −56 e +56), e o que muda de bioma para bioma (amplitude e forma) é interpolado entre os centros dos quadrados.
 */

const LADO_QUADRADO = 112

/** O arquétipo de relevo de cada bioma `[D-minha, aprovado em 24/11 e afinado olhando as fotos de F0]`. Amplitudes em metros acima da rua. */
interface Arquetipo {
  readonly amplitude: number
  readonly piso: number
  readonly escala: number
  readonly oitavas: number
  /** 0 = colinas suaves (fbm); 1 = serras e paredões (ridged). Mistura os dois. */
  readonly serra: number
  /** Quantização em degraus (mesas e cânions da serra_ouro): 0 = sem degraus. */
  readonly degraus: number
  readonly sal: number
  /**
   * A MÉDIA da altura pura do arquétipo (m), subtraída no fim: CENTRA o relevo em 0. MEDIDA (25/11, `.superpowers/mut/medir-media-final.mjs`, 4 estimadores que não aliasam com a escala: passo 1
   * e os primos 7, 11 e 13), não deduzida de `(piso + amplitude) / 2`: o ruído fractal não é uniforme (o basalto dá 2,139, não 1,75). Sem isto 90 a 99 % do chão ficava acima do plano da névoa
   * (+0,33 m) e 0 % abaixo de −0,2 m: um platô de morros sem vale. Mexer em `amplitude`, `piso`, `escala`, `oitavas`, `serra` ou `sal` MUDA a média: remeça com o script e atualize.
   */
  readonly centro: number
}

const ARQUETIPOS: Readonly<Record<BiomaId, Arquetipo>> = {
  clareira: { amplitude: 3.0, piso: -1.0, escala: 1 / 38, oitavas: 4, serra: 0.0, degraus: 0, sal: 11, centro: 0.999 },
  bosque: { amplitude: 4.5, piso: -2.5, escala: 1 / 32, oitavas: 5, serra: 0.24, degraus: 0, sal: 23, centro: 1.165 },
  serra_ouro: { amplitude: 6.0, piso: -3.0, escala: 1 / 36, oitavas: 4, serra: 0.42, degraus: 1.6, sal: 37, centro: 1.856 },
  ribeira: { amplitude: 2.5, piso: -1.0, escala: 1 / 44, oitavas: 4, serra: 0.0, degraus: 0, sal: 41, centro: 0.75 },
  // as cristas da tundra e do basalto prendiam até 3 recursos por quadrado (medido em 24/11, 369 quadrados): menos serra e escala maior, mantendo a silhueta afiada
  tundra_cristal: { amplitude: 6.0, piso: -3.5, escala: 1 / 32, oitavas: 4, serra: 0.5, degraus: 0, sal: 53, centro: 1.702 },
  basalto_brasa: { amplitude: 6.5, piso: -3.0, escala: 1 / 32, oitavas: 5, serra: 0.42, degraus: 0, sal: 67, centro: 2.139 },
}

/**
 * A semente do MUNDO inteiro, somada ao `sal` de cada bioma. É UMA constante global e nunca varia por quadrado: variar por quadrado (a ideia de «recompor um quadrado ruim») abre degraus nas
 * emendas (medido em 24/11: até 0,82 m). Trocar este número muda o relevo de todo o mundo de uma vez, igual para todos os quadrados.
 */
const SAL_DO_MUNDO = 0

/** O nível da superfície da água (m), um pouco abaixo da rua (os lagos do jogo ficam a −0,375 no desenho). */
const NIVEL_AGUA = -0.4

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** A altura que o arquétipo `a` daria em `(X, Z)`, sozinho (sem mistura com os vizinhos). */
function alturaDoArquetipo(a: Arquetipo, X: number, Z: number, sal: number): number {
  const suaveV = fbm(X * a.escala, Z * a.escala, a.sal + sal, a.oitavas)
  const serraV = ridged(X * a.escala, Z * a.escala, a.sal + sal + 7, a.oitavas) * 2 - 1
  const bruto = lerp(suaveV, serraV, a.serra)
  const normalizado = (bruto + 1) / 2
  let h = a.piso + normalizado * (a.amplitude - a.piso)
  if (a.degraus > 0.05) {
    h = lerp(h, Math.round(h / a.degraus) * a.degraus, 0.55)
  }
  // CENTRA em 0 (25/11): a subtração é DENTRO do arquétipo, antes da mistura contínua entre vizinhos, então as emendas (I3) não abrem
  return h - a.centro
}

/**
 * A altura do ARQUÉTIPO de um bioma em `(X, Z)`, PURA (sem mistura com os vizinhos, sem máscara, sem bacia). Exportada SÓ para teste e medição (o mesmo padrão de `mascaraPlana`): é o oráculo
 * do centramento (a média de cada bioma tem de ser ~0) e o único jeito de medir um arquétipo sem o ruído dos vizinhos (os biomas são sorteados por hash: quase nenhum quadrado tem os 8 em
 * volta iguais).
 */
export function alturaBrutaDoBioma(bioma: BiomaId, X: number, Z: number): number {
  return alturaDoArquetipo(ARQUETIPOS[bioma], X, Z, SAL_DO_MUNDO)
}

/**
 * Altura bruta global em `(X, Z)` (antes das máscaras planas e das bacias). Mistura as ALTURAS dos 4 biomas mais próximos, não os seus parâmetros: interpolar a semente do ruído (o `sal`) trocaria o
 * campo inteiro de uma vez no meio do intervalo, e medido em 24/11 isso abria degraus de até 0,76 m nas emendas entre biomas diferentes. Cada bioma usa a PRÓPRIA semente e o PRÓPRIO relevo, e o peso
 * (`suave` do afastamento ao centro de cada quadrado) varia de 0 a 1 sem salto, então a altura é contínua em todo o plano.
 */
function alturaGlobal(X: number, Z: number, sal: number): number {
  const fi = X / LADO_QUADRADO
  const fj = Z / LADO_QUADRADO
  const i0 = Math.floor(fi)
  const j0 = Math.floor(fj)
  const tx = suave(fi - i0)
  const tz = suave(fj - j0)
  // Os 4 cantos costumam repetir o bioma, e o peso de um canto é 0 quando `tx` ou `tz` é exatamente 0 ou 1. Cada ARQUÉTIPO é calculado uma vez só, e só se algum canto de peso > 0 o usa.
  // O resultado é BIT A BIT o mesmo da mistura dos 4 termos (a soma dos pesos de cada canto é a mesma): é só deixar de repetir o mesmo cálculo.
  const pesos = [(1 - tx) * (1 - tz), tx * (1 - tz), (1 - tx) * tz, tx * tz]
  const arquetipos = [
    ARQUETIPOS[biomaDoQuadrado(i0, j0)],
    ARQUETIPOS[biomaDoQuadrado(i0 + 1, j0)],
    ARQUETIPOS[biomaDoQuadrado(i0, j0 + 1)],
    ARQUETIPOS[biomaDoQuadrado(i0 + 1, j0 + 1)],
  ]
  let total = 0
  for (let c = 0; c < 4; c += 1) {
    if (pesos[c] === 0) continue
    // junta o peso de todos os cantos que usam O MESMO arquétipo, para calcular a altura dele uma vez
    let pesoJunto = pesos[c]
    let jaFeito = false
    for (let d = 0; d < c; d += 1) if (arquetipos[d] === arquetipos[c] && pesos[d] !== 0) jaFeito = true
    if (jaFeito) continue
    for (let d = c + 1; d < 4; d += 1) if (arquetipos[d] === arquetipos[c]) pesoJunto += pesos[d]
    total += alturaDoArquetipo(arquetipos[c], X, Z, sal) * pesoJunto
  }
  return total
}

/** Máscara `[0, 1]`: 1 = totalmente achatado a 0. `dist` é a distância ao núcleo plano; `plano` o raio totalmente plano; `rampa` o comprimento da transição. */
function mascaraDisco(dist: number, plano: number, rampa: number): number {
  if (dist <= plano) return 1
  if (dist >= plano + rampa) return 0
  return 1 - suave((dist - plano) / rampa)
}

/**
 * O quanto a máscara de uma ZONA plana achata o ponto GLOBAL `(X, Z)`. A máscara é função do PONTO, não do quadrado que a pede (I3): perto de uma aresta, os dois quadrados vizinhos
 * enxergam as mesmas zonas (a base de cada um dos 9 quadrados em volta e as janelas de passagem), e por isso os dois lados da emenda recebem o MESMO achatamento. Medido em 24/11: com a
 * máscara só do próprio quadrado, a emenda de (−3,−6) saltava 0,94 m (a base de um lado achatava, a do vizinho não).
 */
// Exportada SÓ para o teste (`relevo.test.ts`): a rampa da praça (e das outras zonas) não se prova pelo campo, porque o relevo bruto é tão áspero que nenhuma medida estatística separa «com rampa»
// de «sem rampa» (medido em 25/11); a máscara é determinística, sem estado, função do ponto global.
export function mascaraPlana(X: number, Z: number): number {
  let m = 0
  const i0 = Math.round(X / LADO_QUADRADO)
  const j0 = Math.round(Z / LADO_QUADRADO)
  // as zonas dos quadrados cujo disco (14 m + 12 m de rampa) pode alcançar este ponto: o quadrado do ponto e os 8 vizinhos
  for (let di = -1; di <= 1; di += 1) {
    for (let dj = -1; dj <= 1; dj += 1) {
      const i = i0 + di
      const j = j0 + dj
      const x = X - LADO_QUADRADO * i
      const z = Z - LADO_QUADRADO * j
      // SEM A RUA (25/11, decisão do usuário: «essa rua não era pra existir, ela fazia parte de outro jogo… tem que ser diferente cada minimapa»). O corredor de 15 × 57 m e a praça de raio 8,5 m (que
      // existiam em TODO quadrado e achatavam 14 % dele) saíram, e com eles as 3 caixas. Ficam, em TODO quadrado e pelo ponto global (I3, os 9 quadrados em volta contribuem cada um com a sua):
      // (1) o CLARO DE NASCIMENTO: o herói nasce em (0, 0) (`heroiInicial`) e sem ele poderia nascer num morro; é o MENOR chão plano que cobre o corpo (raio 0,35) com folga;
      // (2) a PEDRA de 35 kg em (−8, 10), que o usuário mandou manter (alimenta o britador).
      m = Math.max(m, mascaraDisco(Math.hypot(x, z), RELEVO_REGRAS.claroDeNascimento, 6))
      m = Math.max(m, mascaraDisco(Math.hypot(x + 8, z - 10), 4.5, 12))
      // a base inimiga: disco plano de 14 m (cresce sem teto hoje, D15) e rampa de 12 m
      const base = lugarDaBaseInimiga(i, j)
      m = Math.max(m, mascaraDisco(Math.hypot(x - base.x, z - base.z), RELEVO_REGRAS.raioBaseInimiga, 12))
    }
  }
  // janelas de passagem: as arestas ficam em X, Z ≡ ±56 (mod 112). Cada janela é um «vão» plano de 14 m a cada 28 m ao longo da aresta, com rampa de 12 m. Como a aresta é DOS DOIS quadrados,
  // a distância à aresta e a posição ao longo dela vêm do ponto global: os dois lados veem a mesma janela.
  const meia = RELEVO_REGRAS.janelaPassagem / 2
  const passo = RELEVO_REGRAS.passoJanela
  // Os CENTROS das janelas ficam em ±14 e ±42 m do meio da aresta (contrato do plano e do teste), ou seja, em 28·k + 14. Como 112 = 4·28, o padrão se repete IGUAL em todo quadrado.
  // Medido em 24/11: centrá-las em 28·k (0, ±28, ±56) discordava do contrato, e a emenda saltava até 0,82 m nos trechos entre janelas.
  const aoLongo = (coord: number): number => {
    const k = Math.round((coord - passo / 2) / passo)
    return Math.max(0, Math.abs(coord - (k * passo + passo / 2)) - meia)
  }
  const distAresta = (coord: number): number => {
    const dentro = ((((coord + MEIA_RELEVO) % LADO_QUADRADO) + LADO_QUADRADO) % LADO_QUADRADO) // 0 na aresta, 56 no centro
    return Math.min(dentro, LADO_QUADRADO - dentro)
  }
  m = Math.max(m, mascaraDisco(Math.hypot(aoLongo(Z), distAresta(X)), 0, 12 + meia))
  m = Math.max(m, mascaraDisco(Math.hypot(aoLongo(X), distAresta(Z)), 0, 12 + meia))
  return m
}

/** Escava o leito das lagoas: 0,5–0,9 m abaixo da água, suave até a margem. Devolve a altura de leito desejada ou `undefined` fora das lagoas. */
function leitoDaLagoa(lagoas: ReadonlyArray<{ x: number; z: number; rx: number; rz: number }>, x: number, z: number): number | undefined {
  let melhor: number | undefined
  for (const l of lagoas) {
    const r = Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz)
    if (r >= 1.35) continue
    const fundo = NIVEL_AGUA - (0.5 + 0.4 * (1 - suave(Math.min(1, r))))
    const margem = r <= 1 ? 1 : 1 - suave((r - 1) / 0.35)
    const alvo = lerp(0, fundo, margem)
    if (melhor === undefined || alvo < melhor) melhor = alvo
  }
  return melhor
}

/** Calcula UMA linha (`gz`) do quadrado: as 113 células de `gx = −56 … +56`. É a unidade de trabalho da geração, tanto síncrona quanto fatiada: há um só caminho de cálculo. */
function calcularLinha(
  alturas: Float32Array,
  lagoas: ReadonlyArray<{ x: number; z: number; rx: number; rz: number }>,
  i: number,
  j: number,
  sal: number,
  gz: number,
): void {
  for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
    const X = LADO_QUADRADO * i + gx
    const Z = LADO_QUADRADO * j + gz
    let h = alturaGlobal(X, Z, sal)
    const plano = mascaraPlana(X, Z)
    h *= 1 - plano
    // a bacia da lagoa escava o leito 0,5–0,9 m abaixo da água, MAS CEDE às zonas planas (a rua, a praça e sobretudo o disco da base inimiga): a base cresce em anéis sem teto e uma peça
    // inimiga nunca pode nascer dentro d'água. Medido em 24/11: em 4 de 2.028 pontos a 13 m da base uma lagoa invadia o disco (até 0,93 m de desnível). A lagoa invasora fica SEM leito
    // (F2 deve desenhá-la como um brejo raso ou omiti-la; `gerarPaisagemBioma` é de outra frente e não a muda).
    const leito = leitoDaLagoa(lagoas, gx, gz)
    if (leito !== undefined && plano < 0.5) h = Math.min(h, leito)
    alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = h
  }
}

/**
 * Uma geração em andamento (24/11/2026). Gerar um quadrado custa ≈ 82 ms (medido; o orçamento de 12 ms era suposição minha) e só acontece UMA vez por quadrado (depois ele fica no cache),
 * mas 82 ms num quadro de 16,7 ms é um soluço de ~5 quadros. A tarefa divide o trabalho em linhas e deixa o jogo gastar só alguns ms por quadro. O resultado é IDÊNTICO ao síncrono por
 * construção: os dois chamam `calcularLinha`.
 */
export interface GeracaoRelevo {
  /** Calcula linhas até gastar `orcamentoMs` (sempre faz ao menos uma linha, para nunca travar). `NaN` ou negativo valem 0. Devolve se terminou. */
  passo(orcamentoMs: number): boolean
  terminou(): boolean
  /** Linhas prontas de 113, de 0 a 1. */
  progresso(): number
  /** O campo pronto. Lança erro se ainda não terminou: nunca devolve um campo pela metade. */
  resultado(): CampoRelevo
}

export function gerarRelevoFatiado(i: number, j: number): GeracaoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  const lagoas = gerarPaisagemBioma(i, j, 5000).lagoas
  let proxima = -MEIA_RELEVO
  const agora = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const tarefa: GeracaoRelevo = {
    passo(orcamentoMs: number): boolean {
      const limite = Number.isFinite(orcamentoMs) && orcamentoMs > 0 ? orcamentoMs : 0
      const inicio = agora()
      do {
        if (proxima > MEIA_RELEVO) break
        calcularLinha(alturas, lagoas, i, j, SAL_DO_MUNDO, proxima)
        proxima += 1
      } while (proxima <= MEIA_RELEVO && agora() - inicio < limite)
      return proxima > MEIA_RELEVO
    },
    terminou: () => proxima > MEIA_RELEVO,
    progresso: () => (proxima + MEIA_RELEVO) / LADO_RELEVO,
    resultado(): CampoRelevo {
      if (proxima <= MEIA_RELEVO) throw new Error(`o relevo de (${i},${j}) ainda não terminou (${Math.round(tarefa.progresso() * 100)} %)`)
      return { i, j, alturas, nivelAgua: NIVEL_AGUA, versao: 1 }
    },
  }
  return tarefa
}

function construir(i: number, j: number): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  const lagoas = gerarPaisagemBioma(i, j, 5000).lagoas
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) calcularLinha(alturas, lagoas, i, j, SAL_DO_MUNDO, gz)
  return { i, j, alturas, nivelAgua: NIVEL_AGUA, versao: 1 }
}

const CAPACIDADE_CACHE = 64
const cache = new Map<string, CampoRelevo>()

export function limparCacheRelevo(): void {
  cache.clear()
}

/** Guarda um campo (gerado fatiado, por exemplo) no cache LRU, como `gerarRelevo` faria. Quem gerou fatiado chama isto no fim para o próximo `gerarRelevo(i, j)` ser instantâneo. */
export function guardarRelevoNoCache(campo: CampoRelevo): void {
  const chave = `${campo.i},${campo.j}`
  cache.delete(chave)
  cache.set(chave, campo)
  if (cache.size > CAPACIDADE_CACHE) {
    const maisAntigo = cache.keys().next().value
    if (maisAntigo !== undefined) cache.delete(maisAntigo)
  }
}

/**
 * O relevo do quadrado `(i, j)`: PURO (I6) e válido para QUALQUER par de inteiros (negativo, zero, grande). Cache LRU de 64 quadrados.
 *
 * NÃO recompõe com outra semente quando o quadrado sai difícil de jogar. Tentei (24/11) e foi o erro: 12 % dos quadrados foram recompostos com `sal` diferente e o campo deles deixou de casar
 * com o dos vizinhos (degraus de até 0,82 m nas emendas, I3), e 4 deles continuavam ruins mesmo após 8 tentativas. Medido: a base, as 4×4 janelas e a fração transitável (97–99 %) NUNCA
 * falham; o único critério que reprovava era «≥ 95 % dos recursos alcançáveis», e eram 20 quadrados com 1 recurso de 12 ou 13 caído num penhasco. Isso é problema da COLOCAÇÃO dos recursos
 * (`gerarPaisagemBioma` não conhece o relevo) e fica para F2, que deve mover o recurso preso para o ponto transitável mais próximo.
 */
export function gerarRelevo(i: number, j: number): CampoRelevo {
  const chave = `${i},${j}`
  const guardado = cache.get(chave)
  if (guardado) {
    cache.delete(chave)
    cache.set(chave, guardado)
    return guardado
  }
  const campo = construir(i, j)
  cache.set(chave, campo)
  if (cache.size > CAPACIDADE_CACHE) {
    const maisAntigo = cache.keys().next().value
    if (maisAntigo !== undefined) cache.delete(maisAntigo)
  }
  return campo
}
