/**
 * Sekundo — High-Performance BigInt Bitmask Schedule Engine
 *
 * Implements O(1) availability verification, shift conflict detection,
 * and ergonomic circadian rotation validation over a 28-day horizon (84 slots).
 */

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export const SHIFT_TYPES: readonly ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;
export const SHIFTS_PER_DAY = 3;
export const HORIZON_DAYS = 28;
export const TOTAL_SLOTS = HORIZON_DAYS * SHIFTS_PER_DAY; // 84 bits

/**
 * Returns the bit index (0 to 83) for a given day (0 to 27) and shift type.
 */
export function getSlotIndex(dayIndex: number, shift: ShiftType): number {
  if (dayIndex < 0 || dayIndex >= HORIZON_DAYS) {
    throw new Error(`Invalid dayIndex ${dayIndex}. Must be within 0..${HORIZON_DAYS - 1}`);
  }
  const shiftIdx = SHIFT_TYPES.indexOf(shift);
  return dayIndex * SHIFTS_PER_DAY + shiftIdx;
}

/**
 * Creates a single-bit mask for a given day and shift.
 */
export function createSlotMask(dayIndex: number, shift: ShiftType): bigint {
  const bitPos = getSlotIndex(dayIndex, shift);
  return 1n << BigInt(bitPos);
}

/**
 * Checks if a specific slot is active within a schedule mask.
 */
export function isSlotScheduled(mask: bigint, dayIndex: number, shift: ShiftType): boolean {
  const slot = createSlotMask(dayIndex, shift);
  return (mask & slot) !== 0n;
}

/**
 * Sets or clears a specific slot in the mask, returning the new mask.
 */
export function setSlot(
  mask: bigint,
  dayIndex: number,
  shift: ShiftType,
  value: boolean
): bigint {
  const slot = createSlotMask(dayIndex, shift);
  return value ? mask | slot : mask & ~slot;
}

/**
 * Returns true if all shifts in candidateMask are permitted by availabilityMask.
 * (candidateMask & ~availabilityMask) === 0n
 */
export function checkAvailabilityMatch(
  candidateMask: bigint,
  availabilityMask: bigint
): boolean {
  return (candidateMask & ~availabilityMask) === 0n;
}

/**
 * Returns true if candidateMask has any slot overlap with existingMask.
 */
export function hasShiftConflict(
  candidateMask: bigint,
  existingMask: bigint
): boolean {
  return (candidateMask & existingMask) !== 0n;
}

/**
 * Checks whether a volunteer has multiple shifts assigned on the same calendar day.
 */
export function hasSameDayShiftCollision(mask: bigint, totalDays: number = HORIZON_DAYS): boolean {
  for (let d = 0; d < totalDays; d++) {
    let count = 0;
    for (const shift of SHIFT_TYPES) {
      if (isSlotScheduled(mask, d, shift)) {
        count++;
        if (count > 1) return true;
      }
    }
  }
  return false;
}

/**
 * Validates ergonomic circadian sequencing.
 * Returns true if a Night shift on day d is immediately followed by a Morning shift on day d + 1.
 */
export function hasCircadianViolation(mask: bigint, totalDays: number = HORIZON_DAYS): boolean {
  for (let d = 0; d < totalDays - 1; d++) {
    const workedNight = isSlotScheduled(mask, d, 'NIGHT');
    const workedNextMorning = isSlotScheduled(mask, d + 1, 'MORNING');
    if (workedNight && workedNextMorning) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the schedule exceeds the maximum permitted consecutive working days.
 */
export function hasExceededConsecutiveDays(
  mask: bigint,
  maxConsecutive: number = 3,
  totalDays: number = HORIZON_DAYS
): boolean {
  let consecutive = 0;

  for (let d = 0; d < totalDays; d++) {
    const workedToday = SHIFT_TYPES.some((shift) => isSlotScheduled(mask, d, shift));
    if (workedToday) {
      consecutive++;
      if (consecutive > maxConsecutive) {
        return true;
      }
    } else {
      consecutive = 0;
    }
  }

  return false;
}

/**
 * Counts total assigned shifts (popcount) in the BigInt mask.
 */
export function countTotalShifts(mask: bigint): number {
  let count = 0;
  let temp = mask;
  while (temp > 0n) {
    if ((temp & 1n) === 1n) count++;
    temp >>= 1n;
  }
  return count;
}
