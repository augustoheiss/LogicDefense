/**
 * Column Mapping Workbench Modal — Assistente Moeda
 *
 * Interactive configuration modal where users can manually inspect,
 * reclassify, and fine-tune dynamic table columns, data types, and
 * semantic roles before or after loading data into local storage.
 *
 * Features:
 *   - Visual role picker (Date, Amount, Description, Category, Ticker, Quantity, etc.)
 *   - Type switcher (money, date, ticker, text, number, category)
 *   - Credit card expense sign inverter (invertSign toggle)
 *   - Visibility toggle (show/hide columns on the main table)
 *   - 100% saved locally to browser AsyncStorage (local-first)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Switch,
  TextInput,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { DynamicTableSchema, DynamicColumnDefinition, ColumnSemanticRole, ColumnDataType } from '@/core/types';

interface ColumnMappingWorkbenchModalProps {
  visible: boolean;
  onClose: () => void;
  schema: DynamicTableSchema;
  sampleData?: Record<string, string>[];
  onSaveSchema: (updatedSchema: DynamicTableSchema) => void;
}

const AVAILABLE_ROLES: Array<{ role: ColumnSemanticRole; label: string; icon: string }> = [
  { role: 'primary_date', label: 'Data Principal', icon: '📅' },
  { role: 'primary_amount', label: 'Valor Monetário', icon: '💰' },
  { role: 'primary_description', label: 'Descrição / Histórico', icon: '📝' },
  { role: 'entry_type', label: 'Tipo (Receita/Despesa)', icon: '🏷️' },
  { role: 'category', label: 'Categoria', icon: '📂' },
  { role: 'invest_ticker', label: 'Ativo / Ticker (B3/Cripto)', icon: '📈' },
  { role: 'invest_quantity', label: 'Quantidade de Cotas', icon: '🔢' },
  { role: 'invest_unit_price', label: 'Preço Unitário', icon: '💲' },
  { role: 'tags', label: 'Etiquetas / Setor', icon: '🔖' },
  { role: 'period_start', label: 'Início do Período', icon: '⏳' },
  { role: 'period_end', label: 'Fim do Período', icon: '⌛' },
  { role: 'custom_attribute', label: 'Atributo Livre (Info)', icon: 'ℹ️' },
];

const AVAILABLE_TYPES: Array<{ type: ColumnDataType; label: string }> = [
  { type: 'money', label: 'Moeda (R$)' },
  { type: 'date', label: 'Data' },
  { type: 'ticker', label: 'Ticker' },
  { type: 'category', label: 'Categoria' },
  { type: 'entryType', label: 'Tipo' },
  { type: 'number', label: 'Número' },
  { type: 'quantity', label: 'Qtd' },
  { type: 'text', label: 'Texto' },
];

export function ColumnMappingWorkbenchModal({
  visible,
  onClose,
  schema,
  sampleData = [],
  onSaveSchema,
}: ColumnMappingWorkbenchModalProps) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;

  const [columns, setColumns] = useState<DynamicColumnDefinition[]>(schema.columns || []);

  useEffect(() => {
    if (schema?.columns) {
      setColumns([...schema.columns]);
    }
  }, [schema]);

  const handleUpdateCol = (id: string, updates: Partial<DynamicColumnDefinition>) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, ...updates } : col))
    );
  };

  const handleToggleInvertSign = (id: string, current: boolean) => {
    setColumns((prev) =>
      prev.map((col) => {
        if (col.id !== id) return col;
        return {
          ...col,
          transformRule: {
            ...col.transformRule,
            invertSign: !current,
          },
        };
      })
    );
  };

  const handleSave = () => {
    const updatedSchema: DynamicTableSchema = {
      ...schema,
      columns,
      updatedAt: new Date().toISOString(),
    };
    onSaveSchema(updatedSchema);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, isWide && styles.modalCardWide, { maxHeight: height * 0.9 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>⚙️ Configurador Dinâmico de Colunas</Text>
              <Text style={styles.subtitle}>
                Ajuste os papéis contábeis e tipos de dados. Suas preferências são salvas localmente no navegador.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* List of Columns */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {columns.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhuma coluna detectada nesta planilha.</Text>
              </View>
            ) : (
              columns.map((col, idx) => {
                const sampleValues = sampleData
                  .map((row) => row[col.originalHeader] || row[col.id] || '')
                  .filter((v) => v.length > 0)
                  .slice(0, 3)
                  .join(' · ');

                const isInverted = !!col.transformRule?.invertSign;

                return (
                  <View key={col.id} style={styles.columnCard}>
                    {/* Column Header & Sample */}
                    <View style={styles.columnCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.colNameRow}>
                          <Text style={styles.colIndexBadge}>#{idx + 1}</Text>
                          <TextInput
                            style={styles.colLabelInput}
                            value={col.label}
                            onChangeText={(text) => handleUpdateCol(col.id, { label: text })}
                            placeholder="Rótulo da Coluna"
                            placeholderTextColor={colors.text.disabled}
                          />
                          <Text style={styles.origHeaderLabel}>orig: {col.originalHeader}</Text>
                        </View>
                        {sampleValues ? (
                          <Text style={styles.sampleText} numberOfLines={1}>
                            Amostra: {sampleValues}
                          </Text>
                        ) : null}
                      </View>

                      {/* Visible switch */}
                      <View style={styles.switchWrapper}>
                        <Text style={styles.switchLabel}>{col.visible ? 'Visível' : 'Oculto'}</Text>
                        <Switch
                          value={col.visible}
                          onValueChange={(val) => handleUpdateCol(col.id, { visible: val })}
                          trackColor={{ false: colors.border.default, true: colors.accent.purple }}
                        />
                      </View>
                    </View>

                    {/* Role Picker (horizontal scroll) */}
                    <Text style={styles.fieldSectionLabel}>Papel Semântico:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                      {AVAILABLE_ROLES.map((r) => {
                        const isSelected = col.role === r.role;
                        return (
                          <Pressable
                            key={r.role}
                            onPress={() => handleUpdateCol(col.id, { role: r.role })}
                            style={[styles.chip, isSelected && styles.chipSelected]}
                          >
                            <Text style={styles.chipIcon}>{r.icon}</Text>
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                              {r.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {/* Type Selector & Invert Sign Options */}
                    <View style={styles.typeOptionsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldSectionLabel}>Tipo de Dado:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                          {AVAILABLE_TYPES.map((t) => {
                            const isSelected = col.dataType === t.type;
                            return (
                              <Pressable
                                key={t.type}
                                onPress={() => handleUpdateCol(col.id, { dataType: t.type })}
                                style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                              >
                                <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                                  {t.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>

                      {/* Invert Sign Toggle (for money amounts) */}
                      {(col.dataType === 'money' || col.role === 'primary_amount') && (
                        <View style={styles.invertSignContainer}>
                          <Text style={styles.fieldSectionLabel}>Inverter Sinal (+ / -):</Text>
                          <Pressable
                            onPress={() => handleToggleInvertSign(col.id, isInverted)}
                            style={[styles.invertBtn, isInverted && styles.invertBtnActive]}
                          >
                            <Text style={[styles.invertBtnText, isInverted && styles.invertBtnTextActive]}>
                              {isInverted ? '⇅ Invertendo (Despesa Cartão)' : 'Normal (Sinal Original)'}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Salvar no Navegador & Aplicar</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.lg,
    width: '100%',
    overflow: 'hidden',
  },
  modalCardWide: {
    maxWidth: 840,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.background.tertiary,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
    maxWidth: 620,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.text.secondary,
    fontSize: 18,
    fontWeight: '600',
  },
  scrollArea: {
    padding: spacing.md,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  columnCard: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  columnCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  colNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  colIndexBadge: {
    backgroundColor: colors.background.tertiary,
    color: colors.accent.purple,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  colLabelInput: {
    backgroundColor: colors.background.tertiary,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    minWidth: 140,
  },
  origHeaderLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  sampleText: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 4,
  },
  switchWrapper: {
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  fieldSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.default,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    marginRight: 6,
  },
  chipSelected: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purpleLight,
  },
  chipIcon: {
    fontSize: 12,
  },
  chipText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  typeOptionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: 4,
  },
  typeChip: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.default,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginRight: 6,
  },
  typeChipSelected: {
    borderColor: colors.success.main,
    backgroundColor: colors.success.light,
  },
  typeChipText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  typeChipTextSelected: {
    color: colors.success.main,
    fontWeight: '700',
  },
  invertSignContainer: {
    alignItems: 'flex-end',
  },
  invertBtn: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.default,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  invertBtnActive: {
    backgroundColor: colors.warning.light,
    borderColor: colors.warning.main,
  },
  invertBtnText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  invertBtnTextActive: {
    color: colors.warning.main,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.tertiary,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
