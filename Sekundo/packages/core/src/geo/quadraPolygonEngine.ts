/**
 * Sekundo — Quadra & Perimeter Streets GIS Engine
 *
 * Implements the Universal Spatial Law for Urban Quadras/Blocks:
 * - Grouping by Quadra/Block with perimeter enclosing streets (3, 4+ ruas)
 * - Polygon geometry calculation (Convex Hull, Bounding Polygon or explicit coords)
 * - Bottom-up 0/1 Rollup & Semantic Status Color (#10B981, #F59E0B, #EF4444)
 * - Address Unit inspection without displaying raw coordinates
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import { resolveTerritoryNumber, parseLatLng, bufferPolygonMeters } from './geoUtils';

/** Default outward margin (meters) applied to automatic hulls so pins sit inside the block. */
export const DEFAULT_AUTO_BUFFER_METERS = 6;

export type BoundarySource = 'auto' | 'manual' | 'imported';

export interface QuadraAddressUnit {
  key: string;
  numberOrComplement: string;
  street: string;
  worked: 0 | 1;
  lat?: number;
  lng?: number;
  notes?: string;
  isForeign?: boolean;
  propertyType?: string;
  workerName?: string;
  lastWorkedAt?: string;
}

export interface StreetAddressGroup {
  streetName: string;
  units: QuadraAddressUnit[];
  totalUnits: number;
  workedUnits: number;
  coveragePercent: number;
}

export interface QuadraSummary {
  key: string;
  quadraNumber: string;
  label: string;
  territoryNumber: string;
  locality?: string;
  city?: string;
  perimeterStreets: string[];
  boundaryPolygon: [number, number][]; // Array of [lat, lng]
  centroid: [number, number];          // [lat, lng]
  totalUnits: number;
  workedUnits: number;
  coveragePercent: number;
  isCompleted: boolean;
  statusColor: string;                 // Hex color for Leaflet polygon
  customColor?: string;                // User custom override color if specified
  polygonExpansion?: number;           // Legacy scale factor (kept for compatibility, no longer drives geometry)
  bufferMeters: number;                // Effective outward (+) / inward (-) margin in meters
  boundarySource: BoundarySource;      // Where the boundary polygon came from
  mergedWithQuadras?: string[];        // If merged with other quadras into a territory group
  streets: StreetAddressGroup[];
}

/**
 * Merges multiple quadras into a single combined territory polygon.
 * Collects all boundary points from the selected quadras and calculates the bounding convex hull.
 */
export function computeMergedTerritoryPolygon(
  quadras: Pick<QuadraSummary, 'boundaryPolygon' | 'centroid'>[],
  bufferMeters = 10
): [number, number][] {
  const allPoints: [number, number][] = [];
  for (const q of quadras) {
    if (q.boundaryPolygon && q.boundaryPolygon.length > 0) {
      allPoints.push(...q.boundaryPolygon);
    } else if (q.centroid && (q.centroid[0] !== 0 || q.centroid[1] !== 0)) {
      allPoints.push(q.centroid);
    }
  }

  if (allPoints.length < 3) {
    return allPoints;
  }

  const hull = computeConvexHull(allPoints);
  return bufferPolygonMeters(hull, bufferMeters);
}

/**
 * Calculates semantic status color for a Quadra based on completion percentage.
 */
export function calculateQuadraColor(coveragePercent: number, totalUnits: number): string {
  if (totalUnits === 0) return '#6B7280'; // Gray (No address units)
  if (coveragePercent >= 100) return '#10B981'; // Emerald Green (100% Completed)
  if (coveragePercent > 0) return '#F59E0B'; // Amber / Orange (In Progress)
  return '#EF4444'; // Red (Pending / 0% worked)
}

/**
 * Computes a 2D convex hull around an arbitrary set of [lat, lng] points (Monotone Chain algorithm).
 * Returns the ordered vertices of the convex polygon.
 */
export function computeConvexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return points;

  // Sort points primarily by latitude, secondarily by longitude
  const sorted = [...points].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

  // Cross product of vector OA and OB
  function cross(o: [number, number], a: [number, number], b: [number, number]): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  }

  // Build lower hull
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Concatenate lower and upper hull (remove duplicates)
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Expands a polygon by a fractional margin around its centroid so it encompasses addresses visually.
 */
export function expandPolygon(vertices: [number, number][], factor = 1.0005): [number, number][] {
  if (vertices.length === 0) return [];
  if (vertices.length === 1) {
    const [lat, lng] = vertices[0];
    const d = 0.0004; // ~40m box
    return [
      [lat - d, lng - d],
      [lat - d, lng + d],
      [lat + d, lng + d],
      [lat + d, lng - d],
    ];
  }
  if (vertices.length === 2) {
    const [p1, p2] = vertices;
    const d = 0.0003;
    return [
      [p1[0] - d, p1[1] - d],
      [p1[0] + d, p1[1] + d],
      [p2[0] + d, p2[1] + d],
      [p2[0] - d, p2[1] - d],
    ];
  }

  // Compute centroid
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of vertices) {
    sumLat += lat;
    sumLng += lng;
  }
  const cLat = sumLat / vertices.length;
  const cLng = sumLng / vertices.length;

  return vertices.map(([lat, lng]) => [
    cLat + (lat - cLat) * factor,
    cLng + (lng - cLng) * factor,
  ]);
}

/**
 * Parses raw address label into street name and number/complement.
 * Example: "Rua Azaleias, 202 (AP-2, JD. Karla)" -> { street: "Rua Azaleias", number: "202 (AP-2, JD. Karla)" }
 */
export function parseAddressLine(rawLine: string): { street: string; number: string } {
  if (!rawLine) return { street: 'Logradouro Geral', number: 'S/N' };

  const commaIndex = rawLine.indexOf(',');
  if (commaIndex > -1) {
    const street = rawLine.slice(0, commaIndex).trim();
    const number = rawLine.slice(commaIndex + 1).trim();
    return { street: street || 'Logradouro', number: number || 'S/N' };
  }

  // Hyphen fallback
  const hyphenIndex = rawLine.lastIndexOf('-');
  if (hyphenIndex > -1) {
    const street = rawLine.slice(0, hyphenIndex).trim();
    const number = rawLine.slice(hyphenIndex + 1).trim();
    return { street: street || 'Logradouro', number: number || 'S/N' };
  }

  return { street: rawLine.trim(), number: 'S/N' };
}

/**
 * Extracts and consolidates Quadras from a flat skeleton registry.
 * Groups by explicit quadra meta or by territory sub-containers.
 */
export function extractQuadrasFromRegistry(flatRegistry: FlatSkeletonEntry[]): QuadraSummary[] {
  // Determine leaf nodes vs container nodes
  const parentKeys = new Set<string>();
  flatRegistry.forEach((e) => {
    const parts = e.key.split('-');
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        parentKeys.add(parts.slice(0, i).join('-'));
      }
    }
  });

  // Map of Quadra Key -> Accumulator
  interface QuadraAcc {
    key: string;
    quadraNumber: string;
    label: string;
    territoryNumber: string;
    locality?: string;
    city?: string;
    explicitPolygon?: [number, number][];
    explicitPerimeterStreets?: string[];
    customColor?: string;
    polygonExpansion?: number;
    bufferMeters?: number;
    boundarySource?: BoundarySource;
    mergedWithQuadras?: string[];
    units: QuadraAddressUnit[];
    points: [number, number][];
  }

  const quadraMap = new Map<string, QuadraAcc>();

  // Pass 1: Identify explicit Quadra nodes (depth 3 headers, or nodes carrying quadra metadata/customizations)
  flatRegistry.forEach((entry) => {
    const meta = (entry.meta || {}) as Record<string, any>;
    const isQuadraNode =
      meta.is_quadra === true ||
      meta.quadra_number !== undefined ||
      meta.boundaryPolygon !== undefined ||
      (parentKeys.has(entry.key) &&
        (meta.customColor !== undefined ||
          meta.bufferMeters !== undefined ||
          meta.perimeter_streets !== undefined)) ||
      entry.type === 'header' && entry.key.split('-').length === 3;

    if (isQuadraNode) {
      const qNum = String(meta.quadra_number || meta.quadra || entry.key);
      const tNum = resolveTerritoryNumber(entry, true);

      let poly: [number, number][] | undefined = undefined;
      if (Array.isArray(meta.boundaryPolygon) && meta.boundaryPolygon.length > 0) {
        poly = meta.boundaryPolygon;
      }

      const pStreets: string[] | undefined = Array.isArray(meta.perimeter_streets)
        ? meta.perimeter_streets
        : (Array.isArray(meta.perimeterStreets) ? meta.perimeterStreets : undefined);

      const customColor = meta.customColor || meta.custom_color || meta.cor_personalizada;
      const polygonExpansion = typeof meta.polygonExpansion === 'number'
        ? meta.polygonExpansion
        : (typeof meta.polygon_expansion === 'number' ? meta.polygon_expansion : undefined);
      const bufferMeters = typeof meta.bufferMeters === 'number' ? meta.bufferMeters : undefined;
      const boundarySource: BoundarySource | undefined =
        meta.boundarySource === 'manual' || meta.boundarySource === 'imported' ? meta.boundarySource : undefined;
      const mergedWithQuadras = Array.isArray(meta.merged_quadras) ? meta.merged_quadras : undefined;

      quadraMap.set(entry.key, {
        key: entry.key,
        quadraNumber: qNum,
        label: entry.label || `Quadra ${qNum}`,
        territoryNumber: tNum,
        locality: meta.locality || (entry.label.includes('—') ? entry.label.split('—')[1].trim() : undefined),
        city: meta.city || meta.cidade,
        explicitPolygon: poly,
        explicitPerimeterStreets: pStreets,
        customColor: customColor ? String(customColor) : undefined,
        polygonExpansion,
        bufferMeters,
        boundarySource,
        mergedWithQuadras,
        units: [],
        points: [],
      });
    }
  });

  // Pass 2: Map leaf addresses to their parent quadra or fallback territory-quadra
  flatRegistry.forEach((entry) => {
    if (parentKeys.has(entry.key)) return; // Skip intermediate containers

    const meta = (entry.meta || {}) as Record<string, any>;
    const rawLine = meta.line || entry.label || '';
    const { street, number } = parseAddressLine(rawLine);

    const coords = parseLatLng(meta);
    const lat = coords?.lat;
    const lng = coords?.lng;

    const unit: QuadraAddressUnit = {
      key: entry.key,
      street,
      numberOrComplement: number,
      worked: meta.worked === 1 ? 1 : 0,
      lat,
      lng,
      notes: meta.notes || (entry.value ? entry.value : undefined),
      isForeign: Boolean(meta.isForeign || meta.is_foreign),
      propertyType: meta.propertyType || meta.property_type || 'residencial',
      workerName: meta.workerName || (meta.worked === 1 ? entry.value : undefined),
      lastWorkedAt: meta.lastWorkedAt || meta.completed_date || meta.completedAt,
    };

    // Find target quadra key
    // Strategy A: Find nearest ancestor that is in quadraMap
    const parts = entry.key.split('-');
    let targetQuadraKey: string | null = null;

    for (let depth = parts.length - 1; depth >= 1; depth--) {
      const candidateKey = parts.slice(0, depth).join('-');
      if (quadraMap.has(candidateKey)) {
        targetQuadraKey = candidateKey;
        break;
      }
    }

    // Strategy B: If no explicit ancestor in quadraMap, fallback to territory container (depth 3)
    if (!targetQuadraKey) {
      const fallbackKey = parts.slice(0, Math.min(3, parts.length - 1)).join('-');
      if (!quadraMap.has(fallbackKey)) {
        const tNum = resolveTerritoryNumber(entry);
        quadraMap.set(fallbackKey, {
          key: fallbackKey,
          quadraNumber: fallbackKey,
          label: meta.locality || `Quarteirão ${fallbackKey}`,
          territoryNumber: tNum,
          locality: meta.locality,
          city: meta.city || meta.cidade,
          units: [],
          points: [],
        });
      }
      targetQuadraKey = fallbackKey;
    }

    const acc = quadraMap.get(targetQuadraKey)!;
    acc.units.push(unit);
    if (lat !== undefined && lng !== undefined) {
      acc.points.push([lat, lng]);
    }
  });

  // Pass 3: Synthesize Summaries
  const summaries: QuadraSummary[] = [];

  for (const acc of quadraMap.values()) {
    if (acc.units.length === 0) continue; // Skip empty quadras

    const totalUnits = acc.units.length;
    const workedUnits = acc.units.filter((u) => u.worked === 1).length;
    const coveragePercent = totalUnits > 0 ? Math.round((workedUnits / totalUnits) * 1000) / 10 : 0;
    const isCompleted = totalUnits > 0 && workedUnits === totalUnits;
    const statusColor = acc.customColor || calculateQuadraColor(coveragePercent, totalUnits);

    // Group units by street
    const streetMap = new Map<string, QuadraAddressUnit[]>();
    for (const u of acc.units) {
      const sName = u.street || 'Geral';
      if (!streetMap.has(sName)) {
        streetMap.set(sName, []);
      }
      streetMap.get(sName)!.push(u);
    }

    const streets: StreetAddressGroup[] = Array.from(streetMap.entries()).map(([streetName, uList]) => {
      const sWorked = uList.filter((u) => u.worked === 1).length;
      return {
        streetName,
        units: uList,
        totalUnits: uList.length,
        workedUnits: sWorked,
        coveragePercent: Math.round((sWorked / uList.length) * 1000) / 10,
      };
    });

    // Determine perimeter streets (either explicitly defined or extracted unique streets)
    const perimeterStreets = acc.explicitPerimeterStreets || Array.from(streetMap.keys());

    // Determine polygon boundary (explicit polygons are only buffered when the user asked for it)
    let boundaryPolygon: [number, number][] = [];
    let boundarySource: BoundarySource = 'auto';
    let bufferMeters = acc.bufferMeters ?? DEFAULT_AUTO_BUFFER_METERS;
    if (acc.explicitPolygon && acc.explicitPolygon.length >= 3) {
      boundarySource = acc.boundarySource || 'imported';
      bufferMeters = acc.bufferMeters ?? 0;
      boundaryPolygon = bufferMeters !== 0
        ? bufferPolygonMeters(acc.explicitPolygon, bufferMeters)
        : acc.explicitPolygon;
    } else if (acc.points.length >= 3) {
      const hull = computeConvexHull(acc.points);
      boundaryPolygon = bufferPolygonMeters(hull, bufferMeters);
    } else if (acc.points.length > 0) {
      boundaryPolygon = bufferPolygonMeters(acc.points, bufferMeters);
    }

    // Centroid calculation
    let centroid: [number, number] = [0, 0];
    if (boundaryPolygon.length > 0) {
      let sLat = 0;
      let sLng = 0;
      for (const [lat, lng] of boundaryPolygon) {
        sLat += lat;
        sLng += lng;
      }
      centroid = [sLat / boundaryPolygon.length, sLng / boundaryPolygon.length];
    } else if (acc.points.length > 0) {
      let sLat = 0;
      let sLng = 0;
      for (const [lat, lng] of acc.points) {
        sLat += lat;
        sLng += lng;
      }
      centroid = [sLat / acc.points.length, sLng / acc.points.length];
    }

    summaries.push({
      key: acc.key,
      quadraNumber: acc.quadraNumber,
      label: acc.label,
      territoryNumber: acc.territoryNumber,
      locality: acc.locality,
      city: acc.city,
      perimeterStreets,
      boundaryPolygon,
      centroid,
      totalUnits,
      workedUnits,
      coveragePercent,
      isCompleted,
      statusColor,
      customColor: acc.customColor,
      polygonExpansion: acc.polygonExpansion,
      bufferMeters,
      boundarySource,
      mergedWithQuadras: acc.mergedWithQuadras,
      streets,
    });
  }

  // Sort by territory number then quadra key
  return summaries.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Helper to format perimeter streets list into human readable Portuguese text.
 * Example: ["Rua A", "Rua B", "Rua C"] -> "Delimitada por Rua A, Rua B e Rua C"
 */
export function formatQuadraPerimeterDescription(streets: string[]): string {
  if (!streets || streets.length === 0) return 'Quarteirão sem ruas especificadas';
  if (streets.length === 1) return `Rua: ${streets[0]}`;
  if (streets.length === 2) return `Delimitada por ${streets[0]} e ${streets[1]}`;
  const allButLast = streets.slice(0, -1).join(', ');
  const last = streets[streets.length - 1];
  return `Delimitada por ${allButLast} e ${last} (${streets.length} vias)`;
}
