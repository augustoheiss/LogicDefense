import { biomaDoQuadrado, type BiomaId } from '../biomaRecursos'
import { alturaEm } from './campoRelevo'
import { chaoDaMalha, desnivelDaMalha } from './chaoDaMalha'
import { desnivelDoChao } from './alturaVisual'
import { gerarRelevo, limparCacheRelevo } from './geradorRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Um gerador fixo (mulberry32): os pontos «aleatórios» são REPRODUTÍVEIS. */
function semente(valor: number): () => number {
  let t = valor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A SONDA DE ALTURAS (F2, Task 9, 26/11/2026). O plano (`relevo-f2-implementation-plan.md:185`) pedia `inspecionarAlturas` no bench de DEV: a altura que o DESENHO usa, lida da posição real de um mesh, contra `alturaEm`, com erro < 0,05 m e,
 * como controle positivo, desligar a chave elevando o erro a ≥ 0,3 m. Duas coisas mudaram desde que o plano foi escrito: (1) o usuário decidiu em 26/11 que o desenho amostra a MALHA que o GPU desenha (`chaoDaMalha`), e a malha diverge do
 * campo bilinear até 1,08 m entre os vértices: um «erro < 0,05 m contra `alturaEm`» FALHARIA no Leve por construção (não é defeito, é a decisão); (2) o bench vive em `IlhaRua` e a cena do R3F só existe dentro de `Cena`: expô-la
 * pede editar o arquivo mais delicado do projeto só para medir. A prova que cabe SEM tocá-lo e que o plano de fato quer é esta, no Node, com os módulos REAIS, nos 6 biomas e nos 3 passos:
 *  (a) o chão que o desenho usa é a MALHA: nos VÉRTICES da malha ele é EXATAMENTE `alturaEm` (|Δ| ≤ 1e-6) e entre eles é o triângulo que o GPU desenha (a diferença para o campo é medida e fica registrada, é o que o usuário aceitou);
 *  (b) o desenho NÃO usa o plano: o desnível de um ponto com relevo é MUITO diferente de zero (o controle positivo do plano: desligar a chave, ou seja, o chão plano, eleva o erro a ≥ 0,3 m);
 *  (c) sem campo o desnível é +0 EXATO em todo ponto (I1).
 */
export function run(): void {
  limparCacheRelevo()
  const sorteio = semente(26112026)
  // um quadrado de cada bioma (o primeiro que achar, varrendo −6..6): clareira, bosque, serra_ouro, ribeira, tundra_cristal, basalto_brasa
  const achados = new Map<BiomaId, { i: number; j: number }>()
  for (let i = -6; i <= 6; i += 1) for (let j = -6; j <= 6; j += 1) if (!(i === 0 && j === 0) && !achados.has(biomaDoQuadrado(i, j))) achados.set(biomaDoQuadrado(i, j), { i, j })
  assert(achados.size === 6, `a varredura achou um quadrado de cada um dos 6 biomas (achou ${achados.size})`)

  let pontosNoTotal = 0
  let desvioMaximoGeral = 0
  let pioresDoPlano = Infinity
  for (const [bioma, { i, j }] of achados) {
    const campo = gerarRelevo(i, j)
    for (const passo of [1, 2, 4] as const) {
      const chao = chaoDaMalha(campo, passo)
      assert(chao !== undefined, `o chão da malha existe para ${bioma} no passo ${passo}`)
      // (a) nos VÉRTICES da malha o chão que o desenho usa é EXATAMENTE o campo
      let piorNoVertice = 0
      for (let x = -56; x <= 56; x += passo * 7) for (let z = -56; z <= 56; z += passo * 7) piorNoVertice = Math.max(piorNoVertice, Math.abs(desnivelDaMalha(chao, x, z) - alturaEm(campo, x, z)))
      assert(piorNoVertice <= 1e-6, `${bioma}, passo ${passo}: nos VÉRTICES da malha o chão do desenho é exatamente \`alturaEm\` (pior ${piorNoVertice.toExponential(2)} m)`)
      // (b) entre os vértices: 300 pontos sorteados; o desvio malha × campo (o que o usuário aceitou) fica registrado, e o chão PLANO erra MUITO mais
      let desvio = 0
      let planoErra = 0
      let comRelevo = 0
      for (let k = 0; k < 300; k += 1) {
        const x = (sorteio() - 0.5) * 110
        const z = (sorteio() - 0.5) * 110
        const malha = desnivelDaMalha(chao, x, z)
        const campoAqui = alturaEm(campo, x, z)
        desvio = Math.max(desvio, Math.abs(malha - campoAqui))
        planoErra = Math.max(planoErra, Math.abs(0 - malha))
        if (Math.abs(malha) > 0.05) comRelevo += 1
        pontosNoTotal += 1
        // (c) I1: SEM campo o desnível é +0 EXATO (nenhum `-0`, nenhum 1e-17)
        assert(Object.is(desnivelDoChao(undefined, x, z), 0) && Object.is(desnivelDaMalha(undefined, x, z), 0), 'sem campo o desnível é +0 exato (I1)')
      }
      desvioMaximoGeral = Math.max(desvioMaximoGeral, desvio)
      pioresDoPlano = Math.min(pioresDoPlano, planoErra)
      // o desvio malha × campo cresce com o passo e fica abaixo de 1,2 m (medido em 26/11: 0,22 / 0,85 / 1,08 m nos 6 biomas)
      assert(desvio <= 1.2, `${bioma}, passo ${passo}: o chão do desenho (a malha) difere do campo bilinear no máximo ${desvio.toFixed(3)} m ≤ 1,2 m (medido em 26/11: até 1,08 m no Leve)`)
      // O CONTROLE POSITIVO do plano: o chão PLANO (a chave desligada) erra ≥ 0,3 m contra o relevo (a sonda enxerga a diferença)
      assert(planoErra >= 0.3, `CONTROLE: ${bioma}, passo ${passo}: o chão PLANO erra ${planoErra.toFixed(2)} m contra o relevo (≥ 0,3 m): a sonda separa o desenho com relevo do plano de hoje`)
      assert(comRelevo >= 150, `CONTROLE: ${bioma}, passo ${passo}: ${comRelevo} de 300 pontos têm desnível > 5 cm (relevo de verdade, ≥ 150): o quadrado não é plano`)
    }
  }
  assert(pontosNoTotal === 6 * 3 * 300, `a sonda mediu ${pontosNoTotal} pontos (6 biomas × 3 passos × 300)`)

  // (d) A BORDA E O QUE NÃO É NÚMERO: fora do quadrado (|x| ou |z| > 56) o chão que o desenho usa PRENDE na borda, como `alturaEm`: o ponto a 70 m do centro tem o desnível do ponto a 56 m (o mutante «sem prender» lia
  // a malha FORA da grade e devolvia lixo: a sonda só sorteava pontos dentro de ±55 e não o via). E `NaN`/`Infinity` (a entrada corrompida) NÃO elevam nada: o desnível é +0 exato, e nunca `NaN` (o plano: «NaN e infinito não propagam»).
  for (const [bioma, { i, j }] of achados) {
    const campo = gerarRelevo(i, j)
    for (const passo of [1, 2, 4] as const) {
      const chao = chaoDaMalha(campo, passo)
      for (const [fx, fz, dx, dz] of [[56, 10, 14, 0], [-56, -20, -30, 0], [7, 56, 0, 25], [-9, -56, 0, -90], [56, 56, 40, 40]] as const) {
        const dentro = desnivelDaMalha(chao, fx, fz)
        const fora = desnivelDaMalha(chao, fx + dx, fz + dz)
        assert(Math.abs(dentro - fora) <= 1e-9, `${bioma}, passo ${passo}: o chão PRENDE na borda: o desnível a (${fx + dx}, ${fz + dz}) é o de (${fx}, ${fz}) (${fora} contra ${dentro})`)
      }
      for (const ruim of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assert(Object.is(desnivelDaMalha(chao, ruim, 3), 0) && Object.is(desnivelDaMalha(chao, 3, ruim), 0), `${bioma}, passo ${passo}: a entrada ${ruim} NÃO propaga: o desnível é +0 exato`)
      }
    }
  }
  // o desvio máximo geral registra o que o usuário aceitou (a malha não é o campo bilinear entre os vértices)
  assert(desvioMaximoGeral > 0.05, `CONTROLE: o desvio malha × campo é mensurável (${desvioMaximoGeral.toFixed(3)} m > 0,05): a sonda enxerga a decisão de «o desenho amostra a malha»`)
  limparCacheRelevo()
}
