import { semente } from '../geradoresBase'
import { GERADORES_ENEM_PARAMETRICOS } from './geradoresEnem'
import { validarDesafioZeroSpoiler } from './validadorDicas'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function verificarMatematicaIndependente(archetypeId: string, enunciado: string, respostaCerta: number): void {
  if (archetypeId === 'g5_enem_escala_conversao') {
    const mEscala = enunciado.match(/1\s*:\s*(\d[\d.]*)/)
    const mVol = enunciado.match(/(\d[\d.]*)\s*cm³/)
    const mCons = enunciado.match(/(\d[\d.]*)\s*litros\s+por\s+dia/)
    assert(mEscala && mVol && mCons, `padrão escala inesperado: ${enunciado}`)
    const den = Number(mEscala[1].replace(/\./g, ''))
    const vol = Number(mVol[1].replace(/\./g, ''))
    const cons = Number(mCons[1].replace(/\./g, ''))
    const esperado = (vol * den ** 3) / 1000 / cons
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `escala incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g5_enem_porcentagem_sucessiva') {
    const mPreco = enunciado.match(/R\$\s*(\d[\d.]*(?:,\d+)?)/)
    const mAum = enunciado.match(/\*\*(\d+)%\s+maior\*\*/)
    const mDesc = enunciado.match(/\*\*(\d+)%\s+de\s+desconto/)
    assert(mPreco && mAum && mDesc, `padrão porcentagem inesperado: ${enunciado}`)
    const preco = Number(mPreco[1].replace(/\./g, '').replace(',', '.'))
    const aum = Number(mAum[1])
    const desc = Number(mDesc[1])
    const esperado = Math.round(preco * (1 + aum / 100) * (1 - desc / 100) * 100) / 100
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `porcentagem incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g6_enem_probabilidade_combinatoria') {
    const mTotal = enunciado.match(/\*\*(\d+)\s+participantes\*\*/)
    const mK = enunciado.match(/comissão de \*\*(\d+)\s+pessoas\*\*/)
    assert(mTotal && mK, `padrão combinatória inesperado: ${enunciado}`)
    const n = Number(mTotal[1])
    const k = Number(mK[1])
    const comb = (nn: number, kk: number) => {
      let res = 1
      for (let i = 1; i <= kk; i++) res = (res * (nn - kk + i)) / i
      return Math.round(res)
    }
    const esperado = comb(n, k) - comb(n - 2, k - 2)
    assert(esperado === respostaCerta, `combinatória incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g7_enem_funcao_afim_pa') {
    const mCustos = enunciado.match(
      /Produzindo \*\*(\d+) peças\*\*, o custo total é \*\*R\$ ([\d.]+),00\*\*; produzindo \*\*(\d+) peças\*\*, sobe para \*\*R\$ ([\d.]+),00\*\*/,
    )
    const mAlvo = enunciado.match(/para produzir \*\*(\d+) peças\*\*/)
    assert(mCustos && mAlvo, `padrão função afim inesperado: ${enunciado}`)
    const q1 = Number(mCustos[1])
    const c1 = Number(mCustos[2].replace(/\./g, ''))
    const q2 = Number(mCustos[3])
    const c2 = Number(mCustos[4].replace(/\./g, ''))
    const qAlvo = Number(mAlvo[1])
    const taxa = (c2 - c1) / (q2 - q1)
    const esperado = c1 + taxa * (qAlvo - q1)
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `função afim incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  throw new Error(`Gerador desconhecido sem verificador: ${archetypeId}`)
}

export function run(): void {
  assert(GERADORES_ENEM_PARAMETRICOS.length === 4, `esperava 4 geradores ENEM, achei ${GERADORES_ENEM_PARAMETRICOS.length}`)

  for (const gen of GERADORES_ENEM_PARAMETRICOS) {
    const assinaturas = new Set<string>()
    const res = gen.reserva()
    const checkRes = validarDesafioZeroSpoiler(res)
    assert(checkRes.ok, `reserva ${gen.archetypeId} violou zero spoiler: ${checkRes.violacoes.join(' | ')}`)

    for (let i = 1; i <= 120; i++) {
      const item = gen.synthesize(semente(i * 37 + gen.grau), i)
      assert(item.grau === gen.grau, `${gen.archetypeId}: grau incorreto`)
      assert(item.alternativas.length === 4, `${gen.archetypeId}: deve ter 4 alternativas`)
      assert(item.altarFisicoCompativel === true, `${gen.archetypeId}: devia ser compatível com altar físico`)

      const valores = new Set(item.alternativas.map((a) => a.rotulo))
      assert(valores.size === 4, `${gen.archetypeId}: alternativas repetidas na seed ${i}`)

      const corretas = item.alternativas.filter((a) => a.correta)
      assert(corretas.length === 1 && typeof corretas[0].valorNumerico === 'number', `${gen.archetypeId}: sem correta única`)
      verificarMatematicaIndependente(gen.archetypeId, item.enunciadoMarkdown, corretas[0].valorNumerico!)

      const erradas = item.alternativas.filter((a) => !a.correta)
      assert(erradas.every((e) => Boolean(e.tagErro) && e.diagnosticoPt.length >= 12), `${gen.archetypeId}: distrator sem tagErro/diagnóstico`)

      const spoiler = validarDesafioZeroSpoiler(item)
      assert(spoiler.ok, `${gen.archetypeId} seed ${i} violou zero spoiler: ${spoiler.violacoes.join(' | ')}`)

      assinaturas.add(item.assinatura)
    }

    assert(assinaturas.size >= 15, `${gen.archetypeId} produziu pouca variedade (${assinaturas.size} assinaturas únicas em 120 seeds)`)
  }
}
