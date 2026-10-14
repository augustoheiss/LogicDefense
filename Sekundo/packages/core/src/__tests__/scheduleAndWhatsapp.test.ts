import { describe, it, expect } from 'vitest';
import {
  normalizePersonKey,
  findParticipantProfile,
  listOperationalGroups,
  parseLocalizedDateToISO,
  splitPairedAssignees,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  parseSekundoScheduleBundle,
  PROGRAMACAO_PARTICIPANT_DIRECTORY,
  extractStructuredSessions,
  formatWeeklyScheduleWhatsApp,
  formatGroupFilterWhatsApp,
  formatIndividualCommitmentWhatsApp,
  formatLivePocketScheduleWhatsApp,
  formatTerritoryAssignmentWhatsApp,
  formatPartnerSyncWhatsAppMessage,
  generateCommitmentICS,
  chunkCyclesBy4,
  generateTerritoryS13AndCardsPDF,
  skeletonTree,
  rosterEngine,
  runOfShowEngine,
  territoryEngine,
} from '../index';

describe('Participant Directory & Diacritic-Insensitive Resolution', () => {
  it('resolves diacritic variations such as Conçeição vs Conceição', () => {
    expect(normalizePersonKey('Fernando d. S. Conçeição')).toBe(
      normalizePersonKey('Fernando d. S. Conceição'),
    );

    const profile = findParticipantProfile(
      'Fernando d. S. Conceição',
      PROGRAMACAO_PARTICIPANT_DIRECTORY,
    );
    expect(profile).toBeDefined();
    expect(profile?.groupTag).toBe('Grupo 2');
    expect(profile?.capabilityTags).toContain('Supervisor');
  });

  it('lists all 3 operational groups in natural order', () => {
    const groups = listOperationalGroups(PROGRAMACAO_PARTICIPANT_DIRECTORY);
    expect(groups).toEqual(['Grupo 1', 'Grupo 2', 'Grupo 3']);
    expect(PROGRAMACAO_PARTICIPANT_DIRECTORY.length).toBe(16);
  });
});

describe('Agnostic Schedule Parser & 9-Week Seed Ingestion', () => {
  it('parses localized dates and paired assignees accurately', () => {
    expect(parseLocalizedDateToISO('9 de outubro de 2026')).toBe('2026-10-09');
    expect(parseLocalizedDateToISO('4 de dezembro de 2026')).toBe('2026-12-04');

    const pair = splitPairedAssignees('Paulo Henrick F. Castro / Josué G. Oliveira');
    expect(pair).toEqual({
      assignedTo: 'Paulo Henrick F. Castro',
      assistantTo: 'Josué G. Oliveira',
    });
  });

  it('builds all 9 weekly sessions (Oct-Dec 2026) into an agnostic FlatRegistry', () => {
    const registry = buildProgramacaoReuniaoRegistry();
    const sessions = extractStructuredSessions(registry);

    expect(sessions.length).toBe(9);
    expect(sessions[0].sessionDate).toBe('2026-10-09');
    expect(sessions[8].sessionDate).toBe('2026-12-04');

    // Check first week (09/10/2026)
    const week1 = sessions[0];
    expect(week1.chairPerson).toBe('Tiago A. Rocha Neto');
    expect(week1.sections.length).toBe(3);
    expect(week1.sections.map((s) => s.accentColor)).toEqual([
      '#3D5B65',
      '#9A7420',
      '#80241E',
    ]);

    // Check paired slot with group enrichment (Part 4: Paulo Henrick F. Castro / Josué G. Oliveira)
    const slot4 = week1.sections[1].slots.find((s) => (s.meta as any)?.partNumber === 4);
    expect(slot4).toBeDefined();
    const slot4Meta = slot4!.meta as Record<string, any>;
    expect(slot4Meta.assignedTo).toBe('Paulo Henrick F. Castro');
    expect(slot4Meta.assistantTo).toBe('Josué G. Oliveira');
    expect(slot4Meta.groupTag).toBe('Grupo 3');
    expect(slot4Meta.assistantGroupTag).toBe('Grupo 1');

    // Agnostic core engines operate seamlessly on the populated registry
    const tree = skeletonTree.buildTree(registry);
    const rosterSummary = rosterEngine.calculateMetrics(tree);
    expect(rosterSummary.data.totalSlots).toBeGreaterThan(70);
    expect(rosterSummary.data.assignedSlots).toBeGreaterThan(70);

    const rosSummary = runOfShowEngine.calculateMetrics(tree);
    expect(rosSummary.data.totalPlannedSeconds).toBeGreaterThan(20000);
  });

  it('parses an external JSON schedule bundle cleanly via parseSekundoScheduleBundle', () => {
    const bundleJson = JSON.stringify({
      unitName: 'Unidade Local Teste',
      participants: [
        { id: 'p1', name: 'Ana Beatriz', groupTag: 'Grupo 1', capabilityTags: ['Orador'] },
      ],
      rawScheduleText: [
        '9 de outubro de 2026 | TEMA 01 Presidente Ana Beatriz',
        'SEÇÃO INICIAL',
        '1. Introdução (10 mins.) Ana Beatriz',
      ].join('\n'),
      s13TerritoryRecords: [
        {
          territoryNumber: 'T01.01.01',
          locality: 'Setor Alfa',
          cycles2027: [{ assignedTo: 'Ana Beatriz', assignedAt: '01/10/2026', serviceYear: 2027 }],
          cycles2026: [],
        },
      ],
    });

    const parsed = parseSekundoScheduleBundle(bundleJson);
    expect(parsed.unitName).toBe('Unidade Local Teste');
    expect(parsed.participants.length).toBe(1);
    expect(parsed.scheduleRegistry.length).toBe(3);
    expect(parsed.territoryRegistry.length).toBe(1);
  });
});

describe('WhatsApp Export Engine & Commitment Agonist Formatters', () => {
  const registry = buildProgramacaoReuniaoRegistry();
  const territoryRegistry = buildTerritoriosS13HistoricalRegistry();
  const sessions = extractStructuredSessions(registry);
  const week1 = sessions[0];

  it('formats Mode 1: Complete Weekly Schedule Board for WhatsApp', () => {
    const msg = formatWeeklyScheduleWhatsApp(week1);

    expect(msg).toContain('*PROGRAMAÇÃO DA SEMANA');
    expect(msg).toContain('9 DE OUTUBRO DE 2026');
    expect(msg).toContain('*Presidente:* Tiago A. Rocha Neto');
    expect(msg).toContain('*BLOCO 1 — FUNDAMENTOS E ANÁLISE*');
    expect(msg).toContain('*BLOCO 2 — PRÁTICA E COMUNICAÇÃO*');
    expect(msg).toContain('*BLOCO 3 — APLICAÇÃO E SÍNTESE*');
    expect(msg).toContain('Paulo Henrick F. Castro');
    expect(msg).toContain('Josué G. Oliveira');
  });

  it('formats Mode 2: Group Filter Summary (Grupo 1, 2, 3) with active territories', () => {
    const msgGrupo1 = formatGroupFilterWhatsApp(
      week1,
      'Grupo 1',
      PROGRAMACAO_PARTICIPANT_DIRECTORY,
      territoryRegistry,
    );

    expect(msgGrupo1).toContain('*DESTAQUES DO GRUPO 1');
    expect(msgGrupo1).toContain('Roberto Gomes Almeida');
    expect(msgGrupo1).toContain('Carlos Eduardo F. Silva');
    expect(msgGrupo1).toContain('Josué G. Oliveira');
    expect(msgGrupo1).toContain('*Territórios em Campo (Grupo 1):*');
    expect(msgGrupo1).toContain('T01.01.02');
  });

  it('formats Mode 3: Individual Commitment Card & Partner Sync Message', () => {
    const slot4 = week1.sections[1].slots.find((s) => (s.meta as any)?.partNumber === 4)!;
    const card = formatIndividualCommitmentWhatsApp(slot4, week1, 'primary');

    expect(card).toContain('Olá, *Paulo Henrick F. Castro*!');
    expect(card).toContain('*Parceiro(a):* Josué G. Oliveira');
    expect(card).toContain('4. Inicie conversas');

    const partnerMsg = formatPartnerSyncWhatsAppMessage(
      slot4,
      '9 de outubro de 2026',
      'Paulo Henrick F. Castro',
    );
    expect(partnerMsg).toContain('Olá, *Josué G. Oliveira*!');
    expect(partnerMsg).toContain('*4. Inicie conversas*');
  });

  it('formats Mode 4: Live Pocket Timeline with calculated clock times', () => {
    const liveMsg = formatLivePocketScheduleWhatsApp(week1, '19:30');
    expect(liveMsg).toContain('*CRONOGRAMA AO VIVO');
    expect(liveMsg).toContain('`19:30`');
    expect(liveMsg).toContain('`19:36`');
  });

  it('formats Mode 5: Territory Assignment Card & generates RFC 5545 .ics calendar', () => {
    const terrMsg = formatTerritoryAssignmentWhatsApp(territoryRegistry[1]); // T01.01.02
    expect(terrMsg).toContain('*DESIGNAÇÃO DE TERRITÓRIO — T01.01.02*');
    expect(terrMsg).toContain('Eliane R. Martins');

    const slot1 = week1.sections[0].slots[0];
    const ics = generateCommitmentICS(slot1, week1);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('TRIGGER:-PT48H');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('END:VCALENDAR');
  });
});

describe('S-13-S 4-Column Multi-Cycle Territory Record PDF Engine', () => {
  it('chunks assignment cycles into 4-column rows accurately', () => {
    const history = Array.from({ length: 9 }, (_, idx) => ({
      assignedTo: `Person ${idx + 1}`,
      assignedAt: '01/01/2026',
      completedAt: '15/01/2026',
      serviceYear: 2026,
    }));

    const rows = chunkCyclesBy4(history);
    expect(rows.length).toBe(3); // 9 items -> 4 + 4 + 1
    expect(rows[0].length).toBe(4);
    expect(rows[1].length).toBe(4);
    expect(rows[2].length).toBe(1);
  });

  it('generates valid S-13-S PDF bytes for Service Years 2027, 2026, and all', async () => {
    const registry = buildTerritoriosS13HistoricalRegistry();
    const tree = skeletonTree.buildTree(registry);
    const summary = territoryEngine.calculateMetrics(tree);
    expect(summary.data.totalUnits).toBeGreaterThanOrEqual(15);

    const pdfAll = await generateTerritoryS13AndCardsPDF(registry, {
      eventName: 'Unidade Operacional Demo',
      serviceYear: 'all',
      includeQuadraCards: true,
    });

    expect(pdfAll.territoryCount).toBe(registry.length);
    expect(pdfAll.pdfBytes.byteLength).toBeGreaterThan(2000);
    const header = new TextDecoder().decode(pdfAll.pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');

    const pdf2027 = await generateTerritoryS13AndCardsPDF(registry, {
      eventName: 'Unidade Operacional Demo',
      serviceYear: '2027',
      includeQuadraCards: false,
    });
    expect(pdf2027.pdfBytes.byteLength).toBeGreaterThan(1500);
  });
});
