// (os NÍVEIS d'água NÃO estão aqui: dependem da altura de base, que só o gerador real fornece; a Task 3 os compara contra o protótipo com a altura do gerador.)
// DADOS DO TESTE `aguaDoMundo.test.ts` (26/11/2026): os 13 rios que o PROTÓTIPO medido (`.superpowers/agua/agua-modelo.mjs`, 169 quadrados de −6 a 6) produziu. O módulo de produção tem de reproduzi-los:
// é o controle de que a PORTA do protótipo para `relevo/aguaDoMundo.ts` é fiel. Gerado por `.superpowers/agua/_listar-rios-do-prototipo.mjs`; NÃO editar à mão: se o desenho mudar de propósito, regerar e dizer no LEDGER.
export interface RioDeReferencia {
  readonly id: string
  readonly arestas: ReadonlyArray<readonly [number, number]>
  readonly n: number
  readonly p0: readonly [number, number]
  readonly pN: readonly [number, number]
}

export const RIOS_DE_REFERENCIA: readonly RioDeReferencia[] = [
  {
    "id": "H-3:-2:-4",
    "arestas": [
      [
        -4,
        -42
      ],
      [
        -3,
        -14
      ]
    ],
    "n": 145,
    "p0": [
      -408,
      -378
    ],
    "pN": [
      -264,
      -350
    ]
  },
  {
    "id": "H-4:-1:-5",
    "arestas": [
      [
        -5,
        42
      ],
      [
        -4,
        42
      ]
    ],
    "n": 145,
    "p0": [
      -520,
      -406
    ],
    "pN": [
      -376,
      -406
    ]
  },
  {
    "id": "H0:-2:-8",
    "arestas": [
      [
        -8,
        -42
      ],
      [
        -7,
        -14
      ]
    ],
    "n": 145,
    "p0": [
      -856,
      -42
    ],
    "pN": [
      -712,
      -14
    ]
  },
  {
    "id": "H3:-1:2",
    "arestas": [
      [
        2,
        -42
      ],
      [
        3,
        -14
      ]
    ],
    "n": 145,
    "p0": [
      264,
      294
    ],
    "pN": [
      408,
      322
    ]
  },
  {
    "id": "V-1:-1:-2",
    "arestas": [
      [
        -2,
        14
      ],
      [
        -1,
        42
      ],
      [
        0,
        14
      ]
    ],
    "n": 257,
    "p0": [
      -98,
      -184
    ],
    "pN": [
      -98,
      72
    ]
  },
  {
    "id": "V-3:-1:-2",
    "arestas": [
      [
        -2,
        -14
      ],
      [
        -1,
        -42
      ]
    ],
    "n": 145,
    "p0": [
      -350,
      -184
    ],
    "pN": [
      -378,
      -40
    ]
  },
  {
    "id": "V-4:0:4",
    "arestas": [
      [
        4,
        14
      ],
      [
        5,
        14
      ]
    ],
    "n": 145,
    "p0": [
      -434,
      488
    ],
    "pN": [
      -434,
      632
    ]
  },
  {
    "id": "V-5:-2:-7",
    "arestas": [
      [
        -7,
        14
      ],
      [
        -6,
        14
      ]
    ],
    "n": 145,
    "p0": [
      -546,
      -744
    ],
    "pN": [
      -546,
      -600
    ]
  },
  {
    "id": "V2:-2:-8",
    "arestas": [
      [
        -8,
        42
      ],
      [
        -7,
        42
      ]
    ],
    "n": 145,
    "p0": [
      266,
      -856
    ],
    "pN": [
      266,
      -712
    ]
  },
  {
    "id": "V4:-2:-7",
    "arestas": [
      [
        -7,
        -14
      ],
      [
        -6,
        -42
      ]
    ],
    "n": 145,
    "p0": [
      434,
      -744
    ],
    "pN": [
      406,
      -600
    ]
  },
  {
    "id": "V5:-1:-2",
    "arestas": [
      [
        -2,
        -14
      ],
      [
        -1,
        -42
      ]
    ],
    "n": 145,
    "p0": [
      546,
      -184
    ],
    "pN": [
      518,
      -40
    ]
  },
  {
    "id": "V6:-2:-7",
    "arestas": [
      [
        -7,
        14
      ],
      [
        -6,
        42
      ]
    ],
    "n": 145,
    "p0": [
      686,
      -744
    ],
    "pN": [
      714,
      -600
    ]
  },
  {
    "id": "V6:0:5",
    "arestas": [
      [
        5,
        42
      ],
      [
        6,
        42
      ],
      [
        7,
        14
      ]
    ],
    "n": 257,
    "p0": [
      714,
      600
    ],
    "pN": [
      686,
      856
    ]
  }
]
