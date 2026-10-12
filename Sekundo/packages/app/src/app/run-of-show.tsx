/**
 * Page: run-of-show.tsx — Sekundo
 *
 * Mesa de Corte e Régie em Tempo Real (Live Production Run-of-Show)
 *
 * Implementa:
 * 1. Cronômetro de precisão ao segundo com relógio de estúdio.
 * 2. Cálculo dinâmico de derrapagem cumulativa (Cumulative Drift Δ = Σ(Actual - Planned)).
 * 3. Proteção inegociável de âncoras HARD_OUT com lista de corte sugerida (Pad Buffers).
 * 4. Máquina de estados de talentos e disparadores técnicos (STANDBY, GO!, WRAP).
 *
 * Skills: agency-realtime-collaboration-engineer, agency-frontend-developer, agency-ui-designer
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { useSkeleton } from '../hooks/useSkeleton';
import * as storage from '../storage/localStorage';
import type {
  RunOfShowNodeMeta,
  TimingConstraint,
  TalentStatus,
} from '@sekundo/core';

interface CueItem {
  id: string;
  pathKey: string;
  title: string;
  plannedSec: number;
  actualSec?: number;
  status: 'PENDING' | 'STANDBY' | 'ON_AIR' | 'DONE';
  timingConstraint: TimingConstraint;
  isPadBuffer: boolean;
  talentName?: string;
  talentStatus: TalentStatus;
  audioCue?: string;
  videoCue?: string;
  lightingCue?: string;
}

export default function RunOfShowConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';

  const { events } = useLocalEvent();
  const { flatRegistry } = useSkeleton(eventId);
  const currentEvent = events.find((e) => e.config.id === eventId);

  // Live wall-clock time
  const [wallClock, setWallClock] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setWallClock(now.toTimeString().slice(0, 8));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live segment execution state
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [segmentElapsedSec, setSegmentElapsedSec] = useState<number>(0);
  const [isLiveRunning, setIsLiveRunning] = useState<boolean>(false);

  // Cues state
  const [cues, setCues] = useState<CueItem[]>([]);

  // Initialize cues from skeleton flatRegistry or default run sheet
  useEffect(() => {
    async function initCues() {
      if (!eventId) return;
      const savedROS = await storage.loadRunOfShow<CueItem[]>(eventId);
      if (savedROS && Array.isArray(savedROS) && savedROS.length > 0) {
        setCues(savedROS);
        return;
      }

      // Build from flat registry if available
      if (flatRegistry.length > 0) {
        const built: CueItem[] = flatRegistry
          .filter((n) => n.type === 'slot' || n.type === 'header')
          .map((n, idx) => {
            const meta = (n.meta || {}) as Record<string, any>;
            const plannedSec = typeof meta.plannedDurationSec === 'number' ? meta.plannedDurationSec : 300;
            return {
              id: n.key,
              pathKey: n.key,
              title: n.label || n.value || `Segmento ${n.key}`,
              plannedSec,
              actualSec: typeof meta.actualDurationSec === 'number' ? meta.actualDurationSec : undefined,
              status: idx === 0 ? 'STANDBY' : 'PENDING',
              timingConstraint: (meta.timingConstraint as TimingConstraint) || (idx === flatRegistry.length - 1 ? 'HARD_OUT' : 'SOFT_START'),
              isPadBuffer: Boolean(meta.isPadBuffer) || idx === 3,
              talentName: n.value || 'Apresentador',
              talentStatus: 'GREEN_ROOM_CALL',
              audioCue: meta.audioCue || 'BGM Play',
              videoCue: meta.videoCue || 'Slide Intro',
              lightingCue: meta.lightingCue || 'Preset Palco',
            };
          });
        setCues(built);
      } else {
        // Default broadcast rundown sample
        setCues([
          {
            id: 'cue-01',
            pathKey: '01.01',
            title: 'Abertura & Cântico Inicial',
            plannedSec: 300,
            status: 'STANDBY',
            timingConstraint: 'HARD_START',
            isPadBuffer: false,
            talentName: 'Presidente do Evento',
            talentStatus: 'STANDBY_WINGS',
            audioCue: 'Microfone 1 Aberto / BGM Fade Out',
            videoCue: 'Câmera 1 (Plano Geral)',
            lightingCue: 'Iluminação Frontal 80%',
          },
          {
            id: 'cue-02',
            pathKey: '01.02',
            title: 'Discurso de Boas-Vindas & Objetivos',
            plannedSec: 600,
            status: 'PENDING',
            timingConstraint: 'SOFT_START',
            isPadBuffer: false,
            talentName: 'Orador Principal',
            talentStatus: 'GREEN_ROOM_CALL',
            audioCue: 'Microfone Lapela 2',
            videoCue: 'Slides Apresentação',
            lightingCue: 'Foco Púlpito 100%',
          },
          {
            id: 'cue-03',
            pathKey: '01.03',
            title: 'Exibição de Vídeo Institucional',
            plannedSec: 240,
            status: 'PENDING',
            timingConstraint: 'SOFT_START',
            isPadBuffer: true,
            talentName: 'Cabine de Vídeo',
            talentStatus: 'OFF_STAGE',
            audioCue: 'Áudio HDMI / Linha Estéreo',
            videoCue: 'Vídeo VT-01 (4K)',
            lightingCue: 'Blackout Meia-Luz',
          },
          {
            id: 'cue-04',
            pathKey: '01.04',
            title: 'Painel de Discussão & Encerramento',
            plannedSec: 480,
            status: 'PENDING',
            timingConstraint: 'HARD_OUT',
            isPadBuffer: false,
            talentName: 'Todos os Participantes',
            talentStatus: 'GREEN_ROOM_CALL',
            audioCue: 'Mics 1, 2 e 3 Ativos',
            videoCue: 'Câmera 2 (Mesa)',
            lightingCue: 'Luz Plena Auditório',
          },
        ]);
      }
    }
    initCues();
  }, [eventId, flatRegistry]);

  // Live timer tick for active segment
  useEffect(() => {
    let interval: any = null;
    if (isLiveRunning && activeCueId) {
      interval = setInterval(() => {
        setSegmentElapsedSec((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLiveRunning, activeCueId]);

  // Save cues changes
  const saveCues = async (updated: CueItem[]) => {
    setCues(updated);
    if (eventId) {
      await storage.saveRunOfShow(eventId, updated);
    }
  };

  // Math: Cumulative Timing Drift calculation
  const metrics = useMemo(() => {
    let totalPlanned = 0;
    let totalActual = 0;
    let cumulativeDrift = 0;
    let hardOutThreatened = false;
    const cutListKeys: string[] = [];

    for (const cue of cues) {
      totalPlanned += cue.plannedSec;
      if (cue.status === 'DONE' && cue.actualSec !== undefined) {
        totalActual += cue.actualSec;
        cumulativeDrift += cue.actualSec - cue.plannedSec;
      } else if (cue.id === activeCueId) {
        totalActual += Math.max(cue.plannedSec, segmentElapsedSec);
        if (segmentElapsedSec > cue.plannedSec) {
          cumulativeDrift += segmentElapsedSec - cue.plannedSec;
        }
      } else {
        totalActual += cue.plannedSec;
      }

      if (cue.timingConstraint === 'HARD_OUT' && cumulativeDrift > 0) {
        hardOutThreatened = true;
      }

      if (cue.isPadBuffer && cumulativeDrift > 0 && cue.status !== 'DONE') {
        cutListKeys.push(cue.pathKey);
      }
    }

    return {
      totalPlanned,
      totalActual,
      cumulativeDrift,
      hardOutThreatened,
      cutListKeys,
    };
  }, [cues, activeCueId, segmentElapsedSec]);

  // Helper formatting mm:ss
  const formatSeconds = (totalSec: number) => {
    const isNeg = totalSec < 0;
    const abs = Math.abs(totalSec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    const str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return isNeg ? `-${str}` : str;
  };

  // Trigger: STANDBY Cue
  const handleStandby = (cueId: string) => {
    const updated = cues.map((c) => {
      if (c.id === cueId) {
        return {
          ...c,
          status: 'STANDBY' as const,
          talentStatus: 'STANDBY_WINGS' as const,
        };
      }
      return c;
    });
    saveCues(updated);
  };

  // Trigger: GO! (Takes cue on air)
  const handleGo = (cueId: string) => {
    // If another cue was on air, mark it done
    const updated = cues.map((c) => {
      if (c.id === activeCueId && c.id !== cueId) {
        return {
          ...c,
          status: 'DONE' as const,
          actualSec: segmentElapsedSec,
          talentStatus: 'OFF_STAGE' as const,
        };
      }
      if (c.id === cueId) {
        return {
          ...c,
          status: 'ON_AIR' as const,
          talentStatus: 'ON_STAGE' as const,
        };
      }
      return c;
    });

    setActiveCueId(cueId);
    setSegmentElapsedSec(0);
    setIsLiveRunning(true);
    saveCues(updated);
  };

  // Trigger: STOP / ADVANCE
  const handleStopActive = () => {
    if (!activeCueId) return;
    const updated = cues.map((c) => {
      if (c.id === activeCueId) {
        return {
          ...c,
          status: 'DONE' as const,
          actualSec: segmentElapsedSec,
          talentStatus: 'OFF_STAGE' as const,
        };
      }
      return c;
    });

    setActiveCueId(null);
    setSegmentElapsedSec(0);
    setIsLiveRunning(false);
    saveCues(updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Studio Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Voltar</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Mesa de Corte & Régie (Run-of-Show)</Text>
            <Text style={styles.headerSubtitle}>
              {currentEvent ? currentEvent.config.name : 'Sekundo Precision Studio'}
            </Text>
          </View>
        </View>

        {/* Studio Wall Clock */}
        <View style={styles.clockContainer}>
          <Text style={styles.clockLabel}>RELÓGIO DE ESTÚDIO (HORA LOCAL)</Text>
          <Text style={styles.clockValue}>{wallClock}</Text>
        </View>
      </View>

      {/* Broadcast Telemetry Strip */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>TEMPO PLANEJADO</Text>
          <Text style={styles.telemetryValue}>{formatSeconds(metrics.totalPlanned)}</Text>
        </View>

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>TEMPO PROJETADO</Text>
          <Text style={styles.telemetryValue}>{formatSeconds(metrics.totalActual)}</Text>
        </View>

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>DESVIO CUMULATIVO (DRIFT Δ)</Text>
          <View
            style={[
              styles.driftBadge,
              metrics.cumulativeDrift > 0
                ? styles.driftBadgeLate
                : metrics.cumulativeDrift < 0
                ? styles.driftBadgeEarly
                : styles.driftBadgeExact,
            ]}
          >
            <Text style={styles.driftBadgeText}>
              {metrics.cumulativeDrift > 0
                ? `+${metrics.cumulativeDrift}s ATRASADO`
                : metrics.cumulativeDrift < 0
                ? `${metrics.cumulativeDrift}s ADIANTADO`
                : '0s NO HORÁRIO'}
            </Text>
          </View>
        </View>

        {/* Active Cue Timer */}
        {activeCueId && (
          <View style={styles.activeCueTimerBox}>
            <Text style={styles.activeCueTimerLabel}>🔴 NO AR (ON AIR):</Text>
            <Text style={styles.activeCueTimerValue}>{formatSeconds(segmentElapsedSec)}</Text>
          </View>
        )}
      </View>

      {/* Hard Out Warning Banner */}
      {metrics.hardOutThreatened && (
        <View style={styles.hardOutBanner}>
          <Text style={styles.hardOutTitle}>⚠️ ALERTA: ÂNCORA HARD_OUT COMPROMETIDA!</Text>
          <Text style={styles.hardOutDesc}>
            O evento está acumulando atraso (+{metrics.cumulativeDrift}s). Sugestão de corte elástico:{' '}
            <Text style={{ fontWeight: '700' }}>
              {metrics.cutListKeys.length > 0 ? metrics.cutListKeys.join(', ') : 'Nenhum Pad Buffer configurado.'}
            </Text>
          </Text>
        </View>
      )}

      {/* Cue Sheet Table */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.cuesWrapper}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 1.2 }]}>CUE / SEGMENTO</Text>
            <Text style={[styles.thText, { flex: 0.8 }]}>DURAÇÃO</Text>
            <Text style={[styles.thText, { flex: 1.2 }]}>TÉCNICA (ÁUDIO/VÍDEO/LUZ)</Text>
            <Text style={[styles.thText, { flex: 1.2 }]}>TALENTO / STATUS</Text>
            <Text style={[styles.thText, { flex: 1.2, textAlign: 'right' }]}>DISPARO (RÉGIE)</Text>
          </View>

          {cues.map((cue) => {
            const isCurrentOnAir = cue.id === activeCueId;
            return (
              <View
                key={cue.id}
                style={[
                  styles.cueRow,
                  isCurrentOnAir && styles.cueRowOnAir,
                  cue.status === 'DONE' && styles.cueRowDone,
                ]}
              >
                {/* Cue Title & Hierarchy */}
                <View style={{ flex: 1.2 }}>
                  <View style={styles.keyTagRow}>
                    <Text style={styles.pathKeyText}>{cue.pathKey}</Text>
                    {cue.timingConstraint === 'HARD_OUT' && (
                      <View style={styles.hardBadge}>
                        <Text style={styles.hardBadgeText}>HARD OUT</Text>
                      </View>
                    )}
                    {cue.isPadBuffer && (
                      <View style={styles.padBadge}>
                        <Text style={styles.padBadgeText}>PAD BUFFER</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cueTitle}>{cue.title}</Text>
                </View>

                {/* Duration */}
                <View style={{ flex: 0.8 }}>
                  <Text style={styles.durationPlanned}>Plano: {formatSeconds(cue.plannedSec)}</Text>
                  {cue.actualSec !== undefined && (
                    <Text
                      style={[
                        styles.durationActual,
                        cue.actualSec > cue.plannedSec ? styles.durationLate : styles.durationEarly,
                      ]}
                    >
                      Real: {formatSeconds(cue.actualSec)} ({cue.actualSec - cue.plannedSec > 0 ? `+${cue.actualSec - cue.plannedSec}s` : `${cue.actualSec - cue.plannedSec}s`})
                    </Text>
                  )}
                  {isCurrentOnAir && (
                    <Text style={styles.durationLive}>Ao Vivo: {formatSeconds(segmentElapsedSec)}</Text>
                  )}
                </View>

                {/* Technical Cues */}
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.techText}>🔊 {cue.audioCue}</Text>
                  <Text style={styles.techText}>📺 {cue.videoCue}</Text>
                  <Text style={styles.techText}>💡 {cue.lightingCue}</Text>
                </View>

                {/* Talent & Presence */}
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.talentName}>{cue.talentName}</Text>
                  <View style={styles.talentStatusBadge}>
                    <Text style={styles.talentStatusText}>{cue.talentStatus}</Text>
                  </View>
                </View>

                {/* Show Caller Actions */}
                <View style={{ flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                  {cue.status !== 'DONE' && !isCurrentOnAir && (
                    <Pressable
                      onPress={() => handleStandby(cue.id)}
                      style={[
                        styles.standbyBtn,
                        cue.status === 'STANDBY' && styles.standbyBtnActive,
                      ]}
                    >
                      <Text style={styles.standbyBtnText}>STANDBY</Text>
                    </Pressable>
                  )}

                  {!isCurrentOnAir && cue.status !== 'DONE' && (
                    <Pressable onPress={() => handleGo(cue.id)} style={styles.goBtn}>
                      <Text style={styles.goBtnText}>GO!</Text>
                    </Pressable>
                  )}

                  {isCurrentOnAir && (
                    <Pressable onPress={handleStopActive} style={styles.stopBtn}>
                      <Text style={styles.stopBtnText}>WRAP / NEXT</Text>
                    </Pressable>
                  )}

                  {cue.status === 'DONE' && (
                    <View style={styles.doneBadge}>
                      <Text style={styles.doneBadgeText}>CONCLUÍDO ✅</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  clockContainer: {
    backgroundColor: '#020617',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'flex-end',
  },
  clockLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clockValue: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 24,
  },
  telemetryItem: {
    flexDirection: 'column',
  },
  telemetryLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  telemetryValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  driftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  driftBadgeLate: {
    backgroundColor: '#EF4444',
  },
  driftBadgeEarly: {
    backgroundColor: '#10B981',
  },
  driftBadgeExact: {
    backgroundColor: '#3B82F6',
  },
  driftBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  activeCueTimerBox: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  activeCueTimerLabel: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  activeCueTimerValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  hardOutBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  hardOutTitle: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  hardOutDesc: {
    color: '#FCA5A5',
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
  },
  cuesWrapper: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  thText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  cueRowOnAir: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  cueRowDone: {
    opacity: 0.6,
  },
  keyTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pathKeyText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  hardBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hardBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  padBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  padBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
  },
  cueTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  durationPlanned: {
    color: '#94A3B8',
    fontSize: 12,
  },
  durationActual: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  durationLate: {
    color: '#EF4444',
  },
  durationEarly: {
    color: '#10B981',
  },
  durationLive: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  techText: {
    color: '#CBD5E1',
    fontSize: 11,
    marginVertical: 1,
  },
  talentName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  talentStatusBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  talentStatusText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  standbyBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  standbyBtnActive: {
    backgroundColor: '#F59E0B',
  },
  standbyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  goBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  goBtnText: {
    color: '#022C22',
    fontSize: 12,
    fontWeight: '900',
  },
  stopBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  stopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  doneBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  doneBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
});
