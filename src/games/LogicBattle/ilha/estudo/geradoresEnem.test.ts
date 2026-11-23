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

  if (archetypeId === 'g5_enem_media_ponderada_setores') {
    const mOp = enunciado.match(/\*\*(\d+)\s+funcionários\*\*\s+com salário de \*\*R\$ ([\d.]+),00\*\*/)
    const mEng = enunciado.match(/Engenharia\*\*,\s+há\s+\*\*(\d+)\s+funcionários\*\*\s+com salário de \*\*R\$ ([\d.]+),00\*\*/)
    assert(mOp && mEng, `padrão média ponderada inesperado: ${enunciado}`)
    const nA = Number(mOp[1])
    const salA = Number(mOp[2].replace(/\./g, ''))
    const nB = Number(mEng[1])
    const salB = Number(mEng[2].replace(/\./g, ''))
    const esperado = (nA * salA + nB * salB) / (nA + nB)
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `média ponderada incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g6_enem_regra3_composta_producao') {
    const m1 = enunciado.match(/com \*\*(\d+)\s+técnicos\*\*,\s+trabalhando \*\*(\d+)\s+horas por dia\*\* no mesmo ritmo individual,\s+monta \*\*([\d.]+)\s+placas/)
    const m2 = enunciado.match(/para \*\*(\d+)\s+técnicos\*\*,\s+trabalhando \*\*(\d+)\s+horas por dia\*\*/)
    assert(m1 && m2, `padrão regra de 3 composta inesperado: ${enunciado}`)
    const f1 = Number(m1[1])
    const h1 = Number(m1[2])
    const p1 = Number(m1[3].replace(/\./g, ''))
    const f2 = Number(m2[1])
    const h2 = Number(m2[2])
    const esperado = (p1 / (f1 * h1)) * (f2 * h2)
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `regra de 3 composta incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g7_enem_vazao_piscina_proporcao') {
    const mQ = enunciado.match(/vazão constante de \*\*([\d.]+)\s+L\/min\*\*/)
    const mV = enunciado.match(/capacidade \*\*(\d+)%\s+maior\*\*/)
    const mT = enunciado.match(/tempo \*\*(\d+)%\s+maior\*\*/)
    assert(mQ && mV && mT, `padrão vazão inesperado: ${enunciado}`)
    const q1 = Number(mQ[1].replace(/\./g, ''))
    const aumV = Number(mV[1])
    const aumT = Number(mT[1])
    const esperado = (q1 * (100 + aumV)) / (100 + aumT)
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `vazão incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g7_enem_urna_probabilidade_ajuste') {
    const mA = enunciado.match(/urna A, a chance de sair uma ficha premiada é \*\*(\d+)%\*\*/)
    const mB = enunciado.match(/urna B há \*\*(\d+)\s+fichas premiadas\*\*,\s+que hoje representam \*\*(\d+)%\*\*/)
    const mAlvo = enunciado.match(/caia exatamente para \*\*(\d+)%\*\*/)
    assert(mA && mB && mAlvo, `padrão urna probabilidade inesperado: ${enunciado}`)
    const pA = Number(mA[1]) / 100
    const premB = Number(mB[1])
    const pBAtual = Number(mB[2]) / 100
    const pAlvo = Number(mAlvo[1]) / 100
    const totalAtual = premB / pBAtual
    const totalFinal = (premB * pA) / pAlvo
    const esperado = Math.round(totalFinal - totalAtual)
    assert(esperado === respostaCerta, `urna probabilidade incorreta: esperado ${esperado}, veio ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g5_geometria_area_perimetro') {
    const m = enunciado.match(/\*\*(\d+) m × (\d+) m\*\*[\s\S]*?\*\*(\d+) m × (\d+) m\*\*[\s\S]*?\*\*(\d+) m²\*\*/)
    assert(!!m, `Padrão não reconhecido (geometria área): ${enunciado}`)
    const areaTotal = Number(m[1]) * Number(m[2]) - Number(m[3]) * Number(m[4])
    const esperado = areaTotal / Number(m[5])
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `Geometria área: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g5_estatistica_mediana_moda') {
    const m = enunciado.match(/\*\*(\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\*\*/)
    assert(!!m, `Padrão não reconhecido (mediana): ${enunciado}`)
    const nums = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number).sort((a, b) => a - b)
    const esperado = (nums[2] + nums[3]) / 2
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `Mediana: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g5_juros_simples_parcelamento') {
    const m = enunciado.match(/\*\*R\$ ([\d.]+),00\*\*[\s\S]*?desconto de \*\*(\d+)%\*\*[\s\S]*?\*\*(\d+)% ao mês\*\* durante \*\*(\d+) meses\*\*/)
    assert(!!m, `Padrão não reconhecido (juros simples): ${enunciado}`)
    const preco = Number(m[1].replace(/\./g, ''))
    const descPct = Number(m[2])
    const taxaPct = Number(m[3])
    const meses = Number(m[4])
    const esperado = (preco * (descPct + taxaPct * meses)) / 100
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `Juros simples: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g6_geometria_espacial_volume') {
    const m = enunciado.match(/medindo \*\*(\d+) m × (\d+) m\*\* de base e \*\*(\d+) m\*\* de altura[\s\S]*?preenchido com \*\*(\d+)%\*\*[\s\S]*?\*\*(\d+) L\/min\*\*/)
    assert(!!m, `Padrão não reconhecido (volume espacial): ${enunciado}`)
    const a = Number(m[1])
    const b = Number(m[2])
    const h = Number(m[3])
    const pct = Number(m[4])
    const vazao = Number(m[5])
    const esperado = (a * b * h * 1000 * ((100 - pct) / 100)) / vazao
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `Volume espacial: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g6_funcao_quadratica_vertice') {
    const m = enunciado.match(/\$\$[LPh]\(x\) = -(\d+)x\^2 \+ (\d+)x ([+-]) (\d+)\$\$/)
    assert(!!m, `Padrão não reconhecido (vértice quadrática): ${enunciado}`)
    const a = Number(m[1])
    const b = Number(m[2])
    const c = (m[3] === '-' ? -1 : 1) * Number(m[4])
    const xv = b / (2 * a)
    const esperado = -a * xv * xv + b * xv + c
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `Vértice quadrática: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g6_pitagoras_trigonometria') {
    const m = enunciado.match(/a \*\*(\d+) m\*\* de altura[\s\S]*?a \*\*(\d+) m\*\* de altura[\s\S]*?mede \*\*(\d+) m\*\*/)
    assert(!!m, `Padrão não reconhecido (Pitágoras): ${enunciado}`)
    const hBase = Number(m[1])
    const hTopo = Number(m[2])
    const horiz = Number(m[3])
    const esperado = Math.hypot(horiz, hTopo - hBase)
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `Pitágoras: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g7_juros_compostos_montante') {
    const m = enunciado.match(/\*\*R\$ ([\d.]+),00\*\*[\s\S]*?taxa de \*\*(\d+)% ao mês\*\*[\s\S]*?final de \*\*(\d+) meses\*\*/)
    assert(!!m, `Padrão não reconhecido (juros compostos): ${enunciado}`)
    const capital = Number(m[1].replace(/\./g, ''))
    const taxaPct = Number(m[2])
    const periodos = Number(m[3])
    const esperado = Math.round(capital * Math.pow(1 + taxaPct / 100, periodos))
    assert(Math.abs(esperado - respostaCerta) < 1, `Juros compostos: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  if (archetypeId === 'g7_pa_pg_sequencias') {
    const m = enunciado.match(/\*\*(\d+) [^*]+\*\*[\s\S]*?\*\*(\d+) [^*]+\*\*[\s\S]*?primeiros \*\*(\d+) (?:semanas|meses)\*\*/)
    assert(!!m, `Padrão não reconhecido (PA): ${enunciado}`)
    const a1 = Number(m[1])
    const r = Number(m[2])
    const n = Number(m[3])
    const esperado = (n * (2 * a1 + (n - 1) * r)) / 2
    assert(Math.abs(esperado - respostaCerta) < 1e-6, `PA: esperava ${esperado}, achei ${respostaCerta}`)
    return
  }

  throw new Error(`Gerador desconhecido sem verificador: ${archetypeId}`)
}

export function run(): void {
  assert(GERADORES_ENEM_PARAMETRICOS.length === 16, `esperava 16 geradores ENEM, achei ${GERADORES_ENEM_PARAMETRICOS.length}`)

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
