/**
 * Component: TerritoryLeafletMap (web)
 *
 * Leaflet rendered straight into the React DOM — no iframe, no srcDoc, no postMessage.
 * - The map instance is created once; data updates only swap layers, so pan/zoom survive
 *   every toggle, mode switch (`quadras` <-> `pins`), filter or edit. The viewport moves
 *   only on first load, `fitRequest`, or `panToUserRequest`.
 * - Dedicated `userLocationLayerRef` renders live GPS telemetry (accuracy halo + pulsing
 *   blue dot) without disrupting `dataLayerRef` or hijacking the camera.
 * - Dedicated `routeLayerRef` renders in-map routes (OSRM street geometry or offline
 *   Haversine vector) and walking sequence trails (`1 -> 2 -> 3...`).
 * - Every user-provided string is written with `textContent` (no innerHTML), and user
 *   colors are applied through the CSSOM, which ignores invalid values.
 */

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type * as Leaflet from 'leaflet';
import {
  buildGoogleMapsDirectionsUrl,
  formatRouteDistance,
  formatRouteDuration,
} from '@sekundo/core';
import type { LatLngTuple, MapPin, MapQuadra, TerritoryLeafletMapProps } from './mapTypes';

type LeafletNS = typeof Leaflet;

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const SHAPE_CSS: Record<string, Partial<CSSStyleDeclaration>> = {
  circle: { width: '24px', height: '24px', borderRadius: '50%' },
  triangle: { width: '26px', height: '24px', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
  square: { width: '22px', height: '22px', borderRadius: '4px' },
  diamond: { width: '24px', height: '24px', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
  pentagon: { width: '26px', height: '25px', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
  hexagon: { width: '26px', height: '24px', clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  star: {
    width: '26px',
    height: '26px',
    clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  },
  pin: { width: '26px', height: '30px', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', marginTop: '-6px' },
};

const PROPERTY_LABELS: Record<string, string> = {
  comercial: '🏢 Comércio',
  predio: '🏙️ Prédio',
  residencial: '🏠 Residência',
};

/** Tiny DOM builder: text is always set via textContent. */
function el(
  tag: string,
  opts: { cls?: string; text?: string; style?: Partial<CSSStyleDeclaration>; testId?: string } = {},
  children: HTMLElement[] = []
) {
  const node = document.createElement(tag);
  if (opts.cls) node.className = opts.cls;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.testId) node.setAttribute('data-testid', opts.testId);
  if (opts.style) Object.assign(node.style, opts.style);
  children.forEach((c) => node.appendChild(c));
  return node;
}

function daysLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return '';
  if (days === 0) return ' (hoje)';
  if (days === 1) return ' (ontem)';
  return ` (há ${days}d)`;
}

function openExternalUrlSafe(url: string) {
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function TerritoryLeafletMap(props: TerritoryLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const dataLayerRef = useRef<Leaflet.FeatureGroup | null>(null);
  const routeLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const userLocationLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const editLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const didInitialFitRef = useRef(false);
  const lastFitRequestRef = useRef(props.fitRequest);
  const lastPanToUserRequestRef = useRef(props.panToUserRequest ?? 0);
  const [ready, setReady] = React.useState(false);

  // Leaflet handlers read callbacks through this ref, so they never go stale.
  const propsRef = useRef(props);
  propsRef.current = props;

  // 1. Create the map exactly once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      const L = ((mod as unknown as { default?: LeafletNS }).default ?? mod) as LeafletNS;
      // Geoman reads the global `L` and attaches `map.pm` via an init hook, which only runs for
      // maps created AFTER it loads — so it must be loaded before `L.map(...)`.
      (window as unknown as { L: LeafletNS }).L = L;
      await import('@geoman-io/leaflet-geoman-free');
      if (cancelled || !containerRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([0, 0], 2);
      L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
      dataLayerRef.current = L.featureGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      userLocationLayerRef.current = L.layerGroup().addTo(map);
      map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (propsRef.current.pickingOriginMode && propsRef.current.onPickOriginOnMap) {
          propsRef.current.onPickOriginOnMap(e.latlng.lat, e.latlng.lng);
        }
      });
      mapRef.current = map;
      (window as unknown as { __sekundoLeafletMap?: Leaflet.Map }).__sekundoLeafletMap = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if ((window as unknown as { __sekundoLeafletMap?: Leaflet.Map }).__sekundoLeafletMap === mapRef.current) {
        delete (window as unknown as { __sekundoLeafletMap?: Leaflet.Map }).__sekundoLeafletMap;
      }
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const fitToData = () => {
    const map = mapRef.current;
    const group = dataLayerRef.current;
    if (!map || !group || group.getLayers().length === 0) return false;
    const bounds = group.getBounds();
    if (!bounds.isValid()) return false;
    map.fitBounds(bounds.pad(0.1), { maxZoom: 18 });
    return true;
  };

  // 2. Redraw data layers on data changes — never touches the viewport except the first time.
  useEffect(() => {
    const L = LRef.current;
    const group = dataLayerRef.current;
    if (!ready || !L || !group) return;
    group.clearLayers();

    const { mode, pins, quadras, outlines, showStreetLabels, showQuadraPopup, selectedKey, editSession } = props;

    if (mode === 'quadras') {
      for (const mt of outlines) {
        if (!mt.polygon || mt.polygon.length < 3) continue;
        const outline = L.polygon(mt.polygon, {
          color: mt.color,
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.95,
          fillColor: mt.color,
          fillOpacity: 0.12,
          interactive: false,
        });
        group.addLayer(outline);
      }

      for (const q of quadras) {
        if (!q.boundaryPolygon || q.boundaryPolygon.length < 3) continue;
        if (editSession && editSession.quadraKey === q.key) continue; // drawn by the editor layer
        const isSelected = selectedKey === q.key;
        const poly = L.polygon(q.boundaryPolygon, {
          color: q.statusColor,
          weight: isSelected ? 5 : 3,
          opacity: 0.95,
          fillColor: q.statusColor,
          fillOpacity: isSelected ? 0.5 : 0.38,
        });
        poly.on('click', (e: Leaflet.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          propsRef.current.onSelectQuadra(q.key);
        });

        const tip = el('div', { style: { fontFamily: '-apple-system, sans-serif', padding: '4px' } }, [
          el('div', { text: `🏢 ${q.label}`, style: { fontWeight: '800', fontSize: '13px', color: q.statusColor } }),
          el('div', {
            text: `${q.workedUnits}/${q.totalUnits} concluídos (${q.coveragePercent}%)`,
            style: { fontSize: '11px', color: '#374151', marginTop: '2px' },
          }),
          ...(q.perimeterStreets.length > 0
            ? [
                el('div', {
                  text: `🛣️ ${q.perimeterStreets.slice(0, 4).join(', ')}`,
                  style: { fontSize: '10px', color: '#6B7280', marginTop: '3px', maxWidth: '220px', whiteSpace: 'normal' },
                }),
              ]
            : []),
        ]);
        poly.bindTooltip(tip, { sticky: true });

        if (showQuadraPopup) {
          poly.bindPopup(buildQuadraPopupCard(q, propsRef));
        }

        group.addLayer(poly);
        const polyEl = poly.getElement();
        if (polyEl) {
          polyEl.setAttribute('data-testid', `quadra-polygon-${q.key}`);
          polyEl.addEventListener('click', (ev) => {
            ev.stopPropagation();
            propsRef.current.onSelectQuadra(q.key);
          });
        }

        if (showStreetLabels && q.perimeterStreets.length > 0) {
          const label = L.marker(q.centroid, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: 'sk-street-label',
              html: el('div', {
                text: q.perimeterStreets.slice(0, 3).join(' · '),
                style: {
                  transform: 'translate(-50%, -50%)',
                  whiteSpace: 'nowrap',
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#111827',
                  textShadow: '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff',
                  pointerEvents: 'none',
                },
              }),
              iconSize: [0, 0],
            }),
          });
          group.addLayer(label);
        }
      }
    } else {
      for (const pin of pins) {
        group.addLayer(buildPinMarker(L, pin, propsRef));
      }
    }

    if (!didInitialFitRef.current && fitToData()) {
      didInitialFitRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    props.mode,
    props.pins,
    props.quadras,
    props.outlines,
    props.showStreetLabels,
    props.showQuadraPopup,
    props.selectedKey,
    props.editSession?.quadraKey,
    props.routeStopKeys,
  ]);

  // 3. Explicit re-frame requests (territory chip, "Enquadrar" button — NEVER on mode switch).
  useEffect(() => {
    if (!ready || props.fitRequest === lastFitRequestRef.current) return;
    lastFitRequestRef.current = props.fitRequest;
    if (fitToData()) didInitialFitRef.current = true;
  }, [ready, props.fitRequest]);

  // 3b. Live GPS Telemetry layer (`userLocationLayerRef`) — updates position without moving camera.
  useEffect(() => {
    const L = LRef.current;
    const userGrp = userLocationLayerRef.current;
    if (!ready || !L || !userGrp) return;
    userGrp.clearLayers();

    const loc = props.userLocation;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;

    const radius = Math.max(10, Math.min(loc.accuracy || 20, 250));
    const halo = L.circle([loc.lat, loc.lng], {
      radius,
      color: '#3B82F6',
      weight: 1.5,
      opacity: 0.7,
      fillColor: '#3B82F6',
      fillOpacity: 0.14,
      interactive: false,
    });
    userGrp.addLayer(halo);

    const dotEl = el(
      'div',
      {
        testId: 'leaflet-user-gps-dot',
        style: {
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#2563EB',
          border: '3px solid #FFFFFF',
          boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.38), 0 3px 8px rgba(0,0,0,0.6)',
        },
      },
      []
    );

    const gpsMarker = L.marker([loc.lat, loc.lng], {
      zIndexOffset: 2500,
      icon: L.divIcon({
        className: 'sk-user-gps-marker',
        html: dotEl,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    });
    gpsMarker.bindTooltip(
      loc.isManual
        ? `📍 Seu ponto de partida (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)})`
        : `🛰️ Sua localização GPS (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} • ±${Math.round(loc.accuracy || 15)}m)`,
      { direction: 'top' }
    );
    userGrp.addLayer(gpsMarker);
  }, [ready, props.userLocation]);

  // 3c. Explicit pan-to-user GPS request (`panToUserRequest`).
  useEffect(() => {
    const map = mapRef.current;
    const req = props.panToUserRequest ?? 0;
    if (!ready || !map || req === lastPanToUserRequestRef.current) return;
    lastPanToUserRequestRef.current = req;
    const loc = props.userLocation;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 17), { animate: true });
    }
  }, [ready, props.panToUserRequest, props.userLocation]);

  // 3d. Route & Walking Sequence Layer (`routeLayerRef`).
  // Never draws straight Euclidean spiderweb lines across territories; only renders real street geometry
  // from `activeRoute` plus discrete numbered stop badges.
  useEffect(() => {
    const L = LRef.current;
    const routeGrp = routeLayerRef.current;
    if (!ready || !L || !routeGrp) return;
    routeGrp.clearLayers();

    // Scoped walking order badges (`1, 2, 3...`) when in quadras mode and no active street route overrides them
    if (
      props.walkingSequence &&
      props.walkingSequence.length >= 1 &&
      props.walkingSequence.length <= 60 &&
      !props.activeRoute &&
      props.mode === 'quadras'
    ) {
      for (const stop of props.walkingSequence) {
        const badgeNode = el('div', {
          text: String(stop.order),
          style: {
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: stop.worked === 1 ? '#10B981' : '#F59E0B',
            color: '#0D1117',
            fontWeight: '900',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid #FFFFFF',
            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          },
        });
        const seqMarker = L.marker([stop.lat, stop.lng], {
          interactive: false,
          keyboard: false,
          zIndexOffset: 900,
          icon: L.divIcon({
            className: 'sk-walk-stop',
            html: badgeNode,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        });
        routeGrp.addLayer(seqMarker);
      }
    }

    // Active Street Navigation Route (OSRM Street Geometry from Operator's GPS Origin -> 1 or N Stops)
    const route = props.activeRoute;
    if (route && route.coordinates && route.coordinates.length >= 2) {
      const casing = L.polyline(route.coordinates, {
        color: '#0F172A',
        weight: 9,
        opacity: 0.82,
        interactive: false,
      });
      const mainLine = L.polyline(route.coordinates, {
        color: route.source === 'osrm' ? '#06B6D4' : '#F59E0B',
        weight: 5,
        opacity: 0.96,
        dashArray: route.source === 'offline_haversine' ? '10, 8' : undefined,
      });
      const summaryText = `🧭 Rota ${
        route.source === 'osrm' ? 'pelas ruas (OpenStreetMap)' : 'em linha reta (Sem internet)'
      }: ${formatRouteDistance(route.distanceMeters)} (${formatRouteDuration(route.durationSeconds)})${
        route.label ? ` → ${route.label}` : ''
      }`;
      mainLine.bindTooltip(summaryText, { sticky: true });

      routeGrp.addLayer(casing);
      routeGrp.addLayer(mainLine);

      // Origin marker (User's GPS / Start point)
      const originPt = route.origin || route.coordinates[0];
      const originRing = L.circleMarker(originPt, {
        radius: 8,
        color: '#FFFFFF',
        weight: 2.5,
        fillColor: '#2563EB',
        fillOpacity: 1,
        interactive: false,
      });
      routeGrp.addLayer(originRing);

      // Numbered stop markers along the street route
      if (route.stops && route.stops.length > 0) {
        for (const stop of route.stops) {
          const stopBadge = el('div', {
            testId: `route-stop-badge-${stop.order}`,
            text: String(stop.order),
            style: {
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#06B6D4',
              color: '#082F49',
              fontWeight: '900',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #FFFFFF',
              boxShadow: '0 2px 6px rgba(0,0,0,0.65)',
            },
          });
          const stopMarker = L.marker([stop.lat, stop.lng], {
            zIndexOffset: 1800 + stop.order,
            icon: L.divIcon({
              className: 'sk-route-stop-marker',
              html: stopBadge,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          });
          stopMarker.bindTooltip(`🏁 Parada ${stop.order}: ${stop.label}`, { direction: 'top' });
          routeGrp.addLayer(stopMarker);
        }
      } else {
        const destPt = route.coordinates[route.coordinates.length - 1];
        const destRing = L.circleMarker(destPt, {
          radius: 10,
          color: '#06B6D4',
          weight: 3,
          fillColor: '#22D3EE',
          fillOpacity: 0.35,
          interactive: false,
        });
        routeGrp.addLayer(destRing);
      }
    }
  }, [ready, props.activeRoute, props.walkingSequence, props.mode]);

  // 4. Vertex editor (Leaflet-Geoman Free, bundled, with snapping, Undo revision & touch long-press).
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const session = props.editSession;
    if (!ready || !L || !map) return;

    editLayerRef.current?.remove();
    editLayerRef.current = null;
    if (!session) return;

    let disposed = false;
    const layerGroup = L.layerGroup().addTo(map);
    editLayerRef.current = layerGroup;

    (async () => {
      if (disposed) return;

      for (const u of session.units) {
        L.circleMarker(u, {
          radius: 4,
          color: '#111827',
          weight: 1,
          fillColor: '#FFFFFF',
          fillOpacity: 0.9,
          interactive: false,
        }).addTo(layerGroup);
      }

      const emit = (layer: Leaflet.Polygon) => {
        const raw = layer.getLatLngs();
        const latlngs = (Array.isArray(raw[0]) ? raw[0] : raw) as Leaflet.LatLng[];
        propsRef.current.onPolygonDraft?.(latlngs.map((p) => [p.lat, p.lng] as LatLngTuple));
      };

      const bindTouchLongPress = (layer: Leaflet.Polygon) => {
        const pmAny = (layer as any).pm;
        const markers: Leaflet.Marker[] = Array.isArray(pmAny?._markers) ? pmAny._markers.flat() : [];
        markers.forEach((m: any) => {
          if (!m.__skDragBound) {
            m.__skDragBound = true;
            m.on?.('dragend', () => emit(layer));
          }
          const elNode: HTMLElement | undefined = m.getElement?.();
          if (!elNode || (elNode as any).__skTouchBound) return;
          (elNode as any).__skTouchBound = true;
          let timer: ReturnType<typeof setTimeout> | null = null;
          const clear = () => {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
          };
          elNode.addEventListener(
            'touchstart',
            () => {
              clear();
              timer = setTimeout(() => {
                const raw = layer.getLatLngs();
                const ring = ((Array.isArray(raw[0]) ? raw[0] : raw) as Leaflet.LatLng[]) || [];
                if (ring.length <= 3) return;
                const mLatLng = m.getLatLng?.();
                if (!mLatLng) return;
                const filtered = ring.filter(
                  (pt) => Math.abs(pt.lat - mLatLng.lat) > 1e-7 || Math.abs(pt.lng - mLatLng.lng) > 1e-7
                );
                if (filtered.length >= 3 && filtered.length < ring.length) {
                  pmAny.disable?.();
                  layer.setLatLngs([filtered]);
                  pmAny.enable?.({
                    allowSelfIntersection: false,
                    snappable: true,
                    snapDistance: 15,
                    removeVertexOn: 'contextmenu',
                  });
                  bindTouchLongPress(layer);
                  emit(layer);
                }
              }, 600);
            },
            { passive: true }
          );
          elNode.addEventListener('touchend', clear, { passive: true });
          elNode.addEventListener('touchmove', clear, { passive: true });
          elNode.addEventListener('touchcancel', clear, { passive: true });
        });
      };

      const attach = (layer: Leaflet.Polygon) => {
        layer.setStyle({ color: session.color, weight: 3, fillOpacity: 0.25, dashArray: undefined });
        layer.addTo(layerGroup);
        const pm = (layer as unknown as { pm: { enable: (o: object) => void; disable?: () => void } }).pm;
        pm.enable({
          allowSelfIntersection: false,
          snappable: true,
          snapDistance: 15,
          removeVertexOn: 'contextmenu',
        });
        bindTouchLongPress(layer);
        layer.on('pm:edit pm:change pm:vertexadded pm:vertexremoved pm:markerdragend pm:cut', () => {
          bindTouchLongPress(layer);
          emit(layer);
        });
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          (window as any).__sekundoMoveVertex = (idx: number, dLat: number, dLng: number) => {
            const raw = layer.getLatLngs();
            const ring = ((Array.isArray(raw[0]) ? raw[0] : raw) as Leaflet.LatLng[]).map((p, i) =>
              i === idx ? L.latLng(p.lat + dLat, p.lng + dLng) : p
            );
            pm.disable?.();
            layer.setLatLngs([ring]);
            pm.enable({
              allowSelfIntersection: false,
              snappable: true,
              snapDistance: 15,
              removeVertexOn: 'contextmenu',
            });
            bindTouchLongPress(layer);
            emit(layer);
          };
        }
        emit(layer);
      };

      const mapPm = (
        map as unknown as {
          pm?: {
            enableDraw: (s: string, o: object) => void;
            disableDraw: () => void;
            setLang?: (l: string) => void;
          };
        }
      ).pm;
      if (!mapPm) {
        console.error('[Sekundo] Leaflet-Geoman não inicializou no mapa; edição de vértices indisponível.');
        return;
      }
      mapPm.setLang?.('pt_br');

      if (session.initial.length >= 3) {
        attach(L.polygon(session.initial));
      } else {
        mapPm.enableDraw('Polygon', {
          allowSelfIntersection: false,
          snappable: true,
          snapDistance: 15,
          finishOn: 'dblclick',
        });
        map.once('pm:create', (e: Leaflet.LeafletEvent) => {
          const created = (e as unknown as { layer: Leaflet.Polygon }).layer;
          map.removeLayer(created);
          mapPm.disableDraw();
          if (!disposed) attach(L.polygon(created.getLatLngs() as Leaflet.LatLngExpression[][]));
        });
      }
    })();

    return () => {
      disposed = true;
      delete (window as any).__sekundoMoveVertex;
      const mapPm = (map as unknown as { pm?: { disableDraw: () => void } }).pm;
      mapPm?.disableDraw();
      layerGroup.remove();
      if (editLayerRef.current === layerGroup) editLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.editSession?.quadraKey, props.editSession ? 1 : 0, props.editSession?.revision ?? 0]);

  // 5. Highlight units falling outside the edited polygon in warning red.
  const outsideLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    outsideLayerRef.current?.remove();
    outsideLayerRef.current = null;
    if (!ready || !L || !map || !props.editSession?.unitsOutside?.length) return;

    const grp = L.layerGroup().addTo(map);
    outsideLayerRef.current = grp;
    for (const u of props.editSession.unitsOutside) {
      L.circleMarker(u, {
        radius: 8,
        color: '#EF4444',
        weight: 3,
        fillColor: '#F59E0B',
        fillOpacity: 0.95,
        interactive: false,
      }).addTo(grp);
    }
    return () => {
      grp.remove();
      if (outsideLayerRef.current === grp) outsideLayerRef.current = null;
    };
  }, [ready, props.editSession?.quadraKey, props.editSession?.unitsOutside]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#12151C',
          cursor: props.pickingOriginMode ? 'crosshair' : undefined,
        }}
      />
      {!ready ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8A94A6',
            fontFamily: 'sans-serif',
            fontSize: 13,
          }}
        >
          Carregando mapa…
        </div>
      ) : null}
    </div>
  );
}

function buildQuadraPopupCard(q: MapQuadra, propsRef: React.MutableRefObject<TerritoryLeafletMapProps>) {
  const button = (
    text: string,
    bg: string,
    color: string,
    onClick: () => void,
    testId?: string
  ) => {
    const b = el('button', {
      text,
      testId,
      style: {
        flex: '1',
        border: 'none',
        padding: '7px 8px',
        fontSize: '11px',
        fontWeight: '700',
        borderRadius: '6px',
        cursor: 'pointer',
        background: bg,
        color,
      },
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  const openGmaps = () => {
    if (propsRef.current.onOpenGoogleMapsQuadra) {
      propsRef.current.onOpenGoogleMapsQuadra(q.key);
      return;
    }
    const url = buildGoogleMapsDirectionsUrl({
      lat: q.centroid?.[0],
      lng: q.centroid?.[1],
      street: q.perimeterStreets?.[0] || q.label,
      locality: q.locality,
      city: q.city,
      travelMode: 'walking',
    });
    openExternalUrlSafe(url);
  };

  return el(
    'div',
    {
      style: {
        minWidth: '215px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
    },
    [
      el('div', {
        text: `🏢 ${q.label}`,
        style: { fontWeight: '800', fontSize: '14px', color: '#111827', marginBottom: '4px' },
      }),
      el('div', {
        text: `${q.workedUnits}/${q.totalUnits} concluídos (${q.coveragePercent}%)`,
        style: { fontSize: '11px', color: '#374151', marginBottom: '6px' },
      }),
      ...(q.perimeterStreets.length > 0
        ? [
            el('div', {
              text: `🛣️ ${q.perimeterStreets.join(', ')}`,
              style: { fontSize: '11px', color: '#4B5563', marginBottom: '8px' },
            }),
          ]
        : []),
      el('div', { style: { display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' } }, [
        button('🗺️ Google Maps', '#2563EB', '#FFFFFF', openGmaps, `popup-quadra-gmaps-${q.key}`),
        ...(propsRef.current.onRouteToQuadraInMap
          ? [
              button(
                '🧭 Rota no Mapa',
                '#0891B2',
                '#FFFFFF',
                () => propsRef.current.onRouteToQuadraInMap?.(q.key),
                `popup-quadra-route-${q.key}`
              ),
            ]
          : []),
        ...(propsRef.current.onRouteToQuadraAddressesInMap
          ? [
              button(
                '👣 Rota Endereços',
                '#059669',
                '#FFFFFF',
                () => propsRef.current.onRouteToQuadraAddressesInMap?.(q.key),
                `popup-quadra-route-addresses-${q.key}`
              ),
            ]
          : []),
      ]),
    ]
  );
}

function buildPinMarker(L: LeafletNS, pin: MapPin, propsRef: React.MutableRefObject<TerritoryLeafletMapProps>) {
  const isWorked = pin.worked === 1;
  const isSelected = propsRef.current.selectedKey === pin.key;
  const baseShape = SHAPE_CSS[pin.shape] ? pin.shape : 'circle';
  const shape = isSelected && baseShape === 'circle' ? 'pin' : baseShape;

  const badgeText =
    pin.walkOrder !== undefined
      ? isWorked
        ? `✓${pin.walkOrder}`
        : String(pin.walkOrder)
      : isWorked
      ? '✓'
      : '•';

  const inner = el('span', {
    text: badgeText,
    style:
      shape === 'pin'
        ? { transform: 'rotate(45deg)', marginTop: '-2px', fontSize: pin.walkOrder !== undefined ? '10px' : '12px' }
        : shape === 'triangle'
        ? { marginTop: '6px', fontSize: pin.walkOrder !== undefined ? '10px' : '12px' }
        : { fontSize: pin.walkOrder !== undefined ? '10px' : '12px' },
  });
  const badge = el(
    'div',
    {
      style: {
        ...SHAPE_CSS[shape],
        background: pin.color,
        border: isSelected
          ? '2.5px solid #FFB800'
          : isWorked
          ? '2px solid #FFFFFF'
          : '2px dashed #FFFFFF',
        opacity: isSelected || isWorked ? '1' : '0.88',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: '12px',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(255,184,0,0.55), 0 6px 14px rgba(0,0,0,0.7)'
          : '0 4px 8px rgba(0,0,0,0.5)',
        cursor: 'pointer',
      },
    },
    [inner]
  );

  const marker = L.marker([pin.lat, pin.lng], {
    zIndexOffset: isSelected ? 1000 : 0,
    icon: L.divIcon({ className: 'custom-pin', html: badge, iconSize: [28, 28], iconAnchor: [14, 14] }),
  });
  marker.on('click', () => propsRef.current.onSelectPin(pin.key));

  const button = (
    text: string,
    bg: string,
    color: string,
    onClick: () => void,
    extra: Partial<CSSStyleDeclaration> = {},
    testId?: string
  ) => {
    const b = el('button', {
      text,
      testId,
      style: {
        flex: '1',
        border: 'none',
        padding: '7px 8px',
        fontSize: '11px',
        fontWeight: '700',
        borderRadius: '6px',
        cursor: 'pointer',
        background: bg,
        color,
        ...extra,
      },
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  const openPinGoogleMaps = () => {
    if (propsRef.current.onOpenGoogleMapsPin) {
      propsRef.current.onOpenGoogleMapsPin(pin.key);
      return;
    }
    const uLoc = propsRef.current.userLocation;
    const url = buildGoogleMapsDirectionsUrl({
      lat: pin.lat,
      lng: pin.lng,
      line: pin.line || pin.label,
      line2: pin.line2,
      city: pin.city,
      postalcode: pin.postalcode,
      originLat: uLoc?.lat,
      originLng: uLoc?.lng,
      travelMode: 'walking',
    });
    openExternalUrlSafe(url);
  };

  const tags: HTMLElement[] = [
    el('span', { cls: 'sk-tag', text: PROPERTY_LABELS[pin.propertyType] || PROPERTY_LABELS.residencial }),
  ];
  if (pin.walkOrder !== undefined) {
    tags.push(el('span', { cls: 'sk-tag', text: `👣 ${pin.walkOrder}º na rua` }));
  }
  if (pin.isForeign) tags.push(el('span', { cls: 'sk-tag', text: `🌐 ${pin.language || 'Estrangeiro'}` }));
  if (pin.notes) tags.push(el('span', { cls: 'sk-tag', text: '📝 Anotação' }));
  tags.forEach((t) =>
    Object.assign(t.style, {
      fontSize: '10px',
      padding: '2px 6px',
      borderRadius: '4px',
      background: 'rgba(0,0,0,0.06)',
      color: '#374151',
    })
  );

  const dates: HTMLElement[] = [];
  if (pin.assignedAt) dates.push(el('div', { text: `📅 Desig: ${pin.assignedAt}`, style: { color: '#6D28D9' } }));
  if (pin.completedAt)
    dates.push(
      el('div', {
        text: `✓ Concl: ${pin.completedAt}${daysLabel(pin.daysSinceCompleted)}`,
        style: { color: '#047857', fontWeight: '700' },
      })
    );

  const card = el(
    'div',
    { style: { minWidth: '228px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' } },
    [
      el(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' } },
        [
          el('span', {
            text: pin.territoryNumber,
            style: {
              fontSize: '10px',
              fontWeight: '800',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              border: `1px solid ${pin.color}`,
              color: '#111827',
            },
          }),
          el('span', { text: pin.city, style: { fontSize: '11px', color: '#6B7280' } }),
        ]
      ),
      el('div', { text: pin.line || pin.label, style: { fontWeight: '700', fontSize: '14px', marginBottom: '4px' } }),
      ...(pin.line2
        ? [
            el('div', {
              text: `${pin.line2}${pin.postalcode ? ` • CEP ${pin.postalcode}` : ''}`,
              style: { fontSize: '11px', color: '#6B7280', marginBottom: '8px' },
            }),
          ]
        : []),
      el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' } }, tags),
      ...(dates.length
        ? [el('div', { style: { fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' } }, dates)]
        : []),
      el('div', { style: { display: 'flex', gap: '5px', marginTop: '8px' } }, [
        button(
          isWorked ? 'Marcar pendente' : '✓ Concluído',
          isWorked ? '#EF4444' : '#10B981',
          isWorked ? '#FFFFFF' : '#062016',
          () => propsRef.current.onToggleWork(pin.key),
          {},
          `popup-pin-toggle-${pin.key}`
        ),
        button(
          '🎨 Ícone',
          'rgba(255,184,0,0.18)',
          '#92400E',
          () => propsRef.current.onCustomizePin(pin.key),
          { flex: '0.8' }
        ),
        button(
          '✏️ Editar',
          'rgba(0,0,0,0.08)',
          '#111827',
          () => propsRef.current.onEditPin(pin.key),
          { flex: '0.6' }
        ),
      ]),
      el('div', { style: { display: 'flex', gap: '5px', marginTop: '6px' } }, [
        button(
          '🗺️ Google Maps',
          '#2563EB',
          '#FFFFFF',
          openPinGoogleMaps,
          {},
          `popup-pin-gmaps-${pin.key}`
        ),
        ...(propsRef.current.onRouteToPinInMap
          ? [
              button(
                '🧭 Rota GPS',
                '#0891B2',
                '#FFFFFF',
                () => propsRef.current.onRouteToPinInMap?.(pin.key),
                { flex: '0.9' },
                `popup-pin-route-${pin.key}`
              ),
            ]
          : []),
        ...(propsRef.current.onAddPinToRoute
          ? [
              button(
                (propsRef.current.routeStopKeys || []).includes(pin.key) ? '✓ Na Rota' : '➕ +Rota',
                (propsRef.current.routeStopKeys || []).includes(pin.key) ? '#059669' : '#0F766E',
                '#FFFFFF',
                () => propsRef.current.onAddPinToRoute?.(pin.key),
                { flex: '0.8' },
                `popup-pin-add-route-${pin.key}`
              ),
            ]
          : []),
      ]),
    ]
  );

  marker.bindPopup(card);
  return marker;
}
