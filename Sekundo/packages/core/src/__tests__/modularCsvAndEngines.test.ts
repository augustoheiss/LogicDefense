/**
 * Sekundo — Modular CSV, Engine Templates, Auto-Detection & Quarantine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ENGINE_TEMPLATES,
  getEngineTemplate,
  listEngineTemplates,
  exportTemplateCSV,
  detectEnginesFromCSV,
  exportGranularCSV,
  filterGranularEntries,
  importGranularCSV,
  parseCSVWithQuarantine,
  parseCSV,
  getActiveEngines,
  createEvent,
} from '../index';
import type { FlatRegistry, EngineId } from '../index';

describe('Canonical Engine CSV Templates', () => {
  const allEngineIds: EngineId[] = [
    'territory_logistics',
    'roster_assignments',
    'study_synthesis',
    'generic_wbs',
    'incident_command',
    'live_production_ros',
    'tournament_pairings',
    'canvassing_logistics',
  ];

  it('provides all 8 engine templates', () => {
    const list = listEngineTemplates();
    expect(list).toHaveLength(8);
    for (const engineId of allEngineIds) {
      const template = getEngineTemplate(engineId);
      expect(template).toBeDefined();
      expect(template.engineId).toBe(engineId);
      expect(template.canonicalCsv.length).toBeGreaterThan(50);
      expect(template.cleanHumanCsv.length).toBeGreaterThan(50);
      expect(template.columnGuides.length).toBeGreaterThan(0);
    }
  });

  it('all 8 canonical templates parse cleanly via parseCSV', () => {
    for (const engineId of allEngineIds) {
      const canonical = exportTemplateCSV(engineId, 'canonical');
      const rows = parseCSV(canonical);
      expect(rows.length).toBeGreaterThanOrEqual(3);
      expect(rows[0]._key).toBe('01');
      expect(rows[0]._type).toBe('root');
    }
  });

  it('clean human templates export correctly with friendly headers', () => {
    const territoryHuman = exportTemplateCSV('territory_logistics', 'clean_human');
    expect(territoryHuman).toContain('key,tipo,nome,trabalhado,endereco,latitude,longitude');

    const rosterHuman = exportTemplateCSV('roster_assignments', 'clean_human');
    expect(rosterHuman).toContain('key,tipo,parte,designado,email,assistente,sala');
  });
});

describe('Universal Engine Auto-Detection', () => {
  it('detects territory_logistics from coordinates and worked status', () => {
    const sample = `key,tipo,nome,trabalhado,endereco,latitude,longitude
01,root,Território 01,,,-23.55,-46.63
01-01,branch,Quadra A,,,
01-01-01,leaf,Casa 1,1,"Rua das Flores, 10",-23.5501,-46.6301`;
    const report = detectEnginesFromCSV(sample);
    expect(report.primaryEngine).toBe('territory_logistics');
    expect(report.matches[0].confidence).toBeGreaterThan(50);
  });

  it('detects roster_assignments from speaker, duration and room headers', () => {
    const sample = `_key,_type,label,value,email,_meta_json
01,root,Reunião de Meio de Semana,,,"{}"
01-01-01,leaf,Discurso Inicial,Carlos Silva,carlos@email.com,"{""assignedTo"":""Carlos Silva"",""room"":""Auditório Principal"",""durationMinutes"":10}"`;
    const report = detectEnginesFromCSV(sample);
    expect(report.primaryEngine).toBe('roster_assignments');
    expect(report.matches[0].confidence).toBeGreaterThan(50);
  });

  it('detects study_synthesis from research status and synthesis fields', () => {
    const sample = `key,tema,pesquisador,status,sintese,principais_achados
01-01,Topico A,Dr. Aris,submitted,"Sintese do estudo","Descoberta 1"`;
    const report = detectEnginesFromCSV(sample);
    expect(report.primaryEngine).toBe('study_synthesis');
  });

  it('detects incident_command from ICS roles and radio channels', () => {
    const sample = `key,funcao_ics,oficial,radio,efetivo
01-01-01,INCIDENT_COMMANDER,Silva,Canal 1 (Comando),1`;
    const report = detectEnginesFromCSV(sample);
    expect(report.primaryEngine).toBe('incident_command');
  });

  it('detects live_production_ros from plannedDurationSec and cues', () => {
    const sample = `key,elemento,duracao_seg,restricao,cue_audio,cue_video
01-01-01,Teaser,180,HARD_START,Trilha 1,VT01.mp4`;
    const report = detectEnginesFromCSV(sample);
    expect(report.primaryEngine).toBe('live_production_ros');
  });

  it('detects tournament_pairings from round, board, and contestant headers', () => {
    const sample = `key,partida,rodada,mesa,jogador_a,jogador_b,placar_a,placar_b
01-01-01,Mesa 1,1,1,Kasparov,Anand,1,0`;
    const report = detectEnginesFromCSV(sample);
    expect(report.primaryEngine).toBe('tournament_pairings');
  });

  it('detects canvassing_logistics from contact codes CNT, NH, DNC', () => {
    const sample = `key,endereco_porta,codigo_contato,ordem_rota,voluntario
01-01-01,Porta 1,CNT,1,Mariana
01-01-02,Porta 2,NH,2,Mariana
01-01-03,Porta 3,DNC,3,Mariana`;
    const report = detectEnginesFromCSV(sample);
    expect(report.primaryEngine).toBe('canvassing_logistics');
  });

  it('detects composite multi-engine needs when CSV has both territory and roster features', () => {
    const compositeCSV = `key,tipo,nome,trabalhado,latitude,longitude,designado,sala,duracao_min
01,root,Evento Grande,,,,,,
01-01,branch,Setor Campo,,,,,,
01-01-01,leaf,Ponto Apoio 1,1,-23.55,-46.63,Carlos Silva,Auditório 1,30`;
    const report = detectEnginesFromCSV(compositeCSV);
    expect(report.isMultiEngineCandidate).toBe(true);
    expect(report.suggestedEngines).toContain('territory_logistics');
    expect(report.suggestedEngines).toContain('roster_assignments');
  });
});

describe('Granular Sliced Export (Export by Parts / Subtrees)', () => {
  const sampleRegistry: FlatRegistry = [
    { key: '01', type: 'territory', label: 'Território Geral', value: '', email: '', meta: {} },
    { key: '01-01', type: 'header', label: 'Quadra 1', value: '', email: '', meta: {} },
    { key: '01-01-01', type: 'slot', label: 'Casa 10', value: '1', email: '', meta: { worked: 1, address: 'Rua A, 10', lat: -23.55, lng: -46.63 } },
    { key: '01-01-02', type: 'slot', label: 'Casa 12', value: '', email: '', meta: { worked: 0, address: 'Rua A, 12' } },
    { key: '01-02', type: 'header', label: 'Quadra 2', value: '', email: '', meta: {} },
    { key: '01-02-01', type: 'slot', label: 'Casa 20', value: '1', email: '', meta: { worked: 1, address: 'Rua B, 20' } },
  ];

  it('exports only a specific branch (01-01)', () => {
    const csv = exportGranularCSV(sampleRegistry, { branchPrefix: '01-01' });
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(3); // 01-01, 01-01-01, 01-01-02
    expect(parsed.some((r) => r._key === '01-02')).toBe(false);
    expect(parsed.some((r) => r._key === '01-02-01')).toBe(false);
  });

  it('exports with scope leaves_only', () => {
    const filtered = filterGranularEntries(sampleRegistry, { scope: 'leaves_only' });
    expect(filtered).toHaveLength(3); // 01-01-01, 01-01-02, 01-02-01
    expect(filtered.map((f) => f.key)).toEqual(['01-01-01', '01-01-02', '01-02-01']);
  });

  it('exports with scope worked_only', () => {
    const filtered = filterGranularEntries(sampleRegistry, { scope: 'worked_only' });
    expect(filtered).toHaveLength(2); // 01-01-01 and 01-02-01
  });

  it('exports with clean human format for territories', () => {
    const csv = exportGranularCSV(sampleRegistry, {
      branchPrefix: '01-01',
      format: 'clean_human',
      engineId: 'territory_logistics',
    });
    expect(csv).toContain('key,tipo,nome,trabalhado,endereco,latitude,longitude');
    expect(csv).toContain('01-01-01');
    expect(csv).toContain('Rua A, 10');
    expect(csv).not.toContain('_meta_json');
  });
});

describe('Granular Ingestion & Staging Quarantine (LEGO Assembly)', () => {
  const currentRegistry: FlatRegistry = [
    { key: '01', type: 'territory', label: 'Território Geral', value: '', email: '', meta: {} },
    { key: '01-01', type: 'header', label: 'Quadra 1', value: '', email: '', meta: {} },
    { key: '01-01-01', type: 'slot', label: 'Casa 10', value: 'Trabalhado', email: '', meta: { worked: 1, workerName: 'Carlos' } },
    { key: '01-02', type: 'header', label: 'Quadra 2', value: '', email: '', meta: {} },
    { key: '01-02-01', type: 'slot', label: 'Casa 20', value: '', email: '', meta: { worked: 0 } },
  ];

  it('quarantines bad lines without breaking the import of valid rows', () => {
    const messyCSV = `key,tipo,nome,trabalhado,endereco
01-01-02,item,Casa 12,0,"Rua A, 12"
malformed_key,item,Casa Errada,0,"Rua A, 99"
,item,Sem Chave,0,"Rua A, 0"
01-01-03,item,Casa 14,1,"Rua A, 14"`;

    const result = importGranularCSV(currentRegistry, messyCSV);

    // Fault isolation: the import succeeds for valid rows!
    expect(result.success).toBe(true);
    expect(result.validRows).toHaveLength(2); // 01-01-02 and 01-01-03
    expect(result.quarantinedRows).toHaveLength(2); // malformed_key and empty key

    expect(result.quarantinedRows[0].attemptedKey).toBe('malformed_key');
    expect(result.quarantinedRows[0].reason).toContain('Formato de chave inválido');

    // Registry includes new valid rows
    expect(result.updatedRegistry.some((n) => n.key === '01-01-02')).toBe(true);
    expect(result.updatedRegistry.some((n) => n.key === '01-01-03')).toBe(true);
  });

  it('branch_replace replaces targeted branch while keeping other branches intact', () => {
    // We import an update strictly for Quadra 1 (01-01)
    const quadra1Replacement = `key,tipo,nome,trabalhado
01-01,bloco,Quadra 1 Renomeada,
01-01-01,item,Nova Casa 10,1
01-01-99,item,Nova Casa 99,0`;

    const result = importGranularCSV(currentRegistry, quadra1Replacement, {
      mode: 'branch_replace',
      targetBranchPrefix: '01-01',
    });

    expect(result.success).toBe(true);
    // Quadra 2 (01-02 and 01-02-01) is 100% preserved!
    expect(result.updatedRegistry.some((n) => n.key === '01-02')).toBe(true);
    expect(result.updatedRegistry.some((n) => n.key === '01-02-01')).toBe(true);

    // Quadra 1 has the new items
    expect(result.updatedRegistry.some((n) => n.key === '01-01-99')).toBe(true);
    const updated0101 = result.updatedRegistry.find((n) => n.key === '01-01');
    expect(updated0101?.label).toBe('Quadra 1 Renomeada');
  });

  it('supports semicolon delimiter and Portuguese header aliases', () => {
    const ptCSV = `chave;tipo;rotulo;valor;endereco
01-03;bloco;Quadra 3;;Av Central
01-03-01;item;Loja 1;1;Av Central, 100`;

    const { validRows, quarantinedRows } = parseCSVWithQuarantine(ptCSV);
    expect(quarantinedRows).toHaveLength(0);
    expect(validRows).toHaveLength(2);
    expect(validRows[0]._key).toBe('01-03');
    expect(validRows[0].label).toBe('Quadra 3');
    expect(validRows[1].value).toBe('1');
  });
});

describe('Multi-Engine Events Support', () => {
  it('creates event with multiple active engines', () => {
    const event = createEvent('Mega Congresso', 'once', ['01'], [
      'territory_logistics',
      'roster_assignments',
      'live_production_ros',
    ]);
    expect(event.engineId).toBe('territory_logistics');
    expect(event.activeEngines).toEqual([
      'territory_logistics',
      'roster_assignments',
      'live_production_ros',
    ]);
  });

  it('getActiveEngines resolves active engines correctly with fallback', () => {
    expect(getActiveEngines(null)).toEqual(['generic_wbs']);
    expect(getActiveEngines({ engineId: 'roster_assignments' })).toEqual(['roster_assignments']);
    expect(
      getActiveEngines({
        engineId: 'territory_logistics',
        activeEngines: ['territory_logistics', 'roster_assignments'],
      })
    ).toEqual(['territory_logistics', 'roster_assignments']);
  });
});
