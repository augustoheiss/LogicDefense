/**
 * Landing Dashboard — Sekundo (AutoCAD Technical Command Station)
 *
 * Fixed 100dvh Zero-Roll-Down viewport:
 * - Dense command buttons for all Hubs, Engines, Privilege Matrix, and Unified Master CSV (CSV Geral)
 * - Click any module or event button to inspect and launch actions without vertical page scrolling
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import {
  engineRegistry,
  getActiveEngines,
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  exportOmniCsvBundle,
  generateOmniMasterSampleCsv,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  S89_4UP_SDOC_YAML,
  S13S_MULTICYCLE_SDOC_YAML,
  type ParticipantProfile,
} from '@sekundo/core';
import { deliverFile } from '../utils/deliverFile';
import { PrivilegeMatrixModal } from '../components/PrivilegeMatrixModal';

const PRIVILEGE_DIRECTORY_STORAGE_KEY = 'sekundo:privilege_directory_v1';

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const { events, loading, deleteEventState } = useLocalEvent();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedToolInfo, setSelectedToolInfo] = useState<{
    code: string;
    title: string;
    desc: string;
    route?: string;
    badge: string;
  }>({
    code: 'CAD-01',
    title: '📅 Programação & WhatsApp (Hub)',
    desc: 'Compromissos, Grupos 1–3, Exportador WhatsApp, Registro de Territórios, Importação/Exportação CSV e Folha PDF Completa.',
    route: '/schedule-hub',
    badge: 'HUB OPERACIONAL',
  });

  const [participants, setParticipants] = useState<ParticipantProfile[]>(
    DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
  );
  const [privilegeModalOpen, setPrivilegeModalOpen] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(PRIVILEGE_DIRECTORY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ParticipantProfile[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setParticipants(parsed);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  const handleSaveParticipants = async (next: ParticipantProfile[]) => {
    setParticipants(next);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(PRIVILEGE_DIRECTORY_STORAGE_KEY, JSON.stringify(next));
    }
    showToast(`🛡️ Matriz salva (${next.length} participantes).`);
  };

  const handleDownloadOmniCsvGeral = async () => {
    try {
      const csv =
        events.length > 0
          ? exportOmniCsvBundle({
              events: events.map((ev) => ({
                id: ev.config.id,
                name: ev.config.name,
                engines: getActiveEngines(ev.config),
                registry: [],
              })),
              scheduleRegistry: buildProgramacaoReuniaoRegistry(),
              territoryRegistry: buildTerritoriosS13HistoricalRegistry(),
              participants,
              studioDocuments: [
                {
                  id: 'fichas-4up',
                  title: 'Fichas de Designação 4-Up',
                  format: 'a4',
                  sdocYaml: S89_4UP_SDOC_YAML,
                },
                {
                  id: 'territorios-multiciclo',
                  title: 'Registro de Territórios Multi-Ciclo',
                  format: 'a4',
                  sdocYaml: S13S_MULTICYCLE_SDOC_YAML,
                },
              ],
            })
          : generateOmniMasterSampleCsv();
      await deliverFile(csv, 'sekundo_omni_geral.csv', 'text/csv;charset=utf-8');
      showToast('🌐 CSV GERAL exportado (sekundo_omni_geral.csv).');
    } catch (e: any) {
      showToast(`Erro ao exportar CSV Geral: ${e?.message ?? e}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  const activeSelectedEvent =
    events.find((e) => e.config.id === selectedEventId) || events[0] || null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top AutoCAD Command Ribbon */}
      <View style={styles.topRibbon}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/app-icon.png')}
            style={styles.brandIcon}
          />
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.logo}>Sekundo</Text>
              <View style={styles.cadModePill}>
                <Text style={styles.cadModePillText}>CAD ZERO-SCROLL</Text>
              </View>
            </View>
            <Text style={styles.tagline} numberOfLines={1}>
              Estação técnica agnóstica • Clique nos comandos para inspecionar ou executar
            </Text>
          </View>
        </View>

        <View style={styles.topRibbonActions}>
          <Pressable
            testID="home-open-privileges-btn"
            onPress={() => setPrivilegeModalOpen(true)}
            style={[styles.ribbonBtn, styles.ribbonBtnPurple]}
          >
            <Text style={[styles.ribbonBtnText, { color: '#DDD6FE' }]}>
              🛡️ Privilégios ({participants.length})
            </Text>
          </Pressable>

          <Pressable
            testID="home-download-omni-csv-btn"
            onPress={handleDownloadOmniCsvGeral}
            style={[styles.ribbonBtn, styles.ribbonBtnGold]}
          >
            <Text style={[styles.ribbonBtnText, { color: '#FDE68A' }]}>
              🌐 Baixar CSV Geral
            </Text>
          </Pressable>

          <Pressable
            testID="home-import-omni-csv-btn"
            onPress={() => router.push('/csv-import')}
            style={[styles.ribbonBtn, styles.ribbonBtnEmerald]}
          >
            <Text style={[styles.ribbonBtnText, { color: '#6EE7B7' }]}>
              📥 Importar CSV Geral
            </Text>
          </Pressable>
        </View>
      </View>

      {statusToast && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastBannerText}>{statusToast}</Text>
        </View>
      )}

      {/* Main Fixed Viewport Split Workspace */}
      <View style={[styles.mainLayout, isLargeScreen && styles.rowLayout]}>
        {/* Left Dock: Quick Actions & Hubs Matrix */}
        <View style={[styles.column, isLargeScreen && styles.leftColumn]}>
          <View style={styles.dockHeader}>
            <Text style={styles.sectionTitle}>1. Módulos & Ferramentas (Quick Actions)</Text>
            <Text style={styles.dockMeta}>6 comandos</Text>
          </View>

          <View style={styles.commandGrid}>
            <Pressable
              testID="quick-action-create-event"
              onPress={() => {
                setSelectedToolInfo({
                  code: 'CMD-NEW',
                  title: 'Create New Event (Novo Evento / Engine)',
                  desc: 'Cria um evento com qualquer uma das 9 Engines universais, baixa CSV de exemplo e aplica Auto-Designação com Privilégios.',
                  route: '/create-event',
                  badge: '9 ENGINES',
                });
                router.push('/create-event');
              }}
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            >
              <View style={styles.actionRowTop}>
                <Text style={styles.actionCode}>[01]</Text>
                <Text style={styles.actionBadge}>ENGINE</Text>
              </View>
              <Text style={styles.actionButtonText} numberOfLines={1}>
                ➕ Create New Event
              </Text>
              <Text style={styles.actionButtonSub} numberOfLines={1}>
                9 Engines + Auto-Designar Privilégios
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-csv-import"
              onPress={() => {
                setSelectedToolInfo({
                  code: 'CMD-CSV',
                  title: 'Import CSV Template (Central Omni-CSV)',
                  desc: 'Importa ou exporta um único arquivo .CSV GERAL contendo todas as Engines, Programação WhatsApp, Estúdio YAML e Cockpit Hoje.',
                  route: '/csv-import',
                  badge: 'OMNI-CSV',
                });
                router.push('/csv-import');
              }}
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            >
              <View style={styles.actionRowTop}>
                <Text style={styles.actionCode}>[02]</Text>
                <Text style={[styles.actionBadge, { color: '#34D399' }]}>OMNI-CSV</Text>
              </View>
              <Text style={styles.actionButtonText} numberOfLines={1}>
                📥 Import CSV Template
              </Text>
              <Text style={styles.actionButtonSub} numberOfLines={1}>
                CSV Único p/ Todo o App ou por Engine
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-schedule-hub"
              onPress={() => {
                setSelectedToolInfo({
                  code: 'HUB-ZAP',
                  title: '📅 Programação & WhatsApp (Hub)',
                  desc: 'Compromissos, Grupos 1–3, Exportador WhatsApp, Registro de Territórios, Importar/Exportar CSV e Impressão PDF Completa.',
                  route: '/schedule-hub',
                  badge: 'HUB + CSV + PDF',
                });
                router.push('/schedule-hub' as any);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.08)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.actionRowTop}>
                <Text style={[styles.actionCode, { color: '#34D399' }]}>[03]</Text>
                <Text style={[styles.actionBadge, { color: '#34D399' }]}>ZAP + CSV</Text>
              </View>
              <Text style={[styles.actionButtonText, { color: '#34D399' }]} numberOfLines={1}>
                📅 Programação & WhatsApp (Hub)
              </Text>
              <Text style={styles.actionButtonSub} numberOfLines={1}>
                Compromissos, Grupos 1–3, CSV e PDF
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-studio"
              onPress={() => {
                setSelectedToolInfo({
                  code: 'STUDIO-MM',
                  title: '🖋️ Estúdio Documental YAML ⇄ PDF',
                  desc: 'Canvas em mm, Fichas 4-Up, Territórios Multi-Ciclo, Ingestão de PDF e Exportação CSV/PDF.',
                  route: '/studio',
                  badge: 'YAML ⇄ PDF',
                });
                router.push('/studio' as any);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.10)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.actionRowTop}>
                <Text style={[styles.actionCode, { color: '#60A5FA' }]}>[04]</Text>
                <Text style={[styles.actionBadge, { color: '#60A5FA' }]}>ESTÚDIO MM</Text>
              </View>
              <Text style={[styles.actionButtonText, { color: '#60A5FA' }]} numberOfLines={1}>
                🖋️ Estúdio Documental YAML ⇄ PDF
              </Text>
              <Text style={styles.actionButtonSub} numberOfLines={1}>
                Canvas em mm, Fichas 4-Up e Multi-Ciclo
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-hoje"
              onPress={() => {
                setSelectedToolInfo({
                  code: 'COCKPIT-HOJE',
                  title: '☀️ Cockpit Hoje & Compositor',
                  desc: 'Compromissos do dia, Rituais governados, sekundo.app.yaml e Importação/Exportação CSV Geral.',
                  route: '/hoje',
                  badge: 'COCKPIT CAD',
                });
                router.push('/hoje' as any);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.10)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.actionRowTop}>
                <Text style={[styles.actionCode, { color: '#FBBF24' }]}>[05]</Text>
                <Text style={[styles.actionBadge, { color: '#FBBF24' }]}>HOJE + YAML</Text>
              </View>
              <Text style={[styles.actionButtonText, { color: '#FBBF24' }]} numberOfLines={1}>
                ☀️ Cockpit Hoje & Compositor
              </Text>
              <Text style={styles.actionButtonSub} numberOfLines={1}>
                Compromissos do dia, Rituais e YAML
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-privileges"
              onPress={() => {
                setSelectedToolInfo({
                  code: 'PRIV-26',
                  title: '🛡️ Matriz de Privilégios & Rotatividade',
                  desc: 'Configura 26 colunas de competências por usuário (Perfil A/B, Nível de Função e Grupos) para auto-preenchimento justo sem colisões.',
                  badge: '26 COLUNAS',
                });
                setPrivilegeModalOpen(true);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.12)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.actionRowTop}>
                <Text style={[styles.actionCode, { color: '#C4B5FD' }]}>[06]</Text>
                <Text style={[styles.actionBadge, { color: '#C4B5FD' }]}>26 PRIVILÉGIOS</Text>
              </View>
              <Text style={[styles.actionButtonText, { color: '#DDD6FE' }]} numberOfLines={1}>
                🛡️ Matriz de Privilégios & Rotação
              </Text>
              <Text style={styles.actionButtonSub} numberOfLines={1}>
                {participants.length} participantes • Auto-Designar FIFO
              </Text>
            </Pressable>
          </View>

          {/* Compact CAD Inspector Box for Selected Module */}
          <View style={styles.inspectorBar}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.inspectorCode}>
                [{selectedToolInfo.code}] {selectedToolInfo.title}
              </Text>
              <Text style={styles.inspectorBadge}>{selectedToolInfo.badge}</Text>
            </View>
            <Text style={styles.inspectorDesc} numberOfLines={2}>
              {selectedToolInfo.desc}
            </Text>
          </View>
        </View>

        {/* Right Dock: Active Events Matrix & Selected Event Command Inspector */}
        <View style={[styles.column, isLargeScreen && styles.rightColumn]}>
          <View style={styles.dockHeader}>
            <Text style={styles.sectionTitle}>2. Your Active Skeletons ({events.length})</Text>
            <Text style={styles.dockMeta}>Clique no evento p/ comandos</Text>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No events configured yet.</Text>
              <Text style={styles.emptySub}>Click "Create New Event" or "Import CSV Template".</Text>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
              {/* Compact Event Selector Buttons */}
              <ScrollView
                style={styles.eventsMatrixScroll}
                contentContainerStyle={styles.eventsMatrixGrid}
              >
                {events.map((event, idx) => {
                  const activeEngines = getActiveEngines(event.config);
                  const isSelected = activeSelectedEvent?.config.id === event.config.id;
                  return (
                    <View
                      key={event.config.id}
                      style={[styles.eventCard, isSelected && styles.eventCardActive]}
                    >
                      <Pressable
                        onPress={() => setSelectedEventId(event.config.id)}
                        style={styles.eventHeaderRow}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <Text style={styles.eventIndexCode}>
                            [{String(idx + 1).padStart(2, '0')}]
                          </Text>
                          <Text style={styles.eventName} numberOfLines={1}>
                            {event.config.name}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {activeEngines.slice(0, 2).map((engId) => {
                            const eng = engineRegistry.get(engId);
                            return (
                              <View key={engId} style={styles.engineBadge}>
                                <Text style={styles.engineBadgeText}>{eng.name}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </Pressable>

                      {/* Compact CAD Command Buttons for the Event */}
                      <View style={styles.cardActions}>
                        {activeEngines.includes('territory_logistics') && (
                          <>
                            <Pressable
                              onPress={() => router.push(`/territory-checklist?id=${event.config.id}`)}
                              style={[
                                styles.openButton,
                                {
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  borderWidth: 1,
                                  borderColor: '#10B981',
                                },
                              ]}
                            >
                              <Text style={[styles.openButtonText, { color: '#10B981' }]}>📋 Campo</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => router.push(`/territory-map?id=${event.config.id}`)}
                              style={[
                                styles.openButton,
                                {
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  borderWidth: 1,
                                  borderColor: '#3B82F6',
                                },
                              ]}
                            >
                              <Text style={[styles.openButtonText, { color: '#60A5FA' }]}>🗺️ Mapa</Text>
                            </Pressable>
                          </>
                        )}
                        {activeEngines.includes('roster_assignments') && (
                          <>
                            <Pressable
                              onPress={() => router.push(`/schedule-hub?id=${event.config.id}` as any)}
                              style={[
                                styles.openButton,
                                {
                                  backgroundColor: 'rgba(255, 184, 0, 0.16)',
                                  borderWidth: 1,
                                  borderColor: '#FFB800',
                                },
                              ]}
                            >
                              <Text style={[styles.openButtonText, { color: '#FFB800' }]}>
                                📲 Programação
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => router.push(`/roster-swap?id=${event.config.id}`)}
                              style={[
                                styles.openButton,
                                {
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  borderWidth: 1,
                                  borderColor: '#10B981',
                                },
                              ]}
                            >
                              <Text style={[styles.openButtonText, { color: '#10B981' }]}>🔄 Trocas</Text>
                            </Pressable>
                          </>
                        )}
                        {activeEngines.includes('live_production_ros') && (
                          <Pressable
                            onPress={() => router.push(`/run-of-show?id=${event.config.id}`)}
                            style={[
                              styles.openButton,
                              {
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                borderWidth: 1,
                                borderColor: '#EF4444',
                              },
                            ]}
                          >
                            <Text style={[styles.openButtonText, { color: '#FCA5A5' }]}>⏱️ Régie</Text>
                          </Pressable>
                        )}
                        {activeEngines.includes('tournament_pairings') && (
                          <Pressable
                            onPress={() => router.push(`/tournament-bracket?id=${event.config.id}`)}
                            style={[
                              styles.openButton,
                              {
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                borderWidth: 1,
                                borderColor: '#F59E0B',
                              },
                            ]}
                          >
                            <Text style={[styles.openButtonText, { color: '#FCD34D' }]}>🏆 Torneio</Text>
                          </Pressable>
                        )}
                        {activeEngines.includes('incident_command') && (
                          <Pressable
                            onPress={() => router.push(`/ics-command?id=${event.config.id}`)}
                            style={[
                              styles.openButton,
                              {
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                borderWidth: 1,
                                borderColor: '#3B82F6',
                              },
                            ]}
                          >
                            <Text style={[styles.openButtonText, { color: '#93C5FD' }]}>🛡️ ICS</Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => router.push(`/pdf-forms?id=${event.config.id}`)}
                          style={[
                            styles.openButton,
                            {
                              backgroundColor: 'rgba(255, 184, 0, 0.12)',
                              borderWidth: 1,
                              borderColor: '#FFB800',
                            },
                          ]}
                        >
                          <Text style={[styles.openButtonText, { color: '#FFB800' }]}>📄 PDF</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => router.push(`/studio?id=${event.config.id}` as any)}
                          style={[
                            styles.openButton,
                            {
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              borderWidth: 1,
                              borderColor: '#3B82F6',
                            },
                          ]}
                        >
                          <Text style={[styles.openButtonText, { color: '#60A5FA' }]}>🖋️ Estúdio</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => router.push(`/skeleton-editor?id=${event.config.id}`)}
                          style={styles.openButton}
                        >
                          <Text style={styles.openButtonText}>Editar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => deleteEventState(event.config.id)}
                          style={styles.deleteButton}
                        >
                          <Text style={styles.deleteButtonText}>✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Clean-Room 26-Column Privilege Matrix Modal */}
      <PrivilegeMatrixModal
        visible={privilegeModalOpen}
        onClose={() => setPrivilegeModalOpen(false)}
        participants={participants}
        onChangeParticipants={handleSaveParticipants}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    height: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFB800',
  },
  logo: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  cadModePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  cadModePillText: {
    color: '#FBBF24',
    fontSize: 8.5,
    fontWeight: '900',
  },
  tagline: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  topRibbonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ribbonBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  ribbonBtnPurple: {
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderColor: '#8B5CF6',
  },
  ribbonBtnGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: '#F59E0B',
  },
  ribbonBtnEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: '#10B981',
  },
  ribbonBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  toastBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  toastBannerText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
  },
  mainLayout: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    gap: 8,
    overflow: 'hidden',
  },
  rowLayout: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    overflow: 'hidden',
  },
  leftColumn: {
    flex: 1.05,
  },
  rightColumn: {
    flex: 1,
  },
  dockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dockMeta: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionButton: {
    width: '48.8%',
    flexGrow: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  actionCode: {
    color: '#FFB800',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  actionBadge: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '800',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionButtonSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  inspectorBar: {
    marginTop: 'auto',
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#090D16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  inspectorCode: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  inspectorBadge: {
    color: '#FFB800',
    fontSize: 9,
    fontWeight: '900',
  },
  inspectorDesc: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptySub: {
    color: '#6F7E94',
    fontSize: 11,
    marginTop: 4,
  },
  eventsContainer: {
    flex: 1,
    minHeight: 0,
  },
  eventsMatrixScroll: {
    flex: 1,
    minHeight: 0,
  },
  eventsMatrixGrid: {
    gap: 6,
    paddingBottom: 4,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 6,
  },
  eventCardActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.05)',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  eventIndexCode: {
    color: '#FFB800',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  eventName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  engineBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  engineBadgeText: {
    color: '#FFB800',
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  openButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  openButtonText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 10.5,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 10.5,
    fontWeight: '800',
  },
});
