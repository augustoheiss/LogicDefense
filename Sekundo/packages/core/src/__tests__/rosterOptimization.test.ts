import { describe, it, expect } from 'vitest';
import {
  createSlotMask,
  setSlot,
  isSlotScheduled,
  hasShiftConflict,
  checkAvailabilityMatch,
  hasCircadianViolation,
  hasExceededConsecutiveDays,
  countTotalShifts,
} from '../roster/bitmaskSchedule';
import {
  calculateInverseFatigueScore,
  rankStandbyCandidates,
  dryRunSwapSimulation,
  commitSwap,
  type VolunteerProfile,
  type ShiftSlotDescriptor,
  type SwapTransaction,
} from '../roster/swapLedger';

describe('Bitmask Schedule & Roster Optimization Engine', () => {
  describe('Bitmask Operations (O(1))', () => {
    it('should set and test slots accurately across 84 bits', () => {
      let mask = 0n;
      expect(isSlotScheduled(mask, 0, 'MORNING')).toBe(false);

      mask = setSlot(mask, 0, 'MORNING', true);
      expect(isSlotScheduled(mask, 0, 'MORNING')).toBe(true);
      expect(isSlotScheduled(mask, 0, 'NIGHT')).toBe(false);

      mask = setSlot(mask, 27, 'NIGHT', true); // Last slot (slot 83)
      expect(isSlotScheduled(mask, 27, 'NIGHT')).toBe(true);
      expect(countTotalShifts(mask)).toBe(2);
    });

    it('should detect availability violations in O(1)', () => {
      const availMask = createSlotMask(1, 'MORNING') | createSlotMask(2, 'AFTERNOON');
      const candidateMaskValid = createSlotMask(1, 'MORNING');
      const candidateMaskInvalid = createSlotMask(3, 'NIGHT');

      expect(checkAvailabilityMatch(candidateMaskValid, availMask)).toBe(true);
      expect(checkAvailabilityMatch(candidateMaskInvalid, availMask)).toBe(false);
    });

    it('should detect shift conflicts instantly', () => {
      const existing = createSlotMask(5, 'AFTERNOON');
      const overlapping = createSlotMask(5, 'AFTERNOON');
      const nonOverlapping = createSlotMask(5, 'MORNING');

      expect(hasShiftConflict(overlapping, existing)).toBe(true);
      expect(hasShiftConflict(nonOverlapping, existing)).toBe(false);
    });

    it('should detect circadian violations (Night followed immediately by Morning next day)', () => {
      // Day 3 Night + Day 4 Morning -> VIOLATION
      let mask = createSlotMask(3, 'NIGHT') | createSlotMask(4, 'MORNING');
      expect(hasCircadianViolation(mask)).toBe(true);

      // Day 3 Morning + Day 4 Night -> VALID
      mask = createSlotMask(3, 'MORNING') | createSlotMask(4, 'NIGHT');
      expect(hasCircadianViolation(mask)).toBe(false);
    });

    it('should detect when consecutive days exceed threshold', () => {
      // 4 days in a row (days 0, 1, 2, 3) with maxConsecutive = 3 -> EXCEEDED
      let mask =
        createSlotMask(0, 'MORNING') |
        createSlotMask(1, 'MORNING') |
        createSlotMask(2, 'MORNING') |
        createSlotMask(3, 'MORNING');
      expect(hasExceededConsecutiveDays(mask, 3)).toBe(true);

      // 3 days in a row -> ALLOWED
      mask =
        createSlotMask(0, 'MORNING') |
        createSlotMask(1, 'MORNING') |
        createSlotMask(2, 'MORNING');
      expect(hasExceededConsecutiveDays(mask, 3)).toBe(false);
    });
  });

  describe('Standby Pools & Inverse Fatigue Score (IFS)', () => {
    it('should calculate IFS score with higher priority for well-rested personnel', () => {
      // Worker A: 48h rested, 10h worked recently -> IFS = 48 / 11 = ~4.36
      const scoreA = calculateInverseFatigueScore(48, 10);
      // Worker B: 12h rested, 40h worked recently -> IFS = 12 / 41 = ~0.29
      const scoreB = calculateInverseFatigueScore(12, 40);

      expect(scoreA).toBeGreaterThan(scoreB);
    });

    it('should rank standby candidates prioritizing qualified and available with highest IFS', () => {
      const targetSlot: ShiftSlotDescriptor = {
        slotId: 'slot_1',
        dayIndex: 5,
        shift: 'MORNING',
        requiredSkill: 'INTERMEDIATE',
        durationHours: 4,
      };

      const candidateA: VolunteerProfile = {
        id: 'vol_A',
        name: 'Participante 01 (Qualified, Well-Rested)',
        skillLevel: 'LEADER',
        scheduleMask: 0n,
        availabilityMask: createSlotMask(5, 'MORNING'),
        hoursRested: 72,
        recentHoursWorked: 8,
      };

      const candidateB: VolunteerProfile = {
        id: 'vol_B',
        name: 'Participante 02 (Underqualified)',
        skillLevel: 'BASIC',
        scheduleMask: 0n,
        availabilityMask: createSlotMask(5, 'MORNING'),
        hoursRested: 90,
        recentHoursWorked: 2,
      };

      const candidateC: VolunteerProfile = {
        id: 'vol_C',
        name: 'Participante 03 (Qualified but Fatigued)',
        skillLevel: 'ADVANCED',
        scheduleMask: 0n,
        availabilityMask: createSlotMask(5, 'MORNING'),
        hoursRested: 10,
        recentHoursWorked: 35,
      };

      const ranked = rankStandbyCandidates([candidateB, candidateC, candidateA], targetSlot);

      // Qualified candidates first, sorted by IFS
      expect(ranked[0].volunteer.id).toBe('vol_A');
      expect(ranked[1].volunteer.id).toBe('vol_C');
      expect(ranked[2].volunteer.id).toBe('vol_B'); // underqualified goes last
    });
  });

  describe('Atomic Shift Swap Lifecycle', () => {
    const slotA: ShiftSlotDescriptor = {
      slotId: 'slot_sat',
      dayIndex: 6,
      shift: 'MORNING',
      requiredSkill: 'INTERMEDIATE',
      durationHours: 4,
    };

    it('should validate and commit an allowed swap', () => {
      const workerA: VolunteerProfile = {
        id: 'wA',
        name: 'André',
        skillLevel: 'ADVANCED',
        scheduleMask: createSlotMask(6, 'MORNING'),
        availabilityMask: createSlotMask(6, 'MORNING'),
        hoursRested: 24,
        recentHoursWorked: 10,
      };

      const workerB: VolunteerProfile = {
        id: 'wB',
        name: 'Bernardo',
        skillLevel: 'INTERMEDIATE',
        scheduleMask: 0n,
        availabilityMask: createSlotMask(6, 'MORNING'),
        hoursRested: 48,
        recentHoursWorked: 4,
      };

      const transaction: SwapTransaction = {
        id: 'tx_01',
        slotA,
        workerAId: 'wA',
        workerBId: 'wB',
        state: 'PEER_ACCEPTED',
        createdAt: '2026-10-12T10:00:00Z',
        updatedAt: '2026-10-12T10:00:00Z',
        version: 1,
      };

      const result = commitSwap(transaction, workerA, workerB);

      expect(result.transaction.state).toBe('COMMITTED');
      expect(isSlotScheduled(result.updatedWorkerA.scheduleMask, 6, 'MORNING')).toBe(false);
      expect(isSlotScheduled(result.updatedWorkerB.scheduleMask, 6, 'MORNING')).toBe(true);
    });

    it('should reject a swap that violates qualification requirements', () => {
      const workerA: VolunteerProfile = {
        id: 'wA',
        name: 'André (Leader)',
        skillLevel: 'LEADER',
        scheduleMask: createSlotMask(6, 'MORNING'),
        availabilityMask: createSlotMask(6, 'MORNING'),
        hoursRested: 24,
        recentHoursWorked: 10,
      };

      const workerB: VolunteerProfile = {
        id: 'wB',
        name: 'Cláudio (Basic)',
        skillLevel: 'BASIC', // Below INTERMEDIATE required by slotA!
        scheduleMask: 0n,
        availabilityMask: createSlotMask(6, 'MORNING'),
        hoursRested: 48,
        recentHoursWorked: 4,
      };

      const transaction: SwapTransaction = {
        id: 'tx_02',
        slotA,
        workerAId: 'wA',
        workerBId: 'wB',
        state: 'PEER_ACCEPTED',
        createdAt: '2026-10-12T10:00:00Z',
        updatedAt: '2026-10-12T10:00:00Z',
        version: 1,
      };

      const result = commitSwap(transaction, workerA, workerB);

      expect(result.transaction.state).toBe('INVALIDATED');
      expect(result.transaction.rejectionReason).toContain('does not have required skill');
      // Masks remain unmutated
      expect(isSlotScheduled(result.updatedWorkerA.scheduleMask, 6, 'MORNING')).toBe(true);
      expect(isSlotScheduled(result.updatedWorkerB.scheduleMask, 6, 'MORNING')).toBe(false);
    });
  });
});
