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

        {/* ── Video grid ── */}
        <div className="video-grid">
          {youtubeVideos.map((video) => (
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
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="video-card__link"
                >
                  Abrir no YouTube ↗
                </a>
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
