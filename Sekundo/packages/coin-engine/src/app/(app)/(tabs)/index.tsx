/**
 * Today Screen (Dashboard "Hoje") — Assistente Moeda
 *
 * The protagonist home screen focused on Financial Health, immediate clarity,
 * daily habits, and proactive guidance for families and individuals.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { useCoinDB } from '@coin/hooks/useCoinDB';
import { useSectorRegistry } from '@coin/hooks/useSectorRegistry';
import {
  HealthScoreRing,
  PillarsOverview,
  NextActionCard,
  InsightsCard,
} from '@coin/components/health';
import { WhatIfSimulator } from '@coin/components/sim/WhatIfSimulator';
import { LessonsViewer } from '@coin/components/learning/LessonsViewer';
import { computeHealthScore } from '@coin/core/healthEngine';
import { computeFinancialInsights } from '@coin/core/insightsEngine';
import { formatCurrencySmart } from '@coin/core/formatCurrency';
import {
  WORKSPACE_PRESETS,
  WIDGET_CATALOG,
  resolveEffectiveDashboardConfig,
  getRecommendedPresetForHealth,
} from '@coin/core/workspacePresets';
import {
  AddRowModal,
  TableSwitcherModal,
  ErrorBoundary,
  AppBuilderModal,
  InvestorPortfolioWidget,
  PersonalFinanceSectorWidget,
  SMBSectorWidget,
  RealEstateSectorWidget,
  VehiclesSectorWidget,
  LegalTaxesSectorWidget,
  SectorGuard,
  ExampleCSVGalleryModal,
  GranularExportModal,
} from '@coin/components/ui';
import { useWebKeyboardShortcuts } from '@coin/hooks/useWebKeyboardShortcuts';
import { CadWorkspaceShell } from '@coin/components/cad/CadWorkspaceShell';
import type { TableRow, DashboardWidgetId, WorkspacePresetType, CadToolNodeId } from '@coin/core/types';

export default function HojeScreen() {
  const router = useRouter();
  const db = useCoinDB();
  const { activeSectors } = useSectorRegistry();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);
  const [showAppBuilder, setShowAppBuilder] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [showLiveSynthesisModal, setShowLiveSynthesisModal] = useState(false);
  const [healthSubTab, setHealthSubTab] = useState<'score' | 'pillars' | 'insights'>('score');

  useWebKeyboardShortcuts({
    onQuickAdd: () => setShowAddModal(true),
    onOpenBuilder: () => setShowAppBuilder(true),
  });

  // ── Greeting based on current time ──────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // ── Financial Health Diagnostic ────────────────────────
  const healthReport = useMemo(() => {
    return computeHealthScore(db.metrics);
  }, [db.metrics]);

  // ── Effective Composable Dashboard Config ──────────────
  const effectiveConfig = useMemo(
    () => resolveEffectiveDashboardConfig(db.activeTable?.dashboardConfig),
    [db.activeTable?.dashboardConfig]
  );

  const recommendedPreset = useMemo(
    () => getRecommendedPresetForHealth(healthReport.level, healthReport.score),
    [healthReport.level, healthReport.score]
  );

  const activePresetMeta = WORKSPACE_PRESETS[effectiveConfig.preset] || WORKSPACE_PRESETS.freelancer;

  const handleQuickApplyPreset = useCallback(
    (presetId: WorkspacePresetType) => {
      const def = WORKSPACE_PRESETS[presetId];
      if (!def) return;
      db.updateDashboardConfig({
        preset: def.id,
        widgetOrder: [...def.widgetOrder],
        hiddenWidgets: [...def.hiddenWidgets],
        preferredViewMode: effectiveConfig.preferredViewMode,
      });
      db.updateActiveSectors([...def.activeSectors]);
    },
    [db, effectiveConfig.preferredViewMode]
  );

  // ── Dynamic Insights ───────────────────────────────────
  const activeRows = useMemo(() => {
    return db.activeTable?.rows || [];
  }, [db.activeTable?.rows]);

  const insights = useMemo(() => {
    return computeFinancialInsights(activeRows, db.metrics);
  }, [activeRows, db.metrics]);

  // ── Accurate Monthly Baseline for What-If Simulator ────
  const monthlySimulatorBaseline = useMemo(() => {
    const activeMonthsCount = Math.max(1, Object.keys(db.metrics.byMonth || {}).length);
    const monthlyExpense =
      db.metrics.survivalMonthly > 0
        ? db.metrics.survivalMonthly
        : db.metrics.totalExpenses > 0
        ? Math.round(db.metrics.totalExpenses / activeMonthsCount)
        : 3000;
    const monthlyRevenue =
      db.metrics.globalMonthlyAvg > 0
        ? Math.round(db.metrics.globalMonthlyAvg)
        : db.metrics.grossTotal > 0
        ? Math.round(db.metrics.grossTotal / activeMonthsCount)
        : 4500;
    return { monthlyExpense, monthlyRevenue };
  }, [db.metrics]);

  // ── Recent transactions (Last 4) ───────────────────────
  const recentRows = useMemo(() => {
    return [...activeRows]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 4);
  }, [activeRows]);

  // ── Handlers ───────────────────────────────────────────
  const handleNextActionPress = useCallback((actionType?: string) => {
    if (actionType === 'add_row') {
      setShowAddModal(true);
    } else if (actionType === 'adjust_goals') {
      router.push('/coin/settings' as any);
    } else if (actionType === 'cut_expense' || actionType === 'build_reserve') {
      router.push('/coin/transactions' as any);
    } else {
      setShowAddModal(true);
    }
  }, [router]);

  const handleAddRow = useCallback((rowOrRows: Omit<TableRow, 'id'> | Omit<TableRow, 'id'>[]) => {
    if (db.tables.length === 0) {
      db.addTable('Minha Planilha', 'Primeira tabela financeira');
    }
    if (Array.isArray(rowOrRows)) {
      db.addRows(rowOrRows);
    } else {
      db.addRow(rowOrRows);
    }
  }, [db]);

  const formatRelativeDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const [, month, day] = dateStr.split('-');
      return `${day}/${month}`;
    } catch {
      return dateStr;
    }
  };

  const getEntryTypeColor = (type?: string) => {
    switch (type) {
      case 'revenue':
        return colors.success.main;
      case 'deposit':
        return colors.info.main;
      case 'waiver':
        return colors.warning.main;
      case 'unresolved':
        return '#F59E0B';
      case 'expense':
      default:
        return colors.danger.main;
    }
  };

  // ── Modular Widget Renderer ────────────────────────────
  const renderWidgetById = (widgetId: DashboardWidgetId) => {
    switch (widgetId) {
      case 'health_score':
        return (
          <HealthScoreRing
            score={healthReport.score}
            level={healthReport.level}
            headline={healthReport.headline}
          />
        );

      case 'next_action':
        return (
          <NextActionCard
            action={healthReport.nextBestAction}
            onActionPress={handleNextActionPress}
          />
        );

      case 'month_summary':
        return (
          <View style={styles.summarySection}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Entradas</Text>
              <Text style={[styles.summaryValue, { color: colors.success.main }]}>
                {formatCurrencySmart(db.metrics.grossTotal)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Despesas</Text>
              <Text style={[styles.summaryValue, { color: colors.danger.main }]}>
                {formatCurrencySmart(db.metrics.totalExpenses)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Saldo Líquido</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      db.metrics.netBalance >= 0
                        ? colors.accent.purple
                        : colors.danger.main,
                  },
                ]}
              >
                {formatCurrencySmart(db.metrics.netBalance)}
              </Text>
            </View>
          </View>
        );

      case 'pillars':
        return <PillarsOverview pillars={healthReport.pillars} />;

      case 'insights':
        return <InsightsCard insights={insights} />;

      case 'what_if':
        return (
          <WhatIfSimulator
            currentMonthlyExpense={monthlySimulatorBaseline.monthlyExpense}
            currentMonthlyRevenue={monthlySimulatorBaseline.monthlyRevenue}
          />
        );

      case 'investor_summary':
        return (
          <InvestorPortfolioWidget
            rows={activeRows}
            activeProfile={db.activeTable?.investorProfile}
            annualCost={
              db.metrics.survivalAnnualCost > 0
                ? db.metrics.survivalAnnualCost
                : db.metrics.totalExpenses > 0
                ? db.metrics.totalExpenses
                : 0
            }
            onUpdateProfile={(profile) => db.updateInvestorProfile(profile)}
            onAddRows={async (newRows) => {
              await db.addRows(newRows);
            }}
          />
        );

      case 'sector_simulators':
        return (
          <View style={styles.sectorSimulatorsBlock}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.sectionTitle}>🧮 Motores Setoriais & Atuariais Ativos</Text>
              <Pressable onPress={() => setShowAppBuilder(true)}>
                <Text style={styles.seeAllText}>Configurar Setores ›</Text>
              </Pressable>
            </View>
            <SectorGuard sector="personal_finance">
              <PersonalFinanceSectorWidget />
            </SectorGuard>
            <SectorGuard sector="smb_accounting">
              <SMBSectorWidget />
            </SectorGuard>
            <SectorGuard sector="real_estate">
              <RealEstateSectorWidget />
            </SectorGuard>
            <SectorGuard sector="vehicles">
              <VehiclesSectorWidget />
            </SectorGuard>
            <SectorGuard sector="legal_taxes">
              <LegalTaxesSectorWidget />
            </SectorGuard>
          </View>
        );

      case 'lessons':
        return <LessonsViewer />;

      case 'quick_actions':
        return (
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Ações Rápidas</Text>
            <View style={styles.quickActionsGrid}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.quickActionIcon}>➕</Text>
                <Text style={styles.quickActionText}>Novo Registro</Text>
              </Pressable>

              <Pressable
                style={styles.quickActionButton}
                onPress={() => router.push('/coin/transactions' as any)}
              >
                <Text style={styles.quickActionIcon}>📋</Text>
                <Text style={styles.quickActionText}>Planilha Completa</Text>
              </Pressable>

              <Pressable
                style={[styles.quickActionButton, { borderColor: 'rgba(99, 102, 241, 0.45)', backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}
                onPress={() => setShowExamplesModal(true)}
              >
                <Text style={styles.quickActionIcon}>📚</Text>
                <Text style={[styles.quickActionText, { color: '#A5B4FC' }]}>Exemplos & Modelos IA</Text>
              </Pressable>

              <Pressable
                style={styles.quickActionButton}
                onPress={() => setShowAppBuilder(true)}
              >
                <Text style={styles.quickActionIcon}>🧩</Text>
                <Text style={styles.quickActionText}>Monte Seu App</Text>
              </Pressable>
            </View>
          </View>
        );

      case 'recent_activity':
        return (
          <View style={styles.recentSection}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.sectionTitle}>Últimos Lançamentos</Text>
              <Pressable onPress={() => router.push('/coin/transactions' as any)}>
                <Text style={styles.seeAllText}>Ver todos ›</Text>
              </Pressable>
            </View>

            {recentRows.length === 0 ? (
              <View style={styles.emptyRecentCard}>
                <Text style={styles.emptyRecentText}>
                  Nenhuma transação registrada nesta planilha ainda.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  <Pressable
                    style={styles.emptyAddButton}
                    onPress={() => setShowAddModal(true)}
                  >
                    <Text style={styles.emptyAddButtonText}>+ Criar Primeiro Lançamento</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.emptyAddButton, { backgroundColor: '#312E81', borderWidth: 1, borderColor: '#6366F1' }]}
                    onPress={() => setShowExamplesModal(true)}
                  >
                    <Text style={[styles.emptyAddButtonText, { color: '#E0E7FF' }]}>📚 Testar Planilha de Exemplo / IA</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.recentList}>
                {recentRows.map((row) => {
                  const isPositive = row.entryType === 'revenue' || row.entryType === 'partner_in';
                  const sign = isPositive ? '+' : row.entryType === 'expense' || row.entryType === 'partner_out' ? '-' : '';
                  const valColor = getEntryTypeColor(row.entryType);

                  return (
                    <View key={row.id} style={styles.recentItem}>
                      <View style={styles.recentItemLeft}>
                        <Text style={styles.recentItemDate}>
                          {formatRelativeDate(row.date)}
                        </Text>
                        <View style={styles.recentDescCol}>
                          <Text style={styles.recentItemDesc} numberOfLines={1}>
                            {row.description || 'Sem descrição'}
                          </Text>
                          {row.category ? (
                            <Text style={styles.recentItemCategory} numberOfLines={1}>
                              {row.category}
                              {row.ticker ? ` • 📈 ${row.ticker}` : ''}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <Text style={[styles.recentItemValue, { color: valColor }]}>
                        {sign} {formatCurrencySmart(Math.abs(row.value))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const visibleWidgets = useMemo(
    () =>
      effectiveConfig.widgetOrder.filter(
        (wId) => !effectiveConfig.hiddenWidgets.includes(wId)
      ),
    [effectiveConfig]
  );

  // Instant local view mode state so toggling CAD <-> Classic List works even before a table is created
  const [localViewMode, setLocalViewMode] = useState<'cad_canvas' | 'cards' | null>(null);
  const currentViewMode = localViewMode ?? effectiveConfig.preferredViewMode;
  const isCadMode = currentViewMode !== 'cards';

  const handleSetViewMode = (mode: 'cad_canvas' | 'cards') => {
    setLocalViewMode(mode);
    db.updateDashboardConfig({
      ...effectiveConfig,
      preferredViewMode: mode,
    });
  };

  const renderCadToolContent = (toolId: CadToolNodeId): React.ReactNode => {
    switch (toolId) {
      case 'quick_entry':
        return (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Pressable
                style={[styles.emptyAddButton, { flex: 1, alignItems: 'center', paddingVertical: 12 }]}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.emptyAddButtonText}>＋ Novo Lançamento Agora</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.emptyAddButton,
                  {
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 12,
                    backgroundColor: colors.background.primary,
                    borderWidth: 1,
                    borderColor: colors.border.strong,
                  },
                ]}
                onPress={() => router.push('/coin/transactions' as any)}
              >
                <Text style={[styles.emptyAddButtonText, { color: colors.text.primary }]}>
                  📋 Abrir Planilha Completa
                </Text>
              </Pressable>
            </View>
            {renderWidgetById('recent_activity')}
          </View>
        );
      case 'mini_grid':
        return (
          <View style={{ gap: spacing.md }}>
            {renderWidgetById('month_summary')}
            {renderWidgetById('recent_activity')}
          </View>
        );
      case 'what_if':
        return renderWidgetById('what_if');
      case 'goals_timebank':
        return (
          <View style={{ gap: spacing.md }}>
            <View style={styles.summarySection}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Sobrevivência / Dia</Text>
                <Text style={[styles.summaryValue, { color: '#C084FC' }]}>
                  {formatCurrencySmart(db.metrics.survivalDaily)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Sobrevivência / Semana</Text>
                <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                  {formatCurrencySmart(db.metrics.survivalWeekly)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Banco de Tempo</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: db.metrics.timeBankBalance >= 0 ? colors.success.main : colors.danger.main },
                  ]}
                >
                  {db.metrics.timeBankBalance >= 0 ? '+' : ''}
                  {db.metrics.timeBankBalance.toFixed(1)} sem.
                </Text>
              </View>
            </View>
            <Pressable
              style={[styles.emptyAddButton, { alignSelf: 'flex-start' }]}
              onPress={() => router.push('/coin/metrics' as any)}
            >
              <Text style={styles.emptyAddButtonText}>🎯 Configurar Metas & Sprints ›</Text>
            </Pressable>
          </View>
        );
      case 'health_pillars':
        return (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
              {([
                { id: 'score', label: '🩺 Score & Resumo' },
                { id: 'pillars', label: '🏛️ 4 Pilares' },
                { id: 'insights', label: '💡 Insights' },
              ] as const).map((tab) => {
                const active = healthSubTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      backgroundColor: active ? colors.accent.purpleLight : colors.background.primary,
                      borderWidth: 1,
                      borderColor: active ? colors.accent.purple : colors.border.default,
                    }}
                    onPress={() => setHealthSubTab(tab.id)}
                    testID={`cad-health-subtab-${tab.id}`}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: active ? colors.accent.purple : colors.text.secondary,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {healthSubTab === 'score' && renderWidgetById('health_score')}
            {healthSubTab === 'pillars' && renderWidgetById('pillars')}
            {healthSubTab === 'insights' && renderWidgetById('insights')}
          </View>
        );
      case 'investor_fire':
        return renderWidgetById('investor_summary');
      case 'sector_pfm':
        return <PersonalFinanceSectorWidget />;
      case 'sector_smb':
        return <SMBSectorWidget />;
      case 'sector_real_estate':
        return <RealEstateSectorWidget />;
      case 'sector_vehicles':
        return <VehiclesSectorWidget />;
      case 'sector_legal_taxes':
        return <LegalTaxesSectorWidget />;
      case 'export_import':
        return (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionTitle}>🔌 Central de Dados, Exportação & IA</Text>
            <View style={styles.quickActionsGrid}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => setShowLiveSynthesisModal(true)}
                testID="cad-io-synthesis-btn"
              >
                <Text style={styles.quickActionIcon}>🧠</Text>
                <Text style={styles.quickActionText}>Exportar Granular / Síntese IA</Text>
              </Pressable>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => setShowExamplesModal(true)}
                testID="cad-io-examples-btn"
              >
                <Text style={styles.quickActionIcon}>📚</Text>
                <Text style={styles.quickActionText}>Importar Modelos CSV Prontos</Text>
              </Pressable>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => router.push('/coin/transactions' as any)}
                testID="cad-io-spreadsheet-btn"
              >
                <Text style={styles.quickActionIcon}>📥</Text>
                <Text style={styles.quickActionText}>Importar / Exportar na Planilha</Text>
              </Pressable>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => setShowAppBuilder(true)}
                testID="cad-io-builder-btn"
              >
                <Text style={styles.quickActionIcon}>🧩</Text>
                <Text style={styles.quickActionText}>Perfis & Setores do App</Text>
              </Pressable>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary fallbackTitle="Erro ao carregar Painel Hoje" componentName="HojeScreen">
      <View style={styles.container}>
        {isCadMode ? (
          <CadWorkspaceShell
            tableName={db.activeTable?.name || 'Planilha Principal'}
            rows={activeRows}
            metrics={db.metrics}
            goals={db.activeTable?.goals || { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} }}
            healthScore={healthReport.score}
            healthLevelLabel={String(healthReport.level)}
            nextActionTitle={healthReport.nextBestAction?.title}
            nextActionDesc={healthReport.nextBestAction?.description}
            nextActionType={healthReport.nextBestAction?.actionType}
            dashboardConfig={effectiveConfig}
            canUndo={db.canUndo}
            lastUndoDescription={db.lastUndoDescription}
            isPrivacyMode={db.isPrivacyMode}
            onTogglePrivacyMode={db.togglePrivacyMode}
            formatCurrency={(val) => formatCurrencySmart(val)}
            onUndo={() => db.undo()}
            onOpenAddModal={() => setShowAddModal(true)}
            onOpenTableSwitcher={() => setShowTableSwitcher(true)}
            onOpenAppBuilder={() => setShowAppBuilder(true)}
            onOpenExamplesModal={() => setShowExamplesModal(true)}
            onOpenLiveSynthesisModal={() => setShowLiveSynthesisModal(true)}
            onNavigateTransactions={() => router.push('/coin/transactions' as any)}
            onNavigateCharts={() => router.push('/coin/charts' as any)}
            onNavigateMetrics={() => router.push('/coin/metrics' as any)}
            onNavigateSettings={() => router.push('/coin/settings' as any)}
            onNavigateChat={() => router.push('/coin/chat')}
            onNextActionPress={handleNextActionPress}
            onUpdateDashboardConfig={db.updateDashboardConfig}
            renderToolContent={renderCadToolContent}
            onSwitchToClassicList={() => handleSetViewMode('cards')}
          />
        ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top Header: Greeting + Table Selector + App Builder + AI ── */}
          <View style={styles.topHeader}>
            <View>
              <Text style={styles.greetingText}>
                {greeting} 👋 • {activePresetMeta.icon} Modo {activePresetMeta.name}
              </Text>
              <Pressable
                style={styles.tableSelectorButton}
                onPress={() => setShowTableSwitcher(true)}
              >
                <Text style={styles.activeTableName} numberOfLines={1}>
                  {db.activeTable?.name || 'Selecione uma Planilha'}
                </Text>
                <Text style={styles.tableDropdownIcon}>▾</Text>
              </Pressable>
            </View>

            <View style={styles.topHeaderActions}>
              <Pressable
                style={[styles.builderHeaderButton, { borderColor: colors.accent.purple, backgroundColor: 'rgba(168, 85, 247, 0.18)' }]}
                onPress={() => handleSetViewMode('cad_canvas')}
                testID="switch-to-cad-mode-btn"
              >
                <Text style={styles.builderButtonEmoji}>📐</Text>
                <Text style={[styles.builderButtonText, { color: '#E9D5FF', fontWeight: '800' }]}>Modo CAD (Sem Rolagem)</Text>
              </Pressable>

              <Pressable
                style={[styles.builderHeaderButton, { borderColor: 'rgba(16, 185, 129, 0.55)', backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}
                onPress={() => setShowLiveSynthesisModal(true)}
              >
                <Text style={styles.builderButtonEmoji}>🧠</Text>
                <Text style={[styles.builderButtonText, { color: '#6EE7B7', fontWeight: '700' }]}>Síntese da Planilha p/ IA</Text>
              </Pressable>

              <Pressable
                style={styles.builderHeaderButton}
                onPress={() => setShowAppBuilder(true)}
              >
                <Text style={styles.builderButtonEmoji}>🧩</Text>
                <Text style={styles.builderButtonText}>Monte Seu App</Text>
              </Pressable>

              <Pressable
                style={styles.chatHeaderButton}
                onPress={() => router.push('/coin/chat')}
              >
                <Text style={styles.chatButtonEmoji}>✨</Text>
                <Text style={styles.chatButtonText}>IA Assistente</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Journey / Preset Quick Strip ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetStrip}
          >
            {(['survival', 'freelancer', 'investor', 'smb'] as WorkspacePresetType[]).map((pid) => {
              const p = WORKSPACE_PRESETS[pid];
              const isSelected = effectiveConfig.preset === p.id;
              const isRec = recommendedPreset.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                  onPress={() => handleQuickApplyPreset(p.id)}
                >
                  <Text style={styles.presetChipIcon}>{p.icon}</Text>
                  <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                    {p.name}
                  </Text>
                  {isRec && !isSelected && (
                    <View style={styles.presetRecDot}>
                      <Text style={styles.presetRecDotText}>Sugerido</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.presetChip, { borderColor: 'rgba(99, 102, 241, 0.45)', backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}
              onPress={() => setShowExamplesModal(true)}
            >
              <Text style={styles.presetChipIcon}>📚</Text>
              <Text style={[styles.presetChipText, { color: '#A5B4FC', fontWeight: '700' }]}>Modelos CSV por Perfil</Text>
            </Pressable>
            <Pressable
              style={[styles.presetChip, effectiveConfig.preset === 'custom' && styles.presetChipActive]}
              onPress={() => setShowAppBuilder(true)}
            >
              <Text style={styles.presetChipIcon}>⚙️</Text>
              <Text style={styles.presetChipText}>Personalizar Blocos</Text>
            </Pressable>
          </ScrollView>

          {/* ── Undo Bar (When Available) ── */}
          {db.canUndo && (
            <View style={styles.undoBar}>
              <Text style={styles.undoText} numberOfLines={1}>
                {db.lastUndoDescription ? `Última ação: ${db.lastUndoDescription}` : 'Ação registrada no histórico'}
              </Text>
              <Pressable
                style={styles.undoButton}
                onPress={() => db.undo()}
              >
                <Text style={styles.undoButtonText}>↩ Desfazer</Text>
              </Pressable>
            </View>
          )}

          {/* ── Dynamic Bento Grid (Desktop 2-col / Mobile 1-col) ── */}
          <View style={[styles.widgetsContainer, isDesktop && styles.widgetsBentoGrid]}>
            {visibleWidgets.map((wId) => {
              const catalogMeta = WIDGET_CATALOG.find((c) => c.id === wId);
              const isFullSpan = catalogMeta?.defaultSpan === 2;
              return (
                <View
                  key={wId}
                  style={[
                    styles.widgetItemWrap,
                    isDesktop && (isFullSpan ? styles.bentoFullSpan : styles.bentoHalfSpan),
                  ]}
                >
                  {renderWidgetById(wId)}
                </View>
              );
            })}
          </View>

          {/* Extra bottom padding for tab bar and FAB */}
          <View style={{ height: 80 }} />
        </ScrollView>
        )}

        {/* ── Thumb-Zone Quick Register FAB (Classic List Mode only) ── */}
        {!isCadMode && (
          <View style={styles.homeFabContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.homeQuickAddFab,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.homeQuickAddFabText}>＋ Registrar Gasto / Receita</Text>
            </Pressable>
          </View>
        )}

        {/* ── Modals ── */}
        <AddRowModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddRow}
          schema={db.activeTable?.schema}
        />

        <TableSwitcherModal
          visible={showTableSwitcher}
          onClose={() => setShowTableSwitcher(false)}
          tables={db.tables}
          activeTableIndex={db.activeTableIndex}
          onSelect={db.setActiveTableIndex}
          onAdd={(name) => db.addTable(name)}
          onRename={db.renameTable}
          onDelete={db.deleteTable}
          onReorder={db.reorderTables}
        />

        <AppBuilderModal
          visible={showAppBuilder}
          onClose={() => setShowAppBuilder(false)}
          dashboardConfig={db.activeTable?.dashboardConfig}
          activeSectors={activeSectors}
          healthScore={healthReport.score}
          healthLevel={healthReport.level}
          isPrivacyMode={db.isPrivacyMode}
          onUpdateDashboardConfig={db.updateDashboardConfig}
          onUpdateActiveSectors={db.updateActiveSectors}
          onTogglePrivacyMode={db.togglePrivacyMode}
        />

        <ExampleCSVGalleryModal
          visible={showExamplesModal}
          onClose={() => setShowExamplesModal(false)}
          onImportExample={db.importSpreadsheet}
          onOpenLiveSynthesis={() => {
            setShowExamplesModal(false);
            setShowLiveSynthesisModal(true);
          }}
        />

        <GranularExportModal
          visible={showLiveSynthesisModal}
          onClose={() => setShowLiveSynthesisModal(false)}
          rows={db.activeTable?.rows || []}
          tableName={db.activeTable?.name || 'Minha Planilha'}
          selectedMonth={db.selectedMonth === 'all' ? undefined : db.selectedMonth}
          goals={db.activeTable?.goals}
          tableId={db.activeTable?.id}
          schema={db.activeTable?.schema}
          investorProfile={db.activeTable?.investorProfile}
          activeSectors={activeSectors}
          dashboardConfig={db.activeTable?.dashboardConfig}
          sectorParams={db.activeTable?.sectorParams}
          initialMode="ai_analyst"
        />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  scrollContentDesktop: {
    maxWidth: 1380,
    width: '100%',
    alignSelf: 'center',
    padding: spacing.xl,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: Platform.OS === 'android' ? spacing.sm : 0,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  greetingText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '600',
    marginBottom: 2,
  },
  tableSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 280,
  },
  activeTableName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  tableDropdownIcon: {
    fontSize: 14,
    color: colors.accent.purple,
    fontWeight: '800',
  },
  builderHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  builderButtonEmoji: {
    fontSize: 14,
  },
  builderButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chatHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent.purpleLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
  },
  chatButtonEmoji: {
    fontSize: 14,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  presetStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  presetChipActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purple,
  },
  presetChipIcon: {
    fontSize: 13,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  presetChipTextActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  presetRecDot: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  presetRecDotText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success.main,
  },
  widgetsContainer: {
    gap: spacing.md,
  },
  widgetsBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  widgetItemWrap: {
    width: '100%',
  },
  bentoHalfSpan: {
    width: '48.8%',
    flexGrow: 1,
  },
  bentoFullSpan: {
    width: '100%',
  },
  sectorSimulatorsBlock: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
  },
  undoText: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  undoButton: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  undoButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  summarySection: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  quickActionsSection: {
    marginBottom: spacing.xs,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickActionIcon: {
    fontSize: 20,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recentSection: {
    marginBottom: spacing.xs,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  seeAllText: {
    fontSize: 13,
    color: colors.accent.purple,
    fontWeight: '600',
  },
  emptyRecentCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentText: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyAddButton: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  emptyAddButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  recentList: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  recentItemDate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.tertiary,
    width: 42,
  },
  recentDescCol: {
    flex: 1,
  },
  recentItemDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recentItemCategory: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  recentItemValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  homeFabContainer: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    zIndex: 999,
  },
  homeQuickAddFab: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.full,
    elevation: 8,
    shadowColor: colors.accent.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  homeQuickAddFabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
