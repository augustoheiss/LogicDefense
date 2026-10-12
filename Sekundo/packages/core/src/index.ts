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

// Subtree Delegation (CBAC)
export * as tokenManager from './delegation/tokenManager';
export type {
  DelegationPermissions,
  SSDTokenPayload,
} from './delegation/tokenManager';
