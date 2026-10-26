/**
 * Page: publisher
 *
 * Modo Operador de Campo (Single-Territory Field Volunteer View).
 * Ultra-simplified, high-contrast, one-handed interface for working a single territory
 * in the field without administrative clutter:
 * - Instant 1-tap toggle per house number or per Quadra
 * - Smart Sidewalk Walking Order ("🚶 Calçada Ímpar/Par" vs "🔢 Sequencial")
 * - Outdoor Daylight Mode ("☀️ Modo Sol" WCAG AAA high-contrast for midday sun)
 * - Territory Assignment Record (who holds the territory & assignment date)
 * - Embedded toggle between Street/House Grid and Interactive Territory Map
 * - 1-tap "📤 Devolver Território (Delta)" button to send progress back via WhatsApp / .sekundo file
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { storage } from '../storage/localStorage';
import {
  pathKey,
  extractQuadrasFromRegistry,
  formatQuadraPerimeterDescription,
  buildWorkedMeta,
  resolveTerritoryNumber,
  parseLatLng,
  calculateDaysDifference,
  buildTerritoriosS13HistoricalRegistry,
  selectEnginePartitionNodes,
  calculateMapRoute,
  calculateMultiStopMapRoute,
  buildWalkingSequenceRoute,
  formatRouteDistance,
  formatRouteDuration,
  resolveTerritoryNameFromNodes,
  updateSingleNodeInCleanRegistry,
  transferAddressesBetweenTerritories,
  buildTerritoryModelCsvText,
  formatShareAddressLocationText,
  formatShareTerritoryOrQuadraLocationsText,
} from '@sekundo/core';
import type {
  FlatSkeletonEntry,
  QuadraSummary,
  QuadraAddressUnit,
  RouteCalculationResult,
  WalkingSequenceRoute,
} from '@sekundo/core';
import { DeltaSyncModal } from '../components/territory/DeltaSyncModal';
import { AddressEditModal } from '../components/territory/AddressEditModal';
import {
  TerritoryManageModal,
  type TerritoryManageTab,
} from '../components/territory/TerritoryManageModal';
import { TerritoryLeafletMap } from '../components/map/TerritoryLeafletMap';
import type { MapPin } from '../components/map/mapTypes';
import {
  loadSavedTerritoryRegistry,
  persistTerritoryRegistryMutation,
  exportUpdatedTerritoryModelCsvFromStorage,
  triggerCsvFileDownloadOrCopy,
  shareLocationPayload,
} from '../storage/omniStorageBridge';
import { useLiveGpsLocation, openExternalGoogleMaps } from '../hooks/useLiveGpsLocation';

function extractNumericHouseNumber(numStr?: string): number | null {
  if (!numStr) return null;
  const match = numStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function sortUnitsByWalkingMode(
  units: QuadraAddressUnit[],
  walkMode: 'sequential' | 'sidewalk'
): QuadraAddressUnit[] {
  const copy = [...units];
  if (walkMode === 'sequential') {
    return copy.sort((a, b) => {
      const nA = extractNumericHouseNumber(a.numberOrComplement) ?? 999999;
      const nB = extractNumericHouseNumber(b.numberOrComplement) ?? 999999;
      return nA - nB;
    });
  }
  // Sidewalk mode: Odd numbers ascending (going down one sidewalk), then Even numbers descending/ascending
  return copy.sort((a, b) => {
    const nA = extractNumericHouseNumber(a.numberOrComplement);
    const nB = extractNumericHouseNumber(b.numberOrComplement);
    if (nA === null && nB === null) return 0;
    if (nA === null) return 1;
    if (nB === null) return -1;
    const oddA = nA % 2 !== 0 ? 0 : 1;
    const oddB = nB % 2 !== 0 ? 0 : 1;
    if (oddA !== oddB) return oddA - oddB;
    return nA - nB;
  });
}

export default function PublisherModeScreen() {
  const router = useRouter();
  const { id, territory } = useLocalSearchParams();
  const rawEventId = typeof id === 'string' ? id : '';
  const initialTerritory = typeof territory === 'string' ? territory : '';

  const { events } = useLocalEvent();
  const fallbackEvent =
    events.find((e) => e.config.id === rawEventId) ||
    events.find((e) => e.config.id === 'seed-territorios-padrao') ||
    events.find((e) => (e.config.activeEngines || []).includes('territory_logistics')) ||
    events[0] ||
    null;
  const eventId = rawEventId || fallbackEvent?.config.id || 'seed-territorios-padrao';
  const {
    flatRegistry: rawRegistry,
    saveSkeleton,
    loading,
  } = useSkeleton(eventId);
  const [savedTerritoryRegistry, setSavedTerritoryRegistry] = useState<FlatSkeletonEntry[]>([]);
  useEffect(() => {
    loadSavedTerritoryRegistry()
      .then((reg) => {
        if (reg && reg.length > 0) setSavedTerritoryRegistry(reg);
      })
      .catch(() => undefined);
  }, [rawRegistry]);

  const flatRegistry = useMemo<FlatSkeletonEntry[]>(() => {
    const savedPartitioned = selectEnginePartitionNodes(
      savedTerritoryRegistry,
      'territory_logistics'
    );
    if (savedPartitioned.length > 0) return savedPartitioned;
    const partitioned = selectEnginePartitionNodes(rawRegistry || [], 'territory_logistics');
    if (partitioned.length > 0) return partitioned;
    return buildTerritoriosS13HistoricalRegistry();
  }, [rawRegistry, savedTerritoryRegistry]);

  const [daylightMode, setDaylightMode] = useState<boolean>(false);
  const [walkMode, setWalkMode] = useState<'sequential' | 'sidewalk'>('sidewalk');
  const [editingAssignee, setEditingAssignee] = useState<boolean>(false);
  const [assigneeDraft, setAssigneeDraft] = useState<string>('');
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState<boolean>(false);
  const [manageModalTab, setManageModalTab] = useState<TerritoryManageTab>('edit');
  const [manageTargetGroupKey, setManageTargetGroupKey] = useState<string | undefined>(undefined);
  const [manageTargetGroupLabel, setManageTargetGroupLabel] = useState<string | undefined>(undefined);
  const [manageTargetAddressKey, setManageTargetAddressKey] = useState<string | undefined>(undefined);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Field Map states: Quadras <-> Pontos (preserving camera zoom!), walking direction, GPS & route
  const [fieldMapMode, setFieldMapMode] = useState<'quadras' | 'pins'>('quadras');
  const [showWalkingOrder, setShowWalkingOrder] = useState<boolean>(true);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
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

  useEffect(() => {
    storage.getItem('sekundo:daylight-mode').then((v) => {
      if (v === '1') setDaylightMode(true);
    });
    storage.getItem('sekundo:walk-mode').then((v) => {
      if (v === 'sequential' || v === 'sidewalk') setWalkMode(v);
    });
  }, []);

  const toggleDaylightMode = () => {
    const next = !daylightMode;
    setDaylightMode(next);
    storage.setItem('sekundo:daylight-mode', next ? '1' : '0').catch(() => undefined);
  };

  const toggleWalkMode = () => {
    const next = walkMode === 'sidewalk' ? 'sequential' : 'sidewalk';
    setWalkMode(next);
    storage.setItem('sekundo:walk-mode', next).catch(() => undefined);
  };

  const allQuadras = useMemo<QuadraSummary[]>(
    () => extractQuadrasFromRegistry(flatRegistry),
    [flatRegistry]
  );

  const territoryList = useMemo(() => {
    const set = new Set<string>();
    allQuadras.forEach((q) => set.add(q.territoryNumber));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [allQuadras]);

  const [activeTerritory, setActiveTerritory] = useState<string>('');
  const effectiveTerritory =
    activeTerritory ||
    (initialTerritory && territoryList.includes(initialTerritory)
      ? initialTerritory
      : territoryList[0] || '');

  const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
  const [fitRequest, setFitRequest] = useState<number>(0);
  const [showDeltaModal, setShowDeltaModal] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  const commitTerritoryNodes = async (
    nextCleanTerritoryNodes: FlatSkeletonEntry[],
    metaInfo?: { activeTerritoryNumber?: string; message?: string }
  ) => {
    setSavedTerritoryRegistry(nextCleanTerritoryNodes);
    await persistTerritoryRegistryMutation({
      eventId,
      cleanTerritoryNodes: nextCleanTerritoryNodes,
      rawRegistry: rawRegistry || [],
      saveSkeletonFn: saveSkeleton,
    });
    if (metaInfo?.activeTerritoryNumber) {
      setActiveTerritory(metaInfo.activeTerritoryNumber);
    }
    if (metaInfo?.message) {
      showToast(metaInfo.message);
    }
  };

  const openTerritoryManager = (
    tab: TerritoryManageTab,
    groupKey?: string,
    groupLabel?: string,
    addressKey?: string
  ) => {
    setManageModalTab(tab);
    setManageTargetGroupKey(groupKey);
    setManageTargetGroupLabel(groupLabel);
    setManageTargetAddressKey(addressKey);
    setManageModalOpen(true);
  };

  const effectiveTerritoryName = useMemo(
    () => resolveTerritoryNameFromNodes(flatRegistry, effectiveTerritory),
    [flatRegistry, effectiveTerritory]
  );

  const handleExportUpdatedCsv = async () => {
    const csvText = buildTerritoryModelCsvText(flatRegistry);
    const filename = `Sekundo_Territorios_Modelo_S13_${new Date().toISOString().slice(0, 10)}.csv`;
    const res = await triggerCsvFileDownloadOrCopy(csvText, filename);
    if (res === 'downloaded') {
      showToast(`✅ Planilha CSV exportada (${filename})!`);
    } else {
      showToast('📋 CSV atualizado copiado para a área de transferência!');
    }
  };

  const handleQuickShareTerritory = async () => {
    const items = flatRegistry.filter((n) => resolveTerritoryNumber(n) === effectiveTerritory && n.type !== 'header');
    const payload = formatShareTerritoryOrQuadraLocationsText({
      territoryNumber: effectiveTerritory,
      territoryName: effectiveTerritoryName,
      items,
      city: defaultCity,
    });
    const res = await shareLocationPayload(payload, 'whatsapp');
    if (res === 'copied') {
      showToast(`📋 Localizações do Território ${effectiveTerritory} copiadas!`);
    }
  };

  const handleQuickShareQuadra = async (quadraKey: string, quadraLabel: string) => {
    const items = flatRegistry.filter(
      (n) =>
        n.type !== 'header' &&
        (pathKey.equals(n.key, quadraKey) || pathKey.isDescendant(n.key, quadraKey))
    );
    const payload = formatShareTerritoryOrQuadraLocationsText({
      territoryNumber: effectiveTerritory,
      territoryName: effectiveTerritoryName,
      quadraLabel,
      items,
      city: defaultCity,
    });
    const res = await shareLocationPayload(payload, 'whatsapp');
    if (res === 'copied') {
      showToast(`📋 Localizações de "${quadraLabel}" copiadas!`);
    }
  };

  const handleQuickShareUnit = async (unitKey: string) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, unitKey));
    if (!target) return;
    const payload = formatShareAddressLocationText(target);
    const res = await shareLocationPayload(payload, 'whatsapp');
    if (res === 'copied') {
      showToast(`📋 Endereço "${target.label}" copiado!`);
    }
  };

  const territoryQuadras = useMemo(
    () => allQuadras.filter((q) => q.territoryNumber === effectiveTerritory),
    [allQuadras, effectiveTerritory]
  );

  const defaultCity = useMemo(() => {
    for (const n of flatRegistry) {
      if (resolveTerritoryNumber(n) === effectiveTerritory) {
        const m = (n.meta || {}) as Record<string, any>;
        if (m.city || m.cidade) return String(m.city || m.cidade);
      }
    }
    return '';
  }, [flatRegistry, effectiveTerritory]);

  // Extract current territory assignment metadata (workerName & assignedAt)
  const assignmentInfo = useMemo(() => {
    let workerName = '';
    let assignedAt = '';
    for (const n of flatRegistry) {
      if (resolveTerritoryNumber(n) === effectiveTerritory) {
        const m = (n.meta || {}) as Record<string, any>;
        if (!workerName && m.workerName) workerName = String(m.workerName);
        const aDate = m.assignedAt || m.assigned_date || m.data_designacao;
        if (!assignedAt && aDate) assignedAt = String(aDate);
      }
    }
    const daysAssigned = assignedAt ? calculateDaysDifference(assignedAt) : null;
    const isOverdue = daysAssigned !== null && daysAssigned >= 120;
    return { workerName, assignedAt, daysAssigned, isOverdue };
  }, [flatRegistry, effectiveTerritory]);

  const handleSaveAssignee = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const trimmed = assigneeDraft.trim();
    const targetKeys = new Set(
      territoryQuadras.flatMap((q) => q.streets.flatMap((s) => s.units.map((u) => u.key)))
    );

    if (targetKeys.size > 0) {
      const nextClean = flatRegistry.map((n) => {
        if (!targetKeys.has(n.key) && resolveTerritoryNumber(n) !== effectiveTerritory) return n;
        return {
          ...n,
          meta: {
            ...(n.meta || {}),
            workerName: trimmed || undefined,
            assignedAt: trimmed ? (n.meta as any)?.assignedAt || today : undefined,
          },
        };
      });
      await commitTerritoryNodes(nextClean);
    }
    setEditingAssignee(false);
  };

  const stats = useMemo(() => {
    const total = territoryQuadras.reduce((acc, q) => acc + q.totalUnits, 0);
    const worked = territoryQuadras.reduce((acc, q) => acc + q.workedUnits, 0);
    const percent = total > 0 ? Math.round((worked / total) * 100) : 0;
    return { total, worked, percent };
  }, [territoryQuadras]);

  const rawMapPins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = [];
    const parentKeys = new Set<string>();
    for (const node of flatRegistry) {
      const p = pathKey.parent(node.key);
      if (p) parentKeys.add(p);
    }
    for (const node of flatRegistry) {
      if (parentKeys.has(node.key) || node.type === 'header') continue;
      const tNum = resolveTerritoryNumber(node);
      if (tNum !== effectiveTerritory) continue;
      const meta = (node.meta || {}) as Record<string, any>;
      const coords = parseLatLng(meta);
      if (!coords) continue;
      list.push({
        key: node.key,
        label: node.label,
        worked: Number(meta.worked) === 1 ? 1 : 0,
        lat: coords.lat,
        lng: coords.lng,
        color: Number(meta.worked) === 1 ? '#10B981' : '#FFB800',
        shape: 'circle',
        territoryNumber: tNum,
        city: String(meta.city || meta.cidade || ''),
        line: meta.line ? String(meta.line) : node.label,
        propertyType: String(meta.property_type || 'residencial'),
        isForeign: Boolean(meta.is_foreign || meta.language),
      });
    }
    return list;
  }, [flatRegistry, effectiveTerritory]);

  const walkingSequence = useMemo<WalkingSequenceRoute | null>(() => {
    if (!showWalkingOrder || rawMapPins.length === 0) return null;
    return buildWalkingSequenceRoute(
      rawMapPins.map((p) => {
        const lineStr = p.line || p.label;
        const commaIdx = lineStr.indexOf(',');
        const streetName = commaIdx >= 0 ? lineStr.slice(0, commaIdx).trim() : lineStr;
        const numberOrComplement = commaIdx >= 0 ? lineStr.slice(commaIdx + 1).trim() : undefined;
        return {
          key: p.key,
          label: lineStr,
          lat: p.lat,
          lng: p.lng,
          streetName,
          numberOrComplement,
          worked: p.worked,
        };
      }),
      walkMode,
      userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null
    );
  }, [showWalkingOrder, rawMapPins, walkMode, userLocation]);

  const mapPins = useMemo<MapPin[]>(() => {
    if (!walkingSequence) return rawMapPins;
    const orderMap = new Map<string, number>();
    for (const s of walkingSequence) {
      orderMap.set(s.key, s.order);
    }
    return rawMapPins.map((p) => ({
      ...p,
      walkOrder: orderMap.get(p.key),
    }));
  }, [rawMapPins, walkingSequence]);

  const handleToggleUnit = async (unitKey: string) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, unitKey));
    if (!target) return;
    const meta = (target.meta || {}) as Record<string, any>;
    const nextWorked: 0 | 1 = Number(meta.worked) === 1 ? 0 : 1;
    const nextClean = updateSingleNodeInCleanRegistry(flatRegistry, target.key, {
      value: nextWorked === 1 ? (meta.workerName || 'Trabalhado') : '',
      meta: buildWorkedMeta(meta, nextWorked),
    });
    await commitTerritoryNodes(nextClean);
  };

  const handleToggleQuadra = async (quadra: QuadraSummary) => {
    const nextWorked: 0 | 1 = quadra.isCompleted ? 0 : 1;
    const now = new Date();
    const unitKeySet = new Set(quadra.streets.flatMap((s) => s.units.map((u) => u.key)));
    const nextClean = flatRegistry.map((n) => {
      if (!unitKeySet.has(n.key)) return n;
      return {
        ...n,
        value: nextWorked === 1 ? ((n.meta as any)?.workerName || 'Trabalhado') : '',
        meta: buildWorkedMeta(n.meta, nextWorked, now),
      };
    });
    await commitTerritoryNodes(nextClean);
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

  const handleTraceRouteInMap = async (dest: {
    lat: number;
    lng: number;
    label: string;
    city?: string;
    streetName?: string;
  }) => {
    setRoutingBusy(true);
    setRouteError(null);
    if (viewMode !== 'map') {
      setViewMode('map');
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

  const handleTraceQuadraAddressesRoute = async (quadraKey: string) => {
    const q = territoryQuadras.find((x) => x.key === quadraKey);
    if (!q) return;
    setRoutingBusy(true);
    setRouteError(null);
    if (viewMode !== 'map') {
      setViewMode('map');
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
      const orderedStops = buildWalkingSequenceRoute(targetUnits, walkMode, origin);
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
        city: defaultCity,
        streetName: q.perimeterStreets[0],
      });
    } finally {
      setRoutingBusy(false);
    }
  };

  if (loading && flatRegistry.length === 0) {
    return (
      <View style={[styles.loadingContainer, daylightMode && styles.containerDaylight]}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, daylightMode && styles.containerDaylight]}>
      {/* Compact Field Header */}
      <View style={[styles.header, daylightMode && styles.headerDaylight]}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.replace(`/territory-checklist?id=${eventId}&territory=${encodeURIComponent(effectiveTerritory)}`)}
            style={[styles.backBtn, daylightMode && styles.btnDaylight]}
          >
            <Text style={[styles.backBtnText, daylightMode && styles.textDaylight]}>← Prancheta</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%' }}>
            <Pressable
              onPress={toggleWalkMode}
              style={[styles.backBtn, daylightMode && styles.btnDaylight]}
              accessibilityLabel="Alternar ordem de caminhada na rua"
            >
              <Text style={[styles.backBtnText, daylightMode && styles.textDaylight]}>
                {walkMode === 'sidewalk' ? '🚶 Calçada (Ímpar/Par)' : '🔢 Sequencial'}
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleDaylightMode}
              style={[styles.backBtn, daylightMode && styles.btnDaylightActive]}
              accessibilityLabel="Alternar modo alto contraste solar"
            >
              <Text style={[styles.backBtnText, daylightMode && styles.textDaylight]}>
                {daylightMode ? '🌙 Escuro' : '☀️ Modo Sol'}
              </Text>
            </Pressable>

            <View style={[styles.modeSwitch, daylightMode && styles.modeSwitchDaylight]}>
              <Pressable
                testID="publisher-view-cards-btn"
                onPress={() => setViewMode('cards')}
                style={[styles.modeBtn, viewMode === 'cards' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, viewMode === 'cards' && styles.modeBtnTextActive]}>
                  📋 Quadras ({territoryQuadras.length})
                </Text>
              </Pressable>
              <Pressable
                testID="publisher-view-map-btn"
                onPress={() => {
                  setViewMode('map');
                  setFitRequest((n) => n + 1);
                }}
                style={[styles.modeBtn, viewMode === 'map' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, viewMode === 'map' && styles.modeBtnTextActive]}>
                  🗺️ Mapa
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Territory Selector Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.territoryRow}
        >
          {territoryList.map((tNum) => {
            const active = tNum === effectiveTerritory;
            const tName = resolveTerritoryNameFromNodes(flatRegistry, tNum);
            return (
              <Pressable
                key={tNum}
                testID={`publisher-territory-chip-${tNum}`}
                onPress={() => {
                  setActiveTerritory(tNum);
                  setFitRequest((n) => n + 1);
                }}
                style={[
                  styles.territoryChip,
                  daylightMode && styles.btnDaylight,
                  active && styles.territoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.territoryChipText,
                    daylightMode && styles.textDaylight,
                    active && styles.territoryChipTextActive,
                  ]}
                >
                  Território {tNum}{tName ? ` • ${tName}` : ''}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            testID="publisher-add-territory-chip"
            onPress={() => openTerritoryManager('new_territory')}
            style={[
              styles.territoryChip,
              {
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                borderColor: 'rgba(16, 185, 129, 0.45)',
              },
            ]}
          >
            <Text style={[styles.territoryChipText, { color: '#34D399' }]}>
              ➕ Novo Território
            </Text>
          </Pressable>
        </ScrollView>

        {/* Big Progress & Assignment Banner */}
        <View style={styles.progressBanner}>
          <View style={styles.progressTextRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%' }}>
              <Text style={[styles.territoryTitle, daylightMode && styles.textDaylight]}>
                📱 Território {effectiveTerritory}{effectiveTerritoryName ? ` — ${effectiveTerritoryName}` : ''}
              </Text>
              <Pressable
                testID="publisher-edit-territory-btn"
                onPress={() => openTerritoryManager('edit')}
                style={[
                  styles.gmapsHeaderChip,
                  {
                    backgroundColor: 'rgba(255, 184, 0, 0.16)',
                    borderColor: 'rgba(255, 184, 0, 0.45)',
                  },
                ]}
              >
                <Text style={[styles.gmapsHeaderChipText, { color: '#FFB800' }]}>
                  ✏️ Nome / Nº
                </Text>
              </Pressable>
              <Pressable
                testID="publisher-add-address-btn"
                onPress={() =>
                  openTerritoryManager(
                    'new_address',
                    territoryQuadras[0]?.key,
                    territoryQuadras[0]?.label
                  )
                }
                style={[
                  styles.gmapsHeaderChip,
                  {
                    backgroundColor: 'rgba(16, 185, 129, 0.14)',
                    borderColor: 'rgba(16, 185, 129, 0.45)',
                  },
                ]}
              >
                <Text style={[styles.gmapsHeaderChipText, { color: '#34D399' }]}>
                  🏠 + Endereço
                </Text>
              </Pressable>
              <Pressable
                testID="publisher-transfer-territory-btn"
                onPress={() =>
                  openTerritoryManager(
                    'transfer_addresses',
                    territoryQuadras[0]?.key,
                    territoryQuadras[0]?.label
                  )
                }
                style={[
                  styles.gmapsHeaderChip,
                  {
                    backgroundColor: 'rgba(192, 132, 252, 0.16)',
                    borderColor: 'rgba(192, 132, 252, 0.45)',
                  },
                ]}
              >
                <Text style={[styles.gmapsHeaderChipText, { color: '#C084FC' }]}>
                  🔀 Transferir
                </Text>
              </Pressable>
              <Pressable
                testID="publisher-share-territory-btn"
                onPress={handleQuickShareTerritory}
                style={[
                  styles.gmapsHeaderChip,
                  {
                    backgroundColor: 'rgba(16, 185, 129, 0.22)',
                    borderColor: '#10B981',
                  },
                ]}
              >
                <Text style={[styles.gmapsHeaderChipText, { color: '#34D399' }]}>
                  📲 Compartilhar
                </Text>
              </Pressable>
              <Pressable
                testID="publisher-export-csv-btn"
                onPress={handleExportUpdatedCsv}
                style={styles.gmapsHeaderChip}
              >
                <Text style={styles.gmapsHeaderChipText}>📤 Exportar CSV</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAssigneeDraft(assignmentInfo.workerName);
                  setEditingAssignee(!editingAssignee);
                }}
                style={[styles.assigneeBadge, assignmentInfo.isOverdue && styles.assigneeBadgeOverdue]}
              >
                <Text style={styles.assigneeBadgeText}>
                  {assignmentInfo.workerName
                    ? `👤 ${assignmentInfo.workerName}${assignmentInfo.assignedAt ? ` (${assignmentInfo.assignedAt})` : ''}${assignmentInfo.isOverdue ? ` ⚠️ ${assignmentInfo.daysAssigned}d` : ''}`
                    : '👤 + Designar operador'}
                </Text>
              </Pressable>
              {territoryQuadras[0] ? (
                <Pressable
                  testID="publisher-territory-gmaps-btn"
                  onPress={() =>
                    openExternalGoogleMaps({
                      lat: territoryQuadras[0].centerLat,
                      lng: territoryQuadras[0].centerLng,
                      streetName: territoryQuadras[0].perimeterStreets[0] || territoryQuadras[0].label,
                      label: `Território ${effectiveTerritory}`,
                      city: defaultCity,
                      originLat: userLocation?.lat,
                      originLng: userLocation?.lng,
                      mode: 'directions',
                    })
                  }
                  style={styles.gmapsHeaderChip}
                >
                  <Text style={styles.gmapsHeaderChipText}>🗺️ Abrir no Google Maps</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.progressCount, daylightMode && { color: '#047857' }]}>
              {stats.worked}/{stats.total} casas ({stats.percent}%)
            </Text>
          </View>

          {actionToast ? (
            <View
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.16)',
                borderColor: 'rgba(16, 185, 129, 0.45)',
                borderWidth: 1,
                borderRadius: 8,
                paddingVertical: 6,
                paddingHorizontal: 10,
                marginTop: 6,
              }}
            >
              <Text style={{ color: '#34D399', fontSize: 12, fontWeight: '700' }}>
                {actionToast}
              </Text>
            </View>
          ) : null}

          {editingAssignee ? (
            <View style={styles.assigneeEditRow}>
              <TextInput
                value={assigneeDraft}
                onChangeText={setAssigneeDraft}
                placeholder="Nome do operador responsável..."
                placeholderTextColor="#64748B"
                style={[styles.assigneeInput, daylightMode && styles.assigneeInputDaylight]}
              />
              <Pressable onPress={handleSaveAssignee} style={styles.assigneeSaveBtn}>
                <Text style={styles.assigneeSaveText}>Salvar</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.track, daylightMode && { backgroundColor: '#CBD5E1' }]}>
            <View
              style={[
                styles.fill,
                stats.percent === 100 && styles.fillDone,
                { width: `${stats.percent}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Main Content: Cards or Map */}
      {viewMode === 'map' ? (
        <View style={styles.mapWrapper}>
          {/* Field Map Control Bar: Quadras <-> Pontos (preserving camera zoom!), Walking Direction, Live GPS, Fit */}
          <View style={[styles.fieldMapToolbar, daylightMode && styles.headerDaylight]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <Pressable
                testID="field-map-mode-quadras"
                onPress={() => {
                  setFieldMapMode('quadras');
                  // Preserves current camera zoom & center!
                }}
                style={[
                  styles.fieldMapToolBtn,
                  fieldMapMode === 'quadras' && styles.fieldMapToolBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.fieldMapToolBtnText,
                    fieldMapMode === 'quadras' && styles.fieldMapToolBtnTextActive,
                  ]}
                >
                  🔷 Quadras ({territoryQuadras.length})
                </Text>
              </Pressable>

              <Pressable
                testID="field-map-mode-pins"
                onPress={() => {
                  setFieldMapMode('pins');
                  // Preserves current camera zoom & center!
                }}
                style={[
                  styles.fieldMapToolBtn,
                  fieldMapMode === 'pins' && styles.fieldMapToolBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.fieldMapToolBtnText,
                    fieldMapMode === 'pins' && styles.fieldMapToolBtnTextActive,
                  ]}
                >
                  📍 Pontos ({mapPins.length})
                </Text>
              </Pressable>

              <Pressable
                testID="field-map-toggle-direction"
                onPress={() => setShowWalkingOrder((prev) => !prev)}
                style={[
                  styles.fieldMapToolBtn,
                  showWalkingOrder && {
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    borderColor: '#38BDF8',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fieldMapToolBtnText,
                    showWalkingOrder && { color: '#38BDF8', fontWeight: '800' },
                  ]}
                >
                  {showWalkingOrder
                    ? `👣 Direção (${walkMode === 'sidewalk' ? 'Ímpar/Par' : 'Seq.'}): ON`
                    : '👣 Direção'}
                </Text>
              </Pressable>

              <Pressable
                testID="field-map-toggle-gps"
                onPress={toggleGps}
                style={[
                  styles.fieldMapToolBtn,
                  gpsEnabled && {
                    backgroundColor: 'rgba(37, 99, 235, 0.25)',
                    borderColor: '#38BDF8',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fieldMapToolBtnText,
                    gpsEnabled && { color: '#60A5FA', fontWeight: '800' },
                  ]}
                >
                  {gpsEnabled ? '🛰️ GPS Ativo' : '🛰️ Meu GPS'}
                </Text>
              </Pressable>

              {gpsEnabled && userLocation ? (
                <Pressable
                  testID="field-map-center-gps"
                  onPress={centerOnUser}
                  style={[
                    styles.fieldMapToolBtn,
                    { backgroundColor: 'rgba(37, 99, 235, 0.2)', borderColor: '#38BDF8' },
                  ]}
                >
                  <Text style={[styles.fieldMapToolBtnText, { color: '#38BDF8' }]}>
                    🎯 Centralizar
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                testID="field-map-pick-origin-btn"
                onPress={() => setPickingOriginMode((v) => !v)}
                style={[
                  styles.fieldMapToolBtn,
                  pickingOriginMode && {
                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                    borderColor: '#10B981',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fieldMapToolBtnText,
                    pickingOriginMode && { color: '#34D399', fontWeight: '800' },
                  ]}
                >
                  {pickingOriginMode ? '📍 Clique no Mapa...' : '📍 Definir Partida'}
                </Text>
              </Pressable>

              <Pressable
                testID="field-map-fit-btn"
                onPress={() => setFitRequest((n) => n + 1)}
                style={styles.fieldMapToolBtn}
              >
                <Text style={styles.fieldMapToolBtnText}>⌖ Enquadrar</Text>
              </Pressable>
            </View>

            {activeRoute ? (
              <View style={styles.fieldRouteBanner} testID="field-map-active-route-banner">
                <Text style={styles.fieldRouteText} numberOfLines={1}>
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
                        city: routeDestinationMeta.city || defaultCity,
                        originLat: userLocation?.lat,
                        originLng: userLocation?.lng,
                        mode: 'directions',
                      })
                    }
                    style={styles.gmapsHeaderChip}
                  >
                    <Text style={styles.gmapsHeaderChipText}>🗺️ Google Maps</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  testID="field-map-clear-route-btn"
                  onPress={() => {
                    setActiveRoute(null);
                    setRouteDestinationMeta(null);
                  }}
                  style={styles.fieldRouteClearBtn}
                >
                  <Text style={styles.fieldRouteClearText}>✕ Limpar</Text>
                </Pressable>
              </View>
            ) : null}

            {gpsError || routeError ? (
              <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '700' }}>
                ⚠️ {routeError || gpsError}
              </Text>
            ) : null}
          </View>

          <View style={{ flex: 1 }}>
            <TerritoryLeafletMap
              mode={fieldMapMode}
              pins={mapPins}
              quadras={territoryQuadras}
              outlines={[]}
              showStreetLabels
              showQuadraPopup
              selectedKey={selectedFieldKey}
              fitRequest={fitRequest}
              userLocation={userLocation}
              panToUserRequest={panToUserRequest}
              activeRoute={activeRoute}
              walkingSequence={walkingSequence}
              pickingOriginMode={pickingOriginMode}
              onPickOriginOnMap={(lat, lng) => {
                setManualOrigin(lat, lng);
                setPickingOriginMode(false);
                setRouteError(null);
              }}
              onSelectPin={(k) => setSelectedFieldKey(k)}
              onSelectQuadra={(k) => setSelectedFieldKey(k)}
              onToggleWork={(k) => handleToggleUnit(k)}
              onEditPin={() => undefined}
              onCustomizePin={() => undefined}
              onOpenGoogleMapsPin={(k) => {
                const p = mapPins.find((x) => x.key === k);
                if (p) {
                  openExternalGoogleMaps({
                    lat: p.lat,
                    lng: p.lng,
                    line: p.line,
                    label: p.label,
                    city: p.city || defaultCity,
                    originLat: userLocation?.lat,
                    originLng: userLocation?.lng,
                    mode: 'directions',
                  });
                }
              }}
              onRouteToPinInMap={(k) => {
                const p = mapPins.find((x) => x.key === k);
                if (p) {
                  handleTraceRouteInMap({
                    lat: p.lat,
                    lng: p.lng,
                    label: p.line || p.label,
                    city: p.city || defaultCity,
                  });
                }
              }}
              onOpenGoogleMapsQuadra={(qKey) => {
                const q = territoryQuadras.find((x) => x.key === qKey);
                if (q) {
                  openExternalGoogleMaps({
                    lat: q.centerLat,
                    lng: q.centerLng,
                    streetName: q.perimeterStreets[0] || q.label,
                    label: q.label,
                    city: defaultCity,
                    originLat: userLocation?.lat,
                    originLng: userLocation?.lng,
                    mode: 'directions',
                  });
                }
              }}
              onRouteToQuadraInMap={(qKey) => {
                const q = territoryQuadras.find((x) => x.key === qKey);
                if (q) {
                  handleTraceRouteInMap({
                    lat: q.centerLat,
                    lng: q.centerLng,
                    label: q.label,
                    city: defaultCity,
                    streetName: q.perimeterStreets[0],
                  });
                }
              }}
              onRouteToQuadraAddressesInMap={(qKey) => {
                handleTraceQuadraAddressesRoute(qKey);
              }}
            />
          </View>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {territoryQuadras.map((quadra) => (
            <View
              key={quadra.key}
              style={[styles.quadraCard, daylightMode && styles.quadraCardDaylight]}
            >
              <View style={styles.quadraHeader}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={[styles.quadraTitle, daylightMode && styles.textDaylight]}>
                    {quadra.label}
                  </Text>
                  <Text style={[styles.quadraSub, daylightMode && { color: '#475569' }]}>
                    {formatQuadraPerimeterDescription(quadra.perimeterStreets)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%' }}>
                  <Pressable
                    testID={`field-quadra-edit-${quadra.key}`}
                    onPress={() => openTerritoryManager('edit', quadra.key, quadra.label)}
                    style={[
                      styles.gmapsHeaderChip,
                      {
                        backgroundColor: 'rgba(255, 184, 0, 0.14)',
                        borderColor: 'rgba(255, 184, 0, 0.45)',
                      },
                    ]}
                  >
                    <Text style={[styles.gmapsHeaderChipText, { color: '#FFB800' }]}>
                      ✏️ Nome/Nº
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`field-quadra-add-address-${quadra.key}`}
                    onPress={() => openTerritoryManager('new_address', quadra.key, quadra.label)}
                    style={[
                      styles.gmapsHeaderChip,
                      {
                        backgroundColor: 'rgba(16, 185, 129, 0.14)',
                        borderColor: 'rgba(16, 185, 129, 0.45)',
                      },
                    ]}
                  >
                    <Text style={[styles.gmapsHeaderChipText, { color: '#34D399' }]}>
                      ➕ Endereço
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`field-quadra-share-${quadra.key}`}
                    onPress={() => handleQuickShareQuadra(quadra.key, quadra.label)}
                    style={[
                      styles.gmapsHeaderChip,
                      {
                        backgroundColor: 'rgba(16, 185, 129, 0.22)',
                        borderColor: '#10B981',
                      },
                    ]}
                  >
                    <Text style={[styles.gmapsHeaderChipText, { color: '#34D399' }]}>
                      📲 Compartilhar
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`field-quadra-gmaps-${quadra.key}`}
                    onPress={() =>
                      openExternalGoogleMaps({
                        lat: quadra.centerLat,
                        lng: quadra.centerLng,
                        streetName: quadra.perimeterStreets[0] || quadra.label,
                        label: quadra.label,
                        city: defaultCity,
                        originLat: userLocation?.lat,
                        originLng: userLocation?.lng,
                        mode: 'directions',
                      })
                    }
                    style={styles.gmapsHeaderChip}
                  >
                    <Text style={styles.gmapsHeaderChipText}>🗺️ Google Maps</Text>
                  </Pressable>
                  <Pressable
                    testID={`field-quadra-route-${quadra.key}`}
                    disabled={routingBusy}
                    onPress={() =>
                      handleTraceRouteInMap({
                        lat: quadra.centerLat,
                        lng: quadra.centerLng,
                        label: quadra.label,
                        city: defaultCity,
                        streetName: quadra.perimeterStreets[0],
                      })
                    }
                    style={[
                      styles.gmapsHeaderChip,
                      {
                        backgroundColor: 'rgba(16, 185, 129, 0.16)',
                        borderColor: 'rgba(16, 185, 129, 0.45)',
                      },
                    ]}
                  >
                    <Text style={[styles.gmapsHeaderChipText, { color: '#34D399' }]}>
                      🧭 Rota no Mapa
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleToggleQuadra(quadra)}
                    style={[
                      styles.quadraToggleBtn,
                      quadra.isCompleted && styles.quadraToggleBtnDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quadraToggleText,
                        quadra.isCompleted && styles.quadraToggleTextDone,
                      ]}
                    >
                      {quadra.isCompleted ? '↺ Reabrir' : '✓ Concluir Quadra'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {quadra.streets.map((street, sIdx) => {
                const orderedUnits = sortUnitsByWalkingMode(street.units, walkMode);
                return (
                  <View
                    key={sIdx}
                    style={[styles.streetBlock, daylightMode && styles.streetBlockDaylight]}
                  >
                    <View style={styles.streetHeader}>
                      <Text style={[styles.streetName, { flex: 1 }, daylightMode && { color: '#B45309' }]}>
                        📍 {street.streetName}
                      </Text>
                      <Pressable
                        testID={`field-street-gmaps-${quadra.key}-${sIdx}`}
                        onPress={() =>
                          openExternalGoogleMaps({
                            streetName: street.streetName,
                            city: defaultCity,
                            lat: street.units[0]?.lat ?? quadra.centerLat,
                            lng: street.units[0]?.lng ?? quadra.centerLng,
                            originLat: userLocation?.lat,
                            originLng: userLocation?.lng,
                            mode: 'directions',
                          })
                        }
                        style={styles.gmapsHeaderChip}
                      >
                        <Text style={styles.gmapsHeaderChipText}>🗺️ Abrir Rua no Maps</Text>
                      </Pressable>
                      <Text style={[styles.streetCount, { marginLeft: 8 }, daylightMode && { color: '#334155' }]}>
                        {street.workedUnits}/{street.totalUnits}
                      </Text>
                    </View>
                    <View style={styles.unitsGrid}>
                      {orderedUnits.map((unit) => {
                        const done = unit.worked === 1;
                        return (
                          <View
                            key={unit.key}
                            style={[
                              styles.unitBtn,
                              done
                                ? daylightMode
                                  ? styles.unitBtnDoneDaylight
                                  : styles.unitBtnDone
                                : daylightMode
                                ? styles.unitBtnDaylight
                                : styles.unitBtnPending,
                            ]}
                          >
                            <Pressable
                              testID={`field-unit-toggle-${unit.key}`}
                              onPress={() => handleToggleUnit(unit.key)}
                              style={{ alignItems: 'center', gap: 4, width: '100%' }}
                              accessibilityRole="button"
                              accessibilityLabel={`Casa ${unit.numberOrComplement || unit.street}, ${done ? 'concluída' : 'pendente'}`}
                            >
                              <Text
                                style={[
                                  styles.unitNum,
                                  daylightMode && styles.textDaylight,
                                  done && (daylightMode ? { color: '#065F46' } : styles.unitNumDone),
                                ]}
                              >
                                Nº {unit.numberOrComplement || 'S/N'}
                              </Text>
                              <Text
                                style={[
                                  styles.unitStatus,
                                  daylightMode && { color: '#475569' },
                                  done && (daylightMode ? { color: '#047857' } : styles.unitStatusDone),
                                ]}
                              >
                                {done ? '✓ Feito' : '⬜ Pendente'}
                              </Text>
                            </Pressable>
                            <View style={styles.fieldUnitActionsRow}>
                              <Pressable
                                testID={`field-unit-gmaps-${unit.key}`}
                                onPress={() =>
                                  openExternalGoogleMaps({
                                    lat: unit.lat,
                                    lng: unit.lng,
                                    streetName: street.streetName,
                                    numberOrComplement: unit.numberOrComplement,
                                    label: `${unit.street || street.streetName}, ${unit.numberOrComplement}`,
                                    city: defaultCity,
                                    originLat: userLocation?.lat,
                                    originLng: userLocation?.lng,
                                    mode: 'directions',
                                  })
                                }
                                style={styles.fieldUnitMiniBtn}
                                accessibilityLabel={`Abrir Nº ${unit.numberOrComplement || 'S/N'} no Google Maps`}
                              >
                                <Text style={styles.fieldUnitMiniBtnText}>🗺️ Maps</Text>
                              </Pressable>
                              <Pressable
                                testID={`field-unit-share-${unit.key}`}
                                onPress={() => handleQuickShareUnit(unit.key)}
                                style={[
                                  styles.fieldUnitMiniBtn,
                                  {
                                    backgroundColor: 'rgba(16, 185, 129, 0.16)',
                                    borderColor: 'rgba(16, 185, 129, 0.45)',
                                  },
                                ]}
                                accessibilityLabel={`Compartilhar localização de Nº ${unit.numberOrComplement || 'S/N'}`}
                              >
                                <Text style={[styles.fieldUnitMiniBtnText, { color: '#34D399' }]}>
                                  📲 Local
                                </Text>
                              </Pressable>
                              <Pressable
                                testID={`field-unit-transfer-${unit.key}`}
                                onPress={() =>
                                  openTerritoryManager(
                                    'transfer_addresses',
                                    quadra.key,
                                    quadra.label,
                                    unit.key
                                  )
                                }
                                style={[
                                  styles.fieldUnitMiniBtn,
                                  {
                                    backgroundColor: 'rgba(192, 132, 252, 0.14)',
                                    borderColor: 'rgba(192, 132, 252, 0.45)',
                                  },
                                ]}
                                accessibilityLabel={`Transferir endereço Nº ${unit.numberOrComplement || 'S/N'} para outro território`}
                              >
                                <Text style={[styles.fieldUnitMiniBtnText, { color: '#C084FC' }]}>
                                  🔀
                                </Text>
                              </Pressable>
                              <Pressable
                                testID={`field-unit-edit-${unit.key}`}
                                onPress={() => {
                                  const found = flatRegistry.find((n) => pathKey.equals(n.key, unit.key));
                                  if (found) setEditingAddressItem(found);
                                }}
                                style={[
                                  styles.fieldUnitMiniBtn,
                                  { borderColor: 'rgba(255, 184, 0, 0.45)' },
                                ]}
                                accessibilityLabel={`Editar endereço Nº ${unit.numberOrComplement || 'S/N'}`}
                              >
                                <Text style={[styles.fieldUnitMiniBtnText, { color: '#FFB800' }]}>
                                  ✏️
                                </Text>
                              </Pressable>
                              {unit.lat !== undefined && unit.lng !== undefined ? (
                                <Pressable
                                  testID={`field-unit-route-${unit.key}`}
                                  onPress={() =>
                                    handleTraceRouteInMap({
                                      lat: unit.lat as number,
                                      lng: unit.lng as number,
                                      label: `${street.streetName}, ${unit.numberOrComplement || 'S/N'}`,
                                      city: defaultCity,
                                      streetName: street.streetName,
                                    })
                                  }
                                  style={[
                                    styles.fieldUnitMiniBtn,
                                    { borderColor: 'rgba(56, 189, 248, 0.45)' },
                                  ]}
                                  accessibilityLabel={`Traçar rota para Nº ${unit.numberOrComplement || 'S/N'} no mapa`}
                                >
                                  <Text style={[styles.fieldUnitMiniBtnText, { color: '#38BDF8' }]}>
                                    🧭 Rota
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Sticky Bottom Action Bar: Share / Export CSV / Delta Sync */}
      <View style={[styles.bottomBar, daylightMode && styles.headerDaylight, { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }]}>
        <Pressable
          testID="publisher-bottom-share-btn"
          onPress={handleQuickShareTerritory}
          style={[
            styles.returnBtn,
            {
              flex: 1,
              minWidth: 160,
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              borderColor: '#10B981',
            },
          ]}
        >
          <Text style={[styles.returnBtnText, { color: '#34D399' }]}>
            📲 Compartilhar Território (WhatsApp / Maps)
          </Text>
        </Pressable>
        <Pressable
          testID="publisher-bottom-delta-btn"
          onPress={() => setShowDeltaModal(true)}
          style={[styles.returnBtn, { flex: 1, minWidth: 180 }]}
        >
          <Text style={styles.returnBtnText}>
            🔄 Sincronizar Progresso em Equipe (Delta)
          </Text>
        </Pressable>
      </View>

      <AddressEditModal
        visible={Boolean(editingAddressItem)}
        item={editingAddressItem}
        onClose={() => setEditingAddressItem(null)}
        onSave={async (key, updates) => {
          const prevNode = flatRegistry.find((n) => pathKey.equals(n.key, key));
          const prevTerr = prevNode ? resolveTerritoryNumber(prevNode) : '';
          const updatedNodes = updateSingleNodeInCleanRegistry(flatRegistry, key, updates);
          const nextTerr = String(updates.meta?.territory_number || '').trim();
          let finalClean = updatedNodes;
          let toastMsg = '✅ Endereço salvo na memória!';
          if (nextTerr && prevTerr && nextTerr.toUpperCase() !== prevTerr.toUpperCase()) {
            const transferred = transferAddressesBetweenTerritories(updatedNodes, {
              sourceTerritoryNumber: prevTerr,
              destinationTerritoryNumber: nextTerr,
              destinationTerritoryName: updates.meta?.territory_name
                ? String(updates.meta.territory_name)
                : undefined,
              mode: 'single',
              addressKeys: [key],
              emptySourcePolicy: 'keep_header',
            });
            finalClean = transferred.cleanNodes;
            toastMsg = `🔀 Endereço transferido de ${prevTerr} → ${transferred.destinationTerritoryNumber} e salvo!`;
          }
          await commitTerritoryNodes(finalClean);
          if (nextTerr) {
            setActiveTerritory(nextTerr);
          }
          showToast(toastMsg);
        }}
      />

      <TerritoryManageModal
        visible={manageModalOpen}
        initialTab={manageModalTab}
        targetTerritoryNumber={effectiveTerritory}
        targetGroupKey={manageTargetGroupKey}
        targetGroupLabel={manageTargetGroupLabel}
        targetAddressKey={manageTargetAddressKey}
        cleanNodes={flatRegistry}
        onClose={() => setManageModalOpen(false)}
        onCommitNodes={commitTerritoryNodes}
      />

      <DeltaSyncModal
        visible={showDeltaModal}
        eventId={eventId}
        flatRegistry={flatRegistry}
        onClose={() => setShowDeltaModal(false)}
        onSyncApplied={async (updated) => {
          await commitTerritoryNodes(updated);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: '#0D1117',
  },
  containerDaylight: {
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#141923',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  headerDaylight: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#CBD5E1',
    borderTopColor: '#CBD5E1',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  btnDaylight: {
    backgroundColor: '#E2E8F0',
    borderColor: '#94A3B8',
    borderWidth: 1,
  },
  btnDaylightActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  backBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  textDaylight: {
    color: '#0F172A',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#0D1117',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeSwitchDaylight: {
    backgroundColor: '#E2E8F0',
    borderColor: '#94A3B8',
  },
  modeBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: '#FFB800',
  },
  modeBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeBtnTextActive: {
    color: '#0D1117',
    fontWeight: '900',
  },
  territoryRow: {
    gap: 8,
    paddingVertical: 2,
  },
  territoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  territoryChipActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.18)',
    borderColor: '#FFB800',
  },
  territoryChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  territoryChipTextActive: {
    color: '#FFB800',
  },
  progressBanner: {
    gap: 6,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  territoryTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  assigneeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  assigneeBadgeOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: '#EF4444',
  },
  assigneeBadgeText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '800',
  },
  assigneeEditRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  assigneeInput: {
    flex: 1,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#F8FAFC',
    fontSize: 13,
  },
  assigneeInputDaylight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#64748B',
    color: '#0F172A',
  },
  assigneeSaveBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  assigneeSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  progressCount: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  track: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFB800',
  },
  fillDone: {
    backgroundColor: '#10B981',
  },
  mapWrapper: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  quadraCard: {
    backgroundColor: '#141923',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 14,
  },
  quadraCardDaylight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#94A3B8',
    borderWidth: 1.5,
  },
  quadraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  quadraTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  quadraSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  quadraToggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quadraToggleBtnDone: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  quadraToggleText: {
    color: '#052E16',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  quadraToggleTextDone: {
    color: '#E2E8F0',
  },
  streetBlock: {
    backgroundColor: '#0D1117',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  streetBlockDaylight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  streetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  streetName: {
    color: '#FFB800',
    fontSize: 14,
    fontWeight: '800',
  },
  streetCount: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unitBtn: {
    minWidth: 104,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  unitBtnDaylight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#64748B',
  },
  unitBtnPending: {
    backgroundColor: '#161C28',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  unitBtnDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: '#10B981',
  },
  unitBtnDoneDaylight: {
    backgroundColor: '#D1FAE5',
    borderColor: '#059669',
  },
  unitNum: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  unitNumDone: {
    color: '#34D399',
  },
  unitStatus: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  unitStatusDone: {
    color: '#10B981',
  },
  gmapsHeaderChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gmapsHeaderChipText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  fieldMapToolbar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#141923',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  fieldMapToolBtn: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldMapToolBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  fieldMapToolBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  fieldMapToolBtnTextActive: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  fieldRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fieldRouteText: {
    flex: 1,
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldRouteClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldRouteClearText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  fieldUnitActionsRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  fieldUnitMiniBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  fieldUnitMiniBtnText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  bottomBar: {
    padding: 14,
    backgroundColor: '#141923',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  returnBtn: {
    backgroundColor: '#FFB800',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  returnBtnText: {
    color: '#0D1117',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
});
