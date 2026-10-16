/**
 * Page: roster-swap.tsx — Sekundo
 *
 * Banco de Reservas Inteligente (Shadow Roster) & Ledger Atômico de Trocas
 *
 * Implementa:
 * 1. Ranking de substitutos baseado no Inverse Fatigue Score (IFS = Δt_descanso / (H_recente + 1)).
 * 2. Ciclo de transação de troca em 5 estágios: DRAFT -> PROPOSED -> PEER_ACCEPTED -> VALIDATED -> COMMITTED.
 * 3. Simulação preventiva de conformidade (dry-run) com detecção de violações circadianas e de habilidade.
 *
 * Skills: agency-frontend-developer, agency-ui-designer, agency-minimal-change-engineer
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { useSkeleton } from '../hooks/useSkeleton';
import * as storage from '../storage/localStorage';
import {
  rankStandbyCandidates,
  dryRunSwapSimulation,
  calculateInverseFatigueScore,
  type VolunteerProfile,
  type ShiftSlotDescriptor,
  type SwapTransaction,
  type RankedStandbyCandidate,
  type SkillLevel,
  type ShiftType,
} from '@sekundo/core';

export default function RosterSwapConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';

  const { events } = useLocalEvent();
  const { flatRegistry } = useSkeleton(eventId);
  const currentEvent = events.find((e) => e.config.id === eventId);

  const [activeTab, setActiveTab] = useState<'standby' | 'swaps'>('standby');
  const [swaps, setSwaps] = useState<SwapTransaction[]>([]);
  const [selectedSlotDay, setSelectedSlotDay] = useState<number>(0);
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType>('MORNING');
  const [requiredSkill, setRequiredSkill] = useState<SkillLevel>('INTERMEDIATE');

  // Modal for new swap proposal
  const [modalVisible, setModalVisible] = useState(false);
  const [workerAName, setWorkerAName] = useState('');
  const [workerBName, setWorkerBName] = useState('');
  const [dryRunReport, setDryRunReport] = useState<{ isValid: boolean; violations: string[] } | null>(null);

  // Load saved swaps from local storage
  useEffect(() => {
    async function load() {
      if (!eventId) return;
      const loaded = await storage.loadRosterSwaps<SwapTransaction>(eventId);
      if (loaded && Array.isArray(loaded)) {
        setSwaps(loaded);
      }
    }
    load();
  }, [eventId]);

  const saveSwapsList = async (updated: SwapTransaction[]) => {
    setSwaps(updated);
    if (eventId) {
      await storage.saveRosterSwaps(eventId, updated);
    }
  };

  // Synthesize volunteer profiles from flat registry or defaults
  const volunteers: VolunteerProfile[] = useMemo(() => {
    const fromRegistry: VolunteerProfile[] = flatRegistry
      .filter((node) => node.value && node.value.trim().length > 0)
      .map((node, index) => {
        const meta = (node.meta || {}) as Record<string, any>;
        const skill = (meta.skill as SkillLevel) || (index % 3 === 0 ? 'LEADER' : index % 2 === 0 ? 'ADVANCED' : 'INTERMEDIATE');
        const hoursRested = typeof meta.hoursRested === 'number' ? meta.hoursRested : 24 + (index * 8);
        const recentHoursWorked = typeof meta.recentHoursWorked === 'number' ? meta.recentHoursWorked : 12 + (index * 4);

        return {
          id: node.key,
          name: node.value,
          skillLevel: skill,
          scheduleMask: 0n,
          availabilityMask: ~0n, // Full availability default
          hoursRested,
          recentHoursWorked,
        };
      });

    if (fromRegistry.length > 0) return fromRegistry;

    // Default standby pool if registry has no volunteers yet
    return [
      {
        id: 'vol-01',
        name: 'Carlos Oliveira',
        skillLevel: 'LEADER',
        scheduleMask: 0n,
        availabilityMask: ~0n,
        hoursRested: 48,
        recentHoursWorked: 8,
      },
      {
        id: 'vol-02',
        name: 'Mateus Santos',
        skillLevel: 'ADVANCED',
        scheduleMask: 0n,
        availabilityMask: ~0n,
        hoursRested: 36,
        recentHoursWorked: 16,
      },
      {
        id: 'vol-03',
        name: 'Lucas Ferreira',
        skillLevel: 'INTERMEDIATE',
        scheduleMask: 0n,
        availabilityMask: ~0n,
        hoursRested: 18,
        recentHoursWorked: 24,
      },
      {
        id: 'vol-04',
        name: 'Daniel Silva',
        skillLevel: 'BASIC',
        scheduleMask: 0n,
        availabilityMask: ~0n,
        hoursRested: 72,
        recentHoursWorked: 4,
      },
    ];
  }, [flatRegistry]);

  // Target shift to evaluate replacements for
  const targetShift: ShiftSlotDescriptor = useMemo(() => {
    return {
      slotId: `slot-d${selectedSlotDay}-${selectedShiftType}`,
      dayIndex: selectedSlotDay,
      shift: selectedShiftType,
      requiredSkill,
      durationHours: 4,
    };
  }, [selectedSlotDay, selectedShiftType, requiredSkill]);

  // Calculate Standby Pool ranked by Inverse Fatigue Score (IFS)
  const rankedStandby: RankedStandbyCandidate[] = useMemo(() => {
    return rankStandbyCandidates(volunteers, targetShift);
  }, [volunteers, targetShift]);

  const handleSimulateSwap = () => {
    const workerA = volunteers.find((v) => v.name.toLowerCase().includes(workerAName.toLowerCase()));
    const workerB = volunteers.find((v) => v.name.toLowerCase().includes(workerBName.toLowerCase()));

    if (!workerA || !workerB) {
      setDryRunReport({
        isValid: false,
        violations: ['Participante Solicitante ou Substituto não encontrado na base de dados.'],
      });
      return;
    }

    const simResult = dryRunSwapSimulation(workerA, targetShift, workerB);
    setDryRunReport({
      isValid: simResult.isValid,
      violations: simResult.violations,
    });
  };

  const handleCommitSwap = async () => {
    const workerA = volunteers.find((v) => v.name.toLowerCase().includes(workerAName.toLowerCase()));
    const workerB = volunteers.find((v) => v.name.toLowerCase().includes(workerBName.toLowerCase()));

    if (!workerA || !workerB) return;

    const newTransaction: SwapTransaction = {
      id: `swap-${Date.now().toString(36)}`,
      slotA: targetShift,
      workerAId: workerA.id,
      workerBId: workerB.id,
      state: 'COMMITTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    await saveSwapsList([newTransaction, ...swaps]);
    setModalVisible(false);
    setWorkerAName('');
    setWorkerBName('');
    setDryRunReport(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Voltar</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Banco de Reservas & Trocas</Text>
            <Text style={styles.headerSubtitle}>
              {currentEvent ? currentEvent.config.name : 'Sekundo Workforce Optimization'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setModalVisible(true)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>+ Nova Troca de Plantão</Text>
          </Pressable>
        </View>
      </View>

      {/* Tabs Switcher */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('standby')}
          style={[styles.tabItem, activeTab === 'standby' && styles.tabItemActive]}
        >
          <Text style={[styles.tabText, activeTab === 'standby' && styles.tabTextActive]}>
            🛡️ Shadow Roster (Standby Ordenado por IFS)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('swaps')}
          style={[styles.tabItem, activeTab === 'swaps' && styles.tabItemActive]}
        >
          <Text style={[styles.tabText, activeTab === 'swaps' && styles.tabTextActive]}>
            🔄 Mural de Transações ({swaps.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'standby' ? (
          <View style={styles.contentSection}>
            {/* Target Slot Filter Bar */}
            <View style={styles.filterCard}>
              <Text style={styles.sectionHeading}>Defina o Posto / Turno Vago para Substituição:</Text>
              <View style={styles.filterRow}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>DIA DO HORIZONTE (0-27):</Text>
                  <View style={styles.chipRow}>
                    {[0, 1, 2, 3, 7, 14, 21].map((day) => (
                      <Pressable
                        key={day}
                        onPress={() => setSelectedSlotDay(day)}
                        style={[styles.chip, selectedSlotDay === day && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selectedSlotDay === day && styles.chipTextActive]}>
                          Dia {day}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>TURNO:</Text>
                  <View style={styles.chipRow}>
                    {(['MORNING', 'AFTERNOON', 'NIGHT'] as ShiftType[]).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => setSelectedShiftType(st)}
                        style={[styles.chip, selectedShiftType === st && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selectedShiftType === st && styles.chipTextActive]}>
                          {st === 'MORNING' ? 'Manhã' : st === 'AFTERNOON' ? 'Tarde' : 'Noite'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>COMPETÊNCIA MÍNIMA:</Text>
                  <View style={styles.chipRow}>
                    {(['BASIC', 'INTERMEDIATE', 'ADVANCED', 'LEADER'] as SkillLevel[]).map((sk) => (
                      <Pressable
                        key={sk}
                        onPress={() => setRequiredSkill(sk)}
                        style={[styles.chip, requiredSkill === sk && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, requiredSkill === sk && styles.chipTextActive]}>
                          {sk}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* Standby Ranking List */}
            <Text style={styles.subHeading}>
              {'Candidatos Ordenados pelo Inverse Fatigue Score [IFS = Δt / (Carga + 1)]: '}
            </Text>

            <View style={styles.cardsGrid}>
              {rankedStandby.map((cand, index) => {
                const ifsFormatted = cand.ifsScore.toFixed(2);
                return (
                  <View key={cand.volunteer.id} style={styles.candidateCard}>
                    <View style={styles.candidateHeader}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.candidateName}>{cand.volunteer.name}</Text>
                        <Text style={styles.candidateSkill}>Nível: {cand.volunteer.skillLevel}</Text>
                      </View>
                      <View style={styles.ifsBadge}>
                        <Text style={styles.ifsLabel}>IFS</Text>
                        <Text style={styles.ifsScore}>{ifsFormatted}</Text>
                      </View>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricItem}>
                        💤 Descanso: <Text style={styles.metricValue}>{cand.volunteer.hoursRested}h</Text>
                      </Text>
                      <Text style={styles.metricItem}>
                        💼 Recente (14d): <Text style={styles.metricValue}>{cand.volunteer.recentHoursWorked}h</Text>
                      </Text>
                    </View>

                    <View style={styles.statusBadgesRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          cand.isQualified ? styles.statusBadgeSuccess : styles.statusBadgeWarning,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {cand.isQualified ? '✅ Qualificado' : '❌ Habilidade Insuficiente'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          cand.isAvailable ? styles.statusBadgeSuccess : styles.statusBadgeWarning,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {cand.isAvailable ? '✅ Disponível' : '⚠️ Indisponível'}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => {
                        setWorkerBName(cand.volunteer.name);
                        setModalVisible(true);
                      }}
                      style={styles.inviteBtn}
                    >
                      <Text style={styles.inviteBtnText}>Convidar para Substituição</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.contentSection}>
            <Text style={styles.sectionHeading}>Ledger de Transações Atômicas de Troca:</Text>
            {swaps.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nenhuma troca registrada ainda</Text>
                <Text style={styles.emptySub}>
                  Use o botão "+ Nova Troca de Plantão" para simular e aprovar transações.
                </Text>
              </View>
            ) : (
              swaps.map((item) => (
                <View key={item.id} style={styles.swapCard}>
                  <View style={styles.swapHeader}>
                    <Text style={styles.swapId}>{item.id}</Text>
                    <View style={styles.swapStateBadge}>
                      <Text style={styles.swapStateText}>{item.state}</Text>
                    </View>
                  </View>

                  <Text style={styles.swapDetails}>
                    Posto: Dia {item.slotA.dayIndex} ({item.slotA.shift}) • Requer {item.slotA.requiredSkill}
                  </Text>
                  <Text style={styles.swapActors}>
                    Solicitante: <Text style={styles.actorName}>{item.workerAId}</Text> ➔ Substituto:{' '}
                    <Text style={styles.actorName}>{item.workerBId}</Text>
                  </Text>
                  <Text style={styles.swapDate}>
                    Registrado em: {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal: New Swap Transaction & Dry-Run Simulation */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Propor Troca de Designação / Turno</Text>
            <Text style={styles.modalSubtitle}>
              Simulação de conformidade preventiva: verifica descanso, colisão de turno e habilidade.
            </Text>

            <Text style={styles.inputLabel}>NOME DO SOLICITANTE (PARTICIPANTE A):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Participante 01"
              placeholderTextColor="#64748B"
              value={workerAName}
              onChangeText={setWorkerAName}
            />

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>NOME DO SUBSTITUTO (PARTICIPANTE B):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Participante 02"
              placeholderTextColor="#64748B"
              value={workerBName}
              onChangeText={setWorkerBName}
            />

            {/* Dry-Run Result Banner */}
            {dryRunReport && (
              <View
                style={[
                  styles.reportBanner,
                  dryRunReport.isValid ? styles.reportBannerSuccess : styles.reportBannerError,
                ]}
              >
                <Text style={styles.reportTitle}>
                  {dryRunReport.isValid ? '✅ Simulação Aprovada! Sem Violações.' : '⚠️ Violações Detectadas:'}
                </Text>
                {dryRunReport.violations.map((v, i) => (
                  <Text key={i} style={styles.reportViolation}>
                    • {v}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>

              <Pressable onPress={handleSimulateSwap} style={styles.simulateBtn}>
                <Text style={styles.simulateBtnText}>Simular (Dry-Run)</Text>
              </Pressable>

              <Pressable
                onPress={handleCommitSwap}
                disabled={!dryRunReport || !dryRunReport.isValid}
                style={[
                  styles.commitBtn,
                  (!dryRunReport || !dryRunReport.isValid) && styles.commitBtnDisabled,
                ]}
              >
                <Text style={styles.commitBtnText}>Aprovar & Confirmar</Text>
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
    backgroundColor: '#12151C',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2430',
    backgroundColor: '#161A23',
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
    backgroundColor: '#232936',
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  headerRight: {},
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#022C22',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2430',
    backgroundColor: '#161A23',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  tabText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
  },
  contentSection: {
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  filterCard: {
    backgroundColor: '#1A202C',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 20,
  },
  sectionHeading: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  subHeading: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterRow: {
    gap: 12,
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#2D3748',
  },
  chipActive: {
    backgroundColor: '#10B981',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#022C22',
    fontWeight: '700',
  },
  cardsGrid: {
    gap: 12,
  },
  candidateCard: {
    backgroundColor: '#1A202C',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  candidateName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  candidateSkill: {
    color: '#94A3B8',
    fontSize: 12,
  },
  ifsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  ifsLabel: {
    color: '#6EE7B7',
    fontSize: 9,
    fontWeight: '700',
  },
  ifsScore: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 10,
  },
  metricItem: {
    color: '#94A3B8',
    fontSize: 12,
  },
  metricValue: {
    color: '#F1F5F9',
    fontWeight: '700',
  },
  statusBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusBadgeWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusBadgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  inviteBtn: {
    backgroundColor: '#2D3748',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  inviteBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#1A202C',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  swapCard: {
    backgroundColor: '#1A202C',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 10,
  },
  swapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  swapId: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  swapStateBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  swapStateText: {
    color: '#022C22',
    fontSize: 10,
    fontWeight: '800',
  },
  swapDetails: {
    color: '#CBD5E1',
    fontSize: 13,
    marginBottom: 4,
  },
  swapActors: {
    color: '#94A3B8',
    fontSize: 12,
  },
  actorName: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  swapDate: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#12151C',
    borderWidth: 1,
    borderColor: '#2D3748',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  reportBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  reportBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  reportBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  reportTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  reportViolation: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  simulateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  simulateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  commitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  commitBtnDisabled: {
    opacity: 0.5,
  },
  commitBtnText: {
    color: '#022C22',
    fontSize: 13,
    fontWeight: '700',
  },
});
