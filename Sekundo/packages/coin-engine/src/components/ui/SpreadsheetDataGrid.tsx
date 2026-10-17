/**
 * SpreadsheetDataGrid Component — Assistente Moeda
 *
 * Dense Desktop & Tablet Local Spreadsheet ("Planilha Local na Tela do Usuário").
 * Features:
 *   - Top Quick-Add Inline Row Bar (add entries directly from keyboard with Enter)
 *   - Sortable column headers (Date, Type, Category, Description, Value, Running Balance, Ticker + Dynamic Custom Columns)
 *   - Inline cell editing (click any cell to edit date, category, description, value, type, or custom column)
 *   - Multi-row selection with Excel-style Bottom Status Bar (Count, Sum, Revenue, Expenses, Average, Bulk Delete)
 *   - Inline 1-click Quarantine Resolution for 'unresolved' rows
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { formatCurrencySmart } from '@coin/core/formatCurrency';
import { parseMoneyBR } from '@coin/core/parseMoneyBR';
import type { TableRow, DynamicTableSchema } from '@coin/core/types';

export interface SpreadsheetDataGridProps {
  rows: TableRow[];
  runningBalanceMap: Record<string, number>;
  schema?: DynamicTableSchema;
  onAddRow: (row: Omit<TableRow, 'id'>) => void;
  onUpdateRow: (rowId: string, updates: Partial<TableRow>) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (row: TableRow) => void;
  onEditModalRow: (row: TableRow) => void;
  onOpenWorkbench?: () => void;
}

type SortField = 'date' | 'entryType' | 'category' | 'description' | 'value' | 'runningBalance' | string;
type SortDir = 'asc' | 'desc';

const ENTRY_TYPE_OPTIONS: { value: TableRow['entryType']; label: string; color: string }[] = [
  { value: 'expense',     label: '💸 Despesa',    color: colors.entryType.expense },
  { value: 'revenue',     label: '💰 Receita',    color: colors.entryType.revenue },
  { value: 'deposit',     label: '🏦 Depósito',   color: colors.entryType.deposit },
  { value: 'waiver',      label: '🎁 Abono',      color: colors.entryType.waiver },
  { value: 'partner_in',  label: '🤝 Sócio ↓',    color: colors.entryType.partner_in },
  { value: 'partner_out', label: '📤 Sócio ↑',    color: colors.entryType.partner_out },
  { value: 'unresolved',  label: '⚠️ Quarentena', color: '#F59E0B' },
];

const STANDARD_COL_IDS = new Set([
  'id', 'date', 'data', 'value', 'valor', 'description', 'descricao',
  'entryType', 'entry_type', 'tipo', 'category', 'categoria', 'tags',
  'periodStart', 'period_start', 'periodEnd', 'period_end',
  'monthlyValue', 'monthly_value', 'monthCount', 'month_count',
  'ticker', 'quantity', 'unitPrice', 'unit_price',
]);

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function SpreadsheetDataGrid({
  rows,
  runningBalanceMap,
  schema,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onDuplicateRow,
  onEditModalRow,
  onOpenWorkbench,
}: SpreadsheetDataGridProps) {
  // ── Quick Add Row Bar States ────────────────────────────
  const [quickDate, setQuickDate] = useState(getTodayISO());
  const [quickType, setQuickType] = useState<TableRow['entryType']>('expense');
  const [quickCategory, setQuickCategory] = useState('Geral');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickValue, setQuickValue] = useState('');
  const [quickTicker, setQuickTicker] = useState('');

  // ── Sorting & Selection States ──────────────────────────
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Inline Cell Editing State ───────────────────────────
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editingText, setEditingText] = useState('');

  // ── Extract Visible Custom Columns from Schema ──────────
  const customColumns = useMemo(() => {
    if (!schema?.columns) return [];
    return schema.columns.filter(
      (col) =>
        col.visible !== false &&
        (col.role === 'custom' || !col.role) &&
        !STANDARD_COL_IDS.has(col.id)
    );
  }, [schema]);

  const hasInvestmentRows = useMemo(
    () => rows.some((r) => !!r.ticker || r.entryType === 'deposit'),
    [rows]
  );

  // ── Sorted Rows ─────────────────────────────────────────
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else if (sortField === 'entryType') {
        cmp = (a.entryType || 'revenue').localeCompare(b.entryType || 'revenue');
      } else if (sortField === 'category') {
        cmp = (a.category || 'Geral').localeCompare(b.category || 'Geral');
      } else if (sortField === 'description') {
        cmp = (a.description || '').localeCompare(b.description || '');
      } else if (sortField === 'value') {
        cmp = Math.abs(a.value) - Math.abs(b.value);
      } else if (sortField === 'runningBalance') {
        cmp = (runningBalanceMap[a.id] ?? 0) - (runningBalanceMap[b.id] ?? 0);
      } else {
        const va = String(a.customValues?.[sortField] ?? '');
        const vb = String(b.customValues?.[sortField] ?? '');
        cmp = va.localeCompare(vb, undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortField, sortDir, runningBalanceMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'date' || field === 'value' ? 'desc' : 'asc');
    }
  };

  // ── Selection Helpers ───────────────────────────────────
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedRows.length && sortedRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRows.map((r) => r.id)));
    }
  };

  // ── Status Bar Aggregations (Selected or All Visible) ───
  const selectionStats = useMemo(() => {
    const targetRows =
      selectedIds.size > 0
        ? sortedRows.filter((r) => selectedIds.has(r.id))
        : sortedRows;

    let sumNet = 0;
    let sumRevenue = 0;
    let sumExpense = 0;

    for (const r of targetRows) {
      const mag = Math.abs(r.value || 0);
      if (r.entryType === 'expense' || r.entryType === 'partner_out') {
        sumExpense += mag;
        sumNet -= mag;
      } else if (r.entryType === 'revenue' || r.entryType === 'partner_in') {
        sumRevenue += mag;
        sumNet += mag;
      }
    }

    const count = targetRows.length;
    const avg = count > 0 ? sumNet / count : 0;

    return {
      isSelection: selectedIds.size > 0,
      count,
      sumNet,
      sumRevenue,
      sumExpense,
      avg,
    };
  }, [sortedRows, selectedIds]);

  // ── Quick Add Handler ───────────────────────────────────
  const handleQuickAddSubmit = () => {
    const parsedVal = parseMoneyBR(quickValue);
    if (isNaN(parsedVal) || parsedVal <= 0) return;
    if (!quickDate.match(/^\d{4}-\d{2}-\d{2}$/)) return;

    onAddRow({
      date: quickDate,
      entryType: quickType || 'expense',
      category: quickCategory.trim() || 'Geral',
      description: quickDesc.trim() || quickCategory.trim() || 'Sem descrição',
      value: Math.round(parsedVal * 100) / 100,
      ticker: quickType === 'deposit' && quickTicker.trim() ? quickTicker.trim().toUpperCase() : undefined,
    });

    setQuickValue('');
    setQuickDesc('');
    setQuickTicker('');
  };

  // ── Inline Edit Commit ──────────────────────────────────
  const startCellEdit = (rowId: string, field: string, currentVal: string) => {
    setEditingCell({ rowId, field });
    setEditingText(currentVal);
  };

  const commitCellEdit = (row: TableRow) => {
    if (!editingCell || editingCell.rowId !== row.id) return;
    const { field } = editingCell;
    const trimmed = editingText.trim();
    setEditingCell(null);

    if (field === 'date') {
      if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/) && trimmed !== row.date) {
        onUpdateRow(row.id, { date: trimmed });
      }
    } else if (field === 'category') {
      const nextCat = trimmed || 'Geral';
      if (nextCat !== (row.category || 'Geral')) {
        onUpdateRow(row.id, { category: nextCat });
      }
    } else if (field === 'description') {
      if (trimmed !== (row.description || '')) {
        onUpdateRow(row.id, { description: trimmed });
      }
    } else if (field === 'value') {
      const num = parseMoneyBR(trimmed);
      if (!isNaN(num) && num > 0 && num !== Math.abs(row.value)) {
        onUpdateRow(row.id, { value: Math.round(num * 100) / 100 });
      }
    } else if (field === 'ticker') {
      if (trimmed.toUpperCase() !== (row.ticker || '')) {
        onUpdateRow(row.id, { ticker: trimmed ? trimmed.toUpperCase() : undefined });
      }
    } else if (field.startsWith('custom:')) {
      const colId = field.replace('custom:', '');
      const colDef = customColumns.find((c) => c.id === colId);
      const nextCustom = { ...(row.customValues || {}) };
      if (!trimmed) {
        delete nextCustom[colId];
      } else if (colDef?.type === 'number' || colDef?.type === 'currency' || colDef?.type === 'percentage') {
        const parsed = parseMoneyBR(trimmed);
        nextCustom[colId] = !isNaN(parsed) ? parsed : trimmed;
      } else {
        nextCustom[colId] = trimmed;
      }
      onUpdateRow(row.id, { customValues: nextCustom });
    }
  };

  const cycleRowEntryType = (row: TableRow) => {
    const order: NonNullable<TableRow['entryType']>[] = [
      'expense',
      'revenue',
      'deposit',
      'waiver',
      'partner_in',
      'partner_out',
    ];
    const currentIdx = order.indexOf((row.entryType as any) || 'revenue');
    const nextType = order[(currentIdx + 1) % order.length];
    onUpdateRow(row.id, { entryType: nextType });
  };

  const handleBulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (Platform.OS === 'web') {
      const ok = window.confirm(`Excluir ${selectedIds.size} lançamentos selecionados?`);
      if (!ok) return;
    }
    for (const id of Array.from(selectedIds)) {
      onDeleteRow(id);
    }
    setSelectedIds(new Set());
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <View style={styles.wrapper}>
      {/* 1. Quick-Add Inline Row Bar */}
      <View style={styles.quickAddBar}>
        <Text style={styles.quickAddLabel}>⚡ Linha Rápida:</Text>
        <TextInput
          style={[styles.quickInput, { width: 105 }]}
          value={quickDate}
          onChangeText={setQuickDate}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.text.disabled}
        />
        <Pressable
          style={styles.quickTypeBtn}
          onPress={() => {
            const order: NonNullable<TableRow['entryType']>[] = ['expense', 'revenue', 'deposit', 'waiver'];
            const next = order[(order.indexOf(quickType || 'expense') + 1) % order.length];
            setQuickType(next);
          }}
        >
          <Text style={styles.quickTypeBtnText}>
            {ENTRY_TYPE_OPTIONS.find((o) => o.value === quickType)?.label || '💸 Despesa'}
          </Text>
        </Pressable>
        <TextInput
          style={[styles.quickInput, { width: 115 }]}
          value={quickValue}
          onChangeText={setQuickValue}
          placeholder="Valor (R$)"
          placeholderTextColor={colors.text.disabled}
          keyboardType="decimal-pad"
          onSubmitEditing={handleQuickAddSubmit}
        />
        <TextInput
          style={[styles.quickInput, { width: 125 }]}
          value={quickCategory}
          onChangeText={setQuickCategory}
          placeholder="Categoria"
          placeholderTextColor={colors.text.disabled}
          onSubmitEditing={handleQuickAddSubmit}
        />
        <TextInput
          style={[styles.quickInput, { flex: 1, minWidth: 150 }]}
          value={quickDesc}
          onChangeText={setQuickDesc}
          placeholder="Descrição (Enter para adicionar)"
          placeholderTextColor={colors.text.disabled}
          onSubmitEditing={handleQuickAddSubmit}
        />
        {quickType === 'deposit' && (
          <TextInput
            style={[styles.quickInput, { width: 90 }]}
            value={quickTicker}
            onChangeText={setQuickTicker}
            placeholder="Ticker"
            placeholderTextColor={colors.text.disabled}
            autoCapitalize="characters"
            onSubmitEditing={handleQuickAddSubmit}
          />
        )}
        <Pressable style={styles.quickAddSubmitBtn} onPress={handleQuickAddSubmit}>
          <Text style={styles.quickAddSubmitText}>+ Inserir</Text>
        </Pressable>
        {onOpenWorkbench && (
          <Pressable style={styles.workbenchBtn} onPress={onOpenWorkbench}>
            <Text style={styles.workbenchBtnText}>📐 Colunas ({customColumns.length + 6})</Text>
          </Pressable>
        )}
      </View>

      {/* 2. Scrollable Dense Spreadsheet Table */}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalScroll}>
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.headerRow}>
            <Pressable style={[styles.cell, styles.colCheck]} onPress={toggleSelectAll}>
              <Text style={styles.headerText}>
                {selectedIds.size > 0 && selectedIds.size === sortedRows.length ? '☑️' : '⬜'}
              </Text>
            </Pressable>

            <Pressable style={[styles.cell, styles.colDate]} onPress={() => toggleSort('date')}>
              <Text style={styles.headerText}>Data{renderSortIcon('date')}</Text>
            </Pressable>

            <Pressable style={[styles.cell, styles.colType]} onPress={() => toggleSort('entryType')}>
              <Text style={styles.headerText}>Tipo{renderSortIcon('entryType')}</Text>
            </Pressable>

            <Pressable style={[styles.cell, styles.colCategory]} onPress={() => toggleSort('category')}>
              <Text style={styles.headerText}>Categoria{renderSortIcon('category')}</Text>
            </Pressable>

            <Pressable style={[styles.cell, styles.colDesc]} onPress={() => toggleSort('description')}>
              <Text style={styles.headerText}>Descrição{renderSortIcon('description')}</Text>
            </Pressable>

            {hasInvestmentRows && (
              <View style={[styles.cell, styles.colTicker]}>
                <Text style={styles.headerText}>Ativo / Qtd</Text>
              </View>
            )}

            {/* Dynamic Custom Columns from Schema */}
            {customColumns.map((col) => (
              <Pressable
                key={col.id}
                style={[styles.cell, styles.colCustom]}
                onPress={() => toggleSort(col.id)}
              >
                <Text style={styles.headerText} numberOfLines={1}>
                  {col.label}{renderSortIcon(col.id)}
                </Text>
              </Pressable>
            ))}

            <Pressable style={[styles.cell, styles.colValue]} onPress={() => toggleSort('value')}>
              <Text style={[styles.headerText, { textAlign: 'right' }]}>Valor{renderSortIcon('value')}</Text>
            </Pressable>

            <Pressable style={[styles.cell, styles.colBalance]} onPress={() => toggleSort('runningBalance')}>
              <Text style={[styles.headerText, { textAlign: 'right' }]}>Saldo Acum.{renderSortIcon('runningBalance')}</Text>
            </Pressable>

            <View style={[styles.cell, styles.colActions]}>
              <Text style={[styles.headerText, { textAlign: 'center' }]}>Ações</Text>
            </View>
          </View>

          {/* Table Body */}
          {sortedRows.map((row, idx) => {
            const isSelected = selectedIds.has(row.id);
            const isQuarantine = row.entryType === 'unresolved';
            const typeMeta =
              ENTRY_TYPE_OPTIONS.find((o) => o.value === row.entryType) ||
              ENTRY_TYPE_OPTIONS[0];
            const isExpense = row.entryType === 'expense' || row.entryType === 'partner_out';
            const runningBal = runningBalanceMap[row.id];

            return (
              <View
                key={row.id}
                style={[
                  styles.dataRow,
                  idx % 2 === 1 && styles.dataRowAlt,
                  isSelected && styles.dataRowSelected,
                  isQuarantine && styles.dataRowQuarantine,
                ]}
              >
                {/* Checkbox */}
                <Pressable style={[styles.cell, styles.colCheck]} onPress={() => toggleSelectRow(row.id)}>
                  <Text style={styles.cellText}>{isSelected ? '☑️' : '⬜'}</Text>
                </Pressable>

                {/* Date Cell (Inline Editable) */}
                <View style={[styles.cell, styles.colDate]}>
                  {editingCell?.rowId === row.id && editingCell.field === 'date' ? (
                    <TextInput
                      style={styles.inlineInput}
                      value={editingText}
                      onChangeText={setEditingText}
                      onBlur={() => commitCellEdit(row)}
                      onSubmitEditing={() => commitCellEdit(row)}
                      autoFocus
                    />
                  ) : (
                    <Pressable onPress={() => startCellEdit(row.id, 'date', row.date)}>
                      <Text style={styles.cellMonoText}>{row.date}</Text>
                    </Pressable>
                  )}
                </View>

                {/* Type Cell (Click to Cycle or Resolve Quarantine) */}
                <View style={[styles.cell, styles.colType]}>
                  {isQuarantine ? (
                    <View style={styles.quarantineInlineGroup}>
                      <Pressable
                        style={[styles.qMiniBtn, { borderColor: colors.success.main }]}
                        onPress={() => onUpdateRow(row.id, { entryType: 'revenue' })}
                      >
                        <Text style={[styles.qMiniText, { color: colors.success.main }]}>+Rec</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.qMiniBtn, { borderColor: colors.danger.main }]}
                        onPress={() => onUpdateRow(row.id, { entryType: 'expense' })}
                      >
                        <Text style={[styles.qMiniText, { color: colors.danger.main }]}>-Desp</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.qMiniBtn, { borderColor: colors.info.main }]}
                        onPress={() => onUpdateRow(row.id, { entryType: 'deposit' })}
                      >
                        <Text style={[styles.qMiniText, { color: colors.info.main }]}>🏦Ap</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.typeBadge, { borderColor: typeMeta.color }]}
                      onPress={() => cycleRowEntryType(row)}
                    >
                      <Text style={[styles.typeBadgeText, { color: typeMeta.color }]} numberOfLines={1}>
                        {typeMeta.label}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Category Cell (Inline Editable) */}
                <View style={[styles.cell, styles.colCategory]}>
                  {editingCell?.rowId === row.id && editingCell.field === 'category' ? (
                    <TextInput
                      style={styles.inlineInput}
                      value={editingText}
                      onChangeText={setEditingText}
                      onBlur={() => commitCellEdit(row)}
                      onSubmitEditing={() => commitCellEdit(row)}
                      autoFocus
                    />
                  ) : (
                    <Pressable onPress={() => startCellEdit(row.id, 'category', row.category || 'Geral')}>
                      <Text style={styles.cellCategoryText} numberOfLines={1}>
                        {row.category || 'Geral'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Description Cell (Inline Editable) */}
                <View style={[styles.cell, styles.colDesc]}>
                  {editingCell?.rowId === row.id && editingCell.field === 'description' ? (
                    <TextInput
                      style={styles.inlineInput}
                      value={editingText}
                      onChangeText={setEditingText}
                      onBlur={() => commitCellEdit(row)}
                      onSubmitEditing={() => commitCellEdit(row)}
                      autoFocus
                    />
                  ) : (
                    <Pressable onPress={() => startCellEdit(row.id, 'description', row.description || '')}>
                      <Text style={styles.cellText} numberOfLines={1}>
                        {row.description || '—'}
                        {row.monthCount && row.monthCount > 1 ? ` (${row.monthCount}x)` : ''}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Investment Ticker Cell */}
                {hasInvestmentRows && (
                  <View style={[styles.cell, styles.colTicker]}>
                    {editingCell?.rowId === row.id && editingCell.field === 'ticker' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={editingText}
                        onChangeText={setEditingText}
                        onBlur={() => commitCellEdit(row)}
                        onSubmitEditing={() => commitCellEdit(row)}
                        autoFocus
                      />
                    ) : (
                      <Pressable onPress={() => startCellEdit(row.id, 'ticker', row.ticker || '')}>
                        <Text style={styles.cellTickerText} numberOfLines={1}>
                          {row.ticker
                            ? `${row.ticker}${row.quantity ? ` (${row.quantity})` : ''}`
                            : '—'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Dynamic Custom Columns */}
                {customColumns.map((col) => {
                  const fieldKey = `custom:${col.id}`;
                  const rawVal = row.customValues?.[col.id];
                  const displayVal = rawVal !== undefined && rawVal !== null && rawVal !== '' ? String(rawVal) : '—';
                  return (
                    <View key={col.id} style={[styles.cell, styles.colCustom]}>
                      {editingCell?.rowId === row.id && editingCell.field === fieldKey ? (
                        <TextInput
                          style={styles.inlineInput}
                          value={editingText}
                          onChangeText={setEditingText}
                          onBlur={() => commitCellEdit(row)}
                          onSubmitEditing={() => commitCellEdit(row)}
                          autoFocus
                        />
                      ) : (
                        <Pressable
                          onPress={() =>
                            startCellEdit(row.id, fieldKey, rawVal !== undefined && rawVal !== null ? String(rawVal) : '')
                          }
                        >
                          <Text style={styles.cellText} numberOfLines={1}>
                            {displayVal}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}

                {/* Value Cell (Inline Editable) */}
                <View style={[styles.cell, styles.colValue]}>
                  {editingCell?.rowId === row.id && editingCell.field === 'value' ? (
                    <TextInput
                      style={[styles.inlineInput, { textAlign: 'right' }]}
                      value={editingText}
                      onChangeText={setEditingText}
                      onBlur={() => commitCellEdit(row)}
                      onSubmitEditing={() => commitCellEdit(row)}
                      autoFocus
                    />
                  ) : (
                    <Pressable onPress={() => startCellEdit(row.id, 'value', String(Math.abs(row.value)))}>
                      <Text style={[styles.cellValueText, { color: typeMeta.color }]}>
                        {isExpense ? '-' : ''}
                        {formatCurrencySmart(Math.abs(row.value))}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Running Balance Cell */}
                <View style={[styles.cell, styles.colBalance]}>
                  <Text
                    style={[
                      styles.cellBalanceText,
                      {
                        color:
                          runningBal === undefined
                            ? colors.text.disabled
                            : runningBal >= 0
                            ? colors.text.secondary
                            : colors.danger.main,
                      },
                    ]}
                  >
                    {runningBal !== undefined ? formatCurrencySmart(runningBal) : '—'}
                  </Text>
                </View>

                {/* Actions Cell */}
                <View style={[styles.cell, styles.colActions, styles.actionsCellRow]}>
                  <Pressable style={styles.actionIconBtn} onPress={() => onEditModalRow(row)}>
                    <Text style={styles.actionIconText}>✏️</Text>
                  </Pressable>
                  <Pressable style={styles.actionIconBtn} onPress={() => onDuplicateRow(row)}>
                    <Text style={styles.actionIconText}>📋</Text>
                  </Pressable>
                  <Pressable style={styles.actionIconBtn} onPress={() => onDeleteRow(row.id)}>
                    <Text style={styles.actionIconText}>🗑️</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 3. Excel-Style Bottom Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusGroup}>
          <Text style={styles.statusLabel}>
            {selectionStats.isSelection
              ? `☑️ Selecionados: ${selectionStats.count}`
              : `Σ Total Visível: ${selectionStats.count} linhas`}
          </Text>
          <Text style={styles.statusSep}>|</Text>
          <Text style={styles.statusMetric}>
            Receitas: <Text style={{ color: colors.success.main }}>{formatCurrencySmart(selectionStats.sumRevenue)}</Text>
          </Text>
          <Text style={styles.statusSep}>|</Text>
          <Text style={styles.statusMetric}>
            Despesas: <Text style={{ color: colors.danger.main }}>{formatCurrencySmart(selectionStats.sumExpense)}</Text>
          </Text>
          <Text style={styles.statusSep}>|</Text>
          <Text style={styles.statusMetric}>
            Soma Líquida:{' '}
            <Text style={{ color: selectionStats.sumNet >= 0 ? colors.success.main : colors.danger.main }}>
              {formatCurrencySmart(selectionStats.sumNet)}
            </Text>
          </Text>
          <Text style={styles.statusSep}>|</Text>
          <Text style={styles.statusMetric}>
            Média: <Text style={{ color: colors.text.primary }}>{formatCurrencySmart(selectionStats.avg)}</Text>
          </Text>
        </View>

        {selectionStats.isSelection && (
          <View style={styles.statusActions}>
            <Pressable style={styles.clearSelectionBtn} onPress={() => setSelectedIds(new Set())}>
              <Text style={styles.clearSelectionText}>Limpar Seleção</Text>
            </Pressable>
            <Pressable style={styles.bulkDeleteBtn} onPress={handleBulkDeleteSelected}>
              <Text style={styles.bulkDeleteText}>🗑️ Excluir ({selectionStats.count})</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.md,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  quickAddBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  quickAddLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent.purple,
    marginRight: 4,
  },
  quickInput: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 12,
    color: colors.text.primary,
  },
  quickTypeBtn: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  quickTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  quickAddSubmitBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  quickAddSubmitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  workbenchBtn: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  workbenchBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  horizontalScroll: {
    minWidth: '100%',
  },
  tableContainer: {
    minWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    minHeight: 38,
  },
  dataRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
  },
  dataRowSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  dataRowQuarantine: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  cell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  colCheck: { width: 38, alignItems: 'center' },
  colDate: { width: 102 },
  colType: { width: 132 },
  colCategory: { width: 125 },
  colDesc: { flex: 1, minWidth: 200 },
  colTicker: { width: 110 },
  colCustom: { width: 130 },
  colValue: { width: 125, alignItems: 'flex-end' },
  colBalance: { width: 125, alignItems: 'flex-end' },
  colActions: { width: 96 },

  cellText: {
    fontSize: 12,
    color: colors.text.primary,
  },
  cellMonoText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  cellCategoryText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  cellTickerText: {
    fontSize: 11,
    color: colors.accent.purple,
    fontWeight: '700',
  },
  cellValueText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  cellBalanceText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  inlineInput: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.accent.purple,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 12,
    color: colors.text.primary,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  quarantineInlineGroup: {
    flexDirection: 'row',
    gap: 3,
  },
  qMiniBtn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qMiniText: {
    fontSize: 9,
    fontWeight: '700',
  },
  actionsCellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionIconBtn: {
    padding: 4,
    borderRadius: 4,
  },
  actionIconText: {
    fontSize: 12,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  statusSep: {
    fontSize: 11,
    color: colors.border.strong,
  },
  statusMetric: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearSelectionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  clearSelectionText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  bulkDeleteBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.danger.light,
    borderWidth: 1,
    borderColor: colors.danger.border,
  },
  bulkDeleteText: {
    fontSize: 11,
    color: colors.danger.main,
    fontWeight: '700',
  },
});
