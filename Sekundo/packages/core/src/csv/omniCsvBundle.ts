/**
 * Sekundo — Unified Master CSV ("CSV Geral" / Omni-Bundle CSV) Engine
 *
 * Implements lossless bidirectional Round-Trip (`Export ⇄ Import`) in a single
 * RFC-4180 CSV spreadsheet across ALL Sekundo subsystems:
 * 1. `event_node`            — Events across all 9 Universal Engines
 * 2. `hub_schedule_slot`     — 📅 Programação & WhatsApp (Semanas, Blocos, Designações, Grupos 1–3)
 * 3. `hub_territory_cycle`   — 🗺️ Registro de Territórios Multi-Ciclo
 * 4. `participant_privilege` — 🛡️ Diretório de Usuários + Matriz de 26 Privilégios + Rotação
 * 5. `studio_document`       — 🖋️ Estúdio Documental YAML ⇄ PDF (Canvas mm, Fichas 4-Up)
 * 6. `cockpit_hoje`          — ☀️ Cockpit Hoje & Compositor (Rituais governados, sekundo.app.yaml)
 *
 * Also supports dedicated CSV Import/Export for `📅 Programação & WhatsApp` (`schedule-hub.tsx`)
 * so users can import `.csv` schedules, auto-assign or edit in the app, and immediately
 * download the updated `.csv` backup without manual spreadsheet editing.
 *
 * Skills: agency-software-architect, agency-clean-room-data-hygiene-engineer
 */

import type { FlatSkeletonEntry, NodeType } from '../skeleton/types';
import {
  type ParticipantProfile,
  normalizePersonKey,
} from '../roster/participantDirectory';
import {
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  createEmptyCapabilitiesMap,
  ensureParticipantPrivilegeMatrix,
  getEffectiveCapabilityColumns,
  resolveCapabilityKeyOrCustom,
} from '../roster/privilegeRotationEngine';
import {
  PROGRAMACAO_UNIT_NAME,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
} from '../schedule/programacaoReuniaoSeed';
import {
  FICHAS_4UP_SDOC_YAML,
  TERRITORIOS_MULTICYCLE_SDOC_YAML,
} from '../doc/templates/builtinTemplates';
import { DEFAULT_SEKUNDO_APP_YAML } from '../composer/appManifest';
import { ENGINE_TEMPLATES } from './engineTemplates';

export type OmniRecordKind =
  | 'event_node'
  | 'hub_schedule_slot'
  | 'hub_territory_cycle'
  | 'participant_privilege'
  | 'studio_document'
  | 'cockpit_hoje'
  | 'coin_ledger_row';

export const OMNI_CSV_HEADERS = [
  '_container_id',
  '_key',
  '_type',
  '_engines',
  'group_or_tier',
  'date_or_cycle',
  'time_or_duration',
  'title_or_name',
  'primary_assignee',
  'secondary_assignee',
  'status_or_readiness',
  'capabilities_or_tags',
  'contact_or_location',
  'notes_or_payload',
  '_meta_json',
] as const;

export type OmniCsvHeader = (typeof OMNI_CSV_HEADERS)[number];

export const OMNI_SHEET_TITLES: Record<OmniRecordKind, string> = {
  participant_privilege: 'Matriz de Privilegios & Usuarios (roster_assignments)',
  hub_schedule_slot: 'Programacao & WhatsApp (roster_assignments)',
  hub_territory_cycle: 'Territorios Multi-Ciclo (territory_logistics)',
  coin_ledger_row: 'Assistente Moeda — Engine Financeira (financial_ledger)',
  studio_document: 'Estudio Documental YAML & PDF (DocumentEngine)',
  cockpit_hoje: 'Cockpit Hoje & Rituais (action_tracker)',
  event_node: 'Eventos Multi-Engine (multi_engine)',
};

export interface OmniEventBundleItem {
  id: string;
  name: string;
  engines: string[];
  registry: FlatSkeletonEntry[];
}

export interface OmniStudioDocItem {
  id: string;
  title: string;
  format: string;
  sdocYaml: string;
}

export interface OmniHojeRitualItem {
  id: string;
  title: string;
  frequency: string;
  status: string;
  notes?: string;
}

export type CoinLedgerEntryType =
  | 'income'
  | 'expense'
  | 'investment'
  | 'revenue'
  | 'deposit'
  | 'waiver'
  | 'partner_in'
  | 'partner_out'
  | 'unresolved';

export interface OmniCoinLedgerRowItem {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  entryType: CoinLedgerEntryType;
  paymentMethod?: string;
  status?: 'paid' | 'pending' | 'scheduled';
  recurrence?: string;
  tableId?: string;
  tableName?: string;
  monthlyValue?: number;
  monthCount?: number;
  periodStart?: string;
  periodEnd?: string;
  period_start?: string;
  period_end?: string;
  tags?: string | string[];
  ticker?: string;
  quantity?: number;
  unitPrice?: number;
  metadataJson?: string;
  metadata_json?: string;
  customValues?: Record<string, string | number | boolean>;
  tableEnvelope?: Record<string, any>;
  /**
   * Quando `true`, indica que esta linha no CSV representa apenas o cabeçalho/envelope
   * de uma `CoinTable` sem lançamentos (`rows.length === 0`), não devendo gerar um `TableRow`.
   */
  isTableHeaderOnly?: boolean;
}

/**
 * Representa uma planilha financeira individual reconstruída a partir da seção
 * `#PLANILHA,coin_ledger_row` de um pacote Omni-CSV.
 */
export interface OmniCoinTablePartition {
  /** Identificador único da planilha financeira (`_container_id` / `CoinTable.id`) */
  tableId: string;
  /** Nome amigável da planilha financeira (`CoinTable.name`) */
  tableName: string;
  /** Envelope de metadados exclusivos desta planilha (metas, perfil investidor, schema, setores) */
  tableEnvelope?: Record<string, any>;
  /** Lançamentos pertencentes exclusivamente a esta planilha (excluindo linhas-sentinela de cabeçalho vazio) */
  rows: OmniCoinLedgerRowItem[];
}

/**
 * Demultiplexa uma lista plana de `OmniCoinLedgerRowItem` em partições isoladas por `tableId`.
 * Garante que múltiplas planilhas financeiras exportadas no mesmo CSV nunca tenham seus valores misturados.
 */
export function groupCoinLedgerRowsByTable(
  coinRows: OmniCoinLedgerRowItem[]
): OmniCoinTablePartition[] {
  if (!Array.isArray(coinRows) || coinRows.length === 0) return [];

  const partitionsMap = new Map<
    string,
    {
      tableId: string;
      explicitName?: string;
      envelope?: Record<string, any>;
      rows: OmniCoinLedgerRowItem[];
    }
  >();

  for (const row of coinRows) {
    if (!row || typeof row !== 'object') continue;
    const rawTableId = (row.tableId || row.tableEnvelope?.tableId || 'coin-default').trim();
    const tableId = rawTableId || 'coin-default';

    let partition = partitionsMap.get(tableId);
    if (!partition) {
      partition = {
        tableId,
        explicitName: undefined,
        envelope: undefined,
        rows: [],
      };
      partitionsMap.set(tableId, partition);
    }

    if (row.tableEnvelope && typeof row.tableEnvelope === 'object' && !partition.envelope) {
      partition.envelope = row.tableEnvelope;
    }

    const candidateName = (
      row.tableName ||
      (row.tableEnvelope && typeof row.tableEnvelope.tableName === 'string'
        ? row.tableEnvelope.tableName
        : '')
    ).trim();

    if (
      candidateName &&
      (!partition.explicitName ||
        partition.explicitName === 'Assistente Moeda — Geral' ||
        partition.explicitName === 'Minha Planilha')
    ) {
      partition.explicitName = candidateName;
    }

    if (!row.isTableHeaderOnly) {
      partition.rows.push(row);
    }
  }

  const partitions: OmniCoinTablePartition[] = [];
  const usedNames = new Map<string, number>();
  let idx = 0;

  for (const part of partitionsMap.values()) {
    idx += 1;
    let baseName =
      part.explicitName ||
      (partitionsMap.size > 1
        ? `Planilha Financeira #${idx} (${part.tableId})`
        : 'Assistente Moeda — Geral');

    // Se há múltiplas planilhas com tableIds diferentes, mas todas vieram com o mesmo nome genérico,
    // desambiguamos a partir da 2ª planilha para clareza visual no seletor de planilhas:
    const prevCount = usedNames.get(baseName) || 0;
    usedNames.set(baseName, prevCount + 1);
    if (prevCount > 0 && partitionsMap.size > 1) {
      baseName = `${baseName} (${part.tableId})`;
    }

    partitions.push({
      tableId: part.tableId,
      tableName: baseName,
      tableEnvelope: part.envelope,
      rows: part.rows,
    });
  }

  return partitions;
}

export const DEFAULT_COIN_LEDGER_ROWS: OmniCoinLedgerRowItem[] = [
  {
    id: 'coin-01',
    date: '2026-10-01',
    category: 'Receitas Operacionais',
    description: 'Receita Mensal Principal / Honorários (Fictício)',
    amount: 6800,
    entryType: 'revenue',
    paymentMethod: 'PIX',
    status: 'paid',
    recurrence: 'mensal',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['renda_fixa', 'fator_r'],
  },
  {
    id: 'coin-02',
    date: '2026-10-03',
    category: 'Moradia & Base',
    description: 'Aluguel e Condomínio Residencial (Fictício)',
    amount: 1750,
    entryType: 'expense',
    paymentMethod: 'Boleto',
    status: 'paid',
    recurrence: 'mensal',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['custo_fixo', 'essencial'],
  },
  {
    id: 'coin-03',
    date: '2026-10-05',
    category: 'Alimentação & Suprimentos',
    description: 'Supermercado Atacadista Mensal (Fictício)',
    amount: 920.5,
    entryType: 'expense',
    paymentMethod: 'Cartão',
    status: 'paid',
    recurrence: 'mensal',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['mercado', 'essencial'],
  },
  {
    id: 'coin-04',
    date: '2026-10-07',
    category: 'Utilidades & Conectividade',
    description: 'Energia Elétrica + Fibra Óptica (Fictício)',
    amount: 310.4,
    entryType: 'expense',
    paymentMethod: 'Débito Automático',
    status: 'paid',
    recurrence: 'mensal',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['luz', 'internet'],
  },
  {
    id: 'coin-05',
    date: '2026-10-10',
    category: 'Reserva de Emergência',
    description: 'Aporte Tesouro Selic Liquidez Diária (100% CDI)',
    amount: 1200,
    entryType: 'deposit',
    paymentMethod: 'TED',
    status: 'paid',
    recurrence: 'mensal',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    ticker: 'SELIC',
    quantity: 1,
    unitPrice: 1200,
    tags: ['reserva', 'liquidez', 'sankey'],
  },
  {
    id: 'coin-06',
    date: '2026-10-12',
    category: 'Carteira FIRE & FIIs',
    description: 'Compra de Cotas Fundo Imobiliário Logístico',
    amount: 820,
    entryType: 'deposit',
    paymentMethod: 'Corretora',
    status: 'paid',
    recurrence: 'mensal',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    ticker: 'HGLG11',
    quantity: 5,
    unitPrice: 164,
    tags: ['fii', 'renda_passiva'],
  },
  {
    id: 'coin-07',
    date: '2026-10-14',
    category: 'Frota & Mobilidade',
    description: 'Combustível e Manutenção Preventiva Veículo',
    amount: 480,
    entryType: 'expense',
    paymentMethod: 'PIX',
    status: 'paid',
    recurrence: 'mensal',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['veiculo', 'combustivel'],
  },
  {
    id: 'coin-08',
    date: '2026-10-15',
    category: 'Seguros & Anuidades (12m)',
    description: 'Seguro Anual e IPVA Rateado (12 Meses)',
    amount: 1800,
    monthlyValue: 150,
    monthCount: 12,
    period_start: '2026-01-01',
    period_end: '2026-12-31',
    entryType: 'expense',
    paymentMethod: 'Cartão',
    status: 'paid',
    recurrence: 'anual',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['anual', 'seguro'],
  },
  {
    id: 'coin-09',
    date: '2026-10-16',
    category: 'Banco de Tempo',
    description: 'Abono de Meta / Dia de Estudo & Planejamento (Waiver)',
    amount: 250,
    entryType: 'waiver',
    paymentMethod: 'Banco de Tempo',
    status: 'paid',
    recurrence: 'unico',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['abono', 'banco_de_tempo'],
  },
  {
    id: 'coin-10',
    date: '2026-10-17',
    category: 'Parcerias & Sócios',
    description: 'Reembolso Operacional Recebido de Parceiro',
    amount: 650,
    entryType: 'partner_in',
    paymentMethod: 'PIX',
    status: 'paid',
    recurrence: 'unico',
    tableId: 'coin-main-01',
    tableName: 'Planilha Principal — Assistente Moeda',
    tags: ['socio', 'reembolso'],
  },
];

export interface SekundoOmniStateBundle {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
  events: OmniEventBundleItem[];
  studioDocuments: OmniStudioDocItem[];
  hojeManifestYaml: string;
  hojeRituals: OmniHojeRitualItem[];
  coinLedgerRows: OmniCoinLedgerRowItem[];
  /** Exact list of Planilhas (sheet kinds) present in the parsed CSV */
  presentSheets?: OmniRecordKind[];
}

export interface ExportOmniCsvOptions {
  /** If provided, exports ONLY the specified Planilhas (sheets) instead of all 7 sheets */
  onlySheets?: OmniRecordKind[];
  /** If provided, exports ONLY the Planilha(s) corresponding to this single EngineId */
  onlyEngineId?: string;
}

const VALID_RECORD_KINDS = new Set<OmniRecordKind>([
  'participant_privilege',
  'hub_schedule_slot',
  'hub_territory_cycle',
  'coin_ledger_row',
  'studio_document',
  'cockpit_hoje',
  'event_node',
]);

/**
 * Resolves any sheet tab name / engine alias (from `#PLANILHA,<name>` or `#ABA_PLANILHA,<name>`)
 * into its canonical `OmniRecordKind` as if it were the first column (`_record_kind`).
 */
export function resolveSheetNameToRecordKind(rawName: string): OmniRecordKind | null {
  const clean = (rawName || '')
    .trim()
    .replace(/^#?(PLANILHA|ABA_PLANILHA|FIM_PLANILHA|SHEET)[:\s-]*/i, '')
    .replace(/^\[|\]$/g, '')
    .trim()
    .toLowerCase();
  if (!clean) return null;

  if (VALID_RECORD_KINDS.has(clean as OmniRecordKind)) {
    return clean as OmniRecordKind;
  }
  if (
    clean.includes('participant_privilege') ||
    clean.includes('privilegio') ||
    clean.includes('privilégio') ||
    clean.includes('usuario') ||
    clean.includes('usuário')
  ) {
    return 'participant_privilege';
  }
  if (
    clean.includes('hub_schedule_slot') ||
    clean.includes('programacao') ||
    clean.includes('programação') ||
    clean.includes('roster_assignments') ||
    clean.includes('escala')
  ) {
    return 'hub_schedule_slot';
  }
  if (
    clean.includes('hub_territory_cycle') ||
    clean.includes('territory_logistics') ||
    clean.includes('territorio') ||
    clean.includes('território')
  ) {
    return 'hub_territory_cycle';
  }
  if (
    clean.includes('coin_ledger_row') ||
    clean.includes('financial_ledger') ||
    clean.includes('assistente_moeda') ||
    clean.includes('assistente moeda') ||
    clean.includes('financ') ||
    clean.includes('moeda')
  ) {
    return 'coin_ledger_row';
  }
  if (
    clean.includes('studio_document') ||
    clean.includes('documentengine') ||
    clean.includes('estudio') ||
    clean.includes('estúdio') ||
    clean.includes('sdoc')
  ) {
    return 'studio_document';
  }
  if (
    clean.includes('cockpit_hoje') ||
    clean.includes('action_tracker') ||
    clean.includes('hoje') ||
    clean.includes('rituais')
  ) {
    return 'cockpit_hoje';
  }
  if (clean.includes('event_node') || clean.includes('evento')) {
    return 'event_node';
  }
  return null;
}

/**
 * Maps a single `EngineId` to the specific `OmniRecordKind` Planilhas that belong to it.
 */
export function getSheetsForEngineId(engineId: string): OmniRecordKind[] {
  switch (engineId) {
    case 'financial_ledger':
      return ['coin_ledger_row'];
    case 'territory_logistics':
      return ['hub_territory_cycle'];
    case 'roster_assignments':
      return ['participant_privilege', 'hub_schedule_slot'];
    case 'DocumentEngine':
      return ['studio_document'];
    case 'action_tracker':
      return ['cockpit_hoje'];
    default:
      return ['event_node'];
  }
}

/**
 * Detects whether a CSV string is a Sekundo Multi-Planilha CSV (`#PLANILHA,...` / `#ABA_PLANILHA,...`)
 * or a legacy Omni-CSV (`_record_kind,...` / `_container_id,_key,...`).
 */
export function isOmniCsvText(csvText: string): boolean {
  const clean = (csvText || '').replace(/^\uFEFF/, '').trim();
  if (!clean) return false;
  return (
    clean.startsWith('#PLANILHA,') ||
    clean.startsWith('#ABA_PLANILHA,') ||
    clean.startsWith('PLANILHA,') ||
    clean.startsWith('_record_kind,') ||
    clean.startsWith('_container_id,_key,') ||
    clean.startsWith('## COIN ASSISTANT BACKUP') ||
    /^#?PLANILHA[,:]/im.test(clean) ||
    /^#?ABA_PLANILHA[,:]/im.test(clean) ||
    /^##\s*COIN ASSISTANT BACKUP/im.test(clean) ||
    /^##\s*ROWS\s*##/im.test(clean)
  );
}

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) on untrusted text cells.
 */
export function neutralizeCsvFormula(raw: string): string {
  if (!raw) return '';
  if (/^[=@]/.test(raw) || /^[+-][A-Za-z_]/.test(raw)) {
    return `'${raw}`;
  }
  return raw;
}

/**
 * RFC-4180 CSV cell escaping.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * RFC-4180 compliant multi-line & Multi-Planilha CSV parser returning header names,
 * normalized row objects (with `_record_kind` resolved from the Planilha name or legacy column 1),
 * and the list of `presentSheets`.
 */
export function parseRawOmniCsvTable(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
  presentSheets: OmniRecordKind[];
} {
  const clean = (csvText || '').replace(/^\uFEFF/, '').trim();
  if (!clean) return { headers: [], rows: [], presentSheets: [] };

  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    matrix.push(currentRow);
  }

  if (matrix.length === 0) return { headers: [], rows: [], presentSheets: [] };

  let activeHeaders: string[] = [...OMNI_CSV_HEADERS];
  const discoveredHeaderSet = new Set<string>();
  let currentSheetKind: OmniRecordKind | null = null;
  const presentSheetsSet = new Set<OmniRecordKind>();
  const rows: Record<string, string>[] = [];
  let unassignedBatch: Record<string, string>[] = [];

  // Assistente Moeda Backup v3 header envelope state
  let coinBackupTableId = '';
  let coinBackupTableName = '';
  const coinBackupEnvelope: Record<string, any> = {};
  let coinEnvelopeAttached = false;
  const rowsMarkerIdx = matrix.findIndex((row) =>
    /^##\s*ROWS\s*##$/i.test((row[0] || '').trim())
  );

  for (let r = 0; r < matrix.length; r++) {
    const line = matrix[r];
    if (line.every((cell) => cell.trim() === '')) continue;

    const firstCell = (line[0] || '').trim();
    const secondCell = (line[1] || '').trim();

    // 0a. If the file has a `## ROWS ##` marker (Assistente Moeda Backup v3), everything before `rowsMarkerIdx` is envelope metadata/schema
    if (rowsMarkerIdx !== -1 && r <= rowsMarkerIdx) {
      currentSheetKind = 'coin_ledger_row';
      presentSheetsSet.add('coin_ledger_row');
      if (!firstCell.startsWith('##') && secondCell) {
        const k = firstCell.toLowerCase();
        if (k === 'table_id' || k === 'tableid') coinBackupTableId = secondCell;
        else if (k === 'name' || k === 'nome') coinBackupTableName = secondCell;
        else if (k === 'description' || k === 'descricao') coinBackupEnvelope.description = secondCell;
        else if (k === 'active_sectors') {
          try {
            coinBackupEnvelope.activeSectors = JSON.parse(decodeURIComponent(secondCell));
          } catch {}
        } else if (k === 'dashboard_config') {
          try {
            coinBackupEnvelope.dashboardConfig = JSON.parse(decodeURIComponent(secondCell));
          } catch {}
        } else if (k === 'sector_params') {
          try {
            coinBackupEnvelope.sectorParams = JSON.parse(decodeURIComponent(secondCell));
          } catch {}
        } else if (k === 'profile_type') {
          coinBackupEnvelope.investorProfile = {
            ...(coinBackupEnvelope.investorProfile || {
              emergencyFundMonthsGoal: 6,
              fireTargetAnnualExpensesMultiplier: 25,
            }),
            profileType: secondCell,
          };
        } else if (k === 'emergency_fund_goal_months' && coinBackupEnvelope.investorProfile) {
          coinBackupEnvelope.investorProfile.emergencyFundMonthsGoal = parseInt(secondCell, 10) || 6;
        } else if (k === 'fire_annual_multiplier' && coinBackupEnvelope.investorProfile) {
          coinBackupEnvelope.investorProfile.fireTargetAnnualExpensesMultiplier =
            parseInt(secondCell, 10) || 25;
        } else if (k === 'monthly_contribution_goal' && coinBackupEnvelope.investorProfile) {
          coinBackupEnvelope.investorProfile.monthlyContributionGoal =
            parseFloat(secondCell) || undefined;
        }
      } else if (firstCell.startsWith('##')) {
        const fullBannerLine = line.join(',').trim();
        const match = fullBannerLine.match(/^##\s*([A-Z0-9_]+):\s*(.*?)\s*##$/i);
        if (match) {
          const key = match[1].toUpperCase();
          const val = match[2].trim();
          if (key === 'TABLE_ID') coinBackupTableId = val;
          else if (key === 'TABLE_NAME') coinBackupTableName = val;
          else if (key === 'TABLE_DESCRIPTION') coinBackupEnvelope.description = val;
          else if (key === 'GOALS_JSON') coinBackupEnvelope.goals = safeJsonParse(val, undefined);
          else if (key === 'INVESTOR_PROFILE_JSON')
            coinBackupEnvelope.investorProfile = safeJsonParse(val, undefined);
          else if (key === 'SCHEMA_JSON') coinBackupEnvelope.schema = safeJsonParse(val, undefined);
          else if (key === 'ACTIVE_SECTORS_JSON')
            coinBackupEnvelope.activeSectors = safeJsonParse(val, undefined);
          else if (key === 'DASHBOARD_CONFIG_JSON')
            coinBackupEnvelope.dashboardConfig = safeJsonParse(val, undefined);
          else if (key === 'SECTOR_PARAMS_JSON')
            coinBackupEnvelope.sectorParams = safeJsonParse(val, undefined);
        }
      }
      continue;
    }

    // 0b. Check if this line is an Assistente Moeda Backup v3 (`## ... ##`) banner/metadata line
    if (firstCell.startsWith('##')) {
      const fullBannerLine = line.join(',').trim();
      if (/^##\s*(COIN ASSISTANT BACKUP|ROWS)/i.test(fullBannerLine)) {
        currentSheetKind = 'coin_ledger_row';
        presentSheetsSet.add('coin_ledger_row');
      } else {
        const match = fullBannerLine.match(/^##\s*([A-Z0-9_]+):\s*(.*?)\s*##$/i);
        if (match) {
          const key = match[1].toUpperCase();
          const val = match[2].trim();
          currentSheetKind = 'coin_ledger_row';
          presentSheetsSet.add('coin_ledger_row');
          if (key === 'TABLE_ID') coinBackupTableId = val;
          else if (key === 'TABLE_NAME') coinBackupTableName = val;
          else if (key === 'TABLE_DESCRIPTION') coinBackupEnvelope.description = val;
          else if (key === 'GOALS_JSON') coinBackupEnvelope.goals = safeJsonParse(val, undefined);
          else if (key === 'INVESTOR_PROFILE_JSON')
            coinBackupEnvelope.investorProfile = safeJsonParse(val, undefined);
          else if (key === 'SCHEMA_JSON') coinBackupEnvelope.schema = safeJsonParse(val, undefined);
          else if (key === 'ACTIVE_SECTORS_JSON')
            coinBackupEnvelope.activeSectors = safeJsonParse(val, undefined);
          else if (key === 'DASHBOARD_CONFIG_JSON')
            coinBackupEnvelope.dashboardConfig = safeJsonParse(val, undefined);
          else if (key === 'SECTOR_PARAMS_JSON')
            coinBackupEnvelope.sectorParams = safeJsonParse(val, undefined);
        }
      }
      continue;
    }

    // 1. Check if this line is a Top or Bottom Planilha Marker (`#PLANILHA,<engine>` or `#ABA_PLANILHA,<engine>`)
    if (
      /^#?(PLANILHA|ABA_PLANILHA|FIM_PLANILHA|SHEET)$/i.test(firstCell) ||
      /^#?(PLANILHA|ABA_PLANILHA|FIM_PLANILHA|SHEET)[:\s]/i.test(firstCell)
    ) {
      const candidate = secondCell || firstCell;
      const resolved = resolveSheetNameToRecordKind(candidate) || resolveSheetNameToRecordKind(line[2] || '');
      if (resolved) {
        presentSheetsSet.add(resolved);
        if (/^#?(ABA_PLANILHA|FIM_PLANILHA)/i.test(firstCell)) {
          // Bottom sheet tab marker ("nome da planilha em baixo"): assign any unassigned rows above it
          for (const pending of unassignedBatch) {
            if (!pending._record_kind) {
              pending._record_kind = resolved;
            }
          }
          unassignedBatch = [];
          currentSheetKind = null;
        } else {
          // Top sheet marker
          currentSheetKind = resolved;
          unassignedBatch = [];
        }
      }
      continue;
    }

    // 2. Check if this line is a Column Header row (either at top of file, start of a Planilha block, or immediately after ## ROWS ##)
    if (
      (rowsMarkerIdx !== -1 && r === rowsMarkerIdx + 1) ||
      firstCell === '_container_id' ||
      firstCell === '_record_kind' ||
      (firstCell === '_key' && secondCell === '_type') ||
      (firstCell === 'id' && secondCell === 'date') ||
      (firstCell === 'date' && secondCell === 'value') ||
      (r === 0 && !VALID_RECORD_KINDS.has(firstCell as OmniRecordKind))
    ) {
      activeHeaders = line.map((h) => h.trim());
      for (const h of activeHeaders) {
        if (h) discoveredHeaderSet.add(h);
      }
      continue;
    }

    // 3. Parse Data Row
    const obj: Record<string, string> = {};
    const firstCellIsLegacyKind = VALID_RECORD_KINDS.has(firstCell as OmniRecordKind);

    if (firstCellIsLegacyKind && activeHeaders[0] !== '_record_kind') {
      // Legacy 16-column row where column 0 is `_record_kind` and columns 1..15 map to `activeHeaders`
      obj._record_kind = firstCell;
      presentSheetsSet.add(firstCell as OmniRecordKind);
      for (let c = 0; c < activeHeaders.length; c++) {
        obj[activeHeaders[c]] = line[c + 1] ?? '';
      }
    } else {
      for (let c = 0; c < activeHeaders.length; c++) {
        obj[activeHeaders[c]] = line[c] ?? '';
      }
      if (obj._record_kind && VALID_RECORD_KINDS.has(obj._record_kind.trim() as OmniRecordKind)) {
        presentSheetsSet.add(obj._record_kind.trim() as OmniRecordKind);
      } else if (currentSheetKind) {
        obj._record_kind = currentSheetKind;
        presentSheetsSet.add(currentSheetKind);
      } else {
        unassignedBatch.push(obj);
      }
    }

    if (obj._record_kind === 'coin_ledger_row') {
      if (coinBackupTableId && !obj._container_id) obj._container_id = coinBackupTableId;
      if (coinBackupTableName && !obj._table_name) obj._table_name = coinBackupTableName;
      if (!coinEnvelopeAttached && Object.keys(coinBackupEnvelope).length > 0) {
        obj._table_envelope_json = JSON.stringify(coinBackupEnvelope);
        coinEnvelopeAttached = true;
      }
    }

    rows.push(obj);
  }

  const finalHeaders =
    discoveredHeaderSet.size > 0 ? Array.from(discoveredHeaderSet) : [...OMNI_CSV_HEADERS];

  return {
    headers: finalHeaders,
    rows,
    presentSheets: Array.from(presentSheetsSet),
  };
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Serializes a complete or single-engine `SekundoOmniStateBundle` into a Multi-Planilha RFC-4180 CSV string.
 * Each Engine is emitted as its own Planilha section (`#PLANILHA,<engine>` ... `#ABA_PLANILHA,<engine>`)
 * without repeating `_record_kind` as the first column of every row.
 */
export function exportOmniCsvBundle(
  input?: Partial<SekundoOmniStateBundle>,
  options?: ExportOmniCsvOptions
): string {
  const unitName = input?.unitName || PROGRAMACAO_UNIT_NAME;

  // Determine which Planilhas (sheets) should be included
  let targetSheets: Set<OmniRecordKind>;
  if (options?.onlySheets && options.onlySheets.length > 0) {
    targetSheets = new Set(options.onlySheets);
  } else if (options?.onlyEngineId) {
    targetSheets = new Set(getSheetsForEngineId(options.onlyEngineId));
  } else {
    targetSheets = new Set<OmniRecordKind>([
      'participant_privilege',
      'hub_schedule_slot',
      'hub_territory_cycle',
      'coin_ledger_row',
      'studio_document',
      'cockpit_hoje',
      'event_node',
    ]);
  }

  const participants = (input?.participants ?? DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS).map(
    (p, idx) => ensureParticipantPrivilegeMatrix(p, idx)
  );
  const scheduleRegistry =
    input?.scheduleRegistry ?? buildProgramacaoReuniaoRegistry(undefined, participants);
  const territoryRegistry =
    input?.territoryRegistry ?? buildTerritoriosS13HistoricalRegistry();
  const coinLedgerRows = input?.coinLedgerRows ?? DEFAULT_COIN_LEDGER_ROWS;
  const events = input?.events ?? [];
  const studioDocuments = input?.studioDocuments ?? [
    {
      id: 'fichas-4up',
      title: 'Fichas de Designação 4-Up (A4)',
      format: 'A4-Portrait-mm',
      sdocYaml: FICHAS_4UP_SDOC_YAML,
    },
    {
      id: 'territorios-multiciclo',
      title: 'Registro de Territórios Multi-Ciclo (A4)',
      format: 'A4-Portrait-mm',
      sdocYaml: TERRITORIOS_MULTICYCLE_SDOC_YAML,
    },
  ];
  const hojeManifestYaml = input?.hojeManifestYaml ?? DEFAULT_SEKUNDO_APP_YAML;
  const hojeRituals: OmniHojeRitualItem[] = input?.hojeRituals ?? [
    {
      id: 'ritual-01',
      title: 'Auditoria de Prontidão Semanal & Envio WhatsApp',
      frequency: 'weekly',
      status: 'active',
      notes: 'Verifica confirmações dos Grupos 1–3 e gera fichas 4-Up',
    },
    {
      id: 'ritual-02',
      title: 'Fechamento de Ciclo Territorial & Mapa CAD',
      frequency: 'monthly',
      status: 'active',
      notes: 'Atualiza cobertura de quadras e imprime folha PDF A4',
    },
  ];

  const sheetBlocks: string[] = [];

  const buildSheetBlock = (
    kind: OmniRecordKind,
    records: Array<Record<OmniCsvHeader, unknown>>
  ) => {
    if (!targetSheets.has(kind) || records.length === 0) return;
    const sheetTitle = OMNI_SHEET_TITLES[kind] || kind;
    const blockLines: string[] = [
      `#PLANILHA,${kind},${escapeCsvCell(sheetTitle)}`,
      OMNI_CSV_HEADERS.join(','),
    ];
    for (const rec of records) {
      const cells = OMNI_CSV_HEADERS.map((h) => escapeCsvCell(rec[h]));
      blockLines.push(cells.join(','));
    }
    blockLines.push(`#ABA_PLANILHA,${kind},${escapeCsvCell(sheetTitle)}`);
    sheetBlocks.push(blockLines.join('\n'));
  };

  // 1. Planilha: Participant & Privilege Matrix (`participant_privilege`)
  if (targetSheets.has('participant_privilege')) {
    const rows: Array<Record<OmniCsvHeader, unknown>> = [];
    for (const p of participants) {
      const activeCapKeys = Object.entries(p.capabilities || {})
        .filter(([, enabled]) => Boolean(enabled))
        .map(([k]) => k);
      const sealSuffix = p.hasAdminSeal ? '|selo_admin' : '|sem_selo_admin';
      rows.push({
        _container_id: unitName,
        _key: p.id,
        _type: p.profileCategory || 'perfil_a',
        _engines: 'roster_assignments',
        group_or_tier: `${p.groupTag}|${p.roleTier || 'operador_base'}${sealSuffix}`,
        date_or_cycle: p.lastAssignedIsoDate || '',
        time_or_duration: String(p.assignmentCount ?? 0),
        title_or_name: p.name,
        primary_assignee: p.name,
        secondary_assignee: p.lastPartnerId || '',
        status_or_readiness: (p.statusFlags || []).join('|'),
        capabilities_or_tags: activeCapKeys.join('|'),
        contact_or_location: p.phone || p.email || (p.accessPin ? `PIN:${p.accessPin}` : ''),
        notes_or_payload: (p.capabilityTags || []).join('|'),
        _meta_json: JSON.stringify(p),
      });
    }
    buildSheetBlock('participant_privilege', rows);
  }

  // 2. Planilha: Schedule & WhatsApp Hub (`hub_schedule_slot`)
  if (targetSheets.has('hub_schedule_slot')) {
    const rows: Array<Record<OmniCsvHeader, unknown>> = [];
    for (const entry of scheduleRegistry) {
      const meta = (entry.meta || {}) as Record<string, any>;
      rows.push({
        _container_id: unitName,
        _key: entry.key,
        _type: entry.type,
        _engines: 'roster_assignments',
        group_or_tier: meta.groupTag || '',
        date_or_cycle: meta.sessionDate || '',
        time_or_duration: meta.durationMinutes ? `${meta.durationMinutes} min` : '',
        title_or_name: entry.label,
        primary_assignee: meta.assignedTo || meta.chairPerson || entry.value || '',
        secondary_assignee: meta.assistantTo || meta.openingPrayer || '',
        status_or_readiness: meta.readinessState || (meta.confirmed ? 'ready' : 'pending'),
        capabilities_or_tags: Array.isArray(meta.capabilityTags)
          ? meta.capabilityTags.join('|')
          : meta.requiredCapability || '',
        contact_or_location: meta.room || 'Auditório Principal',
        notes_or_payload: meta.closingPrayer || meta.sessionTheme || '',
        _meta_json: JSON.stringify(meta),
      });
    }
    buildSheetBlock('hub_schedule_slot', rows);
  }

  // 3. Planilha: Territory Multi-Cycle (`hub_territory_cycle`)
  if (targetSheets.has('hub_territory_cycle')) {
    const rows: Array<Record<OmniCsvHeader, unknown>> = [];
    for (const entry of territoryRegistry) {
      const meta = (entry.meta || {}) as Record<string, any>;
      rows.push({
        _container_id: unitName,
        _key: entry.key,
        _type: entry.type,
        _engines: 'territory_logistics',
        group_or_tier: meta.groupTag || '',
        date_or_cycle: meta.assignedAt || '',
        time_or_duration: meta.completedAt || meta.lastCompletedDate || '',
        title_or_name: entry.label,
        primary_assignee: meta.workerName || entry.value || '',
        secondary_assignee: '',
        status_or_readiness: meta.worked === 1 ? 'concluido' : 'em_campo',
        capabilities_or_tags: meta.property_type || 'residencial',
        contact_or_location: meta.locality || meta.neighborhood || '',
        notes_or_payload: meta.territoryNumber || '',
        _meta_json: JSON.stringify(meta),
      });
    }
    buildSheetBlock('hub_territory_cycle', rows);
  }

  // 4. Planilha: Assistente Moeda / Engine Financeira (`coin_ledger_row`)
  if (targetSheets.has('coin_ledger_row')) {
    const effectiveCoinRows =
      coinLedgerRows.length > 0 ? coinLedgerRows : DEFAULT_COIN_LEDGER_ROWS;
    const rows: Array<Record<OmniCsvHeader, unknown>> = [];
    for (const row of effectiveCoinRows) {
      rows.push({
        _container_id: row.tableId || 'coin-default',
        _key: row.id,
        _type: row.isTableHeaderOnly ? 'header' : 'leaf',
        _engines: 'financial_ledger',
        group_or_tier: neutralizeCsvFormula(row.category || 'Outros'),
        date_or_cycle: row.date || '',
        time_or_duration: row.recurrence || 'unico',
        title_or_name: neutralizeCsvFormula(row.description || ''),
        primary_assignee: String(row.amount ?? 0),
        secondary_assignee: row.entryType || 'expense',
        status_or_readiness: row.status || 'paid',
        capabilities_or_tags: row.paymentMethod || 'PIX',
        contact_or_location: 'Assistente Moeda',
        notes_or_payload: String(row.amount ?? 0),
        _meta_json: JSON.stringify(row),
      });
    }
    buildSheetBlock('coin_ledger_row', rows);
  }

  // 5. Planilha: Studio Document YAML ⇄ PDF (`studio_document`)
  if (targetSheets.has('studio_document')) {
    const rows: Array<Record<OmniCsvHeader, unknown>> = [];
    for (const doc of studioDocuments) {
      rows.push({
        _container_id: doc.id,
        _key: doc.id,
        _type: 'document',
        _engines: 'DocumentEngine',
        group_or_tier: doc.format,
        date_or_cycle: '2026-10-17',
        time_or_duration: 'A4-mm',
        title_or_name: doc.title,
        primary_assignee: '',
        secondary_assignee: '',
        status_or_readiness: 'ready',
        capabilities_or_tags: 'yaml|pdf|4up|mm',
        contact_or_location: 'Estúdio Documental',
        notes_or_payload: String(doc.sdocYaml || '').replace(/\r?\n/g, '\\n'),
        _meta_json: JSON.stringify(doc),
      });
    }
    buildSheetBlock('studio_document', rows);
  }

  // 6. Planilha: Cockpit Hoje & Composer (`cockpit_hoje`)
  if (targetSheets.has('cockpit_hoje')) {
    const rows: Array<Record<OmniCsvHeader, unknown>> = [];
    rows.push({
      _container_id: 'sekundo.app.yaml',
      _key: 'manifest',
      _type: 'root',
      _engines: 'custom',
      group_or_tier: 'compositor',
      date_or_cycle: '2026-10-17',
      time_or_duration: 'daily',
      title_or_name: 'Manifesto Declarativo sekundo.app.yaml',
      primary_assignee: '',
      secondary_assignee: '',
      status_or_readiness: 'active',
      capabilities_or_tags: 'hoje|compositor|yaml',
      contact_or_location: 'Cockpit Hoje',
      notes_or_payload: String(hojeManifestYaml || '').replace(/\r?\n/g, '\\n'),
      _meta_json: JSON.stringify({ kind: 'manifest', yaml: hojeManifestYaml }),
    });

    for (const ritual of hojeRituals) {
      rows.push({
        _container_id: 'hoje-rituals',
        _key: ritual.id,
        _type: 'slot',
        _engines: 'action_tracker',
        group_or_tier: ritual.frequency,
        date_or_cycle: '',
        time_or_duration: ritual.frequency,
        title_or_name: ritual.title,
        primary_assignee: '',
        secondary_assignee: '',
        status_or_readiness: ritual.status,
        capabilities_or_tags: 'ritual_governado',
        contact_or_location: 'Cockpit Hoje',
        notes_or_payload: ritual.notes || '',
        _meta_json: JSON.stringify(ritual),
      });
    }
    buildSheetBlock('cockpit_hoje', rows);
  }

  // 7. Planilha: Events across Universal Engines (`event_node`)
  if (targetSheets.has('event_node')) {
    const rows: Array<Record<OmniCsvHeader, unknown>> = [];
    const filteredEvents = options?.onlyEngineId
      ? events.filter((ev) => ev.engines.includes(options.onlyEngineId!))
      : events;

    for (const ev of filteredEvents) {
      for (const node of ev.registry) {
        const meta = (node.meta || {}) as Record<string, any>;
        rows.push({
          _container_id: `${ev.id}::${ev.name}`,
          _key: node.key,
          _type: node.type,
          _engines: ev.engines.join('|'),
          group_or_tier: meta.groupTag || meta.category || '',
          date_or_cycle: meta.date || meta.assignedAt || '',
          time_or_duration: meta.durationMinutes ? String(meta.durationMinutes) : '',
          title_or_name: node.label,
          primary_assignee: meta.assignedTo || meta.workerName || node.value || '',
          secondary_assignee: meta.assistantTo || '',
          status_or_readiness: meta.status || (meta.worked === 1 ? 'worked' : ''),
          capabilities_or_tags: '',
          contact_or_location: node.email || meta.address || meta.room || '',
          notes_or_payload: node.value || '',
          _meta_json: JSON.stringify(meta),
        });
      }
    }
    buildSheetBlock('event_node', rows);
  }

  return sheetBlocks.join('\n\n');
}

/**
 * Generates a Single-Engine Multi-Planilha CSV containing ONLY the Planilha(s)
 * belonging to the specified `engineId` (dramatically smaller than the global Omni-CSV).
 */
export function exportSingleEngineSampleCsv(engineId: string): string {
  const sheets = getSheetsForEngineId(engineId);
  if (engineId === 'financial_ledger' || engineId === 'coin_ledger_row') {
    return exportOmniCsvBundle(
      { coinLedgerRows: DEFAULT_COIN_LEDGER_ROWS },
      { onlySheets: ['coin_ledger_row'] }
    );
  }
  if (engineId === 'territory_logistics' || engineId === 'hub_territory_cycle') {
    return exportOmniCsvBundle(
      { territoryRegistry: buildTerritoriosS13HistoricalRegistry() },
      { onlySheets: ['hub_territory_cycle'] }
    );
  }
  if (engineId === 'roster_assignments') {
    return exportOmniCsvBundle(
      {
        participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
        scheduleRegistry: buildProgramacaoReuniaoRegistry(
          undefined,
          DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
        ),
      },
      { onlySheets: ['participant_privilege', 'hub_schedule_slot'] }
    );
  }
  if (engineId === 'DocumentEngine' || engineId === 'studio_document') {
    return exportOmniCsvBundle(undefined, { onlySheets: ['studio_document'] });
  }
  if (engineId === 'action_tracker' || engineId === 'cockpit_hoje') {
    return exportOmniCsvBundle(undefined, { onlySheets: ['cockpit_hoje'] });
  }

  // Fallback for event-driven engines (`study_synthesis`, `inventory_assets`, `custom_generic`, etc.)
  const tpl = (ENGINE_TEMPLATES as Record<string, any>)[engineId];
  if (tpl) {
    const { rows } = parseRawOmniCsvTable(tpl.canonicalCsv);
    const registry: FlatSkeletonEntry[] = rows.map((r) => ({
      key: r._key || '01',
      type: (r._type as NodeType) || 'leaf',
      label: r.label || tpl.name,
      value: r.value || '',
      email: r.email || '',
      meta: safeJsonParse<Record<string, any>>(r._meta_json, {}),
    }));
    return exportOmniCsvBundle(
      {
        events: [
          {
            id: `evt-${engineId}`,
            name: tpl.name,
            engines: [engineId],
            registry,
          },
        ],
      },
      { onlySheets: sheets, onlyEngineId: engineId }
    );
  }

  return exportOmniCsvBundle(undefined, { onlySheets: sheets, onlyEngineId: engineId });
}

/**
 * Demultiplexes an Omni-CSV string (or a single-engine / Schedule Hub CSV string)
 * back into a complete `SekundoOmniStateBundle`.
 */
const STANDARD_OMNI_HEADER_SET = new Set<string>([
  ...(OMNI_CSV_HEADERS as unknown as string[]),
  '_record_kind',
]);

/**
 * Parses a participant's exact privilege map from a CSV row.
 * Guarantees that `capabilities_or_tags` (and any extra privilege columns in the CSV)
 * is the Single Source of Truth — never reviving deselected privileges from `_meta_json`
 * or `buildPresetCapabilities`.
 */
export function parseParticipantPrivilegesFromCsvRow(
  row: Record<string, string>,
  headers: string[] = [],
  meta: Record<string, any> = {}
): Record<string, boolean> {
  const capMap: Record<string, boolean> = createEmptyCapabilitiesMap();
  const hasCapabilitiesColumn =
    headers.length === 0 ||
    headers.includes('capabilities_or_tags') ||
    'capabilities_or_tags' in row;

  if (!hasCapabilitiesColumn && meta.capabilities && typeof meta.capabilities === 'object') {
    Object.assign(capMap, meta.capabilities);
  }

  const rawCapCell = (row.capabilities_or_tags || row.privilegios || row.privileges || '').trim();
  if (rawCapCell) {
    const delimiter = rawCapCell.includes('|')
      ? '|'
      : rawCapCell.includes(';')
      ? ';'
      : ',';
    const tokens = rawCapCell
      .split(delimiter)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const resolved = resolveCapabilityKeyOrCustom(token);
      if (resolved.key) {
        capMap[resolved.key] = resolved.enabled;
      }
    }
  }

  // Support extra privilege columns added directly in the spreadsheet
  for (const h of headers) {
    if (!h || STANDARD_OMNI_HEADER_SET.has(h)) continue;
    const rawVal = (row[h] ?? '').trim();
    if (!rawVal) continue;
    const cleanHeader = h.replace(/^(priv|privilegio|cap|capability)\s*[:_-]\s*/i, '').trim();
    if (!cleanHeader) continue;
    const resolved = resolveCapabilityKeyOrCustom(`${cleanHeader}=${rawVal}`);
    if (resolved.key) {
      capMap[resolved.key] = resolved.enabled;
    }
  }

  return capMap;
}

/**
 * Demultiplexes a Multi-Planilha Omni-CSV string (or legacy 16-column Omni-CSV or single-engine CSV)
 * back into a `SekundoOmniStateBundle`.
 */
export function importOmniCsvBundle(csvText: string): SekundoOmniStateBundle {
  const { headers, rows, presentSheets } = parseRawOmniCsvTable(csvText);

  let unitName = PROGRAMACAO_UNIT_NAME;
  const participants: ParticipantProfile[] = [];
  const scheduleRegistry: FlatSkeletonEntry[] = [];
  const territoryRegistry: FlatSkeletonEntry[] = [];
  const eventsMap = new Map<string, OmniEventBundleItem>();
  const studioDocuments: OmniStudioDocItem[] = [];
  let hojeManifestYaml = DEFAULT_SEKUNDO_APP_YAML;
  const hojeRituals: OmniHojeRitualItem[] = [];
  const coinLedgerRows: OmniCoinLedgerRowItem[] = [];

  const isOmniSchema =
    presentSheets.length > 0 ||
    headers.includes('_record_kind') ||
    headers.includes('_container_id');

  if (!isOmniSchema) {
    // Fallback for standard single-engine or Schedule Hub simplified CSV
    const hubParsed = importScheduleHubFromCsv(csvText);
    return {
      unitName: hubParsed.unitName,
      participants: hubParsed.participants,
      scheduleRegistry: hubParsed.scheduleRegistry,
      territoryRegistry: hubParsed.territoryRegistry,
      events: [],
      studioDocuments: [],
      hojeManifestYaml,
      hojeRituals: [],
      coinLedgerRows: [],
      presentSheets: ['hub_schedule_slot'],
    };
  }

  for (const row of rows) {
    const kind = (row._record_kind || '').trim() as OmniRecordKind;
    const containerId = (row._container_id || '').trim();
    const key = (row._key || '').trim();
    const type = ((row._type || 'slot').trim() as NodeType) || 'slot';
    const title = row.title_or_name || '';
    const primary = row.primary_assignee || '';
    const secondary = row.secondary_assignee || '';
    const meta = safeJsonParse<Record<string, any>>(row._meta_json, {});

    if (kind === 'participant_privilege') {
      if (containerId) unitName = containerId;
      const groupParts = (row.group_or_tier || 'Grupo 1|operador_base')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const groupPart = groupParts[0] || 'Grupo 1';
      const tierPart =
        groupParts.find((g) =>
          ['coordenador_senior', 'assistente_tecnico', 'operador_base'].includes(g)
        ) || 'operador_base';
      const hasSealInGroupCol = groupParts.some((g) => /^(selo_admin|admin|👑)$/i.test(g));
      const hasNoSealInGroupCol = groupParts.some((g) => /^(sem_selo_admin|consultor|viewer)$/i.test(g));
      const capMap = parseParticipantPrivilegesFromCsvRow(row, headers, meta);

      const rawContact = (row.contact_or_location || '').trim();
      const pinMatch = rawContact.match(/(?:pin\s*[:=]\s*|^)(\d{3,8})$/i);
      const extractedPin = pinMatch ? pinMatch[1] : meta.accessPin;

      const explicitAdminSeal = hasSealInGroupCol
        ? true
        : hasNoSealInGroupCol
        ? false
        : capMap.cap_selo_admin === true || capMap.selo_admin === true
        ? true
        : typeof meta.hasAdminSeal === 'boolean'
        ? meta.hasAdminSeal
        : false;
      delete capMap.cap_selo_admin;
      delete capMap.selo_admin;

      const statusFlags = (row.status_or_readiness || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean) as any[];

      const profile: ParticipantProfile = ensureParticipantPrivilegeMatrix(
        {
          ...meta,
          id: key || meta.id || `p-${participants.length + 1}`,
          name: title || primary || meta.name || `Participante ${participants.length + 1}`,
          groupTag: groupPart || meta.groupTag || 'Grupo 1',
          profileCategory: (
            row._type === 'perfil_b'
              ? 'perfil_b'
              : row._type === 'perfil_a'
              ? 'perfil_a'
              : meta.profileCategory || 'perfil_a'
          ) as any,
          roleTier: (tierPart || meta.roleTier || 'operador_base') as any,
          statusFlags: statusFlags.length > 0 ? statusFlags : meta.statusFlags,
          capabilities: capMap,
          capabilityTags: (row.notes_or_payload || '')
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean),
          lastAssignedIsoDate: row.date_or_cycle || meta.lastAssignedIsoDate || '',
          assignmentCount: parseInt(row.time_or_duration || '0', 10) || meta.assignmentCount || 0,
          lastPartnerId: secondary || meta.lastPartnerId || undefined,
          hasAdminSeal: explicitAdminSeal,
          accessPin: extractedPin,
          preserveExplicitCapabilities: true,
        },
        participants.length,
        { preserveExplicitCapabilities: true }
      );
      participants.push(profile);
    } else if (kind === 'hub_schedule_slot') {
      if (containerId) unitName = containerId;
      const mergedMeta: Record<string, any> = {
        ...meta,
        _enginePartition: 'roster_assignments',
      };
      if (row.group_or_tier) mergedMeta.groupTag = row.group_or_tier;
      if (row.date_or_cycle) mergedMeta.sessionDate = row.date_or_cycle;
      if (row.time_or_duration) {
        const mins = parseInt(row.time_or_duration, 10);
        if (!Number.isNaN(mins)) mergedMeta.durationMinutes = mins;
      }
      if (row.status_or_readiness) {
        mergedMeta.readinessState = row.status_or_readiness;
        mergedMeta.confirmed = row.status_or_readiness === 'ready';
      }
      if (row.contact_or_location) mergedMeta.room = row.contact_or_location;

      let value = primary;
      if (type === 'header' && key.split('-').length === 1) {
        if (primary) mergedMeta.chairPerson = primary;
        if (secondary) mergedMeta.openingPrayer = secondary;
        if (row.notes_or_payload && !mergedMeta.closingPrayer) {
          mergedMeta.closingPrayer = row.notes_or_payload;
        }
      } else if (type === 'slot') {
        if (primary) mergedMeta.assignedTo = primary;
        if (secondary) {
          mergedMeta.assistantTo = secondary;
          value = `${primary} / ${secondary}`;
        } else {
          delete mergedMeta.assistantTo;
        }
      }

      scheduleRegistry.push({
        key,
        type,
        label: title,
        value,
        email: '',
        meta: mergedMeta,
      });
    } else if (kind === 'hub_territory_cycle') {
      if (containerId) unitName = containerId;
      const mergedMeta: Record<string, any> = {
        ...meta,
        _enginePartition: 'territory_logistics',
      };
      if (primary) mergedMeta.workerName = primary;
      if (row.group_or_tier) mergedMeta.groupTag = row.group_or_tier;
      if (row.date_or_cycle) mergedMeta.assignedAt = row.date_or_cycle;
      if (row.time_or_duration) mergedMeta.completedAt = row.time_or_duration;
      if (row.status_or_readiness) {
        mergedMeta.worked = row.status_or_readiness === 'concluido' ? 1 : 0;
      }

      territoryRegistry.push({
        key,
        type: 'territory',
        label: title,
        value: primary,
        email: '',
        meta: mergedMeta,
      });
    } else if (kind === 'studio_document') {
      const rawYaml = row.notes_or_payload
        ? row.notes_or_payload.replace(/\\n/g, '\n')
        : meta.sdocYaml || '';
      studioDocuments.push({
        id: key || containerId || `doc-${studioDocuments.length + 1}`,
        title: title || 'Documento SDOC',
        format: row.group_or_tier || 'A4-Portrait-mm',
        sdocYaml: rawYaml,
      });
    } else if (kind === 'cockpit_hoje') {
      if (key === 'manifest' || containerId === 'sekundo.app.yaml') {
        hojeManifestYaml = row.notes_or_payload
          ? row.notes_or_payload.replace(/\\n/g, '\n')
          : meta.yaml || DEFAULT_SEKUNDO_APP_YAML;
      } else {
        hojeRituals.push({
          id: key || `ritual-${hojeRituals.length + 1}`,
          title: title || 'Ritual Governado',
          frequency: row.group_or_tier || 'weekly',
          status: row.status_or_readiness || 'active',
          notes: row.notes_or_payload || '',
        });
      }
    } else if (kind === 'coin_ledger_row') {
      const parsedAmount = parseFloat(
        primary || row.value || row.valor || row.notes_or_payload || String(meta.amount ?? 0)
      );
      const rawEntryType = (
        secondary ||
        row.entryType ||
        row.entry_type ||
        row.tipo ||
        row.type ||
        meta.entryType ||
        'expense'
      )
        .trim()
        .toLowerCase();
      let entryType: CoinLedgerEntryType = 'expense';
      if (rawEntryType === 'revenue' || rawEntryType === 'receita' || rawEntryType === 'entrada') {
        entryType = 'revenue';
      } else if (rawEntryType === 'income') {
        entryType = 'income';
      } else if (rawEntryType === 'deposit' || rawEntryType === 'aporte') {
        entryType = 'deposit';
      } else if (rawEntryType === 'investment' || rawEntryType === 'investimento') {
        entryType = 'investment';
      } else if (rawEntryType === 'waiver' || rawEntryType === 'abono') {
        entryType = 'waiver';
      } else if (rawEntryType === 'partner_in') {
        entryType = 'partner_in';
      } else if (rawEntryType === 'partner_out') {
        entryType = 'partner_out';
      } else if (rawEntryType === 'unresolved') {
        entryType = 'unresolved';
      }

      const rawStatus = (row.status_or_readiness || meta.status || 'paid').toLowerCase();
      const status: 'paid' | 'pending' | 'scheduled' =
        rawStatus === 'pending' || rawStatus === 'scheduled' ? rawStatus : 'paid';

      const monthlyValueStr = row.monthlyValue ?? row.monthly_value;
      const monthlyValueRaw =
        monthlyValueStr !== undefined && monthlyValueStr !== ''
          ? Number(monthlyValueStr)
          : meta.monthlyValue !== undefined
          ? Number(meta.monthlyValue)
          : undefined;
      const monthCountStr = row.monthCount ?? row.month_count;
      const monthCountRaw =
        monthCountStr !== undefined && monthCountStr !== ''
          ? Number(monthCountStr)
          : meta.monthCount !== undefined
          ? Number(meta.monthCount)
          : undefined;
      const periodStartVal =
        row.periodStart || row.period_start || meta.periodStart || meta.period_start || undefined;
      const periodEndVal =
        row.periodEnd || row.period_end || meta.periodEnd || meta.period_end || undefined;
      const tickerVal = row.ticker || meta.ticker || undefined;
      const quantityRaw =
        row.quantity !== undefined && row.quantity !== ''
          ? Number(row.quantity)
          : meta.quantity !== undefined
          ? Number(meta.quantity)
          : undefined;
      const unitPriceStr = row.unitPrice ?? row.unit_price;
      const unitPriceRaw =
        unitPriceStr !== undefined && unitPriceStr !== ''
          ? Number(unitPriceStr)
          : meta.unitPrice !== undefined
          ? Number(meta.unitPrice)
          : undefined;
      const metadataJsonVal =
        row.metadata_json || meta.metadataJson || meta.metadata_json || undefined;
      const customValuesVal =
        meta.customValues && typeof meta.customValues === 'object'
          ? meta.customValues
          : metadataJsonVal
          ? safeJsonParse<Record<string, any>>(metadataJsonVal, {}).customValues ||
            safeJsonParse<Record<string, any> | undefined>(metadataJsonVal, undefined)
          : undefined;
      const [parsedContainerId, explicitContainerName] = containerId.includes('::')
        ? containerId.split('::').map((s) => s.trim())
        : [containerId, ''];
      const metaTableId = typeof meta.tableId === 'string' ? meta.tableId.trim() : '';
      const resolvedTableId = parsedContainerId || metaTableId || 'coin-default';
      // Se o usuário editou manualmente a coluna `_container_id` no CSV (diferente do `meta.tableId` original),
      // não herdamos `tableName` nem `tableEnvelope` estagnados da tabela antiga contidos em `_meta_json`.
      const containerChangedManually = Boolean(
        parsedContainerId && metaTableId && parsedContainerId !== metaTableId
      );

      const tableEnvelopeVal = containerChangedManually
        ? row._table_envelope_json
          ? safeJsonParse<Record<string, any> | undefined>(row._table_envelope_json, undefined)
          : undefined
        : meta.tableEnvelope && typeof meta.tableEnvelope === 'object'
        ? meta.tableEnvelope
        : row._table_envelope_json
        ? safeJsonParse<Record<string, any> | undefined>(row._table_envelope_json, undefined)
        : undefined;

      const resolvedTableName =
        row._table_name ||
        explicitContainerName ||
        (!containerChangedManually ? meta.tableName : undefined) ||
        (containerChangedManually ? parsedContainerId : undefined);

      const isTableHeaderOnly =
        type === 'header' ||
        Boolean(meta.isTableHeaderOnly) ||
        key.startsWith('__table_header__');

      coinLedgerRows.push({
        id: key || row.id || meta.id || `coin-${coinLedgerRows.length + 1}`,
        date: row.date_or_cycle || row.date || row.data || meta.date || '',
        category: row.group_or_tier || row.category || row.categoria || meta.category || 'Outros',
        description: title || row.description || row.descricao || meta.description || '',
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        entryType,
        paymentMethod: row.capabilities_or_tags || row.tags || meta.paymentMethod || 'PIX',
        status,
        recurrence:
          row.time_or_duration ||
          meta.recurrence ||
          (monthCountRaw && monthCountRaw > 1 ? `rateio_${monthCountRaw}m` : 'unico'),
        tableId: resolvedTableId,
        ...(resolvedTableName ? { tableName: String(resolvedTableName) } : {}),
        ...(isTableHeaderOnly ? { isTableHeaderOnly: true } : {}),
        ...(monthlyValueRaw !== undefined && Number.isFinite(monthlyValueRaw)
          ? { monthlyValue: monthlyValueRaw }
          : {}),
        ...(monthCountRaw !== undefined && Number.isFinite(monthCountRaw)
          ? { monthCount: monthCountRaw }
          : {}),
        ...(periodStartVal
          ? { periodStart: String(periodStartVal), period_start: String(periodStartVal) }
          : {}),
        ...(periodEndVal
          ? { periodEnd: String(periodEndVal), period_end: String(periodEndVal) }
          : {}),
        ...(row.tags || meta.tags ? { tags: row.tags || meta.tags } : {}),
        ...(tickerVal ? { ticker: String(tickerVal) } : {}),
        ...(quantityRaw !== undefined && Number.isFinite(quantityRaw)
          ? { quantity: quantityRaw }
          : {}),
        ...(unitPriceRaw !== undefined && Number.isFinite(unitPriceRaw)
          ? { unitPrice: unitPriceRaw }
          : {}),
        ...(metadataJsonVal
          ? { metadataJson: String(metadataJsonVal), metadata_json: String(metadataJsonVal) }
          : {}),
        ...(customValuesVal && typeof customValuesVal === 'object'
          ? { customValues: customValuesVal }
          : {}),
        ...(tableEnvelopeVal && typeof tableEnvelopeVal === 'object'
          ? { tableEnvelope: tableEnvelopeVal }
          : {}),
      });
    } else if (kind === 'event_node') {
      const [rawId, rawName] = containerId.includes('::')
        ? containerId.split('::')
        : [containerId || 'evt-01', containerId || 'Evento Importado'];
      const engines = (row._engines || 'custom')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);

      let ev = eventsMap.get(rawId);
      if (!ev) {
        ev = { id: rawId, name: rawName, engines, registry: [] };
        eventsMap.set(rawId, ev);
      }

      const mergedMeta: Record<string, any> = { ...meta };
      if (primary && !mergedMeta.assignedTo && !mergedMeta.workerName) {
        mergedMeta.assignedTo = primary;
      }
      if (secondary) mergedMeta.assistantTo = secondary;

      ev.registry.push({
        key,
        type,
        label: title,
        value: row.notes_or_payload || primary || '',
        email: row.contact_or_location?.includes('@') ? row.contact_or_location : '',
        meta: mergedMeta,
      });
    }
  }

  // Synchronize all discovered custom capabilities across all imported participants
  // so every participant has an explicit boolean (`true` or `false`) for every custom privilege
  if (participants.length > 0) {
    const allEffectiveCols = getEffectiveCapabilityColumns(participants);
    for (const p of participants) {
      const nextCaps: Record<string, boolean> = { ...(p.capabilities || {}) };
      for (const col of allEffectiveCols) {
        nextCaps[col.key] = Boolean(nextCaps[col.key]);
      }
      p.capabilities = nextCaps;
    }
  }

  const hasAllSheets = presentSheets.length === 0;
  const shouldFallbackParticipants =
    hasAllSheets ||
    presentSheets.includes('participant_privilege') ||
    presentSheets.includes('hub_schedule_slot');
  const shouldFallbackSchedule =
    hasAllSheets || presentSheets.includes('hub_schedule_slot');
  const shouldFallbackTerritory =
    hasAllSheets || presentSheets.includes('hub_territory_cycle');

  const resolvedParticipants =
    participants.length > 0
      ? participants
      : shouldFallbackParticipants
      ? DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
      : [];

  return {
    unitName,
    participants: resolvedParticipants,
    scheduleRegistry:
      scheduleRegistry.length > 0
        ? scheduleRegistry
        : shouldFallbackSchedule
        ? buildProgramacaoReuniaoRegistry(
            undefined,
            resolvedParticipants.length > 0
              ? resolvedParticipants
              : DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
          )
        : [],
    territoryRegistry:
      territoryRegistry.length > 0
        ? territoryRegistry
        : shouldFallbackTerritory
        ? buildTerritoriosS13HistoricalRegistry()
        : [],
    events: Array.from(eventsMap.values()),
    studioDocuments,
    hojeManifestYaml,
    hojeRituals,
    coinLedgerRows,
    presentSheets,
  };
}

/**
 * Builds a single partitioned `FlatSkeletonEntry[]` from a Multi-Engine Omni-CSV bundle
 * so that a single imported Event Container holds both `roster_assignments` (Schedule)
 * and `territory_logistics` (Territories) without key collisions.
 */
export function buildCombinedMultiEngineSkeleton(
  bundle: Partial<SekundoOmniStateBundle>
): FlatSkeletonEntry[] {
  const schedulePart = (bundle.scheduleRegistry || []).map((entry) => ({
    ...entry,
    meta: {
      ...(entry.meta || {}),
      _enginePartition: 'roster_assignments',
    },
  }));

  const territoryPart = (bundle.territoryRegistry || []).map((entry, idx) => {
    const rawOrig = (entry.meta as any)?._originalKey || entry.key.replace(/^(T::|90-)/, '');
    const numericSuffix = /^\d+(-\d+)*$/.test(rawOrig)
      ? rawOrig
      : String(idx + 1).padStart(2, '0');
    const prefixedKey = `90-${numericSuffix}`;
    return {
      ...entry,
      key: prefixedKey,
      type: entry.type || 'territory',
      meta: {
        ...(entry.meta || {}),
        _enginePartition: 'territory_logistics',
        _originalKey: rawOrig,
      },
    };
  });

  return [...schedulePart, ...territoryPart];
}

/**
 * Selects only the `FlatSkeletonEntry[]` belonging to a target Engine partition
 * (`'territory_logistics'` or `'roster_assignments'`).
 * Prevents Territory views from rendering meeting blocks as streets/houses and
 * prevents Schedule views from rendering territory blocks as meeting parts.
 */
export function selectEnginePartitionNodes(
  registry: FlatSkeletonEntry[],
  engineId: 'territory_logistics' | 'roster_assignments' | string
): FlatSkeletonEntry[] {
  if (!Array.isArray(registry) || registry.length === 0) return [];

  if (engineId === 'territory_logistics') {
    const partitionedTerritoryNodes = registry.filter((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return (
        meta._enginePartition === 'territory_logistics' ||
        e.key.startsWith('90-') ||
        e.key.startsWith('T::')
      );
    });

    if (partitionedTerritoryNodes.length > 0) {
      return partitionedTerritoryNodes.map((e) => {
        const meta = { ...(e.meta || {}) } as Record<string, any>;
        const cleanKey = meta._originalKey || e.key.replace(/^(T::|90-)/, '');
        return {
          ...e,
          key: cleanKey,
          meta,
        };
      });
    }

    const nonScheduleNodes = registry.filter((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return meta._enginePartition !== 'roster_assignments';
    });

    const hasTerritoryLeafOrPolygon = nonScheduleNodes.some((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return (
        e.type === 'territory' ||
        Boolean(meta.boundary_polygon) ||
        Boolean(meta.territory_number)
      );
    });

    if (hasTerritoryLeafOrPolygon) {
      return nonScheduleNodes;
    }

    // Check if the unpartitioned registry actually consists of Schedule/Meeting nodes
    const looksLikeSchedule = nonScheduleNodes.some((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return (
        Boolean(meta.chairPerson) ||
        Boolean(meta.openingPrayer) ||
        Boolean(meta.sessionDate) ||
        /BLOCO\s+[123]\s+—|SEMANA\s+\d+/i.test(e.label || '')
      );
    });

    if (looksLikeSchedule) {
      return [];
    }

    return nonScheduleNodes;
  }

  if (engineId === 'roster_assignments') {
    const filtered = registry.filter((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      if (meta._enginePartition === 'territory_logistics') return false;
      if (e.key.startsWith('90-') || e.key.startsWith('T::')) return false;
      if (e.type === 'territory') return false;
      return true;
    });
    return filtered;
  }

  return registry;
}

/**
 * Automatically derives all active Engine IDs contained in an imported `SekundoOmniStateBundle`.
 */
export function deriveActiveEnginesFromOmniBundle(
  bundle: Partial<SekundoOmniStateBundle>
): string[] {
  const engines = new Set<string>();
  if ((bundle.scheduleRegistry?.length || 0) > 0 || (bundle.participants?.length || 0) > 0) {
    engines.add('roster_assignments');
  }
  if ((bundle.territoryRegistry?.length || 0) > 0) {
    engines.add('territory_logistics');
  }
  for (const ev of bundle.events || []) {
    for (const eng of ev.engines || []) {
      if (eng && eng.trim()) {
        engines.add(eng.trim());
      }
    }
  }
  if ((bundle.studioDocuments?.length || 0) > 0) {
    engines.add('DocumentEngine');
  }
  if ((bundle.hojeRituals?.length || 0) > 0) {
    engines.add('action_tracker');
  }
  if ((bundle.coinLedgerRows?.length || 0) > 0) {
    engines.add('financial_ledger');
  }
  if (engines.size === 0) {
    engines.add('roster_assignments');
    engines.add('territory_logistics');
  }
  return Array.from(engines);
}

/**
 * Dedicated CSV export for `📅 Programação & WhatsApp` (`schedule-hub.tsx`).
 * Exports ONLY the requested Hub Planilhas (by default `participant_privilege`,
 * `hub_schedule_slot`, and `hub_territory_cycle`) without unrelated global sheets.
 */
export function exportScheduleHubToCsv(params: {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
  onlySheets?: OmniRecordKind[];
}): string {
  const onlySheets: OmniRecordKind[] = params.onlySheets || [
    'participant_privilege',
    'hub_schedule_slot',
    'hub_territory_cycle',
  ];
  return exportOmniCsvBundle(
    {
      unitName: params.unitName,
      participants: params.participants,
      scheduleRegistry: params.scheduleRegistry,
      territoryRegistry: params.territoryRegistry,
    },
    { onlySheets }
  );
}

/**
 * Dedicated CSV import for `📅 Programação & WhatsApp` (`schedule-hub.tsx`).
 * Accepts either:
 * 1. A Multi-Planilha Omni-CSV / Schedule Hub CSV (`#PLANILHA,...` or `_record_kind`)
 * 2. A canonical `_key,_type,label,value` CSV
 */
export function importScheduleHubFromCsv(csvText: string): {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
} {
  const { headers, rows, presentSheets } = parseRawOmniCsvTable(csvText);
  if (
    presentSheets.length > 0 ||
    headers.includes('_record_kind') ||
    headers.includes('_container_id')
  ) {
    const bundle = importOmniCsvBundle(csvText);
    return {
      unitName: bundle.unitName,
      participants: bundle.participants,
      scheduleRegistry: bundle.scheduleRegistry,
      territoryRegistry: bundle.territoryRegistry,
    };
  }

  // Support canonical `_key,_type,label,value` or human schedule CSV
  const scheduleRegistry: FlatSkeletonEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = r._key || r.key || String(i + 1).padStart(2, '0');
    const rawType = (r._type || r.tipo || 'slot').toLowerCase();
    const type: NodeType =
      rawType === 'header' || rawType === 'sessao' || rawType === 'secao'
        ? 'header'
        : 'slot';
    const label = r.label || r.parte || r.nome || r.title_or_name || `Item ${key}`;
    const primary = r.value || r.designado || r.primary_assignee || '';
    const assistant = r.assistente || r.secondary_assignee || '';
    const meta = safeJsonParse<Record<string, any>>(r._meta_json, {});
    if (primary) meta.assignedTo = primary;
    if (assistant) meta.assistantTo = assistant;
    if (r.duracao_min) meta.durationMinutes = parseInt(r.duracao_min, 10) || 10;
    if (r.sala) meta.room = r.sala;
    if (r.grupo) meta.groupTag = r.grupo;

    scheduleRegistry.push({
      key,
      type,
      label,
      value: assistant ? `${primary} / ${assistant}` : primary,
      email: r.email || '',
      meta,
    });
  }

  return {
    unitName: PROGRAMACAO_UNIT_NAME,
    participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
    scheduleRegistry:
      scheduleRegistry.length > 0
        ? scheduleRegistry
        : buildProgramacaoReuniaoRegistry(undefined, DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS),
    territoryRegistry: buildTerritoriosS13HistoricalRegistry(),
  };
}

/**
 * Generates the complete sample **CSV GERAL (`sekundo_omni_geral.csv`)** containing:
 * - All 24 Clean-Room Participants with their 26-column Privilege Matrix (`participant_privilege`)
 * - The 9-Week Schedule & WhatsApp Hub (`hub_schedule_slot`)
 * - The 16 Multi-Cycle Territories (`hub_territory_cycle`)
 * - Assistente Moeda / Engine Financeira (`coin_ledger_row` — 10 complete financial rows)
 * - Document Studio YAML ⇄ PDF Templates (`studio_document`)
 * - Cockpit Hoje & Composer (`cockpit_hoje`)
 * - Sample Events across all Universal Engines (`event_node`)
 */
export function generateOmniMasterSampleCsv(): string {
  const sampleEvents: OmniEventBundleItem[] = Object.values(ENGINE_TEMPLATES).map(
    (tpl, idx) => {
      const { rows } = parseRawOmniCsvTable(tpl.canonicalCsv);
      const registry: FlatSkeletonEntry[] = rows.map((r) => ({
        key: r._key || '01',
        type: (r._type as NodeType) || 'leaf',
        label: r.label || tpl.name,
        value: r.value || '',
        email: r.email || '',
        meta: safeJsonParse<Record<string, any>>(r._meta_json, {}),
      }));
      return {
        id: `evt-sample-${idx + 1}`,
        name: `Exemplo ${tpl.name}`,
        engines: [tpl.engineId],
        registry,
      };
    }
  );

  return exportOmniCsvBundle({
    unitName: PROGRAMACAO_UNIT_NAME,
    participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
    scheduleRegistry: buildProgramacaoReuniaoRegistry(
      undefined,
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    ),
    territoryRegistry: buildTerritoriosS13HistoricalRegistry(),
    coinLedgerRows: DEFAULT_COIN_LEDGER_ROWS,
    events: sampleEvents,
  });
}
