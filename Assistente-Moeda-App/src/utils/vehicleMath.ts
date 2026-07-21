import { formatCurrencySmart } from '../core/formatCurrency';

export interface CPKBreakdown {
  energyCost: number;
  tireCost: number;
  maintenanceCost: number;
  insuranceCost: number;
  depreciationCost: number;
  totalCPK: number;
}

export function calculateDynamicCPK(
  fcReal: number, // Fuel/Energy Consumption (L/100km or kWh/100km)
  pRef: number, // local base energy price (R$/L or R$/kWh)
  sigma90: number, // 90-day energy price volatility (R$)
  deltaDriver: number, // driver style factor (0.0 for normal, up to 0.15 for aggressive)
  numTires: number,
  tireUnitPrice: number,
  nominalTireLife: number, // Kref (km)
  iriRoad: number, // IRI road roughness index (e.g. 1.5 to 6.0)
  iriSensitivity: number, // lambda (e.g. 0.05 to 0.15)
  baseMaintCostPerKm: number,
  baseInsurancePremium: number, // annual static premium (R$)
  annualDistance: number, // km/year
  baseInsurancePerKm: number, // variable insurance cost per km
  numHarshEvents: number,
  refDistance: number, // UBI ref distance
  harshWeight: number, // UBI weight (e.g. 0.5 to 2.0)
  vehicleMSRP: number,
  deprecCoefAge: number, // beta_1
  deprecCoefKm: number, // beta_2
  deprecCoefInteraction: number, // beta_3
  ageYears: number
): CPKBreakdown {
  // 1. Energy Cost
  const energyCost = (fcReal * (pRef + sigma90) * (1 + deltaDriver)) / 100;

  // 2. Tire Cost: N_pneus * (C_unitario / (K_ref * e^(-lambda * IRI)))
  const tireLifeActual = nominalTireLife * Math.exp(-iriSensitivity * iriRoad);
  const tireCost = tireLifeActual > 0 ? (numTires * tireUnitPrice) / tireLifeActual : 0;

  // 3. Maintenance Cost
  const maintenanceCost = baseMaintCostPerKm;

  // 4. Insurance Cost (UBI): (P_estatico / K_anual) + C_km_base * (1 + (N_harsh / D_ref) * w)
  const insuranceCost =
    (annualDistance > 0 ? baseInsurancePremium / annualDistance : 0) +
    baseInsurancePerKm * (1 + (numHarshEvents / (refDistance || 1000)) * harshWeight);

  // 5. Depreciation Cost (using log-linear regression derivative approach per km)
  // Let V(t, d) = MSRP * exp(-beta_1 * t - beta_2 * d - beta_3 * t * d)
  // Approximate marginal depreciation per km at current age and km:
  // dV/dd = -V(t, d) * (beta_2 + beta_3 * t)
  const dAccumulated = annualDistance * ageYears; // estimate accumulated distance
  const valResidual =
    vehicleMSRP *
    Math.exp(
      -deprecCoefAge * ageYears -
        deprecCoefKm * (dAccumulated / 100000) -
        deprecCoefInteraction * ageYears * (dAccumulated / 100000)
    );
  // Scale beta coefficients appropriately (they are usually estimated per 100k km)
  const depreciationCost = valResidual * (deprecCoefKm + deprecCoefInteraction * ageYears) / 100000;

  const totalCPK = energyCost + tireCost + maintenanceCost + insuranceCost + depreciationCost;

  return {
    energyCost,
    tireCost,
    maintenanceCost,
    insuranceCost,
    depreciationCost,
    totalCPK,
  };
}

export function calculateResidualValue(
  msrp: number,
  ageYears: number,
  accumulatedKm: number,
  beta0: number, // intercept multiplier, usually 0 (since ln(MSRP) is the reference)
  beta1: number, // age coefficient
  beta2: number, // km coefficient (per 100,000 km)
  beta3: number // interaction coefficient
): number {
  const dScale = accumulatedKm / 100000;
  const exponent = beta0 - beta1 * ageYears - beta2 * dScale - beta3 * (ageYears * dScale);
  return msrp * Math.exp(exponent);
}

export interface InvestmentComparison {
  valOwnership: number;
  valRideshare: number;
  recommendation: 'ownership' | 'rideshare';
  description: string;
}

export function compareOwnershipVsRideshare(
  initialInvestment: number, // I0
  annualDistance: number,
  cpk: number,
  corporateTaxRate: number, // tau (e.g. 0.34)
  discountRate: number, // r (e.g. 10%)
  resaleValue: number, // V_residual
  rideshareCostPerKm: number,
  travelHoursYear: number,
  hourlyRate: number,
  workEfficiency: number // eta (0.0 to 1.0)
): InvestmentComparison {
  const r = discountRate / 100;
  const tau = corporateTaxRate / 100;

  // 1. VAL Ownership
  // Depreciation shield: Linear tax depreciation over 5 years
  const annualTaxDepreciation = initialInvestment / 5;
  const annualOpCost = cpk * annualDistance;

  let valOwnership = -initialInvestment;

  // 5 Year projection
  for (let t = 1; t <= 5; t++) {
    // OpCost after tax savings + Tax shield on depreciation
    const netCashFlow = annualOpCost * (1 - tau) - tau * annualTaxDepreciation;
    valOwnership -= netCashFlow / Math.pow(1 + r, t);
  }

  // Resale value in year 5 (assuming residual book value is 0)
  // Capital gains tax: tau * resaleValue
  const capitalGainsTax = resaleValue * tau;
  const netResale = resaleValue - capitalGainsTax;
  valOwnership += netResale / Math.pow(1 + r, 5);

  // 2. VAL Rideshare
  // Trips cost: rideshareCostPerKm * annualDistance
  // Back-seat productivity benefit: Hours * Rate * efficiency
  const annualRideshareCost = rideshareCostPerKm * annualDistance;
  const annualBenefit = travelHoursYear * hourlyRate * workEfficiency;
  const netRideshareFlow = annualRideshareCost - annualBenefit;

  let valRideshare = 0;
  for (let t = 1; t <= 5; t++) {
    valRideshare -= netRideshareFlow / Math.pow(1 + r, t);
  }

  // Comparison
  // Note: Both VALs are negative cash outflows.
  // The one that is less negative (closer to zero, or positive if benefit > cost) is better.
  const isOwnershipBetter = valOwnership > valRideshare;
  const recommendation = isOwnershipBetter ? 'ownership' : 'rideshare';

  const diff = Math.abs(valOwnership - valRideshare);
  const description = isOwnershipBetter
    ? `✅ Própria: Manter frota própria economiza ${formatCurrencySmart(diff / 5)} anualizados em relação ao uso de aplicativos corporativos, considerando impostos.`
    : `✅ Aplicativos: Terceirizar a mobilidade economiza ${formatCurrencySmart(diff / 5)} anualizados devido à produtividade recuperada durante viagens.`;

  return {
    valOwnership,
    valRideshare,
    recommendation,
    description,
  };
}

// ── 4. Weibull Predictive Maintenance Optimizer ──
export interface WeibullResult {
  optimalM: number;
  expectedCostAtOptimal: number;
  expectedCostAtMMBF: number;
  savings: number;
}

// Denominator integration: integral of e^(-(u/eta)^beta) du from 0 to M
export function integrateWeibullReliability(
  M: number,
  beta: number,
  eta: number
): number {
  if (M <= 0) return 0;
  const steps = 100;
  const h = M / steps;
  let sum = 0.5 * (1 + Math.exp(-Math.pow(M / eta, beta)));

  for (let j = 1; j < steps; j++) {
    const u = j * h;
    sum += Math.exp(-Math.pow(u / eta, beta));
  }

  return sum * h;
}

export function optimizeWeibullMaintenance(
  beta: number,
  eta: number,
  cPrev: number, // preventive replacement cost (R$)
  cCorr: number // corrective repair cost (R$, cCorr >> cPrev)
): WeibullResult {
  // MMBF (Mean Miles Between Failure) is the mean of Weibull:
  // Approximate Gamma(1 + 1/beta) for MMBF:
  // Using standard lookup/approximation for Gamma(1 + 1/b)
  function gammaApprox(z: number): number {
    // Lanczos approximation
    const g = 7;
    const p = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.3234285076536, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaApprox(1 - z));
    z -= 1;
    let x = p[0];
    for (let i = 1; i < g + 2; i++) {
      x += p[i] / (z + i);
    }
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  const mmbf = eta * gammaApprox(1 + 1 / beta);

  function expectedCost(M: number): number {
    const rel = Math.exp(-Math.pow(M / eta, beta)); // Reliability R(M)
    const num = cPrev * rel + cCorr * (1 - rel);
    const den = integrateWeibullReliability(M, beta, eta);
    return den > 0 ? num / den : Infinity;
  }

  // Find optimal M by scanning from 5% of eta to 150% of eta
  let optimalM = mmbf;
  let minCost = Infinity;

  const start = 0.05 * eta;
  const end = 1.5 * eta;
  const scanSteps = 150;
  const stepSize = (end - start) / scanSteps;

  for (let k = 0; k <= scanSteps; k++) {
    const M = start + k * stepSize;
    const cost = expectedCost(M);
    if (cost < minCost) {
      minCost = cost;
      optimalM = M;
    }
  }

  const expectedCostAtOptimal = minCost;
  const expectedCostAtMMBF = expectedCost(mmbf);
  const savings = Math.max(0, expectedCostAtMMBF - expectedCostAtOptimal);

  return {
    optimalM,
    expectedCostAtOptimal,
    expectedCostAtMMBF,
    savings,
  };
}
