export interface BackgroundOption {
  id: string
  name: string
  url: string
  category: 'none' | 'blueprint' | 'glass' | 'washi' | 'guilloche' | 'linen' | 'titanium' | 'gradient' | 'bauhaus' | 'carbon' | 'pearl'
  zone: 'all' | 'header' | 'paper' | 'sidebar' | 'card'
  aspectRatio: string
  previewColor: string
}

export const BACKGROUND_CATEGORIES = [
  { id: 'all', label: 'Todos', icon: '🌟' },
  { id: 'header', label: 'Banners Header (16:9)', icon: '🖼️' },
  { id: 'paper', label: 'Folha A4 (3:4)', icon: '📄' },
  { id: 'sidebar', label: 'Sidebar Vertical (9:16)', icon: '📑' },
  { id: 'card', label: 'Cards & Boxes (1:1 / 4:3)', icon: '🃏' },
] as const

export const BACKGROUND_CATALOG: BackgroundOption[] = [
  {
    id: 'none',
    name: 'Branco Puro (ATS Clean)',
    url: 'none',
    category: 'none',
    zone: 'all',
    aspectRatio: 'A4',
    previewColor: '#ffffff'
  },
  // Banners de Header (16:9)
  {
    id: 'bg-blueprint-01',
    name: 'Blueprint Arquitetura #01',
    url: '/cv-backgrounds/bg-blueprint-01.jpeg',
    category: 'blueprint',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#0f172a'
  },
  {
    id: 'bg-blueprint-02',
    name: 'Blueprint Grade Técnica #02',
    url: '/cv-backgrounds/bg-blueprint-02.jpeg',
    category: 'blueprint',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#0f172a'
  },
  {
    id: 'bg-blueprint-03',
    name: 'Blueprint Isométrico #03',
    url: '/cv-backgrounds/bg-blueprint-03.jpeg',
    category: 'blueprint',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#0f172a'
  },
  {
    id: 'bg-blueprint-04',
    name: 'Blueprint Engenharia #04',
    url: '/cv-backgrounds/bg-blueprint-04.jpeg',
    category: 'blueprint',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#0f172a'
  },
  {
    id: 'bg-glass-01',
    name: 'Vidro Prismático #01',
    url: '/cv-backgrounds/bg-glass-01.jpeg',
    category: 'glass',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-glass-02',
    name: 'Vidro Prismático #02',
    url: '/cv-backgrounds/bg-glass-02.jpeg',
    category: 'glass',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-glass-03',
    name: 'Vidro Prismático #03',
    url: '/cv-backgrounds/bg-glass-03.jpeg',
    category: 'glass',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-glass-04',
    name: 'Vidro Prismático #04',
    url: '/cv-backgrounds/bg-glass-04.jpeg',
    category: 'glass',
    zone: 'header',
    aspectRatio: '16:9',
    previewColor: '#f8fafc'
  },

  // Folha A4 Texturizada (3:4)
  {
    id: 'bg-washi-01',
    name: 'Papel Washi Artesanal #01',
    url: '/cv-backgrounds/bg-washi-01.jpeg',
    category: 'washi',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#fdfbf7'
  },
  {
    id: 'bg-washi-02',
    name: 'Papel Washi Fibras #02',
    url: '/cv-backgrounds/bg-washi-02.jpeg',
    category: 'washi',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#fdfbf7'
  },
  {
    id: 'bg-washi-03',
    name: 'Papel Washi Creme #03',
    url: '/cv-backgrounds/bg-washi-03.jpeg',
    category: 'washi',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#fdfbf7'
  },
  {
    id: 'bg-washi-04',
    name: 'Papel Washi Textura #04',
    url: '/cv-backgrounds/bg-washi-04.jpeg',
    category: 'washi',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#fdfbf7'
  },
  {
    id: 'bg-guilloche-01',
    name: 'Guilloché Segurança #01',
    url: '/cv-backgrounds/bg-guilloche-01.jpeg',
    category: 'guilloche',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-guilloche-02',
    name: 'Guilloché Ondas Finas #02',
    url: '/cv-backgrounds/bg-guilloche-02.jpeg',
    category: 'guilloche',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-guilloche-03',
    name: 'Guilloché Simetria #03',
    url: '/cv-backgrounds/bg-guilloche-03.jpeg',
    category: 'guilloche',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-guilloche-04',
    name: 'Guilloché Executivo #04',
    url: '/cv-backgrounds/bg-guilloche-04.jpeg',
    category: 'guilloche',
    zone: 'paper',
    aspectRatio: '3:4',
    previewColor: '#f8fafc'
  },

  // Sidebars Verticais (9:16)
  {
    id: 'bg-titanium-01',
    name: 'Titânio Escovado #01',
    url: '/cv-backgrounds/bg-titanium-01.jpeg',
    category: 'titanium',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#1e293b'
  },
  {
    id: 'bg-titanium-02',
    name: 'Titânio Escovado #02',
    url: '/cv-backgrounds/bg-titanium-02.jpeg',
    category: 'titanium',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#1e293b'
  },
  {
    id: 'bg-titanium-03',
    name: 'Grafite Carvão Dark #03',
    url: '/cv-backgrounds/bg-titanium-03.jpeg',
    category: 'titanium',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#0f172a'
  },
  {
    id: 'bg-titanium-04',
    name: 'Titânio Metálico #04',
    url: '/cv-backgrounds/bg-titanium-04.jpeg',
    category: 'titanium',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#1e293b'
  },
  {
    id: 'bg-gradient-01',
    name: 'Gradiente Índigo #01',
    url: '/cv-backgrounds/bg-gradient-01.jpeg',
    category: 'gradient',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#0f172a'
  },
  {
    id: 'bg-gradient-02',
    name: 'Gradiente Azul Noturno #02',
    url: '/cv-backgrounds/bg-gradient-02.jpeg',
    category: 'gradient',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#0f172a'
  },
  {
    id: 'bg-gradient-03',
    name: 'Gradiente Vertical Suave #03',
    url: '/cv-backgrounds/bg-gradient-03.jpeg',
    category: 'gradient',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#1e293b'
  },
  {
    id: 'bg-gradient-04',
    name: 'Gradiente Deep Navy #04',
    url: '/cv-backgrounds/bg-gradient-04.jpeg',
    category: 'gradient',
    zone: 'sidebar',
    aspectRatio: '9:16',
    previewColor: '#0b1120'
  },

  // Cards de Seção & Caixas (1:1 / 4:3)
  {
    id: 'bg-linen-01',
    name: 'Linho Cru Editorial #01',
    url: '/cv-backgrounds/bg-linen-01.jpeg',
    category: 'linen',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#f5f5f4'
  },
  {
    id: 'bg-linen-02',
    name: 'Linho Cru Editorial #02',
    url: '/cv-backgrounds/bg-linen-02.jpeg',
    category: 'linen',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#f5f5f4'
  },
  {
    id: 'bg-linen-03',
    name: 'Linho Cru Editorial #03',
    url: '/cv-backgrounds/bg-linen-03.jpeg',
    category: 'linen',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#f5f5f4'
  },
  {
    id: 'bg-linen-04',
    name: 'Linho Cru Editorial #04',
    url: '/cv-backgrounds/bg-linen-04.jpeg',
    category: 'linen',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#f5f5f4'
  },
  {
    id: 'bg-carbon-01',
    name: 'Carbono Terminal #01',
    url: '/cv-backgrounds/bg-carbon-01.jpeg',
    category: 'carbon',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#090d16'
  },
  {
    id: 'bg-carbon-02',
    name: 'Carbono Terminal #02',
    url: '/cv-backgrounds/bg-carbon-02.jpeg',
    category: 'carbon',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#090d16'
  },
  {
    id: 'bg-carbon-03',
    name: 'Grafite Dot Matrix #03',
    url: '/cv-backgrounds/bg-carbon-03.jpeg',
    category: 'carbon',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#090d16'
  },
  {
    id: 'bg-carbon-04',
    name: 'Grafite Dot Matrix #04',
    url: '/cv-backgrounds/bg-carbon-04.jpeg',
    category: 'carbon',
    zone: 'card',
    aspectRatio: '4:3',
    previewColor: '#090d16'
  },
  {
    id: 'bg-bauhaus-01',
    name: 'Bauhaus Geométrico #01',
    url: '/cv-backgrounds/bg-bauhaus-01.jpeg',
    category: 'bauhaus',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#fafaf9'
  },
  {
    id: 'bg-bauhaus-02',
    name: 'Bauhaus Geométrico #02',
    url: '/cv-backgrounds/bg-bauhaus-02.jpeg',
    category: 'bauhaus',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#fafaf9'
  },
  {
    id: 'bg-bauhaus-03',
    name: 'Bauhaus Modernista #03',
    url: '/cv-backgrounds/bg-bauhaus-03.jpeg',
    category: 'bauhaus',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#fafaf9'
  },
  {
    id: 'bg-bauhaus-04',
    name: 'Bauhaus Linhas & Planos #04',
    url: '/cv-backgrounds/bg-bauhaus-04.jpeg',
    category: 'bauhaus',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#fafaf9'
  },
  {
    id: 'bg-pearl-01',
    name: 'Onda Pérola Fluida #01',
    url: '/cv-backgrounds/bg-pearl-01.jpeg',
    category: 'pearl',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#ffffff'
  },
  {
    id: 'bg-pearl-02',
    name: 'Onda Pérola Fluida #02',
    url: '/cv-backgrounds/bg-pearl-02.jpeg',
    category: 'pearl',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#ffffff'
  },
  {
    id: 'bg-pearl-03',
    name: 'Pérola Líquida Escultural #03',
    url: '/cv-backgrounds/bg-pearl-03.jpeg',
    category: 'pearl',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#ffffff'
  },
  {
    id: 'bg-pearl-04',
    name: 'Pérola Suave Minimal #04',
    url: '/cv-backgrounds/bg-pearl-04.jpeg',
    category: 'pearl',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#ffffff'
  },
  {
    id: 'bg-pearl-05',
    name: 'Pérola Champagne #05',
    url: '/cv-backgrounds/bg-pearl-05.jpeg',
    category: 'pearl',
    zone: 'card',
    aspectRatio: '1:1',
    previewColor: '#ffffff'
  }
]
