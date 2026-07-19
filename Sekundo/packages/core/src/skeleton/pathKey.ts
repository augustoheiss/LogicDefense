/**
 * Sekundo — Path Key Engine
 *
 * The heart of the infinite-depth addressing system.
 * Path keys are hyphen-separated numeric strings (e.g., "01-01-01-01")
 * that create any hierarchy without code changes.
 *
 * Design decisions:
 *   - Digit-width agnostic: "01", "001", and "1" all resolve to integer 1.
 *   - Split on "-" delimiter, parse each segment as integer.
 *   - Sorting by integer array comparison, not string comparison.
 *   - Parent-child relationships derived purely from key structure.
 */

import type { ParsedKey, PathKey } from './types';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Separator used between path key segments. */
const SEPARATOR = '-';

/**
 * Parse a path key string into an array of integers.
 *
 * @param key - The path key string (e.g., "01-01-01").
 * @returns Array of integers (e.g., [1, 1, 1]).
 * @throws {Error} If the key is empty or contains non-numeric segments.
 *
 * @example
 * parse("01-01-01")    // → [1, 1, 1]
 * parse("001-002-001") // → [1, 2, 1]
 * parse("3-1")         // → [3, 1]
 */
export function parse(key: PathKey): ParsedKey {
  if (!key || typeof key !== 'string') {
    throw new Error(`Invalid path key: "${key}". Must be a non-empty string.`);
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid path key: empty string after trimming.');
  }

  const segments = trimmed.split(SEPARATOR);
  const parsed: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (segment.length === 0) {
      throw new Error(
        `Invalid path key: "${key}". Empty segment at position ${i}.`
      );
    }

    // Validate that the segment contains only digits
    if (!/^\d+$/.test(segment)) {
      throw new Error(
        `Invalid path key: "${key}". Segment "${segment}" at position ${i} is not a valid integer.`
      );
    }

    const num = parseInt(segment, 10);

    if (num < 0) {
      throw new Error(
        `Invalid path key: "${key}". Negative segment at position ${i}.`
      );
    }

    parsed.push(num);
  }

  return parsed;
}

/**
 * Serialize a parsed key back to a string.
 * Uses zero-padded two-digit format by default, matching the most common usage.
 *
 * @param parsed - Array of integers.
 * @param padWidth - Minimum digit width for each segment (default: 2).
 * @returns Formatted path key string.
 *
 * @example
 * serialize([1, 1, 1])    // → "01-01-01"
 * serialize([1, 2, 1], 3) // → "001-002-001"
 */
export function serialize(parsed: ParsedKey, padWidth: number = 2): PathKey {
  if (!parsed || parsed.length === 0) {
    throw new Error('Cannot serialize an empty parsed key.');
  }

  return parsed.map((n) => String(n).padStart(padWidth, '0')).join(SEPARATOR);
}

// ---------------------------------------------------------------------------
// Depth & Navigation
// ---------------------------------------------------------------------------

/**
 * Get the depth (number of segments) of a path key.
 *
 * @example
 * depth("01")          // → 1
 * depth("01-01")       // → 2
 * depth("01-01-01-01") // → 4
 */
export function depth(key: PathKey): number {
  return parse(key).length;
}

/**
 * Get the parent key of a path key.
 * Returns `null` for root-level keys (depth 1).
 *
 * @example
 * parent("01-01-01") // → "01-01"
 * parent("01-01")    // → "01"
 * parent("01")       // → null
 */
export function parent(key: PathKey): PathKey | null {
  const parsed = parse(key);
  if (parsed.length <= 1) {
    return null;
  }
  return serialize(parsed.slice(0, -1));
}

/**
 * Get all ancestor keys of a path key, from root to immediate parent.
 *
 * @example
 * ancestors("01-01-01-01") // → ["01", "01-01", "01-01-01"]
 */
export function ancestors(key: PathKey): PathKey[] {
  const parsed = parse(key);
  const result: PathKey[] = [];

  for (let i = 1; i < parsed.length; i++) {
    result.push(serialize(parsed.slice(0, i)));
  }

  return result;
}

/**
 * Check if `candidateChild` is a direct child of `parentKey`.
 * A direct child has exactly one more segment than its parent
 * and shares the same prefix.
 *
 * @example
 * isDirectChild("01-01", "01")       // → true
 * isDirectChild("01-01-01", "01")    // → false (grandchild)
 * isDirectChild("02-01", "01")       // → false (different root)
 */
export function isDirectChild(
  candidateChild: PathKey,
  parentKey: PathKey
): boolean {
  const childParsed = parse(candidateChild);
  const parentParsed = parse(parentKey);

  if (childParsed.length !== parentParsed.length + 1) {
    return false;
  }

  for (let i = 0; i < parentParsed.length; i++) {
    if (childParsed[i] !== parentParsed[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Check if `candidateDescendant` is a descendant of `ancestorKey`
 * (at any depth).
 *
 * @example
 * isDescendant("01-01-01", "01")    // → true
 * isDescendant("01-01", "01")       // → true
 * isDescendant("02-01", "01")       // → false
 * isDescendant("01", "01")          // → false (same key, not descendant)
 */
export function isDescendant(
  candidateDescendant: PathKey,
  ancestorKey: PathKey
): boolean {
  const descParsed = parse(candidateDescendant);
  const ancParsed = parse(ancestorKey);

  if (descParsed.length <= ancParsed.length) {
    return false;
  }

  for (let i = 0; i < ancParsed.length; i++) {
    if (descParsed[i] !== ancParsed[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two keys are siblings (same parent, same depth).
 *
 * @example
 * isSibling("01-01", "01-02") // → true
 * isSibling("01-01", "02-01") // → false (different parent)
 * isSibling("01", "02")       // → true (both root-level)
 */
export function isSibling(keyA: PathKey, keyB: PathKey): boolean {
  const parsedA = parse(keyA);
  const parsedB = parse(keyB);

  if (parsedA.length !== parsedB.length) {
    return false;
  }

  // Root-level keys are always siblings of each other
  if (parsedA.length === 1) {
    return parsedA[0] !== parsedB[0];
  }

  // Same parent prefix, different last segment
  for (let i = 0; i < parsedA.length - 1; i++) {
    if (parsedA[i] !== parsedB[i]) {
      return false;
    }
  }

  return parsedA[parsedA.length - 1] !== parsedB[parsedB.length - 1];
}

// ---------------------------------------------------------------------------
// Comparison & Sorting
// ---------------------------------------------------------------------------

/**
 * Compare two path keys for sorting.
 * Comparison is performed on integer arrays, not strings.
 *
 * @returns Negative if a < b, positive if a > b, 0 if equal.
 *
 * @example
 * compare("01-01", "01-02")     // → negative (01-01 comes first)
 * compare("02", "01-01")        // → positive (02 comes after 01-*)
 * compare("001-01", "1-001")    // → 0 (both resolve to [1, 1])
 */
export function compare(keyA: PathKey, keyB: PathKey): number {
  const parsedA = parse(keyA);
  const parsedB = parse(keyB);

  const minLen = Math.min(parsedA.length, parsedB.length);

  for (let i = 0; i < minLen; i++) {
    if (parsedA[i] !== parsedB[i]) {
      return parsedA[i] - parsedB[i];
    }
  }

  // If all shared segments are equal, shorter key comes first (parent before children)
  return parsedA.length - parsedB.length;
}

/**
 * Sort an array of path keys in hierarchical order.
 * Returns a new sorted array (does not mutate the input).
 *
 * @example
 * sort(["02-01", "01", "01-01", "01-01-01", "02"])
 * // → ["01", "01-01", "01-01-01", "02", "02-01"]
 */
export function sort(keys: PathKey[]): PathKey[] {
  return [...keys].sort(compare);
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

/**
 * Check if two path keys are equal (digit-width agnostic).
 *
 * @example
 * equals("01-01", "1-1")       // → true
 * equals("001-002", "01-02")   // → true
 * equals("01-01", "01-02")     // → false
 */
export function equals(keyA: PathKey, keyB: PathKey): boolean {
  return compare(keyA, keyB) === 0;
}

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

/**
 * Generate the next sibling key after the given key.
 * Increments the last segment by 1.
 *
 * @example
 * nextSibling("01-01")    // → "01-02"
 * nextSibling("01-09")    // → "01-10"
 * nextSibling("03")       // → "04"
 */
export function nextSibling(key: PathKey): PathKey {
  const parsed = parse(key);
  const next = [...parsed];
  next[next.length - 1] += 1;
  return serialize(next);
}

/**
 * Generate a first child key under the given parent.
 *
 * @example
 * firstChild("01")      // → "01-01"
 * firstChild("01-03")   // → "01-03-01"
 */
export function firstChild(parentKey: PathKey): PathKey {
  const parsed = parse(parentKey);
  return serialize([...parsed, 1]);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check if a string is a valid path key.
 *
 * @example
 * isValid("01-01-01")  // → true
 * isValid("abc")       // → false
 * isValid("")          // → false
 * isValid("01--01")    // → false
 */
export function isValid(key: string): boolean {
  try {
    parse(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a path key to a consistent format (2-digit padded).
 * This ensures "1-1" and "001-001" both become "01-01".
 *
 * @param key - Any valid path key.
 * @param padWidth - Minimum digit width (default: 2).
 *
 * @example
 * normalize("1-1")       // → "01-01"
 * normalize("001-002")   // → "01-02"
 * normalize("01-01")     // → "01-01" (no change)
 */
export function normalize(key: PathKey, padWidth: number = 2): PathKey {
  return serialize(parse(key), padWidth);
}
