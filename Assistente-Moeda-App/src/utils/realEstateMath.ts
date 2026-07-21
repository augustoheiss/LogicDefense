export interface AmortizationPeriod {
  period: number;
  payment: number;
  interest: number;
  amortization: number;
  endingBalance: number;
}

export interface AmortizationSchedule {
  type: 'price' | 'sac';
  schedule: AmortizationPeriod[];
  totalPayments: number;
  totalInterest: number;
}

// ── 1. Amortization schedules generators ──
export function generatePriceSchedule(
  principal: number,
  annualRate: number,
  months: number
): AmortizationSchedule {
  const schedule: AmortizationPeriod[] = [];
  const i = annualRate / 12 / 100;
  if (i === 0) {
    const payment = principal / months;
    for (let t = 1; t <= months; t++) {
      schedule.push({
        period: t,
        payment,
        interest: 0,
        amortization: payment,
        endingBalance: principal - t * payment,
      });
    }
    return { type: 'price', schedule, totalPayments: principal, totalInterest: 0 };
  }

  const payment = principal * (i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
  let remainingBalance = principal;
  let totalPayments = 0;
  let totalInterest = 0;

  for (let t = 1; t <= months; t++) {
    const interest = remainingBalance * i;
    const amortization = payment - interest;
    remainingBalance = Math.max(0, remainingBalance - amortization);

    schedule.push({
      period: t,
      payment,
      interest,
      amortization,
      endingBalance: remainingBalance,
    });

    totalPayments += payment;
    totalInterest += interest;
  }

  return { type: 'price', schedule, totalPayments, totalInterest };
}

export function generateSACSchedule(
  principal: number,
  annualRate: number,
  months: number
): AmortizationSchedule {
  const schedule: AmortizationPeriod[] = [];
  const i = annualRate / 12 / 100;
  const amortization = principal / months;
  let remainingBalance = principal;
  let totalPayments = 0;
  let totalInterest = 0;

  for (let t = 1; t <= months; t++) {
    const interest = remainingBalance * i;
    const payment = amortization + interest;
    remainingBalance = Math.max(0, remainingBalance - amortization);

    schedule.push({
      period: t,
      payment,
      interest,
      amortization,
      endingBalance: remainingBalance,
    });

    totalPayments += payment;
    totalInterest += interest;
  }

  return { type: 'sac', schedule, totalPayments, totalInterest };
}

// ── 2. Extraordinary Amortization Recalculator ──
export interface RecalculationResult {
  newMonthsRemaining: number;
  newPayment: number;
  interestSaved: number;
}

export function recalculateExtraordinaryAmortization(
  type: 'price' | 'sac',
  remainingBalanceBeforeExtra: number,
  extraPayment: number,
  annualRate: number,
  remainingMonths: number,
  originalPayment: number,
  path: 'term' | 'payment'
): RecalculationResult {
  const i = annualRate / 12 / 100;
  const newBalance = Math.max(0, remainingBalanceBeforeExtra - extraPayment);

  if (newBalance === 0) {
    return { newMonthsRemaining: 0, newPayment: 0, interestSaved: remainingBalanceBeforeExtra * i * remainingMonths }; // simplified
  }

  // Generate standard projection without extraordinary payment to compare total interest
  let standardSchedule: AmortizationSchedule;
  if (type === 'price') {
    standardSchedule = generatePriceSchedule(newBalance + extraPayment, annualRate, remainingMonths);
  } else {
    standardSchedule = generateSACSchedule(newBalance + extraPayment, annualRate, remainingMonths);
  }

  if (path === 'term') {
    // Term Reduction Path (keep original payment or original amortization rate)
    if (type === 'price') {
      if (i === 0) {
        const newMonths = Math.ceil(newBalance / originalPayment);
        return {
          newMonthsRemaining: newMonths,
          newPayment: originalPayment,
          interestSaved: 0,
        };
      }
      // n' = - ln(1 - (SD' * i) / P) / ln(1+i)
      const ratio = 1 - (newBalance * i) / originalPayment;
      let newMonths = remainingMonths;
      if (ratio > 0) {
        newMonths = -Math.log(ratio) / Math.log(1 + i);
      }
      const roundedMonths = Math.ceil(newMonths);
      const newSchedule = generatePriceSchedule(newBalance, annualRate, roundedMonths);
      return {
        newMonthsRemaining: roundedMonths,
        newPayment: originalPayment,
        interestSaved: Math.max(0, standardSchedule.totalInterest - newSchedule.totalInterest),
      };
    } else {
      // SAC: n' = SD' / A
      const standardA = (newBalance + extraPayment) / remainingMonths;
      const roundedMonths = Math.ceil(newBalance / standardA);
      const newSchedule = generateSACSchedule(newBalance, annualRate, roundedMonths);
      return {
        newMonthsRemaining: roundedMonths,
        newPayment: standardA + newBalance * i, // first new payment
        interestSaved: Math.max(0, standardSchedule.totalInterest - newSchedule.totalInterest),
      };
    }
  } else {
    // Payment Reduction Path (keep remaining months constant)
    if (type === 'price') {
      const newSchedule = generatePriceSchedule(newBalance, annualRate, remainingMonths);
      const newPayment = newBalance * (i * Math.pow(1 + i, remainingMonths)) / (Math.pow(1 + i, remainingMonths) - 1);
      return {
        newMonthsRemaining: remainingMonths,
        newPayment: isNaN(newPayment) ? 0 : newPayment,
        interestSaved: Math.max(0, standardSchedule.totalInterest - newSchedule.totalInterest),
      };
    } else {
      // SAC: A' = SD' / n_rem
      const newSchedule = generateSACSchedule(newBalance, annualRate, remainingMonths);
      const newA = newBalance / remainingMonths;
      return {
        newMonthsRemaining: remainingMonths,
        newPayment: newA + newBalance * i, // first new payment
        interestSaved: Math.max(0, standardSchedule.totalInterest - newSchedule.totalInterest),
      };
    }
  }
}

// ── 3. Fisher Inflation real yield ──
export interface MultiYearYieldResult {
  nominalCashFlows: number[];
  realCashFlows: number[];
  nominalIRR: number;
  realIRR: number;
}

export function calculateRealYield(
  initialInvestment: number,
  initialRevenue: number,
  initialExpense: number,
  vacancyRate: number,
  igpmAnnualRate: number,
  ipcaAnnualRate: number,
  years: number
): MultiYearYieldResult {
  const nominalCashFlows: number[] = [];
  const realCashFlows: number[] = [];

  const igpm = igpmAnnualRate / 100;
  const ipca = ipcaAnnualRate / 100;

  for (let t = 1; t <= years; t++) {
    const rev = initialRevenue * (1 - vacancyRate / 100) * Math.pow(1 + igpm, t);
    const exp = initialExpense * Math.pow(1 + ipca, t);
    const cfNom = rev - exp;
    const cfReal = cfNom / Math.pow(1 + ipca, t);

    nominalCashFlows.push(cfNom);
    realCashFlows.push(cfReal);
  }

  // IRR solver using simple secant/bisection method
  function solveIRR(flows: number[], initialInv: number): number {
    let rLow = -0.99;
    let rHigh = 2.0;
    
    function npv(r: number) {
      let sum = -initialInv;
      for (let t = 0; t < flows.length; t++) {
        sum += flows[t] / Math.pow(1 + r, t + 1);
      }
      return sum;
    }

    // Binary search/Bisection method
    for (let step = 0; step < 100; step++) {
      const rMid = (rLow + rHigh) / 2;
      const val = npv(rMid);
      if (Math.abs(val) < 0.01) {
        return rMid * 100;
      }
      if (val > 0) {
        rLow = rMid;
      } else {
        rHigh = rMid;
      }
    }
    return ((rLow + rHigh) / 2) * 100;
  }

  const nominalIRR = solveIRR(nominalCashFlows, initialInvestment);
  const realIRR = solveIRR(realCashFlows, initialInvestment);

  return {
    nominalCashFlows,
    realCashFlows,
    nominalIRR,
    realIRR,
  };
}

// ── 4. Ross-Heidecke Physical Depreciation ──
export interface RossHeideckeResult {
  kd: number;
  depreciatedValue: number;
  annualCapExReserveRate: number;
  annualCapExReserveValue: number;
}

export function calculateRossHeidecke(
  valNew: number,
  valResidual: number,
  effectiveAge: number,
  usefulLife: number,
  heideckeState: number // 0.0 to 1.0
): RossHeideckeResult {
  if (usefulLife <= 0) {
    return { kd: 0, depreciatedValue: valNew, annualCapExReserveRate: 0, annualCapExReserveValue: 0 };
  }

  const x = Math.min(1.0, Math.max(0.0, effectiveAge / usefulLife));
  // Ross Coefficient alpha = 0.5 * (x + x^2)
  const alpha = 0.5 * (x + x * x);
  // Kd = alpha + H * (1 - alpha)
  const kd = alpha + heideckeState * (1 - alpha);

  const depreciatedValue = (valNew - valResidual) * (1 - kd) + valResidual;

  // Annual Marginal CapEx Reserve rate: deltaKd = (2t - 1 + L) / (2 * L^2) * (1 - H)
  // Let's compute deltaKd for t = effectiveAge + 1
  const t = effectiveAge + 1;
  const L = usefulLife;
  const deltaKd = ((2 * t - 1 + L) / (2 * L * L)) * (1 - heideckeState);

  const annualCapExReserveRate = deltaKd * 100;
  const annualCapExReserveValue = (valNew - valResidual) * deltaKd;

  return {
    kd,
    depreciatedValue,
    annualCapExReserveRate,
    annualCapExReserveValue,
  };
}
