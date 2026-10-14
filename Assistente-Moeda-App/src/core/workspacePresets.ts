/**
 * Workspace Presets & Modular App Builder Catalog — Assistente Moeda
 *
 * Defines the 5 Financial Health & Usage Journeys ("Monte Seu Aplicativo")
 * and the catalog of composable dashboard widgets & sector engines.
 */

import type {
  WorkspacePresetType,
  DashboardWidgetId,
  DashboardConfig,
  HealthLevel,
} from './types';

export interface WidgetCatalogItem {
  id: DashboardWidgetId;
  title: string;
  subtitle: string;
  icon: string;
  defaultSpan: 1 | 2;
}

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  {
    id: 'health_score',
    title: 'Anel de Saúde Financeira',
    subtitle: 'Score 0–100 e diagnóstico geral do seu momento financeiro',
    icon: '🩺',
    defaultSpan: 1,
  },
  {
    id: 'next_action',
    title: 'Próxima Melhor Ação',
    subtitle: 'Recomendação prática imediata baseada nos seus indicadores',
    icon: '🎯',
    defaultSpan: 1,
  },
  {
    id: 'month_summary',
    title: 'Resumo de Caixa (Entradas / Saídas / Saldo)',
    subtitle: 'Visão rápida de receitas, despesas e saldo líquido',
    icon: '💰',
    defaultSpan: 2,
  },
  {
    id: 'pillars',
    title: '4 Pilares da Saúde Financeira',
    subtitle: 'Fluxo de Caixa, Reserva, Metas e Estabilidade detalhados',
    icon: '🏛️',
    defaultSpan: 1,
  },
  {
    id: 'insights',
    title: 'Insights Inteligentes',
    subtitle: 'Alertas automáticos de tendências, anomalias e conquistas',
    icon: '💡',
    defaultSpan: 1,
  },
  {
    id: 'what_if',
    title: 'Simulador "E Se?" (Sandbox)',
    subtitle: 'Simule cortes de gastos ou aumento de renda no longo prazo',
    icon: '🧪',
    defaultSpan: 1,
  },
  {
    id: 'investor_summary',
    title: 'Carteira & Independência (FIRE)',
    subtitle: 'Resumo de investimentos, rebalanceamento e progresso FIRE',
    icon: '📈',
    defaultSpan: 1,
  },
  {
    id: 'sector_simulators',
    title: 'Simuladores Atuariais & Setoriais',
    subtitle: 'Acesso direto aos motores de PME, Imóveis, Veículos, Tributos e PFM',
    icon: '🧮',
    defaultSpan: 2,
  },
  {
    id: 'lessons',
    title: 'Pílulas de Educação Financeira',
    subtitle: 'Micro-aulas interativas adaptadas ao seu nível',
    icon: '🎓',
    defaultSpan: 1,
  },
  {
    id: 'quick_actions',
    title: 'Atalhos Rápidos',
    subtitle: 'Botões rápidos para Planilha, Gráficos, Metas e Registro',
    icon: '⚡',
    defaultSpan: 1,
  },
  {
    id: 'recent_activity',
    title: 'Últimos Lançamentos',
    subtitle: 'As 4 transações mais recentes da planilha ativa',
    icon: '🕒',
    defaultSpan: 2,
  },
];

export interface WorkspacePresetDefinition {
  id: WorkspacePresetType;
  name: string;
  badge: string;
  icon: string;
  description: string;
  targetAudience: string;
  activeSectors: string[];
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
}

export const WORKSPACE_PRESETS: Record<WorkspacePresetType, WorkspacePresetDefinition> = {
  survival: {
    id: 'survival',
    name: 'Sobrevivência & Controle',
    badge: 'Score < 50 • Foco em Fôlego',
    icon: '🛡️',
    description:
      'Ideal para organizar contas, estancar gastos variáveis, construir reserva de emergência e capturar despesas na rua em 3 segundos.',
    targetAudience: 'Sair do sufoco, cortar gastos e criar reserva',
    activeSectors: [
      'core_cashflow',
      'core_revenue',
      'core_costs',
      'core_goals',
      'personal_finance',
    ],
    widgetOrder: [
      'month_summary',
      'next_action',
      'health_score',
      'what_if',
      'recent_activity',
      'pillars',
      'insights',
      'lessons',
      'quick_actions',
      'investor_summary',
      'sector_simulators',
    ],
    hiddenWidgets: ['investor_summary', 'sector_simulators'],
  },
  freelancer: {
    id: 'freelancer',
    name: 'Autônomo & Renda Variável',
    badge: 'Score 50–74 • Metas & Banco de Tempo',
    icon: '⚡',
    description:
      'Foco em Meta Diária/Semanal, Banco de Tempo (semanas de folga conquistadas), Abonos e previsão de caixa para quem tem renda variável.',
    targetAudience: 'Autônomos, liberais, motoristas e criadores',
    activeSectors: [
      'core_cashflow',
      'core_revenue',
      'core_costs',
      'core_goals',
      'core_predictions',
      'personal_finance',
      'vehicles',
    ],
    widgetOrder: [
      'health_score',
      'next_action',
      'month_summary',
      'pillars',
      'insights',
      'recent_activity',
      'what_if',
      'quick_actions',
      'sector_simulators',
      'investor_summary',
      'lessons',
    ],
    hiddenWidgets: ['lessons'],
  },
  investor: {
    id: 'investor',
    name: 'Investidor & Patrimônio (FIRE)',
    badge: 'Score 75+ • Multiplicação & Aportes',
    icon: '📈',
    description:
      'Destaca Carteira de Investimentos, Rebalanceamento Inteligente, Simulação Monte Carlo FIRE, Imóveis (SAC/PRICE) e Eficiência Tributária.',
    targetAudience: 'Acumulação patrimonial, FIIs/Ações/Renda Fixa e FIRE',
    activeSectors: [
      'core_cashflow',
      'core_revenue',
      'core_costs',
      'core_goals',
      'core_predictions',
      'personal_finance',
      'real_estate',
      'legal_taxes',
    ],
    widgetOrder: [
      'investor_summary',
      'health_score',
      'month_summary',
      'sector_simulators',
      'pillars',
      'insights',
      'what_if',
      'next_action',
      'recent_activity',
      'quick_actions',
      'lessons',
    ],
    hiddenWidgets: ['lessons', 'quick_actions'],
  },
  smb: {
    id: 'smb',
    name: 'PME, Sócios & Negócios',
    badge: 'Gestão Empresarial Completa',
    icon: '🏢',
    description:
      'Ativa Contabilidade PME (Capital de Giro DRP, CFaR, Folha CLT vs Lucro Real, Plano de Contas SPED), Sócios, Frota e Auditoria.',
    targetAudience: 'Pequenas empresas, sócios, comércio e escritórios',
    activeSectors: [
      'core_cashflow',
      'core_revenue',
      'core_costs',
      'core_goals',
      'core_predictions',
      'smb_accounting',
      'legal_taxes',
      'vehicles',
      'real_estate',
      'personal_finance',
    ],
    widgetOrder: [
      'month_summary',
      'sector_simulators',
      'health_score',
      'insights',
      'pillars',
      'recent_activity',
      'next_action',
      'investor_summary',
      'what_if',
      'quick_actions',
      'lessons',
    ],
    hiddenWidgets: ['lessons'],
  },
  custom: {
    id: 'custom',
    name: 'Personalizado (Monte Seu App)',
    badge: '100% Sob Medida',
    icon: '🧩',
    description:
      'Você escolhe exatamente quais blocos aparecem na tela inicial, a ordem de prioridade e quais motores setoriais ficam ativos.',
    targetAudience: 'Configuração manual livre de blocos e setores',
    activeSectors: [
      'core_cashflow',
      'core_revenue',
      'core_costs',
      'core_goals',
      'core_predictions',
      'personal_finance',
    ],
    widgetOrder: [
      'health_score',
      'next_action',
      'month_summary',
      'pillars',
      'insights',
      'what_if',
      'investor_summary',
      'sector_simulators',
      'lessons',
      'quick_actions',
      'recent_activity',
    ],
    hiddenWidgets: ['investor_summary', 'sector_simulators'],
  },
};

export function getDefaultDashboardConfig(preset: WorkspacePresetType = 'freelancer'): DashboardConfig {
  const def = WORKSPACE_PRESETS[preset] || WORKSPACE_PRESETS.freelancer;
  return {
    preset: def.id,
    widgetOrder: [...def.widgetOrder],
    hiddenWidgets: [...def.hiddenWidgets],
    preferredViewMode: 'auto',
  };
}

export function resolveEffectiveDashboardConfig(config?: DashboardConfig): DashboardConfig {
  if (!config) {
    return getDefaultDashboardConfig('freelancer');
  }
  const allIds = WIDGET_CATALOG.map((w) => w.id);
  const existingOrder = Array.isArray(config.widgetOrder) ? config.widgetOrder : [];
  const missingIds = allIds.filter((id) => !existingOrder.includes(id));
  return {
    preset: config.preset || 'custom',
    widgetOrder: [...existingOrder, ...missingIds],
    hiddenWidgets: Array.isArray(config.hiddenWidgets) ? config.hiddenWidgets : [],
    preferredViewMode: config.preferredViewMode || 'auto',
  };
}

export function getRecommendedPresetForHealth(level: HealthLevel, score: number): WorkspacePresetDefinition {
  if (level === 'critical' || level === 'attention' || score < 50) {
    return WORKSPACE_PRESETS.survival;
  }
  if (level === 'thriving' || score >= 75) {
    return WORKSPACE_PRESETS.investor;
  }
  return WORKSPACE_PRESETS.freelancer;
}
