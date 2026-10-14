/**
 * Component: TerritoryLeafletMap (web)
 *
 * Leaflet rendered straight into the React DOM — no iframe, no srcDoc, no postMessage.
 * - The map instance is created once; data updates only swap layers, so pan/zoom survive
 *   every toggle, filter or edit. The viewport moves only on first load or `fitRequest`.
 * - Every user-provided string is written with `textContent` (no innerHTML), and user
 *   colors are applied through the CSSOM, which ignores invalid values.
 * - Leaflet and Geoman are bundled from npm (no CDN), loaded lazily so static rendering
 *   never touches `window`.
 */

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type * as Leaflet from 'leaflet';
import type { LatLngTuple, MapPin, TerritoryLeafletMapProps } from './mapTypes';

type LeafletNS = typeof Leaflet;

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const SHAPE_CSS: Record<string, Partial<CSSStyleDeclaration>> = {
  circle: { width: '26px', height: '26px', borderRadius: '50%' },
  triangle: { width: '28px', height: '26px', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
  square: { width: '24px', height: '24px', borderRadius: '4px' },
  diamond: { width: '26px', height: '26px', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
  hexagon: { width: '28px', height: '26px', clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  star: {
    width: '28px',
    height: '28px',
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
function el(tag: string, opts: { cls?: string; text?: string; style?: Partial<CSSStyleDeclaration> } = {}, children: HTMLElement[] = []) {
  const node = document.createElement(tag);
  if (opts.cls) node.className = opts.cls;
  if (opts.text !== undefined) node.textContent = opts.text;
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

export function TerritoryLeafletMap(props: TerritoryLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const dataLayerRef = useRef<Leaflet.FeatureGroup | null>(null);
  const editLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const didInitialFitRef = useRef(false);
  const lastFitRequestRef = useRef(props.fitRequest);
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
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
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

    const { mode, pins, quadras, outlines, showStreetLabels, selectedKey, editSession } = props;

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
            ? [el('div', { text: `🛣️ ${q.perimeterStreets.slice(0, 4).join(', ')}`, style: { fontSize: '10px', color: '#6B7280', marginTop: '3px', maxWidth: '220px', whiteSpace: 'normal' } })]
            : []),
        ]);
        poly.bindTooltip(tip, { sticky: true });
        group.addLayer(poly);

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
  }, [ready, props.mode, props.pins, props.quadras, props.outlines, props.showStreetLabels, props.selectedKey, props.editSession?.quadraKey]);

  // 3. Explicit re-frame requests (territory chip, "Enquadrar" button, mode switch).
  useEffect(() => {
    if (!ready || props.fitRequest === lastFitRequestRef.current) return;
    lastFitRequestRef.current = props.fitRequest;
    if (fitToData()) didInitialFitRef.current = true;
  }, [ready, props.fitRequest]);

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
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#12151C' }} />
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

function buildPinMarker(L: LeafletNS, pin: MapPin, propsRef: React.MutableRefObject<TerritoryLeafletMapProps>) {
  const isWorked = pin.worked === 1;
  const shape = SHAPE_CSS[pin.shape] ? pin.shape : 'circle';

  const inner = el('span', {
    text: isWorked ? '✓' : '•',
    style: shape === 'pin' ? { transform: 'rotate(45deg)', marginTop: '-2px' } : shape === 'triangle' ? { marginTop: '6px' } : {},
  });
  const badge = el(
    'div',
    {
      style: {
        ...SHAPE_CSS[shape],
        background: pin.color,
        border: isWorked ? '2px solid #FFFFFF' : '2px dashed #FFFFFF',
        opacity: isWorked ? '1' : '0.85',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: '12px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
        cursor: 'pointer',
      },
    },
    [inner]
  );

  const marker = L.marker([pin.lat, pin.lng], {
    icon: L.divIcon({ className: 'custom-pin', html: badge, iconSize: [28, 28], iconAnchor: [14, 14] }),
  });
  marker.on('click', () => propsRef.current.onSelectPin(pin.key));

  const button = (text: string, bg: string, color: string, onClick: () => void, extra: Partial<CSSStyleDeclaration> = {}) => {
    const b = el('button', {
      text,
      style: { flex: '1', border: 'none', padding: '7px 8px', fontSize: '11px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer', background: bg, color, ...extra },
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  const tags: HTMLElement[] = [el('span', { cls: 'sk-tag', text: PROPERTY_LABELS[pin.propertyType] || PROPERTY_LABELS.residencial })];
  if (pin.isForeign) tags.push(el('span', { cls: 'sk-tag', text: `🌐 ${pin.language || 'Estrangeiro'}` }));
  if (pin.notes) tags.push(el('span', { cls: 'sk-tag', text: '📝 Anotação' }));
  tags.forEach((t) =>
    Object.assign(t.style, { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)', color: '#374151' })
  );

  const dates: HTMLElement[] = [];
  if (pin.assignedAt) dates.push(el('div', { text: `📅 Desig: ${pin.assignedAt}`, style: { color: '#6D28D9' } }));
  if (pin.completedAt) dates.push(el('div', { text: `✓ Concl: ${pin.completedAt}${daysLabel(pin.daysSinceCompleted)}`, style: { color: '#047857', fontWeight: '700' } }));

  const card = el('div', { style: { minWidth: '220px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' } }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' } }, [
      el('span', {
        text: pin.territoryNumber,
        style: { fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', border: `1px solid ${pin.color}`, color: '#111827' },
      }),
      el('span', { text: pin.city, style: { fontSize: '11px', color: '#6B7280' } }),
    ]),
    el('div', { text: pin.line || pin.label, style: { fontWeight: '700', fontSize: '14px', marginBottom: '4px' } }),
    ...(pin.line2 ? [el('div', { text: `${pin.line2}${pin.postalcode ? ` • CEP ${pin.postalcode}` : ''}`, style: { fontSize: '11px', color: '#6B7280', marginBottom: '8px' } })] : []),
    el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' } }, tags),
    ...(dates.length ? [el('div', { style: { fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' } }, dates)] : []),
    el('div', { style: { display: 'flex', gap: '5px', marginTop: '8px' } }, [
      button(isWorked ? 'Marcar pendente' : '✓ Concluído', isWorked ? '#EF4444' : '#10B981', isWorked ? '#FFFFFF' : '#062016', () =>
        propsRef.current.onToggleWork(pin.key)
      ),
      button('🎨 Ícone', 'rgba(255,184,0,0.18)', '#92400E', () => propsRef.current.onCustomizePin(pin.key), { flex: '0.8' }),
      button('✏️ Editar', 'rgba(0,0,0,0.08)', '#111827', () => propsRef.current.onEditPin(pin.key), { flex: '0.6' }),
    ]),
  ]);

  marker.bindPopup(card);
  return marker;
}
