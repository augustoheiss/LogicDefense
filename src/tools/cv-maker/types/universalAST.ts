/**
 * universalAST.ts
 *
 * Definições canônicas da Árvore de Sintaxe Abstrata (AST) Universal de Documentos
 * para o Universal Document Compiler do CV Maker / LogicDefense.
 *
 * Desacopla a ingestão do YAML de esquemas rígidos (JSON Resume), permitindo a
 * compilação e renderização vetorial determinística de qualquer árvore de dados
 * (currículos, propostas, fichas técnicas, faturas, relatórios) em qualquer
 * superfície geométrica euclidiana (A4, A3, A5, Letter, Custom).
 */

/**
 * Os 5 Arquétipos Canônicos Universais de Layout
 */
export type LayoutArchetype =
  | 'card_grid'        // Mapeamentos homogêneos em cartões/blocos modulares
  | 'timeline'         // Sequência cronológica com âncoras temporais (datas/períodos)
  | 'badge_list'       // Coleção compacta de termos curtos/tags em pílulas
  | 'key_value_table'  // Pares associativos de dados tabulares (especificações/métricas)
  | 'prose_flow'       // Texto corrido contínuo ou múltiplos parágrafos/Markdown

export interface ArchetypeDefinition {
  id: LayoutArchetype
  label: string
  icon: string
  description: string
  bestFor: string
}

export const ALL_CANONICAL_ARCHETYPES: LayoutArchetype[] = [
  'card_grid',
  'timeline',
  'badge_list',
  'key_value_table',
  'prose_flow',
]

export const ARCHETYPE_DEFINITIONS: Record<LayoutArchetype, ArchetypeDefinition> = {
  card_grid: {
    id: 'card_grid',
    label: 'Grade de Cartões',
    icon: '📇',
    description: 'Cartões estruturados com título, subtítulo, descrição e badges.',
    bestFor: 'Projetos, serviços, portfólio, produtos, ativos.',
  },
  timeline: {
    id: 'timeline',
    label: 'Linha do Tempo',
    icon: '⏳',
    description: 'Sequência cronológica com marcadores de tempo, cargos e marcos.',
    bestFor: 'Experiência profissional, formação acadêmica, histórico, roadmap.',
  },
  badge_list: {
    id: 'badge_list',
    label: 'Lista de Badges / Tags',
    icon: '🏷️',
    description: 'Pílulas horizontais compactas agrupadas para leitura visual rápida.',
    bestFor: 'Competências, tecnologias, ferramentas, palavras-chave, interesses.',
  },
  key_value_table: {
    id: 'key_value_table',
    label: 'Tabela Chave-Valor',
    icon: '📋',
    description: 'Pares associativos alinhados em duas colunas ou grade métrica.',
    bestFor: 'Especificações técnicas, KPIs, metadados, parâmetros, balanços.',
  },
  prose_flow: {
    id: 'prose_flow',
    label: 'Fluxo de Prosa / Editorial',
    icon: '📜',
    description: 'Parágrafos narrativos contínuos com controle tipográfico estrito.',
    bestFor: 'Resumo profissional, carta de apresentação, escopo, termos, diagnósticos.',
  },
}

/**
 * Ponteiro Semântico Estabilizado por Identidade
 * Garante que overrides visuais permaneçam ancorados ao item mesmo após reordenações.
 */
export interface SemanticPathPointer {
  rawPath: string        // ex: "/work/0" ou "/especificacoes/peso"
  semanticPath: string   // ex: "/work/[name='Acme Corp']" ou "/secao/[key='kpi']"
  sectionKey: string     // ex: "work" ou "especificacoes"
  itemKey?: string       // ex: "name" ou título estável
}

/**
 * Classificação do Arquétipo de Layout (com Soberania Total do Usuário)
 */
export interface ArchetypeClassification {
  inferred: LayoutArchetype                     // Sugestão algorítmica matemática (Jaccard / Léxica)
  userOverride?: LayoutArchetype                // Escolha explícita do usuário (se houver)
  effective: LayoutArchetype                   // userOverride || inferred (o que renderiza de fato)
  confidence: number                            // Grau de confiança da inferência (0.0 a 1.0)
  reason: string                                // Justificativa pedagógica da inferência
  availableArchetypes: LayoutArchetype[]        // Sempre expõe todos os 5 para troca na UI
}

/**
 * Nó Atômico de Conteúdo dentro de um Bloco
 */
export interface UniversalItemNode {
  id: string
  pointer: SemanticPathPointer
  title?: string
  subtitle?: string
  date?: string
  period?: {
    start?: string
    end?: string
    current?: boolean
  }
  badges?: string[]
  metrics?: Record<string, string | number>
  keyValues?: Record<string, any>
  prose?: string
  raw: any
  cstRange?: [start: number, valueEnd: number, nodeEnd: number]
}

/**
 * Nó de Bloco de Nível Superior (Seção do Documento)
 */
export interface UniversalBlockNode {
  id: string
  key: string
  title: string
  pointer: SemanticPathPointer
  classification: ArchetypeClassification
  items: UniversalItemNode[]
  raw: any
  cstRange?: [start: number, valueEnd: number, nodeEnd: number]
}

/**
 * Metadados Globais do Documento Universal
 */
export interface UniversalDocumentMeta {
  title?: string
  author?: string
  lastModified?: string
  version: string
  language?: string
  theme?: string
  formatId?: string
  isUniversalDocument: boolean
  hasBasicsPreset: boolean
  warnings?: string[]
}

/**
 * Árvore de Sintaxe Abstrata Universal (AST Completa)
 */
export interface UniversalDocumentAST {
  meta: UniversalDocumentMeta
  blocks: UniversalBlockNode[]
  rawSource: any
}
