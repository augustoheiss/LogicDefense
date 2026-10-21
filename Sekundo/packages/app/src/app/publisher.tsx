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
  buildWalkingSequenceRoute,
  formatRouteDistance,
  formatRouteDuration,
} from '@sekundo/core';
import type {
  FlatSkeletonEntry,
  QuadraSummary,
  QuadraAddressUnit,
  RouteCalculationResult,
  WalkingSequenceRoute,
} from '@sekundo/core';
import { DeltaSyncModal } from '../components/territory/DeltaSyncModal';
import { TerritoryLeafletMap } from '../components/map/TerritoryLeafletMap';
import type { MapPin } from '../components/map/mapTypes';
import { loadSavedTerritoryRegistry } from '../storage/omniStorageBridge';
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
    events.find((e) => e.config.id === 'seed-territorios-s13') ||
    events.find((e) => (e.config.engines || []).includes('territory_logistics')) ||
    events[0] ||
    null;
  const eventId = rawEventId || fallbackEvent?.config.id || 'seed-territorios-s13';
  const {
    flatRegistry: rawRegistry,
    updateNode,
    updateNodes,
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
    const partitioned = selectEnginePartitionNodes(rawRegistry || [], 'territory_logistics');
    if (partitioned.length > 0) return partitioned;
    const savedPartitioned = selectEnginePartitionNodes(
      savedTerritoryRegistry,
      'territory_logistics'
    );
    if (savedPartitioned.length > 0) return savedPartitioned;
    return buildTerritoriosS13HistoricalRegistry();
  }, [rawRegistry, savedTerritoryRegistry]);

  const resolveRawKey = (cleanKey: string): string => {
    if (rawRegistry && rawRegistry.some((n) => n.key === `T::${cleanKey}`)) {
      return `T::${cleanKey}`;
    }
    return cleanKey;
  };

  const [daylightMode, setDaylightMode] = useState<boolean>(false);
  const [walkMode, setWalkMode] = useState<'sequential' | 'sidewalk'>('sidewalk');
  const [editingAssignee, setEditingAssignee] = useState<boolean>(false);
  const [assigneeDraft, setAssigneeDraft] = useState<string>('');

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
    const targetUnits = territoryQuadras
      .flatMap((q) => q.streets.flatMap((s) => s.units))
      .map((u) => flatRegistry.find((n) => pathKey.equals(n.key, u.key)))
      .filter((n): n is FlatSkeletonEntry => Boolean(n));

    if (targetUnits.length > 0) {
      await updateNodes(
        targetUnits.map((n) => ({
          key: resolveRawKey(n.key),
          updates: {
            meta: {
              ...(n.meta || {}),
              workerName: trimmed || undefined,
              assignedAt: trimmed ? (n.meta as any)?.assignedAt || today : undefined,
            },
          },
        }))
      );
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
    await updateNode(resolveRawKey(target.key), {
      value: nextWorked === 1 ? (meta.workerName || 'Trabalhado') : '',
      meta: buildWorkedMeta(meta, nextWorked),
    });
  };

  const handleToggleQuadra = async (quadra: QuadraSummary) => {
    const nextWorked: 0 | 1 = quadra.isCompleted ? 0 : 1;
    const now = new Date();
    const patches = quadra.streets
      .flatMap((s) => s.units)
      .map((u) => flatRegistry.find((n) => pathKey.equals(n.key, u.key)))
      .filter((n): n is FlatSkeletonEntry => Boolean(n))
      .map((n) => ({
        key: resolveRawKey(n.key),
        updates: {
          value: nextWorked === 1 ? ((n.meta as any)?.workerName || 'Trabalhado') : '',
          meta: buildWorkedMeta(n.meta, nextWorked, now),
        },
      }));
    await updateNodes(patches);
  };

  const handleTraceRouteInMap = async (dest: {
    lat: number;
    lng: number;
    label: string;
    city?: string;
    streetName?: string;
  }) => {
    setRoutingBusy(true);
    if (viewMode !== 'map') {
      setViewMode('map');
    }
    try {
      let origin: { lat: number; lng: number } | null = userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : null;
      if (!origin) {
        const gpsFix = await enableGpsAndGetPosition(2800);
        if (gpsFix) origin = { lat: gpsFix.lat, lng: gpsFix.lng };
      }
      if (!origin) {
        const candidatePin =
          rawMapPins.find(
            (p) => Math.abs(p.lat - dest.lat) > 0.0001 || Math.abs(p.lng - dest.lng) > 0.0001
          ) || rawMapPins[0];
        if (candidatePin) {
          origin = { lat: candidatePin.lat, lng: candidatePin.lng };
        } else if (territoryQuadras.length > 0) {
          origin = {
            lat: territoryQuadras[0].centerLat,
            lng: territoryQuadras[0].centerLng,
          };
        } else {
          origin = { lat: dest.lat - 0.0025, lng: dest.lng - 0.0025 };
        }
      }
      const route = await calculateMapRoute(origin, { lat: dest.lat, lng: dest.lng }, 'foot', 3000);
      setActiveRoute(route);
      setRouteDestinationMeta(dest);
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
        {territoryList.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.territoryRow}
          >
            {territoryList.map((tNum) => {
              const active = tNum === effectiveTerritory;
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
                    Território {tNum}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Big Progress & Assignment Banner */}
        <View style={styles.progressBanner}>
          <View style={styles.progressTextRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Text style={[styles.territoryTitle, daylightMode && styles.textDaylight]}>
                📱 Território {effectiveTerritory}
              </Text>
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

            {gpsError ? (
              <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '700' }}>
                ⚠️ {gpsError}
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
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quadraTitle, daylightMode && styles.textDaylight]}>
                    {quadra.label}
                  </Text>
                  <Text style={[styles.quadraSub, daylightMode && { color: '#475569' }]}>
                    {formatQuadraPerimeterDescription(quadra.perimeterStreets)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                                    label: unit.fullLabel,
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

      {/* Sticky Bottom Action Bar: 1-Tap Return Territory Delta */}
      <View style={[styles.bottomBar, daylightMode && styles.headerDaylight]}>
        <Pressable onPress={() => setShowDeltaModal(true)} style={styles.returnBtn}>
          <Text style={styles.returnBtnText}>
            📤 Devolver Território / Enviar Atualizações (Delta)
          </Text>
        </Pressable>
      </View>

      <DeltaSyncModal
        visible={showDeltaModal}
        eventId={eventId}
        flatRegistry={flatRegistry}
        onClose={() => setShowDeltaModal(false)}
        onSyncApplied={async (updated) => {
          await saveSkeleton(updated);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    gap: 12,
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
  },
  gmapsHeaderChipText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
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
  },
  fieldMapToolBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  fieldMapToolBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
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
  },
  fieldRouteClearText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
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
    borderRadius: 12,
    alignItems: 'center',
  },
  returnBtnText: {
    color: '#0D1117',
    fontSize: 14,
    fontWeight: '900',
  },
});
