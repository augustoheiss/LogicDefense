/**
 * Page: schedule-hub
 *
 * Sekundo — AutoCAD-Style Schedule, Privilege Matrix, WhatsApp & Territory Console.
 *
 * Implements:
 * - Zero Vertical Roll-Down on Screen (`100dvh`, `overflow: hidden`):
 *   All designations of the week (and all 16 territories) are displayed as compact
 *   AutoCAD technical buttons on screen; clicking any button opens its full details
 *   and actions in the Technical Inspector Panel.
 * - Full Vertical Sheet Exclusively on PDF Print (`🖨️ Folha PDF Completa` & `🖨️ PDF Territórios`).
 * - Bidirectional CSV Import & Export (`.csv`, `.json`, `.txt`):
 *   Import/export specific Schedule Hub CSVs or the Unified Master CSV (`CSV Geral`)
 *   so edits and auto-assignments made in the app can be downloaded immediately as
 *   an updated `.csv` backup without manual spreadsheet editing.
 * - Clean-Room 26-Column Privilege Matrix & Fair-Rotation Auto-Assignment Engine
 *   (`🛡️ Privilégios (26)` + `⚡ Auto-Designar`).
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import * as storage from '../storage/localStorage';
import { PrivilegeMatrixModal } from '../components/PrivilegeMatrixModal';
import { MultiEngineSwitcherBar } from '../components/ui/MultiEngineSwitcherBar';
import {
  exportFullSiteOmniCsvFromStorage,
  commitOmniCsvBundleToStorage,
  loadSavedPrivilegeParticipants,
  savePrivilegeParticipants,
  loadSavedScheduleRegistry,
  loadSavedTerritoryRegistry,
} from '../storage/omniStorageBridge';
import {
  PROGRAMACAO_UNIT_NAME,
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  CAPABILITY_COLUMNS,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  parseSekundoScheduleBundle,
  parseProgramScheduleText,
  extractStructuredSessions,
  listOperationalGroups,
  normalizePersonKey,
  findParticipantProfile,
  formatWeeklyScheduleWhatsApp,
  formatGroupFilterWhatsApp,
  formatIndividualCommitmentWhatsApp,
  formatPartnerSyncWhatsAppMessage,
  formatLivePocketScheduleWhatsApp,
  formatTerritoryAssignmentWhatsApp,
  buildWhatsAppUrl,
  generateCommitmentICS,
  generateTerritoryS13AndCardsPDF,
  compileSdocToPdf,
  sanitizeLegacySensitiveText,
  exportScheduleHubToCsv,
  importScheduleHubFromCsv,
  exportOmniCsvBundle,
  importOmniCsvBundle,
  selectEnginePartitionNodes,
  autoAssignScheduleRegistry,
  inferSlotRequiredCapability,
  ensureParticipantPrivilegeMatrix,
  getEffectiveCapabilityColumns,
  type FlatSkeletonEntry,
  type ParticipantProfile,
  type StructuredProgramSession,
  type WhatsAppExportMode,
  type ReadinessState,
} from '@sekundo/core';

const MY_PARTICIPANT_STORAGE_KEY = 'sekundo:my_participant_name';
const SUNLIGHT_MODE_STORAGE_KEY = 'sekundo:sunlight_mode';
const LOCAL_BUNDLE_STORAGE_KEY = 'sekundo:loaded_schedule_bundle_v1';
const PRIVILEGE_DIRECTORY_STORAGE_KEY = 'sekundo:privilege_directory_v1';

/**
 * Generates an A4 `.sdoc.yaml` specification for the full vertical event sheet
 * (where roll-down of the complete event happens on the printed PDF page).
 */
function buildFullEventSheetSdocYaml(
  session: StructuredProgramSession,
  unitName: string
): string {
  const lines: string[] = [
    'sdoc: 1',
    `name: "Folha Completa do Evento — ${session.label.replace(/"/g, '')}"`,
    'page:',
    '  format: a4',
    '  orientation: portrait',
    '  unit: mm',
    'fonts:',
    '  body:',
    '    family: Helvetica',
    'layers:',
    '  - id: folha_evento',
    '    name: Folha Completa de Designacoes',
    '    items:',
    '      - { id: hdr_bg, type: rect, x: 10, y: 10, w: 190, h: 18, fill: "#0F172A", stroke: "#0F172A", stroke_width: 0.3 }',
    `      - { id: hdr_title, type: text, x: 14, y: 14, w: 180, text: "${unitName.replace(/"/g, '')} — FOLHA COMPLETA DO EVENTO", size: 11, weight: bold, color: "#F8FAFC" }`,
    `      - { id: hdr_sub, type: text, x: 14, y: 21, w: 180, text: "${session.label.replace(/"/g, '')} | Presidente: ${session.chairPerson || '—'} | Abertura: ${session.openingPrayer || '—'}", size: 8.5, color: "#38BDF8" }`,
  ];

  let y = 33;
  let itemCounter = 1;

  for (const sec of session.sections) {
    const bandColor = sec.accentColor || '#1E293B';
    lines.push(
      `      - { id: sec_bg_${itemCounter}, type: rect, x: 10, y: ${y}, w: 190, h: 7, fill: "${bandColor}", stroke: "${bandColor}", stroke_width: 0.2 }`,
      `      - { id: sec_txt_${itemCounter}, type: text, x: 13, y: ${y + 1.8}, w: 184, text: "${sec.label.replace(/"/g, '')}", size: 8.5, weight: bold, color: "#FFFFFF" }`
    );
    y += 9;
    itemCounter++;

    for (const slot of sec.slots) {
      const meta = (slot.meta || {}) as Record<string, any>;
      const primary = meta.assignedTo || slot.value || 'A designar';
      const assistant = meta.assistantTo ? ` / Par: ${meta.assistantTo}` : '';
      const dur = meta.durationMinutes || 5;
      const grp = meta.groupTag ? ` [${meta.groupTag}]` : '';

      lines.push(
        `      - { id: slot_bg_${itemCounter}, type: rect, x: 10, y: ${y}, w: 190, h: 11, fill: "#F8FAFC", stroke: "#CBD5E1", stroke_width: 0.25 }`,
        `      - { id: slot_lbl_${itemCounter}, type: text, x: 13, y: ${y + 2}, w: 115, text: "${slot.label.replace(/"/g, '')} (${dur} min)", size: 8.5, weight: bold, color: "#0F172A" }`,
        `      - { id: slot_who_${itemCounter}, type: text, x: 13, y: ${y + 6.3}, w: 180, text: "Designado: ${primary.replace(/"/g, '')}${assistant.replace(/"/g, '')}${grp}", size: 8, color: "#334155" }`
      );
      y += 12.5;
      itemCounter++;
    }
    y += 2;
  }

  lines.push(
    `      - { id: ftr_txt, type: text, x: 10, y: ${Math.min(282, y + 4)}, w: 190, text: "Encerramento: ${session.closingPrayer || '—'} • Gerado via Sekundo CAD Engine (Folha A4 Completa)", size: 8, color: "#475569" }`
  );

  return lines.join('\n');
}

export default function ScheduleHubConsole() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';

  const { flatRegistry, updateNode, saveSkeleton } = useSkeleton(eventId);
  const { events, addEvent } = useLocalEvent();

  const [activeUnitName, setActiveUnitName] = useState<string>(PROGRAMACAO_UNIT_NAME);
  const [activeDirectory, setActiveDirectory] = useState<ParticipantProfile[]>(() =>
    DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx))
  );
  const [localScheduleRegistry, setLocalScheduleRegistry] = useState<FlatSkeletonEntry[]>(() =>
    buildProgramacaoReuniaoRegistry(undefined, DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS)
  );
  const [territoryRegistry, setTerritoryRegistry] = useState<FlatSkeletonEntry[]>(() =>
    buildTerritoriosS13HistoricalRegistry()
  );

  const activeScheduleRegistry = useMemo(() => {
    const partitioned = selectEnginePartitionNodes(flatRegistry, 'roster_assignments');
    const extracted = extractStructuredSessions(partitioned);
    if (extracted.length > 0) return partitioned;
    return localScheduleRegistry;
  }, [flatRegistry, localScheduleRegistry]);

  useEffect(() => {
    const partitionedTerritories = selectEnginePartitionNodes(flatRegistry, 'territory_logistics');
    if (partitionedTerritories.length > 0) {
      setTerritoryRegistry(partitionedTerritories);
    }
  }, [flatRegistry]);

  const sessions = useMemo(
    () => extractStructuredSessions(activeScheduleRegistry),
    [activeScheduleRegistry]
  );

  const [selectedSessionIdx, setSelectedSessionIdx] = useState(0);
  const currentSession: StructuredProgramSession | undefined =
    sessions[selectedSessionIdx] || sessions[0];

  // AutoCAD Selected Slot / Selected Territory in the Fixed Viewport Inspector
  const [selectedSlotKey, setSelectedSlotKey] = useState<string>('');
  const [selectedTerritoryIdx, setSelectedTerritoryIdx] = useState<number>(0);
  const [showReassignList, setShowReassignList] = useState<'primary' | 'assistant' | null>(null);

  // UX Filters & Modals
  const [sunlightMode, setSunlightMode] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [myParticipantName, setMyParticipantName] = useState<string>('');
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'schedule' | 'territories'>('schedule');
  const [showPrivilegeMatrixModal, setShowPrivilegeMatrixModal] = useState(false);
  const [lastAutoAssignSummaryText, setLastAutoAssignSummaryText] = useState<string | null>(null);

  // Rehearsal Timer State
  const [rehearsalSlot, setRehearsalSlot] = useState<FlatSkeletonEntry | null>(null);
  const [rehearsalRemainingSec, setRehearsalRemainingSec] = useState<number>(0);
  const [rehearsalRunning, setRehearsalRunning] = useState<boolean>(false);

  // WhatsApp Export Studio Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waMode, setWaMode] = useState<WhatsAppExportMode>('full_week');
  const [waTargetGroup, setWaTargetGroup] = useState<string>('Grupo 1');
  const [waTargetSlot, setWaTargetSlot] = useState<FlatSkeletonEntry | null>(null);
  const [waTargetRole, setWaTargetRole] = useState<'primary' | 'assistant'>('primary');
  const [waStartTime, setWaStartTime] = useState<string>('19:30');
  const [waTargetTerritoryIdx, setWaTargetTerritoryIdx] = useState<number>(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Custom Text/CSV Paste Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [customScheduleText, setCustomScheduleText] = useState('');

  // PDF Generation State
  const [s13ServiceYear, setS13ServiceYear] = useState<'all' | '2027' | '2026'>('all');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const operationalGroups = useMemo(
    () => listOperationalGroups(activeDirectory),
    [activeDirectory]
  );

  // Flatten all slots in currentSession for the AutoCAD Button Matrix
  const currentSessionSlotsFlat = useMemo(() => {
    if (!currentSession) return [];
    const list: Array<{
      slot: FlatSkeletonEntry;
      sectionLabel: string;
      sectionColor: string;
      sectionIdx: number;
      slotIdxInSection: number;
      buttonNumber: string;
    }> = [];
    let globalCounter = 1;
    currentSession.sections.forEach((sec, sIdx) => {
      sec.slots.forEach((sl, slIdx) => {
        list.push({
          slot: sl,
          sectionLabel: sec.label,
          sectionColor: sec.accentColor || '#3D5B65',
          sectionIdx: sIdx,
          slotIdxInSection: slIdx,
          buttonNumber: String(globalCounter).padStart(2, '0'),
        });
        globalCounter++;
      });
    });
    return list;
  }, [currentSession]);

  // Keep selectedSlotKey pointing to a valid slot in the current session
  const activeInspectedSlotInfo = useMemo(() => {
    if (currentSessionSlotsFlat.length === 0) return undefined;
    const found = currentSessionSlotsFlat.find((item) => item.slot.key === selectedSlotKey);
    return found || currentSessionSlotsFlat[0];
  }, [currentSessionSlotsFlat, selectedSlotKey]);

  // Restore persisted state from storage & localStorage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedPrivs, savedSched, savedTerr] = await Promise.all([
          loadSavedPrivilegeParticipants(),
          loadSavedScheduleRegistry(),
          loadSavedTerritoryRegistry(),
        ]);
        if (!mounted) return;
        if (savedPrivs && savedPrivs.length > 0) {
          setActiveDirectory(savedPrivs);
        }
        if (savedSched && savedSched.length > 0) {
          setLocalScheduleRegistry(savedSched);
        }
        if (savedTerr && savedTerr.length > 0) {
          setTerritoryRegistry(savedTerr);
        }
      } catch {
        // ignore
      }
    })();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const savedName = window.localStorage.getItem(MY_PARTICIPANT_STORAGE_KEY);
      if (savedName) setMyParticipantName(sanitizeLegacySensitiveText(savedName).text);
      const savedSun = window.localStorage.getItem(SUNLIGHT_MODE_STORAGE_KEY);
      if (savedSun === '1') setSunlightMode(true);

      const savedPrivDir = window.localStorage.getItem(PRIVILEGE_DIRECTORY_STORAGE_KEY);
      if (savedPrivDir) {
        try {
          const parsedDir = JSON.parse(savedPrivDir) as ParticipantProfile[];
          if (Array.isArray(parsedDir) && parsedDir.length > 0) {
            setActiveDirectory(
              parsedDir.map((p, idx) =>
                ensureParticipantPrivilegeMatrix(p, idx, { preserveExplicitCapabilities: true })
              )
            );
          }
        } catch {
          // ignore
        }
      }
    }
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdateParticipants = (updated: ParticipantProfile[]) => {
    setActiveDirectory(updated);
    savePrivilegeParticipants(updated).catch(() => undefined);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(PRIVILEGE_DIRECTORY_STORAGE_KEY, JSON.stringify(updated));
    }
  };

  // Auto-Assign Designations using the Privilege Matrix & FIFO Rotation
  const handleRunAutoAssign = async (
    scope: 'current_week' | 'all_weeks',
    strictSameCategoryPairing: boolean = true
  ) => {
    const targetKeys =
      scope === 'current_week' && currentSession ? [currentSession.key] : undefined;
    const { updatedRegistry, updatedParticipants, summary } = autoAssignScheduleRegistry(
      activeScheduleRegistry,
      activeDirectory,
      {
        strictSameCategoryPairing,
        preferredGroupTag: selectedGroup,
        targetSessionKeys: targetKeys,
      }
    );

    setLocalScheduleRegistry(updatedRegistry);
    handleUpdateParticipants(updatedParticipants);
    if (eventId && flatRegistry.length > 0) {
      await saveSkeleton(updatedRegistry);
    }

    const msg = `⚡ Auto-Designação (${
      scope === 'current_week' ? 'Semana Atual' : `${summary.sessionsAssigned} Semanas`
    }): ${summary.slotsAssigned} funções • ${summary.sameDayCollisions} colisões • ${
      summary.privilegeViolations
    } violações`;
    setLastAutoAssignSummaryText(msg);
    setStatusBanner(msg);
  };

  // Pick a local .csv, .json, or .txt file!
  const handlePickLocalScheduleFile = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.json,.txt';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const lower = file.name.toLowerCase();
          if (lower.endsWith('.csv') || text.trim().startsWith('_record_kind,')) {
            const loadedOmni = importOmniCsvBundle(text);
            setActiveUnitName(loadedOmni.unitName);
            handleUpdateParticipants(loadedOmni.participants);
            setLocalScheduleRegistry(loadedOmni.scheduleRegistry);
            setTerritoryRegistry(loadedOmni.territoryRegistry);
            await commitOmniCsvBundleToStorage(text, {
              targetEventId: eventId || undefined,
            });
            setSelectedSessionIdx(0);
            setStatusBanner(
              `✅ CSV "${file.name}" importado (${loadedOmni.participants.length} usuários, ${
                extractStructuredSessions(loadedOmni.scheduleRegistry).length
              } semanas, ${loadedOmni.territoryRegistry.length} territórios)!`
            );
          } else if (lower.endsWith('.json')) {
            const loaded = parseSekundoScheduleBundle(text);
            setActiveUnitName(loaded.unitName);
            handleUpdateParticipants(
              loaded.participants.map((p, idx) =>
                ensureParticipantPrivilegeMatrix(p, idx, { preserveExplicitCapabilities: true })
              )
            );
            setLocalScheduleRegistry(loaded.scheduleRegistry);
            setTerritoryRegistry(loaded.territoryRegistry);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(LOCAL_BUNDLE_STORAGE_KEY, text);
            }
            if (eventId) {
              await saveSkeleton(loaded.scheduleRegistry);
            }
            setSelectedSessionIdx(0);
            setStatusBanner(`✅ JSON "${file.name}" importado!`);
          } else {
            const parsed = parseProgramScheduleText(text, {
              unitName: activeUnitName,
              directory: activeDirectory,
            });
            setLocalScheduleRegistry(parsed);
            if (eventId) {
              await saveSkeleton(parsed);
            }
            setSelectedSessionIdx(0);
            setStatusBanner(`✅ Texto "${file.name}" importado (${parsed.length} nós)!`);
          }
        } catch (err: any) {
          setStatusBanner(`❌ Erro ao importar arquivo: ${err.message}`);
        }
      };
      input.click();
    }
  };

  // Export updated Schedule Hub CSV, Full Saved Site Omni-CSV Geral, or Sample Omni-CSV
  const handleExportCsvBackup = async (mode: 'hub_csv' | 'omni_csv' | 'sample_omni_csv') => {
    let csvContent = '';
    let filename = '';
    const dateStamp = new Date().toISOString().slice(0, 10);

    if (mode === 'hub_csv') {
      csvContent = exportScheduleHubToCsv({
        unitName: activeUnitName,
        participants: activeDirectory,
        scheduleRegistry: activeScheduleRegistry,
        territoryRegistry,
      });
      filename = `sekundo_programacao_whatsapp_${dateStamp}.csv`;
    } else if (mode === 'sample_omni_csv') {
      csvContent = exportOmniCsvBundle();
      filename = `sekundo_omni_exemplo_limpo_${dateStamp}.csv`;
    } else {
      csvContent = await exportFullSiteOmniCsvFromStorage({
        unitName: activeUnitName,
        participants: activeDirectory,
        scheduleRegistry: activeScheduleRegistry,
        territoryRegistry,
      });
      filename = `sekundo_omni_geral_salvo_${dateStamp}.csv`;
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    setStatusBanner(`📤 Arquivo "${filename}" exportado!`);
  };

  // Print Full Event Sheet to PDF (The only place where full vertical roll-down happens!)
  const handlePrintFullEventPdf = async () => {
    if (!currentSession) return;
    try {
      setGeneratingPdf(true);
      const sdocYaml = buildFullEventSheetSdocYaml(currentSession, activeUnitName);
      const { pdfBytes } = await compileSdocToPdf(sdocYaml, activeScheduleRegistry);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Folha_Evento_Completa_${currentSession.key}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setStatusBanner(
        `🖨️ Folha PDF Completa gerada para "${currentSession.label}" (listagem integral na folha A4)!`
      );
    } catch (e: any) {
      setStatusBanner(`❌ Erro ao gerar PDF do evento: ${e.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadS13PDF = async () => {
    try {
      setGeneratingPdf(true);
      const res = await generateTerritoryS13AndCardsPDF(territoryRegistry, {
        eventName: activeUnitName,
        serviceYear: s13ServiceYear,
        includeQuadraCards: false,
      });
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([res.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Registro_Territorios_${s13ServiceYear}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setStatusBanner(`🖨️ PDF Multi-Ciclo de Territórios gerado (${res.territoryCount} setores)!`);
    } catch (e: any) {
      setStatusBanner(`❌ Erro ao gerar PDF de Territórios: ${e.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Rehearsal timer effect
  useEffect(() => {
    if (!rehearsalRunning || !rehearsalSlot) return;
    const interval = setInterval(() => {
      setRehearsalRemainingSec((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [rehearsalRunning, rehearsalSlot]);

  const startRehearsal = (slot: FlatSkeletonEntry) => {
    const meta = (slot.meta || {}) as Record<string, any>;
    const durMin = Number(meta.durationMinutes) || 5;
    setRehearsalSlot(slot);
    setRehearsalRemainingSec(durMin * 60);
    setRehearsalRunning(true);
  };

  const formatTimerMMSS = (sec: number) => {
    const isNegative = sec < 0;
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${isNegative ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCycleReadiness = async (slot: FlatSkeletonEntry) => {
    const meta = (slot.meta || {}) as Record<string, any>;
    const current: ReadinessState = (meta.readinessState as ReadinessState) || 'pending';
    const nextOrder: Record<ReadinessState, ReadinessState> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'pending',
    };
    const nextState = nextOrder[current];
    const nextMeta = {
      ...meta,
      readinessState: nextState,
      confirmed: nextState === 'ready',
    };

    if (eventId && flatRegistry.length > 0) {
      await updateNode(slot.key, { meta: nextMeta });
    } else {
      setLocalScheduleRegistry((prev) =>
        prev.map((entry) => (entry.key === slot.key ? { ...entry, meta: nextMeta } : entry))
      );
    }
  };

  const handleManualReassignSlot = async (
    slot: FlatSkeletonEntry,
    role: 'primary' | 'assistant',
    person: ParticipantProfile
  ) => {
    const meta = { ...((slot.meta || {}) as Record<string, any>) };
    if (role === 'primary') {
      meta.assignedTo = person.name;
      meta.groupTag = person.groupTag;
    } else {
      meta.assistantTo = person.name;
      meta.assistantGroupTag = person.groupTag;
    }
    const newValue = meta.assistantTo
      ? `${meta.assignedTo || slot.value} / ${meta.assistantTo}`
      : meta.assignedTo || person.name;

    if (eventId && flatRegistry.length > 0) {
      await updateNode(slot.key, { value: newValue, meta });
    } else {
      setLocalScheduleRegistry((prev) =>
        prev.map((entry) =>
          entry.key === slot.key ? { ...entry, value: newValue, meta } : entry
        )
      );
    }
    setShowReassignList(null);
    setStatusBanner(`✅ Designação "${slot.label}" atualizada para ${person.name}!`);
  };

  const handleSaveSeedToAppEvents = async () => {
    try {
      const scheduleEventName = `${activeUnitName} — Programação Semanal`;
      let schedEvent = events.find((e) => e.config.name === scheduleEventName);
      if (!schedEvent) {
        schedEvent = await addEvent(scheduleEventName, 'weekly', ['01', '02', '03'], [
          'roster_assignments',
          'live_production_ros',
        ]);
      }
      await storage.saveSkeleton(schedEvent.config.id, activeScheduleRegistry);
      setStatusBanner('✅ Programação e Territórios salvos no App Sekundo!');
    } catch (e: any) {
      setStatusBanner(`❌ Erro ao salvar: ${e.message}`);
    }
  };

  const handleImportCustomText = async () => {
    const trimmed = customScheduleText.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('_record_kind,') || trimmed.startsWith('_key,')) {
      const loadedOmni = importOmniCsvBundle(trimmed);
      setActiveUnitName(loadedOmni.unitName);
      handleUpdateParticipants(loadedOmni.participants);
      setLocalScheduleRegistry(loadedOmni.scheduleRegistry);
      setTerritoryRegistry(loadedOmni.territoryRegistry);
      await commitOmniCsvBundleToStorage(trimmed, {
        targetEventId: eventId || undefined,
      });
      setShowImportModal(false);
      setCustomScheduleText('');
      setStatusBanner('✅ CSV colado e importado com sucesso!');
      return;
    }
    const parsed = parseProgramScheduleText(trimmed, {
      unitName: activeUnitName,
      directory: activeDirectory,
    });
    if (parsed.length === 0) {
      setStatusBanner('⚠️ Nenhuma sessão reconhecida no texto colado.');
      return;
    }
    setLocalScheduleRegistry(parsed);
    setShowImportModal(false);
    setCustomScheduleText('');
    setStatusBanner(`✅ Programação importada (${parsed.length} nós)!`);
  };

  const handleDownloadICS = (slot: FlatSkeletonEntry) => {
    const icsContent = generateCommitmentICS(slot, currentSession);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Compromisso_Sekundo_${slot.key}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const slotMatchesGroupFilter = (slot: FlatSkeletonEntry): boolean => {
    if (selectedGroup === 'ALL') return true;
    const meta = (slot.meta || {}) as Record<string, any>;
    const pGroup =
      meta.groupTag ||
      findParticipantProfile(meta.assignedTo || slot.value, activeDirectory)?.groupTag;
    const aGroup =
      meta.assistantGroupTag ||
      findParticipantProfile(meta.assistantTo, activeDirectory)?.groupTag;
    return pGroup === selectedGroup || aGroup === selectedGroup;
  };

  const isSlotMine = (slot: FlatSkeletonEntry): boolean => {
    if (!myParticipantName) return false;
    const normMe = normalizePersonKey(myParticipantName);
    const meta = (slot.meta || {}) as Record<string, any>;
    return (
      normalizePersonKey(meta.assignedTo || slot.value) === normMe ||
      normalizePersonKey(meta.assistantTo) === normMe
    );
  };

  const whatsappPreviewText = useMemo(() => {
    if (!currentSession) return '';
    switch (waMode) {
      case 'full_week':
        return formatWeeklyScheduleWhatsApp(currentSession);
      case 'group_filter':
        return formatGroupFilterWhatsApp(
          currentSession,
          waTargetGroup,
          activeDirectory,
          territoryRegistry
        );
      case 'individual_card': {
        const fallbackSlot =
          waTargetSlot ||
          activeInspectedSlotInfo?.slot ||
          currentSession.sections[0]?.slots[0];
        if (!fallbackSlot) return 'Selecione uma designação.';
        return formatIndividualCommitmentWhatsApp(fallbackSlot, currentSession, waTargetRole);
      }
      case 'live_pocket':
        return formatLivePocketScheduleWhatsApp(currentSession, waStartTime);
      case 'territory_assignment': {
        const terr = territoryRegistry[waTargetTerritoryIdx] || territoryRegistry[0];
        if (!terr) return '';
        return formatTerritoryAssignmentWhatsApp(terr);
      }
    }
  }, [
    waMode,
    currentSession,
    waTargetGroup,
    waTargetSlot,
    waTargetRole,
    waStartTime,
    waTargetTerritoryIdx,
    activeDirectory,
    territoryRegistry,
    activeInspectedSlotInfo,
  ]);

  const handleCopyWhatsAppMessage = async () => {
    if (!whatsappPreviewText) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(whatsappPreviewText);
      setCopyFeedback('✅ Copiado!');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const handleOpenWhatsAppExternal = (text: string) => {
    const url = buildWhatsAppUrl(text);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url);
    }
  };

  const theme = sunlightMode
    ? {
        bg: '#F8FAFC',
        panelBg: '#FFFFFF',
        border: '#CBD5E1',
        textPrimary: '#0F172A',
        textSecondary: '#334155',
        textMuted: '#64748B',
        accent: '#D97706',
        btnBg: '#E2E8F0',
      }
    : {
        bg: '#060A12',
        panelBg: '#0F172A',
        border: '#1E293B',
        textPrimary: '#F8FAFC',
        textSecondary: '#CBD5E1',
        textMuted: '#64748B',
        accent: '#FFB800',
        btnBg: '#1E293B',
      };

  // Eligible candidates for the currently inspected slot
  const inspectedRequirement = useMemo(() => {
    if (!activeInspectedSlotInfo) return null;
    return inferSlotRequiredCapability(
      activeInspectedSlotInfo.slot.label,
      activeInspectedSlotInfo.sectionIdx,
      activeInspectedSlotInfo.slotIdxInSection
    );
  }, [activeInspectedSlotInfo]);

  const eligibleCandidatesForInspector = useMemo(() => {
    if (!inspectedRequirement || !showReassignList) return [];
    const capKey =
      showReassignList === 'primary'
        ? inspectedRequirement.primaryCapability
        : inspectedRequirement.partnerCapability;
    return activeDirectory.filter((p) => p.capabilities?.[capKey]);
  }, [activeDirectory, inspectedRequirement, showReassignList]);

  const inspectedTerritory = territoryRegistry[selectedTerritoryIdx] || territoryRegistry[0];

  return (
    <SafeAreaView style={[styles.cadViewport, { backgroundColor: theme.bg }]}>
      {/* ================================================================= */}
      {/* RIBBON 1: AUTOCAD ICON-ONLY TOP COMMAND DOCK                      */}
      {/* ================================================================= */}
      <View
        style={[
          styles.cadTopRibbon,
          { backgroundColor: theme.panelBg, borderBottomColor: theme.border },
        ]}
      >
        <MultiEngineSwitcherBar
          activeEngine="schedule"
          eventId={eventId}
          onOpenPrivileges={() => setShowPrivilegeMatrixModal(true)}
        />

        <View style={styles.cadRibbonTools}>
          <Pressable
            testID="schedule-btn-import"
            onPress={handlePickLocalScheduleFile}
            style={[styles.cadCommandBtn, styles.cadBtnBlue]}
            accessibilityLabel="Importar CSV, JSON ou TXT"
            {...({ title: 'Importar (.csv/.json/.txt)' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>📥</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-export-hub"
            onPress={() => handleExportCsvBackup('hub_csv')}
            style={[styles.cadCommandBtn, styles.cadBtnEmerald]}
            accessibilityLabel="Exportar CSV da Programação"
            {...({ title: 'Exportar CSV da Programação' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>📤</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-export-omni"
            onPress={() => handleExportCsvBackup('omni_csv')}
            style={[styles.cadCommandBtn, styles.cadBtnPurple]}
            accessibilityLabel="Baixar CSV Geral"
            {...({ title: 'Baixar CSV Geral (Estado Salvo no Site)' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>🌐</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-sample-omni"
            onPress={() => handleExportCsvBackup('sample_omni_csv')}
            style={styles.cadCommandBtn}
            accessibilityLabel="Baixar CSV Geral de Exemplo"
            {...({ title: 'Baixar CSV Geral de Exemplo Limpo' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>🧪</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-privileges"
            onPress={() => setShowPrivilegeMatrixModal(true)}
            style={[styles.cadCommandBtn, styles.cadBtnAmber]}
            accessibilityLabel="Privilégios"
            {...({ title: `Matriz de Privilégios (${activeDirectory.length})` } as any)}
          >
            <Text style={[styles.cadCommandBtnText, { color: '#090D16' }]}>🛡️</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-auto-assign"
            onPress={() => handleRunAutoAssign('current_week', true)}
            style={[styles.cadCommandBtn, styles.cadBtnCyan]}
            accessibilityLabel="Auto-Designar Semana"
            {...({ title: 'Auto-Designar Semana Atual' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>⚡</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-whatsapp"
            onPress={() => {
              setWaMode('full_week');
              setShowWhatsAppModal(true);
            }}
            style={[styles.cadCommandBtn, styles.cadBtnEmerald]}
            accessibilityLabel="Exportador WhatsApp"
            {...({ title: 'Exportador WhatsApp (5 Modos)' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>📲</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-pdf"
            onPress={
              activeTab === 'schedule' ? handlePrintFullEventPdf : handleDownloadS13PDF
            }
            disabled={generatingPdf}
            style={[styles.cadCommandBtn, styles.cadBtnRose]}
            accessibilityLabel="Folha PDF Completa"
            {...({ title: 'Gerar Folha PDF Completa (A4)' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>
              {generatingPdf ? '⏳' : '🖨️'}
            </Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-paste"
            onPress={() => setShowImportModal(true)}
            style={styles.cadCommandBtn}
            accessibilityLabel="Colar Programação ou CSV"
            {...({ title: 'Colar Texto ou CSV' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>📋</Text>
          </Pressable>

          <Pressable
            testID="schedule-btn-save"
            onPress={handleSaveSeedToAppEvents}
            style={styles.cadCommandBtn}
            accessibilityLabel="Salvar no App Sekundo"
            {...({ title: 'Salvar no App Sekundo' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>💾</Text>
          </Pressable>

          <Pressable
            onPress={() => setSunlightMode((s) => !s)}
            style={styles.cadCommandBtn}
            accessibilityLabel="Alternar Modo Sol"
            {...({ title: 'Alternar Alto Contraste' } as any)}
          >
            <Text style={styles.cadCommandBtnText}>{sunlightMode ? '🌙' : '☀️'}</Text>
          </Pressable>
        </View>
      </View>

      {/* ================================================================= */}
      {/* RIBBON 2: COMPACT WEEK SELECTOR + GROUP FILTER + TAB SWITCHER     */}
      {/* ================================================================= */}
      <View
        style={[
          styles.cadSubRibbon,
          { backgroundColor: theme.bg, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.compactRow}>
          <Pressable
            onPress={() => setActiveTab('schedule')}
            style={[
              styles.subTabBtn,
              activeTab === 'schedule' && {
                backgroundColor: theme.accent,
                borderColor: theme.accent,
              },
            ]}
            accessibilityLabel="Aba Designações"
            {...({ title: `Designações (${sessions.length} Semanas)` } as any)}
          >
            <Text
              style={[
                styles.subTabBtnText,
                { color: activeTab === 'schedule' ? '#090D16' : theme.textPrimary },
              ]}
            >
              📅 {sessions.length}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('territories')}
            style={[
              styles.subTabBtn,
              activeTab === 'territories' && {
                backgroundColor: '#10B981',
                borderColor: '#34D399',
              },
            ]}
            accessibilityLabel="Aba Territórios"
            {...({ title: `Territórios (${territoryRegistry.length})` } as any)}
          >
            <Text
              style={[
                styles.subTabBtnText,
                { color: activeTab === 'territories' ? '#090D16' : theme.textPrimary },
              ]}
            >
              🗺️ {territoryRegistry.length}
            </Text>
          </Pressable>

          {/* Group Filter Chips */}
          {['ALL', ...operationalGroups].map((grp) => {
            const active = selectedGroup === grp;
            return (
              <Pressable
                key={grp}
                onPress={() => setSelectedGroup(grp)}
                style={[
                  styles.microChip,
                  active && { backgroundColor: '#2563EB', borderColor: '#93C5FD' },
                ]}
                accessibilityLabel={grp === 'ALL' ? 'Todos os Grupos' : grp}
                {...({ title: grp === 'ALL' ? 'Todos os Grupos' : grp } as any)}
              >
                <Text style={styles.microChipText}>
                  {grp === 'ALL' ? '👥' : grp.replace('Grupo ', 'G')}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setShowParticipantPicker(true)}
            style={[
              styles.microChip,
              myParticipantName !== '' && {
                backgroundColor: '#B45309',
                borderColor: '#FBBF24',
              },
            ]}
            accessibilityLabel="Filtrar Meu Compromisso"
            {...({ title: myParticipantName ? `Filtro: ${myParticipantName}` : 'Filtrar Meu Compromisso' } as any)}
          >
            <Text style={styles.microChipText}>
              🎯{myParticipantName ? '•' : ''}
            </Text>
          </Pressable>

          {/* Week Selector Buttons (Compact 1-Click Pills) */}
          {activeTab === 'schedule' &&
            sessions.map((sess, idx) => {
              const active = idx === selectedSessionIdx;
              return (
                <Pressable
                  key={sess.key}
                  onPress={() => {
                    setSelectedSessionIdx(idx);
                    setSelectedSlotKey('');
                  }}
                  style={[
                    styles.weekMicroBtn,
                    active && { backgroundColor: '#38BDF8', borderColor: '#BAE6FD' },
                  ]}
                  accessibilityLabel={sess.label}
                  {...({ title: sess.label } as any)}
                >
                  <Text
                    style={[
                      styles.weekMicroBtnText,
                      active && { color: '#090D16', fontWeight: '900' },
                    ]}
                  >
                    S{idx + 1}
                  </Text>
                </Pressable>
              );
            })}
        </View>
      </View>

      {/* Optional Status Toast Strip */}
      {statusBanner && (
        <View style={styles.compactStatusBanner}>
          <Text style={styles.compactStatusText} numberOfLines={1}>
            {statusBanner}
          </Text>
          <Pressable onPress={() => setStatusBanner(null)} accessibilityLabel="Fechar Aviso">
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800' }}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* ================================================================= */}
      {/* MAIN AUTOCAD WORKSPACE (ZERO VERTICAL ROLL-DOWN ON SCREEN!)       */}
      {/* ================================================================= */}
      {activeTab === 'schedule' && currentSession ? (
        <View
          style={[
            styles.cadWorkspaceSplit,
            { flexDirection: isDesktop ? 'row' : 'column' },
          ]}
        >
          {/* LEFT / TOP PANEL: COMPACT BUTTON MATRIX OF ALL DESIGNATIONS */}
          <View
            style={[
              styles.cadMatrixPanel,
              {
                backgroundColor: theme.panelBg,
                borderColor: theme.border,
                flex: isDesktop ? 1.15 : undefined,
              },
            ]}
          >
            {/* Session Coordination Strip (Chair, Opening, Closing) */}
            <View style={styles.sessionCoordStrip}>
              <Text style={[styles.sessionCoordTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                📅 {currentSession.label.split('|')[0]?.trim() || currentSession.label}
              </Text>
              <View style={styles.coordPillsRow}>
                <View style={styles.coordBadge}>
                  <Text style={styles.coordBadgeText}>
                    👑 {currentSession.chairPerson || '—'}
                  </Text>
                </View>
                <View style={styles.coordBadge}>
                  <Text style={styles.coordBadgeText}>
                    🔹 {currentSession.openingPrayer || '—'}
                  </Text>
                </View>
                <View style={styles.coordBadge}>
                  <Text style={styles.coordBadgeText}>
                    🔸 {currentSession.closingPrayer || '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* All Designation Buttons in a Compact Grid */}
            <View style={styles.slotButtonsGrid}>
              {currentSessionSlotsFlat
                .filter((item) => slotMatchesGroupFilter(item.slot))
                .map((item) => {
                  const isSelected = activeInspectedSlotInfo?.slot.key === item.slot.key;
                  const meta = (item.slot.meta || {}) as Record<string, any>;
                  const primary = meta.assignedTo || item.slot.value || '—';
                  const assistant = meta.assistantTo;
                  const readiness: ReadinessState =
                    (meta.readinessState as ReadinessState) ||
                    (meta.confirmed ? 'ready' : 'pending');
                  const mine = isSlotMine(item.slot);
                  const shortLabel = item.slot.label
                    .replace(/^\d+\.\s*/, '')
                    .slice(0, isDesktop ? 22 : 14);

                  return (
                    <Pressable
                      key={item.slot.key}
                      onPress={() => {
                        setSelectedSlotKey(item.slot.key);
                        setShowReassignList(null);
                      }}
                      style={[
                        styles.cadSlotButton,
                        !isDesktop && {
                          width: '31.5%',
                          minWidth: 96,
                          paddingHorizontal: 5,
                          paddingVertical: 3,
                        },
                        {
                          borderLeftColor: item.sectionColor,
                          backgroundColor: isSelected ? '#1E3A8A' : '#0B1120',
                          borderColor: isSelected
                            ? '#60A5FA'
                            : mine
                            ? '#FFB800'
                            : '#1E293B',
                        },
                      ]}
                      accessibilityLabel={`${item.buttonNumber} ${item.slot.label}`}
                      {...({ title: `${item.slot.label} — ${primary}` } as any)}
                    >
                      <View style={styles.cadSlotBtnHeader}>
                        <Text style={styles.cadSlotBtnNumber}>[{item.buttonNumber}]</Text>
                        <Text style={styles.cadSlotBtnDuration}>
                          {meta.durationMinutes || 5}m{' '}
                          {readiness === 'ready'
                            ? '✅'
                            : readiness === 'preparing'
                            ? '📖'
                            : ''}
                        </Text>
                      </View>
                      <Text style={styles.cadSlotBtnTitle} numberOfLines={1}>
                        {shortLabel}
                      </Text>
                      <Text style={styles.cadSlotBtnAssignee} numberOfLines={1}>
                        {primary}
                        {assistant ? `+${assistant}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>

          {/* RIGHT / BOTTOM PANEL: ON-DEMAND TECHNICAL INSPECTOR FOR SELECTED SLOT */}
          <View
            style={[
              styles.cadInspectorPanel,
              {
                backgroundColor: theme.panelBg,
                borderColor: theme.border,
                flex: isDesktop ? 1 : undefined,
              },
            ]}
          >
            {activeInspectedSlotInfo ? (
              (() => {
                const { slot, sectionLabel, sectionColor, buttonNumber } =
                  activeInspectedSlotInfo;
                const meta = (slot.meta || {}) as Record<string, any>;
                const primary = meta.assignedTo || slot.value || 'A designar';
                const assistant = meta.assistantTo as string | undefined;
                const durMin = meta.durationMinutes || 5;
                const readiness: ReadinessState =
                  (meta.readinessState as ReadinessState) ||
                  (meta.confirmed ? 'ready' : 'pending');
                const primaryGroup =
                  meta.groupTag ||
                  findParticipantProfile(primary, activeDirectory)?.groupTag ||
                  'Grupo 1';
                const assistantGroup =
                  meta.assistantGroupTag ||
                  findParticipantProfile(assistant, activeDirectory)?.groupTag;
                const allCols = getEffectiveCapabilityColumns(activeDirectory);
                const capMeta = allCols.find(
                  (c) => c.key === inspectedRequirement?.primaryCapability
                );

                return (
                  <View style={styles.inspectorContent}>
                    <View
                      style={[
                        styles.inspectorBanner,
                        { backgroundColor: sectionColor },
                      ]}
                    >
                      <Text style={styles.inspectorBannerText} numberOfLines={1}>
                        🔍 [{buttonNumber}] {slot.label}
                      </Text>
                      <Text style={styles.inspectorBannerTime}>⏱️ {durMin}m</Text>
                    </View>

                    {capMeta && (
                      <View style={styles.capabilityTagRow}>
                        <Text style={styles.capabilityTagText} numberOfLines={1}>
                          🛡️ {capMeta.shortLabel} — {capMeta.fullLabel}
                        </Text>
                      </View>
                    )}

                    {/* Assignees Boxes with 1-Click Reassignment */}
                    <View style={styles.inspectorAssigneesRow}>
                      <View style={styles.inspectorPersonBox}>
                        <View style={styles.inspectorPersonFooter}>
                          <Text style={styles.inspectorPersonName} numberOfLines={1}>
                            👤 {primary}
                          </Text>
                          <Text style={styles.inspectorGroupBadge}>{primaryGroup}</Text>
                          <Pressable
                            onPress={() =>
                              setShowReassignList((prev) =>
                                prev === 'primary' ? null : 'primary'
                              )
                            }
                            style={styles.miniSwapBtn}
                            accessibilityLabel="Trocar Titular"
                            {...({ title: 'Trocar Titular' } as any)}
                          >
                            <Text style={styles.miniSwapBtnText}>🔄</Text>
                          </Pressable>
                        </View>
                      </View>

                      {(assistant || inspectedRequirement?.requiresPartner) && (
                        <View style={styles.inspectorPersonBox}>
                          <View style={styles.inspectorPersonFooter}>
                            <Text style={styles.inspectorPersonName} numberOfLines={1}>
                              🤝 {assistant || '—'}
                            </Text>
                            {assistantGroup && (
                              <Text style={styles.inspectorGroupBadge}>
                                {assistantGroup}
                              </Text>
                            )}
                            <Pressable
                              onPress={() =>
                                setShowReassignList((prev) =>
                                  prev === 'assistant' ? null : 'assistant'
                                )
                              }
                              style={styles.miniSwapBtn}
                              accessibilityLabel="Trocar Par"
                              {...({ title: 'Trocar Par / Ajudante' } as any)}
                            >
                              <Text style={styles.miniSwapBtnText}>🔄</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Compact Privilege-Filtered Reassignment Strip */}
                    {showReassignList && (
                      <View style={styles.reassignPickerStrip}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {eligibleCandidatesForInspector.map((cand) => (
                              <Pressable
                                key={cand.id}
                                onPress={() =>
                                  handleManualReassignSlot(slot, showReassignList, cand)
                                }
                                style={styles.candidateChip}
                              >
                                <Text style={styles.candidateChipName}>{cand.name}</Text>
                                <Text style={styles.candidateChipMeta}>
                                  {cand.groupTag} • {cand.assignmentCount ?? 0}x
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    )}

                    {/* Direct Icon-Only Action Buttons in Inspector */}
                    <View style={styles.inspectorActionsGrid}>
                      <Pressable
                        onPress={() => handleCycleReadiness(slot)}
                        style={[
                          styles.inspectorActionBtn,
                          readiness === 'ready'
                            ? styles.cadBtnEmerald
                            : readiness === 'preparing'
                            ? styles.cadBtnAmber
                            : styles.cadBtnBlue,
                        ]}
                        accessibilityLabel="Alternar Status de Prontidão"
                        {...({ title: 'Alternar Status (Recebido / Preparando / Pronto)' } as any)}
                      >
                        <Text
                          style={[
                            styles.inspectorActionBtnText,
                            readiness === 'preparing' && { color: '#090D16' },
                          ]}
                        >
                          {readiness === 'ready'
                            ? '✨'
                            : readiness === 'preparing'
                            ? '📖'
                            : '📩'}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setWaTargetSlot(slot);
                          setWaTargetRole('primary');
                          setWaMode('individual_card');
                          setShowWhatsAppModal(true);
                        }}
                        style={styles.inspectorActionBtn}
                        accessibilityLabel="Ficha WhatsApp Individual"
                        {...({ title: 'Ficha WhatsApp Individual' } as any)}
                      >
                        <Text style={styles.inspectorActionBtnText}>📲</Text>
                      </Pressable>

                      {assistant && (
                        <Pressable
                          onPress={() => {
                            const dateLabel =
                              currentSession.label.split('|')[0]?.trim() ||
                              currentSession.label;
                            const msg = formatPartnerSyncWhatsAppMessage(
                              slot,
                              dateLabel,
                              myParticipantName || primary
                            );
                            handleOpenWhatsAppExternal(msg);
                          }}
                          style={[styles.inspectorActionBtn, styles.cadBtnEmerald]}
                          accessibilityLabel="Combinar com Par no WhatsApp"
                          {...({ title: 'Combinar com Par no WhatsApp' } as any)}
                        >
                          <Text style={styles.inspectorActionBtnText}>🤝</Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={() => startRehearsal(slot)}
                        style={styles.inspectorActionBtn}
                        accessibilityLabel="Cronômetro de Ensaio"
                        {...({ title: `Ensaiar (${durMin} min)` } as any)}
                      >
                        <Text style={styles.inspectorActionBtnText}>⏱️</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleDownloadICS(slot)}
                        style={styles.inspectorActionBtn}
                        accessibilityLabel="Baixar Alerta de Calendário ICS"
                        {...({ title: 'Baixar Alerta .ics' } as any)}
                      >
                        <Text style={styles.inspectorActionBtnText}>📅</Text>
                      </Pressable>

                      <Pressable
                        onPress={handlePrintFullEventPdf}
                        style={[styles.inspectorActionBtn, styles.cadBtnRose]}
                        accessibilityLabel="Imprimir Evento em PDF"
                        {...({ title: 'Imprimir Folha PDF Completa' } as any)}
                      >
                        <Text style={styles.inspectorActionBtnText}>🖨️</Text>
                      </Pressable>
                    </View>

                    {/* Active Rehearsal Timer inside Inspector if running */}
                    {rehearsalSlot && (
                      <View style={styles.inlineRehearsalBox}>
                        <Text style={styles.inlineRehearsalLabel}>
                          🎙️ {formatTimerMMSS(rehearsalRemainingSec)}
                        </Text>
                        <Pressable
                          onPress={() => setRehearsalRunning((r) => !r)}
                          style={styles.miniSwapBtn}
                          accessibilityLabel={rehearsalRunning ? 'Pausar' : 'Retomar'}
                        >
                          <Text style={styles.miniSwapBtnText}>
                            {rehearsalRunning ? '⏸' : '▶'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setRehearsalRunning(false);
                            setRehearsalSlot(null);
                          }}
                          style={styles.miniSwapBtn}
                          accessibilityLabel="Encerrar Ensaio"
                        >
                          <Text style={styles.miniSwapBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })()
            ) : (
              <Text style={{ color: theme.textMuted, padding: 12 }}>
                Selecione um botão na matriz.
              </Text>
            )}
          </View>
        </View>
      ) : (
        /* ================================================================= */
        /* TAB 2: AUTOCAD TERRITORY MATRIX + TERRITORY INSPECTOR             */
        /* ================================================================= */
        <View
          style={[
            styles.cadWorkspaceSplit,
            { flexDirection: isDesktop ? 'row' : 'column' },
          ]}
        >
          <View
            style={[
              styles.cadMatrixPanel,
              {
                backgroundColor: theme.panelBg,
                borderColor: theme.border,
                flex: isDesktop ? 1.1 : undefined,
              },
            ]}
          >
            <View style={styles.sessionCoordStrip}>
              <Text style={[styles.sessionCoordTitle, { color: theme.textPrimary }]}>
                🗺️ {territoryRegistry.length} Setores
              </Text>
              <View style={styles.coordPillsRow}>
                {(['all', '2027', '2026'] as const).map((yr) => (
                  <Pressable
                    key={yr}
                    onPress={() => setS13ServiceYear(yr)}
                    style={[
                      styles.microChip,
                      s13ServiceYear === yr && {
                        backgroundColor: '#10B981',
                        borderColor: '#34D399',
                      },
                    ]}
                  >
                    <Text style={styles.microChipText}>
                      {yr === 'all' ? '🌐' : yr}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.slotButtonsGrid}>
              {territoryRegistry.map((t, idx) => {
                const tMeta = (t.meta || {}) as Record<string, any>;
                const code = tMeta.territoryNumber || t.key;
                const history = (tMeta.assignmentHistory || []) as Array<{
                  assignedTo: string;
                  completedAt?: string;
                }>;
                const latest = history[history.length - 1];
                const isOpen = Boolean(latest && !latest.completedAt);
                const isSelected = idx === selectedTerritoryIdx;

                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setSelectedTerritoryIdx(idx)}
                    style={[
                      styles.cadSlotButton,
                      !isDesktop && {
                        width: '23%',
                        minWidth: 72,
                        paddingHorizontal: 4,
                        paddingVertical: 3,
                      },
                      {
                        borderLeftColor: isOpen ? '#10B981' : '#3B82F6',
                        backgroundColor: isSelected ? '#064E3B' : '#0B1120',
                        borderColor: isSelected ? '#34D399' : '#1E293B',
                      },
                    ]}
                  >
                    <View style={styles.cadSlotBtnHeader}>
                      <Text style={styles.cadSlotBtnNumber}>[{code}]</Text>
                      <Text style={styles.cadSlotBtnDuration}>
                        {isOpen ? '🟢' : '✅'}
                      </Text>
                    </View>
                    <Text style={styles.cadSlotBtnTitle} numberOfLines={1}>
                      {tMeta.locality || t.label}
                    </Text>
                    <Text style={styles.cadSlotBtnAssignee} numberOfLines={1}>
                      {latest?.assignedTo || 'Livre'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Territory Inspector Panel */}
          <View
            style={[
              styles.cadInspectorPanel,
              {
                backgroundColor: theme.panelBg,
                borderColor: theme.border,
                flex: isDesktop ? 1 : undefined,
              },
            ]}
          >
            {inspectedTerritory &&
              (() => {
                const tMeta = (inspectedTerritory.meta || {}) as Record<string, any>;
                const code = tMeta.territoryNumber || inspectedTerritory.key;
                const history = (tMeta.assignmentHistory || []) as Array<{
                  assignedTo: string;
                  assignedAt: string;
                  completedAt?: string;
                  serviceYear?: number;
                }>;
                return (
                  <View style={styles.inspectorContent}>
                    <View
                      style={[
                        styles.inspectorBanner,
                        { backgroundColor: '#065F46' },
                      ]}
                    >
                      <Text style={styles.inspectorBannerText}>
                        🔍 [{code}] {tMeta.locality || inspectedTerritory.label}
                      </Text>
                      <Text style={styles.inspectorBannerTime}>
                        {history.length}x
                      </Text>
                    </View>

                    <View style={styles.cyclesCompactGrid}>
                      {history.map((cyc, cIdx) => (
                        <View key={cIdx} style={styles.cycleCompactCard}>
                          <Text style={styles.cycleCompactYear}>
                            {cyc.serviceYear || 2026}
                          </Text>
                          <Text style={styles.cycleCompactWho} numberOfLines={1}>
                            👤 {cyc.assignedTo}
                          </Text>
                          <Text style={styles.cycleCompactDates}>
                            {cyc.assignedAt} → {cyc.completedAt || 'Campo'}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.inspectorActionsGrid}>
                      <Pressable
                        onPress={() => {
                          setWaTargetTerritoryIdx(selectedTerritoryIdx);
                          setWaMode('territory_assignment');
                          setShowWhatsAppModal(true);
                        }}
                        style={[styles.inspectorActionBtn, styles.cadBtnEmerald]}
                        accessibilityLabel="Enviar Cartão WhatsApp"
                        {...({ title: 'Enviar Cartão WhatsApp' } as any)}
                      >
                        <Text style={styles.inspectorActionBtnText}>📲</Text>
                      </Pressable>

                      <Pressable
                        onPress={handleDownloadS13PDF}
                        style={[styles.inspectorActionBtn, styles.cadBtnRose]}
                        accessibilityLabel="Folha PDF 4 Colunas"
                        {...({ title: 'Folha PDF 4 Colunas' } as any)}
                      >
                        <Text style={styles.inspectorActionBtnText}>🖨️</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })()}
          </View>
        </View>
      )}

      {/* ================================================================= */}
      {/* MODAL: CLEAN-ROOM PRIVILEGE MATRIX & FAIR ROTATION                */}
      {/* ================================================================= */}
      <PrivilegeMatrixModal
        visible={showPrivilegeMatrixModal}
        onClose={() => setShowPrivilegeMatrixModal(false)}
        participants={activeDirectory}
        onChangeParticipants={handleUpdateParticipants}
        onAutoAssignCurrentWeek={(strict) => handleRunAutoAssign('current_week', strict)}
        onAutoAssignAllWeeks={(strict) => handleRunAutoAssign('all_weeks', strict)}
        lastAutoAssignSummaryText={lastAutoAssignSummaryText}
      />

      {/* ================================================================= */}
      {/* MODAL: WHATSAPP EXPORT STUDIO                                     */}
      {/* ================================================================= */}
      <Modal visible={showWhatsAppModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📲 Exportador WhatsApp (5 Modos)</Text>
              <Pressable onPress={() => setShowWhatsAppModal(false)}>
                <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '800' }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.compactRow}>
              {(
                [
                  { id: 'full_week', label: '📋 Semana' },
                  { id: 'group_filter', label: '👥 Grupo' },
                  { id: 'individual_card', label: '🎯 Individual' },
                  { id: 'live_pocket', label: '⏱️ 19:30' },
                  { id: 'territory_assignment', label: '🗺️ Território' },
                ] as const
              ).map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setWaMode(tab.id)}
                  style={[
                    styles.microChip,
                    waMode === tab.id && {
                      backgroundColor: '#10B981',
                      borderColor: '#34D399',
                    },
                  ]}
                >
                  <Text style={styles.microChipText}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>

            <ScrollView style={styles.waPreviewScroll}>
              <Text style={styles.waBubbleText}>{whatsappPreviewText}</Text>
            </ScrollView>

            {copyFeedback && (
              <Text style={{ color: '#34D399', fontSize: 12, fontWeight: '800' }}>
                {copyFeedback}
              </Text>
            )}

            <View style={styles.compactRow}>
              <Pressable
                onPress={handleCopyWhatsAppMessage}
                style={[styles.cadCommandBtn, styles.cadBtnBlue]}
              >
                <Text style={styles.cadCommandBtnText}>📋 Copiar Texto</Text>
              </Pressable>
              <Pressable
                onPress={() => handleOpenWhatsAppExternal(whatsappPreviewText)}
                style={[styles.cadCommandBtn, styles.cadBtnEmerald]}
              >
                <Text style={styles.cadCommandBtnText}>📲 Abrir WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: PARTICIPANT PICKER ("MEU COMPROMISSO")                     */}
      {/* ================================================================= */}
      <Modal visible={showParticipantPicker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎯 Filtrar Meu Compromisso</Text>
              <Pressable onPress={() => setShowParticipantPicker(false)}>
                <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '800' }}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              value={participantSearch}
              onChangeText={setParticipantSearch}
              placeholder="Buscar nome ou grupo..."
              placeholderTextColor="#64748B"
              style={styles.searchInput}
            />
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={styles.compactRow}>
                <Pressable
                  onPress={() => {
                    setMyParticipantName('');
                    setShowParticipantPicker(false);
                  }}
                  style={styles.microChip}
                >
                  <Text style={styles.microChipText}>Limpar Filtro</Text>
                </Pressable>
                {activeDirectory
                  .filter((p) =>
                    normalizePersonKey(p.name).includes(normalizePersonKey(participantSearch))
                  )
                  .map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setMyParticipantName(p.name);
                        setShowParticipantPicker(false);
                      }}
                      style={[
                        styles.microChip,
                        myParticipantName === p.name && {
                          backgroundColor: '#D97706',
                          borderColor: '#FDE68A',
                        },
                      ]}
                    >
                      <Text style={styles.microChipText}>
                        {p.name} ({p.groupTag})
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: PASTE CSV OR SCHEDULE TEXT                                 */}
      {/* ================================================================= */}
      <Modal visible={showImportModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📥 Colar CSV ou Texto de Programação</Text>
              <Pressable onPress={() => setShowImportModal(false)}>
                <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '800' }}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              value={customScheduleText}
              onChangeText={setCustomScheduleText}
              multiline
              numberOfLines={8}
              placeholder="Cole aqui o conteúdo de um arquivo .csv ou o texto da programação..."
              placeholderTextColor="#64748B"
              style={[styles.searchInput, { minHeight: 160, textAlignVertical: 'top' }]}
            />
            <View style={styles.compactRow}>
              <Pressable
                onPress={handleImportCustomText}
                style={[styles.cadCommandBtn, styles.cadBtnEmerald]}
              >
                <Text style={styles.cadCommandBtnText}>⚡ Compilar e Importar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cadViewport: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    overflow: 'hidden',
  },
  cadTopRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 6,
  },
  brandCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cadRibbonTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  cadRibbonTools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    flexShrink: 1,
  },
  cadCommandBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cadBtnBlue: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  cadBtnEmerald: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
  },
  cadBtnPurple: {
    backgroundColor: '#6D28D9',
    borderColor: '#A78BFA',
  },
  cadBtnAmber: {
    backgroundColor: '#F59E0B',
    borderColor: '#FDE68A',
  },
  cadBtnCyan: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  cadBtnRose: {
    backgroundColor: '#BE123C',
    borderColor: '#FB7185',
  },
  cadCommandBtnText: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '800',
  },
  cadSubRibbon: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    gap: 5,
  },
  compactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  subTabBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  subTabBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  microChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  microChipText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  weekMicroBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  weekMicroBtnText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },
  compactStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  compactStatusText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  cadWorkspaceSplit: {
    flex: 1,
    padding: 8,
    gap: 8,
    overflow: 'hidden',
  },
  cadMatrixPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
  },
  sessionCoordStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingBottom: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sessionCoordTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  coordPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  coordBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coordBadgeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  matrixHintText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
  },
  slotButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cadSlotButton: {
    width: '48.5%',
    minWidth: 145,
    borderRadius: 6,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  cadSlotBtnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cadSlotBtnNumber: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
  },
  cadSlotBtnDuration: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  cadSlotBtnTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  cadSlotBtnAssignee: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  cadInspectorPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
  },
  inspectorContent: {
    flex: 1,
    gap: 7,
  },
  inspectorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  inspectorBannerText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    flex: 1,
  },
  inspectorBannerTime: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '800',
  },
  inspectorSlotTitle: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  capabilityTagRow: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  capabilityTagText: {
    color: '#BAE6FD',
    fontSize: 10,
    fontWeight: '700',
  },
  inspectorAssigneesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  inspectorPersonBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 6,
    padding: 7,
    gap: 3,
  },
  inspectorRoleLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
  },
  inspectorPersonName: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  inspectorPersonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  inspectorGroupBadge: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  miniSwapBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniSwapBtnText: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '700',
  },
  reassignPickerStrip: {
    backgroundColor: '#111827',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
    gap: 4,
  },
  reassignStripTitle: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
  },
  candidateChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  candidateChipName: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '800',
  },
  candidateChipMeta: {
    color: '#94A3B8',
    fontSize: 9,
  },
  inspectorActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  inspectorActionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  inspectorActionBtnText: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '800',
  },
  inlineRehearsalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  inlineRehearsalLabel: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '900',
    flex: 1,
  },
  cyclesCompactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cycleCompactCard: {
    width: '48%',
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 5,
    padding: 6,
  },
  cycleCompactYear: {
    color: '#FFB800',
    fontSize: 9.5,
    fontWeight: '800',
  },
  cycleCompactWho: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  cycleCompactDates: {
    color: '#94A3B8',
    fontSize: 9.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
  },
  waPreviewScroll: {
    maxHeight: 240,
    backgroundColor: '#090D16',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  waBubbleText: {
    color: '#E2E8F0',
    fontSize: 11.5,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  searchInput: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#F8FAFC',
    fontSize: 12,
  },
});
