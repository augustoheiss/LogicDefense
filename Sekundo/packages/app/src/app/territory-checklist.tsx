/**
 * Page: territory-checklist
 *
 * Tactical Field Checklist for Volunteers and Field Canvassing.
 * Optimized for one-handed smartphone operation:
 * - Large touch targets
 * - High-contrast indicators (1 ✅ Worked / 0 ⬜ Pending)
 * - Grouped by Quadra / Sub-territory
 * - Fast batch toggle ("Marcar Quadra como Concluída")
 * - Quick field note annotation
 * - Search bar with instant filter
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { pathKey } from '@sekundo/core';
import type { FlatSkeletonEntry } from '@sekundo/core';

interface ChecklistGroup {
  groupKey: string;
  groupLabel: string;
  items: FlatSkeletonEntry[];
  total: number;
  worked: number;
  isAllWorked: boolean;
}

export default function TerritoryChecklistScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);
  const { flatRegistry, updateNode, loading } = useSkeleton(eventId);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'worked'>('all');
  const [activeNoteKey, setActiveNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  // Extract territory items and group by parent quadra
  const groups = useMemo<ChecklistGroup[]>(() => {
    const groupMap = new Map<string, { label: string; items: FlatSkeletonEntry[] }>();

    // 1. First find header/quadra parents
    for (const node of flatRegistry) {
      const depth = pathKey.depth(node.key);
      if (depth <= 2) {
        if (!groupMap.has(node.key)) {
          groupMap.set(node.key, { label: node.label, items: [] });
        }
      }
    }

    // 2. Assign leaf/work items into groups
    for (const node of flatRegistry) {
      if (node.type === 'territory') {
        const parentKey = pathKey.parent(node.key);
        if (parentKey && groupMap.has(parentKey)) {
          groupMap.get(parentKey)!.items.push(node);
        } else {
          // If no parent found, group under top-level
          const rootKey = pathKey.root(node.key);
          if (!groupMap.has(rootKey)) {
            groupMap.set(rootKey, { label: `Setor ${rootKey}`, items: [] });
          }
          groupMap.get(rootKey)!.items.push(node);
        }
      }
    }

    const result: ChecklistGroup[] = [];

    for (const [groupKey, data] of groupMap.entries()) {
      // Filter items according to search query and filterMode
      const filtered = data.items.filter((item) => {
        const meta = (item.meta || {}) as Record<string, any>;
        const worked = Number(meta.worked) === 1 ? 1 : 0;

        if (filterMode === 'pending' && worked === 1) return false;
        if (filterMode === 'worked' && worked === 0) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchLabel = item.label.toLowerCase().includes(q);
          const matchKey = item.key.toLowerCase().includes(q);
          const matchNote = String(meta.notes || '').toLowerCase().includes(q);
          return matchLabel || matchKey || matchNote;
        }

        return true;
      });

      if (filtered.length > 0) {
        const total = filtered.length;
        const worked = filtered.filter((i) => Number((i.meta as any)?.worked) === 1).length;
        result.push({
          groupKey,
          groupLabel: data.label || `Quadra ${groupKey}`,
          items: filtered,
          total,
          worked,
          isAllWorked: total > 0 && worked === total,
        });
      }
    }

    // Sort groups hierarchically
    result.sort((a, b) => pathKey.compare(a.groupKey, b.groupKey));
    return result;
  }, [flatRegistry, searchQuery, filterMode]);

  // Overall metrics
  const overallStats = useMemo(() => {
    let total = 0;
    let worked = 0;
    flatRegistry.forEach((n) => {
      if (n.type === 'territory') {
        total++;
        if (Number((n.meta as any)?.worked) === 1) {
          worked++;
        }
      }
    });
    const percent = total > 0 ? Math.round((worked / total) * 100) : 0;
    return { total, worked, percent, pending: total - worked };
  }, [flatRegistry]);

  // Toggle single item work status
  const handleToggleItem = async (targetKey: string) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, targetKey));
    if (!target) return;
    const meta = (target.meta || {}) as Record<string, any>;
    const currentWorked = Number(meta.worked) === 1 ? 1 : 0;
    const nextWorked = currentWorked === 1 ? 0 : 1;

    await updateNode(targetKey, {
      value: nextWorked === 1 ? 'Trabalhado' : '',
      meta: {
        ...meta,
        worked: nextWorked,
        lastWorkedAt: nextWorked === 1 ? new Date().toISOString() : undefined,
      },
    });
  };

  // Batch toggle all items in a quadra
  const handleToggleQuadra = async (group: ChecklistGroup) => {
    const targetStatus = group.isAllWorked ? 0 : 1;

    for (const item of group.items) {
      const meta = (item.meta || {}) as Record<string, any>;
      await updateNode(item.key, {
        value: targetStatus === 1 ? 'Trabalhado' : '',
        meta: {
          ...meta,
          worked: targetStatus,
          lastWorkedAt: targetStatus === 1 ? new Date().toISOString() : undefined,
        },
      });
    }
  };

  // Note editor handlers
  const openNoteEditor = (item: FlatSkeletonEntry) => {
    setActiveNoteKey(item.key);
    const meta = (item.meta || {}) as Record<string, any>;
    setNoteDraft(typeof meta.notes === 'string' ? meta.notes : '');
  };

  const handleSaveNote = async () => {
    if (!activeNoteKey) return;
    const target = flatRegistry.find((n) => pathKey.equals(n.key, activeNoteKey));
    if (!target) return;
    const meta = (target.meta || {}) as Record<string, any>;

    await updateNode(activeNoteKey, {
      meta: {
        ...meta,
        notes: noteDraft.trim(),
      },
    });
    setActiveNoteKey(null);
  };

  if (loading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => router.replace(`/skeleton-editor?id=${eventId}`)}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Voltar</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/territory-map?id=${eventId}`)}
            style={styles.mapLinkBtn}
          >
            <Text style={styles.mapLinkBtnText}>🗺️ Ver no Mapa</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>📋 Prancheta de Campo</Text>
        <Text style={styles.subtitle}>{event.config.name}</Text>

        {/* Progress Bar */}
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>
              Progresso do Território: {overallStats.worked} de {overallStats.total} unidades ({overallStats.percent}%)
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[styles.progressBarFill, { width: `${overallStats.percent}%` }]}
            />
          </View>
        </View>
      </View>

      {/* Search and Filters */}
      <View style={styles.filterSection}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍 Buscar rua, número ou anotação..."
          placeholderTextColor="#6F7E94"
        />

        <View style={styles.filterTabs}>
          <Pressable
            onPress={() => setFilterMode('all')}
            style={[styles.tabBtn, filterMode === 'all' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, filterMode === 'all' && styles.tabTextActive]}>
              Todas ({overallStats.total})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode('pending')}
            style={[styles.tabBtn, filterMode === 'pending' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, filterMode === 'pending' && styles.tabTextActive]}>
              Pendentes ({overallStats.pending})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode('worked')}
            style={[styles.tabBtn, filterMode === 'worked' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, filterMode === 'worked' && styles.tabTextActive]}>
              Trabalhadas ({overallStats.worked})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Checklist Groups */}
      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum endereço encontrado</Text>
            <Text style={styles.emptyDesc}>
              Tente alterar os filtros de busca ou importe novos territórios via CSV.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.groupKey} style={styles.groupCard}>
              {/* Group Header */}
              <View style={styles.groupHeader}>
                <View style={styles.groupHeaderLeft}>
                  <Text style={styles.groupKeyBadge}>{group.groupKey}</Text>
                  <Text style={styles.groupTitle}>{group.groupLabel}</Text>
                </View>
                <Pressable
                  onPress={() => handleToggleQuadra(group)}
                  style={[
                    styles.batchToggleBtn,
                    group.isAllWorked ? styles.batchBtnReset : styles.batchBtnComplete,
                  ]}
                >
                  <Text style={styles.batchBtnText}>
                    {group.isAllWorked ? 'Desmarcar Quadra' : '✓ Concluir Quadra'}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.groupProgressText}>
                {group.worked}/{group.total} casas concluídas
              </Text>

              {/* Items in Quadra */}
              <View style={styles.itemsList}>
                {group.items.map((item) => {
                  const meta = (item.meta || {}) as Record<string, any>;
                  const isWorked = Number(meta.worked) === 1;

                  return (
                    <View
                      key={item.key}
                      style={[
                        styles.itemRow,
                        isWorked ? styles.itemRowWorked : styles.itemRowPending,
                      ]}
                    >
                      {/* Left: Instant Checkbox Toggle */}
                      <Pressable
                        onPress={() => handleToggleItem(item.key)}
                        style={[
                          styles.checkboxBtn,
                          isWorked ? styles.checkboxWorked : styles.checkboxPending,
                        ]}
                      >
                        <Text style={styles.checkboxIcon}>
                          {isWorked ? '✓' : ''}
                        </Text>
                      </Pressable>

                      {/* Middle: Key and Street Info */}
                      <View style={styles.itemInfo}>
                        <View style={styles.itemKeyRow}>
                          <Text style={styles.itemKeyText}>{item.key}</Text>
                          {meta.notes ? (
                            <View style={styles.noteIndicatorBadge}>
                              <Text style={styles.noteIndicatorText}>📝 Anotação</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.itemLabel}>{item.label}</Text>
                        {meta.notes ? (
                          <Text style={styles.itemNoteSnippet} numberOfLines={2}>
                            "{meta.notes}"
                          </Text>
                        ) : null}
                      </View>

                      {/* Right: Quick Note Edit Button */}
                      <Pressable
                        onPress={() => openNoteEditor(item)}
                        style={styles.addNoteBtn}
                      >
                        <Text style={styles.addNoteBtnIcon}>✏️</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Note Editor Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={!!activeNoteKey}
        onRequestClose={() => setActiveNoteKey(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📝 Anotação de Campo</Text>
              <Pressable onPress={() => setActiveNoteKey(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Registre observações sobre o morador, melhor horário para revisita ou alertas:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Ex: Não bater campainha, chamar no portão. Morador idoso..."
              placeholderTextColor="#6F7E94"
              multiline
              autoFocus
            />
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setActiveNoteKey(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSaveNote} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveText}>Salvar Anotação</Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '500',
  },
  mapLinkBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapLinkBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8A94A6',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  progressBarWrapper: {
    marginTop: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#161A24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 10,
  },
  searchInput: {
    backgroundColor: '#1A1F2C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  tabText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFB800',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    color: '#8A94A6',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  groupCard: {
    backgroundColor: '#1A1F2C',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupKeyBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  groupTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  batchToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  batchBtnComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  batchBtnReset: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  batchBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  groupProgressText: {
    color: '#8A94A6',
    fontSize: 11,
    marginBottom: 12,
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  itemRowWorked: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  itemRowPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkboxBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkboxWorked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxPending: {
    backgroundColor: 'transparent',
    borderColor: '#4F5E74',
  },
  checkboxIcon: {
    color: '#062016',
    fontWeight: '900',
    fontSize: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  itemKeyText: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  noteIndicatorBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  noteIndicatorText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '600',
  },
  itemLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemNoteSnippet: {
    color: '#9CA3AF',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  addNoteBtn: {
    padding: 8,
  },
  addNoteBtnIcon: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1A1F2C',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseText: {
    color: '#8A94A6',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSub: {
    color: '#8A94A6',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  modalInput: {
    backgroundColor: '#12151C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    padding: 12,
    fontSize: 13,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#062016',
    fontSize: 13,
    fontWeight: '700',
  },
});
