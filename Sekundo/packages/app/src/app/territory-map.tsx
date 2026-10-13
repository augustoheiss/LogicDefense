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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import {
  pathKey,
  computeTerritoryRecencyList,
  calculateDaysDifference,
  extractQuadrasFromRegistry,
  formatQuadraPerimeterDescription,
  computeMergedTerritoryPolygon,
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

interface PinItem {
  key: string;
  label: string;
  worked: number;
  lat: number;
  lng: number;
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
  'hexagon',
  'diamond',
  'star',
  'pin',
];

const SHAPE_ICONS: Record<PinShape, string> = {
  circle: '●',
  triangle: '▲',
  square: '■',
  hexagon: '⬢',
  diamond: '◆',
  star: '★',
  pin: '📍',
};

export default function TerritoryMapScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);
  const { flatRegistry, updateNode, saveSkeleton, loading } = useSkeleton(eventId);

  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'worked'>('all');
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPinKey, setSelectedPinKey] = useState<string | null>(null);
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);
  const [showRecencyModal, setShowRecencyModal] = useState<boolean>(false);
  const [recencySortMode, setRecencySortMode] = useState<TerritoryRecencySort>('priority_oldest_first');
  const [mapViewMode, setMapViewMode] = useState<'quadras' | 'pins'>('quadras');
  const [selectedQuadraKey, setSelectedQuadraKey] = useState<string | null>(null);

  // Advanced customization & synchronization states
  const [showPinStyleModal, setShowPinStyleModal] = useState<boolean>(false);
  const [pinStyleTarget, setPinStyleTarget] = useState<PinItem | null>(null);
  const [showDeltaSyncModal, setShowDeltaSyncModal] = useState<boolean>(false);
  const [mergeTerritoryMode, setMergeTerritoryMode] = useState<boolean>(false);
  const [newStreetInput, setNewStreetInput] = useState<string>('');

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

    flatRegistry.forEach((node) => {
      const meta = (node.meta || {}) as Record<string, any>;
      const tNum = meta.territory_number || meta.territory || node.key.split('-').slice(0, 3).join('-') || 'T01';
      territories.add(tNum);

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

  // 2. Extract pins from flatRegistry
  const allPins = useMemo<PinItem[]>(() => {
    const list: PinItem[] = [];

    // Collect all parent keys
    const allParentKeys = new Set<string>();
    for (const node of flatRegistry) {
      const p = pathKey.parent(node.key);
      if (p) allParentKeys.add(p);
    }

    flatRegistry.forEach((node, idx) => {
      // Skip parent containers (only plot leaf addresses)
      if (allParentKeys.has(node.key) || node.type === 'header') return;

      const meta = (node.meta || {}) as Record<string, any>;
      let lat = typeof meta.lat === 'number'
        ? meta.lat
        : (typeof meta.latitude === 'number'
          ? meta.latitude
          : (meta.lat ? parseFloat(String(meta.lat)) : (meta.latitude ? parseFloat(String(meta.latitude)) : undefined)));
      let lng = typeof meta.lng === 'number'
        ? meta.lng
        : (typeof meta.longitude === 'number'
          ? meta.longitude
          : (meta.lng ? parseFloat(String(meta.lng)) : (meta.longitude ? parseFloat(String(meta.longitude)) : undefined)));

      if (isNaN(lat as number)) lat = undefined;
      if (isNaN(lng as number)) lng = undefined;

      // Deterministic fallback mock coordinate based on index if empty
      if (lat === undefined || lng === undefined) {
        const baseLat = -23.5488;
        const baseLng = -46.3898;
        const offsetLat = ((idx * 17) % 100 - 50) * 0.00015;
        const offsetLng = ((idx * 23) % 100 - 50) * 0.00015;
        lat = baseLat + offsetLat;
        lng = baseLng + offsetLng;
      }

      const worked = Number(meta.worked) === 1 ? 1 : 0;
      const territoryNumber = meta.territory_number || meta.territory || node.key.split('-').slice(0, 3).join('-') || 'T01';
      const city = meta.city || meta.cidade || 'Cidade Principal';
      const customColor = (meta.pinColor || meta.pin_color) as string | undefined;
      const customShape = (meta.pinShape || meta.pin_shape) as PinShape | undefined;
      const color = customColor || territoryColorMap[territoryNumber] || '#3B82F6';
      const shape = customShape || cityShapeMap[city] || 'circle';

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

    return list;
  }, [flatRegistry, territoryColorMap, cityShapeMap]);

  // Merged territory polygons for consolidated quadras
  const mergedTerritoryPolygons = useMemo(() => {
    if (!mergeTerritoryMode) return [];
    const tMap: Record<string, QuadraSummary[]> = {};
    displayedQuadras.forEach((q) => {
      if (!tMap[q.territoryNumber]) tMap[q.territoryNumber] = [];
      tMap[q.territoryNumber].push(q);
    });

    return Object.entries(tMap).map(([tNum, qList]) => {
      const mergedPoly = computeMergedTerritoryPolygon(qList, 1.0006);
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
    const currentWorked = Number(meta.worked) === 1 ? 1 : 0;
    const nextWorked = currentWorked === 1 ? 0 : 1;
    const todayStr = new Date().toISOString().split('T')[0];

    const nextMeta: Record<string, any> = {
      ...meta,
      worked: nextWorked,
      lastWorkedAt: nextWorked === 1 ? new Date().toISOString() : undefined,
    };

    if (nextWorked === 1) {
      if (!nextMeta.completedAt) nextMeta.completedAt = todayStr;
      if (!nextMeta.completed_date) nextMeta.completed_date = todayStr;
      if (!nextMeta.data_conclusao) nextMeta.data_conclusao = todayStr;
    } else {
      delete nextMeta.completedAt;
      delete nextMeta.completed_date;
      delete nextMeta.data_conclusao;
      delete nextMeta.lastWorkedAt;
    }

    await updateNode(targetKey, {
      value: nextWorked === 1 ? 'Trabalhado' : '',
      meta: nextMeta,
    });
  };

  // Bulk toggle an entire Quadra (all address numbers)
  const handleBulkToggleQuadra = async (quadra: QuadraSummary, markWorked: boolean) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const allUnits = quadra.streets.flatMap((s) => s.units);
    for (const unit of allUnits) {
      const target = flatRegistry.find((n) => pathKey.equals(n.key, unit.key));
      if (!target) continue;
      const meta = (target.meta || {}) as Record<string, any>;
      const nextMeta: Record<string, any> = {
        ...meta,
        worked: markWorked ? 1 : 0,
        lastWorkedAt: markWorked ? new Date().toISOString() : undefined,
      };
      if (markWorked) {
        if (!nextMeta.completedAt) nextMeta.completedAt = todayStr;
        if (!nextMeta.completed_date) nextMeta.completed_date = todayStr;
        if (!nextMeta.data_conclusao) nextMeta.data_conclusao = todayStr;
      } else {
        delete nextMeta.completedAt;
        delete nextMeta.completed_date;
        delete nextMeta.data_conclusao;
        delete nextMeta.lastWorkedAt;
      }
      await updateNode(unit.key, {
        value: markWorked ? 'Trabalhado' : '',
        meta: nextMeta,
      });
    }
  };

  // Open external navigation app
  const handleOpenGPS = (pin: PinItem) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;
    Linking.openURL(url);
  };

  // Listen to messages from Leaflet iframe
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'SELECT_PIN') {
          setSelectedPinKey(e.data.key);
          setSelectedQuadraKey(null);
        } else if (e.data.type === 'SELECT_QUADRA') {
          setSelectedQuadraKey(e.data.key);
          setSelectedPinKey(null);
        } else if (e.data.type === 'TOGGLE_WORK') {
          handleToggleWork(e.data.key);
        } else if (e.data.type === 'EDIT_PIN') {
          const target = flatRegistry.find((n) => pathKey.equals(n.key, e.data.key));
          if (target) setEditingAddressItem(target);
        } else if (e.data.type === 'CUSTOMIZE_PIN') {
          const found = allPins.find((p) => p.key === e.data.key);
          if (found) {
            setPinStyleTarget(found);
            setShowPinStyleModal(true);
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [flatRegistry, allPins]);

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
        const tNum = meta.territory_number || meta.territory || node.key.split('-').slice(0, 3).join('-');
        if (tNum === params.targetTerritory) matches = true;
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

  // Quadra Manual Customization Handlers
  const handleUpdateQuadraColor = async (quadraKey: string, colorHex: string | null) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, quadraKey));
    if (!target) return;
    const meta = { ...(target.meta || {}) };
    if (colorHex) {
      meta.customColor = colorHex;
    } else {
      delete meta.customColor;
      delete meta.custom_color;
    }
    await updateNode(quadraKey, { meta });
  };

  const handleUpdateQuadraExpansion = async (quadraKey: string, factor: number) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, quadraKey));
    if (!target) return;
    const meta = { ...(target.meta || {}), polygonExpansion: factor };
    await updateNode(quadraKey, { meta });
  };

  const handleAddPerimeterStreet = async (quadraKey: string, newStreet: string) => {
    if (!newStreet.trim()) return;
    const target = flatRegistry.find((n) => pathKey.equals(n.key, quadraKey));
    if (!target) return;
    const currentStreets = selectedQuadra?.perimeterStreets || [];
    const nextStreets = Array.from(new Set([...currentStreets, newStreet.trim()]));
    const meta = { ...(target.meta || {}), perimeter_streets: nextStreets };
    await updateNode(quadraKey, { meta });
  };

  const handleRemovePerimeterStreet = async (quadraKey: string, streetToRemove: string) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, quadraKey));
    if (!target) return;
    const currentStreets = selectedQuadra?.perimeterStreets || [];
    const nextStreets = currentStreets.filter((s) => s !== streetToRemove);
    const meta = { ...(target.meta || {}), perimeter_streets: nextStreets };
    await updateNode(quadraKey, { meta });
  };

  const handleDeltaSyncApplied = async (updatedRegistry: FlatSkeletonEntry[]) => {
    await saveSkeleton(updatedRegistry);
  };

  // Build Leaflet HTML payload with dynamic colors, shapes, and responsive controls
  const leafletHTML = useMemo(() => {
    const isQuadrasMode = mapViewMode === 'quadras';
    const pinsData = JSON.stringify(displayedPins);
    const quadrasData = JSON.stringify(displayedQuadras);
    const mergedData = JSON.stringify(mergedTerritoryPolygons);
    let centerLat = displayedPins.length > 0 ? displayedPins[0].lat : -23.5488;
    let centerLng = displayedPins.length > 0 ? displayedPins[0].lng : -46.3898;

    if (isQuadrasMode && displayedQuadras.length > 0) {
      centerLat = displayedQuadras[0].centroid[0];
      centerLng = displayedQuadras[0].centroid[1];
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #12151C;
    }
    .leaflet-popup-content-wrapper {
      background: #181C28;
      color: #FFFFFF;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 12px 30px rgba(0,0,0,0.6);
      padding: 4px;
    }
    .leaflet-popup-tip {
      background: #181C28;
    }
    .popup-card {
      padding: 10px;
      min-width: 230px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .popup-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .popup-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-family: monospace;
    }
    .popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #FFFFFF;
      margin-bottom: 4px;
      line-height: 18px;
    }
    .popup-sub {
      font-size: 11px;
      color: #9CA3AF;
      margin-bottom: 8px;
    }
    .popup-extra {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 10px;
    }
    .popup-tag {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.06);
      color: #D1D5DB;
    }
    .popup-btn-row {
      display: flex;
      gap: 5px;
      margin-top: 8px;
    }
    .popup-btn {
      flex: 1;
      border: none;
      padding: 7px 8px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
    }
    .popup-btn-work {
      background: #10B981;
      color: #062016;
    }
    .popup-btn-pending {
      background: #EF4444;
      color: #FFFFFF;
    }
    .popup-btn-style {
      background: rgba(255, 184, 0, 0.15);
      border: 1px solid #FFB800;
      color: #FFB800;
      flex: 0.8;
    }
    .popup-btn-edit {
      background: rgba(255,255,255,0.1);
      color: #FFFFFF;
      flex: 0.6;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const isQuadrasMode = ${isQuadrasMode};
    const pins = ${pinsData};
    const quadras = ${quadrasData};
    const mergedTerritories = ${mergedData};
    const mergeTerritoryMode = ${mergeTerritoryMode};
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([${centerLat}, ${centerLng}], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const markersGroup = L.featureGroup();

    if (isQuadrasMode) {
      // -------------------------------------------------------------
      // MODO QUADRAS PINTADAS (Quarteirões Vetoriais com Ruas Delimitadoras)
      // -------------------------------------------------------------
      // 1. Render consolidated territory grand-polygon if merge mode is active
      if (mergeTerritoryMode && mergedTerritories && mergedTerritories.length > 0) {
        mergedTerritories.forEach(mt => {
          if (!mt.polygon || mt.polygon.length < 3) return;
          const tPoly = L.polygon(mt.polygon, {
            color: mt.color,
            weight: 4,
            dashArray: '8, 8',
            opacity: 0.95,
            fillColor: mt.color,
            fillOpacity: 0.22,
          });
          tPoly.bindTooltip(
            '<div style="font-family:sans-serif; padding:4px;">' +
              '<b style="color:' + mt.color + ';">🏛️ Território ' + mt.territoryNumber + ' (Consolidado)</b>' +
              '<div>' + mt.quadrasCount + ' quadras agrupadas</div>' +
              '<div>' + mt.workedUnits + '/' + mt.totalUnits + ' concluídos</div>' +
            '</div>',
            { sticky: true }
          );
          markersGroup.addLayer(tPoly);
        });
      }

      // 2. Render individual quadras
      quadras.forEach(q => {
        if (!q.boundaryPolygon || q.boundaryPolygon.length < 3) return;

        const poly = L.polygon(q.boundaryPolygon, {
          color: q.statusColor,
          weight: 3,
          opacity: 0.95,
          fillColor: q.statusColor,
          fillOpacity: 0.40,
        });

        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          window.parent.postMessage({ type: 'SELECT_QUADRA', key: q.key }, '*');
        });

        const tooltipContent = 
          '<div style="font-family:-apple-system, sans-serif; padding:4px;">' +
            '<div style="font-weight:800; font-size:13px; color:' + q.statusColor + ';">🏢 ' + q.label + '</div>' +
            '<div style="font-size:11px; color:#E5E7EB; margin-top:2px;">' +
              '<b>' + q.workedUnits + '/' + q.totalUnits + '</b> concluídos (' + q.coveragePercent + '%)' +
            '</div>' +
            (q.perimeterStreets && q.perimeterStreets.length > 0 ?
              '<div style="font-size:10px; color:#9CA3AF; margin-top:3px; max-width:220px;">' +
                '🛣️ ' + q.perimeterStreets.slice(0, 3).join(', ') +
              '</div>' : '') +
          '</div>';

        poly.bindTooltip(tooltipContent, { sticky: true });
        markersGroup.addLayer(poly);
      });
    } else {
      // -------------------------------------------------------------
      // MODO ALFINETES INDIVIDUAIS (GPS) - 7 Formatos Geométricos & Cores Livres
      // -------------------------------------------------------------
      pins.forEach(pin => {
        const isWorked = pin.worked === 1;
        const color = pin.color;
        const labelBadge = isWorked ? '✓' : '•';

        let shapeStyle = '';
        if (pin.shape === 'circle') {
          shapeStyle = 'width:26px; height:26px; border-radius:50%;';
        } else if (pin.shape === 'triangle') {
          shapeStyle = 'width:28px; height:26px; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);';
        } else if (pin.shape === 'square') {
          shapeStyle = 'width:24px; height:24px; border-radius:4px;';
        } else if (pin.shape === 'diamond') {
          shapeStyle = 'width:26px; height:26px; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);';
        } else if (pin.shape === 'hexagon') {
          shapeStyle = 'width:28px; height:26px; clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);';
        } else if (pin.shape === 'star') {
          shapeStyle = 'width:28px; height:28px; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);';
        } else if (pin.shape === 'pin') {
          shapeStyle = 'width:26px; height:30px; border-radius:50% 50% 50% 0; transform: rotate(-45deg); margin-top:-6px;';
        }

        const opacity = isWorked ? '1' : '0.85';
        const border = isWorked ? '2px solid #FFFFFF' : '2px dashed #FFFFFF';
        const innerTransform = pin.shape === 'pin' ? 'transform: rotate(45deg);' : '';
        const innerMargin = pin.shape === 'triangle' ? 'margin-top:6px;' : (pin.shape === 'pin' ? 'margin-top:-2px;' : 'margin-top:0;');

        const iconHtml = '<div style="background:' + color + '; ' + shapeStyle + ' border:' + border + '; opacity:' + opacity + '; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:bold; font-size:12px; box-shadow:0 4px 8px rgba(0,0,0,0.5); cursor:pointer;">' +
          '<span style="' + innerTransform + ' ' + innerMargin + '">' + labelBadge + '</span>' +
        '</div>';

        const icon = L.divIcon({
          className: 'custom-pin',
          html: iconHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([pin.lat, pin.lng], { icon: icon });

        marker.on('click', () => {
          window.parent.postMessage({ type: 'SELECT_PIN', key: pin.key }, '*');
        });

        // Rich popup content
        const popupCard = document.createElement('div');
        popupCard.className = 'popup-card';
        popupCard.innerHTML = 
          '<div class="popup-top-row">' +
            '<span class="popup-badge" style="background:' + color + '22; color:' + color + '; border:1px solid ' + color + ';">' + pin.territoryNumber + '</span>' +
            '<span style="font-size:11px; color:#9CA3AF;">' + pin.city + '</span>' +
          '</div>' +
          '<div class="popup-title">' + (pin.line || pin.label) + '</div>' +
          (pin.line2 ? '<div class="popup-sub">' + pin.line2 + (pin.postalcode ? ' • CEP ' + pin.postalcode : '') + '</div>' : '') +
          '<div class="popup-extra">' +
            '<span class="popup-tag">' + (pin.propertyType === 'comercial' ? '🏢 Comércio' : (pin.propertyType === 'predio' ? '🏙️ Prédio' : '🏠 Residência')) + '</span>' +
            (pin.isForeign ? '<span class="popup-tag" style="background:rgba(59,130,246,0.2); color:#60A5FA;">🌐 ' + (pin.language || 'Estrangeiro') + '</span>' : '') +
            (pin.notes ? '<span class="popup-tag" style="background:rgba(255,184,0,0.15); color:#FFB800;">📝 Anotação</span>' : '') +
          '</div>' +
          (pin.assignedAt || pin.completedAt ?
            '<div style="font-size:11px; margin-bottom:8px; display:flex; flex-direction:column; gap:2px; background:rgba(255,255,255,0.04); padding:6px; border-radius:6px;">' +
              (pin.assignedAt ? '<span style="color:#A78BFA;">📅 Desig: ' + pin.assignedAt + '</span>' : '') +
              (pin.completedAt ? '<span style="color:#34D399; font-weight:700;">✓ Concl: ' + pin.completedAt + (pin.daysSinceCompleted !== null && pin.daysSinceCompleted !== undefined ? (pin.daysSinceCompleted === 0 ? ' (hoje)' : pin.daysSinceCompleted === 1 ? ' (ontem)' : ' (há ' + pin.daysSinceCompleted + 'd)') : '') + '</span>' : '') +
            '</div>' : '') +
          '<div class="popup-btn-row">' +
            '<button class="popup-btn ' + (isWorked ? 'popup-btn-pending' : 'popup-btn-work') + '" id="btn-toggle">' +
              (isWorked ? 'Marcar Pendente' : '✓ Concluído') +
            '</button>' +
            '<button class="popup-btn popup-btn-style" id="btn-style">🎨 Ícone</button>' +
            '<button class="popup-btn popup-btn-edit" id="btn-edit">✏️ Editar</button>' +
          '</div>';

        popupCard.querySelector('#btn-toggle').addEventListener('click', (e) => {
          e.stopPropagation();
          window.parent.postMessage({ type: 'TOGGLE_WORK', key: pin.key }, '*');
        });

        popupCard.querySelector('#btn-style').addEventListener('click', (e) => {
          e.stopPropagation();
          window.parent.postMessage({ type: 'CUSTOMIZE_PIN', key: pin.key }, '*');
        });

        popupCard.querySelector('#btn-edit').addEventListener('click', (e) => {
          e.stopPropagation();
          window.parent.postMessage({ type: 'EDIT_PIN', key: pin.key }, '*');
        });

        marker.bindPopup(popupCard);
        markersGroup.addLayer(marker);
      });
    }

    markersGroup.addTo(map);

    if (markersGroup.getLayers().length > 0) {
      map.fitBounds(markersGroup.getBounds().pad(0.1));
    }
  </script>
</body>
</html>`;
  }, [displayedPins, displayedQuadras, mergedTerritoryPolygons, mapViewMode, mergeTerritoryMode]);

  if (loading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
        <Text style={styles.loadingText}>Carregando visualização cartográfica...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header & HUD */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.replace(`/skeleton-editor?id=${eventId}`)}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Voltar ao Editor</Text>
          </Pressable>
          <View style={styles.titleRow}>
            <Text style={styles.title}>🗺️ Mapa Tático de Territórios</Text>
            {/* View Mode Toggle: Quadras Pintadas vs Alfinetes */}
            <View style={styles.viewModeToggle}>
              <Pressable
                onPress={() => {
                  setMapViewMode('quadras');
                  setSelectedPinKey(null);
                }}
                style={[
                  styles.viewModeBtn,
                  mapViewMode === 'quadras' && styles.viewModeBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.viewModeBtnText,
                    mapViewMode === 'quadras' && styles.viewModeBtnTextActive,
                  ]}
                >
                  🔷 Modo Quadras Pintadas ({allQuadras.length})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMapViewMode('pins');
                  setSelectedQuadraKey(null);
                }}
                style={[
                  styles.viewModeBtn,
                  mapViewMode === 'pins' && styles.viewModeBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.viewModeBtnText,
                    mapViewMode === 'pins' && styles.viewModeBtnTextActive,
                  ]}
                >
                  📍 Modo Alfinetes ({allPins.length})
                </Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.subtitle}>{event.config.name} • 100% Soberano & OpenStreetMap</Text>
        </View>

        {/* HUD Progress */}
        <View style={styles.hudCard}>
          <View style={styles.hudMetricRow}>
            <Text style={styles.hudPercent}>{stats.percent}%</Text>
            <View>
              <Text style={styles.hudCount}>{stats.worked}/{stats.total}</Text>
              <Text style={styles.hudLabel}>casas cobertas</Text>
            </View>
          </View>
          <View style={styles.hudTrack}>
            <View style={[styles.hudFill, { width: `${stats.percent}%` }]} />
          </View>
        </View>
      </View>

      {/* Control Filter Bar */}
      <View style={styles.filterBar}>
        {/* Search Input */}
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍 Buscar por rua, número, bairro ou observação..."
          placeholderTextColor="#6F7E94"
        />

        {/* Territory Selector Chips */}
        <View style={styles.filterRow}>
          <Text style={styles.filterRowLabel}>TERRITÓRIO:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <Pressable
              onPress={() => setSelectedTerritory('all')}
              style={[styles.territoryChip, selectedTerritory === 'all' && styles.territoryChipActive]}
            >
              <Text style={[styles.territoryChipText, selectedTerritory === 'all' && styles.territoryChipTextActive]}>
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
                  recencyBadgeText = recencyInfo.daysSinceCompleted === 0 ? ' • 0d' : ` • ${recencyInfo.daysSinceCompleted}d`;
                } else {
                  recencyBadgeText = ` • ${recencyInfo.percent}%`;
                }
              }

              return (
                <Pressable
                  key={tNum}
                  onPress={() => setSelectedTerritory(tNum)}
                  style={[
                    styles.territoryChip,
                    active && { backgroundColor: `${color}25`, borderColor: color },
                  ]}
                >
                  <View style={[styles.colorDot, { backgroundColor: color }]} />
                  <Text style={[styles.territoryChipText, active && { color }]}>
                    {tNum} ({count}{recencyBadgeText})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Status Filter Tabs */}
        <View style={styles.statusRow}>
          <View style={styles.tabsRow}>
            {(['all', 'pending', 'worked'] as const).map((mode) => {
              const active = filterMode === mode;
              const labels = {
                all: `Todos (${allPins.length})`,
                pending: `⬜ Pendentes (${allPins.filter((p) => p.worked === 0).length})`,
                worked: `✅ Concluídos (${allPins.filter((p) => p.worked === 1).length})`,
              };
              return (
                <Pressable
                  key={mode}
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

          {/* Recency & Checklist Action Buttons */}
          <View style={styles.headerActionBtns}>
            <Pressable
              onPress={() => {
                setPinStyleTarget(null);
                setShowPinStyleModal(true);
              }}
              style={styles.bulkStyleBtn}
            >
              <Text style={styles.bulkStyleBtnText}>🎨 Estilos em Massa</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowDeltaSyncModal(true)}
              style={styles.syncBtn}
            >
              <Text style={styles.syncBtnText}>🔄 Sincronizar (Modo 1)</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowRecencyModal(true)}
              style={styles.recencyBtn}
            >
              <Text style={styles.recencyBtnText}>📊 Recência</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`/territory-checklist?id=${eventId}`)}
              style={styles.checklistBtn}
            >
              <Text style={styles.checklistBtnText}>📋 Checklist</Text>
            </Pressable>
          </View>
        </View>

        {/* Cartographic Legend */}
        <View style={styles.legendBar}>
          <Text style={styles.legendTitle}>FORMAS POR CIDADE:</Text>
          {cityList.map((cName) => {
            const shape = cityShapeMap[cName] || 'circle';
            return (
              <View key={cName} style={styles.legendItem}>
                <Text style={styles.legendShapeIcon}>{SHAPE_ICONS[shape]}</Text>
                <Text style={styles.legendLabel}>{cName}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Main Workspace (Map + Drawer) */}
      <View style={styles.workspace}>
        {/* Leaflet Map Iframe */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={leafletHTML}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Leaflet Tactical Map"
            />
          ) : (
            <View style={styles.mobilePlaceholder}>
              <Text style={styles.mobilePlaceholderText}>
                Visualização de mapas disponível no navegador Web.
              </Text>
            </View>
          )}
        </View>

        {/* Side Details Drawer (Visible when a Quadra or Pin is selected) */}
        {selectedQuadra ? (
          <View style={styles.sideDrawer}>
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
              <Pressable onPress={() => setSelectedQuadraKey(null)} style={styles.drawerCloseBtn}>
                <Text style={styles.drawerCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.drawerContent} contentContainerStyle={{ gap: 14 }}>
              {/* Perimeter Enclosing Streets Banner */}
              <View style={styles.perimeterCard}>
                <Text style={styles.perimeterTitle}>🛣️ RUAS DELIMITADORAS DO PERÍMETRO</Text>
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

                {/* Buffer / Expansion Selector */}
                <Text style={[styles.customSubLabel, { marginTop: 10 }]}>Tamanho do Polígono (Buffer):</Text>
                <View style={styles.expansionRow}>
                  {[
                    { factor: 1.0001, label: '0.9x Justo' },
                    { factor: 1.0003, label: '1.0x Padrão' },
                    { factor: 1.0006, label: '1.2x (+20%)' },
                    { factor: 1.0010, label: '1.5x (+50%)' },
                    { factor: 1.0020, label: '2.0x Dobro' },
                  ].map((item) => {
                    const curFactor = selectedQuadra.polygonExpansion || 1.0003;
                    const isCur = Math.abs(curFactor - item.factor) < 0.00015;
                    return (
                      <Pressable
                        key={item.label}
                        onPress={() => handleUpdateQuadraExpansion(selectedQuadra.key, item.factor)}
                        style={[
                          styles.expansionChip,
                          isCur && styles.expansionChipActive,
                        ]}
                      >
                        <Text style={[styles.expansionChipText, isCur && styles.expansionChipTextActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Merge Territory Toggle */}
                <Pressable
                  onPress={() => setMergeTerritoryMode(!mergeTerritoryMode)}
                  style={[
                    styles.mergeTerritoryBtn,
                    mergeTerritoryMode && styles.mergeTerritoryBtnActive,
                  ]}
                >
                  <Text style={styles.mergeTerritoryBtnText}>
                    {mergeTerritoryMode
                      ? '✓ Modo Território Consolidado Ativo'
                      : `🔗 Englobar Quadras de ${selectedQuadra.territoryNumber} em Super-Polígono`}
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
          <View style={styles.sideDrawer}>
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
                  Lat: {selectedPin.lat.toFixed(6)}, Lng: {selectedPin.lng.toFixed(6)}
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
                            : `há ${selectedPin.daysSinceCompleted} dias`
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
                  <Text style={styles.gpsNavBtnText}>🧭 Abrir no Google Maps / GPS</Text>
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
                        {item.isCompleted ? (
                          <View style={styles.recencyBadgeCompleted}>
                            <Text style={styles.recencyBadgeCompletedText}>
                              🏆 Concluído {item.daysSinceCompleted === 0 ? 'hoje' : item.daysSinceCompleted === 1 ? 'ontem (1d)' : `há ${item.daysSinceCompleted} dias`}
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
    width: 320,
    backgroundColor: '#161922',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
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
});
