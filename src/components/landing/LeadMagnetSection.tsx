import { Link } from 'react-router-dom'

export function LeadMagnetSection() {
  return (
    <section className="lead-magnet-section" id="compendio-section" aria-labelledby="lead-magnet-heading">
      <div className="section section--sm">
        <div className="lead-magnet-card">
          {/* Top banner */}
          <div className="lead-magnet-badge">
            <span>📚</span>
            <span>MATERIAL DIDÁTICO GRATUITO</span>
          </div>

          <h2 id="lead-magnet-heading" className="lead-magnet-title">
            O Compêndio Secreto dos <span className="text-cyan-400">Viéses dos Números</span>
          </h2>

          <p className="lead-magnet-desc">
            Reunimos toda a teoria da geometria aritmética, o método do Subtraendo Rei, a diferença de quadrados e as dízimas periódicas em um único documento diagramado em LaTeX de alta resolução. Perfeito para estudantes do Ensino Fundamental II, Ensino Médio, vestibulandos e professores.
          </p>

          {/* Value Bullet Points */}
          <div className="lead-magnet-features">
            <div className="lead-magnet-feature-item">
              <span className="lead-magnet-feature-icon">✨</span>
              <div>
                <strong>Diagramação Impecável:</strong> Fórmulas em LaTeX com demonstrações geométricas passo a passo.
              </div>
            </div>

            <div className="lead-magnet-feature-item">
              <span className="lead-magnet-feature-icon">🎓</span>
              <div>
                <strong>Pronto para Sala de Aula:</strong> Atividades e desafios testados com turmas reais.
              </div>
            </div>

            <div className="lead-magnet-feature-item">
              <span className="lead-magnet-feature-icon">⚖️</span>
              <div>
                <strong>Licença Aberta:</strong> Creative Commons CC BY-NC-SA 4.0 (gratuito para estudo e distribuição).
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="lead-magnet-ctas">
            <Link
              to="/repositorio"
              className="btn-lead-primary"
              id="cta-acessar-repositorio-completo"
            >
              <span>Acessar Acervo de Aulas e PDFs</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </Link>

            <a
              href="mailto:augustoheiss@gmail.com?subject=Solicitar%20Comp%C3%AAndio%20de%20Matem%C3%A1tica%20Heiss-Lab"
              className="btn-lead-secondary"
              id="cta-solicitar-material-professor"
            >
              <span>✉ Contato para Professores</span>
            </a>
          </div>

          <p className="lead-magnet-footer-note">
            🛡️ Zero SPAM. Todo o conhecimento do Heiss-Lab é aberto e descentralizado.
          </p>
        </div>
      </div>
    </section>
  )
}
