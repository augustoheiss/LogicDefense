/**
 * Page: create-event
 *
 * Sekundo — AutoCAD-Style Event & Engine Station (`100dvh`, Zero Vertical Roll-Down).
 *
 * Features:
 * - Compact CAD Button Grid for all 9 Universal Engines (clicking any button toggles it
 *   and displays its description + per-Engine sample `.csv` download in the Inspector).
 * - Direct Download & Import of the **CSV GERAL de todo o App (`sekundo_omni_geral.csv`)**
 *   covering all 9 Engines + 📅 Programação & WhatsApp + 🖋️ Estúdio Documental YAML ⇄ PDF
 *   + ☀️ Cockpit Hoje + 🛡️ Matriz de Privilégios.
 * - Automated Fair-Rotation Assignment (`⚡ Auto-Preencher com Privilégios & Rotatividade`)
 *   when creating a schedule/roster event (zero same-day collisions, FIFO rotation).
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
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  autoAssignScheduleRegistry,
  type Frequency,
  type EngineId,
} from '@sekundo/core';

export default function CreateEvent() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const { addEvent } = useLocalEvent();

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [selectedEngines, setSelectedEngines] = useState<EngineId[]>(['roster_assignments']);
  const [inspectedEngineId, setInspectedEngineId] = useState<EngineId>('roster_assignments');
  const [autoFillWithPrivileges, setAutoFillWithPrivileges] = useState<boolean>(true);
  const [strictSameCategoryPairing, setStrictSameCategoryPairing] = useState<boolean>(true);

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

  // Download specific Engine sample CSV
  const handleDownloadEngineSampleCsv = (engineId: EngineId) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const tpl = getEngineTemplate(engineId);
      const csv = exportTemplateCSV(engineId, 'canonical');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = tpl.suggestedFilename || `exemplo_${engineId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setAutoDetectNotice(`📥 Exemplo CSV da Engine "${tpl.name}" baixado!`);
    }
  };

  // Download Unified Master CSV ("CSV GERAL de todo o App")
  const handleDownloadOmniMasterCsv = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const csv = generateOmniMasterSampleCsv();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sekundo_omni_geral.csv';
      a.click();
      URL.revokeObjectURL(url);
      setAutoDetectNotice(
        '🌐 CSV GERAL do App Sekundo baixado (inclui 9 Engines + Programação/WhatsApp + Estúdio YAML/PDF + Hoje + Matriz de Privilégios)!'
      );
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
        setUploadedCsvText(text);
        setUploadedFileName(file.name);

        if (text.trim().startsWith('_record_kind,')) {
          const bundle = importOmniCsvBundle(text);
          if (!name.trim()) setName(`${bundle.unitName} — Pacote Omni CSV`);
          setAutoDetectNotice(
            `🌐 CSV GERAL "${file.name}" reconhecido (${bundle.participants.length} participantes, ${bundle.scheduleRegistry.length} itens de programação, ${bundle.territoryRegistry.length} territórios, ${bundle.events.length} eventos)!`
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
        setAutoDetectNotice(`✅ CSV "${file.name}" carregado! ${report.summary}`);
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
      const bundle = importOmniCsvBundle(uploadedCsvText);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem('sekundo:loaded_schedule_bundle_v1', uploadedCsvText);
        window.localStorage.setItem(
          'sekundo:privilege_directory_v1',
          JSON.stringify(bundle.participants)
        );
      }
      const state = await addEvent(finalName, frequency, ['01', '02', '03'], selectedEngines);
      await storage.saveSkeleton(state.config.id, bundle.scheduleRegistry);
      router.replace(`/schedule-hub?id=${state.config.id}` as any);
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

    // 3. If Auto-Fill with Privilege Matrix & Fair Rotation is enabled, generate auto-assigned schedule!
    if (autoFillWithPrivileges) {
      let directory = DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const savedDir = window.localStorage.getItem('sekundo:privilege_directory_v1');
        if (savedDir) {
          try {
            const parsed = JSON.parse(savedDir);
            if (Array.isArray(parsed) && parsed.length > 0) directory = parsed;
          } catch {
            // use default
          }
        }
      }
      const baseSchedule = buildProgramacaoReuniaoRegistry(undefined, directory);
      const { updatedRegistry, updatedParticipants } = autoAssignScheduleRegistry(
        baseSchedule,
        directory,
        { strictSameCategoryPairing }
      );
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem(
          'sekundo:privilege_directory_v1',
          JSON.stringify(updatedParticipants)
        );
      }
      await storage.saveSkeleton(state.config.id, updatedRegistry);
      router.replace(`/schedule-hub?id=${state.config.id}` as any);
      return;
    }

    router.replace(`/skeleton-editor?id=${state.config.id}`);
  };

  const frequencies: { key: Frequency; label: string }[] = [
    { key: 'weekly', label: '🔄 Semanal' },
    { key: 'monthly', label: '📅 Mensal' },
    { key: 'annual', label: '🗓️ Anual' },
    { key: 'once', label: '📌 Único' },
  ];

  return (
    <SafeAreaView style={styles.cadViewport}>
      {/* Top AutoCAD Command Ribbon */}
      <View style={styles.topRibbon}>
        <View style={styles.brandRow}>
          <Pressable onPress={() => router.push('/')} style={styles.cadBtn}>
            <Text style={[styles.cadBtnText, { color: '#FFB800' }]}>← Painel</Text>
          </Pressable>
          <Text style={styles.ribbonTitle}>📐 ESTAÇÃO CAD — NOVO EVENTO, ENGINES & CSV GERAL</Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            onPress={handleDownloadOmniMasterCsv}
            style={[styles.cadBtn, styles.cadBtnPurple]}
          >
            <Text style={styles.cadBtnText}>🌐 Baixar CSV GERAL do App</Text>
          </Pressable>

          <Pressable onPress={handlePickCsvFile} style={[styles.cadBtn, styles.cadBtnBlue]}>
            <Text style={styles.cadBtnText}>📥 Importar .CSV (Geral ou Engine)</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/csv-import')}
            style={styles.cadBtn}
          >
            <Text style={styles.cadBtnText}>📚 Central de Modelos CSV</Text>
          </Pressable>
        </View>
      </View>

      {/* Sub-Ribbon: Event Name Input + Frequency Pills + Auto-Fill Privilege Toggle + Create CTA */}
      <View style={styles.configRibbon}>
        <TextInput
          style={styles.nameInput}
          placeholder="Nome do Evento (ex: Programação Técnica Out/Nov)..."
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
                onPress={() => setFrequency(f.key)}
                style={[styles.freqPill, active && styles.freqPillActive]}
              >
                <Text style={[styles.freqPillText, active && { color: '#090D16' }]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setAutoFillWithPrivileges((prev) => !prev)}
          style={[
            styles.cadBtn,
            autoFillWithPrivileges ? styles.cadBtnEmerald : styles.cadBtnMuted,
          ]}
        >
          <Text style={styles.cadBtnText}>
            {autoFillWithPrivileges
              ? '⚡ Auto-Designar c/ Privilégios: ATIVO'
              : '⚡ Auto-Designar: INATIVO'}
          </Text>
        </Pressable>

        {autoFillWithPrivileges && (
          <Pressable
            onPress={() => setStrictSameCategoryPairing((prev) => !prev)}
            style={styles.cadBtn}
          >
            <Text style={styles.cadBtnText}>
              {strictSameCategoryPairing ? '🔗 Duplas: Mesma Grade' : '🔗 Duplas: Misto'}
            </Text>
          </Pressable>
        )}

        <Pressable onPress={handleCreate} style={[styles.cadBtn, styles.cadBtnGold]}>
          <Text style={[styles.cadBtnText, { color: '#090D16', fontWeight: '900' }]}>
            🚀 CRIAR EVENTO ({selectedEngines.length} Engine{selectedEngines.length > 1 ? 's' : ''})
          </Text>
        </Pressable>
      </View>

      {(autoDetectNotice || validationError) && (
        <View style={styles.noticeStrip}>
          <Text style={styles.noticeText}>{validationError || autoDetectNotice}</Text>
        </View>
      )}

      {/* Main Split Workspace (Zero Vertical Roll-Down!) */}
      <View
        style={[
          styles.workspaceSplit,
          { flexDirection: isDesktop ? 'row' : 'column' },
        ]}
      >
        {/* Left: Compact Grid of Engine Buttons */}
        <View style={[styles.matrixPanel, { flex: isDesktop ? 1.25 : undefined }]}>
          <Text style={styles.panelHeaderLabel}>
            🎛️ SELECIONE AS ENGINES ATIVAS (Clique no botão para ativar e ver o CSV de exemplo):
          </Text>
          <View style={styles.enginesGrid}>
            {availableEngines.map((eng, idx) => {
              const isChecked = selectedEngines.includes(eng.id);
              const isInspected = inspectedEngineId === eng.id;
              return (
                <Pressable
                  key={eng.id}
                  onPress={() => handleEngineClick(eng.id)}
                  style={[
                    styles.engineButton,
                    isChecked && styles.engineButtonActive,
                    isInspected && { borderColor: '#38BDF8', borderWidth: 1.5 },
                  ]}
                >
                  <View style={styles.engineBtnHeader}>
                    <Text style={styles.engineBtnCode}>
                      [E0{idx + 1}] {isChecked ? '☑ ATIVA' : '☐'}
                    </Text>
                  </View>
                  <Text style={styles.engineBtnTitle} numberOfLines={1}>
                    {eng.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Right: On-Demand Engine & CSV Inspector */}
        <View style={[styles.inspectorPanel, { flex: isDesktop ? 1 : undefined }]}>
          <View style={styles.inspectorHeader}>
            <Text style={styles.inspectorHeaderTitle}>
              🔍 INSPETOR DA ENGINE: {inspectedEngine?.name}
            </Text>
          </View>

          <Text style={styles.inspectorDesc}>{inspectedEngine?.description}</Text>

          <View style={styles.inspectorCsvBox}>
            <Text style={styles.inspectorCsvTitle}>
              📄 Modelo CSV Específico desta Engine ({inspectedTemplate?.suggestedFilename}):
            </Text>
            <Text style={styles.inspectorCsvMeta}>
              {inspectedTemplate?.keyConventions}
            </Text>

            <View style={styles.inspectorBtnRow}>
              <Pressable
                onPress={() => handleDownloadEngineSampleCsv(inspectedEngineId)}
                style={[styles.cadBtn, styles.cadBtnBlue]}
              >
                <Text style={styles.cadBtnText}>
                  📥 Baixar .CSV de Exemplo desta Engine
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDownloadOmniMasterCsv}
                style={[styles.cadBtn, styles.cadBtnPurple]}
              >
                <Text style={styles.cadBtnText}>
                  🌐 Baixar .CSV GERAL de Todo o App
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.privilegeInfoBox}>
            <Text style={styles.privilegeInfoTitle}>
              🛡️ Auto-Preenchimento com Privilégios & Rotatividade Justa
            </Text>
            <Text style={styles.privilegeInfoDesc}>
              Com o botão &quot;⚡ Auto-Designar c/ Privilégios&quot; ativo, o Sekundo preenche
              automaticamente cada parte do novo evento respeitando as 26 colunas de privilégio,
              sem repetir a mesma pessoa no mesmo dia e revezando por antiguidade (FIFO).
            </Text>
          </View>
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
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    letterSpacing: 0.4,
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
  cadBtnMuted: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  cadBtnGold: {
    backgroundColor: '#FFB800',
    borderColor: '#FDE68A',
  },
  cadBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  configRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  nameInput: {
    flex: 1,
    minWidth: 210,
    backgroundColor: '#060A12',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: '#F8FAFC',
    fontSize: 12,
  },
  freqGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  freqPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  freqPillActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#BAE6FD',
  },
  freqPillText: {
    color: '#E2E8F0',
    fontSize: 10.5,
    fontWeight: '800',
  },
  noticeStrip: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
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
  panelHeaderLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  enginesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  engineButton: {
    width: '48.5%',
    minWidth: 150,
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
  },
  engineButtonActive: {
    backgroundColor: '#172554',
    borderColor: '#3B82F6',
  },
  engineBtnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  engineBtnCode: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
  },
  engineBtnTitle: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 2,
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
    borderLeftColor: '#FFB800',
  },
  inspectorHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '900',
  },
  inspectorDesc: {
    color: '#CBD5E1',
    fontSize: 11.5,
    lineHeight: 16,
  },
  inspectorCsvBox: {
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 9,
    gap: 6,
  },
  inspectorCsvTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  inspectorCsvMeta: {
    color: '#94A3B8',
    fontSize: 10.5,
  },
  inspectorBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  privilegeInfoBox: {
    backgroundColor: '#064E3B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 9,
    gap: 4,
  },
  privilegeInfoTitle: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
  },
  privilegeInfoDesc: {
    color: '#D1FAE5',
    fontSize: 10.5,
    lineHeight: 15,
  },
});
