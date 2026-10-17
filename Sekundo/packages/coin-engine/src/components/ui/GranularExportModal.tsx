/**
 * Granular Export & Manual AI-Analyst Synthesis Modal — Assistente Moeda
 *
 * Dual-mode export & synthesis center:
 *   1. 🧠 Síntese Manual AI-Analyst (Sem API):
 *      Generates the full pre-computed DRE, 8 Financial Skills, Advanced Statistics,
 *      Accrual Category Anatomy, Time Bank, and 4-Tier Cascade Ledger in .md, .xml, or .json
 *      for direct copy/paste or file upload into any external AI (ChatGPT, Claude, Gemini, DeepSeek).
 *   2. 🧩 Exportar CSV por Partes:
 *      Sliced CSV export by scope (All, Revenue, Expense, Deposit, Partner, Unresolved)
 *      and format (Agent-Compact, Standard CSV, Backup v3).
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type {
  TableRow,
  TableGoals,
  DynamicTableSchema,
  InvestorProfileConfig,
  ExportScopeType,
  ExportFormatType,
  SectorGroupId,
  WorkspaceDashboardConfig,
  SectorParamsConfig,
} from '@coin/core/types';
import {
  generateManualAiAnalystSynthesis,
  type ManualSynthesisFormat,
  type ManualSynthesisProfile,
} from '@coin/core/localAiAnalystSynthesizer';
import {
  buildGranularCSV,
  shareGranularCSV,
  shareSynthesisDocument,
} from '@coin/services/exportService';

const PREVIEW_CHAR_CAP = 15_000;

const DEFAULT_GOALS: TableGoals = {
  dailyGoals: {},
  weeklyGoals: {},
  annualCosts: {},
};

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
  initialMode?: 'ai_analyst' | 'csv';
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
  initialMode = 'ai_analyst',
}: GranularExportModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 650;

  // Top-level mode tab
  const [activeMode, setActiveMode] = useState<'ai_analyst' | 'csv'>(initialMode);

  // AI-Analyst Manual Synthesis states
  const [synthFormat, setSynthFormat] = useState<ManualSynthesisFormat>('ai_analyst_full_md');
  const [synthProfile, setSynthProfile] = useState<ManualSynthesisProfile>('native');
  const [anonymizeDescriptions, setAnonymizeDescriptions] = useState<boolean>(true);
  const [userCustomPrompt, setUserCustomPrompt] = useState<string>('');

  // Granular CSV states
  const [scope, setScope] = useState<ExportScopeType>('all');
  const [format, setFormat] = useState<ExportFormatType>('agent_compact');
  const [useMonthFilter, setUseMonthFilter] = useState<boolean>(false);
  const [copiedStatus, setCopiedStatus] = useState<string>('');

  // Generate Manual AI-Analyst Synthesis dynamically
  const synthesisResult = useMemo(() => {
    if (activeMode !== 'ai_analyst') return null;
    return generateManualAiAnalystSynthesis(
      rows,
      goals || DEFAULT_GOALS,
      tableName,
      {
        format: synthFormat,
        profile: synthProfile,
        anonymizeDescriptions,
        selectedMonth:
          useMonthFilter && selectedMonth && selectedMonth !== 'all'
            ? selectedMonth
            : undefined,
        userCustomPrompt,
        investorProfile,
        activeSectors,
        sectorParams,
      },
    );
  }, [
    activeMode,
    rows,
    goals,
    tableName,
    synthFormat,
    synthProfile,
    anonymizeDescriptions,
    useMonthFilter,
    selectedMonth,
    userCustomPrompt,
    investorProfile,
    activeSectors,
    sectorParams,
  ]);

  // Generate CSV text dynamically based on current options
  const generatedCSV = useMemo(() => {
    if (activeMode !== 'csv') return '';
    return buildGranularCSV(
      rows,
      {
        scope,
        format,
        selectedMonth:
          useMonthFilter && selectedMonth && selectedMonth !== 'all'
            ? selectedMonth
            : undefined,
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
      sectorParams,
    );
  }, [
    activeMode,
    rows,
    scope,
    format,
    useMonthFilter,
    selectedMonth,
    tableName,
    goals,
    tableId,
    schema,
    investorProfile,
    activeSectors,
    dashboardConfig,
    sectorParams,
  ]);

  // Count items matching the current scope and month
  const matchingCount = useMemo(() => {
    let list = [...rows];
    if (activeMode === 'csv') {
      if (scope === 'revenue') {
        list = list.filter((r) => !r.entryType || r.entryType === 'revenue');
      } else if (scope === 'expense') {
        list = list.filter((r) => r.entryType === 'expense');
      } else if (scope === 'deposit') {
        list = list.filter((r) => r.entryType === 'deposit');
      } else if (scope === 'partner') {
        list = list.filter(
          (r) => r.entryType === 'partner_in' || r.entryType === 'partner_out',
        );
      } else if (scope === 'unresolved') {
        list = list.filter((r) => r.entryType === 'unresolved');
      }
    }

    if (useMonthFilter && selectedMonth && selectedMonth !== 'all') {
      list = list.filter((r) => r.date && r.date.startsWith(selectedMonth));
    }
    return list.length;
  }, [activeMode, rows, scope, useMonthFilter, selectedMonth]);

  const activeText =
    activeMode === 'ai_analyst' ? synthesisResult?.content || '' : generatedCSV;

  const previewText = useMemo(() => {
    if (activeText.length <= PREVIEW_CHAR_CAP) return activeText;
    return (
      activeText.slice(0, PREVIEW_CHAR_CAP) +
      `\n\n... [Pré-visualização truncada em ${PREVIEW_CHAR_CAP.toLocaleString(
        'pt-BR',
      )} caracteres para fluidez da tela. O botão Copiar ou Baixar entregará 100% dos ${activeText.length.toLocaleString(
        'pt-BR',
      )} caracteres completos!]`
    );
  }, [activeText]);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(activeText);
      const label =
        activeMode === 'ai_analyst'
          ? `Síntese .${synthesisResult?.metadata.extension || 'md'} copiada! Cole direto na sua IA ✅`
          : 'Copiado para a área de transferência! ✅';
      setCopiedStatus(label);
      setTimeout(() => setCopiedStatus(''), 3200);
    } catch {
      Alert.alert('Erro', 'Não foi possível copiar o texto.');
    }
  };

  const handleShareFile = async () => {
    try {
      if (activeMode === 'ai_analyst' && synthesisResult) {
        await shareSynthesisDocument(
          synthesisResult.content,
          tableName,
          synthesisResult.metadata.extension,
        );
        return;
      }

      await shareGranularCSV(
        rows,
        tableName,
        {
          scope,
          format,
          selectedMonth:
            useMonthFilter && selectedMonth && selectedMonth !== 'all'
              ? selectedMonth
              : undefined,
        },
        goals,
        tableId,
        schema,
        investorProfile,
        activeSectors,
        dashboardConfig,
        sectorParams,
      );
      onClose();
    } catch (err: any) {
      Alert.alert(
        'Erro ao exportar',
        err.message || 'Falha ao gerar arquivo para exportação.',
      );
    }
  };

  const kbSize = synthesisResult
    ? (synthesisResult.metadata.byteSize / 1024).toFixed(1)
    : (activeText.length / 1024).toFixed(1);
  const estTokens = synthesisResult
    ? synthesisResult.metadata.estimatedTokens.toLocaleString('pt-BR')
    : Math.ceil(activeText.length / 4).toLocaleString('pt-BR');

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
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {activeMode === 'ai_analyst'
                  ? '🧠 Extrator de Rotas API & Síntese IA (Planilha Atual)'
                  : '📤 Exportação Granular CSV da Planilha Atual'}
              </Text>
              <Text style={styles.subtitle}>
                Planilha Ativa no Navegador:{' '}
                <Text style={{ color: colors.accent.purple, fontWeight: '700' }}>
                  {tableName} ({rows.length} lançamentos)
                </Text>
              </Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>
                {activeMode === 'ai_analyst'
                  ? `${kbSize} KB • ~${estTokens} tok • Tier ${synthesisResult?.metadata.ledgerTier || 1}`
                  : `${matchingCount} itens filtrados`}
              </Text>
            </View>
          </View>

          {/* Live Active Spreadsheet Guarantee Banner */}
          <View
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 11, color: '#6ee7b7', lineHeight: 15 }}>
              📡 <Text style={{ fontWeight: '800' }}>Extração em Tempo Real da Planilha Atual ({tableName}):</Text>{' '}
              Este painel lê os <Text style={{ fontWeight: '800' }}>{rows.length} lançamentos</Text> que estão abertos agora no seu navegador (não é modelo fictício). Ele compila localmente todas as rotas da chave API (<Text style={{ fontWeight: '700' }}>/agent-prompt</Text>, <Text style={{ fontWeight: '700' }}>/ai-analyst</Text>, <Text style={{ fontWeight: '700' }}>/analysis-context</Text>, <Text style={{ fontWeight: '700' }}>/summary</Text>, <Text style={{ fontWeight: '700' }}>/transactions</Text> + <Text style={{ fontWeight: '700' }}>Relatório WhatsApp</Text>) em texto pronto para copiar ou baixar.
            </Text>
          </View>

          {/* Top-Level Mode Switcher */}
          <View style={styles.modeTabsRow}>
            <Pressable
              style={[
                styles.modeTab,
                activeMode === 'ai_analyst' && styles.modeTabActive,
              ]}
              onPress={() => setActiveMode('ai_analyst')}
            >
              <Text
                style={[
                  styles.modeTabText,
                  activeMode === 'ai_analyst' && styles.modeTabTextActive,
                ]}
              >
                🧠 Rotas API & AI-Analyst (.md / .xml / .json)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, activeMode === 'csv' && styles.modeTabActive]}
              onPress={() => setActiveMode('csv')}
            >
              <Text
                style={[
                  styles.modeTabText,
                  activeMode === 'csv' && styles.modeTabTextActive,
                ]}
              >
                🧩 Exportar CSV da Planilha Atual
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 460 }}
            contentContainerStyle={{ gap: spacing.sm }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {activeMode === 'ai_analyst' ? (
              <>
                {/* 1. Formato da Síntese */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>
                    1. Escolha o Formato de Extração das Rotas da API (Planilha Atual)
                  </Text>
                  <View style={styles.formatRow}>
                    {[
                      {
                        id: 'ai_analyst_full_md',
                        icon: '📄',
                        title: 'Dossiê Completo AI-Analyst + WhatsApp + Rotas API (.md) — Recomendado',
                        desc: 'Imita a chave API completa da sua planilha atual: /agent-prompt (8 Skills) + /ai-analyst (DRE, Mediana, Moda, DP, Categorias por Competência, Banco de Tempo) + Relatório WhatsApp + /transactions.',
                      },
                      {
                        id: 'ai_analyst_xml',
                        icon: '🧬',
                        title: 'XML Semântico Estruturado da Planilha Atual (.xml)',
                        desc: 'Tags XML (<dre_synthesis>, <statistical_distribution>, <accrual_categories>, <whatsapp_executive_report>) otimizadas para Claude, o1/o3 e DeepSeek-R1.',
                      },
                      {
                        id: 'analysis_context_md',
                        icon: '📊',
                        title: 'Contexto Analítico + Relatório WhatsApp (.md — Rota /analysis-context)',
                        desc: 'Apenas os dados contábeis, estatísticos e relatório WhatsApp da sua planilha atual em Markdown puro (sem System Prompt).',
                      },
                      {
                        id: 'api_routes_bundle_json',
                        icon: '📦',
                        title: 'Todas as Rotas da Chave API em JSON (.json)',
                        desc: 'Extrai /api/v1/public/agent-prompt, /ai-analyst, /analysis-context, /whatsapp-report, /summary, /transactions e /spreadsheet/export da sua planilha atual.',
                      },
                    ].map((opt) => (
                      <Pressable
                        key={opt.id}
                        style={[
                          styles.formatCard,
                          synthFormat === opt.id && styles.formatCardActive,
                        ]}
                        onPress={() =>
                          setSynthFormat(opt.id as ManualSynthesisFormat)
                        }
                      >
                        <Text style={styles.formatIcon}>{opt.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.formatTitle}>{opt.title}</Text>
                          <Text style={styles.formatDesc}>{opt.desc}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* 2. Perfil Especialista do Agente */}
                {synthFormat !== 'analysis_context_md' && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>
                      2. Perfil Especialista do Agente (System Prompt Embarcado)
                    </Text>
                    <View style={styles.chipsRow}>
                      {[
                        { id: 'native', label: '🌟 Agent Native (8 Skills)' },
                        { id: 'cfo', label: '🏛️ CFO & FP&A (Aula Executiva)' },
                        { id: 'operational', label: '⚡ Operacional & God Mode' },
                        { id: 'goals', label: '🎯 Metas & Banco de Tempo' },
                        { id: 'dev', label: '🛠️ Agente Dev & Auditoria' },
                      ].map((prof) => (
                        <Pressable
                          key={prof.id}
                          style={[
                            styles.chip,
                            synthProfile === prof.id && styles.chipActive,
                          ]}
                          onPress={() =>
                            setSynthProfile(prof.id as ManualSynthesisProfile)
                          }
                        >
                          <Text style={styles.chipText}>{prof.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* 3. Privacidade & Intervalo de Tempo */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>
                    3. Privacidade (LGPD) & Escopo Temporal
                  </Text>
                  <View style={styles.chipsRow}>
                    <Pressable
                      style={[
                        styles.chip,
                        !anonymizeDescriptions && styles.chipActive,
                      ]}
                      onPress={() => setAnonymizeDescriptions(false)}
                    >
                      <Text style={styles.chipText}>🔓 Descrições Reais da Planilha</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.chip,
                        anonymizeDescriptions && styles.chipActive,
                      ]}
                      onPress={() => setAnonymizeDescriptions(true)}
                    >
                      <Text style={styles.chipText}>
                        🛡️ Anonimizar Descrições (LGPD / Modo Rua)
                      </Text>
                    </Pressable>

                    {selectedMonth && selectedMonth !== 'all' && (
                      <>
                        <Pressable
                          style={[
                            styles.chip,
                            !useMonthFilter && styles.chipActive,
                          ]}
                          onPress={() => setUseMonthFilter(false)}
                        >
                          <Text style={styles.chipText}>📅 Todo o Histórico</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.chip,
                            useMonthFilter && styles.chipActive,
                          ]}
                          onPress={() => setUseMonthFilter(true)}
                        >
                          <Text style={styles.chipText}>
                            🗓️ Apenas {selectedMonth}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>

                {/* 4. Comando / Dúvida Opcional para a IA */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>
                    4. Sua Dúvida ou Objetivo Atual (Opcional — será incluído no final do arquivo)
                  </Text>
                  <TextInput
                    style={styles.promptInput}
                    placeholder="Ex: Analise meus gastos deste mês, calcule meu ponto de equilíbrio e me diga onde cortar 15%..."
                    placeholderTextColor={colors.text.tertiary}
                    value={userCustomPrompt}
                    onChangeText={setUserCustomPrompt}
                    multiline
                  />
                </View>
              </>
            ) : (
              <>
                {/* CSV Scope Selector */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>
                    1. O que você deseja exportar da planilha "{tableName}"? (Escopo)
                  </Text>
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

                {/* CSV Format Selector */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>2. Formato de Destino</Text>
                  <View style={styles.formatRow}>
                    <Pressable
                      style={[
                        styles.formatCard,
                        format === 'agent_compact' && styles.formatCardActive,
                      ]}
                      onPress={() => setFormat('agent_compact')}
                    >
                      <Text style={styles.formatIcon}>🤖</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formatTitle}>
                          Compacto para Agente IA
                        </Text>
                        <Text style={styles.formatDesc}>
                          4-5 colunas essenciais da sua planilha atual. Economiza 70% de tokens.
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.formatCard,
                        format === 'standard_csv' && styles.formatCardActive,
                      ]}
                      onPress={() => setFormat('standard_csv')}
                    >
                      <Text style={styles.formatIcon}>📊</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formatTitle}>CSV Tabular Padrão</Text>
                        <Text style={styles.formatDesc}>
                          Estrutura amigável para abrir no Excel, Numbers ou Google
                          Planilhas.
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.formatCard,
                        format === 'backup_v3' && styles.formatCardActive,
                      ]}
                      onPress={() => setFormat('backup_v3')}
                    >
                      <Text style={styles.formatIcon}>💾</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formatTitle}>Backup Completo v3</Text>
                        <Text style={styles.formatDesc}>
                          Contém metas hierárquicas, colunas personalizadas e perfis de
                          investidor da planilha atual.
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
                        <Text style={styles.chipText}>
                          🗓️ Apenas o Mês ({selectedMonth})
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* WhatsApp-style Multiline Text Preview of the Active Spreadsheet */}
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>
                  {activeMode === 'ai_analyst'
                    ? `📝 Texto Extraído da Planilha "${tableName}" (.${synthesisResult?.metadata.extension || 'md'} — Igual à Exportação WhatsApp):`
                    : `📝 Texto CSV Extraído da Planilha "${tableName}":`}
                </Text>
                {copiedStatus !== '' && (
                  <Text style={styles.copiedBadge}>{copiedStatus}</Text>
                )}
              </View>
              <TextInput
                style={[styles.codeBox, styles.codeText, { height: 180, textAlignVertical: 'top' }]}
                multiline
                value={previewText}
                editable={false}
                selectTextOnFocus
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
              <Text style={styles.btnCancelText}>Fechar</Text>
            </Pressable>

            <Pressable style={[styles.btn, styles.btnCopy]} onPress={handleCopy}>
              <Text style={styles.btnCopyText}>
                {activeMode === 'ai_analyst'
                  ? `📋 Copiar Texto da Planilha (.${synthesisResult?.metadata.extension || 'md'})`
                  : '📋 Copiar Texto CSV'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnShare]}
              onPress={handleShareFile}
            >
              <Text style={styles.btnShareText}>
                {activeMode === 'ai_analyst'
                  ? `📥 Baixar .${(synthesisResult?.metadata.extension || 'md').toUpperCase()}`
                  : '📥 Baixar / Compartilhar'}
              </Text>
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
    maxWidth: 600,
    maxHeight: '94%',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalContainerWide: {
    maxWidth: 760,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    fontSize: 15,
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
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.background.secondary,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.accent.purple,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modeTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
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
  promptInput: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 11,
    color: colors.text.primary,
    minHeight: 46,
    textAlignVertical: 'top',
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
    maxHeight: 130,
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
    flex: 0.45,
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

