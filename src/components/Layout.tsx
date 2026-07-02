import { NavLink, Outlet, Link } from 'react-router-dom'
import '../styles/portal.css'

const NAV_LINKS = [
  { to: '/',           label: 'Início',      icon: '🏛️'  },
  { to: '/jogos',      label: 'Jogos',        icon: '🎮'  },
  { to: '/laboratorio',label: 'Laboratório',  icon: '🔬'  },
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
          {NAV_LINKS.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `navbar__link${isActive ? ' active' : ''}`
                }
              >
                <span>{icon}</span>
                {label}
              </NavLink>
            </li>
          ))}
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
