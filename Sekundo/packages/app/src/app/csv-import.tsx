/**
 * Page: csv-import
 *
 * Sekundo — AutoCAD-Style Central CSV & Omni-Bundle Station (`100dvh`, Zero Roll-Down).
 *
 * Features:
 * - Unified Master CSV ("CSV GERAL de todo o App"): Download & Import a single `.csv`
 *   containing all 9 Engines + 📅 Programação & WhatsApp + 🖋️ Estúdio Documental YAML ⇄ PDF
 *   + ☀️ Cockpit Hoje + 🛡️ Matriz de Privilégios.
 * - Per-Engine Sample CSV Selector: Click any Engine button in the compact CAD matrix
 *   to inspect its schema and download its sample `.csv` (Canônico or Limpo Humano).
 * - Granular LEGO Ingestion & Quarantine Staging without vertical page scrolling.
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
  importOmniCsvBundle,
  type CSVDiffResult,
  type CSVRow,
  type EngineId,
  type EngineDetectionReport,
  type QuarantinedRow,
  type GranularImportMode,
  type SekundoOmniStateBundle,
} from '@sekundo/core';

export default function CSVImport() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events, addEvent, loading: eventsLoading } = useLocalEvent();
  const [targetEventId] = useState<string>(eventId);
  const [newEventName, setNewEventName] = useState<string>('');

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

  const handleDownloadOmniGeneralCsv = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const content = generateOmniMasterSampleCsv();
      const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sekundo_omni_geral.csv';
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(
        '🌐 CSV GERAL baixado! Inclui 9 Engines + 📅 Programação & WhatsApp + 🖋️ Estúdio YAML/PDF + ☀️ Hoje + 🛡️ Matriz de Privilégios.'
      );
    }
  };

  const handleDownloadTemplate = (format: 'canonical' | 'clean_human') => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const content = exportTemplateCSV(activeTemplateEngine, format);
      const filename =
        format === 'canonical'
          ? `canonico_${currentTemplate.suggestedFilename}`
          : `limpo_${currentTemplate.suggestedFilename}`;
      const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(`📥 Modelo "${filename}" baixado com sucesso!`);
    }
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

        // Check if it is a Unified Master CSV ("CSV Geral")
        if (text.trim().startsWith('_record_kind,')) {
          const bundle = importOmniCsvBundle(text);
          setOmniBundlePreview(bundle);
          setRawOmniText(text);
          setParsedRows(null);
          if (!newEventName) setNewEventName(`${bundle.unitName} — Importação Geral`);
          setStatusMessage(
            `🌐 CSV GERAL "${file.name}" pronto para importar: ${bundle.participants.length} usuários c/ privilégios, ${bundle.scheduleRegistry.length} slots WhatsApp, ${bundle.territoryRegistry.length} territórios, ${bundle.studioDocuments.length} docs YAML/PDF, ${bundle.hojeRituals.length} rituais Hoje e ${bundle.events.length} eventos!`
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
        setStatusMessage(
          `✅ CSV "${file.name}" analisado (${importRes.validRows.length} linhas válidas)!`
        );
      };
      input.click();
    }
  };

  const handleCommit = async () => {
    // 1. Commit Omni-CSV Bundle across ALL Sekundo Hubs & Engines
    if (omniBundlePreview && rawOmniText) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem('sekundo:loaded_schedule_bundle_v1', rawOmniText);
        window.localStorage.setItem(
          'sekundo:privilege_directory_v1',
          JSON.stringify(omniBundlePreview.participants)
        );
        if (omniBundlePreview.hojeManifestYaml) {
          window.localStorage.setItem(
            'sekundo_app_manifest_v1',
            omniBundlePreview.hojeManifestYaml
          );
        }
      }
      const evState = await addEvent(
        newEventName.trim() || `${omniBundlePreview.unitName} — Geral`,
        'weekly',
        ['01', '02', '03'],
        ['roster_assignments', 'territory_logistics']
      );
      await storage.saveSkeleton(evState.config.id, omniBundlePreview.scheduleRegistry);
      router.replace(`/schedule-hub?id=${evState.config.id}` as any);
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

  return (
    <SafeAreaView style={styles.cadViewport}>
      {/* Top AutoCAD Command Ribbon */}
      <View style={styles.topRibbon}>
        <View style={styles.brandRow}>
          <Pressable onPress={() => router.push('/')} style={styles.cadBtn}>
            <Text style={[styles.cadBtnText, { color: '#FFB800' }]}>← Painel</Text>
          </Pressable>
          <Text style={styles.ribbonTitle}>
            📐 CENTRAL CAD DE IMPORTAÇÃO & EXPORTAÇÃO CSV (GERAL + 9 ENGINES)
          </Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            onPress={handleDownloadOmniGeneralCsv}
            style={[styles.cadBtn, styles.cadBtnPurple]}
          >
            <Text style={styles.cadBtnText}>🌐 Baixar .CSV GERAL de Todo o App</Text>
          </Pressable>

          <Pressable onPress={handlePickCsvFile} style={[styles.cadBtn, styles.cadBtnBlue]}>
            <Text style={styles.cadBtnText}>📂 Selecionar Arquivo .CSV p/ Importar</Text>
          </Pressable>

          {(parsedRows || omniBundlePreview) && (
            <Pressable onPress={handleCommit} style={[styles.cadBtn, styles.cadBtnEmerald]}>
              <Text style={styles.cadBtnText}>⚡ Confirmar e Aplicar Importação</Text>
            </Pressable>
          )}
        </View>
      </View>

      {statusMessage && (
        <View style={styles.statusStrip}>
          <Text style={styles.statusStripText} numberOfLines={1}>
            {statusMessage}
          </Text>
        </View>
      )}

      {/* Main Split Workspace (Zero Vertical Roll-Down!) */}
      <View
        style={[
          styles.workspaceSplit,
          { flexDirection: isDesktop ? 'row' : 'column' },
        ]}
      >
        {/* Left: Compact Matrix of Engine CSV Buttons + Omni-CSV Hub Card */}
        <View style={[styles.matrixPanel, { flex: isDesktop ? 1.2 : undefined }]}>
          <Text style={styles.sectionLabel}>
            🎛️ ESCOLHA UM MODELO DE ENGINE OU O PACOTE GERAL (Clique no botão):
          </Text>

          <View style={styles.engineButtonsGrid}>
            {allTemplates.map((tpl, idx) => {
              const active = activeTemplateEngine === tpl.engineId;
              return (
                <Pressable
                  key={tpl.engineId}
                  onPress={() => setActiveTemplateEngine(tpl.engineId)}
                  style={[styles.engineCadBtn, active && styles.engineCadBtnActive]}
                >
                  <Text style={styles.engineCadCode}>[CSV-0{idx + 1}]</Text>
                  <Text style={styles.engineCadTitle} numberOfLines={1}>
                    {tpl.name}
                  </Text>
                  <Text style={styles.engineCadSub} numberOfLines={1}>
                    {tpl.suggestedFilename}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Right: On-Demand Inspector for Selected CSV Template or Uploaded CSV Diff */}
        <View style={[styles.inspectorPanel, { flex: isDesktop ? 1 : undefined }]}>
          {omniBundlePreview ? (
            <View style={{ gap: 8 }}>
              <View style={styles.inspectorBanner}>
                <Text style={styles.inspectorBannerTitle}>
                  🌐 RESUMO DO CSV GERAL CARREGADO
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
                  <Text style={styles.metricLabel}>🛡️ Usuários & Privilégios</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>
                    {omniBundlePreview.scheduleRegistry.length}
                  </Text>
                  <Text style={styles.metricLabel}>📅 Slots WhatsApp Hub</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>
                    {omniBundlePreview.territoryRegistry.length}
                  </Text>
                  <Text style={styles.metricLabel}>🗺️ Territórios Multi-Ciclo</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricValue}>
                    {omniBundlePreview.studioDocuments.length}
                  </Text>
                  <Text style={styles.metricLabel}>🖋️ Docs Estúdio YAML/PDF</Text>
                </View>
              </View>
              <Pressable onPress={handleCommit} style={[styles.cadBtn, styles.cadBtnEmerald]}>
                <Text style={styles.cadBtnText}>
                  🚀 Importar Todas as Funcionalidades Agora
                </Text>
              </Pressable>
            </View>
          ) : parsedRows ? (
            <View style={{ gap: 8 }}>
              <View style={styles.inspectorBanner}>
                <Text style={styles.inspectorBannerTitle}>
                  📊 PRÉVIA DE IMPORTAÇÃO ({parsedRows.length} linhas válidas •{' '}
                  {quarantinedRows.length} em quarentena)
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
                  Diff: +{diff.added} novos | ↻ {diff.modified} atualizados | ={' '}
                  {diff.unchanged} inalterados
                </Text>
              )}
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => setPreserveHistory((p) => !p)}
                  style={styles.cadBtn}
                >
                  <Text style={styles.cadBtnText}>
                    {preserveHistory ? '🔒 Preservar Histórico: SIM' : '🔓 Sobrescrever Tudo'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCommit}
                  style={[styles.cadBtn, styles.cadBtnEmerald]}
                >
                  <Text style={styles.cadBtnText}>⚡ Confirmar Importação</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={styles.inspectorBanner}>
                <Text style={styles.inspectorBannerTitle}>
                  🔍 INSPETOR DE MODELO: {currentTemplate.name}
                </Text>
              </View>
              <Text style={styles.inspectorDesc}>{currentTemplate.description}</Text>
              <Text style={styles.conventionText}>
                Convenção de Chaves: {currentTemplate.keyConventions}
              </Text>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => handleDownloadTemplate('canonical')}
                  style={[styles.cadBtn, styles.cadBtnBlue]}
                >
                  <Text style={styles.cadBtnText}>📥 Baixar CSV Canônico</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDownloadTemplate('clean_human')}
                  style={[styles.cadBtn, styles.cadBtnEmerald]}
                >
                  <Text style={styles.cadBtnText}>📥 Baixar CSV Humano</Text>
                </Pressable>
                <Pressable
                  onPress={handleDownloadOmniGeneralCsv}
                  style={[styles.cadBtn, styles.cadBtnPurple]}
                >
                  <Text style={styles.cadBtnText}>🌐 Baixar CSV GERAL do App</Text>
                </Pressable>
              </View>

              <View style={styles.omniExplainBox}>
                <Text style={styles.omniExplainTitle}>
                  💡 O que está incluído no .CSV GERAL de todo o App?
                </Text>
                <Text style={styles.omniExplainText}>
                  • 📅 Programação & WhatsApp (Compromissos, Grupos 1–3, Territórios){'\n'}
                  • 🖋️ Estúdio Documental YAML ⇄ PDF (Canvas mm, Fichas 4-Up, Multi-Ciclo){'\n'}
                  • ☀️ Cockpit Hoje & Compositor (Rituais governados e sekundo.app.yaml){'\n'}
                  • 🛡️ Matriz de 26 Privilégios & Rotatividade + Todas as 9 Engines!
                </Text>
              </View>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
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
    gap: 6,
  },
  cadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
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
    paddingHorizontal: 12,
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
    padding: 10,
    gap: 10,
    overflow: 'hidden',
  },
  matrixPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    overflow: 'hidden',
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  engineButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  engineCadBtn: {
    width: '48.5%',
    minWidth: 145,
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
  },
  engineCadBtnActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#60A5FA',
  },
  engineCadCode: {
    color: '#38BDF8',
    fontSize: 9.5,
    fontWeight: '900',
  },
  engineCadTitle: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 2,
  },
  engineCadSub: {
    color: '#64748B',
    fontSize: 9.5,
    marginTop: 1,
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
    fontSize: 11.5,
    lineHeight: 16,
  },
  conventionText: {
    color: '#38BDF8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  nameInput: {
    backgroundColor: '#060A12',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    padding: 8,
  },
  metricValue: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  omniExplainBox: {
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 9,
    gap: 4,
    marginTop: 4,
  },
  omniExplainTitle: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '800',
  },
  omniExplainText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    lineHeight: 16,
  },
});
