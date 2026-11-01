/**
 * Sekundo — GeoJSON & KML Polygon Spatial Adapter
 *
 * Implements bidirectional conversion between spatial files (GeoJSON/KML)
 * and hierarchical Skeleton territory nodes.
 */

import type { SkeletonNode } from '../skeleton/types';
import type { TerritoryNodeMeta } from '../engines/types';

export interface GeoJSONGeometry {
  type: 'Point' | 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties?: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Normalizes a polygon coordinate ring into internal `[lat, lng]` order.
 * GeoJSON RFC 7946 and KML store coordinates as `[lng, lat]`.
 * If `sourceOrder` is `'lng_lat'` (default for GeoJSON/KML), swaps `[lng, lat] -> [lat, lng]`.
 * Also removes duplicate closing vertex if identical to the first vertex.
 */
export function ensureLatLngRing(
  ring: [number, number][],
  sourceOrder: 'lng_lat' | 'lat_lng' | 'auto' = 'lng_lat'
): [number, number][] {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const converted: [number, number][] = [];
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const a = Number(pt[0]);
    const b = Number(pt[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (sourceOrder === 'lng_lat') {
      converted.push([b, a]);
    } else if (sourceOrder === 'lat_lng') {
      converted.push([a, b]);
    } else {
      // Heuristic when 'auto':
      // 1) Latitude must be in [-90, 90] (if |a| > 90 and |b| <= 90, a is lng and b is lat)
      // 2) In Brazil/South America, lng is in [-75, -34] and lat is in [-34, 6]
      const isLngLatOrder =
        (Math.abs(a) > 90 && Math.abs(b) <= 90) ||
        (a < -34 && a >= -82 && b >= -34 && b <= 13);
      if (isLngLatOrder) {
        converted.push([b, a]);
      } else {
        converted.push([a, b]);
      }
    }
  }
  if (
    converted.length > 3 &&
    Math.abs(converted[0][0] - converted[converted.length - 1][0]) < 1e-7 &&
    Math.abs(converted[0][1] - converted[converted.length - 1][1]) < 1e-7
  ) {
    converted.pop();
  }
  return converted;
}

/**
 * Converts an internal `[lat, lng]` polygon ring into a closed GeoJSON `[lng, lat]` ring per RFC 7946.
 */
export function latLngRingToGeoJsonCoords(ringLatLng: [number, number][]): [number, number][] {
  if (!Array.isArray(ringLatLng) || ringLatLng.length === 0) return [];
  const ringLngLat: [number, number][] = ringLatLng.map(([lat, lng]) => [Number(lng), Number(lat)]);
  if (
    ringLngLat.length >= 3 &&
    (Math.abs(ringLngLat[0][0] - ringLngLat[ringLngLat.length - 1][0]) > 1e-7 ||
      Math.abs(ringLngLat[0][1] - ringLngLat[ringLngLat.length - 1][1]) > 1e-7)
  ) {
    ringLngLat.push([ringLngLat[0][0], ringLngLat[0][1]]);
  }
  return ringLngLat;
}

/**
 * Calculates the centroid of a 2D GeoJSON polygon ring `[[lng, lat], ...]`.
 * Returns `[lat, lng]`.
 */
export function calculatePolygonCentroid(coordinates: [number, number][]): [number, number] {
  if (coordinates.length === 0) return [0, 0];

  let sumLat = 0;
  let sumLng = 0;

  for (const [lng, lat] of coordinates) {
    sumLat += lat;
    sumLng += lng;
  }

  return [sumLat / coordinates.length, sumLng / coordinates.length];
}

/**
 * Converts a GeoJSON FeatureCollection into flat skeleton territory nodes.
 * Normalizes GeoJSON `[lng, lat]` polygon rings into internal `[lat, lng]` `boundaryPolygon`.
 * @param geoJson The parsed GeoJSON object
 * @param parentPrefix Key prefix, e.g. "01" (for territory 1)
 */
export function geoJsonToSkeletonNodes(
  geoJson: GeoJSONFeatureCollection,
  parentPrefix: string = '01'
): SkeletonNode[] {
  const nodes: SkeletonNode[] = [];

  for (let i = 0; i < geoJson.features.length; i++) {
    const feature = geoJson.features[i];
    const indexPadded = String(i + 1).padStart(2, '0');
    const nodeKey = `${parentPrefix}-${indexPadded}`;

    const label =
      feature.properties?.name ||
      feature.properties?.label ||
      feature.properties?.quadra ||
      `Quadra ${i + 1}`;

    const meta: TerritoryNodeMeta = {
      worked: feature.properties?.worked === 1 ? 1 : 0,
      notes: feature.properties?.description || feature.properties?.notes,
    };

    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      meta.lat = lat;
      meta.lng = lng;
    } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const outerRingLngLat: [number, number][] =
        feature.geometry.type === 'MultiPolygon'
          ? feature.geometry.coordinates?.[0]?.[0] || []
          : feature.geometry.coordinates?.[0] || [];
      const latLngRing = ensureLatLngRing(outerRingLngLat, 'lng_lat');
      meta.boundaryPolygon = latLngRing;
      const [centroidLat, centroidLng] = calculatePolygonCentroid(outerRingLngLat);
      meta.lat = centroidLat;
      meta.lng = centroidLng;
    }

    nodes.push({
      key: nodeKey,
      type: 'territory',
      label,
      value: '',
      email: '',
      meta: meta as Record<string, unknown>,
      children: [],
    });
  }

  return nodes;
}

/**
 * Exports skeleton nodes containing spatial meta back into a standard GeoJSON FeatureCollection.
 * Converts internal `[lat, lng]` `boundaryPolygon` rings back into RFC 7946 `[lng, lat]` rings.
 */
export function skeletonNodesToGeoJson(nodes: SkeletonNode[]): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = [];

  for (const node of nodes) {
    const meta = (node.meta || {}) as TerritoryNodeMeta;

    if (meta.boundaryPolygon && meta.boundaryPolygon.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [latLngRingToGeoJsonCoords(meta.boundaryPolygon)],
        },
        properties: {
          key: node.key,
          label: node.label,
          worked: meta.worked ?? 0,
          notes: meta.notes,
        },
      });
    } else if (meta.lat !== undefined && meta.lng !== undefined) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [meta.lng, meta.lat],
        },
        properties: {
          key: node.key,
          label: node.label,
          worked: meta.worked ?? 0,
          address: meta.address,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
