/**
 * Landing Dashboard — Sekundo (AutoCAD Icon-Only Command Station)
 *
 * Fixed 100dvh Zero-Roll-Down viewport:
 * - Icon-only command buttons (`Click-to-Reveal`) for all Hubs, Engines, Privilege Matrix,
 *   and Unified Master CSV ("CSV Geral" saved state + sample)
 * - Zero clipped controls on Mobile (`390x844`) and Desktop (`1280x720`)
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
  generateOmniMasterSampleCsv,
  type ParticipantProfile,
} from '@sekundo/core';
import { deliverFile } from '../utils/deliverFile';
import { PrivilegeMatrixModal } from '../components/PrivilegeMatrixModal';
import {
  loadSavedPrivilegeParticipants,
  savePrivilegeParticipants,
  exportFullSiteOmniCsvFromStorage,
} from '../storage/omniStorageBridge';

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const { events, loading, deleteEventState } = useLocalEvent();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [selectedToolInfo, setSelectedToolInfo] = useState<{
    code: string;
    title: string;
    desc: string;
    route?: string;
    badge: string;
  }>({
    code: 'CAD-01',
    title: '📅 Programação & WhatsApp',
    desc: 'Compromissos, Grupos 1–3, WhatsApp, Territórios, CSV Geral e PDF.',
    route: '/schedule-hub',
    badge: 'HUB',
  });

  const [participants, setParticipants] = useState<ParticipantProfile[]>(
    DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
  );
  const [privilegeModalOpen, setPrivilegeModalOpen] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    loadSavedPrivilegeParticipants().then((loaded) => {
      if (loaded && loaded.length > 0) {
        setParticipants(loaded);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  const handleSaveParticipants = async (next: ParticipantProfile[]) => {
    setParticipants(next);
    await savePrivilegeParticipants(next);
    showToast(`🛡️ ${next.length} usuários salvos.`);
  };

  const handleDownloadOmniCsvGeral = async () => {
    try {
      const csv = await exportFullSiteOmniCsvFromStorage({ participants });
      await deliverFile(csv, 'sekundo_omni_geral.csv', 'text/csv;charset=utf-8');
      showToast('🌐 CSV Geral (Estado Salvo no Site) exportado!');
    } catch (e: any) {
      showToast(`Erro: ${e?.message ?? e}`);
    }
  };

  const handleDownloadSampleOmniCsv = async () => {
    try {
      const csv = generateOmniMasterSampleCsv();
      await deliverFile(csv, 'sekundo_omni_exemplo.csv', 'text/csv;charset=utf-8');
      showToast('🧪 CSV Geral de Exemplo baixado!');
    } catch (e: any) {
      showToast(`Erro: ${e?.message ?? e}`);
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

  const webTitle = (title: string) => (Platform.OS === 'web' ? ({ title } as any) : {});

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Icon-Only AutoCAD Command Ribbon */}
      <View style={styles.topRibbon}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/app-icon.png')}
            style={styles.brandIcon}
          />
          <Text style={styles.logo}>Sekundo</Text>
          <View style={styles.cadModePill}>
            <Text style={styles.cadModePillText}>CAD</Text>
          </View>
        </View>

        <View style={styles.topRibbonActions}>
          <Pressable
            testID="home-open-privileges-btn"
            accessibilityRole="button"
            accessibilityLabel={`Privilégios (${participants.length})`}
            {...webTitle(`Matriz de Privilégios (${participants.length} usuários)`)}
            onPress={() => setPrivilegeModalOpen(true)}
            style={[styles.iconRibbonBtn, styles.ribbonBtnPurple]}
          >
            <Text style={styles.iconRibbonGlyph}>🛡️</Text>
            <View style={styles.miniBadge}>
              <Text style={styles.miniBadgeText}>{participants.length}</Text>
            </View>
          </Pressable>

          <Pressable
            testID="home-download-omni-csv-btn"
            accessibilityRole="button"
            accessibilityLabel="Baixar CSV Geral"
            {...webTitle('Baixar CSV Geral (Inclui tudo salvo no site)')}
            onPress={handleDownloadOmniCsvGeral}
            style={[styles.iconRibbonBtn, styles.ribbonBtnGold]}
          >
            <Text style={styles.iconRibbonGlyph}>🌐</Text>
          </Pressable>

          <Pressable
            testID="home-download-sample-csv-btn"
            accessibilityRole="button"
            accessibilityLabel="Baixar CSV Geral de Exemplo"
            {...webTitle('Baixar CSV Geral de Exemplo')}
            onPress={handleDownloadSampleOmniCsv}
            style={styles.iconRibbonBtn}
          >
            <Text style={styles.iconRibbonGlyph}>🧪</Text>
          </Pressable>

          <Pressable
            testID="home-import-omni-csv-btn"
            accessibilityRole="button"
            accessibilityLabel="Importar CSV Geral"
            {...webTitle('Importar CSV Geral ou Planilha')}
            onPress={() => router.push('/csv-import')}
            style={[styles.iconRibbonBtn, styles.ribbonBtnEmerald]}
          >
            <Text style={styles.iconRibbonGlyph}>📥</Text>
          </Pressable>

          <Pressable
            testID="home-create-event-btn"
            accessibilityRole="button"
            accessibilityLabel="Novo Evento Multi-Engine"
            {...webTitle('Criar Novo Evento Multi-Engine')}
            onPress={() => router.push('/create-event')}
            style={styles.iconRibbonBtn}
          >
            <Text style={styles.iconRibbonGlyph}>➕</Text>
          </Pressable>

          <Pressable
            testID="home-toggle-info-btn"
            accessibilityRole="button"
            accessibilityLabel="Informações do Módulo"
            {...webTitle('Mostrar/Ocultar Detalhes do Módulo')}
            onPress={() => setShowInspector((prev) => !prev)}
            style={[styles.iconRibbonBtn, showInspector && styles.ribbonBtnActive]}
          >
            <Text style={styles.iconRibbonGlyph}>ℹ️</Text>
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
        {/* Left Dock: Icon-Centric Quick Actions Matrix */}
        <View style={[styles.column, isLargeScreen && styles.leftColumn]}>
          <View style={styles.dockHeader}>
            <Text style={styles.sectionTitle}>⚡ Módulos</Text>
            <Text style={styles.dockMeta}>6</Text>
          </View>

          <View style={styles.commandGrid}>
            <Pressable
              testID="quick-action-create-event"
              accessibilityRole="button"
              accessibilityLabel="Create New Event"
              {...webTitle('Criar Novo Evento (9 Engines)')}
              onPress={() => {
                setSelectedToolInfo({
                  code: 'E01-09',
                  title: '➕ Novo Evento Multi-Engine',
                  desc: 'Cria evento com qualquer uma das 9 Engines e Auto-Designação.',
                  route: '/create-event',
                  badge: '9 ENGINES',
                });
                router.push('/create-event');
              }}
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.actionBigIcon}>➕</Text>
              <Text style={styles.actionShortLabel} numberOfLines={1}>
                Novo
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-csv-import"
              accessibilityRole="button"
              accessibilityLabel="Import CSV Template"
              {...webTitle('Importar / Exportar CSV Geral')}
              onPress={() => {
                setSelectedToolInfo({
                  code: 'CSV',
                  title: '📥 Central Omni-CSV',
                  desc: 'Abre múltiplas Engines (Territórios + Programação + Privilégios) com 1 único CSV.',
                  route: '/csv-import',
                  badge: 'OMNI-CSV',
                });
                router.push('/csv-import');
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#10B981' },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.actionBigIcon}>📥</Text>
              <Text style={[styles.actionShortLabel, { color: '#34D399' }]} numberOfLines={1}>
                CSV Geral
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-schedule-hub"
              accessibilityRole="button"
              accessibilityLabel="Programação & WhatsApp"
              {...webTitle('Engine de Programação, WhatsApp & Territórios')}
              onPress={() => {
                setSelectedToolInfo({
                  code: 'HUB',
                  title: '📅 Programação & WhatsApp',
                  desc: 'Designações, Grupos 1–3, WhatsApp, Territórios, CSV e PDF.',
                  route: '/schedule-hub',
                  badge: 'ZAP + CSV',
                });
                router.push('/schedule-hub' as any);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.08)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.actionBigIcon}>📅</Text>
              <Text style={[styles.actionShortLabel, { color: '#38BDF8' }]} numberOfLines={1}>
                Agenda
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-studio"
              accessibilityRole="button"
              accessibilityLabel="Estúdio Documental YAML PDF"
              {...webTitle('Estúdio Documental YAML ⇄ PDF')}
              onPress={() => {
                setSelectedToolInfo({
                  code: 'SDOC',
                  title: '🖋️ Estúdio YAML ⇄ PDF',
                  desc: 'Canvas em mm, Fichas 4-Up e Registro Multi-Ciclo.',
                  route: '/studio',
                  badge: 'PDF MM',
                });
                router.push('/studio' as any);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.08)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.actionBigIcon}>🖋️</Text>
              <Text style={[styles.actionShortLabel, { color: '#60A5FA' }]} numberOfLines={1}>
                Estúdio
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-hoje"
              accessibilityRole="button"
              accessibilityLabel="Cockpit Hoje"
              {...webTitle('Cockpit Hoje & Rituais')}
              onPress={() => {
                setSelectedToolInfo({
                  code: 'HOJE',
                  title: '☀️ Cockpit Hoje',
                  desc: 'Compromissos do dia, Rituais e sekundo.app.yaml.',
                  route: '/hoje',
                  badge: 'HOJE',
                });
                router.push('/hoje' as any);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.08)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.actionBigIcon}>☀️</Text>
              <Text style={[styles.actionShortLabel, { color: '#FBBF24' }]} numberOfLines={1}>
                Hoje
              </Text>
            </Pressable>

            <Pressable
              testID="quick-action-privileges"
              accessibilityRole="button"
              accessibilityLabel="Matriz de Privilégios"
              {...webTitle('Matriz de Privilégios Dinâmica & Auto-Designação')}
              onPress={() => {
                setSelectedToolInfo({
                  code: 'PRIV',
                  title: '🛡️ Matriz de Privilégios',
                  desc: 'Lê qualquer privilégio do CSV e executa rotação justa FIFO.',
                  badge: `${participants.length} USUÁRIOS`,
                });
                setPrivilegeModalOpen(true);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.10)' },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.actionBigIcon}>🛡️</Text>
              <Text style={[styles.actionShortLabel, { color: '#C4B5FD' }]} numberOfLines={1}>
                Privilégios
              </Text>
            </Pressable>
          </View>

          {/* Click-to-Reveal Inspector Box (hidden unless user clicks ℹ️) */}
          {showInspector && (
            <View style={styles.inspectorBar}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.inspectorCode}>
                  [{selectedToolInfo.code}] {selectedToolInfo.title}
                </Text>
                <Text style={styles.inspectorBadge}>{selectedToolInfo.badge}</Text>
              </View>
              <Text style={styles.inspectorDesc} numberOfLines={2}>
                {selectedToolInfo.desc}
              </Text>
            </View>
          )}
        </View>

        {/* Right Dock: Active Events Matrix with Icon-Only Engine Launchers */}
        <View style={[styles.column, isLargeScreen && styles.rightColumn]}>
          <View style={styles.dockHeader}>
            <Text style={styles.sectionTitle}>🗂️ Eventos ({events.length})</Text>
            <Text style={styles.dockMeta}>Ícones abrem as Engines</Text>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhum evento salvo.</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={() => router.push('/create-event')}
                  style={[styles.iconRibbonBtn, styles.ribbonBtnGold]}
                >
                  <Text style={styles.iconRibbonGlyph}>➕</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/csv-import')}
                  style={[styles.iconRibbonBtn, styles.ribbonBtnEmerald]}
                >
                  <Text style={styles.iconRibbonGlyph}>📥</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
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
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            flex: 1,
                          }}
                        >
                          <Text style={styles.eventIndexCode}>
                            [{String(idx + 1).padStart(2, '0')}]
                          </Text>
                          <Text style={styles.eventName} numberOfLines={1}>
                            {event.config.name}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {activeEngines.slice(0, 3).map((engId) => {
                            const eng = engineRegistry.get(engId);
                            return (
                              <View key={engId} style={styles.engineBadge}>
                                <Text style={styles.engineBadgeText}>
                                  {eng ? eng.name.slice(0, 10) : engId}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </Pressable>

                      {/* Icon-Only Multi-Engine Action Bar for the Event */}
                      <View style={styles.cardActions}>
                        {activeEngines.includes('territory_logistics') && (
                          <>
                            <Pressable
                              testID={`event-open-territory-${event.config.id}`}
                              accessibilityRole="button"
                              accessibilityLabel="📋 Campo"
                              {...webTitle('📋 Campo (Engine de Territórios)')}
                              onPress={() =>
                                router.push(`/territory-checklist?id=${event.config.id}`)
                              }
                              style={[styles.eventIconBtn, { borderColor: '#10B981' }]}
                            >
                              <Text style={styles.eventIconGlyph}>📋</Text>
                            </Pressable>
                            <Pressable
                              testID={`event-open-map-${event.config.id}`}
                              accessibilityRole="button"
                              accessibilityLabel="🗺️ Mapa"
                              {...webTitle('🗺️ Mapa CAD 2D (Engine de Territórios)')}
                              onPress={() =>
                                router.push(`/territory-map?id=${event.config.id}`)
                              }
                              style={[styles.eventIconBtn, { borderColor: '#3B82F6' }]}
                            >
                              <Text style={styles.eventIconGlyph}>🗺️</Text>
                            </Pressable>
                          </>
                        )}

                        {activeEngines.includes('roster_assignments') && (
                          <>
                            <Pressable
                              testID={`event-open-schedule-${event.config.id}`}
                              accessibilityRole="button"
                              accessibilityLabel="📲 Programação"
                              {...webTitle('📅 Programação & WhatsApp')}
                              onPress={() =>
                                router.push(`/schedule-hub?id=${event.config.id}` as any)
                              }
                              style={[styles.eventIconBtn, { borderColor: '#FFB800' }]}
                            >
                              <Text style={styles.eventIconGlyph}>📅</Text>
                            </Pressable>
                            <Pressable
                              testID={`event-open-privileges-${event.config.id}`}
                              accessibilityRole="button"
                              accessibilityLabel="🛡️ Privilégios"
                              {...webTitle('🛡️ Matriz de Privilégios')}
                              onPress={() => setPrivilegeModalOpen(true)}
                              style={[styles.eventIconBtn, { borderColor: '#A855F7' }]}
                            >
                              <Text style={styles.eventIconGlyph}>🛡️</Text>
                            </Pressable>
                            <Pressable
                              testID={`event-open-swap-${event.config.id}`}
                              accessibilityRole="button"
                              accessibilityLabel="🔄 Trocas"
                              {...webTitle('🔄 Trocas de Designação')}
                              onPress={() =>
                                router.push(`/roster-swap?id=${event.config.id}`)
                              }
                              style={[styles.eventIconBtn, { borderColor: '#10B981' }]}
                            >
                              <Text style={styles.eventIconGlyph}>🔄</Text>
                            </Pressable>
                          </>
                        )}

                        {activeEngines.includes('live_production_ros') && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="⏱️ Régie"
                            {...webTitle('⏱️ Run-of-Show / Régie')}
                            onPress={() =>
                              router.push(`/run-of-show?id=${event.config.id}`)
                            }
                            style={[styles.eventIconBtn, { borderColor: '#EF4444' }]}
                          >
                            <Text style={styles.eventIconGlyph}>⏱️</Text>
                          </Pressable>
                        )}

                        {activeEngines.includes('tournament_pairings') && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="🏆 Torneio"
                            {...webTitle('🏆 Chaveamento de Torneio')}
                            onPress={() =>
                              router.push(`/tournament-bracket?id=${event.config.id}`)
                            }
                            style={[styles.eventIconBtn, { borderColor: '#F59E0B' }]}
                          >
                            <Text style={styles.eventIconGlyph}>🏆</Text>
                          </Pressable>
                        )}

                        {activeEngines.includes('incident_command') && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="🚨 ICS"
                            {...webTitle('🚨 Comando de Incidente ICS')}
                            onPress={() =>
                              router.push(`/ics-command?id=${event.config.id}`)
                            }
                            style={[styles.eventIconBtn, { borderColor: '#3B82F6' }]}
                          >
                            <Text style={styles.eventIconGlyph}>🚨</Text>
                          </Pressable>
                        )}

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="📄 PDF"
                          {...webTitle('📄 Formulários PDF')}
                          onPress={() =>
                            router.push(`/pdf-forms?id=${event.config.id}`)
                          }
                          style={[styles.eventIconBtn, { borderColor: '#FFB800' }]}
                        >
                          <Text style={styles.eventIconGlyph}>📄</Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="🖋️ Estúdio"
                          {...webTitle('🖋️ Estúdio Documental YAML ⇄ PDF')}
                          onPress={() =>
                            router.push(`/studio?id=${event.config.id}` as any)
                          }
                          style={[styles.eventIconBtn, { borderColor: '#3B82F6' }]}
                        >
                          <Text style={styles.eventIconGlyph}>🖋️</Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Editar"
                          {...webTitle('🌳 Editor de Esqueleto Multi-Engine')}
                          onPress={() =>
                            router.push(`/skeleton-editor?id=${event.config.id}`)
                          }
                          style={styles.eventIconBtn}
                        >
                          <Text style={styles.eventIconGlyph}>🌳</Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Excluir Evento"
                          {...webTitle('🗑️ Excluir Evento')}
                          onPress={() => deleteEventState(event.config.id)}
                          style={[styles.eventIconBtn, styles.deleteButton]}
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

      {/* Dynamic Clean-Room Privilege Matrix Modal */}
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
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  logo: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  cadModePill: {
    backgroundColor: 'rgba(255, 184, 0, 0.16)',
    borderWidth: 1,
    borderColor: '#FFB800',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  cadModePillText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFB800',
  },
  topRibbonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  iconRibbonBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconRibbonGlyph: {
    fontSize: 16,
  },
  miniBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#A855F7',
    borderRadius: 7,
    paddingHorizontal: 3,
    minWidth: 14,
    alignItems: 'center',
  },
  miniBadgeText: {
    color: '#DDD6FE',
    fontSize: 8,
    fontWeight: '800',
  },
  ribbonBtnPurple: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
  },
  ribbonBtnGold: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  ribbonBtnEmerald: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  ribbonBtnActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  toastBanner: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
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
    gap: 8,
    minHeight: 0,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1.35,
  },
  dockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
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
    width: '31.5%',
    minWidth: 88,
    flexGrow: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  actionBigIcon: {
    fontSize: 20,
  },
  actionShortLabel: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  inspectorBar: {
    marginTop: 6,
    backgroundColor: '#090D16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
  },
  inspectorCode: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  inspectorBadge: {
    color: '#FFB800',
    fontSize: 9,
    fontWeight: '800',
  },
  inspectorDesc: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  eventsContainer: {
    flex: 1,
    minHeight: 0,
  },
  eventsMatrixScroll: {
    flex: 1,
  },
  eventsMatrixGrid: {
    gap: 6,
    paddingBottom: 6,
  },
  eventCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.72)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  eventCardActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
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
  },
  eventName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  engineBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.14)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.35)',
  },
  engineBadgeText: {
    color: '#FFB800',
    fontSize: 8.5,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  eventIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIconGlyph: {
    fontSize: 15,
  },
  deleteButton: {
    borderColor: 'rgba(239, 68, 68, 0.45)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 13,
  },
  emptyCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
});
