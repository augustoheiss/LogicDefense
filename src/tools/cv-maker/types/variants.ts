/**
 * variants.ts — Catálogo de Variantes Visuais de Layout por Categoria de Bloco
 */

export interface BlockVariantOption {
  id: string
  label: string
  icon: string
  description: string
}

export const CATEGORY_VARIANTS_MAP: Record<string, BlockVariantOption[]> = {
  work: [
    {
      id: 'card_box',
      label: 'Box Card',
      icon: '📦',
      description: 'Card estruturado moderno com borda sutil, tag de período e badges'
    },
    {
      id: 'timeline',
      label: 'Timeline Clássica',
      icon: '⏱️',
      description: 'Marcador vertical com bullet clássico e recuo estilizado'
    },
    {
      id: 'minimal',
      label: 'Minimalista',
      icon: '📄',
      description: 'Apresentação limpa padrão corporativa'
    },
    {
      id: 'ultra_compact',
      label: 'Linha Ultra-Compacta',
      icon: '📏',
      description: 'One-liner (Empresa • Cargo • Período) para alta densidade A4'
    }
  ],
  education: [
    {
      id: 'card_box',
      label: 'Box Card Acadêmico',
      icon: '📦',
      description: 'Card com moldura, instituição destacada e badge de ano'
    },
    {
      id: 'timeline',
      label: 'Linha do Tempo',
      icon: '⏱️',
      description: 'Sequência cronológica com marcador lateral'
    },
    {
      id: 'ultra_compact',
      label: 'Linha Ultra-Compacta',
      icon: '📏',
      description: 'One-liner (Curso • Instituição • Ano) de máxima economia'
    }
  ],
  projects: [
    {
      id: 'card_box',
      label: 'Showcase Box',
      icon: '🚀',
      description: 'Card em destaque com tags de tecnologias e link externo'
    },
    {
      id: 'minimal',
      label: 'Lista com Link',
      icon: '🔗',
      description: 'Título clicável com resumo conciso'
    },
    {
      id: 'ultra_compact',
      label: 'Linha Compacta',
      icon: '📏',
      description: 'One-liner com nome, link e stack principal'
    }
  ],
  skills: [
    {
      id: 'badges',
      label: 'Pílulas / Badges',
      icon: '🏷️',
      description: 'Tags coloridas modernas agrupadas por área de domínio'
    },
    {
      id: 'bars',
      label: 'Barras de Progresso',
      icon: '📊',
      description: 'Nível visual com porcentagem e barra gráfica'
    },
    {
      id: 'minimal',
      label: 'Lista Textual',
      icon: '📝',
      description: 'Lista clássica separada por bullets e categorias'
    }
  ],
  languages: [
    {
      id: 'pill_badge',
      label: 'Pills com Tag de Nível',
      icon: '🌐',
      description: 'Idioma com etiqueta de proficiência estilizada'
    },
    {
      id: 'dots',
      label: 'Barra de Bolinhas (Dots)',
      icon: '⚪',
      description: 'Escala de proficiência de 1 a 5 pontos visuais'
    },
    {
      id: 'minimal',
      label: 'Linha Simples',
      icon: '📄',
      description: 'Texto clássico alinhado'
    }
  ],
  photo: [
    {
      id: 'circle',
      label: 'Circular com Borda',
      icon: '⭕',
      description: 'Avatar circular moderno'
    },
    {
      id: 'rounded_rect',
      label: 'Retangular Suave',
      icon: '🔲',
      description: 'Proporção retrato com cantos arredondados'
    },
    {
      id: 'editorial_stamp',
      label: 'Selo Editorial',
      icon: '📰',
      description: 'Estilo moldura de revista'
    }
  ],
  contacts: [
    {
      id: 'row',
      label: 'Linha Horizontal',
      icon: '↔️',
      description: 'Ícones e contatos distribuídos em linha'
    },
    {
      id: 'list',
      label: 'Coluna Vertical',
      icon: '↕️',
      description: 'Ideal para barras laterais e sidebars'
    },
    {
      id: 'grid',
      label: 'Grid 2 Colunas',
      icon: '⊞',
      description: 'Grade compacta de contatos'
    }
  ],
  certificates: [
    {
      id: 'card_box',
      label: 'Box Card',
      icon: '📜',
      description: 'Card com nome da certificação, emissor e data'
    },
    {
      id: 'minimal',
      label: 'Linha Simples',
      icon: '📄',
      description: 'One-liner compacto (Nome • Emissor • Ano)'
    },
    {
      id: 'pill_badge',
      label: 'Badge Pill',
      icon: '🏷️',
      description: 'Pílula moderna com etiqueta de emissor'
    }
  ],
  interests: [
    {
      id: 'card_box',
      label: 'Card com Tags',
      icon: '💡',
      description: 'Card com ícone, nome e nuvem de tags'
    },
    {
      id: 'circles',
      label: 'Círculo de Hobbies',
      icon: '⭕',
      description: 'Emblema circular minimalista com ícone central'
    },
    {
      id: 'minimal',
      label: 'Linha Textual',
      icon: '📝',
      description: 'Lista textual alinhada e compacta'
    }
  ]
}
