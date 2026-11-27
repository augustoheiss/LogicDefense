import { Y_SOLO_VISUAL } from '../visual/suporteFundacao'
import { alturaEm, LADO_RELEVO, MEIA_RELEVO, type CampoRelevo } from './campoRelevo'
import { gerarRelevo } from './geradorRelevo'
import { raioContraTerreno, type Raio } from './raioTerreno'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Gerador fixo (mulberry32): os raios «aleatórios» do teste são REPRODUTÍVEIS. */
function semente(valor: number): () => number {
  let t = valor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function campoDe(altura: (gx: number, gz: number) => number): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = altura(gx, gz)
  }
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

const PLANO = campoDe(() => 0)
/** Rampa em x, declive 0,5 (m por m): a altura do chão desenhado em x é Y_SOLO_VISUAL + 0,5 · x. */
const RAMPA = campoDe((gx) => 0.5 * gx)
/** Um morro isolado de 3 m (pico em x = 20), 8 m de raio, e o resto plano: para o raio rasante que o atravessa. */
const MORRO = campoDe((gx, gz) => {
  const d = Math.hypot(gx - 20, gz)
  return d < 8 ? 3 * (1 - d / 8) : 0
})
/** DOIS morros em fila (x = 12 e x = 30): o raio rasante tem de devolver o PRIMEIRO. */
const DOIS_MORROS = campoDe((gx, gz) => {
  const d1 = Math.hypot(gx - 12, gz)
  const d2 = Math.hypot(gx - 30, gz)
  return Math.max(d1 < 6 ? 3 * (1 - d1 / 6) : 0, d2 < 6 ? 4 * (1 - d2 / 6) : 0)
})

/** O `soloNoNdc` / `soloNoChao` de HOJE, escrito por extenso (copiado de `IlhaRua.tsx`): a referência bit a bit. NÃO chama o código sob teste. */
function planoDeHoje(raio: Raio, planoY: number): { x: number; z: number; t: number } | null {
  const dirY = raio.direcao.y
  if (Math.abs(dirY) < 1e-5) return null
  const t = (planoY - raio.origem.y) / dirY
  if (t < 0) return null
  return { x: raio.origem.x + raio.direcao.x * t, z: raio.origem.z + raio.direcao.z * t, t }
}

function normalizar(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const n = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / n, y: v.y / n, z: v.z / n }
}

/**
 * O CLIQUE CONTRA O TERRENO (F2, Task 6, 25/11/2026). Hoje o clique no chão é a interseção do raio da câmera com um PLANO (`y = 0` no `soloNoNdc`, `y = −0,45` no `soloNoChao`). Com o relevo ligado o chão
 * DESENHADO sobe e desce, e o jogador clicaria numa colina e a tropa iria para um ponto deslocado (o morro de 3 m desloca o clique em até ~5 m com a câmera a 34 m). A regra: o clique devolve o ponto onde o raio
 * encontra o terreno VISÍVEL. Sem campo é EXATAMENTE o plano de hoje (I1), com o MESMO plano que cada chamada usa (0 e −0,45).
 */
export function run(): void {
  const rng = semente(20261126)

  // ── (1) I1: SEM CAMPO, é o plano de hoje, bit a bit, nos DOIS planos que o jogo usa (0 e −0,45), em 10 000 raios, e nos casos de borda ────────────────────────────────────────────────────────────
  for (const planoY of [0, Y_SOLO_VISUAL]) {
    let comResultado = 0
    for (let n = 0; n < 10000; n += 1) {
      const origem = { x: (rng() - 0.5) * 120, y: 2 + rng() * 40, z: (rng() - 0.5) * 120 }
      const direcao = normalizar({ x: rng() - 0.5, y: rng() - 0.75, z: rng() - 0.5 }) // inclinada, mais para baixo que para cima
      const raio: Raio = { origem, direcao }
      const hoje = planoDeHoje(raio, planoY)
      const r = raioContraTerreno(undefined, raio, planoY, 1e9)
      if (hoje === null) {
        assert(r === null, `sem campo (plano ${planoY}, caso ${n}): hoje é null, o código também tem de ser`)
      } else {
        comResultado += 1
        assert(r !== null && Object.is(r.x, hoje.x) && Object.is(r.z, hoje.z) && Object.is(r.t, hoje.t), `sem campo (plano ${planoY}, caso ${n}): x, z e t IDÊNTICOS aos de hoje, bit a bit`)
      }
    }
    assert(comResultado > 3000, `controle do instrumento: o gerador de raios produz acertos (${comResultado} de 10000 com resultado) e também nulos`)
  }
  // os casos de borda de HOJE: raio paralelo ao chão (|dirY| < 1e-5), raio para cima (t < 0) e origem exatamente no plano
  for (const planoY of [0, Y_SOLO_VISUAL]) {
    assert(raioContraTerreno(undefined, { origem: { x: 0, y: 5, z: 0 }, direcao: { x: 1, y: 0, z: 0 } }, planoY, 1e9) === null, `sem campo: raio paralelo ao chão (dirY = 0) é null (plano ${planoY})`)
    assert(raioContraTerreno(undefined, { origem: { x: 0, y: 5, z: 0 }, direcao: { x: 1, y: 9e-6, z: 0 } }, planoY, 1e9) === null, `sem campo: |dirY| < 1e-5 é null (o limiar de hoje)`)
    assert(raioContraTerreno(undefined, { origem: { x: 0, y: 5, z: 0 }, direcao: { x: 0, y: 1, z: 0 } }, planoY, 1e9) === null, `sem campo: raio para CIMA (t < 0) é null (plano ${planoY})`)
    const naBorda = raioContraTerreno(undefined, { origem: { x: 3, y: 5, z: 4 }, direcao: { x: 0, y: -1e-5, z: 1 } }, planoY, 1e9)
    const hojeBorda = planoDeHoje({ origem: { x: 3, y: 5, z: 4 }, direcao: { x: 0, y: -1e-5, z: 1 } }, planoY)
    assert(hojeBorda !== null && naBorda !== null && Object.is(naBorda.t, hojeBorda.t), 'sem campo: |dirY| = 1e-5 EXATO acerta como hoje (o limiar é «menor que»)')
  }
  // campo PLANO é o plano de hoje (o relevo desligado e o relevo plano são a mesma coisa)
  {
    const raio: Raio = { origem: { x: 1, y: 30, z: 2 }, direcao: normalizar({ x: 0.3, y: -1, z: 0.2 }) }
    const r = raioContraTerreno(PLANO, raio, 0, 1e9)
    const hoje = planoDeHoje(raio, Y_SOLO_VISUAL)
    assert(r !== null && hoje !== null && Math.abs(r.x - hoje.x) < 1e-3 && Math.abs(r.z - hoje.z) < 1e-3 && Math.abs(r.t - hoje.t) < 1e-3, 'campo plano: o clique cai onde o plano de −0,45 o põe (a malha de um campo plano fica em Y_SOLO_VISUAL)')
  }

  // ── (1b) A ALTURA `y` do ponto devolvido (o editor de blocos mede o alcance até ELA, não até um `0` fixo): é a altura do RAIO em `t`, sem campo e com campo ─────────────────────────────────────────────────
  for (const planoY of [0, Y_SOLO_VISUAL]) {
    for (let n = 0; n < 500; n += 1) {
      const raio: Raio = { origem: { x: (rng() - 0.5) * 60, y: 3 + rng() * 40, z: (rng() - 0.5) * 60 }, direcao: normalizar({ x: rng() - 0.5, y: -0.2 - rng(), z: rng() - 0.5 }) }
      const r = raioContraTerreno(undefined, raio, planoY, 1e9)
      assert(r !== null && Math.abs(r.y - planoY) < 1e-9, `sem campo, o \`y\` do ponto é o do PLANO (${planoY}), veio ${r ? r.y : 'null'}`)
      assert(Object.is(r.y, raio.origem.y + raio.direcao.y * r.t), `e é EXATAMENTE a altura do raio em t (origem.y + direcao.y · t), bit a bit`)
    }
  }
  {
    const r = raioContraTerreno(RAMPA, { origem: { x: 0, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }, 0, 1e9)
    assert(r !== null && Math.abs(r.y - (Y_SOLO_VISUAL + 0.5 * r.x)) < 1e-6, `com campo, o \`y\` é a altura do TERRENO no ponto (rampa 0,5: −0,45 + 0,5 · x = ${(Y_SOLO_VISUAL + 0.5 * (r?.x ?? 0)).toFixed(4)}), veio ${r ? r.y.toFixed(4) : 'null'}`)
    assert(r !== null && Math.abs(r.y - (Y_SOLO_VISUAL + alturaEm(RAMPA, r.x, r.z))) < 1e-6, 'e coincide com `Y_SOLO_VISUAL + alturaEm` no ponto devolvido (o ponto está NO terreno desenhado)')
  }

  // ── (2) COM campo: o ponto devolvido ESTÁ NO TERRENO (ida e volta), e é o ponto onde o raio o cruza ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // rampa: raio de cima, a posição é conhecida à mão. O raio parte de (0, 30, 0) com direção (1, −1, 0)/√2; a rampa fica em y = −0,45 + 0,5·x. Cruzamento: 30 − x = −0,45 + 0,5·x → x = 30,45/1,5 = 20,3.
    const raio: Raio = { origem: { x: 0, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }
    const r = raioContraTerreno(RAMPA, raio, 0, 1e9)
    assert(r !== null && Math.abs(r.x - 20.3) < 0.01 && Math.abs(r.z) < 1e-9, `rampa: o raio cruza o terreno em x = 20,3 (à mão), veio ${r ? r.x.toFixed(4) : 'null'}`)
    assert(r !== null && Math.abs(r.t - 20.3 * Math.SQRT2) < 0.02, `e o t é a distância ao longo do raio (${(20.3 * Math.SQRT2).toFixed(3)})`)
    // o plano (sem campo) o poria em x = 30,45 (−0,45 + 0 = 30 − x): 10 m ALÉM. O relevo move o clique de verdade (controle positivo do instrumento).
    const semCampo = raioContraTerreno(undefined, raio, Y_SOLO_VISUAL, 1e9)
    assert(semCampo !== null && Math.abs(semCampo.x - 30.45) < 1e-9, 'controle POSITIVO: sem campo o mesmo raio cai em x = 30,45, 10 m além: o relevo muda o clique')
  }
  // ida e volta em 3000 raios de câmera sobre a tundra (o relevo mais forte): a altura do ponto devolvido é a do terreno, a menos de 1 cm
  {
    const tundra = gerarRelevo(-1, -3)
    let maiorErro = 0
    let acertos = 0
    for (let n = 0; n < 3000; n += 1) {
      const origem = { x: (rng() - 0.5) * 60, y: 20 + rng() * 20, z: 15 + rng() * 25 }
      const alvo = { x: (rng() - 0.5) * 80, z: (rng() - 0.5) * 80 }
      const raio: Raio = { origem, direcao: normalizar({ x: alvo.x - origem.x, y: -origem.y, z: alvo.z - origem.z }) }
      const r = raioContraTerreno(tundra, raio, 0, 1e9)
      if (r === null) continue
      acertos += 1
      const yDoRaio = raio.origem.y + raio.direcao.y * r.t
      const yDoTerreno = Y_SOLO_VISUAL + alturaEm(tundra, r.x, r.z)
      maiorErro = Math.max(maiorErro, Math.abs(yDoRaio - yDoTerreno))
    }
    assert(acertos > 2500, `controle do instrumento: a maioria dos 3000 raios acerta o terreno (${acertos})`)
    assert(maiorErro < 0.01, `ida e volta na tundra: o ponto devolvido está a menos de 1 cm do terreno (pior erro ${maiorErro.toExponential(2)} m)`)
  }

  // ── (3) O PRIMEIRO acerto: um raio rasante que atravessa dois morros devolve o do PRIMEIRO, e nunca o do segundo nem o do vale entre eles ────────────────────────────────────────────────────────────
  {
    // o raio parte de x = 0 a y = 1,2 e desce 0,02 por metro andado em x: passa por cima do vale (chão −0,45) e CORTA o 1º morro (pico em x = 12, chão −0,45 + 3 = 2,55)
    const raio: Raio = { origem: { x: 0, y: 1.2, z: 0 }, direcao: normalizar({ x: 1, y: -0.02, z: 0 }) }
    const r = raioContraTerreno(DOIS_MORROS, raio, 0, 1e9)
    assert(r !== null && r.x > 6 && r.x < 12, `raio rasante: acerta a ENCOSTA do 1º morro (x entre 6 e 12), veio ${r ? r.x.toFixed(2) : 'null'}`)
    // o MESMO raio, mas só o 2º morro existe: tem de acertá-lo (controle: o 1º não «rouba» o resultado por acaso)
    const so2 = campoDe((gx, gz) => { const d = Math.hypot(gx - 30, gz); return d < 6 ? 4 * (1 - d / 6) : 0 })
    const r2 = raioContraTerreno(so2, raio, 0, 1e9)
    assert(r2 !== null && r2.x > 24 && r2.x < 30, `controle: sem o 1º morro o raio acerta o 2º (x entre 24 e 30), veio ${r2 ? r2.x.toFixed(2) : 'null'}`)
  }
  // um raio rasante que PASSA por cima de um morro baixo e só acerta o plano depois: o pico do morro (x = 20) tem o chão em −0,45 + 3 = 2,55 e o raio, que desce 0,05 por metro de x a partir de y = 4, está
  // em 4 − 1 = 3,0 ali: passa 0,45 m por cima. Ele chega ao chão plano (−0,45) quando 4 − 0,05·x = −0,45, isto é, em x = 89 (calculado à mão: a 1ª versão deste teste dizia «x < 82», um erro de conta MEU
  // que o código acusou). O passo da marcha não pode «pular» o morro nem parar nele.
  {
    const raio: Raio = { origem: { x: 0, y: 4, z: 0 }, direcao: normalizar({ x: 1, y: -0.05, z: 0 }) }
    const r = raioContraTerreno(MORRO, raio, 0, 1e9)
    assert(r !== null && Math.abs(r.x - 89) < 0.01, `raio que passa por cima do morro acerta o chão PLANO depois dele, em x = 89 (à mão), veio ${r ? r.x.toFixed(3) : 'null'}`)
    // o MESMO raio 0,5 m mais baixo (3,5) corta o morro: a diferença de 0,5 m na origem decide entre passar por cima e bater na encosta (controle: o instrumento distingue 0,45 m de folga)
    const baixo = raioContraTerreno(MORRO, { origem: { x: 0, y: 3.5, z: 0 }, direcao: raio.direcao }, 0, 1e9)
    assert(baixo !== null && baixo.x > 14 && baixo.x < 20, `controle: com a origem 0,5 m mais baixa o raio bate na encosta do morro (x entre 14 e 20), veio ${baixo ? baixo.x.toFixed(2) : 'null'}`)
  }

  // ── (3b) A MARCHA DE PASSO FIXO PULA CRISTAS FINAS (achado por MEDIÇÃO contra o gerador real, 25/11 18h48, `medir-raio-passo-da-marcha.mjs`: 18 de 7 200 raios divergiram, todos RASANTES de 1ª/3ª pessoa; o
  //      Império, que olha de cima, 0 de 2 400). A mutação não achava isto (prova que o código segue o contrato, não que o contrato está certo): o plano previa o risco («passo grande demais que pula um morro»)
  //      e o meu primeiro teste não tinha um caso que a marcha pulasse. Este é um raio REAL da tundra (−1, −3): o olho do herói a 0,55 m do plano, olhando levemente para baixo, rente a uma encosta. A referência é
  //      um GABARITO de passo fino (0,02 m) calculado AQUI, não o valor que o código dá.
  {
    const tundra = gerarRelevo(-1, -3)
    const raio: Raio = {
      origem: { x: -11.556095047853887, y: 0.5485695031105315, z: -23.113730340264738 },
      direcao: { x: 0.4870377545367297, y: -0.13665565510370545, z: 0.8626235897446796 },
    }
    const folgaEm = (t: number): number => raio.origem.y + raio.direcao.y * t - (Y_SOLO_VISUAL + alturaEm(tundra, raio.origem.x + raio.direcao.x * t, raio.origem.z + raio.direcao.z * t))
    let tFino = -1
    for (let t = 0.02; t < 50; t += 0.02) {
      if (folgaEm(t) <= 0) {
        tFino = t
        break
      }
    }
    assert(tFino > 3.4 && tFino < 3.6, `o teste monta o caso certo: o gabarito fino acha o chão em t ≈ 3,5 (veio ${tFino.toFixed(3)})`)
    const r = raioContraTerreno(tundra, raio, 0, 1e9)
    assert(r !== null && Math.abs(r.t - tFino) < 0.05, `a marcha NÃO pula a crista: o clique acerta em t ≈ ${tFino.toFixed(2)} (o gabarito fino), não 3 m além (veio ${r ? r.t.toFixed(3) : 'null'})`)
  }
  // e o controle positivo do instrumento: um raio rasante sobre um campo onde uma crista de UM nó (2,5 m de altura, 2 m de base na bilinear) fica entre dois pontos da marcha de 0,5 m não é um pico que o
  // passo fixo consiga pular de verdade (a base de 2 m cabe 4 passos); o que a marcha pula é a crista FINA E ALTA do gerador, e o caso acima é o controle positivo disso.

  // ── (3c) A COMPARAÇÃO EM MASSA contra um GABARITO de passo fino (5 mm), no gerador REAL: é a prova de que «o contrato está certo» (um raio avulso, como o caso acima, deixou 5 mutantes do passo sobreviverem:
  //      M4/M5, o divisor do declive, M7, o teto do passo, e R6/R7, a atualização do `t` e da folga). 1 500 raios rasantes (1ª e 3ª pessoa) em 3 relevos fortes. O gabarito é 4× mais fino que a produção (2 cm
  //      no mínimo): um árbitro tem de ser mais fino que o arbitrado. Dos 24 000 raios medidos em `classificar-divergencias-restantes.mjs`, 2 divergiram e os 2 eram RASPÕES (mergulho de 0,5 mm abaixo do chão,
  //      que o passo de 2 cm salta e nenhum jogador consegue mirar): por isso o limite aqui é «no máximo 0,3 % divergem e NENHUM cruzamento franco (mergulho ≥ 1 cm) é perdido».
  {
    const rngMassa = semente(777)
    let divergem = 0
    let francosPerdidos = 0
    let total = 0
    let acertos = 0
    for (const [i, j] of [[-1, -3], [1, 2], [3, 0]]) {
      const campo = gerarRelevo(i, j)
      const folgaDe = (raio: Raio, t: number): number => raio.origem.y + raio.direcao.y * t - (Y_SOLO_VISUAL + alturaEm(campo, raio.origem.x + raio.direcao.x * t, raio.origem.z + raio.direcao.z * t))
      for (let n = 0; n < 500; n += 1) {
        const px = (rngMassa() - 0.5) * 100
        const pz = (rngMassa() - 0.5) * 100
        const yaw = rngMassa() * Math.PI * 2
        const pitch = -0.25 + rngMassa() * 0.35
        const alturaOlho = n % 2 === 0 ? Y_SOLO_VISUAL + 1.6 + 0.45 : 1.6 + rngMassa() * 1.4
        const raio: Raio = { origem: { x: px, y: alturaOlho + alturaEm(campo, px, pz), z: pz }, direcao: normalizar({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) }) }
        // o gabarito (passo 5 mm, mesma bissecção de 12 passos)
        let tGab: number | null = null
        if (folgaDe(raio, 0) > 0) {
          let acima = 0
          for (let t = 0.005; acima < 400; t += 0.005) {
            const p = Math.min(t, 400)
            if (folgaDe(raio, p) <= 0) {
              let abaixo = p
              for (let k = 0; k < 12; k += 1) {
                const m = (acima + abaixo) / 2
                if (folgaDe(raio, m) > 0) acima = m
                else abaixo = m
              }
              tGab = (acima + abaixo) / 2
              break
            }
            acima = p
          }
        }
        const prod = raioContraTerreno(campo, raio, 0, 400)
        total += 1
        if (tGab !== null && prod !== null) acertos += 1
        if (tGab === null && prod === null) continue
        if (tGab === null || prod === null || Math.abs(prod.t - tGab) > 0.01) {
          divergem += 1
          let mergulho = 0
          if (tGab !== null) for (let t = tGab; t <= tGab + 0.3; t += 0.002) mergulho = Math.min(mergulho, folgaDe(raio, t))
          if (mergulho <= -0.01) francosPerdidos += 1
        }
      }
    }
    assert(acertos > 800, `controle do instrumento: a maioria dos ${total} raios rasantes acerta o terreno (${acertos})`)
    assert(francosPerdidos === 0, `NENHUM cruzamento franco (mergulho ≥ 1 cm) é perdido pela marcha, em ${total} raios rasantes de 3 relevos reais (veio ${francosPerdidos})`)
    assert(divergem <= total * 0.003, `no máximo 0,3 % dos raios divergem do gabarito fino (medido: 2 em 24 000, ambos raspões); aqui ${divergem} de ${total}`)
  }

  // ── (3c-bis) `tMax = Infinity` COM CAMPO (o que `IlhaRua` PASSA nas duas funções de clique) tem de ACERTAR o terreno. ACHADO em 26/11 pela prova no navegador (I7): a validação `every(Number.isFinite)` incluía `tMax`, e
  //      com o relevo ligado TODO clique no chão devolvia `null` (ordem de movimento, caixa de seleção e fantasma mortos) enquanto com a chave desligada o caminho `!campo` retornava ANTES da validação e o jogo de hoje
  //      funcionava: os 5 portões e as 4 fotos de 25/11 NÃO viram. O meu teste (3d) afirmava «`tMax = Infinity` com um raio que NUNCA acerta devolve null», que é a resposta certa por acaso e NÃO distingue
  //      «rejeitou a entrada» de «não achou chão»: foi o mutante T8, que eu julguei «equivalente por acaso». Não era. O que prova a diferença é um raio que ACERTA.
  {
    const raio: Raio = { origem: { x: 0, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }
    const finito = raioContraTerreno(RAMPA, raio, 0, 1e9)
    const infinito = raioContraTerreno(RAMPA, raio, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
    assert(finito !== null && Math.abs(finito.x - 20.3) < 0.01, 'controle: com `tMax = 1e9` o raio acerta a rampa em x = 20,3')
    assert(infinito !== null, '`tMax = Infinity` com campo ACERTA o terreno (é o que `IlhaRua` passa): com o relevo ligado todo clique no chão devolvia null')
    assert(infinito !== null && finito !== null && Object.is(infinito.t, finito.t) && Object.is(infinito.x, finito.x), 'e é o MESMO ponto que `tMax = 1e9` (o teto de 400 m é quem limita)')
    // `tMax = -Infinity` e `NaN` continuam rejeitados: um alcance negativo ou indefinido não é um alcance
    assert(raioContraTerreno(RAMPA, raio, 0, Number.NEGATIVE_INFINITY) === null, '`tMax = -Infinity` é rejeitado (alcance negativo)')
    assert(raioContraTerreno(RAMPA, raio, 0, Number.NaN) === null, '`tMax = NaN` é rejeitado')
  }

  // ── (3d) as BORDAS que 9 mutantes deixaram passar (T5, T6, T8, M2, P4, R4) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // uma origem EXATAMENTE no terreno (folga 0): não há «primeiro acerto à frente», é null (T5/T6)
    const noChao = raioContraTerreno(RAMPA, { origem: { x: 10, y: Y_SOLO_VISUAL + alturaEm(RAMPA, 10, 0), z: 0 }, direcao: normalizar({ x: 0, y: -1, z: 0.001 }) }, 0, 1e9)
    assert(noChao === null, 'origem EXATAMENTE no terreno (folga 0): null, nunca um ponto na própria origem')
    // uma origem 1 mm acima, descendo: acerta quase na origem (t ≈ 1 mm), e t >= 0
    const quase = raioContraTerreno(RAMPA, { origem: { x: 10, y: Y_SOLO_VISUAL + alturaEm(RAMPA, 10, 0) + 0.001, z: 0 }, direcao: { x: 0, y: -1, z: 0 } }, 0, 1e9)
    assert(quase !== null && quase.t >= 0 && quase.t < 0.01, `origem 1 mm acima do terreno: acerta em t ≈ 1 mm (veio ${quase ? quase.t : 'null'})`)
    // origem abaixo do terreno: null (T5)
    assert(raioContraTerreno(RAMPA, { origem: { x: 10, y: Y_SOLO_VISUAL + alturaEm(RAMPA, 10, 0) - 0.5, z: 0 }, direcao: { x: 0, y: -1, z: 0 } }, 0, 1e9) === null, 'origem 0,5 m ABAIXO do terreno: null (nunca um ponto atrás da câmera)')
    // `tMax` não finito: não lança e não devolve NaN (T8); `tMax = Infinity` com um raio que NUNCA acerta termina (M2: o teto de 400 m)
    assert(raioContraTerreno(RAMPA, { origem: { x: 0, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }, 0, Number.NaN) === null, 'tMax = NaN: null, sem lançar')
    const semFim = raioContraTerreno(PLANO, { origem: { x: 0, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: 0.0001, z: 0 }) }, 0, Number.POSITIVE_INFINITY)
    assert(semFim === null, 'tMax = Infinity com um raio que NUNCA acerta (sobe levemente): TERMINA e devolve null (o teto de 400 m)')
    // o teto de 400 m vale também com tMax grande: um raio rasante a 8 m que desce 0,001 por metro só alcançaria o chão (−0,45) em 8,45/0,001 = 8 450 m: além do teto, é null
    const alem = raioContraTerreno(PLANO, { origem: { x: 0, y: 8, z: 0 }, direcao: normalizar({ x: 1, y: -0.001, z: 0 }) }, 0, 1e9)
    assert(alem === null, 'o acerto a 8 450 m fica além do teto de 400 m: null (nenhum clique de câmera chega lá)')
    // o MESMO raio, descendo 0,05: acerta a 170 m, dentro do teto (controle: o teto não é «sempre null»)
    const dentro = raioContraTerreno(PLANO, { origem: { x: 0, y: 8, z: 0 }, direcao: normalizar({ x: 1, y: -0.05, z: 0 }) }, 0, 1e9)
    assert(dentro !== null && Math.abs(dentro.x - 169) < 0.5, `controle: descendo 0,05 por metro acerta o plano em x = 169 (8,45 / 0,05), veio ${dentro ? dentro.x.toFixed(2) : 'null'}`)
    // sem campo, a origem exatamente no plano acerta em t = 0 (o `t < 0` de hoje; P4): o raio parte de y = 0 descendo
    const naBorda = raioContraTerreno(undefined, { origem: { x: 1, y: 0, z: 2 }, direcao: normalizar({ x: 0, y: -1, z: 1 }) }, 0, 1e9)
    // `t = (0 − 0) / dirY` com `dirY < 0` é −0 (o `soloNoNdc` de hoje devolve o MESMO −0): afirmo «é zero», não o sinal do zero
    assert(naBorda !== null && naBorda.t === 0, 'sem campo, origem EXATAMENTE no plano: acerta em t = 0, como hoje (t < 0 é que rejeita)')
    const hojeBorda = planoDeHoje({ origem: { x: 1, y: 0, z: 2 }, direcao: normalizar({ x: 0, y: -1, z: 1 }) }, 0)
    assert(hojeBorda !== null && Object.is(naBorda.t, hojeBorda.t), 'e o `t` é idêntico, bit a bit (inclusive o sinal do zero), ao do plano de hoje')
  }

  // ── (4) CASOS DE BORDA com campo ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // raio HORIZONTAL a 30 m sobre uma rampa que sobe 0,5 m por metro: o terreno só alcança 30 m em x = 60,9; fora do quadrado (|x| > 56) a altura PRENDE em 28 − 0,45 = 27,55 e o raio, a 30 m, NUNCA o toca: null
  assert(raioContraTerreno(RAMPA, { origem: { x: 0, y: 30, z: 0 }, direcao: { x: 1, y: 0, z: 0 } }, 0, 1e9) === null, 'com campo: raio horizontal a 30 m que nunca encontra a rampa (que prende em 27,55 além da borda) é null')
  // com campo, o `planoY` NÃO vale: vale o terreno desenhado. Os DOIS planos de hoje (0 do `soloNoNdc` e −0,45 do `soloNoChao`) convergem para o MESMO ponto, senão a caixa de seleção e a ordem de movimento discordariam
  {
    const raio: Raio = { origem: { x: 0, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }
    const a = raioContraTerreno(RAMPA, raio, 0, 1e9)
    const b = raioContraTerreno(RAMPA, raio, Y_SOLO_VISUAL, 1e9)
    assert(a !== null && b !== null && Object.is(a.x, b.x) && Object.is(a.z, b.z) && Object.is(a.t, b.t), 'com campo, `planoY = 0` e `planoY = −0,45` dão o MESMO ponto (o terreno desenhado manda, não o plano)')
    const diferem = raioContraTerreno(undefined, raio, 0, 1e9)
    const dif2 = raioContraTerreno(undefined, raio, Y_SOLO_VISUAL, 1e9)
    assert(diferem !== null && dif2 !== null && Math.abs(diferem.x - dif2.x) > 0.4, 'controle POSITIVO: SEM campo os dois planos dão pontos DIFERENTES (0,45 m de diferença no chão vira ~0,45 m no clique): a convergência acima é mérito do campo')
  }
  assert(raioContraTerreno(RAMPA, { origem: { x: 0, y: 30, z: 0 }, direcao: { x: 0, y: 1, z: 0 } }, 0, 1e9) === null, 'com campo: raio para CIMA é null')
  assert(raioContraTerreno(PLANO, { origem: { x: 0, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }, 0, 5) === null, 'tMax é respeitado: um acerto além de tMax = null')
  {
    // origem DENTRO do terreno (abaixo da superfície): não há «primeiro acerto» para frente; devolve null (nunca um ponto atrás da câmera)
    const r = raioContraTerreno(RAMPA, { origem: { x: 10, y: -3, z: 0 }, direcao: normalizar({ x: 0.2, y: -1, z: 0 }) }, 0, 1e9)
    assert(r === null || r.t >= 0, `origem abaixo do terreno: nunca devolve t negativo (veio ${r ? r.t : 'null'})`)
  }
  for (const [x, z] of [[Number.NaN, 0], [0, Number.POSITIVE_INFINITY]] as const) {
    let lancou = false
    let r: ReturnType<typeof raioContraTerreno> = null
    try {
      r = raioContraTerreno(RAMPA, { origem: { x, y: 30, z }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }, 0, 1e9)
    } catch {
      lancou = true
    }
    assert(!lancou, `origem não finita (${x}, ${z}) não lança`)
    assert(r === null || (Number.isFinite(r.x) && Number.isFinite(r.z) && Number.isFinite(r.t)), `origem não finita (${x}, ${z}): o resultado é null ou todo finito (o NaN não vira ordem de movimento)`)
  }
  // a DIREÇÃO não finita (origem finita): o `raycaster` do three devolve `NaN` quando a câmera ou o pixel estão corrompidos. Sem a checagem o laço produziria `NaN` em toda parte e o clique viraria uma ordem
  // de movimento para `(NaN, NaN)`. O mutante VAL5 (valida só a origem) sobreviveu na 1ª rodada: nenhum caso tinha a direção corrompida com a origem boa.
  for (const direcao of [{ x: Number.NaN, y: -1, z: 0 }, { x: 0, y: Number.NaN, z: 0 }, { x: 0, y: -1, z: Number.POSITIVE_INFINITY }, { x: 0, y: Number.NEGATIVE_INFINITY, z: 0 }]) {
    for (const campo of [RAMPA, PLANO]) {
      let lancou = false
      let r: ReturnType<typeof raioContraTerreno> = null
      try {
        r = raioContraTerreno(campo, { origem: { x: 1, y: 30, z: 2 }, direcao }, 0, Infinity)
      } catch {
        lancou = true
      }
      assert(!lancou, `direção não finita (${direcao.x}, ${direcao.y}, ${direcao.z}) com campo não lança`)
      assert(r === null, `direção não finita (${direcao.x}, ${direcao.y}, ${direcao.z}) com campo devolve null: nenhuma ordem de movimento sai de um raio corrompido`)
    }
  }
  // o raio que sai do quadrado (|x| > 56): a altura prende na borda do campo, o resultado existe e é finito (o jogador clica perto da borda do mapa)
  {
    const r = raioContraTerreno(RAMPA, { origem: { x: 50, y: 30, z: 0 }, direcao: normalizar({ x: 1, y: -1, z: 0 }) }, 0, 1e9)
    assert(r === null || (Number.isFinite(r.x) && Number.isFinite(r.t)), 'raio que cruza a borda do quadrado: null ou finito, sem lançar')
  }
}
