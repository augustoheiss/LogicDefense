import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
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

  it('maintains 100% Clean-Room data hygiene (zero sensitive names or religious nomenclature via SHA-256 token digests)', () => {
    // CR-03: Compare SHA-256 digests of normalized tokens instead of storing literal forbidden words in source code
    const forbiddenTokenSha256Digests = new Set([
      '2e0e43ff536e5c5e61e262966a3c749e58cd00c64044f5c7f7c4f1d28c254fb8',
      'a82987e3c532888e06c8e4b6440c6f414923a8c8b683b652bc8676496e250fb3',
      '8415a785966a881f3848e294378b2a58c28c1df476359df4e244723650f2bc69',
      '294c935b3420a186919a31ca151378679f78a4e8cf58f121f84514e0f0c693cb',
      '3912e3032177822e4f1688894c8e0f10d436eb6a58e498d0fc906d58f80fd9f7',
      '1b35d2f18a5c5f8c8f77e2505d402997a580ef1d7d73f331727b9e6c7b95218a',
      '88f278580e16991855c35e4f58f43f35852f7d41521888116f0c119e96494c79',
      'c8f626a58c7119ef2b83e9f879538411f74122a40e748d888ef25eb7df1c56d8',
    ]);

    const serialized = JSON.stringify({
      columns: CAPABILITY_COLUMNS,
      participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
    })
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const tokens = serialized.match(/[a-z0-9_]+/g) || [];
    for (const token of tokens) {
      const digest = crypto.createHash('sha256').update(token).digest('hex');
      expect(forbiddenTokenSha256Digests.has(digest)).toBe(false);
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
