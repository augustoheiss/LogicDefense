import { describe, it, expect } from 'vitest';
import {
  calculateDaysDifference,
  computeTerritoryRecencyList,
  exportGranularCSV,
  type FlatSkeletonEntry,
} from '../index';

describe('Territory Recency & Coverage Ranking', () => {
  it('calculates days difference accurately', () => {
    const fixedNow = new Date('2026-10-12T12:00:00Z');

    // Same day
    expect(calculateDaysDifference('2026-10-12', fixedNow)).toBe(0);

    // 10 days ago
    expect(calculateDaysDifference('2026-10-02', fixedNow)).toBe(10);

    // 120 days ago
    expect(calculateDaysDifference('2026-06-14', fixedNow)).toBe(120);

    // Null for empty or invalid
    expect(calculateDaysDifference('', fixedNow)).toBeNull();
    expect(calculateDaysDifference('invalid', fixedNow)).toBeNull();
  });

  it('aggregates territory units and orders by priority (incomplete first, then oldest completed)', () => {
    const fixedNow = new Date('2026-10-12T12:00:00Z');

    const sampleRegistry: FlatSkeletonEntry[] = [
      // Territory 01 (Completed 120 days ago)
      {
        key: '01-01-01',
        type: 'header',
        label: 'T01.01.01 — Centro',
        value: '',
        email: '',
        meta: { territory_number: 'T01.01.01', assignedAt: '2026-06-01', completedAt: '2026-06-14' },
      },
      {
        key: '01-01-01-01',
        type: 'territory',
        label: 'Casa 1',
        value: 'Trabalhado',
        email: '',
        meta: { territory_number: 'T01.01.01', worked: 1, completedAt: '2026-06-14' },
      },
      {
        key: '01-01-01-02',
        type: 'territory',
        label: 'Casa 2',
        value: 'Trabalhado',
        email: '',
        meta: { territory_number: 'T01.01.01', worked: 1, completedAt: '2026-06-14' },
      },

      // Territory 02 (Completed recently: 2 days ago)
      {
        key: '01-01-02',
        type: 'header',
        label: 'T01.01.02 — Bairro Novo',
        value: '',
        email: '',
        meta: { territory_number: 'T01.01.02', assignedAt: '2026-10-01', completedAt: '2026-10-10' },
      },
      {
        key: '01-01-02-01',
        type: 'territory',
        label: 'Casa 3',
        value: 'Trabalhado',
        email: '',
        meta: { territory_number: 'T01.01.02', worked: 1, completedAt: '2026-10-10' },
      },

      // Territory 03 (Pending / Not worked: 0% coverage)
      {
        key: '01-01-03',
        type: 'header',
        label: 'T01.01.03 — Vila Alta',
        value: '',
        email: '',
        meta: { territory_number: 'T01.01.03', assignedAt: '2026-10-05' },
      },
      {
        key: '01-01-03-01',
        type: 'territory',
        label: 'Casa 4',
        value: '',
        email: '',
        meta: { territory_number: 'T01.01.03', worked: 0 },
      },
    ];

    const priorityList = computeTerritoryRecencyList(sampleRegistry, 'priority_oldest_first', fixedNow);

    expect(priorityList).toHaveLength(3);

    // 1st item should be the pending/unworked territory (T01.01.03)
    expect(priorityList[0].territoryNumber).toBe('T01.01.03');
    expect(priorityList[0].isCompleted).toBe(false);
    expect(priorityList[0].daysSinceCompleted).toBeNull();

    // 2nd item should be the one completed longest ago (T01.01.01, 120 days ago)
    expect(priorityList[1].territoryNumber).toBe('T01.01.01');
    expect(priorityList[1].isCompleted).toBe(true);
    expect(priorityList[1].daysSinceCompleted).toBe(120);

    // 3rd item should be the most recently completed (T01.01.02, 2 days ago)
    expect(priorityList[2].territoryNumber).toBe('T01.01.02');
    expect(priorityList[2].isCompleted).toBe(true);
    expect(priorityList[2].daysSinceCompleted).toBe(2);

    // Test recent_first sorting
    const recentList = computeTerritoryRecencyList(sampleRegistry, 'recent_first', fixedNow);
    expect(recentList[0].territoryNumber).toBe('T01.01.02'); // 2 days ago first
    expect(recentList[1].territoryNumber).toBe('T01.01.01'); // 120 days ago second
    expect(recentList[2].territoryNumber).toBe('T01.01.03'); // Incomplete last
  });

  it('exports territory CSV with data_designacao, data_conclusao and dias_concluido', () => {
    const sampleRegistry: FlatSkeletonEntry[] = [
      {
        key: '01-01-01-01',
        type: 'territory',
        label: 'Rua das Flores, 101',
        value: 'Trabalhado',
        email: '',
        meta: {
          worked: 1,
          line: 'Rua das Flores, 101',
          lat: -23.55,
          lng: -46.63,
          workerName: 'Carlos Silva',
          assignedAt: '2026-06-01',
          completedAt: '2026-06-14',
          notes: 'Visita concluída com sucesso',
        },
      },
    ];

    const csvOutput = exportGranularCSV(sampleRegistry, {
      engineId: 'territory_logistics',
      format: 'clean_human',
    });

    expect(csvOutput).toContain('data_designacao');
    expect(csvOutput).toContain('data_conclusao');
    expect(csvOutput).toContain('dias_concluido');
    expect(csvOutput).toContain('2026-06-01');
    expect(csvOutput).toContain('2026-06-14');
  });
});
