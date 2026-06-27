/**
 * Settings Tab — Assistente Moeda
 *
 * Account management, sync controls, app preferences, and GOALS ACCORDION.
 *
 * Goals section allows editing:
 *   - Weekly goals by year (dailyGoals multiplied by 7)
 *   - Annual costs by year
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/hooks/useAuth';
import { useCoinDB } from '@/hooks/useCoinDB';
import { clearDB } from '@/storage/asyncStorageAdapter';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { formatCurrencySmart } from '@/core/formatCurrency';
import type { TableGoals } from '@/core/types';

export default function SettingsScreen() {
  const router = useRouter();
  const auth = useAuthContext();
  const db = useCoinDB();

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Seus dados locais serão apagados. Deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await auth.logout();
            await clearDB();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Ajustes</Text>
        <Text style={styles.subtitle}>Conta, metas e preferências</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* ── Account Section ──────────────────────────────── */}
        <Section title="Conta">
          {auth.mode === 'authenticated' && auth.profile ? (
            <Card>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(auth.profile.displayName || auth.profile.email || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>
                    {auth.profile.displayName || 'Usuário'}
                  </Text>
                  <Text style={styles.profileEmail}>{auth.profile.email}</Text>
                  <Text style={styles.tierText}>
                    {auth.isPremium ? '⭐ Premium' : '🆓 Gratuito'}
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.guestTitle}>👤 Modo Visitante</Text>
              <Text style={styles.guestText}>
                Dados salvos apenas neste dispositivo.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                onPress={() => router.push('/(auth)/register')}
              >
                <Text style={styles.actionButtonText}>Criar Conta</Text>
              </Pressable>
            </Card>
          )}
        </Section>

        {/* ── Goals Accordion ─────────────────────────────── */}
        {db.activeTable && (
          <Section title="🎯 Metas Semanais">
            <GoalsAccordion
              goals={db.activeTable.goals}
              onUpdate={db.updateGoals}
            />
          </Section>
        )}

        {/* ── Table Management ────────────────────────────── */}
        <Section title="📋 Tabelas">
          <Card>
            {db.tables.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma tabela criada</Text>
            ) : (
              db.tables.map((t, i) => (
                <View key={t.id} style={styles.tableRow}>
                  <Pressable
                    style={[
                      styles.tableButton,
                      i === db.activeTableIndex && styles.tableButtonActive,
                    ]}
                    onPress={() => db.setActiveTableIndex(i)}
                  >
                    <Text
                      style={[
                        styles.tableName,
                        i === db.activeTableIndex && styles.tableNameActive,
                      ]}
                    >
                      {i === db.activeTableIndex ? '● ' : '○ '}
                      {t.name}
                    </Text>
                    <Text style={styles.tableRowCount}>{t.rows.length} entradas</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        </Section>

        {/* ── App Info ────────────────────────────────────── */}
        <Section title="Sobre">
          <Card>
            <Text style={styles.infoRow}>Versão: 1.0.0</Text>
            <Text style={styles.infoRow}>Plataforma: Expo SDK 56</Text>
            <Text style={styles.infoRow}>Motor: React Native 0.85</Text>
            <Text style={styles.infoRow}>Desenvolvido por: Logic Defense</Text>
          </Card>
        </Section>

        {/* ── Logout ─────────────────────────────────────── */}
        {auth.mode === 'authenticated' && (
          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </Pressable>
        )}

        <View style={{ height: spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section Component ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Goals Accordion ──────────────────────────────────────────────────────────

function GoalsAccordion({
  goals,
  onUpdate,
}: {
  goals: TableGoals;
  onUpdate: (goals: any) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  
  // Global States
  const [globalWeekly, setGlobalWeekly] = useState(goals.globalGoals ? String(goals.globalGoals.weeklyGoal) : '');

  // Yearly States
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newYearWeekly, setNewYearWeekly] = useState('');

  // Monthly States
  const [newMonth, setNewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [newMonthWeekly, setNewMonthWeekly] = useState('');

  // Weekly States (for YYYY-Www overrides)
  const [newWeek, setNewWeek] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  });
  const [newWeekWeekly, setNewWeekWeekly] = useState('');

  // ── Global Goals Handlers ──────────────────────────────────────────────────
  const handleSaveGlobal = () => {
    const val = parseFloat(globalWeekly.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      // Clear global goal
      onUpdate({
        ...goals,
        globalGoals: undefined,
      });
      setGlobalWeekly('');
      Alert.alert('Sucesso', 'Meta global removida. O sistema usará as metas anuais ou os padrões legados.');
      return;
    }

    const updatedGlobal = {
      weeklyGoal: val,
      dailyGoal: Math.round((val / 7) * 100) / 100,
      annualCost: val * 52,
    };

    onUpdate({
      ...goals,
      globalGoals: updatedGlobal,
    });
    Alert.alert('Sucesso', 'Meta global atualizada!');
  };

  // ── Yearly Overrides Handlers ──────────────────────────────────────────────
  const yearlyGoals = goals.yearlyGoals ?? {};
  const years = Object.keys(yearlyGoals).map(Number).sort((a, b) => b - a);

  const handleAddYearly = () => {
    const yearNum = parseInt(newYear, 10);
    const val = parseFloat(newYearWeekly.replace(',', '.'));
    if (!yearNum || isNaN(val) || val <= 0) {
      Alert.alert('Erro', 'Preencha o ano e valor da meta semanal.');
      return;
    }

    const updatedYearly = {
      ...yearlyGoals,
      [yearNum]: {
        weeklyGoal: val,
        dailyGoal: Math.round((val / 7) * 100) / 100,
        annualCost: val * 52,
      },
    };

    // Sync with legacy flat arrays for backward compatibility
    const updatedWeeklyGoals = { ...(goals.weeklyGoals ?? {}), [yearNum]: val };
    const updatedDailyGoals = { ...(goals.dailyGoals ?? {}), [yearNum]: Math.round((val / 7) * 100) / 100 };

    onUpdate({
      ...goals,
      yearlyGoals: updatedYearly,
      weeklyGoals: updatedWeeklyGoals,
      dailyGoals: updatedDailyGoals,
    });

    setNewYearWeekly('');
    Alert.alert('Sucesso', `Meta para o ano ${yearNum} adicionada!`);
  };

  const handleDeleteYearly = (year: number) => {
    const nextYearly = { ...yearlyGoals };
    delete nextYearly[year];

    const nextWeeklyGoals = { ...(goals.weeklyGoals ?? {}) };
    delete nextWeeklyGoals[year];

    const nextDailyGoals = { ...(goals.dailyGoals ?? {}) };
    delete nextDailyGoals[year];

    onUpdate({
      ...goals,
      yearlyGoals: nextYearly,
      weeklyGoals: nextWeeklyGoals,
      dailyGoals: nextDailyGoals,
    });
  };

  // ── Monthly Overrides Handlers ─────────────────────────────────────────────
  const monthlyGoals = goals.monthlyGoals ?? {};
  const months = Object.keys(monthlyGoals).sort().reverse();

  const handleAddMonthly = () => {
    if (!newMonth.match(/^\d{4}-\d{2}$/)) {
      Alert.alert('Erro', 'Insira o mês no formato AAAA-MM (Ex: 2026-06).');
      return;
    }
    const val = parseFloat(newMonthWeekly.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert('Erro', 'Insira um valor de meta válido.');
      return;
    }

    const updatedMonthly = {
      ...monthlyGoals,
      [newMonth]: {
        weeklyGoal: val,
        dailyGoal: Math.round((val / 7) * 100) / 100,
        annualCost: val * 52,
      },
    };

    onUpdate({
      ...goals,
      monthlyGoals: updatedMonthly,
    });

    setNewMonthWeekly('');
    Alert.alert('Sucesso', `Meta para o mês ${newMonth} adicionada!`);
  };

  const handleDeleteMonthly = (monthKey: string) => {
    const nextMonthly = { ...monthlyGoals };
    delete nextMonthly[monthKey];

    onUpdate({
      ...goals,
      monthlyGoals: nextMonthly,
    });
  };

  // ── Weekly Overrides Handlers ──────────────────────────────────────────────
  const weeklyOverrides = useMemo(() => {
    const list: { key: string; value: number }[] = [];
    if (!goals.weeklyGoals) return list;
    for (const key of Object.keys(goals.weeklyGoals)) {
      if (typeof key === 'string' && key.includes('-W')) {
        list.push({ key, value: goals.weeklyGoals[key] });
      }
    }
    return list.sort((a, b) => b.key.localeCompare(a.key));
  }, [goals.weeklyGoals]);

  const handleAddWeekly = () => {
    if (!newWeek.match(/^\d{4}-W\d{2}$/)) {
      Alert.alert('Erro', 'Insira a semana no formato AAAA-WSS (Ex: 2026-W26).');
      return;
    }
    const val = parseFloat(newWeekWeekly.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert('Erro', 'Insira um valor de meta válido.');
      return;
    }

    const updatedWeeklyGoals = {
      ...(goals.weeklyGoals ?? {}),
      [newWeek]: val,
    };

    onUpdate({
      ...goals,
      weeklyGoals: updatedWeeklyGoals,
    });

    setNewWeekWeekly('');
    Alert.alert('Sucesso', `Meta para a semana ${newWeek} adicionada!`);
  };

  const handleDeleteWeekly = (weekKey: string) => {
    const nextWeeklyGoals = { ...(goals.weeklyGoals ?? {}) };
    delete nextWeeklyGoals[weekKey];

    onUpdate({
      ...goals,
      weeklyGoals: nextWeeklyGoals,
    });
  };

  return (
    <Card>
      <Pressable
        style={styles.accordionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.accordionTitle}>
          {expanded ? '▼' : '▶'} Níveis de Metas
        </Text>
        <Text style={styles.accordionCount}>
          {weeklyOverrides.length} Sem. / {Object.keys(monthlyGoals).length} Mens. / {Object.keys(yearlyGoals).length} Anual
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.accordionBody}>
          
          {/* 1. WEEKLY GOALS OVERRIDES (Priority 1) */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>🚀 Sobrescrita por Semana</Text>
            <Text style={styles.sectionDesc}>Prioridade máxima. Substitui todas as metas para a semana específica (AAAA-WSS).</Text>
            
            {weeklyOverrides.map((item: { key: string; value: number }) => (
              <View key={item.key} style={styles.goalRow}>
                <Text style={[styles.goalYear, { width: 90 }]}>{item.key}</Text>
                <Text style={styles.goalValue}>
                  {formatCurrencySmart(item.value)} /sem
                </Text>
                <Pressable
                  onPress={() => handleDeleteWeekly(item.key)}
                  style={styles.goalDelete}
                >
                  <Text style={styles.goalDeleteText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add new weekly override */}
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 0.4 }]}
                value={newWeek}
                onChangeText={setNewWeek}
                placeholder="AAAA-WSS"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.goalInput, { flex: 0.6 }]}
                value={newWeekWeekly}
                onChangeText={setNewWeekWeekly}
                placeholder="Meta semanal (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalAddBtn, pressed && styles.pressed]}
                onPress={handleAddWeekly}
              >
                <Text style={styles.goalAddBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.subSectionDivider} />

          {/* 2. GLOBAL GOAL */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>🌍 Meta Global (Padrão)</Text>
            <Text style={styles.sectionDesc}>Usada como fallback geral na ausência de metas anuais ou mensais.</Text>
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 1 }]}
                value={globalWeekly}
                onChangeText={setGlobalWeekly}
                placeholder="Meta Semanal Global (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalSaveBtn, pressed && styles.pressed]}
                onPress={handleSaveGlobal}
              >
                <Text style={styles.goalAddBtnText}>Salvar</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.subSectionDivider} />

          {/* 3. YEARLY GOALS */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>📅 Sobrescrita por Ano</Text>
            <Text style={styles.sectionDesc}>Substitui a meta global para todo o ano selecionado.</Text>
            
            {years.map((yr) => (
              <View key={yr} style={styles.goalRow}>
                <Text style={styles.goalYear}>{yr}</Text>
                <Text style={styles.goalValue}>
                  {formatCurrencySmart(yearlyGoals[yr].weeklyGoal)} /sem
                </Text>
                <Pressable
                  onPress={() => handleDeleteYearly(yr)}
                  style={styles.goalDelete}
                >
                  <Text style={styles.goalDeleteText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add new yearly override */}
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 0.4 }]}
                value={newYear}
                onChangeText={setNewYear}
                placeholder="Ano"
                placeholderTextColor={colors.text.disabled}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.goalInput, { flex: 0.6 }]}
                value={newYearWeekly}
                onChangeText={setNewYearWeekly}
                placeholder="Meta semanal (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalAddBtn, pressed && styles.pressed]}
                onPress={handleAddYearly}
              >
                <Text style={styles.goalAddBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.subSectionDivider} />

          {/* 4. MONTHLY GOALS */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>🗓️ Sobrescrita por Mês</Text>
            <Text style={styles.sectionDesc}>Substitui a meta anual e global para o mês específico (AAAA-MM).</Text>
            
            {months.map((monthKey) => (
              <View key={monthKey} style={styles.goalRow}>
                <Text style={[styles.goalYear, { width: 75 }]}>{monthKey}</Text>
                <Text style={styles.goalValue}>
                  {formatCurrencySmart(monthlyGoals[monthKey].weeklyGoal)} /sem
                </Text>
                <Pressable
                  onPress={() => handleDeleteMonthly(monthKey)}
                  style={styles.goalDelete}
                >
                  <Text style={styles.goalDeleteText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add new monthly override */}
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 0.4 }]}
                value={newMonth}
                onChangeText={setNewMonth}
                placeholder="AAAA-MM"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.goalInput, { flex: 0.6 }]}
                value={newMonthWeekly}
                onChangeText={setNewMonthWeekly}
                placeholder="Meta semanal (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalAddBtn, pressed && styles.pressed]}
                onPress={handleAddMonthly}
              >
                <Text style={styles.goalAddBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

        </View>
      )}
    </Card>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  content: { flex: 1 },
  contentInner: {
    padding: spacing.lg,
    gap: spacing.xl,
  },

  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Profile
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent.purpleLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  profileEmail: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  tierText: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  guestText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  actionButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },

  // Tables
  tableRow: {
    marginBottom: spacing.xs,
  },
  tableButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableButtonActive: {
    backgroundColor: colors.accent.purpleLight,
  },
  tableName: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  tableNameActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },
  tableRowCount: {
    fontSize: 11,
    color: colors.text.disabled,
  },

  // Goals Accordion
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  accordionCount: {
    fontSize: 11,
    color: colors.text.disabled,
  },
  accordionBody: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  goalYear: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    width: 50,
  },
  goalValue: {
    fontSize: 14,
    color: colors.accent.purple,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginRight: spacing.md,
  },
  goalDelete: {
    padding: spacing.xs,
  },
  goalDeleteText: {
    color: colors.danger.main,
    fontSize: 14,
    fontWeight: '600',
  },
  addGoalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  goalInput: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text.primary,
    fontSize: 14,
  },
  goalAddBtn: {
    backgroundColor: colors.accent.purple,
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalAddBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Hierarchical Goals Manager styles
  goalSection: {
    gap: spacing.xs,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionDesc: {
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 15,
  },
  subSectionDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
  goalSaveBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoRow: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xxs,
  },

  // Logout
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.danger.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.danger.main,
    fontSize: 14,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.75,
  },
});
