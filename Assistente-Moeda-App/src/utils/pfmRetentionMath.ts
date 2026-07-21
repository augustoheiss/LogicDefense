// Box-Muller transform to generate standard normal pseudo-random numbers
export function randomNormal(mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + num * stdDev;
}

export interface MonteCarloResult {
  successRate: number; // percentage (0 to 100)
  medianEndingWealth: number;
  p10EndingWealth: number; // 10th percentile
  p90EndingWealth: number; // 90th percentile
}

export function runMonteCarloFIRE(
  initialWealth: number,
  annualDrawdown: number,
  expectedReturn: number, // mean real return (0.0 to 1.0)
  volatility: number, // standard deviation (0.0 to 1.0)
  years: number = 30,
  simulations: number = 10000
): MonteCarloResult {
  let successCount = 0;
  const endingWealths: number[] = [];

  // Optimized loop to prevent blocking UI main thread
  for (let i = 0; i < simulations; i++) {
    let currentWealth = initialWealth;
    let failed = false;

    for (let t = 0; t < years; t++) {
      if (currentWealth <= 0) {
        currentWealth = 0;
        failed = true;
        break;
      }
      const rate = randomNormal(expectedReturn, volatility);
      currentWealth = currentWealth * (1 + rate) - annualDrawdown;
    }

    if (!failed && currentWealth > 0) {
      successCount++;
    }
    endingWealths.push(currentWealth);
  }

  // Sort ending wealths to calculate percentiles
  endingWealths.sort((a, b) => a - b);
  const successRate = (successCount / simulations) * 100;
  const medianEndingWealth = endingWealths[Math.floor(simulations * 0.5)];
  const p10EndingWealth = endingWealths[Math.floor(simulations * 0.1)];
  const p90EndingWealth = endingWealths[Math.floor(simulations * 0.9)];

  return {
    successRate,
    medianEndingWealth,
    p10EndingWealth,
    p90EndingWealth,
  };
}

export interface CashFlowWeekPrediction {
  weekIndex: number;
  dateStr: string;
  projectedBalance: number;
  revenue: number;
  expenses: number;
  isNegative: boolean;
}

export function predict13WeekCashFlow(
  initialBalance: number,
  weeklyIncome: number,
  weeklyExpenses: number,
  customOneTimeEvents: { weekIndex: number; amount: number; isIncome: boolean }[] = []
): CashFlowWeekPrediction[] {
  const predictions: CashFlowWeekPrediction[] = [];
  let currentBalance = initialBalance;

  for (let w = 1; w <= 13; w++) {
    let oneTimeNet = 0;
    customOneTimeEvents
      .filter((e) => e.weekIndex === w)
      .forEach((e) => {
        oneTimeNet += e.isIncome ? e.amount : -e.amount;
      });

    const netWeeklyChange = weeklyIncome - weeklyExpenses + oneTimeNet;
    currentBalance += netWeeklyChange;

    predictions.push({
      weekIndex: w,
      dateStr: `Semana ${w}`,
      projectedBalance: currentBalance,
      revenue: weeklyIncome + (oneTimeNet > 0 ? oneTimeNet : 0),
      expenses: weeklyExpenses + (oneTimeNet < 0 ? -oneTimeNet : 0),
      isNegative: currentBalance < 0,
    });
  }

  return predictions;
}

export function generateTransactionHash(
  date: string,
  amountCents: number,
  description: string
): string {
  const cleanDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawString = `${date}_${amountCents}_${cleanDesc}`;
  
  // Simple deterministic hash function
  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

export interface OnboardingProgress {
  completedStepsCount: number;
  totalStepsCount: number;
  progressPercent: number;
  steps: { id: string; name: string; completed: boolean }[];
}

export function calculateOnboardingProgress(
  completedStepIds: string[]
): OnboardingProgress {
  const steps = [
    { id: 'vault_creation', name: 'Criar Cofre Criptografado Local', completed: true },
    { id: 'key_generation', name: 'Gerar Chave de Segurança WebCrypto', completed: true },
    { id: 'csv_import', name: 'Primeira Importação de Extrato CSV', completed: false },
    { id: 'fator_r_check', name: 'Calcular Fator R Tributário', completed: false },
    { id: 'price_sac_sim', name: 'Simular Tabela Amortização Imobiliária', completed: false },
    { id: 'cpk_telemetry', name: 'Ajustar Telemetria CPK Automóvel', completed: false },
    { id: 'monte_carlo_success', name: 'Simular FIRE de Longo Prazo', completed: false },
  ];

  // Auto-complete the first two steps (Endowed Progress Effect Rationale)
  const stepsWithStatus = steps.map((step) => {
    const isCompleted = step.completed || completedStepIds.includes(step.id);
    return { ...step, completed: isCompleted };
  });

  const completedStepsCount = stepsWithStatus.filter((s) => s.completed).length;
  const totalStepsCount = stepsWithStatus.length;
  const progressPercent = (completedStepsCount / totalStepsCount) * 100;

  return {
    completedStepsCount,
    totalStepsCount,
    progressPercent,
    steps: stepsWithStatus,
  };
}
