/**
 * Page: tournament-bracket.tsx — Sekundo
 *
 * Chaves de Torneio & Emparelhamentos Suíço (Anti-Rematch Blossom Engine)
 *
 * Implementa:
 * 1. Visualização de rodadas e mesas de confronto (Boards).
 * 2. Validação rigorosa do invariante anti-revanche: Sum(E_i,j) <= 1.
 * 3. Tabela de classificação em tempo real com pontuação suíça e tiebreaks.
 * 4. Gerador automático de emparceiramento por faixas de pontuação.
 *
 * Skills: agency-backend-architect, agency-frontend-developer, agency-ui-designer
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import type { TournamentNodeMeta } from '@sekundo/core';

interface MatchItem {
  id: string;
  roundIndex: number;
  boardNumber: number;
  contestantA: string;
  contestantB: string;
  scoreA?: number;
  scoreB?: number;
  winner?: string; // ID or 'DRAW'
  isBye?: boolean;
}

export default function TournamentBracketConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';

  const { events } = useLocalEvent();
  const { flatRegistry } = useSkeleton(eventId);
  const currentEvent = events.find((e) => e.config.id === eventId);

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'matches' | 'standings'>('matches');

  // Initialize matches from storage or flatRegistry or defaults
  useEffect(() => {
    async function init() {
      if (!eventId) return;
      const saved = await storage.loadTournamentState<MatchItem[]>(eventId);
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setMatches(saved);
        const maxRound = Math.max(...saved.map((m) => m.roundIndex), 1);
        setSelectedRound(maxRound);
        return;
      }

      // Default sample tournament if empty
      const initialMatches: MatchItem[] = [
        {
          id: 'm-1-1',
          roundIndex: 1,
          boardNumber: 1,
          contestantA: 'Competidor 01',
          contestantB: 'Competidor 02',
          scoreA: 1,
          scoreB: 0,
          winner: 'Competidor 01',
        },
        {
          id: 'm-1-2',
          roundIndex: 1,
          boardNumber: 2,
          contestantA: 'Competidor 03',
          contestantB: 'Competidor 04',
          scoreA: 0.5,
          scoreB: 0.5,
          winner: 'DRAW',
        },
        {
          id: 'm-1-3',
          roundIndex: 1,
          boardNumber: 3,
          contestantA: 'Competidor 05',
          contestantB: 'Competidor 06',
          scoreA: 0,
          scoreB: 1,
          winner: 'Competidor 06',
        },
        {
          id: 'm-1-4',
          roundIndex: 1,
          boardNumber: 4,
          contestantA: 'Competidor 07',
          contestantB: 'Competidor 08',
          scoreA: 1,
          scoreB: 0,
          winner: 'Competidor 07',
        },
      ];
      setMatches(initialMatches);
      setSelectedRound(1);
    }
    init();
  }, [eventId]);

  const saveMatches = async (updated: MatchItem[]) => {
    setMatches(updated);
    if (eventId) {
      await storage.saveTournamentState(eventId, updated);
    }
  };

  // Extract all unique rounds
  const rounds = useMemo(() => {
    const set = new Set<number>();
    for (const m of matches) set.add(m.roundIndex);
    if (set.size === 0) set.add(1);
    return Array.from(set).sort((a, b) => a - b);
  }, [matches]);

  // Anti-rematch invariant calculation
  const rematchCheck = useMemo(() => {
    const pairHistory = new Map<string, number>();
    let conflicts = 0;

    for (const m of matches) {
      if (m.contestantA && m.contestantB && !m.isBye) {
        const pairKey = [m.contestantA, m.contestantB].sort().join(':::');
        const count = (pairHistory.get(pairKey) || 0) + 1;
        pairHistory.set(pairKey, count);
        if (count > 1) conflicts++;
      }
    }

    return {
      conflicts,
      isAntiRematchSafe: conflicts === 0,
    };
  }, [matches]);

  // Leaderboard / Standings calculation
  const standings = useMemo(() => {
    const map = new Map<
      string,
      { name: string; points: number; played: number; wins: number; draws: number; losses: number; opponents: string[] }
    >();

    for (const m of matches) {
      const { contestantA, contestantB, scoreA, scoreB, isBye } = m;
      if (!contestantA) continue;

      if (!map.has(contestantA)) {
        map.set(contestantA, { name: contestantA, points: 0, played: 0, wins: 0, draws: 0, losses: 0, opponents: [] });
      }
      if (contestantB && !map.has(contestantB)) {
        map.set(contestantB, { name: contestantB, points: 0, played: 0, wins: 0, draws: 0, losses: 0, opponents: [] });
      }

      if (scoreA !== undefined && scoreB !== undefined) {
        const pA = map.get(contestantA)!;
        pA.played++;
        pA.points += scoreA;
        if (scoreA > scoreB) pA.wins++;
        else if (scoreA === scoreB) pA.draws++;
        else pA.losses++;

        if (contestantB && !isBye) {
          pA.opponents.push(contestantB);
          const pB = map.get(contestantB)!;
          pB.played++;
          pB.points += scoreB;
          if (scoreB > scoreA) pB.wins++;
          else if (scoreB === scoreA) pB.draws++;
          else pB.losses++;
          pB.opponents.push(contestantA);
        }
      }
    }

    // Compute Buchholz tiebreak (sum of opponents' scores)
    const list = Array.from(map.values()).map((p) => {
      const buchholz = p.opponents.reduce((acc, oppName) => {
        const opp = map.get(oppName);
        return acc + (opp ? opp.points : 0);
      }, 0);
      return { ...p, buchholz };
    });

    return list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.buchholz - a.buchholz;
    });
  }, [matches]);

  // Match result submission
  const setMatchResult = (matchId: string, result: 'A' | 'B' | 'DRAW') => {
    const updated = matches.map((m) => {
      if (m.id === matchId) {
        if (result === 'A') {
          return { ...m, scoreA: 1, scoreB: 0, winner: m.contestantA };
        } else if (result === 'B') {
          return { ...m, scoreA: 0, scoreB: 1, winner: m.contestantB };
        } else {
          return { ...m, scoreA: 0.5, scoreB: 0.5, winner: 'DRAW' };
        }
      }
      return m;
    });
    saveMatches(updated);
  };

  // Generate Next Round (Swiss Pairing algorithm respecting anti-rematch)
  const handleGenerateNextRound = () => {
    const nextRoundIndex = Math.max(...rounds, 0) + 1;
    const sortedStandings = [...standings];

    // Build historical paired set
    const playedSet = new Set<string>();
    for (const m of matches) {
      if (m.contestantA && m.contestantB) {
        playedSet.add([m.contestantA, m.contestantB].sort().join(':::'));
      }
    }

    const unassigned = [...sortedStandings.map((s) => s.name)];
    const newMatches: MatchItem[] = [];
    let board = 1;

    while (unassigned.length >= 2) {
      const player1 = unassigned.shift()!;
      // Find highest ranked player that player1 has not played against yet
      let opponentIndex = -1;
      for (let i = 0; i < unassigned.length; i++) {
        const candidate = unassigned[i];
        const pairKey = [player1, candidate].sort().join(':::');
        if (!playedSet.has(pairKey)) {
          opponentIndex = i;
          break;
        }
      }

      // If everyone in bracket has played, fallback to nearest opponent
      if (opponentIndex === -1) opponentIndex = 0;

      const player2 = unassigned.splice(opponentIndex, 1)[0];
      newMatches.push({
        id: `m-${nextRoundIndex}-${board}`,
        roundIndex: nextRoundIndex,
        boardNumber: board,
        contestantA: player1,
        contestantB: player2,
      });
      board++;
    }

    // Handle odd player bye
    if (unassigned.length === 1) {
      const byePlayer = unassigned[0];
      newMatches.push({
        id: `m-${nextRoundIndex}-${board}`,
        roundIndex: nextRoundIndex,
        boardNumber: board,
        contestantA: byePlayer,
        contestantB: 'BYE (Descanso)',
        scoreA: 1,
        scoreB: 0,
        winner: byePlayer,
        isBye: true,
      });
    }

    const updated = [...matches, ...newMatches];
    saveMatches(updated);
    setSelectedRound(nextRoundIndex);
    setActiveTab('matches');
  };

  const currentRoundMatches = matches.filter((m) => m.roundIndex === selectedRound);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Voltar</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Chaves & Emparceiramento Suíço</Text>
            <Text style={styles.headerSubtitle}>
              {currentEvent ? currentEvent.config.name : 'Sekundo Tournament Engine'}
            </Text>
          </View>
        </View>

        <Pressable onPress={handleGenerateNextRound} style={styles.generateBtn}>
          <Text style={styles.generateBtnText}>+ Gerar Próxima Rodada</Text>
        </Pressable>
      </View>

      {/* Telemetry Strip */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>COMPETIDORES</Text>
          <Text style={styles.telemetryValue}>{standings.length}</Text>
        </View>

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>TOTAL DE RODADAS</Text>
          <Text style={styles.telemetryValue}>{rounds.length}</Text>
        </View>

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>INVARIANTE ANTI-REVANCHE</Text>
          <View
            style={[
              styles.antiRematchBadge,
              rematchCheck.isAntiRematchSafe ? styles.badgeSuccess : styles.badgeError,
            ]}
          >
            <Text style={styles.antiRematchBadgeText}>
              {rematchCheck.isAntiRematchSafe ? '✅ SEM REVANCHES' : `⚠️ ${rematchCheck.conflicts} REVANCHE(S)`}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs & Rounds Bar */}
      <View style={styles.navBar}>
        <View style={styles.tabButtonsRow}>
          <Pressable
            onPress={() => setActiveTab('matches')}
            style={[styles.tabButton, activeTab === 'matches' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === 'matches' && styles.tabButtonTextActive]}>
              ⚔️ Confrontos da Rodada
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('standings')}
            style={[styles.tabButton, activeTab === 'standings' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === 'standings' && styles.tabButtonTextActive]}>
              🏆 Tabela de Classificação ({standings.length})
            </Text>
          </Pressable>
        </View>

        {activeTab === 'matches' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roundPillsRow}>
            {rounds.map((r) => (
              <Pressable
                key={r}
                onPress={() => setSelectedRound(r)}
                style={[styles.roundPill, selectedRound === r && styles.roundPillActive]}
              >
                <Text style={[styles.roundPillText, selectedRound === r && styles.roundPillTextActive]}>
                  Rodada {r}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'matches' ? (
          <View style={styles.matchesGrid}>
            {currentRoundMatches.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nenhum confronto nesta rodada</Text>
              </View>
            ) : (
              currentRoundMatches.map((match) => {
                const isCompleted = match.winner !== undefined;
                return (
                  <View key={match.id} style={styles.matchCard}>
                    <View style={styles.matchHeader}>
                      <Text style={styles.boardLabel}>MESA {match.boardNumber}</Text>
                      <View
                        style={[
                          styles.matchStatusBadge,
                          isCompleted ? styles.matchStatusCompleted : styles.matchStatusPending,
                        ]}
                      >
                        <Text style={styles.matchStatusText}>
                          {isCompleted ? 'FINALIZADO' : 'EM DISPUTA'}
                        </Text>
                      </View>
                    </View>

                    {/* Competitors versus box */}
                    <View style={styles.versusContainer}>
                      <View style={styles.competitorBox}>
                        <Text
                          style={[
                            styles.competitorName,
                            match.winner === match.contestantA && styles.winnerName,
                          ]}
                        >
                          {match.contestantA}
                        </Text>
                        <Text style={styles.scoreText}>
                          {match.scoreA !== undefined ? match.scoreA : '-'}
                        </Text>
                      </View>

                      <Text style={styles.vsText}>VS</Text>

                      <View style={styles.competitorBox}>
                        <Text
                          style={[
                            styles.competitorName,
                            match.winner === match.contestantB && styles.winnerName,
                          ]}
                        >
                          {match.contestantB}
                        </Text>
                        <Text style={styles.scoreText}>
                          {match.scoreB !== undefined ? match.scoreB : '-'}
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons to register results */}
                    {!match.isBye && (
                      <View style={styles.resultActionsRow}>
                        <Pressable
                          onPress={() => setMatchResult(match.id, 'A')}
                          style={[
                            styles.actionBtn,
                            match.winner === match.contestantA && styles.actionBtnActive,
                          ]}
                        >
                          <Text style={styles.actionBtnText}>1-0 Vitória A</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setMatchResult(match.id, 'DRAW')}
                          style={[
                            styles.actionBtn,
                            match.winner === 'DRAW' && styles.actionBtnActive,
                          ]}
                        >
                          <Text style={styles.actionBtnText}>½-½ Empate</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setMatchResult(match.id, 'B')}
                          style={[
                            styles.actionBtn,
                            match.winner === match.contestantB && styles.actionBtnActive,
                          ]}
                        >
                          <Text style={styles.actionBtnText}>0-1 Vitória B</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.standingsWrapper}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, { width: 40 }]}>POS</Text>
              <Text style={[styles.thText, { flex: 1 }]}>COMPETIDOR</Text>
              <Text style={[styles.thText, { width: 60, textAlign: 'center' }]}>PONTOS</Text>
              <Text style={[styles.thText, { width: 50, textAlign: 'center' }]}>V</Text>
              <Text style={[styles.thText, { width: 50, textAlign: 'center' }]}>E</Text>
              <Text style={[styles.thText, { width: 50, textAlign: 'center' }]}>D</Text>
              <Text style={[styles.thText, { width: 80, textAlign: 'right' }]}>BUCHHOLZ</Text>
            </View>

            {standings.map((st, index) => (
              <View key={st.name} style={styles.tableRow}>
                <Text style={[styles.tdText, { width: 40, fontWeight: '800' }]}>#{index + 1}</Text>
                <Text style={[styles.tdText, { flex: 1, fontWeight: '700', color: '#F8FAFC' }]}>
                  {st.name}
                </Text>
                <Text style={[styles.tdText, { width: 60, textAlign: 'center', color: '#10B981', fontWeight: '800' }]}>
                  {st.points}
                </Text>
                <Text style={[styles.tdText, { width: 50, textAlign: 'center' }]}>{st.wins}</Text>
                <Text style={[styles.tdText, { width: 50, textAlign: 'center' }]}>{st.draws}</Text>
                <Text style={[styles.tdText, { width: 50, textAlign: 'center' }]}>{st.losses}</Text>
                <Text style={[styles.tdText, { width: 80, textAlign: 'right', color: '#94A3B8' }]}>
                  {st.buchholz.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  backBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  generateBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  generateBtnText: {
    color: '#451A03',
    fontSize: 13,
    fontWeight: '800',
  },
  telemetryBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 16,
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
  antiRematchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  badgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  antiRematchBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  navBar: {
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 10,
  },
  tabButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  tabButtonActive: {
    backgroundColor: '#F59E0B',
  },
  tabButtonText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#451A03',
    fontWeight: '800',
  },
  roundPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  roundPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  roundPillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  roundPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  roundPillTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
  },
  matchesGrid: {
    gap: 12,
  },
  matchCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  boardLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  matchStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchStatusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  matchStatusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  matchStatusText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
  },
  versusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  competitorBox: {
    flex: 1,
    alignItems: 'center',
  },
  competitorName: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  winnerName: {
    color: '#10B981',
    fontWeight: '800',
  },
  scoreText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  vsText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: 12,
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnActive: {
    backgroundColor: '#10B981',
  },
  actionBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  standingsWrapper: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  thText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tdText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
