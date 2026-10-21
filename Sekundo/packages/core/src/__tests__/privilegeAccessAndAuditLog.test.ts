import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  ensureParticipantPrivilegeMatrix,
  createEmptyCapabilitiesMap,
  verifyParticipantAdmission,
  revalidateSavedSessionPrincipal,
  canPerformSpreadsheetAction,
  lockSessionWithPin,
  unlockSessionWithPin,
  appendActivityLogEntry,
  mergeActivityLogs,
  verifyActivityLogChain,
  exportActivityLogToCsv,
  encodeEncryptedCollabPacket,
  decodeEncryptedCollabPacket,
  applyIncomingCollabPacket,
  createLedgerOperation,
} from '../index';

describe('Sekundo Phase 7 — Roster-Gated Identity Confirmation, RBAC Selo Admin, Activity Log & Simultaneous Collab', () => {
  it('State 1 (Not in Privilege List): blocks visualization when person name is not registered in the Privilege Roster', () => {
    const result = verifyParticipantAdmission(
      {
        fullName: 'Pessoa Nao Cadastrada',
        groupTag: 'Grupo 1',
        pin: '1001',
        eventId: 'evt-01',
      },
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );

    expect(result.allowed).toBe(false);
    expect(result.role).toBe('UNAUTHORIZED');
    expect(result.rejectionReason).toBe('NOT_IN_PRIVILEGE_LIST');
    expect(result.principal).toBeUndefined();
  });

  it('State 2 (Registered with ZERO active privileges): blocks visualization when participant has no active privilege', () => {
    const zeroPrivUser = ensureParticipantPrivilegeMatrix(
      {
        id: 'p-zero',
        name: 'Participante Sem Privilegio',
        groupTag: 'Grupo 2',
        capabilityTags: [],
        capabilities: createEmptyCapabilitiesMap(),
        hasAdminSeal: false,
        accessPin: '4321',
        preserveExplicitCapabilities: true,
      },
      99,
      { preserveExplicitCapabilities: true }
    );

    const roster = [...DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS, zeroPrivUser];
    const result = verifyParticipantAdmission(
      {
        fullName: 'Participante Sem Privilegio',
        groupTag: 'Grupo 2',
        pin: '4321',
        eventId: 'evt-01',
      },
      roster
    );

    expect(result.allowed).toBe(false);
    expect(result.role).toBe('UNAUTHORIZED');
    expect(result.rejectionReason).toBe('ZERO_ACTIVE_PRIVILEGES');
  });

  it('State 3 (Group or PIN mismatch on first-time confirmation): rejects admission when Group or PIN does not match roster', () => {
    // Participante 02 is in Grupo 1 with default PIN '1002'
    const wrongGroup = verifyParticipantAdmission(
      {
        fullName: 'Participante 02',
        groupTag: 'Grupo 3',
        pin: '1002',
      },
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );
    expect(wrongGroup.allowed).toBe(false);
    expect(wrongGroup.rejectionReason).toBe('GROUP_MISMATCH');

    const wrongPin = verifyParticipantAdmission(
      {
        fullName: 'Participante 02',
        groupTag: 'Grupo 1',
        pin: '9999',
      },
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );
    expect(wrongPin.allowed).toBe(false);
    expect(wrongPin.rejectionReason).toBe('PIN_MISMATCH');
  });

  it('State 4 (Viewer without Selo Admin): grants VIEW_SPREADSHEET only, strictly blocking EDIT and EXPORT', () => {
    // Participante 02 has active privileges in Grupo 1, but hasAdminSeal === false
    const admission = verifyParticipantAdmission(
      {
        fullName: 'Participante 02',
        groupTag: 'Grupo 1',
        pin: '1002',
        eventId: 'evt-01',
      },
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );

    expect(admission.allowed).toBe(true);
    expect(admission.role).toBe('VIEWER');
    expect(admission.principal?.hasAdminSeal).toBe(false);
    expect(admission.principal?.permissions.canViewSpreadsheet).toBe(true);
    expect(admission.principal?.permissions.canEditSpreadsheet).toBe(false);
    expect(admission.principal?.permissions.canExportSpreadsheet).toBe(false);
    expect(admission.principal?.permissions.canManagePrivileges).toBe(false);

    expect(canPerformSpreadsheetAction(admission.principal, 'VIEW_SPREADSHEET')).toBe(true);
    expect(canPerformSpreadsheetAction(admission.principal, 'EDIT_SPREADSHEET')).toBe(false);
    expect(canPerformSpreadsheetAction(admission.principal, 'EXPORT_SPREADSHEET')).toBe(false);
  });

  it('State 5 (Admin with 👑 Selo Admin): grants full permissions to VIEW, EDIT, EXPORT, and MANAGE_PRIVILEGES', () => {
    // Participante 01 is in Grupo 1 with hasAdminSeal === true and PIN '1001'
    const admission = verifyParticipantAdmission(
      {
        fullName: 'Participante 01',
        groupTag: 'Grupo 1',
        pin: '1001',
        eventId: 'evt-01',
      },
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );

    expect(admission.allowed).toBe(true);
    expect(admission.role).toBe('ADMIN_SEAL');
    expect(admission.principal?.hasAdminSeal).toBe(true);
    expect(admission.principal?.permissions.canViewSpreadsheet).toBe(true);
    expect(admission.principal?.permissions.canEditSpreadsheet).toBe(true);
    expect(admission.principal?.permissions.canExportSpreadsheet).toBe(true);
    expect(admission.principal?.permissions.canManagePrivileges).toBe(true);

    expect(canPerformSpreadsheetAction(admission.principal, 'EDIT_SPREADSHEET')).toBe(true);
    expect(canPerformSpreadsheetAction(admission.principal, 'EXPORT_SPREADSHEET')).toBe(true);
  });

  it('State 6 (Persistent Device Session + PIN Quick Lock & Revalidation): locks/unlocks with PIN and reflects live Selo Admin changes', () => {
    const admission = verifyParticipantAdmission(
      {
        fullName: 'Participante 02',
        groupTag: 'Grupo 1',
        pin: '1002',
        eventId: 'evt-01',
      },
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    );
    const initialPrincipal = admission.principal!;

    // Lock screen on shared device
    const locked = lockSessionWithPin(initialPrincipal);
    expect(locked.isPinLocked).toBe(true);
    expect(canPerformSpreadsheetAction(locked, 'VIEW_SPREADSHEET')).toBe(false);

    // Wrong PIN fails unlock
    const badUnlock = unlockSessionWithPin(locked, '0000');
    expect(badUnlock.unlocked).toBe(false);

    // Correct PIN unlocks without needing Full Name + Group again
    const goodUnlock = unlockSessionWithPin(locked, '1002');
    expect(goodUnlock.unlocked).toBe(true);
    expect(canPerformSpreadsheetAction(goodUnlock.principal, 'VIEW_SPREADSHEET')).toBe(true);

    // Admin grants 👑 Selo Admin to Participante 02 in the roster; revalidation promotes session automatically!
    const promotedRoster = DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS.map((p) =>
      p.id === 'p-02' ? { ...p, hasAdminSeal: true } : p
    );
    const revalidated = revalidateSavedSessionPrincipal(goodUnlock.principal, promotedRoster);
    expect(revalidated.allowed).toBe(true);
    expect(revalidated.role).toBe('ADMIN_SEAL');
    expect(revalidated.principal?.permissions.canEditSpreadsheet).toBe(true);
    expect(revalidated.principal?.permissions.canExportSpreadsheet).toBe(true);
  });

  it('State 7 (Tamper-Evident Activity Log & Network RBAC Enforcement): rejects Viewer mutation packets and maintains intact hash chain', async () => {
    let log = appendActivityLogEntry([], {
      eventId: 'evt-01',
      actorId: 'p-01',
      actorName: 'Participante 01',
      actorGroup: 'Grupo 1',
      actorRole: 'ADMIN_SEAL',
      actionType: 'IDENTITY_CONFIRMED',
      summary: 'Participante 01 confirmou cadastro (👑 Selo Admin)',
    }).updatedLog;

    log = appendActivityLogEntry(log, {
      eventId: 'evt-01',
      actorId: 'p-02',
      actorName: 'Participante 02',
      actorGroup: 'Grupo 1',
      actorRole: 'VIEWER',
      actionType: 'SHEET_VIEWED',
      targetSheet: 'hub_schedule_slot',
      summary: 'Participante 02 consultou a planilha de Programação',
    }).updatedLog;

    const integrity = verifyActivityLogChain(log);
    expect(integrity.valid).toBe(true);
    expect(integrity.totalEntries).toBe(2);

    const csvAudit = exportActivityLogToCsv(log);
    expect(csvAudit).toContain('Participante 01');
    expect(csvAudit).toContain('Selo Admin');
    expect(csvAudit).toContain('Consultor (Somente Leitura)');

    // Test E2EE packet encryption and receiver-side RBAC check
    const initialSkeleton = [
      { key: '01', type: 'slot' as const, label: 'Slot 01', value: 'Valor Inicial', meta: {} },
    ];
    const unauthorizedOp = createLedgerOperation(
      'evt-01',
      '01',
      'value',
      'Tentativa de Edicao por Viewer',
      'p-02',
      { authorName: 'Participante 02' }
    );

    const viewerPacket = await encodeEncryptedCollabPacket(
      {
        protocol: 'SEKUNDO_COLLAB_v2',
        packetId: 'pkt_1',
        roomId: 'rm_test',
        eventId: 'evt-01',
        kind: 'DELTA_MUTATION',
        sentAt: new Date().toISOString(),
        author: {
          peerId: 'peer_2',
          participantId: 'p-02',
          fullName: 'Participante 02',
          groupTag: 'Grupo 1',
          role: 'VIEWER',
          hasAdminSeal: false,
        },
        operations: [unauthorizedOp],
      },
      'senha-secreta-2026'
    );

    const decodedViewerPacket = await decodeEncryptedCollabPacket(viewerPacket, 'senha-secreta-2026');
    const rejectedOutcome = applyIncomingCollabPacket(
      {
        eventId: 'evt-01',
        skeleton: initialSkeleton,
        privilegeRoster: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
        ledger: [],
        activityLog: log,
      },
      decodedViewerPacket
    );

    expect(rejectedOutcome.accepted).toBe(false);
    expect(rejectedOutcome.rejectedReason).toBe('AUTHOR_MISSING_ADMIN_SEAL');
    expect(rejectedOutcome.updatedSkeleton[0].value).toBe('Valor Inicial');
    expect(
      rejectedOutcome.updatedActivityLog.some((e) => e.actionType === 'UNAUTHORIZED_EDIT_ATTEMPT')
    ).toBe(true);

    // Now Admin (p-01 with 👑 Selo Admin) sends a valid mutation packet
    const adminOp = createLedgerOperation(
      'evt-01',
      '01',
      'value',
      'Editado pelo Admin 01',
      'p-01',
      { authorName: 'Participante 01' }
    );
    const adminPacket = await encodeEncryptedCollabPacket(
      {
        protocol: 'SEKUNDO_COLLAB_v2',
        packetId: 'pkt_2',
        roomId: 'rm_test',
        eventId: 'evt-01',
        kind: 'DELTA_MUTATION',
        sentAt: new Date().toISOString(),
        author: {
          peerId: 'peer_1',
          participantId: 'p-01',
          fullName: 'Participante 01',
          groupTag: 'Grupo 1',
          role: 'ADMIN_SEAL',
          hasAdminSeal: true,
        },
        operations: [adminOp],
      },
      'senha-secreta-2026'
    );

    const decodedAdminPacket = await decodeEncryptedCollabPacket(adminPacket, 'senha-secreta-2026');
    const acceptedOutcome = applyIncomingCollabPacket(
      {
        eventId: 'evt-01',
        skeleton: initialSkeleton,
        privilegeRoster: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
        ledger: [],
        activityLog: rejectedOutcome.updatedActivityLog,
      },
      decodedAdminPacket
    );

    expect(acceptedOutcome.accepted).toBe(true);
    expect(acceptedOutcome.updatedSkeleton[0].value).toBe('Editado pelo Admin 01');
    expect(verifyActivityLogChain(acceptedOutcome.updatedActivityLog).valid).toBe(true);
  });
});
