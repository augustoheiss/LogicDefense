/**
 * UniversalASTNormalizer.ts
 *
 * Normalizador Universal de Árvore de Sintaxe Abstrata (AST)
 * do Universal Document Compiler.
 *
 * Transforma qualquer payload arbitrário YAML/JSON em uma UniversalDocumentAST
 * tipada e determinística, preservando a identidade semântica de cada nó e
 * integrando os arquétipos classificados com o sistema de overrides do usuário.
 *
 * Mantém compatibilidade total de retrocesso com os 10 modelos existentes de CVData.
 */

import { classifyNode } from './DataShapeClassifier'
import type {
  LayoutArchetype,
  SemanticPathPointer,
  UniversalBlockNode,
  UniversalDocumentAST,
  UniversalDocumentMeta,
  UniversalItemNode,
} from '../types/universalAST'

// Mapeamento padrão de rótulos amigáveis para chaves conhecidas
const CANONICAL_SECTION_LABELS: Record<string, string> = {
  basics: 'Informações Pessoais',
  work: 'Experiência Profissional',
  education: 'Formação Acadêmica',
  projects: 'Projetos de Destaque',
  skills: 'Habilidades & Competências',
  languages: 'Idiomas',
  certificates: 'Certificações & Cursos',
  awards: 'Prêmios & Reconhecimentos',
  publications: 'Publicações & Artigos',
  volunteer: 'Trabalho Voluntário',
  interests: 'Interesses & Causas',
  kpis: 'Métricas & Resultados-Chave',
  patents: 'Patentes & Propriedade Intelectual',
  proposta: 'Escopo & Proposta Técnica',
  termos: 'Termos & Condições',
  diagnosticos: 'Diagnósticos & Histórico Clínico',
}

/**
 * Converte uma chave snake_case ou camelCase em um título legível
 */
export function formatSectionTitle(key: string): string {
  const lower = key.toLowerCase()
  if (CANONICAL_SECTION_LABELS[lower]) {
    return CANONICAL_SECTION_LABELS[lower]
  }

  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/**
 * Normaliza qualquer objeto arbitrário do YAML em uma UniversalDocumentAST
 *
 * @param raw       - O objeto puro resultante do parser YAML
 * @param overrides - Dicionário opcional de overrides manuais do usuário por sectionKey
 */
export function normalizeToUniversalAST(
  raw: any,
  overrides: Record<string, LayoutArchetype> = {}
): UniversalDocumentAST {
  const safeRaw = raw && typeof raw === 'object' ? raw : {}
  const hasBasics = Boolean(safeRaw.basics && typeof safeRaw.basics === 'object' && safeRaw.basics.name)
  const hasWorkOrEdu = Boolean(
    (Array.isArray(safeRaw.work) && safeRaw.work.length > 0) ||
    (Array.isArray(safeRaw.education) && safeRaw.education.length > 0)
  )

  const STANDARD_RESUME_KEYS = new Set([
    'basics', 'work', 'education', 'skills', 'projects', 'languages',
    'certificates', 'interests', 'publications', 'volunteer', 'awards',
    'references', 'coverLetter', 'meta', '$schema', '_schema', '_layoutManifest',
    'themeConfig', 'designConfig', 'photo', 'summary', 'resumo'
  ])

  // Detecta se o YAML possui quaisquer chaves customizadas/arbitrárias de outros domínios
  const hasNonStandardKeys = Object.keys(safeRaw).some(
    (k) => !STANDARD_RESUME_KEYS.has(k) && safeRaw[k] !== undefined && safeRaw[k] !== null
  )

  const isUniversalDoc = Boolean(
    safeRaw.meta?.isUniversalDocument !== undefined
      ? safeRaw.meta.isUniversalDocument
      : (
          safeRaw.isUniversalDocument ||
          safeRaw.document_title ||
          safeRaw.document_type ||
          hasNonStandardKeys ||
          !hasBasics ||
          !hasWorkOrEdu
        )
  )

  const meta: UniversalDocumentMeta = {
    title: safeRaw.title || safeRaw.document_title || safeRaw.basics?.name || 'Documento Universal',
    author: safeRaw.author || safeRaw.basics?.name || undefined,
    lastModified: safeRaw.meta?.lastModified || new Date().toISOString(),
    version: '3.0.0',
    language: safeRaw.meta?.language || 'pt',
    theme: safeRaw.meta?.theme || 'executive',
    formatId: safeRaw.meta?.formatId || 'a4',
    isUniversalDocument: isUniversalDoc,
    hasBasicsPreset: hasBasics,
  }

  const blocks: UniversalBlockNode[] = []

  // Filtra chaves reservadas de metadados para não poluir os blocos visuais
  const reservedKeys = new Set(['meta', '$schema', '_schema', '_layoutManifest', 'themeConfig', 'designConfig'])

  for (const [key, value] of Object.entries(safeRaw)) {
    if (reservedKeys.has(key) || value === undefined || value === null) {
      continue
    }

    const sectionTitle = formatSectionTitle(key)
    const userOverride = overrides[key]
    const classification = classifyNode(key, value, userOverride)

    const blockPointer: SemanticPathPointer = {
      rawPath: `/${key}`,
      semanticPath: `/[section='${key}']`,
      sectionKey: key,
    }

    const items = normalizeItemsForBlock(key, value, classification.effective)

    blocks.push({
      id: `block-${key}`,
      key,
      title: sectionTitle,
      pointer: blockPointer,
      classification,
      items,
      raw: value,
    })
  }

  return {
    meta,
    blocks,
    rawSource: safeRaw,
  }
}

/**
 * Normaliza os itens internos de um bloco de acordo com o valor e o arquétipo
 */
function normalizeItemsForBlock(
  sectionKey: string,
  value: any,
  _archetype: LayoutArchetype
): UniversalItemNode[] {
  // 1. Caso valor seja um array
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      // 1.1 Array de strings primitivas (ex: badges, ingredientes simples, termos)
      if (typeof item === 'string' || typeof item === 'number') {
        const strVal = String(item).trim()
        return {
          id: `${sectionKey}-${index}`,
          pointer: {
            rawPath: `/${sectionKey}/${index}`,
            semanticPath: `/${sectionKey}/[item='${strVal}']`,
            sectionKey,
            itemKey: strVal,
          },
          title: strVal,
          badges: [strVal],
          raw: item,
        }
      }

      // 1.2 Array de objetos (médicos, receitas, legais, comerciais, TI, etc.)
      if (item && typeof item === 'object') {
        // Heurística Polimórfica: Título do Item (Cor Primária)
        const explicitTitle =
          item.name ||
          item.title ||
          item.titulo ||
          item.nome ||
          item.medicamento ||
          item.remedio ||
          item.droga ||
          item.exame ||
          item.procedimento ||
          item.ingrediente ||
          item.prato ||
          item.alimento ||
          item.clausula ||
          item.artigo ||
          item.termo ||
          item.foro ||
          item.produto ||
          item.servico ||
          item.item ||
          item.peca ||
          item.etapa ||
          item.passo ||
          item.fase ||
          item.tarefa ||
          item.atividade ||
          item.milestone ||
          item.cargo ||
          item.position ||
          item.role ||
          item.roleTitle ||
          item.company ||
          item.empresa ||
          item.instituicao ||
          item.institution ||
          item.topico ||
          item.assunto ||
          item.categoria ||
          item.pilar ||
          item.label

        // Se não houver campo explícito, encontra a 1ª propriedade do tipo string válida
        const firstStringProp = !explicitTitle
          ? Object.entries(item).find(
              ([k, v]) =>
                typeof v === 'string' &&
                v.trim().length > 0 &&
                k !== 'id' &&
                k !== 'date' &&
                k !== 'data' &&
                k !== 'period' &&
                k !== 'periodo'
            )?.[1]
          : undefined

        const title = explicitTitle || firstStringProp || `Item ${index + 1}`

        // Heurística Polimórfica: Subtítulo do Item (Cor Secundária)
        const explicitSubtitle =
          item.subtitle ||
          item.subtitulo ||
          item.posologia ||
          item.dose ||
          item.dosagem ||
          item.frequencia ||
          item.via ||
          item.quantidade ||
          item.porcao ||
          item.medida ||
          item.tempo_preparo ||
          item.temperatura ||
          item.preco ||
          item.valor ||
          item.custo ||
          item.taxa ||
          item.total ||
          item.objeto ||
          item.partes ||
          item.prazo ||
          item.vigencia ||
          item.company ||
          item.empresa ||
          item.organization ||
          item.area ||
          item.institution ||
          item.instituicao ||
          item.studyType ||
          item.awarder ||
          item.issuer ||
          item.department ||
          item.departamento ||
          item.responsavel ||
          item.autor ||
          item.status ||
          item.prioridade

        // Se não houver campo explícito de subtítulo, busca uma 2ª propriedade de string curta
        const secondStringProp = !explicitSubtitle
          ? Object.entries(item).find(
              ([k, v]) =>
                typeof v === 'string' &&
                v.trim().length > 0 &&
                v !== title &&
                v.length <= 120 &&
                k !== 'id' &&
                k !== 'date' &&
                k !== 'data' &&
                k !== 'period' &&
                k !== 'periodo' &&
                k !== 'summary' &&
                k !== 'description'
            )?.[1]
          : undefined

        const subtitle = explicitSubtitle || secondStringProp || undefined

        // Datas e Períodos
        const date =
          item.date ||
          item.data ||
          item.ano ||
          item.year ||
          item.releaseDate ||
          item.periodo ||
          item.validade ||
          undefined

        const period =
          item.startDate || item.endDate || item.inicio || item.fim
            ? {
                start: item.startDate || item.inicio,
                end: item.endDate || item.fim,
                current:
                  !item.endDate && !item.fim
                    ? true
                    : /presente|current|atual/i.test(String(item.endDate || item.fim)),
              }
            : undefined

        // Extração de badges (habilidades, tags, categorias, tecnologias)
        let badges: string[] = []
        if (Array.isArray(item.keywords)) badges = badges.concat(item.keywords)
        if (Array.isArray(item.skills)) badges = badges.concat(item.skills)
        if (Array.isArray(item.highlights)) badges = badges.concat(item.highlights)
        if (Array.isArray(item.tags)) badges = badges.concat(item.tags)
        if (Array.isArray(item.tecnologias)) badges = badges.concat(item.tecnologias)
        if (Array.isArray(item.categorias)) badges = badges.concat(item.categorias)
        if (Array.isArray(item.ingredientes)) badges = badges.concat(item.ingredientes)

        // Extração de texto/prosa
        const prose =
          item.summary ||
          item.description ||
          item.detalhes ||
          item.texto ||
          item.text ||
          item.instrucoes ||
          item.preparo ||
          item.modo_preparo ||
          item.laudo ||
          item.observacoes ||
          item.parecer ||
          item.notes ||
          item.notas ||
          undefined

        // Extração de pares chave/valor associativos
        const keyValues: Record<string, any> = {}
        for (const [k, v] of Object.entries(item)) {
          if (
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean'
          ) {
            keyValues[k] = v
          }
        }

        const stableKey = String(title).slice(0, 30).replace(/['"]/g, '')

        return {
          id: `${sectionKey}-${index}`,
          pointer: {
            rawPath: `/${sectionKey}/${index}`,
            semanticPath: `/${sectionKey}/[id='${stableKey}']`,
            sectionKey,
            itemKey: stableKey,
          },
          title,
          subtitle,
          date,
          period,
          badges: badges.length > 0 ? badges : undefined,
          keyValues: Object.keys(keyValues).length > 0 ? keyValues : undefined,
          prose,
          raw: item,
        }
      }

      // Fallback para qualquer outro tipo
      return {
        id: `${sectionKey}-${index}`,
        pointer: {
          rawPath: `/${sectionKey}/${index}`,
          semanticPath: `/${sectionKey}/[index='${index}']`,
          sectionKey,
        },
        title: String(item),
        raw: item,
      }
    })
  }

  // 2. Caso valor seja um objeto único
  if (value && typeof value === 'object') {
    const keyValues: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        keyValues[k] = v
      }
    }

    return [
      {
        id: `${sectionKey}-single`,
        pointer: {
          rawPath: `/${sectionKey}`,
          semanticPath: `/[section='${sectionKey}']`,
          sectionKey,
        },
        title: formatSectionTitle(sectionKey),
        keyValues: Object.keys(keyValues).length > 0 ? keyValues : undefined,
        raw: value,
      },
    ]
  }

  // 3. Caso valor seja escalar simples (string, número)
  const str = String(value || '')
  return [
    {
      id: `${sectionKey}-scalar`,
      pointer: {
        rawPath: `/${sectionKey}`,
        semanticPath: `/[section='${sectionKey}']`,
        sectionKey,
      },
      title: formatSectionTitle(sectionKey),
      prose: str,
      raw: value,
    },
  ]
}
