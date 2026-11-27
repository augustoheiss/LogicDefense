import { PARTIDA } from '../partidaPolicies'
import { escavacaDoRioComBase, limparMemoriaDaAgua, riosDoQuadrado } from './aguaDoMundo'
import { gerarPaisagemBioma } from '../biomaRecursos'
import { RIOS_DE_REFERENCIA } from './aguaDoMundo.referencia'
import { alturaEm } from './campoRelevo'
import { chaoDaMalha, desnivelDaMalha } from './chaoDaMalha'
import { alturaDeBaseDoMundo, gerarRelevo, gerarRelevoFatiado, limparCacheRelevo, mascaraPlana, nivelDaAguaNoMundo, zonasPlanasSemJanelas } from './geradorRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const LADO = 112
const MEIA = 56
/** A chave da água é `boolean` mas `PARTIDA` é `as const` (somente leitura): o teste a liga por este cast LOCALIZADO e SEMPRE a devolve a `false` num `finally`. */
const chave = PARTIDA.relevo as { agua: boolean }
/** O que o RUNNER entrega (o projeto não tem `@types/node`: quem lê arquivo e calcula SHA-1 é o runner, como nos outros testes de texto). */
export interface InsumosDoGerador {
  /** `aguaNoGerador.hashes.json`: os hashes gravados ANTES de qualquer edição do gerador (Step 0 da Task 3): o jogo de hoje, bit a bit. */
  readonly hashes: string
  /** `.superpowers/agua/rios-do-prototipo.json`: os 13 rios medidos no protótipo (níveis das pontas). */
  readonly prototipo: string
  /** SHA-1 hexadecimal dos bytes de um array tipado. */
  readonly sha1: (a: Float32Array | Float64Array) => string
}

interface Hashes {
  quadrados: Record<string, string>
  fatiado: Record<string, string>
  mascaraPlana2000: string
  politica: { visual: boolean; agua: boolean }
}

/** `mascaraPlana` em 2.000 pontos reproduzíveis: a MESMA conta do script que gravou o hash (semente 20261126, 13 × 13 quadrados). */
function hashDaMascara(sha: (a: Float64Array) => string): string {
  let t = 20261126 >>> 0
  const rnd = (): number => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const vals = new Float64Array(2000)
  for (let k = 0; k < 2000; k += 1) vals[k] = mascaraPlana((rnd() - 0.5) * LADO * 13, (rnd() - 0.5) * LADO * 13)
  return sha(vals)
}

const desligados = new Map<string, Float32Array>()
/** O relevo do quadrado com a chave DESLIGADA (a referência «de hoje»), guardado por quadrado. */
function chaveDesligada(i: number, j: number): Float32Array {
  const c = `${i},${j}`
  let v = desligados.get(c)
  if (!v) {
    v = Float32Array.from(geradoComAChave(false, i, j))
    desligados.set(c, v)
  }
  return v
}

function geradoComAChave(ligada: boolean, i: number, j: number): Float32Array {
  const antes = PARTIDA.relevo.agua
  chave.agua = ligada
  try {
    limparCacheRelevo()
    limparMemoriaDaAgua()
    return gerarRelevo(i, j).alturas
  } finally {
    chave.agua = antes
    limparCacheRelevo()
    limparMemoriaDaAgua()
  }
}

/**
 * A ÁGUA NO GERADOR (F2, 26/11/2026, Task 3): o relevo ganha os RIOS escavados, só com `PARTIDA.relevo.agua` ligada. Com ela DESLIGADA o jogo é o de hoje bit a bit (I1): os hashes de 6 quadrados, do caminho fatiado e de
 * `mascaraPlana` em 2.000 pontos foram gravados ANTES de editar o gerador (`aguaNoGerador.hashes.json`).
 */
export function run(insumos: InsumosDoGerador): void {
  const sha = insumos.sha1
  const HASHES = JSON.parse(insumos.hashes) as Hashes
  const politicaOriginal = PARTIDA.relevo.agua
  assert(PARTIDA.relevo.agua === true && PARTIDA.relevo.visual === true, 'a política do jogo parte com relevo visual e rios ligados (decisão do usuário em 27/11/2026)')
  assert(HASHES.politica.agua === false && HASHES.politica.visual === false, 'os hashes de referência I1 foram gravados com as duas chaves desligadas')

  // (1) I1 — O MAIS IMPORTANTE: com a chave DESLIGADA os 6 quadrados saem bit a bit como hoje, pelos DOIS caminhos (síncrono e fatiado)
  for (const [chaveMap, esperado] of Object.entries(HASHES.quadrados)) {
    const [i, j] = chaveMap.split(',').map(Number)
    assert(sha(geradoComAChave(false, i, j)) === esperado, `I1: o quadrado (${i}, ${j}) com a chave desligada é BIT A BIT o de hoje (hash ${esperado})`)
    chave.agua = false
    try {
      limparCacheRelevo()
      limparMemoriaDaAgua()
      const g = gerarRelevoFatiado(i, j)
      while (!g.passo(2)) {
        /* fatias de 2 ms */
      }
      assert(sha(g.resultado().alturas) === HASHES.fatiado[chaveMap], `I1: o quadrado (${i}, ${j}) FATIADO com a chave desligada é bit a bit o de hoje`)
    } finally {
      chave.agua = politicaOriginal
      limparCacheRelevo()
      limparMemoriaDaAgua()
    }
  }
  assert(hashDaMascara(sha) === HASHES.mascaraPlana2000, 'I1: `mascaraPlana` em 2.000 pontos é bit a bit a de hoje (o refactor de `zonasPlanasSemJanelas` não mudou um bit)')
  // `mascaraPlana` = max(zonas, janelas): as zonas SEM as janelas nunca passam da máscara inteira, e DENTRO de uma janela de passagem a máscara inteira vale 1 enquanto as zonas valem menos. Os pontos do controle são
  // CONSTRUÍDOS (o meio de cada janela: na aresta X = 112·n + 56 e Z = 112·m + 14 ou 42): uma amostra sorteada nunca cai nas faixas estreitas das janelas (foi o primeiro erro deste teste: 0 em 4.000).
  let zonasMaiorQueTudo = 0
  for (let k = 0; k < 4000; k += 1) {
    const X = (((k * 7919) % 2001) - 1000) * 0.5 + 0.137
    const Z = (((k * 104729) % 2001) - 1000) * 0.5 + 0.091
    if (zonasPlanasSemJanelas(X, Z) > mascaraPlana(X, Z) + 1e-15) zonasMaiorQueTudo += 1
  }
  assert(zonasMaiorQueTudo === 0, 'as zonas sem as janelas nunca passam da máscara inteira')
  let janelaViva = 0
  let janelas = 0
  for (let n = -3; n <= 3; n += 1) {
    for (let m = -3; m <= 3; m += 1) {
      for (const dz of [14, 42, -14, -42]) {
        const X = LADO * n + MEIA // a aresta
        const Z = LADO * m + dz // o centro de uma janela
        janelas += 1
        if (mascaraPlana(X, Z) === 1 && zonasPlanasSemJanelas(X, Z) < 0.5) janelaViva += 1
      }
    }
  }
  assert(janelaViva >= janelas * 0.5, `CONTROLE: no centro de uma janela de passagem a máscara inteira vale 1 e as zonas valem < 0,5 (${janelaViva} de ${janelas} janelas): o rio não pode ser zerado ali`)

  // (2) a ALTURA DE BASE exportada é a conta do gerador: `alturaGlobal · (1 − mascaraPlana)`, igual ao `alturas` com a chave desligada nos pontos SEM bacia de lagoa
  chave.agua = false
  let comLagoa = 0
  let maiorDif = 0
  try {
    limparCacheRelevo()
    limparMemoriaDaAgua()
    const campo0 = gerarRelevo(3, 0)
    for (let gz = -MEIA; gz <= MEIA; gz += 1) {
      for (let gx = -MEIA; gx <= MEIA; gx += 1) {
        const gerado = campo0.alturas[(gz + MEIA) * 113 + (gx + MEIA)]
        const base = alturaDeBaseDoMundo(LADO * 3 + gx, gz)
        const dif = Math.abs(gerado - base)
        if (dif > 1e-5) comLagoa += 1
        else maiorDif = Math.max(maiorDif, dif)
      }
    }
  } finally {
    chave.agua = politicaOriginal
    limparCacheRelevo()
    limparMemoriaDaAgua()
  }
  assert(maiorDif < 1e-5, `a altura de base exportada concorda com o gerador (Float32) onde não há leito de lagoa: maior diferença ${maiorDif.toExponential(2)}`)
  assert(comLagoa < 113 * 113 * 0.2, `só os pontos com leito de lagoa diferem da altura de base (${comLagoa} de ${113 * 113})`)

  // (3) CHAVE LIGADA: o rio aparece. O quadrado (−1, 0) tem o rio V-1:-1:-2, e com a chave ligada o relevo dele MUDA; o quadrado (0, 0) (sem rio) NÃO muda
  const sem = geradoComAChave(false, -1, 0)
  const com = geradoComAChave(true, -1, 0)
  let mudados = 0
  let fundo = 0
  for (let k = 0; k < sem.length; k += 1) {
    if (sem[k] !== com[k]) mudados += 1
    fundo = Math.min(fundo, com[k] - sem[k])
  }
  assert(mudados > 500, `com a chave LIGADA o quadrado (−1, 0) tem o rio escavado (${mudados} de ${sem.length} alturas mudaram)`)
  assert(fundo < -0.4, `o canal é fundo de verdade (a maior queda é ${fundo.toFixed(2)} m, abaixo de −0,4)`)
  // O quadrado de NASCIMENTO (0, 0) não tem rio dentro, mas a escavação alcança 16 m e o rio V-1:-1:-2 passa a ~15 m do canto (−56, −56): 33 de 12.769 alturas mudam, no máximo 3,8 cm, a 67,7 m do centro (medido).
  // O que o jogador precisa é que o NASCIMENTO fique intacto: nenhum ponto a menos de 60 m do centro muda, e a mudança total é minúscula.
  const nasc0 = geradoComAChave(false, 0, 0)
  const nasc1 = geradoComAChave(true, 0, 0)
  let mudouNoNascimento = 0
  let mudouNoCanto = 0
  let maiorNoCanto = 0
  for (let gz = -MEIA; gz <= MEIA; gz += 1) {
    for (let gx = -MEIA; gx <= MEIA; gx += 1) {
      const k = (gz + MEIA) * 113 + (gx + MEIA)
      if (nasc0[k] === nasc1[k]) continue
      if (Math.hypot(gx, gz) < 60) mudouNoNascimento += 1
      else mudouNoCanto += 1
      maiorNoCanto = Math.max(maiorNoCanto, Math.abs(nasc0[k] - nasc1[k]))
    }
  }
  assert(mudouNoNascimento === 0, `com a chave LIGADA nenhum ponto do quadrado de nascimento a menos de 60 m do centro muda (${mudouNoNascimento} mudaram)`)
  assert(mudouNoCanto > 0 && mudouNoCanto < 100 && maiorNoCanto < 0.1, `CONTROLE: só a cauda do rio vizinho entra no canto do (0, 0) (${mudouNoCanto} alturas, a maior mudança ${maiorNoCanto.toFixed(3)} m; medido 33 e 0,038 m)`)
  assert(sha(geradoComAChave(false, -1, 0)) === sha(sem), 'desligar a chave depois de ligada devolve o jogo de hoje (a memória da água não vaza para o relevo)')

  // (4) SÓ ONDE HÁ RIO: com a chave ligada, em 40 quadrados SEM rio e a mais de 20 m de qualquer rio, o relevo é IDÊNTICO ao de hoje
  limparMemoriaDaAgua()
  let sorteados = 0
  let identicos = 0
  for (let i = -6; i <= 6 && sorteados < 40; i += 1) {
    for (let j = -6; j <= 6 && sorteados < 40; j += 1) {
      // sem rio no quadrado NEM nos 8 vizinhos (a escavação alcança 16 m: um rio vizinho a < 16 m da borda entra no quadrado)
      let limpo = true
      for (let di = -1; di <= 1 && limpo; di += 1) for (let dj = -1; dj <= 1 && limpo; dj += 1) if (riosDoQuadrado(i + di, j + dj, alturaDeBaseDoMundo).length > 0) limpo = false
      if (!limpo) continue
      sorteados += 1
      if (sha(geradoComAChave(true, i, j)) === sha(geradoComAChave(false, i, j))) identicos += 1
    }
  }
  assert(sorteados >= 20, `CONTROLE: achei ${sorteados} quadrados sem rio nos 9 em volta (≥ 20)`)
  assert(identicos === sorteados, `com a chave LIGADA, os ${sorteados} quadrados sem rio por perto são IDÊNTICOS ao de hoje (${identicos})`)

  // (5) LRU / cache: gerar, limpar os caches e gerar de novo dá as MESMAS alturas, com a chave ligada
  chave.agua = true
  try {
    limparCacheRelevo()
    limparMemoriaDaAgua()
    const a = sha(gerarRelevo(3, 0).alturas)
    limparCacheRelevo()
    limparMemoriaDaAgua()
    const b = sha(gerarRelevo(3, 0).alturas)
    assert(a === b, 'gerar (3, 0), limpar o cache e gerar de novo dá as MESMAS alturas (a água é pura)')
    // o caminho FATIADO com a chave ligada é igual ao síncrono (os dois chamam `calcularLinha`)
    limparCacheRelevo()
    const g = gerarRelevoFatiado(3, 0)
    while (!g.passo(2)) {
      /* fatias de 2 ms */
    }
    assert(sha(g.resultado().alturas) === a, 'o caminho FATIADO com a chave ligada dá as mesmas alturas do síncrono')
  } finally {
    chave.agua = politicaOriginal
    limparCacheRelevo()
    limparMemoriaDaAgua()
  }

  // (6) `nivelDaAguaNoMundo`: `null` com a chave desligada; com ela ligada devolve o nível no canal e `null` longe do rio
  const rio = riosDoQuadrado(-1, 0, alturaDeBaseDoMundo).find((r) => r.id === 'V-1:-1:-2')
  assert(rio !== undefined, 'o rio V-1:-1:-2 existe')
  const centro = rio.pontos[120]
  chave.agua = false
  try {
    limparMemoriaDaAgua()
    assert(nivelDaAguaNoMundo(centro.X, centro.Z) === null, 'com a chave DESLIGADA o nível da água no mundo é null')
  } finally {
    chave.agua = politicaOriginal
    limparMemoriaDaAgua()
  }
  chave.agua = true
  try {
    const n = nivelDaAguaNoMundo(centro.X, centro.Z)
    assert(n !== null && Math.abs(n - rio.niveis[120]) < 0.05, `com a chave LIGADA o nível no centro do rio é o do rio (${n} contra ${rio.niveis[120]})`)
    assert(nivelDaAguaNoMundo(centro.X + 30, centro.Z) === null, 'a 30 m do rio não há água')
  } finally {
    chave.agua = politicaOriginal
    limparMemoriaDaAgua()
  }

  // (7) OS NÍVEIS CONTRA O PROTÓTIPO (movido da Task 2): com a altura de base do GERADOR REAL, o nível das duas pontas de cada um dos 13 rios é o que o protótipo mediu (tolerância 1e-4)
  const medidos = JSON.parse(insumos.prototipo) as Array<{ id: string; lv0: number; lvN: number }>
  limparMemoriaDaAgua()
  const todos = new Map<string, { niveis: Float64Array }>()
  for (let i = -6; i <= 6; i += 1) for (let j = -6; j <= 6; j += 1) for (const r of riosDoQuadrado(i, j, alturaDeBaseDoMundo)) todos.set(r.id, r)
  assert(todos.size === RIOS_DE_REFERENCIA.length, `os ${RIOS_DE_REFERENCIA.length} rios existem com a altura de base do gerador (vieram ${todos.size})`)
  let pior = 0
  for (const m of medidos) {
    const r = todos.get(m.id)
    assert(r !== undefined, `o rio ${m.id} do protótipo existe`)
    pior = Math.max(pior, Math.abs(r.niveis[0] - m.lv0), Math.abs(r.niveis[r.niveis.length - 1] - m.lvN))
  }
  assert(pior < 1e-4, `os níveis nas pontas dos 13 rios coincidem com o protótipo (pior diferença ${pior.toExponential(2)}, tolerância 1e-4)`)
  limparMemoriaDaAgua()

  // (8) O RIO ATRAVESSA A JANELA DE PASSAGEM. `mascaraPlana` vale 1 dentro de uma janela; um rio que a usasse como zona plana seria ZERADO nos vaus (o plano chamou isto de armadilha). Os pontos são ACHADOS varrendo os rios
  // (um ponto de rio onde a máscara inteira vale ≥ 0,95 e as zonas sem janelas ≤ 0,05: medido 196 deles). Com a chave LIGADA o relevo gerado ali cai MUITO abaixo da base (medido 0,67 m; com a máscara inteira como zona caía 0,02 m).
  // (9) A ESCAVAÇÃO CEDE À ZONA PLANA: perto do rio, onde as zonas valem > 0,5, o relevo gerado é o da escavação COM a zona (medido: sem zona nenhuma a escavação diverge até 0,30 m em 835 pontos).
  const rios2 = new Map<string, { pontos: ReadonlyArray<{ X: number; Z: number }>; niveis: Float64Array }>()
  for (let i = -6; i <= 6; i += 1) for (let j = -6; j <= 6; j += 1) for (const r of riosDoQuadrado(i, j, alturaDeBaseDoMundo)) rios2.set(r.id, r)
  let vaus = 0
  let menorQueda = Infinity
  let nivelNoVau = 0
  let nivelDivergente = 0
  let zonasChecadas = 0
  let maiorEntreZonas = 0
  const alturaGerada = (X: number, Z: number): number => {
    // o relevo GERADO pelo gerador (com a chave ligada) no ponto global (X, Z): o quadrado que o contém e o índice dentro dele
    const i = Math.round(X / LADO)
    const j = Math.round(Z / LADO)
    const gx = Math.round(X - LADO * i)
    const gz = Math.round(Z - LADO * j)
    return gerarRelevo(i, j).alturas[(gz + MEIA) * 113 + (gx + MEIA)]
  }
  chave.agua = true
  try {
    limparCacheRelevo()
    limparMemoriaDaAgua()
    for (const r of rios2.values()) {
      for (let k = 0; k < r.pontos.length; k += 1) {
        const p = r.pontos[k]
        // só pontos de grade inteira (o `alturas` é uma grade de 1 m) e longe da borda do quadrado (para o quadrado do ponto ser inequívoco)
        if (Math.abs(p.X - Math.round(p.X)) > 1e-9 || Math.abs(p.Z - Math.round(p.Z)) > 1e-9) continue
        if (mascaraPlana(p.X, p.Z) >= 0.95 && zonasPlanasSemJanelas(p.X, p.Z) <= 0.05) {
          const queda = alturaDeBaseDoMundo(p.X, p.Z) - alturaGerada(p.X, p.Z)
          vaus += 1
          menorQueda = Math.min(menorQueda, queda)
          const n = nivelDaAguaNoMundo(p.X, p.Z)
          if (n === null) nivelDivergente += 1
          else nivelNoVau += 1
          if (vaus >= 60) break
        }
      }
      if (vaus >= 60) break
    }
    // (9): pontos perto do rio com a zona > 0,5: o gerado é o da escavação COM a zona
    for (const r of rios2.values()) {
      for (let k = 0; k < r.pontos.length && zonasChecadas < 60; k += 6) {
        const p = r.pontos[k]
        for (let dx = -16; dx <= 16 && zonasChecadas < 60; dx += 2) {
          for (let dz = -16; dz <= 16 && zonasChecadas < 60; dz += 2) {
            const X = Math.round(p.X) + dx
            const Z = Math.round(p.Z) + dz
            if (zonasPlanasSemJanelas(X, Z) < 0.5) continue
            const h0 = alturaDeBaseDoMundo(X, Z)
            const com = escavacaDoRioComBase(X, Z, h0, alturaDeBaseDoMundo, zonasPlanasSemJanelas).altura
            const sem2 = escavacaDoRioComBase(X, Z, h0, alturaDeBaseDoMundo, () => 0).altura
            if (Math.abs(com - sem2) < 0.05) continue // só os pontos onde a zona FAZ diferença
            zonasChecadas += 1
            maiorEntreZonas = Math.max(maiorEntreZonas, Math.abs(com - sem2))
            const gerado = alturaGerada(X, Z)
            assert(Math.abs(gerado - com) < 1e-4, `a escavação CEDE à zona plana em (${X}, ${Z}): o relevo gerado é o da escavação com a zona (${com.toFixed(4)}), não o da sem ela (${sem2.toFixed(4)}); veio ${gerado.toFixed(4)}`)
          }
        }
      }
    }
  } finally {
    chave.agua = politicaOriginal
    limparCacheRelevo()
    limparMemoriaDaAgua()
  }
  assert(vaus >= 30, `CONTROLE: o teste achou ${vaus} pontos de rio dentro de uma janela de passagem (≥ 30)`)
  assert(menorQueda > 0.3, `o rio ATRAVESSA a janela de passagem: em ${vaus} pontos de janela a menor queda abaixo da base é ${menorQueda.toFixed(3)} m (> 0,3; com a máscara inteira como zona o rio seria aplainado: 0,02 m)`)
  assert(nivelDivergente === 0 && nivelNoVau === vaus, `o NÍVEL d'água existe em todos os ${vaus} pontos de janela (${nivelNoVau} com água, ${nivelDivergente} sem: com a máscara inteira o nível some no vau)`)
  assert(zonasChecadas >= 30 && maiorEntreZonas > 0.1, `CONTROLE: o teste checou ${zonasChecadas} pontos onde a zona plana faz diferença (≥ 30), a maior em ${maiorEntreZonas.toFixed(3)} m (> 0,1)`)

  // (11) A EMENDA (I3): com a chave LIGADA, a altura de um ponto da aresta compartilhada tem de ser a MESMA nos dois quadrados (|Δ| ≤ 1e-4), com o rio ENCOSTADO: no cruzamento (0 m) e a 5, 10 e 14 m ao longo da aresta.
  // A MESMA conta de travessia do módulo da água (28 travessias nos 13 rios; 216 pontos medidos: salto 0). O salto é exatamente 0 porque os dois lados avaliam a mesma função no mesmo ponto global; o CONTROLE NEGATIVO
  // mostra que o instrumento enxerga: um lado com +0,2 m abre 0,200 m (uma escavação que dependesse do índice do quadrado faria isto).
  const idx = (gx: number, gz: number): number => (gz + MEIA) * 113 + (gx + MEIA)
  let travessias = 0
  let pontosDaEmenda = 0
  let piorEmenda = 0
  let piorControle = 0
  chave.agua = true
  try {
    limparCacheRelevo()
    limparMemoriaDaAgua()
    for (const r of rios2.values()) {
      for (let k = 1; k < r.pontos.length; k += 1) {
        const p = r.pontos[k - 1]
        const q = r.pontos[k]
        for (const eixo of ['X', 'Z'] as const) {
          const u0 = (p[eixo] + MEIA) / LADO
          const u1 = (q[eixo] + MEIA) / LADO
          if (Math.floor(u0) === Math.floor(u1)) continue
          travessias += 1
          const t0 = (Math.max(Math.floor(u0), Math.floor(u1)) - u0) / (u1 - u0)
          const outro = eixo === 'X' ? 'Z' : 'X'
          const ao = p[outro] + (q[outro] - p[outro]) * t0
          const nAresta = Math.max(Math.floor(u0), Math.floor(u1))
          const iOutro = Math.round(ao / LADO)
          for (const afast of [0, 5, 10, 14]) {
            for (const sinal of [1, -1]) {
              const c = ao + sinal * afast
              if (Math.round(c / LADO) !== iOutro) continue
              const g = Math.round(c - LADO * iOutro)
              if (g < -MEIA || g > MEIA) continue
              const qa = eixo === 'X' ? [nAresta - 1, iOutro] : [iOutro, nAresta - 1]
              const qb = eixo === 'X' ? [nAresta, iOutro] : [iOutro, nAresta]
              const a = gerarRelevo(qa[0], qa[1]).alturas
              const b = gerarRelevo(qb[0], qb[1]).alturas
              const va = eixo === 'X' ? a[idx(MEIA, g)] : a[idx(g, MEIA)]
              const vb = eixo === 'X' ? b[idx(-MEIA, g)] : b[idx(g, -MEIA)]
              piorEmenda = Math.max(piorEmenda, Math.abs(va - vb))
              piorControle = Math.max(piorControle, Math.abs(va - (vb + 0.2)))
              pontosDaEmenda += 1
            }
          }
        }
      }
    }
  } finally {
    chave.agua = politicaOriginal
    limparCacheRelevo()
    limparMemoriaDaAgua()
  }
  assert(travessias >= 26 && pontosDaEmenda >= 100, `CONTROLE: o teste da emenda viu ${travessias} travessias e mediu ${pontosDaEmenda} pontos (≥ 26 e ≥ 100)`)
  assert(piorEmenda <= 1e-4, `com o rio encostado na aresta (0, 5, 10 e 14 m do cruzamento) a emenda não abre degrau: pior ${piorEmenda.toExponential(2)} m (≤ 1e-4)`)
  assert(piorControle > 0.19 && piorControle < 0.21, `CONTROLE NEGATIVO: um lado com +0,2 m abre ${piorControle.toFixed(3)} m na mesma conta (o instrumento enxerga um degrau)`)

  // (12) A LARGURA DA ÁGUA VISÍVEL contra a MALHA REAL (passo 1 = Ultra, 2 = Bonito, 4 = Leve): cortes perpendiculares ao rio; a largura é o comprimento onde o nível d'água fica ACIMA do chão da malha (margem de 2 mm). O protótipo
  // mediu mediana 5,50 / 6,00 / 6,75 m e 0 % dos cortes sem água; o contrato exige a mediana em [4, 8] m e 0 % sem água nos três passos (um canal estreito demais sumiria na malha de 4 m). Um canal sintético de 2 m é o
  // CONTROLE: a malha de 4 m o ALARGA (2,0 → 3,75 m, medido), e o instrumento enxerga a malha mudar o canal.
  // (13) A MARGEM: o declive máximo do chão no corte (m/m). O protótipo mediu mediana 0,39 e máximo 0,67; o herói só anda em declive ≤ 0,75 (D4), então 100 % dos cortes têm de ficar ≤ 0,75; a mediana ≤ 0,45 e MENOR que a
  // das lagoas de hoje pelo mesmo critério (medida abaixo, no gerador real: mediana 0,62, máximo 1,28).
  const larguras: Record<1 | 2 | 4, number[]> = { 1: [], 2: [], 4: [] }
  const declives: number[] = []
  const declivesBilinear: number[] = []
  const declivesSemAgua: number[] = []
  const declivesLagoa: number[] = []
  // os campos do MESMO quadrado COM e SEM a água: o gerador é puro, então cada um é gerado com a chave no estado certo e guardado
  const camposCom = new Map<string, ReturnType<typeof gerarRelevo>>()
  const camposSem = new Map<string, ReturnType<typeof gerarRelevo>>()
  const alturaBilinear = (ligada: boolean): ((X: number, Z: number) => number) => (X, Z) => {
    const i = Math.round(X / LADO)
    const j = Math.round(Z / LADO)
    const mapa = ligada ? camposCom : camposSem
    let campo = mapa.get(`${i},${j}`)
    if (!campo) {
      const antes = chave.agua
      chave.agua = ligada
      try {
        limparCacheRelevo()
        campo = gerarRelevo(i, j)
      } finally {
        chave.agua = antes
      }
      mapa.set(`${i},${j}`, campo)
    }
    return alturaEm(campo, X - LADO * i, Z - LADO * j)
  }
  chave.agua = true
  try {
    limparCacheRelevo()
    limparMemoriaDaAgua()
    const campos = new Map<string, ReturnType<typeof gerarRelevo>>()
    const campoDe = (i: number, j: number): ReturnType<typeof gerarRelevo> => {
      const c = `${i},${j}`
      let v = campos.get(c)
      if (!v) {
        v = gerarRelevo(i, j)
        campos.set(c, v)
      }
      return v
    }
    // a altura da MALHA no ponto GLOBAL (X, Z): o quadrado que o contém e o desnível da malha dele (a função do desenho)
    const malha = (passo: 1 | 2 | 4, X: number, Z: number): number => {
      const i = Math.round(X / LADO)
      const j = Math.round(Z / LADO)
      return desnivelDaMalha(chaoDaMalha(campoDe(i, j), passo), X - LADO * i, Z - LADO * j)
    }
    for (const r of rios2.values()) {
      for (let k = 20; k < r.pontos.length - 20; k += 7) {
        const dx = r.pontos[k + 1].X - r.pontos[k - 1].X
        const dz = r.pontos[k + 1].Z - r.pontos[k - 1].Z
        const m = Math.hypot(dx, dz) || 1
        const nx = -dz / m
        const nz = dx / m
        const lv = r.niveis[k]
        for (const passo of [1, 2, 4] as const) {
          let w = 0
          for (let s = -9; s <= 9; s += 0.25) if (lv > malha(passo, r.pontos[k].X + nx * s, r.pontos[k].Z + nz * s) + 0.002) w += 0.25
          larguras[passo].push(w)
        }
        // o declive máximo entre -14 e +14 m do centro, passos de 0,5 m, de TRÊS formas (a conta do protótipo, `medir-6-margem.mjs`):
        // (a) pela altura CONTÍNUA (`escavacaDoRioComBase`, o que o protótipo chamava de `alturaNova`); (b) pelo CAMPO bilinear COM a água e (c) SEM ela (`alturaEm`, o chão que o herói pisa entre os vértices).
        // O `Float32Array` lido com `Math.round(coordenada)` INFLAVA o declive ×2 (duas amostras de 0,5 m caíam em vértices vizinhos de 1 m): foi o primeiro erro deste contrato (0,73 / 1,74 em vez de 0,39 / 0,46).
        const declivePor = (alt: (X: number, Z: number) => number): number => {
          let maxDecl = 0
          let prev = alt(r.pontos[k].X - nx * 14, r.pontos[k].Z - nz * 14)
          for (let s = -13.5; s <= 14; s += 0.5) {
            const h = alt(r.pontos[k].X + nx * s, r.pontos[k].Z + nz * s)
            maxDecl = Math.max(maxDecl, Math.abs(h - prev) / 0.5)
            prev = h
          }
          return maxDecl
        }
        declives.push(declivePor((X, Z) => escavacaDoRioComBase(X, Z, alturaDeBaseDoMundo(X, Z), alturaDeBaseDoMundo, zonasPlanasSemJanelas).altura))
        declivesBilinear.push(declivePor(alturaBilinear(true)))
        declivesSemAgua.push(declivePor(alturaBilinear(false)))
      }
    }
    // a margem das lagoas de HOJE (a mesma conta no gerador real, com a chave desligada)
    chave.agua = false
    limparCacheRelevo()
    for (const [i, j] of [[-1, -3], [1, 2], [3, 0], [1, -1], [0, -2]] as const) {
      const campo = gerarRelevo(i, j)
      for (const l of gerarPaisagemBioma(i, j, 5000).lagoas) {
        for (let a = 0; a < 16; a += 1) {
          const ang = (a / 16) * 2 * Math.PI
          let maxDecl = 0
          let prev = Number.NaN
          for (let s = 0.7; s <= 1.5; s += 0.02) {
            const x = Math.round(l.x + Math.cos(ang) * l.rx * s)
            const z = Math.round(l.z + Math.sin(ang) * l.rz * s)
            if (Math.abs(x) > MEIA || Math.abs(z) > MEIA) continue
            const h = campo.alturas[(z + MEIA) * 113 + (x + MEIA)]
            if (!Number.isNaN(prev)) maxDecl = Math.max(maxDecl, Math.abs(h - prev) / (0.02 * Math.max(l.rx, l.rz)))
            prev = h
          }
          declivesLagoa.push(maxDecl)
        }
      }
    }
  } finally {
    chave.agua = politicaOriginal
    limparCacheRelevo()
    limparMemoriaDaAgua()
  }
  const mediana = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]
  assert(larguras[1].length >= 200, `CONTROLE: o teste mediu ${larguras[1].length} cortes perpendiculares (≥ 200; medido 227)`)
  for (const passo of [1, 2, 4] as const) {
    const med = mediana(larguras[passo])
    const sem = larguras[passo].filter((w) => w < 1).length
    assert(med >= 4 && med <= 8, `a largura da água visível na malha de passo ${passo} m tem mediana em [4, 8] m (veio ${med.toFixed(2)}; o protótipo mediu 5,50 / 6,00 / 6,75)`)
    assert(sem === 0, `em NENHUM corte a água some na malha de passo ${passo} m (${sem} de ${larguras[passo].length} cortes com menos de 1 m de água)`)
  }
  // a malha de 4 m ALARGA o canal (o protótipo mediu 5,50 → 6,75): o instrumento enxerga a malha mudar a água
  assert(mediana(larguras[4]) > mediana(larguras[1]) + 0.5, `a malha de 4 m alarga o canal em relação à de 1 m (${mediana(larguras[4]).toFixed(2)} contra ${mediana(larguras[1]).toFixed(2)} m)`)
  const sd = [...declives].sort((a, b) => a - b)
  assert(declives.length >= 200, `CONTROLE: o teste mediu o declive em ${declives.length} cortes (≥ 200; medido 227: os mesmos cortes da largura, a cada 7 pontos; o protótipo media a cada 5 e dava 319)`)
  // (13a) a conta do PROTÓTIPO, pela altura contínua: máximo ≤ 0,75 (o herói anda até 0,75: D4) e mediana ≤ 0,45 (medido 0,46 e 0,39)
  assert(sd[sd.length - 1] <= 0.75, `o declive máximo do canal pela altura contínua não passa de 0,75 em NENHUM corte (máximo ${sd[sd.length - 1].toFixed(2)}; o protótipo mediu 0,67 e este código 0,46)`)
  assert(mediana(declives) <= 0.45, `o declive mediano da margem do rio é ≤ 0,45 (veio ${mediana(declives).toFixed(2)}; medido 0,39)`)
  // (13b) pelo CAMPO BILINEAR (o chão que o herói pisa): onde a água PIORA o declive de um corte, o declive resultante é o do CANAL (medido: nunca passa de 0,373), e NENHUM corte passa de 0,75 por causa dela: os que passam
  // já passavam sem a água (o relevo bruto do bioma: 0,84 e 0,80). Medido: 192 de 227 cortes pioram mais de 0,05 (de um chão PLANO, 0,01–0,02, para a parede do canal, ~0,37): é o que escavar um rio significa. A 1ª versão
  // deste contrato exigia «a água não piora por mais de 0,10», o que proibia o próprio canal (pior +0,362): um limite mal calibrado, não uma propriedade do jogo.
  let canalMax = 0
  let novosAcima = 0
  for (let c = 0; c < declivesBilinear.length; c += 1) {
    if (declivesBilinear[c] - declivesSemAgua[c] > 0.05) canalMax = Math.max(canalMax, declivesBilinear[c])
    if (declivesBilinear[c] > 0.75 && declivesSemAgua[c] <= 0.75) novosAcima += 1
  }
  assert(canalMax <= 0.45, `onde a água piora o declive, o declive resultante é o do canal e não passa de 0,45 (veio ${canalMax.toFixed(3)}; medido 0,373)`)
  assert(novosAcima === 0, `nenhum corte passa de 0,75 POR CAUSA da água (${novosAcima}): os que passam já passavam sem ela (medido: 2 de 227, 0,84 e 0,80 sem água)`)
  assert(mediana(declivesBilinear) < 0.5, `o declive mediano pelo campo bilinear com a água é < 0,5 (veio ${mediana(declivesBilinear).toFixed(2)}; medido 0,37)`)
  // (13c) a margem do rio é MAIS SUAVE que a das lagoas de hoje (o mesmo gerador, a mesma conta, o campo de 1 m)
  assert(declivesLagoa.length >= 50 && mediana(declives) < mediana(declivesLagoa), `a margem do rio é MAIS SUAVE que a das lagoas de hoje (mediana do rio ${mediana(declives).toFixed(2)} contra ${mediana(declivesLagoa).toFixed(2)} das lagoas, ${declivesLagoa.length} cortes)`)

  // (14) A FIDELIDADE: com a chave LIGADA o relevo gerado é EXATAMENTE a escavação pura (`escavacaDoRioComBase(...).altura`, em Float32) em todo ponto SEM leito de lagoa, INCLUSIVE onde ela SOBE o chão. A escavação não só
  // cava: ela leva o terreno ao lado do canal até a margem (nível + 0,18 m) e SOBE o chão em 14,8 % dos pontos a ≤ 16 m dos rios (86.798 de 584.793, até 1,17 m; medido). O mutante `Math.min(h, escavação)` (o rio nunca
  // sobe o chão) PASSAVA por falta deste contrato: eu o tinha marcado «equivalente» sem provar. Os pontos são os dos 13 rios (a ≤ 16 m), de grade inteira e longe do leito de qualquer lagoa (a lagoa vem depois no gerador).
  {
    chave.agua = true
    let checados = 0
    let sobem = 0
    let maiorSubida = 0
    try {
      limparCacheRelevo()
      limparMemoriaDaAgua()
      for (const r of rios2.values()) {
        for (let k = 0; k < r.pontos.length && checados < 3000; k += 9) {
          const p = r.pontos[k]
          for (let dx = -16; dx <= 16 && checados < 3000; dx += 3) {
            for (let dz = -16; dz <= 16 && checados < 3000; dz += 3) {
              const X = Math.round(p.X) + dx
              const Z = Math.round(p.Z) + dz
              const i = Math.round(X / LADO)
              const j = Math.round(Z / LADO)
              const gx = X - LADO * i
              const gz = Z - LADO * j
              if (Math.abs(gx) > MEIA || Math.abs(gz) > MEIA) continue
              // sem leito de lagoa neste ponto: o relevo gerado COM a chave desligada é a altura de base (em Float32)
              const sem = chaveDesligada(i, j)[(gz + MEIA) * 113 + (gx + MEIA)]
              if (Math.abs(sem - Math.fround(alturaDeBaseDoMundo(X, Z))) > 1e-6) continue
              const h0 = alturaDeBaseDoMundo(X, Z)
              const esperado = escavacaDoRioComBase(X, Z, h0, alturaDeBaseDoMundo, zonasPlanasSemJanelas).altura
              const gerado = gerarRelevo(i, j).alturas[(gz + MEIA) * 113 + (gx + MEIA)]
              assert(Math.abs(gerado - Math.fround(esperado)) < 1e-6, `o relevo gerado em (${X}, ${Z}) é EXATAMENTE a escavação pura (esperado ${esperado}, veio ${gerado})`)
              checados += 1
              if (esperado > h0 + 1e-9) {
                sobem += 1
                maiorSubida = Math.max(maiorSubida, esperado - h0)
              }
            }
          }
        }
      }
    } finally {
      chave.agua = politicaOriginal
      limparCacheRelevo()
      limparMemoriaDaAgua()
    }
    assert(checados >= 1500, `CONTROLE: o teste da fidelidade checou ${checados} pontos (≥ 1.500)`)
    assert(sobem >= 100 && maiorSubida > 0.1, `CONTROLE: a escavação SOBE o chão em ${sobem} dos ${checados} pontos checados (≥ 100), a maior subida em ${maiorSubida.toFixed(3)} m (> 0,1): o rio também enche os vales em volta`)
  }
}
