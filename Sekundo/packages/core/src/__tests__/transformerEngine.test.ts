import { describe, it, expect } from 'vitest';
import {
  transformerEngine,
  calculateTransformerMetrics,
  DEFAULT_TRANSFORMER_CONFIG,
  type TransformerConfig,
  type SkeletonNode,
  engineRegistry,
  exportGranularCSV,
  importGranularCSV,
  detectEnginesFromCSV,
  getEngineTemplate,
} from '../index';

describe('Engine Transformer (Metamórfica & Universal)', () => {
  const sampleTree: SkeletonNode[] = [
    {
      key: '01',
      type: 'header',
      label: 'Convenção Central',
      value: '',
      email: '',
      meta: {},
      children: [
        {
          key: '01-01',
          type: 'slot',
          label: 'Abertura & Instruções',
          value: '',
          email: '',
          meta: {
            responsavel: 'Participante 01',
            horario_inicio: '09:00',
            duracao_planejada_seg: 600,
            duracao_real_seg: 720, // +120s drift
            estimativa_horas: 4,
            progresso_pct: 100,
            trabalhado: 1,
            endereco: 'Av Paulista, 1000',
            lat: -23.55052,
            lng: -46.6333,
          },
          children: [],
        },
        {
          key: '01-02',
          type: 'slot',
          label: 'Mesa Redonda Sala B',
          value: '',
          email: '',
          meta: {
            responsavel: 'Participante 01', // Double booking with 01-01 at 09:00!
            horario_inicio: '09:00',
            duracao_planejada_seg: 1800,
            duracao_real_seg: 1800,
            estimativa_horas: 8,
            progresso_pct: 25,
            trabalhado: 0,
            endereco: 'Av Paulista, 1050',
            lat: -23.5512,
            lng: -46.6341,
          },
          children: [],
        },
        {
          key: '01-03',
          type: 'slot',
          label: 'Encerramento Geral',
          value: '',
          email: '',
          meta: {
            responsavel: 'Participante 02',
            horario_inicio: '11:00',
            duracao_planejada_seg: 900,
            duracao_real_seg: 900,
            ancora_hard: 'HARD_OUT',
            estimativa_horas: 2,
            progresso_pct: 0,
            trabalhado: 0,
          },
          children: [],
        },
      ],
    },
  ];

  it('is registered in EngineRegistry as transformer', () => {
    const engine = engineRegistry.get('transformer');
    expect(engine).toBeDefined();
    expect(engine.id).toBe('transformer');
    expect(engine.name).toContain('Transformer');
  });

  it('has valid template in engineTemplates', () => {
    const tpl = getEngineTemplate('transformer');
    expect(tpl).toBeDefined();
    expect(tpl.engineId).toBe('transformer');
    expect(tpl.cleanHumanCsv).toContain('responsavel');
  });

  describe('On-Demand Mathematical Modules', () => {
    it('executes coverage_rollup when active and computes coverage %', () => {
      const config: TransformerConfig = {
        customFields: ['trabalhado'],
        activeMathModules: ['coverage_rollup'],
      };

      const metrics = calculateTransformerMetrics(sampleTree, config);
      expect(metrics.activeModules).toContain('coverage_rollup');
      expect(metrics.moduleResults.coverage_rollup).toBeDefined();
      expect(metrics.moduleResults.coverage_rollup.totalUnits).toBe(3);
      expect(metrics.moduleResults.coverage_rollup.workedUnits).toBe(1);
      expect(metrics.moduleResults.coverage_rollup.coveragePercent).toBe(33.3);
      expect(metrics.summaryBadges.some((b) => b.id === 'coverage_pct')).toBe(true);
    });

    it('detects roster double-booking conflicts when roster_conflicts is active', () => {
      const config: TransformerConfig = {
        customFields: ['responsavel', 'horario_inicio'],
        activeMathModules: ['roster_conflicts'],
      };

      const metrics = calculateTransformerMetrics(sampleTree, config);
      expect(metrics.activeModules).toContain('roster_conflicts');
      expect(metrics.moduleResults.roster_conflicts.conflictsDetected).toBe(1);
      expect(metrics.alerts.some((a) => a.title.includes('Double-Booking: Participante 01'))).toBe(true);
    });

    it('does NOT run roster_conflicts when it is toggled OFF', () => {
      const config: TransformerConfig = {
        customFields: ['responsavel'],
        activeMathModules: ['coverage_rollup'], // roster_conflicts not included
      };

      const metrics = calculateTransformerMetrics(sampleTree, config);
      expect(metrics.activeModules).not.toContain('roster_conflicts');
      expect(metrics.moduleResults.roster_conflicts).toBeUndefined();
      expect(metrics.alerts.some((a) => a.title.includes('Double-Booking'))).toBe(false);
    });

    it('computes Run-of-Show drift and flags HARD_OUT threat', () => {
      const config: TransformerConfig = {
        customFields: ['duracao_planejada_seg', 'duracao_real_seg'],
        activeMathModules: ['run_of_show_timing'],
        parameters: { timingWarningDriftSec: 60 },
      };

      const metrics = calculateTransformerMetrics(sampleTree, config);
      expect(metrics.moduleResults.run_of_show_timing.cumulativeDriftSec).toBe(120); // +120s drift
      expect(metrics.moduleResults.run_of_show_timing.hardOutThreatened).toBe(true);
      expect(metrics.alerts.some((a) => a.id === 'hard_out_breach')).toBe(true);
      expect(metrics.alerts.some((a) => a.id === 'ros_drift_warning')).toBe(true);
    });

    it('computes Graicunas Cognitive Span formula on wide trees', () => {
      // Tree with 8 direct children under one supervisor
      const wideTree: SkeletonNode[] = [
        {
          key: '01',
          type: 'header',
          label: 'Comandante Supremo',
          value: '',
          email: '',
          meta: {},
          children: Array.from({ length: 8 }, (_, i) => ({
            key: `01-0${i + 1}`,
            type: 'slot',
            label: `Divisão ${i + 1}`,
            value: '',
            email: '',
            meta: {},
            children: [],
          })),
        },
      ];

      const config: TransformerConfig = {
        customFields: [],
        activeMathModules: ['graicunas_span'],
        parameters: { maxSpanOfControl: 7 },
      };

      const metrics = calculateTransformerMetrics(wideTree, config);
      expect(metrics.moduleResults.graicunas_span.spanBreaches).toBe(1);
      expect(metrics.alerts.some((a) => a.id === 'graicunas_overload')).toBe(true);
    });

    it('computes Weighted WBS progress correctly', () => {
      const config: TransformerConfig = {
        customFields: ['estimativa_horas', 'progresso_pct'],
        activeMathModules: ['weighted_wbs'],
      };

      // 01-01: 4h * 100% = 4
      // 01-02: 8h * 25% = 2
      // 01-03: 2h * 0% = 0
      // Total hours: 14h. Weighted sum: 6h. 6/14 = 42.9%
      const metrics = calculateTransformerMetrics(sampleTree, config);
      expect(metrics.moduleResults.weighted_wbs.totalEstimatedHours).toBe(14);
      expect(metrics.moduleResults.weighted_wbs.weightedProgressPercent).toBe(42.9);
      expect(metrics.summaryBadges.some((b) => b.id === 'wbs_weighted_progress')).toBe(true);
    });

    it('computes Geo Proximity coordinates', () => {
      const config: TransformerConfig = {
        customFields: ['latitude', 'longitude'],
        activeMathModules: ['geo_proximity'],
      };

      const metrics = calculateTransformerMetrics(sampleTree, config);
      expect(metrics.moduleResults.geo_proximity.validGeoPoints).toBe(2);
      expect(metrics.moduleResults.geo_proximity.missingGeoPoints).toBe(1);
      expect(metrics.moduleResults.geo_proximity.centerLat).toBeCloseTo(-23.55086, 3);
    });
  });

  describe('Custom Columns Schema & Granular Export', () => {
    it('exports CSV with exactly the custom fields chosen by the user', () => {
      const customConfig: TransformerConfig = {
        customFields: ['responsavel', 'duracao_min', 'veiculo', 'observacoes'],
        activeMathModules: ['roster_conflicts'],
      };

      const csv = exportGranularCSV(sampleTree, {
        engineId: 'transformer',
        format: 'clean_human',
        delimiter: ';',
        transformerConfig: customConfig,
      });

      const firstLine = csv.split('\n')[0];
      expect(firstLine).toBe('key;tipo;nome;responsavel;duracao_min;veiculo;observacoes');
      expect(csv).toContain('Participante 01');
    });

    it('imports CSV containing custom columns and stores them directly into node metadata', () => {
      const customCsv = `key,tipo,nome,responsavel,duracao_min,veiculo,pontos
01,root,Evento Global,,,,
01-01,leaf,Operação Sul,Participante 01,45,Van Alpha,100
01-02,leaf,Operação Norte,Participante 02,30,Moto Beta,80`;

      const res = importGranularCSV([], customCsv);
      expect(res.quarantinedRows).toHaveLength(0);
      expect(res.validRows).toHaveLength(3);

      const row0101 = res.validRows.find((r) => r._key === '01-01');
      expect(row0101?.responsavel).toBe('Participante 01');
      expect(row0101?.veiculo).toBe('Van Alpha');
      expect(row0101?.pontos).toBe('100');
    });
  });

  describe('Transformer Engine Auto-Detection', () => {
    it('detects transformer engine when CSV contains multi-domain attributes or explicit keywords', () => {
      const compositeCsv = `key,tipo,nome,endereco,latitude,longitude,responsavel,horario_inicio,duracao_planejada_seg
01,raiz,Geral,,,,,,
01-01,item,Ponto 1,"Rua X, 10",-23.5,-46.6,Participante 01,09:00,300`;

      const report = detectEnginesFromCSV(compositeCsv);
      const transformerMatch = report.matches.find((m) => m.engineId === 'transformer');
      expect(transformerMatch).toBeDefined();
      expect(transformerMatch!.confidence).toBeGreaterThanOrEqual(45);
      expect(report.suggestedEngines).toContain('transformer');
    });
  });
});
