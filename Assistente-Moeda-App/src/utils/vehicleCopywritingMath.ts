export interface HiddenDrainResult {
  depreciation: number;
  insurance: number;
  maintenanceReserve: number;
  taxesAndInterest: number;
  totalTrueTCO: number;
  hiddenDrain: number; // TCO - visiblePayment
}

export function calculateHiddenDrain(
  visibleLoanPayment: number,
  monthlyFuelCost: number,
  vehicleValue: number,
  annualMilage: number
): HiddenDrainResult {
  // Vincentric/AAA baseline estimates:
  // Depreciation: ~15% of value annually
  const depreciation = (vehicleValue * 0.15) / 12;
  // Insurance: static estimate
  const insurance = 220;
  // Maintenance reserve: ~R$ 0.15 per km or R$ 0.25 per mile
  const maintenanceReserve = (annualMilage * 0.20) / 12;
  // Taxes, Registration and Interest: ~5% of value annually
  const taxesAndInterest = (vehicleValue * 0.05) / 12;

  const totalTrueTCO = visibleLoanPayment + monthlyFuelCost + depreciation + insurance + maintenanceReserve + taxesAndInterest;
  const hiddenDrain = totalTrueTCO - visibleLoanPayment;

  return {
    depreciation,
    insurance,
    maintenanceReserve,
    taxesAndInterest,
    totalTrueTCO,
    hiddenDrain,
  };
}

export interface FreelancerTaxLossResult {
  lostMiles: number;
  lostDeduction: number;
  netTaxLoss: number;
}

export function calculateFreelancerTaxLoss(
  professionalMiles: number,
  omissionRate: number, // phi_omissao (0.0 to 1.0)
  taxRateIncome: number, // e.g. 27.5%
  taxRateSocial: number, // e.g. 11% or 15% self-employed
  isMetricKm: boolean = false
): FreelancerTaxLossResult {
  const lostMiles = professionalMiles * omissionRate;
  // 2026 standard rate: $0.725 USD/mile. For metric/BRL equivalent, we use R$ 3.60/km
  const ratePerUnit = isMetricKm ? 3.60 : 0.725;
  const lostDeduction = lostMiles * ratePerUnit;
  const netTaxLoss = lostDeduction * ((taxRateIncome / 100) + (taxRateSocial / 100));

  return {
    lostMiles,
    lostDeduction,
    netTaxLoss,
  };
}

export interface TVDENetHourlyResult {
  netHourlyIncome: number;
  deadheadMilesPerHour: number;
  totalCostPerHour: number;
  warningFlag: boolean;
}

export function calculateTVDENetHourly(
  grossHourlyEarnings: number,
  costPerMileOrKm: number,
  milesOrKmPerHour: number,
  deadheadRate: number // phi_deadhead (e.g. 0.35 to 0.42)
): TVDENetHourlyResult {
  const totalCostPerHour = costPerMileOrKm * milesOrKmPerHour;
  const netHourlyIncome = grossHourlyEarnings - totalCostPerHour;
  const deadheadMilesPerHour = milesOrKmPerHour * deadheadRate;
  
  // Warning flag if real hourly rate drops below standard minimum wage (e.g. R$ 10/hour or $15/hour)
  const warningFlag = netHourlyIncome < 15;

  return {
    netHourlyIncome,
    deadheadMilesPerHour,
    totalCostPerHour,
    warningFlag,
  };
}

export function calculateLogisticsDeadheadWaste(
  annualMilesOrKm: number,
  deadheadRate: number, // phi_deadhead
  fuelCostPerUnit: number
): number {
  return annualMilesOrKm * deadheadRate * fuelCostPerUnit;
}

export interface RestorationStage {
  id: string;
  name: string;
  baseCost: number;
  contingency: number; // 25% of baseCost
  totalCost: number;
}

export function calculateRestorationBudget(
  stages: { id: string; name: string; baseCost: number }[]
): {
  detailedStages: RestorationStage[];
  totalBaseCost: number;
  totalContingency: number;
  grandTotal: number;
} {
  let totalBaseCost = 0;
  let totalContingency = 0;

  const detailedStages = stages.map((stage) => {
    const contingency = stage.baseCost * 0.25;
    const totalCost = stage.baseCost + contingency;

    totalBaseCost += stage.baseCost;
    totalContingency += contingency;

    return {
      ...stage,
      contingency,
      totalCost,
    };
  });

  return {
    detailedStages,
    totalBaseCost,
    totalContingency,
    grandTotal: totalBaseCost + totalContingency,
  };
}
