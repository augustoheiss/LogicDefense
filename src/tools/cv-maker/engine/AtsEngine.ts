/**
 * AtsEngine.ts
 * Motor de Auditoria e Validação ATS (Applicant Tracking System) determinístico.
 * Execução 100% no navegador (Client-Side), tempo < 5ms, 0 tokens, 0 requisições externas.
 * 
 * Pilares:
 * 1. Aderência de Palavras-Chave (40%)
 * 2. Fórmula de Impacto Google / IBM X-Y-Z (30%)
 * 3. Parseabilidade Estrutural (15%)
 * 4. Densidade e Orçamento de Leitura (15%)
 */

import type { CVData } from '../types/cv'
import {
  STOPWORDS_PT,
  STOPWORDS_EN,
  ACTION_VERBS_PT,
  ACTION_VERBS_EN,
  ALL_CANONICAL_KEYWORDS
} from './atsKeywords'

export interface XyzAnalysisResult {
  status: 'excellent' | 'partial' | 'weak'
  score: number // 0 to 100
  hasActionVerb: boolean
  actionVerbFound?: string
  hasMetric: boolean
  metricFound?: string
  hasToolOrContext: boolean
  toolFound?: string
  feedback: string
  suggestions: string[]
}

export interface KeywordMatchResult {
  matchedKeywords: string[]
  missingKeywords: string[]
  matchPercentage: number
  allJdKeywords: string[]
  preloadedTechFound: string[]
}

export interface AtsPillarBreakdown {
  keywordsScore: number // 0-100 (peso 40%)
  xyzScore: number      // 0-100 (peso 30%)
  structureScore: number // 0-100 (peso 15%)
  densityScore: number   // 0-100 (peso 15%)
}

export interface AtsAuditReport {
  overallScore: number // 0 to 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D'
  pillars: AtsPillarBreakdown
  keywordAnalysis: KeywordMatchResult
  bulletAnalyses: {
    workIndex: number
    bulletIndex: number
    company: string
    bullet: string
    analysis: XyzAnalysisResult
  }[]
  structureIssues: string[]
  structurePassed: string[]
  densityStats: {
    totalWords: number
    totalBullets: number
    pageEstimate: number
    verdict: 'ideal' | 'too_short' | 'too_long'
    feedback: string
  }
}

// Regexes de Impacto e Métricas
const ALL_ACTION_VERBS = [...ACTION_VERBS_PT, ...ACTION_VERBS_EN]
const ACTION_VERB_REGEX = new RegExp(
  `^\\s*(?:[-•*]\\s*)?(${ALL_ACTION_VERBS.join('|')})\\b`,
  'i'
)

const METRIC_PATTERNS = [
  // Percentuais: 45%, 12.5%
  /\b\d+(?:[.,]\d+)?\s*%/i,
  // Valores monetários: R$ 500k, $1.2M, € 200, 50 mil reais
  /(?:R\$|\$|€|£)\s*\d+(?:[.,]\d+)?(?:\s*(?:k|m|mil|milhões|mi|bilhões|b))?/i,
  // Volumetria técnica e contagens explícitas
  /\b\d+(?:[.,]\d+)?\s*(?:usuários|clientes|microsserviços|serviços|tabelas|linhas|devs|membros|desenvolvedores|projetos|releases|deploys|aplicações|endpoints|requisições|req\/s|rps|tps|transações|pontos|qps|ms|segundos|minutos|horas|dias|semanas|meses|anos|gb|tb|mb|kb|x|vezes)\b/i,
  // Números abreviados: 100k, 2.5M
  /\b\d+(?:[.,]\d+)?\s*(?:k|m|mi)\b/i,
  // Palavras de impacto quantitativo direto
  /\b(?:dobrou|triplicou|quadruplicou|reduziu pela metade|zerou)\b/i,
  // Contagens numéricas puras associadas a equipes ou anos: "equipe de 15", "10 produtos"
  /\b(?:equipe|time|grupo|carteira|frota)\s+de\s+\d+\b/i,
  // Qualquer número com 2 ou mais dígitos isolado
  /\b\d{2,}\b/
]

/**
 * Normaliza e limpa o texto em tokens minúsculos sem pontuações supérfluas
 */
export function tokenizeText(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos para comparação uniforme
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1)
}

/**
 * Extrai N-Grams (unigrams, bigrams, trigrams) de um array de tokens
 */
export function extractNGrams(tokens: string[], n: number = 2): string[] {
  const ngrams: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '))
  }
  return ngrams
}

/**
 * Filtra tokens eliminando stopwords
 */
export function filterStopwords(tokens: string[]): string[] {
  return tokens.filter(t => !STOPWORDS_PT.has(t) && !STOPWORDS_EN.has(t) && t.length > 2)
}

/**
 * Concatena todo o conteúdo textual do currículo em uma única string indexável
 */
export function extractCVFullText(cv: CVData): string {
  const parts: string[] = []

  if (cv.basics) {
    if (cv.basics.name) parts.push(cv.basics.name)
    if (cv.basics.label) parts.push(cv.basics.label)
    if (cv.basics.summary) parts.push(cv.basics.summary)
    if (cv.basics.customBadges) parts.push(cv.basics.customBadges.join(' '))
  }

  if (cv.work) {
    cv.work.forEach(w => {
      if (w.name) parts.push(w.name)
      if (w.company) parts.push(w.company)
      if (w.position) parts.push(w.position)
      if (w.summary) parts.push(w.summary)
      if (w.highlights) parts.push(w.highlights.join(' '))
    })
  }

  if (cv.skills) {
    cv.skills.forEach(s => {
      if (s.name) parts.push(s.name)
      if (s.keywords) parts.push(s.keywords.join(' '))
    })
  }

  if (cv.projects) {
    cv.projects.forEach(p => {
      if (p.name) parts.push(p.name)
      if (p.description) parts.push(p.description)
      if (p.highlights) parts.push(p.highlights.join(' '))
      if (p.keywords) parts.push(p.keywords.join(' '))
    })
  }

  if (cv.education) {
    cv.education.forEach(e => {
      if (e.institution) parts.push(e.institution)
      if (e.area) parts.push(e.area)
      if (e.studyType) parts.push(e.studyType)
    })
  }

  return parts.join(' ')
}

/**
 * Analisa a fórmula de impacto Google / IBM X-Y-Z em um bullet pontual
 */
export function analyzeXYZBullet(bullet: string): XyzAnalysisResult {
  if (!bullet || bullet.trim().length === 0) {
    return {
      status: 'weak',
      score: 0,
      hasActionVerb: false,
      hasMetric: false,
      hasToolOrContext: false,
      feedback: 'Bullet vazio.',
      suggestions: ['Adicione uma conquista começando com verbo de ação e impacto mensurável.']
    }
  }

  const cleanBullet = bullet.trim()
  const lowerBullet = cleanBullet.toLowerCase()

  // 1. Verbo de Ação
  const actionVerbMatch = cleanBullet.match(ACTION_VERB_REGEX)
  const hasActionVerb = Boolean(actionVerbMatch)
  const actionVerbFound = actionVerbMatch ? actionVerbMatch[1] : undefined

  // 2. Métrica Quantificada (Y)
  let hasMetric = false
  let metricFound: string | undefined

  for (const pattern of METRIC_PATTERNS) {
    const match = cleanBullet.match(pattern)
    if (match) {
      hasMetric = true
      metricFound = match[0].trim()
      break
    }
  }

  // 3. Ferramenta ou Contexto Técnico (Z)
  let hasToolOrContext = false
  let toolFound: string | undefined

  for (const tech of ALL_CANONICAL_KEYWORDS) {
    if (lowerBullet.includes(tech)) {
      hasToolOrContext = true
      toolFound = tech
      break
    }
  }

  // Se não encontrou do dicionário, procura por siglas típicas (API, SQL, CI/CD, AWS)
  if (!hasToolOrContext && /\b[A-Z]{2,}\b/.test(cleanBullet)) {
    hasToolOrContext = true
    const match = cleanBullet.match(/\b[A-Z]{2,}\b/)
    toolFound = match ? match[0] : undefined
  }

  // Classificação & Pontuação
  let score = 20
  const suggestions: string[] = []

  if (hasActionVerb) score += 35
  else suggestions.push('Inicie a frase com um verbo de ação no passado (ex: "Desenvolveu", "Otimizou", "Liderou").')

  if (hasMetric) score += 35
  else suggestions.push('Adicione uma métrica de resultado concreta (ex: %, volume de acessos, redução de tempo ou custos).')

  if (hasToolOrContext) score += 10
  else suggestions.push('Mencione a ferramenta ou contexto tecnológico utilizado (ex: "utilizando Docker e Python").')

  let status: 'excellent' | 'partial' | 'weak' = 'weak'
  let feedback = 'Descrição passiva de rotina. Precisa demonstrar o resultado alcançado.'

  if (score >= 80) {
    status = 'excellent'
    feedback = 'Excelente! Conquista quantificada com verbo de ação forte e impacto evidente.'
  } else if (score >= 50) {
    status = 'partial'
    feedback = hasMetric
      ? 'Bom impacto numérico, mas pode começar com verbo de ação mais assertivo.'
      : 'Ação bem formulada, mas falta quantificar o resultado gerado (números, % ou tempo).'
  }

  return {
    status,
    score: Math.min(100, score),
    hasActionVerb,
    actionVerbFound,
    hasMetric,
    metricFound,
    hasToolOrContext,
    toolFound,
    feedback,
    suggestions
  }
}

/**
 * Analisa aderência de palavras-chave entre o CV e a Job Description (ou tech dictionary)
 */
export function analyzeKeywords(cvText: string, jdText?: string): KeywordMatchResult {
  const cvTokens = filterStopwords(tokenizeText(cvText))
  const cvTokenSet = new Set(cvTokens)
  const cvBigrams = new Set(extractNGrams(cvTokens, 2))
  const cvTrigrams = new Set(extractNGrams(cvTokens, 3))

  const lowerCvText = cvText.toLowerCase()

  // Detecta tecnologias pré-carregadas encontradas no CV
  const preloadedTechFound: string[] = []
  for (const tech of ALL_CANONICAL_KEYWORDS) {
    if (lowerCvText.includes(tech.toLowerCase())) {
      preloadedTechFound.push(tech)
    }
  }

  // Se o usuário não informou uma Job Description, avaliamos com base na densidade técnica pré-carregada
  if (!jdText || jdText.trim().length < 20) {
    const idealTechCount = 12
    const matchPercentage = Math.min(100, Math.round((preloadedTechFound.length / idealTechCount) * 100))
    return {
      matchedKeywords: preloadedTechFound.slice(0, 15),
      missingKeywords: [],
      matchPercentage,
      allJdKeywords: [],
      preloadedTechFound
    }
  }

  // Extração de termos relevantes da Job Description
  const jdTokens = filterStopwords(tokenizeText(jdText))
  const jdTokenFreq = new Map<string, number>()

  jdTokens.forEach(t => {
    jdTokenFreq.set(t, (jdTokenFreq.get(t) || 0) + 1)
  })

  // Prioriza termos com maior frequência ou que coincidem com o dicionário de tech
  const uniqueJdTerms = Array.from(new Set(jdTokens))
  const candidateKeywords = uniqueJdTerms.filter(term => {
    const isTech = ALL_CANONICAL_KEYWORDS.some(k => k.includes(term))
    const freq = jdTokenFreq.get(term) || 0
    return isTech || freq >= 2 || term.length >= 4
  })

  // Extrai também bigrams da JD (ex: "machine learning", "cloud architecture")
  const jdBigrams = extractNGrams(tokenizeText(jdText), 2)
  const candidateBigrams = Array.from(new Set(jdBigrams)).filter(b => {
    return ALL_CANONICAL_KEYWORDS.includes(b) || (jdText.toLowerCase().split(b).length - 1) >= 2
  })

  const allTargetKeywords = Array.from(new Set([...candidateBigrams, ...candidateKeywords])).slice(0, 30)

  const matchedKeywords: string[] = []
  const missingKeywords: string[] = []

  allTargetKeywords.forEach(kw => {
    const lowerKw = kw.toLowerCase()
    const matches = lowerCvText.includes(lowerKw) ||
                    cvTokenSet.has(lowerKw) ||
                    cvBigrams.has(lowerKw) ||
                    cvTrigrams.has(lowerKw)

    if (matches) {
      matchedKeywords.push(kw)
    } else {
      missingKeywords.push(kw)
    }
  })

  const matchPercentage = allTargetKeywords.length > 0
    ? Math.min(100, Math.round((matchedKeywords.length / allTargetKeywords.length) * 100))
    : 100

  return {
    matchedKeywords,
    missingKeywords,
    matchPercentage,
    allJdKeywords: allTargetKeywords,
    preloadedTechFound
  }
}

/**
 * Audita a parseabilidade estrutural e os padrões de higiene do currículo
 */
export function auditStructure(cv: CVData): { score: number; passed: string[]; issues: string[] } {
  const passed: string[] = []
  const issues: string[] = []

  // 1. Dados Básicos de Contato
  if (cv.basics?.name && cv.basics.name.trim().length > 2) {
    passed.push('Nome completo do candidato identificado com clareza.')
  } else {
    issues.push('Nome do candidato ausente ou incompleto.')
  }

  if (cv.basics?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.basics.email.trim())) {
    passed.push('E-mail em formato padrão e parseável por robôs ATS.')
  } else {
    issues.push('E-mail de contato ausente ou em formato inválido.')
  }

  if (cv.basics?.phone && cv.basics.phone.trim().length >= 8) {
    passed.push('Telefone de contato identificado.')
  } else {
    issues.push('Telefone de contato ausente.')
  }

  if (cv.basics?.summary && cv.basics.summary.trim().length >= 50) {
    passed.push('Resumo profissional presente e informativo.')
  } else {
    issues.push('Resumo executivo muito curto ou ausente (recomendado 2 a 4 linhas).')
  }

  // 2. Experiência Profissional
  if (cv.work && cv.work.length > 0) {
    passed.push(`Histórico profissional com ${cv.work.length} posição(ões) registrada(s).`)

    const hasValidDates = cv.work.every(w => Boolean(w.startDate))
    if (hasValidDates) {
      passed.push('Todas as experiências possuem data de início estruturada.')
    } else {
      issues.push('Algumas experiências profissionais não informam data de início.')
    }

    const hasHighlights = cv.work.some(w => w.highlights && w.highlights.length > 0)
    if (hasHighlights) {
      passed.push('Conquistas e responsabilidades descritas em tópicos/bullets.')
    } else {
      issues.push('Nenhuma experiência possui tópicos (highlights) estruturados.')
    }
  } else {
    issues.push('Seção de experiência profissional ausente.')
  }

  // 3. Competências & Educação
  if (cv.skills && cv.skills.length > 0) {
    passed.push('Seção de competências técnicas catalogada.')
  } else {
    issues.push('Seção de competências técnicas não declarada.')
  }

  if (cv.education && cv.education.length > 0) {
    passed.push('Seção de formação acadêmica presente.')
  } else {
    issues.push('Formação acadêmica ausente.')
  }

  // Cálculo da nota estrutural (0 a 100)
  const totalChecks = passed.length + issues.length
  const score = totalChecks > 0 ? Math.round((passed.length / totalChecks) * 100) : 50

  return { score, passed, issues }
}

/**
 * Analisa a densidade de palavras e volume de leitura
 */
export function auditDensity(cv: CVData, cvFullText: string): {
  score: number
  totalWords: number
  totalBullets: number
  pageEstimate: number
  verdict: 'ideal' | 'too_short' | 'too_long'
  feedback: string
} {
  const words = cvFullText.trim().split(/\s+/).filter(Boolean)
  const totalWords = words.length

  let totalBullets = 0
  if (cv.work) {
    cv.work.forEach(w => {
      totalBullets += (w.highlights?.length || 0)
    })
  }

  // Estimativa de páginas com base no volume A4 típico (350 a 600 palavras por página)
  const pageEstimate = totalWords <= 550 ? 1 : totalWords <= 1100 ? 2 : 3

  let score = 100
  let verdict: 'ideal' | 'too_short' | 'too_long' = 'ideal'
  let feedback = 'Orçamento de leitura equilibrado e perfeito para triagem de recrutador.'

  if (totalWords < 200) {
    score = 45
    verdict = 'too_short'
    feedback = 'Currículo excessivamente conciso. Pode ser descartado por falta de densidade de informações.'
  } else if (totalWords < 320) {
    score = 75
    verdict = 'too_short'
    feedback = 'Conteúdo um pouco enxuto. Adicione mais detalhes quantitativos nas experiências.'
  } else if (totalWords > 1200) {
    score = 65
    verdict = 'too_long'
    feedback = 'Currículo muito longo. Recrutadores gastam 6 segundos na triagem inicial; considere resumir.'
  }

  return {
    score,
    totalWords,
    totalBullets,
    pageEstimate,
    verdict,
    feedback
  }
}

/**
 * Função Mestre: Executa a auditoria completa de ATS e retorna o relatório estruturado
 */
export function calculateAtsReport(cv: CVData | null, jdText?: string): AtsAuditReport {
  if (!cv) {
    return {
      overallScore: 0,
      grade: 'D',
      pillars: { keywordsScore: 0, xyzScore: 0, structureScore: 0, densityScore: 0 },
      keywordAnalysis: { matchedKeywords: [], missingKeywords: [], matchPercentage: 0, allJdKeywords: [], preloadedTechFound: [] },
      bulletAnalyses: [],
      structureIssues: ['Carregue ou digite os dados do currículo no editor para iniciar a auditoria.'],
      structurePassed: [],
      densityStats: { totalWords: 0, totalBullets: 0, pageEstimate: 1, verdict: 'too_short', feedback: 'Sem dados.' }
    }
  }

  const cvFullText = extractCVFullText(cv)

  // 1. Pilar Keywords (40%)
  const keywordAnalysis = analyzeKeywords(cvFullText, jdText)
  const keywordsScore = keywordAnalysis.matchPercentage

  // 2. Pilar X-Y-Z (30%)
  const bulletAnalyses: AtsAuditReport['bulletAnalyses'] = []
  let totalBulletScore = 0

  if (cv.work) {
    cv.work.forEach((w, workIdx) => {
      if (w.highlights) {
        w.highlights.forEach((bullet, bIdx) => {
          const analysis = analyzeXYZBullet(bullet)
          totalBulletScore += analysis.score
          bulletAnalyses.push({
            workIndex: workIdx,
            bulletIndex: bIdx,
            company: w.company || w.name || 'Empresa',
            bullet,
            analysis
          })
        })
      }
    })
  }

  const xyzScore = bulletAnalyses.length > 0
    ? Math.round(totalBulletScore / bulletAnalyses.length)
    : 50 // pontuação neutra se não houver bullets ainda

  // 3. Pilar Estrutura (15%)
  const structureResult = auditStructure(cv)
  const structureScore = structureResult.score

  // 4. Pilar Densidade (15%)
  const densityResult = auditDensity(cv, cvFullText)
  const densityScore = densityResult.score

  // Pontuação Agregada Ponderada:
  // Keywords (40%) + XYZ (30%) + Estrutura (15%) + Densidade (15%)
  const overallScore = Math.round(
    (keywordsScore * 0.40) +
    (xyzScore * 0.30) +
    (structureScore * 0.15) +
    (densityScore * 0.15)
  )

  // Atribuição de Nota Executiva
  let grade: AtsAuditReport['grade'] = 'D'
  if (overallScore >= 90) grade = 'A+'
  else if (overallScore >= 80) grade = 'A'
  else if (overallScore >= 68) grade = 'B'
  else if (overallScore >= 50) grade = 'C'

  return {
    overallScore,
    grade,
    pillars: {
      keywordsScore,
      xyzScore,
      structureScore,
      densityScore
    },
    keywordAnalysis,
    bulletAnalyses,
    structureIssues: structureResult.issues,
    structurePassed: structureResult.passed,
    densityStats: {
      totalWords: densityResult.totalWords,
      totalBullets: densityResult.totalBullets,
      pageEstimate: densityResult.pageEstimate,
      verdict: densityResult.verdict,
      feedback: densityResult.feedback
    }
  }
}
