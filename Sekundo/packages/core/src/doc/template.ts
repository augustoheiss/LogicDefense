/**
 * Sekundo Document Engine — Safe Logicless Mustache Template Interpreter (`template.ts`)
 *
 * Implements Red Teaming V3 security guarantees:
 * - Zero `eval`, zero `new Function`, zero prototype access.
 * - Blocks `__proto__`, `constructor`, `prototype`, and function invocations.
 * - Supports dotted paths (`{{meta.assistantTo}}`), array indexing (`{{cycles.0.assignedTo}}`),
 *   and whitelisted pipe filters:
 *   - `default:'fallback'`
 *   - `upper`
 *   - `lower`
 *   - `date:'dd/MM/yyyy'`
 *   - `truncate:25`
 */

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__']);

/**
 * Safely resolves a dotted property path against a plain object context.
 * Returns `undefined` if any segment touches a forbidden prototype property or a function.
 */
export function resolveSafePath(context: Record<string, unknown>, rawPath: string): unknown {
  const path = rawPath.trim();
  if (!path) return undefined;

  // Reject any expression containing parentheses or code characters
  if (/[();=`]/.test(path)) {
    return undefined;
  }

  const segments = path.split('.').map((s) => s.trim()).filter(Boolean);
  let current: unknown = context;

  for (const seg of segments) {
    if (FORBIDDEN_SEGMENTS.has(seg)) {
      return undefined;
    }
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
        return undefined;
      }
      current = current[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, seg)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[seg];
    }
    if (typeof current === 'function') {
      return undefined;
    }
  }

  return current;
}

function formatDateFilter(val: unknown, pattern: string): string {
  const str = String(val ?? '').trim();
  if (!str) return '';

  // Already in dd/MM/yyyy or dd/MM/yy
  if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(str)) {
    return str;
  }

  // ISO yyyy-MM-dd
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    if (pattern === 'dd/MM/yy') return `${dd}/${mm}/${yyyy.slice(2)}`;
    if (pattern === 'yyyy-MM-dd') return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  }

  return str;
}

function applyWhitelistedFilter(value: unknown, filterExpr: string): unknown {
  const trimmed = filterExpr.trim();
  if (!trimmed) return value;

  const colonIdx = trimmed.indexOf(':');
  const filterName = (colonIdx >= 0 ? trimmed.slice(0, colonIdx) : trimmed).trim().toLowerCase();
  let rawArg = colonIdx >= 0 ? trimmed.slice(colonIdx + 1).trim() : '';
  if (
    (rawArg.startsWith("'") && rawArg.endsWith("'")) ||
    (rawArg.startsWith('"') && rawArg.endsWith('"'))
  ) {
    rawArg = rawArg.slice(1, -1);
  }

  const strVal = value === undefined || value === null ? '' : String(value);

  switch (filterName) {
    case 'default':
      return strVal.trim() !== '' ? strVal : rawArg;
    case 'upper':
      return strVal.toUpperCase();
    case 'lower':
      return strVal.toLowerCase();
    case 'date':
      return formatDateFilter(strVal, rawArg || 'dd/MM/yyyy');
    case 'truncate': {
      const maxLen = Math.max(1, parseInt(rawArg, 10) || 30);
      return strVal.length > maxLen ? strVal.slice(0, maxLen) : strVal;
    }
    default:
      // Unknown filter is ignored safely
      return strVal;
  }
}

/**
 * Evaluates a single `{{ expression | filter1 | filter2 }}` token against `context`.
 * If the expression contains forbidden code injection patterns, returns the literal `{{...}}` string safely.
 */
function evaluateMustacheToken(rawTokenContent: string, context: Record<string, unknown>): string {
  const parts = rawTokenContent.split('|').map((p) => p.trim());
  const pathExpr = parts[0] || '';

  // Security check: if someone writes `constructor.constructor('...')()` render literally as inert text
  if (
    pathExpr.includes('(') ||
    pathExpr.includes(')') ||
    pathExpr
      .split('.')
      .some((s) => FORBIDDEN_SEGMENTS.has(s.trim()))
  ) {
    return `{{${rawTokenContent}}}`;
  }

  let value = resolveSafePath(context, pathExpr);
  for (let i = 1; i < parts.length; i++) {
    value = applyWhitelistedFilter(value, parts[i]);
  }

  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Renders a template string containing `{{...}}` placeholders using a safe logicless evaluator.
 */
export function renderTemplateString(
  template: string,
  context: Record<string, unknown>
): string {
  if (!template || typeof template !== 'string') return '';
  if (!template.includes('{{')) return template;

  return template.replace(/\{\{([^{}]+)\}\}/g, (_match, inner: string) => {
    return evaluateMustacheToken(inner, context);
  });
}
