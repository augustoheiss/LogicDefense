import type { TowerType, BuffType } from '../types/game'

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
  ],
  odio: [
    'Ta ficando molenga amigo, eu cuido disso rapidinho.',
    'Você não acha que é melhor desligar da tomada de vez brother?',
    'Cara você ainda ta nesse jogo de lixo? Vai pegar uma enxada.',
    'Brother quem você pensa que é? Você acha faz diferença algum resultado?',
    'To falando que é pra desligar a energia. Você quer que eu faça isso?',
  ],
  cadeira: [
    'Tenho um lugar aqui pra você amigo, senta, eu não vou puxar a Cadeira.',
    'Não somos mais crianças, agora você tem alguma coisa pra perder, certo?',
    'Mermão eu sou formado e você vem aqui com essa experiência? Sai dessa.',
    'Cara eu sou seu amigo, sempre tive do seu lado, não perca seu tempo.',
    'Quer sentar na minha cadeira? Você está no meu jogo.',
  ],
}

export const BUFF_DISPLAY: Record<BuffType, { emoji: string; label: string; color: string; borderColor: string }> = {
  amor: { emoji: '❤️', label: 'AMOR', color: '#00ff00', borderColor: '#00ff00' },
  odio: { emoji: '🔥', label: 'ÓDIO', color: '#ff0000', borderColor: '#ff0000' },
  cadeira: { emoji: '🪑', label: 'A CADEIRA', color: '#00d4ff', borderColor: '#00d4ff' },
}

export const TOTAL_TIME = 30
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 600
