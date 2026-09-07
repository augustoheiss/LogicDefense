/**
 * verify_ats_math.js
 * Script de validação matemática e de casos de borda do motor ATS determinístico.
 */

const ALL_ACTION_VERBS = [
  'arquitetou', 'desenvolveu', 'liderou', 'implementou', 'otimizou', 'reduziu', 'aumentou',
  'automatizou', 'migrou', 'entregou', 'projetou', 'gerenciou', 'coordenou', 'construiu',
  'estruturou', 'escalou', 'padronizou', 'reestruturou', 'acelerou', 'consolidou', 'orquestrou',
  'architected', 'developed', 'led', 'implemented', 'optimized', 'reduced', 'increased',
  'automated', 'migrated', 'delivered', 'designed', 'managed', 'coordinated', 'built'
]

const ACTION_VERB_REGEX = new RegExp(
  `^\\s*(?:[-•*]\\s*)?(${ALL_ACTION_VERBS.join('|')})\\b`,
  'i'
)

const METRIC_PATTERNS = [
  /\b\d+(?:[.,]\d+)?\s*%/i,
  /(?:R\$|\$|€|£)\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|mil|milhões|mi|bilhões|b))?/i,
  /\b\d+(?:[.,]\d+)?\s*(?:usuários|clientes|microsserviços|serviços|tabelas|linhas|devs|membros|desenvolvedores|projetos|releases|deploys|aplicações|endpoints|requisições|req\/s|rps|tps|transações|pontos|qps|ms|segundos|minutos|horas|dias|semanas|meses|anos|gb|tb|mb|kb|x|vezes)\b/i,
  /\b\d+(?:[.,]\d+)?\s*(?:k|m|mi)\b/i,
  /\b(?:dobrou|triplicou|quadruplicou|reduziu pela metade|zerou)\b/i,
  /\b(?:equipe|time|grupo|carteira|frota)\s+de\s+\d+\b/i,
  /\b\d{2,}\b/
]

function testBullet(bullet) {
  const hasVerb = ACTION_VERB_REGEX.test(bullet)
  const hasMetric = METRIC_PATTERNS.some(p => p.test(bullet))
  let score = 20
  if (hasVerb) score += 35
  if (hasMetric) score += 35
  const hasContext = /\b(Docker|AWS|React|Python|API|PostgreSQL|CI\/CD|Kubernetes)\b/i.test(bullet)
  if (hasContext) score += 10
  
  let status = 'weak'
  if (score >= 80) status = 'excellent'
  else if (score >= 50) status = 'partial'
  
  return { score, status, hasVerb, hasMetric, hasContext }
}

const tests = [
  {
    bullet: "Arquitetou pipeline distribuído reduzindo o tempo de compilação em 42% com Docker e AWS.",
    expectedStatus: "excellent"
  },
  {
    bullet: "Liderou equipe técnica de 12 desenvolvedores no desenvolvimento da nova API.",
    expectedStatus: "excellent"
  },
  {
    bullet: "Desenvolveu novos componentes em React sem acompanhamento.",
    expectedStatus: "partial" // tem verbo e ferramenta, mas sem números/métrica
  },
  {
    bullet: "Responsável por reuniões diárias e dar suporte ao time.",
    expectedStatus: "weak" // passivo, sem verbo de ação forte, sem métrica
  }
]

console.log("--- TESTE DE CASOS DE BORDA DO CLASSIFICADOR X-Y-Z ---")
let allPassed = true

tests.forEach((t, i) => {
  const res = testBullet(t.bullet)
  const passed = res.status === t.expectedStatus
  console.log(`[Caso ${i + 1}] "${t.bullet}"`)
  console.log(`  -> Status: ${res.status} (Score: ${res.score}%) | Esperado: ${t.expectedStatus} -> ${passed ? '✅ PASSOU' : '❌ FALHOU'}`)
  if (!passed) allPassed = false
})

if (allPassed) {
  console.log("\n✅ Todos os testes de asserção matemática X-Y-Z passaram com sucesso!")
  process.exit(0)
} else {
  console.error("\n❌ Falha em asserções matemáticas!")
  process.exit(1)
}
