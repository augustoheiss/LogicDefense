import { describe, it, expect } from 'vitest';
import {
  OMNI_CSV_HEADERS,
  exportOmniCsvBundle,
  importOmniCsvBundle,
  exportScheduleHubToCsv,
  importScheduleHubFromCsv,
  generateOmniMasterSampleCsv,
} from '../csv/omniCsvBundle';
import { DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS } from '../roster/privilegeRotationEngine';
import {
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
} from '../schedule/programacaoReuniaoSeed';

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
});
