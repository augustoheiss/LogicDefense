/**
 * Action Definitions — Assistente Moeda Command Bus
 *
 * All state mutations are expressed as serializable, discrete actions.
 * This enables deterministic undo/redo, action replay, audit logging,
 * and safe AI agent proposals.
 */

import type {
  CoinTable,
  TableRow,
  TableGoals,
  DynamicTableSchema,
  InvestorProfileConfig,
  DashboardConfig,
  SectorSimulationParams,
} from './types';

export type Action =
  | {
      type: 'ADD_TABLE';
      payload: {
        table: CoinTable;
      };
    }
  | {
      type: 'RENAME_TABLE';
      payload: {
        tableId: string;
        name: string;
      };
    }
  | {
      type: 'DELETE_TABLE';
      payload: {
        tableId: string;
      };
    }
  | {
      type: 'REORDER_TABLES';
      payload: {
        fromIndex: number;
        toIndex: number;
      };
    }
  | {
      type: 'ADD_ROWS';
      payload: {
        tableId?: string;
        tableName?: string;
        rows: TableRow[];
      };
    }
  | {
      type: 'UPDATE_ROW';
      payload: {
        tableId?: string;
        rowId: string;
        updates: Partial<TableRow>;
        previousState?: Partial<TableRow>;
      };
    }
  | {
      type: 'DELETE_ROWS';
      payload: {
        tableId?: string;
        rowIds: string[];
        deletedRowsSnapshot?: TableRow[];
      };
    }
  | {
      type: 'SET_TABLE_ROWS';
      payload: {
        tableId?: string;
        rows: TableRow[];
        previousRowsSnapshot?: TableRow[];
      };
    }
  | {
      type: 'UPDATE_GOALS';
      payload: {
        tableId?: string;
        goals: Partial<TableGoals>;
        previousGoalsSnapshot?: TableGoals;
      };
    }
  | {
      type: 'UPDATE_SECTORS';
      payload: {
        tableId?: string;
        sectors: string[];
        previousSectorsSnapshot?: string[];
      };
    }
  | {
      type: 'RENAME_CATEGORY';
      payload: {
        tableId?: string;
        oldCategory: string;
        newCategory: string;
        entryType?: string;
      };
    }
  | {
      type: 'UPDATE_TABLE_SCHEMA';
      payload: {
        tableId?: string;
        schema: DynamicTableSchema;
        previousSchemaSnapshot?: DynamicTableSchema;
      };
    }
  | {
      type: 'UPDATE_INVESTOR_PROFILE';
      payload: {
        tableId?: string;
        profile: InvestorProfileConfig;
        previousProfileSnapshot?: InvestorProfileConfig;
      };
    }
  | {
      type: 'UPDATE_DASHBOARD_CONFIG';
      payload: {
        tableId?: string;
        dashboardConfig: DashboardConfig;
        previousConfigSnapshot?: DashboardConfig;
      };
    }
  | {
      type: 'UPDATE_SECTOR_PARAMS';
      payload: {
        tableId?: string;
        sectorParams: SectorSimulationParams;
        previousParamsSnapshot?: SectorSimulationParams;
      };
    };
