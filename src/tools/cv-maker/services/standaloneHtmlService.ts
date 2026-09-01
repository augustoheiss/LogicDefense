/**
 * standaloneHtmlService.ts — Gerador e Compilador Standalone HTML & ZIP (Client-Side)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Gera arquivos HTML 100% autônomos com suporte aos 8 Modelos A4, 5 Temas Visuais,
 * Cover Letter integrada e Dossiê completo de 2 páginas com quebra A4 offline.
 */

import JSZip from 'jszip'
import type { CVData, ThemeVariant, LayoutVariant, ViewMode, CVDesignConfig } from '../types/cv'
import { LAYOUT_OPTIONS, getSkillPercentage } from '../types/cv'
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
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800;900&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Fira+Code:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,400&family=Montserrat:wght@400;500;600;700;800&family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Poppins:wght@300;400;500;600;700;800&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: A4 portrait;
      margin: 0;
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
      max-width: 900px;
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
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .cv-select-control {
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #475569;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }

    .cv-toolbar-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .cv-toolbar-btn--primary {
      background: #0284c7;
      color: #ffffff;
    }

    .cv-toolbar-btn--primary:hover {
      background: #0369a1;
    }

    .cv-toolbar-btn--secondary {
      background: #334155;
      color: #f8fafc;
    }

    .cv-toolbar-btn--secondary:hover {
      background: #475569;
    }

    /* ── Folha A4 e Container ── */
    .cv-sheet-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
    }

    .cv-page-a4 {
      width: 100%;
      max-width: 210mm;
      min-height: 297mm;
      margin-bottom: 2rem;
      box-sizing: border-box;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
      border-radius: 4px;
      position: relative;
      background: #ffffff;
    }

    .cv-cover-letter-page {
      break-before: page;
      page-break-before: always;
    }

    .cv-card {
      padding: 2rem 2.25rem;
      min-height: 100%;
      box-sizing: border-box;
      width: 100%;
    }

    /* ── Controles de Visibilidade das Folhas ── */
    .view-cv .cv-cover-letter-page { display: none !important; }
    .view-cover_letter .cv-resume-page { display: none !important; }
    .view-both .cv-resume-page,
    .view-both .cv-cover-letter-page { display: block !important; }

    /* ── Regras de Impressão ── */
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .cv-standalone-toolbar, .no-print {
        display: none !important;
      }
      .cv-sheet-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .cv-page-a4 {
        width: 100% !important;
        max-width: 100% !important;
        min-height: 297mm !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .cv-card {
        padding: 0 !important;
      }
      .cv-cover-letter-page {
        page-break-before: always !important;
        break-before: page !important;
      }
    }

    /* ── Tipografia e Elementos ── */
    .cv-name { font-size: 1.8rem; font-weight: 800; line-height: 1.15; }
    .cv-badge { display: inline-flex; align-items: center; font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 0.25rem; border: 1px solid currentColor; }
    .cv-section-title { font-size: 1.05rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.04em; }
    .cv-summary { font-size: 0.88rem; line-height: 1.55; margin-bottom: 1.25rem; }
    .cv-bullets { margin: 0.35rem 0 0.5rem 1.2rem; font-size: 0.85rem; line-height: 1.45; }
    
    .cv-skill-bar-wrapper { margin-bottom: 0.55rem; }
    .cv-skill-bar-label { display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.2rem; }
    .cv-skill-bar-bg { width: 100%; height: 6px; background: rgba(125, 125, 125, 0.2); border-radius: 9999px; overflow: hidden; }
    .cv-skill-bar-fill { height: 100%; border-radius: 9999px; background: currentColor; }

    .cv-references-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
    .cv-ref-card { padding: 0.65rem 0.85rem; border-radius: 0.35rem; border-left: 2.5px solid currentColor; background: rgba(125, 125, 125, 0.04); font-size: 0.82rem; }

    .cv-signature-cursive { font-family: 'Caveat', cursive, sans-serif; font-size: 2.2rem; line-height: 1.1; margin-top: 0.5rem; }
    .cv-signature-img { max-height: 52px; max-width: 180px; object-fit: contain; margin-top: 0.4rem; }

    /* ── Grids de Cards com Proteção Anti-Transbordamento ── */
    .cv-languages-grid,
    .cv-skills-grid,
    .cv-projects-grid,
    .cv-education-grid,
    .cv-certs-grid,
    .cv-awards-grid,
    .cv-interests-grid,
    .cv-references-grid {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .cv-language-card,
    .cv-skills-group,
    .cv-project-card,
    .cv-education-card,
    .cv-cert-card,
    .cv-award-card,
    .cv-interest-card,
    .cv-ref-card {
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .cv-grid-1 { display: grid; grid-template-columns: 1fr; gap: 0.75rem; width: 100%; }
    .cv-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; width: 100%; }
    .cv-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; width: 100%; }
    .cv-grid-4 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; width: 100%; }
    .cv-grid-5, .cv-grid-split-3-2 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.75rem; width: 100%; }
    .cv-grid-5 > *, .cv-grid-split-3-2 > * { grid-column: span 2; }
    .cv-grid-5 > *:nth-last-child(2):nth-child(3n+4), .cv-grid-5 > *:last-child:nth-child(3n+5),
    .cv-grid-split-3-2 > *:nth-last-child(2):nth-child(3n+4), .cv-grid-split-3-2 > *:last-child:nth-child(3n+5) { grid-column: span 3; }

    .cv-tags, .cv-skill-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; max-width: 100%; }
    .cv-tag, .cv-skill-tag { font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 0.25rem; white-space: normal; word-break: break-word; max-width: 100%; }

    /* ── Layouts Wireframe & Contenção de Sidebar ── */
    .layout-sidebar .cv-sidebar-layout,
    .layout-compact_split .cv-duo-layout,
    .layout-corporate_timeline .cv-navy-layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 2rem;
      align-items: start;
    }
    .layout-corporate_timeline .cv-navy-sidebar { background: #0f172a; color: #f8fafc; padding: 2.2rem 1.5rem; }
    .layout-editorial_accent .cv-editorial-grid { display: grid; grid-template-columns: 220px 1fr; gap: 1.75rem; }
    .layout-editorial_accent .cv-brand-greeting { padding: 0.3rem 0.6rem; background: currentColor; color: #fff; border-radius: 4px; font-weight: 800; }
    .layout-hero_matrix .cv-hero-banner { display: grid; grid-template-columns: 1fr 120px; gap: 1.5rem; background: rgba(125,125,125,0.06); padding: 1.25rem; border-radius: 6px; }

    /* Contenção de Sidebar */
    .cv-sidebar-col, .cv-duo-left, .cv-navy-sidebar, .cv-editorial-grid aside {
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
    }
    .cv-sidebar-col .cv-languages-grid, .cv-duo-left .cv-languages-grid, .cv-navy-sidebar .cv-languages-grid, .cv-editorial-grid aside .cv-languages-grid,
    .cv-sidebar-col .cv-skills-grid, .cv-duo-left .cv-skills-grid, .cv-navy-sidebar .cv-skills-grid, .cv-editorial-grid aside .cv-skills-grid,
    .cv-sidebar-col .cv-interests-grid, .cv-duo-left .cv-interests-grid, .cv-navy-sidebar .cv-interests-grid, .cv-editorial-grid aside .cv-interests-grid {
      display: flex !important;
      flex-direction: column !important;
      grid-template-columns: 1fr !important;
      width: 100% !important;
      max-width: 100% !important;
      gap: 0.5rem !important;
    }
    .cv-sidebar-col .cv-language-card, .cv-duo-left .cv-language-card, .cv-navy-sidebar .cv-language-card, .cv-editorial-grid aside .cv-language-card {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 0.35rem !important;
      flex-wrap: wrap !important;
    }
    .cv-sidebar-col .cv-contacts, .cv-duo-left .cv-contacts, .cv-navy-sidebar .cv-contacts, .cv-editorial-grid aside .cv-contacts, .cv-sidebar-contacts {
      text-align: left !important;
      align-items: flex-start !important;
      width: 100% !important;
      max-width: 100% !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
    }
    .cv-sidebar-col a, .cv-duo-left a, .cv-navy-sidebar a, .cv-editorial-grid aside a {
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
    }

    /* ── Temas ── */
    .theme-executive { background: #ffffff; color: #0f172a; }
    .theme-executive .cv-name, .theme-executive .cv-section-title { color: #0369a1; }

    .theme-creative { background: #ffffff; color: #1e1b4b; }
    .theme-creative .cv-name, .theme-creative .cv-section-title { color: #ea580c; }

    .theme-minimalist { background: #ffffff; color: #18181b; }
    .theme-minimalist .cv-name, .theme-minimalist .cv-section-title { color: #3f3f46; }

    .theme-white { background: #ffffff; color: #1e293b; }
    .theme-white .cv-name, .theme-white .cv-section-title { color: #059669; }

    .theme-terminal { background: #090d16; color: #4ade80; }
    .theme-terminal .cv-name, .theme-terminal .cv-section-title { color: #22c55e; }
  `
}

/**
 * Renderiza o currículo para um arquivo HTML Standalone offline e autocontido.
 */
export function renderCVToStandaloneHtml(
  data: CVData,
  theme: ThemeVariant = 'executive',
  rawYaml?: string,
  layout: LayoutVariant = 'modular',
  viewMode: ViewMode = 'cv',
  designConfig?: CVDesignConfig
): string {
  const basics = data.basics || { name: 'Candidato' }
  const work = data.work || []
  const education = data.education || []
  const projects = data.projects || []
  const skills = data.skills || []
  const languages = data.languages || []
  const interests = data.interests || []
  const references = data.references || []
  const coverLetter = data.coverLetter

  const locationStr = basics.location
    ? [basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(', ')
    : ''

  const safeYaml = rawYaml ? escapeHtml(rawYaml) : ''

  const customStyleVars = `
    --cv-avatar-pos-x: ${basics.imagePosX ?? 50}%;
    --cv-avatar-pos-y: ${basics.imagePosY ?? 50}%;
    --cv-avatar-scale: ${basics.imageScale ?? 1.0};
    ${designConfig ? `
    --cv-font-heading: "${designConfig.fontHeading}", sans-serif;
    --cv-font-body: "${designConfig.fontBody}", sans-serif;
    --cv-font-scale: ${designConfig.fontScale};
    --cv-font-size-base: ${designConfig.fontSizeBase};
    --cv-color-primary: ${designConfig.colorPrimary};
    --cv-color-secondary: ${designConfig.colorSecondary};
    --cv-color-text: ${designConfig.colorText};
    --cv-color-text-muted: ${designConfig.colorTextMuted};
    --cv-color-bg: ${designConfig.colorBg};
    --cv-color-surface: ${designConfig.colorSurface};
    --cv-color-border: ${designConfig.colorBorder};
    --cv-color-accent: ${designConfig.colorAccent};
    ${designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none' ? `--cv-bg-image: url('${designConfig.backgroundPattern}');` : ''}
    ` : ''}
  `

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(basics.name)} — Currículo & Cover Letter</title>
  <style>${getEmbeddedCss()}</style>
</head>
<body id="cvBody" class="theme-${theme}" style="${customStyleVars}">

  <!-- Floating Offline Toolbar -->
  <div class="cv-standalone-toolbar no-print">
    <a href="https://www.heisslab.com.br/laboratorio/cv-maker" target="_blank" class="cv-toolbar-brand">
      <span>⚡</span>
      <span>CV Maker 2.0 • LogicDefense</span>
    </a>

    <div class="cv-toolbar-actions">
      <!-- Seletor de Modo de Visualização -->
      <select id="viewModeSelector" class="cv-select-control" onchange="changeViewMode(this.value)">
        <option value="cv" ${viewMode === 'cv' ? 'selected' : ''}>📄 Currículo A4</option>
        <option value="cover_letter" ${viewMode === 'cover_letter' ? 'selected' : ''}>✉️ Cover Letter</option>
        <option value="both" ${viewMode === 'both' ? 'selected' : ''}>📑 Dossiê (2 Páginas)</option>
      </select>

      <!-- Seletor de Modelo A4 -->
      <select id="layoutSelector" class="cv-select-control" onchange="changeLayout(this.value)">
        ${LAYOUT_OPTIONS.map(l => `<option value="${l.id}" ${layout === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}
      </select>

      <!-- Seletor de Tema Visual -->
      <select id="themeSelector" class="cv-select-control" onchange="changeTheme(this.value)">
        <option value="executive" ${theme === 'executive' ? 'selected' : ''}>👔 Executivo</option>
        <option value="creative" ${theme === 'creative' ? 'selected' : ''}>🎨 Criativo</option>
        <option value="minimalist" ${theme === 'minimalist' ? 'selected' : ''}>🔹 Minimalista</option>
        <option value="white" ${theme === 'white' ? 'selected' : ''}>📄 White</option>
        <option value="terminal" ${theme === 'terminal' ? 'selected' : ''}>>_ Terminal</option>
      </select>

      <button onclick="window.print()" class="cv-toolbar-btn cv-toolbar-btn--primary">
        <span>🖨️</span> Imprimir PDF
      </button>

      ${safeYaml ? `<button onclick="downloadCurrentYaml()" class="cv-toolbar-btn cv-toolbar-btn--secondary"><span>📥</span> YAML</button>` : ''}
    </div>
  </div>

  <!-- Contêiner de Folhas A4 -->
  <div id="cvContainer" class="cv-sheet-container layout-${layout} view-${viewMode}">
    
    <!-- 1. Folha de Currículo A4 -->
    <div class="cv-page-a4 cv-resume-page">
      <div class="cv-card">
        <header class="cv-header" style="margin-bottom: 1.5rem;">
          <h1 class="cv-name">${escapeHtml(basics.name)}</h1>
          <div style="font-size: 1rem; font-weight: 600; opacity: 0.85;">${escapeHtml(basics.label)}</div>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.5rem; font-size: 0.82rem;">
            ${basics.email ? `<span>✉ ${escapeHtml(basics.email)}</span>` : ''}
            ${basics.phone ? `<span>📞 ${escapeHtml(basics.phone)}</span>` : ''}
            ${locationStr ? `<span>📍 ${escapeHtml(locationStr)}</span>` : ''}
          </div>
        </header>

        ${basics.summary ? `<div class="cv-summary">${escapeHtml(basics.summary)}</div>` : ''}

        ${work.length > 0 ? `
          <section class="cv-section">
            <h2 class="cv-section-title">💼 Experiência Profissional</h2>
            ${work.map(w => `
              <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; font-weight: 700;">
                  <span>${escapeHtml(w.position)}</span>
                  <span style="font-size: 0.8rem; opacity: 0.8;">${escapeHtml(w.startDate)} — ${escapeHtml(w.endDate || 'Presente')}</span>
                </div>
                <div style="font-size: 0.85rem; font-weight: 600; opacity: 0.85;">${escapeHtml(w.name)}</div>
                ${w.summary ? `<p style="font-size: 0.85rem; margin: 0.25rem 0;">${escapeHtml(w.summary)}</p>` : ''}
                ${w.highlights ? `<ul class="cv-bullets">${w.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>` : ''}
              </div>
            `).join('')}
          </section>
        ` : ''}

        ${skills.length > 0 ? `
          <section class="cv-section">
            <h2 class="cv-section-title">⚡ Competências & Habilidades</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
              ${skills.map(s => {
                const percent = getSkillPercentage(s.level, s.levelPercent)
                return `
                  <div class="cv-skill-bar-wrapper">
                    <div class="cv-skill-bar-label">
                      <span>${escapeHtml(s.name)}</span>
                      <span>${percent}%</span>
                    </div>
                    <div class="cv-skill-bar-bg">
                      <div class="cv-skill-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </section>
        ` : ''}

        ${education.length > 0 ? `
          <section class="cv-section">
            <h2 class="cv-section-title">🎓 Educação</h2>
            ${education.map(e => `
              <div style="margin-bottom: 0.5rem; font-size: 0.85rem;">
                <strong>${escapeHtml(e.area || '')}</strong> — ${escapeHtml(e.institution)} (${escapeHtml(e.startDate || '')} - ${escapeHtml(e.endDate || 'Concluído')})
              </div>
            `).join('')}
          </section>
        ` : ''}

        ${projects.length > 0 ? `
          <section class="cv-section">
            <h2 class="cv-section-title">🚀 Projetos Destacados</h2>
            ${projects.map(pr => `
              <div style="margin-bottom: 0.85rem;">
                <div style="font-weight: 700;">${escapeHtml(pr.name)}</div>
                ${pr.description ? `<p style="font-size: 0.85rem; margin: 0.2rem 0;">${escapeHtml(pr.description)}</p>` : ''}
                ${pr.highlights ? `<ul class="cv-bullets">${pr.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>` : ''}
              </div>
            `).join('')}
          </section>
        ` : ''}

        ${languages.length > 0 ? `
          <section class="cv-section">
            <h2 class="cv-section-title">🌐 Idiomas</h2>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.85rem;">
              ${languages.map(l => `
                <div style="padding: 0.25rem 0.6rem; border-radius: 4px; border: 1px solid currentColor;">
                  <strong>${escapeHtml(l.language)}:</strong> ${escapeHtml(l.fluency)}
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        ${interests.length > 0 ? `
          <section class="cv-section">
            <h2 class="cv-section-title">🎯 Interesses</h2>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem;">
              ${interests.map(i => `
                <span class="cv-badge">${escapeHtml(i.name)}</span>
              `).join('')}
            </div>
          </section>
        ` : ''}

        ${references.length > 0 ? `
          <section class="cv-section">
            <h2 class="cv-section-title">🤝 Referências</h2>
            <div class="cv-references-grid">
              ${references.map(r => `
                <div class="cv-ref-card">
                  <div style="font-weight: 700;">${escapeHtml(r.name)}</div>
                  <div style="font-size: 0.78rem; opacity: 0.85;">${escapeHtml(r.position || '')} • ${escapeHtml(r.company || '')}</div>
                  <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.2rem;">${escapeHtml(r.phone || '')} ${escapeHtml(r.email || '')}</div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}
      </div>
    </div>

    <!-- 2. Folha de Cover Letter A4 -->
    ${coverLetter && coverLetter.paragraphs && coverLetter.paragraphs.length > 0 ? `
      <div class="cv-page-a4 cv-cover-letter-page">
        <div class="cv-card">
          <header class="cv-header" style="border-bottom: 1px solid rgba(125,125,125,0.25); padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <h1 class="cv-name">${escapeHtml(basics.name)}</h1>
            <div style="font-size: 0.95rem; font-weight: 600; opacity: 0.85;">${escapeHtml(basics.label)}</div>
          </header>

          ${coverLetter.recipient ? `
            <div style="margin-bottom: 1.25rem; font-size: 0.88rem; line-height: 1.45; border-left: 2.5px solid currentColor; padding-left: 0.75rem;">
              <div style="font-weight: 700;">${escapeHtml(coverLetter.recipient.name)}</div>
              <div>${escapeHtml(coverLetter.recipient.title || '')}</div>
              <div style="font-weight: 600;">${escapeHtml(coverLetter.recipient.company || '')}</div>
              <div style="font-size: 0.8rem; opacity: 0.8;">${escapeHtml(coverLetter.recipient.address || '')}</div>
            </div>
          ` : ''}

          ${coverLetter.date ? `<div style="font-size: 0.82rem; font-weight: 600; opacity: 0.8; margin-bottom: 0.75rem;">📅 ${escapeHtml(coverLetter.date)}</div>` : ''}

          <main style="font-size: 0.9rem; line-height: 1.65;">
            <h2 class="cv-section-title">Carta de Apresentação</h2>
            ${coverLetter.subject ? `<div style="font-weight: 700; margin-bottom: 0.75rem;">${escapeHtml(coverLetter.subject)}</div>` : ''}
            ${coverLetter.salutation ? `<div style="font-weight: 600; margin-bottom: 0.75rem;">${escapeHtml(coverLetter.salutation)}</div>` : ''}
            ${coverLetter.paragraphs.map(p => `<p style="margin-bottom: 0.85rem; text-align: justify;">${escapeHtml(p)}</p>`).join('')}
            ${coverLetter.closing ? `<div style="margin-top: 1.25rem; font-weight: 600;">${escapeHtml(coverLetter.closing)}</div>` : ''}
            <div class="cv-signature-cursive">${escapeHtml(coverLetter.signature || basics.name)}</div>
            <div style="font-weight: 700; font-size: 0.88rem; margin-top: 0.2rem;">${escapeHtml(coverLetter.signature || basics.name)}</div>
          </main>
        </div>
      </div>
    ` : ''}

  </div>

  <script>
    function changeViewMode(mode) {
      var container = document.getElementById('cvContainer');
      if (container) {
        container.classList.remove('view-cv', 'view-cover_letter', 'view-both');
        container.classList.add('view-' + mode);
      }
    }

    function changeLayout(layoutName) {
      var container = document.getElementById('cvContainer');
      if (container) {
        container.className = container.className.replace(/layout-[a-z0-9_]+/g, '').trim();
        container.classList.add('layout-' + layoutName);
      }
    }

    function changeTheme(themeName) {
      var bodyEl = document.getElementById('cvBody');
      if (bodyEl) {
        bodyEl.className = 'theme-' + themeName;
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
      a.download = 'curriculo.yaml';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>

  ${safeYaml ? `<script type="text/plain" id="rawYamlStore">${safeYaml}</script>` : ''}
</body>
</html>`
}

/**
 * Dispara o download do Currículo em HTML Standalone
 */
export function downloadCVHtmlFile(params: {
  yaml: string
  name: string
  persona?: string
  theme?: ThemeVariant
  layout?: LayoutVariant
  viewMode?: ViewMode
  designConfig?: CVDesignConfig
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
    params.layout || 'modular',
    params.viewMode || 'cv',
    params.designConfig
  )

  const cleanName = params.name.toLowerCase().replace(/\s+/g, '-') || 'curriculo'
  const filename = `curriculo-${cleanName}.html`

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Dispara o download da Cover Letter em HTML Standalone
 */
export function downloadCVCoverLetterHtml(params: {
  yaml: string
  name: string
  theme?: ThemeVariant
  layout?: LayoutVariant
  designConfig?: CVDesignConfig
}): void {
  const parsed = parseYamlToCV(params.yaml)
  if (!parsed.data) return

  const htmlContent = renderCVToStandaloneHtml(
    parsed.data,
    params.theme || 'executive',
    params.yaml,
    params.layout || 'modular',
    'cover_letter',
    params.designConfig
  )

  const cleanName = params.name.toLowerCase().replace(/\s+/g, '-') || 'candidato'
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cover-letter-${cleanName}.html`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Dispara o download do pacote ZIP completo (Currículo + Cover Letter + Dossiê + YAML)
 */
export async function downloadCVZipPackage(params: {
  yaml: string
  name: string
  persona?: string
  theme?: ThemeVariant
  layout?: LayoutVariant
  designConfig?: CVDesignConfig
}): Promise<void> {
  try {
    const parsed = parseYamlToCV(params.yaml)
    const cleanName = params.name.toLowerCase().replace(/\s+/g, '-') || 'curriculo'
    const baseName = `dossie-${cleanName}`

    const cvHtml = parsed.data
      ? renderCVToStandaloneHtml(parsed.data, params.theme || 'executive', params.yaml, params.layout || 'modular', 'cv', params.designConfig)
      : ''

    const coverHtml = parsed.data
      ? renderCVToStandaloneHtml(parsed.data, params.theme || 'executive', params.yaml, params.layout || 'modular', 'cover_letter', params.designConfig)
      : ''

    const dossierHtml = parsed.data
      ? renderCVToStandaloneHtml(parsed.data, params.theme || 'executive', params.yaml, params.layout || 'modular', 'both', params.designConfig)
      : ''

    const zip = new JSZip()
    zip.file(`1_curriculo_${cleanName}.html`, cvHtml)
    if (parsed.data?.coverLetter) {
      zip.file(`2_cover_letter_${cleanName}.html`, coverHtml)
      zip.file(`3_dossie_completo_2paginas_${cleanName}.html`, dossierHtml)
    }
    zip.file(`dados_${cleanName}.yaml`, params.yaml)

    const readmeText = [
      'CV Maker 2.0 - Dossiê Profissional Completo',
      '================================================================',
      `Candidato: ${params.name}`,
      `Data de Exportação: ${new Date().toLocaleString('pt-BR')}`,
      `Modelo A4: ${params.layout || 'modular'}`,
      `Tema Visual: ${params.theme || 'executive'}`,
      '',
      'Arquivos incluídos:',
      `1. 1_curriculo_${cleanName}.html -> Currículo A4 (1 página).`,
      `2. 2_cover_letter_${cleanName}.html -> Carta de Apresentação A4 espelhada.`,
      `3. 3_dossie_completo_2paginas_${cleanName}.html -> Dossiê unificado para impressão/salvar em PDF único.`,
      `4. dados_${cleanName}.yaml -> Fonte única de verdade em YAML (JSON Resume).`,
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
  }
}
