import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { useCoinDB } from '../hooks/useCoinDB';
import { useImportPipeline } from '../hooks/useImportPipeline';
import {
  ImportCancelledError,
  mapImportErrorToDiagnostics,
} from '../services/importPipelineContract';
import { parseCSVTextAsync } from '../utils/csvEngine';
import type { TableRow } from '../core/types';
import { CSVStagingReviewModal } from './ui/CSVStagingReviewModal';
import { ImportProgressModal } from './ui/ImportProgressModal';
import { SearchableVerticalFilter } from './ui/SearchableVerticalFilter';
import { EXAMPLE_CSV_PROFILES, ExampleCSVProfile } from '../data/exampleCsvProfiles';

interface CSVImporterProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialCsvText?: string;
  onOpenExamplesGallery?: () => void;
  /** Permite montar overlays (staging/progress) como irmãos de modais externos, evitando Modal aninhado. */
  renderContainer?: (params: {
    body: React.ReactNode;
    overlays: React.ReactNode;
    hasActiveOverlayModal: boolean;
  }) => React.ReactNode;
}

export function CSVImporter({
  onSuccess,
  onCancel,
  initialCsvText,
  onOpenExamplesGallery,
  renderContainer,
}: CSVImporterProps) {
  const { importSpreadsheet, activeTable, updateActiveSectors } = useCoinDB() as any;
  const importPipeline = useImportPipeline();
  const pendingSuccessRef = useRef<boolean>(false);
  const [csvText, setCsvText] = useState(initialCsvText || '');
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [presetType, setPresetType] = useState<'auto' | 'expense' | 'revenue' | 'deposit' | 'unresolved'>('auto');

  useEffect(() => {
    if (initialCsvText) {
      setCsvText(initialCsvText);
    }
  }, [initialCsvText]);

  // Staging Review State for ambiguous or partial agent imports
  const [stagingData, setStagingData] = useState<{
    rows: TableRow[];
    metadata?: any;
    detectedSectors?: string[];
    isAmbiguous?: boolean;
    mode: 'merge' | 'replace' | 'new';
  } | null>(null);
  const [showStagingModal, setShowStagingModal] = useState(false);

  const handleLoadExampleIntoEditor = (profile: ExampleCSVProfile) => {
    setSelectedExampleId(profile.id);
    setCsvText(profile.fullBackupV3Csv);
    setErrorLogs([]);
    setStatusMsg(
      `${profile.emoji} Modelo "${profile.shortTitle}" (100% fictício) carregado no editor! Você pode editá-lo ou clicar em "🆕 Nova Planilha" abaixo.`
    );
  };

  const handleCopyPromptForSelected = async () => {
    const profile =
      EXAMPLE_CSV_PROFILES.find((p) => p.id === selectedExampleId) ||
      EXAMPLE_CSV_PROFILES[7]; // Default to 08 Universal AI Template
    try {
      await Clipboard.setStringAsync(profile.aiBuilderPrompt);
      setStatusMsg(
        `🤖 Prompt + Modelo (${profile.shortTitle}) copiado! Cole na sua IA com seus dados reais.`
      );
    } catch {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(profile.aiBuilderPrompt);
        setStatusMsg(
          `🤖 Prompt + Modelo (${profile.shortTitle}) copiado! Cole na sua IA com seus dados reais.`
        );
      }
    }
  };

  const commitRows = async (
    rowsToCommit: (TableRow | Omit<TableRow, 'id'>)[],
    metadata?: any,
    detectedSectors?: string[],
    importMode: 'merge' | 'replace' | 'new' = 'merge',
    tablePartitions?: Array<{
      tableId: string;
      rows: (TableRow | Omit<TableRow, 'id'>)[];
      metadata: any;
      detectedSectors: string[];
    }>
  ) => {
    setIsProcessing(true);
    const targetLabel = metadata?.name || activeTable?.name || 'planilha_colada.csv';
    try {
      await importPipeline.run(
        {
          fileName: targetLabel,
          initialStage: 'saving_storage',
          initialDetail: 'Gravando transações importadas no cofre local...',
        },
        async ({ signal, reportProgress }) => {
          if (tablePartitions && tablePartitions.length > 1) {
            let lastImportRes: any = null;
            const totalParts = tablePartitions.length;
            for (let i = 0; i < totalParts; i++) {
              const part = tablePartitions[i];
              const partSectors = Array.from(
                new Set([
                  ...(part.metadata?.activeSectors || []),
                  ...(part.detectedSectors || []),
                ])
              );
              reportProgress({
                stage: 'saving_storage',
                stageLabel: `Gravando partição ${i + 1} de ${totalParts}...`,
                detailLabel: part.metadata?.name || part.tableId,
                processedCount: i,
                totalCount: totalParts,
                percent: Math.round(((i + 0.5) / totalParts) * 90),
              });
              lastImportRes = await importSpreadsheet({
                rows: part.rows,
                tableId: importMode === 'new' ? undefined : part.tableId,
                apiKey: part.metadata?.apiKey,
                lastEventSeq: part.metadata?.lastEventSeq,
                name: part.metadata?.name,
                description: part.metadata?.description,
                goals: part.metadata?.goals || part.metadata?.tableGoals,
                mode: importMode,
                isolateByTableId: importMode !== 'new',
                schema: part.metadata?.schema,
                investorProfile: part.metadata?.investorProfile,
                activeSectors: partSectors.length > 0 ? partSectors : undefined,
                dashboardConfig: part.metadata?.dashboardConfig,
                sectorParams: part.metadata?.sectorParams,
                signal,
                strictPersistence: true,
                onProgress: (p: any) => reportProgress(p),
              });
            }

            setCsvText('');
            pendingSuccessRef.current = true;

            reportProgress({
              stage: 'opening_table',
              stageLabel: 'Preparando e abrindo planilhas...',
              percent: 100,
            });

            const tableNames = tablePartitions.map((p) => `"${p.metadata?.name || p.tableId}"`).join(', ');
            let successMsg = `${rowsToCommit.length} transações foram distribuídas em ${tablePartitions.length} planilhas financeiras separadas (${tableNames}).`;
            if (lastImportRes?.keyWasAutoRenewed) {
              successMsg += ' Chaves API locais atualizadas automaticamente.';
            }
            setStatusMsg(successMsg);
            return {
              result: lastImportRes,
              summary: successMsg,
              importedCount: rowsToCommit.length,
            };
          }

          const mergedSectors = Array.from(
            new Set([
              ...(metadata?.activeSectors || []),
              ...(detectedSectors || []),
            ])
          );

          const importRes = await importSpreadsheet({
            rows: rowsToCommit,
            tableId: importMode === 'new' ? undefined : metadata?.tableId,
            apiKey: metadata?.apiKey,
            lastEventSeq: metadata?.lastEventSeq,
            name: metadata?.name,
            description: metadata?.description,
            goals: metadata?.goals || metadata?.tableGoals,
            mode: importMode,
            schema: metadata?.schema,
            investorProfile: metadata?.investorProfile,
            activeSectors: mergedSectors.length > 0 ? mergedSectors : undefined,
            dashboardConfig: metadata?.dashboardConfig,
            sectorParams: metadata?.sectorParams,
            signal,
            strictPersistence: true,
            onProgress: (p: any) => reportProgress(p),
          });

          if (importMode !== 'new' && mergedSectors.length > 0) {
            const currentActiveSectors = activeTable?.activeSectors || ['personal_finance'];
            const nextSectors = Array.from(new Set([...currentActiveSectors, ...mergedSectors]));
            try {
              await updateActiveSectors(nextSectors);
            } catch (secErr) {
              console.warn('[Import Warning]: Skipped sectors update', secErr);
            }
          }

          setCsvText('');
          pendingSuccessRef.current = true;

          reportProgress({
            stage: 'opening_table',
            stageLabel: 'Preparando e abrindo planilha...',
            percent: 100,
          });

          const activeTableName = metadata?.name || activeTable?.name || 'Ativa';
          const modeLabel =
            importMode === 'new'
              ? 'carregadas em uma NOVA planilha'
              : importMode === 'merge'
              ? 'acumuladas'
              : 'carregadas (substituição)';
          let successMsg = `${rowsToCommit.length} transações foram ${modeLabel} ("${activeTableName}").`;
          if (importRes?.keyWasAutoRenewed) {
            successMsg += ' Planilha restaurada com sucesso! Uma nova Chave API ativa foi gerada.';
          }
          setStatusMsg(successMsg);
          return {
            result: importRes,
            summary: successMsg,
            importedCount: rowsToCommit.length,
          };
        }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (importMode: 'merge' | 'replace' | 'new' = 'merge') => {
    if (!csvText.trim()) {
      setErrorLogs(['Por favor, cole um conteúdo CSV válido ou selecione um dos exemplos abaixo.']);
      return;
    }

    setIsProcessing(true);
    setErrorLogs([]);
    setStatusMsg('');

    try {
      const parseOptions = presetType !== 'auto' ? { forceEntryType: presetType } : undefined;
      let pendingStaging: {
        rows: TableRow[];
        metadata?: any;
        detectedSectors?: string[];
        isAmbiguous?: boolean;
        mode: 'merge' | 'replace' | 'new';
      } | null = null;
      let parsedForCommit: any = null;

      await importPipeline.run(
        {
          fileName: 'texto_csv_colado.csv',
          sizeBytes: csvText.length,
          initialStage: 'parsing_rows',
          initialDetail: 'Processando texto CSV em lotes cooperativos...',
        },
        async ({ signal, reportProgress, requestWarningReview }) => {
          const parsed = await parseCSVTextAsync(csvText, parseOptions, {
            signal,
            onProgress: (p) => reportProgress(p),
          });

          if (parsed.rows.length === 0) {
            const msg =
              parsed.errors.length > 0
                ? parsed.errors.slice(0, 8).join('\n')
                : 'Nenhuma linha de transação válida foi encontrada no CSV.';
            setErrorLogs(parsed.errors.length > 0 ? parsed.errors : [msg]);
            throw new Error(msg);
          }

          if (parsed.errors.length > 0) {
            setErrorLogs(parsed.errors);
            const issues = mapImportErrorToDiagnostics(parsed.errors.slice(0, 8), {
              fileName: 'texto_csv_colado.csv',
              stageFailed: 'validating',
            });
            const proceed = await requestWarningReview({
              summary: `${parsed.rows.length} linhas válidas encontradas, com ${parsed.errors.length} ocorrência(s).`,
              validCount: parsed.rows.length,
              skippedCount: parsed.skippedCount || parsed.errors.length,
              issues,
            });
            if (!proceed) {
              throw new ImportCancelledError();
            }
          }

          if (parsed.isAmbiguous && presetType === 'auto') {
            pendingStaging = {
              rows: parsed.rows as TableRow[],
              metadata: parsed.metadata,
              detectedSectors: parsed.detectedSectors,
              isAmbiguous: true,
              mode: importMode,
            };
          } else {
            parsedForCommit = parsed;
          }

          return {
            result: parsed,
            summary: `${parsed.rows.length} linhas processadas.`,
            suppressSuccessModal: true,
          };
        }
      );

      if (pendingStaging) {
        setStagingData(pendingStaging);
        setShowStagingModal(true);
        return;
      }

      if (parsedForCommit) {
        await commitRows(
          parsedForCommit.rows,
          parsedForCommit.metadata,
          parsedForCommit.detectedSectors,
          importMode,
          parsedForCommit.tablePartitions
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStagingConfirm = async (classifiedRows: TableRow[], mode: 'merge' | 'replace') => {
    setShowStagingModal(false);
    if (!stagingData) return;
    const finalMode = stagingData.mode === 'new' ? 'new' : mode;
    await commitRows(classifiedRows, stagingData.metadata, stagingData.detectedSectors, finalMode);
  };

  const hasActiveOverlayModal =
    Boolean(stagingData && showStagingModal) || importPipeline.state.status !== 'idle';

  const handleProgressDismiss = () => {
    const shouldNotifySuccess =
      pendingSuccessRef.current && importPipeline.state.status === 'success';
    pendingSuccessRef.current = false;
    importPipeline.dismiss();
    if (shouldNotifySuccess && onSuccess) {
      onSuccess();
    }
  };

  const body = (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>📥 Importador de Planilha CSV & Exemplos</Text>
        {onOpenExamplesGallery && (
          <Pressable
            style={styles.galleryShortcutBtn}
            onPress={onOpenExamplesGallery}
          >
            <Text style={styles.galleryShortcutBtnText}>📚 Galeria de Modelos</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.description}>
        Cole seu CSV abaixo ou carregue um <Text style={{ fontWeight: '700', color: '#6EE7B7' }}>Modelo 100% Fictício</Text> por perfil para testar direto na planilha, exportar novamente ou usar como gabarito na sua IA.
      </Text>

      {/* Quick Example Templates Strip */}
      <View style={styles.examplesBox}>
        <View style={styles.examplesHeaderRow}>
          <Text style={styles.examplesLabel}>
            📚 Exemplos Fictícios por Perfil (Clique para carregar no editor):
          </Text>
          <Pressable onPress={handleCopyPromptForSelected} style={styles.copyAiPromptChip}>
            <Text style={styles.copyAiPromptChipText}>🤖 Copiar Prompt p/ IA</Text>
          </Pressable>
        </View>
        <SearchableVerticalFilter
          label="Perfil de Exemplo"
          placeholder="Filtrar ou escolher perfil CSV de exemplo..."
          options={EXAMPLE_CSV_PROFILES.map((prof) => ({
            id: prof.id,
            label: `${prof.emoji} ${prof.code}. ${prof.shortTitle}`,
            subtitle: prof.subtitle,
            keywords: [prof.code, prof.shortTitle, prof.title, prof.subtitle, ...prof.recommendedFor],
          }))}
          selectedId={selectedExampleId}
          allowClear={false}
          disabled={isProcessing}
          onSelect={(id) => {
            const prof = EXAMPLE_CSV_PROFILES.find((item) => item.id === id);
            if (prof) handleLoadExampleIntoEditor(prof);
          }}
          emptyMessage="Nenhum perfil CSV encontrado."
          testID="csv-importer-example-filter"
        />
      </View>

      {/* Classification Presets */}
      <View style={styles.presetsContainer}>
        <Text style={styles.presetsLabel}>Classificação do Lote (Agente / IA):</Text>
        <View style={styles.presetsRow}>
          {[
            { id: 'auto', label: '🔄 Auto / Revisar' },
            { id: 'expense', label: '🔴 Tudo Despesa' },
            { id: 'revenue', label: '🟢 Tudo Receita' },
            { id: 'deposit', label: '🔵 Tudo Aporte' },
            { id: 'unresolved', label: '🟡 Quarentena' },
          ].map((opt) => (
            <Pressable
              key={opt.id}
              style={[
                styles.presetChip,
                presetType === opt.id && styles.presetChipActive,
              ]}
              onPress={() => setPresetType(opt.id as any)}
              disabled={isProcessing}
            >
              <Text
                style={[
                  styles.presetChipText,
                  presetType === opt.id && styles.presetChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TextInput
        style={styles.codeTextarea}
        multiline
        value={csvText}
        onChangeText={setCsvText}
        placeholder="date,value,description,entryType,category,tags,metadata_json&#10;2026-07-21,150.00,Combustivel Posto,expense,Transporte,cpk,{}"
        placeholderTextColor={colors.text.disabled}
        editable={!isProcessing}
      />

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: '#10B981' }, isProcessing && styles.disabledBtn]}
          onPress={() => handleImport('new')}
          disabled={isProcessing}
        >
          <Text style={styles.actionBtnText}>
            {isProcessing ? 'Processando...' : '🆕 Nova Planilha'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, isProcessing && styles.disabledBtn]}
          onPress={() => handleImport('merge')}
          disabled={isProcessing}
        >
          <Text style={styles.actionBtnText}>
            {isProcessing ? 'Processando...' : '➕ Acumular'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.info.main }, isProcessing && styles.disabledBtn]}
          onPress={() => handleImport('replace')}
          disabled={isProcessing}
        >
          <Text style={styles.actionBtnText}>
            {isProcessing ? 'Processando...' : '🔄 Substituir'}
          </Text>
        </Pressable>
        {onCancel && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary, flex: 0.65 }]}
            onPress={onCancel}
            disabled={isProcessing}
          >
            <Text style={styles.actionBtnText}>Cancelar</Text>
          </Pressable>
        )}
      </View>

      {statusMsg !== '' && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusMsg}</Text>
        </View>
      )}

      {errorLogs.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorHeader}>Erros/Alertas de Reconciliação ({errorLogs.length}):</Text>
          <ScrollView style={styles.errorScroll}>
            {errorLogs.map((log, index) => (
              <Text key={index} style={styles.errorLogText}>
                • {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const overlays = (
    <>
      {/* Staging Review Modal */}
      {stagingData && (
        <CSVStagingReviewModal
          visible={showStagingModal}
          onClose={() => setShowStagingModal(false)}
          incomingRows={stagingData.rows}
          isAmbiguous={stagingData.isAmbiguous}
          activeTableName={stagingData.metadata?.name || activeTable?.name || 'Ativa'}
          onConfirmCommit={handleStagingConfirm}
        />
      )}

      <ImportProgressModal
        state={importPipeline.state}
        technicalReport={importPipeline.technicalReport}
        onCancel={importPipeline.cancelImport}
        onResolveWarning={importPipeline.resolveWarningReview}
        onDismiss={handleProgressDismiss}
      />
    </>
  );

  if (renderContainer) {
    return <>{renderContainer({ body, overlays, hasActiveOverlayModal })}</>;
  }

  return (
    <>
      {body}
      {overlays}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  galleryShortcutBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderColor: 'rgba(99, 102, 241, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full || 999,
  },
  galleryShortcutBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#A5B4FC',
  },
  description: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
  },
  examplesBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: 8,
    gap: 6,
  },
  examplesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  examplesLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  copyAiPromptChip: {
    backgroundColor: '#312E81',
    borderColor: '#6366F1',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  copyAiPromptChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  examplesScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  exampleChipEmoji: {
    fontSize: 13,
  },
  exampleChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  codeTextarea: {
    backgroundColor: '#0d1117',
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: '#a5d6ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    padding: spacing.sm,
    height: 150,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minWidth: 95,
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.6,
  },
  presetsContainer: {
    gap: 6,
    paddingVertical: 2,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full || 9999,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  presetChipActive: {
    backgroundColor: colors.accent.purple,
    borderColor: colors.accent.purpleBorder,
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  presetChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  statusText: {
    fontSize: 11,
    color: colors.success.main,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  errorHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger.main,
  },
  errorScroll: {
    maxHeight: 100,
  },
  errorLogText: {
    fontSize: 9,
    color: colors.text.secondary,
    lineHeight: 12,
  },
});
