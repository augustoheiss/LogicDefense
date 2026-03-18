import { NavLink, Outlet } from 'react-router-dom'
import '../styles/portal.css'

const NAV_LINKS = [
  { to: '/',           label: 'Início',      icon: '🏛️'  },
  { to: '/jogos',      label: 'Jogos',        icon: '🎮'  },
  { to: '/laboratorio',label: 'Laboratório',  icon: '🔬'  },
  { to: '/repositorio',label: 'Repositório',  icon: '📚'  },
]

export function Layout() {
  return (
    <div className="portal-root">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <NavLink to="/" className="navbar__logo" end>
          <span className="navbar__logo-icon">∑</span>
          <span className="navbar__logo-text">LOGIC DEFENSE</span>
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
      <footer className="footer">
        <p className="footer__msg">
        © 2026 Heiss-Lab | Feito com 💡 para a Educação |{' '}
          <a href="mailto:augustoheiss@gmail.com">augustoheiss@gmail.com</a>
          {' '}
        </p>
        <p className="footer__copy">
          © {new Date().getFullYear()} Logic Defense · Produzido em co-criação com IA
        </p>
      </footer>
    </div>
  )
}
