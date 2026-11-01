import { describe, it, expect } from 'vitest';
import {
  OMNI_CSV_HEADERS,
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
} from '../csv/omniCsvBundle';
import {
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  ensureParticipantPrivilegeMatrix,
  getEffectiveCapabilityColumns,
} from '../roster/privilegeRotationEngine';
import {
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  isSampleTerritorySeedNode,
  isSampleTerritorySeedRegistry,
  stripSampleTerritorySeedNodes,
} from '../schedule/programacaoReuniaoSeed';
import { buildTree } from '../skeleton/skeletonTree';
import { importGranularCSV } from '../csv/granularImport';
import { buildTerritoryModelCsvText } from '../territory/territoryCrudEngine';
import { extractQuadrasFromRegistry } from '../geo/quadraPolygonEngine';

describe('Sekundo Multi-Planilha Master CSV ("CSV Geral") & Single-Engine Planilha Export/Import', () => {
  it('generates a complete Multi-Planilha Master CSV covering all 7 Planilhas including Assistente Moeda (coin_ledger_row) with #PLANILHA and #ABA_PLANILHA markers', () => {
    const masterCsv = generateOmniMasterSampleCsv();
    expect(OMNI_CSV_HEADERS[0]).toBe('_container_id');
    expect(OMNI_CSV_HEADERS).not.toContain('_record_kind');
    expect(masterCsv).toContain(OMNI_CSV_HEADERS.join(','));

    // Every Planilha has #PLANILHA,<engine> at the top and #ABA_PLANILHA,<engine> at the bottom
    for (const kind of [
      'participant_privilege',
      'hub_schedule_slot',
      'hub_territory_cycle',
      'coin_ledger_row',
      'studio_document',
      'cockpit_hoje',
      'event_node',
    ]) {
      expect(masterCsv).toContain(`#PLANILHA,${kind},`);
      expect(masterCsv).toContain(`#ABA_PLANILHA,${kind},`);
    }

    const reimported = importOmniCsvBundle(masterCsv);
    expect(reimported.participants.length).toBe(24);
    expect(reimported.scheduleRegistry.length).toBeGreaterThan(80);
    expect(reimported.territoryRegistry.length).toBe(16);
    expect(reimported.coinLedgerRows?.length).toBe(10);
    expect(reimported.studioDocuments.length).toBeGreaterThanOrEqual(2);
    expect(reimported.hojeManifestYaml).toContain('sekundo.app.yaml');
    expect(reimported.hojeRituals.length).toBeGreaterThanOrEqual(2);
    expect(reimported.events.length).toBeGreaterThanOrEqual(8);
    expect(reimported.presentSheets).toEqual(
      expect.arrayContaining([
        'participant_privilege',
        'hub_schedule_slot',
        'hub_territory_cycle',
        'coin_ledger_row',
        'studio_document',
        'cockpit_hoje',
        'event_node',
      ])
    );
  });

  it('exports a single Engine Planilha with a much smaller file size than TODOS (Global Master CSV)', () => {
    const fullMasterCsv = generateOmniMasterSampleCsv();
    const onlyCoinCsv = exportSingleEngineSampleCsv('financial_ledger');
    const onlyTerritoryCsv = exportSingleEngineSampleCsv('territory_logistics');
    const onlyScheduleCsv = exportSingleEngineSampleCsv('roster_assignments');

    expect(onlyCoinCsv.length).toBeLessThan(fullMasterCsv.length / 4);
    expect(onlyTerritoryCsv.length).toBeLessThan(fullMasterCsv.length / 3);
    expect(onlyScheduleCsv.length).toBeLessThan(fullMasterCsv.length);

    expect(onlyCoinCsv).toContain('#PLANILHA,coin_ledger_row,');
    expect(onlyCoinCsv).toContain('#ABA_PLANILHA,coin_ledger_row,');
    expect(onlyCoinCsv).not.toContain('#PLANILHA,hub_territory_cycle,');
    expect(onlyCoinCsv).not.toContain('#PLANILHA,participant_privilege,');

    const parsedCoinOnly = importOmniCsvBundle(onlyCoinCsv);
    expect(parsedCoinOnly.presentSheets).toEqual(['coin_ledger_row']);
    expect(parsedCoinOnly.coinLedgerRows?.length).toBe(10);
  });

  it('allows the user to delete an entire Planilha block (#PLANILHA ... #ABA_PLANILHA) if they do not want to share it, importing only the remaining Planilhas', () => {
    const masterCsv = generateOmniMasterSampleCsv();
    const blocks = masterCsv.split('\n\n');
    expect(blocks.length).toBe(7);

    // User deletes the Assistente Moeda (`coin_ledger_row`) and Territory (`hub_territory_cycle`) Planilhas before sharing
    const filteredCsv = blocks
      .filter(
        (b) =>
          !b.includes('#PLANILHA,coin_ledger_row,') &&
          !b.includes('#PLANILHA,hub_territory_cycle,')
      )
      .join('\n\n');

    const imported = importOmniCsvBundle(filteredCsv);
    expect(imported.presentSheets).not.toContain('coin_ledger_row');
    expect(imported.presentSheets).not.toContain('hub_territory_cycle');
    expect(imported.presentSheets).toContain('participant_privilege');
    expect(imported.presentSheets).toContain('hub_schedule_slot');
    expect(imported.coinLedgerRows?.length).toBe(0);
  });

  it('performs lossless Round-Trip (Export -> Modify -> Import) for 📅 Programação & WhatsApp CSV', () => {
    const initialSchedule = buildProgramacaoReuniaoRegistry(
      undefined,
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );
    const initialTerritories = buildTerritoriosS13HistoricalRegistry();

    const modifiedSchedule = initialSchedule.map((entry) => {
      if (entry.key === '01-01-01') {
        return {
          ...entry,
          value: 'Participante 17',
          meta: {
            ...(entry.meta || {}),
            assignedTo: 'Participante 17',
            readinessState: 'ready',
            confirmed: true,
          },
        };
      }
      return entry;
    });

    const csvBackup = exportScheduleHubToCsv({
      unitName: 'Unidade Técnica Alfa',
      participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
      scheduleRegistry: modifiedSchedule,
      territoryRegistry: initialTerritories,
    });

    // Must not include unrelated global sheets
    expect(csvBackup).not.toContain('#PLANILHA,studio_document,');
    expect(csvBackup).not.toContain('#PLANILHA,event_node,');

    const restored = importScheduleHubFromCsv(csvBackup);
    expect(restored.unitName).toBe('Unidade Técnica Alfa');
    expect(restored.participants.length).toBe(24);
    expect(restored.territoryRegistry.length).toBe(16);

    const slot01 = restored.scheduleRegistry.find((e) => e.key === '01-01-01');
    expect(slot01).toBeDefined();
    expect(slot01?.value).toBe('Participante 17');
    expect((slot01?.meta as any)?.assignedTo).toBe('Participante 17');
    expect((slot01?.meta as any)?.readinessState).toBe('ready');
    expect((slot01?.meta as any)?.confirmed).toBe(true);
  });

  it('SIT-01: loads exact privileges selected in CSV (never reviving deselected preset/_meta_json privileges) and registers any custom privilege dynamically', () => {
    const sampleCsv = exportSingleEngineSampleCsv('roster_assignments');
    const lines = sampleCsv.split('\n');

    // Modify p-01 to ONLY have `cap_leitura_tecnica|Privilegio_Custom_Audio_HD` even though its _meta_json still has `cap_presidencia_sessao: true`
    const modifiedLines = lines.map((line) => {
      if (line.includes(',p-01,perfil_')) {
        const p01MetaJson = JSON.stringify({
          id: 'p-01',
          name: 'Participante 01 Editado CSV',
          capabilities: { cap_presidencia_sessao: true, cap_tema_central: true },
        }).replace(/"/g, '""');
        return `Unidade Central,p-01,perfil_a,roster_assignments,Grupo 1|coordenador_senior,2026-10-01,1,Participante 01 Editado CSV,Participante 01 Editado CSV,,integral_regular,cap_leitura_tecnica|Privilegio_Custom_Audio_HD,,,"${p01MetaJson}"`;
      }
      if (line.startsWith('#ABA_PLANILHA,participant_privilege,')) {
        // Insert a brand new participant p-99 right before the bottom #ABA_PLANILHA tab marker!
        return [
          'Unidade Central,p-99,perfil_b,roster_assignments,Grupo 2|operador_base,,0,Participante 99 (Planilha),Participante 99 (Planilha),,integral_regular,Privilegio_Custom_Audio_HD|Privilegio_Drone_Mapa,,{},"{}"',
          line,
        ].join('\n');
      }
      return line;
    });

    const bundle = importOmniCsvBundle(modifiedLines.join('\n'));
    const p01 = bundle.participants.find((p) => p.id === 'p-01')!;
    const p99 = bundle.participants.find((p) => p.id === 'p-99')!;

    expect(p01).toBeDefined();
    expect(p01.capabilities?.cap_presidencia_sessao).toBe(false);
    expect(p01.capabilities?.cap_tema_central).toBe(false);
    expect(p01.capabilities?.cap_leitura_tecnica).toBe(true);
    expect(p01.capabilities?.Privilegio_Custom_Audio_HD).toBe(true);
    expect(p01.capabilities?.Privilegio_Drone_Mapa).toBe(false);

    expect(p99).toBeDefined();
    expect(p99.capabilities?.cap_pratica_1_titular).toBe(false);
    expect(p99.capabilities?.cap_pratica_2_titular).toBe(false);
    expect(p99.capabilities?.cap_pratica_ajudante).toBe(false);
    expect(p99.capabilities?.Privilegio_Custom_Audio_HD).toBe(true);
    expect(p99.capabilities?.Privilegio_Drone_Mapa).toBe(true);

    const rehydratedP99 = ensureParticipantPrivilegeMatrix(p99);
    expect(rehydratedP99.capabilities?.cap_pratica_1_titular).toBe(false);
    expect(rehydratedP99.capabilities?.Privilegio_Custom_Audio_HD).toBe(true);

    const effectiveCols = getEffectiveCapabilityColumns(bundle.participants);
    const colKeys = effectiveCols.map((c) => c.key);
    expect(colKeys).toContain('Privilegio_Custom_Audio_HD');
    expect(colKeys).toContain('Privilegio_Drone_Mapa');
  });

  it('SIT-03: partitions Schedule and Territory nodes cleanly from a single Omni-CSV so Territory views never show meeting blocks', () => {
    const sampleCsv = generateOmniMasterSampleCsv();
    const bundle = importOmniCsvBundle(sampleCsv);

    const activeEngines = deriveActiveEnginesFromOmniBundle(bundle);
    expect(activeEngines).toContain('roster_assignments');
    expect(activeEngines).toContain('territory_logistics');
    expect(activeEngines).toContain('financial_ledger');

    const combinedSkeleton = buildCombinedMultiEngineSkeleton(bundle);
    expect(combinedSkeleton.length).toBe(
      bundle.scheduleRegistry.length + bundle.territoryRegistry.length
    );

    const treeRoots = buildTree(combinedSkeleton);
    expect(treeRoots.length).toBeGreaterThan(0);

    const extractedTerritories = selectEnginePartitionNodes(
      combinedSkeleton,
      'territory_logistics'
    );
    expect(extractedTerritories.length).toBe(16);
    expect(extractedTerritories[0].key).toBe('01');
    expect(extractedTerritories.some((t) => /BLOCO 1/i.test(t.label))).toBe(false);

    const extractedSchedule = selectEnginePartitionNodes(
      combinedSkeleton,
      'roster_assignments'
    );
    expect(extractedSchedule.length).toBe(bundle.scheduleRegistry.length);
    expect(extractedSchedule.some((s) => s.type === 'territory')).toBe(false);
  });

  it('SIT-04: demultiplexes multiple financial spreadsheets (distinct tableIds in #PLANILHA,coin_ledger_row) on round-trip without mixing values, envelopes, or dropping empty tables', () => {
    const multiTableCoinRows = [
      {
        id: 'pf-1',
        date: '2026-10-01',
        category: 'Salário',
        description: 'Pró-labore PF',
        amount: 8000,
        entryType: 'revenue' as const,
        paymentMethod: 'PIX',
        status: 'paid' as const,
        recurrence: 'mensal',
        tableId: 'coin-pessoal-01',
        tableName: 'Finanças Pessoais',
        tableEnvelope: {
          tableId: 'coin-pessoal-01',
          tableName: 'Finanças Pessoais',
          description: 'Carteira PF',
          investorProfile: { currentAge: 32, targetRetirementAge: 55 },
          goals: { dailyGoals: { '2026': 120 } },
        },
      },
      {
        id: 'pf-2',
        date: '2026-10-05',
        category: 'Moradia',
        description: 'Aluguel Residencial',
        amount: 2500,
        entryType: 'expense' as const,
        paymentMethod: 'Boleto',
        status: 'paid' as const,
        recurrence: 'mensal',
        tableId: 'coin-pessoal-01',
        tableName: 'Finanças Pessoais',
      },
      {
        id: 'pj-1',
        date: '2026-10-02',
        category: 'Faturamento',
        description: 'Receita Clínica PJ',
        amount: 22000,
        entryType: 'revenue' as const,
        paymentMethod: 'TED',
        status: 'paid' as const,
        recurrence: 'mensal',
        tableId: 'coin-empresa-02',
        tableName: 'Caixa Clínica PJ',
        tableEnvelope: {
          tableId: 'coin-empresa-02',
          tableName: 'Caixa Clínica PJ',
          description: 'Conta Empresarial',
          investorProfile: { currentAge: 45, targetRetirementAge: 65 },
          activeSectors: ['smb_accounting', 'legal_taxes'],
        },
      },
      {
        id: 'pj-2',
        date: '2026-10-10',
        category: 'Tributos',
        description: 'DAS Simples Nacional',
        amount: 3300,
        entryType: 'expense' as const,
        paymentMethod: 'Boleto',
        status: 'paid' as const,
        recurrence: 'mensal',
        tableId: 'coin-empresa-02',
        tableName: 'Caixa Clínica PJ',
      },
      {
        id: '__table_header__coin-reserva-03',
        date: '2026-10-15',
        category: 'Reserva Vazia',
        description: 'Fundo de Emergência (Sem lançamentos ainda)',
        amount: 0,
        entryType: 'unresolved' as const,
        paymentMethod: 'PIX',
        status: 'paid' as const,
        recurrence: 'unico',
        tableId: 'coin-reserva-03',
        tableName: 'Reserva Vazia',
        isTableHeaderOnly: true,
        tableEnvelope: {
          tableId: 'coin-reserva-03',
          tableName: 'Reserva Vazia',
          goals: { annualCosts: { '2026': 50000 } },
        },
      },
    ];

    const exportedCsv = exportOmniCsvBundle(
      {
        unitName: 'Unidade Multi-Moeda',
        participants: [],
        scheduleRegistry: [],
        territoryRegistry: [],
        events: [],
        studioDocuments: [],
        hojeManifestYaml: '',
        hojeRituals: [],
        coinLedgerRows: multiTableCoinRows,
      },
      { onlySheets: ['coin_ledger_row'], onlyEngineId: 'financial_ledger' }
    );

    const reimported = importOmniCsvBundle(exportedCsv);
    const partitions = groupCoinLedgerRowsByTable(reimported.coinLedgerRows);

    expect(partitions.length).toBe(3);

    const p1 = partitions[0];
    expect(p1.tableId).toBe('coin-pessoal-01');
    expect(p1.tableName).toBe('Finanças Pessoais');
    expect(p1.rows.length).toBe(2);
    expect(p1.rows.map((r) => r.amount)).toEqual([8000, 2500]);
    expect(p1.tableEnvelope?.investorProfile?.currentAge).toBe(32);

    const p2 = partitions[1];
    expect(p2.tableId).toBe('coin-empresa-02');
    expect(p2.tableName).toBe('Caixa Clínica PJ');
    expect(p2.rows.length).toBe(2);
    expect(p2.rows.map((r) => r.amount)).toEqual([22000, 3300]);
    expect(p2.tableEnvelope?.investorProfile?.currentAge).toBe(45);
    expect(p2.tableEnvelope?.activeSectors).toEqual(['smb_accounting', 'legal_taxes']);

    const p3 = partitions[2];
    expect(p3.tableId).toBe('coin-reserva-03');
    expect(p3.tableName).toBe('Reserva Vazia');
    expect(p3.rows.length).toBe(0);
    expect(p3.tableEnvelope?.goals?.annualCosts?.['2026']).toBe(50000);
  });

  it('SIT-05: respects manual _container_id edits in CSV (including tableId::tableName syntax) without leaking stale _meta_json tableName or tableEnvelope', () => {
    const singleCsv = exportSingleEngineSampleCsv('financial_ledger');
    const lines = singleCsv.split('\n');
    // Change the 3rd data row's _container_id from coin-main-01 to coin-custom-02::Carteira Filial 02
    let dataRowSeen = 0;
    const editedLines = lines.map((line) => {
      if (line.startsWith('coin-main-01,')) {
        dataRowSeen += 1;
        if (dataRowSeen >= 6) {
          return line.replace(/^coin-main-01,/, 'coin-custom-02::Carteira Filial 02,');
        }
      }
      return line;
    });

    const bundle = importOmniCsvBundle(editedLines.join('\n'));
    const partitions = groupCoinLedgerRowsByTable(bundle.coinLedgerRows);

    expect(partitions.length).toBe(2);
    expect(partitions[0].tableId).toBe('coin-main-01');
    expect(partitions[0].rows.length).toBe(5);
    expect(partitions[1].tableId).toBe('coin-custom-02');
    expect(partitions[1].tableName).toBe('Carteira Filial 02');
    expect(partitions[1].rows.length).toBe(5);
    expect(partitions[1].tableEnvelope).toBeUndefined();
  });

  it('SIT-06: detects and strips synthetic 16-territory sample seed while preserving user territory hierarchies on export/import round-trip', () => {
    const sampleSeed = buildTerritoriosS13HistoricalRegistry();
    expect(sampleSeed).toHaveLength(16);
    expect(isSampleTerritorySeedRegistry(sampleSeed)).toBe(true);
    expect(sampleSeed.every((n) => isSampleTerritorySeedNode(n))).toBe(true);

    // Even if _isSampleSeed flag is stripped (e.g. legacy exported CSV), signature detection catches it
    const legacySeedWithoutFlag = sampleSeed.map((n) => {
      const { _isSampleSeed, ...restMeta } = (n.meta || {}) as Record<string, any>;
      return { ...n, meta: restMeta };
    });
    expect(isSampleTerritorySeedRegistry(legacySeedWithoutFlag)).toBe(true);
    expect(stripSampleTerritorySeedNodes(legacySeedWithoutFlag)).toHaveLength(0);

    // Real 4-level hierarchical user territory registry (Area -> Sector -> Territory -> Address)
    const userHierarchy = [
      {
        key: '01',
        type: 'header' as const,
        label: 'Área T01 — Zona Urbana',
        value: '',
        email: '',
        meta: { territory_number: 'T01', locality: 'Zona Urbana' },
      },
      {
        key: '01-01',
        type: 'header' as const,
        label: 'Setor T01.01 — Jardim Alfa',
        value: '',
        email: '',
        meta: { territory_number: 'T01.01', locality: 'Jardim Alfa' },
      },
      {
        key: '01-01-01',
        type: 'header' as const,
        label: 'T01.01.01 — Jardim Alfa (2 endereços)',
        value: '',
        email: '',
        meta: { territory_number: 'T01.01.01', locality: 'Jardim Alfa', lat: -23.512, lng: -46.412 },
      },
      {
        key: '01-01-01-01',
        type: 'territory' as const,
        label: 'Avenida das Palmeiras, 120 (Jardim Alfa)',
        value: '',
        email: '',
        meta: {
          territory_number: 'T01.01.01',
          locality: 'Jardim Alfa',
          line: 'Avenida das Palmeiras, 120',
          city: 'Município Alfa',
          state: 'SP',
          lat: -23.5121,
          lng: -46.4121,
          worked: 1,
        },
      },
      {
        key: '01-01-01-02',
        type: 'territory' as const,
        label: 'Avenida das Palmeiras, 140 (Jardim Alfa)',
        value: '',
        email: '',
        meta: {
          territory_number: 'T01.01.01',
          locality: 'Jardim Alfa',
          line: 'Avenida das Palmeiras, 140',
          city: 'Município Alfa',
          state: 'SP',
          lat: -23.5125,
          lng: -46.4125,
          worked: 0,
        },
      },
    ];

    expect(isSampleTerritorySeedRegistry(userHierarchy)).toBe(false);
    expect(stripSampleTerritorySeedNodes([...sampleSeed, ...userHierarchy])).toEqual(userHierarchy);

    // Export -> Import Round-Trip via Omni-CSV preserves 'header' vs 'territory' node types
    const omniCsv = exportOmniCsvBundle(
      {
        unitName: 'Unidade Alfa',
        participants: [],
        scheduleRegistry: [],
        territoryRegistry: userHierarchy,
        events: [],
        studioDocuments: [],
        hojeManifestYaml: '',
        hojeRituals: [],
      },
      { onlySheets: ['hub_territory_cycle'] }
    );

    const reimported = importOmniCsvBundle(omniCsv);
    expect(reimported.presentSheets).toEqual(['hub_territory_cycle']);
    expect(reimported.territoryRegistry).toHaveLength(5);
    expect(reimported.territoryRegistry[0].type).toBe('header');
    expect(reimported.territoryRegistry[1].type).toBe('header');
    expect(reimported.territoryRegistry[2].type).toBe('header');
    expect(reimported.territoryRegistry[3].type).toBe('territory');
    expect(reimported.territoryRegistry[4].type).toBe('territory');

    const quadras = extractQuadrasFromRegistry(reimported.territoryRegistry);
    expect(quadras).toHaveLength(1);
    expect(quadras[0].territoryNumber).toBe('T01.01.01');
    expect(quadras[0].totalUnits).toBe(2);
    expect(quadras[0].workedUnits).toBe(1);
  });

  it('SIT-07: ingests 17-col canonical, 18-col external, and 19-col semicolon territory spreadsheets via importOmniCsvBundle and importGranularCSV without falling back to the 16 sample territories', () => {
    // 1. 17-column canonical territory CSV (like convert_enderecos.py output)
    const canonical17Csv = [
      '_key,_type,label,value,email,territory_number,locality,line,line2,city,state,country,property_type,lat,lng,worked,notes',
      '01,header,Área T01 — Centro,, ,T01,Centro,,,,Município Beta,SP,BR,header,-23.51,-46.41,0,',
      '01-01,header,Setor T01.01 — Centro,, ,T01.01,Centro,,,,Município Beta,SP,BR,header,-23.51,-46.41,0,',
      '01-01-01,header,T01.01.01 — Centro (1 endereços),, ,T01.01.01,Centro,,,,Município Beta,SP,BR,header,-23.51,-46.41,0,',
      '01-01-01-01,territory,"Rua Beta, 55 (Centro)",,,T01.01.01,Centro,"Rua Beta, 55",Centro,Município Beta,SP,BR,residencial,-23.5105,-46.4105,1,Portão branco',
    ].join('\n');

    const omniFrom17 = importOmniCsvBundle(canonical17Csv);
    expect(omniFrom17.presentSheets).toEqual(['hub_territory_cycle']);
    expect(isSampleTerritorySeedRegistry(omniFrom17.territoryRegistry)).toBe(false);
    expect(omniFrom17.territoryRegistry).toHaveLength(4);
    expect(omniFrom17.territoryRegistry[3].meta?.line).toBe('Rua Beta, 55');
    expect(omniFrom17.territoryRegistry[3].meta?.lat).toBe(-23.5105);
    expect(omniFrom17.territoryRegistry[3].meta?.worked).toBe(1);

    const granular17 = importGranularCSV([], canonical17Csv, { forceOverwriteState: true });
    expect(granular17.quarantinedRows).toHaveLength(0);
    expect(granular17.updatedRegistry).toHaveLength(4);

    // 2. 18-column external territory CSV (no _key or _type)
    const external18Csv = [
      'territory_number,territory_locality,line,line2,city,state,postalcode,dnc,lang,locationType,status,latitude,longitude,sortOrder,hideOnMap,lastWorked,notes,tags',
      'T02.01.01,Bairro Delta,"Rua Gama, 200",Bairro Delta,Município Delta,SP,01000-000,FALSE,,house,1,-23.521,-46.421,1,FALSE,2026-10-15,Visitado,',
    ].join('\n');

    const omniFrom18 = importOmniCsvBundle(external18Csv);
    expect(omniFrom18.presentSheets).toEqual(['hub_territory_cycle']);
    expect(isSampleTerritorySeedRegistry(omniFrom18.territoryRegistry)).toBe(false);
    expect(omniFrom18.territoryRegistry.length).toBeGreaterThanOrEqual(2);

    const granular18 = importGranularCSV([], external18Csv, { forceOverwriteState: true });
    expect(granular18.quarantinedRows).toHaveLength(0);
    expect(granular18.updatedRegistry.length).toBeGreaterThanOrEqual(4); // 01, 01-01, 01-01-01, 01-01-01-01

    // 3. 19-column semicolon Sekundo territory model CSV (modelo_territorios_*.csv)
    const model19Csv = buildTerritoryModelCsvText(omniFrom17.territoryRegistry, {
      privacySafeMode: false,
    });
    const omniFrom19 = importOmniCsvBundle(model19Csv);
    expect(omniFrom19.presentSheets).toEqual(['hub_territory_cycle']);
    expect(isSampleTerritorySeedRegistry(omniFrom19.territoryRegistry)).toBe(false);
    expect(omniFrom19.territoryRegistry.some((n) => n.label.includes('Rua Beta'))).toBe(true);

    const granular19 = importGranularCSV([], model19Csv, { forceOverwriteState: true });
    expect(granular19.quarantinedRows).toHaveLength(0);
    expect(granular19.updatedRegistry.some((n) => n.label.includes('Rua Beta'))).toBe(true);
  });
});

