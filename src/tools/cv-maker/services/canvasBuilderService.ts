import type { BlockIdentifier, CanvasBlockConfig, CanvasPreset } from '../types/cv'

const STORAGE_CANVAS_BLOCKS_KEY = 'cv_maker_canvas_blocks_v1'

export interface PaletteItemDef {
  type: BlockIdentifier
  label: string
  icon: string
  description: string
  category: 'identity' | 'content' | 'skills' | 'academic' | 'extras'
  defaultColSpan: 3 | 4 | 6 | 8 | 12
  defaultTitle?: string
}

export const AVAILABLE_PALETTE_ITEMS: PaletteItemDef[] = [
  {
    type: 'header',
    label: 'Nome & Título Profissional',
    icon: '👤',
    description: 'Nome completo, cargo/especialidade e badges de destaque',
    category: 'identity',
    defaultColSpan: 12,
    defaultTitle: 'Identificação'
  },
  {
    type: 'photo',
    label: 'Foto / Avatar',
    icon: '📷',
    description: 'Foto de perfil com enquadramento ajustável',
    category: 'identity',
    defaultColSpan: 4,
    defaultTitle: 'Foto'
  },
  {
    type: 'contacts',
    label: 'Contatos & Links Sociais',
    icon: '📞',
    description: 'E-mail, telefone, cidade, LinkedIn, GitHub e portfólio',
    category: 'identity',
    defaultColSpan: 8,
    defaultTitle: 'Contatos'
  },
  {
    type: 'summary',
    label: 'Sobre Mim / Resumo',
    icon: '📝',
    description: 'Apresentação executiva e resumo de qualificações',
    category: 'content',
    defaultColSpan: 12,
    defaultTitle: 'Sobre Mim'
  },
  {
    type: 'work',
    label: 'Experiência Profissional',
    icon: '💼',
    description: 'Cargos, empresas, datas, resumo e conquistas (bullets)',
    category: 'content',
    defaultColSpan: 12,
    defaultTitle: 'Experiência Profissional'
  },
  {
    type: 'projects',
    label: 'Projetos em Destaque',
    icon: '🚀',
    description: 'Sistemas entregues, links de demonstração e tecnologias',
    category: 'content',
    defaultColSpan: 12,
    defaultTitle: 'Projetos em Destaque'
  },
  {
    type: 'skills_tags',
    label: 'Competências (Pílulas / Tags)',
    icon: '⚡',
    description: 'Grupos de habilidades técnicas e palavras-chave em badges',
    category: 'skills',
    defaultColSpan: 6,
    defaultTitle: 'Competências Técnicas'
  },
  {
    type: 'skills_bars',
    label: 'Habilidades (Barras de Nível)',
    icon: '📊',
    description: 'Barras gráficas com percentual visual e nível de proficiência',
    category: 'skills',
    defaultColSpan: 6,
    defaultTitle: 'Expertise & Proficiência'
  },
  {
    type: 'education',
    label: 'Formação Acadêmica',
    icon: '🎓',
    description: 'Cursos de graduação, pós-graduação, instituições e anos',
    category: 'academic',
    defaultColSpan: 6,
    defaultTitle: 'Formação Acadêmica'
  },
  {
    type: 'certificates',
    label: 'Certificações & Licenças',
    icon: '📜',
    description: 'Certificados emitidos, instituições e credenciais',
    category: 'academic',
    defaultColSpan: 6,
    defaultTitle: 'Certificações'
  },
  {
    type: 'languages',
    label: 'Idiomas',
    icon: '🌐',
    description: 'Idiomas e nível de fluência (Nativo, Avançado, etc.)',
    category: 'extras',
    defaultColSpan: 6,
    defaultTitle: 'Idiomas'
  },
  {
    type: 'interests',
    label: 'Interesses & Hobbies',
    icon: '🎯',
    description: 'Áreas de pesquisa técnica, hobbies e interesses pessoais',
    category: 'extras',
    defaultColSpan: 6,
    defaultTitle: 'Interesses & Pesquisa'
  },
  {
    type: 'civil',
    label: 'Dados Civis & CNH',
    icon: '🆔',
    description: 'Idade, nacionalidade, estado civil e habilitação',
    category: 'extras',
    defaultColSpan: 4,
    defaultTitle: 'Dados Gerais'
  },
  {
    type: 'quote',
    label: 'Citação / Frase de Impacto',
    icon: '💬',
    description: 'Frase sintética ou lema profissional',
    category: 'content',
    defaultColSpan: 12,
    defaultTitle: 'Frase'
  },
  {
    type: 'cover_letter',
    label: 'Carta de Apresentação',
    icon: '✉️',
    description: 'Cover Letter completa para dossiê profissional',
    category: 'content',
    defaultColSpan: 12,
    defaultTitle: 'Carta de Apresentação'
  },
  {
    type: 'custom_image',
    label: 'Imagem / Logo / Selo / QR',
    icon: '🖼️',
    description: 'Insira qualquer imagem: logotipo, certificado, QR Code ou portfólio',
    category: 'extras',
    defaultColSpan: 6,
    defaultTitle: 'Destaque Visual'
  }
]

export const CANVAS_PRESETS: CanvasPreset[] = [
  {
    id: 'blank',
    name: 'Folha em Branco',
    description: 'Comece com a página A4 totalmente vazia e adicione blocos à vontade.',
    icon: '📄',
    blocks: []
  },
  {
    id: 'executive_balanced',
    name: 'Executivo Balanceado',
    description: 'Layout clássico A4 com cabeçalho integrado, bio e 2 colunas equilibradas.',
    icon: '👔',
    blocks: [
      { id: 'b-header', type: 'header', colSpan: 12, padding: 'normal' },
      { id: 'b-photo', type: 'photo', colSpan: 4, padding: 'normal' },
      { id: 'b-contacts', type: 'contacts', colSpan: 8, padding: 'normal' },
      { id: 'b-summary', type: 'summary', colSpan: 12, padding: 'normal' },
      { id: 'b-work', type: 'work', colSpan: 12, padding: 'normal' },
      { id: 'b-skills', type: 'skills_tags', colSpan: 6, padding: 'normal' },
      { id: 'b-edu', type: 'education', colSpan: 6, padding: 'normal' },
      { id: 'b-proj', type: 'projects', colSpan: 12, padding: 'normal' }
    ]
  },
  {
    id: 'two_column_modern',
    name: 'Duas Colunas Modernas',
    description: 'Coluna lateral para contatos/habilidades e coluna principal para experiência.',
    icon: '📑',
    blocks: [
      { id: 'b-header', type: 'header', colSpan: 12, padding: 'normal' },
      { id: 'b-photo', type: 'photo', colSpan: 4, padding: 'normal' },
      { id: 'b-summary', type: 'summary', colSpan: 8, padding: 'normal' },
      { id: 'b-contacts', type: 'contacts', colSpan: 4, padding: 'normal' },
      { id: 'b-work', type: 'work', colSpan: 8, padding: 'normal' },
      { id: 'b-skills', type: 'skills_bars', colSpan: 4, padding: 'normal' },
      { id: 'b-edu', type: 'education', colSpan: 8, padding: 'normal' },
      { id: 'b-lang', type: 'languages', colSpan: 4, padding: 'normal' },
      { id: 'b-cert', type: 'certificates', colSpan: 8, padding: 'normal' }
    ]
  },
  {
    id: 'hero_tech',
    name: 'Hero Tech & Projetos',
    description: 'Foco em impacto com barra superior de contatos e matriz de projetos.',
    icon: '🚀',
    blocks: [
      { id: 'b-contacts', type: 'contacts', colSpan: 12, padding: 'compact' },
      { id: 'b-header', type: 'header', colSpan: 8, padding: 'normal' },
      { id: 'b-photo', type: 'photo', colSpan: 4, padding: 'normal' },
      { id: 'b-summary', type: 'summary', colSpan: 12, padding: 'normal' },
      { id: 'b-work', type: 'work', colSpan: 6, padding: 'normal' },
      { id: 'b-proj', type: 'projects', colSpan: 6, padding: 'normal' },
      { id: 'b-skills', type: 'skills_tags', colSpan: 12, padding: 'normal' },
      { id: 'b-edu', type: 'education', colSpan: 6, padding: 'normal' },
      { id: 'b-cert', type: 'certificates', colSpan: 6, padding: 'normal' }
    ]
  }
]

export function createBlockFromType(type: BlockIdentifier, overrides?: Partial<CanvasBlockConfig>): CanvasBlockConfig {
  const itemDef = AVAILABLE_PALETTE_ITEMS.find(p => p.type === type)
  const id = `block_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  return {
    id,
    type,
    customTitle: overrides?.customTitle || itemDef?.defaultTitle,
    colSpan: overrides?.colSpan || itemDef?.defaultColSpan || 12,
    fontSizeScale: overrides?.fontSizeScale || 1.0,
    padding: overrides?.padding || 'normal',
    showCardBackground: overrides?.showCardBackground ?? false,
    showBorder: overrides?.showBorder ?? false,
    ...(type === 'custom_image' ? {
      imageUrl: overrides?.imageUrl || '',
      imageAlt: overrides?.imageAlt || 'Imagem ilustrativa',
      imageHeight: overrides?.imageHeight || 120,
      imageFit: overrides?.imageFit || 'contain',
      imageBorderRadius: overrides?.imageBorderRadius ?? 6,
    } : {}),
    ...overrides
  }
}

export function loadSavedCanvasBlocks(): CanvasBlockConfig[] {
  const saved = localStorage.getItem(STORAGE_CANVAS_BLOCKS_KEY)
  if (!saved) {
    // Retorna preset Executivo Balanceado por padrão
    return CANVAS_PRESETS[1].blocks.map(b => ({ ...b, id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` }))
  }
  try {
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Falha silenciosa
  }
  return []
}

export function saveCanvasBlocks(blocks: CanvasBlockConfig[]): void {
  try {
    localStorage.setItem(STORAGE_CANVAS_BLOCKS_KEY, JSON.stringify(blocks))
  } catch {
    // Quota storage exceeded handling
  }
}
