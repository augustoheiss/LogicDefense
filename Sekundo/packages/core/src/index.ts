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

// PDF
export type {
  PrintMode,
  PDFFormField,
  CoordinateMapping,
  TemplateCoordinateMap,
  PDFMapStorage,
} from './pdf/types';

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
