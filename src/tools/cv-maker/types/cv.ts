export type TextVariant = 'official_master' | 'professional' | 'architect' | 'historian' | 'didactic' | 'alien'
export type ThemeVariant = 'executive' | 'creative' | 'minimalist' | 'white' | 'terminal'
export type LayoutVariant = 
  | 'modular'             // Modelo A4 01 - Modular Cards
  | 'linear'              // Modelo A4 02 - Linear Clássico ATS
  | 'sidebar'             // Modelo A4 03 - Executive Sidebar
  | 'compact_split'       // Modelo A4 04 - Split Duo (Victoria Wotton)
  | 'editorial_accent'    // Modelo A4 05 - Brand Accent Block (Basil Hailward)
  | 'corporate_timeline'  // Modelo A4 06 - Navy Solid Timeline (Wilkins Micawber)
  | 'warm_magazine'       // Modelo A4 07 - Warm Editorial & Stamp (Editorial Cream)
  | 'hero_matrix'         // Modelo A4 08 - Hero Banner Matrix (Mary Smith)
  | 'dynamic_math'        // Modelo A4 09 - Dynamic Grid Math (Augusto Heiss / Mathematical Balance)
  | 'canvas_livre'        // Modelo A4 10 - Block Canvas A4 Builder (Modo Livre)

export type ViewMode = 'cv' | 'cover_letter' | 'both'
export type LanguageCode = 'pt' | 'en'

export interface LayoutOption {
  id: LayoutVariant
  name: string
  label: string
  icon: string
  description: string
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'modular',
    name: 'Modelo A4 01',
    label: '📐 Modelo A4 01 (Modular)',
    icon: '📐',
    description: 'Header dinâmico com avatar, badges em pílula e blocos modulares em caixas suaves.'
  },
  {
    id: 'linear',
    name: 'Modelo A4 02',
    label: '📄 Modelo A4 02 (Linear)',
    icon: '📄',
    description: 'Linha contínua compacta estilo clássico/ATS com divisores finos e alta densidade.'
  },
  {
    id: 'sidebar',
    name: 'Modelo A4 03',
    label: '📑 Modelo A4 03 (Sidebar)',
    icon: '📑',
    description: '2 Colunas com barra lateral dedicada para perfil, contatos, competências e idiomas.'
  },
  {
    id: 'compact_split',
    name: 'Modelo A4 04',
    label: '📑 Modelo A4 04 (Compact Split)',
    icon: '📑',
    description: 'Design moderno com split assimétrico, cards com ícones geométricos e badge sutil.'
  },
  {
    id: 'editorial_accent',
    name: 'Modelo A4 05',
    label: '🎨 Modelo A4 05 (Editorial Accent)',
    icon: '🎨',
    description: 'Header com bloco de cor sólida (marca registrada), grid balanceado e tipografia editorial.'
  },
  {
    id: 'corporate_timeline',
    name: 'Modelo A4 06',
    label: '🏛️ Modelo A4 06 (Corporate Timeline)',
    icon: '🏛️',
    description: 'Navy corporate com timeline vertical contínua, conectores temporais e resumo em destaque.'
  },
  {
    id: 'warm_magazine',
    name: 'Modelo A4 07',
    label: '📰 Modelo A4 07 (Warm Magazine)',
    icon: '📰',
    description: 'Estilo editorial creme com selo/stamp lateral, badges suaves e cards estruturados.'
  },
  {
    id: 'hero_matrix',
    name: 'Modelo A4 08',
    label: '⚡ Modelo A4 08 (Hero Matrix)',
    icon: '⚡',
    description: 'Hero banner proeminente com foto redonda central/offset e grid matricial em 2 colunas.'
  },
  {
    id: 'dynamic_math',
    name: 'Modelo A4 09',
    label: '📐 Modelo A4 09 (Grid Math)',
    icon: '📐',
    description: 'Equilíbrio e proporção matemática pura com tipografia IBM Plex, micro-cards compactos e alta densidade A4.'
  }
]

export interface CVProfile {
  network: string
  username: string
  url: string
}

export interface CVLocation {
  city?: string
  region?: string
  postalCode?: string
  countryCode?: string
  address?: string
}

export interface CVBasics {
  name: string
  label?: string
  image?: string // Profile avatar Base64 or URL
  imagePosX?: number // 0% a 100% (default: 50)
  imagePosY?: number // 0% a 100% (default: 50)
  imageScale?: number // 1.0 a 2.5 (default: 1.0)
  email?: string
  phone?: string
  url?: string
  summary?: string
  location?: CVLocation
  profiles?: CVProfile[]
  customBadges?: string[] // e.g. ["PcD", "Open to Relocate"]
  age?: string | number
  civilStatus?: string    // "Solteiro(a)", "Casado(a)"
  nationality?: string    // "Brasileira", "Portuguesa"
  driverLicense?: string  // "CNH B", "Sim"
  quote?: string          // Frase de impacto / bio sintética
  birthDate?: string
}

export interface CVWork {
  name: string
  company?: string
  position: string
  url?: string
  startDate: string
  endDate?: string
  summary: string
  highlights: string[]
  location?: string
}

export interface CVProject {
  name: string
  description?: string
  highlights?: string[]
  keywords?: string[]
  url?: string
}

export interface CVEducation {
  institution: string
  url?: string
  area: string
  studyType: string
  startDate: string
  endDate: string
  score?: string
  courses?: string[]
}

export interface CVCertificate {
  name: string
  date: string
  issuer: string
  url?: string
}

export interface CVAward {
  title: string
  date: string
  awarder: string
  summary: string
}

export interface CVPublication {
  name: string
  publisher: string
  releaseDate: string
  url: string
  summary: string
}

export interface CVSkill {
  name: string
  level?: string          // "Básico", "Intermediário", "Avançado", "Especialista"
  levelPercent?: number   // 0 a 100
  keywords: string[]
}

export interface CVLanguage {
  language: string
  fluency: string
  levelPercent?: number   // 0 a 100
}

export interface CVInterest {
  name: string
  icon?: string           // "camera" | "palette" | "plane" | "book" | "code" | "music" | "coffee" | "globe"
  keywords?: string[]
}

export interface CVVolunteer {
  organization: string
  position: string
  url?: string
  startDate: string
  endDate?: string
  summary: string
  highlights: string[]
}

export interface CVReference {
  name: string
  reference?: string
  phone?: string
  email?: string
  company?: string
  position?: string
  address?: string
  url?: string
  description?: string
}

export interface CoverLetterRecipient {
  name?: string
  title?: string
  company?: string
  address?: string
}

export interface CoverLetter {
  recipient?: CoverLetterRecipient | string
  company?: string
  date?: string
  subject?: string
  salutation?: string
  paragraphs?: string[]
  body?: string
  closing?: string
  signature?: string
  signatureImage?: string // Base64 or direct image URL
}

export interface CVData {
  basics: CVBasics
  work?: CVWork[]
  education?: CVEducation[]
  projects?: CVProject[]
  skills?: CVSkill[]
  languages?: CVLanguage[]
  interests?: CVInterest[]
  certificates?: CVCertificate[]
  awards?: CVAward[]
  volunteer?: CVVolunteer[]
  references?: CVReference[]
  coverLetter?: CoverLetter
  meta?: {
    lastModified?: string
    version?: string
    theme?: ThemeVariant
    layout?: LayoutVariant
    language?: LanguageCode
  }
}

export interface CVVersions {
  official_master?: string
  professional: string
  architect?: string
  historian: string
  didactic: string
  alien: string
}

/**
 * Identificadores de blocos atômicos puros no motor de documentos.
 */
export type BlockIdentifier =
  | 'header'
  | 'photo'
  | 'contacts'
  | 'civil'
  | 'summary'
  | 'quote'
  | 'work'
  | 'projects'
  | 'education'
  | 'skills_tags'
  | 'skills_bars'
  | 'languages'
  | 'certificates'
  | 'references'
  | 'interests'
  | 'cover_letter'

/**
 * Definição declarativa de um Blueprint de Layout A4.
 */
export interface LayoutBlueprint {
  id: LayoutVariant
  name: string
  label: string
  icon: string
  description: string
  gridTemplate: string // ex: '1fr', '240px 1fr', '1fr 240px'
  heroZone?: BlockIdentifier[]
  sidebarZone?: BlockIdentifier[]
  mainZone: BlockIdentifier[]
  footerZone?: BlockIdentifier[]
  sidebarPosition?: 'left' | 'right' | 'none'
  hasHeroBanner?: boolean
  customClass?: string
}

/**
 * Mapeia níveis de habilidade descritivos para percentuais visuais de barra (0 a 100).
 */
export function getSkillPercentage(level?: string, levelPercent?: number): number {
  if (typeof levelPercent === 'number' && levelPercent >= 0 && levelPercent <= 100) {
    return levelPercent
  }
  if (!level) return 75
  const normalized = level.toLowerCase().trim()
  if (normalized.includes('expert') || normalized.includes('especialista') || normalized.includes('master')) return 95
  if (normalized.includes('senior') || normalized.includes('avançad') || normalized.includes('advanced')) return 85
  if (normalized.includes('pleno') || normalized.includes('intermediár') || normalized.includes('proficient')) return 70
  if (normalized.includes('júnior') || normalized.includes('básic') || normalized.includes('basic') || normalized.includes('iniciante')) return 40
  return 75
}

/**
 * Override de Estilo Granular por Seção
 */
export interface SectionStyleOverride {
  textColor?: string
  titleColor?: string
  bgColor?: string
  borderColor?: string
  accentColor?: string
}

/**
 * Configurações de Design Tokens e Estilização Dinâmica
 */
export interface CVDesignConfig {
  fontHeading: string
  fontBody: string
  fontScale: number // 0.85 a 1.25
  fontSizeBase: string // e.g. "0.85rem"
  colorPrimary: string
  colorSecondary: string
  colorText: string
  colorTextMuted: string
  colorBg: string
  colorSurface: string
  colorBorder: string
  colorAccent: string
  colorSidebar?: string
  colorWorkspaceBg?: string
  backgroundPattern?: string
  backgroundOpacity?: number
  sectionOverrides?: Record<string, SectionStyleOverride>
}

export const DEFAULT_DESIGN_CONFIG: CVDesignConfig = {
  fontHeading: 'Plus Jakarta Sans',
  fontBody: 'Inter',
  fontScale: 1.0,
  fontSizeBase: '0.85rem',
  colorPrimary: '#0284c7',
  colorSecondary: '#0369a1',
  colorText: '#0f172a',
  colorTextMuted: '#64748b',
  colorBg: '#ffffff',
  colorSurface: '#f8fafc',
  colorBorder: '#e2e8f0',
  colorAccent: '#f97316',
  colorSidebar: '#0f172a',
  colorWorkspaceBg: '#0b1120',
  backgroundPattern: 'none',
  backgroundOpacity: 1.0,
  sectionOverrides: {}
}

/**
 * Modos de Criação do CV Maker
 */
export type AppMode = 'templates' | 'canvas_builder'

/**
 * Largura em Grid de 12 Colunas
 * 3 = 25% (1/4) | 4 = 33.3% (1/3) | 6 = 50% (1/2) | 8 = 66.6% (2/3) | 12 = 100% (Full)
 */
export type CanvasColSpan = 3 | 4 | 6 | 8 | 12

/**
 * Estrutura de Configuração de um Bloco no Canvas Livre
 */
export interface CanvasBlockConfig {
  id: string
  type: BlockIdentifier
  customTitle?: string
  colSpan: CanvasColSpan
  fontFamily?: string
  fontSizeScale?: number // 0.75 a 1.5 (padrão: 1.0)
  customTextColor?: string
  customBgColor?: string
  customBorderColor?: string
  padding?: 'none' | 'compact' | 'normal' | 'spacious'
  align?: 'left' | 'center' | 'right'
  minHeight?: number // px
  showCardBackground?: boolean
  showBorder?: boolean
  // Configurações especializadas para o bloco de Foto / Avatar
  photoShape?: 'circle' | 'square' | 'rounded' | 'vertical' | 'pill' | 'hexagon' | 'diamond' | 'shield'
  photoSize?: number // px de largura (ex: 50 a 240, default: 90)
  photoBorderWidth?: number // px (ex: 0, 2, 4, 6)
  photoBorderColor?: string
  photoShadow?: boolean
  photoAlign?: 'left' | 'center' | 'right'
  hideContainerBox?: boolean // Se true, remove qualquer fundo/caixa e exibe apenas a foto pura
}

export interface CanvasPreset {
  id: string
  name: string
  description: string
  icon: string
  blocks: CanvasBlockConfig[]
}

/**
 * Dimensões e comportamento contínuo de uma caixa de seção no Modo Canvas Livre Universal
 */
export interface SectionBoxDimensions {
  widthPercent?: number       // Largura contínua de 10% a 100%
  minHeightPx?: number        // Altura mínima em pixels
  maxHeightPx?: number        // Altura máxima em pixels
  order?: number              // Ordem visual no container (CSS order)
  marginTopPx?: number        // Margem superior ajustável em pixels (-20px a +80px)
  marginLeftPx?: number       // Deslocamento lateral / margem esquerda em pixels (-40px a +400px)
  marginLeftPercent?: number  // Recuo lateral em percentual
  alignment?: 'left' | 'center' | 'right' // Alinhamento no plano horizontal
  variant?: string            // Variante de layout visual do bloco
  hidden?: boolean            // Indica se o item/bloco está ocultado da folha A4

  // Propriedades Estendidas de Foto no Canvas Livre
  photoShape?: 'circle' | 'square' | 'rounded' | 'vertical' | 'pill' | 'hexagon' | 'diamond' | 'shield' | 'octagon' | 'teardrop' | 'editorial_stamp'
  photoSize?: number          // Tamanho da foto em pixels (40 a 240)
  photoBorderWidth?: number   // Espessura da borda em pixels (0 a 6)
  photoBorderColor?: string   // Cor da borda
  photoShadow?: boolean       // Sombra suave ativada
  photoAlign?: 'left' | 'center' | 'right' // Alinhamento na coluna
  photoPosX?: number          // Enquadramento Pan X (0% a 100%)
  photoPosY?: number          // Enquadramento Pan Y (0% a 100%)
  photoScale?: number         // Zoom / Escala (1.0 a 2.5)

  // Propriedades Estendidas de Tipografia do Box (Canvas Livre)
  fontSizeScale?: number      // Escala de fonte contínua (ex: 0.70 a 1.40, 1.0 = 100%)
  fontFamily?: string         // Família tipográfica específica do box (ex: 'Cinzel', 'Fira Code', etc.)
}

export interface BoxFontOption {
  id: string
  name: string
  label: string
  family: string
  category: 'sans' | 'serif' | 'mono'
}

export const AVAILABLE_BOX_FONTS: BoxFontOption[] = [
  { id: 'inherit', name: 'Padrão do Tema', label: '🎨 Padrão do Tema', family: '', category: 'sans' },
  { id: 'plus_jakarta', name: 'Plus Jakarta Sans', label: '🚀 Plus Jakarta Sans', family: 'Plus Jakarta Sans', category: 'sans' },
  { id: 'inter', name: 'Inter', label: '📐 Inter', family: 'Inter', category: 'sans' },
  { id: 'cinzel', name: 'Cinzel', label: '🏛️ Cinzel', family: 'Cinzel', category: 'serif' },
  { id: 'merriweather', name: 'Merriweather', label: '📰 Merriweather', family: 'Merriweather', category: 'serif' },
  { id: 'lora', name: 'Lora', label: '📖 Lora', family: 'Lora', category: 'serif' },
  { id: 'poppins', name: 'Poppins', label: '🎨 Poppins', family: 'Poppins', category: 'sans' },
  { id: 'roboto', name: 'Roboto', label: '🏢 Roboto', family: 'Roboto', category: 'sans' },
  { id: 'open_sans', name: 'Open Sans', label: '🌐 Open Sans', family: 'Open Sans', category: 'sans' },
  { id: 'courier_prime', name: 'Courier Prime', label: '⌨️ Courier Prime', family: 'Courier Prime', category: 'mono' },
  { id: 'fira_code', name: 'Fira Code', label: '💻 Fira Code', family: 'Fira Code', category: 'mono' },
  { id: 'montserrat', name: 'Montserrat', label: '🏔️ Montserrat', family: 'Montserrat', category: 'sans' },
  { id: 'outfit', name: 'Outfit', label: '⚡ Outfit', family: 'Outfit', category: 'sans' },
]

/**
 * Configuração Estrutural de um Modelo no Modo Canvas Livre Universal
 */
export interface LayoutStructureConfig {
  isFreeCanvasActive: boolean
  columnSplitRatio?: number   // Proporção percentual da coluna esquerda/sidebar (ex: 28 = 28% / 72%)
  sectionDimensions: Record<string, SectionBoxDimensions>
  sectionOrder?: string[]     // Ordem sequencial explícita das seções no layout ativo
  sectionZone?: Record<string, 'left' | 'right'> // Coluna/zona atribuída à seção em layouts de múltiplas colunas
}


