/**
 * Shared props for the territory map renderer.
 *
 * Web renders Leaflet directly into the React DOM (no iframe, no postMessage bridge):
 * the map instance persists across data updates, so the viewport is only moved when
 * the caller explicitly asks for it via `fitRequest`.
 */

export type LatLngTuple = [number, number];

export interface MapPin {
  key: string;
  label: string;
  worked: number;
  lat: number;
  lng: number;
  color: string;
  shape: string;
  territoryNumber: string;
  city: string;
  line?: string;
  line2?: string;
  postalcode?: string;
  propertyType: string;
  isForeign: boolean;
  language?: string;
  notes?: string;
  assignedAt?: string;
  completedAt?: string;
  daysSinceCompleted?: number | null;
}

export interface MapQuadra {
  key: string;
  label: string;
  statusColor: string;
  boundaryPolygon: LatLngTuple[];
  centroid: LatLngTuple;
  workedUnits: number;
  totalUnits: number;
  coveragePercent: number;
  perimeterStreets: string[];
}

export interface MapOutline {
  territoryNumber: string;
  polygon: LatLngTuple[];
  color: string;
  quadrasCount: number;
  workedUnits: number;
  totalUnits: number;
}

export interface MapEditSession {
  quadraKey: string;
  color: string;
  /** Starting ring; empty means "draw from scratch". */
  initial: LatLngTuple[];
  /** Unit positions shown as reference dots while editing. */
  units: LatLngTuple[];
  /** Unit positions currently falling outside the edited polygon (highlighted in red). */
  unitsOutside?: LatLngTuple[];
  /** Incremented when Undo or Reset programmatically replaces `initial`. */
  revision?: number;
}

export interface TerritoryLeafletMapProps {
  mode: 'quadras' | 'pins';
  pins: MapPin[];
  quadras: MapQuadra[];
  outlines: MapOutline[];
  /** Show perimeter street names as labels on quadra polygons. */
  showStreetLabels?: boolean;
  selectedKey?: string | null;
  /** Increment to re-frame the map on the current layers. The first data load frames automatically. */
  fitRequest: number;
  onSelectPin: (key: string) => void;
  onSelectQuadra: (key: string) => void;
  onToggleWork: (key: string) => void;
  onEditPin: (key: string) => void;
  onCustomizePin: (key: string) => void;
  /** When set, the map enters vertex-editing mode for one quadra boundary. */
  editSession?: MapEditSession | null;
  onPolygonDraft?: (ring: LatLngTuple[]) => void;
}
