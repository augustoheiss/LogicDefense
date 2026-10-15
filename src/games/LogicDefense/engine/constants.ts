import type { TowerType, BuffType, MathOp } from '../types/game'

export const TOWER_TYPES: TowerType[] = [
  { name: 'Soma', symbol: '+', shape: 'triangle', cost: 50, range: 120, damage: 25, rate: 25, color: '#ffeb3b' },
  { name: 'Sub', symbol: '-', shape: 'circle', cost: 120, range: 160, damage: 8, rate: 5, color: '#03a9f4', slow: true },
  { name: 'Mult', symbol: 'x', shape: 'square', cost: 300, range: 220, damage: 120, rate: 70, color: '#f44336', splash: true },
  { name: 'Div', symbol: '÷', shape: 'hexagon', cost: 450, range: 300, damage: 400, rate: 120, color: '#9c27b0' },
]

export const BUFF_PHRASES: Record<BuffType, string[]> = {
  amor: [
    'Pode deixar que o pai paga essa filhão, mas resolve essa aqui pra mim.',
    'Gênio do Sistema, a Lógica ta do seu lado e ela sempre vence.',
    'Potência, não se deixe levar por mais esse viés do Português.',
    'O erro é só um degrau, mermão. Sobe ele. Resolve essa.',
    'Acalma o coração e ativa o córtex. A resposta tá aí dentro.',
    'Desligue o seu Juiz interno. Aqui ninguém te julga, só evolui.',
    'Respira fundo, parceiro. Enxerga a massinha dos números que ela cede.',
    'Cada conta resolvida é uma corrente quebrada. Confia na sua mente!',
    'Se tropeçar, o Amor segura o multiplicador. Olha a dica e vai sem medo!',
    'Você não é uma máquina decoradora, você é a alma que domina a Balança.',
  ],
  odio: [
    'Ta ficando molenga amigo, eu cuido disso rapidinho.',
    'Você não acha que é melhor desligar da tomada de vez brother?',
    'Cara você ainda ta nesse jogo de lixo? Vai pegar uma enxada.',
    'Brother quem você pensa que é? Você acha faz diferença algum resultado?',
    'To falando que é pra desligar a energia. Você quer que eu faça isso?',
    'Vinte segundos no relógio. Vai travar agora ou vai provar que sabe pensar?',
    'A escola te ensinou a ter medo de número grande? Mostra sua fúria!',
    'Sem choro e sem calculadora. Ou você domina a conta ou ela te engole.',
    'Responde rápido se quiser o Overclock de 2.2x. Lento demais não sobrevive!',
    'O Juiz interno tá rindo de você. Vai deixar barato ou vai explodir essa onda?',
  ],
  cadeira: [
    'Tenho um lugar aqui pra você amigo, senta, eu não vou puxar a Cadeira.',
    'Não somos mais crianças, agora você tem alguma coisa pra perder, certo?',
    'Mermão eu sou formado e você vem aqui com essa experiência? Sai dessa.',
    'Cara eu sou seu amigo, sempre tive do seu lado, não perca seu tempo.',
    'Quer sentar na minha cadeira? Você está no meu jogo.',
    'Quatro caminhos na mesa. No Trono da Lógica, quem chuta perde tudo.',
    'Guarde seu ouro e acerte a conta: a Cadeira paga dividendos pra quem calcula.',
    'A geometria não tem emoção. Posicione suas torres e controle o centro.',
    'Eles querem que você peça emprestado na subtração. Use o Hack e governe.',
    'Senta no Trono. Mais alcance, upgrades mais baratos, mas quatro opções no teste.',
  ],
}

export const BUFF_DISPLAY: Record<
  BuffType,
  {
    emoji: string
    label: string
    subtitle: string
    color: string
    borderColor: string
    perks: string[]
    shortSummary: string
  }
> = {
  amor: {
    emoji: '❤️',
    label: 'AMOR',
    subtitle: '"O pai paga essa filhão — desligue o Juiz interno"',
    color: '#00ff00',
    borderColor: '#00ff00',
    shortSummary: 'Pista Iluminada • Escudo 1.0x no Erro • +2 Vidas a cada 3 Acertos • Vínculo Herói-Torre (+25% Vel.)',
    perks: [
      '💡 Pista Mental gratuita revelada na pergunta',
      '🛡️ Escudo do Perdão: errar mantém 1.0x (não cai para 0.5x)',
      '💚 +2 Vidas a cada 3 acertos seguidos (Streak)',
      '🧲 Heróis com +40% de imã, +25% valor de moeda e +25% vel. nas torres próximas',
    ],
  },
  odio: {
    emoji: '🔥',
    label: 'ÓDIO',
    subtitle: '"Vou desligar sua tomada — prove seu valor sob pressão"',
    color: '#ff4444',
    borderColor: '#ff0000',
    shortSummary: 'Relógio 20s • Overclock 2.2x (<8s) • +30% Dano Global • AoE Nuke 200px + Queimadura',
    perks: [
      '⏱️ Alta Tensão: cronômetro reduzido para 20s',
      '⚡ Overclock Crítico: acertar em <8s rende 2.2x Ouro (normal: 1.8x)',
      '🔥 +30% de Dano em todas as Torres e Heróis',
      '☢️ AoE Nuke expandido (200px) + Queimadura contínua nos inimigos',
    ],
  },
  cadeira: {
    emoji: '🪑',
    label: 'A CADEIRA',
    subtitle: '"Você está no meu jogo — geometria e dividendos"',
    color: '#00d4ff',
    borderColor: '#00d4ff',
    shortSummary: '4 Alternativas • +15% Juros sobre o Banco • -20% Custo de Upgrade • +25% Alcance de Torres',
    perks: [
      '🎯 Exigência do Trono: 4 alternativas na pergunta (1.6x Ouro)',
      '🏦 Dividendos da Cadeira: acertar rende +15% de juros sobre seu Ouro (até +$150)',
      '🛠️ Engenharia Soberana: -20% no custo de Upgrade de Torres e Heróis',
      '📐 +25% de Alcance nas Torres e -15% de velocidade nos inimigos no centro',
    ],
  },
}

export const RESONANCE_DISPLAY: Record<
  MathOp,
  {
    name: string
    label: string
    towerName: string
    color: string
    badge: string
    bonusText: string
    description: string
  }
> = {
  '+': {
    name: 'Ressonância da Balança',
    label: 'Ressonância da Balança (+)',
    towerName: 'Torre Soma (+)',
    color: '#ffeb3b',
    badge: '⚡ SOMA: +35% DANO + CADÊNCIA',
    bonusText: 'Torres de Soma (+) ganham +35% de dano e +18% de cadência nesta onda!',
    description: 'Torres de Soma (+) disparam rajadas duplas sincronizadas durante esta onda!',
  },
  '-': {
    name: 'Pulso de Zero Absoluto',
    label: 'Pulso de Zero Absoluto (-)',
    towerName: 'Torre Sub (-)',
    color: '#03a9f4',
    badge: '❄️ SUB: ZERO ABSOLUTO (90px SLOW)',
    bonusText: 'Torres de Subtração (-) congelam em área maior (90px) por mais tempo!',
    description: 'Torres de Subtração (-) congelam em área maior (75% lentidão) e amplificam o dano!',
  },
  'x': {
    name: 'Geometria dos Quadrados',
    label: 'Geometria dos Quadrados (×)',
    towerName: 'Torre Mult (×)',
    color: '#f44336',
    badge: '💥 MULT: SUPER SPLASH (85px ÁREA)',
    bonusText: 'Torres de Multiplicação (×) ampliam o splash para 85px com 75% de dano!',
    description: 'Torres de Multiplicação (×) dobram o raio de explosão com impacto crítico!',
  },
  '÷': {
    name: 'Raio da Fênix (142857)',
    label: 'Raio da Fênix (÷)',
    towerName: 'Torre Div (÷)',
    color: '#d500f9',
    badge: '🔮 DIV: RAIO DA FÊNIX (+45% VS TANKS/BOSS)',
    bonusText: 'Torres de Divisão (÷) causam dano crítico letal contra Tanques e Chefes!',
    description: 'Torres de Divisão (÷) canalizam o número 142857, causando +50% de dano letal!',
  },
}

export const TOTAL_TIME = 30
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 600
export const TOWER_CORE_LOOT_RADIUS = 55

