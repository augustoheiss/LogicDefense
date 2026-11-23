/** Gerado por scripts/organizar-figuras-matematica.py (v2 HD). So matematica. ETEC. */
export interface FiguraManifesto {
  readonly src: string
  readonly alt: string
  readonly largura: number
  readonly altura: number
  readonly papel: 'enunciado' | 'alternativa'
  readonly letra?: 'A' | 'B' | 'C' | 'D' | 'E'
}

export const FIGURAS: Readonly<Record<string, readonly FiguraManifesto[]>> = {
  'etec:2016:2:26': [
    { src: '/etec/figuras/2016-2/q26.png', alt: 'Figura da questao 26 de matematica (ETEC)', largura: 480, altura: 392, papel: 'enunciado' },
  ],
  'etec:2016:2:29': [
    { src: '/etec/figuras/2016-2/q29.png', alt: 'Figura da questao 29 de matematica (ETEC)', largura: 742, altura: 457, papel: 'enunciado' },
  ],
  'etec:2017:1:10': [
    { src: '/etec/figuras/2017-1/q10.png', alt: 'Figura da questao 10 de matematica (ETEC)', largura: 1053, altura: 287, papel: 'enunciado' },
  ],
  'etec:2017:2:32': [
    { src: '/etec/figuras/2017-2/q32.png', alt: 'Figura da questao 32 de matematica (ETEC)', largura: 575, altura: 549, papel: 'enunciado' },
  ],
  'etec:2017:2:35': [
    { src: '/etec/figuras/2017-2/q35.png', alt: 'Figura da questao 35 de matematica (ETEC)', largura: 545, altura: 530, papel: 'enunciado' },
  ],
  'etec:2018:2:31': [
    { src: '/etec/figuras/2018-2/q31.png', alt: 'Figura da questao 31 de matematica (ETEC)', largura: 1203, altura: 485, papel: 'enunciado' },
  ],
  'etec:2019:1:49': [
    { src: '/etec/figuras/2019-1/q49.png', alt: 'Figura da questao 49 de matematica (ETEC)', largura: 478, altura: 279, papel: 'enunciado' },
  ],
  'etec:2020:1:33': [
    { src: '/etec/figuras/2020-1/q33.png', alt: 'Figura da questao 33 de matematica (ETEC)', largura: 521, altura: 503, papel: 'enunciado' },
  ],
}
