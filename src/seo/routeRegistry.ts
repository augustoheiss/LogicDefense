// ──────────────────────────────────────────────────────────────────────────────
// src/seo/routeRegistry.ts — Fonte Única da Verdade (SEO, Open Graph, Ícones & AEO)
// ──────────────────────────────────────────────────────────────────────────────
import { lessonPlans } from '../data/content'

export const SITE_ORIGIN = 'https://heisslab.com.br'
export const SITE_NAME = 'Heiss-Lab · Matemática Soberana & IA'

export interface RouteSeoMeta {
  /** Rota da aplicação (ex.: '/jogos/logic-tetris', '/laboratorio/cv-maker') */
  path: string
  /** URL canônica completa (ex.: 'https://heisslab.com.br/laboratorio/cv-maker') */
  canonicalPath?: string
  /** Título exclusivo da página (<title>, og:title, twitter:title) */
  title: string
  /** Descrição curta (140–165 chars) para Google SERP e preview de compartilhamento */
  description: string
  /** Palavras-chave específicas da página */
  keywords: string
  /** Categoria / Eyebrow exibido no card Open Graph 1200x630 */
  badge: string
  /** subtítulo curto exibido no card visual 1200x630 */
  cardSubtitle: string
  /** Emoji/Símbolo principal para geração do ícone e do card */
  emoji: string
  /** Cor primária (hex) do tema visual desta página para o card e ícone */
  accentColor: string
  /** Cor secundária (hex) do gradiente do card */
  secondaryColor: string
  /** Caminho relativo em public/ para o ícone específico da página (ex.: '/icons/icon-cv-maker.png') */
  iconPath: string
  /** Caminho relativo em public/ para o preview 1200x630 (ex.: '/og/tool-cv-maker.png') */
  ogImagePath: string
  /** Tipo Open Graph ('website' | 'article') */
  ogType: 'website' | 'article'
  /** Tipo Schema.org principal */
  schemaType: 'WebSite' | 'CollectionPage' | 'VideoGame' | 'SoftwareApplication' | 'LearningResource' | 'AboutPage' | 'WebPage'
  /** Prioridade no sitemap.xml (0.1 a 1.0) */
  sitemapPriority: number
  /** Frequência de atualização no sitemap.xml */
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** Se deve ser incluído no sitemap.xml (false para rotas alias como /cv-maker) */
  includeInSitemap: boolean
  /** Destaques em bullet points para o card 1200x630 e pré-renderização semântica */
  highlights: string[]
}

export const STATIC_ROUTES_META: RouteSeoMeta[] = [
  // ── 1. HOME ────────────────────────────────────────────────────────────────
  {
    path: '/',
    title: 'Heiss-Lab & Logic Defense · Matemática Soberana, IA e Jogos de Lógica',
    description:
      'Portal educacional de Matemática Soberana e IA: 6 jogos cognitivos no navegador, ferramentas local-first (CV Maker, Sekundo, Moeda) e acervo aberto em LaTeX.',
    keywords:
      'Heiss Lab, Logic Defense, matemática soberana, jogos de matemática, cálculo mental, Hack Japonês, Augusto Heiss, edtech, IA na educação',
    badge: 'PORTAL EDUCACIONAL & LAB DE IA',
    cardSubtitle: 'Onde a Matemática, a Filosofia e a Engenharia de IA se encontram',
    emoji: '🏛️',
    accentColor: '#38bdf8',
    secondaryColor: '#a855f7',
    iconPath: '/favicon.png',
    ogImagePath: '/og/home.png',
    ogType: 'website',
    schemaType: 'WebSite',
    sitemapPriority: 1.0,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      '6 Jogos Matemáticos no Navegador (Zero Game Over)',
      '5 Ferramentas Soberanas de IA & Produtividade Local-First',
      '18 Aulas e Apostilas Abertas em LaTeX + 40 Vídeos',
    ],
  },

  // ── 2. HUB DE JOGOS (/jogos) ───────────────────────────────────────────────
  {
    path: '/jogos',
    title: 'Jogos de Matemática e Raciocínio Lógico no Navegador · Heiss-Lab',
    description:
      'Jogue 6 jogos educativos de matemática direto no navegador: Logic Defense, Logic Ascension, Logic Invaders, Logic Friction 3D, Logic Tetris e Logic Battle.',
    keywords:
      'jogos de matemática, raciocínio lógico, cálculo mental, PEMDAS, jogos educativos online, Logic Defense, Logic Tetris, Logic Battle, Heiss Lab',
    badge: 'SUÍTE DE 6 JOGOS COGNITIVOS',
    cardSubtitle: 'Treine cálculo mental, PEMDAS e álgebra em tempo real sem instalação',
    emoji: '🎮',
    accentColor: '#00d4ff',
    secondaryColor: '#7c3aed',
    iconPath: '/icons/icon-jogos.png',
    ogImagePath: '/og/jogos-hub.png',
    ogType: 'website',
    schemaType: 'CollectionPage',
    sitemapPriority: 0.9,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      'Logic Defense (Tower Defense) & Logic Ascension (RPG PEMDAS)',
      'Logic Invaders (Arcade) & Logic Friction (Arena 3D WebGL)',
      'Logic Tetris & Logic Battle (Genesis Edition · Portões & Reino)',
    ],
  },

  // ── 3. JOGOS INDIVIDUAIS (/jogos/*) ────────────────────────────────────────
  {
    path: '/jogos/logic-defense',
    title: 'Logic Defense · Tower Defense de Cálculo Mental | Heiss-Lab',
    description:
      'Defenda o Museu dos Números contra invasores resolvendo contas em tempo real. Construa torres, gerencie energia e gire a Roleta SPIN Esfera no navegador.',
    keywords:
      'Logic Defense, tower defense matemático, jogo de cálculo mental, museu dos números, jogos educativos matemática, Heiss Lab',
    badge: 'JOGO #01 · TOWER DEFENSE MATEMÁTICO',
    cardSubtitle: 'O Museu dos Números — Construa torres com a velocidade do seu cálculo mental',
    emoji: '🏰',
    accentColor: '#f59e0b',
    secondaryColor: '#ef4444',
    iconPath: '/icons/icon-logic-defense.png',
    ogImagePath: '/og/jogo-logic-defense.png',
    ogType: 'website',
    schemaType: 'VideoGame',
    sitemapPriority: 0.85,
    changefreq: 'monthly',
    includeInSitemap: true,
    highlights: [
      'Ondas progressivas de cálculo mental e aritmética rápida',
      'Construção tática de torres e Roleta de Buffs SPIN Esfera',
      'Jogue grátis no navegador (PC e Mobile) sem cadastro',
    ],
  },
  {
    path: '/jogos/logic-ascension',
    title: 'Logic Ascension · RPG Roguelike de Ordem das Operações (PEMDAS) | Heiss-Lab',
    description:
      'Explore masmorras com Névoa de Guerra, escolha entre Buff ou Sacrifício e derrote monstros gerados pelo Oráculo Matemático resolvendo PEMDAS em combate.',
    keywords:
      'Logic Ascension, RPG matemático, ordem das operações, PEMDAS, expressões numéricas, jogo roguelike educativo, Heiss Lab',
    badge: 'JOGO #02 · RPG ROGUELIKE & PEMDAS',
    cardSubtitle: 'A Masmorra da Matemática — Domine a Ordem das Operações em combate tático',
    emoji: '🗺️',
    accentColor: '#a855f7',
    secondaryColor: '#ec4899',
    iconPath: '/icons/icon-logic-ascension.png',
    ogImagePath: '/og/jogo-logic-ascension.png',
    ogType: 'website',
    schemaType: 'VideoGame',
    sitemapPriority: 0.85,
    changefreq: 'monthly',
    includeInSitemap: true,
    highlights: [
      'Grade 2D procedural com Névoa de Guerra e Caminho do Sacrifício',
      'Combate guiado por Expressões Numéricas e hierarquia PEMDAS',
      'Motor adaptativo que calibra os desafios ao seu poder atual',
    ],
  },
  {
    path: '/jogos/logic-invaders',
    title: 'Logic Invaders · Arcade Shooter de Cálculo Mental Reflexivo | Heiss-Lab',
    description:
      'Naves alienígenas descem carregando equações e sua munição são os números. Atire a resposta certa ou veja o inimigo acelerar com Feedback Elástico (Zero Game Over).',
    keywords:
      'Logic Invaders, space invaders matemático, arcade shooter educativo, cálculo mental rápido, feedback elástico, Heiss Lab',
    badge: 'JOGO #03 · ARCADE SHOOTER REFLEXIVO',
    cardSubtitle: 'Sua munição são os Números — Destrua equações em queda livre sem Game Over',
    emoji: '👾',
    accentColor: '#00d4ff',
    secondaryColor: '#3b82f6',
    iconPath: '/icons/icon-logic-invaders.png',
    ogImagePath: '/og/jogo-logic-invaders.png',
    ogType: 'website',
    schemaType: 'VideoGame',
    sitemapPriority: 0.85,
    changefreq: 'monthly',
    includeInSitemap: true,
    highlights: [
      'Estética Retro-Arcade combinada com neurociência cognitiva',
      'Sistema Elastic Feedback: erros aceleram o desafio sem punição fatal',
      'Treinamento de reflexo aritmético sob pressão controlada',
    ],
  },
  {
    path: '/jogos/logic-friction',
    title: 'Logic Friction · Arena 3D WebGL de Aritmética e Física Real | Heiss-Lab',
    description:
      'Arena 3D com física Rapier e Three.js no navegador. Movimentação WASD, combate corpo-a-corpo, construção de torres e equações 3D para desbloquear buffs divinos.',
    keywords:
      'Logic Friction, jogo 3D matemática, WebGL Three.js educativo, ARPG torre defense 3D, PEMDAS aritmética, Heiss Lab',
    badge: 'JOGO #04 · ARENA 3D WEBGL & FÍSICA REAL',
    cardSubtitle: 'Combate 3D em tempo real onde equações resolvidas concedem poderes divinos',
    emoji: '🏟️',
    accentColor: '#10b981',
    secondaryColor: '#06b6d4',
    iconPath: '/icons/icon-logic-friction.png',
    ogImagePath: '/og/jogo-logic-friction.png',
    ogType: 'website',
    schemaType: 'VideoGame',
    sitemapPriority: 0.85,
    changefreq: 'monthly',
    includeInSitemap: true,
    highlights: [
      'Motor 3D React Three Fiber + Física Rapier direto no navegador',
      'Movimentação livre WASD, construção física e chefes Voxel',
      'Espiral infinita de Aritmética e PEMDAS integrada ao combate',
    ],
  },
  {
    path: '/jogos/logic-tetris',
    title: 'Logic Tetris (Genesis Edition) · Puzzle Base-10 e Protocolo Fênix 142857 | Heiss-Lab',
    description:
      'Onde a Matemática salva sua vida na Matriz 10x20. Use atalhos visuais Heiss-Lab para metamorfosear peças [M], selar buracos [B] e ativar o Protocolo Fênix 142857.',
    keywords:
      'Logic Tetris, tetris matemático, Genesis Edition, protocolo fênix 142857, cálculo mental base 10, códice Heiss Lab',
    badge: 'JOGO #05 · PUZZLE ESPACIAL BASE-10',
    cardSubtitle: 'Metamorfoseie peças, sele buracos com Cristais Dourados e vença o Top-Out com Matemática',
    emoji: '🧱',
    accentColor: '#38bdf8',
    secondaryColor: '#a855f7',
    iconPath: '/icons/icon-logic-tetris.png',
    ogImagePath: '/og/jogo-logic-tetris.png',
    ogType: 'website',
    schemaType: 'VideoGame',
    sitemapPriority: 0.9,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      '3 Milagres Matemáticos ativos: Metamorfose [M], Cristal [B] e Fênix 142857',
      'Códice Heiss-Lab integrado com hacks visuais de cálculo mental',
      'Zero Game Over arbitrário: sua mente é o último escudo na matriz 10×20',
    ],
  },
  {
    path: '/jogos/logic-battle',
    title: 'Logic Battle (Genesis Edition) · A Ponte dos Portões & O Reino | Heiss-Lab',
    description:
      'Guie sua legião por portões aritméticos 100% honestos, funda 10 soldados em Pelotões Posicionais (Vai-Um), dome 20 Pegadinhas com Fichas de Resgate e conquiste o Reino.',
    keywords:
      'Logic Battle, jogo dos portões matemáticos, crowd runner matemática, pegadinhas matemáticas, pelotões posicionais base 10, Heiss Lab',
    badge: 'JOGO #06 · CROWD RUNNER & REINO MATEMÁTICO',
    cardSubtitle: 'A Ponte dos Portões Honestos, Fusão Vai-Um e 20 Pegadinhas da Intuição',
    emoji: '⚔️',
    accentColor: '#facc15',
    secondaryColor: '#38bdf8',
    iconPath: '/icons/icon-logic-battle.png',
    ogImagePath: '/og/jogo-logic-battle.png',
    ogType: 'website',
    schemaType: 'VideoGame',
    sitemapPriority: 0.9,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      'Mundo 1 (Ponte dos Portões 60fps) + Mundo 2 (Reino & Cidadela)',
      '20 Pegadinhas da Intuição com Fichas de Resgate Socráticas',
      'Pelotões Posicionais na Base 10 (Fusão Vai-Um: 1 · 10 · 0,1k · 1k...)',
    ],
  },

  // ── 4. HUB DO LABORATÓRIO (/laboratorio) ───────────────────────────────────
  {
    path: '/laboratorio',
    title: 'Laboratório de IA & Ferramentas Soberanas Local-First · Heiss-Lab',
    description:
      'Explore as ferramentas SaaS gratuitas e pesquisas de IA do Heiss-Lab: CV Maker 3.0, Sekundo Event Scheduler, Assistente Moeda, Gerador de Ocorrências e API Port.',
    keywords:
      'Laboratório Heiss Lab, ferramentas IA gratuitas, CV Maker, Sekundo, Assistente Moeda, Gerador de Ocorrências, API Port, local-first',
    badge: 'LABORATÓRIO DE ENGENHARIA & IA',
    cardSubtitle: '5 Ferramentas Soberanas Local-First + 40 Vídeos de Pesquisa em IA e Educação',
    emoji: '🔬',
    accentColor: '#a855f7',
    secondaryColor: '#38bdf8',
    iconPath: '/icons/icon-laboratorio.png',
    ogImagePath: '/og/laboratorio-hub.png',
    ogType: 'website',
    schemaType: 'CollectionPage',
    sitemapPriority: 0.9,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      'CV Maker 3.0 (YAML/PDF) & Sekundo (Planejador Local-First)',
      'Assistente Moeda (Finanças) & Gerador de Ocorrências Escolares PDF',
      'Porta USB Universal (OpenAPI) + Acervo de 40 Vídeos em Co-criação com IA',
    ],
  },

  // ── 5. FERRAMENTAS ESPECÍFICAS DO LABORATÓRIO ──────────────────────────────
  {
    path: '/laboratorio/cv-maker',
    title: 'CV Maker 3.0 · Compilador Universal de Currículos em YAML e PDF com IA | Heiss-Lab',
    description:
      'Crie currículos de alta densidade com 5 arquétipos em YAML, fórmula X-Y-Z do Google, editor visual Canvas livre, temas executivos e exportação PDF/HTML perfeita.',
    keywords:
      'CV Maker Heiss Lab, gerador de currículo IA, currículo YAML PDF, fórmula XYZ Google, compilador de currículos, currículo executivo grátis',
    badge: 'FERRAMENTA SAAS · IA & CARREIRAS',
    cardSubtitle: 'Engenharia de Currículos em YAML, Estúdio Canvas Livre e PDF de Alta Densidade',
    emoji: '📄',
    accentColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    iconPath: '/icons/icon-cv-maker.png',
    ogImagePath: '/og/tool-cv-maker.png',
    ogType: 'website',
    schemaType: 'SoftwareApplication',
    sitemapPriority: 0.95,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      '5 Arquétipos em YAML + Fórmula de Impacto X-Y-Z do Google',
      'Motor RealDOMSpatialBudgeter: paginação A4 sem cortes órfãos',
      'Estúdio Visual Canvas Livre + Exportação PDF Vetorial e HTML Offline',
    ],
  },
  {
    path: '/cv-maker',
    canonicalPath: '/laboratorio/cv-maker',
    title: 'CV Maker 3.0 · Compilador Universal de Currículos em YAML e PDF com IA | Heiss-Lab',
    description:
      'Crie currículos de alta densidade com 5 arquétipos em YAML, fórmula X-Y-Z do Google, editor visual Canvas livre, temas executivos e exportação PDF/HTML perfeita.',
    keywords:
      'CV Maker Heiss Lab, gerador de currículo IA, currículo YAML PDF, fórmula XYZ Google, compilador de currículos',
    badge: 'FERRAMENTA SAAS · IA & CARREIRAS',
    cardSubtitle: 'Engenharia de Currículos em YAML, Estúdio Canvas Livre e PDF de Alta Densidade',
    emoji: '📄',
    accentColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    iconPath: '/icons/icon-cv-maker.png',
    ogImagePath: '/og/tool-cv-maker.png',
    ogType: 'website',
    schemaType: 'SoftwareApplication',
    sitemapPriority: 0.8,
    changefreq: 'weekly',
    includeInSitemap: false, // Evita canibalização com /laboratorio/cv-maker no sitemap
    highlights: [
      '5 Arquétipos em YAML + Fórmula de Impacto X-Y-Z do Google',
      'Motor RealDOMSpatialBudgeter: paginação A4 sem cortes órfãos',
      'Estúdio Visual Canvas Livre + Exportação PDF Vetorial e HTML Offline',
    ],
  },
  {
    path: '/laboratorio/sekundo',
    title: 'Sekundo · Planejador Local-First de Finanças, Rotinas, Mapas e PDFs | Heiss-Lab',
    description:
      'Planejador agnóstico e 100% Local-First com chaves hierárquicas infinitas, sincronização P2P WebRTC efêmera, mapas interativos e preenchimento inteligente de PDFs.',
    keywords:
      'Sekundo, Sekundo Heiss Lab, planejador de eventos local-first, sincronização WebRTC P2P, gestão de rotinas e finanças, mapeador de PDF',
    badge: 'FERRAMENTA SAAS · PRODUTIVIDADE SOBERANA',
    cardSubtitle: 'Planejador de Eventos, Finanças, Territórios e Estúdio PDF 100% Local-First',
    emoji: '📅',
    accentColor: '#f59e0b',
    secondaryColor: '#10b981',
    iconPath: '/icons/icon-sekundo.png',
    ogImagePath: '/og/tool-sekundo.png',
    ogType: 'website',
    schemaType: 'SoftwareApplication',
    sitemapPriority: 0.95,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      'Arquitetura 100% Local-First: privacidade absoluta sem banco em nuvem',
      'Sincronização P2P WebRTC efêmera entre dispositivos via QR/Código',
      'Mapeamento híbrido de PDFs, escalas de eventos, finanças e territórios',
    ],
  },
  {
    path: '/laboratorio/assistente-moeda',
    title: 'Assistente Moeda · Gestão Financeira Diária e Relatórios Local-First | Heiss-Lab',
    description:
      'Controle receitas diárias, acompanhe médias automáticas (diária, semanal e mensal), simule cenários e exporte relatórios prontos para o WhatsApp 100% no seu dispositivo.',
    keywords:
      'Assistente Moeda, Assistente Moeda Heiss Lab, controle financeiro diário, planilha de receitas local, gestão financeira autônomos',
    badge: 'FERRAMENTA SAAS · FINANÇAS LOCAL-FIRST',
    cardSubtitle: 'Gestão Financeira Diária, Médias Estatísticas e Exportação Instantânea para WhatsApp',
    emoji: '💰',
    accentColor: '#10b981',
    secondaryColor: '#f59e0b',
    iconPath: '/icons/icon-moeda.png',
    ogImagePath: '/og/tool-assistente-moeda.png',
    ogType: 'website',
    schemaType: 'SoftwareApplication',
    sitemapPriority: 0.9,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      'Tabelas dinâmicas de receitas e despesas com cálculo automático de médias',
      'Motor estatístico local: zero envio de dados bancários para servidores',
      'Exportação formatada em 1 clique para prestação de contas no WhatsApp',
    ],
  },
  {
    path: '/laboratorio/ocorrencias',
    title: 'Gerador de Ocorrências Escolares em PDF com IA (Zero Dados Retidos) | Heiss-Lab',
    description:
      'Faça upload do formulário escolar em PDF, redija ou formalize o relato pedagógico e preencha o documento oficial com precisão milimétrica. Zero dados armazenados.',
    keywords:
      'Gerador de Ocorrências, ocorrências escolares PDF, preenchimento automático PDF escolar, IA para professores, Heiss Lab',
    badge: 'FERRAMENTA SAAS · AUTOMATIZAÇÃO PEDAGÓGICA',
    cardSubtitle: 'Mapeamento e Preenchimento Inteligente de Formulários Escolares em PDF',
    emoji: '📋',
    accentColor: '#06b6d4',
    secondaryColor: '#3b82f6',
    iconPath: '/icons/icon-ocorrencias.png',
    ogImagePath: '/og/tool-ocorrencias.png',
    ogType: 'website',
    schemaType: 'SoftwareApplication',
    sitemapPriority: 0.85,
    changefreq: 'monthly',
    includeInSitemap: true,
    highlights: [
      'Auto-descoberta de campos e solver tipográfico em PDFs oficiais',
      'Assinatura digital integrada e geração em lote via Web Workers',
      'Privacidade escolar blindada: processamento local sem retenção em banco',
    ],
  },
  {
    path: '/laboratorio/api-port',
    title: 'Porta USB Universal (API Port) · Interface Dinâmica OpenAPI | Heiss-Lab',
    description:
      'Conecte sistemas legados sem interface gráfica. Carregue qualquer contrato OpenAPI/Swagger e gere formulários validados, tabelas e exportação HAR automaticamente.',
    keywords:
      'API Port Heiss Lab, Porta USB Universal API, leitor OpenAPI dinâmico, cliente Swagger sem código, integração sistemas legados',
    badge: 'FERRAMENTA SAAS · INTEGRAÇÃO DE SISTEMAS',
    cardSubtitle: 'Transforme qualquer especificação OpenAPI em uma interface gráfica operacional na hora',
    emoji: '🔌',
    accentColor: '#ec4899',
    secondaryColor: '#8b5cf6',
    iconPath: '/icons/icon-api-port.png',
    ogImagePath: '/og/tool-api-port.png',
    ogType: 'website',
    schemaType: 'SoftwareApplication',
    sitemapPriority: 0.85,
    changefreq: 'monthly',
    includeInSitemap: true,
    highlights: [
      'Parser dinâmico de contratos OpenAPI 3.x / JSON Schema',
      'Geração automática de formulários, validação de payload e tabelas',
      'Auditoria e exportação de tráfego HTTP em formato HAR padrão',
    ],
  },

  // ── 6. HUB DO REPOSITÓRIO (/repositorio) ───────────────────────────────────
  {
    path: '/repositorio',
    title: 'Repositório Didático Aberto · Aulas de Matemática em LaTeX, PDFs e Vídeos | Heiss-Lab',
    description:
      'Acervo gratuito de Matemática e Filosofia: 18 apostilas completas em LaTeX/PDF, listas de desafios, músicas educativas e 40 vídeos organizados por trilhas temáticas.',
    keywords:
      'Repositório Heiss Lab, apostilas matemática PDF grátis, aulas LaTeX matemática, equações, frações, regra de três, números negativos, cálculo mental',
    badge: 'ACERVO DIDÁTICO ABERTO · CC BY-NC-SA 4.0',
    cardSubtitle: '18 Apostilas em LaTeX/PDF + 40 Vídeos em 9 Trilhas de Matemática Soberana',
    emoji: '📚',
    accentColor: '#38bdf8',
    secondaryColor: '#10b981',
    iconPath: '/icons/icon-repositorio.png',
    ogImagePath: '/og/repositorio-hub.png',
    ogType: 'website',
    schemaType: 'CollectionPage',
    sitemapPriority: 0.9,
    changefreq: 'weekly',
    includeInSitemap: true,
    highlights: [
      'Trilhas completas: Equações, Frações, Porcentagem, Divisores e Regra de Três',
      'Apostilas originais diagramadas em LaTeX com download direto em PDF',
      'Licença aberta Creative Commons para uso livre por professores e alunos',
    ],
  },

  // ── 7. PÁGINAS INSTITUCIONAIS ──────────────────────────────────────────────
  {
    path: '/sobre',
    title: 'Sobre o Heiss-Lab · Manifesto da Matemática Soberana e Engenharia com IA',
    description:
      'Conheça a filosofia do Heiss-Lab e do Prof. Augusto Heiss: resgatar a soberania intelectual, combater a decoreba mecânica e unir Matemática, Filosofia e IA.',
    keywords:
      'Augusto Heiss, sobre Heiss Lab, manifesto matemática soberana, filosofia da matemática, educação e inteligência artificial',
    badge: 'MANIFESTO & ARQUITETURA PEDAGÓGICA',
    cardSubtitle: 'Por que unimos Matemática Visual, Jogos Cognitivos e Engenharia Local-First',
    emoji: '✦',
    accentColor: '#a855f7',
    secondaryColor: '#f59e0b',
    iconPath: '/favicon.png',
    ogImagePath: '/og/sobre.png',
    ogType: 'website',
    schemaType: 'AboutPage',
    sitemapPriority: 0.7,
    changefreq: 'monthly',
    includeInSitemap: true,
    highlights: [
      'Combate à atrofia cognitiva e ao medo de errar na Matemática',
      'Software educacional público, gratuito e livre de anúncios predatórios',
      'Criado por Augusto Heiss — Professor, Pesquisador e Arquiteto de IA',
    ],
  },
  {
    path: '/privacidade',
    title: 'Política de Privacidade e Soberania de Dados · Heiss-Lab',
    description:
      'Política de Privacidade do portal Heiss-Lab (heisslab.com.br): arquitetura Local-First, conformidade com a LGPD e respeito integral aos dados do usuário.',
    keywords: 'política de privacidade Heiss Lab, LGPD, privacidade local-first',
    badge: 'GOVERNANÇA & LGPD',
    cardSubtitle: 'Compromisso com Arquitetura Local-First e Privacidade por Design',
    emoji: '🛡️',
    accentColor: '#64748b',
    secondaryColor: '#38bdf8',
    iconPath: '/favicon.png',
    ogImagePath: '/og/home.png',
    ogType: 'website',
    schemaType: 'WebPage',
    sitemapPriority: 0.3,
    changefreq: 'yearly',
    includeInSitemap: true,
    highlights: [
      'Processamento prioritariamente Local-First no navegador do usuário',
      'Conformidade integral com a Lei Geral de Proteção de Dados (LGPD)',
    ],
  },
  {
    path: '/termos',
    title: 'Termos de Uso e Licença Creative Commons · Heiss-Lab',
    description:
      'Termos de Uso e licenciamento Creative Commons CC BY-NC-SA 4.0 dos jogos, ferramentas SaaS e materiais didáticos do portal Heiss-Lab.',
    keywords: 'termos de uso Heiss Lab, licença Creative Commons CC BY-NC-SA 4.0',
    badge: 'TERMOS & LICENCIAMENTO ABERTO',
    cardSubtitle: 'Diretrizes de uso das ferramentas SaaS, jogos e apostilas didáticas',
    emoji: '⚖️',
    accentColor: '#64748b',
    secondaryColor: '#a855f7',
    iconPath: '/favicon.png',
    ogImagePath: '/og/home.png',
    ogType: 'website',
    schemaType: 'WebPage',
    sitemapPriority: 0.3,
    changefreq: 'yearly',
    includeInSitemap: true,
    highlights: [
      'Material didático sob licença aberta CC BY-NC-SA 4.0',
      'Uso gratuito para estudantes, professores e escolas',
    ],
  },
]

/**
 * Gera automaticamente os metadados exclusivos para cada aula do repositório (/repositorio/:slug)
 * a partir de `lessonPlans` em `src/data/content.ts`.
 */
export function buildLessonRoutesMeta(): RouteSeoMeta[] {
  const palette: Array<{ accent: string; secondary: string }> = [
    { accent: '#38bdf8', secondary: '#6366f1' },
    { accent: '#f59e0b', secondary: '#ec4899' },
    { accent: '#10b981', secondary: '#06b6d4' },
    { accent: '#a855f7', secondary: '#3b82f6' },
    { accent: '#f43f5e', secondary: '#f59e0b' },
  ]

  return lessonPlans.map((lesson, idx): RouteSeoMeta => {
    const colors = palette[idx % palette.length]
    const cleanDesc =
      lesson.description.length > 158
        ? `${lesson.description.slice(0, 155).trim()}...`
        : lesson.description

    return {
      path: `/repositorio/${lesson.slug}`,
      title: `${lesson.title} · Aula e PDF | Heiss-Lab`,
      description: cleanDesc,
      keywords: `${lesson.title}, ${lesson.subject}, ${lesson.grade}, apostila PDF matemática, aula LaTeX, Heiss Lab, Augusto Heiss`,
      badge: `AULA & PDF · ${lesson.grade.toUpperCase()}`,
      cardSubtitle: `${lesson.subject} · Apostila de ${lesson.pages} páginas com explicação passo a passo`,
      emoji: '📐',
      accentColor: colors.accent,
      secondaryColor: colors.secondary,
      iconPath: '/icons/icon-repositorio.png',
      ogImagePath: `/og/aula-${lesson.slug}.png`,
      ogType: 'article',
      schemaType: 'LearningResource',
      sitemapPriority: 0.8,
      changefreq: 'monthly',
      includeInSitemap: true,
      highlights: [
        `Público-alvo: ${lesson.grade} · Disciplina: ${lesson.subject}`,
        `Material didático completo (${lesson.pages} páginas) com equações em LaTeX`,
        lesson.available ? 'PDF imprimível disponível para download gratuito' : 'Leitura interativa completa no navegador',
      ],
    }
  })
}

export const ALL_ROUTES_META: RouteSeoMeta[] = [
  ...STATIC_ROUTES_META,
  ...buildLessonRoutesMeta(),
]

const ROUTE_MAP = new Map<string, RouteSeoMeta>(
  ALL_ROUTES_META.map((meta) => [normalizePathname(meta.path), meta])
)

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/'
  const clean = pathname.split('?')[0].split('#')[0].trim()
  if (clean === '' || clean === '/') return '/'
  return clean.endsWith('/') ? clean.slice(0, -1) : clean
}

export function resolveRouteMeta(pathname: string): RouteSeoMeta {
  const norm = normalizePathname(pathname)
  const exact = ROUTE_MAP.get(norm)
  if (exact) return exact

  // Sub-rotas dos apps do laboratório (ex.: /laboratorio/sekundo/hoje)
  if (norm.startsWith('/laboratorio/sekundo')) {
    return ROUTE_MAP.get('/laboratorio/sekundo')!
  }
  if (norm.startsWith('/laboratorio/assistente-moeda')) {
    return ROUTE_MAP.get('/laboratorio/assistente-moeda')!
  }
  if (norm.startsWith('/laboratorio/cv-maker') || norm.startsWith('/cv-maker')) {
    return ROUTE_MAP.get('/laboratorio/cv-maker')!
  }

  return ROUTE_MAP.get('/')!
}

export function getCanonicalUrl(meta: RouteSeoMeta): string {
  const targetPath = meta.canonicalPath ?? meta.path
  return targetPath === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${targetPath}`
}

export function getAbsoluteOgImageUrl(meta: RouteSeoMeta): string {
  return `${SITE_ORIGIN}${meta.ogImagePath}`
}

export function getAbsoluteIconUrl(meta: RouteSeoMeta): string {
  return `${SITE_ORIGIN}${meta.iconPath}`
}

/**
 * Constrói o grafo Schema.org JSON-LD específico para a rota, evitando que o Google
 * trate todas as URLs como se fossem a página inicial.
 */
export function buildRouteJsonLd(meta: RouteSeoMeta): Record<string, unknown> {
  const canonicalUrl = getCanonicalUrl(meta)
  const ogImageUrl = getAbsoluteOgImageUrl(meta)

  const breadcrumbItems: Array<Record<string, unknown>> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Heiss-Lab',
      item: `${SITE_ORIGIN}/`,
    },
  ]

  if (meta.path !== '/') {
    const segments = meta.path.split('/').filter(Boolean)
    if (segments.length === 1) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: meta.title.split('·')[0].trim(),
        item: canonicalUrl,
      })
    } else if (segments.length >= 2) {
      const parentMap: Record<string, { name: string; url: string }> = {
        jogos: { name: 'Jogos Cognitivos', url: `${SITE_ORIGIN}/jogos` },
        laboratorio: { name: 'Laboratório de IA', url: `${SITE_ORIGIN}/laboratorio` },
        repositorio: { name: 'Repositório Didático', url: `${SITE_ORIGIN}/repositorio` },
      }
      const parent = parentMap[segments[0]]
      if (parent) {
        breadcrumbItems.push({
          '@type': 'ListItem',
          position: 2,
          name: parent.name,
          item: parent.url,
        })
      }
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: meta.title.split('·')[0].trim(),
        item: canonicalUrl,
      })
    }
  }

  const baseEntity: Record<string, unknown> = {
    '@type': meta.schemaType,
    '@id': `${canonicalUrl}#webpage`,
    name: meta.title,
    headline: meta.title,
    description: meta.description,
    url: canonicalUrl,
    image: ogImageUrl,
    inLanguage: 'pt-BR',
    author: {
      '@type': 'Person',
      name: 'Augusto Heiss',
      url: `${SITE_ORIGIN}/sobre`,
    },
    publisher: {
      '@type': 'EducationalOrganization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'Heiss-Lab',
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/logo-heisslab.png`,
    },
  }

  if (meta.schemaType === 'VideoGame') {
    baseEntity.applicationCategory = 'GameApplication, EducationalApplication'
    baseEntity.operatingSystem = 'Web Browser'
    baseEntity.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    }
  } else if (meta.schemaType === 'SoftwareApplication') {
    baseEntity.applicationCategory = 'BusinessApplication, EducationalApplication'
    baseEntity.operatingSystem = 'Web Browser, Android, iOS'
    baseEntity.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
    }
  } else if (meta.schemaType === 'LearningResource') {
    baseEntity.learningResourceType = 'Lesson Plan, Study Guide'
    baseEntity.license = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
    baseEntity.isAccessibleForFree = true
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      baseEntity,
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
    ],
  }
}
