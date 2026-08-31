/**
 * standaloneHtmlService.ts — Gerador e Compilador Standalone HTML & ZIP (Client-Side)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Gera arquivos HTML 100% autônomos, com 5 temas embutidos, layout A4 de alta densidade,
 * alternador dinâmico de temas e botão nativo de impressão A4 sem dependência de servidor.
 */

import JSZip from 'jszip'
import type { CVData, ThemeVariant, LayoutVariant } from '../types/cv'
import { parseYamlToCV } from './yamlService'

function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Retorna o CSS completo embutido para renderização standalone idêntica ao aplicativo.
 */
function getEmbeddedCss(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,400&family=Courier+Prime:wght@400;700&family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #0f172a;
      color: #1e293b;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }

    /* ── Floating Standalone Toolbar ── */
    .cv-standalone-toolbar {
      position: sticky;
      top: 1rem;
      z-index: 100;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      max-width: 860px;
      margin-bottom: 1.5rem;
      padding: 0.75rem 1.25rem;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }

    .cv-toolbar-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 700;
      color: #38bdf8;
      text-decoration: none;
    }

    .cv-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .cv-btn-tool {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .cv-btn-tool:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    .cv-btn-tool--primary {
      background: #0284c7;
      border-color: #0284c7;
      color: #ffffff;
    }

    .cv-btn-tool--primary:hover {
      background: #0369a1;
      border-color: #0369a1;
    }

    .cv-theme-select {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      outline: none;
    }

    /* ── Document Paper Container (A4) ── */
    .cv-sheet-container {
      width: 100%;
      max-width: 860px;
      background: #ffffff;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
      border-radius: 4px;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .cv-sheet-body {
      padding: 2.75rem 3rem;
    }

    /* ── Common Typography & Elements ── */
    .cv-header {
      margin-bottom: 1.5rem;
    }

    .cv-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
    }

    .cv-title-area {
      flex: 1;
    }

    .cv-name {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 0.35rem;
    }

    .cv-label-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .cv-label {
      font-size: 1.05rem;
      font-weight: 600;
    }

    .cv-badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .cv-contact-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
      font-size: 0.84rem;
      margin-top: 0.6rem;
    }

    .cv-contact-item {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      text-decoration: none;
      color: inherit;
    }

    .cv-avatar-box {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid currentColor;
    }

    .cv-avatar-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cv-summary {
      margin-top: 0.85rem;
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .cv-section {
      margin-top: 1.5rem;
      page-break-inside: auto;
    }

    .cv-section-title {
      font-size: 1.05rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .cv-item {
      margin-bottom: 1.15rem;
      page-break-inside: avoid;
    }

    .cv-item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
      margin-bottom: 0.2rem;
    }

    .cv-item-title {
      font-size: 0.98rem;
      font-weight: 700;
    }

    .cv-item-date {
      font-size: 0.82rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .cv-item-sub {
      font-size: 0.88rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
    }

    .cv-item-sub a {
      color: inherit;
      text-decoration: none;
    }

    .cv-item-sub a:hover {
      text-decoration: underline;
    }

    .cv-item-desc {
      font-size: 0.87rem;
      line-height: 1.55;
      margin-bottom: 0.35rem;
    }

    .cv-bullets {
      list-style-type: disc;
      padding-left: 1.25rem;
      font-size: 0.86rem;
      line-height: 1.5;
    }

    .cv-bullets li {
      margin-bottom: 0.25rem;
    }

    .cv-tags-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.3rem;
    }

    .cv-tag {
      font-size: 0.78rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       THEME 1: EXECUTIVE (Merriweather, Classic Navy/Black)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-executive {
      font-family: 'Merriweather', Georgia, serif;
      background: #ffffff;
      color: #111827;
      line-height: 1.6;
    }
    .theme-executive .cv-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 1rem;
    }
    .theme-executive .cv-name {
      font-family: 'Merriweather', Georgia, serif;
      font-weight: 900;
      color: #0f172a;
    }
    .theme-executive .cv-label {
      color: #334155;
    }
    .theme-executive .cv-section-title {
      border-bottom: 1.5px solid #334155;
      padding-bottom: 0.25rem;
      color: #0f172a;
    }
    .theme-executive .cv-badge {
      border: 1px solid #64748b;
      color: #334155;
      background: transparent;
    }
    .theme-executive .cv-tag {
      border: 1px solid #94a3b8;
      background: transparent;
      color: #1e293b;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       THEME 2: CREATIVE (Poppins, Electric Indigo & Purple)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-creative {
      font-family: 'Poppins', sans-serif;
      background: #ffffff;
      color: #1e1b4b;
    }
    .theme-creative .cv-header {
      border-bottom: 2px dashed #6366f1;
      padding-bottom: 1rem;
    }
    .theme-creative .cv-name {
      color: #4338ca;
    }
    .theme-creative .cv-label {
      color: #6366f1;
    }
    .theme-creative .cv-section-title {
      color: #4f46e5;
      border-left: 4px solid #6366f1;
      padding-left: 0.5rem;
    }
    .theme-creative .cv-badge {
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
    }
    .theme-creative .cv-tag {
      background: rgba(99, 102, 241, 0.08);
      color: #4338ca;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       THEME 3: MINIMALIST (Inter, Ultra-Clean Emerald/Cyan)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-minimalist {
      font-family: 'Inter', sans-serif;
      background: #ffffff;
      color: #0f172a;
    }
    .theme-minimalist .cv-header {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1rem;
    }
    .theme-minimalist .cv-name {
      color: #0f172a;
      letter-spacing: -0.03em;
    }
    .theme-minimalist .cv-label {
      color: #0284c7;
    }
    .theme-minimalist .cv-section-title {
      color: #0369a1;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.25rem;
    }
    .theme-minimalist .cv-badge {
      background: #f0fdf4;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .theme-minimalist .cv-tag {
      background: #f1f5f9;
      color: #334155;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       THEME 4: WHITE (Pure Monochrome, Swiss Typography)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-white {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #ffffff;
      color: #000000;
    }
    .theme-white .cv-header {
      border-bottom: 1px solid #000000;
      padding-bottom: 1rem;
    }
    .theme-white .cv-name {
      color: #000000;
    }
    .theme-white .cv-label {
      color: #555555;
    }
    .theme-white .cv-section-title {
      color: #000000;
      border-bottom: 1px solid #000000;
      padding-bottom: 0.25rem;
    }
    .theme-white .cv-badge {
      border: 1px solid #000000;
      color: #000000;
      background: transparent;
    }
    .theme-white .cv-tag {
      border: 1px solid #cccccc;
      color: #000000;
      background: transparent;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       THEME 5: TERMINAL (Courier Prime, Matrix Dark Green)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-terminal {
      font-family: 'Courier Prime', monospace;
      background: #0a0e14;
      color: #00ff66;
    }
    .theme-terminal .cv-sheet-body {
      background: #0a0e14;
    }
    .theme-terminal .cv-header {
      border-bottom: 1px dashed #00ff66;
      padding-bottom: 1rem;
    }
    .theme-terminal .cv-name {
      color: #00ff66;
    }
    .theme-terminal .cv-label {
      color: #38bdf8;
    }
    .theme-terminal .cv-section-title {
      color: #00ff66;
      border-bottom: 1px dashed #00ff66;
      padding-bottom: 0.25rem;
    }
    .theme-terminal .cv-badge {
      border: 1px solid #00ff66;
      color: #00ff66;
      background: transparent;
    }
    .theme-terminal .cv-tag {
      border: 1px solid #38bdf8;
      color: #38bdf8;
      background: transparent;
    }
    .theme-terminal .cv-item-title, .theme-terminal .cv-item-sub, .theme-terminal .cv-summary, .theme-terminal .cv-item-desc {
      color: #bbf7d0;
    }
    .theme-terminal a {
      color: #38bdf8;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       MODELOS DE LAYOUT A4 (Estruturas Wireframe)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .layout-modular .cv-sheet-body {
      padding: 3rem 3.5rem;
    }

    /* Modelo A4 02: Linear (Single Column ATS) */
    .layout-linear .cv-sheet-body {
      padding: 2.2rem 2.8rem;
    }
    .layout-linear .cv-header-top {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
      border-bottom: 2px solid currentColor;
      padding-bottom: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .layout-linear .cv-contact-bar {
      margin-top: 0.3rem;
      gap: 0.8rem;
      font-size: 0.8rem;
    }
    .layout-linear .cv-section {
      margin-bottom: 1.25rem;
    }
    .layout-linear .cv-section-title {
      border-bottom: 1.5px solid currentColor;
      padding-bottom: 0.2rem;
      margin-bottom: 0.65rem;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .layout-linear .cv-item {
      margin-bottom: 0.75rem;
    }

    /* Modelo A4 03: Sidebar (2 Colunas / Modern Split) */
    .layout-sidebar .cv-sheet-body {
      padding: 2.2rem 2.5rem;
    }
    .layout-sidebar .cv-sheet-grid {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 2rem;
      align-items: start;
    }
    .layout-sidebar .cv-sheet-aside {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      border-right: 1.5px solid rgba(125, 125, 125, 0.2);
      padding-right: 1.5rem;
    }
    .layout-sidebar .cv-sheet-main {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Fallback default when not sidebar */
    .layout-modular .cv-sheet-grid,
    .layout-linear .cv-sheet-grid {
      display: block;
    }
    .layout-modular .cv-sheet-aside,
    .layout-linear .cv-sheet-aside {
      border-right: none;
      padding-right: 0;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       PRINT MEDIA QUERY (Exact A4 PDF Output)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 15mm;
      }

      body {
        background: #ffffff !important;
        padding: 0 !important;
        color: #000000 !important;
      }

      .cv-standalone-toolbar {
        display: none !important;
      }

      .cv-sheet-container {
        max-width: 100% !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }

      .cv-sheet-body {
        padding: 0 !important;
      }

      .cv-item, .cv-section {
        page-break-inside: avoid;
      }
    }
  `
}

/**
 * Converte um objeto CVData em HTML estruturado completo.
 */
export function renderCVToStandaloneHtml(
  data: CVData,
  theme: ThemeVariant = 'executive',
  rawYaml?: string,
  layout: LayoutVariant = 'modular'
): string {
  const basics = data.basics || { name: 'Currículo Profissional' }
  const work = data.work || []
  const projects = data.projects || []
  const skills = data.skills || []
  const education = data.education || []
  const languages = data.languages || []
  const certificates = data.certificates || []
  const awards = data.awards || []
  const volunteer = data.volunteer || []
  const interests = data.interests || []

  const candidateName = escapeHtml(basics.name || 'Currículo Profissional')
  const candidateLabel = escapeHtml(basics.label || '')
  const candidateEmail = escapeHtml(basics.email || '')
  const candidatePhone = escapeHtml(basics.phone || '')
  const candidateUrl = escapeHtml(basics.url || '')
  const candidateSummary = escapeHtml(basics.summary || '')

  const locParts = [basics.location?.city, basics.location?.region, basics.location?.countryCode].filter(Boolean)
  const locStr = escapeHtml(locParts.join(' - '))

  // Custom badges
  const badgesHtml = (basics.customBadges || [])
    .map(b => `<span class="cv-badge">${escapeHtml(b)}</span>`)
    .join('')

  // Profiles
  const profilesHtml = (basics.profiles || [])
    .map(p => `<a href="${escapeHtml(p.url)}" target="_blank" class="cv-contact-item">🔗 ${escapeHtml(p.network)}: @${escapeHtml(p.username)}</a>`)
    .join('')

  // Work items
  const workHtml = work.map(w => {
    const start = escapeHtml(w.startDate || '')
    const end = escapeHtml(w.endDate || 'Presente')
    const highlights = (w.highlights || []).map(h => `<li>${escapeHtml(h)}</li>`).join('')
    const compLink = w.url ? `<a href="${escapeHtml(w.url)}" target="_blank">${escapeHtml(w.name)} ↗</a>` : escapeHtml(w.name)
    return `
      <div class="cv-item">
        <div class="cv-item-header">
          <span class="cv-item-title">${escapeHtml(w.position)}</span>
          <span class="cv-item-date">${start} — ${end}</span>
        </div>
        <div class="cv-item-sub">${compLink}</div>
        ${w.summary ? `<p class="cv-item-desc">${escapeHtml(w.summary)}</p>` : ''}
        ${highlights ? `<ul class="cv-bullets">${highlights}</ul>` : ''}
      </div>
    `
  }).join('')

  // Projects
  const projectsHtml = projects.map(p => {
    const highlights = (p.highlights || []).map(h => `<li>${escapeHtml(h)}</li>`).join('')
    const tags = (p.keywords || []).map(k => `<span class="cv-tag">${escapeHtml(k)}</span>`).join('')
    const prLink = p.url ? `<a href="${escapeHtml(p.url)}" target="_blank">${escapeHtml(p.name)} ↗</a>` : escapeHtml(p.name)
    return `
      <div class="cv-item">
        <div class="cv-item-header">
          <span class="cv-item-title">${prLink}</span>
        </div>
        ${p.description ? `<p class="cv-item-desc">${escapeHtml(p.description)}</p>` : ''}
        ${highlights ? `<ul class="cv-bullets">${highlights}</ul>` : ''}
        ${tags ? `<div class="cv-tags-cloud">${tags}</div>` : ''}
      </div>
    `
  }).join('')

  // Skills
  const skillsHtml = skills.map(s => {
    const tags = (s.keywords || []).map(k => `<span class="cv-tag">${escapeHtml(k)}</span>`).join('')
    return `
      <div class="cv-item" style="margin-bottom: 0.75rem;">
        <div style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.2rem;">
          ${escapeHtml(s.name)} ${s.level ? `<span style="font-size: 0.75rem; font-weight: 500; opacity: 0.8;">(${escapeHtml(s.level)})</span>` : ''}
        </div>
        ${tags ? `<div class="cv-tags-cloud">${tags}</div>` : ''}
      </div>
    `
  }).join('')

  // Education
  const educationHtml = education.map(e => {
    const start = escapeHtml(e.startDate || '')
    const end = escapeHtml(e.endDate || 'Presente')
    return `
      <div class="cv-item">
        <div class="cv-item-header">
          <span class="cv-item-title">${escapeHtml(e.institution)}</span>
          <span class="cv-item-date">${start} — ${end}</span>
        </div>
        <div class="cv-item-sub">${escapeHtml(e.studyType || '')}${e.area ? ` em ${escapeHtml(e.area)}` : ''}</div>
      </div>
    `
  }).join('')

  // Languages
  const languagesHtml = languages.map(l => {
    return `<span class="cv-tag" style="border: 1px solid currentColor; font-weight: 600;">${escapeHtml(l.language)}: ${escapeHtml(l.fluency)}</span>`
  }).join(' ')

  // Certificates
  const certificatesHtml = certificates.map(c => {
    const link = c.url ? `<a href="${escapeHtml(c.url)}" target="_blank">${escapeHtml(c.name)} ↗</a>` : escapeHtml(c.name)
    return `
      <div class="cv-item" style="margin-bottom: 0.5rem;">
        <div class="cv-item-header">
          <span class="cv-item-title">${link}</span>
          ${c.date ? `<span class="cv-item-date">${escapeHtml(c.date)}</span>` : ''}
        </div>
        ${c.issuer ? `<div class="cv-item-sub" style="font-size: 0.82rem; opacity: 0.85;">Emissor: ${escapeHtml(c.issuer)}</div>` : ''}
      </div>
    `
  }).join('')

  // Awards
  const awardsHtml = awards.map(a => {
    return `
      <div class="cv-item" style="margin-bottom: 0.5rem;">
        <div class="cv-item-header">
          <span class="cv-item-title">🏆 ${escapeHtml(a.title)}</span>
          ${a.date ? `<span class="cv-item-date">${escapeHtml(a.date)}</span>` : ''}
        </div>
        ${a.awarder ? `<div class="cv-item-sub" style="font-size: 0.82rem;">${escapeHtml(a.awarder)}</div>` : ''}
        ${a.summary ? `<p class="cv-item-desc">${escapeHtml(a.summary)}</p>` : ''}
      </div>
    `
  }).join('')

  // Volunteer
  const volunteerHtml = volunteer.map(v => {
    const start = escapeHtml(v.startDate || '')
    const end = escapeHtml(v.endDate || 'Presente')
    return `
      <div class="cv-item" style="margin-bottom: 0.5rem;">
        <div class="cv-item-header">
          <span class="cv-item-title">🤝 ${escapeHtml(v.position)} — ${escapeHtml(v.organization)}</span>
          <span class="cv-item-date">${start} — ${end}</span>
        </div>
        ${v.summary ? `<p class="cv-item-desc">${escapeHtml(v.summary)}</p>` : ''}
      </div>
    `
  }).join('')

  // Interests
  const interestsHtml = interests.map(i => {
    const kws = (i.keywords || []).join(', ')
    return `<span class="cv-tag">${escapeHtml(i.name)}${kws ? ` (${escapeHtml(kws)})` : ''}</span>`
  }).join(' ')

  const yamlDownloadContent = rawYaml ? escapeHtml(rawYaml) : ''

  const phoneClean = candidatePhone ? candidatePhone.replace(/\D/g, '') : ''
  const displayUrl = candidateUrl ? candidateUrl.replace(/^https?:\/\//, '') : ''
  const downloadFileName = candidateName.toLowerCase().replace(/\s+/g, '-') + '-curriculo.yaml'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${candidateName} - ${candidateLabel || 'Currículo'}</title>
  <style>
${getEmbeddedCss()}
  </style>
</head>
<body>

  <!-- Floating Standalone Action Bar -->
  <div class="cv-standalone-toolbar">
    <a href="https://www.heisslab.com.br/laboratorio/cv-maker" target="_blank" class="cv-toolbar-brand">
      ⚡ CV Maker 2.0
    </a>
    <div class="cv-toolbar-actions">
      <label style="font-size: 0.78rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 0.3rem;">
        Modelo A4:
        <select class="cv-theme-select" id="layoutSelector" onchange="changeLayout(this.value)">
          <option value="modular" ${layout === 'modular' ? 'selected' : ''}>📐 Modelo A4 01 (Modular)</option>
          <option value="linear" ${layout === 'linear' ? 'selected' : ''}>📄 Modelo A4 02 (Linear)</option>
          <option value="sidebar" ${layout === 'sidebar' ? 'selected' : ''}>📑 Modelo A4 03 (Sidebar)</option>
        </select>
      </label>

      <label style="font-size: 0.78rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 0.3rem;">
        Tema Visual:
        <select class="cv-theme-select" id="themeSelector" onchange="changeTheme(this.value)">
          <option value="executive" ${theme === 'executive' ? 'selected' : ''}>👔 Executivo</option>
          <option value="creative" ${theme === 'creative' ? 'selected' : ''}>🎨 Criativo</option>
          <option value="minimalist" ${theme === 'minimalist' ? 'selected' : ''}>🔹 Minimalista</option>
          <option value="white" ${theme === 'white' ? 'selected' : ''}>📄 White</option>
          <option value="terminal" ${theme === 'terminal' ? 'selected' : ''}>&gt;_ Terminal</option>
        </select>
      </label>
      <button class="cv-btn-tool cv-btn-tool--primary" onclick="window.print()" title="Imprimir em A4 ou salvar como PDF nativo">
        🖨️ Imprimir PDF
      </button>
      <button class="cv-btn-tool" onclick="downloadCurrentYaml()" title="Baixar arquivo YAML fonte">
        📥 Baixar .yaml
      </button>
    </div>
  </div>

  <!-- A4 Paper Document -->
  <div class="cv-sheet-container layout-${layout}" id="cvContainer">
    <div class="cv-sheet-body theme-${theme}" id="cvBody">
      
      <!-- Header Area -->
      <header class="cv-header">
        <div class="cv-header-top">
          <div class="cv-title-area">
            <h1 class="cv-name">${candidateName}</h1>
            <div class="cv-label-row">
              ${candidateLabel ? `<span class="cv-label">${candidateLabel}</span>` : ''}
              ${badgesHtml}
            </div>
          </div>
          ${basics.image ? `
            <div class="cv-avatar-box">
              <img src="${escapeHtml(basics.image)}" alt="${candidateName}">
            </div>
          ` : ''}
        </div>

        <div class="cv-contact-bar">
          ${candidateEmail ? `<a href="mailto:${candidateEmail}" class="cv-contact-item">✉️ ${candidateEmail}</a>` : ''}
          ${candidatePhone ? `<a href="tel:${phoneClean}" class="cv-contact-item">📱 ${candidatePhone}</a>` : ''}
          ${locStr ? `<span class="cv-contact-item">📍 ${locStr}</span>` : ''}
          ${candidateUrl ? `<a href="${candidateUrl}" target="_blank" class="cv-contact-item">🌐 ${displayUrl}</a>` : ''}
        </div>

        ${profilesHtml ? `<div class="cv-contact-bar" style="margin-top: 0.4rem;">${profilesHtml}</div>` : ''}

        ${candidateSummary ? `<p class="cv-summary">${candidateSummary}</p>` : ''}
      </header>

      <!-- Work Experience -->
      ${work.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">💼 Experiência Profissional</h2>
          ${workHtml}
        </section>
      ` : ''}

      <!-- Featured Projects -->
      ${projects.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">🚀 Projetos em Destaque</h2>
          ${projectsHtml}
        </section>
      ` : ''}

      <!-- Skills -->
      ${skills.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">⚡ Habilidades & Competências</h2>
          ${skillsHtml}
        </section>
      ` : ''}

      <!-- Education -->
      ${education.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">🎓 Formação Acadêmica</h2>
          ${educationHtml}
        </section>
      ` : ''}

      <!-- Certifications -->
      ${certificates.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">📜 Certificações & Licenças</h2>
          ${certificatesHtml}
        </section>
      ` : ''}

      <!-- Awards -->
      ${awards.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">🏆 Prêmios & Reconhecimentos</h2>
          ${awardsHtml}
        </section>
      ` : ''}

      <!-- Volunteer -->
      ${volunteer.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">🤝 Voluntariado & Projetos Sociais</h2>
          ${volunteerHtml}
        </section>
      ` : ''}

      <!-- Languages -->
      ${languages.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">🌐 Idiomas</h2>
          <div class="cv-tags-cloud">${languagesHtml}</div>
        </section>
      ` : ''}

      <!-- Interests -->
      ${interests.length > 0 ? `
        <section class="cv-section">
          <h2 class="cv-section-title">🎯 Interesses & Pesquisa</h2>
          <div class="cv-tags-cloud">${interestsHtml}</div>
        </section>
      ` : ''}

    </div>
  </div>

  <script>
    function changeLayout(layoutName) {
      var container = document.getElementById('cvContainer');
      if (container) {
        container.className = 'cv-sheet-container layout-' + layoutName;
      }
    }

    function changeTheme(themeName) {
      var bodyEl = document.getElementById('cvBody');
      if (bodyEl) {
        bodyEl.className = 'cv-sheet-body theme-' + themeName;
      }
    }

    function downloadCurrentYaml() {
      var yamlData = document.getElementById('rawYamlStore') ? document.getElementById('rawYamlStore').textContent : '';
      if (!yamlData) {
        alert('YAML não embutido neste arquivo.');
        return;
      }
      var blob = new Blob([yamlData], { type: 'text/yaml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '${downloadFileName}';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>

  <script type="text/plain" id="rawYamlStore">${yamlDownloadContent}</script>
</body>
</html>`
}

/**
 * Dispara o download de um arquivo HTML Standalone no navegador
 */
export function downloadCVHtmlFile(params: {
  yaml: string
  name: string
  persona?: string
  theme?: ThemeVariant
  layout?: LayoutVariant
}): void {
  const parsed = parseYamlToCV(params.yaml)
  if (!parsed.data) {
    alert('Erro ao converter YAML para HTML: formato inválido.')
    return
  }

  const htmlContent = renderCVToStandaloneHtml(
    parsed.data,
    params.theme || 'executive',
    params.yaml,
    params.layout || 'modular'
  )

  const cleanName = params.name.toLowerCase().replace(/\s+/g, '-') || 'curriculo'
  const personaSuffix = params.persona ? `-${params.persona}` : ''
  const filename = `curriculo-${cleanName}${personaSuffix}.html`

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Dispara o download de um pacote ZIP contendo o HTML Standalone e o YAML estruturado
 */
export async function downloadCVZipPackage(params: {
  yaml: string
  name: string
  persona?: string
  theme?: ThemeVariant
  layout?: LayoutVariant
}): Promise<void> {
  try {
    const parsed = parseYamlToCV(params.yaml)
    const cleanName = params.name.toLowerCase().replace(/\s+/g, '-') || 'curriculo'
    const personaSuffix = params.persona ? `-${params.persona}` : ''
    const baseName = `curriculo-${cleanName}${personaSuffix}`

    const htmlContent = parsed.data
      ? renderCVToStandaloneHtml(parsed.data, params.theme || 'executive', params.yaml, params.layout || 'modular')
      : '<html><body><pre>' + escapeHtml(params.yaml) + '</pre></body></html>'

    const zip = new JSZip()
    zip.file(`${baseName}.html`, htmlContent)
    zip.file(`${baseName}.yaml`, params.yaml)
    const readmeText = [
      'CV Maker 2.0 - Pacote de Curriculo Profissional',
      '================================================================',
      `Candidato: ${params.name}`,
      `Data de Exportacao: ${new Date().toLocaleString('pt-BR')}`,
      `Modelo A4: ${params.layout || 'modular'}`,
      `Tema Visual: ${params.theme || 'executive'}`,
      'Formato: JSON Resume Standard v1.0.0 (YAML & Standalone HTML)',
      '',
      'Arquivos incluidos:',
      `1. ${baseName}.html -> Curriculo Standalone interativo pronto para abrir no navegador e imprimir em PDF A4.`,
      `2. ${baseName}.yaml -> Fonte unica de verdade dos dados estruturados.`,
      '',
      'Gerado com tecnologia LogicDefense & HeissLab: https://www.heisslab.com.br/laboratorio/cv-maker'
    ].join('\n')

    zip.file('LEIAME.txt', readmeText)

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}-completo.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Falha ao gerar ZIP local:', err)
    alert('Nao foi possivel gerar o arquivo ZIP. Baixando versao YAML como alternativa.')
    const blob = new Blob([params.yaml], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `curriculo-${params.name.toLowerCase().replace(/\s+/g, '-')}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }
}
