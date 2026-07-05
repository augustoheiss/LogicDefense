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
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { TableRow } from '@/core/types';

interface AddRowModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (rowOrRows: Omit<TableRow, 'id'> | Omit<TableRow, 'id'>[]) => void;
  editingRow?: TableRow | null;
  onDelete?: (rowId: string) => void;
  onClone?: (row: TableRow) => void;
}

type EntryType = 'revenue' | 'deposit' | 'waiver' | 'expense' | 'partner_in' | 'partner_out';

const entryTypes: { value: EntryType; label: string; icon: string }[] = [
  { value: 'revenue',     label: 'Receita',    icon: '💰' },
  { value: 'expense',     label: 'Despesa',    icon: '💸' },
  { value: 'deposit',     label: 'Depósito',   icon: '🏦' },
  { value: 'waiver',      label: 'Abono',      icon: '🎁' },
  { value: 'partner_in',  label: 'Sócio ↓',    icon: '🤝' },
  { value: 'partner_out', label: 'Sócio ↑',    icon: '📤' },
];

function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AddRowModal({ visible, onClose, onAdd, editingRow, onDelete, onClone }: AddRowModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [date, setDate] = useState(getTodayISO());
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('revenue');
  const [error, setError] = useState<string | null>(null);

  // Period States
  const [isPeriod, setIsPeriod] = useState(false);
  const [periodStart, setPeriodStart] = useState(getTodayISO());
  const [periodEnd, setPeriodEnd] = useState(getTodayISO());

  // Expense-specific States
  const [monthlyValue, setMonthlyValue] = useState('');
  const [monthCount, setMonthCount] = useState('');

  // Batch Mode States
  const [isBatch, setIsBatch] = useState(false);
  const [batchValues, setBatchValues] = useState('');
  const [isSingleDescription, setIsSingleDescription] = useState(true);
  const [individualDescriptions, setIndividualDescriptions] = useState<string[]>([]);

  // Pre-fill when editing
  useEffect(() => {
    if (editingRow) {
      setDate(editingRow.date);
      setValue(String(editingRow.value));
      setDescription(editingRow.description || '');
      setEntryType((editingRow.entryType || 'revenue') as EntryType);

      const hasPeriod = !!(editingRow.periodStart && editingRow.periodEnd);
      setIsPeriod(hasPeriod);
      setPeriodStart(editingRow.periodStart || editingRow.date);
      setPeriodEnd(editingRow.periodEnd || editingRow.date);

      setMonthlyValue(editingRow.monthlyValue != null ? String(editingRow.monthlyValue) : '');
      setMonthCount(editingRow.monthCount != null ? String(editingRow.monthCount) : '');
      
      setIsBatch(false);
    } else {
      setDate(getTodayISO());
      setValue('');
      setDescription('');
      setEntryType('revenue');
      setIsPeriod(false);
      setPeriodStart(getTodayISO());
      setPeriodEnd(getTodayISO());
      setMonthlyValue('');
      setMonthCount('');
      setIsBatch(false);
      setBatchValues('');
      setIsSingleDescription(true);
      setIndividualDescriptions([]);
    }
    setError(null);
  }, [editingRow, visible]);

  // Dynamically parse values from batch input
  const parsedValues = useMemo(() => {
    if (!batchValues) return [];
    return batchValues
      .split(',')
      .map((s) => s.trim())
      .map((s) => parseFloat(s.replace(',', '.')))
      .filter((v) => !isNaN(v) && v > 0);
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
    const mVal = parseFloat(val.replace(',', '.'));
    const mCount = parseInt(monthCount, 10);
    if (!isNaN(mVal) && !isNaN(mCount)) {
      setValue(String(Math.round(mVal * mCount * 100) / 100));
    }
  };

  const handleMonthCountChange = (val: string) => {
    setMonthCount(val);
    const mVal = parseFloat(monthlyValue.replace(',', '.'));
    const mCount = parseInt(val, 10);
    if (!isNaN(mVal) && !isNaN(mCount)) {
      setValue(String(Math.round(mVal * mCount * 100) / 100));
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
          description: desc || undefined,
          entryType,
          periodStart: finalPeriodStart,
          periodEnd: finalPeriodEnd,
          monthlyValue: finalMonthlyValue,
          monthCount: finalMonthCount,
        };
      });

      onAdd(rows);
    } else {
      // Individual mode submission
      const numValue = parseFloat(value.replace(',', '.'));
      if (isNaN(numValue) || numValue <= 0) {
        setError('Insira um valor válido');
        return;
      }

      let finalMonthlyValue: number | undefined;
      let finalMonthCount: number | undefined;

      if (entryType === 'expense') {
        const mVal = parseFloat(monthlyValue.replace(',', '.'));
        const mCount = parseInt(monthCount, 10);
        if (!isNaN(mVal) && mVal > 0) {
          finalMonthlyValue = Math.round(mVal * 100) / 100;
        }
        if (!isNaN(mCount) && mCount > 0) {
          finalMonthCount = mCount;
        }
      }

      onAdd({
        date: finalDate,
        value: Math.round(numValue * 100) / 100,
        description: description.trim() || undefined,
        entryType,
        periodStart: finalPeriodStart,
        periodEnd: finalPeriodEnd,
        monthlyValue: finalMonthlyValue,
        monthCount: finalMonthCount,
      });
    }

    // Reset form
    setValue('');
    setDescription('');
    setEntryType('revenue');
    setDate(getTodayISO());
    setIsPeriod(false);
    setPeriodStart(getTodayISO());
    setPeriodEnd(getTodayISO());
    setMonthlyValue('');
    setMonthCount('');
    setIsBatch(false);
    setBatchValues('');
    setIsSingleDescription(true);
    setIndividualDescriptions([]);
    setError(null);
    onClose();
  };

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

            <Text style={styles.title}>{isEditMode ? '✏️ Editar Entrada' : 'Nova Entrada'}</Text>

            {/* Mode Selector */}
            {!isEditMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Modo de Entrada</Text>
                <View style={styles.toggleRow}>
                  <Pressable
                    style={[styles.toggleBtn, !isBatch && styles.toggleBtnActive]}
                    onPress={() => setIsBatch(false)}
                  >
                    <Text style={[styles.toggleBtnText, !isBatch && styles.toggleBtnTextActive]}>Individual</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toggleBtn, isBatch && styles.toggleBtnActive]}
                    onPress={() => setIsBatch(true)}
                  >
                    <Text style={[styles.toggleBtnText, isBatch && styles.toggleBtnTextActive]}>Em Lote</Text>
                  </Pressable>
                </View>
              </View>
            )}

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

            {/* Date Range Type Switcher */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Lançamento</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  style={[styles.toggleBtn, !isPeriod && styles.toggleBtnActive]}
                  onPress={() => setIsPeriod(false)}
                >
                  <Text style={[styles.toggleBtnText, !isPeriod && styles.toggleBtnTextActive]}>Data Única</Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleBtn, isPeriod && styles.toggleBtnActive]}
                  onPress={() => setIsPeriod(true)}
                >
                  <Text style={[styles.toggleBtnText, isPeriod && styles.toggleBtnTextActive]}>Período</Text>
                </Pressable>
              </View>
            </View>

            {/* Conditional Date Pickers */}
            {!isPeriod ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Data</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.text.disabled}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
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

            {/* Conditional Expense Sub-inputs (only for single or if months apply to batch) */}
            {entryType === 'expense' && (
              <View style={styles.rowInputs}>
                {!isBatch && (
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Valor Mensal (R$)</Text>
                    <TextInput
                      style={styles.input}
                      value={monthlyValue}
                      onChangeText={handleMonthlyValueChange}
                      placeholder="0,00"
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
                    onChangeText={setMonthCount}
                    placeholder="1"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}

            {/* Values input based on Mode */}
            {!isBatch ? (
              /* Total Value */
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {entryType === 'expense' && monthlyValue && monthCount ? 'Valor Total (Autocalculado)' : 'Valor (R$)'}
                </Text>
                <TextInput
                  style={[styles.input, styles.inputValue]}
                  value={value}
                  onChangeText={setValue}
                  placeholder="0,00"
                  placeholderTextColor={colors.text.disabled}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : (
              /* Batch Values list */
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Valores (separados por vírgula)</Text>
                <TextInput
                  style={[styles.input, styles.inputValue, styles.batchInput]}
                  value={batchValues}
                  onChangeText={setBatchValues}
                  placeholder="Ex: 50, 120.50, 80"
                  placeholderTextColor={colors.text.disabled}
                  multiline
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}

            {/* Description Mode Selector (Batch only) */}
            {isBatch && !isEditMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Descrição das Entradas</Text>
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
              /* Individual Descriptions fields */
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
});
