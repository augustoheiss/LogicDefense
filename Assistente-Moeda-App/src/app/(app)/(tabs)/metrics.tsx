/**
 * Metrics Tab — Assistente Moeda (AutoCAD Central Cockpit v2)
 *
 * Single centered AutoCAD interface with icon-only command buttons (no wall-of-text descriptions),
 * an interactive contextual Guide HUD that explains each activated button step-by-step,
 * and a focused central viewport that eliminates endless vertical page scrolling.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '@/hooks/useCoinDB';
import { useSectorRegistry } from '@/hooks/useSectorRegistry';
import { MetricCard, MetricGrid } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { formatCurrencySmart } from '@/core/formatCurrency';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { getDailyGoalForDate } from '@/core/dateUtils';
import { CategorySummary, AddRowModal, InvestorPortfolioWidget } from '@/components/ui';
import { SectorSettingsPanel } from '@/components/ui/SectorSettingsPanel';
import {
  PersonalFinanceSectorWidget,
  SMBSectorWidget,
  RealEstateSectorWidget,
  VehiclesSectorWidget,
  LegalTaxesSectorWidget,
} from '@/components/ui/SectorWidgets';
import type { TableRow } from '@/core/types';
import { PieChart } from 'react-native-gifted-charts';

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
}

function calculateStats(rows: TableRow[], fallbackDays: number) {
  if (rows.length === 0) {
    return { sum: 0, count: 0, mean: 0, median: 0, mode: 0, stdDev: 0, max: 0, min: 0, dailyAvg: 0, weeklyAvg: 0 };
  }
  const values = rows.map((r) => r.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const count = values.length;
  const mean = sum / count;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = sorted[0];
  for (const v of sorted) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      mode = v;
    }
  }

  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  const max = Math.max(...values);
  const min = Math.min(...values);

  let totalDailyRate = 0;
  for (const row of rows) {
    const hasPeriod = !!(row.periodStart && row.periodEnd);
    if (hasPeriod) {
      const txDays = daysBetween(row.periodStart!, row.periodEnd!);
      totalDailyRate += row.value / txDays;
    } else {
      totalDailyRate += row.value / fallbackDays;
    }
  }
  const dailyAvg = totalDailyRate;
  const weeklyAvg = totalDailyRate * 7;

  return { sum, count, mean, median, mode, stdDev, max, min, dailyAvg, weeklyAvg };
}

export type MetricsStationId =
  | 'bi_overview'
  | 'revenue_stats'
  | 'expenses_survival'
  | 'goals_sectors'
  | 'sector_pfm'
  | 'sector_smb'
  | 'sector_real_estate'
  | 'sector_vehicles'
  | 'sector_legal_taxes'
  | 'modules_config';

interface CadMetricNode {
  id: MetricsStationId;
  sectorId?: string;
  icon: string;
  title: string;
  guide: string;
  subLenses?: Array<{ id: string; icon: string; label: string; hint: string }>;
}

const CAD_METRIC_NODES: CadMetricNode[] = [
  {
    id: 'bi_overview',
    sectorId: 'core_cashflow',
    icon: '📊',
    title: 'Fluxo de Caixa & Raio-X BI',
    guide: 'Inspecione a divisão do seu caixa em fatias interativas (Pizza BI) ou gerencie categorias em lote.',
    subLenses: [
      { id: 'donut', icon: '🍩', label: 'Pizza BI', hint: 'Toque em qualquer fatia ou item da legenda para dar zoom no Raio-X da categoria.' },
      { id: 'categories', icon: '🗂️', label: 'Categorias', hint: 'Agrupamento automático por descrição com edição ou renomeação em lote.' },
    ],
  },
  {
    id: 'revenue_stats',
    sectorId: 'core_revenue',
    icon: '📈',
    title: 'Receitas, Médias & Estatísticas',
    guide: 'Analisa seu ritmo de faturamento (diário/semanal/mensal/anual) e a estabilidade dos ganhos (mediana, moda e desvio).',
    subLenses: [
      { id: 'averages', icon: '💰', label: 'Médias Gerais', hint: 'Total bruto e médias diária, semanal, mensal e anual da sua planilha.' },
      { id: 'stats', icon: '📐', label: 'Estatísticas', hint: 'Mediana (ganho típico), Moda (valor mais repetido) e Desvio Padrão (volatilidade).' },
      { id: 'scoped', icon: '📅', label: 'Mês / Ano & Sócio', hint: 'Recorte exclusivo do mês/ano filtrado acima e repasses de parceria.' },
    ],
  },
  {
    id: 'expenses_survival',
    sectorId: 'core_costs',
    icon: '📉',
    title: 'Custos & Teto de Sobrevivência',
    guide: 'Revela exatamente quanto você precisa gerar por dia, semana e mês para cobrir seus custos sem entrar no vermelho.',
    subLenses: [
      { id: 'survival', icon: '🛡️', label: 'Sobrevivência', hint: 'Seu custo mínimo diário, semanal e mensal calculado a partir das saídas reais.' },
      { id: 'month_exp', icon: '💸', label: 'Gastos do Mês', hint: 'Despesas rateadas especificamente no mês selecionado na barra superior.' },
    ],
  },
  {
    id: 'goals_sectors',
    icon: '🎯',
    title: 'Metas, Banco de Tempo & Portfólio',
    guide: 'Acompanhe quantas semanas de folga ou atraso você acumulou no Banco de Tempo e calibre sua carteira de investimentos.',
    subLenses: [
      { id: 'timebank', icon: '⏱️', label: 'Banco de Tempo', hint: 'Saldo acumulado em R$ e em semanas de crédito/débito frente à sua meta semanal.' },
      { id: 'portfolio', icon: '🏦', label: 'Investimentos', hint: 'Saldo investido, juros compostos acumulados e rebalanceador de carteira.' },
    ],
  },
  {
    id: 'sector_pfm',
    sectorId: 'personal_finance',
    icon: '👤',
    title: 'Módulo: Finanças Pessoais & FIRE',
    guide: 'Simule sua Independência Financeira (Monte Carlo FIRE), Regra 50/30/20 e projeção de 13 semanas usando os sub-botões abaixo.',
  },
  {
    id: 'sector_smb',
    sectorId: 'smb_accounting',
    icon: '🏢',
    title: 'Módulo: Contabilidade PME',
    guide: 'Calcule Capital de Giro (NCG), Fluxo de Caixa em Risco (CFaR) e Custo Real de Folha CLT nos botões do palco.',
  },
  {
    id: 'sector_real_estate',
    sectorId: 'real_estate',
    icon: '🏠',
    title: 'Módulo: Imobiliário & Financiamentos',
    guide: 'Compare tabelas SAC vs. Price com amortização extraordinária e calcule o Cap Rate / Yield Real de aluguéis.',
  },
  {
    id: 'sector_vehicles',
    sectorId: 'vehicles',
    icon: '🚗',
    title: 'Módulo: Frotas, TCO & Custo/Km',
    guide: 'Descubra o Custo Real por Quilômetro (CPK), compare Carro Próprio vs. Uber e meça seu lucro líquido por hora.',
  },
  {
    id: 'sector_legal_taxes',
    sectorId: 'legal_taxes',
    icon: '⚖️',
    title: 'Módulo: Jurídico & Tributário',
    guide: 'Otimize o Fator R (Anexo III 6% vs Anexo V 15,5%), simule o IRPF 2026 + PGBL e corrija débitos pela SELIC.',
  },
  {
    id: 'modules_config',
    icon: '⚙️',
    title: 'Seletor de Módulos da Planilha',
    guide: 'Ligue ou desligue qualquer um dos 8 módulos diretamente aqui para deixar apenas os botões que você usa no seu cockpit.',
  },
];

export default function MetricsScreen() {
  const db = useCoinDB();
  const { isSectorActive } = useSectorRegistry();
  const { metrics, activeTable, selectedMonth, setSelectedMonth, availableMonths, cutoffDate } = db;

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [activeStation, setActiveStation] = useState<MetricsStationId>('bi_overview');
  const [subLensByStation, setSubLensByStation] = useState<Record<string, string>>({
    bi_overview: 'donut',
    revenue_stats: 'averages',
    expenses_survival: 'survival',
    goals_sectors: 'timebank',
  });

  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useMemo(() => {
    setSelectedMacro(null);
    setSelectedCategory(null);
  }, [selectedMonth]);

  const visibleNodes = useMemo(() => {
    return CAD_METRIC_NODES.filter((node) => {
      if (!node.sectorId) return true;
      // Keep core nodes always accessible or active according to sector registry
      if (node.id === 'bi_overview' || node.id === 'revenue_stats' || node.id === 'expenses_survival') {
        return true;
      }
      return isSectorActive(node.sectorId);
    });
  }, [isSectorActive]);

  const currentNode = useMemo(() => {
    return CAD_METRIC_NODES.find((n) => n.id === activeStation) || CAD_METRIC_NODES[0];
  }, [activeStation]);

  const activeSubLensId = subLensByStation[currentNode.id] || currentNode.subLenses?.[0]?.id || '';
  const activeSubLens = currentNode.subLenses?.find((l) => l.id === activeSubLensId) || currentNode.subLenses?.[0];

  const handleEditRow = (row: TableRow) => {
    setEditingRow(row);
    setShowAddModal(true);
  };

  // Level 1: Macro categories (Receitas, Custos, Aportes, Parceria, Abonos)
  const macroSums = useMemo(() => {
    let receitas = 0;
    let custos = 0;
    let aportes = 0;
    let parceria = 0;
    let abonos = 0;

    for (const r of db.filteredRows || []) {
      const type = r.entryType || 'revenue';
      if (type === 'revenue') receitas += r.value;
      else if (type === 'expense') custos += r.value;
      else if (type === 'deposit') aportes += r.value;
      else if (type === 'partner_in' || type === 'partner_out') parceria += r.value;
      else if (type === 'waiver') abonos += r.value;
    }
    return { receitas, custos, aportes, parceria, abonos };
  }, [db.filteredRows]);

  const macroPieData = useMemo(() => {
    const data: any[] = [];
    const { receitas, custos, aportes, parceria, abonos } = macroSums;
    const total = receitas + custos + aportes + parceria + abonos;
    if (total === 0) return [];

    if (receitas > 0) {
      data.push({
        value: receitas,
        color: '#10b981',
        label: 'Receitas',
        text: `${Math.round((receitas / total) * 100)}%`,
        focused: selectedMacro === 'Receitas',
      });
    }
    if (custos > 0) {
      data.push({
        value: custos,
        color: '#ef4444',
        label: 'Custos',
        text: `${Math.round((custos / total) * 100)}%`,
        focused: selectedMacro === 'Custos',
      });
    }
    if (aportes > 0) {
      data.push({
        value: aportes,
        color: '#3b82f6',
        label: 'Aportes',
        text: `${Math.round((aportes / total) * 100)}%`,
        focused: selectedMacro === 'Aportes',
      });
    }
    if (parceria > 0) {
      data.push({
        value: parceria,
        color: '#8b5cf6',
        label: 'Parceria',
        text: `${Math.round((parceria / total) * 100)}%`,
        focused: selectedMacro === 'Parceria',
      });
    }
    if (abonos > 0) {
      data.push({
        value: abonos,
        color: '#f59e0b',
        label: 'Abonos',
        text: `${Math.round((abonos / total) * 100)}%`,
        focused: selectedMacro === 'Abonos',
      });
    }
    return data;
  }, [macroSums, selectedMacro]);

  const macroFilteredRows = useMemo(() => {
    if (!selectedMacro) return [];
    return (db.filteredRows || []).filter((r) => {
      const type = r.entryType || 'revenue';
      if (selectedMacro === 'Receitas') return type === 'revenue';
      if (selectedMacro === 'Custos') return type === 'expense';
      if (selectedMacro === 'Aportes') return type === 'deposit';
      if (selectedMacro === 'Parceria') return type === 'partner_in' || type === 'partner_out';
      if (selectedMacro === 'Abonos') return type === 'waiver';
      return false;
    });
  }, [db.filteredRows, selectedMacro]);

  const microGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const r of macroFilteredRows) {
      const desc = (r.description || 'SEM DESCRIÇÃO').toUpperCase().trim() || 'SEM DESCRIÇÃO';
      groups[desc] = (groups[desc] || 0) + r.value;
    }
    return groups;
  }, [macroFilteredRows]);

  const microPieData = useMemo(() => {
    const data: any[] = [];
    const entries = Object.entries(microGroups).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((acc, curr) => acc + curr[1], 0);
    if (total === 0) return [];

    const colorsPalette = ['#ef4444', '#f97316', '#facc15', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#84cc16'];
    entries.forEach(([label, value], idx) => {
      if (value > 0) {
        const color = colorsPalette[idx % colorsPalette.length];
        data.push({
          value,
          color,
          label,
          text: `${Math.round((value / total) * 100)}%`,
          focused: selectedCategory === label,
        });
      }
    });
    return data;
  }, [microGroups, selectedCategory]);

  const categoryRows = useMemo(() => {
    if (!selectedCategory) return [];
    return macroFilteredRows.filter(
      (r) => ((r.description || 'SEM DESCRIÇÃO').toUpperCase().trim() || 'SEM DESCRIÇÃO') === selectedCategory.toUpperCase().trim()
    );
  }, [macroFilteredRows, selectedCategory]);

  const fallbackDays = useMemo(() => {
    if (selectedMonth === 'all') {
      if (!activeTable || activeTable.rows.length === 0) return 1;
      const dates = activeTable.rows.map((r) => r.date).filter(Boolean).sort();
      const oldest = dates[0] || new Date().toISOString().slice(0, 10);
      const start = new Date(oldest);
      const end = new Date();
      const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diff);
    } else {
      const [y, m] = selectedMonth.split('-').map(Number);
      return new Date(y, m, 0).getDate();
    }
  }, [selectedMonth, activeTable]);

  const categoryStats = useMemo(() => {
    if (categoryRows.length === 0) return null;
    return calculateStats(categoryRows, fallbackDays);
  }, [categoryRows, fallbackDays]);

  const selectedMonthMetrics = selectedMonth !== 'all' ? metrics.byMonth[selectedMonth] || null : null;
  const selectedYearStr = selectedMonth !== 'all' ? selectedMonth.slice(0, 4) : '';
  const yearMetrics = selectedYearStr ? metrics.byYear[selectedYearStr] || null : null;

  const monthlyExpenseTotal = selectedMonthMetrics?.expense ?? 0;
  const monthDays = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return 0;
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  const expenseDailyAvg = monthDays > 0 ? monthlyExpenseTotal / monthDays : 0;
  const expenseWeeklyAvg = expenseDailyAvg * 7;

  if (!activeTable || activeTable.rows.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.header}>
          <Text style={styles.title}>📐 Cockpit AutoCAD de Métricas</Text>
          <Text style={styles.subtitle}>Seus indicadores financeiros sem rolagem</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📐</Text>
          <Text style={styles.emptyTitle}>Adicione dados primeiro</Text>
          <Text style={styles.emptyText}>
            Acione a aba Planilha ou Hoje para registrar entradas e liberar os botões interativos do palco.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const m = metrics;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* ── Compact Top Header + Month Filter ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>📐 Métricas CAD</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{activeTable.name}</Text>
        </View>
      </View>

      {availableMonths.length > 0 && (
        <MonthPicker
          months={availableMonths}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
        />
      )}

      {/* ── Central AutoCAD Cockpit Wrapper (Centered on Screen) ── */}
      <View style={styles.cockpitOuter}>
        {/* 1. DOCK DE BOTÕES SOMENTE-ÍCONE (Sem descrições longas que poluem a tela) */}
        <View style={styles.stationBarWrapper} testID="metrics-station-bar">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stationBarScroll}
          >
            {visibleNodes.map((node) => {
              const active = activeStation === node.id;
              return (
                <Pressable
                  key={node.id}
                  testID={`metrics-station-${node.id}`}
                  style={[styles.iconOnlyNode, active && styles.iconOnlyNodeActive]}
                  onPress={() => setActiveStation(node.id)}
                >
                  <Text style={styles.iconOnlyEmoji}>{node.icon}</Text>
                  {active && <View style={styles.iconActiveIndicator} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. VISOR GUIA INTERATIVO AUTOCAD ("Vai te guiando o que é aquele botão") */}
        <View style={styles.guideHud} testID="metrics-autocad-guide">
          <View style={styles.guideHeaderRow}>
            <View style={styles.guideBadgeBox}>
              <Text style={{ fontSize: 18 }}>{currentNode.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideNodeTitle}>{currentNode.title}</Text>
              <Text style={styles.guideNodeDesc}>
                🧭 {activeSubLens ? activeSubLens.hint : currentNode.guide}
              </Text>
            </View>

            {/* Sub-botões interativos da ferramenta ativa (Somente ícone + tag curta) */}
            {currentNode.subLenses && currentNode.subLenses.length > 0 && (
              <View style={styles.subLensDock}>
                {currentNode.subLenses.map((lens) => {
                  const isLensActive = activeSubLens?.id === lens.id;
                  return (
                    <Pressable
                      key={lens.id}
                      testID={`metrics-sublens-${currentNode.id}-${lens.id}`}
                      style={[styles.subLensBtn, isLensActive && styles.subLensBtnActive]}
                      onPress={() =>
                        setSubLensByStation((prev) => ({
                          ...prev,
                          [currentNode.id]: lens.id,
                        }))
                      }
                    >
                      <Text style={styles.subLensEmoji}>{lens.icon}</Text>
                      <Text style={[styles.subLensLabel, isLensActive && styles.subLensLabelActive]}>
                        {lens.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* 3. FAIXA DE TELEMETRIA RÁPIDA (4 KPIs vitais sempre visíveis no topo do palco) */}
        <View style={styles.quickKpiRow}>
          <View style={[styles.quickKpiChip, { borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
            <Text style={styles.quickKpiLabel}>Receita</Text>
            <Text style={[styles.quickKpiValue, { color: colors.success.main }]} numberOfLines={1}>
              {formatCurrencySmart(m.grossTotal)}
            </Text>
          </View>
          <View style={[styles.quickKpiChip, { borderColor: 'rgba(239, 68, 68, 0.35)' }]}>
            <Text style={styles.quickKpiLabel}>Despesas</Text>
            <Text style={[styles.quickKpiValue, { color: colors.danger.main }]} numberOfLines={1}>
              {formatCurrencySmart(m.totalExpenses)}
            </Text>
          </View>
          <View style={[styles.quickKpiChip, { borderColor: 'rgba(139, 92, 246, 0.35)' }]}>
            <Text style={styles.quickKpiLabel}>Líquido</Text>
            <Text
              style={[
                styles.quickKpiValue,
                { color: m.netBalance >= 0 ? '#c084fc' : colors.danger.main },
              ]}
              numberOfLines={1}
            >
              {formatCurrencySmart(m.netBalance)}
            </Text>
          </View>
          <View style={[styles.quickKpiChip, { borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
            <Text style={styles.quickKpiLabel}>Tempo</Text>
            <Text
              style={[
                styles.quickKpiValue,
                { color: m.timeBankBalance >= 0 ? colors.success.main : colors.warning.main },
              ]}
              numberOfLines={1}
            >
              {m.timeBankBalance > 0 ? '+' : ''}{m.timeBankBalance.toFixed(1)}s
            </Text>
          </View>
        </View>

        {/* 4. PALCO CENTRAL AUTOCAD (Exibe APENAS a peça acionada, sem empilhar o resto) */}
        <ScrollView
          style={styles.stageViewport}
          contentContainerStyle={styles.stageViewportContent}
          testID="metrics-autocad-stage"
        >
          {/* ══ NODE 1: 📊 FLUXO DE CAIXA & RAIO-X BI ══ */}
          {activeStation === 'bi_overview' && (
            <>
              {activeSubLens?.id === 'donut' ? (
                <Card style={styles.biCard}>
                  {selectedCategory ? (
                    <View style={styles.xrayContainer}>
                      <View style={styles.xrayHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.xrayTitle}>🔍 Raio-X: {selectedCategory}</Text>
                          <Text style={styles.xraySubtitle}>Detalhamento em {selectedMacro}</Text>
                        </View>
                        <Pressable style={styles.xrayBackBtn} onPress={() => setSelectedCategory(null)}>
                          <Text style={styles.xrayBackText}>← Voltar</Text>
                        </Pressable>
                      </View>

                      {categoryStats && (
                        <View style={styles.statsGrid}>
                          <View style={styles.statCell}>
                            <Text style={styles.statLabel}>Soma Total</Text>
                            <Text style={[styles.statValue, { color: selectedMacro === 'Receitas' ? colors.success.main : colors.danger.main }]}>
                              {formatCurrencySmart(categoryStats.sum)}
                            </Text>
                            <Text style={styles.statCellSub}>{categoryStats.count} reg.</Text>
                          </View>
                          <View style={styles.statCell}>
                            <Text style={styles.statLabel}>Média</Text>
                            <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.mean)}</Text>
                          </View>
                          <View style={styles.statCell}>
                            <Text style={styles.statLabel}>Mediana</Text>
                            <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.median)}</Text>
                          </View>
                          <View style={styles.statCell}>
                            <Text style={styles.statLabel}>Diária / Sem.</Text>
                            <Text style={styles.statValue}>
                              {formatCurrencySmart(categoryStats.dailyAvg)} / {formatCurrencySmart(categoryStats.weeklyAvg)}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.xrayList}>
                        {categoryRows.slice(0, 8).map((row) => (
                          <View key={row.id} style={styles.xrayRow}>
                            <View style={styles.xrayRowLeft}>
                              <Text style={styles.xrayRowDate}>{row.date.split('-').reverse().slice(0, 2).join('/')}</Text>
                              <Text style={styles.xrayRowDesc} numberOfLines={1}>{row.description || 'Sem descrição'}</Text>
                            </View>
                            <View style={styles.xrayRowRight}>
                              <Text style={[styles.xrayRowValue, { color: selectedMacro === 'Receitas' ? colors.success.main : colors.danger.main }]}>
                                {selectedMacro === 'Custos' ? '-' : ''}{formatCurrencySmart(row.value)}
                              </Text>
                              <View style={styles.xrayRowActions}>
                                <Pressable style={styles.xrayRowActionBtn} onPress={() => handleEditRow(row)}>
                                  <Text style={{ fontSize: 12 }}>✏️</Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : selectedMacro ? (
                    <View style={styles.chartContainer}>
                      <View style={styles.xrayHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chartTitle}>🔍 Categorias: {selectedMacro}</Text>
                          <Text style={styles.chartSubtitle}>Toque em uma fatia para abrir o Raio-X</Text>
                        </View>
                        <Pressable style={styles.xrayBackBtn} onPress={() => setSelectedMacro(null)}>
                          <Text style={styles.xrayBackText}>← Voltar</Text>
                        </Pressable>
                      </View>

                      {microPieData.length > 0 ? (
                        <View style={styles.chartRow}>
                          <View style={styles.pieWrapper}>
                            <PieChart
                              data={microPieData}
                              donut
                              showText
                              textColor="#111"
                              textSize={9}
                              radius={62}
                              innerRadius={38}
                              onPress={(item: any) => setSelectedCategory(item.label)}
                            />
                          </View>
                          <View style={styles.legendList}>
                            {microPieData.slice(0, 6).map((item, idx) => (
                              <Pressable
                                key={idx}
                                style={styles.legendItem}
                                onPress={() => setSelectedCategory(item.label)}
                              >
                                <View style={[styles.legendIndicator, { backgroundColor: item.color }]} />
                                <Text style={styles.legendLabel} numberOfLines={1}>
                                  {item.label} ({item.text})
                                </Text>
                                <Text style={styles.legendValue}>{formatCurrencySmart(item.value)}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.noDataText}>Nenhum dado nesta categoria.</Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.chartContainer}>
                      <Text style={styles.chartTitle}>🍩 Distribuição Macro do Caixa</Text>
                      <Text style={styles.chartSubtitle}>Toque em um grupo para abrir suas categorias</Text>

                      {macroPieData.length > 0 ? (
                        <View style={styles.chartRow}>
                          <View style={styles.pieWrapper}>
                            <PieChart
                              data={macroPieData}
                              donut
                              showText
                              textColor="#111"
                              textSize={9}
                              radius={62}
                              innerRadius={38}
                              onPress={(item: any) => setSelectedMacro(item.label)}
                            />
                          </View>
                          <View style={styles.legendList}>
                            {macroPieData.map((item, idx) => (
                              <Pressable
                                key={idx}
                                style={styles.legendItem}
                                onPress={() => setSelectedMacro(item.label)}
                              >
                                <View style={[styles.legendIndicator, { backgroundColor: item.color }]} />
                                <Text style={styles.legendLabel}>
                                  {item.label} ({item.text})
                                </Text>
                                <Text style={styles.legendValue}>{formatCurrencySmart(item.value)}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.noDataText}>Sem dados financeiros no período selecionado.</Text>
                      )}
                    </View>
                  )}
                </Card>
              ) : (
                <CategorySummary
                  allRows={activeTable.rows}
                  selectedMonth={selectedMonth}
                  cutoffDate={cutoffDate}
                  onEditRow={handleEditRow}
                  onDeleteRow={db.deleteRow}
                  onRenameCategory={db.renameCategoryInBulk}
                  onDeleteCategory={db.deleteCategoryInBulk}
                />
              )}
            </>
          )}

          {/* ══ NODE 2: 📈 RECEITAS, MÉDIAS & ESTATÍSTICAS ══ */}
          {activeStation === 'revenue_stats' && (
            <>
              {activeSubLens?.id === 'averages' && (
                <MetricGrid>
                  <MetricCard icon="📦" label="Total Bruto" value={formatCurrencySmart(m.grossTotal)} accentColor={colors.success.main} />
                  <MetricCard icon="📅" label="Média Diária" value={formatCurrencySmart(m.globalDailyAvg)} accentColor={colors.info.main} />
                  <MetricCard icon="📆" label="Média Semanal" value={formatCurrencySmart(m.globalWeeklyAvg)} accentColor={colors.info.main} />
                  <MetricCard icon="🗓️" label="Média Mensal" value={formatCurrencySmart(m.globalMonthlyAvg)} accentColor={colors.info.main} />
                  <MetricCard icon="📊" label="Média Anual" value={formatCurrencySmart(m.globalAnnualAvg)} accentColor={colors.accent.purple} />
                  <MetricCard
                    icon="🏦"
                    label="Saldo Líquido"
                    value={formatCurrencySmart(m.netBalance)}
                    trend={m.netBalance >= 0 ? 'up' : 'down'}
                    accentColor={m.netBalance >= 0 ? colors.success.main : colors.danger.main}
                  />
                </MetricGrid>
              )}

              {activeSubLens?.id === 'stats' && (
                <MetricGrid>
                  <MetricCard icon="📊" label="Mediana (Típica)" value={formatCurrencySmart(m.medianTransaction)} accentColor={colors.info.main} />
                  <MetricCard icon="🔁" label="Moda (Recorrente)" value={formatCurrencySmart(m.modeTransaction)} accentColor={colors.accent.purple} />
                  <MetricCard icon="📏" label="Desvio Padrão" value={formatCurrencySmart(m.stdDeviation)} accentColor={colors.warning.main} />
                  <MetricCard icon="⬆️" label="Maior Receita" value={formatCurrencySmart(m.maxTransaction)} accentColor={colors.success.main} />
                  <MetricCard icon="⬇️" label="Menor Receita" value={formatCurrencySmart(m.minTransaction)} accentColor={colors.warning.main} />
                </MetricGrid>
              )}

              {activeSubLens?.id === 'scoped' && (
                <MetricGrid>
                  {selectedMonth !== 'all' && selectedMonthMetrics ? (
                    <>
                      <MetricCard
                        icon="💵"
                        label={`Receita (${formatMonthLabel(selectedMonth)})`}
                        value={formatCurrencySmart(selectedMonthMetrics.grossMonthly)}
                        accentColor={colors.success.main}
                      />
                      <MetricCard
                        icon="📅"
                        label="Diária do Mês"
                        value={`${formatCurrencySmart(selectedMonthMetrics.dailyAvg)}/dia`}
                        accentColor={colors.info.main}
                      />
                      <MetricCard
                        icon="📆"
                        label="Semanal do Mês"
                        value={`${formatCurrencySmart(selectedMonthMetrics.weeklyAvg)}/sem`}
                        accentColor={colors.info.main}
                      />
                    </>
                  ) : (
                    <MetricCard
                      icon="🗓️"
                      label="Filtro Mensal"
                      value="Todos os Meses"
                      subtitle="Selecione um mês acima para recorte mensal"
                      accentColor={colors.info.main}
                    />
                  )}
                  <MetricCard icon="🤝" label="Recebido Sócio" value={formatCurrencySmart(m.totalPartnerIn)} accentColor="#06b6d4" />
                  <MetricCard icon="📤" label="Pago Sócio" value={formatCurrencySmart(m.totalPartnerOut)} accentColor="#f97316" />
                  <MetricCard
                    icon="📊"
                    label="Saldo c/ Parceria"
                    value={formatCurrencySmart(m.netWithPartner)}
                    accentColor={m.netWithPartner >= 0 ? colors.success.main : colors.danger.main}
                  />
                </MetricGrid>
              )}
            </>
          )}

          {/* ══ NODE 3: 📉 CUSTOS & SOBREVIVÊNCIA ══ */}
          {activeStation === 'expenses_survival' && (
            <>
              {activeSubLens?.id === 'survival' ? (
                <MetricGrid>
                  <MetricCard icon="💸" label="Total Despesas" value={formatCurrencySmart(m.totalExpenses)} accentColor={colors.danger.main} />
                  <MetricCard
                    icon="🛡️"
                    label="Sobrevivência / Mês"
                    value={formatCurrencySmart(m.survivalMonthly)}
                    accentColor={colors.warning.main}
                    subtitle="para cobrir custos"
                  />
                  <MetricCard icon="📅" label="Custo Diário" value={formatCurrencySmart(m.survivalDaily)} accentColor={colors.warning.main} />
                  <MetricCard icon="📆" label="Custo Semanal" value={formatCurrencySmart(m.survivalWeekly)} accentColor={colors.warning.main} />
                </MetricGrid>
              ) : (
                <MetricGrid>
                  <MetricCard
                    icon="💸"
                    label="Gasto no Mês Selecionado"
                    value={monthlyExpenseTotal > 0 ? `-${formatCurrencySmart(monthlyExpenseTotal)}` : 'R$ 0,00'}
                    accentColor={colors.danger.main}
                    subtitle={selectedMonth === 'all' ? 'Selecione um mês acima' : formatMonthLabel(selectedMonth)}
                  />
                  <MetricCard
                    icon="📅"
                    label="Gasto Diário no Mês"
                    value={`-${formatCurrencySmart(expenseDailyAvg)}`}
                    accentColor={colors.danger.main}
                  />
                  <MetricCard
                    icon="📆"
                    label="Gasto Semanal no Mês"
                    value={`-${formatCurrencySmart(expenseWeeklyAvg)}`}
                    accentColor={colors.danger.main}
                  />
                </MetricGrid>
              )}
            </>
          )}

          {/* ══ NODE 4: 🎯 METAS, TEMPO & PORTFÓLIO ══ */}
          {activeStation === 'goals_sectors' && (
            <>
              {activeSubLens?.id === 'timebank' ? (
                <MetricGrid>
                  <MetricCard
                    icon="🎯"
                    label="Saldo Meta (R$)"
                    value={formatCurrencySmart(m.globalGoalBalance)}
                    trend={m.globalGoalBalance >= 0 ? 'up' : 'down'}
                    accentColor={m.globalGoalBalance >= 0 ? colors.success.main : colors.danger.main}
                  />
                  <MetricCard
                    icon="⏱️"
                    label="Banco de Tempo"
                    value={`${m.timeBankBalance > 0 ? '+' : ''}${m.timeBankBalance.toFixed(1)} sem`}
                    trend={m.timeBankBalance >= 0 ? 'up' : 'down'}
                    accentColor={m.timeBankBalance >= 0 ? colors.success.main : colors.warning.main}
                  />
                  <MetricCard icon="📐" label="Semanas Ativas" value={`${m.totalElapsedWeeks}`} accentColor={colors.text.tertiary} />
                  <MetricCard icon="🎁" label="Crédito Abonos" value={formatCurrencySmart(m.totalWaiverCredit)} accentColor={colors.warning.main} />
                </MetricGrid>
              ) : (
                <InvestorPortfolioWidget
                  rows={activeTable.rows}
                  activeProfile={activeTable.investorProfile}
                  annualCost={metrics.survivalAnnualCost > 0 ? metrics.survivalAnnualCost : metrics.totalExpenses}
                  onUpdateProfile={(profile) => db.updateInvestorProfile(profile)}
                  onAddRows={async (newRows) => {
                    await db.addRows(newRows);
                  }}
                />
              )}
            </>
          )}

          {/* ══ NODES 5..9: MÓDULOS SETORIAIS INTERATIVOS AUTOCAD ══ */}
          {activeStation === 'sector_pfm' && <PersonalFinanceSectorWidget />}
          {activeStation === 'sector_smb' && <SMBSectorWidget />}
          {activeStation === 'sector_real_estate' && <RealEstateSectorWidget />}
          {activeStation === 'sector_vehicles' && <VehiclesSectorWidget />}
          {activeStation === 'sector_legal_taxes' && <LegalTaxesSectorWidget />}

          {/* ══ NODE 10: ⚙️ CONFIGURADOR DE MÓDULOS IN-PLACE ══ */}
          {activeStation === 'modules_config' && <SectorSettingsPanel compact />}
        </ScrollView>
      </View>

      {/* Add / Edit Row Modal */}
      <AddRowModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingRow(null);
        }}
        onAdd={(rowOrRows) => {
          if (editingRow) {
            if (!Array.isArray(rowOrRows)) {
              db.updateRow(editingRow.id, rowOrRows);
            }
          } else {
            if (Array.isArray(rowOrRows)) {
              db.addRows(rowOrRows);
            } else {
              db.addRow(rowOrRows);
            }
          }
          setEditingRow(null);
        }}
        editingRow={editingRow}
      />
    </SafeAreaView>
  );
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx]} ${y}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
    flex: 1,
    textAlign: 'right',
  },

  cockpitOuter: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: 6,
    gap: 6,
  },

  /* 1. Icon-Only Command Bar */
  stationBarWrapper: {
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
  },
  stationBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
    minWidth: '100%',
  },
  iconOnlyNode: {
    width: 44,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconOnlyNodeActive: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    transform: [{ scale: 1.05 }],
  },
  iconOnlyEmoji: {
    fontSize: 19,
  },
  iconActiveIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#c084fc',
  },

  /* 2. Interactive Guide HUD */
  guideHud: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  guideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  guideBadgeBox: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideNodeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.primary,
  },
  guideNodeDesc: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 14,
    marginTop: 1,
  },
  subLensDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  subLensBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  subLensBtnActive: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
  },
  subLensEmoji: {
    fontSize: 12,
  },
  subLensLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  subLensLabelActive: {
    color: '#fff',
  },

  /* 3. Quick KPI Strip */
  quickKpiRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickKpiChip: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 5,
    gap: 1,
  },
  quickKpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  quickKpiValue: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  /* 4. Central Stage Viewport */
  stageViewport: {
    flex: 1,
  },
  stageViewportContent: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },

  biCard: {
    padding: spacing.md,
  },
  chartContainer: {
    gap: spacing.xs,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chartSubtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pieWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  legendList: {
    flex: 1,
    minWidth: 170,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    gap: 6,
  },
  legendIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  legendValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  noDataText: {
    fontSize: 12,
    color: colors.text.disabled,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  /* X-Ray View */
  xrayContainer: {
    gap: spacing.sm,
  },
  xrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: spacing.xs,
  },
  xrayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  xraySubtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  xrayBackBtn: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  xrayBackText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.tertiary,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
  },
  statCellSub: {
    fontSize: 9,
    color: colors.text.disabled,
  },
  xrayList: {
    gap: 4,
  },
  xrayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.tertiary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  xrayRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  xrayRowDate: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.disabled,
    width: 36,
  },
  xrayRowDesc: {
    fontSize: 11,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  xrayRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  xrayRowValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  xrayRowActions: {
    flexDirection: 'row',
    gap: 4,
  },
  xrayRowActionBtn: {
    padding: 3,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xs,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
