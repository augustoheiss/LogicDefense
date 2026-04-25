import { Link } from 'react-router-dom'
import { youtubeVideos } from '../data/content'

export function LabPage() {
  return (
    <>
      {/* ── Hero ── */}
      <div className="hero">
        <p className="hero__eyebrow">Portal Educacional · Laboratório</p>
        <h1 className="hero__title">Laboratório de IA</h1>
        <p className="hero__sub">
          Vídeos e pesquisas sobre Inteligência Artificial aplicada à Educação.
          Conteúdo produzido em co-criação com IA e testado na prática.
        </p>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>

        {/* ── Stats bar ── */}
        <div className="stat-bar">
          <div className="stat-bar__item">
            <span className="stat-bar__value">{youtubeVideos.length}</span>
            <span className="stat-bar__label">Vídeos</span>
          </div>
          <div className="stat-bar__item">
            <span className="stat-bar__value">100%</span>
            <span className="stat-bar__label">Gratuito</span>
          </div>
          <div className="stat-bar__item">
            <span className="stat-bar__value">IA</span>
            <span className="stat-bar__label">Co-criado</span>
          </div>
        </div>

        {/* ── Assistente Moeda tool card ── */}
        <div className="cv-lab-card">
          <div className="cv-lab-card__icon">💰</div>
          <div className="cv-lab-card__body">
            <span className="cv-lab-card__tag">SaaS Tool · Finanças</span>
            <h2 className="cv-lab-card__title">Assistente Moeda — Gestão Financeira</h2>
            <p className="cv-lab-card__desc">
              Crie tabelas de receitas, registre entradas diárias e acompanhe médias automáticas (diária, semanal, mensal). Exporte relatórios para o WhatsApp. 100% local, sem backend.
            </p>
          </div>
          <Link to="/laboratorio/assistente-moeda" className="cv-lab-card__cta">
            Abrir Assistente ↗
          </Link>
        </div>

        {/* ── Gerador de Ocorrências tool card ── */}
        <div className="cv-lab-card">
          <div className="cv-lab-card__icon">📋</div>
          <div className="cv-lab-card__body">
            <span className="cv-lab-card__tag">SaaS Tool · Pedagógico</span>
            <h2 className="cv-lab-card__title">Gerador de Ocorrências</h2>
            <p className="cv-lab-card__desc">
              Faça upload do formulário escolar em PDF, descreva a ocorrência e preencha o PDF oficial da escola. Zero dados armazenados.
            </p>
          </div>
          <Link to="/laboratorio/ocorrencias" className="cv-lab-card__cta">
            Abrir Gerador ↗
          </Link>
        </div>

        {/* ── CV YAML tool card ── */}
        <div className="cv-lab-card">
          <div className="cv-lab-card__icon">📄</div>
          <div className="cv-lab-card__body">
            <span className="cv-lab-card__tag">SaaS Tool · MVP</span>
            <h2 className="cv-lab-card__title">CV YAML — Crush the Bureaucracy</h2>
            <p className="cv-lab-card__desc">
              Paste your AI-generated YAML resume, choose a persona and a visual theme, then export a pixel-perfect PDF — all processed locally, zero data leaves your browser.
            </p>
          </div>
          <Link to="/laboratorio/cv-maker" className="cv-lab-card__cta">
            Open CV Maker ↗
          </Link>
        </div>

        {/* ── Video grid ── */}
        <div className="video-grid">
          {[...youtubeVideos].reverse().map((video) => (
            <article key={video.id} className="video-card">
              <div className="video-card__embed">
                <iframe
                  src={`https://www.youtube.com/embed/${video.youtubeId}?rel=0&modestbranding=1`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>

              <div className="video-card__body">
                <span className="video-card__tag">{video.tag}</span>
                <h3 className="video-card__title">{video.title}</h3>
                <p className="video-card__desc">{video.description}</p>
                <Link
                  to={`/repositorio?v=${video.id}`}
                  className="video-card__link"
                >
                  Abrir no Repositório ↗
                </Link>
              </div>
            </article>
          ))}

          {/* Dev hint — add new videos in content.ts */}
          <div className="video-card video-card--add-hint">
            <span style={{ fontSize: 28 }}>➕</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
              Adicionar vídeo
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', maxWidth: 180, textAlign: 'center' }}>
              Inclua um novo item em{' '}
              <code style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: 4 }}>
                src/data/content.ts
              </code>
            </p>
          </div>
        </div>

      </div>
    </>
  )
}
