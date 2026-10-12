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
 * Calculates the centroid of a 2D polygon [[lng, lat], ...]
 * Returns [lat, lng].
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
      worked: 0,
      notes: feature.properties?.description || feature.properties?.notes,
    };

    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      meta.lat = lat;
      meta.lng = lng;
    } else if (feature.geometry.type === 'Polygon') {
      // GeoJSON polygon outer ring is coordinates[0]
      const outerRing: [number, number][] = feature.geometry.coordinates[0] || [];
      meta.boundaryPolygon = outerRing;
      const [centroidLat, centroidLng] = calculatePolygonCentroid(outerRing);
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
          coordinates: [meta.boundaryPolygon],
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
