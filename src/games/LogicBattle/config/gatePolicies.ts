// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/config/gatePolicies.ts — Políticas Declarativas (§3.8)
// ──────────────────────────────────────────────────────────────────────────────

export const GATE_POLICIES = {
  /** V9: Frequência base de pegadinhas em corridas de 6 segmentos: 1 a cada 2 segmentos (~2 por setor) */
  baseTrapEveryNSegments: 2,
  /** Perda máxima permitida em uma pegadinha comum (60%) */
  maxStandardTrapLossRatio: 0.6,
  /** Distância máxima (em segmentos) para surgir o Portão do Resgate após uma pegadinha */
  maxSegmentsUntilRedemptionGate: 2,
  /** Margem mínima exigida pelo Oráculo: melhor caminho >= inimigo * (1 + 0.15) */
  oracleBestMarginRatio: 0.15,
  /** Teto harmônico do Oráculo para evitar inflação exponencial em corridas iniciais */
  oracleMaxBestRatio: 2.4,
  /** Proporção máxima da recompensa regional que pode vir de bônus de sobreviventes */
  maxSurvivorReserveBonusRatio: 1.0,
  /** Margem concedida pelo Contrato de Resgate na Batalha Final (5% da força inimiga) */
  redemptionContractMarginRatio: 0.05,
  /** Tempo de leitura base por portão (ms) */
  baseReadingTimeMs: 2200,
  /** Acréscimo de leitura para operadores compostos/frações/decimais (ms) */
  complexOperatorReadingBonusMs: 800,
  /** Máximo de retentativas de seed no gerador antes de acionar o fallback autoral */
  maxSeedRetries: 32,
  /** A partir da 3ª ocorrência da mesma pegadinha, a cinemática encurta de 2,4s para 0,8s */
  shortCinematicAfterCount: 3,
  fullTrapCinematicMs: 2400,
  shortTrapCinematicMs: 800,
} as const

/**
 * Paleta honesta por operador (§2.1 R1):
 * A cor codifica EXCLUSIVAMENTE o operador matemático, jamais dando spoiler se o resultado é bom ou ruim.
 */
export const OPERATOR_PALETTE: Record<
  string,
  { border: string; fill: string; badgeBg: string; text: string; namePt: string }
> = {
  '+': {
    border: '#10b981',
    fill: 'rgba(16, 185, 129, 0.22)',
    badgeBg: '#065f46',
    text: '#d1fae5',
    namePt: 'Soma',
  },
  '−': {
    border: '#fb7185',
    fill: 'rgba(251, 113, 133, 0.22)',
    badgeBg: '#881337',
    text: '#ffe4e6',
    namePt: 'Subtração',
  },
  '×': {
    border: '#38bdf8',
    fill: 'rgba(56, 189, 248, 0.22)',
    badgeBg: '#075985',
    text: '#e0f2fe',
    namePt: 'Multiplicação',
  },
  '÷': {
    border: '#a855f7',
    fill: 'rgba(168, 85, 247, 0.22)',
    badgeBg: '#581c87',
    text: '#f3e8ff',
    namePt: 'Divisão',
  },
  '%+': {
    border: '#f97316',
    fill: 'rgba(249, 115, 22, 0.22)',
    badgeBg: '#7c2d12',
    text: '#ffedd5',
    namePt: 'Acréscimo Percentual',
  },
  '%−': {
    border: '#f97316',
    fill: 'rgba(249, 115, 22, 0.22)',
    badgeBg: '#7c2d12',
    text: '#ffedd5',
    namePt: 'Desconto Percentual',
  },
  '^': {
    border: '#facc15',
    fill: 'rgba(250, 204, 21, 0.24)',
    badgeBg: '#713f12',
    text: '#fef9c3',
    namePt: 'Potência',
  },
  '√': {
    border: '#facc15',
    fill: 'rgba(250, 204, 21, 0.24)',
    badgeBg: '#713f12',
    text: '#fef9c3',
    namePt: 'Raiz Quadrada',
  },
  expr: {
    border: '#2dd4bf',
    fill: 'rgba(45, 212, 191, 0.22)',
    badgeBg: '#115e59',
    text: '#ccfbf1',
    namePt: 'Expressão Composta',
  },
}
