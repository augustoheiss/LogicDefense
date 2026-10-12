/**
 * Sekundo — Atomic Peer-to-Peer Roster Swap Ledger & Reserve Engine
 *
 * Implements:
 * 1. Inverse Fatigue Score (IFS) ranking for dynamic standby pools (Shadow Rosters).
 * 2. 5-stage atomic swap transaction lifecycle with dry-run compliance simulation.
 * 3. Asymmetric qualification verification.
 */

import {
  setSlot,
  isSlotScheduled,
  hasShiftConflict,
  hasCircadianViolation,
  hasExceededConsecutiveDays,
  hasSameDayShiftCollision,
  checkAvailabilityMatch,
  type ShiftType,
} from './bitmaskSchedule';

// ---------------------------------------------------------------------------
// Types & Contracts
// ---------------------------------------------------------------------------

export type SkillLevel = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'LEADER';

export const SKILL_HIERARCHY: Record<SkillLevel, number> = {
  BASIC: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  LEADER: 4,
};

export interface VolunteerProfile {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  /** Schedule mask (bits for assigned shifts) */
  scheduleMask: bigint;
  /** Availability mask (bits for allowed shifts) */
  availabilityMask: bigint;
  /** Hours elapsed since last shift departure */
  hoursRested: number;
  /** Hours worked in the last 14 days */
  recentHoursWorked: number;
}

export interface ShiftSlotDescriptor {
  slotId: string;
  dayIndex: number;
  shift: ShiftType;
  requiredSkill: SkillLevel;
  durationHours: number;
}

export type SwapState =
  | 'DRAFT'
  | 'PROPOSED'
  | 'PEER_ACCEPTED'
  | 'VALIDATED'
  | 'COMMITTED'
  | 'INVALIDATED'
  | 'CANCELLED';

export interface SwapTransaction {
  id: string;
  slotA: ShiftSlotDescriptor;
  workerAId: string;
  slotB?: ShiftSlotDescriptor; // Optional if giving away shift to standby
  workerBId: string;
  state: SwapState;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Inverse Fatigue Score (IFS) & Standby Ranking
// ---------------------------------------------------------------------------

/**
 * Calculates the Inverse Fatigue Score:
 * IFS = hoursRested / (recentHoursWorked + 1)
 */
export function calculateInverseFatigueScore(
  hoursRested: number,
  recentHoursWorked: number
): number {
  return hoursRested / (Math.max(0, recentHoursWorked) + 1);
}

export interface RankedStandbyCandidate {
  volunteer: VolunteerProfile;
  ifsScore: number;
  isAvailable: boolean;
  isQualified: boolean;
}

/**
 * Ranks off-duty volunteers to identify the ideal replacement.
 * Candidates with highest IFS, matching availability, and required skills are prioritized.
 */
export function rankStandbyCandidates(
  volunteers: VolunteerProfile[],
  targetShift: ShiftSlotDescriptor
): RankedStandbyCandidate[] {
  return volunteers
    .map((v) => {
      const isQualified = SKILL_HIERARCHY[v.skillLevel] >= SKILL_HIERARCHY[targetShift.requiredSkill];
      const isAvailable =
        isSlotScheduled(v.availabilityMask, targetShift.dayIndex, targetShift.shift) &&
        !isSlotScheduled(v.scheduleMask, targetShift.dayIndex, targetShift.shift);
      const ifsScore = calculateInverseFatigueScore(v.hoursRested, v.recentHoursWorked);

      return {
        volunteer: v,
        ifsScore,
        isAvailable,
        isQualified,
      };
    })
    .sort((a, b) => {
      // 1. Qualified first
      if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
      // 2. Available first
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      // 3. Highest IFS score first
      return b.ifsScore - a.ifsScore;
    });
}

// ---------------------------------------------------------------------------
// Dry-Run Swap Simulation & Commit
// ---------------------------------------------------------------------------

export interface SwapDryRunResult {
  isValid: boolean;
  violations: string[];
  workerAUpdatedMask: bigint;
  workerBUpdatedMask: bigint;
}

/**
 * Simulates a proposed swap between Worker A and Worker B without mutating state.
 * Returns whether all hard constraints (availability, circadian, skill, collision) hold.
 */
export function dryRunSwapSimulation(
  workerA: VolunteerProfile,
  slotA: ShiftSlotDescriptor,
  workerB: VolunteerProfile,
  slotB?: ShiftSlotDescriptor
): SwapDryRunResult {
  const violations: string[] = [];

  // Skill verification
  const requiredSkillA = slotA.requiredSkill;
  if (SKILL_HIERARCHY[workerB.skillLevel] < SKILL_HIERARCHY[requiredSkillA]) {
    violations.push(
      `Worker B (${workerB.name}) does not have required skill (${requiredSkillA}) for Slot A.`
    );
  }

  if (slotB) {
    const requiredSkillB = slotB.requiredSkill;
    if (SKILL_HIERARCHY[workerA.skillLevel] < SKILL_HIERARCHY[requiredSkillB]) {
      violations.push(
        `Worker A (${workerA.name}) does not have required skill (${requiredSkillB}) for Slot B.`
      );
    }
  }

  // Calculate updated masks
  // Worker A: loses slotA, gains slotB (if exists)
  let maskA = setSlot(workerA.scheduleMask, slotA.dayIndex, slotA.shift, false);
  if (slotB) {
    maskA = setSlot(maskA, slotB.dayIndex, slotB.shift, true);
  }

  // Worker B: gains slotA, loses slotB (if exists)
  let maskB = setSlot(workerB.scheduleMask, slotA.dayIndex, slotA.shift, true);
  if (slotB) {
    maskB = setSlot(maskB, slotB.dayIndex, slotB.shift, false);
  }

  // Availability check
  if (!checkAvailabilityMatch(maskA, workerA.availabilityMask)) {
    violations.push(`Worker A (${workerA.name}) is not available for the updated schedule.`);
  }
  if (!checkAvailabilityMatch(maskB, workerB.availabilityMask)) {
    violations.push(`Worker B (${workerB.name}) is not available for the updated schedule.`);
  }

  // Same-day collision check
  if (hasSameDayShiftCollision(maskA)) {
    violations.push(`Worker A (${workerA.name}) would have multiple shifts on the same day.`);
  }
  if (hasSameDayShiftCollision(maskB)) {
    violations.push(`Worker B (${workerB.name}) would have multiple shifts on the same day.`);
  }

  // Circadian rotation check
  if (hasCircadianViolation(maskA)) {
    violations.push(`Worker A (${workerA.name}) would violate circadian rotation (Night followed by Morning).`);
  }
  if (hasCircadianViolation(maskB)) {
    violations.push(`Worker B (${workerB.name}) would violate circadian rotation (Night followed by Morning).`);
  }

  // Consecutive days check
  if (hasExceededConsecutiveDays(maskA, 3)) {
    violations.push(`Worker A (${workerA.name}) would exceed 3 consecutive working days.`);
  }
  if (hasExceededConsecutiveDays(maskB, 3)) {
    violations.push(`Worker B (${workerB.name}) would exceed 3 consecutive working days.`);
  }

  return {
    isValid: violations.length === 0,
    violations,
    workerAUpdatedMask: maskA,
    workerBUpdatedMask: maskB,
  };
}

/**
 * Commits a validated swap transaction atomically.
 */
export function commitSwap(
  transaction: SwapTransaction,
  workerA: VolunteerProfile,
  workerB: VolunteerProfile
): {
  transaction: SwapTransaction;
  updatedWorkerA: VolunteerProfile;
  updatedWorkerB: VolunteerProfile;
} {
  const dryRun = dryRunSwapSimulation(workerA, transaction.slotA, workerB, transaction.slotB);

  if (!dryRun.isValid) {
    return {
      transaction: {
        ...transaction,
        state: 'INVALIDATED',
        rejectionReason: dryRun.violations.join(' | '),
        updatedAt: new Date().toISOString(),
        version: transaction.version + 1,
      },
      updatedWorkerA: workerA,
      updatedWorkerB: workerB,
    };
  }

  return {
    transaction: {
      ...transaction,
      state: 'COMMITTED',
      rejectionReason: undefined,
      updatedAt: new Date().toISOString(),
      version: transaction.version + 1,
    },
    updatedWorkerA: {
      ...workerA,
      scheduleMask: dryRun.workerAUpdatedMask,
    },
    updatedWorkerB: {
      ...workerB,
      scheduleMask: dryRun.workerBUpdatedMask,
    },
  };
}
