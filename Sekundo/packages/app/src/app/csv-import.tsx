/**
 * Page: csv-import
 *
 * Imports CSV skeleton data with:
 * - Engine CSV Template downloads & column guides for all 8 Universal Engines.
 * - Automatic Engine Detection with one-click multi-engine activation.
 * - Granular "LEGO" Ingestion by parts (additive merge or branch replacement).
 * - Quarantine Staging for malformed rows so imports NEVER fail completely.
 * - Operational history preservation & visual diffs.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import CSVDropZone from '../components/csv/CSVDropZone.web';
import { CSVPreviewTable } from '../components/csv/CSVPreviewTable';
import * as storage from '../storage/localStorage';
import {
  buildDiff,
  upsertRegistry,
  listEngineTemplates,
  getEngineTemplate,
  exportTemplateCSV,
  detectEnginesFromCSV,
  importGranularCSV,
  getActiveEngines,
  type CSVDiffResult,
  type CSVRow,
  type EngineId,
  type EngineDetectionReport,
  type QuarantinedRow,
  type GranularImportMode,
} from '@sekundo/core';

export default function CSVImport() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events, updateEventState, addEvent, loading: eventsLoading } = useLocalEvent();
  const [targetEventId, setTargetEventId] = useState<string>(eventId);
  const [newEventName, setNewEventName] = useState<string>('');

  const currentEvent = eventId
    ? events.find((e) => e.config.id === eventId)
    : events.find((e) => e.config.id === targetEventId);

  const { flatRegistry, commitCSVImport, loading: skeletonLoading } = useSkeleton(currentEvent?.config.id || '');

  const [parsedRows, setParsedRows] = useState<CSVRow[] | null>(null);
  const [quarantinedRows, setQuarantinedRows] = useState<QuarantinedRow[]>([]);
  const [diff, setDiff] = useState<CSVDiffResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preserveHistory, setPreserveHistory] = useState<boolean>(true);
  const [preservedCount, setPreservedCount] = useState<number>(0);

  // Modular LEGO & Engine state
  const [importMode, setImportMode] = useState<GranularImportMode>('additive_merge');
  const [detectionReport, setDetectionReport] = useState<EngineDetectionReport | null>(null);
  const [activeTemplateEngine, setActiveTemplateEngine] = useState<EngineId>('territory_logistics');
  const [showTemplateGuide, setShowTemplateGuide] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const allTemplates = listEngineTemplates();
  const currentTemplate = getEngineTemplate(activeTemplateEngine);

  // Only show full loading if events are being loaded from storage, or if a specific eventId is loading its skeleton
  if (eventsLoading || (eventId && skeletonLoading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  const activeEngines = currentEvent
    ? getActiveEngines(currentEvent.config)
    : detectionReport?.suggestedEngines || ['territory_logistics'];

  const handleParsed = (rows: CSVRow[], rawText?: string) => {
    try {
      const text = rawText || '';

      // 1. Run Engine Auto-Detection
      if (text.trim() !== '') {
        const report = detectEnginesFromCSV(text);
        setDetectionReport(report);
      }

      const activeRegistry = currentEvent ? flatRegistry : [];

      // 2. Granular Ingestion with Quarantine Staging ("LEGO que não quebra")
      if (text.trim() !== '') {
        const importRes = importGranularCSV(activeRegistry, text, {
          mode: importMode,
          forceOverwriteState: !preserveHistory,
        });

        setParsedRows(importRes.validRows);
        setQuarantinedRows(importRes.quarantinedRows);
        setPreservedCount(importRes.diff.preservedHistoryCount);

        const computedDiff = buildDiff(activeRegistry, importRes.validRows);
        setDiff(computedDiff);
        setErrorMessage(null);

        // Auto-suggest new event name if empty
        if (!newEventName) {
          const rootRow = importRes.validRows.find((r: any) => r._type === 'root' || r._type === 'header');
          if (rootRow && rootRow.label) {
            setNewEventName(rootRow.label);
          } else {
            setNewEventName('Novo Evento Importado');
          }
        }
      } else {
        // Fallback for direct CSVRow array
        const computedDiff = buildDiff(activeRegistry, rows);
        const upsertRes = upsertRegistry(activeRegistry, rows, {
          forceOverwriteState: !preserveHistory,
        });
        setPreservedCount(upsertRes.diff.preservedHistoryCount);
        setParsedRows(rows);
        setQuarantinedRows([]);
        setDiff(computedDiff);
        setErrorMessage(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado na análise do CSV.');
    }
  };

  const handleActivateDetectedEngine = async (engineId: EngineId) => {
    if (!currentEvent) return;
    const currentList = getActiveEngines(currentEvent.config);
    const updatedEngines = Array.from(new Set([...currentList, engineId]));
    const updatedState = {
      ...currentEvent,
      config: {
        ...currentEvent.config,
        engineId: updatedEngines[0],
        activeEngines: updatedEngines,
      },
    };
    await updateEventState(currentEvent.config.id, updatedState);
  };

  const togglePreserveHistory = () => {
    const nextVal = !preserveHistory;
    setPreserveHistory(nextVal);
    const activeRegistry = currentEvent ? flatRegistry : [];
    if (parsedRows) {
      const upsertRes = upsertRegistry(activeRegistry, parsedRows, {
        forceOverwriteState: !nextVal,
      });
      setPreservedCount(upsertRes.diff.preservedHistoryCount);
    }
  };

  const handleCommit = async () => {
    if (!parsedRows) return;

    if (currentEvent) {
      if (currentEvent.config.id === eventId) {
        await commitCSVImport(parsedRows, {
          forceOverwriteState: !preserveHistory,
        });
      } else {
        const currentSkeleton = (await storage.loadSkeleton(currentEvent.config.id)) || [];
        const upsertRes = upsertRegistry(currentSkeleton, parsedRows, {
          forceOverwriteState: !preserveHistory,
        });
        await storage.saveSkeleton(currentEvent.config.id, upsertRes.updatedRegistry);
      }

      const hasCoords = parsedRows.some((r: any) => {
        try {
          const meta = r._meta_json ? JSON.parse(r._meta_json) : {};
          return (meta.lat && meta.lng) || (r.lat && r.lng);
        } catch {
          return false;
        }
      });

      if (hasCoords) {
        router.replace(`/territory-map?id=${currentEvent.config.id}`);
      } else {
        router.replace(`/skeleton-editor?id=${currentEvent.config.id}`);
      }
    } else {
      // Create NEW Event on the fly!
      const finalName = newEventName.trim() || 'Novo Evento Importado';
      const engines = detectionReport?.suggestedEngines && detectionReport.suggestedEngines.length > 0
        ? detectionReport.suggestedEngines
        : ['territory_logistics'];

      const newState = await addEvent(finalName, 'weekly', ['01'], engines);
      const upsertRes = upsertRegistry([], parsedRows, {
        forceOverwriteState: true,
      });
      await storage.saveSkeleton(newState.config.id, upsertRes.updatedRegistry);

      const hasCoords = parsedRows.some((r: any) => {
        try {
          const meta = r._meta_json ? JSON.parse(r._meta_json) : {};
          return (meta.lat && meta.lng) || (r.lat && r.lng);
        } catch {
          return false;
        }
      });

      if (hasCoords) {
        router.replace(`/territory-map?id=${newState.config.id}`);
      } else {
        router.replace(`/skeleton-editor?id=${newState.config.id}`);
      }
    }
  };

  const handleReset = () => {
    setParsedRows(null);
    setQuarantinedRows([]);
    setDiff(null);
    setErrorMessage(null);
    setDetectionReport(null);
    setPreservedCount(0);
  };

  const handleDownloadTemplate = (format: 'canonical' | 'clean_human') => {
    if (Platform.OS === 'web') {
      const content = exportTemplateCSV(activeTemplateEngine, format);
      const filename = format === 'canonical'
        ? `canonico_${currentTemplate.suggestedFilename}`
        : `limpo_${currentTemplate.suggestedFilename}`;
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('Download de template ativo via navegador web.');
    }
  };

  const handleCopyTemplate = (format: 'canonical' | 'clean_human') => {
    const content = exportTemplateCSV(activeTemplateEngine, format);
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(content);
      setCopyFeedback(`Exemplo ${format === 'canonical' ? 'Canônico' : 'Limpo'} copiado!`);
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollWrapper}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Voltar</Text>
            </Pressable>
            <Text style={styles.title}>
              {currentEvent ? 'Importação e Modelos de CSV' : 'Central Global de Modelos & Importação de CSV'}
            </Text>
            <Text style={styles.subtitle}>
              {currentEvent
                ? `Evento: ${currentEvent.config.name} • Engines Ativas: ${activeEngines.join(', ')}`
                : 'Baixe modelos canônicos de todas as 9 Engines ou importe qualquer planilha para criar um evento automaticamente.'}
            </Text>
          </View>

          {/* Section: Canonical Engine CSV Templates */}
          {!parsedRows && (
            <View style={styles.templateSection}>
              <View style={styles.templateSectionHeader}>
                <Text style={styles.templateSectionTitle}>
                  📚 Modelos de CSV por Engine (Exemplos para Exportar e Importar)
                </Text>
                <Text style={styles.templateSectionSub}>
                  Baixe os arquivos de exemplo para saber exatamente como construir o CSV para cada Engine.
                </Text>
              </View>

              {/* Engine Tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.engineTabs}>
                {allTemplates.map((tpl) => {
                  const isSelected = activeTemplateEngine === tpl.engineId;
                  return (
                    <Pressable
                      key={tpl.engineId}
                      onPress={() => setActiveTemplateEngine(tpl.engineId)}
                      style={[styles.engineTab, isSelected && styles.engineTabActive]}
                    >
                      <Text style={[styles.engineTabText, isSelected && styles.engineTabTextActive]}>
                        {tpl.name.split('&')[0].trim()}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Template Card */}
              <View style={styles.templateCard}>
                <View style={styles.templateCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateCardTitle}>{currentTemplate.name}</Text>
                    <Text style={styles.templateCardCategory}>{currentTemplate.category}</Text>
                    <Text style={styles.templateCardDesc}>{currentTemplate.description}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.templateActionsRow}>
                  <Pressable
                    onPress={() => handleDownloadTemplate('canonical')}
                    style={styles.templateBtnPrimary}
                  >
                    <Text style={styles.templateBtnPrimaryText}>📥 Baixar CSV Canônico (Completo)</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDownloadTemplate('clean_human')}
                    style={styles.templateBtnSecondary}
                  >
                    <Text style={styles.templateBtnSecondaryText}>📥 Baixar CSV Limpo (Humano)</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCopyTemplate('canonical')}
                    style={styles.templateBtnOutline}
                  >
                    <Text style={styles.templateBtnOutlineText}>📋 Copiar Exemplo</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowTemplateGuide(!showTemplateGuide)}
                    style={styles.templateBtnGhost}
                  >
                    <Text style={styles.templateBtnGhostText}>
                      {showTemplateGuide ? '▲ Ocultar Colunas' : 'ℹ️ Guia de Colunas'}
                    </Text>
                  </Pressable>
                </View>

                {copyFeedback && (
                  <Text style={styles.copyNotice}>{copyFeedback}</Text>
                )}

                {/* Column Guide Accordion */}
                {showTemplateGuide && (
                  <View style={styles.columnGuideBox}>
                    <Text style={styles.guideTitle}>Convenção de Códigos e Chaves:</Text>
                    <Text style={styles.guideDesc}>{currentTemplate.keyConventions}</Text>

                    <Text style={[styles.guideTitle, { marginTop: 12 }]}>Colunas Suportadas:</Text>
                    {currentTemplate.columnGuides.map((col, idx) => (
                      <View key={idx} style={styles.guideRow}>
                        <Text style={styles.guideColName}>{col.column}</Text>
                        <Text style={styles.guideColDesc}>{col.description}</Text>
                        <Text style={styles.guideColEx}>Ex: {col.example}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Erro na Validação</Text>
              <ScrollView style={styles.errorScroll}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </ScrollView>
              <Pressable onPress={handleReset} style={styles.errorDismissBtn}>
                <Text style={styles.errorDismissText}>Tentar Novamente</Text>
              </Pressable>
            </View>
          )}

          {/* Action Panel: DropZone & LEGO Mode */}
          {!parsedRows && !errorMessage && (
            <View style={styles.uploadArea}>
              {/* Modular Import Mode Selector */}
              <View style={styles.importModeRow}>
                <Text style={styles.importModeTitle}>🧩 Modo LEGO de Importação por Partes:</Text>
                <View style={styles.importModeButtons}>
                  <Pressable
                    onPress={() => setImportMode('additive_merge')}
                    style={[
                      styles.modeBtn,
                      importMode === 'additive_merge' && styles.modeBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        importMode === 'additive_merge' && styles.modeBtnTextActive,
                      ]}
                    >
                      Mesclar Aditivamente (Preserva outros ramos)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setImportMode('branch_replace')}
                    style={[
                      styles.modeBtn,
                      importMode === 'branch_replace' && styles.modeBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        importMode === 'branch_replace' && styles.modeBtnTextActive,
                      ]}
                    >
                      Substituir Apenas o Ramo Específico
                    </Text>
                  </Pressable>
                </View>
              </View>

              <CSVDropZone onParsed={handleParsed} onError={setErrorMessage} />
              <Text style={styles.uploadSub}>
                Arraste qualquer CSV (canônico ou limpo). O Sekundo detecta a Engine automaticamente e isola linhas irregulares na Quarentena!
              </Text>
            </View>
          )}

          {/* Preview and Diff area */}
          {parsedRows && diff && !errorMessage && (
            <View style={styles.previewArea}>
              {/* Auto-Detection Banner */}
              {detectionReport && (
                <View style={styles.detectionBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detectionTitle}>✨ Detecção Automática de Engine</Text>
                    <Text style={styles.detectionSummary}>{detectionReport.summary}</Text>
                    {detectionReport.matches.slice(0, 2).map((m) => (
                      <Text key={m.engineId} style={styles.detectionReason}>
                        • {m.name}: {m.confidence}% ({m.reasons[0] || 'Aderência estrutural'})
                      </Text>
                    ))}
                  </View>
                  {!activeEngines.includes(detectionReport.primaryEngine) && (
                    <Pressable
                      onPress={() => handleActivateDetectedEngine(detectionReport.primaryEngine)}
                      style={styles.activateEngineBtn}
                    >
                      <Text style={styles.activateEngineBtnText}>
                        ⚡ Ativar {detectionReport.primaryEngine}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Quarantine Staging Card (LEGO Fault Isolation) */}
              {quarantinedRows.length > 0 && (
                <View style={styles.quarantineCard}>
                  <Text style={styles.quarantineTitle}>
                    ⚠️ Quarentena Ativa: {quarantinedRows.length} linha(s) isolada(s)
                  </Text>
                  <Text style={styles.quarantineSub}>
                    Linhas com formatação incompatível foram isoladas para que o restante do seu LEGO seja importado sem quebrar!
                  </Text>
                  <ScrollView style={styles.quarantineScroll}>
                    {quarantinedRows.map((q, idx) => (
                      <View key={idx} style={styles.quarantineItem}>
                        <Text style={styles.quarantineLine}>Linha {q.rowNumber} {q.attemptedKey ? `(${q.attemptedKey})` : ''}:</Text>
                        <Text style={styles.quarantineReason}>{q.reason}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.previewTitle}>Prévia de Mesclagem & Resolução</Text>
              <Text style={styles.previewSub}>
                O Sekundo compara os códigos hierárquicos e atualiza seu evento de forma não-destrutiva.
              </Text>

              {/* Smart History Preservation Toggle */}
              <Pressable
                onPress={togglePreserveHistory}
                style={[
                  styles.historyToggleCard,
                  preserveHistory && styles.historyToggleCardActive,
                ]}
              >
                <View style={styles.toggleRow}>
                  <View
                    style={[
                      styles.toggleIndicator,
                      preserveHistory && styles.toggleIndicatorActive,
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>
                      Preservar Histórico Operacional de Campo
                    </Text>
                    <Text style={styles.toggleDesc}>
                      {preserveHistory
                        ? `✅ ATIVADO: Preserva status trabalhado, datas de visita e anotações. (${preservedCount} nós preservados).`
                        : '⚠️ DESATIVADO: Valores da planilha importada sobrescreverão todo o histórico.'}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Diff Summary Cards */}
              <View style={styles.diffBadgesRow}>
                <View style={[styles.diffBadge, styles.badgeAdd]}>
                  <Text style={styles.badgeText}>+ {diff.added} Adições</Text>
                </View>
                <View style={[styles.diffBadge, styles.badgeMod]}>
                  <Text style={styles.badgeText}>~ {diff.modified} Alterações</Text>
                </View>
                <View style={[styles.diffBadge, styles.badgeUnchanged]}>
                  <Text style={styles.badgeText}>= {diff.unchanged} Inalterados</Text>
                </View>
                {diff.deleted > 0 && (
                  <View style={[styles.diffBadge, styles.badgeDel]}>
                    <Text style={styles.badgeText}>- {diff.deleted} Removidos</Text>
                  </View>
                )}
              </View>

              {/* Table Preview */}
              <View style={styles.tableBox}>
                <CSVPreviewTable diff={diff} />
              </View>

              {/* Destination Selector for Standalone Mode */}
              {!eventId && (
                <View style={styles.destinationBox}>
                  <Text style={styles.destinationTitle}>🎯 Onde salvar estes dados?</Text>
                  <Text style={styles.destinationSub}>
                    Você está na Central Global de CSV. Escolha se deseja criar um novo evento ou atualizar um existente:
                  </Text>

                  {/* Option to create new event */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.destinationLabel}>Nome do Novo Evento:</Text>
                    <TextInput
                      style={styles.destinationInput}
                      value={newEventName}
                      onChangeText={(val) => {
                        setNewEventName(val);
                        setTargetEventId('');
                      }}
                      placeholder="Ex: Territórios Pinhais - Grupo Espanhol"
                      placeholderTextColor="#4F5E74"
                    />
                  </View>

                  {events.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.destinationSub}>Ou selecione um evento existente para mesclar:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventChipRow}>
                        <Pressable
                          onPress={() => setTargetEventId('')}
                          style={[
                            styles.eventChip,
                            !targetEventId && styles.eventChipActive,
                          ]}
                        >
                          <Text style={[styles.eventChipText, !targetEventId && styles.eventChipTextActive]}>
                            ✨ Criar Novo Evento
                          </Text>
                        </Pressable>
                        {events.map((ev) => {
                          const isEvSelected = targetEventId === ev.config.id;
                          return (
                            <Pressable
                              key={ev.config.id}
                              onPress={() => setTargetEventId(ev.config.id)}
                              style={[
                                styles.eventChip,
                                isEvSelected && styles.eventChipActive,
                              ]}
                            >
                              <Text style={[styles.eventChipText, isEvSelected && styles.eventChipTextActive]}>
                                {ev.config.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Actions Footer */}
              <View style={styles.footerActions}>
                <Pressable onPress={handleReset} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Descartar e Voltar</Text>
                </Pressable>
                <Pressable onPress={handleCommit} style={styles.commitBtn}>
                  <Text style={styles.commitBtnText}>
                    {currentEvent
                      ? `Confirmar e Salvar no Evento (${parsedRows.length} itens)`
                      : `✨ Criar Novo Evento & Salvar Dados (${parsedRows.length} itens)`}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
  },
  scrollWrapper: {
    padding: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 960,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 4,
  },
  templateSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
  },
  templateSectionHeader: {
    marginBottom: 12,
  },
  templateSectionTitle: {
    color: '#FFB800',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  templateSectionSub: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 2,
  },
  engineTabs: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  engineTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  engineTabActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderColor: '#FFB800',
  },
  engineTabText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  engineTabTextActive: {
    color: '#FFB800',
  },
  templateCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  templateCardTop: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  templateCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  templateCardCategory: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  templateCardDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  templateActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateBtnPrimary: {
    backgroundColor: '#FFB800',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  templateBtnPrimaryText: {
    color: '#12151C',
    fontSize: 12,
    fontWeight: '700',
  },
  templateBtnSecondary: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  templateBtnSecondaryText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
  },
  templateBtnOutline: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  templateBtnOutlineText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  templateBtnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  templateBtnGhostText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  copyNotice: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  columnGuideBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  guideTitle: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '700',
  },
  guideDesc: {
    color: '#8A94A6',
    fontSize: 11,
    marginTop: 2,
  },
  guideRow: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 6,
    borderRadius: 4,
  },
  guideColName: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
  guideColDesc: {
    color: '#D1D5DB',
    fontSize: 11,
    marginTop: 1,
  },
  guideColEx: {
    color: '#9CA3AF',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 1,
  },
  uploadArea: {
    marginTop: 8,
  },
  importModeRow: {
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  importModeTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  importModeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeBtnActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
  },
  modeBtnText: {
    color: '#8A94A6',
    fontSize: 12,
  },
  modeBtnTextActive: {
    color: '#FFB800',
    fontWeight: '600',
  },
  uploadSub: {
    color: '#6F7E94',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
  detectionBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detectionTitle: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  detectionSummary: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
  },
  detectionReason: {
    color: '#8A94A6',
    fontSize: 11,
    marginTop: 1,
  },
  activateEngineBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activateEngineBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  quarantineCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 14,
    marginBottom: 16,
  },
  quarantineTitle: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '700',
  },
  quarantineSub: {
    color: '#D1D5DB',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  quarantineScroll: {
    maxHeight: 120,
  },
  quarantineItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  quarantineLine: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  quarantineReason: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 1,
  },
  previewArea: {
    marginTop: 8,
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  previewSub: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  historyToggleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    marginBottom: 14,
  },
  historyToggleCardActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#4F5E74',
    marginRight: 10,
  },
  toggleIndicatorActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleDesc: {
    color: '#8A94A6',
    fontSize: 11,
    marginTop: 2,
  },
  diffBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  diffBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeAdd: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  badgeMod: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  badgeUnchanged: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  badgeDel: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tableBox: {
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '600',
  },
  commitBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  commitBtnText: {
    color: '#12151C',
    fontSize: 13,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorScroll: {
    maxHeight: 120,
  },
  errorText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  errorDismissBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#EF4444',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  errorDismissText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  destinationBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  destinationTitle: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  destinationSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  destinationLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  destinationInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  eventChipRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  eventChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  eventChipActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderColor: '#FFB800',
  },
  eventChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  eventChipTextActive: {
    color: '#FFB800',
    fontWeight: '700',
  },
});
