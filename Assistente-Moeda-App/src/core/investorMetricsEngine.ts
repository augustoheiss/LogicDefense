/**
 * Investor Metrics Engine — Assistente Moeda
 *
 * Mathematical and statistical engine for investor personas,
 * asset allocation tracking, emergency fund runway, FIRE target (4% rule),
 * and portfolio health scoring.
 *
 * Sovereignty: 100% pure functional calculations, offline-ready, local-first.
 */

import type {
  TableRow,
  AssetClass,
  InvestorProfileType,
  AssetAllocationTarget,
  InvestorProfileConfig,
  AssetPosition,
  InvestorMetrics,
} from './types';
import { calculateSmartRebalance } from './smartRebalancer';

// ── Archetype Allocation Presets ─────────────────────────────────────────────

export const DEFAULT_PERSONA_ALLOCATIONS: Record<InvestorProfileType, AssetAllocationTarget[]> = {
  safety: [
    { assetClass: 'cash_reserves', targetPercentage: 50, toleranceBandPercent: 5 },
    { assetClass: 'fixed_income_ipca', targetPercentage: 40, toleranceBandPercent: 5 },
    { assetClass: 'real_estate_funds', targetPercentage: 10, toleranceBandPercent: 5 },
  ],
  income: [
    { assetClass: 'real_estate_funds', targetPercentage: 45, toleranceBandPercent: 5 },
    { assetClass: 'fixed_income_ipca', targetPercentage: 30, toleranceBandPercent: 5 },
    { assetClass: 'equities_brazil', targetPercentage: 15, toleranceBandPercent: 5 },
    { assetClass: 'cash_reserves', targetPercentage: 10, toleranceBandPercent: 5 },
  ],
  balanced: [
    { assetClass: 'fixed_income_ipca', targetPercentage: 30, toleranceBandPercent: 5 },
    { assetClass: 'equities_brazil', targetPercentage: 25, toleranceBandPercent: 5 },
    { assetClass: 'real_estate_funds', targetPercentage: 20, toleranceBandPercent: 5 },
    { assetClass: 'equities_global', targetPercentage: 15, toleranceBandPercent: 5 },
    { assetClass: 'cash_reserves', targetPercentage: 10, toleranceBandPercent: 5 },
  ],
  aggressive: [
    { assetClass: 'equities_global', targetPercentage: 35, toleranceBandPercent: 5 },
    { assetClass: 'equities_brazil', targetPercentage: 25, toleranceBandPercent: 5 },
    { assetClass: 'crypto', targetPercentage: 15, toleranceBandPercent: 5 },
    { assetClass: 'real_estate_funds', targetPercentage: 15, toleranceBandPercent: 5 },
    { assetClass: 'cash_reserves', targetPercentage: 10, toleranceBandPercent: 5 },
  ],
  smb_hybrid: [
    { assetClass: 'business_capital', targetPercentage: 40, toleranceBandPercent: 5 },
    { assetClass: 'cash_reserves', targetPercentage: 25, toleranceBandPercent: 5 },
    { assetClass: 'fixed_income_ipca', targetPercentage: 20, toleranceBandPercent: 5 },
    { assetClass: 'real_estate_funds', targetPercentage: 15, toleranceBandPercent: 5 },
  ],
};

export const DEFAULT_PROFILE_CONFIGS: Record<InvestorProfileType, InvestorProfileConfig> = {
  safety: {
    profileType: 'safety',
    emergencyFundMonthsGoal: 12,
    fireTargetAnnualExpensesMultiplier: 25,
    monthlyContributionGoal: 1000,
    customAllocations: DEFAULT_PERSONA_ALLOCATIONS.safety,
  },
  income: {
    profileType: 'income',
    emergencyFundMonthsGoal: 6,
    fireTargetAnnualExpensesMultiplier: 25,
    monthlyContributionGoal: 1500,
    customAllocations: DEFAULT_PERSONA_ALLOCATIONS.income,
  },
  balanced: {
    profileType: 'balanced',
    emergencyFundMonthsGoal: 6,
    fireTargetAnnualExpensesMultiplier: 25,
    monthlyContributionGoal: 2000,
    customAllocations: DEFAULT_PERSONA_ALLOCATIONS.balanced,
  },
  aggressive: {
    profileType: 'aggressive',
    emergencyFundMonthsGoal: 6,
    fireTargetAnnualExpensesMultiplier: 25,
    monthlyContributionGoal: 2500,
    customAllocations: DEFAULT_PERSONA_ALLOCATIONS.aggressive,
  },
  smb_hybrid: {
    profileType: 'smb_hybrid',
    emergencyFundMonthsGoal: 12,
    fireTargetAnnualExpensesMultiplier: 25,
    monthlyContributionGoal: 3000,
    customAllocations: DEFAULT_PERSONA_ALLOCATIONS.smb_hybrid,
  },
};

// ── Asset Classification Heuristics ──────────────────────────────────────────

const GLOBAL_ETF_TICKERS = ['IVVB11', 'SPY', 'QQQ', 'VT', 'VOO', 'WRLD11', 'ACWI', 'NDIV11'];
const CRYPTO_TICKERS = ['BTC', 'ETH', 'SOL', 'ADA', 'USDT', 'USDC', 'HASH11', 'QBTC11', 'BITCOIN'];

export function detectAssetClass(row: TableRow): AssetClass {
  // 1. Explicit metadata
  if (row.metadataJson) {
    try {
      const meta = JSON.parse(row.metadataJson);
      if (meta.assetClass && isValidAssetClass(meta.assetClass)) {
        return meta.assetClass;
      }
    } catch {
      // ignore JSON errors
    }
  }

  // 2. Custom values
  if (row.customValues?.assetClass && isValidAssetClass(row.customValues.assetClass)) {
    return row.customValues.assetClass as AssetClass;
  }

  // 3. Ticker patterns
  const ticker = (row.ticker || '').toUpperCase().trim();
  if (ticker) {
    if (CRYPTO_TICKERS.some((c) => ticker.includes(c))) return 'crypto';
    if (GLOBAL_ETF_TICKERS.includes(ticker)) return 'equities_global';
    if (/^[A-Z]{4}11[B]?$/.test(ticker)) return 'real_estate_funds';
    if (/^[A-Z]{4}[3456]$/.test(ticker)) return 'equities_brazil';
    if (ticker.includes('SELIC') || ticker.includes('CDI')) return 'cash_reserves';
    if (ticker.includes('IPCA') || ticker.includes('NTNB') || ticker.includes('DEB')) return 'fixed_income_ipca';
  }

  // 4. Description & category patterns
  const desc = `${row.description || ''} ${row.category || ''} ${row.tags || ''}`.toLowerCase();
  if (/fii|fiagro|fundo imobil|imobiliario|fundo imob/i.test(desc)) return 'real_estate_funds';
  if (/btc|bitcoin|cripto|crypto|ethereum|eth|solana/i.test(desc)) return 'crypto';
  if (/global|etf mundial|nasdaq|s&p 500|sp500|exterior|bdr/i.test(desc)) return 'equities_global';
  if (/a[çc][oõ]es|b3|ibov|dividendos|small cap/i.test(desc)) return 'equities_brazil';
  if (/ipca|infla[çc][aã]o|ntn-b|renda fixa longo|debenture/i.test(desc)) return 'fixed_income_ipca';
  if (/giro|capital de giro|caixa da empresa|empresa|pj|negocio/i.test(desc)) return 'business_capital';
  if (/reserva|selic|cdi|caixinha|nuconta|liquidez|tesouro direto selic/i.test(desc)) return 'cash_reserves';

  // 5. Default
  return 'cash_reserves';
}

function isValidAssetClass(val: any): val is AssetClass {
  const valid: AssetClass[] = [
    'cash_reserves',
    'fixed_income_ipca',
    'real_estate_funds',
    'equities_brazil',
    'equities_global',
    'crypto',
    'business_capital',
  ];
  return valid.includes(val);
}

// ── Asset Position Calculations ──────────────────────────────────────────────

export function computeAssetPositions(
  rows: TableRow[],
  profileConfig: InvestorProfileConfig
): AssetPosition[] {
  const targets = profileConfig.customAllocations || DEFAULT_PERSONA_ALLOCATIONS[profileConfig.profileType] || [];
  
  // Only consider deposit / investment rows or rows with positive value and investment markers
  const investmentRows = rows.filter((r) => {
    return (
      r.entryType === 'deposit' ||
      r.ticker !== undefined ||
      r.quantity !== undefined ||
      (r.entryType === 'revenue' && /aporte|investimento|reserva|fii|a[çc][aã]o|tesouro/i.test(r.description || ''))
    );
  });

  // Sum value per asset class
  const classBalances: Partial<Record<AssetClass, number>> = {};
  targets.forEach((t) => {
    classBalances[t.assetClass] = 0;
  });

  investmentRows.forEach((r) => {
    const ac = detectAssetClass(r);
    classBalances[ac] = (classBalances[ac] || 0) + Math.abs(r.value);
  });

  const totalNetWorth = Object.values(classBalances).reduce((acc, v) => acc + (v || 0), 0);

  return targets.map((t) => {
    const currentValue = classBalances[t.assetClass] || 0;
    const currentPercentage = totalNetWorth > 0 ? (currentValue / totalNetWorth) * 100 : 0;
    const targetPercentage = t.targetPercentage;
    const deviationPercentage = currentPercentage - targetPercentage;
    const targetBRL = (targetPercentage / 100) * totalNetWorth;
    const deltaBRL = targetBRL - currentValue; // Positive = deficit (needs deposit), Negative = surplus

    return {
      assetClass: t.assetClass,
      currentValue: Math.round(currentValue * 100) / 100,
      currentPercentage: Math.round(currentPercentage * 10) / 10,
      targetPercentage: Math.round(targetPercentage * 10) / 10,
      deviationPercentage: Math.round(deviationPercentage * 10) / 10,
      deltaBRL: Math.round(deltaBRL * 100) / 100,
    };
  });
}

// ── Global Investor Metrics Aggregator ────────────────────────────────────────

export function computeInvestorMetrics(
  rows: TableRow[],
  profileConfig: InvestorProfileConfig,
  monthlyExpenses: number,
  newDepositAmountBRL: number = 0
): InvestorMetrics {
  const positions = computeAssetPositions(rows, profileConfig);
  const totalNetWorth = positions.reduce((acc, p) => acc + p.currentValue, 0);

  // Liquid emergency reserves
  const cashPosition = positions.find((p) => p.assetClass === 'cash_reserves');
  const liquidReserveBalance = cashPosition ? cashPosition.currentValue : 0;

  // Emergency Fund Runway (Months of survival covered)
  const safeExpenses = monthlyExpenses > 0 ? monthlyExpenses : 1;
  const emergencyFundMonthsAvailable = Math.round((liquidReserveBalance / safeExpenses) * 10) / 10;
  const emergencyGoalMonths = profileConfig.emergencyFundMonthsGoal || 6;
  const emergencyFundProgressPct = Math.min(
    100,
    Math.round((emergencyFundMonthsAvailable / emergencyGoalMonths) * 100)
  );

  // Passive Income Calculation (Dividends, Rendimentos, Proventos)
  const passiveRows = rows.filter((r) => {
    const d = `${r.description || ''} ${r.category || ''}`.toLowerCase();
    return (
      (r.entryType === 'revenue' || !r.entryType) &&
      (d.includes('dividendo') ||
        d.includes('rendimento') ||
        d.includes('provento') ||
        d.includes('jcp') ||
        d.includes('aluguel fii') ||
        r.category?.toLowerCase() === 'proventos')
    );
  });
  const totalPassiveIncome = passiveRows.reduce((acc, r) => acc + Math.abs(r.value), 0);
  
  // Determine distinct months with records to calculate true monthly average
  const distinctMonths = new Set(rows.map((r) => r.date.slice(0, 7))).size;
  const monthSpan = Math.max(1, distinctMonths);
  const passiveIncomeMonthlyAvg = Math.round((totalPassiveIncome / monthSpan) * 100) / 100;
  const passiveIncomeCoverageRatio = monthlyExpenses > 0
    ? Math.round((passiveIncomeMonthlyAvg / monthlyExpenses) * 1000) / 10
    : 0;

  // FIRE Number Target (Rule of 4% / Multiplier)
  const multiplier = profileConfig.fireTargetAnnualExpensesMultiplier || 25;
  const annualExpenses = monthlyExpenses * 12;
  const fireNumberTarget = Math.round(annualExpenses * multiplier);
  const fireProgressPercentage = fireNumberTarget > 0
    ? Math.min(100, Math.round((totalNetWorth / fireNumberTarget) * 1000) / 10)
    : 0;

  // Smart Cash-In Rebalance Suggestions
  const depositToSimulate = newDepositAmountBRL > 0
    ? newDepositAmountBRL
    : profileConfig.monthlyContributionGoal || 1000;
  const rebalanceSuggestions = calculateSmartRebalance(positions, depositToSimulate);

  // Portfolio Health Score (0 to 100)
  const portfolioHealthScore = calculatePortfolioHealthScore(
    emergencyFundProgressPct,
    positions,
    passiveIncomeCoverageRatio,
    fireProgressPercentage
  );

  return {
    totalNetWorth,
    liquidReserveBalance,
    emergencyFundMonthsAvailable,
    emergencyFundProgressPct,
    passiveIncomeMonthlyAvg,
    passiveIncomeCoverageRatio,
    fireNumberTarget,
    fireProgressPercentage,
    positions,
    rebalanceSuggestions,
    portfolioHealthScore,
  };
}

// ── Portfolio Health Score Formula ───────────────────────────────────────────

function calculatePortfolioHealthScore(
  emergencyPct: number,
  positions: AssetPosition[],
  passiveCoveragePct: number,
  fireProgressPct: number
): number {
  // 1. Emergency Fund Resilience (35% weight)
  const emergencyScore = Math.min(100, emergencyPct);

  // 2. Allocation Discipline (35% weight) — Lower absolute deviation yields higher score
  const avgDeviation = positions.length > 0
    ? positions.reduce((acc, p) => acc + Math.abs(p.deviationPercentage), 0) / positions.length
    : 0;
  const allocationScore = Math.max(0, 100 - avgDeviation * 4);

  // 3. Passive Income Coverage (15% weight)
  const passiveScore = Math.min(100, passiveCoveragePct * 2);

  // 4. FIRE Trajectory (15% weight)
  const fireScore = Math.min(100, fireProgressPct * 2.5);

  const finalScore = (
    emergencyScore * 0.35 +
    allocationScore * 0.35 +
    passiveScore * 0.15 +
    fireScore * 0.15
  );

  return Math.round(finalScore);
}
