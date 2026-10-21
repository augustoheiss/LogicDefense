/**
 * Sekundo — Roster-Backed Zero-Trust Admission Gate & RBAC Hierarchy (`👑 Selo Admin`)
 *
 * Implements:
 * 1. First-Time Registration Confirmation Gate (`verifyParticipantAdmission`):
 *    - Validates Full Name (`fullName`), Operational Group (`groupTag`), and Individual PIN (`pin`)
 *      against the event's Privilege Matrix (`ParticipantProfile[]`).
 *    - Enforces the Privilege Eligibility Invariant: if a person's name is NOT in the Privilege List
 *      OR has ZERO active privileges (`activeCapabilityCount === 0`), they are strictly blocked
 *      from viewing any spreadsheet (`UNAUTHORIZED`).
 * 2. Two-Tier Authorized Spreadsheet Hierarchy:
 *    - `ADMIN_SEAL` (`👑 Selo Admin` active in Privilege List): Full permission to view all sheets,
 *      edit cells/nodes simultaneously, export spreadsheets (CSV Geral, Granular CSV, PDF, YAML),
 *      and manage the Privilege Matrix & Activity Log.
 *    - `VIEWER` (Registered in Privilege List with >= 1 active privilege, but WITHOUT `👑 Selo Admin`):
 *      Can consult/view any spreadsheet in real time, but is strictly forbidden from editing any
 *      information or exporting any spreadsheet.
 * 3. Persistent Trusted Device Session with Explicit Logout & Quick PIN Lock:
 *    - Once confirmed on first access, the session is persisted on the device so the user does not
 *      have to re-enter Name + Group + PIN on every visit.
 *    - Supports explicit `logoutSession` (clearing identity so another user on the same device must
 *      confirm registration) and `lockSessionWithPin` / `unlockSessionWithPin` for shared device safety.
 *
 * Skills: agency-software-architect, agency-code-reviewer
 */

import {
  type ParticipantProfile,
  normalizePersonKey,
} from '../roster/participantDirectory';

export type SpreadsheetAccessRole = 'ADMIN_SEAL' | 'VIEWER' | 'UNAUTHORIZED';

export type SpreadsheetPermissionAction =
  | 'VIEW_SPREADSHEET'
  | 'EDIT_SPREADSHEET'
  | 'ADD_OR_DELETE_NODE'
  | 'EXPORT_SPREADSHEET'
  | 'MANAGE_PRIVILEGES'
  | 'VIEW_FULL_AUDIT_LOG'
  | 'EXPORT_AUDIT_LOG';

export type AdmissionRejectionReason =
  | 'EMPTY_FIELDS'
  | 'NOT_IN_PRIVILEGE_LIST'
  | 'INACTIVE_PARTICIPANT'
  | 'ZERO_ACTIVE_PRIVILEGES'
  | 'GROUP_MISMATCH'
  | 'PIN_MISMATCH';

export interface CollaborativeGovernancePolicy {
  requireAtLeastOneActivePrivilege: boolean;
  requireGroupMatch: boolean;
  requirePinMatch: boolean;
  rolePermissions: Record<SpreadsheetAccessRole, SpreadsheetPermissionAction[]>;
}

/**
 * Declarative Metadata Policy (Anti-Dodo Code: Abstractions in Code, Details in Metadata)
 */
export const COLLAB_GOVERNANCE_POLICY: CollaborativeGovernancePolicy = {
  requireAtLeastOneActivePrivilege: true,
  requireGroupMatch: true,
  requirePinMatch: true,
  rolePermissions: {
    ADMIN_SEAL: [
      'VIEW_SPREADSHEET',
      'EDIT_SPREADSHEET',
      'ADD_OR_DELETE_NODE',
      'EXPORT_SPREADSHEET',
      'MANAGE_PRIVILEGES',
      'VIEW_FULL_AUDIT_LOG',
      'EXPORT_AUDIT_LOG',
    ],
    VIEWER: ['VIEW_SPREADSHEET'],
    UNAUTHORIZED: [],
  },
};

export interface SpreadsheetPermissionsSummary {
  canViewSpreadsheet: boolean;
  canEditSpreadsheet: boolean;
  canMutateStructure: boolean;
  canExportSpreadsheet: boolean;
  canManagePrivileges: boolean;
  canViewFullAuditLog: boolean;
}

export interface AuthenticatedSessionPrincipal {
  sessionId: string;
  eventId: string;
  participantId: string;
  fullName: string;
  groupTag: string;
  role: SpreadsheetAccessRole;
  hasAdminSeal: boolean;
  activePrivilegeCount: number;
  activePrivilegeKeys: string[];
  confirmedAt: string;
  lastActiveAt: string;
  /** True when the user clicked "🔒 Bloquear Tela" on a shared device; requires only PIN to unlock */
  isPinLocked?: boolean;
  /** Masked or hashed PIN verifier for quick unlock without storing raw secrets in network packets */
  pinVerifierHash: string;
  permissions: SpreadsheetPermissionsSummary;
}

export interface AdmissionVerificationInput {
  fullName: string;
  groupTag: string;
  pin: string;
  eventId?: string;
}

export interface AdmissionVerificationResult {
  allowed: boolean;
  role: SpreadsheetAccessRole;
  principal?: AuthenticatedSessionPrincipal;
  rejectionReason?: AdmissionRejectionReason;
  errorMessage?: string;
  matchedParticipant?: ParticipantProfile;
}

/**
 * Lightweight deterministic hash for client-side PIN verification (FNV-1a 64-bit hex).
 */
export function computePinVerifierHash(rawPin: string, participantId: string = ''): string {
  const clean = `${normalizePersonKey(participantId)}::${(rawPin || '').trim()}`;
  let h1 = 0xdeadbeef ^ clean.length;
  let h2 = 0x41c6ce57 ^ clean.length;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `pvh_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Counts how many active privileges (`true` flags in `capabilities`) a participant holds.
 */
export function getActivePrivilegeKeys(profile?: ParticipantProfile | null): string[] {
  if (!profile) return [];
  const activeKeys: string[] = [];
  if (profile.capabilities && typeof profile.capabilities === 'object') {
    for (const [key, enabled] of Object.entries(profile.capabilities)) {
      if (enabled === true && key !== 'cap_selo_admin' && key !== 'selo_admin') {
        activeKeys.push(key);
      }
    }
  }
  if (activeKeys.length === 0 && Array.isArray(profile.capabilityTags)) {
    for (const tag of profile.capabilityTags) {
      const clean = (tag || '').trim();
      if (clean && !/^(selo_admin|admin|👑)$/i.test(clean)) {
        activeKeys.push(clean);
      }
    }
  }
  return activeKeys;
}

/**
 * Checks whether a participant holds at least one active privilege in the Privilege Matrix.
 */
export function hasActivePrivileges(profile?: ParticipantProfile | null): boolean {
  if (!profile || profile.active === false) return false;
  return getActivePrivilegeKeys(profile).length > 0 || hasAdminSealPrivilege(profile);
}

/**
 * Checks whether a participant has been granted the `👑 Selo Admin` in the Privilege Matrix.
 */
export function hasAdminSealPrivilege(profile?: ParticipantProfile | null): boolean {
  if (!profile || profile.active === false) return false;
  if (profile.hasAdminSeal === true) return true;
  if (profile.capabilities?.cap_selo_admin === true || profile.capabilities?.selo_admin === true) {
    return true;
  }
  if (
    Array.isArray(profile.capabilityTags) &&
    profile.capabilityTags.some((t) => /^(selo_admin|cap_selo_admin|👑\s*selo\s*admin)$/i.test(t.trim()))
  ) {
    return true;
  }
  return false;
}

/**
 * Builds the boolean permission flags for a given `SpreadsheetAccessRole`.
 */
export function buildPermissionsForRole(
  role: SpreadsheetAccessRole,
  policy: CollaborativeGovernancePolicy = COLLAB_GOVERNANCE_POLICY
): SpreadsheetPermissionsSummary {
  const allowedSet = new Set<SpreadsheetPermissionAction>(policy.rolePermissions[role] || []);
  return {
    canViewSpreadsheet: allowedSet.has('VIEW_SPREADSHEET'),
    canEditSpreadsheet: allowedSet.has('EDIT_SPREADSHEET'),
    canMutateStructure: allowedSet.has('ADD_OR_DELETE_NODE'),
    canExportSpreadsheet: allowedSet.has('EXPORT_SPREADSHEET'),
    canManagePrivileges: allowedSet.has('MANAGE_PRIVILEGES'),
    canViewFullAuditLog: allowedSet.has('VIEW_FULL_AUDIT_LOG'),
  };
}

/**
 * Evaluates whether a session principal has authority to perform a specific spreadsheet action.
 */
export function canPerformSpreadsheetAction(
  principal: AuthenticatedSessionPrincipal | null | undefined,
  action: SpreadsheetPermissionAction,
  policy: CollaborativeGovernancePolicy = COLLAB_GOVERNANCE_POLICY
): boolean {
  if (!principal || principal.isPinLocked) return false;
  const allowedList = policy.rolePermissions[principal.role] || [];
  return allowedList.includes(action);
}

/**
 * Verifies a user's First-Time Registration Confirmation (Full Name + Group + PIN)
 * against the event's Privilege Matrix (`ParticipantProfile[]`).
 *
 * Preconditions:
 *   - `roster` is a valid array of `ParticipantProfile`.
 * Postconditions:
 *   - Returns `allowed: true` ONLY if the person is found in `roster`, is active,
 *     matches Group & PIN, and holds >= 1 active privilege.
 *   - Grants `role: 'ADMIN_SEAL'` ONLY if `hasAdminSealPrivilege(matched)` is true.
 */
export function verifyParticipantAdmission(
  input: AdmissionVerificationInput,
  roster: ParticipantProfile[],
  policy: CollaborativeGovernancePolicy = COLLAB_GOVERNANCE_POLICY
): AdmissionVerificationResult {
  const rawName = (input.fullName || '').trim();
  const rawGroup = (input.groupTag || '').trim();
  const rawPin = (input.pin || '').trim();

  if (!rawName || (policy.requireGroupMatch && !rawGroup) || (policy.requirePinMatch && !rawPin)) {
    return {
      allowed: false,
      role: 'UNAUTHORIZED',
      rejectionReason: 'EMPTY_FIELDS',
      errorMessage:
        'Preencha Nome Completo, Grupo e PIN de cadastro para confirmar sua identidade.',
    };
  }

  const normInputName = normalizePersonKey(rawName);
  // Strict normalized full-name match against Privilege Roster
  const matched = (roster || []).find((p) => normalizePersonKey(p.name) === normInputName);

  if (!matched) {
    return {
      allowed: false,
      role: 'UNAUTHORIZED',
      rejectionReason: 'NOT_IN_PRIVILEGE_LIST',
      errorMessage:
        'Acesso bloqueado: seu nome não consta na Lista de Privilégios desta planilha.',
    };
  }

  if (matched.active === false) {
    return {
      allowed: false,
      role: 'UNAUTHORIZED',
      rejectionReason: 'INACTIVE_PARTICIPANT',
      matchedParticipant: matched,
      errorMessage:
        'Acesso bloqueado: este cadastro encontra-se inativo na Lista de Privilégios.',
    };
  }

  const activePrivKeys = getActivePrivilegeKeys(matched);
  const isAdmin = hasAdminSealPrivilege(matched);

  if (policy.requireAtLeastOneActivePrivilege && activePrivKeys.length === 0 && !isAdmin) {
    return {
      allowed: false,
      role: 'UNAUTHORIZED',
      rejectionReason: 'ZERO_ACTIVE_PRIVILEGES',
      matchedParticipant: matched,
      errorMessage:
        'Acesso bloqueado: seu nome está cadastrado, mas não possui nenhum privilégio ativo na Lista de Privilégios para visualizar a planilha.',
    };
  }

  if (policy.requireGroupMatch) {
    const normInputGroup = normalizePersonKey(rawGroup);
    const normExpectedGroup = normalizePersonKey(matched.groupTag || '');
    if (normExpectedGroup && normInputGroup !== normExpectedGroup) {
      return {
        allowed: false,
        role: 'UNAUTHORIZED',
        rejectionReason: 'GROUP_MISMATCH',
        matchedParticipant: matched,
        errorMessage:
          'Confirmação incorreta: o Grupo Operacional informado não corresponde ao seu cadastro na Lista de Privilégios.',
      };
    }
  }

  if (policy.requirePinMatch) {
    const expectedPin = (matched.accessPin || '').trim();
    if (expectedPin && rawPin !== expectedPin) {
      return {
        allowed: false,
        role: 'UNAUTHORIZED',
        rejectionReason: 'PIN_MISMATCH',
        matchedParticipant: matched,
        errorMessage:
          'PIN de cadastro inválido. Verifique o PIN com o Administrador da planilha.',
      };
    }
  }

  const role: SpreadsheetAccessRole = isAdmin ? 'ADMIN_SEAL' : 'VIEWER';
  const nowIso = new Date().toISOString();
  const principal: AuthenticatedSessionPrincipal = {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eventId: input.eventId || 'global',
    participantId: matched.id,
    fullName: matched.name,
    groupTag: matched.groupTag || rawGroup,
    role,
    hasAdminSeal: isAdmin,
    activePrivilegeCount: activePrivKeys.length + (isAdmin ? 1 : 0),
    activePrivilegeKeys: activePrivKeys,
    confirmedAt: nowIso,
    lastActiveAt: nowIso,
    isPinLocked: false,
    pinVerifierHash: computePinVerifierHash(rawPin || matched.accessPin || '', matched.id),
    permissions: buildPermissionsForRole(role, policy),
  };

  return {
    allowed: true,
    role,
    principal,
    matchedParticipant: matched,
  };
}

/**
 * Re-validates a previously saved device session against the latest Privilege Roster
 * (e.g., if an Admin revoked someone's privileges or granted/revoked their `👑 Selo Admin`
 * while they were already registered on the device).
 */
export function revalidateSavedSessionPrincipal(
  savedPrincipal: AuthenticatedSessionPrincipal,
  roster: ParticipantProfile[],
  policy: CollaborativeGovernancePolicy = COLLAB_GOVERNANCE_POLICY
): AdmissionVerificationResult {
  const matched =
    (roster || []).find((p) => p.id === savedPrincipal.participantId) ||
    (roster || []).find((p) => normalizePersonKey(p.name) === normalizePersonKey(savedPrincipal.fullName));

  if (!matched) {
    return {
      allowed: false,
      role: 'UNAUTHORIZED',
      rejectionReason: 'NOT_IN_PRIVILEGE_LIST',
      errorMessage: 'Seu cadastro foi removido da Lista de Privilégios.',
    };
  }

  if (matched.active === false) {
    return {
      allowed: false,
      role: 'UNAUTHORIZED',
      rejectionReason: 'INACTIVE_PARTICIPANT',
      matchedParticipant: matched,
      errorMessage: 'Seu cadastro foi desativado na Lista de Privilégios.',
    };
  }

  const activePrivKeys = getActivePrivilegeKeys(matched);
  const isAdmin = hasAdminSealPrivilege(matched);

  if (policy.requireAtLeastOneActivePrivilege && activePrivKeys.length === 0 && !isAdmin) {
    return {
      allowed: false,
      role: 'UNAUTHORIZED',
      rejectionReason: 'ZERO_ACTIVE_PRIVILEGES',
      matchedParticipant: matched,
      errorMessage: 'Você não possui mais privilégios ativos para visualizar esta planilha.',
    };
  }

  const role: SpreadsheetAccessRole = isAdmin ? 'ADMIN_SEAL' : 'VIEWER';
  const refreshedPrincipal: AuthenticatedSessionPrincipal = {
    ...savedPrincipal,
    participantId: matched.id,
    fullName: matched.name,
    groupTag: matched.groupTag || savedPrincipal.groupTag,
    role,
    hasAdminSeal: isAdmin,
    activePrivilegeCount: activePrivKeys.length + (isAdmin ? 1 : 0),
    activePrivilegeKeys: activePrivKeys,
    lastActiveAt: new Date().toISOString(),
    permissions: buildPermissionsForRole(role, policy),
  };

  return {
    allowed: true,
    role,
    principal: refreshedPrincipal,
    matchedParticipant: matched,
  };
}

/**
 * Locks an active device session with the user's PIN (so if someone else picks up the same
 * phone/computer, they cannot view or edit without entering the PIN or clicking Logout).
 */
export function lockSessionWithPin(
  principal: AuthenticatedSessionPrincipal
): AuthenticatedSessionPrincipal {
  return {
    ...principal,
    isPinLocked: true,
    lastActiveAt: new Date().toISOString(),
  };
}

/**
 * Unlocks a PIN-locked session on the same device using only the user's PIN.
 */
export function unlockSessionWithPin(
  principal: AuthenticatedSessionPrincipal,
  candidatePin: string
): { unlocked: boolean; principal: AuthenticatedSessionPrincipal; errorMessage?: string } {
  const candidateHash = computePinVerifierHash(candidatePin, principal.participantId);
  if (candidateHash !== principal.pinVerifierHash) {
    return {
      unlocked: false,
      principal,
      errorMessage: 'PIN incorreto. Digite o PIN do seu cadastro ou clique em "Sair (Logout)" para entrar com outra pessoa.',
    };
  }
  return {
    unlocked: true,
    principal: {
      ...principal,
      isPinLocked: false,
      lastActiveAt: new Date().toISOString(),
    },
  };
}
