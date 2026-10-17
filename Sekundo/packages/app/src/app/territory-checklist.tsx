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

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import {
  pathKey,
  calculateDaysDifference,
  buildWorkedMeta,
  resolveTerritoryNumber,
  buildTerritoriosS13HistoricalRegistry,
} from '@sekundo/core';
import type { FlatSkeletonEntry } from '@sekundo/core';
import { AddressEditModal } from '../components/territory/AddressEditModal';
import { TerritoryAccordionHeader } from '../components/territory/TerritoryAccordionHeader';

interface ChecklistGroup {
  groupKey: string;
  groupLabel: string;
  items: FlatSkeletonEntry[];
  total: number;
  worked: number;
  isAllWorked: boolean;
  assignedAt?: string;
  completedAt?: string;
  daysSinceCompleted: number | null;
}

export default function TerritoryChecklistScreen() {
  const router = useRouter();
  const { id, territory } = useLocalSearchParams();
  const rawEventId = typeof id === 'string' ? id : '';
  const focusTerritory = typeof territory === 'string' ? territory : '';

  const { events } = useLocalEvent();
  const event = useMemo(() => {
    if (rawEventId) {
      return events.find((e) => e.config.id === rawEventId) || events[0];
    }
    return events[0];
  }, [events, rawEventId]);
  const eventId = event?.config.id || rawEventId;
  const { flatRegistry: rawFlatRegistry, updateNode, updateNodes, loading } = useSkeleton(eventId);
  const fallbackRegistry = useMemo(() => buildTerritoriosS13HistoricalRegistry(), []);
  const flatRegistry = useMemo(
    () => (rawFlatRegistry && rawFlatRegistry.length > 0 ? rawFlatRegistry : fallbackRegistry),
    [rawFlatRegistry, fallbackRegistry]
  );

  // Accordion state: everything collapsed by default. Keys: `T:<territory>` / `G:<groupKey>`.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const focusAppliedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'worked'>('all');
  const [sortOrder, setSortOrder] = useState<'hierarchical' | 'priority_oldest_first' | 'recent_first'>('hierarchical');
  const [activeNoteKey, setActiveNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);

  // Extract territory items and group by closest parent group
  const { groups, overallStats } = useMemo(() => {
    const groupMap = new Map<string, { label: string; items: FlatSkeletonEntry[] }>();

    // 1. Collect all parent keys of every node in flatRegistry
    const allParentKeys = new Set<string>();
    for (const node of flatRegistry) {
      const p = pathKey.parent(node.key);
      if (p) allParentKeys.add(p);
    }

    // 2. Identify parent groups (nodes that have children or explicit headers)
    for (const node of flatRegistry) {
      if (allParentKeys.has(node.key) || node.type === 'header') {
        if (!groupMap.has(node.key)) {
          groupMap.set(node.key, { label: node.label, items: [] });
        }
      }
    }

    // Fallback if no parent nodes exist
    if (groupMap.size === 0) {
      for (const node of flatRegistry) {
        const rootKey = pathKey.root(node.key);
        if (!groupMap.has(rootKey)) {
          groupMap.set(rootKey, { label: `Setor ${rootKey}`, items: [] });
        }
      }
    }

    // 3. Assign leaf work items into their closest ancestor group
    for (const node of flatRegistry) {
      // Skip parent nodes (they act as container cards, not leaf checklist items)
      if (allParentKeys.has(node.key)) {
        continue;
      }

      if (node.type === 'territory' || node.type === 'slot') {
        let parentKey = pathKey.parent(node.key);
        let assigned = false;
        while (parentKey) {
          if (groupMap.has(parentKey)) {
            groupMap.get(parentKey)!.items.push(node);
            assigned = true;
            break;
          }
          parentKey = pathKey.parent(parentKey);
        }

        if (!assigned) {
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
          const matchGroup = (data.label || '').toLowerCase().includes(q) || groupKey.toLowerCase().includes(q);
          const matchLabel = item.label.toLowerCase().includes(q);
          const matchKey = item.key.toLowerCase().includes(q);
          const matchNote = String(meta.notes || '').toLowerCase().includes(q);
          return matchGroup || matchLabel || matchKey || matchNote;
        }

        return true;
      });

      if (filtered.length > 0) {
        const total = filtered.length;
        const worked = filtered.filter((i) => Number((i.meta as any)?.worked) === 1).length;
        const isAllWorked = total > 0 && worked === total;

        // Extract dates
        let groupAssignedAt: string | undefined;
        let latestCompletedAt: string | undefined;

        for (const item of filtered) {
          const m = (item.meta || {}) as Record<string, any>;
          const itemAssigned = m.assignedAt || m.assigned_date || m.data_designacao;
          if (itemAssigned) {
            if (!groupAssignedAt || itemAssigned < groupAssignedAt) {
              groupAssignedAt = itemAssigned;
            }
          }
          const itemCompleted = m.completedAt || m.completed_date || m.data_conclusao;
          if (itemCompleted) {
            if (!latestCompletedAt || itemCompleted > latestCompletedAt) {
              latestCompletedAt = itemCompleted;
            }
          }
        }

        const effectiveCompletedAt = isAllWorked ? latestCompletedAt : undefined;
        const daysSinceCompleted =
          isAllWorked && effectiveCompletedAt ? calculateDaysDifference(effectiveCompletedAt) : null;

        result.push({
          groupKey,
          groupLabel: data.label || `Território / Quadra ${groupKey}`,
          items: filtered,
          total,
          worked,
          isAllWorked,
          assignedAt: groupAssignedAt,
          completedAt: effectiveCompletedAt,
          daysSinceCompleted,
        });
      }
    }

    // Sort groups based on user selection
    if (sortOrder === 'recent_first') {
      result.sort((a, b) => {
        if (a.isAllWorked && !b.isAllWorked) return -1;
        if (!a.isAllWorked && b.isAllWorked) return 1;
        if (a.isAllWorked && b.isAllWorked) {
          return (a.daysSinceCompleted ?? 999999) - (b.daysSinceCompleted ?? 999999);
        }
        return b.worked - a.worked;
      });
    } else if (sortOrder === 'priority_oldest_first') {
      result.sort((a, b) => {
        // Incomplete / unworked first
        if (!a.isAllWorked && b.isAllWorked) return -1;
        if (a.isAllWorked && !b.isAllWorked) return 1;
        if (!a.isAllWorked && !b.isAllWorked) {
          const pA = a.total > 0 ? a.worked / a.total : 0;
          const pB = b.total > 0 ? b.worked / b.total : 0;
          return pA - pB;
        }
        // Both completed: completed longest ago first
        return (b.daysSinceCompleted ?? 0) - (a.daysSinceCompleted ?? 0);
      });
    } else {
      // Default: hierarchical order
      result.sort((a, b) => pathKey.compare(a.groupKey, b.groupKey));
    }

    // Overall metrics for leaf items
    let overallTotal = 0;
    let overallWorked = 0;
    flatRegistry.forEach((n) => {
      if ((n.type === 'territory' || n.type === 'slot') && !allParentKeys.has(n.key)) {
        overallTotal++;
        if (Number((n.meta as any)?.worked) === 1) {
          overallWorked++;
        }
      }
    });
    const percent = overallTotal > 0 ? Math.round((overallWorked / overallTotal) * 100) : 0;
    const stats = {
      total: overallTotal,
      worked: overallWorked,
      percent,
      pending: overallTotal - overallWorked,
    };

    return { groups: result, overallStats: stats };
  }, [flatRegistry, searchQuery, filterMode, sortOrder]);

  // Nest groups by territory, preserving the selected group order.
  const territorySections = useMemo(() => {
    const sections: {
      territory: string;
      groups: ChecklistGroup[];
      total: number;
      worked: number;
      daysSinceCompleted: number | null;
    }[] = [];
    const index = new Map<string, number>();
    for (const group of groups) {
      const t = group.items.length > 0 ? resolveTerritoryNumber(group.items[0]) : group.groupKey;
      if (!index.has(t)) {
        index.set(t, sections.length);
        sections.push({ territory: t, groups: [], total: 0, worked: 0, daysSinceCompleted: null });
      }
      const s = sections[index.get(t)!];
      s.groups.push(group);
      s.total += group.total;
      s.worked += group.worked;
      if (typeof group.daysSinceCompleted === 'number') {
        s.daysSinceCompleted =
          s.daysSinceCompleted === null
            ? group.daysSinceCompleted
            : Math.min(s.daysSinceCompleted, group.daysSinceCompleted);
      }
    }
    return sections;
  }, [groups]);

  // Deep link `?territory=` (e.g. from the map) pre-expands that territory once.
  useEffect(() => {
    if (focusAppliedRef.current || !focusTerritory || territorySections.length === 0) return;
    const section = territorySections.find((s) => s.territory === focusTerritory);
    if (!section) return;
    focusAppliedRef.current = true;
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.add(`T:${section.territory}`);
      if (section.groups.length === 1) next.add(`G:${section.groups[0].groupKey}`);
      return next;
    });
  }, [focusTerritory, territorySections]);

  // An active search shows every match without touching the saved accordion state.
  const searchActive = searchQuery.trim().length > 0;
  const isExpanded = (k: string) => searchActive || expandedKeys.has(k);
  const toggleExpanded = (k: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const expandAll = () => {
    const next = new Set<string>();
    for (const s of territorySections) {
      next.add(`T:${s.territory}`);
      for (const g of s.groups) next.add(`G:${g.groupKey}`);
    }
    setExpandedKeys(next);
  };
  const collapseAll = () => setExpandedKeys(new Set());

  // Toggle single item work status
  const handleToggleItem = async (targetKey: string) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, targetKey));
    if (!target) return;
    const meta = (target.meta || {}) as Record<string, any>;
    const nextWorked = Number(meta.worked) === 1 ? 0 : 1;

    await updateNode(targetKey, {
      value: nextWorked === 1 ? (meta.workerName || 'Trabalhado') : '',
      meta: buildWorkedMeta(meta, nextWorked),
    });
  };

  // Batch toggle all items in a quadra — one atomic write, no lost updates.
  const handleToggleQuadra = async (group: ChecklistGroup) => {
    const targetStatus: 0 | 1 = group.isAllWorked ? 0 : 1;
    const now = new Date();

    await updateNodes(
      group.items.map((item) => {
        const meta = (item.meta || {}) as Record<string, any>;
        return {
          key: item.key,
          updates: {
            value: targetStatus === 1 ? (meta.workerName || 'Trabalhado') : '',
            meta: buildWorkedMeta(meta, targetStatus, now),
          },
        };
      })
    );
  };

  // Batch toggle all items in an entire territory section — one atomic write.
  const handleToggleTerritory = async (section: {
    territory: string;
    groups: ChecklistGroup[];
    total: number;
    worked: number;
  }) => {
    const allItems = section.groups.flatMap((g) => g.items);
    if (allItems.length === 0) return;
    const isAllDone = section.total > 0 && section.worked === section.total;
    const targetStatus: 0 | 1 = isAllDone ? 0 : 1;
    const now = new Date();

    await updateNodes(
      allItems.map((item) => {
        const meta = (item.meta || {}) as Record<string, any>;
        return {
          key: item.key,
          updates: {
            value: targetStatus === 1 ? (meta.workerName || 'Trabalhado') : '',
            meta: buildWorkedMeta(meta, targetStatus, now),
          },
        };
      })
    );
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

  if (loading && flatRegistry.length === 0) {
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
            onPress={() => router.replace(eventId ? `/skeleton-editor?id=${eventId}` : '/')}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Voltar</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() =>
                router.push(
                  `/publisher?id=${eventId}${focusTerritory ? `&territory=${encodeURIComponent(focusTerritory)}` : ''}`
                )
              }
              style={styles.mapLinkBtn}
            >
              <Text style={styles.mapLinkBtnText}>📱 Modo Operador de Campo</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push(
                  `/territory-map?id=${eventId}${focusTerritory ? `&territory=${encodeURIComponent(focusTerritory)}` : ''}`
                )
              }
              style={styles.mapLinkBtn}
            >
              <Text style={styles.mapLinkBtnText}>🗺️ Ver no Mapa</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.title}>📋 Prancheta de Campo</Text>
        <Text style={styles.subtitle}>{event?.config.name ?? 'Malha Territorial Sintética'}</Text>

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

        {/* Recency Sort Selector */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>ORDENAÇÃO:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => setSortOrder('hierarchical')}
              style={[styles.sortChip, sortOrder === 'hierarchical' && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sortOrder === 'hierarchical' && styles.sortChipTextActive]}>
                📌 Padrão (Código)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortOrder('priority_oldest_first')}
              style={[styles.sortChip, sortOrder === 'priority_oldest_first' && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sortOrder === 'priority_oldest_first' && styles.sortChipTextActive]}>
                ⏳ Prioridade (Pendentes & Antigos)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortOrder('recent_first')}
              style={[styles.sortChip, sortOrder === 'recent_first' && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sortOrder === 'recent_first' && styles.sortChipTextActive]}>
                ⚡ Mais Recentes (Menos dias)
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>

      {/* Checklist Groups */}
      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {groups.length > 0 ? (
          <View style={styles.accordionToolbar}>
            <Text style={styles.accordionToolbarText}>
              {territorySections.length} {territorySections.length === 1 ? 'território' : 'territórios'} • {groups.length} grupos
              {searchActive ? ' • busca ativa' : ''}
            </Text>
            <View style={styles.accordionToolbarActions}>
              <Pressable onPress={expandAll} style={styles.accordionToolbarBtn}>
                <Text style={styles.accordionToolbarBtnText}>▾ Expandir tudo</Text>
              </Pressable>
              <Pressable onPress={collapseAll} style={styles.accordionToolbarBtn}>
                <Text style={styles.accordionToolbarBtnText}>▸ Recolher tudo</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum endereço encontrado</Text>
            <Text style={styles.emptyDesc}>
              Tente alterar os filtros de busca ou importe novos territórios via CSV.
            </Text>
          </View>
        ) : (
          territorySections.map((section) => {
            // A territory with a single group is not double-nested.
            const single = section.groups.length === 1;
            const sectionOpen = single || isExpanded(`T:${section.territory}`);
            return (
          <View key={`T:${section.territory}`} style={single ? undefined : styles.territorySection}>
            {!single ? (
              <TerritoryAccordionHeader
                territory={section.territory}
                groupCount={section.groups.length}
                worked={section.worked}
                total={section.total}
                expanded={sectionOpen}
                daysSinceCompleted={section.daysSinceCompleted}
                onToggle={() => toggleExpanded(`T:${section.territory}`)}
                onBatchToggle={() => handleToggleTerritory(section)}
                onOpenPublisher={() =>
                  router.push(`/publisher?id=${eventId}&territory=${encodeURIComponent(section.territory)}`)
                }
              />
            ) : null}
          {sectionOpen && section.groups.map((group) => {
            const groupOpen = isExpanded(`G:${group.groupKey}`);
            return (
            <View key={group.groupKey} style={[styles.groupCard, !single && styles.groupCardNested]}>
              {/* Group Header */}
              <View style={styles.groupHeader}>
                <Pressable
                  onPress={() => toggleExpanded(`G:${group.groupKey}`)}
                  style={styles.groupHeaderLeft}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: groupOpen }}
                >
                  <Text style={styles.groupChevron}>{groupOpen ? '▾' : '▸'}</Text>
                  <Text style={styles.groupKeyBadge}>{group.groupKey}</Text>
                  <Text style={styles.groupTitle} numberOfLines={groupOpen ? undefined : 1}>{group.groupLabel}</Text>
                </Pressable>
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

              {/* Group Recency & Progress Meta */}
              <View style={styles.groupMetaBar}>
                <Text style={styles.groupProgressText}>
                  {group.worked}/{group.total} casas concluídas
                </Text>
                {group.isAllWorked ? (
                  <View style={styles.groupCompletedBadge}>
                    <Text style={styles.groupCompletedBadgeText}>
                      🏆 Concluído {group.daysSinceCompleted === 0 ? 'hoje' : (group.daysSinceCompleted === 1 ? 'ontem (1d)' : `há ${group.daysSinceCompleted} dias`)} ({group.completedAt})
                    </Text>
                  </View>
                ) : (
                  <View style={styles.groupPendingBadge}>
                    <Text style={styles.groupPendingBadgeText}>
                      ⏳ Em andamento
                    </Text>
                  </View>
                )}
                {group.assignedAt ? (
                  <Text style={styles.groupAssignedText}>
                    📅 Designado: {group.assignedAt}
                  </Text>
                ) : null}
              </View>

              {/* Items in Quadra (not rendered while collapsed) */}
              {groupOpen ? (
              <View style={styles.itemsList}>
                {group.items.map((item) => {
                  const meta = (item.meta || {}) as Record<string, any>;
                  const isWorked = Number(meta.worked) === 1;

                  const line = meta.line || '';
                  const line2 = meta.line2 || meta.neighborhood || meta.bairro || '';
                  const city = meta.city || meta.cidade || '';
                  const postalcode = meta.postalcode || meta.cep || '';
                  const propType = meta.property_type || meta.tipo_imovel || 'residencial';
                  const isForeign = Boolean(meta.is_foreign || meta.foreign || meta.language || meta.estrangeiro);
                  const foreignLang = meta.language || meta.idioma || '';
                  const latNum = meta.lat != null ? Number(meta.lat) : (meta.latitude != null ? Number(meta.latitude) : undefined);
                  const lngNum = meta.lng != null ? Number(meta.lng) : (meta.longitude != null ? Number(meta.longitude) : undefined);

                  const propTypeLabels: Record<string, string> = {
                    residencial: '🏠 Residência',
                    comercial: '🏢 Comércio',
                    predio: '🏙️ Prédio',
                    outro: '📦 Outro',
                  };

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

                      {/* Middle: Full Address Breakdown */}
                      <Pressable
                        onPress={() => setEditingAddressItem(item)}
                        style={styles.itemInfo}
                      >
                        <View style={styles.itemKeyRow}>
                          <Text style={styles.itemKeyText}>{item.key}</Text>
                          {meta.territory_number ? (
                            <View style={styles.territoryNumberBadge}>
                              <Text style={styles.territoryNumberText}>{meta.territory_number}</Text>
                            </View>
                          ) : null}
                          <View style={styles.propTypeBadge}>
                            <Text style={styles.propTypeText}>{propTypeLabels[propType] || '🏠 Residência'}</Text>
                          </View>
                          {isForeign ? (
                            <View style={styles.foreignBadge}>
                              <Text style={styles.foreignBadgeText}>
                                🌐 {foreignLang ? foreignLang : 'Estrangeiro'}
                              </Text>
                            </View>
                          ) : null}
                          {meta.notes ? (
                            <View style={styles.noteIndicatorBadge}>
                              <Text style={styles.noteIndicatorText}>📝 Nota</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Main Address / Street Line */}
                        <Text style={styles.itemLabel}>
                          {line || item.label}
                        </Text>

                        {/* Subtitle: Neighborhood, City, CEP */}
                        {(line2 || city || postalcode) ? (
                          <Text style={styles.addressSubDetail}>
                            {[line2, city, postalcode ? `CEP: ${postalcode}` : null]
                              .filter(Boolean)
                              .join(' • ')}
                          </Text>
                        ) : null}

                        {/* Coordinates */}
                        {latNum != null && lngNum != null && !isNaN(latNum) && !isNaN(lngNum) ? (
                          <Text style={styles.coordsText}>
                            🧭 {latNum.toFixed(5)}, {lngNum.toFixed(5)}
                          </Text>
                        ) : null}

                        {/* Dates Row: Assigned & Completed */}
                        {(() => {
                          const itemAssigned = meta.assignedAt || meta.assigned_date || meta.data_designacao;
                          const itemCompleted = meta.completedAt || meta.completed_date || meta.data_conclusao;
                          const itemDays = itemCompleted ? calculateDaysDifference(String(itemCompleted)) : null;

                          if (!itemAssigned && !itemCompleted) return null;

                          return (
                            <View style={styles.itemDatesRow}>
                              {itemAssigned ? (
                                <View style={styles.itemDateBadge}>
                                  <Text style={styles.itemDateText}>
                                    📅 Desig: {String(itemAssigned)}
                                  </Text>
                                </View>
                              ) : null}
                              {itemCompleted ? (
                                <View style={styles.itemDateBadgeCompleted}>
                                  <Text style={styles.itemDateTextCompleted}>
                                    ✓ Concl: {String(itemCompleted)}
                                    {itemDays !== null
                                      ? itemDays === 0
                                        ? ' (hoje)'
                                        : itemDays === 1
                                        ? ' (ontem)'
                                        : ` (há ${itemDays}d)`
                                      : ''}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })()}

                        {/* Field Notes Snippet */}
                        {meta.notes ? (
                          <Text style={styles.itemNoteSnippet} numberOfLines={2}>
                            "{meta.notes}"
                          </Text>
                        ) : null}
                      </Pressable>

                      {/* Right: Actions */}
                      <View style={styles.actionButtonsCol}>
                        <Pressable
                          onPress={() => setEditingAddressItem(item)}
                          style={styles.editAddressBtn}
                          accessibilityLabel="Editar Endereço Completo"
                        >
                          <Text style={styles.editAddressBtnText}>✏️ Editar</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => openNoteEditor(item)}
                          style={styles.addNoteBtn}
                          accessibilityLabel="Anotação Rápida"
                        >
                          <Text style={styles.addNoteBtnIcon}>📝</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
              ) : null}
            </View>
            );
          })}
          </View>
            );
          })
        )}
      </ScrollView>

      {/* Address Edit Full Modal */}
      <AddressEditModal
        visible={!!editingAddressItem}
        item={editingAddressItem}
        onClose={() => setEditingAddressItem(null)}
        onSave={async (key, updates) => {
          await updateNode(key, updates);
        }}
      />

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
              <Text style={styles.modalTitle}>📝 Observação Operacional</Text>
              <Pressable onPress={() => setActiveNoteKey(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Registre observações sobre o local/ponto, melhor janela de atendimento ou alertas:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Ex: Acesso pela portaria lateral, atendimento apenas em horário comercial..."
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
    flexWrap: 'wrap',
    gap: 8,
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
    flexWrap: 'wrap',
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
  groupCardNested: {
    marginLeft: 12,
    padding: 12,
  },
  groupChevron: {
    color: '#8A94A6',
    fontSize: 16,
    width: 14,
    textAlign: 'center',
  },
  territorySection: {
    gap: 10,
  },
  accordionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  accordionToolbarText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  accordionToolbarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  accordionToolbarBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  accordionToolbarBtnText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 180,
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
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sortLabel: {
    color: '#8A94A6',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderColor: '#FFB800',
  },
  sortChipText: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#FFB800',
    fontWeight: '700',
  },
  groupProgressText: {
    color: '#8A94A6',
    fontSize: 11,
  },
  groupMetaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  groupCompletedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  groupCompletedBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  groupPendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  groupPendingBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  groupAssignedText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  itemDatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  itemDateBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  itemDateText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
  },
  itemDateBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  itemDateTextCompleted: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
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
    flexWrap: 'wrap',
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
  territoryNumberBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  territoryNumberText: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '700',
  },
  propTypeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  propTypeText: {
    color: '#C3D0E5',
    fontSize: 10,
    fontWeight: '600',
  },
  foreignBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  foreignBadgeText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
  },
  addressSubDetail: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  coordsText: {
    color: '#6F7E94',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  actionButtonsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  editAddressBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editAddressBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  addNoteBtn: {
    padding: 6,
  },
  addNoteBtnIcon: {
    fontSize: 15,
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
