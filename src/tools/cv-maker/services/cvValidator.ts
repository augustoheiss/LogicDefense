import type { CVData, CVBasics, CVWork, CVEducation, CVProject, CVSkill, CVLanguage, CVInterest, CVCertificate, CVAward, CVVolunteer } from '../types/cv'

/**
 * Regex canônico para formatos de data suportados pelo padrão JSON Resume:
 * - YYYY
 * - YYYY-MM
 * - YYYY-MM-DD
 */
export const DATE_FORMAT_REGEX = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

export interface DateValidationResult {
  value: string
  isValid: boolean
  isEstimated?: boolean
  warning?: string
}

/**
 * Valida e normaliza strings de data vindas de entrada de usuário ou do modelo LLM.
 * Segue a política rigorosa de não inventar dados e aceita strings vazias como ausência legítima.
 */
export function validateAndNormalizeDate(rawDate?: any, contextLabel = 'Data'): DateValidationResult {
  if (rawDate === null || rawDate === undefined) {
    return { value: '', isValid: true }
  }
  const str = String(rawDate).trim()
  if (!str) {
    return { value: '', isValid: true }
  }

  // Detecta explicitamente se a data foi sinalizada como estimada pela IA
  const isEstimated = str.includes('[ESTIMADO]') || str.toLowerCase().includes('estimad')
  const cleanStr = str.replace(/\[ESTIMADO\]/gi, '').trim()

  const match = cleanStr.match(DATE_FORMAT_REGEX)
  if (!match) {
    const lower = cleanStr.toLowerCase()
    if (['atual', 'presente', 'current', 'present'].includes(lower)) {
      return { value: 'Atual', isValid: true, isEstimated }
    }
    return {
      value: cleanStr,
      isValid: false,
      isEstimated,
      warning: `${contextLabel}: Formato não reconhecido ("${cleanStr}"). Esperado: YYYY, YYYY-MM ou YYYY-MM-DD.`
    }
  }

  const year = parseInt(match[1], 10)
  const month = match[2] ? parseInt(match[2], 10) : undefined
  const day = match[3] ? parseInt(match[3], 10) : undefined

  if (year < 1960 || year > 2100) {
    return { value: cleanStr, isValid: false, warning: `${contextLabel}: Ano fora de limites razoáveis (${year}).` }
  }
  if (month !== undefined && (month < 1 || month > 12)) {
    return { value: cleanStr, isValid: false, warning: `${contextLabel}: Mês inválido (${month}).` }
  }
  if (day !== undefined && (day < 1 || day > 31)) {
    return { value: cleanStr, isValid: false, warning: `${contextLabel}: Dia inválido (${day}).` }
  }

  // Checagem de datas futuras
  const currentYear = new Date().getFullYear()
  if (year > currentYear + 1) {
    return {
      value: cleanStr,
      isValid: true,
      isEstimated,
      warning: `${contextLabel}: Data futura detectada (${cleanStr}). Ano corrente: ${currentYear}.`
    }
  }

  return { value: cleanStr, isValid: true, isEstimated }
}

/**
 * Valida a coerência e ordem cronológica entre data de início e término.
 */
export function validateDateRange(
  startDate?: string, 
  endDate?: string, 
  contextLabel = 'Item'
): { isValid: boolean; warning?: string } {
  if (!startDate || !endDate) return { isValid: true }
  const e = endDate.trim().toLowerCase()
  if (e === 'atual' || e === 'presente' || e === 'current') return { isValid: true }

  const startRes = validateAndNormalizeDate(startDate)
  const endRes = validateAndNormalizeDate(endDate)
  if (!startRes.isValid || !endRes.isValid) return { isValid: true }

  if (startRes.value && endRes.value && endRes.value < startRes.value) {
    return {
      isValid: false,
      warning: `${contextLabel}: Inversão temporal detectada — término (${endRes.value}) é anterior ao início (${startRes.value}).`
    }
  }
  return { isValid: true }
}

/**
 * Validates and normalizes raw JSON/YAML data into a clean, crash-proof CVData object.
 * Applies safe defaults (e.g. empty arrays for missing optional sections).
 */
export function validateAndNormalizeCV(raw: any): { 
  valid: boolean
  data: CVData | null
  warnings?: string[]
  error?: string 
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, data: null, error: 'O currículo deve ser um objeto JSON/YAML válido.' }
  }

  const warnings: string[] = []

  const basicsRaw = raw.basics
  if (!basicsRaw || typeof basicsRaw !== 'object' || !basicsRaw.name || typeof basicsRaw.name !== 'string') {
    return { valid: false, data: null, error: 'O currículo precisa conter ao menos a seção "basics" com o campo "name".' }
  }

  const cleanBasics: CVBasics = {
    name: String(basicsRaw.name || '').trim(),
    label: basicsRaw.label ? String(basicsRaw.label).trim() : undefined,
    image: basicsRaw.image ? String(basicsRaw.image).trim() : undefined,
    email: basicsRaw.email ? String(basicsRaw.email).trim() : undefined,
    phone: basicsRaw.phone ? String(basicsRaw.phone).trim() : undefined,
    url: basicsRaw.url ? String(basicsRaw.url).trim() : undefined,
    summary: basicsRaw.summary ? String(basicsRaw.summary).trim() : undefined,
    location: basicsRaw.location && typeof basicsRaw.location === 'object' ? {
      city: basicsRaw.location.city ? String(basicsRaw.location.city).trim() : undefined,
      region: basicsRaw.location.region ? String(basicsRaw.location.region).trim() : undefined,
      postalCode: basicsRaw.location.postalCode ? String(basicsRaw.location.postalCode).trim() : undefined,
      countryCode: basicsRaw.location.countryCode ? String(basicsRaw.location.countryCode).trim() : undefined,
      address: basicsRaw.location.address ? String(basicsRaw.location.address).trim() : undefined,
    } : undefined,
    profiles: Array.isArray(basicsRaw.profiles)
      ? basicsRaw.profiles
          .filter((p: any) => p && typeof p === 'object' && p.network && p.url)
          .map((p: any) => ({
            network: String(p.network).trim(),
            username: String(p.username || '').trim(),
            url: String(p.url).trim(),
          }))
      : [],
    customBadges: Array.isArray(basicsRaw.customBadges)
      ? basicsRaw.customBadges.map((b: any) => String(b).trim()).filter(Boolean)
      : [],
    imagePosX: typeof basicsRaw.imagePosX === 'number' ? basicsRaw.imagePosX : undefined,
    imagePosY: typeof basicsRaw.imagePosY === 'number' ? basicsRaw.imagePosY : undefined,
    imageScale: typeof basicsRaw.imageScale === 'number' ? basicsRaw.imageScale : undefined,
  }

  const cleanWork: CVWork[] = Array.isArray(raw.work)
    ? raw.work
        .filter((w: any) => w && typeof w === 'object' && w.name)
        .map((w: any, idx: number) => {
          const compName = String(w.name || `Experiência #${idx + 1}`).trim()
          const startRes = validateAndNormalizeDate(w.startDate, `${compName} (Início)`)
          const endRes = w.endDate ? validateAndNormalizeDate(w.endDate, `${compName} (Término)`) : undefined
          
          if (startRes.warning) warnings.push(startRes.warning)
          if (endRes?.warning) warnings.push(endRes.warning)

          const rangeRes = validateDateRange(startRes.value, endRes?.value, compName)
          if (rangeRes.warning) warnings.push(rangeRes.warning)

          return {
            name: compName,
            position: String(w.position || '').trim(),
            url: w.url ? String(w.url).trim() : undefined,
            startDate: startRes.value,
            endDate: endRes ? endRes.value : undefined,
            summary: w.summary ? String(w.summary).trim() : undefined,
            highlights: Array.isArray(w.highlights)
              ? w.highlights.map((h: any) => String(h).trim()).filter(Boolean)
              : [],
          }
        })
    : []

  const cleanEducation: CVEducation[] = Array.isArray(raw.education)
    ? raw.education
        .filter((e: any) => e && typeof e === 'object' && e.institution)
        .map((e: any, idx: number) => {
          const instName = String(e.institution || `Instituição #${idx + 1}`).trim()
          const startRes = e.startDate ? validateAndNormalizeDate(e.startDate, `${instName} (Início)`) : undefined
          const endRes = e.endDate ? validateAndNormalizeDate(e.endDate, `${instName} (Término)`) : undefined

          if (startRes?.warning) warnings.push(startRes.warning)
          if (endRes?.warning) warnings.push(endRes.warning)

          if (startRes && endRes) {
            const rangeRes = validateDateRange(startRes.value, endRes.value, instName)
            if (rangeRes.warning) warnings.push(rangeRes.warning)
          }

          return {
            institution: instName,
            area: e.area ? String(e.area).trim() : undefined,
            studyType: e.studyType ? String(e.studyType).trim() : undefined,
            startDate: startRes ? startRes.value : undefined,
            endDate: endRes ? endRes.value : undefined,
            score: e.score ? String(e.score).trim() : undefined,
            courses: Array.isArray(e.courses)
              ? e.courses.map((c: any) => String(c).trim()).filter(Boolean)
              : [],
          }
        })
    : []

  const cleanProjects: CVProject[] = Array.isArray(raw.projects)
    ? raw.projects
        .filter((p: any) => p && typeof p === 'object' && p.name)
        .map((p: any) => ({
          name: String(p.name || '').trim(),
          description: p.description ? String(p.description).trim() : undefined,
          highlights: Array.isArray(p.highlights)
            ? p.highlights.map((h: any) => String(h).trim()).filter(Boolean)
            : [],
          keywords: Array.isArray(p.keywords)
            ? p.keywords.map((k: any) => String(k).trim()).filter(Boolean)
            : [],
          url: p.url ? String(p.url).trim() : undefined,
        }))
    : []

  const cleanSkills: CVSkill[] = Array.isArray(raw.skills)
    ? raw.skills
        .filter((s: any) => s && typeof s === 'object' && s.name)
        .map((s: any) => ({
          name: String(s.name || '').trim(),
          level: s.level ? String(s.level).trim() : undefined,
          keywords: Array.isArray(s.keywords)
            ? s.keywords.map((k: any) => String(k).trim()).filter(Boolean)
            : [],
        }))
    : []

  const cleanLanguages: CVLanguage[] = Array.isArray(raw.languages)
    ? raw.languages
        .filter((l: any) => l && typeof l === 'object' && l.language)
        .map((l: any) => ({
          language: String(l.language || '').trim(),
          fluency: String(l.fluency || 'Conversational').trim(),
        }))
    : []

  const cleanInterests: CVInterest[] = Array.isArray(raw.interests)
    ? raw.interests
        .filter((i: any) => i && typeof i === 'object' && i.name)
        .map((i: any) => ({
          name: String(i.name || '').trim(),
          keywords: Array.isArray(i.keywords)
            ? i.keywords.map((k: any) => String(k).trim()).filter(Boolean)
            : [],
        }))
    : []

  const cleanCertificates: CVCertificate[] = Array.isArray(raw.certificates)
    ? raw.certificates
        .filter((c: any) => c && typeof c === 'object' && c.name)
        .map((c: any) => {
          const certName = String(c.name || '').trim()
          const dateRes = c.date ? validateAndNormalizeDate(c.date, `Certificado "${certName}"`) : undefined
          if (dateRes?.warning) warnings.push(dateRes.warning)

          return {
            name: certName,
            date: dateRes ? dateRes.value : undefined,
            issuer: c.issuer ? String(c.issuer).trim() : undefined,
            url: c.url ? String(c.url).trim() : undefined,
          }
        })
    : []

  const cleanAwards: CVAward[] = Array.isArray(raw.awards)
    ? raw.awards
        .filter((a: any) => a && typeof a === 'object' && a.title)
        .map((a: any) => {
          const awardTitle = String(a.title || '').trim()
          const dateRes = a.date ? validateAndNormalizeDate(a.date, `Prêmio "${awardTitle}"`) : undefined
          if (dateRes?.warning) warnings.push(dateRes.warning)

          return {
            title: awardTitle,
            date: dateRes ? dateRes.value : undefined,
            awarder: a.awarder ? String(a.awarder).trim() : undefined,
            summary: a.summary ? String(a.summary).trim() : undefined,
          }
        })
    : []

  const cleanVolunteer: CVVolunteer[] = Array.isArray(raw.volunteer)
    ? raw.volunteer
        .filter((v: any) => v && typeof v === 'object' && v.organization)
        .map((v: any, idx: number) => {
          const orgName = String(v.organization || `Voluntariado #${idx + 1}`).trim()
          const startRes = v.startDate ? validateAndNormalizeDate(v.startDate, `${orgName} (Início)`) : undefined
          const endRes = v.endDate ? validateAndNormalizeDate(v.endDate, `${orgName} (Término)`) : undefined

          if (startRes?.warning) warnings.push(startRes.warning)
          if (endRes?.warning) warnings.push(endRes.warning)

          if (startRes && endRes) {
            const rangeRes = validateDateRange(startRes.value, endRes.value, orgName)
            if (rangeRes.warning) warnings.push(rangeRes.warning)
          }

          return {
            organization: orgName,
            position: String(v.position || '').trim(),
            url: v.url ? String(v.url).trim() : undefined,
            startDate: startRes ? startRes.value : '',
            endDate: endRes ? endRes.value : undefined,
            summary: v.summary ? String(v.summary).trim() : undefined,
            highlights: Array.isArray(v.highlights)
              ? v.highlights.map((h: any) => String(h).trim()).filter(Boolean)
              : [],
          }
        })
    : []

  // Normalização padronizada: seções opcionais retornam [] em vez de undefined, eliminando falhas de renderização
  const normalized: CVData = {
    basics: cleanBasics,
    work: cleanWork,
    education: cleanEducation,
    projects: cleanProjects,
    skills: cleanSkills,
    languages: cleanLanguages,
    interests: cleanInterests,
    certificates: cleanCertificates,
    awards: cleanAwards,
    volunteer: cleanVolunteer,
    meta: {
      lastModified: raw.meta?.lastModified || new Date().toISOString(),
      version: '2.0.0',
      theme: raw.meta?.theme || 'executive',
      language: raw.meta?.language || 'pt',
      temporalWarnings: warnings.length > 0 ? warnings : undefined,
    },
  }

  return { 
    valid: true, 
    data: normalized,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}
