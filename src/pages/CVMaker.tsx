import { useState, useEffect, useCallback } from 'react'
import * as yaml from 'js-yaml'
import { CVViewer } from '../components/CVViewer/CVViewer'
import { ChatInterface, type CVVersions } from '../components/Chat/ChatInterface'
import type { CVData, TextVariant, ThemeVariant } from '../types/cv'
import './CVMaker.css'

/* ── John Doe sample — generic, no real personal data ─────────── */
const JOHN_DOE_YAML = `basics:
  name: "John Doe"
  label: "Full-Stack Developer | Problem Solver | Open-Source Enthusiast"
  email: "john.doe@example.com"
  phone: "+1 (555) 123-4567"
  url: "https://linkedin.com/in/johndoe"
  summary: "Versatile software developer with 5+ years of experience building scalable web applications. Passionate about clean code, thoughtful architecture, and mentoring junior engineers."
  location:
    city: "San Francisco"
    region: "California"
    postalCode: "94105"
    countryCode: "US"
  profiles:
    - network: "GitHub"
      username: "johndoe"
      url: "https://github.com/johndoe"
    - network: "LinkedIn"
      username: "johndoe"
      url: "https://linkedin.com/in/johndoe"

work:
  - name: "Acme Corporation"
    position: "Senior Frontend Developer"
    startDate: "2021-03-01"
    summary: "Led the redesign of the main product dashboard, reducing load time by 40%. Mentored a team of 3 junior developers and introduced a component library adopted across 4 products."
    highlights:
      - "Reduced dashboard load time by 40% through lazy loading and code splitting."
      - "Introduced a shared design system used by 4 product teams."
  - name: "Startup Inc."
    position: "Full-Stack Developer"
    startDate: "2018-06-01"
    endDate: "2021-02-28"
    summary: "Built RESTful APIs and React frontends for a B2B SaaS platform serving 10,000+ users. Owned the entire development cycle from spec to production."
    highlights:
      - "Architected the authentication service handling 50k daily sessions."
      - "Cut API response time by 60% via query optimization and Redis caching."

projects:
  - name: "OpenBudget"
    description: "An open-source personal finance tracker built with React and Node.js. Allows users to connect bank accounts, set budgets, and visualize spending trends."
    highlights:
      - "500+ GitHub stars in the first month after launch."
      - "Integrated with 5 major banking APIs using the Plaid SDK."
    url: "https://github.com/johndoe/openbudget"
  - name: "DevPortfolio Generator"
    description: "A CLI tool that auto-generates portfolio sites from a developer's GitHub activity and README files."
    highlights:
      - "Published on npm with 1,200+ weekly downloads."
      - "Used in 3 coding bootcamp curricula as a final-project scaffold."

education:
  - institution: "State University"
    area: "Computer Science"
    studyType: "Bachelor's Degree"
    endDate: "2018-05-31"
  - institution: "freeCodeCamp / Udemy"
    area: "Web Development & Cloud Computing"
    studyType: "Self-Directed Certificates"
    endDate: "2017-12-31"

skills:
  - name: "Frontend"
    keywords: ["React", "TypeScript", "CSS / Tailwind", "Vite", "Accessibility"]
  - name: "Backend"
    keywords: ["Node.js", "Python", "PostgreSQL", "REST APIs", "GraphQL"]
  - name: "DevOps & Tools"
    keywords: ["Git / GitHub", "Docker", "CI/CD (GitHub Actions)", "Linux", "AWS"]

languages:
  - language: "English"
    fluency: "Native"
  - language: "Spanish"
    fluency: "Conversational"

interests:
  - name: "Open Source"
    keywords: ["Contributing to OSS projects", "Maintaining public repos", "Hacktoberfest"]
  - name: "Side Projects"
    keywords: ["Building weekend experiments", "Hackathons", "Teaching code to teens"]

certificates:
  - name: "AWS Certified Developer – Associate"
    date: "2022-08-15"
    issuer: "Amazon Web Services"
    url: "https://aws.amazon.com/certification/"
  - name: "Professional Scrum Master I (PSM I)"
    date: "2021-04-10"
    issuer: "Scrum.org"

awards:
  - title: "Employee of the Quarter"
    date: "2022-12-01"
    awarder: "Acme Corporation"
    summary: "Recognised for leading the zero-downtime migration of the legacy monolith to microservices."
`

/* ── Variant / theme metadata ─────────────────────────────────── */
const TEXT_VARIANTS: { id: TextVariant; label: string; icon: string }[] = [
  { id: 'professional', label: 'Professional', icon: '💼' },
  { id: 'historian',    label: 'Historian',    icon: '📜' },
  { id: 'didactic',     label: 'Didactic',     icon: '🎓' },
  { id: 'alien',        label: 'Alien',        icon: '🤖' },
]

const THEME_VARIANTS: { id: ThemeVariant; label: string; icon: string }[] = [
  { id: 'executive', label: 'Executive', icon: '💼' },
  { id: 'historian', label: 'Historian', icon: '📜' },
  { id: 'didactic',  label: 'Didactic',  icon: '🎓' },
  { id: 'alien',     label: 'Alien',     icon: '🤖' },
]

/* ── Page component ───────────────────────────────────────────── */
export function CVMaker() {
  const [cvVersions, setCvVersions]     = useState<CVVersions | null>(null)
  const [yamlInput, setYamlInput]       = useState<string>(JOHN_DOE_YAML)
  const [cvData, setCvData]             = useState<CVData | null>(null)
  const [parseError, setParseError]     = useState<string | null>(null)
  const [activeText, setActiveText]     = useState<TextVariant>('professional')
  const [activeTheme, setActiveTheme]   = useState<ThemeVariant>('executive')

  /* ── YAML parser ─────────────────────────────────────────────── */
  const parseYaml = useCallback((raw: string) => {
    try {
      const parsed = yaml.load(raw) as CVData
      if (parsed && typeof parsed === 'object' && 'basics' in parsed) {
        setCvData(parsed)
        setParseError(null)
      } else {
        setCvData(null)
        setParseError('YAML must contain a "basics" key at the root level.')
      }
    } catch (err) {
      setCvData(null)
      setParseError((err as Error).message)
    }
  }, [])

  /* Initial parse on mount */
  useEffect(() => { parseYaml(JOHN_DOE_YAML) }, [parseYaml])

  /* When cvVersions or activeText changes, re-parse the active version */
  useEffect(() => {
    if (cvVersions) {
      const raw = cvVersions[activeText]
      setYamlInput(raw)
      parseYaml(raw)
    }
  }, [cvVersions, activeText, parseYaml])

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleYamlChange = (val: string) => {
    setYamlInput(val)
    if (!cvVersions) parseYaml(val)
  }

  const handleCVGenerated = (versions: CVVersions) => {
    setCvVersions(versions)
  }

  const handleReset = () => {
    setCvVersions(null)
    setYamlInput(JOHN_DOE_YAML)
    parseYaml(JOHN_DOE_YAML)
  }

  const handleDownload = () => {
    const raw = cvVersions ? cvVersions[activeText] : yamlInput
    const blob = new Blob([raw], { type: 'text/yaml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cv-${activeText}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => window.print()

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="cv-maker">

      {/* ════════════════════════════════════════════════
          Left area — sliding track (editor ↔ chat)
          ════════════════════════════════════════════════ */}
      <div className="cv-maker__left" aria-label="Left panel">
        {/*
          The track is 200% wide. The --chat modifier locks it at -50%
          so the Chat panel (slot 2) is always the visible left column.
          The YAML editor (slot 1) remains off-screen at all times.
        */}
        <div className="cv-maker__track cv-maker__track--chat">

          {/* ── Slot 1: YAML editor (off-screen, aria-hidden) ── */}
          <aside
            className="cv-maker__panel cv-maker__controls"
            aria-label="YAML editor"
            aria-hidden={true}
          >
            <div className="cv-maker__controls-inner">

              <header className="cv-maker__header">
                <span className="cv-maker__badge">⚡ CV YAML</span>
                <h1 className="cv-maker__title">Crush the Bureaucracy</h1>
                <p className="cv-maker__subtitle">
                  Edit your YAML directly — the preview updates in real-time.
                </p>
              </header>

              <div className="cv-maker__field">
                <label className="cv-maker__label" htmlFor="yaml-input">
                  YAML Source
                  {parseError
                    ? <span className="cv-maker__status cv-maker__status--error">✗ Syntax error</span>
                    : <span className="cv-maker__status cv-maker__status--ok">✓ Valid</span>
                  }
                </label>
                <textarea
                  id="yaml-input"
                  className={`cv-maker__textarea${parseError ? ' cv-maker__textarea--error' : ''}`}
                  value={yamlInput}
                  onChange={e => handleYamlChange(e.target.value)}
                  spellCheck={false}
                  aria-describedby={parseError ? 'yaml-error' : undefined}
                  tabIndex={-1}
                />
                {parseError && (
                  <p id="yaml-error" className="cv-maker__error-msg" role="alert">
                    {parseError}
                  </p>
                )}
              </div>

              <div className="cv-maker__actions">
                <button
                  className="cv-maker__action-btn cv-maker__action-btn--secondary"
                  onClick={handleDownload}
                  tabIndex={-1}
                >
                  ⬇ Download .yaml
                </button>
                <button
                  className="cv-maker__action-btn cv-maker__action-btn--primary"
                  onClick={handlePrint}
                  tabIndex={-1}
                >
                  🖨 Generate PDF
                </button>
              </div>

              <p className="cv-maker__privacy">🔒 Your data never leaves this browser.</p>
            </div>
          </aside>

          {/* ── Slot 2: Chat (always visible) ── */}
          <div
            className="cv-maker__panel cv-maker__chat"
            aria-label="AI Chat"
          >
            <ChatInterface
              onCVGenerated={handleCVGenerated}
              hasGeneratedCVs={cvVersions !== null}
              onReset={handleReset}
            />
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════
          Right area — showcase + sticky toolbar
          ════════════════════════════════════════════════ */}
      <main className="cv-maker__showcase" aria-label="CV preview">

        {/* Sticky toolbar: always visible on the preview side */}
        <div className="cv-maker__toolbar">

          <div className="cv-maker__toolbar-section">
            <span className="cv-maker__toolbar-label">Persona</span>
            <div className="cv-maker__btn-group" role="group" aria-label="Select AI persona">
              {TEXT_VARIANTS.map(v => (
                <button
                  key={v.id}
                  className={`cv-maker__btn${activeText === v.id ? ' cv-maker__btn--active' : ''}`}
                  onClick={() => setActiveText(v.id)}
                  aria-pressed={activeText === v.id}
                >
                  <span aria-hidden="true">{v.icon}</span> {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cv-maker__toolbar-section">
            <span className="cv-maker__toolbar-label">Theme</span>
            <div className="cv-maker__btn-group" role="group" aria-label="Select theme">
              {THEME_VARIANTS.map(t => (
                <button
                  key={t.id}
                  className={`cv-maker__btn${activeTheme === t.id ? ' cv-maker__btn--active' : ''}`}
                  onClick={() => setActiveTheme(t.id)}
                  aria-pressed={activeTheme === t.id}
                >
                  <span aria-hidden="true">{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cv-maker__toolbar-actions">
            <button
              className="cv-maker__action-btn cv-maker__action-btn--secondary"
              onClick={handleDownload}
              aria-label="Download YAML"
            >
              ⬇ .yaml
            </button>
            <button
              className="cv-maker__action-btn cv-maker__action-btn--primary"
              onClick={handlePrint}
              aria-label="Export PDF"
            >
              🖨 PDF
            </button>
          </div>
        </div>

        {/* CV preview */}
        <div className={`cv-wrapper theme-${activeTheme}`}>
          {cvData
            ? <CVViewer data={cvData} activeText={activeText} />
            : (
              <div className="cv-maker__empty">
                <span className="cv-maker__empty-icon">📄</span>
                <p>Paste your resume in the AI Assistant on the left to generate your CV.</p>
              </div>
            )
          }
        </div>
      </main>

    </div>
  )
}
