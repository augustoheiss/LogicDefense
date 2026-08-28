import type { CVData, CVBasics, CVWork, CVEducation, CVProject, CVSkill, CVLanguage, CVInterest, CVCertificate, CVAward, CVVolunteer } from '../types/cv'

/**
 * Validates and normalizes raw JSON/YAML data into a clean, crash-proof CVData object.
 * Applies safe defaults (e.g. empty arrays for missing optional sections).
 */
export function validateAndNormalizeCV(raw: any): { valid: boolean; data: CVData | null; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, data: null, error: 'O currículo deve ser um objeto JSON/YAML válido.' }
  }

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
  }

  const cleanWork: CVWork[] = Array.isArray(raw.work)
    ? raw.work
        .filter((w: any) => w && typeof w === 'object' && w.name)
        .map((w: any) => ({
          name: String(w.name || '').trim(),
          position: String(w.position || '').trim(),
          url: w.url ? String(w.url).trim() : undefined,
          startDate: String(w.startDate || '').trim(),
          endDate: w.endDate ? String(w.endDate).trim() : undefined,
          summary: w.summary ? String(w.summary).trim() : undefined,
          highlights: Array.isArray(w.highlights)
            ? w.highlights.map((h: any) => String(h).trim()).filter(Boolean)
            : [],
        }))
    : []

  const cleanEducation: CVEducation[] = Array.isArray(raw.education)
    ? raw.education
        .filter((e: any) => e && typeof e === 'object' && e.institution)
        .map((e: any) => ({
          institution: String(e.institution || '').trim(),
          area: e.area ? String(e.area).trim() : undefined,
          studyType: e.studyType ? String(e.studyType).trim() : undefined,
          startDate: e.startDate ? String(e.startDate).trim() : undefined,
          endDate: e.endDate ? String(e.endDate).trim() : undefined,
          score: e.score ? String(e.score).trim() : undefined,
          courses: Array.isArray(e.courses)
            ? e.courses.map((c: any) => String(c).trim()).filter(Boolean)
            : [],
        }))
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
        .map((c: any) => ({
          name: String(c.name || '').trim(),
          date: c.date ? String(c.date).trim() : undefined,
          issuer: c.issuer ? String(c.issuer).trim() : undefined,
          url: c.url ? String(c.url).trim() : undefined,
        }))
    : []

  const cleanAwards: CVAward[] = Array.isArray(raw.awards)
    ? raw.awards
        .filter((a: any) => a && typeof a === 'object' && a.title)
        .map((a: any) => ({
          title: String(a.title || '').trim(),
          date: a.date ? String(a.date).trim() : undefined,
          awarder: a.awarder ? String(a.awarder).trim() : undefined,
          summary: a.summary ? String(a.summary).trim() : undefined,
        }))
    : []

  const cleanVolunteer: CVVolunteer[] = Array.isArray(raw.volunteer)
    ? raw.volunteer
        .filter((v: any) => v && typeof v === 'object' && v.organization)
        .map((v: any) => ({
          organization: String(v.organization || '').trim(),
          position: String(v.position || '').trim(),
          url: v.url ? String(v.url).trim() : undefined,
          startDate: v.startDate ? String(v.startDate).trim() : undefined,
          endDate: v.endDate ? String(v.endDate).trim() : undefined,
          summary: v.summary ? String(v.summary).trim() : undefined,
          highlights: Array.isArray(v.highlights)
            ? v.highlights.map((h: any) => String(h).trim()).filter(Boolean)
            : [],
        }))
    : []

  const normalized: CVData = {
    basics: cleanBasics,
    work: cleanWork.length > 0 ? cleanWork : undefined,
    education: cleanEducation.length > 0 ? cleanEducation : undefined,
    projects: cleanProjects.length > 0 ? cleanProjects : undefined,
    skills: cleanSkills.length > 0 ? cleanSkills : undefined,
    languages: cleanLanguages.length > 0 ? cleanLanguages : undefined,
    interests: cleanInterests.length > 0 ? cleanInterests : undefined,
    certificates: cleanCertificates.length > 0 ? cleanCertificates : undefined,
    awards: cleanAwards.length > 0 ? cleanAwards : undefined,
    volunteer: cleanVolunteer.length > 0 ? cleanVolunteer : undefined,
    meta: {
      lastModified: raw.meta?.lastModified || new Date().toISOString(),
      version: '2.0.0',
      theme: raw.meta?.theme || 'executive',
      language: raw.meta?.language || 'pt',
    },
  }

  return { valid: true, data: normalized }
}
