/**
 * Page: csv-import
 *
 * Sekundo — AutoCAD Icon-Only Central CSV & Multi-Engine Omni-Bundle Station (`100dvh`, Zero Roll-Down).
 *
 * Features:
 * - Opens multiple Engines (Territory + Schedule + Privileges + embedded events) from a single CSV Geral
 *   via `commitOmniCsvBundleToStorage`.
 * - Exports either the full saved site workspace (`🌐`) or the clean sample template (`🧪`).
 * - Icon-Only Click-to-Reveal controls (`0` clipped controls on Mobile `390x844`).
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Platform,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import * as storage from '../storage/localStorage';
import {
  buildDiff,
  upsertRegistry,
  listEngineTemplates,
  getEngineTemplate,
  exportTemplateCSV,
  detectEnginesFromCSV,
  importGranularCSV,
  generateOmniMasterSampleCsv,
  exportSingleEngineSampleCsv,
  isOmniCsvText,
  importOmniCsvBundleAsync,
  importTerritoryMultiFormatAsync,
  stripSampleTerritorySeedNodes,
  selectEnginePartitionNodes,
  getActiveEngines,
  groupCoinLedgerRowsByTable,
  getEffectiveCapabilityColumns,
  ImportCancelledError,
  mapImportErrorToDiagnostics,
  yieldToUiFrame,
  type CSVDiffResult,
  type CSVRow,
  type EngineId,
  type EngineDetectionReport,
  type QuarantinedRow,
  type GranularImportMode,
  type SekundoOmniStateBundle,
} from '@sekundo/core';
import {
  commitOmniCsvBundleToStorage,
  exportFullSiteOmniCsvFromStorage,
  exportSingleEngineOmniCsvFromStorage,
  saveTerritoryRegistry,
  persistTerritoryRegistryMutation,
} from '../storage/omniStorageBridge';
import { deliverFile } from '../utils/deliverFile';
import { TerritoryMultiFormatButtons } from '../components/territory/TerritoryMultiFormatButtons';
import {
  pickBrowserSpreadsheetFile,
  useSekundoImportPipeline,
} from '../hooks/useSekundoImportPipeline';
import { SekundoImportModal } from '../components/csv/SekundoImportModal';

const ENGINE_ICONS: Record<string, string> = {
  territory_logistics: '🗺️',
  roster_assignments: '📅',
  study_synthesis: '📖',
  financial_ledger: '🪙',
  inventory_assets: '📦',
  action_tracker: '✅',
  live_production_ros: '⏱️',
  incident_command: '🚨',
  tournament_pairings: '🏆',
  CheckInEngine: '🚪',
  DocumentEngine: '🖋️',
  custom: '🎛️',
};

export default function CSVImport() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events, addEvent, refreshEvents, loading: eventsLoading } = useLocalEvent();
  const [targetEventId] = useState<string>(eventId);
  const [newEventName, setNewEventName] = useState<string>('');
  const [showInfoBox, setShowInfoBox] = useState<boolean>(false);

  const currentEvent = eventId
    ? events.find((e) => e.config.id === eventId)
    : events.find((e) => e.config.id === targetEventId);

  const { flatRegistry, commitCSVImport, loading: skeletonLoading } = useSkeleton(
    currentEvent?.config.id || ''
  );

  const [parsedRows, setParsedRows] = useState<CSVRow[] | null>(null);
  const [omniBundlePreview, setOmniBundlePreview] = useState<SekundoOmniStateBundle | null>(
    null
  );
  const [rawOmniText, setRawOmniText] = useState<string | null>(null);
  const [quarantinedRows, setQuarantinedRows] = useState<QuarantinedRow[]>([]);
  const [diff, setDiff] = useState<CSVDiffResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [preserveHistory, setPreserveHistory] = useState<boolean>(true);
  const [importMode] = useState<GranularImportMode>('additive_merge');
  const [detectionReport, setDetectionReport] = useState<EngineDetectionReport | null>(null);
  const [activeTemplateEngine, setActiveTemplateEngine] =
    useState<EngineId>('roster_assignments');
  const importPipeline = useSekundoImportPipeline<string>();

  const allTemplates = listEngineTemplates();
  const currentTemplate = getEngineTemplate(activeTemplateEngine);

  if (eventsLoading || (eventId && skeletonLoading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  // Top Ribbon: Downloads ALL Planilhas (Geral de Tudo)
  const handleDownloadSavedOmniCsv = async () => {
    try {
      const content = await exportFullSiteOmniCsvFromStorage();
      await deliverFile(content, 'sekundo_omni_geral.csv', 'text/csv;charset=utf-8');
      setStatusMessage('🌐 CSV Geral Multi-Planilhas (Todas as Engines) baixado!');
    } catch (e: any) {
      setStatusMessage(`Erro: ${e?.message ?? e}`);
    }
  };

  const handleDownloadSampleOmniCsv = async () => {
    try {
      const content = generateOmniMasterSampleCsv();
      await deliverFile(content, 'sekundo_omni_exemplo.csv', 'text/csv;charset=utf-8');
      setStatusMessage('🧪 CSV Geral Multi-Planilhas de Exemplo baixado!');
    } catch (e: any) {
      setStatusMessage(`Erro: ${e?.message ?? e}`);
    }
  };

  // Selected Engine Inspector: Downloads ONLY the selected Engine's Planilha!
  const handleDownloadSavedSingleEngineCsv = async () => {
    try {
      const content = await exportSingleEngineOmniCsvFromStorage(activeTemplateEngine);
      const filename = `planilha_${activeTemplateEngine}.csv`;
      await deliverFile(content, filename, 'text/csv;charset=utf-8');
      setStatusMessage(`🌐 Planilha somente da Engine "${currentTemplate.name}" baixada!`);
    } catch (e: any) {
      setStatusMessage(`Erro: ${e?.message ?? e}`);
    }
  };

  const handleDownloadSampleSingleEngineCsv = async () => {
    try {
      const content = exportSingleEngineSampleCsv(activeTemplateEngine);
      const filename = `exemplo_planilha_${activeTemplateEngine}.csv`;
      await deliverFile(content, filename, 'text/csv;charset=utf-8');
      setStatusMessage(`🧪 Exemplo somente da Planilha "${currentTemplate.name}" baixado!`);
    } catch (e: any) {
      setStatusMessage(`Erro: ${e?.message ?? e}`);
    }
  };

  const handleDownloadTemplate = async (format: 'canonical' | 'clean_human') => {
    const content = exportTemplateCSV(activeTemplateEngine, format);
    const filename =
      format === 'canonical'
        ? `canonico_${currentTemplate.suggestedFilename}`
        : `limpo_${currentTemplate.suggestedFilename}`;
    await deliverFile(content, filename, 'text/csv;charset=utf-8');
    setStatusMessage(`📥 Modelo "${filename}" baixado!`);
  };

  const handlePickCsvFile = async () => {
    let trackedId: number | null = null;
    try {
      const outcome = await pickBrowserSpreadsheetFile({
        accept: '.csv,.xlsx,.kml,.geojson,.json',
        allowXlsxBinary: true,
        onFileSelected: async ({ fileName, sizeBytes }) => {
          trackedId = importPipeline.beginTracking({
            fileName,
            sizeBytes,
            initialStage: 'reading_file',
            initialDetail: 'Lendo arquivo e verificando assinatura e codificação...',
          });
        },
      });

      if (outcome.kind === 'cancelled') {
        importPipeline.dismiss();
        return;
      }

      if (outcome.kind === 'error') {
        const errId =
          trackedId ??
          importPipeline.beginTracking({
            fileName: outcome.fileName,
            sizeBytes: outcome.sizeBytes,
            initialStage: 'reading_file',
          });
        importPipeline.failExternal(errId, outcome.error, {
          fileName: outcome.fileName,
          binarySignature: outcome.binarySignature,
          stageFailed: 'reading_file',
        });
        return;
      }

      const picked = outcome.file;
      const lowerName = picked.fileName.toLowerCase();

      await importPipeline.run(
        {
          fileName: picked.fileName,
          sizeBytes: picked.sizeBytes,
          initialStage: 'decoding',
          initialDetail:
            picked.decoded.detectedEncoding === 'windows-1252'
              ? 'Codificação ANSI/Windows-1252 convertida automaticamente para UTF-8.'
              : 'Analisando estrutura tabular da planilha...',
          diagnosticContext: {
            fileName: picked.fileName,
            binarySignature: picked.binarySignature,
            allowXlsxBinary: true,
            detectedEncoding: picked.decoded.detectedEncoding,
          },
        },
        async ({ signal, reportProgress, requestWarningReview }) => {
          if (
            lowerName.endsWith('.xlsx') ||
            lowerName.endsWith('.kml') ||
            lowerName.endsWith('.geojson') ||
            lowerName.endsWith('.json') ||
            picked.binarySignature === 'zip_or_xlsx'
          ) {
            const parsedMulti = await importTerritoryMultiFormatAsync(
              {
                bytes: picked.binarySignature === 'zip_or_xlsx' ? picked.bytes : undefined,
                text: picked.binarySignature === 'zip_or_xlsx' ? undefined : picked.decoded.text,
                fileName: picked.fileName,
              },
              {
                privacySafeMode: false,
                signal,
                onProgress: (p) => reportProgress(p),
              }
            );
            if (!parsedMulti.nodes || parsedMulti.nodes.length === 0) {
              throw new Error(
                `Nenhum território ou endereço válido foi encontrado em "${picked.fileName}".`
              );
            }
            setOmniBundlePreview(null);
            setRawOmniText(null);
            setActiveTemplateEngine('territory_logistics');
            setDetectionReport(
              detectEnginesFromCSV(
                '_key,_type,label,territory_number,locality,lat,lng,worked\n01,territory,Rua,T01,Centro,-23.5,-46.4,0'
              )
            );
            const rowsAsCsv: CSVRow[] = parsedMulti.nodes.map((n) => ({
              _key: n.key,
              _type: n.type,
              label: n.label,
              value: n.value || '',
              email: n.email || '',
              _meta_json: JSON.stringify(n.meta || {}),
            }));
            const activeRegistry = currentEvent
              ? stripSampleTerritorySeedNodes(flatRegistry)
              : [];
            setParsedRows(rowsAsCsv);
            setQuarantinedRows([]);
            setDiff(buildDiff(activeRegistry, rowsAsCsv));
            if (!newEventName) {
              setNewEventName(picked.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
            }
            setStatusMessage(
              `✅ "${picked.fileName}" (${parsedMulti.territoriesCount} territórios • ${parsedMulti.addressesCount} endereços)`
            );
            return {
              result: picked.fileName,
              summary: `${parsedMulti.territoriesCount} territórios carregados para pré-visualização.`,
              suppressSuccessModal: true,
            };
          }

          const text = picked.decoded.text;
          if (!text.trim()) {
            throw new Error(`O arquivo "${picked.fileName}" está vazio.`);
          }

          if (isOmniCsvText(text)) {
            const bundle = await importOmniCsvBundleAsync(text, {
              signal,
              onProgress: (p) => reportProgress(p),
            });
            setOmniBundlePreview(bundle);
            setRawOmniText(text);
            setParsedRows(null);
            if (!newEventName) setNewEventName(`${bundle.unitName} — Geral`);
            const effectiveCols = getEffectiveCapabilityColumns(bundle.participants);
            const sheetsCount = bundle.presentSheets?.length || 1;
            setStatusMessage(
              `🌐 "${picked.fileName}" (${sheetsCount} planilhas): ${bundle.participants.length} 👤 (${effectiveCols.length} priv.) • ${bundle.scheduleRegistry.length} 📅 • ${bundle.territoryRegistry.length} 🗺️ • ${(bundle.coinLedgerRows || []).length} 🪙`
            );
            return {
              result: picked.fileName,
              summary: `CSV Geral com ${sheetsCount} planilhas pronto para aplicar.`,
              suppressSuccessModal: true,
            };
          }

          reportProgress({
            stage: 'parsing_rows',
            stageLabel: 'Detectando colunas e processando linhas...',
            percent: 42,
          });
          await yieldToUiFrame();

          setOmniBundlePreview(null);
          setRawOmniText(null);
          const report = detectEnginesFromCSV(text);
          setDetectionReport(report);
          if (report.suggestedEngines.includes('territory_logistics')) {
            setActiveTemplateEngine('territory_logistics');
          }
          const activeRegistry = currentEvent ? stripSampleTerritorySeedNodes(flatRegistry) : [];
          const importRes = importGranularCSV(activeRegistry, text, {
            mode: importMode,
            forceOverwriteState: !preserveHistory,
          });

          reportProgress({
            stage: 'validating',
            stageLabel: 'Validando colunas, chaves e valores...',
            processedCount: importRes.validRows.length,
            totalCount: importRes.validRows.length + importRes.quarantinedRows.length,
            percent: 84,
          });
          await yieldToUiFrame();

          if (importRes.validRows.length === 0) {
            const qReasons = importRes.quarantinedRows
              .slice(0, 6)
              .map((q) => `Linha ${q.rowNumber}: ${q.reason}`)
              .join('\n');
            throw new Error(
              qReasons ||
                'Nenhuma linha válida encontrada. Verifique se a planilha possui cabeçalho válido (_key/_type ou colunas de endereço/território).'
            );
          }

          if (importRes.quarantinedRows.length > 0) {
            const qMessages = importRes.quarantinedRows
              .slice(0, 8)
              .map((q) => `Linha ${q.rowNumber}: ${q.reason}`);
            const issues = mapImportErrorToDiagnostics(qMessages, {
              fileName: picked.fileName,
              stageFailed: 'validating',
            });
            const proceed = await requestWarningReview({
              summary: `${importRes.validRows.length} linhas válidas prontas, mas ${importRes.quarantinedRows.length} linha(s) foram separadas na quarentena.`,
              validCount: importRes.validRows.length,
              skippedCount: importRes.quarantinedRows.length,
              issues,
            });
            if (!proceed) {
              throw new ImportCancelledError();
            }
          }

          setParsedRows(importRes.validRows);
          setQuarantinedRows(importRes.quarantinedRows);
          setDiff(buildDiff(activeRegistry, importRes.validRows));
          if (!newEventName) {
            setNewEventName(picked.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
          }
          setStatusMessage(`✅ "${picked.fileName}" (${importRes.validRows.length} linhas)`);

          return {
            result: picked.fileName,
            summary: `${importRes.validRows.length} linhas carregadas para revisão.`,
            suppressSuccessModal: true,
          };
        }
      );
    } catch (err) {
      const errId =
        trackedId ??
        importPipeline.beginTracking({
          fileName: 'planilha.csv',
          initialStage: 'reading_file',
        });
      importPipeline.failExternal(errId, err, { stageFailed: 'reading_file' });
    }
  };

  const handleCommit = async (
    targetDestination: 'schedule' | 'territory' | 'map' | 'auto' = 'auto'
  ) => {
    const commitTargetName =
      newEventName.trim() ||
      (omniBundlePreview ? `${omniBundlePreview.unitName} — Geral` : 'planilha_sekundo.csv');

    // 1. Commit Omni-CSV Bundle across Sekundo Hubs & Engines (only updating present Planilhas)
    if (omniBundlePreview && rawOmniText) {
      const routeToGo = await importPipeline.run<string>(
        {
          fileName: commitTargetName,
          sizeBytes: rawOmniText.length,
          initialStage: 'saving_storage',
          initialDetail: 'Gravando todas as planilhas no cofre local...',
        },
        async ({ signal, reportProgress }) => {
          const { primaryEventId } = await commitOmniCsvBundleToStorage(rawOmniText, {
            customEventName: commitTargetName,
            targetEventId: currentEvent?.config.id,
            signal,
            onProgress: (p) => reportProgress({ ...p, cancellable: false }),
          });
          reportProgress({
            stage: 'opening_table',
            stageLabel: 'Abrindo workspace importado...',
            percent: 100,
          });
          await yieldToUiFrame();
          const dest =
            targetDestination === 'territory'
              ? `/territory-checklist?id=${primaryEventId}`
              : targetDestination === 'map'
              ? `/territory-map?id=${primaryEventId}`
              : `/schedule-hub?id=${primaryEventId}`;
          return {
            result: dest,
            summary: 'Planilhas aplicadas com sucesso!',
            suppressSuccessModal: true,
          };
        }
      );
      if (routeToGo) {
        router.replace(routeToGo as any);
      }
      return;
    }

    // 2. Commit Single-Engine CSV / Spreadsheet
    if (!parsedRows) return;

    const destRoute = await importPipeline.run<string>(
      {
        fileName: commitTargetName,
        initialStage: 'saving_storage',
        initialDetail: 'Gravando registros no armazenamento local...',
      },
      async ({ reportProgress }) => {
        const engines: EngineId[] =
          detectionReport?.suggestedEngines && detectionReport.suggestedEngines.length > 0
            ? [...detectionReport.suggestedEngines]
            : [activeTemplateEngine];

        const hasTerritoryRows =
          engines.includes('territory_logistics') ||
          parsedRows.some(
            (r) =>
              r._type === 'territory' ||
              Boolean((r as any).territory_number) ||
              Boolean(r._meta_json && r._meta_json.includes('territory_logistics'))
          );
        if (hasTerritoryRows && !engines.includes('territory_logistics')) {
          engines.unshift('territory_logistics');
        }

        let targetId = currentEvent?.config.id || '';
        let updatedRegistry = [];

        reportProgress({
          stage: 'saving_storage',
          stageLabel: 'Gravando esqueleto no armazenamento local...',
          percent: 35,
        });

        if (currentEvent) {
          targetId = currentEvent.config.id;
          const rawCurrent = (await storage.loadSkeleton(targetId)) || flatRegistry || [];
          const cleanedCurrent = hasTerritoryRows
            ? stripSampleTerritorySeedNodes(rawCurrent)
            : rawCurrent;
          const upsertRes = upsertRegistry(cleanedCurrent, parsedRows, {
            forceOverwriteState: !preserveHistory,
            preserveUnmatchedCurrent: hasTerritoryRows ? false : true,
          });
          updatedRegistry = upsertRes.updatedRegistry;
          await storage.saveSkeleton(targetId, updatedRegistry);

          const currentEngines = getActiveEngines(currentEvent.config);
          const mergedEngines = Array.from(new Set([...currentEngines, ...engines])) as EngineId[];
          await storage.saveEventState(targetId, {
            ...currentEvent,
            config: {
              ...currentEvent.config,
              activeEngines: mergedEngines,
            },
          });
        } else {
          const finalName = newEventName.trim() || 'Novo Evento Importado';
          const newState = await addEvent(finalName, 'weekly', ['01'], engines);
          targetId = newState.config.id;
          const upsertRes = upsertRegistry([], parsedRows, { forceOverwriteState: true });
          updatedRegistry = upsertRes.updatedRegistry;
          await storage.saveSkeleton(targetId, updatedRegistry);
        }

        if (hasTerritoryRows) {
          reportProgress({
            stage: 'saving_storage',
            stageLabel: 'Sincronizando territórios e mapas...',
            percent: 78,
          });
          const territoryNodes = selectEnginePartitionNodes(updatedRegistry, 'territory_logistics');
          const effectiveTerritoryNodes =
            territoryNodes.length > 0 ? territoryNodes : updatedRegistry;
          await saveTerritoryRegistry(effectiveTerritoryNodes);
          await persistTerritoryRegistryMutation({
            eventId: targetId,
            rawRegistry: updatedRegistry,
            cleanTerritoryNodes: effectiveTerritoryNodes,
          });
        }

        await refreshEvents();

        reportProgress({
          stage: 'opening_table',
          stageLabel: 'Preparando e abrindo planilha...',
          percent: 100,
        });
        await yieldToUiFrame();

        const dest =
          targetDestination === 'map'
            ? `/territory-map?id=${targetId}`
            : targetDestination === 'territory' || (targetDestination === 'auto' && hasTerritoryRows)
            ? `/territory-checklist?id=${targetId}`
            : targetDestination === 'schedule'
            ? `/schedule-hub?id=${targetId}`
            : `/skeleton-editor?id=${targetId}`;

        return {
          result: dest,
          summary: `${parsedRows.length} registros gravados com sucesso.`,
          suppressSuccessModal: true,
        };
      }
    );

    if (destRoute) {
      router.replace(destRoute as any);
    }
  };

  const webTitle = (title: string) => (Platform.OS === 'web' ? ({ title } as any) : {});

  return (
    <SafeAreaView style={styles.cadViewport}>
      {/* Top Icon-Only AutoCAD Command Ribbon (Downloads ALL Planilhas / Geral de Tudo) */}
      <View style={styles.topRibbon}>
        <View style={styles.brandRow}>
          <Pressable
            testID="csv-import-back-btn"
            accessibilityRole="button"
            accessibilityLabel="Painel Inicial"
            {...webTitle('Voltar ao Painel Inicial')}
            onPress={() => router.push('/')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconGlyph}>🏠</Text>
          </Pressable>
          <Text style={styles.ribbonTitle}>📐 IMPORT & EXPORT MULTI (.CSV/.XLSX/.KML/.GeoJSON)</Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            testID="csv-import-pick-file-btn"
            accessibilityRole="button"
            accessibilityLabel="Selecionar Arquivo (.CSV, .XLSX, .KML, .GeoJSON, .JSON)"
            {...webTitle('Selecionar Arquivo (.CSV, .XLSX, .KML, .GeoJSON, .JSON) p/ Importar')}
            onPress={handlePickCsvFile}
            style={[styles.iconBtn, styles.cadBtnBlue]}
          >
            <Text style={styles.iconGlyph}>📂</Text>
          </Pressable>

          <Pressable
            testID="csv-import-download-saved-omni-btn"
            accessibilityRole="button"
            accessibilityLabel="Baixar CSV Geral Salvo no Site (Todas as Planilhas)"
            {...webTitle('TODOS: Baixar CSV Geral com Todas as Planilhas Salvas no Site')}
            onPress={handleDownloadSavedOmniCsv}
            style={[styles.iconBtn, styles.cadBtnPurple]}
          >
            <Text style={styles.iconGlyph}>🌐</Text>
          </Pressable>

          <Pressable
            testID="csv-import-download-sample-omni-btn"
            accessibilityRole="button"
            accessibilityLabel="Baixar CSV Geral de Exemplo (Todas as Planilhas)"
            {...webTitle('TODOS: Baixar CSV Geral de Exemplo com Todas as Planilhas')}
            onPress={handleDownloadSampleOmniCsv}
            style={styles.iconBtn}
          >
            <Text style={styles.iconGlyph}>🧪</Text>
          </Pressable>

          {(parsedRows || omniBundlePreview) && (
            <Pressable
              testID="csv-import-commit-btn"
              accessibilityRole="button"
              accessibilityLabel="Confirmar e Aplicar Importação"
              {...webTitle('Confirmar e Abrir Todas as Funcionalidades')}
              onPress={() => handleCommit('schedule')}
              style={[styles.iconBtn, styles.cadBtnEmerald]}
            >
              <Text style={styles.iconGlyph}>🚀</Text>
            </Pressable>
          )}

          <Pressable
            testID="csv-import-info-btn"
            accessibilityRole="button"
            accessibilityLabel="Informações do CSV Geral"
            {...webTitle('Mostrar/Ocultar Resumo do CSV Geral')}
            onPress={() => setShowInfoBox((prev) => !prev)}
            style={[styles.iconBtn, showInfoBox && styles.cadBtnBlue]}
          >
            <Text style={styles.iconGlyph}>ℹ️</Text>
          </Pressable>
        </View>
      </View>

      {statusMessage && (
        <View style={styles.statusStrip}>
          <Text style={styles.statusStripText} numberOfLines={3}>
            {statusMessage}
          </Text>
        </View>
      )}

      {/* Main Split Workspace */}
      <View
        style={[
          styles.workspaceSplit,
          { flexDirection: isDesktop ? 'row' : 'column' },
        ]}
      >
        {/* Left: Compact Icon Grid of Engine CSV Templates */}
        <View style={[styles.matrixPanel, { flex: isDesktop ? 1 : undefined }]}>
          <Text style={styles.sectionLabel}>🎛️ MODELOS POR ENGINE</Text>

          <View style={styles.engineButtonsGrid}>
            {allTemplates.map((tpl, idx) => {
              const active = activeTemplateEngine === tpl.engineId;
              const icon = ENGINE_ICONS[tpl.engineId] || '⚙️';
              return (
                <Pressable
                  key={tpl.engineId}
                  testID={`csv-tpl-btn-${tpl.engineId}`}
                  accessibilityRole="button"
                  accessibilityLabel={tpl.name}
                  {...webTitle(`${tpl.name} (${tpl.suggestedFilename})`)}
                  onPress={() => setActiveTemplateEngine(tpl.engineId)}
                  style={[styles.engineCadBtn, active && styles.engineCadBtnActive]}
                >
                  <Text style={styles.engineCadIcon}>{icon}</Text>
                  <Text style={styles.engineCadCode}>E0{idx + 1}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Right: On-Demand Inspector for Selected CSV Template or Uploaded Multi-Engine CSV */}
        <View style={[styles.inspectorPanel, { flex: isDesktop ? 1.2 : undefined }]}>
          {omniBundlePreview ? (
            <View style={{ gap: 8 }}>
              <View style={styles.inspectorBanner}>
                <Text style={styles.inspectorBannerTitle}>
                  🌐 PACOTE MULTI-PLANILHA ({omniBundlePreview.presentSheets?.length || 7} ABAS)
                </Text>
              </View>
              <TextInput
                style={styles.nameInput}
                value={newEventName}
                onChangeText={setNewEventName}
                placeholder="Nome do pacote..."
                placeholderTextColor="#64748B"
              />
              <View style={styles.metricsGrid}>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>
                    {omniBundlePreview.participants.length}
                  </Text>
                  <Text style={styles.metricLabel}>
                    🛡️ Usuários ({getEffectiveCapabilityColumns(omniBundlePreview.participants).length} priv.)
                  </Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>
                    {omniBundlePreview.scheduleRegistry.length}
                  </Text>
                  <Text style={styles.metricLabel}>📅 Programação</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>
                    {omniBundlePreview.territoryRegistry.length}
                  </Text>
                  <Text style={styles.metricLabel}>🗺️ Territórios</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>
                    {(omniBundlePreview.coinLedgerRows || []).filter((r) => !r.isTableHeaderOnly).length}
                  </Text>
                  <Text style={styles.metricLabel}>
                    {(() => {
                      const coinPartitions = groupCoinLedgerRowsByTable(
                        omniBundlePreview.coinLedgerRows || []
                      );
                      return coinPartitions.length > 1
                        ? `🪙 Moeda (${coinPartitions.length} planilhas)`
                        : '🪙 Moeda';
                    })()}
                  </Text>
                </View>
              </View>

              {/* Multi-Engine Launch Bar: Open directly into Schedule, Territory, or Map */}
              <View style={styles.actionRow}>
                <Pressable
                  testID="omni-commit-open-schedule"
                  accessibilityRole="button"
                  accessibilityLabel="Importar Todas as Funcionalidades Agora"
                  {...webTitle('Importar e Abrir Programação & Privilégios')}
                  onPress={() => handleCommit('schedule')}
                  style={[styles.cadBtn, styles.cadBtnEmerald]}
                >
                  <Text style={styles.cadBtnText}>🚀 Importar Todas as Funcionalidades Agora</Text>
                </Pressable>

                <Pressable
                  testID="omni-commit-open-territory"
                  accessibilityRole="button"
                  accessibilityLabel="Importar e Abrir Territórios"
                  {...webTitle('Importar e Abrir Prancheta de Territórios')}
                  onPress={() => handleCommit('territory')}
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconGlyph}>📋</Text>
                </Pressable>

                <Pressable
                  testID="omni-commit-open-map"
                  accessibilityRole="button"
                  accessibilityLabel="Importar e Abrir Mapa CAD"
                  {...webTitle('Importar e Abrir Mapa CAD 2D')}
                  onPress={() => handleCommit('map')}
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconGlyph}>🗺️</Text>
                </Pressable>
              </View>
            </View>
          ) : parsedRows ? (
            <View style={{ gap: 8 }}>
              <View style={styles.inspectorBanner}>
                <Text style={styles.inspectorBannerTitle}>
                  📊 {parsedRows.length} LINHAS ({quarantinedRows.length} quarentena)
                </Text>
              </View>
              <TextInput
                style={styles.nameInput}
                value={newEventName}
                onChangeText={setNewEventName}
                placeholder="Nome do evento..."
                placeholderTextColor="#64748B"
              />
              {diff && (
                <Text style={styles.inspectorDesc}>
                  +{diff.added} | ↻ {diff.modified} | = {diff.unchanged}
                </Text>
              )}
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Alternar Preservar Histórico"
                  {...webTitle(preserveHistory ? 'Preservar Histórico: SIM' : 'Sobrescrever Tudo')}
                  onPress={() => setPreserveHistory((p) => !p)}
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconGlyph}>{preserveHistory ? '🔒' : '🔓'}</Text>
                </Pressable>
                <Pressable
                  testID="single-csv-commit-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar Importação"
                  {...webTitle('Confirmar Importação')}
                  onPress={() => handleCommit('auto')}
                  style={[styles.iconBtn, styles.cadBtnEmerald]}
                >
                  <Text style={styles.iconGlyph}>⚡</Text>
                </Pressable>
                <Pressable
                  testID="single-csv-commit-open-territory"
                  accessibilityRole="button"
                  accessibilityLabel="Importar e Abrir Territórios"
                  {...webTitle('Importar e Abrir Prancheta de Territórios')}
                  onPress={() => handleCommit('territory')}
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconGlyph}>📋</Text>
                </Pressable>
                <Pressable
                  testID="single-csv-commit-open-map"
                  accessibilityRole="button"
                  accessibilityLabel="Importar e Abrir Mapa CAD"
                  {...webTitle('Importar e Abrir Mapa CAD 2D')}
                  onPress={() => handleCommit('map')}
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconGlyph}>🗺️</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={styles.inspectorBanner}>
                <Text style={styles.inspectorBannerTitle}>
                  {ENGINE_ICONS[currentTemplate.engineId] || '🔍'} {currentTemplate.name}
                </Text>
              </View>
              <Text style={styles.conventionText} numberOfLines={1}>
                {currentTemplate.suggestedFilename} • {currentTemplate.keyConventions}
              </Text>

              {/* Icon-Only Action Row for THIS Selected Engine ONLY */}
              <View style={styles.actionRow}>
                <Pressable
                  testID="tpl-download-canonical-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Baixar CSV Canônico"
                  {...webTitle('Baixar CSV Canônico desta Engine')}
                  onPress={() => handleDownloadTemplate('canonical')}
                  style={[styles.iconBtn, styles.cadBtnBlue]}
                >
                  <Text style={styles.iconGlyph}>📥</Text>
                </Pressable>

                <Pressable
                  testID="tpl-download-human-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Baixar CSV Humano"
                  {...webTitle('Baixar CSV Limpo Humano desta Engine')}
                  onPress={() => handleDownloadTemplate('clean_human')}
                  style={[styles.iconBtn, styles.cadBtnEmerald]}
                >
                  <Text style={styles.iconGlyph}>📄</Text>
                </Pressable>

                <Pressable
                  testID="tpl-download-saved-omni-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Baixar Planilha Salva Somente Desta Engine"
                  {...webTitle(`Baixar Planilha Salva Somente desta Engine (${currentTemplate.name})`)}
                  onPress={handleDownloadSavedSingleEngineCsv}
                  style={[styles.iconBtn, styles.cadBtnPurple]}
                >
                  <Text style={styles.iconGlyph}>🌐</Text>
                </Pressable>

                <Pressable
                  testID="tpl-download-sample-omni-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Baixar Planilha Exemplo Somente Desta Engine"
                  {...webTitle(`Baixar Planilha Exemplo Somente desta Engine (${currentTemplate.name})`)}
                  onPress={handleDownloadSampleSingleEngineCsv}
                  style={styles.iconBtn}
                >
                  <Text style={styles.iconGlyph}>🧪</Text>
                </Pressable>

                <Pressable
                  testID="tpl-pick-file-inline-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Selecionar Arquivo Multi-Formato"
                  {...webTitle('Selecionar Arquivo .CSV, .XLSX, .KML, .GeoJSON ou .JSON')}
                  onPress={handlePickCsvFile}
                  style={[styles.iconBtn, styles.cadBtnBlue]}
                >
                  <Text style={styles.iconGlyph}>📂</Text>
                </Pressable>
              </View>

              <View
                style={{
                  marginTop: 6,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(148, 163, 184, 0.2)',
                  gap: 6,
                }}
              >
                <Text style={styles.sectionLabel}>
                  🧩 EXPORTAR TERRITÓRIOS SALVOS (MULTI-FORMATO / GIS):
                </Text>
                <TerritoryMultiFormatButtons
                  nodes={flatRegistry}
                  compact
                  presets={['zip_gis', 'kml_numbered', 'xlsx_18col', 'kml_full', 'geojson_gis', 'csv_18col', 'json']}
                  onFeedback={(msg) => setStatusMessage(msg)}
                  testIdPrefix="csv-station-multi"
                />
              </View>

              {showInfoBox && (
                <View style={styles.omniExplainBox}>
                  <Text style={styles.omniExplainText}>
                    🌐 No topo baixa TODAS as planilhas. No painel desta Engine baixa SOMENTE a planilha {currentTemplate.name} (#PLANILHA / #ABA_PLANILHA).
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <SekundoImportModal
        state={importPipeline.state}
        technicalReport={importPipeline.technicalReport}
        onCancel={importPipeline.cancelImport}
        onResolveWarning={importPipeline.resolveWarningReview}
        onRetry={() => {
          importPipeline.dismiss();
          handlePickCsvFile();
        }}
        onDismiss={importPipeline.dismiss}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#060A12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cadViewport: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    backgroundColor: '#060A12',
    overflow: 'hidden',
  },
  topRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ribbonTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
  },
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 16,
    color: '#F8FAFC',
  },
  cadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
  },
  cadBtnBlue: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  cadBtnPurple: {
    backgroundColor: '#6D28D9',
    borderColor: '#A78BFA',
  },
  cadBtnEmerald: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
  },
  cadBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  statusStrip: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  statusStripText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
  },
  workspaceSplit: {
    flex: 1,
    padding: 8,
    gap: 8,
    overflow: 'hidden',
  },
  matrixPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
    overflow: 'hidden',
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  engineButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  engineCadBtn: {
    width: 58,
    height: 52,
    backgroundColor: '#0B1120',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  engineCadBtnActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#60A5FA',
  },
  engineCadIcon: {
    fontSize: 18,
  },
  engineCadCode: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '900',
  },
  inspectorPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    overflow: 'hidden',
  },
  inspectorBanner: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  inspectorBannerTitle: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '900',
  },
  inspectorDesc: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  conventionText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  nameInput: {
    backgroundColor: '#060A12',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: '#F8FAFC',
    fontSize: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricPill: {
    width: '48%',
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 6,
  },
  metricValue: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  omniExplainBox: {
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 8,
  },
  omniExplainText: {
    color: '#CBD5E1',
    fontSize: 10.5,
  },
});
