export interface AltmanResult {
  score: number;
  zone: 'danger' | 'grey' | 'safe';
  description: string;
}

export function calculateAltmanZScore(
  workingCapitalCents: number,
  retainedEarningsCents: number,
  ebitCents: number,
  netWorthCents: number,
  totalAssetsCents: number,
  totalLiabilitiesCents: number,
  salesCents: number
): AltmanResult {
  if (totalAssetsCents <= 0) {
    return { score: 0, zone: 'danger', description: 'Ativo Total inválido ou nulo.' };
  }

  const x1 = workingCapitalCents / totalAssetsCents;
  const x2 = retainedEarningsCents / totalAssetsCents;
  const x3 = ebitCents / totalAssetsCents;
  const x4 = totalLiabilitiesCents > 0 ? netWorthCents / totalLiabilitiesCents : 0;
  const x5 = salesCents / totalAssetsCents;

  const score = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 0.999 * x5;

  let zone: 'danger' | 'grey' | 'safe' = 'danger';
  let description = '';

  if (score < 1.1) {
    zone = 'danger';
    description = 'Zona de Perigo (Alto Risco de Insolvência)';
  } else if (score < 2.6) {
    zone = 'grey';
    description = 'Zona Cinzenta (Risco Moderado / Atenção)';
  } else {
    zone = 'safe';
    description = 'Zona Segura (Solvente / Baixo Risco)';
  }

  return { score, zone, description };
}

export interface BeneishResult {
  aqi: number;
  manipulationRisk: boolean;
  description: string;
}

export function calculateBeneishAQI(
  currentAssetsT: number,
  fixedAssetsT: number,
  investmentsT: number,
  totalAssetsT: number,
  currentAssetsPrev: number,
  fixedAssetsPrev: number,
  investmentsPrev: number,
  totalAssetsPrev: number
): BeneishResult {
  if (totalAssetsT <= 0 || totalAssetsPrev <= 0) {
    return { aqi: 1.0, manipulationRisk: false, description: 'Ativos Totais insuficientes para cálculo.' };
  }

  const numerator = 1 - (currentAssetsT + fixedAssetsT + investmentsT) / totalAssetsT;
  const denominator = 1 - (currentAssetsPrev + fixedAssetsPrev + investmentsPrev) / totalAssetsPrev;

  if (denominator === 0) {
    return { aqi: 1.0, manipulationRisk: false, description: 'Denominador nulo no cálculo do AQI.' };
  }

  const aqi = numerator / denominator;
  const manipulationRisk = aqi > 1.0;
  const description = manipulationRisk
    ? '⚠️ Alerta: AQI > 1.0 indica possível capitalização inadequada de despesas operacionais.'
    : '✅ Conforme: AQI normal indica ausência de desvio na qualidade dos ativos.';

  return { aqi, manipulationRisk, description };
}

export interface FinancialRatiosResult {
  currentRatio: number;
  quickRatio: number;
  dso: number;
  debtToEquity: number;
  grossMargin: number;
  ebitdaMargin: number;
}

export function calculateFinancialRatios(
  currentAssetsCents: number,
  currentLiabilitiesCents: number,
  cashAndReceivablesCents: number,
  receivablesCents: number,
  annualCreditSalesCents: number,
  totalLiabilitiesCents: number,
  netWorthCents: number,
  grossProfitCents: number,
  salesCents: number,
  ebitdaCents: number
): FinancialRatiosResult {
  const currentRatio = currentLiabilitiesCents > 0 ? currentAssetsCents / currentLiabilitiesCents : 0;
  const quickRatio = currentLiabilitiesCents > 0 ? cashAndReceivablesCents / currentLiabilitiesCents : 0;
  const dso = annualCreditSalesCents > 0 ? (receivablesCents / annualCreditSalesCents) * 365 : 0;
  const debtToEquity = netWorthCents > 0 ? totalLiabilitiesCents / netWorthCents : 0;
  const grossMargin = salesCents > 0 ? (grossProfitCents / salesCents) * 100 : 0;
  const ebitdaMargin = salesCents > 0 ? (ebitdaCents / salesCents) * 100 : 0;

  return {
    currentRatio,
    quickRatio,
    dso,
    debtToEquity,
    grossMargin,
    ebitdaMargin,
  };
}

export interface LedgerValidationResult {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
}

export function validateDoubleEntryLedger(
  entries: { amountInCents: number; entryType: 'debit' | 'credit' }[]
): LedgerValidationResult {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    if (entry.entryType === 'debit') {
      totalDebits += entry.amountInCents;
    } else {
      totalCredits += entry.amountInCents;
    }
  }

  const difference = Math.abs(totalDebits - totalCredits);
  return {
    balanced: difference === 0,
    totalDebits,
    totalCredits,
    difference,
  };
}
