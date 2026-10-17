/**
 * AppBuilderModal Component ("Monte Seu Aplicativo") — Assistente Moeda
 *
 * Allows the user to customize their application layout, active financial sectors,
 * and dashboard widgets according to their usage context ("na rua" vs "no computador")
 * and financial health stage.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import {
  WORKSPACE_PRESETS,
  WIDGET_CATALOG,
  resolveEffectiveDashboardConfig,
  getRecommendedPresetForHealth,
} from '@coin/core/workspacePresets';
import type {
  DashboardConfig,
  DashboardWidgetId,
  WorkspacePresetType,
  HealthLevel,
} from '@coin/core/types';

export interface AppBuilderModalProps {
  visible: boolean;
  onClose: () => void;
  dashboardConfig?: DashboardConfig;
  activeSectors: string[];
  healthScore: number;
  healthLevel: HealthLevel;
  isPrivacyMode: boolean;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
  onUpdateActiveSectors: (sectors: string[]) => void;
  onTogglePrivacyMode: () => void;
}

const SECTOR_OPTIONS: { id: string; label: string; icon: string; desc: string }[] = [
  {
    id: 'personal_finance',
    label: 'Finanças Pessoais & FIRE (PFM)',
    icon: '👤',
    desc: 'Fluxo de 13 semanas, Simulador Monte Carlo FIRE, Sankey e Reconciliação',
  },
  {
    id: 'smb_accounting',
    label: 'Contabilidade PME & Negócios',
    icon: '🏢',
    desc: 'Capital de Giro DRP, Volatilidade Welford, CFaR, Folha CLT vs Lucro Real e SPED',
  },
  {
    id: 'real_estate',
    label: 'Imóveis & PropTech (SAC / PRICE)',
    icon: '🏠',
    desc: 'Amortização SAC vs PRICE, Alugar vs Comprar, Cap Rate, FIIs e Permuta',
  },
  {
    id: 'vehicles',
    label: 'Veículos, Frotas & Mobilidade (TCO)',
    icon: '🚗',
    desc: 'Depreciação, Custo por Km, App vs Carro Próprio e Eficiência de Frota',
  },
  {
    id: 'legal_taxes',
    label: 'Tributário, Jurídico & Privacidade',
    icon: '⚖️',
    desc: 'Fator R, PGBL vs VGBL, Come-Cotas, Auditoria de Contratos e K-Anonimato',
  },
];

export function AppBuilderModal({
  visible,
  onClose,
  dashboardConfig,
  activeSectors,
  healthScore,
  healthLevel,
  isPrivacyMode,
  onUpdateDashboardConfig,
  onUpdateActiveSectors,
  onTogglePrivacyMode,
}: AppBuilderModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 680;

  const effectiveConfig = useMemo(
    () => resolveEffectiveDashboardConfig(dashboardConfig),
    [dashboardConfig]
  );

  const recommendedPreset = useMemo(
    () => getRecommendedPresetForHealth(healthLevel, healthScore),
    [healthLevel, healthScore]
  );

  const handleApplyPreset = (presetId: WorkspacePresetType) => {
    const def = WORKSPACE_PRESETS[presetId];
    if (!def) return;
    onUpdateDashboardConfig({
      preset: def.id,
      widgetOrder: [...def.widgetOrder],
      hiddenWidgets: [...def.hiddenWidgets],
      preferredViewMode: effectiveConfig.preferredViewMode,
    });
    onUpdateActiveSectors([...def.activeSectors]);
  };

  const handleToggleWidget = (widgetId: DashboardWidgetId) => {
    const isHidden = effectiveConfig.hiddenWidgets.includes(widgetId);
    const nextHidden = isHidden
      ? effectiveConfig.hiddenWidgets.filter((id) => id !== widgetId)
      : [...effectiveConfig.hiddenWidgets, widgetId];

    onUpdateDashboardConfig({
      ...effectiveConfig,
      preset: 'custom',
      hiddenWidgets: nextHidden,
    });
  };

  const handleMoveWidget = (widgetId: DashboardWidgetId, direction: 'up' | 'down') => {
    const order = [...effectiveConfig.widgetOrder];
    const idx = order.indexOf(widgetId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;

    const temp = order[idx];
    order[idx] = order[targetIdx];
    order[targetIdx] = temp;

    onUpdateDashboardConfig({
      ...effectiveConfig,
      preset: 'custom',
      widgetOrder: order,
    });
  };

  const handleToggleSector = (sectorId: string) => {
    const isActive = activeSectors.includes(sectorId);
    let nextSectors: string[];
    if (isActive) {
      nextSectors = activeSectors.filter((s) => s !== sectorId);
    } else {
      nextSectors = [...activeSectors, sectorId];
    }
    // Ensure core modules remain active
    const coreDefaults = ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'core_predictions'];
    for (const c of coreDefaults) {
      if (!nextSectors.includes(c)) nextSectors.push(c);
    }
    onUpdateActiveSectors(nextSectors);

    // If user activates an actuarial sector, also ensure 'sector_simulators' widget is visible on Hoje
    if (!isActive && effectiveConfig.hiddenWidgets.includes('sector_simulators')) {
      onUpdateDashboardConfig({
        ...effectiveConfig,
        hiddenWidgets: effectiveConfig.hiddenWidgets.filter((w) => w !== 'sector_simulators'),
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, isWide && styles.sheetWide]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🧩 Monte Seu Aplicativo</Text>
              <Text style={styles.subtitle}>
                Personalize blocos, setores e ergonomia de acordo com seu uso e Saúde Financeira (Score: {healthScore}/100)
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* 1. Recommended Banner by Financial Health */}
            <View style={styles.recommendationBanner}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.recBadge}>
                  🩺 RECOMENDADO PARA SEU SCORE ({healthScore} pts)
                </Text>
                <Text style={styles.recTitle}>
                  {recommendedPreset.icon} Modo {recommendedPreset.name}
                </Text>
                <Text style={styles.recDesc}>{recommendedPreset.description}</Text>
              </View>
              {effectiveConfig.preset !== recommendedPreset.id && (
                <Pressable
                  style={styles.applyRecBtn}
                  onPress={() => handleApplyPreset(recommendedPreset.id)}
                >
                  <Text style={styles.applyRecBtnText}>Ativar Agora</Text>
                </Pressable>
              )}
            </View>

            {/* 2. Journey Presets Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Escolha um Perfil de Jornada (1 Toque)</Text>
              <View style={styles.presetsGrid}>
                {(['survival', 'freelancer', 'investor', 'smb'] as WorkspacePresetType[]).map(
                  (presetKey) => {
                    const p = WORKSPACE_PRESETS[presetKey];
                    const isSelected = effectiveConfig.preset === p.id;
                    const isRec = recommendedPreset.id === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.presetCard,
                          isSelected && styles.presetCardActive,
                        ]}
                        onPress={() => handleApplyPreset(p.id)}
                      >
                        <View style={styles.presetCardTop}>
                          <Text style={styles.presetIcon}>{p.icon}</Text>
                          {isRec && (
                            <View style={styles.recPill}>
                              <Text style={styles.recPillText}>Ideal p/ Você</Text>
                            </View>
                          )}
                          {isSelected && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>✓ Ativo</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.presetName, isSelected && styles.presetNameActive]}>
                          {p.name}
                        </Text>
                        <Text style={styles.presetBadge}>{p.badge}</Text>
                        <Text style={styles.presetDesc} numberOfLines={3}>
                          {p.description}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>
            </View>

            {/* 3. Ergonomics: Street Mode vs Workstation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Ergonomia: Uso na Rua vs. No Computador</Text>
              <View style={styles.ergonomicsRow}>
                <Pressable
                  style={[styles.ergoCard, isPrivacyMode && styles.ergoCardActive]}
                  onPress={onTogglePrivacyMode}
                >
                  <Text style={styles.ergoIcon}>{isPrivacyMode ? '🙈' : '👁️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ergoTitle}>
                      Modo Rua / Privacidade: {isPrivacyMode ? 'ATIVADO' : 'DESATIVADO'}
                    </Text>
                    <Text style={styles.ergoSub}>
                      Oculta saldos e valores com máscara (R$ •••••) para usar em público com segurança.
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* 4. Active Actuarial Sectors */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Motores & Setores Especializados da Planilha</Text>
              <Text style={styles.sectionHint}>
                Ative os motores matemáticos que fazem sentido para sua realidade. Todos os dados são salvos no IndexedDB e no CSV.
              </Text>
              <View style={styles.listContainer}>
                {SECTOR_OPTIONS.map((sec) => {
                  const active = activeSectors.includes(sec.id);
                  return (
                    <Pressable
                      key={sec.id}
                      style={[styles.listRow, active && styles.listRowActive]}
                      onPress={() => handleToggleSector(sec.id)}
                    >
                      <Text style={styles.listRowIcon}>{sec.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listRowTitle}>{sec.label}</Text>
                        <Text style={styles.listRowSub}>{sec.desc}</Text>
                      </View>
                      <View style={[styles.switchBadge, active && styles.switchBadgeOn]}>
                        <Text style={[styles.switchBadgeText, active && styles.switchBadgeTextOn]}>
                          {active ? 'ATIVO' : 'OFF'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 5. Reorder & Toggle Home Widgets */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Blocos da Tela Inicial ("Hoje") — Ordem & Visibilidade</Text>
              <Text style={styles.sectionHint}>
                Use as setas ↑ ↓ para escolher a ordem dos cartões e clique em Visível/Oculto para montar sua tela.
              </Text>
              <View style={styles.listContainer}>
                {effectiveConfig.widgetOrder.map((widgetId, idx) => {
                  const meta = WIDGET_CATALOG.find((w) => w.id === widgetId);
                  if (!meta) return null;
                  const isVisible = !effectiveConfig.hiddenWidgets.includes(widgetId);
                  return (
                    <View
                      key={widgetId}
                      style={[styles.listRow, !isVisible && styles.listRowDimmed]}
                    >
                      <View style={styles.orderBtnsCol}>
                        <Pressable
                          style={[styles.orderBtn, idx === 0 && styles.orderBtnDisabled]}
                          onPress={() => handleMoveWidget(widgetId, 'up')}
                          disabled={idx === 0}
                        >
                          <Text style={styles.orderBtnText}>↑</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.orderBtn,
                            idx === effectiveConfig.widgetOrder.length - 1 && styles.orderBtnDisabled,
                          ]}
                          onPress={() => handleMoveWidget(widgetId, 'down')}
                          disabled={idx === effectiveConfig.widgetOrder.length - 1}
                        >
                          <Text style={styles.orderBtnText}>↓</Text>
                        </Pressable>
                      </View>

                      <Text style={styles.listRowIcon}>{meta.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listRowTitle}>
                          {idx + 1}. {meta.title}
                        </Text>
                        <Text style={styles.listRowSub}>{meta.subtitle}</Text>
                      </View>

                      <Pressable
                        style={[styles.switchBadge, isVisible && styles.switchBadgeOn]}
                        onPress={() => handleToggleWidget(widgetId)}
                      >
                        <Text style={[styles.switchBadgeText, isVisible && styles.switchBadgeTextOn]}>
                          {isVisible ? 'VISÍVEL' : 'OCULTO'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>✓ Concluir Personalização</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheet: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sheetWide: {
    alignSelf: 'center',
    width: 740,
    borderRadius: radius.xl,
    marginBottom: 24,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: spacing.md,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  recBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent.purple,
    letterSpacing: 0.5,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
  },
  recDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  applyRecBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  applyRecBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetCard: {
    flex: 1,
    minWidth: 210,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  presetCardActive: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  presetCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  presetIcon: {
    fontSize: 22,
  },
  recPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  recPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success.main,
  },
  activePill: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  presetName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  presetNameActive: {
    color: colors.accent.purple,
  },
  presetBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  presetDesc: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
    marginTop: 2,
  },
  ergonomicsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ergoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  ergoCardActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  ergoIcon: {
    fontSize: 24,
  },
  ergoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  ergoSub: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  listContainer: {
    gap: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listRowActive: {
    borderColor: colors.accent.purpleBorder,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
  },
  listRowDimmed: {
    opacity: 0.55,
  },
  listRowIcon: {
    fontSize: 18,
  },
  listRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  listRowSub: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  orderBtnsCol: {
    flexDirection: 'row',
    gap: 4,
  },
  orderBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnDisabled: {
    opacity: 0.3,
  },
  orderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.secondary,
  },
  switchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  switchBadgeOn: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  switchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.disabled,
  },
  switchBadgeTextOn: {
    color: colors.accent.purple,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  doneBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
