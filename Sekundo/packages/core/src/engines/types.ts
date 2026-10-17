/**
 * Sekundo — Universal Engine Type Definitions
 *
 * An Engine defines the "Universal Law" for an Event container:
 * - Allowed node types & semantics
 * - Depth rules and domain validations
 * - Metric calculations (rollups, coverage, synthesis aggregation)
 * - Specialized export/import capabilities
 */

import type { SkeletonNode, NodeType } from '../skeleton/types';

import type { TransformerMetrics } from './transformerTypes';
export * from './transformerTypes';

// ---------------------------------------------------------------------------
// Engine Identifiers
// ---------------------------------------------------------------------------

export type EngineId =
  | 'territory_logistics'  // Physical territory management, 0/1 coverage, maps
  | 'roster_assignments'   // Roles, speakers, chairmen, time slots, confirmation
  | 'study_synthesis'      // Group research, member syntheses, executive summary
  | 'generic_wbs'          // Freeform hierarchical work breakdown structure
  | 'incident_command'     // FEMA ICS/NIMS, Graicunas span of control
  | 'live_production_ros'  // Live Run-of-Show, second-accurate drift
  | 'tournament_pairings'  // Swiss & Elimination Blossom pairings
  | 'canvassing_logistics' // Advanced 8-code field canvassing & eLOT routing
  | 'financial_ledger'     // Assistente Moeda: Sovereign Financial, Sectoral & Patrimonial Engine
  | 'transformer';         // Metamorphic engine: custom CSV columns & on-demand math laws

// ---------------------------------------------------------------------------
// 1. Territory Logistics Domain Types
// ---------------------------------------------------------------------------

export interface TerritoryAssignmentCycle {
  assignedTo: string;           // Name of volunteer / person assigned in this cycle
  assignedAt: string;           // Date assigned (DD/MM/YYYY or YYYY-MM-DD)
  completedAt?: string;         // Date completed (DD/MM/YYYY or YYYY-MM-DD, empty if in progress)
  serviceYear?: number;         // Service year bucket (e.g. 2027, 2026)
}

export interface TerritoryNodeMeta {
  worked?: 0 | 1;               // 0 = pending, 1 = completed
  lastWorkedAt?: string;        // ISO 8601 timestamp
  assignedAt?: string;          // ISO 8601 or YYYY-MM-DD assignment date
  completedAt?: string;         // ISO 8601 or YYYY-MM-DD completion date
  workerName?: string;          // Name of member who worked this node
  address?: string;             // Street and number or place descriptor
  line?: string;                // Street and number
  line2?: string;               // Neighborhood / Complement
  city?: string;                // City
  state?: string;               // State / UF
  postalcode?: string;          // Postal code / CEP
  propertyType?: string;        // 'residencial' | 'comercial' | 'predio' | 'outro'
  isForeign?: boolean;          // Foreign resident flag
  language?: string;            // Spoken language
  lat?: number;                 // Latitude
  lng?: number;                 // Longitude
  boundaryPolygon?: [number, number][]; // Geo coordinates for block/polygon
  notes?: string;               // Local tactical notes
  tags?: string[];              // e.g. ["foreign_language", "commercial", "hard_access"]
  territoryNumber?: string;     // Canonical territory identifier (e.g. "T01.01.01")
  territory_number?: string;    // Snake-case alias for territory identifier
  locality?: string;            // Neighborhood / sector name (e.g. "Setor Central", "Setor Norte")
  lastCompletedBeforeYear?: string; // "Última data concluída*" before starting the sheet
  serviceYear?: number;         // Primary operational year
  assignmentHistory?: TerritoryAssignmentCycle[]; // Multi-cycle assignment ledger (4-column model)
}

export type TerritoryRecencySort = 'priority_oldest_first' | 'recent_first' | 'hierarchical';

export interface TerritoryRecencyItem {
  territoryNumber: string;
  label: string;
  locality?: string;
  totalUnits: number;
  workedUnits: number;
  percent: number;
  isCompleted: boolean;
  assignedAt?: string;
  completedAt?: string;
  daysSinceCompleted: number | null; // null if not fully completed
  daysSinceAssigned?: number | null; // days since assignedAt
  isOverdue?: boolean; // true if incomplete and assigned >= 120 days ago (4-month operational cycle)
}

export interface TerritoryMetrics {
  totalUnits: number;           // Total addressable leaf points
  workedUnits: number;          // Total units marked with worked = 1
  coveragePercent: number;      // 0 to 100
  isFullyWorked: boolean;
  quadrasCount: number;         // Count of intermediate blocks
  streetsCount: number;         // Count of streets
}

// ---------------------------------------------------------------------------
// 2. Roster Assignments Domain Types
// ---------------------------------------------------------------------------

export type ReadinessState = 'pending' | 'preparing' | 'ready';

export interface RosterNodeMeta {
  assignedTo?: string;          // Name of primary person assigned
  assistantTo?: string;         // Assistant / reader / partner
  room?: string;                // Hall, classroom, booth, room name
  durationMinutes?: number;     // Allocated minutes
  confirmed?: boolean;          // Whether the assignee confirmed attendance
  substitute?: string;          // Standby replacement if unavailable
  materialReference?: string;   // Topic title, reference code, document reference
  readinessState?: ReadinessState; // 3-step commitment readiness ('pending' -> 'preparing' -> 'ready')
  groupTag?: string;            // Operational team/group of primary assignee (e.g. "Grupo 1")
  assistantGroupTag?: string;   // Operational team/group of assistant (e.g. "Grupo 2")
  capabilityTags?: string[];    // Generic qualification/role tags of primary assignee
  accentColor?: string;         // Data-driven section banner hex color (e.g. "#3D5B65", "#9A7420", "#80241E")
  partNumber?: number;          // Sequential part number within session
  sessionDate?: string;         // ISO date YYYY-MM-DD or localized date label
  sessionTheme?: string;        // Session theme / reference (e.g. "MÓDULO 40, 41")
  unitName?: string;            // Organization / unit header (e.g. "Unidade Operacional Central")
  chairPerson?: string;         // Session chairperson / moderator
  openingCue?: string;          // Opening cue / theme
  openingAssignee?: string;     // Opening / accreditation assignee
  openingPrayer?: string;       // Legacy alias for openingAssignee
  middleCue?: string;           // Intermission / transition cue
  closingCue?: string;          // Closing cue / theme
  closingAssignee?: string;     // Closing / synthesis assignee
  closingPrayer?: string;       // Legacy alias for closingAssignee
}

export interface RosterMetrics {
  totalSlots: number;
  assignedSlots: number;
  confirmedSlots: number;
  unassignedSlots: number;
  fulfillmentPercent: number;
}

// ---------------------------------------------------------------------------
// 3. Study & Synthesis Domain Types
// ---------------------------------------------------------------------------

export type ResearchStatus = 'pending' | 'in_progress' | 'submitted' | 'reviewed';

export interface StudySynthesisNodeMeta {
  researcherName?: string;      // Member conducting the investigation
  status?: ResearchStatus;      // Research lifecycle
  synthesisText?: string;       // Synthesized summary written by the member
  keyFindings?: string[];       // Bullet points / highlights
  references?: string[];        // Citations, books, scriptures, URLs
  organizerNotes?: string;      // Feedback or directive from event organizer
}

export interface StudyMetrics {
  totalTopics: number;
  submittedCount: number;
  pendingCount: number;
  completionPercent: number;
  executiveSummary: string;     // Consolidated markdown generated from all child syntheses
}

// ---------------------------------------------------------------------------
// 4. Incident Command System (ICS) Domain Types
// ---------------------------------------------------------------------------

export type ICSRoleType =
  | 'INCIDENT_COMMANDER'
  | 'SAFETY_OFFICER'
  | 'LIAISON_OFFICER'
  | 'PUBLIC_INFO_OFFICER'
  | 'OPERATIONS'
  | 'PLANNING'
  | 'LOGISTICS'
  | 'FINANCE'
  | 'BRANCH'
  | 'DIVISION'
  | 'STRIKE_TEAM'
  | 'TASK_FORCE';

export interface ICSNodeMeta {
  icsRole?: ICSRoleType;
  supervisorName?: string;
  operationalPeriod?: string;
  allocatedPersonnel?: number;
  radioChannel?: string;
  smartObjectives?: string[];
}

export interface ICSMetrics {
  totalUnits: number;
  totalPersonnel: number;
  spanOfControlBreaches: number; // Nodes exceeding Graicunas threshold (n > 7)
  maxGraicunasRelationships: number;
  isSpanHealthy: boolean;
}

// ---------------------------------------------------------------------------
// 5. Live Production Run-of-Show Domain Types
// ---------------------------------------------------------------------------

export type TimingConstraint = 'SOFT_START' | 'HARD_START' | 'HARD_OUT';

export type TalentStatus =
  | 'NOT_ARRIVED'
  | 'ARRIVED_ON_SITE'
  | 'GREEN_ROOM_CALL'
  | 'MIC_CHECK'
  | 'STANDBY_WINGS'
  | 'ON_STAGE'
  | 'OFF_STAGE';

export interface RunOfShowNodeMeta {
  plannedDurationSec: number;
  actualDurationSec?: number;
  timingConstraint?: TimingConstraint;
  talentName?: string;
  talentStatus?: TalentStatus;
  audioCue?: string;
  videoCue?: string;
  lightingCue?: string;
  isPadBuffer?: boolean; // Can be cut if show is running late
}

export interface RunOfShowMetrics {
  totalPlannedSeconds: number;
  totalActualSeconds: number;
  cumulativeDriftSec: number; // Over (+) or Under (-) in seconds
  hardOutThreatened: boolean;
  cutListSuggestedKeys: string[];
}

// ---------------------------------------------------------------------------
// 6. Tournament Systems Domain Types
// ---------------------------------------------------------------------------

export interface TournamentNodeMeta {
  roundIndex?: number;
  boardNumber?: number;
  contestantA?: string;
  contestantB?: string;
  scoreA?: number;
  scoreB?: number;
  winner?: string;
  isBye?: boolean;
}

export interface TournamentMetrics {
  totalRounds: number;
  currentRound: number;
  activeContestants: number;
  completedMatches: number;
  rematchesDetected: number;
}

// ---------------------------------------------------------------------------
// 7. Advanced Canvassing Logistics Domain Types
// ---------------------------------------------------------------------------

export type CanvassContactCode =
  | 'CNT' // Contacted
  | 'NH'  // Not Home
  | 'REF' // Refused
  | 'DNC' // Do Not Call
  | 'LAN' // Foreign Language
  | 'VAC' // Vacant
  | 'INA' // Inaccessible / Gate
  | 'HOS';// Hostile

export interface CanvassingNodeMeta {
  contactCode?: CanvassContactCode;
  eLotOrder?: number;
  foreignLanguage?: string;
  lastVisitedAt?: string;
  canvasserName?: string;
}

export interface CanvassingMetrics {
  totalDoors: number;
  contactedCount: number;
  notHomeCount: number;
  refusedCount: number;
  dncCount: number;
  languageCount: number;
  contactRatePercent: number;
}

// ---------------------------------------------------------------------------
// 8. Assistente Moeda (Financial Ledger & Sectoral Engine) Domain Types
// ---------------------------------------------------------------------------

export type FinancialEntryType =
  | 'revenue'
  | 'expense'
  | 'deposit'
  | 'waiver'
  | 'partner_in'
  | 'partner_out'
  | 'unresolved';

export interface FinancialLedgerNodeMeta {
  date?: string;              // YYYY-MM-DD
  amountBRL?: number;         // Monetary value in BRL
  entryType?: FinancialEntryType;
  category?: string;
  tags?: string;
  periodStart?: string;
  periodEnd?: string;
  monthlyValue?: number;
  monthCount?: number;
  ticker?: string;
  quantity?: number;
  unitPrice?: number;
  tableId?: string;
  tableName?: string;
}

export interface FinancialLedgerMetrics {
  transactionCount: number;
  grossTotal: number;
  totalExpenses: number;
  totalInvested: number;
  totalWaiverCredit: number;
  totalPartnerIn: number;
  totalPartnerOut: number;
  netBalance: number;
  survivalDaily: number;
  survivalWeekly: number;
  survivalMonthly: number;
  unresolvedCount: number;
}

// ---------------------------------------------------------------------------
// Generic Union Metrics
// ---------------------------------------------------------------------------

export type EngineMetrics =
  | { engineId: 'territory_logistics'; data: TerritoryMetrics }
  | { engineId: 'roster_assignments'; data: RosterMetrics }
  | { engineId: 'study_synthesis'; data: StudyMetrics }
  | { engineId: 'generic_wbs'; data: { totalNodes: number; leafCount: number } }
  | { engineId: 'incident_command'; data: ICSMetrics }
  | { engineId: 'live_production_ros'; data: RunOfShowMetrics }
  | { engineId: 'tournament_pairings'; data: TournamentMetrics }
  | { engineId: 'canvassing_logistics'; data: CanvassingMetrics }
  | { engineId: 'financial_ledger'; data: FinancialLedgerMetrics }
  | { engineId: 'transformer'; data: TransformerMetrics };

// ---------------------------------------------------------------------------
// Engine Contract Interface
// ---------------------------------------------------------------------------

export interface EventEngine {
  /** Unique engine identifier */
  id: EngineId;

  /** Human-readable name */
  name: string;

  /** Comprehensive explanation of what this law governs */
  description: string;

  /** Suggested UI icon identifier */
  icon: string;

  /** Supported node types for this engine */
  allowedNodeTypes: NodeType[];

  /** Default node type given depth level (1-based) */
  defaultNodeTypeForDepth: (depth: number) => NodeType;

  /** Validates a node's data against the engine's laws */
  validateNode: (node: SkeletonNode) => { valid: boolean; errors: string[] };

  /** Calculates domain metrics and rollups across the skeleton tree */
  calculateMetrics: (tree: SkeletonNode[], contextConfig?: unknown) => EngineMetrics;

  /** Supported export formats for this engine */
  supportedExports: ('csv' | 'xlsx' | 'pdf' | 'yaml' | 'geojson')[];
}
