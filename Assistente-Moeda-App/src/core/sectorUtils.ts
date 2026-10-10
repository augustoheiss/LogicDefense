/**
 * Sector Utility Functions — Pure zero-dependency helpers
 */

export function isSectorActive(sectorId: string, activeSectors?: string[] | null): boolean {
  if (!activeSectors || activeSectors.length === 0) return false;
  return activeSectors.includes(sectorId);
}
