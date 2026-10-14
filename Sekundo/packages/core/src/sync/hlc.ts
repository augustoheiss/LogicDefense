/**
 * Sekundo — Hybrid Logical Clock (HLC)
 *
 * Combines physical wall-clock time (ms) with a monotonic logical counter
 * and a unique node/device identifier so concurrent offline operations
 * have a deterministic, total ordering that is resilient to clock drift
 * and never ties when two devices edit at the same millisecond.
 */

export interface HLC {
  /** Wall-clock time in epoch milliseconds */
  physical: number;
  /** Monotonic counter within the same physical millisecond */
  logical: number;
  /** Unique device/author identifier */
  nodeId: string;
}

/**
 * Formats an HLC into a lexicographically sortable string:
 * `<15-digit-physical>:<5-digit-hex-logical>:<nodeId>`
 */
export function packHLC(hlc: HLC): string {
  const phys = Math.max(0, Math.floor(hlc.physical)).toString().padStart(15, '0');
  const log = Math.max(0, Math.floor(hlc.logical)).toString(16).padStart(5, '0');
  return `${phys}:${log}:${hlc.nodeId}`;
}

/**
 * Parses a packed HLC string back into an HLC struct.
 * Returns `null` if the string is not a valid packed HLC.
 */
export function unpackHLC(packed: string | undefined | null): HLC | null {
  if (!packed || typeof packed !== 'string') return null;
  const firstColon = packed.indexOf(':');
  if (firstColon < 0) return null;
  const secondColon = packed.indexOf(':', firstColon + 1);
  if (secondColon < 0) return null;

  const physical = Number(packed.slice(0, firstColon));
  const logical = parseInt(packed.slice(firstColon + 1, secondColon), 16);
  const nodeId = packed.slice(secondColon + 1);

  if (!Number.isFinite(physical) || !Number.isFinite(logical) || !nodeId) {
    return null;
  }
  return { physical, logical, nodeId };
}

/**
 * Creates a fresh HLC for a given device and optional wall-clock timestamp.
 */
export function createHLC(nodeId: string, nowMs: number = Date.now()): HLC {
  return { physical: Math.floor(nowMs), logical: 0, nodeId };
}

/**
 * Advances a local HLC for a new local event.
 * Guarantees strict monotonicity even if the device wall clock moves backward.
 */
export function tickHLC(prev: HLC | null, nodeId: string, nowMs: number = Date.now()): HLC {
  const wall = Math.floor(nowMs);
  if (!prev) {
    return { physical: wall, logical: 0, nodeId };
  }
  if (wall > prev.physical) {
    return { physical: wall, logical: 0, nodeId };
  }
  return {
    physical: prev.physical,
    logical: prev.logical + 1,
    nodeId,
  };
}

/**
 * Merges a remote HLC with the local clock upon receiving peer operations.
 */
export function receiveHLC(local: HLC | null, remote: HLC, nodeId: string, nowMs: number = Date.now()): HLC {
  const wall = Math.floor(nowMs);
  const localPhys = local ? local.physical : 0;
  const localLog = local ? local.logical : 0;

  if (wall > localPhys && wall > remote.physical) {
    return { physical: wall, logical: 0, nodeId };
  }
  if (localPhys === remote.physical) {
    return { physical: localPhys, logical: Math.max(localLog, remote.logical) + 1, nodeId };
  }
  if (localPhys > remote.physical) {
    return { physical: localPhys, logical: localLog + 1, nodeId };
  }
  return { physical: remote.physical, logical: remote.logical + 1, nodeId };
}

/**
 * Total ordering comparison between two HLCs.
 * Returns < 0 if a < b, > 0 if a > b, 0 if identical.
 */
export function compareHLC(a: HLC, b: HLC): number {
  if (a.physical !== b.physical) return a.physical - b.physical;
  if (a.logical !== b.logical) return a.logical - b.logical;
  return a.nodeId.localeCompare(b.nodeId);
}
