import { describe, it, expect } from 'vitest';
import {
  OMNI_CSV_HEADERS,
  exportOmniCsvBundle,
  importOmniCsvBundle,
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

describe('Sekundo Unified Master CSV ("CSV Geral" / Omni-CSV Bundle) & Schedule Hub CSV Round-Trip', () => {
  it('generates a complete Master Omni-CSV covering all 9 Engines + 3 Flagship Hubs + Privilege Matrix', () => {
    const masterCsv = generateOmniMasterSampleCsv();
    expect(masterCsv).toContain(OMNI_CSV_HEADERS.join(','));
    expect(masterCsv).toContain('participant_privilege');
    expect(masterCsv).toContain('hub_schedule_slot');
    expect(masterCsv).toContain('hub_territory_cycle');
    expect(masterCsv).toContain('studio_document');
    expect(masterCsv).toContain('cockpit_hoje');
    expect(masterCsv).toContain('event_node');

    const reimported = importOmniCsvBundle(masterCsv);
    expect(reimported.participants.length).toBe(24);
    expect(reimported.scheduleRegistry.length).toBeGreaterThan(80);
    expect(reimported.territoryRegistry.length).toBe(16);
    expect(reimported.studioDocuments.length).toBeGreaterThanOrEqual(2);
    expect(reimported.hojeManifestYaml).toContain('sekundo.app.yaml');
    expect(reimported.hojeRituals.length).toBeGreaterThanOrEqual(2);
    expect(reimported.events.length).toBeGreaterThanOrEqual(8);
  });

  it('performs lossless Round-Trip (Export -> Modify -> Import) for 📅 Programação & WhatsApp CSV', () => {
    const initialSchedule = buildProgramacaoReuniaoRegistry(
      undefined,
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );
    const initialTerritories = buildTerritoriosS13HistoricalRegistry();

    // Simulate user modifying a slot readiness and assignee in the app, then exporting CSV backup
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
    const sampleCsv = generateOmniMasterSampleCsv();
    const lines = sampleCsv.split('\n');

    // Modify p-01 to ONLY have `cap_leitura_tecnica|Privilegio_Custom_Audio_HD` even though its _meta_json still has `cap_presidencia_sessao: true`
    const modifiedLines = lines.map((line) => {
      if (line.startsWith('participant_privilege,') && line.includes(',p-01,')) {
        const p01MetaJson = JSON.stringify({
          id: 'p-01',
          name: 'Participante 01 Editado CSV',
          capabilities: { cap_presidencia_sessao: true, cap_tema_central: true },
        }).replace(/"/g, '""');
        return `participant_privilege,Unidade Central,p-01,perfil_a,roster_assignments,Grupo 1|coordenador_senior,2026-10-01,1,Participante 01 Editado CSV,Participante 01 Editado CSV,,integral_regular,cap_leitura_tecnica|Privilegio_Custom_Audio_HD,,,"${p01MetaJson}"`;
      }
      return line;
    });

    // Add a brand new participant p-99 with ONLY custom privileges
    modifiedLines.push(
      'participant_privilege,Unidade Central,p-99,perfil_b,roster_assignments,Grupo 2|operador_base,,0,Participante 99 (Planilha),Participante 99 (Planilha),,integral_regular,Privilegio_Custom_Audio_HD|Privilegio_Drone_Mapa,,{},"{}"'
    );

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
    // Must NOT have preset privileges injected!
    expect(p99.capabilities?.cap_pratica_1_titular).toBe(false);
    expect(p99.capabilities?.cap_pratica_2_titular).toBe(false);
    expect(p99.capabilities?.cap_pratica_ajudante).toBe(false);
    expect(p99.capabilities?.Privilegio_Custom_Audio_HD).toBe(true);
    expect(p99.capabilities?.Privilegio_Drone_Mapa).toBe(true);

    // Even if ensureParticipantPrivilegeMatrix is called again by UI components, it must preserve exact CSV capabilities
    const rehydratedP99 = ensureParticipantPrivilegeMatrix(p99);
    expect(rehydratedP99.capabilities?.cap_pratica_1_titular).toBe(false);
    expect(rehydratedP99.capabilities?.Privilegio_Custom_Audio_HD).toBe(true);

    // Dynamic column discovery must include both custom privileges from the spreadsheet
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

    const combinedSkeleton = buildCombinedMultiEngineSkeleton(bundle);
    expect(combinedSkeleton.length).toBe(
      bundle.scheduleRegistry.length + bundle.territoryRegistry.length
    );

    // Must also be a 100% valid integer PathKey tree for useSkeleton / skeletonTree.buildTree
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
});

