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
  selectEnginePartitionNodes,
  extractQuadrasFromRegistry,
  parseLatLng,
  calculateMapRoute,
  calculateMultiStopMapRoute,
  buildWalkingSequenceRoute,
  formatRouteDistance,
  formatRouteDuration,
  resolveTerritoryNameFromNodes,
  updateSingleNodeInCleanRegistry,
  formatShareAddressLocationText,
  formatShareTerritoryOrQuadraLocationsText,
} from '@sekundo/core';
import type {
  FlatSkeletonEntry,
  QuadraSummary,
  RouteCalculationResult,
  WalkingSequenceRoute,
} from '@sekundo/core';
import { AddressEditModal } from '../components/territory/AddressEditModal';
import { TerritoryAccordionHeader } from '../components/territory/TerritoryAccordionHeader';
import {
  TerritoryManageModal,
  type TerritoryManageTab,
} from '../components/territory/TerritoryManageModal';
import { QuickShareSheet } from '../components/share/QuickShareSheet';
import { MultiEngineSwitcherBar } from '../components/ui/MultiEngineSwitcherBar';
import {
  loadSavedTerritoryRegistry,
  persistTerritoryRegistryMutation,
  exportUpdatedTerritoryModelCsvFromStorage,
  triggerCsvFileDownloadOrCopy,
  shareLocationPayload,
} from '../storage/omniStorageBridge';
import { TerritoryLeafletMap } from '../components/map/TerritoryLeafletMap';
import type { MapPin } from '../components/map/mapTypes';
import { useLiveGpsLocation, openExternalGoogleMaps } from '../hooks/useLiveGpsLocation';

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
    return events.find((e) => (e.config.activeEngines || []).includes('territory_logistics')) || events[0];
  }, [events, rawEventId]);
  const eventId = event?.config.id || rawEventId;
  const { flatRegistry: rawFlatRegistry, saveSkeleton, loading } = useSkeleton(eventId);
  const [savedTerritoryRegistry, setSavedTerritoryRegistry] = useState<FlatSkeletonEntry[]>([]);
  useEffect(() => {
    loadSavedTerritoryRegistry()
      .then((reg) => {
        if (reg && reg.length > 0) setSavedTerritoryRegistry(reg);
      })
      .catch(() => undefined);
  }, [rawFlatRegistry]);

  const fallbackRegistry = useMemo(() => buildTerritoriosS13HistoricalRegistry(), []);
  const flatRegistry = useMemo(() => {
    const savedPartitioned = selectEnginePartitionNodes(savedTerritoryRegistry, 'territory_logistics');
    if (savedPartitioned.length > 0) return savedPartitioned;
    const partitioned = selectEnginePartitionNodes(rawFlatRegistry || [], 'territory_logistics');
    if (partitioned.length > 0) return partitioned;
    return fallbackRegistry;
  }, [rawFlatRegistry, savedTerritoryRegistry, fallbackRegistry]);

  // Accordion state: everything collapsed by default. Keys: `T:<territory>` / `G:<groupKey>`.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const focusAppliedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'worked'>('all');
  const [sortOrder, setSortOrder] = useState<'hierarchical' | 'priority_oldest_first' | 'recent_first'>('hierarchical');
  const [activeNoteKey, setActiveNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);

  // In-App Territory CRUD & CSV Export Modal State
  const [manageModalOpen, setManageModalOpen] = useState<boolean>(false);
  const [manageModalTab, setManageModalTab] = useState<TerritoryManageTab>('edit');
  const [manageTargetTerritory, setManageTargetTerritory] = useState<string | undefined>(undefined);
  const [manageTargetGroupKey, setManageTargetGroupKey] = useState<string | undefined>(undefined);
  const [manageTargetGroupLabel, setManageTargetGroupLabel] = useState<string | undefined>(undefined);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [quickShareOpen, setQuickShareOpen] = useState<boolean>(false);
  const [quickShareTerritories, setQuickShareTerritories] = useState<string[]>([]);

  const openTerritoryManager = (
    tab: TerritoryManageTab,
    targetTerr?: string,
    groupKey?: string,
    groupLabel?: string
  ) => {
    setManageModalTab(tab);
    setManageTargetTerritory(targetTerr || focusTerritory || undefined);
    setManageTargetGroupKey(groupKey);
    setManageTargetGroupLabel(groupLabel);
    setManageModalOpen(true);
  };

  const commitTerritoryNodes = async (
    nextCleanNodes: FlatSkeletonEntry[],
    metaInfo?: { activeTerritoryNumber?: string; message?: string }
  ) => {
    setSavedTerritoryRegistry(nextCleanNodes);
    await persistTerritoryRegistryMutation({
      eventId,
      cleanTerritoryNodes: nextCleanNodes,
      rawRegistry: rawFlatRegistry,
      saveSkeletonFn: saveSkeleton,
    });
    if (metaInfo?.activeTerritoryNumber) {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.add(`T:${metaInfo.activeTerritoryNumber}`);
        return next;
      });
    }
    if (metaInfo?.message) {
      setActionToast(metaInfo.message);
      setTimeout(() => setActionToast(null), 4000);
    }
  };

  // Embedded Territory Map (Modo Campo inline inside Checklist) + Live GPS & In-Map Routing
  const [inlineMapTerritory, setInlineMapTerritory] = useState<string | null>(null);
  const [inlineMapMode, setInlineMapMode] = useState<'quadras' | 'pins'>('quadras');
  const [inlineMapWalkOrder, setInlineMapWalkOrder] = useState<boolean>(true);
  const [inlineMapFitRequest, setInlineMapFitRequest] = useState<number>(0);
  const [inlineSelectedKey, setInlineSelectedKey] = useState<string | null>(null);
  const {
    gpsEnabled,
    userLocation,
    gpsError,
    panToUserRequest,
    toggleGps,
    enableGpsAndGetPosition,
    setManualOrigin,
    centerOnUser,
  } = useLiveGpsLocation();
  const [activeRoute, setActiveRoute] = useState<RouteCalculationResult | null>(null);
  const [routeDestinationMeta, setRouteDestinationMeta] = useState<{
    label: string;
    lat: number;
    lng: number;
    city?: string;
    streetName?: string;
  } | null>(null);
  const [routingBusy, setRoutingBusy] = useState<boolean>(false);
  const [pickingOriginMode, setPickingOriginMode] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const allQuadras = useMemo<QuadraSummary[]>(
    () => extractQuadrasFromRegistry(flatRegistry),
    [flatRegistry]
  );

  const toggleInlineMapForTerritory = (territoryNum: string) => {
    setInlineMapTerritory((prev) => {
      if (prev === territoryNum) return null;
      setInlineMapFitRequest((n) => n + 1);
      return territoryNum;
    });
  };

  const resolveOperatorOrigin = async (): Promise<{ lat: number; lng: number } | null> => {
    if (userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    const gpsFix = await enableGpsAndGetPosition(3500);
    if (gpsFix) {
      return { lat: gpsFix.lat, lng: gpsFix.lng };
    }
    setPickingOriginMode(true);
    setRouteError(
      'GPS indisponível. Clique no mapa onde você está agora para definir sua partida (ou ative a permissão de localização).'
    );
    return null;
  };

  const handleTraceRouteInChecklistMap = async (
    territoryNum: string,
    dest: {
      lat: number;
      lng: number;
      label: string;
      city?: string;
      streetName?: string;
    }
  ) => {
    setRoutingBusy(true);
    setRouteError(null);
    if (inlineMapTerritory !== territoryNum) {
      setInlineMapTerritory(territoryNum);
      setInlineMapFitRequest((n) => n + 1);
    }
    try {
      const origin = await resolveOperatorOrigin();
      if (!origin) return;
      const route = await calculateMapRoute(origin, { lat: dest.lat, lng: dest.lng }, 'foot', 4000);
      setActiveRoute(route);
      setRouteDestinationMeta(dest);
    } finally {
      setRoutingBusy(false);
    }
  };

  const handleTraceQuadraAddressesInChecklistMap = async (
    territoryNum: string,
    quadraKey: string,
    sectionCity?: string
  ) => {
    const q = allQuadras.find((x) => x.territoryNumber === territoryNum && x.key === quadraKey);
    if (!q) return;
    setRoutingBusy(true);
    setRouteError(null);
    if (inlineMapTerritory !== territoryNum) {
      setInlineMapTerritory(territoryNum);
      setInlineMapFitRequest((n) => n + 1);
    }
    try {
      const origin = await resolveOperatorOrigin();
      if (!origin) return;
      const unitCoords = q.streets
        .flatMap((s) =>
          s.units.map((u) => ({
            key: u.key,
            label: `${s.streetName}, ${u.numberOrComplement}`,
            streetName: s.streetName,
            numberOrComplement: u.numberOrComplement,
            lat: u.lat ?? q.centerLat,
            lng: u.lng ?? q.centerLng,
            worked: u.worked,
          }))
        )
        .filter((u) => u.worked === 0);
      const targetUnits =
        unitCoords.length > 0
          ? unitCoords
          : q.streets.flatMap((s) =>
              s.units.map((u) => ({
                key: u.key,
                label: `${s.streetName}, ${u.numberOrComplement}`,
                streetName: s.streetName,
                numberOrComplement: u.numberOrComplement,
                lat: u.lat ?? q.centerLat,
                lng: u.lng ?? q.centerLng,
                worked: u.worked,
              }))
            );
      const orderedStops = buildWalkingSequenceRoute(targetUnits, 'sidewalk', origin);
      const stops =
        orderedStops.length > 0
          ? orderedStops.map((s) => ({
              key: s.key,
              label: s.label,
              lat: s.lat,
              lng: s.lng,
            }))
          : [{ key: q.key, label: q.label, lat: q.centerLat, lng: q.centerLng }];
      const route = await calculateMultiStopMapRoute(origin, stops, {
        profile: 'foot',
        timeoutMs: 4500,
      });
      setActiveRoute(route);
      setRouteDestinationMeta({
        label: `${q.label} (${stops.length} paradas pelas ruas)`,
        lat: q.centerLat,
        lng: q.centerLng,
        city: sectionCity,
        streetName: q.perimeterStreets[0],
      });
    } finally {
      setRoutingBusy(false);
    }
  };

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

    const nextClean = updateSingleNodeInCleanRegistry(flatRegistry, targetKey, {
      value: nextWorked === 1 ? (meta.workerName || 'Trabalhado') : '',
      meta: buildWorkedMeta(meta, nextWorked),
    });
    await commitTerritoryNodes(nextClean);
  };

  // Batch toggle all items in a quadra — one atomic write, no lost updates.
  const handleToggleQuadra = async (group: ChecklistGroup) => {
    const targetStatus: 0 | 1 = group.isAllWorked ? 0 : 1;
    const now = new Date();
    const targetKeySet = new Set(group.items.map((i) => pathKey.normalizeKey(i.key)));

    const nextClean = flatRegistry.map((node) => {
      if (!targetKeySet.has(pathKey.normalizeKey(node.key))) return node;
      const meta = (node.meta || {}) as Record<string, any>;
      return {
        ...node,
        value: targetStatus === 1 ? (meta.workerName || 'Trabalhado') : '',
        meta: buildWorkedMeta(meta, targetStatus, now),
      };
    });
    await commitTerritoryNodes(nextClean);
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
    const targetKeySet = new Set(allItems.map((i) => pathKey.normalizeKey(i.key)));

    const nextClean = flatRegistry.map((node) => {
      if (!targetKeySet.has(pathKey.normalizeKey(node.key))) return node;
      const meta = (node.meta || {}) as Record<string, any>;
      return {
        ...node,
        value: targetStatus === 1 ? (meta.workerName || 'Trabalhado') : '',
        meta: buildWorkedMeta(meta, targetStatus, now),
      };
    });
    await commitTerritoryNodes(nextClean);
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

    const nextClean = updateSingleNodeInCleanRegistry(flatRegistry, activeNoteKey, {
      meta: {
        ...meta,
        notes: noteDraft.trim(),
      },
    });
    await commitTerritoryNodes(nextClean, { message: '📝 Observação salva na memória!' });
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
      {/* Top Header (Icon-Only Click-to-Reveal) */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <MultiEngineSwitcherBar activeRoute="territory-checklist" eventId={eventId} />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pressable
              testID="checklist-new-territory-btn"
              onPress={() => openTerritoryManager('new_territory')}
              style={[
                styles.mapLinkBtn,
                { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.16)' },
              ]}
              accessibilityLabel="Adicionar Novo Território"
            >
              <Text style={[styles.mapLinkBtnText, { color: '#34D399' }]}>➕ Novo Território</Text>
            </Pressable>
            <Pressable
              testID="checklist-edit-territory-btn"
              onPress={() => openTerritoryManager('edit')}
              style={[
                styles.mapLinkBtn,
                { borderColor: '#FFB800', backgroundColor: 'rgba(255, 184, 0, 0.16)' },
              ]}
              accessibilityLabel="Alterar Nome e Número de Território"
            >
              <Text style={[styles.mapLinkBtnText, { color: '#FFB800' }]}>✏️ Nome / Nº</Text>
            </Pressable>
            <Pressable
              testID="checklist-export-csv-btn"
              onPress={async () => {
                const { csvText, filename } = await exportUpdatedTerritoryModelCsvFromStorage(
                  flatRegistry,
                  'flat_s13'
                );
                const res = await triggerCsvFileDownloadOrCopy(csvText, filename);
                setActionToast(
                  res === 'downloaded'
                    ? `📥 Novo modelo "${filename}" exportado com as alterações!`
                    : `📋 Novo modelo "${filename}" copiado!`
                );
                setTimeout(() => setActionToast(null), 4000);
              }}
              style={[
                styles.mapLinkBtn,
                { borderColor: '#38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.16)' },
              ]}
              accessibilityLabel="Exportar Novo Modelo CSV Atualizado"
            >
              <Text style={[styles.mapLinkBtnText, { color: '#38BDF8' }]}>📤 Exportar CSV</Text>
            </Pressable>
            <Pressable
              testID="checklist-quick-share-btn"
              onPress={() => {
                setQuickShareTerritories(focusTerritory ? [focusTerritory] : []);
                setQuickShareOpen(true);
              }}
              style={[
                styles.mapLinkBtn,
                { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.22)' },
              ]}
              accessibilityLabel="Gerar Link Curto de Territórios"
            >
              <Text style={[styles.mapLinkBtnText, { color: '#34D399' }]}>🔗 Link Curto</Text>
            </Pressable>
            <Pressable
              testID="checklist-share-btn"
              onPress={() => openTerritoryManager('share_export')}
              style={[
                styles.mapLinkBtn,
                { borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.16)' },
              ]}
              accessibilityLabel="Compartilhar Localizações sem Burocracia"
            >
              <Text style={[styles.mapLinkBtnText, { color: '#4ADE80' }]}>📲 Compartilhar</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowFiltersPanel((prev) => !prev)}
              style={[
                styles.mapLinkBtn,
                (showFiltersPanel || searchQuery.trim().length > 0 || filterMode !== 'all') && {
                  borderColor: '#FFB800',
                  backgroundColor: 'rgba(255, 184, 0, 0.16)',
                },
              ]}
              accessibilityLabel="Filtrar e Ordenar Territórios"
              {...({ title: 'Filtrar e Ordenar Territórios' } as any)}
            >
              <Text style={styles.mapLinkBtnText}>🔍</Text>
            </Pressable>
            <Pressable
              onPress={expandAll}
              style={styles.mapLinkBtn}
              accessibilityLabel="Expandir Todos os Territórios"
              {...({ title: 'Expandir Todos os Territórios' } as any)}
            >
              <Text style={styles.mapLinkBtnText}>▾</Text>
            </Pressable>
            <Pressable
              onPress={collapseAll}
              style={styles.mapLinkBtn}
              accessibilityLabel="Recolher Todos os Territórios"
              {...({ title: 'Recolher Todos os Territórios' } as any)}
            >
              <Text style={styles.mapLinkBtnText}>▸</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push(
                  `/publisher?id=${eventId}${focusTerritory ? `&territory=${encodeURIComponent(focusTerritory)}` : ''}`
                )
              }
              style={styles.mapLinkBtn}
              accessibilityLabel="Modo Operador de Campo"
              {...({ title: 'Modo Operador de Campo' } as any)}
            >
              <Text style={styles.mapLinkBtnText}>📱</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push(
                  `/territory-map?id=${eventId}${focusTerritory ? `&territory=${encodeURIComponent(focusTerritory)}` : ''}`
                )
              }
              style={styles.mapLinkBtn}
              accessibilityLabel="Ver no Mapa"
              {...({ title: 'Ver no Mapa' } as any)}
            >
              <Text style={styles.mapLinkBtnText}>🗺️</Text>
            </Pressable>
          </View>
        </View>

        {actionToast ? (
          <View
            testID="checklist-action-toast"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.18)',
              borderWidth: 1,
              borderColor: '#10B981',
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
            }}
          >
            <Text style={{ color: '#34D399', fontSize: 12, fontWeight: '800' }}>{actionToast}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>📋 {territorySections.length} Territórios</Text>
          <Text style={styles.progressText}>
            {overallStats.worked}/{overallStats.total} ({overallStats.percent}%)
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarTrack}>
            <View
              style={[styles.progressBarFill, { width: `${overallStats.percent}%` }]}
            />
          </View>
        </View>
      </View>

      {/* Search and Filters (Click-to-Reveal via 🔍) */}
      {showFiltersPanel ? (
        <View style={styles.filterSection}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="🔍 Rua, número ou anotação..."
            placeholderTextColor="#6F7E94"
          />

          <View style={styles.filterTabs}>
            <Pressable
              onPress={() => setFilterMode('all')}
              style={[styles.tabBtn, filterMode === 'all' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, filterMode === 'all' && styles.tabTextActive]}>
                🌐 ({overallStats.total})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterMode('pending')}
              style={[styles.tabBtn, filterMode === 'pending' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, filterMode === 'pending' && styles.tabTextActive]}>
                ⬜ ({overallStats.pending})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterMode('worked')}
              style={[styles.tabBtn, filterMode === 'worked' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, filterMode === 'worked' && styles.tabTextActive]}>
                ✅ ({overallStats.worked})
              </Text>
            </Pressable>
          </View>

          <View style={styles.sortRow}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                onPress={() => setSortOrder('hierarchical')}
                style={[styles.sortChip, sortOrder === 'hierarchical' && styles.sortChipActive]}
                accessibilityLabel="Ordenar por Código"
              >
                <Text style={[styles.sortChipText, sortOrder === 'hierarchical' && styles.sortChipTextActive]}>
                  📌 Código
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSortOrder('priority_oldest_first')}
                style={[styles.sortChip, sortOrder === 'priority_oldest_first' && styles.sortChipActive]}
                accessibilityLabel="Ordenar por Prioridade"
              >
                <Text style={[styles.sortChipText, sortOrder === 'priority_oldest_first' && styles.sortChipTextActive]}>
                  ⏳ Prioridade
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSortOrder('recent_first')}
                style={[styles.sortChip, sortOrder === 'recent_first' && styles.sortChipActive]}
                accessibilityLabel="Ordenar por Mais Recentes"
              >
                <Text style={[styles.sortChipText, sortOrder === 'recent_first' && styles.sortChipTextActive]}>
                  ⚡ Recentes
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

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
          territorySections.map((section) => {
            // A territory with a single group is not double-nested.
            const single = section.groups.length === 1;
            const sectionOpen = single || isExpanded(`T:${section.territory}`);
            const isMapOpenForSection = inlineMapTerritory === section.territory;
            const sectionQuadras = allQuadras.filter((q) => q.territoryNumber === section.territory);
            const firstSectionItem = section.groups[0]?.items[0];
            const firstSectionMeta = (firstSectionItem?.meta || {}) as Record<string, any>;
            const sectionCity = String(firstSectionMeta.city || firstSectionMeta.cidade || '');

            const renderInlineTerritoryMap = () => {
              if (!isMapOpenForSection) return null;
              const rawSectionPins: MapPin[] = [];
              for (const g of section.groups) {
                for (const item of g.items) {
                  const m = (item.meta || {}) as Record<string, any>;
                  const coords = parseLatLng(m);
                  if (!coords) continue;
                  rawSectionPins.push({
                    key: item.key,
                    label: item.label,
                    worked: Number(m.worked) === 1 ? 1 : 0,
                    lat: coords.lat,
                    lng: coords.lng,
                    color: Number(m.worked) === 1 ? '#10B981' : '#FFB800',
                    shape: 'circle',
                    territoryNumber: section.territory,
                    city: String(m.city || m.cidade || sectionCity),
                    line: m.line ? String(m.line) : item.label,
                    propertyType: String(m.property_type || 'residencial'),
                    isForeign: Boolean(m.is_foreign || m.language),
                  });
                }
              }
              const walkingSeq: WalkingSequenceRoute | null =
                inlineMapWalkOrder && rawSectionPins.length > 0
                  ? buildWalkingSequenceRoute(
                      rawSectionPins.map((p) => {
                        const lStr = p.line || p.label;
                        const cIdx = lStr.indexOf(',');
                        return {
                          key: p.key,
                          label: lStr,
                          lat: p.lat,
                          lng: p.lng,
                          streetName: cIdx >= 0 ? lStr.slice(0, cIdx).trim() : lStr,
                          numberOrComplement: cIdx >= 0 ? lStr.slice(cIdx + 1).trim() : undefined,
                          worked: p.worked,
                        };
                      }),
                      'sidewalk',
                      userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null
                    )
                  : null;
              const orderMap = new Map<string, number>();
              if (walkingSeq) {
                for (const st of walkingSeq) orderMap.set(st.key, st.order);
              }
              const sectionPins: MapPin[] = rawSectionPins.map((p) => ({
                ...p,
                walkOrder: orderMap.get(p.key),
              }));

              return (
                <View
                  style={styles.inlineMapPanel}
                  testID={`checklist-inline-map-panel-${section.territory}`}
                >
                  <View style={styles.inlineMapToolbar}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <Pressable
                        testID={`checklist-map-mode-quadras-${section.territory}`}
                        onPress={() => setInlineMapMode('quadras')}
                        style={[
                          styles.inlineMapToolBtn,
                          inlineMapMode === 'quadras' && styles.inlineMapToolBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.inlineMapToolBtnText,
                            inlineMapMode === 'quadras' && styles.inlineMapToolBtnTextActive,
                          ]}
                        >
                          🔷 Quadras ({sectionQuadras.length})
                        </Text>
                      </Pressable>

                      <Pressable
                        testID={`checklist-map-mode-pins-${section.territory}`}
                        onPress={() => setInlineMapMode('pins')}
                        style={[
                          styles.inlineMapToolBtn,
                          inlineMapMode === 'pins' && styles.inlineMapToolBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.inlineMapToolBtnText,
                            inlineMapMode === 'pins' && styles.inlineMapToolBtnTextActive,
                          ]}
                        >
                          📍 Pontos ({sectionPins.length})
                        </Text>
                      </Pressable>

                      <Pressable
                        testID={`checklist-map-direction-${section.territory}`}
                        onPress={() => setInlineMapWalkOrder((prev) => !prev)}
                        style={[
                          styles.inlineMapToolBtn,
                          inlineMapWalkOrder && styles.inlineMapToolBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.inlineMapToolBtnText,
                            inlineMapWalkOrder && styles.inlineMapToolBtnTextActive,
                          ]}
                        >
                          {inlineMapWalkOrder ? '👣 Direção: ON' : '👣 Direção'}
                        </Text>
                      </Pressable>

                      <Pressable
                        testID={`checklist-map-gps-${section.territory}`}
                        onPress={toggleGps}
                        style={[
                          styles.inlineMapToolBtn,
                          gpsEnabled && styles.inlineMapToolBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.inlineMapToolBtnText,
                            gpsEnabled && styles.inlineMapToolBtnTextActive,
                          ]}
                        >
                          {gpsEnabled ? '🛰️ GPS Ativo' : '🛰️ Meu GPS'}
                        </Text>
                      </Pressable>

                      {gpsEnabled && userLocation ? (
                        <Pressable
                          testID={`checklist-map-center-gps-${section.territory}`}
                          onPress={centerOnUser}
                          style={styles.inlineMapToolBtn}
                        >
                          <Text style={styles.inlineMapToolBtnText}>🎯 Centralizar</Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        testID={`checklist-map-pick-origin-${section.territory}`}
                        onPress={() => setPickingOriginMode((v) => !v)}
                        style={[
                          styles.inlineMapToolBtn,
                          pickingOriginMode && styles.inlineMapToolBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.inlineMapToolBtnText,
                            pickingOriginMode && styles.inlineMapToolBtnTextActive,
                          ]}
                        >
                          {pickingOriginMode ? '📍 Clique no Mapa...' : '📍 Definir Partida'}
                        </Text>
                      </Pressable>

                      <Pressable
                        testID={`checklist-map-fit-${section.territory}`}
                        onPress={() => setInlineMapFitRequest((n) => n + 1)}
                        style={styles.inlineMapToolBtn}
                      >
                        <Text style={styles.inlineMapToolBtnText}>⌖ Enquadrar</Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          router.push(
                            `/territory-map?id=${eventId}&territory=${encodeURIComponent(section.territory)}`
                          )
                        }
                        style={styles.inlineMapToolBtn}
                      >
                        <Text style={styles.inlineMapToolBtnText}>↗ Mapa CAD</Text>
                      </Pressable>
                    </View>

                    {gpsError || routeError ? (
                      <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                        ⚠️ {routeError || gpsError}
                      </Text>
                    ) : null}

                    {activeRoute ? (
                      <View
                        style={styles.inlineRouteBanner}
                        testID={`checklist-active-route-${section.territory}`}
                      >
                        <Text style={styles.inlineRouteText} numberOfLines={1}>
                          🧭 {routeDestinationMeta?.label || 'Destino'} • 🚶{' '}
                          {formatRouteDistance(activeRoute.distanceMeters)} (
                          {formatRouteDuration(activeRoute.durationSeconds)})
                        </Text>
                        {routeDestinationMeta ? (
                          <Pressable
                            onPress={() =>
                              openExternalGoogleMaps({
                                lat: routeDestinationMeta.lat,
                                lng: routeDestinationMeta.lng,
                                streetName: routeDestinationMeta.streetName,
                                label: routeDestinationMeta.label,
                                city: routeDestinationMeta.city || sectionCity,
                                originLat: userLocation?.lat,
                                originLng: userLocation?.lng,
                                mode: 'directions',
                              })
                            }
                            style={styles.inlineGmapsChip}
                          >
                            <Text style={styles.inlineGmapsChipText}>🗺️ Google Maps</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => {
                            setActiveRoute(null);
                            setRouteDestinationMeta(null);
                          }}
                          style={styles.inlineRouteClearBtn}
                        >
                          <Text style={styles.inlineRouteClearText}>✕ Limpar</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ height: 340, width: '100%' }}>
                    <TerritoryLeafletMap
                      mode={inlineMapMode}
                      pins={sectionPins}
                      quadras={sectionQuadras}
                      outlines={[]}
                      showStreetLabels
                      showQuadraPopup
                      selectedKey={inlineSelectedKey}
                      fitRequest={inlineMapFitRequest}
                      userLocation={userLocation}
                      panToUserRequest={panToUserRequest}
                      activeRoute={activeRoute}
                      walkingSequence={walkingSeq}
                      pickingOriginMode={pickingOriginMode}
                      onPickOriginOnMap={(lat, lng) => {
                        setManualOrigin(lat, lng);
                        setPickingOriginMode(false);
                        setRouteError(null);
                      }}
                      onSelectPin={(k) => setInlineSelectedKey(k)}
                      onSelectQuadra={(k) => setInlineSelectedKey(k)}
                      onToggleWork={(k) => handleToggleItem(k)}
                      onEditPin={(k) => {
                        const found = flatRegistry.find((n) => pathKey.equals(n.key, k));
                        if (found) setEditingAddressItem(found);
                      }}
                      onCustomizePin={() => undefined}
                      onOpenGoogleMapsPin={(k) => {
                        const p = sectionPins.find((x) => x.key === k);
                        if (p) {
                          openExternalGoogleMaps({
                            lat: p.lat,
                            lng: p.lng,
                            line: p.line,
                            label: p.label,
                            city: p.city || sectionCity,
                            originLat: userLocation?.lat,
                            originLng: userLocation?.lng,
                            mode: 'directions',
                          });
                        }
                      }}
                      onRouteToPinInMap={(k) => {
                        const p = sectionPins.find((x) => x.key === k);
                        if (p) {
                          handleTraceRouteInChecklistMap(section.territory, {
                            lat: p.lat,
                            lng: p.lng,
                            label: p.line || p.label,
                            city: p.city || sectionCity,
                          });
                        }
                      }}
                      onOpenGoogleMapsQuadra={(qKey) => {
                        const q = sectionQuadras.find((x) => x.key === qKey);
                        if (q) {
                          openExternalGoogleMaps({
                            lat: q.centerLat,
                            lng: q.centerLng,
                            streetName: q.perimeterStreets[0] || q.label,
                            label: q.label,
                            city: sectionCity,
                            originLat: userLocation?.lat,
                            originLng: userLocation?.lng,
                            mode: 'directions',
                          });
                        }
                      }}
                      onRouteToQuadraInMap={(qKey) => {
                        const q = sectionQuadras.find((x) => x.key === qKey);
                        if (q) {
                          handleTraceRouteInChecklistMap(section.territory, {
                            lat: q.centerLat,
                            lng: q.centerLng,
                            label: q.label,
                            city: sectionCity,
                            streetName: q.perimeterStreets[0],
                          });
                        }
                      }}
                      onRouteToQuadraAddressesInMap={(qKey) => {
                        handleTraceQuadraAddressesInChecklistMap(section.territory, qKey, sectionCity);
                      }}
                    />
                  </View>
                </View>
              );
            };

            return (
          <View key={`T:${section.territory}`} style={single ? undefined : styles.territorySection}>
            {!single ? (
              <TerritoryAccordionHeader
                territory={section.territory}
                territoryName={resolveTerritoryNameFromNodes(flatRegistry, section.territory)}
                groupCount={section.groups.length}
                worked={section.worked}
                total={section.total}
                expanded={sectionOpen}
                daysSinceCompleted={section.daysSinceCompleted}
                mapOpen={isMapOpenForSection}
                onToggle={() => toggleExpanded(`T:${section.territory}`)}
                onEditTerritory={() => openTerritoryManager('edit', section.territory)}
                onAddAddress={() =>
                  openTerritoryManager(
                    'new_address',
                    section.territory,
                    section.groups[0]?.groupKey,
                    section.groups[0]?.groupLabel
                  )
                }
                onShareTerritory={() => {
                  const payload = formatShareTerritoryOrQuadraLocationsText({
                    territoryNumber: section.territory,
                    territoryName: resolveTerritoryNameFromNodes(flatRegistry, section.territory),
                    items: section.groups.flatMap((g) => g.items),
                    city: sectionCity,
                  });
                  shareLocationPayload(payload, 'whatsapp');
                }}
                onToggleMap={() => toggleInlineMapForTerritory(section.territory)}
                onOpenGoogleMaps={() => {
                  const q0 = sectionQuadras[0];
                  openExternalGoogleMaps({
                    lat: q0?.centerLat,
                    lng: q0?.centerLng,
                    streetName: q0?.perimeterStreets[0] || firstSectionMeta.line || section.territory,
                    label: `Território ${section.territory}`,
                    city: sectionCity,
                    originLat: userLocation?.lat,
                    originLng: userLocation?.lng,
                    mode: 'directions',
                  });
                }}
                onBatchToggle={() => handleToggleTerritory(section)}
                onOpenPublisher={() =>
                  router.push(`/publisher?id=${eventId}&territory=${encodeURIComponent(section.territory)}`)
                }
              />
            ) : null}

            {!single && sectionOpen ? renderInlineTerritoryMap() : null}

          {sectionOpen && section.groups.map((group) => {
            const groupOpen = isExpanded(`G:${group.groupKey}`);
            const groupQuadra =
              sectionQuadras.find((q) => q.key === group.groupKey) || sectionQuadras[0];
            const firstGroupItem = group.items[0];
            const firstGroupMeta = (firstGroupItem?.meta || {}) as Record<string, any>;
            const firstGroupCoords = parseLatLng(firstGroupMeta);

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Pressable
                    testID={`checklist-group-edit-${group.groupKey}`}
                    onPress={() =>
                      openTerritoryManager(
                        'edit',
                        section.territory,
                        group.groupKey,
                        group.groupLabel
                      )
                    }
                    style={[
                      styles.inlineGmapsChip,
                      {
                        backgroundColor: 'rgba(255, 184, 0, 0.16)',
                        borderColor: 'rgba(255, 184, 0, 0.45)',
                      },
                    ]}
                  >
                    <Text style={[styles.inlineGmapsChipText, { color: '#FFB800', fontWeight: '800' }]}>
                      ✏️ Nome/Nº
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`checklist-group-add-addr-${group.groupKey}`}
                    onPress={() =>
                      openTerritoryManager(
                        'new_address',
                        section.territory,
                        group.groupKey,
                        group.groupLabel
                      )
                    }
                    style={[
                      styles.inlineGmapsChip,
                      {
                        backgroundColor: 'rgba(16, 185, 129, 0.16)',
                        borderColor: 'rgba(16, 185, 129, 0.45)',
                      },
                    ]}
                  >
                    <Text style={[styles.inlineGmapsChipText, { color: '#34D399', fontWeight: '800' }]}>
                      ➕ Endereço
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`checklist-group-share-${group.groupKey}`}
                    onPress={() => {
                      const payload = formatShareTerritoryOrQuadraLocationsText({
                        territoryNumber: section.territory,
                        territoryName: resolveTerritoryNameFromNodes(flatRegistry, section.territory),
                        quadraKey: group.groupKey,
                        quadraLabel: group.groupLabel,
                        items: group.items,
                        city: String(firstGroupMeta.city || firstGroupMeta.cidade || sectionCity),
                      });
                      shareLocationPayload(payload, 'whatsapp');
                    }}
                    style={[
                      styles.inlineGmapsChip,
                      {
                        backgroundColor: 'rgba(34, 197, 94, 0.16)',
                        borderColor: 'rgba(34, 197, 94, 0.45)',
                      },
                    ]}
                  >
                    <Text style={[styles.inlineGmapsChipText, { color: '#4ADE80', fontWeight: '800' }]}>
                      📲 Compartilhar
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`checklist-group-map-btn-${group.groupKey}`}
                    onPress={() => toggleInlineMapForTerritory(section.territory)}
                    style={[
                      styles.inlineGmapsChip,
                      isMapOpenForSection && {
                        backgroundColor: 'rgba(56, 189, 248, 0.28)',
                        borderColor: '#38BDF8',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.inlineGmapsChipText,
                        isMapOpenForSection && { color: '#38BDF8', fontWeight: '900' },
                      ]}
                    >
                      {isMapOpenForSection ? '🗺️ Ocultar Mapa' : '🗺️ Mapa'}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`checklist-group-gmaps-${group.groupKey}`}
                    onPress={() =>
                      openExternalGoogleMaps({
                        lat: groupQuadra?.centerLat ?? firstGroupCoords?.lat,
                        lng: groupQuadra?.centerLng ?? firstGroupCoords?.lng,
                        streetName:
                          groupQuadra?.perimeterStreets[0] ||
                          firstGroupMeta.line ||
                          group.groupLabel,
                        label: group.groupLabel,
                        city: String(firstGroupMeta.city || firstGroupMeta.cidade || sectionCity),
                        originLat: userLocation?.lat,
                        originLng: userLocation?.lng,
                        mode: 'directions',
                      })
                    }
                    style={styles.inlineGmapsChip}
                  >
                    <Text style={styles.inlineGmapsChipText}>🗺️ Google Maps</Text>
                  </Pressable>
                  {single ? (
                    <Pressable
                      testID={`checklist-group-campo-${group.groupKey}`}
                      onPress={() =>
                        router.push(
                          `/publisher?id=${eventId}&territory=${encodeURIComponent(section.territory)}`
                        )
                      }
                      style={styles.inlineGmapsChip}
                    >
                      <Text style={styles.inlineGmapsChipText}>📱 Campo</Text>
                    </Pressable>
                  ) : null}
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

              {/* Embedded Territory Map when toggled on a single-group territory */}
              {single && isMapOpenForSection ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
                  {renderInlineTerritoryMap()}
                </View>
              ) : null}

              {/* Items in Quadra (not rendered while collapsed) */}
              {groupOpen ? (
              <View style={styles.itemsList}>
                {/* Prominent Territory Map & Google Maps Bar inside opened territory */}
                <View style={styles.openedTerritoryActionRow}>
                  <Pressable
                    testID={`checklist-open-inline-map-${section.territory}`}
                    onPress={() => toggleInlineMapForTerritory(section.territory)}
                    style={[
                      styles.openedTerritoryActionBtn,
                      isMapOpenForSection && styles.openedTerritoryActionBtnActive,
                    ]}
                  >
                    <Text style={styles.openedTerritoryActionBtnText}>
                      {isMapOpenForSection
                        ? `🗺️ Ocultar Mapa de ${section.territory}`
                        : `🗺️ Ver Mapa deste Território (${section.territory} — Igual Modo Campo)`}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`checklist-opened-gmaps-${group.groupKey}`}
                    onPress={() =>
                      openExternalGoogleMaps({
                        lat: groupQuadra?.centerLat ?? firstGroupCoords?.lat,
                        lng: groupQuadra?.centerLng ?? firstGroupCoords?.lng,
                        streetName:
                          groupQuadra?.perimeterStreets[0] ||
                          firstGroupMeta.line ||
                          group.groupLabel,
                        label: group.groupLabel,
                        city: String(firstGroupMeta.city || firstGroupMeta.cidade || sectionCity),
                        originLat: userLocation?.lat,
                        originLng: userLocation?.lng,
                        mode: 'directions',
                      })
                    }
                    style={styles.inlineGmapsChip}
                  >
                    <Text style={styles.inlineGmapsChipText}>🗺️ Abrir Quadra no Google Maps</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/publisher?id=${eventId}&territory=${encodeURIComponent(section.territory)}`
                      )
                    }
                    style={styles.inlineGmapsChip}
                  >
                    <Text style={styles.inlineGmapsChipText}>📱 Abrir Modo Campo</Text>
                  </Pressable>
                </View>

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
                      <View style={styles.itemInfo}>
                        <Pressable onPress={() => setEditingAddressItem(item)}>
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

                        {/* Easy-to-find Google Maps & In-Map Route row right under the street/address */}
                        <View style={styles.itemQuickGmapsRow}>
                          <Pressable
                            testID={`checklist-item-gmaps-${item.key}`}
                            onPress={() =>
                              openExternalGoogleMaps({
                                lat: latNum,
                                lng: lngNum,
                                line: line || item.label,
                                label: item.label,
                                neighborhood: line2,
                                city: city || sectionCity,
                                state: meta.state || meta.uf,
                                postalcode,
                                originLat: userLocation?.lat,
                                originLng: userLocation?.lng,
                                mode: 'directions',
                              })
                            }
                            style={styles.inlineGmapsChip}
                          >
                            <Text style={styles.inlineGmapsChipText}>
                              🗺️ Abrir no Google Maps / Rota
                            </Text>
                          </Pressable>

                          {latNum != null && lngNum != null && !isNaN(latNum) && !isNaN(lngNum) ? (
                            <Pressable
                              testID={`checklist-item-route-${item.key}`}
                              disabled={routingBusy}
                              onPress={() =>
                                handleTraceRouteInChecklistMap(section.territory, {
                                  lat: latNum,
                                  lng: lngNum,
                                  label: line || item.label,
                                  city: city || sectionCity,
                                })
                              }
                              style={[
                                styles.inlineGmapsChip,
                                {
                                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                                  borderColor: 'rgba(16, 185, 129, 0.45)',
                                },
                              ]}
                            >
                              <Text style={[styles.inlineGmapsChipText, { color: '#34D399' }]}>
                                🧭 Traçar Rota no Mapa
                              </Text>
                            </Pressable>
                          ) : null}

                          <Pressable
                            testID={`checklist-item-share-${item.key}`}
                            onPress={() => {
                              const payload = formatShareAddressLocationText(
                                item,
                                city || sectionCity
                              );
                              shareLocationPayload(payload, 'whatsapp');
                            }}
                            style={[
                              styles.inlineGmapsChip,
                              {
                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                borderColor: 'rgba(34, 197, 94, 0.45)',
                              },
                            ]}
                          >
                            <Text style={[styles.inlineGmapsChipText, { color: '#4ADE80' }]}>
                              📲 Compartilhar Local
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* Right: Actions */}
                      <View style={styles.actionButtonsCol}>
                        <Pressable
                          testID={`checklist-item-gmaps-icon-${item.key}`}
                          onPress={() =>
                            openExternalGoogleMaps({
                              lat: latNum,
                              lng: lngNum,
                              line: line || item.label,
                              label: item.label,
                              neighborhood: line2,
                              city: city || sectionCity,
                              state: meta.state || meta.uf,
                              postalcode,
                              originLat: userLocation?.lat,
                              originLng: userLocation?.lng,
                              mode: 'directions',
                            })
                          }
                          style={styles.editAddressBtn}
                          accessibilityLabel="Abrir no Google Maps"
                          {...({ title: 'Abrir no Google Maps / Traçar Rota' } as any)}
                        >
                          <Text style={styles.editAddressBtnText}>🗺️</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setEditingAddressItem(item)}
                          style={styles.editAddressBtn}
                          accessibilityLabel="Editar Endereço Completo"
                          {...({ title: 'Editar Endereço Completo' } as any)}
                        >
                          <Text style={styles.editAddressBtnText}>✏️</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => openNoteEditor(item)}
                          style={styles.addNoteBtn}
                          accessibilityLabel="Anotação Rápida"
                          {...({ title: 'Anotação Rápida' } as any)}
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
          const nextClean = updateSingleNodeInCleanRegistry(flatRegistry, key, updates);
          await commitTerritoryNodes(nextClean, {
            activeTerritoryNumber: updates.meta?.territory_number || undefined,
            message: '✓ Endereço atualizado e salvo na memória!',
          });
        }}
      />

      {/* In-App Territory CRUD, Share & CSV Export Modal */}
      <TerritoryManageModal
        visible={manageModalOpen}
        initialTab={manageModalTab}
        targetTerritoryNumber={manageTargetTerritory}
        targetGroupKey={manageTargetGroupKey}
        targetGroupLabel={manageTargetGroupLabel}
        cleanNodes={flatRegistry}
        onClose={() => setManageModalOpen(false)}
        onCommitNodes={commitTerritoryNodes}
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

      <QuickShareSheet
        visible={quickShareOpen}
        onClose={() => setQuickShareOpen(false)}
        eventId={eventId}
        eventTitle={event?.config.name || 'Territórios Sekundo'}
        skeleton={flatRegistry}
        initialScopeKind="territories"
        initialSelectedTerritoryNumbers={quickShareTerritories}
      />
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
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  inlineMapPanel: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    backgroundColor: '#141923',
  },
  inlineMapToolbar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#161B26',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  inlineMapToolBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  inlineMapToolBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#38BDF8',
  },
  inlineMapToolBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineMapToolBtnTextActive: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  inlineRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineRouteText: {
    flex: 1,
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineRouteClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  inlineRouteClearText: {
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '800',
  },
  inlineGmapsChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  inlineGmapsChipText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  openedTerritoryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  openedTerritoryActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  openedTerritoryActionBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.35)',
  },
  openedTerritoryActionBtnText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '800',
  },
  itemQuickGmapsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
});
