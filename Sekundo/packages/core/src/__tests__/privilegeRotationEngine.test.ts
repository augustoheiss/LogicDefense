import { describe, it, expect } from 'vitest';
import {
  CAPABILITY_COLUMNS,
  ALL_CAPABILITY_KEYS,
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  ensureParticipantPrivilegeMatrix,
  filterParticipantsByMatrixCriteria,
  inferSlotRequiredCapability,
  autoAssignScheduleRegistry,
} from '../roster/privilegeRotationEngine';
import { buildProgramacaoReuniaoRegistry } from '../schedule/programacaoReuniaoSeed';
import { extractStructuredSessions } from '../schedule/whatsappFormatter';

describe('Sekundo Clean-Room Privilege Matrix & Fair-Rotation Auto-Assignment Engine', () => {
  it('defines all 26 domain-agnostic capability columns across 5 operational domains', () => {
    expect(CAPABILITY_COLUMNS.length).toBe(26);
    expect(ALL_CAPABILITY_KEYS.length).toBe(26);
    const uniqueKeys = new Set(ALL_CAPABILITY_KEYS);
    expect(uniqueKeys.size).toBe(26);

    const domains = new Set(CAPABILITY_COLUMNS.map((c) => c.domainId));
    expect(domains.size).toBe(5);
  });

  it('maintains 100% Clean-Room data hygiene (zero sensitive names or religious nomenclature)', () => {
    const forbiddenTerms = [
      'anciao',
      'servo ministerial',
      'publicador',
      'pioneiro',
      'oracao',
      'tesouros',
      'sentinela',
      'congregacao',
      'reuniao vida e ministerio',
      'discurso publico',
    ];
    const serialized = JSON.stringify({
      columns: CAPABILITY_COLUMNS,
      participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
    })
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    for (const term of forbiddenTerms) {
      expect(serialized).not.toContain(term);
    }
  });

  it('filters participants accurately by Category, Role Tier, Status Flags, Group, and Capability', () => {
    const gradeA = filterParticipantsByMatrixCriteria(DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS, {
      categories: ['perfil_a'],
    });
    const gradeB = filterParticipantsByMatrixCriteria(DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS, {
      categories: ['perfil_b'],
    });
    expect(gradeA.length).toBeGreaterThan(0);
    expect(gradeB.length).toBeGreaterThan(0);
    expect(gradeA.length + gradeB.length).toBe(DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS.length);

    const group1Seniors = filterParticipantsByMatrixCriteria(
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
      {
        groupTag: 'Grupo 1',
        roleTiers: ['coordenador_senior'],
      }
    );
    expect(group1Seniors.length).toBeGreaterThanOrEqual(2);
    expect(group1Seniors.every((p) => p.groupTag === 'Grupo 1')).toBe(true);
    expect(group1Seniors.every((p) => p.roleTier === 'coordenador_senior')).toBe(true);
  });

  it('auto-assigns 9 full weeks with ZERO same-day collisions, 100% privilege compliance, and fair rotation', () => {
    const baseRegistry = buildProgramacaoReuniaoRegistry(
      undefined,
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );
    const { updatedRegistry, updatedParticipants, summary } = autoAssignScheduleRegistry(
      baseRegistry,
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
      { strictSameCategoryPairing: true }
    );

    expect(summary.sessionsAssigned).toBe(9);
    expect(summary.sameDayCollisions).toBe(0);
    expect(summary.privilegeViolations).toBe(0);

    const sessions = extractStructuredSessions(updatedRegistry);
    expect(sessions.length).toBe(9);

    for (const session of sessions) {
      const seenInDay = new Set<string>();
      const registerPerson = (name?: string) => {
        if (!name) return;
        expect(seenInDay.has(name)).toBe(false);
        seenInDay.add(name);
      };

      registerPerson(session.chairPerson);
      registerPerson(session.openingPrayer);
      registerPerson(session.closingPrayer);

      for (const sec of session.sections) {
        for (const slot of sec.slots) {
          const meta = (slot.meta || {}) as Record<string, any>;
          registerPerson(meta.assignedTo);
          registerPerson(meta.assistantTo);
        }
      }
    }

    // Verify fair rotation across eligible participants
    const activeAssignedCount = updatedParticipants.filter(
      (p) => (p.assignmentCount ?? 0) > 0
    ).length;
    expect(activeAssignedCount).toBeGreaterThanOrEqual(20);
  });

  it('respects custom user privilege edits when auto-assigning a newly added participant', () => {
    const customUser = ensureParticipantPrivilegeMatrix({
      id: 'p-99',
      name: 'Participante 99',
      groupTag: 'Grupo 1',
      capabilityTags: ['Coordenação'],
      profileCategory: 'perfil_a',
      roleTier: 'coordenador_senior',
      capabilities: {
        cap_presidencia_sessao: true,
      },
      lastAssignedIsoDate: '0000-00-00',
      assignmentCount: 0,
    });

    // Disable presidency for everyone else so Participante 99 must be chosen for Session 01 chair
    const customPool = [
      ...DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS.map((p) => ({
        ...p,
        capabilities: { ...(p.capabilities || {}), cap_presidencia_sessao: false },
      })),
      customUser,
    ];

    const baseRegistry = buildProgramacaoReuniaoRegistry(undefined, customPool);
    const { updatedRegistry } = autoAssignScheduleRegistry(baseRegistry, customPool, {
      targetSessionKeys: ['01'],
    });

    const sessions = extractStructuredSessions(updatedRegistry);
    expect(sessions[0].chairPerson).toBe('Participante 99');
  });
});
