export type TextVariant = 'professional' | 'architect' | 'historian' | 'didactic' | 'alien'
export type ThemeVariant = 'executive' | 'creative' | 'minimalist' | 'white' | 'terminal'
export type LanguageCode = 'pt' | 'en'

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
  email?: string
  phone?: string
  url?: string
  summary?: string
  location?: CVLocation
  profiles?: CVProfile[]
  customBadges?: string[] // e.g. ["PcD", "Open to Relocate"]
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
  level?: string
  keywords?: string[]
}

export interface CVLanguage {
  language: string
  fluency: string
}

export interface CVInterest {
  name: string
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
  meta?: {
    lastModified?: string
    version?: string
    theme?: ThemeVariant
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
