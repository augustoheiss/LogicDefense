import { Gate } from './contaContratos'

export type Olhar = 'primeira' | 'terceira' | 'imperio'
export type Postura = 'ordens' | 'automatico' | 'vigia' | 'noLugar' | 'calado'
export type PecaId = 'nucleo' | 'torre' | 'portao' | 'quartel' | 'britador' | 'serraria' | 'mina'
export type Papel = 'horda' | 'tropa' | 'sitiante' | 'isca' | 'dragao'
export type PoliticaMinimapas = 'atual' | 'alguns' | 'todos'
export type QualidadeGraficaPreset = 'auto' | 'leve' | 'bonito' | 'ultra'

export const OBRA_CENTRO_Y = 0.8
export const DIMENSOES_OBRA: Record<PecaId, [number, number, number]> = {
  nucleo: [2, 1.6, 2],
  quartel: [2, 1.6, 2],
  britador: [2, 1.6, 2],
  serraria: [1.9, 1.5, 1.9],
  mina: [2.1, 1.5, 2.1],
  torre: [1.1, 2.4, 1.1],
  portao: [2.4, 2.2, 0.4],
}

export const TEMPO_CONSTRUCAO: Record<PecaId, number> = {
  nucleo: 6,
  torre: 5,
  portao: 4,
  quartel: 6,
  britador: 5,
  serraria: 5,
  mina: 6,
}

export interface OrdemMover {
  tipo: 'mover'
  x: number
  z: number
  /**
   * O destino ORIGINAL que o jogador pediu, só quando ele fica FORA do quadrado do mapa (M5, pedido do usuário 23/11: tropas atravessam de mapa). `x`/`z` seguem PRESOS dentro do mapa (a formação e o A* só
   * enxergam pontos de dentro), e a tropa anda até a borda; o atlas lê `alem` para saber que ela quer passar e a transfere com a ordem convertida. Ausente em toda ordem com destino interno.
   */
  alem?: { x: number; z: number }
}

export interface OrdemAtacar {
  tipo: 'atacar'
  alvoId: number
}

export interface OrdemAtacarObra {
  tipo: 'atacarObra'
  obraId: number
}

export type Ordem = OrdemMover | OrdemAtacar | OrdemAtacarObra

export const PARTIDA = {
  vidaCap: 999_999,
  enemHabilitado: true as boolean,
  radius: 56,
  body: 0.35,
  eyeY: 1.6,
  pitchMin: -1.45,
  pitchMax: 1.45,
  pitchTetoTiro: 1,
  dtMax: 0.05,
  dtBudgetMax: 3,
  heroSpeed: 8,
  pulo: 9.6,
  gravidade: 28,
  allyCap: 24,
  tropaEspacoFormacao: 1.2,
  tropaRaioSeparacao: 0.85,
  enemyCap: 12,
  creditoInicial: 4,
  shootRange: 14,
  shootDot: 0.5,
  tiroFolgaMin: 0.55,
  tiroFolgaExtra: 2.1,
  tiroFolgaEscala: 6,
  tiroCorpoBaixo: 0.2,
  tiroCorpoAlto: 1.35,
  shootCooldown: 0.45,
  hitRadius: 0.9,
  hitDamage: 3,
  acquireHorda: 16,
  aggroZ: 22,
  acquireAliado: 22,
  allySpeed: 8,
  enemySpeed: 4.2,
  melee: 1.15,
  nucleoContato: 1.7,
  danoOrdem: 10,
  danoAutomatico: 4,
  danoSitio: 3,
  golpeCooldown: 0.5,
  nucleoHp: 100,
  obraMeio: 1.15,
  // O alcance, o dano e a visão da torre vêm de `evolucaoObra.ts` (a tabela de evolução, 23/11): `torreAlcance` (12) e `torreDano` (6) saíram daqui. A recarga continua aqui.
  torreCooldown: 0.8,
  ondaPeriodo: 20,
  pedraX: -8,
  pedraZ: 10,
  pedraKg: 35,
  pedraMeio: 0.4,
  pedraAltura: 0.7,
  britadorDivisor: 10,
  reparoLingotes: 3,
  reparoCredito: 2,
  nivelMaximoObra: 5,
  // O preço de evoluir NÃO mora mais aqui: cresce 1,5× por nível e vem de `custoDeEvoluir` (`evolucaoObra.ts`), a mesma tabela que `evoluir` cobra e que o painel mostra.
  rebroteArvoreSeg: 45,
  aguaFatorVelocidade: 0.55,
  custoAguaCaminho: 2.2,
  orcamentoFrameTodosMs: 28,
  orcamentoStepTodosMs: 9,
  maxLentosPorFrame: 2,
  visualPbrHabilitado: true as boolean,
  qualidadeGraficaPadrao: 'auto' as QualidadeGraficaPreset,
  capacidadePoolBiomasGpu: 2,
  mostrarFaixaTiroVisual: false as boolean,
  usarLoSPorAltura: true as boolean,
  alturaLinhaPadrao: 2 as 1 | 2 | 3,
  materialBlocoPadrao: 'madeira' as 'madeira' | 'pedra' | 'ouro',
  alcanceEdicaoBlocos: 7,
  limiarArrastoPx: 6,
  limiarArrastoRmbPx: 12,
  altarPasso: 4,
  altarRaio: 1.15,
  arch: { minX: -1.2, maxX: 1.2, minZ: 18, maxZ: 22 },
  asphaltEndZ: 40,
  celula: 1,
  espiral: 5,
  recalcularSeg: 0.4,
  maxVisitas: 5000,
  caminho: 'grade' as 'grade' | 'reto',
  levaDistancia: 16,
  levaPrimeira: 4,
  levaSeguinte: 1,
  levaAlvo: 'nucleo' as 'nucleo' | 'perto',
  corpoPasso: 3.2,
  nuvem: true as boolean,
  ladoMapa: 112,
  mapasResidentes: 3,
  atlas: 'grade' as 'grade' | 'um',
  visao: {
    heroi: 18,
    tropa: 12,
    obra: 10,
    // a visão da TORRE não é mais fixa: é o alcance dela (`alcanceDaTorre`, 22 m no nível 1, +2 m por nível), em `evolucaoObra.ts`.
  },
} as const

/**
 * O que uma conta CERTA paga, por grau (base 2: `bonus = 2^(grau + 1)` → +4 .. +256).
 * Graus 1..4 vêm dos motores paramétricos; graus 5..7 (Hardcore, Super Hardcore, Especialista)
 * são alimentados pelo acervo ENEM + motores ENEM-like. Cada erro divide o buff por 2 (`buffPorErro`).
 */
export type GrauConta = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const GRAU_PARTIDA: Record<GrauConta, { wipe: number; bonus: number; credito: number; rotulo: string; sub: string }> = {
  1: { wipe: 0.35, bonus: 4, credito: 1, rotulo: '🟢 Fácil (+4)', sub: 'Cálculo ágil' },
  2: { wipe: 0.6, bonus: 8, credito: 1, rotulo: '🔵 Médio (+8)', sub: 'Aritmética elegante' },
  3: { wipe: 0.85, bonus: 16, credito: 2, rotulo: '🟣 Difícil (+16)', sub: 'Problemas & álgebra' },
  4: { wipe: 1, bonus: 32, credito: 2, rotulo: '👑 Muito Difícil (+32)', sub: 'Desafios contextuais' },
  5: { wipe: 1, bonus: 64, credito: 3, rotulo: '🔥 Hardcore · ENEM (+64)', sub: 'ENEM · 1º nível' },
  6: { wipe: 1, bonus: 128, credito: 4, rotulo: '⚡ S. Hardcore · ENEM (+128)', sub: 'ENEM · Multi-passo' },
  7: { wipe: 1, bonus: 256, credito: 5, rotulo: '🏆 Especialista · ENEM (+256)', sub: 'ENEM · Alta complexidade' },
}

export const PLUS_TEN: Gate = {
  id: 'arco-mais-10',
  op: '+',
  operand: { value: 10, num: 10, den: 1 },
  label: '+10',
  readingTimeMs: 0,
}

export const OBSTACULOS: readonly { x: number; z: number; hx: number; hz: number; altura: number }[] = [
  { x: -1.65, z: 12, hx: 1.15, hz: 0.7, altura: 1.4 },
  { x: 1.65, z: 26, hx: 1.15, hz: 0.7, altura: 1.4 },
  { x: -1.55, z: 33, hx: 1.05, hz: 0.65, altura: 1.4 },
]
