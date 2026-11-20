import React from 'react'

export type IconeId =
  | 'nucleo'
  | 'torre'
  | 'portao'
  | 'quartel'
  | 'britador'
  | 'serraria'
  | 'mina'
  | 'evoluir'
  | 'tropa'
  | 'todas'
  | 'atacar'
  | 'automatico'
  | 'reparar'
  | 'editarBlocos'
  | 'blocoAdicionar'
  | 'blocoRemover'
  | 'muralhaLinha'
  | 'consagrar'
  | 'subsolo'
  | 'menuMinimapas'
  | 'minimapaAtual'
  | 'minimapaAlguns'
  | 'minimapaTodos'
  | 'confirmar'
  | 'cancelar'
  | 'moverAqui'
  | 'desmarcar'

export interface MetaIntencao {
  id: IconeId
  titulo: string
  resumo: string
  detalhe: string
}

export const META_INTENCOES: Readonly<Record<IconeId, MetaIntencao>> = {
  nucleo: {
    id: 'nucleo',
    titulo: 'Núcleo da Cidadela',
    resumo: 'Centro do território neste quadrado (custo inicial grátis; 6s de construção frágil).',
    detalhe: 'No Nível 5 vira fortaleza habitável de 2 andares com bloquinhos editáveis. Deseja preparar a fundação?',
  },
  torre: {
    id: 'torre',
    titulo: 'Torre de Vigia e Cerco',
    resumo: 'Enxerga 22m e dispara por cima de trincheiras (1 bloco). No Nv. 5 vira mirante entrável e vê acima de 3 blocos!',
    detalhe: 'A planta transparente segue o ponteiro (verde válido / vermelho bloqueado). Confirmar seleção?',
  },
  portao: {
    id: 'portao',
    titulo: 'Portão Matemático (+10)',
    resumo: 'Arco tático que soma +10 soldados ao atravessar. No Nv. 5 vira arco triunfal fortificado com corredor aberto!',
    detalhe: 'Custo: 2 madeiras (ou 1 licença). Deseja posicionar com a planta transparente?',
  },
  quartel: {
    id: 'quartel',
    titulo: 'Quartel de Tropas',
    resumo: 'Ponto avançado para recrutar tropas de cerco e defesa (6s de construção frágil).',
    detalhe: 'Custo: 3 madeiras (ou 1 licença). No Nível 5 permite entrar e editar blocos. Confirmar?',
  },
  britador: {
    id: 'britador',
    titulo: 'Britador de Pedra',
    resumo: 'Converte a pedra de 35 kg em 3 lingotes para reparos e engenharia (5s frágil).',
    detalhe: 'Custo: grátis no 1º britador (depois 2 madeiras). Confirmar posicionamento?',
  },
  serraria: {
    id: 'serraria',
    titulo: 'Serraria Florestal',
    resumo: 'Gera madeira periodicamente perto de árvores e acelera colheita (5s frágil).',
    detalhe: 'Custo: 2 madeiras ou 1 licença. Deseja confirmar a construção da Serraria?',
  },
  mina: {
    id: 'mina',
    titulo: 'Mina de Ouro & Acesso ao Subsolo',
    resumo: 'Extrai ouro passivo e abre escada para explorar a galeria subterrânea em 1ª pessoa (6s frágil).',
    detalhe: 'Custo: 3 madeiras ou 1 licença. Deseja confirmar a construção da Mina?',
  },
  evoluir: {
    id: 'evoluir',
    titulo: 'Evoluir Construção (Nv. 1 → 5)',
    resumo: 'Aumenta vida, alcance e altura escalável. No Nível 5 libera interior caminhável e edição de blocos!',
    detalhe: 'Custo: 1 licença, ou 2 madeiras e 2 ouros.',
  },
  tropa: {
    id: 'tropa',
    titulo: 'Recrutar Tropa Aliada',
    resumo: 'Cria soldado aliado que ataca unidades e construções inimigas.',
    detalhe: 'Custo: 1 licença (ou 2 ouros). Confirmar recrutamento imediato?',
  },
  todas: {
    id: 'todas',
    titulo: 'Selecionar Todas as Tropas',
    resumo: 'Reúne todas as tropas vivas deste quadrado sob seu comando.',
    detalhe: 'Deseja confirmar a seleção de todo o pelotão local?',
  },
  atacar: {
    id: 'atacar',
    titulo: 'Ordem de Ataque / Cerco',
    resumo: 'Ordena às unidades selecionadas atacar o inimigo ou construção hostil mais próxima.',
    detalhe: 'Confirmar ofensiva imediata?',
  },
  automatico: {
    id: 'automatico',
    titulo: 'Vigia',
    resumo: 'A tropa e o herói enfrentam quem entra na visão e não atravessam o mapa.',
    detalhe: 'Vigia, no lugar ou calado. Aplica na hora.',
  },
  reparar: {
    id: 'reparar',
    titulo: 'Reparar Ruína Aliada',
    resumo: 'Reergue sua construção destruída (priorizando o Núcleo) e desatola unidades.',
    detalhe: 'Custo: 3 lingotes (ou 2 licenças / 3 ouros). Confirmar reparo?',
  },
  editarBlocos: {
    id: 'editarBlocos',
    titulo: 'Construir & Esculpir Blocos',
    resumo: 'Abre ferramentas de blocos livres no mapa (Madeira, Pedra/Lingote ou Ouro) e edição de fortalezas Nv. 5.',
    detalhe: 'Crie trincheiras (1 bloco), muralhas (2–3 blocos), escadas ou estruturas próprias. Confirmar?',
  },
  blocoAdicionar: {
    id: 'blocoAdicionar',
    titulo: 'Adicionar Bloco (Mapa ou Obra)',
    resumo: 'Coloca um bloco sólido no chão, empilhado sobre outro bloco ou na sua obra Nível 5 / consagrada.',
    detalhe: 'Escolha Madeira, Pedra ou Ouro. Arraste para girar a câmera livremente; clique ou toque para pôr.',
  },
  blocoRemover: {
    id: 'blocoRemover',
    titulo: 'Remover / Esculpir Bloco',
    resumo: 'Remove blocos livres do mapa ou esculpe portas, janelas e passagens em obras Nível 5 e consagradas.',
    detalhe: 'Confirmar modo Remover Bloco?',
  },
  muralhaLinha: {
    id: 'muralhaLinha',
    titulo: 'Linha de Blocos 360° (Trincheira / Muralha)',
    resumo: 'Arraste no chão em qualquer direção 360° para erguer trincheiras (1 bloco) ou muralhas (2–3 blocos).',
    detalhe: '1 bloco: torres ainda atiram por cima. 2+ blocos: bloqueiam visão de torres Nv. 1–4. Confirmar?',
  },
  consagrar: {
    id: 'consagrar',
    titulo: 'Consagrar Estrutura Manual',
    resumo: 'Transforma uma estrutura construída com blocos manuais em Núcleo, Torre, Quartel, Portão, Britador, Serraria ou Mina!',
    detalhe: 'Escolha o tipo desejado e clique em qualquer bloco conectado da sua construção manual. Confirmar?',
  },
  subsolo: {
    id: 'subsolo',
    titulo: 'Alternar Superfície / Subsolo',
    resumo: 'Desce para a galeria subterrânea de ouro (y = -3,2m) ou sobe de volta à superfície.',
    detalhe: 'Exige estar próximo a uma Mina nossa viva ou escada do subsolo. Confirmar travessia vertical?',
  },
  menuMinimapas: {
    id: 'menuMinimapas',
    titulo: 'Governança de Minimapas Ativos',
    resumo: 'Escolhe quantos quadrados rodam em tempo real simultaneamente (com proteção anti-travamento).',
    detalhe: 'Deseja abrir/fechar os ícones de modo dos minimapas?',
  },
  minimapaAtual: {
    id: 'minimapaAtual',
    titulo: 'Modo 1: Somente o Mapa Atual',
    resumo: 'Apenas o quadrado visível roda em tempo cheio (1 mapa); demais ficam em pulso leve.',
    detalhe: 'Ideal para economizar bateria e CPU máxima. Confirmar ativação deste modo?',
  },
  minimapaAlguns: {
    id: 'minimapaAlguns',
    titulo: 'Modo 2: Alguns Mapas (Vizinhança)',
    resumo: 'Mantém até 3 quadrados simultâneos em passo cheio (corpo, cena e fronteira).',
    detalhe: 'Equilíbrio recomendado entre mundo vivo e desempenho. Confirmar ativação?',
  },
  minimapaTodos: {
    id: 'minimapaTodos',
    titulo: 'Modo 3: Todos os Minimapas Ativos (Auto-Guard)',
    resumo: 'Deixa TODOS os quadrados descobertos rodando ao vivo enquanto o seu PC não travar!',
    detalhe: 'Monitora os FPS continuamente e freia os mais distantes só se o quadro passar de 28 ms. Confirmar?',
  },
  confirmar: {
    id: 'confirmar',
    titulo: 'Confirmar Ação',
    resumo: 'Executa a ação inspecionada.',
    detalhe: '',
  },
  cancelar: {
    id: 'cancelar',
    titulo: 'Cancelar',
    resumo: 'Fecha sem executar.',
    detalhe: '',
  },
  moverAqui: {
    id: 'moverAqui',
    titulo: 'Mover Seleção para o Chão',
    resumo: 'Ativa o modo de destino por clique ou toque único no mapa.',
    detalhe: 'Toque no terreno após ativar para deslocar tropas/herói selecionados.',
  },
  desmarcar: {
    id: 'desmarcar',
    titulo: 'Limpar Seleção',
    resumo: 'Deseleciona o herói e todas as tropas selecionadas.',
    detalhe: '',
  },
}

export const IconeSvg: React.FC<{ id: IconeId; size?: number }> = ({ id, size = 20 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (id) {
    case 'nucleo':
      return (
        <svg {...common}>
          <path d="M4 20h16V9l-4 2-4-5-4 5-4-2v11z" />
          <path d="M10 20v-5h4v5" />
        </svg>
      )
    case 'torre':
      return (
        <svg {...common}>
          <path d="M7 21h10l-1-12H8L7 21z" />
          <path d="M6 9h12V5h-3v2h-2V5h-2v2H9V5H6v4z" />
          <circle cx="12" cy="14" r="1.5" />
        </svg>
      )
    case 'portao':
      return (
        <svg {...common}>
          <path d="M4 20V8a8 8 0 0 1 16 0v12" />
          <path d="M9 20v-7a3 3 0 0 1 6 0v7" />
        </svg>
      )
    case 'quartel':
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      )
    case 'britador':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" />
        </svg>
      )
    case 'serraria':
      return (
        <svg {...common}>
          <path d="M12 3l6 8h-4l5 6H5l5-6H6l6-8z" />
          <path d="M12 17v4" />
        </svg>
      )
    case 'mina':
      return (
        <svg {...common}>
          <path d="M6 9l6-6 6 6-6 12L6 9z" />
          <path d="M6 9h12" />
        </svg>
      )
    case 'evoluir':
      return (
        <svg {...common}>
          <path d="M7 14l5-5 5 5" />
          <path d="M7 9l5-5 5 5" />
          <path d="M12 10v10" />
        </svg>
      )
    case 'tropa':
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      )
    case 'todas':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.5" />
          <circle cx="16" cy="8" r="2.5" />
          <path d="M3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0" />
        </svg>
      )
    case 'atacar':
      return (
        <svg {...common}>
          <path d="M4 20L19 5M14 5h5v5" />
          <path d="M20 20L5 5M10 5H5v5" />
        </svg>
      )
    case 'automatico':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-2.6-6.4" />
          <path d="M21 3v6h-6" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )
    case 'reparar':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z" />
        </svg>
      )
    case 'editarBlocos':
      return (
        <svg {...common}>
          <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
          <path d="M12 11l8-4.5M12 11v9M12 11L4 6.5" />
        </svg>
      )
    case 'blocoAdicionar':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      )
    case 'blocoRemover':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 12h8" />
        </svg>
      )
    case 'muralhaLinha':
      return (
        <svg {...common}>
          <path d="M3 18h18v-8H3v8z" />
          <path d="M3 10V6h4v4h3V6h4v4h3V6h4v4" />
          <path d="M9 10v8M15 10v8M3 14h18" />
        </svg>
      )
    case 'consagrar':
      return (
        <svg {...common}>
          <path d="M12 3l2.6 5.3L20 9.1l-4 3.9.9 5.5L12 15.8l-4.9 2.7.9-5.5-4-3.9 5.4-.8L12 3z" />
        </svg>
      )
    case 'subsolo':
      return (
        <svg {...common}>
          <path d="M4 6h16M7 6v14M17 6v14M7 10h10M7 14h10M7 18h10" />
        </svg>
      )
    case 'menuMinimapas':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <circle cx="17.5" cy="17.5" r="3.5" />
        </svg>
      )
    case 'minimapaAtual':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
          <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" />
        </svg>
      )
    case 'minimapaAlguns':
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="15" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="15" width="6" height="6" rx="1" />
        </svg>
      )
    case 'minimapaTodos':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="5" height="5" fill="currentColor" />
          <rect x="9.5" y="3" width="5" height="5" fill="currentColor" />
          <rect x="16" y="3" width="5" height="5" fill="currentColor" />
          <rect x="3" y="9.5" width="5" height="5" fill="currentColor" />
          <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" />
          <rect x="16" y="9.5" width="5" height="5" fill="currentColor" />
          <rect x="3" y="16" width="5" height="5" fill="currentColor" />
          <rect x="9.5" y="16" width="5" height="5" fill="currentColor" />
          <rect x="16" y="16" width="5" height="5" fill="currentColor" />
        </svg>
      )
    case 'confirmar':
      return (
        <svg {...common}>
          <path d="M5 13l4 4L19 7" />
        </svg>
      )
    case 'cancelar':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )
    case 'moverAqui':
      return (
        <svg {...common}>
          <path d="M12 2v14M12 16l-5-5M12 16l5-5" />
          <path d="M5 20h14" />
        </svg>
      )
    case 'desmarcar':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      )
  }
}
