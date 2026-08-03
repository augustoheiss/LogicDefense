/**
 * PredictionPanel — Dual-Engine Scenario Builder + Management UI (React Native)
 *
 * Two generation engines:
 *   👯 Clonagem Exata   — copy-paste historical rows into future months (1:1)
 *   🧮 Previsão Estatística — generate synthetic rows from category averages
 *
 * Below the form: "Gestão de Cenários Sintéticos" — per-period management
 * with [✅ Tornar Real] and [🗑️ Apagar] actions, plus global clear.
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { TableRow } from '@/core/types';
import { useSubscription } from '@/hooks/useSubscription';
import { useCoinDB } from '@/hooks/useCoinDB';
import {
  generateClonedData,
  generateStatisticalData,
  countGeneratedRows,
  getGeneratedPeriods,
  type SourceMode,
  type CloneConfig,
} from '@/core/predictionEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PredictionPanelProps {
  rows: TableRow[];
  onBulkAdd: (rows: Omit<TableRow, 'id'>[]) => void;
  onDeleteGenerated: (prefix?: string) => number;
  onEffectuateGenerated: (prefix?: string) => number;
}

type SourceType = 'month' | 'year' | 'range' | 'lastN';
type EngineMode = 'clone' | 'statistical';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayYM(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

function availableYears(rows: TableRow[]): string[] {
  const years = new Set<string>();
  for (const r of rows) {
    if (!r.generatedBy) years.add(r.date.slice(0, 4));
  }
  return Array.from(years).sort().reverse();
}

function availableMonths(rows: TableRow[]): string[] {
  const months = new Set<string>();
  for (const r of rows) {
    if (!r.generatedBy) months.add(r.date.slice(0, 7));
  }
  return Array.from(months).sort().reverse();
}

function formatMonthShort(ym: string): string {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const shortMonths = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  const monthIdx = parseInt(m, 10) - 1;
  if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return ym;
  return `${shortMonths[monthIdx]} ${y}`;
}

export function PredictionPanel({
  rows,
  onBulkAdd,
  onDeleteGenerated,
  onEffectuateGenerated
}: PredictionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isPro, subscriptionType, setShowPaywall } = useSubscription();
  const db = useCoinDB();

  // Engine mode
  const [engineMode, setEngineMode] = useState<EngineMode>('clone');

  // Source config
  const [sourceType,       setSourceType]       = useState<SourceType>('month');
  const [sourceMonth,      setSourceMonth]      = useState('');
  const [sourceYear,       setSourceYear]       = useState('');
  const [sourceMonthKeys,  setSourceMonthKeys]  = useState<string[]>([]);
  const [sourceLastN,      setSourceLastN]      = useState(3);

  // Target config
  const [targetStart, setTargetStart] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);

  // Status
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Derived
  const years    = useMemo(() => availableYears(rows), [rows]);
  const months   = useMemo(() => availableMonths(rows), [rows]);
  const genCount = useMemo(() => countGeneratedRows(rows), [rows]);
  const generatedPeriods = useMemo(() => getGeneratedPeriods(rows), [rows]);

  // Generate 12 upcoming target months starting from the latest month in data
  const targetMonths = useMemo(() => {
    const baseYM = months[0] || todayYM();
    const [yStr, mStr] = baseYM.split('-');
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10);

    const list: string[] = [];
    for (let i = 1; i <= 12; i++) {
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      list.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    return list;
  }, [months]);

  // Initialize defaults on opening
  const handleOpen = () => {
    if (!isOpen) {
      if (!sourceMonth && months.length > 0) setSourceMonth(months[0]);
      if (!sourceYear && years.length > 0) setSourceYear(years[0]);
      if (!targetStart && targetMonths.length > 0) setTargetStart(targetMonths[0]);
    }
    setIsOpen(!isOpen);
  };

  const buildSource = (): SourceMode => {
    switch (sourceType) {
      case 'month': return { type: 'month', ym: sourceMonth };
      case 'year':  return { type: 'year',  year: sourceYear };
      case 'range': return { type: 'range', sourceMonthKeys };
      case 'lastN': return { type: 'lastN', months: sourceLastN };
    }
  };

  const handleGenerate = () => {
    if (!targetStart) {
      alertMsg('Erro', 'Por favor, selecione um mês de destino.');
      return;
    }
    if (sourceType === 'range' && sourceMonthKeys.length === 0) {
      alertMsg('Erro', 'Por favor, selecione ao menos um mês fonte.');
      return;
    }

    const config: CloneConfig = {
      source: buildSource(),
      targetStart,
      repeatCount,
    };

    const generated = engineMode === 'clone'
      ? generateClonedData(rows, config)
      : generateStatisticalData(rows, config);

    if (generated.length === 0) {
      setLastResult('⚠️ Nenhum dado encontrado no período selecionado.');
      return;
    }

    onBulkAdd(generated);

    const verb = engineMode === 'clone' ? 'clonados' : 'projetados';
    setLastResult(`✅ ${generated.length} registros ${verb} com sucesso!`);
  };

  const handleClearAll = () => {
    const performClear = () => {
      const count = onDeleteGenerated();
      setLastResult(`🗑️ ${count} registros de previsão removidos.`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Deseja apagar todas as ${genCount} previsões sintéticas?`)) {
        performClear();
      }
    } else {
      Alert.alert(
        'Apagar previsões',
        `Deseja apagar todas as ${genCount} previsões sintéticas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Apagar', style: 'destructive', onPress: performClear },
        ]
      );
    }
  };

  const handleDeletePeriod = (period: string) => {
    const performDelete = () => {
      const count = onDeleteGenerated(period);
      setLastResult(`🗑️ ${count} registros removidos de ${formatMonthShort(period)}.`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Apagar previsões de ${formatMonthShort(period)}?`)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Apagar período',
        `Apagar previsões de ${formatMonthShort(period)}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Apagar', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const handleEffectuatePeriod = (period: string) => {
    const performEffectuate = () => {
      const count = onEffectuateGenerated(period);
      setLastResult(`✅ ${count} registros de ${formatMonthShort(period)} tornados reais!`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Tornar os registros de ${formatMonthShort(period)} reais permanentemente?`)) {
        performEffectuate();
      }
    } else {
      Alert.alert(
        'Tornar Real',
        `Deseja tornar os registros de ${formatMonthShort(period)} reais permanentemente?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tornar Real', onPress: performEffectuate },
        ]
      );
    }
  };

  const alertMsg = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const toggleSourceMonthKey = (ym: string) => {
    setSourceMonthKeys((prev) =>
      prev.includes(ym) ? prev.filter((x) => x !== ym) : [...prev, ym]
    );
  };

  const sourceOptions = [
    { id: 'month' as const, label: 'Mês' },
    { id: 'year'  as const, label: 'Ano' },
    { id: 'range' as const, label: 'Múltiplo' },
    { id: 'lastN' as const, label: 'Últimos' },
  ];

  return (
    <View style={styles.outerContainer}>
      {/* Toggle button */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.toggleBtn,
          isOpen && styles.toggleBtnOpen,
          !isOpen && genCount > 0 && styles.toggleBtnActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.toggleBtnText, (isOpen || genCount > 0) && styles.toggleBtnTextOpen]}>
          🔮 Previsão (Cenário Builder)
        </Text>
        {genCount > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{genCount}</Text>
          </View>
        )}
      </Pressable>

      {/* Main Drawer Panel */}
      {isOpen && (
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🔮 Cenário Builder & Gestão</Text>
            {genCount > 0 && (
              <Text style={styles.headerSubtitle}>
                {genCount} registros sintéticos ativos
              </Text>
            )}
          </View>

          {/* Dual Engine Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setEngineMode('clone')}
              style={[styles.tabItem, engineMode === 'clone' && styles.tabItemActive]}
            >
              <Text style={[styles.tabLabel, engineMode === 'clone' && styles.tabLabelActive]}>
                👯 Clonar 1:1
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setEngineMode('statistical')}
              style={[styles.tabItem, engineMode === 'statistical' && styles.tabItemActive]}
            >
              <Text style={[styles.tabLabel, engineMode === 'statistical' && styles.tabLabelActive]}>
                🧮 Previsão Estatística
              </Text>
            </Pressable>
          </View>

          <Text style={styles.engineDesc}>
            {engineMode === 'clone'
              ? 'Copia cada lançamento do período de origem exatamente como está (valor e descrição), adaptando as datas para o destino.'
              : 'Gera lançamentos automáticos calculando médias e frequências por descrição no período fonte.'}
          </Text>

          {/* Section: Configuração do Cenário */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>⚙️ Configuração</Text>

            {/* Source Type Pills */}
            <View style={styles.controlGroup}>
              <Text style={styles.label}>Fonte de Dados</Text>
              <View style={styles.pillRow}>
                {sourceOptions.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setSourceType(opt.id)}
                    style={[styles.pill, sourceType === opt.id && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, sourceType === opt.id && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Source Selector UI */}
            <View style={styles.selectorWrapper}>
              {sourceType === 'month' && (
                <View style={styles.subControl}>
                  <Text style={styles.subLabel}>Selecione o mês de origem</Text>
                  {months.length === 0 ? (
                    <Text style={styles.emptyText}>Sem dados no histórico</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPills}>
                      {months.map((m) => (
                        <Pressable
                          key={m}
                          onPress={() => setSourceMonth(m)}
                          style={[styles.selectorPill, sourceMonth === m && styles.selectorPillActive]}
                        >
                          <Text style={[styles.selectorPillText, sourceMonth === m && styles.selectorPillTextActive]}>
                            {formatMonthShort(m)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {sourceType === 'year' && (
                <View style={styles.subControl}>
                  <Text style={styles.subLabel}>Selecione o ano de origem</Text>
                  {years.length === 0 ? (
                    <Text style={styles.emptyText}>Sem dados no histórico</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPills}>
                      {years.map((y) => (
                        <Pressable
                          key={y}
                          onPress={() => setSourceYear(y)}
                          style={[styles.selectorPill, sourceYear === y && styles.selectorPillActive]}
                        >
                          <Text style={[styles.selectorPillText, sourceYear === y && styles.selectorPillTextActive]}>
                            {y}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {sourceType === 'range' && (
                <View style={styles.subControl}>
                  <Text style={styles.subLabel}>Selecione múltiplos meses (Cherry-pick)</Text>
                  {months.length === 0 ? (
                    <Text style={styles.emptyText}>Sem dados no histórico</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPills}>
                      {months.map((m) => {
                        const isSelected = sourceMonthKeys.includes(m);
                        return (
                          <Pressable
                            key={m}
                            onPress={() => toggleSourceMonthKey(m)}
                            style={[styles.selectorPill, isSelected && styles.selectorPillActiveRange]}
                          >
                            <Text style={[styles.selectorPillText, isSelected && styles.selectorPillTextActiveRange]}>
                              {formatMonthShort(m)} {isSelected ? '✓' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              {sourceType === 'lastN' && (
                <View style={styles.counterRow}>
                  <Text style={styles.counterLabel}>Últimos N meses:</Text>
                  <View style={styles.counterControls}>
                    <Pressable
                      onPress={() => setSourceLastN(Math.max(1, sourceLastN - 1))}
                      style={styles.counterBtn}
                    >
                      <Text style={styles.counterBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.counterValue}>{sourceLastN}</Text>
                    <Pressable
                      onPress={() => setSourceLastN(Math.min(24, sourceLastN + 1))}
                      style={styles.counterBtn}
                    >
                      <Text style={styles.counterBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Target Settings */}
            <View style={styles.targetWrapper}>
              <View style={styles.targetCol}>
                <Text style={styles.label}>Mês Destino</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPills}>
                  {targetMonths.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setTargetStart(m)}
                      style={[styles.selectorPill, targetStart === m && styles.selectorPillActiveTarget]}
                    >
                      <Text style={[styles.selectorPillText, targetStart === m && styles.selectorPillTextActiveTarget]}>
                        {formatMonthShort(m)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.counterRow}>
                <Text style={styles.counterLabel}>Repetir por N meses:</Text>
                <View style={styles.counterControls}>
                  <Pressable
                    onPress={() => setRepeatCount(Math.max(1, repeatCount - 1))}
                    style={styles.counterBtn}
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </Pressable>
                  <Text style={styles.counterValue}>{repeatCount}</Text>
                  <Pressable
                    onPress={() => setRepeatCount(Math.min(12, repeatCount + 1))}
                    style={styles.counterBtn}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Summary Preview Panel */}
            <View style={styles.previewCard}>
              <Text style={styles.previewText} numberOfLines={1}>
                📋 Fonte:{' '}
                <Text style={styles.previewValue}>
                  {sourceType === 'month' && sourceMonth ? formatMonthShort(sourceMonth) : ''}
                  {sourceType === 'year' ? sourceYear : ''}
                  {sourceType === 'range'
                    ? sourceMonthKeys.length > 0
                      ? sourceMonthKeys.map(formatMonthShort).join(', ')
                      : 'Nenhum...'
                    : ''}
                  {sourceType === 'lastN' ? `${sourceLastN} meses` : ''}
                </Text>
              </Text>
              <Text style={styles.previewText} numberOfLines={1}>
                🎯 Destino:{' '}
                <Text style={styles.previewValue}>
                  {targetStart ? formatMonthShort(targetStart) : '...'} ({repeatCount}x)
                </Text>
              </Text>
            </View>

            {/* Run Button */}
            <Pressable
              onPress={handleGenerate}
              style={({ pressed }) => [
                styles.actionBtn,
                engineMode === 'clone' ? styles.actionBtnClone : styles.actionBtnStat,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.actionBtnText}>
                {engineMode === 'clone' ? '👯 Gerar Clonagem' : '🧮 Projetar Estatísticas'}
              </Text>
            </Pressable>

            {/* Result Alert box */}
            {lastResult && (
              <View style={[
                styles.alertBox,
                lastResult.startsWith('✅') ? styles.alertSuccess : lastResult.startsWith('🗑️') ? styles.alertDelete : styles.alertWarning
              ]}>
                <Text style={[
                  styles.alertText,
                  lastResult.startsWith('✅') ? styles.alertTextSuccess : lastResult.startsWith('🗑️') ? styles.alertTextDelete : styles.alertTextWarning
                ]}>
                  {lastResult}
                </Text>
              </View>
            )}
          </View>

          {/* Section: Synthetic Scenario Management */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📋 Gestão dos Cenários Sintéticos</Text>

            {generatedPeriods.length > 0 ? (
              <View style={styles.periodsWrapper}>
                <ScrollView style={styles.periodsScroll} nestedScrollEnabled>
                  {generatedPeriods.map((p) => (
                    <View key={p.period} style={styles.periodRow}>
                      <View style={styles.periodInfo}>
                        <Text style={styles.periodLabel}>{p.label}</Text>
                        <Text style={styles.periodCount}>({p.count} lançamentos)</Text>
                        <View style={styles.badgeRow}>
                          {p.hasCloned && <Text style={styles.typeBadge}>clone</Text>}
                          {p.hasPredicted && <Text style={styles.typeBadgeStat}>stat</Text>}
                        </View>
                      </View>
                      <View style={styles.periodActions}>
                        <Pressable
                          onPress={() => handleEffectuatePeriod(p.period)}
                          style={styles.effectuateBtn}
                        >
                          <Text style={styles.effectuateText}>Reais</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeletePeriod(p.period)}
                          style={styles.deletePeriodBtn}
                        >
                          <Text style={styles.deletePeriodText}>🗑️</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <Pressable
                  onPress={handleClearAll}
                  style={({ pressed }) => [styles.clearAllBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.clearAllBtnText}>
                    🗑️ Apagar Todas as Previsões ({genCount})
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyStateEmoji}>📭</Text>
                <Text style={styles.emptyStateTitle}>Nenhum cenário sintético ativo</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Configure a origem e destino acima para popular e testar simulações.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  toggleBtnActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  toggleBtnOpen: {
    backgroundColor: colors.accent.purple,
    borderColor: colors.accent.purple,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  toggleBtnTextOpen: {
    color: '#fff',
  },
  badgeContainer: {
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'monospace',
  },
  pressed: {
    opacity: 0.75,
  },

  panel: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 8px 30px rgba(168, 85, 247, 0.08)',
      }
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  headerSubtitle: {
    fontSize: 10,
    color: colors.text.tertiary,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  tabItemActive: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  tabLabelActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },

  engineDesc: {
    fontSize: 10,
    color: colors.text.tertiary,
    lineHeight: 14,
  },

  sectionCard: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  controlGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.background.secondary,
    padding: 2,
    borderRadius: radius.sm,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  pillActive: {
    backgroundColor: colors.accent.purpleLight,
  },
  pillText: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  pillTextActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },

  selectorWrapper: {
    minHeight: 45,
    justifyContent: 'center',
  },
  subControl: {
    gap: spacing.xs,
  },
  subLabel: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  horizontalPills: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  selectorPill: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  selectorPillActive: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purpleLight,
  },
  selectorPillActiveRange: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purple,
  },
  selectorPillActiveTarget: {
    borderColor: colors.warning.main,
    backgroundColor: colors.warning.light,
  },
  selectorPillText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  selectorPillTextActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },
  selectorPillTextActiveRange: {
    color: '#fff',
    fontWeight: '600',
  },
  selectorPillTextActiveTarget: {
    color: colors.warning.main,
    fontWeight: '600',
  },

  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterLabel: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  counterValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
    minWidth: 16,
    textAlign: 'center',
  },

  targetWrapper: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.md,
  },
  targetCol: {
    gap: spacing.xs,
  },

  previewCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 2,
  },
  previewText: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  previewValue: {
    color: colors.text.secondary,
    fontWeight: '500',
  },

  actionBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnClone: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  actionBtnStat: {
    backgroundColor: colors.info.light,
    borderColor: colors.info.border,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  alertBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  alertSuccess: {
    backgroundColor: colors.success.light,
    borderColor: colors.success.border,
  },
  alertWarning: {
    backgroundColor: colors.warning.light,
    borderColor: colors.warning.border,
  },
  alertDelete: {
    backgroundColor: colors.danger.light,
    borderColor: colors.danger.border,
  },
  alertText: {
    fontSize: 11,
    textAlign: 'center',
  },
  alertTextSuccess: { color: colors.success.main },
  alertTextWarning: { color: colors.warning.main },
  alertTextDelete: { color: colors.danger.main },

  periodsWrapper: {
    gap: spacing.sm,
  },
  periodsScroll: {
    maxHeight: 180,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  periodInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  periodLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  periodCount: {
    fontSize: 9,
    color: colors.text.disabled,
    fontFamily: 'monospace',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 2,
  },
  typeBadge: {
    fontSize: 8,
    color: colors.accent.purple,
    backgroundColor: colors.accent.purpleLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontWeight: '500',
  },
  typeBadgeStat: {
    fontSize: 8,
    color: colors.info.main,
    backgroundColor: colors.info.light,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontWeight: '500',
  },
  periodActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  effectuateBtn: {
    backgroundColor: colors.success.light,
    borderWidth: 1,
    borderColor: colors.success.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  effectuateText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.success.main,
  },
  deletePeriodBtn: {
    backgroundColor: colors.danger.light,
    borderWidth: 1,
    borderColor: colors.danger.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  deletePeriodText: {
    fontSize: 9,
  },
  clearAllBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: colors.danger.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  clearAllBtnText: {
    color: colors.danger.main,
    fontSize: 11,
    fontWeight: '600',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: 4,
  },
  emptyStateEmoji: {
    fontSize: 28,
  },
  emptyStateTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptyStateSubtitle: {
    fontSize: 9,
    color: colors.text.disabled,
    textAlign: 'center',
    maxWidth: 180,
  },
  emptyText: {
    fontSize: 11,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
});
