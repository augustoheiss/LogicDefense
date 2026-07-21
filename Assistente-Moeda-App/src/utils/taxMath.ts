export interface FatorRResult {
  fatorR: number;
  anexo: 'III' | 'V';
  nominalRate: number;
  effectiveRate: number;
  proLaboreAdjustment: number;
  description: string;
}

export function calculateFatorR(
  massaSalarial12: number,
  receitaBruta12: number
): FatorRResult {
  let fatorR = 0;
  if (receitaBruta12 === 0) {
    fatorR = massaSalarial12 > 0 ? 1.0 : 0.0;
  } else {
    fatorR = massaSalarial12 / receitaBruta12;
  }

  const anexo = fatorR >= 0.28 ? 'III' : 'V';
  
  // Nominal rate and deduction brackets
  let nominalRate = 0;
  let deduction = 0;

  if (anexo === 'III') {
    if (receitaBruta12 <= 180000) {
      nominalRate = 0.06;
      deduction = 0;
    } else if (receitaBruta12 <= 360000) {
      nominalRate = 0.112;
      deduction = 9360;
    } else if (receitaBruta12 <= 720000) {
      nominalRate = 0.135;
      deduction = 17640;
    } else if (receitaBruta12 <= 1800000) {
      nominalRate = 0.16;
      deduction = 35640;
    } else if (receitaBruta12 <= 3600000) {
      nominalRate = 0.21;
      deduction = 125640;
    } else {
      nominalRate = 0.33;
      deduction = 648000;
    }
  } else {
    if (receitaBruta12 <= 180000) {
      nominalRate = 0.155;
      deduction = 0;
    } else if (receitaBruta12 <= 360000) {
      nominalRate = 0.18;
      deduction = 4500;
    } else if (receitaBruta12 <= 720000) {
      nominalRate = 0.195;
      deduction = 9900;
    } else if (receitaBruta12 <= 1800000) {
      nominalRate = 0.205;
      deduction = 17100;
    } else if (receitaBruta12 <= 3600000) {
      nominalRate = 0.23;
      deduction = 62100;
    } else {
      nominalRate = 0.305;
      deduction = 540000;
    }
  }

  let effectiveRate = receitaBruta12 > 0
    ? (receitaBruta12 * nominalRate - deduction) / receitaBruta12
    : nominalRate;

  if (effectiveRate < 0.06 && anexo === 'III') effectiveRate = 0.06;
  if (effectiveRate < 0.155 && anexo === 'V') effectiveRate = 0.155;

  const targetMassa = receitaBruta12 * 0.28;
  const proLaboreAdjustment = Math.max(0, targetMassa - massaSalarial12);

  const description = anexo === 'III'
    ? `✅ Anexo III: Fator R de ${(fatorR * 100).toFixed(1)}% atinge o limite legal de 28%, garantindo alíquota efetiva reduzida de ${(effectiveRate * 100).toFixed(2)}%.`
    : `⚠️ Anexo V: Fator R de ${(fatorR * 100).toFixed(1)}% está abaixo dos 28%. Aumentar pró-labore em ${formatCurrencySmart(proLaboreAdjustment)} acumulados enquadrará sua TI no Anexo III.`;

  return {
    fatorR,
    anexo,
    nominalRate,
    effectiveRate,
    proLaboreAdjustment,
    description,
  };
}

export interface PresumidoResult {
  presumptionRate: number;
  baseIRPJ: number;
  irpj: number;
  csll: number;
  pis: number;
  cofins: number;
  totalTax: number;
  effectiveRate: number;
}

export function calculateLucroPresumido(
  revenueQuarterly: number,
  plp182Enabled: boolean
): PresumidoResult {
  // Service presumption base: 32%. Under PLP 182/2025, if annual revenue > 1.2M (or quarterly > 300k), increases to 35.2%.
  const presumptionRate = plp182Enabled && revenueQuarterly > 300000 ? 0.352 : 0.32;

  const baseIRPJ = revenueQuarterly * presumptionRate;
  const baseCSLL = revenueQuarterly * presumptionRate;

  // IRPJ: 15% base + 10% surcharge on trimestral base exceeding 60,000
  const irpjBaseTax = baseIRPJ * 0.15;
  const irpjSurcharge = baseIRPJ > 60000 ? (baseIRPJ - 60000) * 0.10 : 0;
  const irpj = irpjBaseTax + irpjSurcharge;

  // CSLL: 9%
  const csll = baseCSLL * 0.09;

  // PIS: 0.65% (cumulative)
  const pis = revenueQuarterly * 0.0065;

  // COFINS: 3.00% (cumulative)
  const cofins = revenueQuarterly * 0.03;

  const totalTax = irpj + csll + pis + cofins;
  const effectiveRate = revenueQuarterly > 0 ? (totalTax / revenueQuarterly) * 100 : 0;

  return {
    presumptionRate,
    baseIRPJ,
    irpj,
    csll,
    pis,
    cofins,
    totalTax,
    effectiveRate,
  };
}

export interface IRPFResult {
  netBase: number;
  brutoIR: number;
  specialReducer: number;
  effectiveIR: number;
  effectiveRate: number;
}

export function calculateIRPF2026(
  grossIncome: number,
  inss: number,
  dependentsCount: number,
  alimony: number
): IRPFResult {
  const netBase = Math.max(0, grossIncome - inss - dependentsCount * 189.59 - alimony);

  // IRPF 2026 standard monthly brackets
  let rate = 0;
  let deduction = 0;

  if (netBase <= 2259.2) {
    rate = 0;
    deduction = 0;
  } else if (netBase <= 2828.65) {
    rate = 0.075;
    deduction = 169.44;
  } else if (netBase <= 3751.05) {
    rate = 0.15;
    deduction = 381.44;
  } else if (netBase <= 4664.68) {
    rate = 0.225;
    deduction = 662.77;
  } else {
    rate = 0.275;
    deduction = 896.0;
  }

  const brutoIR = netBase * rate - deduction;

  // Special Reducer (Lei nº 15.270/2025)
  // Dynamic RedMax calculated at gross point R$ 5,000.00
  const netBaseMax = Math.max(0, 5000.0 - Math.min(5000.0 * 0.11, 900.0)); // estimate max INSS
  let rateMax = 0.225;
  let dedMax = 662.77;
  if (netBaseMax <= 2259.2) { rateMax = 0; dedMax = 0; }
  else if (netBaseMax <= 2828.65) { rateMax = 0.075; dedMax = 169.44; }
  else if (netBaseMax <= 3751.05) { rateMax = 0.15; dedMax = 381.44; }
  const redMax = netBaseMax * rateMax - dedMax;

  let specialReducer = 0;
  if (grossIncome <= 5000.0) {
    specialReducer = brutoIR; // 100% exemption
  } else if (grossIncome <= 7350.0) {
    specialReducer = redMax * (1 - (grossIncome - 5000.0) / 2350.0);
  } else {
    specialReducer = 0;
  }

  const effectiveIR = Math.max(0, brutoIR - specialReducer);
  const effectiveRate = grossIncome > 0 ? (effectiveIR / grossIncome) * 100 : 0;

  return {
    netBase,
    brutoIR,
    specialReducer,
    effectiveIR,
    effectiveRate,
  };
}

export interface JudicialCorrectionResult {
  daysPreJudicial: number;
  daysJudicial: number;
  correctedPrincipal: number;
  interestAccumulated: number;
  totalDue: number;
}

export function calculateJudicialCorrection(
  originalValue: number,
  dueDate: Date,
  lawsuitDate: Date,
  paymentDate: Date,
  isLaborDebt: boolean
): JudicialCorrectionResult {
  const timePre = lawsuitDate.getTime() - dueDate.getTime();
  const timeJud = paymentDate.getTime() - lawsuitDate.getTime();

  const daysPreJudicial = Math.max(0, Math.floor(timePre / (1000 * 60 * 60 * 24)));
  const daysJudicial = Math.max(0, Math.floor(timeJud / (1000 * 60 * 60 * 24)));

  // Phase 1 (Pre-judicial): IPCA-E / IPCA + TRD simples (usually ~4.5% annual IPCA + 0% TRD)
  const annualPreRate = 0.045; // 4.5% IPCA
  const factorPre = 1 + (annualPreRate * daysPreJudicial) / 365;
  const correctedPrincipal = originalValue * factorPre;

  // Phase 2 (Judicial): SELIC conglobante or IPCA + Taxa Legal CMN (SELIC - IPCA)
  // Let's assume average SELIC of 10.5% and IPCA of 4.5%, so Taxa Legal is 6.0% annual
  const annualJudRate = isLaborDebt ? 0.105 : 0.06; // 10.5% SELIC vs 6% Taxa Legal
  const factorJudInterest = (annualJudRate * daysJudicial) / 365;

  const interestAccumulated = correctedPrincipal * factorJudInterest;
  const totalDue = correctedPrincipal + interestAccumulated;

  return {
    daysPreJudicial,
    daysJudicial,
    correctedPrincipal,
    interestAccumulated,
    totalDue,
  };
}

export interface PrevidenciaResult {
  simplificadoDeduction: number;
  completoDeduction: number;
  recommendation: 'VGBL' | 'PGBL';
  pgblLimitContribution: number;
  description: string;
}

export function calibratePrevidencia(
  grossAnnualIncome: number,
  inss: number,
  dependentsCount: number,
  educationExp: number,
  healthExp: number,
  actualPgblContributions: number
): PrevidenciaResult {
  const simplificadoDeduction = Math.min(grossAnnualIncome * 0.20, 17640.0);

  const pgblLimitContribution = grossAnnualIncome * 0.12;
  const pgblDeduction = Math.min(actualPgblContributions, pgblLimitContribution);

  const completoDeduction =
    inss +
    dependentsCount * 2275.08 +
    Math.min(educationExp, 3561.5) +
    healthExp +
    pgblDeduction;

  const recommendation = completoDeduction <= simplificadoDeduction ? 'VGBL' : 'PGBL';

  const description = recommendation === 'PGBL'
    ? `✅ PGBL Recomendado: Suas deduções legais completas (${formatCurrencySmart(completoDeduction)}) superam o desconto simplificado. Aporte até ${formatCurrencySmart(pgblLimitContribution)} (12% do bruto) para abatimento máximo.`
    : `✅ VGBL Recomendado: Suas deduções completas não compensam a declaração simplificada. Opte pelo VGBL para usufruir da incidência tributária menor sobre os rendimentos futuros.`;

  return {
    simplificadoDeduction,
    completoDeduction,
    recommendation,
    pgblLimitContribution,
    description,
  };
}

import { formatCurrencySmart } from '../core/formatCurrency';
