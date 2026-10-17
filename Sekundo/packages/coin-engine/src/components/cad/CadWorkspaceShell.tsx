/**
 * CadWorkspaceShell — "AutoCAD Financeiro" (Viewport-Locked Progressive Builder)
 *
 * Replaces endless vertical scrolling with a tactile, zero-scroll CAD workspace:
 *   - Top HUD: Project/Spreadsheet selector, Live Balance, Health Score, and CAD vs List mode toggle.
 *   - Central Blueprint Stage: Starts clean with the Core Project Node + User's Pinned Tool Chips.
 *     Clicking any tool mounts ONLY that single module on the stage (zero stacked wall of text).
 *   - Bottom Command Ribbon: 5 tactile CAD categories ([Palco], [+Lançar], [Projetar], [Inspecionar], [Dados/IA])
 *     that progressively reveal sub-options on click.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type {
  CadToolNodeId,
  DashboardConfig,
  TableRow,
  TableMetrics,
  TableGoals,
  InvestorProfileConfig,
} from '@coin/core/types';

export interface CadToolDefinition {
  id: CadToolNodeId;
  category: 'entry' | 'simulate' | 'inspect' | 'system';
  label: string;
  shortLabel: string;
  icon: string;
  subtitle: string;
  accentColor: string;
}

export const CAD_TOOL_CATALOG: CadToolDefinition[] = [
  {
    id: 'quick_entry',
    category: 'entry',
    label: 'Lançador Rápido & Últimos Registros',
    shortLabel: 'Lançar Rápido',
    icon: '⚡',
    subtitle: 'Registre gastos ou receitas em 3 segundos e veja os 4 últimos lançamentos',
    accentColor: '#10B981',
  },
  {
    id: 'mini_grid',
    category: 'inspect',
    label: 'Grade Compacta da Planilha',
    shortLabel: 'Grade Rápida',
    icon: '📋',
    subtitle: 'Inspecione linhas recentes ou abra a planilha completa sem sair do palco',
    accentColor: '#3B82F6',
  },
  {
    id: 'what_if',
    category: 'simulate',
    label: 'Simulador "E Se?" (Corte de Gastos / Renda)',
    shortLabel: 'Simular Corte',
    icon: '🧪',
    subtitle: 'Deslize controles para projetar economia mensal e impacto acumulado no ano',
    accentColor: '#A855F7',
  },
  {
    id: 'goals_timebank',
    category: 'simulate',
    label: 'Metas, Sobrevivência & Banco de Tempo',
    shortLabel: 'Metas & Folga',
    icon: '🎯',
    subtitle: 'Custo diário de sobrevivência, meta semanal e semanas de folga acumuladas',
    accentColor: '#F59E0B',
  },
  {
    id: 'health_pillars',
    category: 'inspect',
    label: 'Diagnóstico dos 4 Pilares & Insights',
    shortLabel: '4 Pilares',
    icon: '🩺',
    subtitle: 'Anel de Saúde Financeira (0–100), Próxima Melhor Ação e alertas inteligentes',
    accentColor: '#EC4899',
  },
  {
    id: 'investor_fire',
    category: 'simulate',
    label: 'Carteira de Investimentos & Meta FIRE',
    shortLabel: 'Carteira FIRE',
    icon: '📈',
    subtitle: 'Reserva de emergência, alocação por classe de ativo e progresso de independência',
    accentColor: '#06B6D4',
  },
  {
    id: 'sector_pfm',
    category: 'simulate',
    label: 'Motor PFM (Fluxo 13 Semanas & Monte Carlo)',
    shortLabel: 'Motor PFM',
    icon: '👤',
    subtitle: 'Projeção estocástica, reconciliação e fôlego de caixa pessoal',
    accentColor: '#6366F1',
  },
  {
    id: 'sector_vehicles',
    category: 'simulate',
    label: 'Motor de Veículos & Frota (TCO / Km)',
    shortLabel: 'Motor Frota/Km',
    icon: '🚗',
    subtitle: 'Depreciação real, custo por km rodado e comparativo Carro Próprio vs App',
    accentColor: '#14B8A6',
  },
  {
    id: 'sector_real_estate',
    category: 'simulate',
    label: 'Motor Imobiliário (SAC vs PRICE / Alugar vs Comprar)',
    shortLabel: 'Motor Imóvel',
    icon: '🏠',
    subtitle: 'Simulação de amortização imobiliária, Cap Rate e viabilidade patrimonial',
    accentColor: '#F97316',
  },
  {
    id: 'sector_smb',
    category: 'simulate',
    label: 'Motor Contábil PME (Capital de Giro & Folha)',
    shortLabel: 'Motor PME',
    icon: '🏢',
    subtitle: 'Ciclo financeiro (PMR/PME/PMP), Cash-Flow at Risk e regime empresarial',
    accentColor: '#8B5CF6',
  },
  {
    id: 'sector_legal_taxes',
    category: 'simulate',
    label: 'Motor Tributário & Privacidade (Fator R / PGBL)',
    shortLabel: 'Motor Tributos',
    icon: '⚖️',
    subtitle: 'Eficiência fiscal, Simulador Fator R, PGBL vs VGBL e K-Anonimato',
    accentColor: '#EAB308',
  },
  {
    id: 'export_import',
    category: 'system',
    label: 'Central de Exportação, Importação & IA',
    shortLabel: 'Exportar / IA',
    icon: '🔌',
    subtitle: 'Importar CSV, Exportar Relatório PDF/WhatsApp, Modelos Prontos e Síntese p/ IA',
    accentColor: '#10B981',
  },
];

type RibbonCategory = 'hub' | 'entry' | 'simulate' | 'inspect' | 'system';

export interface CadWorkspaceShellProps {
  tableName: string;
  rows: TableRow[];
  metrics: TableMetrics;
  goals: TableGoals;
  healthScore: number;
  healthLevelLabel: string;
  nextActionTitle?: string;
  nextActionDesc?: string;
  nextActionType?: string;
  dashboardConfig?: DashboardConfig;
  canUndo: boolean;
  lastUndoDescription?: string | null;
  isPrivacyMode?: boolean;
  onTogglePrivacyMode?: () => void;
  formatCurrency: (val: number) => string;
  onUndo: () => void;
  onOpenAddModal: () => void;
  onOpenTableSwitcher: () => void;
  onOpenAppBuilder: () => void;
  onOpenExamplesModal: () => void;
  onOpenLiveSynthesisModal: () => void;
  onNavigateTransactions: () => void;
  onNavigateCharts: () => void;
  onNavigateMetrics: () => void;
  onNavigateSettings: () => void;
  onNavigateChat: () => void;
  onNextActionPress?: (actionType?: string) => void;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
  renderToolContent: (toolId: CadToolNodeId) => React.ReactNode;
  onSwitchToClassicList: () => void;
}

export function CadWorkspaceShell({
  tableName,
  rows,
  metrics,
  healthScore,
  healthLevelLabel,
  nextActionTitle,
  nextActionDesc,
  nextActionType,
  dashboardConfig,
  canUndo,
  lastUndoDescription,
  isPrivacyMode,
  onTogglePrivacyMode,
  formatCurrency,
  onUndo,
  onOpenAddModal,
  onOpenTableSwitcher,
  onNavigateChat,
  onNextActionPress,
  onUpdateDashboardConfig,
  renderToolContent,
  onSwitchToClassicList,
}: CadWorkspaceShellProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeTool, setActiveTool] = useState<CadToolNodeId | null>(
    dashboardConfig?.activeCadTool ?? null
  );
  const [secondaryTool, setSecondaryTool] = useState<CadToolNodeId | null>(null);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [isCustomizingStage, setIsCustomizingStage] = useState(false);
  const [openRibbonCategory, setOpenRibbonCategory] = useState<RibbonCategory | null>(null);

  const pinnedNodes: CadToolNodeId[] = useMemo(() => {
    if (dashboardConfig?.pinnedCadNodes && dashboardConfig.pinnedCadNodes.length > 0) {
      return dashboardConfig.pinnedCadNodes;
    }
    return ['quick_entry', 'what_if', 'goals_timebank', 'health_pillars'];
  }, [dashboardConfig?.pinnedCadNodes]);

  const activeToolDef = useMemo(
    () => CAD_TOOL_CATALOG.find((t) => t.id === activeTool) || null,
    [activeTool]
  );

  const secondaryToolDef = useMemo(
    () => CAD_TOOL_CATALOG.find((t) => t.id === secondaryTool) || null,
    [secondaryTool]
  );

  const handleSelectTool = (toolId: CadToolNodeId | null) => {
    setActiveTool(toolId);
    if (toolId === null) {
      setSecondaryTool(null);
      setShowSplitPicker(false);
    }
    setOpenRibbonCategory(null);
    setIsCustomizingStage(false);
    if (dashboardConfig) {
      onUpdateDashboardConfig({
        ...dashboardConfig,
        activeCadTool: toolId,
      });
    }
  };

  const handleTogglePinTool = (toolId: CadToolNodeId) => {
    const isPinned = pinnedNodes.includes(toolId);
    const nextPinned = isPinned
      ? pinnedNodes.filter((id) => id !== toolId)
      : [...pinnedNodes, toolId];
    if (dashboardConfig) {
      onUpdateDashboardConfig({
        ...dashboardConfig,
        pinnedCadNodes: nextPinned.length > 0 ? nextPinned : ['quick_entry'],
      });
    }
  };

  const handleNextActionClick = () => {
    if (nextActionType === 'add_row') {
      handleSelectTool('quick_entry');
      return;
    }
    if (nextActionType === 'cut_expense') {
      handleSelectTool('what_if');
      return;
    }
    if (nextActionType === 'build_reserve') {
      handleSelectTool('investor_fire');
      return;
    }
    if (nextActionType === 'adjust_goals') {
      handleSelectTool('goals_timebank');
      return;
    }
    if (onNextActionPress) {
      onNextActionPress(nextActionType);
      return;
    }
    handleSelectTool('health_pillars');
  };

  const handleRibbonPress = (cat: RibbonCategory) => {
    setIsCustomizingStage(false);
    if (cat === 'hub') {
      handleSelectTool(null);
      setOpenRibbonCategory(null);
      return;
    }
    if (cat === 'entry') {
      handleSelectTool('quick_entry');
      setOpenRibbonCategory(null);
      return;
    }
    setOpenRibbonCategory((prev) => (prev === cat ? null : cat));
  };

  const subToolsForCategory = useMemo(() => {
    if (!openRibbonCategory || openRibbonCategory === 'hub' || openRibbonCategory === 'entry') {
      return [];
    }
    return CAD_TOOL_CATALOG.filter((t) => t.category === openRibbonCategory);
  }, [openRibbonCategory]);

  const netPositive = metrics.netBalance >= 0;

  return (
    <View
      style={[styles.viewportShell, Platform.OS === 'web' && ({ height: '100%', maxHeight: height } as any)]}
      testID="cad-workspace-shell"
    >
      {/* ── 1. UNIFIED TOP CAD HUD BAR (Zero Duplicate Header) ── */}
      <View style={styles.topHud} testID="cad-top-hud">
        <View style={styles.topHudLeft}>
          <View style={styles.cadModeBadge}>
            <Text style={styles.cadModeBadgeText}>📐 CAD</Text>
          </View>
          <Pressable
            style={styles.projectSelector}
            onPress={onOpenTableSwitcher}
            testID="cad-project-selector"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={styles.activeGreenDot} />
              <Text style={styles.projectSelectorName} numberOfLines={1}>
                {tableName || 'Planilha Principal'}
              </Text>
              <View style={styles.rowCountPill}>
                <Text style={styles.rowCountPillText}>{rows.length}</Text>
              </View>
              <Text style={styles.projectDropdownArrow}>▾</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.topHudRight}>
          {onTogglePrivacyMode && (
            <Pressable
              style={styles.hudIconBtn}
              onPress={onTogglePrivacyMode}
              testID="cad-privacy-btn"
            >
              <Text style={{ fontSize: 12 }}>{isPrivacyMode ? '🙈' : '👁️'}</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.hudScorePill}
            onPress={() => handleSelectTool('health_pillars')}
            testID="cad-health-pill"
          >
            <Text style={styles.hudScoreEmoji}>🩺</Text>
            <Text style={styles.hudScoreText}>{healthScore}</Text>
          </Pressable>

          <Pressable
            style={styles.hudAiButton}
            onPress={onNavigateChat}
            testID="cad-ai-button"
          >
            <Text style={styles.hudAiText}>✨ IA</Text>
          </Pressable>

          <Pressable
            style={styles.hudSwitchModeBtn}
            onPress={onSwitchToClassicList}
            testID="cad-switch-classic-btn"
          >
            <Text style={styles.hudSwitchModeText}>📜 Lista</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Undo Notification Strip (Only when active) ── */}
      {canUndo && (
        <View style={styles.undoStrip}>
          <Text style={styles.undoStripText} numberOfLines={1}>
            {lastUndoDescription ? `Ação: ${lastUndoDescription}` : 'Alteração recente'}
          </Text>
          <Pressable style={styles.undoStripBtn} onPress={onUndo}>
            <Text style={styles.undoStripBtnText}>↩ Desfazer</Text>
          </Pressable>
        </View>
      )}

      {/* ── 2. CENTRAL BLUEPRINT CANVAS (Zero-Scroll Constructive Workbench) ── */}
      <View style={styles.canvasStage} testID="cad-stage-canvas">
        {activeTool === null ? (
          /* ── STATE A: CLEAN BLUEPRINT HUB (Zero Infinite Scroll) ── */
          <View style={[styles.hubContainer, isDesktop && styles.hubContainerDesktop]}>
            {/* Core Project Node */}
            <View style={styles.coreNodeCard} testID="cad-core-node">
              <View style={styles.coreNodeHeader}>
                <View style={styles.coreNodeCoordTag}>
                  <Text style={styles.coreNodeCoordText}>NÓ CENTRAL • 0,0</Text>
                </View>
                <Text style={styles.coreNodeStatusText}>
                  {healthLevelLabel.toUpperCase()} • {rows.length} registros
                </Text>
              </View>

              <Text style={styles.coreBalanceLabel}>SALDO LÍQUIDO DO PROJETO</Text>
              <Text
                style={[
                  styles.coreBalanceValue,
                  { color: netPositive ? colors.success.main : colors.danger.main },
                ]}
              >
                {formatCurrency(metrics.netBalance)}
              </Text>

              {/* Compact 3-Metric Telemetry Row */}
              <View style={styles.coreTelemetryRow}>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>ENTRADAS</Text>
                  <Text style={[styles.telemetryVal, { color: colors.success.main }]}>
                    {formatCurrency(metrics.grossTotal)}
                  </Text>
                </View>
                <View style={styles.telemetryDivider} />
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>SAÍDAS</Text>
                  <Text style={[styles.telemetryVal, { color: colors.danger.main }]}>
                    {formatCurrency(metrics.totalExpenses)}
                  </Text>
                </View>
                <View style={styles.telemetryDivider} />
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>SOBREVIVÊNCIA/DIA</Text>
                  <Text style={[styles.telemetryVal, { color: '#C084FC' }]}>
                    {formatCurrency(metrics.survivalDaily)}
                  </Text>
                </View>
              </View>

              {/* Primary Constructive Action */}
              <View style={styles.coreActionsRow}>
                <Pressable
                  style={styles.primaryConstructBtn}
                  onPress={onOpenAddModal}
                  testID="cad-quick-register-btn"
                >
                  <Text style={styles.primaryConstructBtnText}>＋ Registrar Lançamento</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryConstructBtn}
                  onPress={() => handleSelectTool('export_import')}
                  testID="cad-open-io-btn"
                >
                  <Text style={styles.secondaryConstructBtnText}>📥 Importar / Exportar</Text>
                </Pressable>
              </View>
            </View>

            {/* Next Best Action Micro-Node (Smart Contextual Action Router) */}
            {nextActionTitle && (
              <Pressable
                style={styles.nextActionNode}
                onPress={handleNextActionClick}
                testID="cad-next-action-node"
              >
                <Text style={styles.nextActionNodeIcon}>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextActionNodeTitle} numberOfLines={1}>
                    {nextActionTitle}
                  </Text>
                  {nextActionDesc ? (
                    <Text style={styles.nextActionNodeSub} numberOfLines={1}>
                      {nextActionDesc}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.nextActionArrow}>Executar ›</Text>
              </Pressable>
            )}

            {/* Pinned Blueprint Modules ("2x2 Bento Grid + Stage Composer") */}
            <View style={styles.pinnedSection}>
              <View style={styles.pinnedHeaderRow}>
                <Text style={styles.pinnedSectionTitle}>
                  🧩 SUAS PEÇAS FIXADAS (TOQUE PARA ACOPLAR NO PALCO)
                </Text>
                <Pressable
                  style={styles.customizeStagePill}
                  onPress={() => setIsCustomizingStage((prev) => !prev)}
                  testID="cad-customize-stage-btn"
                >
                  <Text style={styles.pinnedAddLink}>
                    {isCustomizingStage ? '✕ Fechar Montador' : '⚙️ Montar Ambiente'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.pinnedGrid}>
                {pinnedNodes.slice(0, 4).map((nodeId) => {
                  const def = CAD_TOOL_CATALOG.find((t) => t.id === nodeId);
                  if (!def) return null;
                  return (
                    <Pressable
                      key={def.id}
                      style={[styles.pinnedNodeCard, { borderColor: def.accentColor + '66' }]}
                      onPress={() => handleSelectTool(def.id)}
                      testID={`cad-pinned-node-${def.id}`}
                    >
                      <Text style={styles.pinnedNodeIcon}>{def.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pinnedNodeLabel} numberOfLines={1}>
                          {def.shortLabel}
                        </Text>
                        <Text style={styles.pinnedNodeHint} numberOfLines={1}>
                          Acoplar no palco ›
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : (
          /* ── STATE B: SINGLE OR SPLIT-STAGE MOUNTED WORKBENCH ── */
          <View style={styles.mountedStageContainer} testID={`cad-mounted-tool-${activeTool}`}>
            <View style={styles.mountedHeaderBar}>
              <Pressable
                style={styles.backToHubBtn}
                onPress={() => handleSelectTool(null)}
                testID="cad-close-active-tool"
              >
                <Text style={styles.backToHubText}>← Palco</Text>
              </Pressable>

              <View style={styles.mountedTitleWrap}>
                <Text style={styles.mountedToolTitle} numberOfLines={1}>
                  {activeToolDef?.icon} {activeToolDef?.shortLabel || activeToolDef?.label}
                </Text>
              </View>

              <Pressable
                style={[
                  styles.pinToolBtn,
                  secondaryTool !== null && styles.pinToolBtnActive,
                ]}
                onPress={() => setShowSplitPicker((prev) => !prev)}
                testID="cad-split-stage-btn"
              >
                <Text style={styles.pinToolBtnText}>
                  {secondaryTool ? '➕ 2ª Peça Ativa' : '➕ Dividir Palco'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.pinToolBtn,
                  pinnedNodes.includes(activeTool) && styles.pinToolBtnActive,
                ]}
                onPress={() => handleTogglePinTool(activeTool)}
                testID="cad-pin-tool-btn"
              >
                <Text style={styles.pinToolBtnText}>
                  {pinnedNodes.includes(activeTool) ? '📌 Fixado' : '📌 Fixar'}
                </Text>
              </Pressable>
            </View>

            {/* Optional Split-Stage Selector Bar */}
            {showSplitPicker && (
              <View style={styles.splitPickerBar} testID="cad-split-picker-bar">
                <Text style={styles.splitPickerLabel}>
                  ACOPLAR 2ª PEÇA EM PARALELO:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {secondaryTool && (
                    <Pressable
                      style={[styles.splitChip, { borderColor: colors.danger.main }]}
                      onPress={() => {
                        setSecondaryTool(null);
                        setShowSplitPicker(false);
                      }}
                    >
                      <Text style={[styles.splitChipText, { color: colors.danger.main }]}>✕ Fechar 2ª Peça</Text>
                    </Pressable>
                  )}
                  {CAD_TOOL_CATALOG.filter((t) => t.id !== activeTool).map((t) => (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.splitChip,
                        secondaryTool === t.id && { borderColor: t.accentColor, backgroundColor: 'rgba(168,85,247,0.18)' },
                      ]}
                      onPress={() => {
                        setSecondaryTool(t.id);
                        setShowSplitPicker(false);
                      }}
                      testID={`cad-split-select-${t.id}`}
                    >
                      <Text style={styles.splitChipText}>
                        {t.icon} {t.shortLabel}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Contained Stage Viewport for 1 or 2 Docked Tools */}
            <ScrollView
              style={styles.mountedToolScroll}
              contentContainerStyle={[
                styles.mountedToolContent,
                isDesktop && styles.mountedToolContentDesktop,
              ]}
              showsVerticalScrollIndicator={false}
            >
              {renderToolContent(activeTool)}

              {secondaryTool && (
                <View style={styles.secondarySlotBox} testID={`cad-secondary-slot-${secondaryTool}`}>
                  <View style={styles.secondarySlotHeader}>
                    <Text style={styles.secondarySlotTitle}>
                      {secondaryToolDef?.icon} 2ª PEÇA ACOPLADA: {secondaryToolDef?.label}
                    </Text>
                    <Pressable onPress={() => setSecondaryTool(null)}>
                      <Text style={styles.secondarySlotClose}>✕ Desacoplar</Text>
                    </Pressable>
                  </View>
                  {renderToolContent(secondaryTool)}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ── 2B. IN-PLACE STAGE COMPOSER OVERLAY ("Monte Seu Próprio Ambiente") ── */}
      {isCustomizingStage && (
        <View style={styles.floatingPaletteOverlay} testID="cad-stage-composer-modal">
          <View style={styles.floatingPaletteHeader}>
            <View>
              <Text style={styles.floatingPaletteTitle}>
                🧩 Construtor do Seu Ambiente CAD ({pinnedNodes.length} fixadas)
              </Text>
              <Text style={{ fontSize: 10, color: colors.text.tertiary }}>
                Toque em 📌 para fixar/desafixar no Palco ou no nome para abrir agora
              </Text>
            </View>
            <Pressable onPress={() => setIsCustomizingStage(false)}>
              <Text style={styles.floatingPaletteClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 310 }} showsVerticalScrollIndicator={false}>
            <View style={styles.floatingPaletteGrid}>
              {CAD_TOOL_CATALOG.map((tool) => {
                const isPinned = pinnedNodes.includes(tool.id);
                return (
                  <View
                    key={tool.id}
                    style={[
                      styles.paletteItemBtn,
                      isPinned && { borderColor: tool.accentColor, backgroundColor: 'rgba(168,85,247,0.10)' },
                    ]}
                  >
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                      onPress={() => handleSelectTool(tool.id)}
                      testID={`cad-composer-open-${tool.id}`}
                    >
                      <Text style={styles.paletteItemIcon}>{tool.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paletteItemLabel}>{tool.shortLabel}</Text>
                        <Text style={styles.paletteItemDesc} numberOfLines={1}>
                          {tool.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.pinToolBtn,
                        isPinned && styles.pinToolBtnActive,
                      ]}
                      onPress={() => handleTogglePinTool(tool.id)}
                      testID={`cad-composer-pin-${tool.id}`}
                    >
                      <Text style={styles.pinToolBtnText}>{isPinned ? '📌 Fixa' : '＋ Fixar'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── 3. POPUP RADIAL/FLOATING PALETTE WHEN A RIBBON CATEGORY IS CLICKED ── */}
      {subToolsForCategory.length > 0 && (
        <View style={styles.floatingPaletteOverlay} testID="cad-floating-palette">
          <View style={styles.floatingPaletteHeader}>
            <Text style={styles.floatingPaletteTitle}>
              {openRibbonCategory === 'simulate'
                ? '📐 Escolha 1 Ferramenta de Projeto / Simulação'
                : openRibbonCategory === 'inspect'
                ? '📊 Escolha 1 Lente de Inspeção'
                : '🔌 Dados, Exportação & Inteligência'}
            </Text>
            <Pressable onPress={() => setOpenRibbonCategory(null)}>
              <Text style={styles.floatingPaletteClose}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.floatingPaletteGrid}>
            {subToolsForCategory.map((tool) => {
              const isCurrent = activeTool === tool.id;
              return (
                <Pressable
                  key={tool.id}
                  style={[
                    styles.paletteItemBtn,
                    isCurrent && { borderColor: tool.accentColor, backgroundColor: 'rgba(168,85,247,0.16)' },
                  ]}
                  onPress={() => handleSelectTool(tool.id)}
                  testID={`cad-palette-tool-${tool.id}`}
                >
                  <Text style={styles.paletteItemIcon}>{tool.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paletteItemLabel}>{tool.shortLabel}</Text>
                    <Text style={styles.paletteItemDesc} numberOfLines={1}>
                      {tool.subtitle}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ── 4. BOTTOM AUTOCAD COMMAND RIBBON (Thumb-Zone Progressive Builder) ── */}
      <View style={styles.commandRibbon} testID="cad-command-ribbon">
        <Pressable
          style={[styles.ribbonBtn, activeTool === null && !openRibbonCategory && styles.ribbonBtnActive]}
          onPress={() => handleRibbonPress('hub')}
          testID="cad-ribbon-hub"
        >
          <Text style={styles.ribbonIcon}>📐</Text>
          <Text style={[styles.ribbonLabel, activeTool === null && styles.ribbonLabelActive]}>
            Palco
          </Text>
        </Pressable>

        <Pressable
          style={[styles.ribbonBtn, activeTool === 'quick_entry' && styles.ribbonBtnActive]}
          onPress={() => handleRibbonPress('entry')}
          testID="cad-ribbon-entry"
        >
          <Text style={styles.ribbonIcon}>⚡</Text>
          <Text style={[styles.ribbonLabel, activeTool === 'quick_entry' && styles.ribbonLabelActive]}>
            Lançar
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.ribbonBtn,
            (openRibbonCategory === 'simulate' ||
              (activeToolDef && activeToolDef.category === 'simulate')) &&
              styles.ribbonBtnActive,
          ]}
          onPress={() => handleRibbonPress('simulate')}
          testID="cad-ribbon-simulate"
        >
          <Text style={styles.ribbonIcon}>🧪</Text>
          <Text style={styles.ribbonLabel}>Projetar ▴</Text>
        </Pressable>

        <Pressable
          style={[
            styles.ribbonBtn,
            (openRibbonCategory === 'inspect' ||
              (activeToolDef && activeToolDef.category === 'inspect')) &&
              styles.ribbonBtnActive,
          ]}
          onPress={() => handleRibbonPress('inspect')}
          testID="cad-ribbon-inspect"
        >
          <Text style={styles.ribbonIcon}>🔍</Text>
          <Text style={styles.ribbonLabel}>Inspecionar ▴</Text>
        </Pressable>

        <Pressable
          style={[
            styles.ribbonBtn,
            (openRibbonCategory === 'system' || activeTool === 'export_import') &&
              styles.ribbonBtnActive,
          ]}
          onPress={() => handleSelectTool('export_import')}
          testID="cad-ribbon-system"
        >
          <Text style={styles.ribbonIcon}>🔌</Text>
          <Text style={[styles.ribbonLabel, activeTool === 'export_import' && styles.ribbonLabelActive]}>
            Dados/IA
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportShell: {
    flex: 1,
    backgroundColor: colors.background.primary,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  topHudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cadModeBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1,
    borderColor: colors.accent.purple,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  cadModeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent.purple,
    letterSpacing: 0.4,
  },
  projectSelector: {
    flex: 1,
    maxWidth: 250,
    backgroundColor: colors.background.primary,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  activeGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success.main,
  },
  projectSelectorLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.8,
  },
  projectSelectorName: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.primary,
    flexShrink: 1,
  },
  rowCountPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  rowCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent.purple,
  },
  projectDropdownArrow: {
    fontSize: 10,
    color: colors.accent.purple,
    fontWeight: '800',
  },
  topHudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hudIconBtn: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  hudScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  hudScoreEmoji: {
    fontSize: 11,
  },
  hudScoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6EE7B7',
  },
  hudAiButton: {
    backgroundColor: colors.accent.purpleLight,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  hudAiText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent.purple,
  },
  hudSwitchModeBtn: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  hudSwitchModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  undoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent.purpleBorder,
  },
  undoStripText: {
    fontSize: 11,
    color: colors.text.secondary,
    flex: 1,
  },
  undoStripBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  undoStripBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  canvasStage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  hubContainer: {
    width: '100%',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  hubContainerDesktop: {
    maxWidth: 760,
    alignSelf: 'center',
  },
  coreNodeCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
  },
  coreNodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  coreNodeCoordTag: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  coreNodeCoordText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A5B4FC',
    letterSpacing: 0.8,
  },
  coreNodeStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.tertiary,
  },
  coreBalanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  coreBalanceValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  coreTelemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  telemetryCell: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.default,
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  telemetryVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  coreActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryConstructBtn: {
    flex: 1.3,
    backgroundColor: colors.accent.purple,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryConstructBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryConstructBtn: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryConstructBtnText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  nextActionNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  nextActionNodeIcon: {
    fontSize: 18,
  },
  nextActionNodeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.primary,
  },
  nextActionNodeSub: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  nextActionArrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  pinnedSection: {
    marginTop: 2,
  },
  pinnedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pinnedSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  customizeStagePill: {
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pinnedAddLink: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent.purple,
  },
  pinnedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pinnedNodeCard: {
    width: '48.5%',
    minWidth: '46%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
  },
  pinnedNodeIcon: {
    fontSize: 18,
  },
  pinnedNodeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.primary,
  },
  pinnedNodeHint: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  mountedStageContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
  },
  mountedHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 6,
  },
  backToHubBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  backToHubText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  mountedTitleWrap: {
    flex: 1,
  },
  mountedToolTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
  },
  pinToolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pinToolBtnActive: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purpleLight,
  },
  pinToolBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  splitPickerBar: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 6,
  },
  splitPickerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent.purple,
    letterSpacing: 0.6,
  },
  splitChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  splitChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  secondarySlotBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.accent.purpleBorder,
    gap: spacing.sm,
  },
  secondarySlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  secondarySlotTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent.purple,
  },
  secondarySlotClose: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger.main,
  },
  mountedToolScroll: {
    flex: 1,
  },
  mountedToolContent: {
    padding: spacing.md,
  },
  mountedToolContentDesktop: {
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
  },
  floatingPaletteOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 66,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purple,
    elevation: 12,
    zIndex: 1000,
  },
  floatingPaletteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  floatingPaletteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.primary,
  },
  floatingPaletteClose: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.tertiary,
    paddingHorizontal: 6,
  },
  floatingPaletteGrid: {
    gap: 6,
  },
  paletteItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  paletteItemIcon: {
    fontSize: 18,
  },
  paletteItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  paletteItemDesc: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  commandRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  ribbonBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  ribbonBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
  },
  ribbonIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  ribbonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  ribbonLabelActive: {
    color: colors.accent.purple,
    fontWeight: '800',
  },
});
