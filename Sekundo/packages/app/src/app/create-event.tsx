/**
 * Page: create-event
 *
 * Sekundo — AutoCAD Icon-Only Event & Multi-Engine Station (`100dvh`, Zero Roll-Down).
 *
 * Features:
 * - Compact Icon Grid (`58x54px`) for all Universal Engines (click to toggle & inspect)
 * - Direct Download & Import of the **CSV GERAL (`sekundo_omni_geral.csv`)** via `omniStorageBridge`
 * - Zero clipped controls on Mobile (`390x844`) and minimal static text
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import * as storage from '../storage/localStorage';
import {
  engineRegistry,
  detectEnginesFromCSV,
  parseCSV,
  upsertRegistry,
  exportTemplateCSV,
  getEngineTemplate,
  generateOmniMasterSampleCsv,
  importOmniCsvBundle,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  buildCombinedMultiEngineSkeleton,
  autoAssignScheduleRegistry,
  type Frequency,
  type EngineId,
} from '@sekundo/core';
import {
  commitOmniCsvBundleToStorage,
  exportFullSiteOmniCsvFromStorage,
  loadSavedPrivilegeParticipants,
  savePrivilegeParticipants,
  saveScheduleRegistry,
  saveTerritoryRegistry,
} from '../storage/omniStorageBridge';
import { deliverFile } from '../utils/deliverFile';

const ENGINE_ICONS: Record<string, string> = {
  territory_logistics: '🗺️',
  roster_assignments: '📅',
  study_synthesis: '📖',
  financial_ledger: '💰',
  inventory_assets: '📦',
  action_tracker: '✅',
  live_production_ros: '⏱️',
  incident_command: '🚨',
  tournament_pairings: '🏆',
  CheckInEngine: '🚪',
  DocumentEngine: '🖋️',
  custom: '🎛️',
};

export default function CreateEvent() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const { addEvent, refreshEvents } = useLocalEvent();

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [selectedEngines, setSelectedEngines] = useState<EngineId[]>([
    'roster_assignments',
    'territory_logistics',
  ]);
  const [inspectedEngineId, setInspectedEngineId] = useState<EngineId>('roster_assignments');
  const [autoFillWithPrivileges, setAutoFillWithPrivileges] = useState<boolean>(true);
  const [strictSameCategoryPairing, setStrictSameCategoryPairing] = useState<boolean>(true);
  const [showInfoBox, setShowInfoBox] = useState<boolean>(false);

  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null);
  const [uploadedCsvText, setUploadedCsvText] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const availableEngines = engineRegistry.list();
  const inspectedEngine =
    availableEngines.find((e) => e.id === inspectedEngineId) || availableEngines[0];
  const inspectedTemplate = getEngineTemplate(inspectedEngineId);

  const handleEngineClick = (id: EngineId) => {
    setInspectedEngineId(id);
    if (selectedEngines.includes(id)) {
      if (selectedEngines.length > 1) {
        setSelectedEngines(selectedEngines.filter((e) => e !== id));
      }
    } else {
      setSelectedEngines([...selectedEngines, id]);
    }
  };

  const handleDownloadEngineSampleCsv = async (engineId: EngineId) => {
    const tpl = getEngineTemplate(engineId);
    const csv = exportTemplateCSV(engineId, 'canonical');
    await deliverFile(
      csv,
      tpl.suggestedFilename || `exemplo_${engineId}.csv`,
      'text/csv;charset=utf-8'
    );
    setAutoDetectNotice(`📥 Exemplo "${tpl.name}" baixado!`);
  };

  const handleDownloadSavedOmniCsv = async () => {
    const csv = await exportFullSiteOmniCsvFromStorage();
    await deliverFile(csv, 'sekundo_omni_geral.csv', 'text/csv;charset=utf-8');
    setAutoDetectNotice('🌐 CSV Geral (Estado Salvo no Site) baixado!');
  };

  const handleDownloadSampleOmniCsv = async () => {
    const csv = generateOmniMasterSampleCsv();
    await deliverFile(csv, 'sekundo_omni_exemplo.csv', 'text/csv;charset=utf-8');
    setAutoDetectNotice('🧪 CSV Geral de Exemplo baixado!');
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
        setUploadedCsvText(text);
        setUploadedFileName(file.name);

        if (text.trim().startsWith('_record_kind,')) {
          const bundle = importOmniCsvBundle(text);
          if (!name.trim()) setName(`${bundle.unitName} — Multi-Engine`);
          setAutoDetectNotice(
            `🌐 "${file.name}": ${bundle.participants.length} 👤 • ${bundle.scheduleRegistry.length} 📅 • ${bundle.territoryRegistry.length} 🗺️`
          );
          setValidationError(null);
          return;
        }

        const report = detectEnginesFromCSV(text);
        if (report.suggestedEngines.length > 0) {
          setSelectedEngines(report.suggestedEngines);
          setInspectedEngineId(report.suggestedEngines[0]);
        }
        if (!name.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
        setAutoDetectNotice(`✅ CSV "${file.name}" pronto!`);
        setValidationError(null);
      };
      input.click();
    }
  };

  const handleCreate = async () => {
    let finalName = name.trim();
    if (!finalName) {
      if (uploadedFileName) {
        finalName = uploadedFileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      } else {
        finalName = `Evento ${inspectedEngine?.name.split('&')[0]?.trim() || 'Sekundo'}`;
      }
    }

    setValidationError(null);

    // 1. Check if uploaded CSV is an Omni-CSV Bundle
    if (uploadedCsvText && uploadedCsvText.trim().startsWith('_record_kind,')) {
      const { primaryEventId } = await commitOmniCsvBundleToStorage(uploadedCsvText, {
        customEventName: finalName,
      });
      await refreshEvents();
      router.replace(`/schedule-hub?id=${primaryEventId}` as any);
      return;
    }

    const state = await addEvent(finalName, frequency, ['01'], selectedEngines);

    // 2. If single-engine CSV was uploaded, commit it
    if (uploadedCsvText) {
      try {
        const parsed = parseCSV(uploadedCsvText);
        const upsertRes = upsertRegistry([], parsed, { forceOverwriteState: true });
        await storage.saveSkeleton(state.config.id, upsertRes.updatedRegistry);
        router.replace(`/skeleton-editor?id=${state.config.id}`);
        return;
      } catch (err) {
        console.warn('[Sekundo] Erro ao salvar CSV:', err);
      }
    }

    // 3. Auto-Fill Multi-Engine Workspace (Schedule + Territory + Privileges)
    if (autoFillWithPrivileges) {
      const directory = await loadSavedPrivilegeParticipants();
      const baseSchedule = buildProgramacaoReuniaoRegistry(undefined, directory);
      const { updatedRegistry, updatedParticipants } = autoAssignScheduleRegistry(
        baseSchedule,
        directory,
        { strictSameCategoryPairing }
      );
      const territoryRegistry = buildTerritoriosS13HistoricalRegistry();
      await savePrivilegeParticipants(updatedParticipants);
      await saveScheduleRegistry(updatedRegistry);
      await saveTerritoryRegistry(territoryRegistry);

      const combinedSkeleton = buildCombinedMultiEngineSkeleton({
        scheduleRegistry: updatedRegistry,
        territoryRegistry,
      });
      await storage.saveSkeleton(state.config.id, combinedSkeleton);
      router.replace(`/schedule-hub?id=${state.config.id}` as any);
      return;
    }

    router.replace(`/skeleton-editor?id=${state.config.id}`);
  };

  const frequencies: { key: Frequency; icon: string; title: string }[] = [
    { key: 'weekly', icon: '🔄', title: 'Semanal' },
    { key: 'monthly', icon: '📅', title: 'Mensal' },
    { key: 'annual', icon: '🗓️', title: 'Anual' },
    { key: 'once', icon: '📌', title: 'Único' },
  ];

  const webTitle = (title: string) => (Platform.OS === 'web' ? ({ title } as any) : {});

  return (
    <SafeAreaView style={styles.cadViewport}>
      {/* Top Icon-Only AutoCAD Command Ribbon */}
      <View style={styles.topRibbon}>
        <View style={styles.brandRow}>
          <Pressable
            testID="create-event-back-btn"
            accessibilityRole="button"
            accessibilityLabel="Painel Inicial"
            {...webTitle('Voltar ao Painel Inicial')}
            onPress={() => router.push('/')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconGlyph}>🏠</Text>
          </Pressable>
          <Text style={styles.ribbonTitle}>📐 NOVO EVENTO MULTI-ENGINE</Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            testID="create-event-pick-csv-btn"
            accessibilityRole="button"
            accessibilityLabel="Importar CSV"
            {...webTitle('Selecionar Arquivo .CSV (Geral ou Engine)')}
            onPress={handlePickCsvFile}
            style={[styles.iconBtn, styles.cadBtnBlue]}
          >
            <Text style={styles.iconGlyph}>📥</Text>
          </Pressable>

          <Pressable
            testID="create-event-download-saved-omni-btn"
            accessibilityRole="button"
            accessibilityLabel="Baixar CSV Geral Salvo"
            {...webTitle('Baixar CSV Geral (Salvo no Site)')}
            onPress={handleDownloadSavedOmniCsv}
            style={[styles.iconBtn, styles.cadBtnPurple]}
          >
            <Text style={styles.iconGlyph}>🌐</Text>
          </Pressable>

          <Pressable
            testID="create-event-download-sample-omni-btn"
            accessibilityRole="button"
            accessibilityLabel="Baixar CSV Geral de Exemplo"
            {...webTitle('Baixar CSV Geral de Exemplo')}
            onPress={handleDownloadSampleOmniCsv}
            style={styles.iconBtn}
          >
            <Text style={styles.iconGlyph}>🧪</Text>
          </Pressable>

          <Pressable
            testID="create-event-open-csv-station-btn"
            accessibilityRole="button"
            accessibilityLabel="Central de Modelos CSV"
            {...webTitle('Abrir Central de Modelos CSV')}
            onPress={() => router.push('/csv-import')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconGlyph}>📚</Text>
          </Pressable>

          <Pressable
            testID="create-event-info-btn"
            accessibilityRole="button"
            accessibilityLabel="Informações"
            {...webTitle('Mostrar/Ocultar Detalhes da Engine')}
            onPress={() => setShowInfoBox((prev) => !prev)}
            style={[styles.iconBtn, showInfoBox && styles.cadBtnBlue]}
          >
            <Text style={styles.iconGlyph}>ℹ️</Text>
          </Pressable>
        </View>
      </View>

      {/* Compact Sub-Ribbon: Event Name Input + Icon Toggles + Launch Button */}
      <View style={styles.configRibbon}>
        <TextInput
          style={styles.nameInput}
          placeholder="Nome do Evento..."
          placeholderTextColor="#64748B"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.freqGroup}>
          {frequencies.map((f) => {
            const active = frequency === f.key;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityLabel={f.title}
                {...webTitle(`Frequência: ${f.title}`)}
                onPress={() => setFrequency(f.key)}
                style={[styles.iconBtn, active && styles.freqPillActive]}
              >
                <Text style={styles.iconGlyph}>{f.icon}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          testID="create-event-toggle-autofill-btn"
          accessibilityRole="button"
          accessibilityLabel="Auto-Designar c/ Privilégios"
          {...webTitle(
            autoFillWithPrivileges
              ? 'Auto-Designar com Privilégios: ATIVO'
              : 'Auto-Designar com Privilégios: INATIVO'
          )}
          onPress={() => setAutoFillWithPrivileges((prev) => !prev)}
          style={[
            styles.iconBtn,
            autoFillWithPrivileges ? styles.cadBtnEmerald : styles.cadBtnMuted,
          ]}
        >
          <Text style={styles.iconGlyph}>⚡</Text>
        </Pressable>

        {autoFillWithPrivileges && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alternar Pareamento de Duplas"
            {...webTitle(
              strictSameCategoryPairing ? 'Duplas: Mesma Grade' : 'Duplas: Misto Livre'
            )}
            onPress={() => setStrictSameCategoryPairing((prev) => !prev)}
            style={styles.iconBtn}
          >
            <Text style={styles.iconGlyph}>🔗</Text>
          </Pressable>
        )}

        <Pressable
          testID="create-event-submit-btn"
          accessibilityRole="button"
          accessibilityLabel="Criar Evento"
          {...webTitle(`Criar Evento (${selectedEngines.length} Engines)`)}
          onPress={handleCreate}
          style={[styles.iconBtn, styles.cadBtnGold]}
        >
          <Text style={styles.iconGlyph}>🚀</Text>
        </Pressable>
      </View>

      {(autoDetectNotice || validationError) && (
        <View style={styles.noticeStrip}>
          <Text style={styles.noticeText} numberOfLines={1}>
            {validationError || autoDetectNotice}
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
        {/* Left: Compact Icon Grid of Engines (`58x54px`) */}
        <View style={[styles.matrixPanel, { flex: isDesktop ? 1 : undefined }]}>
          <Text style={styles.panelHeaderLabel}>
            🎛️ ENGINES ({selectedEngines.length})
          </Text>
          <View style={styles.enginesGrid}>
            {availableEngines.map((eng, idx) => {
              const isChecked = selectedEngines.includes(eng.id);
              const isInspected = inspectedEngineId === eng.id;
              const icon = ENGINE_ICONS[eng.id] || '⚙️';
              return (
                <Pressable
                  key={eng.id}
                  testID={`engine-select-btn-${eng.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={eng.name}
                  {...webTitle(`${eng.name} (${isChecked ? 'Ativa' : 'Inativa'})`)}
                  onPress={() => handleEngineClick(eng.id)}
                  style={[
                    styles.engineButton,
                    isChecked && styles.engineButtonActive,
                    isInspected && { borderColor: '#38BDF8', borderWidth: 1.5 },
                  ]}
                >
                  <Text style={styles.engineIcon}>{icon}</Text>
                  <Text style={styles.engineBtnCode}>
                    E0{idx + 1} {isChecked ? '☑' : '☐'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Right: Compact Inspector */}
        <View style={[styles.inspectorPanel, { flex: isDesktop ? 1.1 : undefined }]}>
          <View style={styles.inspectorHeader}>
            <Text style={styles.inspectorHeaderTitle} numberOfLines={1}>
              {ENGINE_ICONS[inspectedEngineId] || '🔍'} {inspectedEngine?.name}
            </Text>
          </View>

          <Text style={styles.inspectorCsvMeta} numberOfLines={1}>
            📄 {inspectedTemplate?.suggestedFilename}
          </Text>

          <View style={styles.inspectorBtnRow}>
            <Pressable
              testID="inspector-download-engine-csv-btn"
              accessibilityRole="button"
              accessibilityLabel="Baixar CSV de Exemplo desta Engine"
              {...webTitle('Baixar .CSV de Exemplo desta Engine')}
              onPress={() => handleDownloadEngineSampleCsv(inspectedEngineId)}
              style={[styles.iconBtn, styles.cadBtnBlue]}
            >
              <Text style={styles.iconGlyph}>📥</Text>
            </Pressable>

            <Pressable
              testID="inspector-download-saved-omni-btn"
              accessibilityRole="button"
              accessibilityLabel="Baixar CSV Geral Salvo"
              {...webTitle('Baixar .CSV GERAL (Salvo no Site)')}
              onPress={handleDownloadSavedOmniCsv}
              style={[styles.iconBtn, styles.cadBtnPurple]}
            >
              <Text style={styles.iconGlyph}>🌐</Text>
            </Pressable>

            <Pressable
              testID="inspector-download-sample-omni-btn"
              accessibilityRole="button"
              accessibilityLabel="Baixar CSV Geral de Exemplo"
              {...webTitle('Baixar .CSV GERAL de Exemplo')}
              onPress={handleDownloadSampleOmniCsv}
              style={styles.iconBtn}
            >
              <Text style={styles.iconGlyph}>🧪</Text>
            </Pressable>

            <Pressable
              testID="inspector-submit-create-btn"
              accessibilityRole="button"
              accessibilityLabel="Criar e Abrir Evento"
              {...webTitle('Criar e Abrir Evento Agora')}
              onPress={handleCreate}
              style={[styles.iconBtn, styles.cadBtnGold]}
            >
              <Text style={styles.iconGlyph}>🚀</Text>
            </Pressable>
          </View>

          {showInfoBox && (
            <View style={styles.privilegeInfoBox}>
              <Text style={styles.privilegeInfoDesc}>
                {inspectedEngine?.description}
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  cadBtnMuted: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  cadBtnGold: {
    backgroundColor: '#FFB800',
    borderColor: '#FDE68A',
  },
  configRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  nameInput: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#060A12',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: '#F8FAFC',
    fontSize: 12,
  },
  freqGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  freqPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#7DD3FC',
  },
  noticeStrip: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  noticeText: {
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
  panelHeaderLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  enginesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  engineButton: {
    width: 60,
    height: 54,
    backgroundColor: '#0B1120',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  engineButtonActive: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  engineIcon: {
    fontSize: 18,
  },
  engineBtnCode: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '900',
  },
  inspectorPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    gap: 8,
    overflow: 'hidden',
  },
  inspectorHeader: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  inspectorHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
  },
  inspectorCsvMeta: {
    color: '#38BDF8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  inspectorBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  privilegeInfoBox: {
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
  },
  privilegeInfoDesc: {
    color: '#94A3B8',
    fontSize: 10.5,
    lineHeight: 15,
  },
});
