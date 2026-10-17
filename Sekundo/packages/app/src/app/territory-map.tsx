/**
 * Page: territory-map
 *
 * Super Cartographic WebGIS for Field Work & Territory Logistics.
 * Advanced Features:
 * - Color-coded by Territory (unique vibrant color per territory)
 * - Geometric shape-coded by City/Location (Circle, Triangle, Square, Diamond)
 * - Territory selector chips: view all or filter by a specific territory with auto-fit bounds
 * - Full address inspection: street, neighborhood, city, CEP, property type, foreign language
 * - Instant toggle worked status (1/0)
 * - Full manual editing directly from the map via AddressEditModal
 * - 100% sovereign & local-first (OpenStreetMap & Leaflet with ZERO paid API keys)
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { storage } from '../storage/localStorage';
import {
  registerSovereignServiceWorker,
  cacheBoundingBoxTiles,
  getCachedTileCount,
} from '../storage/offlineTiles';
import {
  pathKey,
  computeTerritoryRecencyList,
  calculateDaysDifference,
  extractQuadrasFromRegistry,
  formatQuadraPerimeterDescription,
  computeMergedTerritoryPolygon,
  buildWorkedMeta,
  resolveTerritoryNumber,
  parseLatLng,
  validateBoundary,
  roundRing,
  buildTerritoriosS13HistoricalRegistry,
  selectEnginePartitionNodes,
} from '@sekundo/core';
import type {
  FlatSkeletonEntry,
  TerritoryRecencySort,
  TerritoryRecencyItem,
  QuadraSummary,
} from '@sekundo/core';
import { AddressEditModal } from '../components/territory/AddressEditModal';
import {
  PinStyleModal,
  PIN_SHAPES,
  COLOR_PALETTE,
} from '../components/territory/PinStyleModal';
import type { PinShape } from '../components/territory/PinStyleModal';
import { DeltaSyncModal } from '../components/territory/DeltaSyncModal';
import { TerritoryLeafletMap } from '../components/map/TerritoryLeafletMap';
import type { LatLngTuple, MapEditSession, MapPin } from '../components/map/mapTypes';
import { CadToolDock, type CadToolDefinition } from '../components/ui/CadToolDock';
import { TerritoryFloatingLegend } from '../components/territory/TerritoryFloatingLegend';
import {
  DEFAULT_MAP_SYMBOLOGY_CONFIG,
  SYMBOLOGY_DIMENSION_OPTIONS,
  SYMBOLOGY_SHAPES,
  SYMBOLOGY_SHAPE_META,
  resolvePinSymbology,
  buildSymbologyLegend,
  type MapSymbologyConfig,
} from '../components/territory/mapSymbologyEngine';
import { loadSavedTerritoryRegistry } from '../storage/omniStorageBridge';

const BUFFER_OPTIONS_METERS = [-5, 0, 3, 6, 10, 20, 40];

interface PinItem {
  key: string;
  label: string;
  worked: number;
  lat: number | null;
  lng: number | null;
  notes?: string;
  lastWorkedAt?: string;
  workerName?: string;
  territoryNumber: string;
  locality?: string;
  line?: string;
  line2?: string;
  city: string;
  state?: string;
  postalcode?: string;
  propertyType: string;
  isForeign: boolean;
  language?: string;
  color: string;
  shape: PinShape;
  assignedAt?: string;
  completedAt?: string;
  daysSinceCompleted?: number | null;
}

const TERRITORY_COLOR_PALETTE = COLOR_PALETTE;

const SHAPES_CYCLE: PinShape[] = [
  'circle',
  'triangle',
  'square',
  'pentagon',
  'hexagon',
  'diamond',
  'star',
  'pin',
];

const SHAPE_ICONS: Record<PinShape, string> = {
  circle: '●',
  triangle: '▲',
  square: '■',
  pentagon: '⬠',
  hexagon: '⬢',
  diamond: '◆',
  star: '★',
  pin: '📍',
};

export default function TerritoryMapScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = viewportWidth < 768;
  const { id, territory } = useLocalSearchParams();
  const rawEventId = typeof id === 'string' ? id : '';
  const initialTerritory = typeof territory === 'string' && territory ? territory : 'all';

  const { events } = useLocalEvent();
  const fallbackEvent =
    events.find((e) => e.config.id === rawEventId) ||
    events.find((e) => e.config.id === 'seed-territorios-s13') ||
    events.find((e) => (e.config.engines || []).includes('territory_logistics')) ||
    events[0] ||
    null;
  const eventId = rawEventId || fallbackEvent?.config.id || 'seed-territorios-s13';
  const event = fallbackEvent;
  const {
    flatRegistry: rawRegistry,
    updateNode,
    updateNodes,
    upsertNode,
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
    const savedPartitioned = selectEnginePartitionNodes(savedTerritoryRegistry, 'territory_logistics');
    if (savedPartitioned.length > 0) return savedPartitioned;
    return buildTerritoriosS13HistoricalRegistry();
  }, [rawRegistry, savedTerritoryRegistry]);

  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'worked'>('all');
  const [selectedTerritory, setSelectedTerritory] = useState<string>(initialTerritory);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPinKey, setSelectedPinKey] = useState<string | null>(null);
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);
  const [showRecencyModal, setShowRecencyModal] = useState<boolean>(false);
  const [recencySortMode, setRecencySortMode] = useState<TerritoryRecencySort>('priority_oldest_first');
  const [mapViewMode, setMapViewMode] = useState<'quadras' | 'pins'>('quadras');
  const [selectedQuadraKey, setSelectedQuadraKey] = useState<string | null>(null);
  const [symbologyConfig, setSymbologyConfig] = useState<MapSymbologyConfig>(
    DEFAULT_MAP_SYMBOLOGY_CONFIG
  );

  // Advanced customization & synchronization states
  const [showPinStyleModal, setShowPinStyleModal] = useState<boolean>(false);
  const [pinStyleTarget, setPinStyleTarget] = useState<PinItem | null>(null);
  const [showDeltaSyncModal, setShowDeltaSyncModal] = useState<boolean>(false);
  const [mergeTerritoryMode, setMergeTerritoryMode] = useState<boolean>(false);
  const [newStreetInput, setNewStreetInput] = useState<string>('');

  // Load persisted territory outline toggle
  // Viewport is only re-framed when this counter changes (first load frames automatically).
  const [fitRequest, setFitRequest] = useState<number>(0);
  const requestFit = () => setFitRequest((n) => n + 1);
  const [showStreetLabels, setShowStreetLabels] = useState<boolean>(false);
  const [offlineTileCount, setOfflineTileCount] = useState<number>(0);
  const [offlineCachingStatus, setOfflineCachingStatus] = useState<string | null>(null);

  useEffect(() => {
    registerSovereignServiceWorker();
    getCachedTileCount().then(setOfflineTileCount).catch(() => undefined);
    if (!eventId) return;
    storage.getItem(`sekundo:map-outline:${eventId}`).then((val) => {
      if (val === '1') setMergeTerritoryMode(true);
    });
    storage.getItem(`sekundo:map-streets:${eventId}`).then((val) => {
      if (val === '1') setShowStreetLabels(true);
    });
  }, [eventId]);

  const handleToggleMergeTerritoryMode = () => {
    const next = !mergeTerritoryMode;
    setMergeTerritoryMode(next);
    if (eventId) {
      storage.setItem(`sekundo:map-outline:${eventId}`, next ? '1' : '0').catch(() => undefined);
    }
  };

  const handleToggleStreetLabels = () => {
    const next = !showStreetLabels;
    setShowStreetLabels(next);
    if (eventId) {
      storage.setItem(`sekundo:map-streets:${eventId}`, next ? '1' : '0').catch(() => undefined);
    }
  };

  // Vertex editor session (one quadra at a time), live draft ring, and Undo stack.
  const [editSession, setEditSession] = useState<MapEditSession | null>(null);
  const [draftRing, setDraftRing] = useState<LatLngTuple[]>([]);
  const [ringHistory, setRingHistory] = useState<LatLngTuple[][]>([]);
  const [showUnlocated, setShowUnlocated] = useState<boolean>(false);

  // Compute territory recency list and lookup map
  const recencyList = useMemo(() => {
    return computeTerritoryRecencyList(flatRegistry, recencySortMode);
  }, [flatRegistry, recencySortMode]);

  const recencyMap = useMemo(() => {
    const map: Record<string, TerritoryRecencyItem> = {};
    for (const item of recencyList) {
      map[item.territoryNumber] = item;
    }
    return map;
  }, [recencyList]);

  // Extract all Quadras from flat registry
  const allQuadras = useMemo<QuadraSummary[]>(() => {
    return extractQuadrasFromRegistry(flatRegistry);
  }, [flatRegistry]);

  // Filtered Quadras
  const displayedQuadras = useMemo(() => {
    return allQuadras.filter((q) => {
      if (selectedTerritory !== 'all' && q.territoryNumber !== selectedTerritory) {
        return false;
      }
      if (filterMode === 'pending' && q.isCompleted) return false;
      if (filterMode === 'worked' && !q.isCompleted) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchLabel = q.label.toLowerCase().includes(query);
        const matchT = q.territoryNumber.toLowerCase().includes(query);
        const matchStreet = q.perimeterStreets.some((s) => s.toLowerCase().includes(query));
        return matchLabel || matchT || matchStreet;
      }
      return true;
    });
  }, [allQuadras, selectedTerritory, filterMode, searchQuery]);

  // Selected Quadra item
  const selectedQuadra = useMemo(() => {
    if (!selectedQuadraKey) return null;
    return allQuadras.find((q) => q.key === selectedQuadraKey) || null;
  }, [allQuadras, selectedQuadraKey]);

  // 1. Build distinct territory color map and city shape map
  const { territoryColorMap, cityShapeMap, territoryList, cityList } = useMemo(() => {
    const territories = new Set<string>();
    const cities = new Set<string>();

    // Leaves only: containers would otherwise create phantom territory chips.
    const parentKeys = new Set<string>();
    for (const node of flatRegistry) {
      const p = pathKey.parent(node.key);
      if (p) parentKeys.add(p);
    }

    flatRegistry.forEach((node) => {
      if (parentKeys.has(node.key) || node.type === 'header') return;
      const meta = (node.meta || {}) as Record<string, any>;
      territories.add(resolveTerritoryNumber(node));

      const cityName = meta.city || meta.cidade || 'Cidade Principal';
      cities.add(cityName);
    });

    const tArr = Array.from(territories).sort();
    const cArr = Array.from(cities).sort();

    const tMap: Record<string, string> = {};
    tArr.forEach((t, i) => {
      tMap[t] = TERRITORY_COLOR_PALETTE[i % TERRITORY_COLOR_PALETTE.length];
    });

    const cMap: Record<string, PinShape> = {};
    cArr.forEach((c, i) => {
      cMap[c] = SHAPES_CYCLE[i % SHAPES_CYCLE.length];
    });

    return {
      territoryColorMap: tMap,
      cityShapeMap: cMap,
      territoryList: tArr,
      cityList: cArr,
    };
  }, [flatRegistry]);

  // Neighborhood list for bulk style customizer
  const neighborhoodList = useMemo(() => {
    const set = new Set<string>();
    flatRegistry.forEach((n) => {
      const meta = (n.meta || {}) as Record<string, any>;
      const b = meta.line2 || meta.neighborhood || meta.bairro;
      if (b) set.add(String(b).trim());
    });
    return Array.from(set).sort();
  }, [flatRegistry]);

  // 2. Extract pins from flatRegistry using dynamic MapSymbologyEngine (default: unified compact circle, no legend clutter)
  const { allPins, leafEntries } = useMemo<{
    allPins: PinItem[];
    leafEntries: FlatSkeletonEntry[];
  }>(() => {
    const list: PinItem[] = [];
    const leaves: FlatSkeletonEntry[] = [];

    // Collect all parent keys
    const allParentKeys = new Set<string>();
    for (const node of flatRegistry) {
      const p = pathKey.parent(node.key);
      if (p) allParentKeys.add(p);
    }

    flatRegistry.forEach((node) => {
      // Skip parent containers (only plot leaf addresses)
      if (allParentKeys.has(node.key) || node.type === 'header') return;
      leaves.push(node);

      const meta = (node.meta || {}) as Record<string, any>;
      // Never invent a position: units without coordinates are listed separately.
      const coords = parseLatLng(meta);
      const lat = coords ? coords.lat : null;
      const lng = coords ? coords.lng : null;

      const worked = Number(meta.worked) === 1 ? 1 : 0;
      const territoryNumber = resolveTerritoryNumber(node);
      const city = meta.city || meta.cidade || 'Cidade Principal';
      const resolvedSymbology = resolvePinSymbology(
        {
          key: node.key,
          label: node.label,
          meta: { ...meta, territoryNumber, city },
        },
        worked === 1,
        symbologyConfig
      );
      const color = resolvedSymbology.color;
      const shape = resolvedSymbology.shape as PinShape;

      const assignedAt = meta.assignedAt || meta.assigned_date || meta.data_designacao;
      const completedAt = meta.completedAt || meta.completed_date || meta.data_conclusao;
      const daysSinceCompleted = completedAt ? calculateDaysDifference(String(completedAt)) : null;

      list.push({
        key: node.key,
        label: node.label,
        worked,
        lat,
        lng,
        notes: typeof meta.notes === 'string' ? meta.notes : undefined,
        lastWorkedAt: typeof meta.lastWorkedAt === 'string' ? meta.lastWorkedAt : undefined,
        workerName: node.value || (typeof meta.workerName === 'string' ? meta.workerName : undefined),
        territoryNumber,
        locality: meta.locality,
        line: meta.line,
        line2: meta.line2 || meta.neighborhood || meta.bairro,
        city,
        state: meta.state || meta.uf || 'SP',
        postalcode: meta.postalcode || meta.cep,
        propertyType: meta.property_type || meta.tipo_imovel || 'residencial',
        isForeign: Boolean(meta.is_foreign || meta.foreign || meta.language || meta.estrangeiro),
        language: meta.language || meta.idioma,
        color,
        shape,
        assignedAt: assignedAt ? String(assignedAt) : undefined,
        completedAt: completedAt ? String(completedAt) : undefined,
        daysSinceCompleted,
      });
    });

    return { allPins: list, leafEntries: leaves };
  }, [flatRegistry, symbologyConfig]);

  const symbologyLegendItems = useMemo(() => {
    return buildSymbologyLegend(leafEntries, symbologyConfig);
  }, [leafEntries, symbologyConfig]);

  // Territory outline ("Mostrar contorno do território"): hull of the quadras + 10 m margin.
  const mergedTerritoryPolygons = useMemo(() => {
    if (!mergeTerritoryMode) return [];
    const tMap: Record<string, QuadraSummary[]> = {};
    displayedQuadras.forEach((q) => {
      if (!tMap[q.territoryNumber]) tMap[q.territoryNumber] = [];
      tMap[q.territoryNumber].push(q);
    });

    return Object.entries(tMap).map(([tNum, qList]) => {
      const mergedPoly = computeMergedTerritoryPolygon(qList, 10);
      const color = territoryColorMap[tNum] || '#3B82F6';
      return {
        territoryNumber: tNum,
        polygon: mergedPoly,
        color,
        quadrasCount: qList.length,
        totalUnits: qList.reduce((acc, q) => acc + q.totalUnits, 0),
        workedUnits: qList.reduce((acc, q) => acc + q.workedUnits, 0),
      };
    });
  }, [displayedQuadras, mergeTerritoryMode, territoryColorMap]);

  // 3. Filtered pins based on territory, search query, and work status
  const displayedPins = useMemo(() => {
    return allPins.filter((pin) => {
      // Filter by territory
      if (selectedTerritory !== 'all' && pin.territoryNumber !== selectedTerritory) {
        return false;
      }

      // Filter by work status
      if (filterMode === 'pending' && pin.worked === 1) return false;
      if (filterMode === 'worked' && pin.worked === 0) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = pin.label.toLowerCase().includes(q);
        const matchKey = pin.key.toLowerCase().includes(q);
        const matchLine = (pin.line || '').toLowerCase().includes(q);
        const matchLine2 = (pin.line2 || '').toLowerCase().includes(q);
        const matchCity = pin.city.toLowerCase().includes(q);
        const matchTerritory = pin.territoryNumber.toLowerCase().includes(q);
        const matchNotes = (pin.notes || '').toLowerCase().includes(q);
        return matchLabel || matchKey || matchLine || matchLine2 || matchCity || matchTerritory || matchNotes;
      }

      return true;
    });
  }, [allPins, selectedTerritory, filterMode, searchQuery]);

  // Overall statistics for current selection
  const stats = useMemo(() => {
    const total = displayedPins.length;
    const worked = displayedPins.filter((p) => p.worked === 1).length;
    const pending = total - worked;
    const percent = total > 0 ? Math.round((worked / total) * 100) : 0;
    return { total, worked, pending, percent };
  }, [displayedPins]);

  // Only located units go to the map; the rest are listed so nothing silently disappears.
  const { mapPins, unlocatedPins } = useMemo(() => {
    const located: MapPin[] = [];
    const missing: PinItem[] = [];
    for (const p of displayedPins) {
      if (p.lat === null || p.lng === null) missing.push(p);
      else located.push({ ...p, lat: p.lat, lng: p.lng });
    }
    return { mapPins: located, unlocatedPins: missing };
  }, [displayedPins]);

  // Selected Pin Item
  const selectedPin = useMemo(() => {
    if (!selectedPinKey) return null;
    return allPins.find((p) => p.key === selectedPinKey) || null;
  }, [allPins, selectedPinKey]);

  // Toggle work status directly
  const handleToggleWork = async (targetKey: string) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, targetKey));
    if (!target) return;
    const meta = (target.meta || {}) as Record<string, any>;
    const nextWorked = Number(meta.worked) === 1 ? 0 : 1;

    await updateNode(targetKey, {
      value: nextWorked === 1 ? 'Trabalhado' : '',
      meta: buildWorkedMeta(meta, nextWorked),
    });
  };

  // Bulk toggle an entire Quadra (all address numbers) — one atomic write.
  const handleBulkToggleQuadra = async (quadra: QuadraSummary, markWorked: boolean) => {
    const now = new Date();
    const status: 0 | 1 = markWorked ? 1 : 0;
    const patches = quadra.streets
      .flatMap((s) => s.units)
      .map((unit) => flatRegistry.find((n) => pathKey.equals(n.key, unit.key)))
      .filter((n): n is FlatSkeletonEntry => Boolean(n))
      .map((n) => ({
        key: n.key,
        updates: { value: markWorked ? 'Trabalhado' : '', meta: buildWorkedMeta(n.meta, status, now) },
      }));
    await updateNodes(patches);
  };

  // Open external navigation without a vendor lock-in: `geo:` on Android, OpenStreetMap elsewhere.
  const handleOpenGPS = (pin: PinItem) => {
    const isAndroid =
      Platform.OS === 'android' ||
      (Platform.OS === 'web' && typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent));
    const address = [pin.line || pin.label, pin.city].filter(Boolean).join(', ');
    if (pin.lat !== null && pin.lng !== null) {
      const url = isAndroid
        ? `geo:${pin.lat},${pin.lng}?q=${pin.lat},${pin.lng}`
        : `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}#map=18/${pin.lat}/${pin.lng}`;
      Linking.openURL(url);
    } else {
      const url = isAndroid
        ? `geo:0,0?q=${encodeURIComponent(address)}`
        : `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
      Linking.openURL(url);
    }
  };

  // Apply Pin Style (individual or bulk)
  const handleApplyPinStyle = async (params: {
    scope: 'single' | 'territory' | 'neighborhood' | 'city';
    shape: PinShape;
    color: string;
    targetPinKey?: string;
    targetTerritory?: string;
    targetNeighborhood?: string;
    targetCity?: string;
  }) => {
    const updated = flatRegistry.map((node) => {
      const meta = (node.meta || {}) as Record<string, any>;
      let matches = false;

      if (params.scope === 'single' && params.targetPinKey && pathKey.equals(node.key, params.targetPinKey)) {
        matches = true;
      } else if (params.scope === 'territory' && params.targetTerritory) {
        if (resolveTerritoryNumber(node) === params.targetTerritory) matches = true;
      } else if (params.scope === 'neighborhood' && params.targetNeighborhood) {
        const neigh = meta.line2 || meta.neighborhood || meta.bairro;
        if (neigh === params.targetNeighborhood) matches = true;
      } else if (params.scope === 'city' && params.targetCity) {
        const c = meta.city || meta.cidade;
        if (c === params.targetCity) matches = true;
      }

      if (matches) {
        return {
          ...node,
          meta: {
            ...meta,
            pinShape: params.shape,
            pinColor: params.color,
          },
        };
      }
      return node;
    });

    await saveSkeleton(updated);
  };

  // Helper: upserts the quadra header node in flatRegistry so even auto-grouped quadras
  // can save custom colors, buffer meters, manual vertex boundaries, and perimeter streets.
  const upsertQuadraMeta = async (
    quadraKey: string,
    patchFn: (prevMeta: Record<string, any>) => Record<string, any>
  ) => {
    const existing = flatRegistry.find((n) => pathKey.equals(n.key, quadraKey));
    const qInfo = allQuadras.find((q) => pathKey.equals(q.key, quadraKey));
    const baseMeta: Record<string, any> = {
      ...(existing?.meta || {}),
      ...(qInfo?.territoryNumber ? { territory_number: qInfo.territoryNumber } : {}),
      metaUpdatedAt: new Date().toISOString(),
    };
    const nextMeta = patchFn(baseMeta);
    await upsertNode(quadraKey, 'header', existing?.label || qInfo?.label || `Quadra ${quadraKey}`, {
      meta: nextMeta,
    });
  };

  // Quadra Manual Customization Handlers
  const handleUpdateQuadraColor = async (quadraKey: string, colorHex: string | null) => {
    await upsertQuadraMeta(quadraKey, (meta) => {
      if (colorHex) {
        meta.customColor = colorHex;
      } else {
        delete meta.customColor;
        delete meta.custom_color;
      }
      return meta;
    });
  };

  // Margin around the quadra polygon, in meters (replaces the old scale-factor chips).
  const handleUpdateQuadraBuffer = async (quadraKey: string, meters: number) => {
    await upsertQuadraMeta(quadraKey, (meta) => {
      meta.bufferMeters = meters;
      delete meta.polygonExpansion;
      delete meta.polygon_expansion;
      return meta;
    });
  };

  // ---- Vertex editor -------------------------------------------------------
  const quadraUnitPoints = (q: QuadraSummary) =>
    q.streets
      .flatMap((s) => s.units)
      .filter((u) => u.lat !== undefined && u.lng !== undefined)
      .map((u) => ({ key: u.key, lat: u.lat as number, lng: u.lng as number }));

  const handleStartBoundaryEdit = (q: QuadraSummary, fromScratch = false) => {
    const initial = fromScratch ? [] : q.boundaryPolygon;
    setDraftRing(initial);
    setRingHistory([]);
    setEditSession({
      quadraKey: q.key,
      color: q.statusColor,
      initial,
      units: quadraUnitPoints(q).map((u) => [u.lat, u.lng] as LatLngTuple),
      revision: 0,
    });
  };

  const handleCancelBoundaryEdit = () => {
    setEditSession(null);
    setDraftRing([]);
    setRingHistory([]);
  };

  const handlePolygonDraftChange = (nextRing: LatLngTuple[]) => {
    setDraftRing((prev) => {
      if (prev.length > 0 && JSON.stringify(prev) !== JSON.stringify(nextRing)) {
        setRingHistory((h) => [...h.slice(-29), prev]);
      }
      return nextRing;
    });
  };

  const handleUndoBoundaryEdit = () => {
    if (ringHistory.length === 0 || !editSession) return;
    const prevRing = ringHistory[ringHistory.length - 1];
    setRingHistory((h) => h.slice(0, -1));
    setDraftRing(prevRing);
    setEditSession({
      ...editSession,
      initial: prevRing,
      revision: (editSession.revision || 0) + 1,
    });
  };

  const draftValidation = useMemo(() => {
    if (!editSession) return null;
    const q = allQuadras.find((x) => x.key === editSession.quadraKey);
    return validateBoundary(draftRing, q ? quadraUnitPoints(q) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSession, draftRing, allQuadras]);

  const activeEditSession = useMemo<MapEditSession | null>(() => {
    if (!editSession) return null;
    const q = allQuadras.find((x) => x.key === editSession.quadraKey);
    const pts = q ? quadraUnitPoints(q) : [];
    const outsideSet = new Set(draftValidation?.unitsOutside || []);
    const unitsOutside = pts
      .filter((u) => outsideSet.has(u.key))
      .map((u) => [u.lat, u.lng] as LatLngTuple);
    return {
      ...editSession,
      unitsOutside,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSession, draftValidation, allQuadras]);

  const handleSaveBoundaryEdit = async () => {
    if (!editSession || !draftValidation?.ok) return;
    const qKey = editSession.quadraKey;
    const savedRing = roundRing(draftRing);
    await upsertQuadraMeta(qKey, (meta) => {
      meta.boundaryPolygon = savedRing;
      meta.boundarySource = 'manual';
      meta.bufferMeters = 0;
      delete meta.polygonExpansion;
      delete meta.polygon_expansion;
      return meta;
    });
    handleCancelBoundaryEdit();
  };

  // "Voltar ao automático": drop the manual ring so the hull is recomputed from the units.
  const handleResetBoundaryToAuto = async (quadraKey: string) => {
    await upsertQuadraMeta(quadraKey, (meta) => {
      delete meta.boundaryPolygon;
      delete meta.boundarySource;
      delete meta.bufferMeters;
      return meta;
    });
  };

  // Pre-cache OSM tiles for the visible quadras/pins into sovereign CacheStorage
  const handleCacheOfflineTiles = async () => {
    const pts: [number, number][] = [];
    for (const q of displayedQuadras) {
      for (const p of q.boundaryPolygon) pts.push(p);
    }
    for (const pin of displayedPins) {
      if (pin.lat !== null && pin.lng !== null) pts.push([pin.lat, pin.lng]);
    }
    if (pts.length === 0) return;
    setOfflineCachingStatus('⏳ Baixando...');
    const res = await cacheBoundingBoxTiles(pts, (done, total) => {
      setOfflineCachingStatus(`⏳ ${done}/${total}`);
    });
    const totalCached = await getCachedTileCount();
    setOfflineTileCount(totalCached);
    setOfflineCachingStatus(`✓ ${res.cached} tiles`);
    setTimeout(() => setOfflineCachingStatus(null), 3000);
  };

  // Export Quadra boundary as RFC 7946 GeoJSON Polygon ([lng, lat])
  const handleExportQuadraGeoJSON = (q: QuadraSummary) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || q.boundaryPolygon.length < 3) return;
    const coords = q.boundaryPolygon.map(([lat, lng]) => [lng, lat]);
    if (coords.length > 0) coords.push(coords[0]); // close ring per GeoJSON spec
    const geojson = {
      type: 'Feature',
      properties: {
        key: q.key,
        label: q.label,
        territoryNumber: q.territoryNumber,
        perimeterStreets: q.perimeterStreets,
        boundarySource: q.boundarySource,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quadra-${q.key.replace(/[^a-zA-Z0-9_-]/g, '_')}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Quadra boundary from a .geojson file (hardened: max 2MB, max 2000 vertices, valid coords & non-self-intersecting)
  const handleImportQuadraGeoJSON = (quadraKey: string) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.geojson,.json,application/geo+json,application/json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file || file.size > 2 * 1024 * 1024) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const geom =
          parsed.type === 'FeatureCollection'
            ? parsed.features?.[0]?.geometry
            : parsed.type === 'Feature'
            ? parsed.geometry
            : parsed;
        const rawRing = geom?.type === 'Polygon' ? geom.coordinates?.[0] : geom?.type === 'MultiPolygon' ? geom.coordinates?.[0]?.[0] : null;
        if (!Array.isArray(rawRing) || rawRing.length < 3 || rawRing.length > 2000) return;
        const latLngRing: [number, number][] = rawRing
          .map((pt: any) => (Array.isArray(pt) && pt.length >= 2 ? ([Number(pt[1]), Number(pt[0])] as [number, number]) : null))
          .filter((pt): pt is [number, number] =>
            Boolean(
              pt &&
                Number.isFinite(pt[0]) &&
                Number.isFinite(pt[1]) &&
                pt[0] >= -90 &&
                pt[0] <= 90 &&
                pt[1] >= -180 &&
                pt[1] <= 180
            )
          );
        // Strip duplicate closing vertex if present
        if (
          latLngRing.length > 3 &&
          Math.abs(latLngRing[0][0] - latLngRing[latLngRing.length - 1][0]) < 1e-7 &&
          Math.abs(latLngRing[0][1] - latLngRing[latLngRing.length - 1][1]) < 1e-7
        ) {
          latLngRing.pop();
        }
        const check = validateBoundary(latLngRing, []);
        if (check.ok) {
          await upsertQuadraMeta(quadraKey, (meta) => {
            meta.boundaryPolygon = roundRing(latLngRing);
            meta.boundarySource = 'imported';
            meta.bufferMeters = 0;
            return meta;
          });
        }
      } catch {
        // Ignore malformed GeoJSON
      }
    };
    input.click();
  };

  const handleAddPerimeterStreet = async (quadraKey: string, newStreet: string) => {
    if (!newStreet.trim()) return;
    const currentStreets = selectedQuadra?.perimeterStreets || [];
    const nextStreets = Array.from(new Set([...currentStreets, newStreet.trim()]));
    await upsertQuadraMeta(quadraKey, (meta) => {
      meta.perimeter_streets = nextStreets;
      return meta;
    });
  };

  const handleRemovePerimeterStreet = async (quadraKey: string, streetToRemove: string) => {
    const currentStreets = selectedQuadra?.perimeterStreets || [];
    const nextStreets = currentStreets.filter((s) => s !== streetToRemove);
    await upsertQuadraMeta(quadraKey, (meta) => {
      meta.perimeter_streets = nextStreets;
      return meta;
    });
  };

  const handleResetPerimeterStreets = async (quadraKey: string) => {
    await upsertQuadraMeta(quadraKey, (meta) => {
      delete meta.perimeter_streets;
      delete meta.perimeterStreets;
      return meta;
    });
  };

  const handleDeltaSyncApplied = async (updatedRegistry: FlatSkeletonEntry[]) => {
    await saveSkeleton(updatedRegistry);
  };

  const cadTools = useMemo<CadToolDefinition[]>(() => {
    const activeFiltersCount =
      (selectedTerritory !== 'all' ? 1 : 0) +
      (filterMode !== 'all' ? 1 : 0) +
      (searchQuery.trim() ? 1 : 0);

    return [
      {
        id: 'mode',
        icon: mapViewMode === 'quadras' ? '🔷' : '📍',
        label:
          mapViewMode === 'quadras'
            ? `Modo Cartográfico: Quadras (${allQuadras.length})`
            : `Modo Cartográfico: Pontos (${allPins.length})`,
        shortcut: 'M',
        accentColor: '#38BDF8',
        isActive: true,
        description:
          'Alterna entre a visão de polígonos de quadras pintadas por cobertura e a visão individual de pontos de endereço no mapa.',
        confirmLabel:
          mapViewMode === 'quadras'
            ? `Alternar para Modo Pontos (${allPins.length})`
            : `Alternar para Modo Quadras (${allQuadras.length})`,
        onConfirm: () => {
          if (mapViewMode === 'quadras') {
            setMapViewMode('pins');
            setSelectedQuadraKey(null);
          } else {
            setMapViewMode('quadras');
            setSelectedPinKey(null);
          }
          requestFit();
        },
        renderCustomControls: (closePopover) => (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              testID="cad-mode-select-quadras"
              onPress={() => {
                setMapViewMode('quadras');
                setSelectedPinKey(null);
                requestFit();
                closePopover();
              }}
              style={[
                styles.viewModeBtn,
                { flex: 1, alignItems: 'center' },
                mapViewMode === 'quadras' && styles.viewModeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.viewModeBtnText,
                  mapViewMode === 'quadras' && styles.viewModeBtnTextActive,
                ]}
              >
                🔷 Quadras ({allQuadras.length})
              </Text>
            </Pressable>
            <Pressable
              testID="cad-mode-select-pins"
              onPress={() => {
                setMapViewMode('pins');
                setSelectedQuadraKey(null);
                requestFit();
                closePopover();
              }}
              style={[
                styles.viewModeBtn,
                { flex: 1, alignItems: 'center' },
                mapViewMode === 'pins' && styles.viewModeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.viewModeBtnText,
                  mapViewMode === 'pins' && styles.viewModeBtnTextActive,
                ]}
              >
                📍 Pontos ({allPins.length})
              </Text>
            </Pressable>
          </View>
        ),
      },
      {
        id: 'symbology',
        icon: '🎯',
        label: 'Simbologia & Hierarquia de Ícones',
        shortcut: 'S',
        accentColor: '#A855F7',
        isActive: symbologyConfig.dimension !== 'none',
        badge:
          symbologyConfig.dimension !== 'none'
            ? SYMBOLOGY_DIMENSION_OPTIONS.find((d) => d.id === symbologyConfig.dimension)?.shortLabel
            : undefined,
        description:
          'Por padrão, todos os pontos usam um único Círculo Compacto universal sem exibir legendas automáticas. Escolha abaixo se deseja separar cores/formas por Território, Zona, Bairro, Cidade, UF/País ou Profundidade da Chave.',
        confirmLabel:
          symbologyConfig.dimension === 'none'
            ? 'Manter Ícone Único (Sem Legenda)'
            : 'Aplicar Agrupamento e Mostrar Legenda',
        onConfirm: () => {
          if (mapViewMode !== 'pins') {
            setMapViewMode('pins');
            setSelectedQuadraKey(null);
          }
        },
        renderCustomControls: (closePopover) => (
          <View style={{ gap: 8 }}>
            <Text style={styles.customSubLabel}>Agrupar Ícones Por (Dimensão):</Text>
            <ScrollView style={{ maxHeight: 150 }} contentContainerStyle={{ gap: 4 }}>
              {SYMBOLOGY_DIMENSION_OPTIONS.map((opt) => {
                const active = symbologyConfig.dimension === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    testID={`symbology-dim-${opt.id}`}
                    onPress={() => {
                      setSymbologyConfig((prev) => ({ ...prev, dimension: opt.id }));
                      if (opt.id !== 'none' && mapViewMode !== 'pins') {
                        setMapViewMode('pins');
                        setSelectedQuadraKey(null);
                      }
                    }}
                    style={[
                      styles.expansionChip,
                      { paddingVertical: 6, paddingHorizontal: 10 },
                      active && {
                        backgroundColor: 'rgba(168, 85, 247, 0.22)',
                        borderColor: '#A855F7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.expansionChipText,
                        { fontSize: 11 },
                        active && { color: '#E9D5FF', fontWeight: '800' },
                      ]}
                    >
                      {active ? '● ' : '○ '}
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.customSubLabel}>Forma Base Universal:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {(['circle', 'pin', 'square', 'diamond', 'triangle', 'star', 'pentagon'] as const).map(
                (sh) => {
                  const active = symbologyConfig.baseShape === sh;
                  const meta = SYMBOLOGY_SHAPE_META[sh];
                  return (
                    <Pressable
                      key={sh}
                      testID={`symbology-shape-${sh}`}
                      onPress={() =>
                        setSymbologyConfig((prev) => ({ ...prev, baseShape: sh }))
                      }
                      style={[
                        styles.expansionChip,
                        active && {
                          backgroundColor: 'rgba(56, 189, 248, 0.22)',
                          borderColor: '#38BDF8',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.expansionChipText,
                          active && { color: '#38BDF8', fontWeight: '800' },
                        ]}
                      >
                        {meta.glyph} {meta.label}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>

            <Pressable
              testID="open-bulk-pin-style-modal-btn"
              onPress={() => {
                closePopover();
                setPinStyleTarget(null);
                setShowPinStyleModal(true);
              }}
              style={[styles.bulkStyleBtn, { alignSelf: 'stretch', alignItems: 'center' }]}
            >
              <Text style={styles.bulkStyleBtnText}>
                🎨 Personalizar Cores/Formas Manualmente...
              </Text>
            </Pressable>
          </View>
        ),
      },
      {
        id: 'filter',
        icon: '🔍',
        label: 'Filtro Tático, Território & Busca',
        shortcut: 'F',
        accentColor: '#FFB800',
        isActive: activeFiltersCount > 0,
        badge: activeFiltersCount > 0 ? activeFiltersCount : undefined,
        description:
          'Filtra quadras e endereços por número de território, status de cobertura (Pendentes / Concluídos) ou busca textual por rua/bairro.',
        confirmLabel: 'Aplicar Filtro e Enquadrar Mapa',
        onConfirm: () => {
          requestFit();
        },
        renderCustomControls: () => (
          <View style={{ gap: 8 }}>
            <TextInput
              testID="cad-filter-search-input"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="🔍 Rua, número, bairro ou nota..."
              placeholderTextColor="#6F7E94"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {(['all', 'pending', 'worked'] as const).map((mode) => {
                const active = filterMode === mode;
                const labels = {
                  all: `Todos (${allPins.length})`,
                  pending: `⬜ Pend. (${allPins.filter((p) => p.worked === 0).length})`,
                  worked: `✅ Concl. (${allPins.filter((p) => p.worked === 1).length})`,
                };
                return (
                  <Pressable
                    key={mode}
                    testID={`cad-filter-status-${mode}`}
                    onPress={() => setFilterMode(mode)}
                    style={[styles.statusTab, active && styles.statusTabActive]}
                  >
                    <Text style={[styles.statusTabText, active && styles.statusTabTextActive]}>
                      {labels[mode]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.customSubLabel}>Selecionar Território:</Text>
            <ScrollView style={{ maxHeight: 110 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              <Pressable
                onPress={() => {
                  setSelectedTerritory('all');
                  requestFit();
                }}
                style={[
                  styles.territoryChip,
                  selectedTerritory === 'all' && styles.territoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.territoryChipText,
                    selectedTerritory === 'all' && styles.territoryChipTextActive,
                  ]}
                >
                  🌐 Todos ({allPins.length})
                </Text>
              </Pressable>
              {territoryList.map((tNum) => {
                const active = selectedTerritory === tNum;
                const color = territoryColorMap[tNum] || '#3B82F6';
                const count = allPins.filter((p) => p.territoryNumber === tNum).length;
                const recencyInfo = recencyMap[tNum];
                let recencyBadgeText = '';
                if (recencyInfo && recencyInfo.totalUnits > 0) {
                  if (recencyInfo.isCompleted) {
                    if (
                      recencyInfo.daysSinceCompleted !== null &&
                      recencyInfo.daysSinceCompleted !== undefined
                    ) {
                      recencyBadgeText =
                        recencyInfo.daysSinceCompleted === 0
                          ? ' • 0d'
                          : ` • ${recencyInfo.daysSinceCompleted}d`;
                    } else {
                      recencyBadgeText = ' • 100%';
                    }
                  } else {
                    recencyBadgeText = ` • ${recencyInfo.percent}%`;
                  }
                }
                return (
                  <Pressable
                    key={tNum}
                    onPress={() => {
                      setSelectedTerritory(tNum);
                      requestFit();
                    }}
                    style={[
                      styles.territoryChip,
                      active && { backgroundColor: `${color}25`, borderColor: color },
                    ]}
                  >
                    <View style={[styles.colorDot, { backgroundColor: color }]} />
                    <Text style={[styles.territoryChipText, active && { color }]}>
                      {tNum} ({count}
                      {recencyBadgeText})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ),
      },
      {
        id: 'fit',
        icon: '⌖',
        label: 'Enquadrar Camadas no Mapa (Zoom Fit)',
        shortcut: 'Z',
        accentColor: '#38BDF8',
        description:
          'Recalcula automaticamente o zoom e o centro da câmera cartográfica para enquadrar todos os territórios, quadras ou pontos filtrados.',
        confirmLabel: '⌖ Executar Enquadramento Agora',
        onConfirm: () => {
          requestFit();
        },
      },
      {
        id: 'layers',
        icon: '🛣️',
        label: 'Camadas Auxiliares & Mapa Offline',
        shortcut: 'L',
        accentColor: '#10B981',
        isActive: showStreetLabels || mergeTerritoryMode || offlineTileCount > 0,
        badge: offlineTileCount > 0 ? offlineTileCount : undefined,
        description:
          'Ativa os rótulos de nomes das ruas delimitadoras sobre as quadras, exibe o contorno unificado do território ou baixa tiles OpenStreetMap para uso 100% offline.',
        confirmLabel: 'Concluir Ajuste de Camadas',
        onConfirm: () => {},
        renderCustomControls: () => (
          <View style={{ gap: 6 }}>
            <Pressable
              testID="cad-layer-toggle-streets"
              onPress={handleToggleStreetLabels}
              style={[
                styles.mergeTerritoryBtn,
                { marginTop: 0 },
                showStreetLabels && styles.mergeTerritoryBtnActive,
              ]}
            >
              <Text style={styles.mergeTerritoryBtnText}>
                {showStreetLabels
                  ? '✓ Nomes das ruas nas quadras: ATIVO'
                  : '🛣️ Mostrar nomes das ruas nas quadras'}
              </Text>
            </Pressable>
            <Pressable
              testID="cad-layer-toggle-outline"
              onPress={handleToggleMergeTerritoryMode}
              style={[
                styles.mergeTerritoryBtn,
                { marginTop: 0 },
                mergeTerritoryMode && styles.mergeTerritoryBtnActive,
              ]}
            >
              <Text style={styles.mergeTerritoryBtnText}>
                {mergeTerritoryMode
                  ? '✓ Contorno geral do território: ATIVO'
                  : '◌ Mostrar contorno geral do território'}
              </Text>
            </Pressable>
            <Pressable
              testID="cad-layer-cache-offline"
              onPress={handleCacheOfflineTiles}
              style={[
                styles.mergeTerritoryBtn,
                { marginTop: 0, borderColor: '#10B981' },
                offlineTileCount > 0 && { backgroundColor: 'rgba(16, 185, 129, 0.22)' },
              ]}
            >
              <Text style={styles.mergeTerritoryBtnText}>
                {offlineCachingStatus
                  ? offlineCachingStatus
                  : offlineTileCount > 0
                  ? `📦 Tiles Offline Salvos (${offlineTileCount}) — Atualizar`
                  : '📥 Baixar Tiles da Área para Uso Offline'}
              </Text>
            </Pressable>
          </View>
        ),
      },
      {
        id: 'recency',
        icon: '📊',
        label: 'Painel de Recência e Prioridade',
        shortcut: 'R',
        accentColor: '#FFB800',
        description:
          'Abre o relatório analítico de recência mostrando há quantos dias cada território foi concluído ou se está vencido (>4 meses), orientando novas designações.',
        confirmLabel: '📊 Abrir Relatório de Recência',
        onConfirm: () => {
          setShowRecencyModal(true);
        },
      },
      {
        id: 'sync',
        icon: '🔄',
        label: 'Sincronização Soberana (Delta Sync)',
        shortcut: 'D',
        accentColor: '#3B82F6',
        description:
          'Permite exportar ou mesclar pacotes criptografados de progresso de campo (CRDT / HLC) sem depender de servidores centrais.',
        confirmLabel: '🔄 Abrir Console Delta Sync',
        onConfirm: () => {
          setShowDeltaSyncModal(true);
        },
      },
      {
        id: 'operator',
        icon: '📱',
        label: 'Modo Operador de Campo (Visão de Rua)',
        shortcut: 'O',
        accentColor: '#10B981',
        description:
          'Abre a interface simplificada de bolso projetada para o operador em campo marcar casas rapidamente rua por rua.',
        confirmLabel: '📱 Ir para Modo Operador de Campo',
        onConfirm: () => {
          router.push(
            `/publisher?id=${eventId}${
              selectedTerritory !== 'all'
                ? `&territory=${encodeURIComponent(selectedTerritory)}`
                : ''
            }`
          );
        },
      },
      {
        id: 'checklist',
        icon: '📋',
        label: 'Modo Checklist Linear de Territórios',
        shortcut: 'C',
        accentColor: '#38BDF8',
        description:
          'Alterna para a visão em lista hierárquica expansível (acordeão) com todos os territórios, quadras e números.',
        confirmLabel: '📋 Abrir Checklist Linear',
        onConfirm: () => {
          router.push(
            `/territory-checklist?id=${eventId}${
              selectedTerritory !== 'all'
                ? `&territory=${encodeURIComponent(selectedTerritory)}`
                : ''
            }`
          );
        },
      },
    ];
  }, [
    mapViewMode,
    allQuadras.length,
    allPins,
    symbologyConfig,
    selectedTerritory,
    filterMode,
    searchQuery,
    territoryList,
    territoryColorMap,
    recencyMap,
    showStreetLabels,
    mergeTerritoryMode,
    offlineTileCount,
    offlineCachingStatus,
    eventId,
    router,
  ]);

  if (loading && flatRegistry.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
        <Text style={styles.loadingText}>Carregando visualização cartográfica...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Compact CAD Tool Dock (AutoCAD / Image Editor Paradigm: Pure Icons + 2-Step Popover) */}
      <CadToolDock
        testID="territory-cad-dock"
        tools={cadTools}
        leftSlot={
          <View style={styles.cadLeftBar}>
            <Pressable
              testID="map-back-btn"
              onPress={() => router.replace(`/skeleton-editor?id=${eventId}`)}
              style={styles.cadBackIconBtn}
              accessibilityLabel="Voltar ao Editor"
            >
              <Text style={styles.cadBackIconText}>←</Text>
            </Pressable>
            <View style={styles.cadTitleWrap}>
              <Text style={styles.cadTitleText} numberOfLines={1}>
                🗺️ {selectedTerritory === 'all' ? 'Mapa CAD' : selectedTerritory}
              </Text>
              <Text style={styles.cadHudSubText} numberOfLines={1}>
                {stats.percent}% ({stats.worked}/{stats.total})
              </Text>
            </View>
          </View>
        }
      />

      {/* Main Workspace (Map + Responsive Drawer/BottomSheet) */}
      <View style={styles.workspace}>
        {/* Persistent Leaflet map (no iframe): zoom survives every edit */}
        <View style={styles.mapContainer}>
          <TerritoryLeafletMap
            mode={mapViewMode}
            pins={mapPins}
            quadras={displayedQuadras}
            outlines={mergedTerritoryPolygons}
            showStreetLabels={showStreetLabels}
            selectedKey={mapViewMode === 'quadras' ? selectedQuadraKey : selectedPinKey}
            fitRequest={fitRequest}
            onSelectPin={(key) => {
              setSelectedPinKey(key);
              setSelectedQuadraKey(null);
            }}
            onSelectQuadra={(key) => {
              if (editSession) return;
              setSelectedQuadraKey(key);
              setSelectedPinKey(null);
            }}
            onToggleWork={(key) => handleToggleWork(key)}
            onEditPin={(key) => {
              const target = flatRegistry.find((n) => pathKey.equals(n.key, key));
              if (target) setEditingAddressItem(target);
            }}
            onCustomizePin={(key) => {
              const found = allPins.find((p) => p.key === key);
              if (found) {
                setPinStyleTarget(found);
                setShowPinStyleModal(true);
              }
            }}
            editSession={activeEditSession}
            onPolygonDraft={handlePolygonDraftChange}
          />

          {/* Floating Legend: hidden by default (dimension === 'none'), shown only when user groups icons */}
          <TerritoryFloatingLegend
            dimension={symbologyConfig.dimension}
            items={symbologyLegendItems}
            onResetToUnified={() =>
              setSymbologyConfig((prev) => ({ ...prev, dimension: 'none' }))
            }
          />

          {mapViewMode === 'pins' && unlocatedPins.length > 0 ? (
            <View style={styles.mapOverlay} pointerEvents="box-none">
              <Pressable
                onPress={() => setShowUnlocated(!showUnlocated)}
                style={[styles.mapOverlayBtn, styles.mapOverlayBtnWarn]}
              >
                <Text style={styles.mapOverlayBtnText}>
                  📍 {unlocatedPins.length} sem coord.
                </Text>
              </Pressable>
            </View>
          ) : null}

          {mapViewMode === 'pins' && showUnlocated && unlocatedPins.length > 0 ? (
            <View style={styles.unlocatedPanel}>
              <Text style={styles.unlocatedTitle}>Endereços sem coordenada (não aparecem no mapa)</Text>
              <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 6 }}>
                {unlocatedPins.map((p) => (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      const target = flatRegistry.find((n) => pathKey.equals(n.key, p.key));
                      if (target) setEditingAddressItem(target);
                    }}
                    style={styles.unlocatedRow}
                  >
                    <Text style={styles.unlocatedRowText} numberOfLines={1}>
                      {p.worked === 1 ? '✓ ' : ''}
                      {p.line || p.label}
                    </Text>
                    <Text style={styles.unlocatedRowHint}>✏️ adicionar</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* Side Details Drawer on Desktop / Overlay Bottom Sheet on Mobile */}
        {selectedQuadra ? (
          <View style={[styles.sideDrawer, isMobile && styles.sideDrawerMobile]} testID="territory-inspector-sheet">
            <View style={styles.drawerHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.drawerBadgeRow}>
                  <View
                    style={[
                      styles.drawerTerritoryBadge,
                      { backgroundColor: `${selectedQuadra.statusColor}20`, borderColor: selectedQuadra.statusColor },
                    ]}
                  >
                    <Text style={[styles.drawerTerritoryText, { color: selectedQuadra.statusColor }]}>
                      {selectedQuadra.territoryNumber}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.quadraStatusPill,
                      {
                        backgroundColor: `${selectedQuadra.statusColor}18`,
                        borderColor: selectedQuadra.statusColor,
                      },
                    ]}
                  >
                    <Text style={[styles.quadraStatusPillText, { color: selectedQuadra.statusColor }]}>
                      {selectedQuadra.isCompleted
                        ? '✓ Concluída (100%)'
                        : selectedQuadra.coveragePercent > 0
                        ? `⏳ Em Andamento (${selectedQuadra.coveragePercent}%)`
                        : '⬜ Não Iniciada (0%)'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.drawerTitle}>{selectedQuadra.label}</Text>
                <Text style={styles.quadraUnitCountSub}>
                  {selectedQuadra.workedUnits} de {selectedQuadra.totalUnits} números concluídos
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedQuadraKey(null);
                  handleCancelBoundaryEdit();
                }}
                style={styles.drawerCloseBtn}
              >
                <Text style={styles.drawerCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.drawerContent} contentContainerStyle={{ gap: 14 }}>
              {/* Perimeter Enclosing Streets Banner */}
              <View style={styles.perimeterCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.perimeterTitle}>🛣️ RUAS DELIMITADORAS DO PERÍMETRO</Text>
                  <Pressable
                    onPress={() => handleResetPerimeterStreets(selectedQuadra.key)}
                    style={{ paddingVertical: 2, paddingHorizontal: 6 }}
                  >
                    <Text style={{ color: '#60A5FA', fontSize: 10, fontWeight: '700' }}>
                      ↺ Recalcular auto
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.perimeterDesc}>
                  {formatQuadraPerimeterDescription(selectedQuadra.perimeterStreets)}
                </Text>
                <View style={styles.perimeterPillsRow}>
                  {selectedQuadra.perimeterStreets.map((street, idx) => (
                    <View key={idx} style={styles.perimeterStreetPill}>
                      <Text style={styles.perimeterStreetText}>{street}</Text>
                      <Pressable
                        onPress={() => handleRemovePerimeterStreet(selectedQuadra.key, street)}
                        style={styles.removeStreetBtn}
                      >
                        <Text style={styles.removeStreetText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                {/* Add Street Row */}
                <View style={styles.addStreetRow}>
                  <TextInput
                    style={styles.addStreetInput}
                    value={newStreetInput}
                    onChangeText={setNewStreetInput}
                    placeholder="➕ Nome da nova rua..."
                    placeholderTextColor="#6F7E94"
                  />
                  <Pressable
                    onPress={() => {
                      if (newStreetInput.trim()) {
                        handleAddPerimeterStreet(selectedQuadra.key, newStreetInput.trim());
                        setNewStreetInput('');
                      }
                    }}
                    style={styles.addStreetBtn}
                  >
                    <Text style={styles.addStreetBtnText}>Adicionar</Text>
                  </Pressable>
                </View>
              </View>

              {/* Quadra Manual Customization: Color & Buffer Size */}
              <View style={styles.quadraCustomCard}>
                <Text style={styles.quadraCustomTitle}>🎨 PERSONALIZAÇÃO DA QUADRA</Text>

                {/* Color Selector */}
                <Text style={styles.customSubLabel}>Cor do Polígono:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quadraColorScroll}>
                  <Pressable
                    onPress={() => handleUpdateQuadraColor(selectedQuadra.key, null)}
                    style={[
                      styles.quadraColorChip,
                      !selectedQuadra.customColor && styles.quadraColorChipActive,
                    ]}
                  >
                    <Text style={styles.quadraColorChipText}>🔄 Auto</Text>
                  </Pressable>
                  {COLOR_PALETTE.map((c) => {
                    const active = selectedQuadra.customColor === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => handleUpdateQuadraColor(selectedQuadra.key, c)}
                        style={[
                          styles.quadraColorDot,
                          { backgroundColor: c },
                          active && styles.quadraColorDotActive,
                        ]}
                      />
                    );
                  })}
                </ScrollView>

                {/* Buffer selector, in meters */}
                <Text style={[styles.customSubLabel, { marginTop: 10 }]}>
                  Margem do polígono ({selectedQuadra.boundarySource === 'manual' ? 'contorno manual' : selectedQuadra.boundarySource === 'imported' ? 'contorno importado' : 'contorno automático'}):
                </Text>
                <View style={styles.expansionRow}>
                  {BUFFER_OPTIONS_METERS.map((m) => {
                    const isCur = selectedQuadra.bufferMeters === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => handleUpdateQuadraBuffer(selectedQuadra.key, m)}
                        style={[
                          styles.expansionChip,
                          isCur && styles.expansionChipActive,
                        ]}
                      >
                        <Text style={[styles.expansionChipText, isCur && styles.expansionChipTextActive]}>
                          {m === 0 ? 'Justo (0 m)' : m > 0 ? `+${m} m` : `${m} m`}
                          {m === 6 && selectedQuadra.boundarySource === 'auto' ? ' · padrão' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Vertex editor */}
                <Text style={[styles.customSubLabel, { marginTop: 12 }]}>Contorno da quadra:</Text>
                {editSession && editSession.quadraKey === selectedQuadra.key ? (
                  <View style={styles.editPanel}>
                    <Text style={styles.editHint}>
                      {editSession.initial.length >= 3
                        ? 'Arraste os vértices. Toque no ponto do meio de uma borda para criar um vértice; toque longo (600ms) ou clique direito num vértice para removê-lo.'
                        : 'Toque no mapa para desenhar os vértices. Dois toques no último ponto fecham o contorno.'}
                    </Text>
                    <Text style={styles.editHint}>Vértices: {draftRing.length}</Text>
                    {draftValidation?.errors.map((err) => (
                      <Text key={err} style={styles.editError}>⛔ {err}</Text>
                    ))}
                    {draftValidation && draftValidation.ok && draftValidation.unitsOutside.length > 0 ? (
                      <Text style={styles.editWarn}>
                        ⚠️ {draftValidation.unitsOutside.length} endereço(s) ficaram fora do contorno (destacados em vermelho no mapa).
                      </Text>
                    ) : null}
                    <View style={styles.editBtnRow}>
                      {ringHistory.length > 0 ? (
                        <Pressable onPress={handleUndoBoundaryEdit} style={[styles.editBtn, styles.editBtnGhost]}>
                          <Text style={styles.editBtnText}>↺ Desfazer</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={handleCancelBoundaryEdit} style={[styles.editBtn, styles.editBtnGhost]}>
                        <Text style={styles.editBtnText}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleSaveBoundaryEdit}
                        disabled={!draftValidation?.ok}
                        style={[styles.editBtn, styles.editBtnPrimary, !draftValidation?.ok && { opacity: 0.4 }]}
                      >
                        <Text style={[styles.editBtnText, { color: '#062016' }]}>Salvar contorno</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.editBtnRow}>
                    <Pressable
                      onPress={() => handleStartBoundaryEdit(selectedQuadra, selectedQuadra.boundaryPolygon.length < 3)}
                      style={[styles.editBtn, styles.editBtnPrimary]}
                    >
                      <Text style={[styles.editBtnText, { color: '#062016' }]}>✏️ Editar vértices</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleStartBoundaryEdit(selectedQuadra, true)}
                      style={[styles.editBtn, styles.editBtnGhost]}
                    >
                      <Text style={styles.editBtnText}>Desenhar do zero</Text>
                    </Pressable>
                    {selectedQuadra.boundarySource === 'manual' || selectedQuadra.boundarySource === 'imported' ? (
                      <Pressable
                        onPress={() => handleResetBoundaryToAuto(selectedQuadra.key)}
                        style={[styles.editBtn, styles.editBtnGhost]}
                      >
                        <Text style={styles.editBtnText}>↺ Voltar ao automático</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => handleImportQuadraGeoJSON(selectedQuadra.key)}
                      style={[styles.editBtn, styles.editBtnGhost]}
                    >
                      <Text style={styles.editBtnText}>📥 GeoJSON</Text>
                    </Pressable>
                    {selectedQuadra.boundaryPolygon.length >= 3 ? (
                      <Pressable
                        onPress={() => handleExportQuadraGeoJSON(selectedQuadra)}
                        style={[styles.editBtn, styles.editBtnGhost]}
                      >
                        <Text style={styles.editBtnText}>📤 GeoJSON</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}

                {/* Territory outline toggle */}
                <Pressable
                  onPress={handleToggleMergeTerritoryMode}
                  style={[
                    styles.mergeTerritoryBtn,
                    mergeTerritoryMode && styles.mergeTerritoryBtnActive,
                  ]}
                >
                  <Text style={styles.mergeTerritoryBtnText}>
                    {mergeTerritoryMode
                      ? '✓ Contorno dos territórios visível'
                      : '◌ Mostrar contorno do território'}
                  </Text>
                </Pressable>
              </View>

              {/* Bulk Toggle Button */}
              <Pressable
                onPress={() => {
                  const allWorked = selectedQuadra.isCompleted;
                  handleBulkToggleQuadra(selectedQuadra, !allWorked);
                }}
                style={[
                  styles.bulkQuadraBtn,
                  selectedQuadra.isCompleted ? styles.bulkQuadraBtnReopen : styles.bulkQuadraBtnComplete,
                ]}
              >
                <Text style={styles.bulkQuadraBtnText}>
                  {selectedQuadra.isCompleted
                    ? '↺ Reabrir Quadra (Marcar Todas Pendentes)'
                    : '✓ Concluir Toda a Quadra (Marcar Todas as Casas)'}
                </Text>
              </Pressable>

              {/* Street-by-street list and individual address units */}
              <View style={styles.streetsSection}>
                <Text style={styles.drawerSectionLabel}>NÚMEROS & ENDEREÇOS DA QUADRA</Text>
                <Text style={styles.privacyNote}>
                  🔒 Modo Soberano: Coordenadas GPS ocultadas para foco tático na marcação.
                </Text>

                {selectedQuadra.streets.map((group, sIdx) => {
                  return (
                    <View key={sIdx} style={styles.streetGroupCard}>
                      <View style={styles.streetGroupHeader}>
                        <Text style={styles.streetGroupName}>📍 {group.streetName}</Text>
                        <Text style={styles.streetGroupBadge}>
                          {group.workedUnits}/{group.totalUnits}
                        </Text>
                      </View>

                      <View style={styles.unitsGrid}>
                        {group.units.map((unit) => {
                          const isDone = unit.worked === 1;
                          return (
                            <Pressable
                              key={unit.key}
                              onPress={() => handleToggleWork(unit.key)}
                              style={[
                                styles.unitCard,
                                isDone ? styles.unitCardWorked : styles.unitCardPending,
                              ]}
                            >
                              <View style={styles.unitTopRow}>
                                <Text style={[styles.unitNumber, isDone && styles.unitNumberWorked]}>
                                  Nº {unit.numberOrComplement || 'S/N'}
                                </Text>
                                <Text style={isDone ? styles.unitCheckWorked : styles.unitCheckPending}>
                                  {isDone ? '✓' : '⬜'}
                                </Text>
                              </View>
                              {unit.propertyType ? (
                                <Text style={styles.unitPropertyType} numberOfLines={1}>
                                  {unit.propertyType === 'comercial' ? '🏢 Comércio' : unit.propertyType === 'predio' ? '🏙️ Prédio' : '🏠 Casa'}
                                </Text>
                              ) : null}
                              <Text style={[styles.unitActionLabel, isDone && styles.unitActionLabelWorked]}>
                                {isDone ? 'Concluído' : 'Pendente'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : selectedPin ? (
          <View style={[styles.sideDrawer, isMobile && styles.sideDrawerMobile]} testID="territory-inspector-sheet">
            <View style={styles.drawerHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.drawerBadgeRow}>
                  <View
                    style={[
                      styles.drawerTerritoryBadge,
                      { backgroundColor: `${selectedPin.color}20`, borderColor: selectedPin.color },
                    ]}
                  >
                    <Text style={[styles.drawerTerritoryText, { color: selectedPin.color }]}>
                      {selectedPin.territoryNumber}
                    </Text>
                  </View>
                  <Text style={styles.drawerCityBadge}>
                    {SHAPE_ICONS[selectedPin.shape]} {selectedPin.city}
                  </Text>
                </View>
                <Text style={styles.drawerTitle}>{selectedPin.line || selectedPin.label}</Text>
              </View>
              <Pressable onPress={() => setSelectedPinKey(null)} style={styles.drawerCloseBtn}>
                <Text style={styles.drawerCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.drawerContent} contentContainerStyle={{ gap: 12 }}>
              {/* Address details */}
              <View style={styles.drawerSection}>
                <Text style={styles.drawerSectionLabel}>ENDEREÇO COMPLETO</Text>
                {selectedPin.line2 ? (
                  <Text style={styles.drawerDetailRow}>Bairro: <Text style={styles.drawerDetailVal}>{selectedPin.line2}</Text></Text>
                ) : null}
                <Text style={styles.drawerDetailRow}>Cidade: <Text style={styles.drawerDetailVal}>{selectedPin.city} - {selectedPin.state}</Text></Text>
                {selectedPin.postalcode ? (
                  <Text style={styles.drawerDetailRow}>CEP: <Text style={styles.drawerDetailVal}>{selectedPin.postalcode}</Text></Text>
                ) : null}
                <Text style={styles.drawerDetailRow}>Tipo: <Text style={styles.drawerDetailVal}>{selectedPin.propertyType === 'comercial' ? '🏢 Comercial' : (selectedPin.propertyType === 'predio' ? '🏙️ Prédio' : '🏠 Residencial')}</Text></Text>
                {selectedPin.isForeign ? (
                  <Text style={styles.drawerDetailRow}>Estrangeiro: <Text style={[styles.drawerDetailVal, { color: '#60A5FA' }]}>🌐 {selectedPin.language || 'Sim'}</Text></Text>
                ) : null}
              </View>

              {/* Coordinates */}
              <View style={styles.drawerSection}>
                <Text style={styles.drawerSectionLabel}>COORDENADAS GPS</Text>
                <Text style={styles.coordsVal}>
                  {selectedPin.lat !== null && selectedPin.lng !== null
                    ? `Lat: ${selectedPin.lat.toFixed(6)}, Lng: ${selectedPin.lng.toFixed(6)}`
                    : 'Sem coordenada — edite o endereço para adicionar latitude/longitude.'}
                </Text>
              </View>

              {/* Cronograma & Datas */}
              <View style={styles.drawerSection}>
                <Text style={styles.drawerSectionLabel}>CRONOGRAMA & DATAS DE COBERTURA</Text>
                <Text style={styles.drawerDetailRow}>
                  Designação: <Text style={styles.drawerDetailVal}>{selectedPin.assignedAt || 'Não definida'}</Text>
                </Text>
                <Text style={styles.drawerDetailRow}>
                  Conclusão: <Text style={[styles.drawerDetailVal, selectedPin.completedAt ? { color: '#34D399', fontWeight: '700' } : {}]}>
                    {selectedPin.completedAt
                      ? `${selectedPin.completedAt} (${
                          selectedPin.daysSinceCompleted === 0
                            ? 'concluído hoje'
                            : selectedPin.daysSinceCompleted === 1
                            ? 'concluído ontem'
                            : selectedPin.daysSinceCompleted !== null &&
                              selectedPin.daysSinceCompleted !== undefined
                            ? `há ${selectedPin.daysSinceCompleted} dias`
                            : 'concluído'
                        })`
                      : 'Pendente / Não concluído'}
                  </Text>
                </Text>
              </View>

              {/* Field Notes */}
              {selectedPin.notes ? (
                <View style={styles.drawerSection}>
                  <Text style={styles.drawerSectionLabel}>OBSERVAÇÕES DE CAMPO</Text>
                  <Text style={styles.notesVal}>"{selectedPin.notes}"</Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.drawerActions}>
                {/* Toggle Work */}
                <Pressable
                  onPress={() => handleToggleWork(selectedPin.key)}
                  style={[
                    styles.drawerActionBtn,
                    selectedPin.worked === 1 ? styles.actionBtnPending : styles.actionBtnWorked,
                  ]}
                >
                  <Text style={styles.actionBtnText}>
                    {selectedPin.worked === 1 ? 'Marcar como Pendente' : '✓ Marcar como Concluído'}
                  </Text>
                </Pressable>

                {/* Customize Pin Style (Shape & Color) */}
                <Pressable
                  onPress={() => {
                    setPinStyleTarget(selectedPin);
                    setShowPinStyleModal(true);
                  }}
                  style={styles.pinStyleBtn}
                >
                  <Text style={styles.pinStyleBtnText}>🎨 Personalizar Ícone (Forma & Cor)</Text>
                </Pressable>

                {/* Edit Full Address */}
                <Pressable
                  onPress={() => {
                    const target = flatRegistry.find((n) => pathKey.equals(n.key, selectedPin.key));
                    if (target) setEditingAddressItem(target);
                  }}
                  style={styles.editFullBtn}
                >
                  <Text style={styles.editFullBtnText}>✏️ Editar Endereço Completo</Text>
                </Pressable>

                {/* Open in external GPS */}
                <Pressable
                  onPress={() => handleOpenGPS(selectedPin)}
                  style={styles.gpsNavBtn}
                >
                  <Text style={styles.gpsNavBtnText}>🧭 Abrir no app de navegação</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Address Edit Full Modal */}
      <AddressEditModal
        visible={!!editingAddressItem}
        item={editingAddressItem}
        onClose={() => setEditingAddressItem(null)}
        onSave={async (key, updates) => {
          await updateNode(key, updates);
        }}
      />

      {/* Territory Recency & Priority Modal */}
      {showRecencyModal ? (
        <View style={styles.modalOverlay}>
          <View style={styles.recencyModalCard}>
            <View style={styles.recencyModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recencyModalTitle}>📊 Recência e Cobertura dos Territórios</Text>
                <Text style={styles.recencyModalSub}>
                  Contagem de dias desde a conclusão para orientar novas designações de campo.
                </Text>
              </View>
              <Pressable onPress={() => setShowRecencyModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Sort Toggle */}
            <View style={styles.recencySortBar}>
              <Text style={styles.recencySortLabel}>ORDENAÇÃO:</Text>
              <Pressable
                onPress={() => setRecencySortMode('priority_oldest_first')}
                style={[
                  styles.recencySortChip,
                  recencySortMode === 'priority_oldest_first' && styles.recencySortChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.recencySortChipText,
                    recencySortMode === 'priority_oldest_first' && styles.recencySortChipTextActive,
                  ]}
                >
                  ⏳ Prioridade (Pendentes & Antigos)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRecencySortMode('recent_first')}
                style={[
                  styles.recencySortChip,
                  recencySortMode === 'recent_first' && styles.recencySortChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.recencySortChipText,
                    recencySortMode === 'recent_first' && styles.recencySortChipTextActive,
                  ]}
                >
                  ⚡ Mais Recentes Primeiro
                </Text>
              </Pressable>
            </View>

            {/* Recency List */}
            <ScrollView style={styles.recencyScrollList} contentContainerStyle={{ gap: 10 }}>
              {recencyList.filter((i) => i.totalUnits > 0).length === 0 ? (
                <View style={styles.emptyRecencyCard}>
                  <Text style={styles.emptyRecencyText}>Nenhum território registrado</Text>
                </View>
              ) : (
                recencyList.filter((i) => i.totalUnits > 0).map((item) => {
                  const color = territoryColorMap[item.territoryNumber] || '#3B82F6';
                  return (
                    <View key={item.territoryNumber} style={styles.recencyItemCard}>
                      <View style={styles.recencyItemLeft}>
                        <View style={[styles.recencyDot, { backgroundColor: color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recencyItemTitle}>Território {item.territoryNumber}</Text>
                          <Text style={styles.recencyItemMeta}>
                            {item.workedUnits}/{item.totalUnits} concluídos ({item.percent}%)
                            {item.assignedAt ? ` • Desig: ${item.assignedAt}` : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.recencyItemRight}>
                        {item.isOverdue ? (
                          <View
                            style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.16)',
                              borderColor: 'rgba(239, 68, 68, 0.45)',
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Text style={{ color: '#F87171', fontSize: 11, fontWeight: '700' }}>
                              ⚠️ Vencido há {item.daysSinceAssigned}d (&gt;4m)
                            </Text>
                          </View>
                        ) : null}
                        {item.isCompleted ? (
                          <View style={styles.recencyBadgeCompleted}>
                            <Text style={styles.recencyBadgeCompletedText}>
                              🏆 Concluído{' '}
                              {item.daysSinceCompleted === 0
                                ? 'hoje'
                                : item.daysSinceCompleted === 1
                                ? 'ontem (1d)'
                                : item.daysSinceCompleted !== null &&
                                  item.daysSinceCompleted !== undefined
                                ? `há ${item.daysSinceCompleted} dias`
                                : ''}
                            </Text>
                          </View>
                        ) : item.percent > 0 ? (
                          <View style={styles.recencyBadgeInProgress}>
                            <Text style={styles.recencyBadgeInProgressText}>
                              ⏳ Em andamento ({item.percent}%)
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.recencyBadgePending}>
                            <Text style={styles.recencyBadgePendingText}>
                              ⬜ Não trabalhado
                            </Text>
                          </View>
                        )}

                        <Pressable
                          onPress={() => {
                            setSelectedTerritory(item.territoryNumber);
                            setShowRecencyModal(false);
                          }}
                          style={styles.recencyFocusBtn}
                        >
                          <Text style={styles.recencyFocusBtnText}>🎯 Focar no Mapa</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* Pin Style Customizer Modal */}
      <PinStyleModal
        visible={showPinStyleModal}
        initialPinKey={pinStyleTarget?.key || null}
        initialPinLabel={pinStyleTarget?.line || pinStyleTarget?.label}
        initialTerritory={pinStyleTarget?.territoryNumber || (selectedTerritory !== 'all' ? selectedTerritory : territoryList[0])}
        initialNeighborhood={pinStyleTarget?.line2 || neighborhoodList[0]}
        initialCity={pinStyleTarget?.city || cityList[0]}
        initialShape={pinStyleTarget?.shape || 'circle'}
        initialColor={pinStyleTarget?.color || '#3B82F6'}
        territoryList={territoryList}
        neighborhoodList={neighborhoodList}
        cityList={cityList}
        onClose={() => {
          setShowPinStyleModal(false);
          setPinStyleTarget(null);
        }}
        onApply={handleApplyPinStyle}
      />

      {/* Delta Sync (Mode 1) Modal */}
      <DeltaSyncModal
        visible={showDeltaSyncModal}
        eventId={eventId}
        flatRegistry={flatRegistry}
        onClose={() => setShowDeltaSyncModal(false)}
        onSyncApplied={handleDeltaSyncApplied}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
  },
  cadLeftBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cadBackIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadBackIconText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  cadTitleWrap: {
    justifyContent: 'center',
  },
  cadTitleText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  cadHudSubText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#8A94A6',
    fontSize: 13,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#161A24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flex: 1,
  },
  backBtn: {
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  hudCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: 170,
  },
  hudMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  hudPercent: {
    color: '#10B981',
    fontSize: 22,
    fontWeight: '800',
  },
  hudCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  hudLabel: {
    color: '#8A94A6',
    fontSize: 10,
  },
  hudTrack: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  hudFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  filterBar: {
    backgroundColor: '#181C28',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  searchInput: {
    backgroundColor: '#12151C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterRowLabel: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chipsScroll: {
    flex: 1,
  },
  territoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 6,
    gap: 6,
  },
  territoryChipActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderColor: '#FFB800',
  },
  territoryChipText: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '600',
  },
  territoryChipTextActive: {
    color: '#FFB800',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusTab: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  statusTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusTabText: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '600',
  },
  statusTabTextActive: {
    color: '#FFFFFF',
  },
  checklistBtn: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  checklistBtnText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  legendTitle: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '800',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendShapeIcon: {
    color: '#FFB800',
    fontSize: 12,
  },
  legendLabel: {
    color: '#A9B4C5',
    fontSize: 11,
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#12151C',
  },
  mobilePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mobilePlaceholderText: {
    color: '#8A94A6',
    fontSize: 14,
    textAlign: 'center',
  },
  sideDrawer: {
    width: 340,
    backgroundColor: '#161922',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
  },
  sideDrawerMobile: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxHeight: '58%',
    zIndex: 1300,
    borderLeftWidth: 0,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(56, 189, 248, 0.35)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  drawerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  drawerTerritoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  drawerTerritoryText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  drawerCityBadge: {
    color: '#8A94A6',
    fontSize: 11,
  },
  drawerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  drawerCloseBtn: {
    padding: 4,
  },
  drawerCloseText: {
    color: '#8A94A6',
    fontSize: 16,
  },
  drawerContent: {
    flex: 1,
    padding: 16,
  },
  drawerSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  drawerSectionLabel: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  drawerDetailRow: {
    color: '#8A94A6',
    fontSize: 12,
    marginBottom: 2,
  },
  drawerDetailVal: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  coordsVal: {
    color: '#FFB800',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  notesVal: {
    color: '#E2E8F0',
    fontSize: 12,
    fontStyle: 'italic',
  },
  drawerActions: {
    gap: 8,
    marginTop: 8,
  },
  drawerActionBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnWorked: {
    backgroundColor: '#10B981',
  },
  actionBtnPending: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  editFullBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  editFullBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  gpsNavBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  gpsNavBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActionBtns: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  recencyBtn: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  recencyBtnText: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  recencyModalCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '85%',
    backgroundColor: '#161A24',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  recencyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  recencyModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  recencyModalSub: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#8A94A6',
    fontSize: 18,
    fontWeight: '700',
  },
  recencySortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  recencySortLabel: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recencySortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  recencySortChipActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderColor: '#FFB800',
  },
  recencySortChipText: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '600',
  },
  recencySortChipTextActive: {
    color: '#FFB800',
    fontWeight: '700',
  },
  recencyScrollList: {
    flex: 1,
  },
  emptyRecencyCard: {
    padding: 30,
    alignItems: 'center',
  },
  emptyRecencyText: {
    color: '#8A94A6',
    fontSize: 13,
  },
  recencyItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1A1F2C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  recencyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recencyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recencyItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recencyItemMeta: {
    color: '#8A94A6',
    fontSize: 11,
    marginTop: 2,
  },
  recencyItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recencyBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recencyBadgeCompletedText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  recencyBadgeInProgress: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recencyBadgeInProgressText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  recencyBadgePending: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recencyBadgePendingText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  recencyFocusBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  recencyFocusBtnText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  viewModeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: '#3B82F6',
  },
  viewModeBtnText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  viewModeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quadraStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  quadraStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quadraUnitCountSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  perimeterCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    padding: 12,
  },
  perimeterTitle: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  perimeterDesc: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  perimeterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  perimeterStreetPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  perimeterStreetText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
  },
  bulkQuadraBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkQuadraBtnComplete: {
    backgroundColor: '#10B981',
  },
  bulkQuadraBtnReopen: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  bulkQuadraBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  streetsSection: {
    gap: 12,
  },
  privacyNote: {
    color: '#6B7280',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  streetGroupCard: {
    backgroundColor: '#161A24',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 10,
  },
  streetGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingBottom: 6,
  },
  streetGroupName: {
    color: '#F3F4F6',
    fontSize: 13,
    fontWeight: '700',
  },
  streetGroupBadge: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitCard: {
    width: '48%',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    gap: 4,
  },
  unitCardWorked: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  unitCardPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  unitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitNumber: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '700',
  },
  unitNumberWorked: {
    color: '#34D399',
  },
  unitCheckWorked: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  unitCheckPending: {
    color: '#6B7280',
    fontSize: 12,
  },
  unitPropertyType: {
    color: '#8A94A6',
    fontSize: 10,
  },
  unitActionLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  unitActionLabelWorked: {
    color: '#10B981',
  },
  bulkStyleBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkStyleBtnText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  syncBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncBtnText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  pinStyleBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinStyleBtnText: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '700',
  },
  removeStreetBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  removeStreetText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  addStreetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addStreetInput: {
    flex: 1,
    backgroundColor: '#1E2433',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addStreetBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStreetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  quadraCustomCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 8,
  },
  quadraCustomTitle: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  customSubLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  quadraColorScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  quadraColorChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quadraColorChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  quadraColorChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  quadraColorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quadraColorDotActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  expansionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  expansionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  expansionChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  expansionChipText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
  },
  expansionChipTextActive: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  mergeTerritoryBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  mergeTerritoryBtnActive: {
    backgroundColor: '#8B5CF6',
  },
  mergeTerritoryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  mapOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 6,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  mapOverlayBtn: {
    backgroundColor: 'rgba(18, 21, 28, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapOverlayBtnActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.22)',
  },
  mapOverlayBtnWarn: {
    borderColor: '#F59E0B',
  },
  mapOverlayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  unlocatedPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(18, 21, 28, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    padding: 12,
    zIndex: 1000,
  },
  unlocatedTitle: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  unlocatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  unlocatedRowText: {
    color: '#E5E7EB',
    fontSize: 12,
    flex: 1,
  },
  unlocatedRowHint: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
  editPanel: {
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 8,
    padding: 10,
  },
  editHint: {
    color: '#A7B0C0',
    fontSize: 11,
    lineHeight: 16,
  },
  editError: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  editWarn: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  editBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  editBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  editBtnPrimary: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  editBtnGhost: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
