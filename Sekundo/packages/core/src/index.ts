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
export { applyNodeUpdates, buildWorkedMeta, createSerialQueue } from './skeleton/registryOps';
export type { NodePatch } from './skeleton/registryOps';

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
  inspectPDFSecurityAndXfa,
  parseAcroBoolean,
  fillAcroForm,
  fillS89Assignments4Up,
  stampCoordinateMapOnPDF,
  fillAcroFormMailMerge,
} from './pdf/acroFormFiller';
export type { S89Assignment, FormFillResult } from './pdf/acroFormFiller';

export {
  normalizeWinAnsiTypography,
  needsUnicode,
  sanitizeForWinAnsiWithWarnings,
} from './pdf/unicodeFont';
export type { WinAnsiSanitizeResult } from './pdf/unicodeFont';

export { generateTerritoryS13AndCardsPDF, chunkCyclesBy4 } from './pdf/s13Generator';
export type { TerritoryPDFResult } from './pdf/s13Generator';

export * as templateMatcher from './pdf/templateMatcher';
export {
  computeTemplateFingerprint,
  computeTemplateFingerprintSha256,
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
  PBKDF2_ITERATIONS_V1,
  PBKDF2_ITERATIONS_V2,
} from './crypto/symmetric';

export {
  generateToken,
  decodeToken,
  buildShareURL,
  extractTokenFromURL,
  buildHorizonPayload,
} from './crypto/tokenGenerator';

export type {
  HorizonPayload,
  GenerateTokenOptions,
} from './crypto/tokenGenerator';

// Roster-Backed Zero-Trust Admission Gate & RBAC (`👑 Selo Admin`)
export {
  COLLAB_GOVERNANCE_POLICY,
  computePinVerifierHash,
  getActivePrivilegeKeys,
  hasActivePrivileges,
  hasAdminSealPrivilege,
  buildPermissionsForRole,
  canPerformSpreadsheetAction,
  verifyParticipantAdmission,
  revalidateSavedSessionPrincipal,
  lockSessionWithPin,
  unlockSessionWithPin,
} from './auth/privilegeAccessGuard';
export type {
  SpreadsheetAccessRole,
  SpreadsheetPermissionAction,
  AdmissionRejectionReason,
  CollaborativeGovernancePolicy,
  SpreadsheetPermissionsSummary,
  AuthenticatedSessionPrincipal,
  AdmissionVerificationInput,
  AdmissionVerificationResult,
} from './auth/privilegeAccessGuard';

// Tamper-Evident Append-Only Activity & Governance Audit Log
export {
  ACTIVITY_ACTION_LABELS,
  computeAuditHash,
  createActivityLogEntry,
  appendActivityLogEntry,
  compareActivityLogEntries,
  mergeActivityLogs,
  verifyActivityLogChain,
  exportActivityLogToCsv,
} from './audit/activityLogEngine';
export type {
  ActivityActionType,
  ActivityLogEntry,
  CreateActivityLogInput,
} from './audit/activityLogEngine';

// Zero-Knowledge Multi-Peer Collaborative Room Protocol (`1:N`)
export {
  COLLAB_PACKET_PREFIX,
  encodeEncryptedCollabPacket,
  decodeEncryptedCollabPacket,
  isPacketAuthorAuthorizedAdmin,
  applyIncomingCollabPacket,
} from './sync/collabRoomProtocol';
export type {
  CollabPacketKind,
  CollabPeerPresence,
  CollabPacketPayloadV2,
  CollabRoomStateReconcileResult,
} from './sync/collabRoomProtocol';

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
  DEFAULT_AUTO_BUFFER_METERS,
} from './geo/quadraPolygonEngine';
export type {
  QuadraAddressUnit,
  StreetAddressGroup,
  QuadraSummary,
  BoundarySource,
} from './geo/quadraPolygonEngine';
export {
  resolveTerritoryNumber,
  parseLatLng,
  bufferPolygonMeters,
  polygonAreaM2,
} from './geo/geoUtils';
export { pointInPolygon, isSelfIntersecting, roundRing, validateBoundary } from './geo/polygonOps';
export type { BoundaryValidation } from './geo/polygonOps';
export {
  resolveBestAddressQuery,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
} from './geo/googleMapsLinks';
export type {
  GoogleMapsTargetInput,
  GoogleMapsWaypointItem,
  ResolvedGoogleMapsQuery,
} from './geo/googleMapsLinks';
export {
  ROUTING_POLICY_CONFIG,
  computeHaversineMeters,
  computeBearingDegrees,
  bearingToCardinalPt,
  formatRouteDistance,
  formatRouteDuration,
  computeOfflineRoute,
  calculateMapRoute,
  calculateMultiStopMapRoute,
  buildWalkingSequenceRoute,
} from './geo/routingEngine';
export type {
  RouteStepSummary,
  MapRouteResult,
  RouteCalculationResult,
  WalkingSequenceRoute,
  RouteWaypointInput,
  WalkingSequenceUnitInput,
  WalkingSequenceStop,
} from './geo/routingEngine';

// Subtree Delegation (CBAC)
export * as tokenManager from './delegation/tokenManager';
export type {
  DelegationPermissions,
  SSDTokenPayload,
} from './delegation/tokenManager';

// Sovereign Local-First Operation Ledger, HLC & Encrypted Delta Envelope
export * as hlc from './sync/hlc';
export {
  createHLC,
  tickHLC,
  receiveHLC,
  packHLC,
  unpackHLC,
  compareHLC,
} from './sync/hlc';
export type { HLC } from './sync/hlc';

export * as operationLedger from './sync/operationLedger';
export {
  createLedgerOperation,
  compareLedgerOperations,
  applyOperationToRegistry,
  reconcileLedgers,
  previewReconcileLedgers,
  synthesizeOpsFromRegistry,
  exportLedgerDelta,
  createP2PSyncMessage,
} from './sync/operationLedger';
export type {
  LedgerOperation,
  ReconcileResult,
  ReconcilePreview,
  P2PSyncMessage,
} from './sync/operationLedger';

export * as deltaEnvelope from './sync/envelope';
export {
  encodeDeltaEnvelope,
  decodeDeltaEnvelope,
  isEncryptedDeltaEnvelope,
  ENCRYPTED_DELTA_PREFIX,
} from './sync/envelope';
export type { DeltaEnvelopeV2 } from './sync/envelope';

export {
  DOC_DELTA_PREFIX,
  createSetFieldValueOp,
  createPatchSdocOp,
  reconcileDocFieldOps,
  applyPatchSdocOps,
  encodeDocSyncEnvelope,
  decodeDocSyncEnvelope,
} from './sync/docOps';
export type {
  DocFieldOperation,
  DocSdocOperation,
  DocSyncOperation,
  DocFieldConflict,
} from './sync/docOps';

// Participant Directory & Fuzzy Person Resolution
export {
  normalizePersonKey,
  findParticipantProfile,
  enrichRegistryWithDirectory,
  listOperationalGroups,
} from './roster/participantDirectory';
export type { ParticipantProfile } from './roster/participantDirectory';

// Agnostic Schedule Ingestion, WhatsApp Export & Commitment Agonist Helpers
export {
  parseLocalizedDateToISO,
  splitPairedAssignees,
  parseProgramScheduleText,
} from './schedule/scheduleParser';
export type { ScheduleParseOptions } from './schedule/scheduleParser';

export {
  extractStructuredSessions,
  formatWeeklyScheduleWhatsApp,
  formatGroupFilterWhatsApp,
  formatIndividualCommitmentWhatsApp,
  formatLivePocketScheduleWhatsApp,
  formatTerritoryAssignmentWhatsApp,
  formatPartnerSyncWhatsAppMessage,
  buildWhatsAppUrl,
  generateCommitmentICS,
} from './schedule/whatsappFormatter';
export type {
  WhatsAppExportMode,
  StructuredSessionSection,
  StructuredProgramSession,
} from './schedule/whatsappFormatter';

export {
  PROGRAMACAO_UNIT_NAME,
  PROGRAMACAO_PARTICIPANT_DIRECTORY,
  RAW_PROGRAMACAO_2026_10_AND_11_TEXT,
  S13_TERRITORIOS_SEED_RECORDS,
  TERRITORY_CYCLE_LEDGER_SEED_RECORDS,
  sanitizeLegacySensitiveText,
  normalizePdfTemplateId,
  buildProgramacaoReuniaoRegistry,
  buildS13RegistryFromRecords,
  buildTerritoryCycleRegistryFromRecords,
  buildTerritoriosS13HistoricalRegistry,
  buildTerritoryMultiCycleHistoricalRegistry,
  parseSekundoScheduleBundle,
} from './schedule/programacaoReuniaoSeed';
export type {
  S13TerritorySeedRecord,
  TerritoryCycleSeedRecord,
  SekundoScheduleBundle,
} from './schedule/programacaoReuniaoSeed';

// Data YAML (Phase F1: Lossless Tree & Flat YAML <-> FlatRegistry)
export {
  buildYamlTreeFromRegistry,
  registryToYaml,
  yamlToRegistry,
} from './yaml/dataYaml';
export type {
  DataYamlExportOptions,
  YamlTreeNode,
} from './yaml/dataYaml';

// Document Engine SDOC (Phase F2: YAML <-> DisplayList <-> PDF)
export type {
  Mm,
  PageFormatId,
  PageOrientation,
  SdocPageConfig,
  SdocPageGeometry,
  InlineTextSpan,
  SdocPrimitive,
  SdocLayer,
  SdocRepeatGrid,
  SdocRepeatConfig,
  SdocUnderlayConfig,
  SdocField,
  SdocDocument,
  ResolvedOp,
  DisplayPage,
  DisplayList,
  WriterInput,
  OutputWriter,
} from './doc/types';

export {
  PT_PER_MM,
  PX_PER_MM,
  mmToPt,
  ptToMm,
  mmToPx,
  pxToMm,
  toPdf,
  fromPdf,
  PAGE_FORMATS,
  detectPageFormatFromMm,
  resolvePageDimensions,
} from './doc/units';
export type { PageFormatDimensions } from './doc/units';

export {
  resolveSafePath,
  renderTemplateString,
} from './doc/template';

export {
  parseFormRecordYaml,
  stringifyFormRecordYaml,
  formRecordToContexts,
  extractInitialFormRecord,
} from './doc/formRecord';
export type {
  FormFieldValue,
  FormRecordEntry,
  FormRecordDocument,
} from './doc/formRecord';

export {
  runDocumentPreflight,
} from './doc/preflight';
export type {
  PreflightSeverity,
  PreflightIssueCode,
  PreflightIssue,
  PreflightReport,
} from './doc/preflight';

export {
  buildS13PageContexts,
  evaluateRegistrySelector,
} from './doc/selector';
export type {
  S13VisualRowContext,
  S13PageContext,
} from './doc/selector';

export {
  parseSdocYaml,
  stringifySdocYaml,
  SdocCstMutator,
  ProvenanceBus,
  sdocProvenanceBus,
  autoGenerateSdocFromRegistry,
} from './doc/schema';
export type {
  SdocValidationIssue,
  SdocParseResult,
  SdocTransactionOrigin,
  SdocTransaction,
} from './doc/schema';

export {
  MAX_SDOC_PAGES,
  MAX_SDOC_PRIMITIVES,
  SdocLimitError,
  measureTextWidthMm,
  breakTextIntoLines,
  solveLayout,
} from './doc/layoutSolver';

export {
  UnderlayError,
  toWinAnsiSafe,
  parseHexColorToRgb,
  renderDisplayListToPdf,
} from './doc/painters/pdfPainter';
export type { PdfPainterOptions } from './doc/painters/pdfPainter';

export {
  S89_4UP_SDOC_YAML,
  S13S_MULTICYCLE_SDOC_YAML,
  FICHAS_4UP_SDOC_YAML,
  TERRITORIOS_MULTICYCLE_SDOC_YAML,
  BUILTIN_SDOC_TEMPLATES,
  compileSdocToPdf,
} from './doc/templates/builtinTemplates';

// PDF Ingestion Stages (Phase F4: Pure Functions)
export {
  extractAcroFormStage,
  extractTextStage,
  extractVectorStage,
  detectGridStage,
  synthesizeIngestedSdoc,
} from './doc/ingest/stages';
export type {
  RawPdfTextItem,
  RawPdfVectorOp,
  IngestReport,
} from './doc/ingest/stages';

// Unified Output Writers & App Composer (Phase F5)
export {
  renderWhatsAppTemplate,
  pdfOutputWriter,
  whatsappOutputWriter,
  csvOutputWriter,
  yamlOutputWriter,
  OUTPUT_WRITERS,
  writeUnifiedOutput,
} from './outputs/registry';

export {
  DEFAULT_SEKUNDO_APP_YAML,
  parseAppManifestYaml,
  stringifyAppManifestYaml,
  computeHojeCockpitSummary,
} from './composer/appManifest';
export type {
  ComposerOutputSpec,
  ComposerPrancheta,
  ComposerRitual,
  HojeWidgetId,
  SekundoAppManifest,
  HojeCockpitSummary,
} from './composer/appManifest';

// Dynamic Map Symbology Engine
export {
  DEFAULT_MAP_SYMBOLOGY_CONFIG,
  SYMBOLOGY_DIMENSION_OPTIONS,
  SYMBOLOGY_PALETTE,
  SYMBOLOGY_SHAPES,
  SYMBOLOGY_SHAPE_META,
  hashCategoryKey,
  extractSymbologyCategory,
  resolvePinSymbology,
  buildSymbologyLegend,
} from './territory/mapSymbologyEngine';
export type {
  SymbologyDimension,
  SymbologyShape,
  SymbologyVisualChannel,
  MapSymbologyConfig,
  SymbologyLegendItem,
  ResolvedPinSymbology,
} from './territory/mapSymbologyEngine';

// Clean-Room Privilege Matrix & Fair-Rotation Auto-Assignment Engine
export {
  CAPABILITY_COLUMNS,
  ALL_CAPABILITY_KEYS,
  ROLE_TIER_LABELS,
  PROFILE_CATEGORY_LABELS,
  STATUS_FLAG_LABELS,
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  createEmptyCapabilitiesMap,
  buildPresetCapabilities,
  deriveSummaryTagsFromCapabilities,
  resolveCapabilityKeyOrCustom,
  getEffectiveCapabilityColumns,
  discoverDynamicCapabilityColumns,
  discoverDynamicPrivilegeCatalog,
  ensureParticipantPrivilegeMatrix,
  filterParticipantsByMatrixCriteria,
  inferSlotRequiredCapability,
  autoAssignScheduleRegistry,
} from './roster/privilegeRotationEngine';
export type {
  CapabilityDomainId,
  CapabilityKey,
  CapabilityColumnMeta,
  PrivilegeMatrixFilterCriteria,
  InferredSlotRequirement,
  AutoAssignOptions,
  AutoAssignSummary,
} from './roster/privilegeRotationEngine';
export type {
  ParticipantCategory,
  ParticipantRoleTier,
  ParticipantStatusFlag,
} from './roster/participantDirectory';

// Unified Master CSV ("CSV Geral" / Multi-Planilha Omni-Bundle CSV)
export {
  OMNI_CSV_HEADERS,
  OMNI_SHEET_TITLES,
  DEFAULT_COIN_LEDGER_ROWS,
  neutralizeCsvFormula,
  resolveSheetNameToRecordKind,
  getSheetsForEngineId,
  isOmniCsvText,
  parseRawOmniCsvTable,
  parseParticipantPrivilegesFromCsvRow,
  exportOmniCsvBundle,
  exportSingleEngineSampleCsv,
  importOmniCsvBundle,
  groupCoinLedgerRowsByTable,
  buildCombinedMultiEngineSkeleton,
  selectEnginePartitionNodes,
  deriveActiveEnginesFromOmniBundle,
  exportScheduleHubToCsv,
  importScheduleHubFromCsv,
  generateOmniMasterSampleCsv,
} from './csv/omniCsvBundle';
export type {
  OmniRecordKind,
  OmniCsvHeader,
  OmniEventBundleItem,
  OmniStudioDocItem,
  OmniHojeRitualItem,
  OmniCoinLedgerRowItem,
  OmniCoinTablePartition,
  SekundoOmniStateBundle,
  ExportOmniCsvOptions,
} from './csv/omniCsvBundle';
