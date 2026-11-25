import { type LagoaRasa, emAguaRasa } from '../biomaRecursos'
import { DIMENSOES_OBRA, type PecaId } from '../partidaPolicies'
import { classificarSuporteObra, pegadaEfetivaFundacao, Y_AGUA_VISUAL, Y_SOLO_VISUAL } from '../visual/suporteFundacao'
import { desnivelDaFundacao, desnivelDaObraNoChao, desnivelDoApoio, desnivelDoChao } from './alturaVisual'
import { alturaEm, LADO_RELEVO, MEIA_RELEVO, type CampoRelevo } from './campoRelevo'
import { gerarRelevo } from './geradorRelevo'
import { gerarPaisagemBioma } from '../biomaRecursos'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Uma lagoa conhecida no centro do quadrado: 8 × 6 m de semi-eixos. */
const LAGOA: LagoaRasa = { x: 0, z: 0, rx: 8, rz: 6 }

/**
 * Um campo com uma BACIA conhecida sob a lagoa: o leito desce a −1,3 m no centro e sobe linearmente até 0 em `r = 1,35` (a mesma forma do gerador real: o fundo é o do centro e a margem sobe depois da
 * borda da elipse). Serve para provar o comportamento SEM depender do gerador: o oráculo é a geometria da bacia, não o código que se testa.
 */
function campoComBacia(): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
      const r = Math.hypot((gx - LAGOA.x) / LAGOA.rx, (gz - LAGOA.z) / LAGOA.rz)
      alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = r >= 1.35 ? 0 : -1.3 * (1 - r / 1.35)
    }
  }
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

/**
 * TASK 4, A ÁGUA (25/11/2026). O que REPOUSA na água (o convés do píer e o que está sobre ele, a vitória-régia) tem de ficar na LÂMINA, não no leito: a lâmina d'água desenhada é PLANA em
 * `Y_AGUA_VISUAL = −0,375` e só o terreno é escavado (leito a −1,3 m no centro de uma lagoa). Somar o desnível do chão a quem boia o afundava 0,5 a 1,3 m: medido em 25/11 nos 169 quadrados, 100 %
 * dos píeres, 97 % das vitórias-régias e 95 % dos juncos ficariam abaixo da água. `desnivelDoApoio` é a ÚNICA conta: dentro de uma lagoa (a MESMA `emAguaRasa` que a regra e a água desenhada usam),
 * onde o chão está abaixo da lâmina, o apoio é a lâmina; em qualquer outro lugar é o desnível do chão. É o que o contrato anterior (T8, F1 e F2) deixou de ver: a mutação provou que o CÓDIGO seguia o
 * contrato, não que o contrato estava certo.
 */
function contratoDoApoioNaAgua(): void {
  const campo = campoComBacia()
  const lagoas = [LAGOA]
  const laminaRelativa = Y_AGUA_VISUAL - Y_SOLO_VISUAL // a lâmina, medida a partir do plano de hoje: −0,375 − (−0,45) = +0,075

  // (0) controles do INSTRUMENTO: a bacia sintética tem o fundo a −1,3 m no centro e 0 fora; sem eles um teste verde não provaria nada
  assert(Math.abs(alturaEm(campo, 0, 0) + 1.3) < 1e-3, 'controle: o fundo da bacia sintética é −1,3 m no centro')
  assert(alturaEm(campo, 30, 30) === 0, 'controle: longe da lagoa o terreno é plano (0)')
  assert(desnivelDoChao(campo, 0, 0) < laminaRelativa - 1, 'controle: o desnível do CHÃO no centro está mais de 1 m abaixo da lâmina (é o defeito que a função conserta)')

  // (1) I1: sem campo é 0, com ou sem lagoa, em qualquer ponto (o jogo de hoje com a chave desligada)
  for (const [x, z] of [[0, 0], [3, 2], [-7, 1], [30, 30], [1e9, -1e9]] as const) {
    assert(desnivelDoApoio(undefined, lagoas, x, z) === 0, `sem campo o apoio em (${x}, ${z}) é 0 exato (I1)`)
  }
  for (const ruim of [Number.NaN, Infinity, -Infinity]) {
    assert(desnivelDoApoio(campo, lagoas, ruim, 0) === 0 && desnivelDoApoio(campo, lagoas, 0, ruim) === 0, `com campo, ${String(ruim)} NÃO eleva: dá 0`)
  }

  // (2) DENTRO da lagoa, onde o leito está abaixo da lâmina: o apoio é a LÂMINA (desnível = lâmina − plano de hoje), igual em todo ponto da lagoa, e NUNCA o leito
  for (const [x, z] of [[0, 0], [2, 1], [-4, 2], [5, -3], [7.5, 0], [0, 5.5]] as const) {
    assert(emAguaRasa(lagoas, x, z, 0), `controle: (${x}, ${z}) está dentro da lagoa (a mesma regra do jogo)`)
    assert(Math.abs(desnivelDoApoio(campo, lagoas, x, z) - laminaRelativa) < 1e-9, `dentro da lagoa em (${x}, ${z}) o apoio é a lâmina (${laminaRelativa.toFixed(3)}), não o leito (${desnivelDoChao(campo, x, z).toFixed(2)})`)
  }

  // (3) FORA da lagoa é o desnível do CHÃO, exato: o apoio não pode mexer em terra (a margem, o morro, o plano)
  for (const [x, z] of [[30, 30], [-20, 5], [10.5, 0], [0, 8], [-9, 0]] as const) {
    assert(!emAguaRasa(lagoas, x, z, 0), `controle: (${x}, ${z}) está FORA da lagoa`)
    assert(desnivelDoApoio(campo, lagoas, x, z) === desnivelDoChao(campo, x, z), `fora da lagoa em (${x}, ${z}) o apoio é o desnível do chão, exato`)
  }

  // (4) o apoio na água nunca fica ABAIXO da lâmina nem abaixo do chão que a contém: no pior caso (terreno ACIMA da lâmina dentro da elipse, uma ilhota) vale o MAIOR dos dois
  const ilhota = campoComBacia()
  ilhota.alturas[(0 + MEIA_RELEVO) * LADO_RELEVO + (2 + MEIA_RELEVO)] = 0.9 // um pico de 0,9 m em (2, 0), DENTRO da lagoa
  assert(emAguaRasa(lagoas, 2, 0, 0), 'controle: o pico está dentro da lagoa')
  assert(Math.abs(desnivelDoApoio(ilhota, lagoas, 2, 0) - 0.9) < 1e-6, 'dentro da lagoa, onde o chão está ACIMA da lâmina (uma ilhota), o apoio é o chão (0,9), não a lâmina: vale o maior')

  // (5) várias lagoas: basta cair em UMA delas
  const outra: LagoaRasa = { x: 20, z: 20, rx: 3, rz: 3 }
  assert(Math.abs(desnivelDoApoio(campo, [LAGOA, outra], 20, 20) - Math.max(desnivelDoChao(campo, 20, 20), laminaRelativa)) < 1e-9, 'a segunda lagoa também é água: o apoio é o maior entre o chão e a lâmina')
  assert(desnivelDoApoio(campo, [], 0, 0) === desnivelDoChao(campo, 0, 0), 'sem lagoas é o desnível do chão')
  // `lagoas` AUSENTE (as obras declaram a prop como opcional, como o `campo`) vale «sem lagoas»: o desnível do chão, num campo que TEM bacia (onde errar afundaria o píer), e nunca um erro
  assert(desnivelDoApoio(campo, undefined, 0, 0) === desnivelDoChao(campo, 0, 0), 'com `lagoas` ausente é o desnível do chão (a prop é opcional: sem ela é o de hoje)')
  assert(desnivelDoApoio(undefined, undefined, 0, 0) === 0, 'sem campo e sem lagoas é 0 exato (I1)')

  // (6) NO GERADOR REAL, nos 169 quadrados: dentro de qualquer lagoa o apoio NUNCA fica abaixo da lâmina desenhada (a metade do defeito medido: 100 % dos píeres e 97 % das vitórias ficariam abaixo)
  let pontos = 0
  let abaixoDoChao = 0
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const real = gerarRelevo(i, j)
      const lagoasReais = gerarPaisagemBioma(i, j, 5000).lagoas
      for (const l of lagoasReais) {
        for (let k = 0; k < 8; k += 1) {
          const ang = (k / 8) * Math.PI * 2 + 0.3
          for (const r of [0, 0.3, 0.6, 0.9]) {
            const x = l.x + Math.cos(ang) * l.rx * r
            const z = l.z + Math.sin(ang) * l.rz * r
            if (Math.abs(x) > 54 || Math.abs(z) > 54) continue
            pontos += 1
            if (!emAguaRasa(lagoasReais, x, z, 0)) continue
            const apoio = desnivelDoApoio(real, lagoasReais, x, z)
            assert(apoio >= laminaRelativa - 1e-9, `(${i},${j}) em (${x.toFixed(1)}, ${z.toFixed(1)}) dentro da lagoa o apoio (${apoio.toFixed(2)}) ficou ABAIXO da lâmina (${laminaRelativa.toFixed(3)})`)
            if (apoio < desnivelDoChao(real, x, z) - 1e-9) abaixoDoChao += 1
          }
        }
      }
    }
  }
  assert(pontos > 5000, `o controle do gerador real amostrou pontos de verdade (${pontos})`)
  assert(abaixoDoChao === 0, `o apoio nunca fica abaixo do chão que o contém (${abaixoDoChao} violações)`)
}

/**
 * TASK 4, A ÁGUA, a FUNDAÇÃO (25/11/2026). Uma fundação decide o suporte pela `classificarSuporteObra` (o centro E os 4 cantos da pegada: `'agua'` se o centro está na lagoa, ou se ≥ 2 cantos estão). A altura do
 * grupo-pai tem de seguir ESSA decisão, e não um ponto: se o desnível viesse de `desnivelDoApoio` no centro, uma fundação de TERRA cujo centro cai por pouco na elipse subiria à lâmina, e um píer cujo centro
 * está na margem (mas 2 cantos na água) ficaria no leito. `desnivelDaFundacao(suporte, …)` é a ÚNICA conta: `'agua'` → o apoio (a lâmina); `'terra'` → o desnível do chão.
 */
function contratoDaFundacaoNaAgua(): void {
  const campo = campoComBacia()
  const lagoas = [LAGOA]
  const laminaRelativa = Y_AGUA_VISUAL - Y_SOLO_VISUAL

  // (1) o suporte decide: 'agua' é o apoio (a lâmina onde o leito é fundo), 'terra' é o chão, MESMO com o centro dentro da elipse (o oposto do que o ponto diria)
  assert(Math.abs(desnivelDaFundacao('agua', campo, lagoas, 0, 0) - laminaRelativa) < 1e-9, "suporte 'agua' no centro da lagoa: o grupo-pai sobe à lâmina")
  assert(desnivelDaFundacao('terra', campo, lagoas, 0, 0) === desnivelDoChao(campo, 0, 0), "suporte 'terra' no centro da lagoa: o chão (o suporte decide, não o ponto)")
  assert(desnivelDaFundacao('terra', campo, lagoas, 0, 0) < laminaRelativa - 1, "controle: o chão no centro da lagoa está mais de 1 m abaixo da lâmina (por isso 'terra' e 'agua' dão resultados bem diferentes ali)")
  // o píer na MARGEM: centro FORA da elipse mas suporte 'agua' (≥ 2 cantos na água): o apoio de um ponto fora da lagoa é o chão (o leito sobe), e a fundação precisa da LÂMINA mesmo assim
  const naMargem = 8.3 // fora da elipse (rx = 8) por 0,3 m
  assert(!emAguaRasa(lagoas, naMargem, 0, 0), 'controle: o centro da margem está FORA da lagoa')
  assert(Math.abs(desnivelDaFundacao('agua', campo, lagoas, naMargem, 0) - laminaRelativa) < 1e-9, "um píer com o centro na margem (suporte 'agua') também fica na lâmina: o suporte decide, não o ponto")
  assert(desnivelDaFundacao('terra', campo, lagoas, naMargem, 0) === desnivelDoChao(campo, naMargem, 0), "uma fundação de terra na margem é o chão")

  // (2) I1: sem campo é 0, nos dois suportes
  assert(desnivelDaFundacao('agua', undefined, lagoas, 0, 0) === 0 && desnivelDaFundacao('terra', undefined, lagoas, 0, 0) === 0, 'sem campo é 0 exato (I1), nos dois suportes')
  assert(desnivelDaFundacao('agua', campo, undefined, 0, 0) === desnivelDoChao(campo, 0, 0), "'agua' sem lagoas não tem lâmina para repousar: é o chão (a prop é opcional)")

  // (3) um píer numa ILHOTA (o chão acima da lâmina) fica no chão, não rebaixado à lâmina: vale o maior
  const ilhota = campoComBacia()
  ilhota.alturas[(0 + MEIA_RELEVO) * LADO_RELEVO + (2 + MEIA_RELEVO)] = 0.9
  assert(Math.abs(desnivelDaFundacao('agua', ilhota, lagoas, 2, 0) - 0.9) < 1e-6, "um píer sobre uma ilhota fica no chão (0,9), não rebaixado à lâmina")

  // (4) NO GERADOR REAL, para cada tipo de obra em cada lagoa dos 169 quadrados: a fundação que o jogo classifica 'agua' tem o grupo-pai na lâmina ou acima dela, e a que classifica 'terra' tem o chão exato
  let aguas = 0
  let terras = 0
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const real = gerarRelevo(i, j)
      const lagoasReais = gerarPaisagemBioma(i, j, 5000).lagoas
      for (const l of lagoasReais) {
        for (const [dx, dz] of [[0, 0], [l.rx * 0.5, 0], [l.rx * 1.05, 0], [0, l.rz * 1.1], [l.rx * 1.4, l.rz * 0.3]] as const) {
          const x = l.x + dx
          const z = l.z + dz
          if (Math.abs(x) > 54 || Math.abs(z) > 54) continue
          for (const dim of [[1.4, 1.4, 1.4], [2.4, 2, 2.4], [4.8, 3, 4.8]] as const) {
            const suporte = classificarSuporteObra(lagoasReais, x, z, dim)
            const d = desnivelDaFundacao(suporte, real, lagoasReais, x, z)
            if (suporte === 'agua') {
              aguas += 1
              assert(d >= laminaRelativa - 1e-9, `(${i},${j}) píer em (${x.toFixed(1)}, ${z.toFixed(1)}) ficou ABAIXO da lâmina (${d.toFixed(2)} < ${laminaRelativa.toFixed(3)})`)
            } else {
              terras += 1
              assert(d === desnivelDoChao(real, x, z), `(${i},${j}) fundação de terra em (${x.toFixed(1)}, ${z.toFixed(1)}) não é o chão exato`)
            }
          }
        }
      }
    }
  }
  assert(aguas > 200 && terras > 200, `o controle do gerador real viu os dois suportes (água ${aguas}, terra ${terras})`)
}

/**
 * TASK 4, A ÁGUA, a OBRA (25/11/2026). A fundação, a malha da obra pequena (`ObraArquiteturaMesh`) e o fantasma (`GhostBlueprintObra`) desenham o MESMO prédio: a altura do grupo-pai de cada um tem de ser
 * IDÊNTICA, ou a obra flutua sobre o píer ou o afunda (um píer na lâmina com o prédio no leito). `desnivelDaObraNoChao(obra, campo, lagoas)` é a ÚNICA conta: a pegada (`pegadaEfetivaFundacao`) e o suporte
 * (`classificarSuporteObra`) que a fundação já usa, entregues a `desnivelDaFundacao`. Aqui se prova, no gerador real, que fundação e obra dão exatamente o mesmo número para toda obra em toda lagoa.
 */
function contratoDaObraNaAgua(): void {
  const campo = campoComBacia()
  const lagoas = [LAGOA]
  const laminaRelativa = Y_AGUA_VISUAL - Y_SOLO_VISUAL
  const obra = (tipo: PecaId, x: number, z: number): Parameters<typeof desnivelDaObraNoChao>[0] => ({ tipo, x, z, hp: 10, construindoRestante: 0, blocosNv5: undefined })

  // (1) uma obra no centro de uma lagoa: o suporte é 'agua' e o grupo sobe à lâmina; fora dela é o chão
  assert(classificarSuporteObra(lagoas, 0, 0, DIMENSOES_OBRA.quartel) === 'agua', "controle: um quartel no centro da lagoa é suporte 'agua'")
  assert(Math.abs(desnivelDaObraNoChao(obra('quartel', 0, 0), campo, lagoas) - laminaRelativa) < 1e-9, 'um quartel no centro da lagoa fica na lâmina')
  assert(classificarSuporteObra(lagoas, 30, 30, DIMENSOES_OBRA.quartel) === 'terra', "controle: um quartel longe da lagoa é suporte 'terra'")
  assert(desnivelDaObraNoChao(obra('quartel', 30, 30), campo, lagoas) === desnivelDoChao(campo, 30, 30), 'um quartel em terra é o chão exato')

  // (2) I1: sem campo é 0; sem lagoas é o chão
  assert(desnivelDaObraNoChao(obra('quartel', 0, 0), undefined, lagoas) === 0, 'sem campo é 0 exato (I1)')
  assert(desnivelDaObraNoChao(obra('quartel', 0, 0), campo, undefined) === desnivelDoChao(campo, 0, 0), 'sem lagoas é o chão (a prop é opcional)')

  // (3) o suporte vem da PEGADA EFETIVA, não de `obra.tipo` isolado: um prédio Nv5 (7 × 5 × 7 voxels) tem pegada maior que a de um quartel, e pode estar 'agua' pelos cantos onde o quartel não estaria
  const nv5 = { ...obra('quartel', 7.4, 0), blocosNv5: new Uint8Array(1) } as Parameters<typeof desnivelDaObraNoChao>[0]
  const pegadaNv5 = pegadaEfetivaFundacao(nv5)
  assert(pegadaNv5.dim[0] > DIMENSOES_OBRA.quartel[0], 'controle: a pegada do prédio Nv5 é MAIOR que a do quartel')
  assert(desnivelDaObraNoChao(nv5, campo, lagoas) === desnivelDaFundacao(classificarSuporteObra(lagoas, pegadaNv5.cx, pegadaNv5.cz, pegadaNv5.dim), campo, lagoas, pegadaNv5.cx, pegadaNv5.cz), 'a obra usa a pegada EFETIVA (a do Nv5), a mesma da fundação')

  // (4) NO GERADOR REAL: para cada tipo de obra em cada lagoa dos 169 quadrados, a obra e a fundação dão EXATAMENTE o mesmo número (o prédio nunca fica num nível e o píer em outro)
  let total = 0
  let naAgua = 0
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const real = gerarRelevo(i, j)
      const lagoasReais = gerarPaisagemBioma(i, j, 5000).lagoas
      for (const l of lagoasReais) {
        for (const tipo of Object.keys(DIMENSOES_OBRA) as PecaId[]) {
          for (const [dx, dz] of [[0, 0], [l.rx * 0.6, 0], [l.rx * 1.05, 0], [0, l.rz * 1.1]] as const) {
            const x = l.x + dx
            const z = l.z + dz
            if (Math.abs(x) > 54 || Math.abs(z) > 54) continue
            const o = obra(tipo, x, z)
            const pegada = pegadaEfetivaFundacao(o)
            const suporte = classificarSuporteObra(lagoasReais, pegada.cx, pegada.cz, pegada.dim)
            const daFundacao = desnivelDaFundacao(suporte, real, lagoasReais, pegada.cx, pegada.cz)
            const daObra = desnivelDaObraNoChao(o, real, lagoasReais)
            total += 1
            if (suporte === 'agua') naAgua += 1
            assert(daObra === daFundacao, `(${i},${j}) ${tipo} em (${x.toFixed(1)}, ${z.toFixed(1)}): obra (${daObra.toFixed(3)}) ≠ fundação (${daFundacao.toFixed(3)}): o prédio e o píer ficariam em alturas diferentes`)
            if (suporte === 'agua') assert(daObra >= laminaRelativa - 1e-9, `(${i},${j}) ${tipo} em (${x.toFixed(1)}, ${z.toFixed(1)}) na água ficou ABAIXO da lâmina`)
          }
        }
      }
    }
  }
  assert(total > 2000 && naAgua > 500, `o controle do gerador real viu obras de verdade (${total} no total, ${naAgua} na água)`)

  // (5) O FANTASMA: o sandbox decide `sobreAgua` por `classificarSuporteObra(lagoas, x, z, DIMENSOES_OBRA[tipo])` (uma SEGUNDA classificação, que não passa por `desnivelDaObraNoChao`), e o fantasma sobe à lâmina pela
  // conta da obra. Os dois TÊM de concordar em toda obra pronta de todo ponto, senão o fantasma mostra «sobre a água» (azul, com estacas) com a base no chão, ou o inverso. Prova nos 169 quadrados.
  let discordancias = 0
  let vistos = 0
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const lagoasReais = gerarPaisagemBioma(i, j, 5000).lagoas
      for (const l of lagoasReais) {
        for (const tipo of Object.keys(DIMENSOES_OBRA) as PecaId[]) {
          for (const [dx, dz] of [[0, 0], [l.rx * 0.9, 0], [l.rx * 1.1, 0.4], [0, l.rz * 1.2]] as const) {
            const x = l.x + dx
            const z = l.z + dz
            if (Math.abs(x) > 54 || Math.abs(z) > 54) continue
            vistos += 1
            const doSandbox = classificarSuporteObra(lagoasReais, x, z, DIMENSOES_OBRA[tipo])
            const pegada = pegadaEfetivaFundacao(obra(tipo, x, z))
            const daConta = classificarSuporteObra(lagoasReais, pegada.cx, pegada.cz, pegada.dim)
            if (doSandbox !== daConta) discordancias += 1
          }
        }
      }
    }
  }
  assert(vistos > 2000, `o controle do fantasma viu obras de verdade (${vistos})`)
  assert(discordancias === 0, `o suporte do fantasma (\`sobreAgua\` do sandbox) e o da conta da obra discordam em ${discordancias} de ${vistos} obras: o fantasma mostraria «sobre a água» com a base no chão (ou o inverso)`)
}

export function run(): void {
  contratoDoApoioNaAgua()
  contratoDaFundacaoNaAgua()
  contratoDaObraNaAgua()
}
