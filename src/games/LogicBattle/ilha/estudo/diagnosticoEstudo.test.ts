import { gerarDiagnosticoEstudo } from './diagnosticoEstudo'
import { aplicarEventoNoEstado, estadoEstudoVazio } from './repositorioEstudo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  let st = estadoEstudoVazio()

  // Tema A: erros pensados + abandono -> risco alto em "unidade_escala"
  st = aplicarEventoNoEstado(st, {
    tipo: 'erro_alternativa',
    quando: 1000,
    itemId: 'item_a1',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    alternativaId: 'A',
    tagErro: 'unidade_escala',
    tempoDesdeAberturaMs: 9000,
  })
  st = aplicarEventoNoEstado(st, {
    tipo: 'erro_alternativa',
    quando: 2000,
    itemId: 'item_a1',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    alternativaId: 'B',
    tagErro: 'unidade_escala',
    tempoDesdeAberturaMs: 8500,
  })
  st = aplicarEventoNoEstado(st, {
    tipo: 'abandono',
    quando: 3000,
    itemId: 'item_a2',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    errosAntesDeFechar: 1,
    maiorDicaUsada: 1,
    tempoAbertoMs: 6000,
  })

  // Tema B: 3 acertos de primeira (não pode aparecer como tema crítico!)
  for (let i = 0; i < 3; i++) {
    st = aplicarEventoNoEstado(st, {
      tipo: 'acerto',
      quando: 4000 + i * 1000,
      itemId: `item_b${i}`,
      assinatura: `item_b${i}`,
      origem: 'motor_parametrico',
      temaId: 'ponto_de_virada',
      grau: 1,
      errosNaConta: 0,
      maiorDicaUsada: 0,
      tempoTotalMs: 5000,
      fatorBuff: 1,
    })
  }

  // Tema C: apenas 1 erro rápido (< 1.5 s) -> entra com amostra 0 de tentativas, mas chute_rapido em atencao
  st = aplicarEventoNoEstado(st, {
    tipo: 'erro_alternativa',
    quando: 8000,
    itemId: 'item_c1',
    origem: 'motor_parametrico',
    temaId: 'assimetria_porcentagem',
    grau: 2,
    alternativaId: 'c2',
    tagErro: 'porcentagem_base',
    tempoDesdeAberturaMs: 400,
  })

  const diag = gerarDiagnosticoEstudo(st)
  assert(diag.ondePrecisaAjuda.length === 1, `esperava só 1 tema crítico (escalas), achei ${diag.ondePrecisaAjuda.length}`)
  assert(diag.ondePrecisaAjuda[0].temaId === 'enem_razoes_escalas', 'tema mais fraco devia ser enem_razoes_escalas')
  assert(
    !diag.ondePrecisaAjuda.some((p) => p.temaId === 'ponto_de_virada'),
    'tema dominado de primeira não pode aparecer em Onde precisa mais de ajuda',
  )
  assert(diag.emQuePrestarAtencao[0].tagErro === 'unidade_escala', 'alerta principal devia ser unidade_escala')
  assert(diag.emQuePrestarAtencao[0].ocorrencias === 2, 'esperava 2 ocorrências em unidade_escala')
  assert(diag.resumoGeral.chutesRapidos === 1, 'chute rápido não contabilizado no resumoGeral')
  assert(diag.resumoGeral.dePrimeiraPct === 100, `3 acertos de primeira devia dar 100%, veio ${diag.resumoGeral.dePrimeiraPct}`)
}
