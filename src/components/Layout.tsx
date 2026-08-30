import { NavLink, Outlet, Link } from 'react-router-dom'
import '../styles/portal.css'

const NAV_LINKS = [
  { to: '/',           label: 'Início',      icon: '🏛️'  },
  { to: '/jogos',      label: 'Jogos',        icon: '🎮'  },
  {
    to: '/laboratorio',
    label: 'Laboratório',
    icon: '🔬',
    children: [
      { to: '/laboratorio/cv-maker',       label: 'CV Maker 2.0',            icon: '📄', desc: '5 Arquétipos YAML & Super Dashboard', isExternal: false },
      { to: '/laboratorio/assistente-moeda', label: 'Assistente Moeda',        icon: '💰', desc: 'Gestão Financeira & Relatórios',      isExternal: true },
      { to: '/laboratorio/ocorrencias',    label: 'Gerador de Ocorrências',  icon: '📋', desc: 'Preenchimento inteligente de PDFs',   isExternal: false },
      { to: '/laboratorio/api-port',       label: 'Porta USB — API Port',    icon: '🔌', desc: 'Leitor dinâmico de contratos OpenAPI',isExternal: false },
      { to: '/laboratorio/sekundo',        label: 'Sekundo Event Scheduler', icon: '📅', desc: 'Planejador de Eventos Local-First',   isExternal: true },
    ]
  },
  { to: '/repositorio',label: 'Repositório',  icon: '📚'  },
  { to: '/sobre',      label: 'Sobre',        icon: '✦'   },
]

export function Layout() {
  return (
    <div className="portal-root">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <NavLink to="/" className="navbar__logo" end>
          <img
            src="/logo-heisslab.png"
            alt="Heiss-Lab Logo"
            className="navbar__logo-img"
          />
        </NavLink>

        <ul className="navbar__links">
          {NAV_LINKS.map((item) => {
            const hasChildren = 'children' in item && item.children && item.children.length > 0

            if (hasChildren) {
              return (
                <li key={item.to} className="navbar__item-dropdown">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `navbar__link${isActive ? ' active' : ''}`
                    }
                  >
                    <span>{item.icon}</span>
                    {item.label}
                    <span className="navbar__dropdown-arrow">▾</span>
                  </NavLink>

                  <div className="navbar__dropdown-menu">
                    {item.children.map((sub) => (
                      sub.isExternal ? (
                        <a key={sub.to} href={sub.to} className="navbar__dropdown-item">
                          <span className="navbar__dropdown-icon">{sub.icon}</span>
                          <div className="navbar__dropdown-info">
                            <span className="navbar__dropdown-title">{sub.label}</span>
                            <span className="navbar__dropdown-desc">{sub.desc}</span>
                          </div>
                        </a>
                      ) : (
                        <Link key={sub.to} to={sub.to} className="navbar__dropdown-item">
                          <span className="navbar__dropdown-icon">{sub.icon}</span>
                          <div className="navbar__dropdown-info">
                            <span className="navbar__dropdown-title">{sub.label}</span>
                            <span className="navbar__dropdown-desc">{sub.desc}</span>
                          </div>
                        </Link>
                      )
                    ))}
                  </div>
                </li>
              )
            }

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `navbar__link${isActive ? ' active' : ''}`
                  }
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            )
          })}
        </ul>

        <div className="navbar__spacer" />

        <a
          className="navbar__cta"
          href="mailto:augustoheiss@gmail.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          ✉ Contato
        </a>
      </nav>

      {/* ── Page Content ── */}
      <main className="page-content">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <p className="footer__msg" style={{ margin: 0 }}>
          © 2026 Heiss-Lab / Augusto Heiss. Todo o material deste portal está licenciado sob a{' '}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.pt-br"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__cc-link"
          >
            Licença Creative Commons CC BY-NC-SA 4.0
          </a>
          . Distribuição gratuita permitida; venda proibida.
        </p>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginTop: '4px' }}>
          <Link
            to="/privacidade"
            style={{ color: 'rgba(255, 255, 255, 0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#a855f7'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
          >
            Política de Privacidade
          </Link>
          <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>•</span>
          <Link
            to="/termos"
            style={{ color: 'rgba(255, 255, 255, 0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#a855f7'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
          >
            Termos de Uso
          </Link>
        </div>
      </footer>
    </div>
  )
}
