/**
 * Granular Export Modal — Assistente Moeda
 *
 * Sliced export interface allowing users to export transactions by parts:
 *   - Scope: All, Revenue only, Expense only, Deposit only, Partner only, Unresolved only
 *   - Format: Agent-Compact (token-friendly for LLM prompts), Standard CSV, or Backup v3
 *   - Time span: All history vs. active selected month
 * Includes instant clipboard copy and file share/download.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { TableRow, TableGoals, DynamicTableSchema, InvestorProfileConfig, ExportScopeType, ExportFormatType, SectorGroupId, WorkspaceDashboardConfig, SectorParamsConfig } from '@/core/types';
import { buildGranularCSV, shareGranularCSV } from '@/services/exportService';

interface GranularExportModalProps {
  visible: boolean;
  onClose: () => void;
  rows: TableRow[];
  tableName: string;
  selectedMonth?: string;
  goals?: TableGoals;
  tableId?: string;
  schema?: DynamicTableSchema;
  investorProfile?: InvestorProfileConfig;
  activeSectors?: SectorGroupId[];
  dashboardConfig?: WorkspaceDashboardConfig;
  sectorParams?: SectorParamsConfig;
}

export function GranularExportModal({
  visible,
  onClose,
  rows,
  tableName,
  selectedMonth,
  goals,
  tableId,
  schema,
  investorProfile,
  activeSectors,
  dashboardConfig,
  sectorParams,
}: GranularExportModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 650;

  const [scope, setScope] = useState<ExportScopeType>('all');
  const [format, setFormat] = useState<ExportFormatType>('agent_compact');
  const [useMonthFilter, setUseMonthFilter] = useState<boolean>(false);
  const [copiedStatus, setCopiedStatus] = useState<string>('');

  // Generate CSV text dynamically based on current options
  const generatedCSV = useMemo(() => {
    return buildGranularCSV(
      rows,
      {
        scope,
        format,
        selectedMonth: useMonthFilter && selectedMonth && selectedMonth !== 'all' ? selectedMonth : undefined,
      },
      tableName,
      undefined,
      goals,
      tableId,
      null,
      undefined,
      schema,
      investorProfile,
      activeSectors,
      dashboardConfig,
      sectorParams
    );
  }, [rows, scope, format, useMonthFilter, selectedMonth, tableName, goals, tableId, schema, investorProfile, activeSectors, dashboardConfig, sectorParams]);

  // Count items matching the current scope and month
  const matchingCount = useMemo(() => {
    let list = [...rows];
    if (scope === 'revenue') {
      list = list.filter((r) => !r.entryType || r.entryType === 'revenue');
    } else if (scope === 'expense') {
      list = list.filter((r) => r.entryType === 'expense');
    } else if (scope === 'deposit') {
      list = list.filter((r) => r.entryType === 'deposit');
    } else if (scope === 'partner') {
      list = list.filter((r) => r.entryType === 'partner_in' || r.entryType === 'partner_out');
    } else if (scope === 'unresolved') {
      list = list.filter((r) => r.entryType === 'unresolved');
    }

    if (useMonthFilter && selectedMonth && selectedMonth !== 'all') {
      list = list.filter((r) => r.date && r.date.startsWith(selectedMonth));
    }
    return list.length;
  }, [rows, scope, useMonthFilter, selectedMonth]);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(generatedCSV);
      setCopiedStatus('Copiado para a área de transferência! ✅');
      setTimeout(() => setCopiedStatus(''), 3000);
    } catch {
      Alert.alert('Erro', 'Não foi possível copiar o texto.');
    }
  };

  const handleShareFile = async () => {
    try {
      await shareGranularCSV(
        rows,
        tableName,
        {
          scope,
          format,
          selectedMonth: useMonthFilter && selectedMonth && selectedMonth !== 'all' ? selectedMonth : undefined,
        },
        goals,
        tableId,
        schema,
        investorProfile,
        activeSectors,
        dashboardConfig,
        sectorParams
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err.message || 'Falha ao gerar arquivo CSV.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isWide && styles.modalContainerWide]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📤 Exportação Granular por Partes</Text>
              <Text style={styles.subtitle}>
                Planilha: <Text style={{ color: colors.accent.purple, fontWeight: '700' }}>{tableName}</Text>
              </Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{matchingCount} itens filtrados</Text>
            </View>
          </View>

          {/* Scope Selector */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>1. O que você deseja exportar? (Escopo)</Text>
            <View style={styles.chipsRow}>
              {[
                { id: 'all', label: 'Tudo', icon: '🌐' },
                { id: 'revenue', label: 'Somente Receitas', icon: '🟢' },
                { id: 'expense', label: 'Somente Custos', icon: '🔴' },
                { id: 'deposit', label: 'Somente Aportes', icon: '🔵' },
                { id: 'partner', label: 'Parcerias', icon: '🤝' },
                { id: 'unresolved', label: 'Neutros/Pendentes', icon: '🟡' },
              ].map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.chip, scope === opt.id && styles.chipActive]}
                  onPress={() => setScope(opt.id as ExportScopeType)}
                >
                  <Text style={styles.chipText}>
                    {opt.icon} {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Format Selector */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>2. Formato de Destino</Text>
            <View style={styles.formatRow}>
              <Pressable
                style={[styles.formatCard, format === 'agent_compact' && styles.formatCardActive]}
                onPress={() => setFormat('agent_compact')}
              >
                <Text style={styles.formatIcon}>🤖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formatTitle}>Compacto para Agente IA</Text>
                  <Text style={styles.formatDesc}>
                    4-5 colunas essenciais. Economiza 70% de tokens ao colar no ChatGPT ou Claude.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[styles.formatCard, format === 'standard_csv' && styles.formatCardActive]}
                onPress={() => setFormat('standard_csv')}
              >
                <Text style={styles.formatIcon}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formatTitle}>CSV Tabular Padrão</Text>
                  <Text style={styles.formatDesc}>
                    Estrutura amigável para abrir no Excel, Numbers ou Google Planilhas.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[styles.formatCard, format === 'backup_v3' && styles.formatCardActive]}
                onPress={() => setFormat('backup_v3')}
              >
                <Text style={styles.formatIcon}>💾</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formatTitle}>Backup Completo v3</Text>
                  <Text style={styles.formatDesc}>
                    Contém metas hierárquicas, colunas personalizadas e perfis de investidor.
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Time Span Toggle */}
          {selectedMonth && selectedMonth !== 'all' && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>3. Intervalo de Tempo</Text>
              <View style={styles.chipsRow}>
                <Pressable
                  style={[styles.chip, !useMonthFilter && styles.chipActive]}
                  onPress={() => setUseMonthFilter(false)}
                >
                  <Text style={styles.chipText}>📅 Todo o Histórico</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, useMonthFilter && styles.chipActive]}
                  onPress={() => setUseMonthFilter(true)}
                >
                  <Text style={styles.chipText}>🗓️ Apenas o Mês ({selectedMonth})</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Code Textarea Preview */}
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Pré-visualização do Bloco de Texto CSV:</Text>
              {copiedStatus !== '' && (
                <Text style={styles.copiedBadge}>{copiedStatus}</Text>
              )}
            </View>
            <ScrollView style={styles.codeBox} nestedScrollEnabled>
              <Text style={styles.codeText}>{generatedCSV}</Text>
            </ScrollView>
          </View>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.btn, styles.btnCancel]}
              onPress={onClose}
            >
              <Text style={styles.btnCancelText}>Fechar</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnCopy]}
              onPress={handleCopy}
            >
              <Text style={styles.btnCopyText}>📋 Copiar Texto CSV</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnShare]}
              onPress={handleShareFile}
            >
              <Text style={styles.btnShareText}>📥 Baixar / Compartilhar</Text>
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
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.strong,
    borderWidth: 1,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 580,
    maxHeight: '92%',
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalContainerWide: {
    maxWidth: 720,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: spacing.sm,
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
  },
  metaBadge: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purple,
  },
  chipText: {
    fontSize: 11,
    color: colors.text.primary,
    fontWeight: '500',
  },
  formatRow: {
    flexDirection: 'column',
    gap: 6,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  formatCardActive: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
  formatIcon: {
    fontSize: 20,
  },
  formatTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  formatDesc: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 14,
    marginTop: 1,
  },
  previewContainer: {
    gap: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  copiedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success.main,
  },
  codeBox: {
    maxHeight: 110,
    backgroundColor: '#0a0d12',
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#a5d6ff',
    lineHeight: 14,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    flex: 0.5,
    backgroundColor: colors.background.tertiary,
  },
  btnCancelText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  btnCopy: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.accent.purple,
    borderWidth: 1,
  },
  btnCopyText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent.purple,
  },
  btnShare: {
    backgroundColor: colors.accent.purple,
  },
  btnShareText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
});
