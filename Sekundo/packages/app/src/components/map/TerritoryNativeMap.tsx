/**
 * Component: TerritoryNativeMap (Native Mobile — Android & iOS + Web Mobile Emulation)
 *
 * Sovereign interactive cartographic engine for React Native mobile builds.
 * Renders OpenStreetMap / CartoDB slippy raster tiles (EPSG:3857 Web Mercator)
 * overlaid with a hardware-accelerated `react-native-svg` vector scene graph:
 * - Quadra polygons with deterministic Ray-Casting Point-in-Polygon (PIP) tap selection
 * - Merged territory dashed outlines (`outlines`)
 * - 8 geometric pin shapes (`circle`, `triangle`, `square`, `diamond`, `pentagon`, `hexagon`, `star`, `pin`)
 * - Scoped walking order badges (`1, 2, 3...`) and OSRM / offline street routes (`activeRoute`)
 * - Live GPS telemetry layer (`userLocation` accuracy halo + pulsing dot) & tap-to-pick origin (`pickingOriginMode`)
 * - Interactive touch Vertex Editor (`editSession`) with vertex dragging, midpoint insertion (`+`), and long-press deletion
 * - Native Pin & Quadra Popup Cards with 1-tap actions (Toggle worked, Edit, Icon, Google Maps, Route in Map, +Route)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  PanResponder,
  Linking,
  Platform,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Polygon, Polyline, Circle, G } from 'react-native-svg';
import {
  buildGoogleMapsDirectionsUrl,
  formatRouteDistance,
  formatRouteDuration,
} from '@sekundo/core';
import type {
  LatLngTuple,
  MapPin,
  MapQuadra,
  TerritoryLeafletMapProps,
} from './mapTypes';
import {
  type CameraState,
  clampZoom,
  latLngToWorldPx,
  worldPxToLatLng,
  latLngToScreenPx,
  screenPxToLatLng,
  metersPerPixel,
  computeVisibleTiles,
  computeFitBoundsCamera,
  pointInPolygon,
  coordsToSvgPoints,
} from './webMercatorMath';

const TILE_HEADERS = {
  'User-Agent': 'SekundoFieldGIS/2.0 (Android; +https://heisslab.com)',
  Referer: 'https://heisslab.com/',
};

type TileProviderId = 'hot' | 'osm_de' | 'arcgis' | 'topo';

function buildTileUrl(provider: TileProviderId, z: number, tx: number, ty: number): string {
  const sub = ['a', 'b', 'c'][(tx + ty) % 3];
  if (provider === 'osm_de') {
    return `https://tile.openstreetmap.de/${z}/${tx}/${ty}.png`;
  }
  if (provider === 'arcgis') {
    // ArcGIS REST tile order is /{z}/{y}/{x}
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${ty}/${tx}`;
  }
  if (provider === 'topo') {
    return `https://${sub}.tile.opentopomap.org/${z}/${tx}/${ty}.png`;
  }
  return `https://${sub}.tile.openstreetmap.fr/hot/${z}/${tx}/${ty}.png`;
}

const PROPERTY_LABELS: Record<string, string> = {
  comercial: '🏢 Comércio',
  predio: '🏙️ Prédio',
  residencial: '🏠 Residência',
};

function daysLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return '';
  if (days === 0) return ' (hoje)';
  if (days === 1) return ' (ontem)';
  return ` (há ${days}d)`;
}

function getPinShapeSvgPoints(shape: string): string | null {
  switch (shape) {
    case 'triangle':
      return '14,2 26,25 2,25';
    case 'diamond':
      return '14,1 27,14 14,27 1,14';
    case 'pentagon':
      return '14,1 27,11 22,26 6,26 1,11';
    case 'hexagon':
      return '7,2 21,2 27,14 21,26 7,26 1,14';
    case 'star':
      return '14,1 17.5,10 27,10 19.5,16 22.5,26 14,20 5.5,26 8.5,16 1,10 10.5,10';
    default:
      return null;
  }
}

export function TerritoryNativeMap(props: TerritoryLeafletMapProps) {
  const rootRef = useRef<View | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({
    width: 360,
    height: 480,
  });
  const [camera, setCameraState] = useState<CameraState>({
    centerLat: -23.5505,
    centerLng: -46.6333,
    zoom: 15,
  });
  const cameraRef = useRef<CameraState>(camera);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const updateCamera = useCallback((next: CameraState) => {
    cameraRef.current = next;
    setCameraState(next);
  }, []);

  const [tileProvider, setTileProvider] = useState<TileProviderId>('hot');
  const [failedOsmCount, setFailedOsmCount] = useState<number>(0);
  const [activePinPopupKey, setActivePinPopupKey] = useState<string | null>(null);
  const [activeQuadraPopupKey, setActiveQuadraPopupKey] = useState<string | null>(null);

  // Sync popup state with external selectedKey changes
  useEffect(() => {
    if (!props.selectedKey) {
      setActivePinPopupKey(null);
      setActiveQuadraPopupKey(null);
      return;
    }
    if (props.mode === 'pins') {
      setActivePinPopupKey(props.selectedKey);
      setActiveQuadraPopupKey(null);
    } else {
      setActiveQuadraPopupKey(props.selectedKey);
      setActivePinPopupKey(null);
    }
  }, [props.selectedKey, props.mode]);

  // Editable polygon ring state when `props.editSession` is active
  const [editRing, setEditRing] = useState<LatLngTuple[]>([]);
  const editRingRef = useRef<LatLngTuple[]>([]);
  editRingRef.current = editRing;

  const propsRef = useRef(props);
  propsRef.current = props;

  const didInitialFitRef = useRef(false);
  const lastFitRequestRef = useRef(props.fitRequest);
  const lastPanToUserRequestRef = useRef(props.panToUserRequest ?? 0);

  // Sync editSession initial ring
  useEffect(() => {
    if (!props.editSession) {
      setEditRing([]);
      return;
    }
    const initRing = props.editSession.initial || [];
    setEditRing(initRing);
  }, [
    props.editSession?.quadraKey,
    props.editSession ? 1 : 0,
    props.editSession?.revision ?? 0,
  ]);

  const collectAllDataCoords = useCallback((): LatLngTuple[] => {
    const p = propsRef.current;
    const pts: LatLngTuple[] = [];
    if (p.mode === 'quadras' && p.quadras.length > 0) {
      for (const q of p.quadras) {
        if (q.boundaryPolygon && q.boundaryPolygon.length >= 3) {
          pts.push(...q.boundaryPolygon);
        } else if (q.centroid) {
          pts.push(q.centroid);
        }
      }
      for (const out of p.outlines || []) {
        if (out.polygon && out.polygon.length >= 3) {
          pts.push(...out.polygon);
        }
      }
    }
    if (pts.length === 0 && p.pins.length > 0) {
      for (const pin of p.pins) {
        if (Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
          pts.push([pin.lat, pin.lng]);
        }
      }
    }
    if (pts.length === 0 && p.quadras.length > 0) {
      for (const q of p.quadras) {
        if (q.boundaryPolygon) pts.push(...q.boundaryPolygon);
      }
    }
    return pts;
  }, []);

  const fitToData = useCallback(() => {
    const pts = collectAllDataCoords();
    if (pts.length === 0) return false;
    const nextCam = computeFitBoundsCamera(
      pts,
      viewportRef.current.width,
      viewportRef.current.height
    );
    if (!nextCam) return false;
    updateCamera(nextCam);
    return true;
  }, [collectAllDataCoords, updateCamera]);

  // 1. Initial auto-fit on first data load
  useEffect(() => {
    if (!didInitialFitRef.current && viewport.width > 40 && viewport.height > 40) {
      if (fitToData()) {
        didInitialFitRef.current = true;
      }
    }
  }, [
    viewport.width,
    viewport.height,
    props.pins.length,
    props.quadras.length,
    props.outlines.length,
    fitToData,
  ]);

  // 2. Explicit fitRequest trigger
  useEffect(() => {
    if (props.fitRequest === lastFitRequestRef.current) return;
    lastFitRequestRef.current = props.fitRequest;
    if (fitToData()) {
      didInitialFitRef.current = true;
    }
  }, [props.fitRequest, fitToData]);

  // 3. Explicit panToUserRequest trigger
  useEffect(() => {
    const req = props.panToUserRequest ?? 0;
    if (req === lastPanToUserRequestRef.current) return;
    lastPanToUserRequestRef.current = req;
    const loc = props.userLocation;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      updateCamera({
        centerLat: loc.lat,
        centerLng: loc.lng,
        zoom: Math.max(cameraRef.current.zoom, 17),
      });
    }
  }, [props.panToUserRequest, props.userLocation, updateCamera]);

  // Gesture tracking state
  const gestureStateRef = useRef<{
    startWorldX: number;
    startWorldY: number;
    startZoom: number;
    isPinching: boolean;
    initialPinchDist: number;
    pinchStartZoom: number;
    pinchCenterLat: number;
    pinchCenterLng: number;
    draggingVertexIndex: number | null;
    touchStartTime: number;
    touchStartX: number;
    touchStartY: number;
    lastTapTime: number;
    lastTapX: number;
    lastTapY: number;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    longPressTriggered: boolean;
  }>({
    startWorldX: 0,
    startWorldY: 0,
    startZoom: 15,
    isPinching: false,
    initialPinchDist: 0,
    pinchStartZoom: 15,
    pinchCenterLat: 0,
    pinchCenterLng: 0,
    draggingVertexIndex: null,
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    longPressTimer: null,
    longPressTriggered: false,
  });

  const clearLongPressTimer = () => {
    if (gestureStateRef.current.longPressTimer) {
      clearTimeout(gestureStateRef.current.longPressTimer);
      gestureStateRef.current.longPressTimer = null;
    }
  };

  const resolveLocalTouchCoords = (evt: GestureResponderEvent): { x: number; y: number } => {
    const ne = evt.nativeEvent as any;
    if (Platform.OS === 'web' && rootRef.current && typeof (rootRef.current as any).getBoundingClientRect === 'function') {
      const rect = (rootRef.current as any).getBoundingClientRect();
      const clientX =
        ne.clientX ??
        ne.touches?.[0]?.clientX ??
        ne.changedTouches?.[0]?.clientX ??
        ne.pageX ??
        0;
      const clientY =
        ne.clientY ??
        ne.touches?.[0]?.clientY ??
        ne.changedTouches?.[0]?.clientY ??
        ne.pageY ??
        0;
      if (clientX !== 0 || clientY !== 0) {
        return { x: clientX - rect.left, y: clientY - rect.top };
      }
    }
    if (typeof ne.locationX === 'number' && typeof ne.locationY === 'number' && (ne.locationX !== 0 || ne.locationY !== 0)) {
      return { x: ne.locationX, y: ne.locationY };
    }
    if (typeof ne.offsetX === 'number' && typeof ne.offsetY === 'number') {
      return { x: ne.offsetX, y: ne.offsetY };
    }
    return { x: ne.locationX || 0, y: ne.locationY || 0 };
  };

  const handleTapAtScreenPoint = useCallback(
    (tapX: number, tapY: number) => {
      const p = propsRef.current;
      const cam = cameraRef.current;
      const vw = viewportRef.current.width;
      const vh = viewportRef.current.height;

      // Double-tap detection -> Zoom in +1 around tap point
      const now = Date.now();
      const dt = now - gestureStateRef.current.lastTapTime;
      const distPrev = Math.hypot(
        tapX - gestureStateRef.current.lastTapX,
        tapY - gestureStateRef.current.lastTapY
      );
      gestureStateRef.current.lastTapTime = now;
      gestureStateRef.current.lastTapX = tapX;
      gestureStateRef.current.lastTapY = tapY;

      if (dt < 280 && distPrev < 28 && !p.pickingOriginMode && !p.editSession) {
        const tappedCoord = screenPxToLatLng(tapX, tapY, cam, vw, vh);
        updateCamera({
          centerLat: (cam.centerLat + tappedCoord.lat) / 2,
          centerLng: (cam.centerLng + tappedCoord.lng) / 2,
          zoom: clampZoom(Math.round(cam.zoom + 1)),
        });
        return;
      }

      // 1. Picking Origin Mode (`pickingOriginMode`)
      if (p.pickingOriginMode && p.onPickOriginOnMap) {
        const coord = screenPxToLatLng(tapX, tapY, cam, vw, vh);
        p.onPickOriginOnMap(coord.lat, coord.lng);
        return;
      }

      // 2. Active Vertex Edit Session (`editSession`)
      if (p.editSession) {
        const ring = editRingRef.current;
        if (ring.length < 3) {
          // Drawing polygon from scratch: append vertex on tap
          const coord = screenPxToLatLng(tapX, tapY, cam, vw, vh);
          const nextRing: LatLngTuple[] = [...ring, [coord.lat, coord.lng]];
          setEditRing(nextRing);
          if (nextRing.length >= 3) {
            p.onPolygonDraft?.(nextRing);
          }
          return;
        }

        // Check if user tapped an edge midpoint handle (`+`) to insert a new vertex
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const midLat = (a[0] + b[0]) / 2;
          const midLng = (a[1] + b[1]) / 2;
          const midScreen = latLngToScreenPx(midLat, midLng, cam, vw, vh);
          if (Math.hypot(tapX - midScreen.x, tapY - midScreen.y) <= 22) {
            const nextRing: LatLngTuple[] = [
              ...ring.slice(0, i + 1),
              [midLat, midLng],
              ...ring.slice(i + 1),
            ];
            setEditRing(nextRing);
            p.onPolygonDraft?.(nextRing);
            return;
          }
        }
        return;
      }

      // 3. Pins Mode -> Find nearest pin within 28px touch radius
      if (p.mode === 'pins') {
        let bestPin: MapPin | null = null;
        let bestDist = 28;
        for (const pin of p.pins) {
          const sp = latLngToScreenPx(pin.lat, pin.lng, cam, vw, vh);
          const d = Math.hypot(tapX - sp.x, tapY - sp.y);
          if (d < bestDist) {
            bestDist = d;
            bestPin = pin;
          }
        }
        if (bestPin) {
          p.onSelectPin(bestPin.key);
          setActivePinPopupKey(bestPin.key);
          setActiveQuadraPopupKey(null);
        } else {
          setActivePinPopupKey(null);
        }
        return;
      }

      // 4. Quadras Mode -> Ray-Casting Point-in-Polygon (PIP) + nearest centroid fallback
      const tapCoord = screenPxToLatLng(tapX, tapY, cam, vw, vh);
      let matchedQuadra: MapQuadra | null = null;

      for (const q of p.quadras) {
        if (q.boundaryPolygon && q.boundaryPolygon.length >= 3) {
          if (pointInPolygon(tapCoord.lat, tapCoord.lng, q.boundaryPolygon)) {
            matchedQuadra = q;
            break;
          }
        }
      }

      if (!matchedQuadra) {
        let bestDist = 30;
        for (const q of p.quadras) {
          if (!q.centroid) continue;
          const sp = latLngToScreenPx(q.centroid[0], q.centroid[1], cam, vw, vh);
          const d = Math.hypot(tapX - sp.x, tapY - sp.y);
          if (d < bestDist) {
            bestDist = d;
            matchedQuadra = q;
          }
        }
      }

      if (matchedQuadra) {
        p.onSelectQuadra(matchedQuadra.key);
        setActiveQuadraPopupKey(matchedQuadra.key);
        setActivePinPopupKey(null);
      } else {
        setActiveQuadraPopupKey(null);
      }
    },
    [updateCamera]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.hypot(gestureState.dx, gestureState.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          clearLongPressTimer();
          const touches = evt.nativeEvent.touches;
          const cam = cameraRef.current;
          const vw = viewportRef.current.width;
          const vh = viewportRef.current.height;
          const centerWorld = latLngToWorldPx(cam.centerLat, cam.centerLng, cam.zoom);

          const { x: x0, y: y0 } = resolveLocalTouchCoords(evt);

          gestureStateRef.current.startWorldX = centerWorld.x;
          gestureStateRef.current.startWorldY = centerWorld.y;
          gestureStateRef.current.startZoom = cam.zoom;
          gestureStateRef.current.touchStartTime = Date.now();
          gestureStateRef.current.touchStartX = x0;
          gestureStateRef.current.touchStartY = y0;
          gestureStateRef.current.longPressTriggered = false;
          gestureStateRef.current.draggingVertexIndex = null;

          if (touches && touches.length >= 2) {
            const dx = touches[1].pageX - touches[0].pageX;
            const dy = touches[1].pageY - touches[0].pageY;
            gestureStateRef.current.isPinching = true;
            gestureStateRef.current.initialPinchDist = Math.max(10, Math.hypot(dx, dy));
            gestureStateRef.current.pinchStartZoom = cam.zoom;
            gestureStateRef.current.pinchCenterLat = cam.centerLat;
            gestureStateRef.current.pinchCenterLng = cam.centerLng;
            return;
          }

          gestureStateRef.current.isPinching = false;

          // Check if starting a vertex drag or long-press delete in editSession
          if (propsRef.current.editSession && editRingRef.current.length >= 3) {
            const ring = editRingRef.current;
            for (let i = 0; i < ring.length; i++) {
              const sp = latLngToScreenPx(ring[i][0], ring[i][1], cam, vw, vh);
              if (Math.hypot(x0 - sp.x, y0 - sp.y) <= 24) {
                gestureStateRef.current.draggingVertexIndex = i;
                // Schedule long-press (600ms) to delete vertex if not dragged
                gestureStateRef.current.longPressTimer = setTimeout(() => {
                  const currentRing = editRingRef.current;
                  if (currentRing.length > 3) {
                    gestureStateRef.current.longPressTriggered = true;
                    gestureStateRef.current.draggingVertexIndex = null;
                    const filtered = currentRing.filter((_, idx) => idx !== i);
                    setEditRing(filtered);
                    propsRef.current.onPolygonDraft?.(filtered);
                  }
                }, 600);
                break;
              }
            }
          }
        },
        onPanResponderMove: (evt: GestureResponderEvent, gestureState) => {
          const touches = evt.nativeEvent.touches;
          const cam = cameraRef.current;
          const vw = viewportRef.current.width;
          const vh = viewportRef.current.height;

          if (Math.hypot(gestureState.dx, gestureState.dy) > 8) {
            clearLongPressTimer();
          }

          // 2-Finger Pinch-to-Zoom
          if (touches && touches.length >= 2) {
            const dx = touches[1].pageX - touches[0].pageX;
            const dy = touches[1].pageY - touches[0].pageY;
            const dist = Math.max(10, Math.hypot(dx, dy));

            if (!gestureStateRef.current.isPinching) {
              gestureStateRef.current.isPinching = true;
              gestureStateRef.current.initialPinchDist = dist;
              gestureStateRef.current.pinchStartZoom = cam.zoom;
              gestureStateRef.current.pinchCenterLat = cam.centerLat;
              gestureStateRef.current.pinchCenterLng = cam.centerLng;
              return;
            }

            const ratio = dist / gestureStateRef.current.initialPinchDist;
            const nextZoom = clampZoom(
              gestureStateRef.current.pinchStartZoom + Math.log2(ratio)
            );
            updateCamera({
              centerLat: gestureStateRef.current.pinchCenterLat,
              centerLng: gestureStateRef.current.pinchCenterLng,
              zoom: nextZoom,
            });
            return;
          }

          if (gestureStateRef.current.isPinching) {
            return;
          }

          // 1-Finger Vertex Dragging in Edit Mode
          const vIdx = gestureStateRef.current.draggingVertexIndex;
          if (vIdx !== null && propsRef.current.editSession) {
            const targetScreenX = gestureStateRef.current.touchStartX + gestureState.dx;
            const targetScreenY = gestureStateRef.current.touchStartY + gestureState.dy;
            const movedLatLng = screenPxToLatLng(targetScreenX, targetScreenY, cam, vw, vh);
            const nextRing = editRingRef.current.map((pt, idx) =>
              idx === vIdx ? ([movedLatLng.lat, movedLatLng.lng] as LatLngTuple) : pt
            );
            setEditRing(nextRing);
            propsRef.current.onPolygonDraft?.(nextRing);
            return;
          }

          // 1-Finger Camera Pan
          const nextWorldX = gestureStateRef.current.startWorldX - gestureState.dx;
          const nextWorldY = gestureStateRef.current.startWorldY - gestureState.dy;
          const nextCenter = worldPxToLatLng(
            nextWorldX,
            nextWorldY,
            gestureStateRef.current.startZoom
          );
          updateCamera({
            centerLat: nextCenter.lat,
            centerLng: nextCenter.lng,
            zoom: gestureStateRef.current.startZoom,
          });
        },
        onPanResponderRelease: (_evt, gestureState) => {
          clearLongPressTimer();
          if (gestureStateRef.current.longPressTriggered) {
            gestureStateRef.current.longPressTriggered = false;
            gestureStateRef.current.draggingVertexIndex = null;
            return;
          }

          const wasPinching = gestureStateRef.current.isPinching;
          const wasDraggingVertex = gestureStateRef.current.draggingVertexIndex !== null;
          gestureStateRef.current.isPinching = false;
          gestureStateRef.current.draggingVertexIndex = null;

          if (wasPinching || wasDraggingVertex) {
            return;
          }

          const totalMove = Math.hypot(gestureState.dx, gestureState.dy);
          const elapsed = Date.now() - gestureStateRef.current.touchStartTime;
          if (totalMove < 8 && elapsed < 500) {
            handleTapAtScreenPoint(
              gestureStateRef.current.touchStartX,
              gestureStateRef.current.touchStartY
            );
          }
        },
        onPanResponderTerminate: () => {
          clearLongPressTimer();
          gestureStateRef.current.isPinching = false;
          gestureStateRef.current.draggingVertexIndex = null;
        },
      }),
    [handleTapAtScreenPoint, updateCamera]
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport({ width, height });
    }
  }, []);

  const visibleTiles = useMemo(
    () => computeVisibleTiles(camera, viewport.width, viewport.height),
    [camera, viewport.width, viewport.height]
  );

  const selectedPin = useMemo(
    () =>
      activePinPopupKey
        ? props.pins.find((p) => p.key === activePinPopupKey) || null
        : null,
    [activePinPopupKey, props.pins]
  );

  const selectedQuadra = useMemo(
    () =>
      activeQuadraPopupKey
        ? props.quadras.find((q) => q.key === activeQuadraPopupKey) || null
        : null,
    [activeQuadraPopupKey, props.quadras]
  );

  const openExternalUrl = useCallback((url: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch(() => undefined);
  }, []);

  const cycleTileProvider = useCallback(() => {
    setTileProvider((prev) =>
      prev === 'hot'
        ? 'arcgis'
        : prev === 'arcgis'
        ? 'osm_de'
        : prev === 'osm_de'
        ? 'topo'
        : 'hot'
    );
  }, []);

  // Compute GPS halo pixel radius
  const gpsScreenPoint = useMemo(() => {
    const loc = props.userLocation;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
    const pt = latLngToScreenPx(loc.lat, loc.lng, camera, viewport.width, viewport.height);
    const mpp = metersPerPixel(loc.lat, camera.zoom);
    const accuracyMeters = Math.max(10, Math.min(loc.accuracy || 20, 250));
    const radiusPx = Math.max(12, Math.min(180, accuracyMeters / Math.max(0.05, mpp)));
    return { ...pt, radiusPx, loc };
  }, [props.userLocation, camera, viewport.width, viewport.height]);

  return (
    <View ref={rootRef} testID="native-map-root" style={styles.root} onLayout={onLayout}>
      {/* Interactive Gesture Surface (Tiles + SVG Vector Layers + Markers) */}
      <View style={styles.gestureCanvas} {...panResponder.panHandlers}>
        {/* Layer 1: Slippy Map 256x256 Raster Tiles */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {visibleTiles.map((t) => {
            const effectiveProvider =
              tileProvider === 'hot' && failedOsmCount > 4 ? 'arcgis' : tileProvider;
            const uri = buildTileUrl(effectiveProvider, t.z, t.tx, t.ty);
            return (
              <Image
                key={`${effectiveProvider}:${t.key}`}
                source={Platform.OS === 'web' ? { uri } : { uri, headers: TILE_HEADERS }}
                style={{
                  position: 'absolute',
                  left: t.left,
                  top: t.top,
                  width: t.size,
                  height: t.size,
                }}
                resizeMode="cover"
                onError={() => {
                  if (tileProvider === 'hot') {
                    setFailedOsmCount((c) => c + 1);
                  }
                }}
              />
            );
          })}
        </View>

        {/* Layer 2: Hardware-Accelerated SVG Vector Layer (Outlines, Quadras, Routes, GPS Halo, Edit Polygon) */}
        <Svg
          width={viewport.width}
          height={viewport.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {/* 2a. Merged Territory Outlines */}
          {props.mode === 'quadras' &&
            props.outlines.map((mt) => {
              if (!mt.polygon || mt.polygon.length < 3) return null;
              const pts = coordsToSvgPoints(
                mt.polygon,
                camera,
                viewport.width,
                viewport.height
              );
              return (
                <Polygon
                  key={`outline-${mt.territoryNumber}`}
                  points={pts}
                  stroke={mt.color}
                  strokeWidth={3.5}
                  strokeDasharray="8, 8"
                  strokeOpacity={0.95}
                  fill={mt.color}
                  fillOpacity={0.12}
                />
              );
            })}

          {/* 2b. Quadra Polygons */}
          {props.mode === 'quadras' &&
            props.quadras.map((q) => {
              if (!q.boundaryPolygon || q.boundaryPolygon.length < 3) return null;
              if (props.editSession && props.editSession.quadraKey === q.key) return null;
              const isSelected =
                props.selectedKey === q.key || activeQuadraPopupKey === q.key;
              const pts = coordsToSvgPoints(
                q.boundaryPolygon,
                camera,
                viewport.width,
                viewport.height
              );
              return (
                <Polygon
                  key={`quadra-${q.key}`}
                  points={pts}
                  stroke={q.statusColor}
                  strokeWidth={isSelected ? 4.5 : 2.8}
                  strokeOpacity={0.96}
                  fill={q.statusColor}
                  fillOpacity={isSelected ? 0.48 : 0.34}
                />
              );
            })}

          {/* 2c. Active Street / Offline Route Polyline */}
          {props.activeRoute &&
          props.activeRoute.coordinates &&
          props.activeRoute.coordinates.length >= 2 ? (
            <G>
              <Polyline
                points={coordsToSvgPoints(
                  props.activeRoute.coordinates,
                  camera,
                  viewport.width,
                  viewport.height
                )}
                stroke="#0F172A"
                strokeWidth={8.5}
                strokeOpacity={0.82}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={coordsToSvgPoints(
                  props.activeRoute.coordinates,
                  camera,
                  viewport.width,
                  viewport.height
                )}
                stroke={props.activeRoute.source === 'osrm' ? '#06B6D4' : '#F59E0B'}
                strokeWidth={4.8}
                strokeOpacity={0.96}
                strokeDasharray={
                  props.activeRoute.source === 'offline_haversine' ? '10, 8' : undefined
                }
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          ) : null}

          {/* 2d. Active Vertex Editor Session (`editSession`) */}
          {props.editSession ? (
            <G>
              {editRing.length >= 3 ? (
                <Polygon
                  points={coordsToSvgPoints(
                    editRing,
                    camera,
                    viewport.width,
                    viewport.height
                  )}
                  stroke={props.editSession.color || '#10B981'}
                  strokeWidth={3}
                  fill={props.editSession.color || '#10B981'}
                  fillOpacity={0.25}
                />
              ) : editRing.length === 2 ? (
                <Polyline
                  points={coordsToSvgPoints(
                    editRing,
                    camera,
                    viewport.width,
                    viewport.height
                  )}
                  stroke={props.editSession.color || '#10B981'}
                  strokeWidth={3}
                  fill="none"
                />
              ) : null}

              {/* Reference unit dots inside edited quadra */}
              {props.editSession.units.map((u, idx) => {
                const sp = latLngToScreenPx(
                  u[0],
                  u[1],
                  camera,
                  viewport.width,
                  viewport.height
                );
                return (
                  <Circle
                    key={`edit-unit-${idx}`}
                    cx={sp.x}
                    cy={sp.y}
                    r={4.5}
                    stroke="#111827"
                    strokeWidth={1.2}
                    fill="#FFFFFF"
                    fillOpacity={0.92}
                  />
                );
              })}

              {/* Warning red circles for units falling outside the edited polygon */}
              {(props.editSession.unitsOutside || []).map((u, idx) => {
                const sp = latLngToScreenPx(
                  u[0],
                  u[1],
                  camera,
                  viewport.width,
                  viewport.height
                );
                return (
                  <Circle
                    key={`edit-outside-${idx}`}
                    cx={sp.x}
                    cy={sp.y}
                    r={8}
                    stroke="#EF4444"
                    strokeWidth={2.8}
                    fill="#F59E0B"
                    fillOpacity={0.95}
                  />
                );
              })}
            </G>
          ) : null}

          {/* 2e. Live GPS Accuracy Halo */}
          {gpsScreenPoint ? (
            <Circle
              cx={gpsScreenPoint.x}
              cy={gpsScreenPoint.y}
              r={gpsScreenPoint.radiusPx}
              stroke="#3B82F6"
              strokeWidth={1.5}
              strokeOpacity={0.75}
              fill="#3B82F6"
              fillOpacity={0.15}
            />
          ) : null}
        </Svg>

        {/* Layer 3: Interactive Quadra Targets, Street Labels, Walking Sequence Badges, Pins, GPS Dot & Vertex Handles */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* 3a. Quadra Centroid Tap Targets & Street Labels (`mode === 'quadras'`) */}
          {props.mode === 'quadras' &&
            !props.pickingOriginMode &&
            !props.editSession &&
            props.quadras.map((q) => {
              if (!q.centroid) return null;
              const sp = latLngToScreenPx(
                q.centroid[0],
                q.centroid[1],
                camera,
                viewport.width,
                viewport.height
              );
              if (
                sp.x < -80 ||
                sp.x > viewport.width + 80 ||
                sp.y < -30 ||
                sp.y > viewport.height + 30
              ) {
                return null;
              }
              return (
                <Pressable
                  key={`quadra-hit-${q.key}`}
                  testID={`quadra-polygon-${q.key}`}
                  onPress={() => {
                    props.onSelectQuadra(q.key);
                    setActiveQuadraPopupKey(q.key);
                    setActivePinPopupKey(null);
                  }}
                  style={[
                    styles.quadraHitTarget,
                    { left: sp.x - 45, top: sp.y - 18, width: 90, height: 36 },
                  ]}
                >
                  {props.showStreetLabels && q.perimeterStreets.length > 0 ? (
                    <Text style={styles.streetLabelText} numberOfLines={1}>
                      {q.perimeterStreets.slice(0, 2).join(' · ')}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

          {/* 3b. Walking Sequence Order Badges (`1, 2, 3...`) in Quadras mode */}
          {props.mode === 'quadras' &&
          !props.activeRoute &&
          props.walkingSequence &&
          props.walkingSequence.length >= 1 &&
          props.walkingSequence.length <= 60
            ? props.walkingSequence.map((stop) => {
                const sp = latLngToScreenPx(
                  stop.lat,
                  stop.lng,
                  camera,
                  viewport.width,
                  viewport.height
                );
                if (
                  sp.x < -20 ||
                  sp.x > viewport.width + 20 ||
                  sp.y < -20 ||
                  sp.y > viewport.height + 20
                ) {
                  return null;
                }
                return (
                  <View
                    key={`walk-seq-${stop.key}-${stop.order}`}
                    pointerEvents="none"
                    style={[
                      styles.walkStopBadge,
                      {
                        left: sp.x - 10,
                        top: sp.y - 10,
                        backgroundColor: stop.worked === 1 ? '#10B981' : '#F59E0B',
                      },
                    ]}
                  >
                    <Text style={styles.walkStopBadgeText}>{stop.order}</Text>
                  </View>
                );
              })
            : null}

          {/* 3c. Pins Layer (`mode === 'pins'`) */}
          {props.mode === 'pins' &&
            props.pins.map((pin) => {
              const sp = latLngToScreenPx(
                pin.lat,
                pin.lng,
                camera,
                viewport.width,
                viewport.height
              );
              if (
                sp.x < -30 ||
                sp.x > viewport.width + 30 ||
                sp.y < -30 ||
                sp.y > viewport.height + 30
              ) {
                return null;
              }
              const isWorked = pin.worked === 1;
              const isSelected =
                props.selectedKey === pin.key || activePinPopupKey === pin.key;
              const badgeText =
                pin.walkOrder !== undefined
                  ? isWorked
                    ? `✓${pin.walkOrder}`
                    : String(pin.walkOrder)
                  : isWorked
                  ? '✓'
                  : '•';
              const polyPts = getPinShapeSvgPoints(pin.shape);
              const strokeColor = isSelected ? '#FFB800' : '#FFFFFF';
              const strokeW = isSelected ? 2.6 : 1.8;

              return (
                <Pressable
                  key={`pin-${pin.key}`}
                  testID={`native-pin-${pin.key}`}
                  onPress={() => {
                    if (props.pickingOriginMode && props.onPickOriginOnMap) {
                      props.onPickOriginOnMap(pin.lat, pin.lng);
                      return;
                    }
                    props.onSelectPin(pin.key);
                    setActivePinPopupKey(pin.key);
                    setActiveQuadraPopupKey(null);
                  }}
                  style={[
                    styles.pinMarkerWrap,
                    {
                      left: sp.x - 14,
                      top: sp.y - 14,
                      zIndex: isSelected ? 1000 : 10,
                    },
                  ]}
                >
                  {polyPts ? (
                    <Svg
                      width={28}
                      height={28}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    >
                      <Polygon
                        points={polyPts}
                        fill={pin.color}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        strokeDasharray={!isWorked && !isSelected ? '3, 2' : undefined}
                      />
                    </Svg>
                  ) : (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.pinDefaultBody,
                        {
                          backgroundColor: pin.color,
                          borderColor: strokeColor,
                          borderWidth: strokeW,
                          borderStyle: !isWorked && !isSelected ? 'dashed' : 'solid',
                          borderRadius: pin.shape === 'square' ? 5 : 14,
                        },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.pinBadgeText,
                      pin.walkOrder !== undefined && { fontSize: 9.5 },
                    ]}
                    numberOfLines={1}
                  >
                    {badgeText}
                  </Text>
                </Pressable>
              );
            })}

          {/* 3d. Active Route Numbered Stop Badges */}
          {props.activeRoute?.stops?.map((stop) => {
            const sp = latLngToScreenPx(
              stop.lat,
              stop.lng,
              camera,
              viewport.width,
              viewport.height
            );
            return (
              <View
                key={`route-stop-${stop.order}-${stop.key}`}
                testID={`route-stop-badge-${stop.order}`}
                pointerEvents="none"
                style={[styles.routeStopBadge, { left: sp.x - 12, top: sp.y - 12 }]}
              >
                <Text style={styles.routeStopBadgeText}>{stop.order}</Text>
              </View>
            );
          })}

          {/* 3e. Vertex Editor Draggable Handles & Edge Midpoint (`+`) Handles */}
          {props.editSession &&
            editRing.map((pt, idx) => {
              const sp = latLngToScreenPx(
                pt[0],
                pt[1],
                camera,
                viewport.width,
                viewport.height
              );
              const nextPt = editRing[(idx + 1) % editRing.length];
              const midSp =
                editRing.length >= 3
                  ? latLngToScreenPx(
                      (pt[0] + nextPt[0]) / 2,
                      (pt[1] + nextPt[1]) / 2,
                      camera,
                      viewport.width,
                      viewport.height
                    )
                  : null;
              return (
                <React.Fragment key={`vertex-frag-${idx}`}>
                  {midSp ? (
                    <Pressable
                      testID={`native-midpoint-${idx}`}
                      onPress={() => {
                        const midLat = (pt[0] + nextPt[0]) / 2;
                        const midLng = (pt[1] + nextPt[1]) / 2;
                        const nextRing: LatLngTuple[] = [
                          ...editRing.slice(0, idx + 1),
                          [midLat, midLng],
                          ...editRing.slice(idx + 1),
                        ];
                        setEditRing(nextRing);
                        props.onPolygonDraft?.(nextRing);
                      }}
                      style={[
                        styles.midpointHandle,
                        { left: midSp.x - 9, top: midSp.y - 9 },
                      ]}
                    >
                      <Text style={styles.midpointHandleText}>+</Text>
                    </Pressable>
                  ) : null}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.vertexHandle,
                      { left: sp.x - 9, top: sp.y - 9 },
                    ]}
                  />
                </React.Fragment>
              );
            })}

          {/* 3f. Live GPS User Dot */}
          {gpsScreenPoint ? (
            <View
              testID="leaflet-user-gps-dot"
              pointerEvents="none"
              style={[
                styles.gpsUserDot,
                { left: gpsScreenPoint.x - 9, top: gpsScreenPoint.y - 9 },
              ]}
            />
          ) : null}
        </View>
      </View>

      {/* Picking Origin Mode Interactive Surface */}
      {props.pickingOriginMode ? (
        <Pressable
          testID="native-map-origin-pick-surface"
          style={StyleSheet.absoluteFill}
          onPress={(evt) => {
            const { x, y } = resolveLocalTouchCoords(evt);
            const tapX = x > 0 ? x : viewportRef.current.width / 2;
            const tapY = y > 0 ? y : viewportRef.current.height / 2;
            const coord = screenPxToLatLng(
              tapX,
              tapY,
              cameraRef.current,
              viewportRef.current.width,
              viewportRef.current.height
            );
            props.onPickOriginOnMap?.(coord.lat, coord.lng);
          }}
        />
      ) : null}

      {/* Left-side Tactical Zoom & Basemap Controls */}
      <View style={styles.zoomControlsCol} pointerEvents="box-none">
        <Pressable
          testID="native-map-zoom-in"
          onPress={() =>
            updateCamera({
              ...cameraRef.current,
              zoom: clampZoom(Math.round(cameraRef.current.zoom + 1)),
            })
          }
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomBtnText}>＋</Text>
        </Pressable>
        <Pressable
          testID="native-map-zoom-out"
          onPress={() =>
            updateCamera({
              ...cameraRef.current,
              zoom: clampZoom(Math.round(cameraRef.current.zoom - 1)),
            })
          }
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomBtnText}>－</Text>
        </Pressable>
        <Pressable
          testID="native-map-fit-bounds"
          onPress={fitToData}
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomBtnIcon}>🎯</Text>
        </Pressable>
        <Pressable
          testID="native-map-cycle-layer"
          onPress={cycleTileProvider}
          style={[styles.zoomBtn, { paddingHorizontal: 8, width: 'auto' }]}
        >
          <Text style={styles.layerBtnText}>
            {tileProvider === 'hot'
              ? '🗺️ Nitidez'
              : tileProvider === 'arcgis'
              ? '🗺️ Ruas HD'
              : tileProvider === 'osm_de'
              ? '🗺️ Clássico'
              : '⛰️ Relevo'}
          </Text>
        </Pressable>
      </View>

      {/* Interactive Pin Popup Card (positioned at top-left so it remains visible alongside mobile bottom sheet) */}
      {selectedPin && props.mode === 'pins' ? (
        <View testID="native-pin-popup-card" style={styles.popupCard}>
          <View style={styles.popupHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={[
                  styles.territoryChip,
                  { borderColor: selectedPin.color },
                ]}
              >
                <Text style={styles.territoryChipText}>
                  {selectedPin.territoryNumber}
                </Text>
              </View>
              <Text style={styles.popupCityText}>{selectedPin.city}</Text>
            </View>
            <Pressable
              testID="native-pin-popup-close"
              onPress={() => setActivePinPopupKey(null)}
              style={styles.popupCloseBtn}
            >
              <Text style={styles.popupCloseText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.popupTitleText}>
            {selectedPin.line || selectedPin.label}
          </Text>
          {selectedPin.line2 ? (
            <Text style={styles.popupSubText}>
              {selectedPin.line2}
              {selectedPin.postalcode ? ` • CEP ${selectedPin.postalcode}` : ''}
            </Text>
          ) : null}

          <View style={styles.popupTagsRow}>
            <View style={styles.popupTag}>
              <Text style={styles.popupTagText}>
                {PROPERTY_LABELS[selectedPin.propertyType] ||
                  PROPERTY_LABELS.residencial}
              </Text>
            </View>
            {selectedPin.walkOrder !== undefined ? (
              <View style={styles.popupTag}>
                <Text style={styles.popupTagText}>
                  👣 {selectedPin.walkOrder}º na rua
                </Text>
              </View>
            ) : null}
            {selectedPin.isForeign ? (
              <View style={styles.popupTag}>
                <Text style={styles.popupTagText}>
                  🌐 {selectedPin.language || 'Estrangeiro'}
                </Text>
              </View>
            ) : null}
            {selectedPin.completedAt ? (
              <View style={styles.popupTag}>
                <Text style={[styles.popupTagText, { color: '#34D399' }]}>
                  ✓ {selectedPin.completedAt}
                  {daysLabel(selectedPin.daysSinceCompleted)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.popupActionsRow}>
            <Pressable
              testID={`popup-pin-toggle-${selectedPin.key}`}
              onPress={() => props.onToggleWork(selectedPin.key)}
              style={[
                styles.popupActionBtn,
                {
                  backgroundColor:
                    selectedPin.worked === 1 ? '#EF4444' : '#10B981',
                  flex: 1.2,
                },
              ]}
            >
              <Text
                style={[
                  styles.popupActionBtnText,
                  {
                    color: selectedPin.worked === 1 ? '#FFFFFF' : '#062016',
                  },
                ]}
              >
                {selectedPin.worked === 1 ? 'Marcar pendente' : '✓ Concluído'}
              </Text>
            </Pressable>

            <Pressable
              testID={`popup-pin-style-${selectedPin.key}`}
              onPress={() => props.onCustomizePin(selectedPin.key)}
              style={[
                styles.popupActionBtn,
                { backgroundColor: 'rgba(255, 184, 0, 0.2)', flex: 0.8 },
              ]}
            >
              <Text style={[styles.popupActionBtnText, { color: '#FBBF24' }]}>
                🎨 Ícone
              </Text>
            </Pressable>

            <Pressable
              testID={`popup-pin-edit-${selectedPin.key}`}
              onPress={() => props.onEditPin(selectedPin.key)}
              style={[
                styles.popupActionBtn,
                { backgroundColor: 'rgba(255, 255, 255, 0.12)', flex: 0.8 },
              ]}
            >
              <Text style={styles.popupActionBtnText}>✏️ Editar</Text>
            </Pressable>
          </View>

          <View style={[styles.popupActionsRow, { marginTop: 6 }]}>
            <Pressable
              testID={`popup-pin-gmaps-${selectedPin.key}`}
              onPress={() => {
                if (props.onOpenGoogleMapsPin) {
                  props.onOpenGoogleMapsPin(selectedPin.key);
                  return;
                }
                const uLoc = props.userLocation;
                const url = buildGoogleMapsDirectionsUrl({
                  lat: selectedPin.lat,
                  lng: selectedPin.lng,
                  line: selectedPin.line || selectedPin.label,
                  line2: selectedPin.line2,
                  city: selectedPin.city,
                  postalcode: selectedPin.postalcode,
                  originLat: uLoc?.lat,
                  originLng: uLoc?.lng,
                  travelMode: 'walking',
                });
                openExternalUrl(url);
              }}
              style={[
                styles.popupActionBtn,
                { backgroundColor: '#2563EB', flex: 1 },
              ]}
            >
              <Text style={styles.popupActionBtnText}>🗺️ Google Maps</Text>
            </Pressable>

            {props.onRouteToPinInMap ? (
              <Pressable
                testID={`popup-pin-route-${selectedPin.key}`}
                onPress={() => props.onRouteToPinInMap?.(selectedPin.key)}
                style={[
                  styles.popupActionBtn,
                  { backgroundColor: '#0891B2', flex: 0.9 },
                ]}
              >
                <Text style={styles.popupActionBtnText}>🧭 Rota GPS</Text>
              </Pressable>
            ) : null}

            {props.onAddPinToRoute ? (
              <Pressable
                testID={`popup-pin-add-route-${selectedPin.key}`}
                onPress={() => props.onAddPinToRoute?.(selectedPin.key)}
                style={[
                  styles.popupActionBtn,
                  {
                    backgroundColor: (props.routeStopKeys || []).includes(
                      selectedPin.key
                    )
                      ? '#059669'
                      : '#0F766E',
                    flex: 0.8,
                  },
                ]}
              >
                <Text style={styles.popupActionBtnText}>
                  {(props.routeStopKeys || []).includes(selectedPin.key)
                    ? '✓ Na Rota'
                    : '➕ +Rota'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Interactive Quadra Popup Card */}
      {selectedQuadra && props.mode === 'quadras' ? (
        <View testID="native-quadra-popup-card" style={styles.popupCard}>
          <View style={styles.popupHeaderRow}>
            <Text style={[styles.popupTitleText, { marginBottom: 0 }]}>
              🏢 {selectedQuadra.label}
            </Text>
            <Pressable
              testID="native-quadra-popup-close"
              onPress={() => setActiveQuadraPopupKey(null)}
              style={styles.popupCloseBtn}
            >
              <Text style={styles.popupCloseText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.popupSubText}>
            {selectedQuadra.workedUnits}/{selectedQuadra.totalUnits} concluídos (
            {selectedQuadra.coveragePercent}%)
          </Text>

          {selectedQuadra.perimeterStreets.length > 0 ? (
            <Text style={styles.popupStreetsText} numberOfLines={2}>
              🛣️ {selectedQuadra.perimeterStreets.join(', ')}
            </Text>
          ) : null}

          <View style={styles.popupActionsRow}>
            <Pressable
              testID={`popup-quadra-gmaps-${selectedQuadra.key}`}
              onPress={() => {
                if (props.onOpenGoogleMapsQuadra) {
                  props.onOpenGoogleMapsQuadra(selectedQuadra.key);
                  return;
                }
                const url = buildGoogleMapsDirectionsUrl({
                  lat: selectedQuadra.centroid?.[0],
                  lng: selectedQuadra.centroid?.[1],
                  street:
                    selectedQuadra.perimeterStreets?.[0] || selectedQuadra.label,
                  locality: selectedQuadra.locality,
                  city: selectedQuadra.city,
                  travelMode: 'walking',
                });
                openExternalUrl(url);
              }}
              style={[
                styles.popupActionBtn,
                { backgroundColor: '#2563EB', flex: 1 },
              ]}
            >
              <Text style={styles.popupActionBtnText}>🗺️ Google Maps</Text>
            </Pressable>

            {props.onRouteToQuadraInMap ? (
              <Pressable
                testID={`popup-quadra-route-${selectedQuadra.key}`}
                onPress={() => props.onRouteToQuadraInMap?.(selectedQuadra.key)}
                style={[
                  styles.popupActionBtn,
                  { backgroundColor: '#0891B2', flex: 1 },
                ]}
              >
                <Text style={styles.popupActionBtnText}>🧭 Rota no Mapa</Text>
              </Pressable>
            ) : null}

            {props.onRouteToQuadraAddressesInMap ? (
              <Pressable
                testID={`popup-quadra-route-addresses-${selectedQuadra.key}`}
                onPress={() =>
                  props.onRouteToQuadraAddressesInMap?.(selectedQuadra.key)
                }
                style={[
                  styles.popupActionBtn,
                  { backgroundColor: '#059669', flex: 1 },
                ]}
              >
                <Text style={styles.popupActionBtnText}>👣 Rota Endereços</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* OpenStreetMap Attribution Badge */}
      <View style={styles.attributionPill} pointerEvents="none">
        <Text style={styles.attributionText}>© OpenStreetMap • CARTO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#12151C',
    overflow: 'hidden',
    position: 'relative',
  },
  gestureCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  quadraHitTarget: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streetLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#111827',
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  walkStopBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  walkStopBadgeText: {
    color: '#0D1117',
    fontSize: 10,
    fontWeight: '900',
  },
  pinMarkerWrap: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDefaultBody: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  pinBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  routeStopBadge: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#06B6D4',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  routeStopBadgeText: {
    color: '#082F49',
    fontSize: 11,
    fontWeight: '900',
  },
  vertexHandle: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#10B981',
    elevation: 6,
  },
  midpointHandle: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  midpointHandleText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  gpsUserDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
  },
  pickingBanner: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 140,
    backgroundColor: 'rgba(37, 99, 235, 0.94)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#93C5FD',
    zIndex: 900,
  },
  pickingBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  routeSummaryPill: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 145,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#06B6D4',
    zIndex: 850,
  },
  routeSummaryText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  zoomControlsCol: {
    position: 'absolute',
    left: 10,
    top: 10,
    gap: 6,
    zIndex: 950,
  },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(18, 21, 28, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  zoomBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  zoomBtnIcon: {
    fontSize: 16,
  },
  layerBtnText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '700',
  },
  popupCard: {
    position: 'absolute',
    left: 56,
    right: 138,
    top: 10,
    maxWidth: 340,
    backgroundColor: 'rgba(17, 24, 39, 0.97)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    zIndex: 1100,
    elevation: 8,
  },
  popupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  territoryChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  territoryChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  popupCityText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  popupCloseBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popupCloseText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '800',
  },
  popupTitleText: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  popupSubText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 6,
  },
  popupStreetsText: {
    color: '#D1D5DB',
    fontSize: 11,
    marginBottom: 8,
  },
  popupTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  popupTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popupTagText: {
    color: '#E5E7EB',
    fontSize: 10,
    fontWeight: '600',
  },
  popupActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  popupActionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupActionBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  attributionPill: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    backgroundColor: 'rgba(18, 21, 28, 0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionText: {
    color: '#9CA3AF',
    fontSize: 9,
  },
});
