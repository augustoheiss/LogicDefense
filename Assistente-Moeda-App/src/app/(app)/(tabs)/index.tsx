/**
 * Spreadsheet Tab (Home) — Assistente Moeda
 *
 * The main screen. Shows:
 *   1. Header with table name + "Add" button
 *   2. Monthly summary card (gross revenue, expenses, net)
 *   3. Horizontal month picker
 *   4. Scrollable list of SwipeableRowCards (edit/delete/duplicate)
 *   5. Empty state when no data
 *   6. AddRowModal bottom sheet
 *   7. EditRowModal for inline editing
 *   8. Floating Action Button → AI Chat + Export
 *
 * Connected to useCoinDB for live data.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  useWindowDimensions,
  TextInput,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '@/hooks/useCoinDB';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuthContext } from '@/hooks/useAuth';
import { SwipeableRowCard } from '@/components/ui/SwipeableRowCard';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { AddRowModal } from '@/components/ui/AddRowModal';
import {
  TableSwitcherModal,
  PreviewModal,
  PredictionPanel,
  BulkDeleteModal,
  PaywallModal,
  CSVTextImporterModal,
  SectorGuard,
  ErrorBoundary,
  SMBSectorWidget,
  RealEstateSectorWidget,
  VehiclesSectorWidget,
  LegalTaxesSectorWidget,
  PersonalFinanceSectorWidget,
} from '@/components/ui';
import { formatCurrencySmart } from '@/core/formatCurrency';
import { shareWhatsAppReport, shareCSV, sharePDFReport, buildWhatsAppReport, shareCSVText, buildCSV } from '@/services/exportService';
import { importCSVFlow, pickCSVFile, parseCSV } from '@/services/csvImportService';
import { parseCSVText } from '@/utils/csvEngine';
import { computeBaselineGoals } from '@/core/metricsEngine';
import type { TableRow } from '@/core/types';

export default function SpreadsheetScreen() {
  const router = useRouter();
  const db = useCoinDB();
  const auth = useAuthContext();
  const { isPro, showPaywall, setShowPaywall } = useSubscription();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [showFab, setShowFab] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showCSVStreamModal, setShowCSVStreamModal] = useState(false);
  const { width } = useWindowDimensions();

  // ── Preview Modal State ───────────────────────────────
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewMode, setPreviewMode] = useState<'whatsapp' | 'csv_export' | 'csv_import'>('whatsapp');
  const [previewText, setPreviewText] = useState('');

  // ── Month summary ──────────────────────────────────────
  const monthSummary = useMemo(() => {
    if (db.selectedMonth === 'all' || !db.metrics.byMonth[db.selectedMonth]) {
      return {
        gross: db.metrics.grossTotal,
        expenses: db.metrics.totalExpenses,
        net: db.metrics.netBalance,
        label: 'Total Geral',
      };
    }
    const m = db.metrics.byMonth[db.selectedMonth];
    return {
      gross: m.grossMonthly,
      expenses: m.expense ?? 0,
      net: m.grossMonthly - (m.expense ?? 0),
      label: formatMonthLabel(db.selectedMonth),
    };
  }, [db.selectedMonth, db.metrics]);

  // ── Table management ───────────────────────────────────
  const ensureTable = useCallback(() => {
    if (db.tables.length === 0) {
      db.addTable('Minha Planilha', 'Primeira tabela financeira');
    }
  }, [db]);

  const handleAddRow = useCallback((row: Omit<TableRow, 'id'>) => {
    ensureTable();
    db.addRow(row);
  }, [ensureTable, db]);

  const handleDeleteRow = useCallback((rowId: string) => {
    db.deleteRow(rowId);
  }, [db]);

  const handleDeleteLastRow = useCallback(() => {
    if (!db.activeTable || db.activeTable.rows.length === 0) return;

    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm('Deseja realmente apagar a última transação adicionada?');
      if (confirmDelete) {
        db.deleteLastRow();
      }
    } else {
      Alert.alert(
        'Apagar Última Transação',
        'Deseja realmente apagar a última transação adicionada?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Apagar',
            style: 'destructive',
            onPress: () => {
              db.deleteLastRow();
            },
          },
        ]
      );
    }
  }, [db]);

  const handleEditRow = useCallback((row: TableRow) => {
    setEditingRow(row);
    setShowAddModal(true);
  }, []);

  const handleDuplicate = useCallback((row: TableRow) => {
    const { id, ...rest } = row;
    db.addRow({
      ...rest,
      description: `${rest.description || ''} (cópia)`.trim(),
      generatedBy: undefined,
      clonedFrom: undefined,
    });
  }, [db]);

  // ── Export handlers ────────────────────────────────────
  const handleExportWhatsApp = useCallback(() => {
    if (!db.activeTable) return;
    const reportMonth = db.selectedMonth === 'all'
      ? (db.availableMonths[0] ?? new Date().toISOString().slice(0, 7))
      : db.selectedMonth;
    const report = buildWhatsAppReport(
      db.activeTable.name,
      db.metrics,
      db.activeTable.goals,
      reportMonth,
      db.activeTable.rows
    );
    setPreviewText(report);
    setPreviewMode('whatsapp');
    setPreviewVisible(true);
    setShowFab(false);
  }, [db]);

  const handleExportCSV = useCallback(() => {
    if (!db.activeTable) return;
    const csv = buildCSV(
      db.activeTable.rows,
      db.activeTable.name,
      db.activeTable.description,
      db.activeTable.goals,
      db.activeTable.id
    );
    setPreviewText(csv);
    setPreviewMode('csv_export');
    setPreviewVisible(true);
    setShowFab(false);
  }, [db]);

  const handleExportPDF = useCallback(() => {
    if (!db.activeTable) return;
    sharePDFReport(
      db.activeTable.name,
      db.activeTable.rows,
      db.metrics,
      db.activeTable.goals,
      db.selectedMonth,
      db.availableMonths
    );
    setShowFab(false);
  }, [db]);

  // ── Import handlers ────────────────────────────────────
  const triggerFileImport = useCallback(async () => {
    try {
      const content = await pickCSVFile();
      if (!content) return;

      setPreviewText(content);
      setPreviewMode('csv_import');
      setPreviewVisible(true);
    } catch (err: any) {
      Alert.alert('Erro ao selecionar arquivo', err.message || 'Erro desconhecido');
    }
  }, []);

  const handleImportCSV = useCallback(() => {
    setShowFab(false);
    ensureTable();

    if (Platform.OS === 'web') {
      const choice = window.confirm(
        "Deseja escolher um arquivo de backup CSV (OK) ou colar um Bloco CSV de IA / Texto manualmente (Cancelar)?"
      );
      if (choice) {
        triggerFileImport();
      } else {
        setShowCSVStreamModal(true);
      }
    } else {
      Alert.alert(
        'Importar Dados',
        'Como você deseja importar seus dados?',
        [
          {
            text: '📁 Arquivo de Backup CSV',
            onPress: triggerFileImport,
          },
          {
            text: '📥 Importar Bloco CSV de IA',
            onPress: () => {
              setShowCSVStreamModal(true);
            },
          },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    }
  }, [ensureTable, triggerFileImport]);

  const handlePreviewConfirm = useCallback(async (editedText: string) => {
    setPreviewVisible(false);

    if (previewMode === 'whatsapp') {
      try {
        await Share.share({
          message: editedText,
          title: `Relatório — ${db.activeTable?.name}`,
        });
      } catch {
        Alert.alert('Erro', 'Não foi possível compartilhar o relatório.');
      }
    } else if (previewMode === 'csv_export') {
      if (!db.activeTable) return;
      await shareCSVText(editedText, db.activeTable.name);
    } else if (previewMode === 'csv_import') {
      try {
        const result = parseCSVText(editedText);

        if (result.rows.length === 0) {
          const errMsg = result.errors.length > 0
            ? result.errors.slice(0, 3).join('\n')
            : 'Nenhuma entrada válida encontrada no texto.';
          Alert.alert('Importação falhou', errMsg);
          return;
        }

        const executeCommit = async (mode: 'merge' | 'replace') => {
          try {
            await db.importSpreadsheet({
              rows: result.rows,
              name: result.metadata?.name,
              description: result.metadata?.description,
              goals: result.metadata?.tableGoals,
              mode,
            });

            // Auto-activate detected sectors
            const currentActiveSectors = db.activeTable?.activeSectors || ['personal_finance'];
            const sectorsToActivate = result.detectedSectors.filter(
              (sec) => !currentActiveSectors.includes(sec)
            );

            if (sectorsToActivate.length > 0) {
              const nextSectors = Array.from(new Set([...currentActiveSectors, ...sectorsToActivate]));
              await db.updateActiveSectors(nextSectors);
            }

            setTimeout(() => {
              const activeTableName = result.metadata?.name || db.activeTable?.name || 'Ativa';
              const successTitle = 'Importação Concluída! 🎉';
              const modeLabel = mode === 'merge' ? 'acumuladas' : 'carregadas (substituição)';
              const successMsg = `Sucesso! ${result.rows.length} transações foram ${modeLabel} na planilha "${activeTableName}".`;

              if (Platform.OS === 'web') {
                window.alert(`${successTitle}\n\n${successMsg}`);
              } else {
                Alert.alert(successTitle, successMsg);
              }
            }, 100);
          } catch (commitErr: any) {
            Alert.alert('Erro na importação', commitErr.message || 'Erro desconhecido');
          }
        };

        if (Platform.OS === 'web') {
          const isMerge = window.confirm(
            `Deseja ACUMULAR (${result.rows.length} transações) na planilha atual "${db.activeTable?.name || 'Ativa'}"? (Clique OK para Acumular, ou Cancelar para Substituir completamente)`
          );
          await executeCommit(isMerge ? 'merge' : 'replace');
        } else {
          Alert.alert(
            'Modo de Importação',
            `Como você deseja importar as ${result.rows.length} transações na planilha "${db.activeTable?.name || 'Ativa'}"?`,
            [
              { text: '➕ Acumular Entradas', onPress: () => executeCommit('merge') },
              { text: '🔄 Substituir Planilha', onPress: () => executeCommit('replace') },
              { text: 'Cancelar', style: 'cancel' },
            ]
          );
        }
      } catch (err: any) {
        Alert.alert('Erro na importação', err.message || 'Erro desconhecido');
      }
    }
  }, [previewMode, db]);

  const handleBulkDeleteConfirm = useCallback((prefix: string) => {
    setShowBulkDelete(false);
    const deletedCount = db.deleteRowsByPrefix(prefix);
    if (Platform.OS === 'web') {
      window.alert(`Sucesso: ${deletedCount} lançamentos foram excluídos.`);
    } else {
      Alert.alert('Sucesso', `${deletedCount} lançamentos foram excluídos.`);
    }
  }, [db]);

  const renderHeader = useCallback(() => {
    return (
      <View>
        {db.activeTable && (
          <PredictionPanel
            rows={db.activeTable.rows}
            onBulkAdd={db.addRows}
            onDeleteGenerated={db.deleteGeneratedRows}
            onEffectuateGenerated={db.effectuateGeneratedRows}
          />
        )}

        {/* Core & Personal Finance Widgets */}
        {db.filteredRows.length > 0 && (
          <View style={[styles.summaryCard, { marginHorizontal: spacing.lg, marginTop: spacing.md }]}>
            <Text style={styles.summaryLabel}>{monthSummary.label}</Text>
            <View style={styles.summaryRow}>
              <SectorGuard sector="core_revenue">
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Receita</Text>
                  <Text style={[styles.summaryItemValue, { color: colors.success.main }]}>
                    {formatCurrencySmart(monthSummary.gross)}
                  </Text>
                </View>
              </SectorGuard>
              <SectorGuard sector="core_costs">
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Despesas</Text>
                  <Text style={[styles.summaryItemValue, { color: colors.danger.main }]}>
                    {formatCurrencySmart(monthSummary.expenses)}
                  </Text>
                </View>
              </SectorGuard>
              <SectorGuard sector="core_cashflow">
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Saldo</Text>
                  <Text
                    style={[
                      styles.summaryItemValue,
                      { color: monthSummary.net >= 0 ? colors.success.main : colors.danger.main },
                    ]}
                  >
                    {formatCurrencySmart(monthSummary.net)}
                  </Text>
                </View>
              </SectorGuard>
            </View>
          </View>
        )}

        {/* Month Picker */}
        {db.availableMonths.length > 0 && (
          <MonthPicker
            months={db.availableMonths}
            selected={db.selectedMonth}
            onSelect={db.setSelectedMonth}
          />
        )}
      </View>
    );
  }, [
    db.activeTable,
    db.filteredRows,
    db.availableMonths,
    db.selectedMonth,
    db.setSelectedMonth,
    monthSummary,
  ]);

  const safeFilteredRows = useMemo(() => {
    if (!Array.isArray(db.filteredRows)) return [];
    return db.filteredRows.filter((r): r is TableRow => !!r && typeof r === 'object' && !!r.id);
  }, [db.filteredRows]);

  return (
    <ErrorBoundary fallbackTitle="Falha na Visualização da Planilha" componentName="SpreadsheetScreen">
      <SafeAreaView style={styles.container} edges={[]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              📋 {db.activeTable?.name || 'Planilha'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {safeFilteredRows.length} {safeFilteredRows.length === 1 ? 'entrada' : 'entradas'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.undoButton,
                pressed && styles.pressed,
                (!db.activeTable || db.activeTable.rows.length === 0) && styles.disabledButton,
              ]}
              onPress={handleDeleteLastRow}
              disabled={!db.activeTable || db.activeTable.rows.length === 0}
            >
              <Text style={styles.undoButtonText}>↩ Desfazer</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                ensureTable();
                setEditingRow(null);
                setShowAddModal(true);
              }}
            >
              <Text style={styles.addButtonText}>+ Novo</Text>
            </Pressable>
          </View>
        </View>

        {/* Row List */}
        <FlatList
          data={safeFilteredRows}
          keyExtractor={(item, index) => item?.id || `row_${index}`}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <SwipeableRowCard
            row={item}
            onEdit={handleEditRow}
            onDelete={handleDeleteRow}
            onDuplicate={handleDuplicate}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          db.filteredRows.length === 0 && styles.emptyList,
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🪙</Text>
            <Text style={styles.emptyTitle}>Nenhuma entrada ainda</Text>
            <Text style={styles.emptyText}>
              Toque em "+ Novo" para adicionar sua primeira receita ou despesa.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                ensureTable();
                setShowAddModal(true);
              }}
            >
              <Text style={styles.emptyButtonText}>+ Adicionar Entrada</Text>
            </Pressable>
          </View>
        }
      />

      {/* FAB — Floating Action Button */}
      <View style={styles.fabContainer}>
        {showFab && (
          <View style={styles.fabMenu}>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.accent.purpleBorder }]}
              onPress={() => {
                setShowFab(false);
                if (!isPro) {
                  if (Platform.OS === 'web') {
                    const goToSettings = window.confirm(
                      '🔒 Licença PRO Necessária\n\n' +
                      'O Assistente de IA financeiro exige uma Chave de Licença PRO ativa.\n\n' +
                      'Deseja ir para as Configurações para ativar sua chave de licença ou ver os planos?'
                    );
                    if (goToSettings) {
                      router.push('/(app)/(tabs)/settings');
                    }
                  } else {
                    Alert.alert(
                      '🔒 Licença PRO Necessária',
                      'O Assistente de IA financeiro exige uma Chave de Licença PRO ativa. Ative sua chave nas Configurações.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Ativar Licença', onPress: () => router.push('/(app)/(tabs)/settings') },
                        { text: 'Ver Planos', onPress: () => setShowPaywall(true) }
                      ]
                    );
                  }
                } else {
                  router.push('/(app)/chat');
                }
              }}
            >
              <Text style={styles.fabMenuIcon}>🤖</Text>
              <Text style={styles.fabMenuLabel}>Chat IA</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.success.border }]}
              onPress={handleExportWhatsApp}
            >
              <Text style={styles.fabMenuIcon}>📱</Text>
              <Text style={styles.fabMenuLabel}>WhatsApp</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.danger.border }]}
              onPress={handleExportPDF}
            >
              <Text style={styles.fabMenuIcon}>📕</Text>
              <Text style={styles.fabMenuLabel}>Exportar PDF</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.info.border }]}
              onPress={handleExportCSV}
            >
              <Text style={styles.fabMenuIcon}>📄</Text>
              <Text style={styles.fabMenuLabel}>Exportar CSV</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.warning.border }]}
              onPress={handleImportCSV}
            >
              <Text style={styles.fabMenuIcon}>📥</Text>
              <Text style={styles.fabMenuLabel}>Importar CSV</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.danger.border }]}
              onPress={() => {
                setShowFab(false);
                setShowBulkDelete(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>🗑️</Text>
              <Text style={styles.fabMenuLabel}>Apagar Lote</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
            showFab && styles.fabActive,
          ]}
          onPress={() => setShowFab(!showFab)}
        >
          <Text style={styles.fabIcon}>{showFab ? '✕' : '⚡'}</Text>
        </Pressable>
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
            db.updateRow(editingRow.id, rowOrRows as Omit<TableRow, 'id'>);
          } else {
            if (Array.isArray(rowOrRows)) {
              db.addRows(rowOrRows);
            } else {
              handleAddRow(rowOrRows);
            }
          }
          setEditingRow(null);
        }}
        editingRow={editingRow}
        onDelete={(rowId) => {
          db.deleteRow(rowId);
        }}
        onClone={(row) => {
          const cloned: Omit<TableRow, 'id'> = {
            date: row.date,
            value: row.value,
            description: row.description ? `${row.description} (CÓPIA)` : undefined,
            entryType: row.entryType,
            monthlyValue: row.monthlyValue,
            monthCount: row.monthCount,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            generatedBy: row.generatedBy,
            clonedFrom: row.clonedFrom,
          };
          db.addRows([cloned]);
        }}
      />

      {/* Preview Modal for WhatsApp and CSV */}
      <PreviewModal
        visible={previewVisible}
        mode={previewMode}
        initialText={previewText}
        onClose={() => setPreviewVisible(false)}
        onConfirm={handlePreviewConfirm}
      />

      {/* Bulk Delete Modal */}
      {db.activeTable && (
        <BulkDeleteModal
          visible={showBulkDelete}
          onClose={() => setShowBulkDelete(false)}
          onConfirm={handleBulkDeleteConfirm}
          rows={db.activeTable.rows}
        />
      )}

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />

      {/* CSV Text Stream Importer Modal */}
      <CSVTextImporterModal
        visible={showCSVStreamModal}
        onClose={() => setShowCSVStreamModal(false)}
        onSuccess={(summary) => {
          setShowCSVStreamModal(false);
          if (Platform.OS === 'web') {
            window.alert(summary);
          } else {
            Alert.alert('Importação Bem-Sucedida', summary);
          }
        }}
      />
    </SafeAreaView>
    </ErrorBoundary>
  );
}

function formatMonthLabel(ym?: string | null): string {
  if (!ym || ym === 'all' || typeof ym !== 'string') return 'Todos';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const [y, m] = parts;
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx >= 12 || isNaN(idx)) return ym;
  return `${months[idx]} ${y}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerTitleContainer: {
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.accent.purple,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  undoButton: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  undoButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },

  // Summary Card
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: 1080,
    width: '100%',
    alignSelf: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  summaryItemValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.default,
  },

  // List
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100, // Extra space for FAB
    maxWidth: 1080,
    width: '100%',
    alignSelf: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyButton: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg + 10,
    alignItems: 'flex-end',
    gap: spacing.sm,
    zIndex: 9999,
  },
  fabMenu: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  fabMenuIcon: {
    fontSize: 16,
  },
  fabMenuLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.accent.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabPressed: {
    backgroundColor: colors.accent.purpleHover,
  },
  fabActive: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  fabIcon: {
    fontSize: 22,
    color: '#fff',
  },
  timeMachineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeMachineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  timeMachineEmoji: {
    fontSize: 20,
  },
  timeMachineControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeMachineLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeMachineInputNative: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 12,
    color: colors.text.primary,
    width: 125,
  },
  timeMachineReset: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timeMachineResetText: {
    fontSize: 11,
    color: colors.accent.purple,
    fontWeight: '600',
  },
  timeMachineWarning: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  timeMachineWarningText: {
    fontSize: 11,
    color: '#22d3ee',
    fontWeight: '500',
  },
});
