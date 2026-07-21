export interface WelfordResult {
  mean: number;
  variance: number;
  stdDev: number;
}

export function welfordSinglePass(values: number[]): WelfordResult {
  if (values.length === 0) {
    return { mean: 0, variance: 0, stdDev: 0 };
  }
  let mean = 0;
  let S = 0;
  for (let k = 1; k <= values.length; k++) {
    const x = values[k - 1];
    const oldMean = mean;
    mean = oldMean + (x - oldMean) / k;
    S = S + (x - oldMean) * (x - mean);
  }
  const variance = values.length > 1 ? S / (values.length - 1) : 0;
  return {
    mean,
    variance,
    stdDev: Math.sqrt(variance),
  };
}

export function welfordSlidingWindow(values: number[], W: number): number[] {
  if (values.length === 0 || W <= 1) return [];
  const n = values.length;
  const rollingStdDevs: number[] = [];

  // First window of size W
  const limit = Math.min(n, W);
  const firstWindow = values.slice(0, limit);
  const init = welfordSinglePass(firstWindow);
  rollingStdDevs.push(init.stdDev);

  let mean = init.mean;
  let S = init.variance * (limit - 1);

  for (let t = W; t < n; t++) {
    const xt = values[t];
    const xtW = values[t - W];
    const oldMean = mean;

    mean = oldMean + (xt - xtW) / W;
    S = S + (xt - xtW) * (xt - mean + xtW - oldMean);

    const variance = S / (W - 1);
    rollingStdDevs.push(Math.sqrt(Math.max(0, variance)));
  }
  return rollingStdDevs;
}

export interface NCGResult {
  safetyStock: number;
  ncg: number;
  redZone: number; // Safety Stock
  yellowZone: number; // Lead time demand
  greenZone: number; // Cycle buffer
}

export function calculateNCG(
  dd: number,          // Average Daily Demand (D)
  lt: number,          // Lead Time (LT)
  serviceLevel: number, // 0.95 or 0.99
  sigmaD: number,      // Daily Demand Volatility
  sigmaLT: number      // Lead Time Volatility
): NCGResult {
  // Quantile Z_alpha
  const z = serviceLevel === 0.99 ? 2.33 : 1.645;

  const variance = lt * (sigmaD * sigmaD) + (dd * dd) * (sigmaLT * sigmaLT);
  const safetyStock = z * Math.sqrt(variance);
  const leadTimeDemand = dd * lt;
  const cycleStock = 0.5 * leadTimeDemand;

  const ncg = leadTimeDemand + safetyStock;

  return {
    safetyStock,
    ncg,
    redZone: safetyStock,
    yellowZone: leadTimeDemand,
    greenZone: cycleStock,
  };
}

export interface Scenario {
  probability: number;
  cashFlow: number;
}

export interface CFaRResult {
  expectedCashFlow: number;
  variance: number;
  stdDev: number;
  cfar95: number;
  cfar99: number;
}

export function calculateCFaR(scenarios: Scenario[]): CFaRResult {
  if (scenarios.length === 0) {
    return { expectedCashFlow: 0, variance: 0, stdDev: 0, cfar95: 0, cfar99: 0 };
  }

  // Normalize probabilities to sum to 1.0
  const totalProb = scenarios.reduce((acc, s) => acc + s.probability, 0);
  const normScenarios = scenarios.map((s) => ({
    probability: totalProb > 0 ? s.probability / totalProb : 1 / scenarios.length,
    cashFlow: s.cashFlow,
  }));

  const expectedCashFlow = normScenarios.reduce(
    (acc, s) => acc + s.probability * s.cashFlow,
    0
  );

  const variance = normScenarios.reduce(
    (acc, s) => acc + s.probability * Math.pow(s.cashFlow - expectedCashFlow, 2),
    0
  );

  const stdDev = Math.sqrt(variance);
  const cfar95 = expectedCashFlow - 1.645 * stdDev;
  const cfar99 = expectedCashFlow - 2.33 * stdDev;

  return {
    expectedCashFlow,
    variance,
    stdDev,
    cfar95,
    cfar99,
  };
}

export interface PayrollComparison {
  simplesNacional: {
    inssPatronal: number;
    terceiros: number;
    ratAjustado: number;
    fgts: number;
    totalCost: number;
    taxShield: number;
    effectiveCost: number;
  };
  lucroPresumido: {
    inssPatronal: number;
    terceiros: number;
    ratAjustado: number;
    fgts: number;
    totalCost: number;
    taxShield: number;
    effectiveCost: number;
  };
  lucroReal: {
    inssPatronal: number;
    terceiros: number;
    ratAjustado: number;
    fgts: number;
    totalCost: number;
    taxShield: number;
    effectiveCost: number;
  };
}

export function calculatePayrollTax(
  salary: number,
  ratBase: number,
  fap: number
): PayrollComparison {
  const ratAjustadoRate = ratBase * fap; // e.g. 0.02 * 1.0 = 0.02
  const fgtsRate = 0.08;
  const inssPatronalRate = 0.20;
  const terceirosRate = 0.058;

  // 1. Simples Nacional
  const fgtsSimples = salary * fgtsRate;
  const totalSimples = salary + fgtsSimples;
  const effectiveSimples = totalSimples;

  // 2. Lucro Presumido
  const inssPresumido = salary * inssPatronalRate;
  const terceirosPresumido = salary * terceirosRate;
  const ratPresumido = salary * ratAjustadoRate;
  const fgtsPresumido = salary * fgtsRate;
  const totalPresumido = salary + inssPresumido + terceirosPresumido + ratPresumido + fgtsPresumido;
  const effectivePresumido = totalPresumido;

  // 3. Lucro Real
  const inssReal = salary * inssPatronalRate;
  const terceirosReal = salary * terceirosRate;
  const ratReal = salary * ratAjustadoRate;
  const fgtsReal = salary * fgtsRate;
  const totalReal = salary + inssReal + terceirosReal + ratReal + fgtsReal;
  const taxShieldReal = totalReal * 0.34; // 34% deduction
  const effectiveReal = totalReal - taxShieldReal;

  return {
    simplesNacional: {
      inssPatronal: 0,
      terceiros: 0,
      ratAjustado: 0,
      fgts: fgtsSimples,
      totalCost: totalSimples,
      taxShield: 0,
      effectiveCost: effectiveSimples,
    },
    lucroPresumido: {
      inssPatronal: inssPresumido,
      terceiros: terceirosPresumido,
      ratAjustado: ratPresumido,
      fgts: fgtsPresumido,
      totalCost: totalPresumido,
      taxShield: 0,
      effectiveCost: effectivePresumido,
    },
    lucroReal: {
      inssPatronal: inssReal,
      terceiros: terceirosReal,
      ratAjustado: ratReal,
      fgts: fgtsReal,
      totalCost: totalReal,
      taxShield: taxShieldReal,
      effectiveCost: effectiveReal,
    },
  };
}
