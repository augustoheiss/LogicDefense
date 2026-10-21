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
} from '../schedule/programacaoReuniaoSeed';
import { buildTree } from '../skeleton/skeletonTree';

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
});

