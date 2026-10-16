/**
 * Page: schedule-hub
 *
 * Agnostic Schedule & Commitment Agonist Console ("Agonista de Boas Motivações").
 *
 * Features:
 * - Reads & persists multi-week schedules, participant operational groups, and
 *   multi-cycle territory records using 100% domain-agnostic Sekundo data structures.
 * - Zero hardcoded sensitive/personal data in source control: loads local `.json` / `.txt`
 *   bundles from the user's device folder and persists them in local device storage.
 * - Multi-Mode WhatsApp Export Studio (Weekly Board, Group 1/2/3 Digest, Individual Card,
 *   Live Pocket Timeline, and Territory Assignment Card).
 * - Street-Ready UX:
 *   - ☀️ Modo Sol (WCAG AAA high-contrast daylight theme)
 *   - 🎯 "Meu Compromisso" 1-tap personal lens across all weeks & territories
 *   - 👥 Instant Group Filter (Grupo 1, Grupo 2, Grupo 3)
 *   - ✨ 3-State Readiness Thermometer (Recebido -> Preparando -> Pronto!)
 *   - 🤝 "Combinar com Meu Par" 1-tap WhatsApp dyad sync
 *   - ⏱️ Pocket Rehearsal Timer with 30s amber warning
 *   - 📅 RFC 5545 .ics Calendar Alert download (T-48h & T-2h)
 *   - 🖨️ 4-Column Multi-Cycle Territory PDF generator (2027 / 2026 / All)
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import * as storage from '../storage/localStorage';
import {
  PROGRAMACAO_UNIT_NAME,
  PROGRAMACAO_PARTICIPANT_DIRECTORY,
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
  sanitizeLegacySensitiveText,
  type FlatSkeletonEntry,
  type ParticipantProfile,
  type StructuredProgramSession,
  type WhatsAppExportMode,
  type ReadinessState,
} from '@sekundo/core';

const MY_PARTICIPANT_STORAGE_KEY = 'sekundo:my_participant_name';
const SUNLIGHT_MODE_STORAGE_KEY = 'sekundo:sunlight_mode';
const LOCAL_BUNDLE_STORAGE_KEY = 'sekundo:loaded_schedule_bundle_v1';

export default function ScheduleHubConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';

  const { flatRegistry, updateNode, saveSkeleton } = useSkeleton(eventId);
  const { events, addEvent } = useLocalEvent();

  const [activeUnitName, setActiveUnitName] = useState<string>(PROGRAMACAO_UNIT_NAME);
  const [activeDirectory, setActiveDirectory] = useState<ParticipantProfile[]>(
    PROGRAMACAO_PARTICIPANT_DIRECTORY
  );
  const [localScheduleRegistry, setLocalScheduleRegistry] = useState<FlatSkeletonEntry[]>(() =>
    buildProgramacaoReuniaoRegistry()
  );
  const [territoryRegistry, setTerritoryRegistry] = useState<FlatSkeletonEntry[]>(() =>
    buildTerritoriosS13HistoricalRegistry()
  );

  // Use event's flatRegistry if it contains schedule sessions; otherwise use local schedule state
  const activeScheduleRegistry = useMemo(() => {
    const extracted = extractStructuredSessions(flatRegistry);
    if (extracted.length > 0) return flatRegistry;
    return localScheduleRegistry;
  }, [flatRegistry, localScheduleRegistry]);

  const sessions = useMemo(
    () => extractStructuredSessions(activeScheduleRegistry),
    [activeScheduleRegistry]
  );

  const [selectedSessionIdx, setSelectedSessionIdx] = useState(0);
  const currentSession: StructuredProgramSession | undefined =
    sessions[selectedSessionIdx] || sessions[0];

  // Street-ready UX filters & preferences
  const [sunlightMode, setSunlightMode] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [myParticipantName, setMyParticipantName] = useState<string>('');
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'schedule' | 'territories'>('schedule');

  // Rehearsal Pocket Timer State
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

  // Custom Text Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [customScheduleText, setCustomScheduleText] = useState('');

  // Multi-Cycle PDF Year State
  const [s13ServiceYear, setS13ServiceYear] = useState<'all' | '2027' | '2026'>('all');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const operationalGroups = useMemo(
    () => listOperationalGroups(activeDirectory),
    [activeDirectory]
  );

  // Load persisted user preferences & locally imported schedule bundle from localStorage
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const MIGRATION_KEY = 'sekundo_privacy_migration_v2';
      if (window.localStorage.getItem(MIGRATION_KEY) !== '1') {
        window.localStorage.removeItem(MY_PARTICIPANT_STORAGE_KEY);
        window.localStorage.removeItem(LOCAL_BUNDLE_STORAGE_KEY);
        window.localStorage.removeItem('sekundo_app_manifest_v1');
        window.localStorage.setItem(MIGRATION_KEY, '1');
      }

      const savedName = window.localStorage.getItem(MY_PARTICIPANT_STORAGE_KEY);
      if (savedName) setMyParticipantName(sanitizeLegacySensitiveText(savedName).text);
      const savedSun = window.localStorage.getItem(SUNLIGHT_MODE_STORAGE_KEY);
      if (savedSun === '1') setSunlightMode(true);

      const savedBundleJson = window.localStorage.getItem(LOCAL_BUNDLE_STORAGE_KEY);
      if (savedBundleJson) {
        try {
          const loaded = parseSekundoScheduleBundle(sanitizeLegacySensitiveText(savedBundleJson).text);
          setActiveUnitName(loaded.unitName);
          setActiveDirectory(loaded.participants);
          setLocalScheduleRegistry(loaded.scheduleRegistry);
          setTerritoryRegistry(loaded.territoryRegistry);
        } catch (err) {
          console.warn('[Sekundo] Failed to restore local schedule bundle:', err);
        }
      }
    }
  }, []);

  const handleSelectMyParticipant = (name: string) => {
    setMyParticipantName(name);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (name) {
        window.localStorage.setItem(MY_PARTICIPANT_STORAGE_KEY, name);
      } else {
        window.localStorage.removeItem(MY_PARTICIPANT_STORAGE_KEY);
      }
    }
    setShowParticipantPicker(false);
  };

  const toggleSunlightMode = () => {
    const next = !sunlightMode;
    setSunlightMode(next);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(SUNLIGHT_MODE_STORAGE_KEY, next ? '1' : '0');
    }
  };

  // Load a local .json or .txt file from the user's folder (e.g. sekundo-programacao-2026-2027.json)
  const handlePickLocalScheduleFile = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.txt';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          if (file.name.toLowerCase().endsWith('.json')) {
            const loaded = parseSekundoScheduleBundle(text);
            setActiveUnitName(loaded.unitName);
            setActiveDirectory(loaded.participants);
            setLocalScheduleRegistry(loaded.scheduleRegistry);
            setTerritoryRegistry(loaded.territoryRegistry);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(LOCAL_BUNDLE_STORAGE_KEY, text);
            }
            if (eventId) {
              await saveSkeleton(loaded.scheduleRegistry);
            }
            setSelectedSessionIdx(0);
            setStatusBanner(
              `✅ Arquivo "${file.name}" carregado e salvo localmente (${loaded.participants.length} participantes, ${extractStructuredSessions(loaded.scheduleRegistry).length} semanas, ${loaded.territoryRegistry.length} territórios)!`
            );
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
            setStatusBanner(`✅ Programação de texto "${file.name}" carregada (${parsed.length} nós)!`);
          }
        } catch (err: any) {
          setStatusBanner(`❌ Erro ao ler arquivo: ${err.message}`);
        }
      };
      input.click();
    }
  };

  // Rehearsal timer countdown effect
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

  // Cycle 3-state Readiness Thermometer: pending -> preparing -> ready
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

  // Persist the active schedule & Multi-Cycle Territories as official Sekundo Events in localStorage
  const handleSaveSeedToAppEvents = async () => {
    try {
      setStatusBanner('Salvando programação e territórios nos Eventos Ativos do Sekundo...');
      const scheduleEventName = `${activeUnitName} — Programação Semanal`;
      const territoryEventName = `${activeUnitName} — Registro de Territórios (2027-2026)`;

      let schedEvent = events.find((e) => e.config.name === scheduleEventName);
      if (!schedEvent) {
        schedEvent = await addEvent(scheduleEventName, 'weekly', ['01', '02', '03'], [
          'roster_assignments',
          'live_production_ros',
        ]);
      }
      await storage.saveSkeleton(schedEvent.config.id, activeScheduleRegistry);

      let terrEvent = events.find((e) => e.config.name === territoryEventName);
      if (!terrEvent) {
        terrEvent = await addEvent(territoryEventName, 'monthly', ['01', '02', '03'], [
          'territory_logistics',
        ]);
      }
      await storage.saveSkeleton(terrEvent.config.id, territoryRegistry);

      setStatusBanner(
        '✅ Programação e Registro de Territórios salvos nos Eventos Ativos do Sekundo!'
      );
      router.replace(`/schedule-hub?id=${schedEvent.config.id}` as any);
    } catch (e: any) {
      setStatusBanner(`❌ Erro ao salvar no app: ${e.message}`);
    }
  };

  // Handle importing custom pasted schedule text
  const handleImportCustomText = async () => {
    if (!customScheduleText.trim()) return;
    const parsed = parseProgramScheduleText(customScheduleText, {
      unitName: activeUnitName,
      directory: activeDirectory,
    });
    if (parsed.length === 0) {
      setStatusBanner('⚠️ Nenhuma sessão reconhecida no texto colado. Verifique o formato.');
      return;
    }
    if (eventId) {
      await saveSkeleton(parsed);
    } else {
      setLocalScheduleRegistry(parsed);
    }
    setSelectedSessionIdx(0);
    setShowImportModal(false);
    setCustomScheduleText('');
    setStatusBanner(`✅ Programação importada com sucesso (${parsed.length} nós estruturais)!`);
  };

  // Download .ics calendar file for a slot
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
      setStatusBanner(`📅 Lembrete de calendário (.ics) gerado para "${slot.label}"!`);
    }
  };

  // Generate 4-Column Multi-Cycle Territory PDF
  const handleDownloadS13PDF = async () => {
    try {
      setGeneratingPdf(true);
      setStatusBanner(`Gerando PDF de Registro de Territórios (4 Colunas Multi-Ciclo — Ciclo ${s13ServiceYear})...`);
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
        a.download = `Registro_Territorios_${s13ServiceYear}_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setStatusBanner(
        `✅ PDF de Territórios gerado no padrão de 4 colunas (${res.territoryCount} territórios)!`
      );
    } catch (e: any) {
      setStatusBanner(`❌ Erro ao gerar PDF de Territórios: ${e.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Compute all commitments for `myParticipantName` across all sessions
  const myCommitmentsSummary = useMemo(() => {
    if (!myParticipantName) return { slots: [], territories: [] };
    const normMe = normalizePersonKey(myParticipantName);

    const matchedSlots: Array<{
      sessionIndex: number;
      sessionDateLabel: string;
      slot: FlatSkeletonEntry;
      roleLabel: string;
    }> = [];

    sessions.forEach((sess, sIdx) => {
      const dateShort = sess.label.split('|')[0]?.trim() || sess.label;
      if (normalizePersonKey(sess.chairPerson) === normMe) {
        matchedSlots.push({
          sessionIndex: sIdx,
          sessionDateLabel: dateShort,
          slot: {
            key: sess.key,
            type: 'header',
            label: 'Presidente da Sessão',
            value: sess.chairPerson || '',
            email: '',
            meta: { assignedTo: sess.chairPerson, sessionDate: sess.sessionDate },
          },
          roleLabel: 'Presidente',
        });
      }
      if (normalizePersonKey(sess.openingPrayer) === normMe) {
        matchedSlots.push({
          sessionIndex: sIdx,
          sessionDateLabel: dateShort,
          slot: {
            key: `${sess.key}-open1`,
            type: 'slot',
            label: 'Abertura / Credenciamento',
            value: sess.openingPrayer || '',
            email: '',
            meta: { assignedTo: sess.openingPrayer, durationMinutes: 2 },
          },
          roleLabel: 'Abertura / Credenciamento',
        });
      }
      if (normalizePersonKey(sess.closingPrayer) === normMe) {
        matchedSlots.push({
          sessionIndex: sIdx,
          sessionDateLabel: dateShort,
          slot: {
            key: `${sess.key}-close2`,
            type: 'slot',
            label: 'Encerramento / Síntese Final',
            value: sess.closingPrayer || '',
            email: '',
            meta: { assignedTo: sess.closingPrayer, durationMinutes: 2 },
          },
          roleLabel: 'Encerramento / Síntese Final',
        });
      }

      for (const sec of sess.sections) {
        for (const slot of sec.slots) {
          const meta = (slot.meta || {}) as Record<string, any>;
          const isPrimary = normalizePersonKey(meta.assignedTo || slot.value) === normMe;
          const isAssistant = normalizePersonKey(meta.assistantTo) === normMe;
          if (isPrimary || isAssistant) {
            matchedSlots.push({
              sessionIndex: sIdx,
              sessionDateLabel: dateShort,
              slot,
              roleLabel: isPrimary ? 'Titular' : `Ajudante (Com: ${meta.assignedTo})`,
            });
          }
        }
      }
    });

    const matchedTerritories = territoryRegistry.filter((t) => {
      const tMeta = (t.meta || {}) as Record<string, any>;
      const history = (tMeta.assignmentHistory || []) as Array<{
        assignedTo: string;
        completedAt?: string;
      }>;
      return history.some((c) => normalizePersonKey(c.assignedTo) === normMe && !c.completedAt);
    });

    return { slots: matchedSlots, territories: matchedTerritories };
  }, [myParticipantName, sessions, territoryRegistry]);

  // Check if a slot matches current filters (Group filter)
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

  // Compute active WhatsApp message preview in WhatsApp Studio
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
          waTargetSlot || currentSession.sections[1]?.slots[0] || currentSession.sections[0]?.slots[0];
        if (!fallbackSlot) return 'Selecione uma parte para gerar o cartão.';
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
  ]);

  const handleCopyWhatsAppMessage = async () => {
    if (!whatsappPreviewText) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(whatsappPreviewText);
      setCopyFeedback('✅ Copiado para a área de transferência!');
      setTimeout(() => setCopyFeedback(null), 2500);
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

  // Dynamic Theme Palette (Dark Console vs Outdoor Sunlight Mode WCAG AAA)
  const theme = sunlightMode
    ? {
        bg: '#FFFFFF',
        cardBg: '#F8FAFC',
        cardBorder: '#CBD5E1',
        textPrimary: '#0F172A',
        textSecondary: '#334155',
        textMuted: '#475569',
        accent: '#B45309',
        pillBg: '#E2E8F0',
      }
    : {
        bg: '#090D16',
        cardBg: '#131B2E',
        cardBorder: '#1E293B',
        textPrimary: '#F8FAFC',
        textSecondary: '#CBD5E1',
        textMuted: '#94A3B8',
        accent: '#FFB800',
        pillBg: '#1E293B',
      };

  const filteredParticipants = useMemo(() => {
    const q = normalizePersonKey(participantSearch);
    if (!q) return activeDirectory;
    return activeDirectory.filter(
      (p) =>
        normalizePersonKey(p.name).includes(q) || normalizePersonKey(p.groupTag).includes(q)
    );
  }, [participantSearch, activeDirectory]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Navigation & Street-Ready Action Bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/')} style={styles.backButton}>
            <Text style={[styles.backText, { color: theme.accent }]}>← Painel Sekundo</Text>
          </Pressable>

          <View style={styles.topRightActions}>
            <Pressable
              onPress={toggleSunlightMode}
              style={[
                styles.topPillButton,
                {
                  backgroundColor: sunlightMode ? '#FEF3C7' : '#1E293B',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: sunlightMode ? '#92400E' : '#FCD34D',
                }}
              >
                {sunlightMode ? '🌙 Modo Escuro' : '☀️ Modo Sol (Rua)'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handlePickLocalScheduleFile}
              style={[
                styles.topPillButton,
                { backgroundColor: 'rgba(59, 130, 246, 0.16)', borderColor: '#3B82F6' },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#60A5FA' }}>
                📂 Abrir Arquivo da Pasta (.json/.txt)
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowImportModal(true)}
              style={[
                styles.topPillButton,
                { backgroundColor: theme.pillBg, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary }}>
                📥 Colar Texto
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSaveSeedToAppEvents}
              style={[
                styles.topPillButton,
                { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>
                💾 Salvar no App
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Header Title & WhatsApp Studio CTA */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[styles.heroBadge, { borderColor: theme.accent, color: theme.accent }]}>
                MOTOR AGNÓSTICO SEKUNDO
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '600' }}>
                {activeUnitName}
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
              Programação, Compromissos & Territórios
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              {sessions.length} semanas carregadas • {activeDirectory.length} participantes ({operationalGroups.join(', ')}) • {territoryRegistry.length} territórios multi-ciclo
            </Text>
          </View>

          <Pressable
            onPress={() => {
              setWaMode('full_week');
              setShowWhatsAppModal(true);
            }}
            style={styles.whatsappMainCTA}
          >
            <Text style={styles.whatsappMainCTAText}>📲 Exportar p/ WhatsApp</Text>
            <Text style={styles.whatsappMainCTASub}>5 formatos prontos</Text>
          </Pressable>
        </View>

        {statusBanner && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{statusBanner}</Text>
            <Pressable onPress={() => setStatusBanner(null)}>
              <Text style={{ color: '#94A3B8', fontWeight: '700' }}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Active Rehearsal Pocket Timer Banner */}
        {rehearsalSlot && (
          <View
            style={[
              styles.rehearsalBar,
              rehearsalRemainingSec < 0
                ? { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.16)' }
                : rehearsalRemainingSec <= 30
                ? { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.16)' }
                : { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.14)' },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#10B981' }}>
                🎙️ CRONÔMETRO DE ENSAIO DE BOLSO
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                {rehearsalSlot.label}
              </Text>
            </View>
            <Text
              style={[
                styles.rehearsalClock,
                {
                  color:
                    rehearsalRemainingSec < 0
                      ? '#EF4444'
                      : rehearsalRemainingSec <= 30
                      ? '#F59E0B'
                      : '#10B981',
                },
              ]}
            >
              {formatTimerMMSS(rehearsalRemainingSec)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setRehearsalRunning(!rehearsalRunning)}
                style={styles.rehearsalControlBtn}
              >
                <Text style={styles.rehearsalControlText}>
                  {rehearsalRunning ? '⏸ Pausar' : '▶ Retomar'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setRehearsalRunning(false);
                  setRehearsalSlot(null);
                }}
                style={[styles.rehearsalControlBtn, { backgroundColor: '#334155' }]}
              >
                <Text style={styles.rehearsalControlText}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Street Filter Bar: "🎯 Meu Compromisso" + Group Filter Pills + View Switcher */}
        <View
          style={[
            styles.filterCard,
            { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.filterRow}>
            {/* Personal Commitment Agonist Selector */}
            <Pressable
              onPress={() => setShowParticipantPicker(true)}
              style={[
                styles.myCommitmentButton,
                myParticipantName
                  ? { backgroundColor: 'rgba(255, 184, 0, 0.18)', borderColor: '#FFB800' }
                  : { backgroundColor: theme.pillBg, borderColor: theme.cardBorder },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: myParticipantName ? theme.accent : theme.textPrimary,
                }}
              >
                🎯 {myParticipantName ? `Meu Compromisso: ${myParticipantName}` : 'Meu Compromisso (Escolher Nome)'}
              </Text>
            </Pressable>

            {myParticipantName !== '' && (
              <Pressable
                onPress={() => handleSelectMyParticipant('')}
                style={[styles.clearFilterBtn, { borderColor: theme.cardBorder }]}
              >
                <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '700' }}>
                  Limpar
                </Text>
              </Pressable>
            )}

            {/* Group Filter Pills */}
            <View style={styles.groupPillsContainer}>
              {['ALL', ...operationalGroups].map((grp) => {
                const active = selectedGroup === grp;
                return (
                  <Pressable
                    key={grp}
                    onPress={() => setSelectedGroup(grp)}
                    style={[
                      styles.groupPill,
                      active
                        ? { backgroundColor: '#3B82F6', borderColor: '#60A5FA' }
                        : { backgroundColor: theme.pillBg, borderColor: theme.cardBorder },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: active ? '#FFFFFF' : theme.textSecondary,
                      }}
                    >
                      {grp === 'ALL' ? '👥 Todos os Grupos' : `👥 ${grp}`}
                    </Text>
                  </Pressable>
                );
              })}

              {selectedGroup !== 'ALL' && (
                <Pressable
                  onPress={() => {
                    setWaTargetGroup(selectedGroup);
                    setWaMode('group_filter');
                    setShowWhatsAppModal(true);
                  }}
                  style={styles.groupWhatsAppQuickBtn}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>
                    📲 WhatsApp do {selectedGroup}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Personal Commitment Summary Banner when "Meu Compromisso" is active */}
          {myParticipantName !== '' && (
            <View style={styles.mySummaryBox}>
              <Text style={styles.mySummaryTitle}>
                ✨ Painel Pessoal de {myParticipantName} ({myCommitmentsSummary.slots.length} partes nas {sessions.length} semanas •{' '}
                {myCommitmentsSummary.territories.length} território(s) em mãos)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {myCommitmentsSummary.slots.map((item, idx) => (
                    <Pressable
                      key={`${item.slot.key}-${idx}`}
                      onPress={() => {
                        setActiveTab('schedule');
                        setSelectedSessionIdx(item.sessionIndex);
                      }}
                      style={styles.mySummaryChip}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FCD34D' }}>
                        📅 {item.sessionDateLabel}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                        {item.slot.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#CBD5E1' }}>{item.roleLabel}</Text>
                    </Pressable>
                  ))}
                  {myCommitmentsSummary.territories.map((t) => {
                    const tMeta = (t.meta || {}) as Record<string, any>;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => setActiveTab('territories')}
                        style={[styles.mySummaryChip, { borderColor: '#10B981' }]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#34D399' }}>
                          🗺️ Território em Campo
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                          {tMeta.territoryNumber || t.key} — {tMeta.locality}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#CBD5E1' }}>
                          Desde {tMeta.assignedAt || '-'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Main Section Switcher: Schedule vs Multi-Cycle Territories */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab('schedule')}
            style={[
              styles.tabButton,
              activeTab === 'schedule' && {
                borderBottomColor: theme.accent,
                borderBottomWidth: 3,
              },
            ]}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === 'schedule' ? theme.accent : theme.textMuted },
              ]}
            >
              📅 Programação Semanal ({sessions.length} Semanas)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('territories')}
            style={[
              styles.tabButton,
              activeTab === 'territories' && {
                borderBottomColor: '#10B981',
                borderBottomWidth: 3,
              },
            ]}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === 'territories' ? '#10B981' : theme.textMuted },
              ]}
            >
              🗺️ Designações de Territórios ({territoryRegistry.length})
            </Text>
          </Pressable>
        </View>

        {/* ================================================================= */}
        {/* TAB 1: WEEKLY SCHEDULE BOARD                                      */}
        {/* ================================================================= */}
        {activeTab === 'schedule' && currentSession && (
          <View>
            {/* Horizontal Week Selector Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.weekSelectorScroll}
            >
              <View style={styles.weekSelectorRow}>
                {sessions.map((sess, idx) => {
                  const isSelected = idx === selectedSessionIdx;
                  const shortDate = sess.label.split('|')[0]?.trim() || sess.label;
                  const hasMyPart =
                    myParticipantName !== '' &&
                    myCommitmentsSummary.slots.some((s) => s.sessionIndex === idx);

                  return (
                    <Pressable
                      key={sess.key}
                      onPress={() => setSelectedSessionIdx(idx)}
                      style={[
                        styles.weekPill,
                        isSelected
                          ? { backgroundColor: theme.accent, borderColor: theme.accent }
                          : { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                        hasMyPart && !isSelected && { borderColor: '#FFB800', borderWidth: 2 },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isSelected ? '#090D16' : theme.textPrimary,
                        }}
                      >
                        {shortDate}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: isSelected ? '#1E293B' : theme.textMuted,
                        }}
                      >
                        {sess.sessionTheme}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Session Header Banner */}
            <View
              style={[
                styles.sessionHeaderCard,
                { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionDateTitle, { color: theme.textPrimary }]}>
                    {currentSession.label}
                  </Text>
                  <View style={styles.sessionMetaChips}>
                    {currentSession.chairPerson && (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipLabel}>👤 Presidente:</Text>
                        <Text style={styles.metaChipValue}>{currentSession.chairPerson}</Text>
                      </View>
                    )}
                    {currentSession.openingCue && (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipValue}>🎵 {currentSession.openingCue}</Text>
                      </View>
                    )}
                    {currentSession.openingPrayer && (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipLabel}>🔹 Abertura / Credenciamento:</Text>
                        <Text style={styles.metaChipValue}>{currentSession.openingPrayer}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => {
                      setWaMode('live_pocket');
                      setShowWhatsAppModal(true);
                    }}
                    style={[
                      styles.secondaryActionBtn,
                      { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.14)' },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#60A5FA' }}>
                      ⏱️ Cronograma 19:30
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setWaMode('full_week');
                      setShowWhatsAppModal(true);
                    }}
                    style={[
                      styles.secondaryActionBtn,
                      { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.14)' },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>
                      📲 Compartilhar Semana
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Thematic Sections (Data-Driven Accent Colors: #3D5B65, #9A7420, #80241E) */}
            {currentSession.sections.map((sec, secIdx) => {
              const visibleSlots = sec.slots.filter(slotMatchesGroupFilter);
              if (visibleSlots.length === 0 && selectedGroup !== 'ALL') return null;

              const sectionColor = sec.accentColor || '#3D5B65';

              return (
                <View
                  key={sec.key}
                  style={[
                    styles.sectionBlock,
                    { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                  ]}
                >
                  {/* Colored Section Header Banner */}
                  <View style={[styles.sectionBanner, { backgroundColor: sectionColor }]}>
                    <Text style={styles.sectionBannerTitle}>{sec.label}</Text>
                    <Text style={styles.sectionBannerCount}>
                      {visibleSlots.length} {visibleSlots.length === 1 ? 'parte' : 'partes'}
                    </Text>
                  </View>

                  {/* Middle transition cue inside Section 3 if present */}
                  {secIdx === 2 && currentSession.middleCue && (
                    <View style={styles.cueStrip}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.accent }}>
                        🎵 {currentSession.middleCue}
                      </Text>
                    </View>
                  )}

                  {/* Section Slots */}
                  <View style={styles.slotsList}>
                    {visibleSlots.map((slot) => {
                      const meta = (slot.meta || {}) as Record<string, any>;
                      const primary = meta.assignedTo || slot.value || 'A designar';
                      const assistant = meta.assistantTo as string | undefined;
                      const durMin = meta.durationMinutes || 5;
                      const readiness: ReadinessState =
                        (meta.readinessState as ReadinessState) ||
                        (meta.confirmed ? 'ready' : 'pending');
                      const primaryGroup =
                        meta.groupTag ||
                        findParticipantProfile(primary, activeDirectory)?.groupTag;
                      const assistantGroup =
                        meta.assistantGroupTag ||
                        findParticipantProfile(assistant, activeDirectory)?.groupTag;
                      const mine = isSlotMine(slot);

                      const readinessConfig = {
                        pending: {
                          label: '📩 Recebido (Toque p/ Preparar)',
                          bg: 'rgba(148, 163, 184, 0.15)',
                          border: '#64748B',
                          text: theme.textSecondary,
                        },
                        preparing: {
                          label: '📖 Preparando (Toque p/ Pronto)',
                          bg: 'rgba(245, 158, 11, 0.18)',
                          border: '#F59E0B',
                          text: '#FBBF24',
                        },
                        ready: {
                          label: '✨ Pronto p/ Cumprir!',
                          bg: 'rgba(16, 185, 129, 0.2)',
                          border: '#10B981',
                          text: '#34D399',
                        },
                      }[readiness];

                      return (
                        <View
                          key={slot.key}
                          style={[
                            styles.slotCard,
                            {
                              borderLeftColor: sectionColor,
                              backgroundColor: sunlightMode ? '#FFFFFF' : '#0F172A',
                              borderColor: mine ? '#FFB800' : theme.cardBorder,
                              borderWidth: mine ? 2 : 1,
                            },
                          ]}
                        >
                          {/* Top row: Part Title + Duration Pill */}
                          <View style={styles.slotHeaderRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.slotTitle, { color: theme.textPrimary }]}>
                                {slot.label}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.durationBadge,
                                { backgroundColor: `${sectionColor}33`, borderColor: sectionColor },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '800',
                                  color: sunlightMode ? sectionColor : '#F8FAFC',
                                }}
                              >
                                ⏱️ {durMin} min
                              </Text>
                            </View>
                          </View>

                          {/* Assignees Row (Primary + Optional Partner/Assistant + Group Badges) */}
                          <View style={styles.assigneesContainer}>
                            <View style={styles.personChip}>
                              <Text style={[styles.personRoleLabel, { color: theme.textMuted }]}>
                                {assistant ? 'Titular:' : 'Designado:'}
                              </Text>
                              <Text style={[styles.personName, { color: theme.textPrimary }]}>
                                👤 {primary}
                              </Text>
                              {primaryGroup && (
                                <View style={styles.groupTagBadge}>
                                  <Text style={styles.groupTagText}>{primaryGroup}</Text>
                                </View>
                              )}
                            </View>

                            {assistant && (
                              <View style={styles.personChip}>
                                <Text style={[styles.personRoleLabel, { color: theme.textMuted }]}>
                                  Ajudante / Leitor:
                                </Text>
                                <Text style={[styles.personName, { color: theme.textPrimary }]}>
                                  🤝 {assistant}
                                </Text>
                                {assistantGroup && (
                                  <View style={styles.groupTagBadge}>
                                    <Text style={styles.groupTagText}>{assistantGroup}</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>

                          {/* Street-Ready Commitment Action Bar */}
                          <View style={styles.slotActionsRow}>
                            {/* 1. 3-State Readiness Thermometer */}
                            <Pressable
                              onPress={() => handleCycleReadiness(slot)}
                              style={[
                                styles.slotActionBtn,
                                {
                                  backgroundColor: readinessConfig.bg,
                                  borderColor: readinessConfig.border,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '800',
                                  color: readinessConfig.text,
                                }}
                              >
                                {readinessConfig.label}
                              </Text>
                            </Pressable>

                            {/* 2. "Combinar com Meu Par" 1-Tap Dyad Sync */}
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
                                style={[
                                  styles.slotActionBtn,
                                  {
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    borderColor: '#10B981',
                                  },
                                ]}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>
                                  🤝 Combinar c/ Par
                                </Text>
                              </Pressable>
                            )}

                            {/* 3. Digital Individual WhatsApp Card */}
                            <Pressable
                              onPress={() => {
                                setWaTargetSlot(slot);
                                setWaTargetRole('primary');
                                setWaMode('individual_card');
                                setShowWhatsAppModal(true);
                              }}
                              style={[
                                styles.slotActionBtn,
                                {
                                  backgroundColor: theme.pillBg,
                                  borderColor: theme.cardBorder,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: theme.textPrimary,
                                }}
                              >
                                📲 Ficha Individual
                              </Text>
                            </Pressable>

                            {/* 4. Pocket Rehearsal Timer */}
                            <Pressable
                              onPress={() => startRehearsal(slot)}
                              style={[
                                styles.slotActionBtn,
                                {
                                  backgroundColor: theme.pillBg,
                                  borderColor: theme.cardBorder,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: theme.textPrimary,
                                }}
                              >
                                ⏱️ Ensaiar ({durMin}m)
                              </Text>
                            </Pressable>

                            {/* 5. Calendar .ics Reminder */}
                            <Pressable
                              onPress={() => handleDownloadICS(slot)}
                              style={[
                                styles.slotActionBtn,
                                {
                                  backgroundColor: theme.pillBg,
                                  borderColor: theme.cardBorder,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: theme.textSecondary,
                                }}
                              >
                                📅 .ics
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Session Closing Footer */}
            {(currentSession.closingCue || currentSession.closingPrayer) && (
              <View
                style={[
                  styles.sessionFooterCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                ]}
              >
                {currentSession.closingCue && (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.accent }}>
                    🎵 {currentSession.closingCue}
                  </Text>
                )}
                {currentSession.closingPrayer && (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                    🔹 Encerramento / Síntese Final: {currentSession.closingPrayer}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 2: MULTI-CYCLE TERRITORY DESIGNATIONS (2027-2026)             */}
        {/* ================================================================= */}
        {activeTab === 'territories' && (
          <View>
            <View
              style={[
                styles.s13HeaderCard,
                { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionDateTitle, { color: theme.textPrimary }]}>
                  Registro de Designação de Território (4 Colunas Multi-Ciclo)
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
                  Layout tabular de 4 colunas por linha ("Designado para" + Data da designação | Data da conclusão)
                  com quebra automática para múltiplos ciclos operacionais 2027 e 2026.
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {(['all', '2027', '2026'] as const).map((yr) => (
                    <Pressable
                      key={yr}
                      onPress={() => setS13ServiceYear(yr)}
                      style={[
                        styles.groupPill,
                        s13ServiceYear === yr
                          ? { backgroundColor: '#10B981', borderColor: '#34D399' }
                          : { backgroundColor: theme.pillBg, borderColor: theme.cardBorder },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: s13ServiceYear === yr ? '#090D16' : theme.textSecondary,
                        }}
                      >
                        {yr === 'all' ? '📑 Ciclos 2027 + 2026 (Completo)' : `📅 Ciclo Operacional ${yr}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleDownloadS13PDF}
                disabled={generatingPdf}
                style={styles.s13DownloadBtn}
              >
                {generatingPdf ? (
                  <ActivityIndicator size="small" color="#090D16" />
                ) : (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#090D16' }}>
                      🖨️ Baixar PDF Multi-Ciclo
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#064E3B' }}>
                      4 Colunas Tabulares
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Territory Multi-Cycle Grid Cards */}
            <View style={styles.territoryGrid}>
              {territoryRegistry
                .filter((t) => {
                  if (selectedGroup === 'ALL') return true;
                  const tMeta = (t.meta || {}) as Record<string, any>;
                  const history = (tMeta.assignmentHistory || []) as Array<{
                    assignedTo: string;
                  }>;
                  return history.some(
                    (c) =>
                      findParticipantProfile(c.assignedTo, activeDirectory)?.groupTag ===
                      selectedGroup
                  );
                })
                .map((t, idx) => {
                  const tMeta = (t.meta || {}) as Record<string, any>;
                  const code = tMeta.territoryNumber || t.key;
                  const locality = tMeta.locality || t.label;
                  const history = (tMeta.assignmentHistory || []) as Array<{
                    assignedTo: string;
                    assignedAt: string;
                    completedAt?: string;
                    serviceYear?: number;
                  }>;
                  const filteredCycles =
                    s13ServiceYear === 'all'
                      ? history
                      : history.filter((c) => String(c.serviceYear) === s13ServiceYear);

                  const latest = history[history.length - 1];
                  const isOpen = Boolean(latest && !latest.completedAt);

                  return (
                    <View
                      key={t.key}
                      style={[
                        styles.territoryCard,
                        {
                          backgroundColor: theme.cardBg,
                          borderColor: isOpen ? '#10B981' : theme.cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.territoryHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={styles.territoryCodeBadge}>
                            <Text style={styles.territoryCodeText}>{code}</Text>
                          </View>
                          <View>
                            <Text style={[styles.territoryLocality, { color: theme.textPrimary }]}>
                              {locality}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>
                              Última conclusão prévia: {tMeta.lastCompletedBeforeYear || '-'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={[
                              styles.statusPill,
                              isOpen
                                ? { backgroundColor: 'rgba(16, 185, 129, 0.18)', borderColor: '#10B981' }
                                : { backgroundColor: 'rgba(148, 163, 184, 0.15)', borderColor: '#64748B' },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: isOpen ? '#34D399' : theme.textSecondary,
                              }}
                            >
                              {isOpen ? `🟢 Em campo: ${latest?.assignedTo}` : '✅ Concluído'}
                            </Text>
                          </View>

                          <Pressable
                            onPress={() => {
                              setWaTargetTerritoryIdx(idx);
                              setWaMode('territory_assignment');
                              setShowWhatsAppModal(true);
                            }}
                            style={styles.territoryWaBtn}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>
                              📲 WhatsApp
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* 4-Column Cycle Preview Strip */}
                      <View style={styles.cyclesGrid}>
                        {filteredCycles.map((cyc, cIdx) => {
                          const grp = findParticipantProfile(
                            cyc.assignedTo,
                            activeDirectory
                          )?.groupTag;
                          return (
                            <View
                              key={`${t.key}-c-${cIdx}`}
                              style={[
                                styles.cycleCell,
                                {
                                  backgroundColor: sunlightMode ? '#FFFFFF' : '#090D16',
                                  borderColor: !cyc.completedAt ? '#10B981' : theme.cardBorder,
                                },
                              ]}
                            >
                              <View
                                style={{
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  marginBottom: 2,
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '800', color: theme.accent }}>
                                  Ano {cyc.serviceYear || 2026}
                                </Text>
                                {grp && (
                                  <Text style={{ fontSize: 10, color: '#60A5FA', fontWeight: '700' }}>
                                    {grp}
                                  </Text>
                                )}
                              </View>
                              <Text
                                numberOfLines={1}
                                style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary }}
                              >
                                {cyc.assignedTo}
                              </Text>
                              <View style={styles.cycleDatesRow}>
                                <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                                  Início: {cyc.assignedAt}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '700',
                                    color: cyc.completedAt ? theme.textMuted : '#10B981',
                                  }}
                                >
                                  {cyc.completedAt ? `Fim: ${cyc.completedAt}` : 'Em aberto'}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ================================================================= */}
      {/* MODAL 1: WHATSAPP EXPORT STUDIO (5 MODES)                         */}
      {/* ================================================================= */}
      <Modal visible={showWhatsAppModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>📲 Estúdio de Exportação para WhatsApp</Text>
                <Text style={styles.modalSubtitle}>
                  Mensagens estruturadas prontas para grupos ou envio individual com 1 toque
                </Text>
              </View>
              <Pressable onPress={() => setShowWhatsAppModal(false)} style={styles.closeModalBtn}>
                <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '800' }}>✕</Text>
              </Pressable>
            </View>

            {/* 5 Mode Selector Tabs */}
            <View style={styles.waModeTabs}>
              {(
                [
                  { id: 'full_week', label: '📋 Quadro Semanal' },
                  { id: 'group_filter', label: '👥 Por Grupo (1/2/3)' },
                  { id: 'individual_card', label: '🎯 Ficha Individual' },
                  { id: 'live_pocket', label: '⏱️ Ao Vivo (19:30)' },
                  { id: 'territory_assignment', label: '🗺️ Território' },
                ] as const
              ).map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setWaMode(tab.id)}
                  style={[
                    styles.waModeTab,
                    waMode === tab.id && { backgroundColor: '#10B981', borderColor: '#34D399' },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: waMode === tab.id ? '#090D16' : '#CBD5E1',
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Context Controls per Mode */}
            {waMode === 'group_filter' && (
              <View style={styles.waContextSubBar}>
                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700' }}>
                  Escolher Grupo:
                </Text>
                {operationalGroups.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setWaTargetGroup(g)}
                    style={[
                      styles.smallContextPill,
                      waTargetGroup === g && { backgroundColor: '#3B82F6', borderColor: '#60A5FA' },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>{g}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {waMode === 'individual_card' && currentSession && (
              <View style={styles.waContextSubBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {currentSession.sections.flatMap((s) => s.slots).map((sl) => (
                      <Pressable
                        key={sl.key}
                        onPress={() => setWaTargetSlot(sl)}
                        style={[
                          styles.smallContextPill,
                          waTargetSlot?.key === sl.key && {
                            backgroundColor: '#FFB800',
                            borderColor: '#FDE047',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: waTargetSlot?.key === sl.key ? '#090D16' : '#E2E8F0',
                          }}
                        >
                          {sl.label.slice(0, 24)}...
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Pressable
                    onPress={() => setWaTargetRole('primary')}
                    style={[
                      styles.smallContextPill,
                      waTargetRole === 'primary' && { backgroundColor: '#3B82F6' },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>
                      👤 Enviar ao Titular
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setWaTargetRole('assistant')}
                    style={[
                      styles.smallContextPill,
                      waTargetRole === 'assistant' && { backgroundColor: '#3B82F6' },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>
                      🤝 Enviar ao Ajudante
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {waMode === 'live_pocket' && (
              <View style={styles.waContextSubBar}>
                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700' }}>
                  Horário de Início:
                </Text>
                {['19:00', '19:30', '20:00'].map((tm) => (
                  <Pressable
                    key={tm}
                    onPress={() => setWaStartTime(tm)}
                    style={[
                      styles.smallContextPill,
                      waStartTime === tm && { backgroundColor: '#3B82F6' },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{tm}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {waMode === 'territory_assignment' && (
              <View style={styles.waContextSubBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {territoryRegistry.map((tr, tIdx) => {
                      const code = (tr.meta as any)?.territoryNumber || tr.key;
                      return (
                        <Pressable
                          key={tr.key}
                          onPress={() => setWaTargetTerritoryIdx(tIdx)}
                          style={[
                            styles.smallContextPill,
                            waTargetTerritoryIdx === tIdx && { backgroundColor: '#10B981' },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '800',
                              color: waTargetTerritoryIdx === tIdx ? '#090D16' : '#FFF',
                            }}
                          >
                            {code}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* WhatsApp Bubble Preview */}
            <ScrollView style={styles.waPreviewScroll}>
              <View style={styles.waBubble}>
                <Text style={styles.waBubbleText}>{whatsappPreviewText}</Text>
              </View>
            </ScrollView>

            {copyFeedback && (
              <Text style={{ color: '#34D399', fontWeight: '800', fontSize: 13, marginBottom: 8 }}>
                {copyFeedback}
              </Text>
            )}

            <View style={styles.modalActionsRow}>
              <Pressable onPress={handleCopyWhatsAppMessage} style={styles.waCopyBtn}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#F8FAFC' }}>
                  📋 Copiar Mensagem Formatada
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleOpenWhatsAppExternal(whatsappPreviewText)}
                style={styles.waSendBtn}
              >
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#052E16' }}>
                  📲 Abrir no WhatsApp
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 2: "MEU COMPROMISSO" PARTICIPANT PICKER                     */}
      {/* ================================================================= */}
      <Modal visible={showParticipantPicker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>🎯 Selecionar Meu Nome</Text>
                <Text style={styles.modalSubtitle}>
                  Filtra instantaneamente suas designações e territórios nas semanas carregadas
                </Text>
              </View>
              <Pressable
                onPress={() => setShowParticipantPicker(false)}
                style={styles.closeModalBtn}
              >
                <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '800' }}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              value={participantSearch}
              onChangeText={setParticipantSearch}
              placeholder="Buscar por nome ou grupo (ex: Grupo 1, Alex, Assunção)..."
              placeholderTextColor="#64748B"
              style={styles.searchInput}
            />

            <ScrollView style={{ maxHeight: 360 }}>
              <View style={{ gap: 6 }}>
                {filteredParticipants.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => handleSelectMyParticipant(p.name)}
                    style={[
                      styles.participantRow,
                      myParticipantName === p.name && {
                        borderColor: '#FFB800',
                        backgroundColor: 'rgba(255, 184, 0, 0.14)',
                      },
                    ]}
                  >
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#F8FAFC' }}>
                        {p.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                        {p.capabilityTags.join(' • ')}
                      </Text>
                    </View>
                    <View style={styles.groupTagBadge}>
                      <Text style={styles.groupTagText}>{p.groupTag}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 3: PASTE / IMPORT SCHEDULE TEXT                             */}
      {/* ================================================================= */}
      <Modal visible={showImportModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>📥 Colar Programação (Texto de PDF)</Text>
                <Text style={styles.modalSubtitle}>
                  Cole o texto copiado de qualquer PDF de programação para compilar na estrutura agnóstica do Sekundo
                </Text>
              </View>
              <Pressable onPress={() => setShowImportModal(false)} style={styles.closeModalBtn}>
                <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '800' }}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              value={customScheduleText}
              onChangeText={setCustomScheduleText}
              multiline
              numberOfLines={10}
              placeholder="Exemplo:\n9 de outubro de 2026 | MÓDULO 01 Presidente Mônica Azevedo\nBLOCO 1 — FUNDAMENTOS E ANÁLISE\n1. Abertura Temática e Diretrizes (10 mins.) Caio Cavalcanti..."
              placeholderTextColor="#64748B"
              style={[styles.searchInput, { minHeight: 200, textAlignVertical: 'top' }]}
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => setShowImportModal(false)}
                style={[styles.waCopyBtn, { backgroundColor: '#334155' }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#E2E8F0' }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleImportCustomText} style={styles.waSendBtn}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#052E16' }}>
                  ⚡ Compilar e Carregar Programação
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 64,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backText: {
    fontSize: 14,
    fontWeight: '800',
  },
  topRightActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  topPillButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  heroCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 14,
  },
  heroBadge: {
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  whatsappMainCTA: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  whatsappMainCTAText: {
    color: '#052E16',
    fontSize: 14,
    fontWeight: '900',
  },
  whatsappMainCTASub: {
    color: '#064E3B',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBanner: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBannerText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  rehearsalBar: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  rehearsalClock: {
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  rehearsalControlBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rehearsalControlText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  filterCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  myCommitmentButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  clearFilterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  groupPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  groupPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  groupWhatsAppQuickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  mySummaryBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 184, 0, 0.3)',
  },
  mySummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFB800',
  },
  mySummaryChip: {
    backgroundColor: '#0F172A',
    borderColor: '#FFB800',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 180,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 14,
    gap: 16,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  weekSelectorScroll: {
    marginBottom: 14,
  },
  weekSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  weekPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 145,
  },
  sessionHeaderCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  sessionDateTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sessionMetaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  metaChipLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  metaChipValue: {
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '800',
  },
  secondaryActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionBlock: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  sectionBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionBannerCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  cueStrip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  slotsList: {
    padding: 12,
    gap: 10,
  },
  slotCard: {
    borderRadius: 12,
    borderLeftWidth: 5,
    padding: 14,
  },
  slotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  slotTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  durationBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  assigneesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  personRoleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  personName: {
    fontSize: 14,
    fontWeight: '800',
  },
  groupTagBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: '#3B82F6',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  groupTagText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
  },
  slotActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.12)',
  },
  slotActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  sessionFooterCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  s13HeaderCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  s13DownloadBtn: {
    backgroundColor: '#FFB800',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  territoryGrid: {
    gap: 12,
  },
  territoryCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  territoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  territoryCodeBadge: {
    backgroundColor: '#1E293B',
    borderColor: '#FFB800',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  territoryCodeText: {
    color: '#FFB800',
    fontSize: 13,
    fontWeight: '900',
  },
  territoryLocality: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  territoryWaBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  cyclesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cycleCell: {
    width: 215,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cycleDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
  },
  waModeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  waModeTab: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  waContextSubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#090D16',
    borderRadius: 10,
  },
  smallContextPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  waPreviewScroll: {
    maxHeight: 310,
    backgroundColor: '#0B141A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  waBubble: {
    backgroundColor: '#005C4B',
    borderRadius: 12,
    padding: 14,
  },
  waBubbleText: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  waCopyBtn: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  waSendBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  searchInput: {
    backgroundColor: '#090D16',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 12,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#090D16',
  },
});
