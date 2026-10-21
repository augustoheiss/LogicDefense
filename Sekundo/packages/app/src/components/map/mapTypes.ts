/**
 * Shared props for the territory map renderer.
 *
 * Web renders Leaflet directly into the React DOM (no iframe, no postMessage bridge):
 * the map instance persists across data updates, so the viewport is only moved when
 * the caller explicitly asks for it via `fitRequest` or `panToUserRequest`.
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
  /** Optional 1-based walking order badge for field direction inspection. */
  walkOrder?: number;
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
  city?: string;
  locality?: string;
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

export interface MapUserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  isManual?: boolean;
}

export interface MapWalkingStop {
  key: string;
  lat: number;
  lng: number;
  order: number;
  label: string;
  worked: number;
}

export interface MapActiveRoute {
  coordinates: LatLngTuple[];
  distanceMeters: number;
  durationSeconds: number;
  cardinalDirection?: string;
  source: 'osrm' | 'offline_haversine';
  profile?: 'foot' | 'driving';
  label?: string;
  origin?: LatLngTuple;
  stops?: MapWalkingStop[];
}

export interface TerritoryLeafletMapProps {
  mode: 'quadras' | 'pins';
  pins: MapPin[];
  quadras: MapQuadra[];
  outlines: MapOutline[];
  /** Show perimeter street names as labels on quadra polygons. */
  showStreetLabels?: boolean;
  /** When true, clicking a quadra also opens an interactive popup with Google Maps & Route actions. */
  showQuadraPopup?: boolean;
  selectedKey?: string | null;
  /** Increment to re-frame the map on the current layers. The first data load frames automatically. */
  fitRequest: number;
  onSelectPin: (key: string) => void;
  onSelectQuadra: (key: string) => void;
  onToggleWork: (key: string) => void;
  onEditPin: (key: string) => void;
  onCustomizePin: (key: string) => void;
  /** Live operator GPS coordinates rendered on a dedicated non-disruptive layer. */
  userLocation?: MapUserLocation | null;
  /** Increment to pan/zoom camera to `userLocation`. */
  panToUserRequest?: number;
  /** Active street/offline route drawn over the map. */
  activeRoute?: MapActiveRoute | null;
  /** Optional ordered walking sequence path (`1 -> 2 -> 3...`) across addresses. */
  walkingSequence?: MapWalkingStop[] | null;
  /** Optional custom handler to open a pin in Google Maps; defaults to universal `maps/dir/?api=1`. */
  onOpenGoogleMapsPin?: (key: string) => void;
  /** Optional handler to trace an in-map route to a pin. */
  onRouteToPinInMap?: (key: string) => void;
  /** Optional handler to add/toggle a pin in the multi-address route queue. */
  onAddPinToRoute?: (key: string) => void;
  /** Keys of pins currently queued in the multi-stop route. */
  routeStopKeys?: string[];
  /** When true, clicking on the map sets the operator's starting origin coordinates. */
  pickingOriginMode?: boolean;
  /** Callback fired when operator clicks the map while `pickingOriginMode` is active. */
  onPickOriginOnMap?: (lat: number, lng: number) => void;
  /** Optional handler to open a quadra in Google Maps. */
  onOpenGoogleMapsQuadra?: (key: string) => void;
  /** Optional handler to trace an in-map route to a quadra. */
  onRouteToQuadraInMap?: (key: string) => void;
  /** Optional handler to trace a multi-stop street route across all pending addresses in a quadra. */
  onRouteToQuadraAddressesInMap?: (key: string) => void;
  /** When set, the map enters vertex-editing mode for one quadra boundary. */
  editSession?: MapEditSession | null;
  onPolygonDraft?: (ring: LatLngTuple[]) => void;
}
