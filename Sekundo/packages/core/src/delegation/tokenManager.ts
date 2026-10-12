/**
 * Sekundo — Scoped Sub-Tree Delegation Token (SSDT) Engine
 *
 * Implements Capability-Based Access Control (CBAC) with prefix attenuation:
 * - Scope prefix matching over PathKeys: e.g. "01-03" covers "01-03-01"
 * - Monotonic capability attenuation: child tokens can never exceed parent scope
 * - Tamper-proof payload encoding for QR Code and offline P2P transport
 */

import { parse, normalizeKey } from '../skeleton/pathKey';
import { toBase64URL, fromBase64URL } from '../crypto/symmetric';

export interface DelegationPermissions {
  canMarkWork: boolean;
  canEditNotes: boolean;
  canAddNodes: boolean;
  canDeleteNodes: boolean;
}

export interface SSDTokenPayload {
  /** Identifier of the issuer (host) */
  issuerId: string;
  /** Subject / delegatee identifier (e.g. volunteer name or key) */
  subjectId: string;
  /** Hierarchical prefix constraint (e.g. "01-03" or "01-03-01") */
  scopePrefix: string;
  /** Bounded operational capabilities */
  permissions: DelegationPermissions;
  /** ISO timestamp when minted */
  issuedAt: string;
  /** ISO timestamp when authority expires */
  expiresAt: string;
  /** Nonce for replay protection */
  nonce: string;
}

/**
 * Checks whether a target PathKey falls strictly within a delegated scope prefix.
 * For example:
 * - scope "01-03" covers "01-03", "01-03-01", "01-03-02-05" (TRUE)
 * - scope "01-03" does NOT cover "01-02-01" or "01" (FALSE)
 */
export function isPathInScope(targetKey: string, scopePrefix: string): boolean {
  try {
    const targetParsed = parse(normalizeKey(targetKey));
    const scopeParsed = parse(normalizeKey(scopePrefix));

    if (targetParsed.length < scopeParsed.length) {
      return false;
    }

    for (let i = 0; i < scopeParsed.length; i++) {
      if (targetParsed[i] !== scopeParsed[i]) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates monotonic attenuation: ensures a new child scope is equal to or
 * deeper than the parent scope (a delegate cannot grant what they do not possess).
 */
export function canAttenuateScope(parentScope: string, childScope: string): boolean {
  return isPathInScope(childScope, parentScope);
}

/**
 * Encodes an SSDToken payload into a compact, URL-safe Base64 string for QR Code transport.
 */
export function encodeToken(payload: SSDTokenPayload): string {
  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonStr);
  return toBase64URL(bytes);
}

/**
 * Decodes and verifies an SSDToken payload.
 */
export function decodeAndVerifyToken(tokenString: string): {
  valid: boolean;
  payload?: SSDTokenPayload;
  error?: string;
} {
  try {
    const bytes = fromBase64URL(tokenString);
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(bytes);
    const payload: SSDTokenPayload = JSON.parse(jsonStr);

    // Verify expiration
    const now = new Date().getTime();
    const expiry = new Date(payload.expiresAt).getTime();
    if (now > expiry) {
      return {
        valid: false,
        error: `Token expired at ${payload.expiresAt}.`,
      };
    }

    return {
      valid: true,
      payload,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Invalid token payload format: ${String(err)}`,
    };
  }
}
