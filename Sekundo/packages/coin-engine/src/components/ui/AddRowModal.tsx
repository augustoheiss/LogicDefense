/**
 * AddRowModal Component — Assistente Moeda
 *
 * Bottom-sheet style modal for adding new financial entries.
 * Adapts between a bottom sheet (mobile) and centered modal (web/tablet).
 *
 * Fields: date, value, description, entryType, periodStart, periodEnd, monthlyValue, monthCount
 * Supports: Individual and Batch (Em Lote) modes.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type { TableRow, DynamicTableSchema } from '@coin/core/types';
import { parseMoneyBR, parseBatchAmounts } from '@coin/core/parseMoneyBR';

interface AddRowModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (rowOrRows: Omit<TableRow, 'id'> | Omit<TableRow, 'id'>[]) => void;
  onUpdate?: (rowId: string, updates: Partial<TableRow>) => void;
  editingRow?: TableRow | null;
  onDelete?: (rowId: string) => void;
  onClone?: (row: TableRow) => void;
  schema?: DynamicTableSchema;
}

type EntryType = 'revenue' | 'deposit' | 'waiver' | 'expense' | 'partner_in' | 'partner_out';

const entryTypes: { value: EntryType; label: string; icon: string }[] = [
  { value: 'expense',     label: 'Despesa',    icon: '💸' },
  { value: 'revenue',     label: 'Receita',    icon: '💰' },
  { value: 'deposit',     label: 'Depósito',   icon: '🏦' },
  { value: 'waiver',      label: 'Abono',      icon: '🎁' },
  { value: 'partner_in',  label: 'Sócio ↓',    icon: '🤝' },
  { value: 'partner_out', label: 'Sócio ↑',    icon: '📤' },
];

const QUICK_CATEGORIES: { label: string; icon: string; defaultType?: EntryType }[] = [
  { label: 'Alimentação', icon: '🍔', defaultType: 'expense' },
  { label: 'Transporte',  icon: '🚗', defaultType: 'expense' },
  { label: 'Mercado',     icon: '🛒', defaultType: 'expense' },
  { label: 'Moradia',     icon: '🏠', defaultType: 'expense' },
  { label: 'Saúde',       icon: '💊', defaultType: 'expense' },
  { label: 'Lazer',       icon: '🎬', defaultType: 'expense' },
  { label: 'Trabalho',    icon: '💼', defaultType: 'revenue' },
  { label: 'Investimento',icon: '📈', defaultType: 'deposit' },
  { label: 'Geral',       icon: '📌' },
];

function getOffsetISO(daysOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayISO(): string {
  return getOffsetISO(0);
}

const STANDARD_COLUMN_IDS = new Set([
  'id', 'date', 'data', 'value', 'valor', 'description', 'descricao',
  'entryType', 'entry_type', 'tipo', 'category', 'categoria', 'tags',
  'periodStart', 'period_start', 'periodEnd', 'period_end',
  'monthlyValue', 'monthly_value', 'monthCount', 'month_count',
  'ticker', 'quantity', 'unitPrice', 'unit_price',
]);

export function AddRowModal({
  visible,
  onClose,
  onAdd,
  onUpdate,
  editingRow,
  onDelete,
  onClone,
  schema,
}: AddRowModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [date, setDate] = useState(getTodayISO());
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Geral');
  const [tags, setTags] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [error, setError] = useState<string | null>(null);

  // Period States
  const [isPeriod, setIsPeriod] = useState(false);
  const [periodStart, setPeriodStart] = useState(getTodayISO());
  const [periodEnd, setPeriodEnd] = useState(getTodayISO());

  // Expense-specific States
  const [monthlyValue, setMonthlyValue] = useState('');
  const [monthCount, setMonthCount] = useState('');

  // Investment-specific States (deposit)
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  // Dynamic Custom Columns States
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Batch Mode States
  const [isBatch, setIsBatch] = useState(false);
  const [batchValues, setBatchValues] = useState('');
  const [isSingleDescription, setIsSingleDescription] = useState(true);
  const [individualDescriptions, setIndividualDescriptions] = useState<string[]>([]);

  // Extract custom columns from schema
  const customColumns = useMemo(() => {
    if (!schema?.columns) return [];
    return schema.columns.filter(
      (col) =>
        col.visible !== false &&
        (col.role === 'custom' || !col.role) &&
        !STANDARD_COLUMN_IDS.has(col.id)
    );
  }, [schema]);

  // Pre-fill when editing
  useEffect(() => {
    if (editingRow) {
      setDate(editingRow.date);
      setValue(String(Math.abs(editingRow.value)));
      setDescription(editingRow.description || '');
      setCategory(editingRow.category || 'Geral');
      setTags(editingRow.tags || '');
      const normalizedEditType =
        editingRow.entryType && editingRow.entryType !== 'unresolved'
          ? (editingRow.entryType as EntryType)
          : 'expense';
      setEntryType(normalizedEditType);

      const hasPeriod = !!(editingRow.periodStart && editingRow.periodEnd);
      setIsPeriod(hasPeriod);
      setPeriodStart(editingRow.periodStart || editingRow.date);
      setPeriodEnd(editingRow.periodEnd || editingRow.date);

      setMonthlyValue(editingRow.monthlyValue != null ? String(editingRow.monthlyValue) : '');
      setMonthCount(editingRow.monthCount != null ? String(editingRow.monthCount) : '');

      setTicker(editingRow.ticker || '');
      setQuantity(editingRow.quantity != null ? String(editingRow.quantity) : '');
      setUnitPrice(editingRow.unitPrice != null ? String(editingRow.unitPrice) : '');

      const initialCustom: Record<string, string> = {};
      if (editingRow.customValues) {
        for (const [k, v] of Object.entries(editingRow.customValues)) {
          if (v !== undefined && v !== null) {
            initialCustom[k] = String(v);
          }
        }
      }
      setCustomValues(initialCustom);

      setIsBatch(false);
    } else {
      setDate(getTodayISO());
      setValue('');
      setDescription('');
      setCategory('Geral');
      setTags('');
      setEntryType('expense');
      setIsPeriod(false);
      setPeriodStart(getTodayISO());
      setPeriodEnd(getTodayISO());
      setMonthlyValue('');
      setMonthCount('');
      setTicker('');
      setQuantity('');
      setUnitPrice('');
      setCustomValues({});
      setIsBatch(false);
      setBatchValues('');
      setIsSingleDescription(true);
      setIndividualDescriptions([]);
    }
    setError(null);
  }, [editingRow, visible]);

  // Dynamically parse values from batch input
  const parsedValues = useMemo(() => {
    return parseBatchAmounts(batchValues);
  }, [batchValues]);

  const handleDescChange = (index: number, text: string) => {
    setIndividualDescriptions((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  // Auto-calculate total value when monthlyValue or monthCount changes (for expense only)
  const handleMonthlyValueChange = (val: string) => {
    setMonthlyValue(val);
    const mVal = parseMoneyBR(val);
    const mCount = parseInt(monthCount, 10);
    if (!isNaN(mVal) && mVal > 0 && !isNaN(mCount) && mCount > 0) {
      setValue(String(Math.round(mVal * mCount * 100) / 100));
    }
  };

  const handleMonthCountChange = (val: string) => {
    setMonthCount(val);
    const mVal = parseMoneyBR(monthlyValue);
    const mCount = parseInt(val, 10);
    if (!isNaN(mVal) && mVal > 0 && !isNaN(mCount) && mCount > 0) {
      setValue(String(Math.round(mVal * mCount * 100) / 100));
    }
  };

  // Auto-calculate total deposit value when quantity or unitPrice changes
  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const q = parseMoneyBR(val);
    const p = parseMoneyBR(unitPrice);
    if (!isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      setValue(String(Math.round(q * p * 100) / 100));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val);
    const q = parseMoneyBR(quantity);
    const p = parseMoneyBR(val);
    if (!isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      setValue(String(Math.round(q * p * 100) / 100));
    }
  };

  const handleQuickCategorySelect = (cat: { label: string; defaultType?: EntryType }) => {
    setCategory(cat.label);
    if (!description.trim()) {
      setDescription(cat.label);
    }
  };

  const isEditMode = !!editingRow;

  const handleDelete = () => {
    if (!editingRow || !onDelete) return;

    if (Platform.OS === 'web') {
      const confirm = window.confirm('Deseja mesmo excluir esta entrada?');
      if (confirm) {
        onDelete(editingRow.id);
        onClose();
      }
    } else {
      Alert.alert(
        'Confirmação',
        'Deseja mesmo excluir esta entrada?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => {
              onDelete(editingRow.id);
              onClose();
            },
          },
        ]
      );
    }
  };

  const handleClone = () => {
    if (!editingRow || !onClone) return;

    onClone(editingRow);
    onClose();

    if (Platform.OS === 'web') {
      window.alert('Entrada clonada com sucesso!');
    } else {
      Alert.alert('Sucesso', 'Entrada clonada com sucesso!');
    }
  };

  const buildCustomValuesMap = (): Record<string, string | number | boolean> | undefined => {
    const cleaned: Record<string, string | number | boolean> = {
      ...(editingRow?.customValues || {}),
    };
    for (const [k, rawVal] of Object.entries(customValues)) {
      const trimmed = rawVal.trim();
      if (!trimmed) {
        delete cleaned[k];
        continue;
      }
      const colDef = customColumns.find((c) => c.id === k);
      if (colDef?.type === 'number' || colDef?.type === 'currency' || colDef?.type === 'percentage') {
        const parsed = parseMoneyBR(trimmed);
        cleaned[k] = !isNaN(parsed) ? parsed : trimmed;
      } else {
        cleaned[k] = trimmed;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  };

  const handleSubmit = () => {
    setError(null);

    // Validate dates
    let finalDate = date;
    let finalPeriodStart: string | undefined;
    let finalPeriodEnd: string | undefined;

    if (isPeriod) {
      if (!periodStart.match(/^\d{4}-\d{2}-\d{2}$/) || !periodEnd.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setError('Datas do período inválidas (AAAA-MM-DD)');
        return;
      }
      if (periodStart > periodEnd) {
        setError('Data inicial não pode ser posterior à data final');
        return;
      }
      finalDate = periodStart;
      finalPeriodStart = periodStart;
      finalPeriodEnd = periodEnd;
    } else {
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setError('Data inválida (AAAA-MM-DD)');
        return;
      }
    }

    const finalCustomValues = buildCustomValuesMap();
    const finalCategory = category.trim() || 'Geral';
    const finalTags = tags.trim() || undefined;

    let finalTicker: string | undefined;
    let finalQuantity: number | undefined;
    let finalUnitPrice: number | undefined;

    if (entryType === 'deposit') {
      if (ticker.trim()) finalTicker = ticker.trim().toUpperCase();
      const q = parseMoneyBR(quantity);
      if (!isNaN(q) && q > 0) finalQuantity = q;
      const p = parseMoneyBR(unitPrice);
      if (!isNaN(p) && p > 0) finalUnitPrice = p;
    }

    if (isBatch && !isEditMode) {
      // Batch mode submission
      if (parsedValues.length === 0) {
        setError('Insira pelo menos um valor válido');
        return;
      }

      const rows: Omit<TableRow, 'id'>[] = parsedValues.map((val, idx) => {
        const desc = isSingleDescription
          ? description.trim()
          : (individualDescriptions[idx] || '').trim();

        let finalMonthlyValue: number | undefined;
        let finalMonthCount: number | undefined;

        if (entryType === 'expense') {
          const mCount = parseInt(monthCount, 10);
          if (!isNaN(mCount) && mCount > 0) {
            finalMonthCount = mCount;
            finalMonthlyValue = Math.round((val / mCount) * 100) / 100;
          }
        }

        return {
          date: finalDate,
          value: Math.round(val * 100) / 100,
          description: desc || finalCategory,
          category: finalCategory,
          tags: finalTags,
          entryType,
          periodStart: finalPeriodStart,
          periodEnd: finalPeriodEnd,
          monthlyValue: finalMonthlyValue,
          monthCount: finalMonthCount,
          ticker: finalTicker,
          quantity: finalQuantity,
          unitPrice: finalUnitPrice,
          customValues: finalCustomValues,
        };
      });

      onAdd(rows);
    } else {
      // Individual mode submission
      const numValue = parseMoneyBR(value);
      if (isNaN(numValue) || numValue <= 0) {
        setError('Insira um valor válido');
        return;
      }

      let finalMonthlyValue: number | undefined;
      let finalMonthCount: number | undefined;

      if (entryType === 'expense') {
        const mVal = parseMoneyBR(monthlyValue);
        const mCount = parseInt(monthCount, 10);
        if (!isNaN(mVal) && mVal > 0) {
          finalMonthlyValue = Math.round(mVal * 100) / 100;
        }
        if (!isNaN(mCount) && mCount > 0) {
          finalMonthCount = mCount;
        }
      }

      const payload: Omit<TableRow, 'id'> = {
        date: finalDate,
        value: Math.round(numValue * 100) / 100,
        description: description.trim() || finalCategory,
        category: finalCategory,
        tags: finalTags,
        entryType,
        periodStart: finalPeriodStart,
        periodEnd: finalPeriodEnd,
        monthlyValue: finalMonthlyValue,
        monthCount: finalMonthCount,
        ticker: finalTicker,
        quantity: finalQuantity,
        unitPrice: finalUnitPrice,
        customValues: finalCustomValues,
      };

      if (isEditMode && editingRow && onUpdate) {
        onUpdate(editingRow.id, payload);
      } else {
        onAdd(payload);
      }
    }

    // Reset form
    setValue('');
    setDescription('');
    setCategory('Geral');
    setTags('');
    setEntryType('expense');
    setDate(getTodayISO());
    setIsPeriod(false);
    setPeriodStart(getTodayISO());
    setPeriodEnd(getTodayISO());
    setMonthlyValue('');
    setMonthCount('');
    setTicker('');
    setQuantity('');
    setUnitPrice('');
    setCustomValues({});
    setIsBatch(false);
    setBatchValues('');
    setIsSingleDescription(true);
    setIndividualDescriptions([]);
    setError(null);
    onClose();
  };

  const todayISO = getTodayISO();
  const yesterdayISO = getOffsetISO(-1);
  const twoDaysAgoISO = getOffsetISO(-2);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, isWide && styles.sheetWide]}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Handle bar (mobile) */}
            {!isWide && <View style={styles.handle} />}

            <View style={styles.headerTitleRow}>
              <Text style={styles.title}>{isEditMode ? '✏️ Editar Entrada' : '⚡ Registro Rápido'}</Text>
              {!isEditMode && (
                <View style={styles.compactModeToggle}>
                  <Pressable
                    style={[styles.compactToggleBtn, !isBatch && styles.compactToggleBtnActive]}
                    onPress={() => setIsBatch(false)}
                  >
                    <Text style={[styles.compactToggleText, !isBatch && styles.compactToggleTextActive]}>Único</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.compactToggleBtn, isBatch && styles.compactToggleBtnActive]}
                    onPress={() => setIsBatch(true)}
                  >
                    <Text style={[styles.compactToggleText, isBatch && styles.compactToggleTextActive]}>Lote</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Entry type selector */}
            <View style={styles.typeGrid}>
              {entryTypes.map((et) => (
                <Pressable
                  key={et.value}
                  style={[
                    styles.typeChip,
                    entryType === et.value && styles.typeChipActive,
                  ]}
                  onPress={() => setEntryType(et.value)}
                >
                  <Text style={styles.typeIcon}>{et.icon}</Text>
                  <Text
                    style={[
                      styles.typeLabel,
                      entryType === et.value && styles.typeLabelActive,
                    ]}
                  >
                    {et.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Values input FIRST for 3-second fast street capture */}
            {!isBatch ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {entryType === 'expense' && monthlyValue && monthCount
                    ? 'Valor Total (Autocalculado)'
                    : 'Valor (R$)'}
                </Text>
                <TextInput
                  style={[styles.input, styles.inputValue]}
                  value={value}
                  onChangeText={setValue}
                  placeholder="0,00"
                  placeholderTextColor={colors.text.disabled}
                  keyboardType="decimal-pad"
                  autoFocus={!isEditMode}
                />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Valores em Lote (ponto e vírgula, linha ou vírgula)</Text>
                <TextInput
                  style={[styles.input, styles.inputValue, styles.batchInput]}
                  value={batchValues}
                  onChangeText={setBatchValues}
                  placeholder="Ex: 50,00; 120,50; 80,00 ou um por linha"
                  placeholderTextColor={colors.text.disabled}
                  multiline
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}

            {/* 1-Tap Quick Category Chips */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Categoria Rápida (1 toque)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsRow}
              >
                {QUICK_CATEGORIES.map((cat) => {
                  const isSelected = category.toLowerCase() === cat.label.toLowerCase();
                  return (
                    <Pressable
                      key={cat.label}
                      style={[styles.quickChip, isSelected && styles.quickChipActive]}
                      onPress={() => handleQuickCategorySelect(cat)}
                    >
                      <Text style={styles.quickChipText}>
                        {cat.icon} {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Description Input(s) */}
            {(!isBatch || isSingleDescription) ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Descrição (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ex: Uber, Aluguel, Freelance..."
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            ) : (
              parsedValues.length > 0 && (
                <View style={styles.individualList}>
                  <Text style={styles.subLabel}>Descrições Individuais</Text>
                  {parsedValues.map((val, idx) => (
                    <View key={idx} style={styles.individualRow}>
                      <View style={styles.individualValueTag}>
                        <Text style={styles.individualValueText}>R$ {val.toFixed(2)}</Text>
                      </View>
                      <TextInput
                        style={[styles.input, styles.individualInput]}
                        value={individualDescriptions[idx] || ''}
                        onChangeText={(text) => handleDescChange(idx, text)}
                        placeholder={`Descrição para R$ ${val.toFixed(2)}`}
                        placeholderTextColor={colors.text.disabled}
                      />
                    </View>
                  ))}
                </View>
              )
            )}

            {/* Description Mode Selector (Batch only) */}
            {isBatch && !isEditMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Modo de Descrição em Lote</Text>
                <View style={styles.toggleRow}>
                  <Pressable
                    style={[styles.toggleBtn, isSingleDescription && styles.toggleBtnActive]}
                    onPress={() => setIsSingleDescription(true)}
                  >
                    <Text style={[styles.toggleBtnText, isSingleDescription && styles.toggleBtnTextActive]}>
                      Descrição Única
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toggleBtn, !isSingleDescription && styles.toggleBtnActive]}
                    onPress={() => setIsSingleDescription(false)}
                  >
                    <Text style={[styles.toggleBtnText, !isSingleDescription && styles.toggleBtnTextActive]}>
                      Individuais
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Date Section with 1-Tap Date Chips */}
            <View style={styles.inputGroup}>
              <View style={styles.dateHeaderRow}>
                <Text style={styles.label}>Data</Text>
                <View style={styles.quickDateRow}>
                  <Pressable
                    style={[styles.dateChip, !isPeriod && date === todayISO && styles.dateChipActive]}
                    onPress={() => { setIsPeriod(false); setDate(todayISO); }}
                  >
                    <Text style={[styles.dateChipText, !isPeriod && date === todayISO && styles.dateChipTextActive]}>Hoje</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dateChip, !isPeriod && date === yesterdayISO && styles.dateChipActive]}
                    onPress={() => { setIsPeriod(false); setDate(yesterdayISO); }}
                  >
                    <Text style={[styles.dateChipText, !isPeriod && date === yesterdayISO && styles.dateChipTextActive]}>Ontem</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dateChip, !isPeriod && date === twoDaysAgoISO && styles.dateChipActive]}
                    onPress={() => { setIsPeriod(false); setDate(twoDaysAgoISO); }}
                  >
                    <Text style={[styles.dateChipText, !isPeriod && date === twoDaysAgoISO && styles.dateChipTextActive]}>-2d</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dateChip, isPeriod && styles.dateChipActive]}
                    onPress={() => setIsPeriod(!isPeriod)}
                  >
                    <Text style={[styles.dateChipText, isPeriod && styles.dateChipTextActive]}>Período</Text>
                  </Pressable>
                </View>
              </View>

              {!isPeriod ? (
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.text.disabled}
                  keyboardType="numbers-and-punctuation"
                />
              ) : (
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Data Inicial</Text>
                    <TextInput
                      style={styles.input}
                      value={periodStart}
                      onChangeText={setPeriodStart}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={colors.text.disabled}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Data Final</Text>
                    <TextInput
                      style={styles.input}
                      value={periodEnd}
                      onChangeText={setPeriodEnd}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={colors.text.disabled}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Conditional Expense Sub-inputs */}
            {entryType === 'expense' && (
              <View style={styles.rowInputs}>
                {!isBatch && (
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Valor Mensal (R$)</Text>
                    <TextInput
                      style={styles.input}
                      value={monthlyValue}
                      onChangeText={handleMonthlyValueChange}
                      placeholder="Opcional (parcelado)"
                      placeholderTextColor={colors.text.disabled}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Nº de Meses</Text>
                  <TextInput
                    style={styles.input}
                    value={monthCount}
                    onChangeText={handleMonthCountChange}
                    placeholder="1"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}

            {/* Conditional Investment Sub-inputs (for Deposit) */}
            {entryType === 'deposit' && (
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1.2 }]}>
                  <Text style={styles.label}>Ticker / Ativo</Text>
                  <TextInput
                    style={styles.input}
                    value={ticker}
                    onChangeText={setTicker}
                    placeholder="Ex: PETR4, SELIC"
                    placeholderTextColor={colors.text.disabled}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 0.9 }]}>
                  <Text style={styles.label}>Qtd</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={handleQuantityChange}
                    placeholder="10"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1.1 }]}>
                  <Text style={styles.label}>Preço Unit.</Text>
                  <TextInput
                    style={styles.input}
                    value={unitPrice}
                    onChangeText={handleUnitPriceChange}
                    placeholder="35,50"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            {/* Category & Tags Row */}
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Categoria</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Geral"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Tags (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={tags}
                  onChangeText={setTags}
                  placeholder="fixo, trabalho"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            </View>

            {/* Dynamic Custom Columns from Schema */}
            {customColumns.length > 0 && (
              <View style={styles.customColumnsSection}>
                <Text style={styles.subLabel}>Colunas Personalizadas da Planilha</Text>
                <View style={styles.customColumnsGrid}>
                  {customColumns.map((col) => (
                    <View key={col.id} style={[styles.inputGroup, styles.customColInputWrap]}>
                      <Text style={styles.label}>{col.label}</Text>
                      <TextInput
                        style={styles.input}
                        value={customValues[col.id] || ''}
                        onChangeText={(txt) =>
                          setCustomValues((prev) => ({ ...prev, [col.id]: txt }))
                        }
                        placeholder={col.label}
                        placeholderTextColor={colors.text.disabled}
                        keyboardType={
                          col.type === 'number' || col.type === 'currency' || col.type === 'percentage'
                            ? 'decimal-pad'
                            : 'default'
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Error */}
            {error && (
              <Text style={styles.error}>⚠️ {error}</Text>
            )}

            {/* Actions */}
            {isEditMode ? (
              <View style={styles.editActionsContainer}>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={onClose}
                  >
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.submitButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleSubmit}
                  >
                    <Text style={styles.submitText}>Salvar</Text>
                  </Pressable>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cloneButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleClone}
                  >
                    <Text style={styles.cloneText}>👥 Clonar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleDelete}
                  >
                    <Text style={styles.deleteText}>🗑️ Excluir</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleSubmit}
                >
                  <Text style={styles.submitText}>Adicionar</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  sheetWide: {
    alignSelf: 'center',
    width: 480,
    borderRadius: radius.xl,
    marginBottom: 40,
    maxHeight: '85%',
  },
  content: {
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.strong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  typeChipActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  typeIcon: {
    fontSize: 14,
  },
  typeLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },

  // Toggle switch styles
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accent.purple,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  toggleBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: 16,
  },
  inputValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  batchInput: {
    height: 80,
    fontSize: 16,
    textAlignVertical: 'top',
  },

  individualList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  subLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  individualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  individualValueTag: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minWidth: 100,
    alignItems: 'center',
  },
  individualValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  individualInput: {
    flex: 1,
  },

  error: {
    color: colors.danger.main,
    fontSize: 13,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.accent.purple,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  editActionsContainer: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cloneButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    backgroundColor: colors.accent.purpleLight,
  },
  cloneText: {
    color: colors.accent.purple,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger.border,
    backgroundColor: colors.danger.light,
  },
  deleteText: {
    color: colors.danger.main,
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  compactModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 2,
    gap: 2,
  },
  compactToggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  compactToggleBtnActive: {
    backgroundColor: colors.accent.purple,
  },
  compactToggleText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  compactToggleTextActive: {
    color: '#fff',
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  quickChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  quickChipActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  quickChipText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '600',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dateChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dateChipActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  dateChipText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  dateChipTextActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  customColumnsSection: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  customColumnsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  customColInputWrap: {
    minWidth: 140,
    flex: 1,
  },
});
