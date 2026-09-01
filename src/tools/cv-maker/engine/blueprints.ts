import type { LayoutBlueprint, LayoutVariant } from '../types/cv'

/**
 * Registro Central Declarativo de Blueprints de Layout A4.
 * Permite a inclusão infinita de novos modelos com zero duplicação de JSX/HTML.
 */
export const LAYOUT_BLUEPRINTS: Record<LayoutVariant, LayoutBlueprint> = {
  modular: {
    id: 'modular',
    name: 'Modelo A4 01 - Modular Cards',
    label: '📐 Modelo A4 01 (Modular)',
    icon: '📐',
    description: 'Header dinâmico com avatar, badges em pílula e blocos modulares em caixas suaves.',
    gridTemplate: '1fr',
    sidebarPosition: 'none',
    mainZone: [
      'header',
      'summary',
      'work',
      'projects',
      'skills_tags',
      'education',
      'certificates',
      'languages',
      'references',
      'interests'
    ],
    customClass: 'layout-modular'
  },
  linear: {
    id: 'linear',
    name: 'Modelo A4 02 - Linear Clássico ATS',
    label: '📄 Modelo A4 02 (Linear)',
    icon: '📄',
    description: 'Linha contínua compacta estilo clássico/ATS com divisores finos e alta densidade.',
    gridTemplate: '1fr',
    sidebarPosition: 'none',
    mainZone: [
      'header',
      'contacts',
      'summary',
      'work',
      'education',
      'projects',
      'skills_tags',
      'certificates',
      'languages',
      'references',
      'interests'
    ],
    customClass: 'layout-linear'
  },
  sidebar: {
    id: 'sidebar',
    name: 'Modelo A4 03 - Executive Sidebar',
    label: '📑 Modelo A4 03 (Sidebar)',
    icon: '📑',
    description: '2 Colunas com barra lateral dedicada para perfil, contatos, competências e idiomas.',
    gridTemplate: '230px 1fr',
    sidebarPosition: 'left',
    sidebarZone: [
      'photo',
      'civil',
      'contacts',
      'skills_tags',
      'languages',
      'certificates',
      'references',
      'interests'
    ],
    mainZone: [
      'header',
      'summary',
      'work',
      'projects',
      'education'
    ],
    customClass: 'layout-sidebar'
  },
  compact_split: {
    id: 'compact_split',
    name: 'Modelo A4 04 - Split Duo (Victoria Wotton)',
    label: '🏛️ Modelo A4 04 (Executive Duo)',
    icon: '🏛️',
    description: 'Coluna esquerda com bio, barras de expertise e hobbies circulares; coluna direita com timeline e referências.',
    gridTemplate: '240px 1fr',
    sidebarPosition: 'left',
    sidebarZone: [
      'photo',
      'summary',
      'skills_bars',
      'interests',
      'civil',
      'languages'
    ],
    mainZone: [
      'header',
      'contacts',
      'work',
      'education',
      'projects',
      'certificates',
      'references'
    ],
    customClass: 'layout-compact_split'
  },
  editorial_accent: {
    id: 'editorial_accent',
    name: 'Modelo A4 05 - Brand Accent Block (Basil Hailward)',
    label: '🏷️ Modelo A4 05 (Brand Block)',
    icon: '🏷️',
    description: 'Bloco de topo marcante ("hello, i\'m"), foto vertical, badges de ano sólidos e marcadores em seta.',
    gridTemplate: '220px 1fr',
    sidebarPosition: 'left',
    heroZone: ['header'],
    sidebarZone: [
      'photo',
      'contacts',
      'skills_bars',
      'languages',
      'certificates',
      'civil',
      'interests'
    ],
    mainZone: [
      'summary',
      'work',
      'projects',
      'education',
      'references'
    ],
    hasHeroBanner: true,
    customClass: 'layout-editorial_accent'
  },
  corporate_timeline: {
    id: 'corporate_timeline',
    name: 'Modelo A4 06 - Navy Solid Timeline (Wilkins Micawber)',
    label: '⏱️ Modelo A4 06 (Navy Timeline)',
    icon: '⏱️',
    description: 'Sidebar sólida em Dark Navy, timeline com nós conectados, dados civis/CNH e barras de nível.',
    gridTemplate: '250px 1fr',
    sidebarPosition: 'left',
    sidebarZone: [
      'photo',
      'header',
      'contacts',
      'civil',
      'skills_bars',
      'languages',
      'interests'
    ],
    mainZone: [
      'summary',
      'work',
      'education',
      'projects',
      'certificates',
      'references'
    ],
    customClass: 'layout-corporate_timeline'
  },
  warm_magazine: {
    id: 'warm_magazine',
    name: 'Modelo A4 07 - Warm Editorial & Stamp (Editorial Cream)',
    label: '📰 Modelo A4 07 (Warm Editorial)',
    icon: '📰',
    description: 'Fundo bege editorial elegante, tipografia imponente, selo circular sobre o avatar e medidores visuais.',
    gridTemplate: '230px 1fr',
    sidebarPosition: 'left',
    heroZone: ['header'],
    sidebarZone: [
      'photo',
      'contacts',
      'skills_bars',
      'languages',
      'certificates',
      'civil',
      'interests'
    ],
    mainZone: [
      'summary',
      'work',
      'projects',
      'education',
      'references'
    ],
    hasHeroBanner: true,
    customClass: 'layout-warm_magazine'
  },
  hero_matrix: {
    id: 'hero_matrix',
    name: 'Modelo A4 08 - Hero Banner Matrix (Mary Smith)',
    label: '🖼️ Modelo A4 08 (Hero Matrix)',
    icon: '🖼️',
    description: 'Barra superior de contatos, hero header com foto à direita, grid duplo e matriz inferior de habilidades.',
    gridTemplate: '1fr',
    sidebarPosition: 'none',
    heroZone: ['contacts', 'header'],
    mainZone: [
      'summary',
      'work',
      'education',
      'projects',
      'skills_bars',
      'languages',
      'certificates',
      'references',
      'interests'
    ],
    hasHeroBanner: true,
    customClass: 'layout-hero_matrix'
  },
  dynamic_math: {
    id: 'dynamic_math',
    name: 'Modelo A4 09 - Dynamic Grid Math (Augusto Heiss / Mathematical Balance)',
    label: '🧮 Modelo A4 09 (Grid Math)',
    icon: '🧮',
    description: 'Grid matemático balanceado (3x2, 2x2, 3x3) com caixas em acento, divisor colorido e densidade editorial.',
    gridTemplate: '1fr',
    sidebarPosition: 'none',
    heroZone: ['header', 'contacts'],
    mainZone: [
      'summary',
      'work',
      'projects',
      'skills_tags',
      'education',
      'certificates',
      'languages',
      'interests',
      'references'
    ],
    hasHeroBanner: false,
    customClass: 'layout-dynamic_math'
  },
  canvas_livre: {
    id: 'canvas_livre',
    name: 'Modelo A4 10 - Block Canvas A4 Builder (Modo Livre)',
    label: '🎨 Modelo A4 10 (Modo Livre)',
    icon: '🎨',
    description: 'Editor modular visual livre em grid de 12 colunas, reordenação de blocos, foto com 8 molduras geométricas e texturas IA.',
    gridTemplate: 'repeat(12, 1fr)',
    sidebarPosition: 'none',
    mainZone: [
      'header',
      'photo',
      'contacts',
      'summary',
      'work',
      'projects',
      'skills_tags',
      'education',
      'certificates',
      'languages',
      'interests'
    ],
    customClass: 'layout-canvas_livre'
  }
}

/**
 * Retorna o blueprint pelo ID com fallback seguro para 'modular'.
 */
export function getLayoutBlueprint(id?: LayoutVariant): LayoutBlueprint {
  if (id && LAYOUT_BLUEPRINTS[id]) {
    return LAYOUT_BLUEPRINTS[id]
  }
  return LAYOUT_BLUEPRINTS.modular
}
