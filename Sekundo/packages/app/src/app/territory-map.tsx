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
import { pathKey } from '@sekundo/core';
import type { FlatSkeletonEntry } from '@sekundo/core';
import { AddressEditModal } from '../components/territory/AddressEditModal';

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
  shape: 'circle' | 'triangle' | 'square' | 'diamond';
}

const TERRITORY_COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#A855F7', // Violet
  '#E11D48', // Rose
  '#84CC16', // Lime
  '#EAB308', // Gold
  '#6366F1', // Indigo
  '#D946EF', // Fuchsia
  '#0EA5E9', // Sky
];

const SHAPES_CYCLE: Array<'circle' | 'triangle' | 'square' | 'diamond'> = [
  'circle',
  'triangle',
  'square',
  'diamond',
];

const SHAPE_ICONS: Record<string, string> = {
  circle: '●',
  triangle: '▲',
  square: '■',
  diamond: '◆',
};

export default function TerritoryMapScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);
  const { flatRegistry, updateNode, loading } = useSkeleton(eventId);

  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'worked'>('all');
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPinKey, setSelectedPinKey] = useState<string | null>(null);
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);

  // 1. Build distinct territory color map and city shape map
  const { territoryColorMap, cityShapeMap, territoryList, cityList } = useMemo(() => {
    const territories = new Set<string>();
    const cities = new Set<string>();

    flatRegistry.forEach((node) => {
      const meta = (node.meta || {}) as Record<string, any>;
      const tNum = meta.territory_number || meta.territory || pathKey.parts(node.key).slice(0, 3).join('-') || 'T01';
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

    const cMap: Record<string, 'circle' | 'triangle' | 'square' | 'diamond'> = {};
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
      const territoryNumber = meta.territory_number || meta.territory || pathKey.parts(node.key).slice(0, 3).join('-') || 'T01';
      const city = meta.city || meta.cidade || 'Cidade Principal';
      const color = territoryColorMap[territoryNumber] || '#3B82F6';
      const shape = cityShapeMap[city] || 'circle';

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
      });
    });

    return list;
  }, [flatRegistry, territoryColorMap, cityShapeMap]);

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

    await updateNode(targetKey, {
      value: nextWorked === 1 ? 'Trabalhado' : '',
      meta: {
        ...meta,
        worked: nextWorked,
        lastWorkedAt: nextWorked === 1 ? new Date().toISOString() : undefined,
      },
    });
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
        if (!e.data) return;
        if (e.data.type === 'SELECT_PIN') {
          setSelectedPinKey(e.data.key);
        } else if (e.data.type === 'TOGGLE_WORK') {
          handleToggleWork(e.data.key);
        } else if (e.data.type === 'EDIT_PIN') {
          const target = flatRegistry.find((n) => pathKey.equals(n.key, e.data.key));
          if (target) setEditingAddressItem(target);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [flatRegistry]);

  // Build Leaflet HTML payload with dynamic colors, shapes, and responsive controls
  const leafletHTML = useMemo(() => {
    const pinsData = JSON.stringify(displayedPins);
    const centerLat = displayedPins.length > 0 ? displayedPins[0].lat : -23.5488;
    const centerLng = displayedPins.length > 0 ? displayedPins[0].lng : -46.3898;

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
      min-width: 220px;
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
      gap: 6px;
      margin-top: 8px;
    }
    .popup-btn {
      flex: 1;
      border: none;
      padding: 8px 10px;
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
    const pins = ${pinsData};
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([${centerLat}, ${centerLng}], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const markersGroup = L.featureGroup();

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
      }

      const opacity = isWorked ? '1' : '0.85';
      const border = isWorked ? '2px solid #FFFFFF' : '2px dashed #FFFFFF';

      const iconHtml = '<div style="background:' + color + '; ' + shapeStyle + ' border:' + border + '; opacity:' + opacity + '; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:bold; font-size:12px; box-shadow:0 4px 8px rgba(0,0,0,0.5); cursor:pointer;">' +
        '<span style="margin-top:' + (pin.shape === 'triangle' ? '6px' : '0') + '">' + labelBadge + '</span>' +
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
        '<div class="popup-btn-row">' +
          '<button class="popup-btn ' + (isWorked ? 'popup-btn-pending' : 'popup-btn-work') + '" id="btn-toggle">' +
            (isWorked ? 'Marcar Pendente' : '✓ Concluído') +
          '</button>' +
          '<button class="popup-btn popup-btn-edit" id="btn-edit">✏️ Editar</button>' +
        '</div>';

      popupCard.querySelector('#btn-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        window.parent.postMessage({ type: 'TOGGLE_WORK', key: pin.key }, '*');
      });

      popupCard.querySelector('#btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        window.parent.postMessage({ type: 'EDIT_PIN', key: pin.key }, '*');
      });

      marker.bindPopup(popupCard);
      markersGroup.addLayer(marker);
    });

    markersGroup.addTo(map);

    if (pins.length > 0) {
      map.fitBounds(markersGroup.getBounds().pad(0.1));
    }
  </script>
</body>
</html>`;
  }, [displayedPins]);

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
          <Text style={styles.title}>🗺️ Mapa Tático de Territórios</Text>
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
                    {tNum} ({count})
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

          {/* Quick link to Checklist */}
          <Pressable
            onPress={() => router.push(`/territory-checklist?id=${eventId}`)}
            style={styles.checklistBtn}
          >
            <Text style={styles.checklistBtnText}>📋 Abrir Checklist</Text>
          </Pressable>
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

        {/* Side Details Drawer (Visible when a Pin is selected) */}
        {selectedPin ? (
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
});
