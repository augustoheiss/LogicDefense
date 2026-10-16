import { describe, it, expect } from 'vitest';
import type { SkeletonNode } from '../skeleton/types';
import {
  engineRegistry,
  territoryEngine,
  calculateTerritoryMetrics,
  toggleNodeWorkStatusRecursively,
  getSubtreeCoverage,
  rosterEngine,
  calculateRosterMetrics,
  studySynthesisEngine,
  calculateStudyMetrics,
  generateExecutiveSummary,
} from '../engines';

describe('Sekundo Universal Engines', () => {
  // -------------------------------------------------------------------------
  // 1. Territory & Logistics Engine
  // -------------------------------------------------------------------------
  describe('TerritoryEngine', () => {
    // Tree: Território (01) -> Quadra (01-01) -> Rua (01-01-01) -> Casa 10 (01-01-01-01) & Casa 20 (01-01-01-02)
    const createSampleTerritoryTree = (): SkeletonNode[] => [
      {
        key: '01',
        type: 'header',
        label: 'Cidade Metropolitana',
        value: '',
        email: '',
        meta: {},
        children: [
          {
            key: '01-01',
            type: 'header',
            label: 'Centro',
            value: '',
            email: '',
            meta: {},
            children: [
              {
                key: '01-01-01',
                type: 'territory',
                label: 'Quadra 01',
                value: '',
                email: '',
                meta: {},
                children: [
                  {
                    key: '01-01-01-01',
                    type: 'territory',
                    label: 'Rua 15 de Novembro',
                    value: '',
                    email: '',
                    meta: {},
                    children: [
                      {
                        key: '01-01-01-01-01',
                        type: 'slot',
                        label: 'Casa 10',
                        value: '',
                        email: '',
                        meta: { worked: 0, address: 'Rua 15 de Novembro, 10' },
                        children: [],
                      },
                      {
                        key: '01-01-01-01-02',
                        type: 'slot',
                        label: 'Casa 20',
                        value: '',
                        email: '',
                        meta: { worked: 1, address: 'Rua 15 de Novembro, 20' },
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    it('calculates territory metrics accurately', () => {
      const tree = createSampleTerritoryTree();
      const metrics = calculateTerritoryMetrics(tree);

      expect(metrics.totalUnits).toBe(2);
      expect(metrics.workedUnits).toBe(1);
      expect(metrics.coveragePercent).toBe(50.0);
      expect(metrics.isFullyWorked).toBe(false);
      expect(metrics.quadrasCount).toBe(1);
      expect(metrics.streetsCount).toBe(1);
    });

    it('recursively toggles work status top-down for an entire quadra or street', () => {
      const tree = createSampleTerritoryTree();

      // Mark the entire street (01-01-01-01) as worked = 1
      const updatedTree = toggleNodeWorkStatusRecursively(
        tree,
        '01-01-01-01',
        1,
        'Alex Nogueira'
      );

      const metrics = calculateTerritoryMetrics(updatedTree);
      expect(metrics.workedUnits).toBe(2);
      expect(metrics.coveragePercent).toBe(100.0);
      expect(metrics.isFullyWorked).toBe(true);

      // Verify individual leaf has worker name and status 1
      const leaf1 = updatedTree[0].children[0].children[0].children[0].children[0];
      expect(leaf1.meta.worked).toBe(1);
      expect(leaf1.meta.workerName).toBe('Alex Nogueira');
    });

    it('calculates subtree coverage for a specific block', () => {
      const tree = createSampleTerritoryTree();
      const quadraNode = tree[0].children[0].children[0];

      const coverage = getSubtreeCoverage(quadraNode);
      expect(coverage.totalUnits).toBe(2);
      expect(coverage.workedUnits).toBe(1);
      expect(coverage.percent).toBe(50.0);
    });

    it('validates territory nodes and rejects invalid worked flag', () => {
      const invalidNode: SkeletonNode = {
        key: '01-01',
        type: 'slot',
        label: 'Casa Teste',
        value: '',
        email: '',
        meta: { worked: 5 as any }, // Invalid! Must be 0 or 1
        children: [],
      };

      const result = territoryEngine.validateNode(invalidNode);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Roster & Assignments Engine
  // -------------------------------------------------------------------------
  describe('RosterEngine', () => {
    const createSampleRosterTree = (): SkeletonNode[] => [
      {
        key: '01',
        type: 'header',
        label: 'Programação Operacional Semanal',
        value: '',
        email: '',
        meta: {},
        children: [
          {
            key: '01-01',
            type: 'slot',
            label: 'Coordenação',
            value: 'Bianca Moreira',
            email: 'bianca@exemplo.org',
            meta: { confirmed: true, durationMinutes: 5 },
            children: [],
          },
          {
            key: '01-02',
            type: 'slot',
            label: 'Exposição Principal',
            value: 'Caio Cavalcanti',
            email: 'caio@exemplo.org',
            meta: { confirmed: false, durationMinutes: 30 },
            children: [],
          },
          {
            key: '01-03',
            type: 'slot',
            label: 'Relatoria',
            value: '', // Unassigned!
            email: '',
            meta: {},
            children: [],
          },
        ],
      },
    ];

    it('calculates assignment and fulfillment metrics', () => {
      const tree = createSampleRosterTree();
      const metrics = calculateRosterMetrics(tree);

      expect(metrics.totalSlots).toBe(3);
      expect(metrics.assignedSlots).toBe(2);
      expect(metrics.confirmedSlots).toBe(1);
      expect(metrics.unassignedSlots).toBe(1);
      expect(metrics.fulfillmentPercent).toBe(66.7);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Study Plan & Synthesis Engine
  // -------------------------------------------------------------------------
  describe('StudySynthesisEngine', () => {
    const createSampleStudyTree = (): SkeletonNode[] => [
      {
        key: '01',
        type: 'header',
        label: 'Projeto de Pesquisa: Sekundo Architecture',
        value: '',
        email: '',
        meta: {},
        children: [
          {
            key: '01-01',
            type: 'header',
            label: 'Módulo 1: Fundamentos Local-First',
            value: '',
            email: '',
            meta: {},
            children: [
              {
                key: '01-01-01',
                type: 'slot',
                label: 'Tópico: Armazenamento Offline e IndexedDB',
                value: 'Concluído com sucesso',
                email: 'pesquisador@sekundo.app',
                meta: {
                  researcherName: 'Dr. Lucas',
                  status: 'submitted',
                  synthesisText:
                    'O IndexedDB oferece capacidade superior a 50MB no browser, eliminando os gargalos do localStorage.',
                  keyFindings: [
                    'Zero quota errors em dados geoespaciais',
                    'Transações atômicas nativas',
                  ],
                  references: ['W3C IndexedDB Spec', 'Local-First Software Manifesto'],
                },
                children: [],
              },
              {
                key: '01-01-02',
                type: 'slot',
                label: 'Tópico: Algoritmos de Rollup Booleano',
                value: '',
                email: '',
                meta: {
                  researcherName: 'Ana',
                  status: 'in_progress',
                },
                children: [],
              },
            ],
          },
        ],
      },
    ];

    it('calculates completion metrics for research topics', () => {
      const tree = createSampleStudyTree();
      const metrics = calculateStudyMetrics(tree);

      expect(metrics.totalTopics).toBe(2);
      expect(metrics.submittedCount).toBe(1);
      expect(metrics.pendingCount).toBe(1);
      expect(metrics.completionPercent).toBe(50.0);
    });

    it('compiles a structured Executive Summary markdown for the organizer', () => {
      const tree = createSampleStudyTree();
      const markdown = generateExecutiveSummary(tree, 'Sekundo Architecture');

      expect(markdown).toContain('# 📚 Resumo Executivo Consolidado — Sekundo Architecture');
      expect(markdown).toContain('Dr. Lucas');
      expect(markdown).toContain('O IndexedDB oferece capacidade superior a 50MB');
      expect(markdown).toContain('Zero quota errors em dados geoespaciais');
      expect(markdown).toContain('W3C IndexedDB Spec');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Engine Registry
  // -------------------------------------------------------------------------
  describe('EngineRegistry', () => {
    it('provides all 9 core engines', () => {
      const engines = engineRegistry.list();
      expect(engines.length).toBe(9);

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
    });

    it('retrieves specific engines and falls back safely', () => {
      const territory = engineRegistry.get('territory_logistics');
      expect(territory.id).toBe('territory_logistics');

      const fallback = engineRegistry.get('non_existent_engine');
      expect(fallback.id).toBe('generic_wbs');
    });

    it('executes batch tree validation', () => {
      const invalidTree: SkeletonNode[] = [
        {
          key: '01',
          type: 'slot',
          label: 'Item',
          value: '',
          email: '',
          meta: { worked: 99 as any },
          children: [],
        },
      ];

      const validation = engineRegistry.validateTree('territory_logistics', invalidTree);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].key).toBe('01');
    });
  });
});
