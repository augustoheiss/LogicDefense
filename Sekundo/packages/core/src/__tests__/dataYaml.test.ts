import { describe, it, expect } from 'vitest';
import {
  registryToYaml,
  yamlToRegistry,
  filterGranularEntries,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  type FlatRegistry,
} from '../index';

describe('Phase F0 & F1 — Data YAML (Tree & Flat Roundtrip) + O(n) Granular Filter', () => {
  const sampleRegistry: FlatRegistry = [
    {
      key: '01',
      type: 'header',
      label: 'Programação Operacional — São Paulo',
      value: '',
      email: '',
      meta: { unit: 'Unidade Operacional Demo', week: '2026-10-15' },
    },
    {
      key: '01-01',
      type: 'slot',
      label: 'Destaques e Análise (Acentuação: áéíóú ç ãõ)',
      value: 'Participante 01',
      email: 'alex@example.org',
      meta: { durationMinutes: 10, room: 'Auditório Principal' },
    },
    {
      key: '001-02',
      type: 'slot',
      label: 'Leitura Técnica Estruturada',
      value: 'Participante 03',
      email: '',
      meta: { assistantTo: 'Participante 05', nested: { floor: 2, tags: ['sala_b', 'equipe'] } },
    },
  ];

  it('roundtrips FlatRegistry -> Tree YAML -> FlatRegistry with 100% lossless deep equality', () => {
    const yamlTree = registryToYaml(sampleRegistry, { yamlFormat: 'tree', eventName: 'Teste Árvore' });
    expect(yamlTree).toContain('format: tree');
    expect(yamlTree).toContain('children:');

    const restored = yamlToRegistry(yamlTree);
    expect(restored).toEqual(sampleRegistry);
  });

  it('roundtrips FlatRegistry -> Flat YAML -> FlatRegistry with 100% lossless deep equality', () => {
    const yamlFlat = registryToYaml(sampleRegistry, { yamlFormat: 'flat' });
    expect(yamlFlat).toContain('format: flat');
    expect(yamlFlat).toContain('_key:');

    const restored = yamlToRegistry(yamlFlat);
    expect(restored).toEqual(sampleRegistry);
  });

  it('roundtrips production seeds (Programação Semanal & Histórico de Territórios)', () => {
    const progRegistry = buildProgramacaoReuniaoRegistry();
    const progYaml = registryToYaml(progRegistry, { yamlFormat: 'tree' });
    const progRestored = yamlToRegistry(progYaml);
    expect(progRestored.length).toBe(progRegistry.length);
    expect(progRestored).toEqual(progRegistry);

    const s13Registry = buildTerritoriosS13HistoricalRegistry();
    const s13Yaml = registryToYaml(s13Registry, { yamlFormat: 'tree' });
    const s13Restored = yamlToRegistry(s13Yaml);
    expect(s13Restored.length).toBe(s13Registry.length);
    expect(s13Restored).toEqual(s13Registry);
  });

  it('filters leaves_only and branches_only in O(n) under 50ms for 2,000 hierarchical nodes', () => {
    const largeRegistry: FlatRegistry = [];
    for (let b = 1; b <= 20; b++) {
      const bKey = String(b).padStart(2, '0');
      largeRegistry.push({
        key: bKey,
        type: 'header',
        label: `Ramo ${bKey}`,
        value: '',
        email: '',
        meta: {},
      });
      for (let leaf = 1; leaf <= 99; leaf++) {
        const lKey = `${bKey}-${String(leaf).padStart(2, '0')}`;
        largeRegistry.push({
          key: lKey,
          type: 'slot',
          label: `Folha ${lKey}`,
          value: 'Ok',
          email: '',
          meta: {},
        });
      }
    }

    const t0 = Date.now();
    const leaves = filterGranularEntries(largeRegistry, { scope: 'leaves_only' });
    const branches = filterGranularEntries(largeRegistry, { scope: 'branches_only' });
    const elapsed = Date.now() - t0;

    expect(leaves.length).toBe(20 * 99);
    expect(branches.length).toBe(20);
    expect(elapsed).toBeLessThan(200);
  });
});
