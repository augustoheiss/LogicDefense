/**
 * Sekundo — Core Package Public API
 *
 * Barrel export for all core modules.
 * Import from '@sekundo/core' to access any functionality.
 */

// Skeleton
export * as pathKey from './skeleton/pathKey';
export * as skeletonTree from './skeleton/skeletonTree';
export type {
  PathKey,
  ParsedKey,
  NodeType,
  SkeletonNode,
  FlatSkeletonEntry,
  FlatRegistry,
} from './skeleton/types';

// Events
export * as eventContainer from './events/eventContainer';
export * as rollover from './events/rollover';
export type {
  Frequency,
  EventConfig,
  EventState,
  EventLifecycle,
  RolloverSnapshot,
} from './events/types';
export { getActiveEngines } from './events/types';
export { createEvent, createEventState } from './events/eventContainer';

// Engines (Universal Laws)
export * from './engines';

// CSV
export type {
  CSVRow,
  RowValidationResult,
  CSVValidationResult,
  DiffAction,
  DiffEntry,
  CSVDiffResult,
} from './csv/types';

export { parseCSV } from './csv/parser';
export { serializeCSV } from './csv/serializer';
export { validateCSV, buildDiff } from './csv/validator';
export { upsertRegistry, rowToFlatEntry } from './csv/upsert';
export type {
  UpsertOptions,
  UpsertResult,
  UpsertDetailEntry,
} from './csv/upsert';

// Canonical Engine CSV Templates
export {
  ENGINE_TEMPLATES,
  getEngineTemplate,
  listEngineTemplates,
  exportTemplateCSV,
} from './csv/engineTemplates';
export type { EngineCSVTemplate } from './csv/engineTemplates';

// Engine Auto-Detection
export { detectEnginesFromCSV } from './csv/engineDetection';
export type {
  DetectedEngineMatch,
  EngineDetectionReport,
} from './csv/engineDetection';

// Granular CSV Export (By Parts / Slices)
export {
  filterGranularEntries,
  exportGranularCSV,
} from './csv/granularExport';
export type {
  GranularScope,
  GranularExportOptions,
} from './csv/granularExport';

// Granular CSV Import (LEGO & Quarantine Staging)
export {
  parseCSVWithQuarantine,
  importGranularCSV,
} from './csv/granularImport';
export type {
  QuarantinedRow,
  GranularImportMode,
  GranularImportOptions,
  GranularImportResult,
} from './csv/granularImport';

// PDF
export type {
  PrintMode,
  PDFFormField,
  CoordinateMapping,
  TemplateCoordinateMap,
  PDFMapStorage,
} from './pdf/types';

export {
  inspectPDFForm,
  fillAcroForm,
  fillS89Assignments4Up,
} from './pdf/acroFormFiller';
export type { S89Assignment, FormFillResult } from './pdf/acroFormFiller';

export * as templateMatcher from './pdf/templateMatcher';
export {
  computeTemplateFingerprint,
  normalizeFieldName,
  levenshteinDistance,
  stringSimilarity,
  classifyFieldSemantics,
  semanticKeyToAttribute,
  autoRecognizePDFFields,
} from './pdf/templateMatcher';
export type {
  FieldMappingCandidate,
  TemplateRecognitionResult,
} from './pdf/templateMatcher';

// Roster Optimization & Bitmask Scheduling
export * as bitmaskSchedule from './roster/bitmaskSchedule';
export * from './roster/bitmaskSchedule';
export * as swapLedger from './roster/swapLedger';
export * from './roster/swapLedger';
export type {
  ShiftType,
} from './roster/bitmaskSchedule';
export type {
  SkillLevel,
  VolunteerProfile,
  ShiftSlotDescriptor,
  SwapState,
  SwapTransaction,
  RankedStandbyCandidate,
  SwapDryRunResult,
} from './roster/swapLedger';

// Crypto
export {
  encrypt,
  decrypt,
  compress,
  decompress,
  encryptForURL,
  decryptFromURL,
  toBase64URL,
  fromBase64URL,
} from './crypto/symmetric';

export {
  generateToken,
  decodeToken,
  buildShareURL,
  extractTokenFromURL,
  buildHorizonPayload,
} from './crypto/tokenGenerator';

export type { HorizonPayload } from './crypto/tokenGenerator';

// Chat
export type {
  PeerConnectionState,
  PeerInfo,
  ChatMessage,
  SignalPayload,
  SignalingToken,
} from './chat/types';

// Geo Spatial
export * as geoJsonAdapter from './geo/geoJsonAdapter';
export type {
  GeoJSONGeometry,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
} from './geo/geoJsonAdapter';

export * as quadraPolygonEngine from './geo/quadraPolygonEngine';
export {
  calculateQuadraColor,
  computeConvexHull,
  expandPolygon,
  parseAddressLine,
  extractQuadrasFromRegistry,
  formatQuadraPerimeterDescription,
  computeMergedTerritoryPolygon,
} from './geo/quadraPolygonEngine';
export type {
  QuadraAddressUnit,
  StreetAddressGroup,
  QuadraSummary,
} from './geo/quadraPolygonEngine';

// Subtree Delegation (CBAC)
export * as tokenManager from './delegation/tokenManager';
export type {
  DelegationPermissions,
  SSDTokenPayload,
} from './delegation/tokenManager';

// Sovereign Local-First Operation Ledger & P2P Sync
export * as operationLedger from './sync/operationLedger';
export {
  createLedgerOperation,
  applyOperationToRegistry,
  reconcileLedgers,
  exportLedgerDelta,
  createP2PSyncMessage,
} from './sync/operationLedger';
export type {
  LedgerOperation,
  ReconcileResult,
  P2PSyncMessage,
} from './sync/operationLedger';
