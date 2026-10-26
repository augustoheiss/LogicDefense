import { describe, it, expect } from 'vitest';
import {
  extractTerritorySummaries,
  renameOrRenumberTerritory,
  createTerritoryOrQuadra,
  createAddressInTerritory,
  updateSingleNodeInCleanRegistry,
  deleteTerritoryOrQuadra,
  transferAddressesBetweenTerritories,
  mergeTerritoryPartitionIntoRawRegistry,
  buildTerritoryModelCsvText,
  formatShareAddressLocationText,
  formatShareTerritoryOrQuadraLocationsText,
} from '../territoryCrudEngine';
import { buildTerritoriosS13HistoricalRegistry } from '../../schedule/programacaoReuniaoSeed';
import { resolveTerritoryNumber } from '../../geo/geoUtils';
import { selectEnginePartitionNodes } from '../../csv/omniCsvBundle';
import type { FlatSkeletonEntry } from '../../skeleton/types';

describe('territoryCrudEngine', () => {
  it('extracts territory summaries from territory seed registry', () => {
    const seed = buildTerritoriosS13HistoricalRegistry();
    const summaries = extractTerritorySummaries(seed);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0].territoryNumber).toBeTruthy();
    expect(summaries[0].totalAddresses).toBeGreaterThan(0);
  });

  it('renames and renumbers a territory in cascade across header and all child address nodes', () => {
    const created = createTerritoryOrQuadra([], {
      territoryNumber: '01',
      territoryName: 'Centro Antigo',
      city: 'São Paulo',
      initialAddress: {
        street: 'Rua Direita',
        number: '10',
      },
    });
    const withMore = createAddressInTerritory(created.nodes, {
      territoryNumber: '01',
      groupKey: created.headerKey,
      street: 'Rua Quitanda',
      number: '25',
    });

    const originalCount = withMore.nodes.filter((n) => resolveTerritoryNumber(n) === '01').length;
    expect(originalCount).toBe(3);

    const updated = renameOrRenumberTerritory(withMore.nodes, '01', {
      newTerritoryNumber: '88',
      newTerritoryName: 'Jardim das Oliveiras',
      newCity: 'Campinas',
    });

    const oldRemaining = updated.filter((n) => resolveTerritoryNumber(n) === '01');
    expect(oldRemaining.length).toBe(0);

    const newNodes = updated.filter((n) => resolveTerritoryNumber(n) === '88');
    expect(newNodes.length).toBe(3);
    for (const node of newNodes) {
      expect(node.meta?.territory_number).toBe('88');
      expect(node.meta?.locality).toBe('Jardim das Oliveiras');
      expect(node.meta?.city).toBe('Campinas');
    }
  });

  it('creates a new territory with initial quadra and address and adds further addresses', () => {
    const base: FlatSkeletonEntry[] = [];
    const created = createTerritoryOrQuadra(base, {
      territoryNumber: '5',
      territoryName: 'Vila Mariana',
      city: 'São Paulo',
      initialAddress: {
        street: 'Rua Domingos de Morais',
        number: '1200',
        lat: -23.5881,
        lng: -46.6368,
        notes: 'Portaria 24h',
      },
    });

    expect(created.nodes.length).toBe(2);
    expect(created.nodes[0].type).toBe('header');
    expect(created.nodes[1].type).toBe('territory');
    expect(resolveTerritoryNumber(created.nodes[0])).toBe('05');
    expect(resolveTerritoryNumber(created.nodes[1])).toBe('05');
    expect(created.nodes[1].meta?.line).toBe('Rua Domingos de Morais, 1200');

    const withSecondAddr = createAddressInTerritory(created.nodes, {
      territoryNumber: '05',
      groupKey: created.headerKey,
      street: 'Rua Pelotas',
      number: '450',
      notes: 'Tocar interfone 12',
    });

    expect(withSecondAddr.nodes.length).toBe(3);
    expect(withSecondAddr.createdKey).toBe(`${created.headerKey}-02`);
  });

  it('updates a single node in clean registry and deletes a quadra or territory cleanly', () => {
    const created = createTerritoryOrQuadra([], {
      territoryNumber: '12',
      territoryName: 'Centro Histórico',
    });

    const modified = updateSingleNodeInCleanRegistry(created.nodes, created.addressKey, {
      label: 'Praça da Sé, 10',
      meta: {
        territory_number: '15',
        locality: 'Sé Nova',
      },
    });

    const target = modified.find((n) => n.key === created.addressKey);
    expect(target?.label).toBe('Praça da Sé, 10');
    expect(target?.meta?.territory_number).toBe('15');
    expect(target?.meta?.locality).toBe('Sé Nova');

    const afterDelete = deleteTerritoryOrQuadra(modified, { territoryNumber: '15' });
    expect(afterDelete.some((n) => n.key === created.addressKey)).toBe(false);
  });

  it('reconciles territory partition into multi-engine rawRegistry without corrupting roster_assignments', () => {
    const rawMultiEngine: FlatSkeletonEntry[] = [
      {
        key: '01-01',
        type: 'slot',
        label: 'Presidente da Reunião',
        value: 'Participante 05',
        email: '',
        meta: { engine_id: 'roster_assignments', _originalKey: '01' },
      },
      {
        key: '90-01',
        type: 'header',
        label: 'Território 01 Antigo',
        value: '',
        email: '',
        meta: { engine_id: 'territory_logistics', territory_number: '01', _originalKey: '01' },
      },
      {
        key: '90-01-01',
        type: 'territory',
        label: 'Rua A, 10',
        value: '',
        email: '',
        meta: { engine_id: 'territory_logistics', territory_number: '01', _originalKey: '01-01' },
      },
    ];

    const cleanPartition = selectEnginePartitionNodes(rawMultiEngine, 'territory_logistics');
    const renamedClean = renameOrRenumberTerritory(cleanPartition, '01', {
      newTerritoryNumber: '09',
      newTerritoryName: 'Bairro Novo',
    });

    const mergedRaw = mergeTerritoryPartitionIntoRawRegistry(rawMultiEngine, renamedClean);

    // Roster node must remain untouched
    const rosterNode = mergedRaw.find((n) => n.key === '01-01');
    expect(rosterNode?.value).toBe('Participante 05');

    // Territory nodes must be updated and keep 90- prefix
    const reExtracted = selectEnginePartitionNodes(mergedRaw, 'territory_logistics');
    expect(reExtracted.length).toBe(2);
    expect(resolveTerritoryNumber(reExtracted[0])).toBe('09');
    expect(reExtracted[0].meta?.locality).toBe('Bairro Novo');
  });

  it('builds CSV model text and zero-bureaucracy share messages with Google Maps links', () => {
    const created = createTerritoryOrQuadra([], {
      territoryNumber: '03',
      territoryName: 'Jardim Europa',
      city: 'São Paulo',
      initialAddress: {
        street: 'Av. Europa',
        number: '500',
        lat: -23.5733,
        lng: -46.6752,
        notes: 'Interfone 42 confidencial',
      },
    });

    const csv = buildTerritoryModelCsvText(created.nodes);
    expect(csv).toContain('Jardim Europa');
    expect(csv).toContain('Av. Europa');

    const addrShare = formatShareAddressLocationText(created.nodes[1]);
    expect(addrShare.text).toContain('Território 03 — Jardim Europa');
    expect(addrShare.text).not.toContain('Interfone 42 confidencial');
    expect(addrShare.mapsUrl).toContain('google.com/maps');
    expect(addrShare.whatsappUrl).toContain('wa.me');

    const addrShareWithNotes = formatShareAddressLocationText(created.nodes[1], undefined, {
      includeNotes: true,
    });
    expect(addrShareWithNotes.text).toContain('Interfone 42 confidencial');

    const terrShare = formatShareTerritoryOrQuadraLocationsText({
      territoryNumber: '03',
      territoryName: 'Jardim Europa',
      items: created.nodes,
    });
    expect(terrShare.text).toContain('Av. Europa, 500');
    expect(terrShare.mapsUrl).toContain('google.com/maps');
  });

  it('transfers a single address or all addresses from one territory to another and updates CSV export', () => {
    const t1 = createTerritoryOrQuadra([], {
      territoryNumber: '01',
      territoryName: 'Bairro Origem',
      city: 'São Paulo',
      initialAddress: {
        street: 'Rua Alfa',
        number: '100',
        lat: -23.5505,
        lng: -46.6333,
        notes: 'Portão Azul',
      },
    });
    const t1More = createAddressInTerritory(t1.nodes, {
      territoryNumber: '01',
      groupKey: t1.headerKey,
      street: 'Rua Beta',
      number: '200',
      notes: 'Casa de esquina',
    });
    const t1AndT2 = createTerritoryOrQuadra(t1More.nodes, {
      territoryNumber: '02',
      territoryName: 'Bairro Destino',
      city: 'Guarulhos',
      initialAddress: {
        street: 'Rua Gama',
        number: '300',
      },
    });

    // 1. Transfer a single address (Rua Alfa, 100) from Territory 01 to Territory 02
    const singleTransfer = transferAddressesBetweenTerritories(t1AndT2.nodes, {
      mode: 'single',
      sourceNodeKeys: [t1.addressKey],
      destinationTerritoryNumber: '02',
    });

    expect(singleTransfer.transferredCount).toBe(1);
    expect(singleTransfer.destinationTerritoryNumber).toBe('02');
    expect(singleTransfer.newKeys.length).toBe(1);

    const summariesAfterSingle = extractTerritorySummaries(singleTransfer.nodes);
    const s1 = summariesAfterSingle.find((s) => s.territoryNumber === '01');
    const s2 = summariesAfterSingle.find((s) => s.territoryNumber === '02');
    expect(s1?.totalAddresses).toBe(1); // Only Rua Beta remains in T01
    expect(s2?.totalAddresses).toBe(2); // Rua Gama + transferred Rua Alfa in T02

    const movedNode = singleTransfer.nodes.find((n) => n.key === singleTransfer.newKeys[0]);
    expect(movedNode).toBeDefined();
    expect(resolveTerritoryNumber(movedNode!)).toBe('02');
    expect(movedNode?.meta?.territory_name).toBe('Bairro Destino');
    expect(movedNode?.meta?.street).toBe('Rua Alfa');
    expect(movedNode?.meta?.notes).toBe('Portão Azul');

    // 2. Transfer ALL remaining addresses from Territory 01 to Territory 02
    const bulkTransfer = transferAddressesBetweenTerritories(singleTransfer.nodes, {
      mode: 'all_from_territory',
      sourceTerritoryNumber: '01',
      destinationTerritoryNumber: '02',
      emptySourcePolicy: 'keep_header',
    });

    expect(bulkTransfer.transferredCount).toBe(1);
    const summariesAfterBulk = extractTerritorySummaries(bulkTransfer.nodes);
    const s1AfterBulk = summariesAfterBulk.find((s) => s.territoryNumber === '01');
    const s2AfterBulk = summariesAfterBulk.find((s) => s.territoryNumber === '02');
    expect(s1AfterBulk?.totalAddresses).toBe(0); // T01 kept as empty header
    expect(s2AfterBulk?.totalAddresses).toBe(3); // All 3 addresses now in T02

    // 3. Verify CSV export has all 3 addresses under Territory 02 and zero ghost rows for empty Territory 01
    const csvText = buildTerritoryModelCsvText(bulkTransfer.nodes);
    const csvLines = csvText.trim().split('\n');
    expect(csvLines.length).toBe(4); // 1 header line + 3 address rows
    expect(csvText).toContain(';02;Bairro Destino;');
    expect(csvText).toContain('Rua Alfa');
    expect(csvText).toContain('Rua Beta');
    expect(csvText).toContain('Rua Gama');
    expect(csvText).not.toContain(';01;Bairro Origem;');
  });
});
