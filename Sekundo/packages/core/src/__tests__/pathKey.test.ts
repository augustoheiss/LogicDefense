/**
 * Sekundo — Path Key Engine Tests
 *
 * Tests cover:
 *   - Parsing (including digit-width agnosticism)
 *   - Serialization
 *   - Depth & navigation (parent, ancestors, children, siblings, descendants)
 *   - Comparison & sorting (integer-based, not string-based)
 *   - Key generation (nextSibling, firstChild)
 *   - Validation
 *   - Normalization
 */

import { describe, it, expect } from 'vitest';
import * as pathKey from '../skeleton/pathKey';

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
describe('parse', () => {
  it('parses a simple two-segment key', () => {
    expect(pathKey.parse('01-01')).toEqual([1, 1]);
  });

  it('parses a three-segment key', () => {
    expect(pathKey.parse('01-02-03')).toEqual([1, 2, 3]);
  });

  it('parses a single-segment key', () => {
    expect(pathKey.parse('05')).toEqual([5]);
  });

  it('is digit-width agnostic: "01" equals "1"', () => {
    expect(pathKey.parse('01')).toEqual([1]);
    expect(pathKey.parse('1')).toEqual([1]);
  });

  it('is digit-width agnostic: "001-002-001" equals [1, 2, 1]', () => {
    expect(pathKey.parse('001-002-001')).toEqual([1, 2, 1]);
  });

  it('handles large segment numbers', () => {
    expect(pathKey.parse('99-100-999')).toEqual([99, 100, 999]);
  });

  it('throws on empty string', () => {
    expect(() => pathKey.parse('')).toThrow();
  });

  it('throws on non-numeric segments', () => {
    expect(() => pathKey.parse('01-abc-02')).toThrow();
  });

  it('throws on empty segments (double hyphen)', () => {
    expect(() => pathKey.parse('01--02')).toThrow();
  });

  it('throws on trailing hyphen', () => {
    expect(() => pathKey.parse('01-02-')).toThrow();
  });

  it('trims whitespace', () => {
    expect(pathKey.parse('  01-02  ')).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
describe('serialize', () => {
  it('serializes with default 2-digit padding', () => {
    expect(pathKey.serialize([1, 1, 1])).toBe('01-01-01');
  });

  it('serializes with 3-digit padding', () => {
    expect(pathKey.serialize([1, 2, 1], 3)).toBe('001-002-001');
  });

  it('serializes single-segment', () => {
    expect(pathKey.serialize([5])).toBe('05');
  });

  it('handles numbers larger than pad width', () => {
    expect(pathKey.serialize([100, 1])).toBe('100-01');
  });

  it('throws on empty array', () => {
    expect(() => pathKey.serialize([])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------
describe('depth', () => {
  it('returns 1 for root-level keys', () => {
    expect(pathKey.depth('01')).toBe(1);
  });

  it('returns 3 for three-segment keys', () => {
    expect(pathKey.depth('01-02-03')).toBe(3);
  });

  it('returns 4 for four-segment keys', () => {
    expect(pathKey.depth('01-01-01-01')).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------
describe('parent', () => {
  it('returns null for root-level keys', () => {
    expect(pathKey.parent('01')).toBeNull();
  });

  it('returns parent for two-segment key', () => {
    expect(pathKey.parent('01-02')).toBe('01');
  });

  it('returns parent for three-segment key', () => {
    expect(pathKey.parent('01-02-03')).toBe('01-02');
  });

  it('returns parent for four-segment key', () => {
    expect(pathKey.parent('01-01-01-01')).toBe('01-01-01');
  });
});

// ---------------------------------------------------------------------------
// Ancestors
// ---------------------------------------------------------------------------
describe('ancestors', () => {
  it('returns empty array for root-level keys', () => {
    expect(pathKey.ancestors('01')).toEqual([]);
  });

  it('returns all ancestors for deep key', () => {
    expect(pathKey.ancestors('01-02-03-04')).toEqual([
      '01',
      '01-02',
      '01-02-03',
    ]);
  });
});

// ---------------------------------------------------------------------------
// isDirectChild
// ---------------------------------------------------------------------------
describe('isDirectChild', () => {
  it('returns true for direct child', () => {
    expect(pathKey.isDirectChild('01-01', '01')).toBe(true);
  });

  it('returns false for grandchild', () => {
    expect(pathKey.isDirectChild('01-01-01', '01')).toBe(false);
  });

  it('returns false for different root', () => {
    expect(pathKey.isDirectChild('02-01', '01')).toBe(false);
  });

  it('returns true for deeper direct child', () => {
    expect(pathKey.isDirectChild('01-02-03', '01-02')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isDescendant
// ---------------------------------------------------------------------------
describe('isDescendant', () => {
  it('returns true for child', () => {
    expect(pathKey.isDescendant('01-01', '01')).toBe(true);
  });

  it('returns true for grandchild', () => {
    expect(pathKey.isDescendant('01-01-01', '01')).toBe(true);
  });

  it('returns false for same key', () => {
    expect(pathKey.isDescendant('01', '01')).toBe(false);
  });

  it('returns false for different root', () => {
    expect(pathKey.isDescendant('02-01', '01')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSibling
// ---------------------------------------------------------------------------
describe('isSibling', () => {
  it('returns true for root-level siblings', () => {
    expect(pathKey.isSibling('01', '02')).toBe(true);
  });

  it('returns true for siblings with same parent', () => {
    expect(pathKey.isSibling('01-01', '01-02')).toBe(true);
  });

  it('returns false for different parents', () => {
    expect(pathKey.isSibling('01-01', '02-01')).toBe(false);
  });

  it('returns false for different depths', () => {
    expect(pathKey.isSibling('01', '01-01')).toBe(false);
  });

  it('returns false for same key', () => {
    expect(pathKey.isSibling('01-01', '01-01')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Comparison & Sorting (digit-width agnostic)
// ---------------------------------------------------------------------------
describe('compare', () => {
  it('returns 0 for equal keys', () => {
    expect(pathKey.compare('01-01', '01-01')).toBe(0);
  });

  it('returns 0 for digit-width variants ("001-01" vs "1-1")', () => {
    expect(pathKey.compare('001-01', '1-1')).toBe(0);
  });

  it('returns negative for earlier key', () => {
    expect(pathKey.compare('01-01', '01-02')).toBeLessThan(0);
  });

  it('returns positive for later key', () => {
    expect(pathKey.compare('02', '01-01')).toBeGreaterThan(0);
  });

  it('parent comes before child', () => {
    expect(pathKey.compare('01', '01-01')).toBeLessThan(0);
  });
});

describe('sort', () => {
  it('sorts keys in hierarchical order', () => {
    const unsorted = ['02-01', '01', '01-01', '01-01-01', '02'];
    expect(pathKey.sort(unsorted)).toEqual([
      '01',
      '01-01',
      '01-01-01',
      '02',
      '02-01',
    ]);
  });

  it('handles mixed digit widths', () => {
    const unsorted = ['001-002', '1-1', '01-01-01'];
    const sorted = pathKey.sort(unsorted);
    // [1,1], [1,1,1], [1,2] → "1-1" < "01-01-01" < "001-002"
    expect(sorted).toEqual(['1-1', '01-01-01', '001-002']);
  });

  it('does not mutate original array', () => {
    const original = ['02', '01'];
    const sorted = pathKey.sort(original);
    expect(original).toEqual(['02', '01']); // unchanged
    expect(sorted).toEqual(['01', '02']);
  });
});

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------
describe('equals', () => {
  it('returns true for identical keys', () => {
    expect(pathKey.equals('01-01', '01-01')).toBe(true);
  });

  it('returns true for digit-width variants', () => {
    expect(pathKey.equals('01-01', '1-1')).toBe(true);
    expect(pathKey.equals('001-002', '01-02')).toBe(true);
  });

  it('returns false for different keys', () => {
    expect(pathKey.equals('01-01', '01-02')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------
describe('nextSibling', () => {
  it('increments last segment', () => {
    expect(pathKey.nextSibling('01-01')).toBe('01-02');
  });

  it('handles rollover from 09 to 10', () => {
    expect(pathKey.nextSibling('01-09')).toBe('01-10');
  });

  it('works for root-level keys', () => {
    expect(pathKey.nextSibling('03')).toBe('04');
  });
});

describe('firstChild', () => {
  it('appends -01 to parent', () => {
    expect(pathKey.firstChild('01')).toBe('01-01');
  });

  it('works for deeper parents', () => {
    expect(pathKey.firstChild('01-03')).toBe('01-03-01');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
describe('isValid', () => {
  it('returns true for valid keys', () => {
    expect(pathKey.isValid('01-01-01')).toBe(true);
    expect(pathKey.isValid('1')).toBe(true);
    expect(pathKey.isValid('001-002-003')).toBe(true);
  });

  it('returns false for invalid keys', () => {
    expect(pathKey.isValid('')).toBe(false);
    expect(pathKey.isValid('abc')).toBe(false);
    expect(pathKey.isValid('01--01')).toBe(false);
    expect(pathKey.isValid('01-')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------
describe('normalize', () => {
  it('normalizes to 2-digit pad by default', () => {
    expect(pathKey.normalize('1-1')).toBe('01-01');
    expect(pathKey.normalize('001-002')).toBe('01-02');
  });

  it('normalizes to custom pad width', () => {
    expect(pathKey.normalize('1-2-1', 3)).toBe('001-002-001');
  });

  it('no-ops on already normalized keys', () => {
    expect(pathKey.normalize('01-01')).toBe('01-01');
  });
});
