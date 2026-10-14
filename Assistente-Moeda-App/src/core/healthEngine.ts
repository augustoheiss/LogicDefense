/**
 * Financial Health Engine ("Saúde Financeira") — Assistente Moeda
 *
 * Evaluates financial health (0 to 100) across 4 core pillars
 * calibrated for families and individuals. Pure, zero-dependency.
 */

import type { TableMetrics } from './types';

export type HealthLevel = 'crítico' | 'atenção' | 'estável' | 'ótimo' | 'excelente';

export interface HealthPillar {
  id: 'cashflow' | 'reserve' | 'discipline' | 'efficiency';
  name: string;
  score: number; // 0 to 100
  weight: number; // Percentage contribution (sum = 100)
  status: 'bom' | 'alerta' | 'perigo';
  diagnostic: string;
  recommendation: string;
}

export interface FinancialHealthReport {
  score: number; // 0 to 100 (integer)
  level: HealthLevel;
  headline: string;
  nextBestAction: {
    title: string;
    description: string;
    priority: 'alta' | 'média' | 'baixa';
    actionType?: 'add_row' | 'adjust_goals' | 'build_reserve' | 'cut_expense';
  };
  pillars: HealthPillar[];
  evaluatedAt: string;
}

export interface HealthEngineOptions {
  emergencyFundMonthsTarget?: number; // Default: 3 to 6 months
  benchmarkMonthlyRate?: number; // Ex: 0.008 (0.8% a.m., CDI)
  inflationMonthlyRate?: number; // Ex: 0.0035 (0.35% a.m., IPCA)
}

export function computeHealthScore(
  metrics: Partial<TableMetrics>,
  options: HealthEngineOptions = {}
): FinancialHealthReport {
  const targetReserveMonths = options.emergencyFundMonthsTarget ?? 3;
  const benchmarkRate = options.benchmarkMonthlyRate ?? 0.008;

  const grossRevenue = metrics.grossTotal || 0;
  const totalExpenses = metrics.totalExpenses || 0;
  const totalDeposits =
    metrics.totalDeposits ??
    metrics.investmentBalance ??
    metrics.totalInvested ??
    metrics.globalTotalDeposited ??
    0;
  const netBalance = grossRevenue - totalExpenses;
  const daysWorked =
    metrics.daysWorked ??
    (metrics.byMonth
      ? Object.values(metrics.byMonth).reduce(
          (acc, m) => acc + Object.keys(m.dailyPayments || {}).length,
          0
        )
      : 0);
  const dailyAverage = metrics.dailyAverage ?? metrics.globalDailyAvg ?? 0;

  // ── PILAR 1: Fluxo de Caixa & Sobrevivência (Peso 30%) ───
  let cashflowScore = 50;
  let cashflowStatus: HealthPillar['status'] = 'alerta';
  let cashflowDiag = 'Fluxo equilibrado sem sobras expressivas.';
  let cashflowRec = 'Procure manter as despesas abaixo de 80% das receitas.';

  if (grossRevenue === 0 && totalExpenses === 0) {
    cashflowScore = 50;
    cashflowDiag = 'Ainda sem transações suficientes neste período.';
    cashflowRec = 'Lance suas receitas e contas do mês para calibrar o diagnóstico.';
  } else if (grossRevenue > 0 && totalExpenses === 0) {
    cashflowScore = 95;
    cashflowStatus = 'bom';
    cashflowDiag = 'Receitas registradas sem despesas computadas.';
    cashflowRec = 'Mantenha os custos operacionais sob controle.';
  } else if (netBalance < 0) {
    // Déficit
    const deficitRatio = Math.min(1, Math.abs(netBalance) / (totalExpenses || 1));
    cashflowScore = Math.max(10, Math.round(50 - deficitRatio * 40));
    cashflowStatus = 'perigo';
    cashflowDiag = `Você gastou R$ ${Math.abs(netBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a mais do que arrecadou.`;
    cashflowRec = 'Revise gastos supérfluos para estancar o saldo negativo antes do fechamento.';
  } else {
    // Superávit
    const savingsRate = netBalance / (grossRevenue || 1);
    if (savingsRate >= 0.2) {
      cashflowScore = 95;
      cashflowStatus = 'bom';
      cashflowDiag = `Excelente taxa de poupança de ${Math.round(savingsRate * 100)}% das receitas.`;
      cashflowRec = 'Direcione o excedente para sua reserva de emergência ou investimentos.';
    } else if (savingsRate >= 0.05) {
      cashflowScore = 75;
      cashflowStatus = 'bom';
      cashflowDiag = `Saldo positivo com margem de ${Math.round(savingsRate * 100)}%.`;
      cashflowRec = 'Tente elevar sua poupança mensal para pelo menos 15%.';
    } else {
      cashflowScore = 55;
      cashflowStatus = 'alerta';
      cashflowDiag = 'Receitas quase empatando com as despesas.';
      cashflowRec = 'Pequenos imprevistos podem gerar endividamento. Corte despesas variáveis.';
    }
  }

  // ── PILAR 2: Reserva de Emergência (Peso 25%) ──────────
  // Considera depósitos/investimentos em relação ao custo mensal estimado
  const monthlyCostEstimate =
    metrics.survivalMonthly && metrics.survivalMonthly > 0
      ? metrics.survivalMonthly
      : totalExpenses > 0
      ? totalExpenses
      : 2000;
  const reserveMonthsAvailable = totalDeposits / monthlyCostEstimate;

  let reserveScore = 30;
  let reserveStatus: HealthPillar['status'] = 'perigo';
  let reserveDiag = 'Você ainda não possui reserva financeira suficiente.';
  let reserveRec = 'Comece guardando qualquer quantia mensal até cobrir pelo menos 1 mês de contas.';

  if (reserveMonthsAvailable >= targetReserveMonths) {
    reserveScore = 100;
    reserveStatus = 'bom';
    reserveDiag = `Reserva sólida cobrindo ${reserveMonthsAvailable.toFixed(1)} meses de custos de vida.`;
    reserveRec = 'Reserva completa. Agora você pode focar em investimentos de médio e longo prazo.';
  } else if (reserveMonthsAvailable >= 1) {
    reserveScore = Math.min(90, Math.round(50 + (reserveMonthsAvailable / targetReserveMonths) * 45));
    reserveStatus = reserveMonthsAvailable >= 2 ? 'bom' : 'alerta';
    reserveDiag = `Sua reserva cobre ${reserveMonthsAvailable.toFixed(1)} meses das despesas essenciais.`;
    reserveRec = `Aporte regularmente até atingir a meta recomendada de ${targetReserveMonths} meses.`;
  } else if (totalDeposits > 0) {
    reserveScore = 45;
    reserveStatus = 'alerta';
    reserveDiag = 'Reserva em formação inicial (cobre menos de 1 mês).';
    reserveRec = 'Priorize construir o primeiro mês integral de segurança financeira.';
  }

  // ── PILAR 3: Disciplina & Consistência (Peso 25%) ───────
  let disciplineScore = 60;
  let disciplineStatus: HealthPillar['status'] = 'alerta';
  let disciplineDiag = 'Registros periódicos iniciados.';
  let disciplineRec = 'Mantenha lançamentos diários ou semanais para evitar esquecimentos.';

  if (daysWorked >= 15) {
    disciplineScore = 95;
    disciplineStatus = 'bom';
    disciplineDiag = `Alta frequência de acompanhamento (${daysWorked} dias com registros).`;
    disciplineRec = 'Parabéns pela regularidade! A clareza dos números é a base do patrimônio.';
  } else if (daysWorked >= 7) {
    disciplineScore = 80;
    disciplineStatus = 'bom';
    disciplineDiag = `Boa consistência (${daysWorked} dias acompanhados).`;
    disciplineRec = 'Continue registrando todos os gastos pequenos para não deixar furos no orçamento.';
  } else if (daysWorked >= 2) {
    disciplineScore = 60;
    disciplineStatus = 'alerta';
    disciplineDiag = 'Poucos dias de registro no período selecionado.';
    disciplineRec = 'Acompanhe suas contas pelo menos 2 vezes na semana.';
  } else {
    disciplineScore = 40;
    disciplineStatus = 'alerta';
    disciplineDiag = 'Pouquíssimos lançamentos para diagnóstico preciso.';
    disciplineRec = 'Alimente a planilha para ter previsões matemáticas confiáveis.';
  }

  // ── PILAR 4: Eficiência & Metas (Peso 20%) ──────────────
  const globalGoal = metrics.globalDailyGoal || 0;
  let efficiencyScore = 50;
  let efficiencyStatus: HealthPillar['status'] = 'alerta';
  let efficiencyDiag = 'Metas operacionais sem configuração definida.';
  let efficiencyRec = 'Defina metas diárias ou semanais em Ajustes para ter bússola financeira.';

  if (globalGoal > 0) {
    const goalRatio = dailyAverage / globalGoal;
    if (goalRatio >= 1.0) {
      efficiencyScore = 95;
      efficiencyStatus = 'bom';
      efficiencyDiag = `Você está atingindo ${Math.round(goalRatio * 100)}% da sua meta média diária.`;
      efficiencyRec = 'Meta superada com folga. Considere reajustar para um objetivo maior.';
    } else if (goalRatio >= 0.8) {
      efficiencyScore = 75;
      efficiencyStatus = 'bom';
      efficiencyDiag = `Próximo da meta (${Math.round(goalRatio * 100)}% alcançado).`;
      efficiencyRec = 'Falta pouco para bater 100%. Mantenha o foco até o fim do ciclo.';
    } else {
      efficiencyScore = Math.max(30, Math.round(goalRatio * 70));
      efficiencyStatus = 'alerta';
      efficiencyDiag = `Ritmo atual em ${Math.round(goalRatio * 100)}% da meta planejada.`;
      efficiencyRec = 'Avalie se a meta está realista para o momento atual ou se requer novos esforços.';
    }
  } else {
    // Sem meta configurada: avalia se há sobra positiva
    efficiencyScore = netBalance > 0 ? 70 : 45;
    efficiencyStatus = netBalance > 0 ? 'bom' : 'alerta';
  }

  // ── Consolidação Ponderada ─────────────────────────────
  const weightedScore = Math.round(
    cashflowScore * 0.30 +
    reserveScore * 0.25 +
    disciplineScore * 0.25 +
    efficiencyScore * 0.20
  );

  const finalScore = Math.max(0, Math.min(100, weightedScore));

  let level: HealthLevel = 'estável';
  let headline = 'Finanças em equilíbrio com pontos de atenção.';

  if (finalScore >= 85) {
    level = 'excelente';
    headline = 'Saúde financeira exemplar! Suas contas e reservas estão blindadas.';
  } else if (finalScore >= 70) {
    level = 'ótimo';
    headline = 'Boa estabilidade financeira. O básico está bem executado.';
  } else if (finalScore >= 55) {
    level = 'estável';
    headline = 'Contas sob controle, mas com pouca folga para imprevistos.';
  } else if (finalScore >= 40) {
    level = 'atenção';
    headline = 'Sinal amarelo: despesas altas ou reserva insuficiente demandam atenção.';
  } else {
    level = 'crítico';
    headline = 'Alerta vermelho: orçamento deficitário ou risco iminente de endividamento.';
  }

  // ── Próximo Melhor Passo (Next Best Action) ─────────────
  let nextBestAction: FinancialHealthReport['nextBestAction'] = {
    title: 'Registrar gastos do dia',
    description: 'Lance suas últimas despesas para manter o painel atualizado.',
    priority: 'média',
    actionType: 'add_row',
  };

  if (cashflowScore < 50) {
    nextBestAction = {
      title: 'Estancar déficit financeiro',
      description: 'Você está no vermelho este mês. Revise os maiores gastos não essenciais.',
      priority: 'alta',
      actionType: 'cut_expense',
    };
  } else if (reserveScore < 50) {
    nextBestAction = {
      title: 'Iniciar reserva de emergência',
      description: 'Separe um primeiro aporte de segurança para evitar surpresas.',
      priority: 'alta',
      actionType: 'build_reserve',
    };
  } else if (globalGoal === 0) {
    nextBestAction = {
      title: 'Definir sua meta financeira',
      description: 'Configure metas diárias ou semanais para orientar suas decisões.',
      priority: 'média',
      actionType: 'adjust_goals',
    };
  }

  const pillars: HealthPillar[] = [
    {
      id: 'cashflow',
      name: 'Fluxo de Caixa',
      score: cashflowScore,
      weight: 30,
      status: cashflowStatus,
      diagnostic: cashflowDiag,
      recommendation: cashflowRec,
    },
    {
      id: 'reserve',
      name: 'Reserva de Emergência',
      score: reserveScore,
      weight: 25,
      status: reserveStatus,
      diagnostic: reserveDiag,
      recommendation: reserveRec,
    },
    {
      id: 'discipline',
      name: 'Consistência',
      score: disciplineScore,
      weight: 25,
      status: disciplineStatus,
      diagnostic: disciplineDiag,
      recommendation: disciplineRec,
    },
    {
      id: 'efficiency',
      name: 'Metas & Eficiência',
      score: efficiencyScore,
      weight: 20,
      status: efficiencyStatus,
      diagnostic: efficiencyDiag,
      recommendation: efficiencyRec,
    },
  ];

  return {
    score: finalScore,
    level,
    headline,
    nextBestAction,
    pillars,
    evaluatedAt: new Date().toISOString(),
  };
}
