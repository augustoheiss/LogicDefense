export type TextVariant = 'professional' | 'architect' | 'historian' | 'didactic' | 'alien'
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
    label: '🏛️ Modelo A4 04 (Executive Duo)',
    icon: '🏛️',
    description: 'Coluna esquerda com bio, barras de expertise e hobbies circulares; coluna direita com timeline e referências.'
  },
  {
    id: 'editorial_accent',
    name: 'Modelo A4 05',
    label: '🏷️ Modelo A4 05 (Brand Block)',
    icon: '🏷️',
    description: 'Bloco de topo marcante ("hello, i\'m"), foto vertical, badges de ano sólidos e marcadores em seta.'
  },
  {
    id: 'corporate_timeline',
    name: 'Modelo A4 06',
    label: '⏱️ Modelo A4 06 (Navy Timeline)',
    icon: '⏱️',
    description: 'Sidebar sólida em Dark Navy, timeline com nós conectados, dados civis/CNH e barras de nível.'
  },
  {
    id: 'warm_magazine',
    name: 'Modelo A4 07',
    label: '📰 Modelo A4 07 (Warm Editorial)',
    icon: '📰',
    description: 'Fundo bege editorial elegante, tipografia imponente, selo circular sobre o avatar e medidores visuais.'
  },
  {
    id: 'hero_matrix',
    name: 'Modelo A4 08',
    label: '🖼️ Modelo A4 08 (Hero Matrix)',
    icon: '🖼️',
    description: 'Barra superior de contatos, hero header com foto à direita, grid duplo e matriz inferior de habilidades.'
  },
  {
    id: 'dynamic_math',
    name: 'Modelo A4 09',
    label: '🧮 Modelo A4 09 (Grid Math)',
    icon: '🧮',
    description: 'Grid matemático balanceado (3x2, 2x2, 3x3) com caixas em acento, divisor colorido e densidade editorial.'
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
}

export interface CVWork {
  name: string
  position: string
  url?: string
  startDate: string
  endDate?: string // Omit or leave empty for "Present"
  summary?: string
  highlights?: string[]
}

export interface CVEducation {
  institution: string
  area?: string
  studyType?: string
  startDate?: string
  endDate?: string
  score?: string
  courses?: string[]
}

export interface CVProject {
  name: string
  description?: string
  highlights?: string[]
  keywords?: string[]
  url?: string
}

export interface CVSkill {
  name: string
  level?: string          // "Básico", "Intermediário", "Avançado", "Especialista"
  levelPercent?: number   // 0 a 100
  keywords?: string[]
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

export interface CVCertificate {
  name: string
  date?: string
  issuer?: string
  url?: string
}

export interface CVAward {
  title: string
  date?: string
  awarder?: string
  summary?: string
}

export interface CVVolunteer {
  organization: string
  position: string
  url?: string
  startDate?: string
  endDate?: string
  summary?: string
  highlights?: string[]
}

export interface CVReference {
  name: string
  position?: string
  company?: string
  phone?: string
  email?: string
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
  recipient?: CoverLetterRecipient
  date?: string
  subject?: string
  salutation?: string
  paragraphs: string[]
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
  backgroundPattern?: string
  backgroundOpacity?: number
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
  backgroundPattern: 'none',
  backgroundOpacity: 1.0
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
}

export interface CanvasPreset {
  id: string
  name: string
  description: string
  icon: string
  blocks: CanvasBlockConfig[]
}

