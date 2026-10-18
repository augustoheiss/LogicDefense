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
  importOmniCsvBundle,
  getEffectiveCapabilityColumns,
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
} from '../storage/omniStorageBridge';
import { deliverFile } from '../utils/deliverFile';

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

  const handlePickCsvFile = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const text = await file.text();

        // Check if it is a Multi-Planilha CSV (`#PLANILHA,<engine>`) or legacy Omni-CSV
        if (isOmniCsvText(text)) {
          const bundle = importOmniCsvBundle(text);
          setOmniBundlePreview(bundle);
          setRawOmniText(text);
          setParsedRows(null);
          if (!newEventName) setNewEventName(`${bundle.unitName} — Geral`);
          const effectiveCols = getEffectiveCapabilityColumns(bundle.participants);
          const sheetsCount = bundle.presentSheets?.length || 1;
          setStatusMessage(
            `🌐 "${file.name}" (${sheetsCount} planilhas): ${bundle.participants.length} 👤 (${effectiveCols.length} priv.) • ${bundle.scheduleRegistry.length} 📅 • ${bundle.territoryRegistry.length} 🗺️ • ${(bundle.coinLedgerRows || []).length} 🪙`
          );
          return;
        }

        // Standard Engine CSV
        setOmniBundlePreview(null);
        setRawOmniText(null);
        const report = detectEnginesFromCSV(text);
        setDetectionReport(report);
        const activeRegistry = currentEvent ? flatRegistry : [];
        const importRes = importGranularCSV(activeRegistry, text, {
          mode: importMode,
          forceOverwriteState: !preserveHistory,
        });
        setParsedRows(importRes.validRows);
        setQuarantinedRows(importRes.quarantinedRows);
        setDiff(buildDiff(activeRegistry, importRes.validRows));
        if (!newEventName) {
          setNewEventName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
        }
        setStatusMessage(`✅ "${file.name}" (${importRes.validRows.length} linhas)`);
      };
      input.click();
    }
  };

  const handleCommit = async (targetDestination: 'schedule' | 'territory' | 'map' = 'schedule') => {
    // 1. Commit Omni-CSV Bundle across Sekundo Hubs & Engines (only updating present Planilhas)
    if (omniBundlePreview && rawOmniText) {
      try {
        const { primaryEventId } = await commitOmniCsvBundleToStorage(rawOmniText, {
          customEventName: newEventName.trim() || `${omniBundlePreview.unitName} — Geral`,
          targetEventId: currentEvent?.config.id,
        });
        if (targetDestination === 'territory') {
          router.replace(`/territory-checklist?id=${primaryEventId}` as any);
        } else if (targetDestination === 'map') {
          router.replace(`/territory-map?id=${primaryEventId}` as any);
        } else {
          router.replace(`/schedule-hub?id=${primaryEventId}` as any);
        }
      } catch (err: any) {
        setStatusMessage(`❌ Erro ao aplicar CSV Geral: ${err?.message ?? err}`);
      }
      return;
    }

    // 2. Commit Single-Engine CSV
    if (!parsedRows) return;
    if (currentEvent) {
      if (currentEvent.config.id === eventId) {
        await commitCSVImport(parsedRows, { forceOverwriteState: !preserveHistory });
      } else {
        const currentSkeleton = (await storage.loadSkeleton(currentEvent.config.id)) || [];
        const upsertRes = upsertRegistry(currentSkeleton, parsedRows, {
          forceOverwriteState: !preserveHistory,
        });
        await storage.saveSkeleton(currentEvent.config.id, upsertRes.updatedRegistry);
      }
      router.replace(`/skeleton-editor?id=${currentEvent.config.id}`);
    } else {
      const finalName = newEventName.trim() || 'Novo Evento Importado';
      const engines: EngineId[] =
        detectionReport?.suggestedEngines && detectionReport.suggestedEngines.length > 0
          ? detectionReport.suggestedEngines
          : [activeTemplateEngine];
      const newState = await addEvent(finalName, 'weekly', ['01'], engines);
      const upsertRes = upsertRegistry([], parsedRows, { forceOverwriteState: true });
      await storage.saveSkeleton(newState.config.id, upsertRes.updatedRegistry);
      router.replace(`/skeleton-editor?id=${newState.config.id}`);
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
          <Text style={styles.ribbonTitle}>📐 CSV GERAL & ENGINES</Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            testID="csv-import-pick-file-btn"
            accessibilityRole="button"
            accessibilityLabel="Selecionar Arquivo .CSV p/ Importar"
            {...webTitle('Selecionar Arquivo .CSV p/ Importar')}
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
          <Text style={styles.statusStripText} numberOfLines={1}>
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
                    {(omniBundlePreview.coinLedgerRows || []).length}
                  </Text>
                  <Text style={styles.metricLabel}>🪙 Moeda</Text>
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
                  onPress={() => handleCommit('schedule')}
                  style={[styles.iconBtn, styles.cadBtnEmerald]}
                >
                  <Text style={styles.iconGlyph}>⚡</Text>
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
                  accessibilityLabel="Selecionar Arquivo CSV"
                  {...webTitle('Selecionar Arquivo .CSV do Computador')}
                  onPress={handlePickCsvFile}
                  style={[styles.iconBtn, styles.cadBtnBlue]}
                >
                  <Text style={styles.iconGlyph}>📂</Text>
                </Pressable>
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
