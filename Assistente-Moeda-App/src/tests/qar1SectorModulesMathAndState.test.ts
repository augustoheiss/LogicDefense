/**
 * QAR1 Sector Modules & AutoCAD Calculators Test Suite (QAR1-SEC-MOD-01 to QAR1-SEC-MOD-08)
 *
 * Audits the 8 Sectorial Modules (📊 CAIXA, 📈 RECEITA, 📉 CUSTOS, 👤 PFM, 🏢 PME, 🏠 IMOB, 🚗 FROTA, ⚖️ FISCAL)
 * and their 15+ mathematical sub-calculators connected to the AutoCAD Cockpit:
 *   - QAR1-SEC-MOD-01 (📊 CAIXA): 13-Week Cashflow & Liquidity Shock Valley
 *   - QAR1-SEC-MOD-02 (📈 RECEITA): Advanced Revenue Statistics (Median, Mode, StdDev) & What-If Projections
 *   - QAR1-SEC-MOD-03 (📉 CUSTOS): Survival / Break-Even Targets (Daily, Weekly, Monthly, Annual) & Partner Firewall
 *   - QAR1-SEC-MOD-04 (👤 PFM): Monte Carlo FIRE (2,500 sims), 50/30/20 Budget Calibrator & Transaction Hash
 *   - QAR1-SEC-MOD-05 (🏢 PME): Welford Online Variance, Working Capital (NCG), Cash-Flow at Risk (CFaR 95/99) & CLT vs Presumido/Real Payroll
 *   - QAR1-SEC-MOD-06 (🏠 IMOB): SAC vs Price Amortization, Extraordinary Amortization (Term vs Payment), Fisher Real Yield (IPCA/IGPM) & Ross-Heidecke Depreciation
 *   - QAR1-SEC-MOD-07 (🚗 FROTA): Dynamic CPK Telemetry, Ownership vs Rideshare 5Y NPV, TVDE Net Hourly & Weibull Predictive Maintenance
 *   - QAR1-SEC-MOD-08 (⚖️ FISCAL): Fator R (28% Threshold Anexo III vs V), Lucro Presumido (PLP 182/2025), IRPF 2026 (Lei 15.270/2025 R$ 5k Exemption), Judicial Correction (Lei 14.905/2024) & PGBL vs VGBL
 */

import { computeMetrics } from '../core/metricsEngine';
import {
  runMonteCarloFIRE,
  predict13WeekCashFlow,
  generateTransactionHash,
  calculateOnboardingProgress,
} from '../utils/pfmRetentionMath';
import {
  welfordSinglePass,
  welfordSlidingWindow,
  calculateNCG,
  calculateCFaR,
  calculatePayrollTax,
} from '../utils/smbMath';
import {
  generatePriceSchedule,
  generateSACSchedule,
  recalculateExtraordinaryAmortization,
  calculateRealYield,
  calculateRossHeidecke,
} from '../utils/realEstateMath';
import {
  calculateDynamicCPK,
  calculateResidualValue,
  compareOwnershipVsRideshare,
  optimizeWeibullMaintenance,
} from '../utils/vehicleMath';
import {
  calculateHiddenDrain,
  calculateFreelancerTaxLoss,
  calculateTVDENetHourly,
} from '../utils/vehicleCopywritingMath';
import {
  calculateFatorR,
  calculateLucroPresumido,
  calculateIRPF2026,
  calculateJudicialCorrection,
  calibratePrevidencia,
} from '../utils/taxMath';
import type { TableRow, TableGoals } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

describe('QAR1 8-Module AutoCAD Sectorial Math & Boundary Suite (QAR1-SEC-MOD-01 to 08)', () => {
  const sampleGoals: TableGoals = {
    dailyGoals: { 2026: 250 },
    weeklyGoals: { 2026: 1750 },
    annualCosts: { 2026: 36000 },
  };

  it('QAR1-SEC-MOD-01 (📊 CAIXA): predict13WeekCashFlow deve projetar liquidez de 13 semanas e detectar vale de choque na semana exata', () => {
    const weeks = predict13WeekCashFlow(10000, 2500, 2000, [
      { weekIndex: 4, amount: 8000, isIncome: false },
      { weekIndex: 8, amount: 3000, isIncome: true },
    ]);

    expect(weeks).toHaveLength(13);
    // Semanas 1..3 ganham +500/semana -> Semana 3 = 11500
    expect(weeks[0].projectedBalance).toBe(10500);
    expect(weeks[2].projectedBalance).toBe(11500);
    // Semana 4: 11500 + 500 - 8000 = 4000
    expect(weeks[3].weekIndex).toBe(4);
    expect(weeks[3].projectedBalance).toBe(4000);
    expect(weeks[3].expenses).toBe(10000);
    expect(weeks[3].isNegative).toBe(false);

    // Choque severo gerando ruptura de caixa (isNegative = true)
    const ruptureWeeks = predict13WeekCashFlow(1000, 500, 600, [
      { weekIndex: 2, amount: 2500, isIncome: false },
    ]);
    expect(ruptureWeeks[1].isNegative).toBe(true);
    expect(ruptureWeeks[1].projectedBalance).toBeLessThan(0);
  });

  it('QAR1-SEC-MOD-02 (📈 RECEITA): computeMetrics deve calcular Mediana, Moda, Desvio Padrão e isolar parcerias/aportes', () => {
    const rows: TableRow[] = [
      { id: 'r1', date: '2026-03-01', value: 1000, description: 'Projeto Alpha', entryType: 'revenue' },
      { id: 'r2', date: '2026-03-05', value: 2000, description: 'Projeto Beta', entryType: 'revenue' },
      { id: 'r3', date: '2026-03-10', value: 2000, description: 'Projeto Gamma', entryType: 'revenue' },
      { id: 'r4', date: '2026-03-15', value: 5000, description: 'Projeto Delta', entryType: 'revenue' },
      { id: 'p1', date: '2026-03-18', value: 99000, description: 'Repasse Sócio', entryType: 'partner_in' },
      { id: 'd1', date: '2026-03-20', value: 15000, description: 'Aporte CDB', entryType: 'deposit' },
    ];

    const m = computeMetrics(rows, sampleGoals, '2026-03-31');
    expect(m.grossTotal).toBe(10000);
    expect(m.maxTransaction).toBe(5000);
    expect(m.minTransaction).toBe(1000);
    expect(m.medianTransaction).toBe(2000);
    expect(m.modeTransaction).toBe(2000);
    expect(m.stdDeviation).toBeGreaterThan(1400);
    expect(m.totalPartnerIn).toBe(99000);
    expect(m.totalDeposits).toBe(15000);
  });

  it('QAR1-SEC-MOD-03 (📉 CUSTOS): metas de sobrevivência devem obedecer invariantes de escala temporal e normalizar despesas negativas', () => {
    const rows: TableRow[] = [
      { id: 'e1', date: '2026-01-01', value: -3100, description: 'Aluguel + Operação', entryType: 'expense' },
      { id: 'e2', date: '2026-01-31', value: 3100, description: 'Fornecedores', entryType: 'expense' },
      { id: 'po', date: '2026-01-15', value: 5000, description: 'Saída Sócio', entryType: 'partner_out' },
    ];

    const m = computeMetrics(rows, sampleGoals, '2026-01-31');
    // 6200 em 31 dias corridos -> survivalDaily = 200.00
    expect(m.totalExpenses).toBe(6200);
    expect(m.totalPartnerOut).toBe(5000);
    expect(m.survivalDaily).toBe(200);
    expect(m.survivalWeekly).toBe(1400);
    expect(m.survivalMonthly).toBe(6088);
    expect(m.survivalAnnualCost).toBe(73050);
  });

  it('QAR1-SEC-MOD-04 (👤 PFM): runMonteCarloFIRE deve manter finitude matemática, ordem de percentis (p10 <= p50 <= p90) e hash determinístico', () => {
    const mcSafe = runMonteCarloFIRE(1_200_000, 36_000, 0.065, 0.10, 30, 1000);
    expect(mcSafe.successRate).toBeGreaterThan(80);
    expect(mcSafe.p10EndingWealth).toBeLessThanOrEqual(mcSafe.medianEndingWealth);
    expect(mcSafe.medianEndingWealth).toBeLessThanOrEqual(mcSafe.p90EndingWealth);

    // Caso de fronteira: patrimônio zero com retirada positiva -> 0% de sucesso, sem NaN
    const mcZero = runMonteCarloFIRE(0, 50_000, 0.05, 0.12, 20, 200);
    expect(mcZero.successRate).toBe(0);
    expect(mcZero.medianEndingWealth).toBe(0);

    // Hash determinístico para deduplicação de lançamentos
    const h1 = generateTransactionHash('2026-07-15', -15000, 'Aluguel Escritório #01');
    const h2 = generateTransactionHash('2026-07-15', -15000, '  aluguel   escritório  #01 ');
    expect(h1).toBe(h2);

    const ob = calculateOnboardingProgress(['csv_import', 'fator_r_check']);
    expect(ob.completedStepsCount).toBe(4); // 2 endowed + 2 informados
  });

  it('QAR1-SEC-MOD-05 (🏢 PME): Welford, Capital de Giro (NCG), CFaR (95%/99%) e Encargos CLT (Simples vs Presumido vs Real)', () => {
    const welford = welfordSinglePass([100, 200, 300, 400, 500]);
    expect(welford.mean).toBe(300);
    expect(welford.variance).toBe(25000);
    expect(welford.stdDev).toBeCloseTo(158.1138, 2);

    const rolling = welfordSlidingWindow([10, 20, 30, 40, 50], 3);
    expect(rolling).toHaveLength(3);
    expect(rolling[0]).toBeCloseTo(10, 2);

    const ncg = calculateNCG(1000, 15, 0.95, 200, 2);
    expect(ncg.yellowZone).toBe(15000);
    expect(ncg.safetyStock).toBeGreaterThan(0);
    expect(ncg.ncg).toBeCloseTo(ncg.yellowZone + ncg.safetyStock, 2);

    const cfar = calculateCFaR([
      { probability: 0.25, cashFlow: 20000 },
      { probability: 0.50, cashFlow: 50000 },
      { probability: 0.25, cashFlow: 80000 },
    ]);
    expect(cfar.expectedCashFlow).toBe(50000);
    expect(cfar.cfar95).toBeLessThan(cfar.expectedCashFlow);
    expect(cfar.cfar99).toBeLessThan(cfar.cfar95);

    const payroll = calculatePayrollTax(10000, 0.02, 1.0);
    expect(payroll.simplesNacional.totalCost).toBe(10800); // Salário + 8% FGTS
    expect(payroll.lucroPresumido.totalCost).toBe(13580); // +20% INSS + 5.8% Terceiros + 2% RAT + 8% FGTS
    expect(payroll.lucroReal.effectiveCost).toBeCloseTo(13580 * 0.66, 2); // 34% Tax Shield IRPJ/CSLL
  });

  it('QAR1-SEC-MOD-06 (🏠 IMOB): Financiamento SAC vs Price, Amortização Extraordinária, Yield Real (Fisher) e Depreciação Ross-Heidecke', () => {
    const price = generatePriceSchedule(300000, 12, 120);
    const sac = generateSACSchedule(300000, 12, 120);

    expect(price.schedule).toHaveLength(120);
    expect(sac.schedule).toHaveLength(120);
    // Juros totais no SAC são estritamente menores que na Tabela Price para mesma taxa/prazo
    expect(sac.totalInterest).toBeLessThan(price.totalInterest);
    expect(price.schedule[119].endingBalance).toBeCloseTo(0, 2);
    expect(sac.schedule[119].endingBalance).toBeCloseTo(0, 2);

    // Amortização extraordinária reduzindo prazo ('term') vs parcela ('payment')
    const extraTerm = recalculateExtraordinaryAmortization(
      'sac',
      250000,
      50000,
      12,
      100,
      sac.schedule[20].payment,
      'term'
    );
    expect(extraTerm.newMonthsRemaining).toBeLessThan(100);
    expect(extraTerm.interestSaved).toBeGreaterThan(10000);

    const extraPmt = recalculateExtraordinaryAmortization(
      'price',
      250000,
      50000,
      12,
      100,
      price.schedule[0].payment,
      'payment'
    );
    expect(extraPmt.newMonthsRemaining).toBe(100);
    expect(extraPmt.newPayment).toBeLessThan(price.schedule[0].payment);
    expect(extraPmt.interestSaved).toBeGreaterThan(10000);

    // Yield Real descontando IPCA
    const yieldRes = calculateRealYield(500000, 48000, 6000, 5, 6, 4.5, 10);
    expect(yieldRes.nominalCashFlows).toHaveLength(10);
    expect(yieldRes.nominalIRR).toBeGreaterThan(yieldRes.realIRR);

    // Ross-Heidecke
    const rh = calculateRossHeidecke(800000, 160000, 10, 50, 0.08);
    expect(rh.kd).toBeGreaterThan(0);
    expect(rh.depreciatedValue).toBeLessThan(800000);
    expect(rh.depreciatedValue).toBeGreaterThan(160000);
  });

  it('QAR1-SEC-MOD-07 (🚗 FROTA): CPK Dinâmico, Carro Próprio vs Uber/App (VPL 5 Anos), Lucro Líquido/Hora TVDE e Manutenção Weibull', () => {
    const cpk = calculateDynamicCPK(
      9.5, 5.80, 0.25, 0.05,
      4, 650, 45000, 2.5, 0.08,
      0.18, 3600, 20000, 0.05, 2, 1000, 1.0,
      95000, 0.12, 0.08, 0.01, 2
    );
    expect(cpk.totalCPK).toBeCloseTo(
      cpk.energyCost + cpk.tireCost + cpk.maintenanceCost + cpk.insuranceCost + cpk.depreciationCost,
      5
    );
    expect(cpk.totalCPK).toBeGreaterThan(0.8);

    const resVal = calculateResidualValue(100000, 3, 60000, 0, 0.12, 0.08, 0.01);
    expect(resVal).toBeLessThan(100000);
    expect(resVal).toBeGreaterThan(40000);

    const comp = compareOwnershipVsRideshare(95000, 15000, cpk.totalCPK, 34, 10, 55000, 2.80, 300, 80, 0.5);
    expect(comp.recommendation === 'ownership' || comp.recommendation === 'rideshare').toBe(true);
    expect(Number.isFinite(comp.valOwnership)).toBe(true);
    expect(Number.isFinite(comp.valRideshare)).toBe(true);

    const tvde = calculateTVDENetHourly(45, 1.10, 22, 0.35);
    expect(tvde.totalCostPerHour).toBeCloseTo(24.2, 2);
    expect(tvde.netHourlyIncome).toBeCloseTo(20.8, 2);
    expect(tvde.warningFlag).toBe(false);

    const drain = calculateHiddenDrain(1500, 600, 90000, 18000);
    expect(drain.totalTrueTCO).toBeGreaterThan(2100);
    expect(drain.hiddenDrain).toBeCloseTo(drain.totalTrueTCO - 1500, 2);

    const taxLoss = calculateFreelancerTaxLoss(10000, 0.25, 27.5, 11, true);
    expect(taxLoss.lostMiles).toBe(2500);
    expect(taxLoss.netTaxLoss).toBeGreaterThan(0);

    const weibull = optimizeWeibullMaintenance(2.5, 50000, 800, 4500);
    expect(weibull.optimalM).toBeGreaterThan(0);
    expect(weibull.expectedCostAtOptimal).toBeLessThanOrEqual(weibull.expectedCostAtMMBF);
  });

  it('QAR1-SEC-MOD-08 (⚖️ FISCAL): Fator R (28%), Lucro Presumido (PLP 182), IRPF 2026 (Lei 15.270/2025 Isenção R$ 5k), Correção Judicial (Lei 14.905/2024) e PGBL', () => {
    // 1. Fator R >= 28% -> Anexo III (6% na 1ª faixa)
    const fatorAnexo3 = calculateFatorR(50400, 180000); // 28% exato
    expect(fatorAnexo3.anexo).toBe('III');
    expect(fatorAnexo3.effectiveRate).toBeCloseTo(0.06, 4);
    expect(fatorAnexo3.proLaboreAdjustment).toBe(0);

    // Fator R < 28% -> Anexo V (15.5% na 1ª faixa)
    const fatorAnexo5 = calculateFatorR(30000, 180000);
    expect(fatorAnexo5.anexo).toBe('V');
    expect(fatorAnexo5.effectiveRate).toBeCloseTo(0.155, 4);
    expect(fatorAnexo5.proLaboreAdjustment).toBeCloseTo(20400, 2);

    // 2. Lucro Presumido com e sem PLP 182/2025
    const lpNormal = calculateLucroPresumido(400000, false);
    const lpPlp182 = calculateLucroPresumido(400000, true);
    expect(lpNormal.presumptionRate).toBe(0.32);
    expect(lpPlp182.presumptionRate).toBe(0.352);
    expect(lpPlp182.totalTax).toBeGreaterThan(lpNormal.totalTax);

    // 3. IRPF 2026 (Lei 15.270/2025): Isenção 100% até R$ 5.000,00 brutos
    const irpfIsento = calculateIRPF2026(5000, 550, 0, 0);
    expect(irpfIsento.effectiveIR).toBe(0);
    expect(irpfIsento.effectiveRate).toBe(0);

    // Redutor gradual entre R$ 5.000 e R$ 7.350
    const irpfTransicao = calculateIRPF2026(6000, 660, 0, 0);
    expect(irpfTransicao.specialReducer).toBeGreaterThan(0);
    expect(irpfTransicao.effectiveIR).toBeLessThan(irpfTransicao.brutoIR);

    // Acima de R$ 7.350 sem redutor especial
    const irpfPleno = calculateIRPF2026(12000, 908, 1, 0);
    expect(irpfPleno.specialReducer).toBe(0);
    expect(irpfPleno.effectiveIR).toBeCloseTo(irpfPleno.brutoIR, 2);

    // 4. Correção Judicial (Lei 14.905/2024)
    const corr = calculateJudicialCorrection(
      100000,
      new Date('2024-01-01T12:00:00Z'),
      new Date('2025-01-01T12:00:00Z'),
      new Date('2026-01-01T12:00:00Z'),
      false
    );
    expect(corr.daysPreJudicial).toBeGreaterThanOrEqual(365);
    expect(corr.correctedPrincipal).toBeGreaterThan(100000);
    expect(corr.totalDue).toBeGreaterThan(corr.correctedPrincipal);

    // 5. Calibrador PGBL vs VGBL (teto 12% da renda anual)
    const prev = calibratePrevidencia(200000, 10800, 2, 8000, 12000, 24000);
    expect(prev.pgblLimitContribution).toBe(24000);
    expect(prev.recommendation).toBe('PGBL');
  });
});
