import { listarArquetipos, sintetizarArquetipo } from '../infiniteMathEngine'
import { adaptarDesafioMotor, type DesafioUnificado } from './contratosEstudo'
import { validarDesafioZeroSpoiler, valorIsoladoNoTexto } from './validadorDicas'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const SEMENTES = 2000

export function run(extras: readonly DesafioUnificado[] = []): void {
  // 1. Controles positivos e negativos obrigatórios do instrumento (sem isso, 0 vazamentos não prova nada)
  assert(valorIsoladoNoTexto('1460', 'o resultado dá 1460 anos'), 'controle: não detectou 1460')
  assert(valorIsoladoNoTexto('1.460', 'chega em 1.460 anos'), 'controle: não detectou 1.460')
  assert(!valorIsoladoNoTexto('27', 'use 127 e 270'), 'controle: falso positivo em 127/270')

  const desafioComSpoilerValor: DesafioUnificado = {
    id: 'ctrl-1',
    assinatura: 'ctrl-1',
    origem: 'enem_oficial',
    grau: 5,
    temaId: 'enem_aritmetica_ciclos',
    temaTituloPt: 'Teste',
    arquetipoOuItemId: 'ctrl',
    enunciadoMarkdown: 'Qual é o valor de x?',
    alternativas: [
      { id: 'a', letra: 'A', rotulo: '10', valorNumerico: 10, correta: false, diagnosticoPt: 'Muito baixo.' },
      { id: 'b', letra: 'B', rotulo: '1.460', valorNumerico: 1460, correta: true, diagnosticoPt: 'Certo!' },
      { id: 'c', letra: 'C', rotulo: '20', valorNumerico: 20, correta: false, diagnosticoPt: 'Errado.' },
      { id: 'd', letra: 'D', rotulo: '30', valorNumerico: 30, correta: false, diagnosticoPt: 'Errado.' },
      { id: 'e', letra: 'E', rotulo: '40', valorNumerico: 40, correta: false, diagnosticoPt: 'Errado.' },
    ],
    altarFisicoCompativel: false,
    dicas: [
      { nivel: 1, titulo: 'Foco', textoPt: 'Multiplique as etapas.' },
      { nivel: 2, titulo: 'Estratégia', textoPt: 'O total é 1.460 direto!' },
      { nivel: 3, titulo: 'Passo', textoPt: 'Não caia na pegadinha.' },
    ],
    posAcerto: { solucaoCompletaPt: '1.460', metodos: [], dicaVidaRealPt: 'x' },
  }
  const resSpoilerValor = validarDesafioZeroSpoiler(desafioComSpoilerValor)
  assert(!resSpoilerValor.ok && resSpoilerValor.violacoes.some((v) => v.includes('dica[2]')), 'controle positivo falhou: não pegou 1.460 na dica[2]')

  const desafioComSpoilerLetra: DesafioUnificado = {
    ...desafioComSpoilerValor,
    dicas: [
      { nivel: 1, titulo: 'Foco', textoPt: 'Leia com atenção.' },
      { nivel: 2, titulo: 'Estratégia', textoPt: 'Simplifique antes.' },
      { nivel: 3, titulo: 'Passo', textoPt: 'Marque a letra B sem medo!' },
    ],
  }
  const resSpoilerLetra = validarDesafioZeroSpoiler(desafioComSpoilerLetra)
  assert(!resSpoilerLetra.ok && resSpoilerLetra.violacoes.some((v) => v.includes('letra correta')), 'controle positivo falhou: não pegou menção à letra B')

  // 2. Varre 26 arquétipos × 2.000 sementes = 52.000 desafios adaptados
  const arquetipos = listarArquetipos()
  assert(arquetipos.length === 26, `Esperava 26 arquétipos, achei ${arquetipos.length}`)

  const violacoes: string[] = []
  let testados = 0
  for (const arq of arquetipos) {
    for (let s = 1; s <= SEMENTES; s++) {
      const bruto = sintetizarArquetipo(arq.archetypeId, s * 7919 + 13)
      const desafio = adaptarDesafioMotor({
        ...bruto,
        id: `t_${arq.archetypeId}_${s}`,
        signature: `sig_${arq.archetypeId}_${s}`,
        archetypeId: arq.archetypeId,
        tier: arq.tier,
        lensTitlePt: arq.archetypeId,
        conceptId: 'ponto_de_virada',
        codexSlug: 'x',
      })
      testados++
      const r = validarDesafioZeroSpoiler(desafio)
      if (!r.ok && violacoes.length < 10) {
        violacoes.push(`${arq.archetypeId} (seed=${s}): ${r.violacoes.join(' | ')}`)
      }
    }
  }
  assert(testados === 26 * SEMENTES, `Esperava ${26 * SEMENTES} desafios, testei ${testados}`)
  assert(violacoes.length === 0, `Vazamento detectado nas dicas/diagnósticos do motor:\n  ${violacoes.join('\n  ')}`)

  // 3. Valida extras (questões ENEM e motores Q4)
  for (const item of extras) {
    const r = validarDesafioZeroSpoiler(item)
    assert(r.ok, `Spoiler ou erro estrutural em ${item.arquetipoOuItemId}: ${r.violacoes.join(' | ')}`)
  }
}
