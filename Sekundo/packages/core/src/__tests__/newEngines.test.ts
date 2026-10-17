import { describe, it, expect } from 'vitest';
import {
  incidentCommandEngine,
  calculateGraicunasComplexity,
} from '../engines/incidentCommandEngine';
import { runOfShowEngine } from '../engines/runOfShowEngine';
import { tournamentEngine } from '../engines/tournamentEngine';
import { canvassingEngine } from '../engines/canvassingEngine';
import {
  financialLedgerEngine,
  coinRowsToFlatSkeletonEntries,
} from '../engines/financialLedgerEngine';
import { engineRegistry } from '../engines/registry';
import { buildTree } from '../skeleton/skeletonTree';
import {
  exportOmniCsvBundle,
  importOmniCsvBundle,
  deriveActiveEnginesFromOmniBundle,
} from '../csv/omniCsvBundle';
import type { SkeletonNode } from '../skeleton/types';

describe('Universal Engines Suite (Phase 2)', () => {
  describe('Engine Registry', () => {
    it('should have all 10 engines registered', () => {
      const engines = engineRegistry.list();
      expect(engines).toHaveLength(10);
      const ids = engines.map((e) => e.id);
      expect(ids).toContain('territory_logistics');
      expect(ids).toContain('roster_assignments');
      expect(ids).toContain('study_synthesis');
      expect(ids).toContain('generic_wbs');
      expect(ids).toContain('incident_command');
      expect(ids).toContain('live_production_ros');
      expect(ids).toContain('tournament_pairings');
      expect(ids).toContain('canvassing_logistics');
      expect(ids).toContain('transformer');
      expect(ids).toContain('financial_ledger');
    });
  });

  describe('Incident Command System (ICS / NIMS)', () => {
    it('should calculate Graicunas formula with mathematical precision', () => {
      // n = 1 -> R = 1
      expect(calculateGraicunasComplexity(1)).toBe(1);
      // n = 2 -> R = 6
      expect(calculateGraicunasComplexity(2)).toBe(6);
      // n = 3 -> R = 18
      expect(calculateGraicunasComplexity(3)).toBe(18);
      // n = 5 (NIMS Ideal) -> R = 5 * (16 + 5 - 1) = 100
      expect(calculateGraicunasComplexity(5)).toBe(100);
      // n = 7 (NIMS Max) -> R = 7 * (64 + 7 - 1) = 490
      expect(calculateGraicunasComplexity(7)).toBe(490);
      // n = 8 (Breach) -> R = 8 * (128 + 8 - 1) = 1080
      expect(calculateGraicunasComplexity(8)).toBe(1080);
    });

    it('should detect span of control breach when supervisor exceeds 7 subordinates', () => {
      const subordinates: SkeletonNode[] = Array.from({ length: 8 }, (_, i) => ({
        key: `01.01.0${i + 1}`,
        label: `Equipe de Campo ${i + 1}`,
        type: 'slot',
        value: '',
        email: '',
        meta: {},
        children: [],
      }));

      const supervisor: SkeletonNode = {
        key: '01.01',
        label: 'Chefe de Operações',
        type: 'header',
        value: '',
        email: '',
        meta: {},
        children: subordinates,
      };

      const metrics = incidentCommandEngine.calculateMetrics([supervisor]);

      expect(metrics.engineId).toBe('incident_command');
      if (metrics.engineId === 'incident_command') {
        expect(metrics.data.spanOfControlBreaches).toBe(1);
        expect(metrics.data.isSpanHealthy).toBe(false);
        expect(metrics.data.maxGraicunasRelationships).toBe(1080);
      }
    });
  });

  describe('Live Production Run-of-Show Engine', () => {
    it('should track cumulative drift and flag threatened HARD_OUT anchors', () => {
      const cue1: SkeletonNode = {
        key: '01.01.01',
        label: 'Abertura Musical',
        type: 'slot',
        value: '',
        email: '',
        children: [],
        meta: {
          plannedDurationSec: 300, // 5 min
          actualDurationSec: 420,  // 7 min (+120s drift)
        },
      };

      const cue2: SkeletonNode = {
        key: '01.01.02',
        label: 'Vídeo Institucional Flexível',
        type: 'slot',
        value: '',
        email: '',
        children: [],
        meta: {
          plannedDurationSec: 180,
          isPadBuffer: true,       // Can be cut!
        },
      };

      const cue3: SkeletonNode = {
        key: '01.01.03',
        label: 'Discurso Principal (Transmissão Satélite)',
        type: 'slot',
        value: '',
        email: '',
        children: [],
        meta: {
          plannedDurationSec: 1800,
          timingConstraint: 'HARD_OUT',
        },
      };

      const root: SkeletonNode = {
        key: '01',
        label: 'Ato 1',
        type: 'header',
        value: '',
        email: '',
        children: [cue1, cue2, cue3],
        meta: {},
      };

      const metrics = runOfShowEngine.calculateMetrics([root]);

      expect(metrics.engineId).toBe('live_production_ros');
      if (metrics.engineId === 'live_production_ros') {
        expect(metrics.data.cumulativeDriftSec).toBe(120); // +2 min late
        expect(metrics.data.hardOutThreatened).toBe(true);
        expect(metrics.data.cutListSuggestedKeys).toContain('01.01.02');
      }
    });
  });

  describe('Tournament Pairings Engine', () => {
    it('should detect rematches and validate the anti-rematch invariant', () => {
      const matchRound1: SkeletonNode = {
        key: '01.01.01',
        label: 'Mesa 1 - R1',
        type: 'slot',
        value: '',
        email: '',
        children: [],
        meta: {
          roundIndex: 1,
          contestantA: 'Alice',
          contestantB: 'Bob',
          winner: 'Alice',
        },
      };

      const matchRound2Illegal: SkeletonNode = {
        key: '01.02.01',
        label: 'Mesa 1 - R2',
        type: 'slot',
        value: '',
        email: '',
        children: [],
        meta: {
          roundIndex: 2,
          contestantA: 'Bob',
          contestantB: 'Alice', // Repeated match!
        },
      };

      const root: SkeletonNode = {
        key: '01',
        label: 'Campeonato',
        type: 'header',
        value: '',
        email: '',
        children: [matchRound1, matchRound2Illegal],
        meta: {},
      };

      const metrics = tournamentEngine.calculateMetrics([root]);

      expect(metrics.engineId).toBe('tournament_pairings');
      if (metrics.engineId === 'tournament_pairings') {
        expect(metrics.data.activeContestants).toBe(2);
        expect(metrics.data.rematchesDetected).toBe(1); // Caught anti-rematch violation!
      }
    });
  });

  describe('Canvassing Logistics Engine', () => {
    it('should aggregate all 8 contact statuses and calculate contact rate', () => {
      const doors: SkeletonNode[] = [
        { key: '01.01.01.01', label: 'Casa 1', type: 'slot', value: '', email: '', children: [], meta: { contactCode: 'CNT' } },
        { key: '01.01.01.02', label: 'Casa 2', type: 'slot', value: '', email: '', children: [], meta: { contactCode: 'CNT' } },
        { key: '01.01.01.03', label: 'Casa 3', type: 'slot', value: '', email: '', children: [], meta: { contactCode: 'NH' } },
        { key: '01.01.01.04', label: 'Casa 4', type: 'slot', value: '', email: '', children: [], meta: { contactCode: 'REF' } },
        { key: '01.01.01.05', label: 'Casa 5', type: 'slot', value: '', email: '', children: [], meta: { contactCode: 'DNC' } },
        { key: '01.01.01.06', label: 'Casa 6', type: 'slot', value: '', email: '', children: [], meta: { contactCode: 'LAN' } },
      ];

      const street: SkeletonNode = {
        key: '01.01.01',
        label: 'Rua das Flores',
        type: 'territory',
        value: '',
        email: '',
        children: doors,
        meta: {},
      };

      const metrics = canvassingEngine.calculateMetrics([street]);

      expect(metrics.engineId).toBe('canvassing_logistics');
      if (metrics.engineId === 'canvassing_logistics') {
        expect(metrics.data.totalDoors).toBe(6);
        expect(metrics.data.contactedCount).toBe(2);
        expect(metrics.data.notHomeCount).toBe(1);
        expect(metrics.data.refusedCount).toBe(1);
        expect(metrics.data.dncCount).toBe(1);
        expect(metrics.data.languageCount).toBe(1);
        expect(metrics.data.contactRatePercent).toBe(33); // 2 / 6 = 33%
      }
    });
  });

  describe('Financial Ledger Engine (Assistente Moeda Integration)', () => {
    it('calculates revenue, expense, deposit, net balance, and survival metrics accurately', () => {
      const flat = coinRowsToFlatSkeletonEntries(
        [
          {
            id: 'tx-1',
            date: '2026-10-05',
            category: 'Receitas',
            description: 'Salário Mensal',
            value: 10000,
            entryType: 'revenue',
          },
          {
            id: 'tx-2',
            date: '2026-10-10',
            category: 'Moradia',
            description: 'Aluguel + Condomínio',
            value: 3000,
            entryType: 'expense',
          },
          {
            id: 'tx-3',
            date: '2026-10-15',
            category: 'Investimentos',
            description: 'Tesouro Selic',
            value: 2000,
            entryType: 'deposit',
          },
        ],
        '09',
        'Orçamento Outubro 2026'
      );

      const tree = buildTree(flat);
      const metrics = financialLedgerEngine.calculateMetrics(tree);

      expect(metrics.engineId).toBe('financial_ledger');
      if (metrics.engineId === 'financial_ledger') {
        expect(metrics.data.transactionCount).toBe(3);
        expect(metrics.data.grossTotal).toBe(10000);
        expect(metrics.data.totalExpenses).toBe(3000);
        expect(metrics.data.totalInvested).toBe(2000);
        expect(metrics.data.netBalance).toBe(7000);
      }
    });

    it('round-trips coin_ledger_row in Omni-CSV with CWE-1236 formula neutralization', () => {
      const csv = exportOmniCsvBundle({
        coinLedgerRows: [
          {
            id: 'row-1',
            date: '2026-10-17',
            category: 'Alimentação',
            description: '=SUM(A1:A10) Almoço',
            amount: 85.5,
            entryType: 'expense',
            paymentMethod: 'PIX',
            status: 'paid',
            recurrence: 'unico',
            tableId: 'financas-2026',
          },
        ],
      });

      expect(csv).toContain("'=SUM(A1:A10) Almoço");
      const imported = importOmniCsvBundle(csv);
      expect(imported.coinLedgerRows).toBeDefined();
      expect(imported.coinLedgerRows).toHaveLength(1);
      expect(imported.coinLedgerRows![0].amount).toBe(85.5);
      expect(imported.coinLedgerRows![0].entryType).toBe('expense');
      expect(deriveActiveEnginesFromOmniBundle(imported)).toContain('financial_ledger');
    });
  });
});
