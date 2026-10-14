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

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  ChoiceDialog,
  ColumnMappingWorkbenchModal,
  SMBSectorWidget,
  RealEstateSectorWidget,
  VehiclesSectorWidget,
  LegalTaxesSectorWidget,
  PersonalFinanceSectorWidget,
  CSVStagingReviewModal,
  GranularExportModal,
  SpreadsheetDataGrid,
  ExampleCSVGalleryModal,
} from '@/components/ui';
import { formatCurrencySmart } from '@/core/formatCurrency';
import { shareWhatsAppReport, shareCSV, sharePDFReport, buildWhatsAppReport, shareCSVText, buildCSV } from '@/services/exportService';
import { importCSVFlow, pickCSVFile, parseCSV } from '@/services/csvImportService';
import { parseCSVText } from '@/utils/csvEngine';
import { computeBaselineGoals } from '@/core/metricsEngine';
import { inferTableSchema } from '@/core/typeInferenceEngine';
import { getUIViewModeSync, setUIViewModeSync } from '@/storage/asyncStorageAdapter';
import { useWebKeyboardShortcuts } from '@/hooks/useWebKeyboardShortcuts';
import type { TableRow, DynamicTableSchema } from '@/core/types';

export default function TransactionsScreen() {
  const router = useRouter();
  const db = useCoinDB();
  const auth = useAuthContext();
  const { isPro, showPaywall, setShowPaywall } = useSubscription();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [showFab, setShowFab] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showCSVStreamModal, setShowCSVStreamModal] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [prefillImporterCsv, setPrefillImporterCsv] = useState<string | undefined>(undefined);
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [showGranularExportModal, setShowGranularExportModal] = useState(false);
  const [showStagingModal, setShowStagingModal] = useState(false);
  const [stagingRows, setStagingRows] = useState<TableRow[]>([]);
  const [isAmbiguousImport, setIsAmbiguousImport] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // ── Search & View Mode States ──────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>(() =>
    getUIViewModeSync(width >= 1024 ? 'grid' : 'cards')
  );
  const [hasUserChosenViewMode, setHasUserChosenViewMode] = useState(false);

  useEffect(() => {
    if (!hasUserChosenViewMode) {
      setViewMode(getUIViewModeSync(isDesktop ? 'grid' : 'cards'));
    }
  }, [isDesktop, hasUserChosenViewMode]);

  const handleSelectViewMode = useCallback((mode: 'cards' | 'grid') => {
    setHasUserChosenViewMode(true);
    setViewMode(mode);
    setUIViewModeSync(mode);
  }, []);

  // ── Preview & Import Choice States ────────────────────
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewMode, setPreviewMode] = useState<'whatsapp' | 'csv_export' | 'csv_import'>('whatsapp');
  const [previewText, setPreviewText] = useState('');
  const [pendingImportResult, setPendingImportResult] = useState<any | null>(null);
  const [showImportChoice, setShowImportChoice] = useState(false);

  // ── Month summary (with prorated monthlyValue support) ──
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
    // Compute prorated monthly expenses when rows have monthlyValue + monthCount > 1
    const monthRows = (db.activeTable?.rows || []).filter(
      (r) => r && typeof r.date === 'string' && r.date.startsWith(db.selectedMonth)
    );
    let proratedExpenses = 0;
    for (const r of monthRows) {
      if (r.entryType === 'expense') {
        const val =
          r.monthlyValue && r.monthCount && r.monthCount > 1
            ? Math.abs(r.monthlyValue)
            : Math.abs(r.value || 0);
        proratedExpenses += val;
      }
    }
    const expensesToUse = monthRows.length > 0 ? Math.round(proratedExpenses * 100) / 100 : (m.expense ?? 0);
    return {
      gross: m.grossMonthly,
      expenses: expensesToUse,
      net: Math.round((m.grossMonthly - expensesToUse) * 100) / 100,
      label: formatMonthLabel(db.selectedMonth),
    };
  }, [db.selectedMonth, db.metrics, db.activeTable?.rows]);

  // ── Running Balance Map (chronological cumulative balance) ──
  const runningBalanceMap = useMemo<Record<string, number>>(() => {
    const allRows = [...(db.activeTable?.rows || [])].filter(
      (r): r is TableRow => !!r && typeof r === 'object' && !!r.id
    );
    allRows.sort((a, b) => {
      const dCmp = (a.date || '').localeCompare(b.date || '');
      if (dCmp !== 0) return dCmp;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    const map: Record<string, number> = {};
    let acc = 0;
    for (const r of allRows) {
      const mag = Math.abs(r.value || 0);
      if (r.entryType === 'revenue' || r.entryType === 'partner_in') {
        acc += mag;
      } else if (r.entryType === 'expense' || r.entryType === 'partner_out') {
        acc -= mag;
      }
      map[r.id] = Math.round(acc * 100) / 100;
    }
    return map;
  }, [db.activeTable?.rows]);

  // ── Table management ───────────────────────────────────
  const ensureTable = useCallback(() => {
    if (db.tables.length === 0) {
      db.addTable('Minha Planilha', 'Primeira tabela financeira');
    }
  }, [db]);

  useWebKeyboardShortcuts({
    onQuickAdd: () => {
      ensureTable();
      setEditingRow(null);
      setShowAddModal(true);
    },
    onFocusSearch: () => {
      searchInputRef.current?.focus();
    },
  });

  const handleAddRow = useCallback((row: Omit<TableRow, 'id'>) => {
    ensureTable();
    db.addRow(row);
  }, [ensureTable, db]);

  const handleUpdateRow = useCallback((rowId: string, updates: Partial<TableRow>) => {
    db.updateRow(rowId, updates);
  }, [db]);

  const handleResolveQuarantine = useCallback((rowId: string, resolvedType: TableRow['entryType']) => {
    db.updateRow(rowId, { entryType: resolvedType });
  }, [db]);

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
      db.activeTable.id,
      undefined,
      undefined,
      db.activeTable.schema,
      db.activeTable.investorProfile,
      db.activeTable.activeSectors,
      db.activeTable.dashboardConfig,
      db.activeTable.sectorParams
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

  // ── Dynamic Schema & Workbench Handlers ─────────────────
  const currentOrInferredSchema = useMemo<DynamicTableSchema>(() => {
    if (db.activeTable?.schema) {
      return db.activeTable.schema;
    }
    const sampleRows = (db.activeTable?.rows || []).slice(0, 10).map((r) => ({
      data: r.date,
      valor: String(r.value),
      descricao: r.description || '',
      tipo: r.entryType || 'revenue',
      categoria: r.category || 'Geral',
      ...(r.ticker ? { ticker: r.ticker } : {}),
      ...(r.quantity ? { quantidade: String(r.quantity) } : {}),
      ...(r.unitPrice ? { preco_unitario: String(r.unitPrice) } : {}),
      ...(r.customValues || {}),
    }));
    const headers = ['data', 'valor', 'descricao', 'tipo', 'categoria'];
    if (db.activeTable?.rows?.some((r) => r.ticker)) headers.push('ticker');
    if (db.activeTable?.rows?.some((r) => r.quantity)) headers.push('quantidade');
    if (db.activeTable?.rows?.some((r) => r.unitPrice)) headers.push('preco_unitario');
    const customKeySet = new Set<string>();
    for (const r of (db.activeTable?.rows || []).slice(0, 25)) {
      if (r.customValues) {
        for (const k of Object.keys(r.customValues)) {
          if (!headers.includes(k)) customKeySet.add(k);
        }
      }
    }
    headers.push(...Array.from(customKeySet));
    return inferTableSchema(headers, sampleRows, db.activeTable?.id || 'default');
  }, [db.activeTable?.schema, db.activeTable?.rows, db.activeTable?.id]);

  const workbenchSampleData = useMemo(() => {
    return (db.activeTable?.rows || []).slice(0, 5).map((r) => ({
      data: r.date,
      valor: String(r.value),
      descricao: r.description || '',
      tipo: r.entryType || 'revenue',
      categoria: r.category || 'Geral',
      ...(r.ticker ? { ticker: r.ticker } : {}),
      ...(r.quantity ? { quantidade: String(r.quantity) } : {}),
      ...(r.unitPrice ? { preco_unitario: String(r.unitPrice) } : {}),
      ...(r.customValues || {}),
    }));
  }, [db.activeTable?.rows]);

  const handleSaveWorkbenchSchema = useCallback(async (updatedSchema: DynamicTableSchema) => {
    await db.updateTableSchema(updatedSchema);

    // Re-evaluate existing rows if a custom column was newly mapped to a semantic role
    const rows = db.activeTable?.rows || [];
    const roleCols = updatedSchema.columns.filter((c) => c.role && c.role !== 'custom');
    if (roleCols.length > 0 && rows.length > 0) {
      for (const row of rows) {
        if (!row.customValues) continue;
        const patch: Partial<TableRow> = {};
        let changed = false;
        for (const col of roleCols) {
          const rawVal = row.customValues[col.id];
          if (rawVal === undefined || rawVal === null || rawVal === '') continue;
          const strVal = String(rawVal).trim();
          if (col.role === 'category' && (!row.category || row.category === 'Geral')) {
            patch.category = strVal;
            changed = true;
          } else if (col.role === 'description' && !row.description) {
            patch.description = strVal;
            changed = true;
          } else if (col.role === 'entryType' && row.entryType === 'unresolved') {
            const lower = strVal.toLowerCase();
            if (lower.includes('desp') || lower.includes('gast') || lower.includes('cust') || lower === 'expense') {
              patch.entryType = 'expense';
              changed = true;
            } else if (lower.includes('rec') || lower.includes('rend') || lower === 'revenue') {
              patch.entryType = 'revenue';
              changed = true;
            } else if (lower.includes('dep') || lower.includes('aport') || lower === 'deposit') {
              patch.entryType = 'deposit';
              changed = true;
            }
          }
        }
        if (changed) {
          db.updateRow(row.id, patch);
        }
      }
    }

    setShowWorkbench(false);
    if (Platform.OS === 'web') {
      window.alert('Estrutura e tipos de colunas atualizados com sucesso e salvos no navegador!');
    } else {
      Alert.alert('Sucesso', 'Estrutura e tipos de colunas atualizados com sucesso!');
    }
  }, [db]);

  // ── Import handlers ────────────────────────────────────
  const triggerFileImport = useCallback(async () => {
    try {
      const content = await pickCSVFile();
      if (!content || !content.trim()) return;

      const result = parseCSVText(content);

      if (result.rows.length === 0) {
        const errMsg = result.errors.length > 0
          ? result.errors.slice(0, 3).join('\n')
          : 'Nenhuma entrada válida encontrada no arquivo CSV.';
        Alert.alert('Importação falhou', errMsg);
        return;
      }

      const hasUnresolved = result.rows.some((r) => r.entryType === 'unresolved');
      if (result.isAmbiguous || hasUnresolved) {
        const preparedRows: TableRow[] = result.rows.map((r, idx) => ({
          ...r,
          id: (r as TableRow).id || `import-${Date.now()}-${idx}`,
        }));
        setPendingImportResult({ ...result, rows: preparedRows });
        setStagingRows(preparedRows);
        setIsAmbiguousImport(Boolean(result.isAmbiguous));
        setShowStagingModal(true);
      } else {
        setPendingImportResult(result);
        setShowImportChoice(true);
      }
    } catch (err: any) {
      Alert.alert('Erro ao selecionar arquivo', err.message || 'Erro desconhecido');
    }
  }, []);

  const handleImportCSV = useCallback(() => {
    setShowFab(false);
    ensureTable();

    if (Platform.OS === 'web') {
      triggerFileImport();
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
            text: '📥 Importar por Partes (IA)',
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

        const hasUnresolved = result.rows.some((r) => r.entryType === 'unresolved');
        if (result.isAmbiguous || hasUnresolved) {
          const preparedRows: TableRow[] = result.rows.map((r, idx) => ({
            ...r,
            id: (r as TableRow).id || `import-${Date.now()}-${idx}`,
          }));
          setPendingImportResult({ ...result, rows: preparedRows });
          setStagingRows(preparedRows);
          setIsAmbiguousImport(Boolean(result.isAmbiguous));
          setShowStagingModal(true);
        } else {
          setPendingImportResult(result);
          setShowImportChoice(true);
        }
      } catch (err: any) {
        Alert.alert('Erro na importação', err.message || 'Erro desconhecido');
      }
    }
  }, [previewMode, db]);

  const executeImportCommit = useCallback(async (mode: 'merge' | 'replace' | 'new', dataOverride?: any) => {
    const dataToUse = dataOverride || pendingImportResult;
    if (!dataToUse) return;
    try {
      const mergedSectors = Array.from(
        new Set([
          ...(dataToUse.metadata?.activeSectors || []),
          ...(dataToUse.detectedSectors || []),
        ])
      );

      await db.importSpreadsheet({
        rows: dataToUse.rows,
        tableId: mode === 'new' ? undefined : dataToUse.metadata?.tableId,
        name: dataToUse.metadata?.name,
        description: dataToUse.metadata?.description,
        goals: dataToUse.metadata?.goals || dataToUse.metadata?.tableGoals,
        mode,
        schema: dataToUse.metadata?.schema,
        investorProfile: dataToUse.metadata?.investorProfile,
        activeSectors: mergedSectors.length > 0 ? mergedSectors : undefined,
        dashboardConfig: dataToUse.metadata?.dashboardConfig,
        sectorParams: dataToUse.metadata?.sectorParams,
      });

      if (mode !== 'new' && mergedSectors.length > 0) {
        const currentActiveSectors = db.activeTable?.activeSectors || ['personal_finance'];
        const nextSectors = Array.from(new Set([...currentActiveSectors, ...mergedSectors]));
        await db.updateActiveSectors(nextSectors);
      }

      setTimeout(() => {
        const activeTableName = dataToUse.metadata?.name || db.activeTable?.name || 'Ativa';
        const successTitle = 'Importação Concluída! 🎉';
        const modeLabel =
          mode === 'new'
            ? 'carregadas em uma NOVA planilha'
            : mode === 'merge'
            ? 'acumuladas'
            : 'carregadas (substituição)';
        const successMsg = `Sucesso! ${dataToUse.rows.length} transações foram ${modeLabel} ("${activeTableName}").`;

        if (Platform.OS === 'web') {
          window.alert(`${successTitle}\n\n${successMsg}`);
        } else {
          Alert.alert(successTitle, successMsg);
        }
      }, 100);
    } catch (commitErr: any) {
      Alert.alert('Erro na importação', commitErr.message || 'Erro desconhecido');
    }
  }, [db, pendingImportResult]);

  const handleBulkDeleteConfirm = useCallback((prefix: string) => {
    setShowBulkDelete(false);
    const deletedCount = db.deleteRowsByPrefix(prefix);
    if (Platform.OS === 'web') {
      window.alert(`Sucesso: ${deletedCount} lançamentos foram excluídos.`);
    } else {
      Alert.alert('Sucesso', `${deletedCount} lançamentos foram excluídos.`);
    }
  }, [db]);

  const safeFilteredRows = useMemo(() => {
    if (!Array.isArray(db.filteredRows)) return [];
    const base = db.filteredRows.filter((r): r is TableRow => !!r && typeof r === 'object' && !!r.id);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => {
      if ((r.description || '').toLowerCase().includes(q)) return true;
      if ((r.category || '').toLowerCase().includes(q)) return true;
      if ((r.tags || '').toLowerCase().includes(q)) return true;
      if ((r.ticker || '').toLowerCase().includes(q)) return true;
      if ((r.date || '').toLowerCase().includes(q)) return true;
      if (String(r.value).includes(q)) return true;
      if (r.customValues) {
        for (const v of Object.values(r.customValues)) {
          if (String(v ?? '').toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [db.filteredRows, searchQuery]);

  const quarantineCount = useMemo(
    () => safeFilteredRows.filter((r) => r.entryType === 'unresolved').length,
    [safeFilteredRows]
  );

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
            <View style={styles.summaryHeaderRow}>
              <Text style={styles.summaryLabel}>{monthSummary.label}</Text>
              {quarantineCount > 0 && (
                <Text style={styles.quarantineBadgeText}>
                  ⚠️ {quarantineCount} {quarantineCount === 1 ? 'item em quarentena' : 'itens em quarentena'}
                </Text>
              )}
            </View>
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

        {/* Search & View Mode Toolbar */}
        <View style={styles.toolbarRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar descrição, categoria, valor, tag, ativo... (/)"
              placeholderTextColor={colors.text.disabled}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>✕</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.viewModeToggle}>
            <Pressable
              style={[styles.viewModeBtn, viewMode === 'cards' && styles.viewModeBtnActive]}
              onPress={() => handleSelectViewMode('cards')}
            >
              <Text style={[styles.viewModeText, viewMode === 'cards' && styles.viewModeTextActive]}>
                📋 Cartões
              </Text>
            </Pressable>
            <Pressable
              style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
              onPress={() => handleSelectViewMode('grid')}
            >
              <Text style={[styles.viewModeText, viewMode === 'grid' && styles.viewModeTextActive]}>
                ⊞ Planilha
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Dense Spreadsheet DataGrid when in Grid Mode */}
        {viewMode === 'grid' && safeFilteredRows.length > 0 && (
          <SpreadsheetDataGrid
            rows={safeFilteredRows}
            runningBalanceMap={runningBalanceMap}
            schema={currentOrInferredSchema}
            onAddRow={handleAddRow}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicate}
            onEditModalRow={handleEditRow}
            onOpenWorkbench={() => setShowWorkbench(true)}
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
    db.addRows,
    db.deleteGeneratedRows,
    db.effectuateGeneratedRows,
    monthSummary,
    quarantineCount,
    searchQuery,
    viewMode,
    handleSelectViewMode,
    safeFilteredRows,
    runningBalanceMap,
    currentOrInferredSchema,
    handleAddRow,
    handleUpdateRow,
    handleDeleteRow,
    handleDuplicate,
    handleEditRow,
  ]);

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
              {searchQuery ? ` (filtrado por "${searchQuery}")` : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.undoButton,
                { borderColor: 'rgba(16, 185, 129, 0.55)', backgroundColor: 'rgba(16, 185, 129, 0.14)' },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowGranularExportModal(true)}
            >
              <Text style={[styles.undoButtonText, { color: '#6EE7B7', fontWeight: '700' }]}>🧠 Síntese p/ IA</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.undoButton,
                { borderColor: 'rgba(99, 102, 241, 0.45)', backgroundColor: 'rgba(99, 102, 241, 0.14)' },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowExamplesModal(true)}
            >
              <Text style={[styles.undoButtonText, { color: '#A5B4FC' }]}>📚 Modelos CSV</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.undoButton,
                pressed && styles.pressed,
                !db.canUndo && styles.disabledButton,
              ]}
              onPress={() => db.undo()}
              disabled={!db.canUndo}
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
          data={viewMode === 'grid' ? [] : safeFilteredRows}
          keyExtractor={(item, index) => item?.id || `row_${index}`}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <SwipeableRowCard
              row={item}
              runningBalance={runningBalanceMap[item.id]}
              onEdit={handleEditRow}
              onDelete={handleDeleteRow}
              onDuplicate={handleDuplicate}
              onResolveQuarantine={handleResolveQuarantine}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            isDesktop && styles.listContentDesktop,
            safeFilteredRows.length === 0 && styles.emptyList,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            viewMode === 'grid' && safeFilteredRows.length > 0 ? null : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🪙</Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'Nenhum resultado para a busca' : 'Nenhuma entrada ainda'}
                </Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'Tente outro termo ou limpe o filtro de busca acima.'
                    : 'Adicione sua primeira entrada, carregue uma Planilha de Exemplo 100% fictícia para testar ou use nossos modelos prontos para montar seu CSV com sua própria IA.'}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.emptyButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    ensureTable();
                    setEditingRow(null);
                    setShowAddModal(true);
                  }}
                >
                  <Text style={styles.emptyButtonText}>+ Adicionar Entrada</Text>
                </Pressable>
                <View style={styles.emptyActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.emptySecondaryButton,
                      { borderColor: 'rgba(99, 102, 241, 0.5)', backgroundColor: 'rgba(99, 102, 241, 0.14)' },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setShowExamplesModal(true)}
                  >
                    <Text style={[styles.emptySecondaryButtonText, { color: '#A5B4FC', fontWeight: '700' }]}>
                      📚 Exemplos & Modelos IA
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.emptySecondaryButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      ensureTable();
                      triggerFileImport();
                    }}
                  >
                    <Text style={styles.emptySecondaryButtonText}>📁 Importar CSV</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.emptySecondaryButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      ensureTable();
                      setPrefillImporterCsv(undefined);
                      setShowCSVStreamModal(true);
                    }}
                  >
                    <Text style={styles.emptySecondaryButtonText}>📥 Importar por Partes</Text>
                  </Pressable>
                </View>
              </View>
            )
          }
        />

      {/* FAB — Floating Action Button */}
      <View style={styles.fabContainer}>
        {showFab && (
          <View style={styles.fabMenu}>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: '#6366F1' }]}
              onPress={() => {
                setShowFab(false);
                setShowExamplesModal(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>📚</Text>
              <Text style={styles.fabMenuLabel}>Exemplos & Modelos IA</Text>
            </Pressable>
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
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.accent.purpleBorder }]}
              onPress={() => {
                setShowFab(false);
                setShowGranularExportModal(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>🧠</Text>
              <Text style={styles.fabMenuLabel}>Síntese IA (.MD) / Partes</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.warning.border }]}
              onPress={() => {
                setShowFab(false);
                ensureTable();
                triggerFileImport();
              }}
            >
              <Text style={styles.fabMenuIcon}>📁</Text>
              <Text style={styles.fabMenuLabel}>Importar Arquivo CSV</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.accent.purpleBorder }]}
              onPress={() => {
                setShowFab(false);
                ensureTable();
                setPrefillImporterCsv(undefined);
                setShowCSVStreamModal(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>📥</Text>
              <Text style={styles.fabMenuLabel}>Importar por Partes</Text>
            </Pressable>
            <Pressable
              style={[styles.fabMenuItem, { backgroundColor: colors.background.elevated, borderColor: colors.accent.purpleBorder }]}
              onPress={() => {
                setShowFab(false);
                setShowWorkbench(true);
              }}
            >
              <Text style={styles.fabMenuIcon}>📐</Text>
              <Text style={styles.fabMenuLabel}>Colunas & Tipos</Text>
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
        <View style={styles.fabButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.quickAddFab,
              pressed && styles.fabPressed,
            ]}
            onPress={() => {
              ensureTable();
              setEditingRow(null);
              setShowAddModal(true);
            }}
          >
            <Text style={styles.quickAddFabText}>＋ Registrar</Text>
          </Pressable>
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
        onUpdate={(rowId, updates) => {
          db.updateRow(rowId, updates);
          setEditingRow(null);
        }}
        schema={currentOrInferredSchema}
        editingRow={editingRow}
        onDelete={(rowId) => {
          db.deleteRow(rowId);
        }}
        onClone={(row) => {
          const { id, ...rest } = row;
          const cloned: Omit<TableRow, 'id'> = {
            ...rest,
            description: row.description ? `${row.description} (CÓPIA)` : undefined,
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
        initialCsvText={prefillImporterCsv}
        onOpenExamplesGallery={() => {
          setShowCSVStreamModal(false);
          setShowExamplesModal(true);
        }}
        onClose={() => {
          setShowCSVStreamModal(false);
          setPrefillImporterCsv(undefined);
        }}
        onSuccess={(summary) => {
          setShowCSVStreamModal(false);
          setPrefillImporterCsv(undefined);
          if (Platform.OS === 'web') {
            window.alert(summary);
          } else {
            Alert.alert('Importação Bem-Sucedida', summary);
          }
        }}
      />

      {/* Example CSV Gallery & AI Builder Templates Modal */}
      <ExampleCSVGalleryModal
        visible={showExamplesModal}
        onClose={() => setShowExamplesModal(false)}
        onImportExample={db.importSpreadsheet}
        onOpenCustomImporter={(csv) => {
          setPrefillImporterCsv(csv);
          setShowCSVStreamModal(true);
        }}
        onOpenLiveSynthesis={() => {
          setShowExamplesModal(false);
          setShowGranularExportModal(true);
        }}
      />

      {/* Choice Dialog for Import Mode (Non-destructive) */}
      <ChoiceDialog
        visible={showImportChoice}
        title="Modo de Importação"
        message={
          pendingImportResult
            ? `O arquivo contém ${pendingImportResult.rows.length} transações. Como deseja aplicar os dados?`
            : ''
        }
        options={[
          {
            key: 'new',
            label: '🆕 Abrir em Nova Planilha',
            description: 'Cria uma nova planilha separada sem alterar a planilha atual',
            variant: 'primary',
          },
          {
            key: 'merge',
            label: '➕ Acumular na Planilha Atual',
            description: 'Mantém as entradas existentes e adiciona/atualiza as novas',
            variant: 'primary',
          },
          {
            key: 'replace',
            label: '🔄 Substituir Planilha Atual',
            description: 'Substitui os lançamentos atuais por estes novos do arquivo',
            variant: 'danger',
          },
          {
            key: 'cancel',
            label: '✖ Cancelar',
            description: 'Não alterar nada e manter seus dados intactos',
            variant: 'cancel',
          },
        ]}
        onSelect={async (key) => {
          setShowImportChoice(false);
          if (key === 'new' || key === 'merge' || key === 'replace') {
            await executeImportCommit(key);
          }
          setPendingImportResult(null);
        }}
        onClose={() => {
          setShowImportChoice(false);
          setPendingImportResult(null);
        }}
      />

      {/* Dynamic Column Mapping Workbench Modal */}
      {db.activeTable && (
        <ColumnMappingWorkbenchModal
          visible={showWorkbench}
          onClose={() => setShowWorkbench(false)}
          schema={currentOrInferredSchema}
          sampleData={workbenchSampleData}
          onSaveSchema={handleSaveWorkbenchSchema}
        />
      )}

      {/* Granular / Sliced Export Modal */}
      {db.activeTable && (
        <GranularExportModal
          visible={showGranularExportModal}
          onClose={() => setShowGranularExportModal(false)}
          rows={db.activeTable.rows}
          tableName={db.activeTable.name}
          selectedMonth={db.selectedMonth === 'all' ? undefined : db.selectedMonth}
          goals={db.activeTable.goals}
          tableId={db.activeTable.id}
          schema={db.activeTable.schema}
          investorProfile={db.activeTable.investorProfile}
          activeSectors={db.activeTable.activeSectors}
          dashboardConfig={db.activeTable.dashboardConfig}
          sectorParams={db.activeTable.sectorParams}
        />
      )}

      {/* CSV Staging & Bulk Classification Modal for Ambiguous Imports */}
      <CSVStagingReviewModal
        visible={showStagingModal}
        onClose={() => {
          setShowStagingModal(false);
          setPendingImportResult(null);
        }}
        incomingRows={stagingRows}
        isAmbiguous={isAmbiguousImport}
        activeTableName={db.activeTable?.name}
        onConfirmCommit={async (classifiedRows, mode) => {
          setShowStagingModal(false);
          await executeImportCommit(mode, {
            ...pendingImportResult,
            rows: classifiedRows,
          });
          setPendingImportResult(null);
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
  emptyActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptySecondaryButton: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  emptySecondaryButtonText: {
    color: colors.text.secondary,
    fontSize: 13,
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
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quarantineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  searchBox: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    paddingVertical: 2,
  },
  clearSearchBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearSearchText: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontWeight: '700',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: 2,
    gap: 2,
  },
  viewModeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  viewModeBtnActive: {
    backgroundColor: colors.accent.purple,
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  viewModeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContentDesktop: {
    maxWidth: 1440,
  },
  fabButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickAddFab: {
    height: 52,
    paddingHorizontal: spacing.lg,
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
  quickAddFabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
