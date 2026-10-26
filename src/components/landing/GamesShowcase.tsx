import { Link } from 'react-router-dom'

interface GameItem {
  id: string
  to: string
  icon: string
  title: string
  genre: string
  accentColor: 'cyan' | 'purple' | 'gold' | 'green'
  badge: string
  description: string
  highlights: string[]
  mechanic: string
}

const GAMES: GameItem[] = [
  {
    id: 'logic-defense',
    to: '/jogos/logic-defense',
    icon: '🏛️',
    title: 'Logic Defense',
    genre: 'Tower Defense Estratégico',
    accentColor: 'cyan',
    badge: 'O Museu dos Números',
    description: 'Defenda o Museu dos Números contra ondas crescentes de invasores resolvendo operações em tempo real. Construa torres, administre energia e destrave buffs místicos com a Roleta SPIN Esfera.',
    highlights: ['Cálculo Mental Rápido', 'Dificuldade Adaptativa', 'Roleta SPIN Esfera'],
    mechanic: 'O erro ativa penalidades controladas que ensinam o padrão correto.',
  },
  {
    id: 'logic-ascension',
    to: '/jogos/logic-ascension',
    icon: '🌌',
    title: 'Logic Ascension',
    genre: 'RPG Roguelike Procedural',
    accentColor: 'purple',
    badge: 'PEMDAS & Frações',
    description: 'Navegue por uma masmorra 2D gerada proceduralmente. Escolha entre o Caminho do Buff e o do Sacrifício, enfrentando chefes cujo poder escala com o seu domínio da Ordem das Operações.',
    highlights: ['Ordem das Operações', 'Névoa de Guerra', 'ProcGen Infinito'],
    mechanic: 'Math Engine com armadilhas pedagógicas para antecipar equívocos comuns.',
  },
  {
    id: 'logic-invaders',
    to: '/jogos/logic-invaders',
    icon: '👾',
    title: 'Logic Invaders',
    genre: 'Arcade Shooter Reflexivo',
    accentColor: 'gold',
    badge: 'Elastic Feedback',
    description: 'Naves alienígenas descem carregando equações matemáticas — sua única munição são os números. Atire o resultado exato para destruí-las. Errou? O monstro absorve e fica mais rápido, sem Game Over punitivo!',
    highlights: ['Disparo Reflexivo', 'Feedback Elástico', 'Zero Frustração'],
    mechanic: 'Feedback Elástico: o erro acelera o jogo mas nunca interrompe a partida.',
  },
  {
    id: 'logic-friction',
    to: '/jogos/logic-friction',
    icon: '🏟️',
    title: 'Logic Friction',
    genre: '3D ARPG · Física Real WebGL',
    accentColor: 'green',
    badge: 'Arena Tridimensional',
    description: 'Arena 3D com física de impacto real, movimentação livre WASD, combate corpo-a-corpo e torres posicionadas no espaço tridimensional. Acerte cálculos em combate para receber buffs divinos.',
    highlights: ['Renderização 3D Three.js', 'Física de Colisão', 'Combate em Arena'],
    mechanic: 'Imersão espacial completa onde números têm peso, massa e velocidade.',
  },
  {
    id: 'logic-tetris',
    to: '/jogos/logic-tetris',
    icon: '🧱',
    title: 'Logic Tetris',
    genre: 'Puzzle Espacial · Base-10 Genesis',
    accentColor: 'cyan',
    badge: 'Genesis Edition · 142857',
    description: 'A versão Genesis do Tetris onde a aritmética salva a sua vida. Resolva atalhos das 4 operações para metamorfosear a peça em queda, selar buracos soterrados com Cristais Dourados ou purificar a matriz no Protocolo Fênix.',
    highlights: ['Metamorfose de Peça [M]', 'Selagem de Buracos [B]', 'Protocolo Fênix 142857'],
    mechanic: 'Bullet-Time Cognitivo (0.12×) com 2ª chance elástica e Códice das 8 Lentes Heiss-Lab.',
  },
  {
    id: 'logic-battle',
    to: '/jogos/logic-battle',
    icon: '⚔️',
    title: 'Logic Battle',
    genre: 'Crowd Runner · Conquista Territorial',
    accentColor: 'gold',
    badge: 'Genesis Edition · 20 Pegadinhas',
    description: 'Cumprimos a promessa dos jogos de portões multiplicadores com 100% de honestidade matemática. Guie sua legião pela Ponte (Mundo 1), funda 10 soldados em Pelotões Posicionais (Vai-Um) e expanda seu Reino (Mundo 2).',
    highlights: ['Pelotões Posicionais (Base 10)', '20 Pegadinhas & Fichas de Resgate', 'Mundo 1 (Ponte) + Mundo 2 (Reino)'],
    mechanic: 'Cair numa pegadinha nunca dá Game Over: gera uma Ficha de Resgate para recuperar 100% das tropas pela razão.',
  },
]

export function GamesShowcase() {
  return (
    <section className="games-showcase-section" id="jogos-section" aria-labelledby="showcase-heading">
      <div className="section">
        {/* Eyebrow */}
        <div className="text-center mb-4">
          <span className="section-tag-arcade">
            <span>🎮</span>
            <span>OS 6 JOGOS DO ECOSSISTEMA</span>
          </span>
        </div>

        <h2 id="showcase-heading" className="section-heading section-heading--center">
          Aprenda Matemática <span className="section-heading--accent">Jogando</span>.
        </h2>
        <p className="section-sub-center">
          Cada jogo foi desenhado do zero para transformar a ansiedade matemática em domínio reflexivo. Sem decoreba, 100% no navegador.
        </p>

        {/* Games Grid */}
        <div className="games-grid">
          {GAMES.map((game) => (
            <article key={game.id} className={`game-showcase-card game-showcase-card--${game.accentColor}`}>
              <div className="game-showcase-card__header">
                <div className="game-showcase-card__icon-wrapper">
                  <span className="game-showcase-card__icon">{game.icon}</span>
                </div>
                <div className="game-showcase-card__meta">
                  <span className="game-showcase-card__badge">{game.badge}</span>
                  <h3 className="game-showcase-card__title">{game.title}</h3>
                  <span className="game-showcase-card__genre">{game.genre}</span>
                </div>
              </div>

              <p className="game-showcase-card__desc">{game.description}</p>

              {/* Mechanic callout */}
              <div className="game-showcase-card__mechanic">
                <span className="game-showcase-card__mechanic-icon">💡</span>
                <span className="game-showcase-card__mechanic-text">{game.mechanic}</span>
              </div>

              {/* Highlights */}
              <ul className="game-showcase-card__highlights" role="list">
                {game.highlights.map((h, i) => (
                  <li key={i} className="game-showcase-card__highlight-item">
                    <span className="game-showcase-card__check">✦</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              {/* Card Footer CTA */}
              <div className="game-showcase-card__footer">
                <Link to={game.to} className={`btn-game-play btn-game-play--${game.accentColor}`}>
                  <span>Jogar {game.title}</span>
                  <span className="btn-arrow" aria-hidden="true">▶</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
