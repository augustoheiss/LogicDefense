/**
 * Sekundo — Agnostic Participant & Operational Group Directory
 *
 * Provides phonetic/diacritic normalization and fuzzy matching to link
 * schedule assignees and territory holders to their operational groups
 * (e.g., "Grupo 1", "Grupo 2", "Grupo 3") and capability tags without
 * hardcoding domain-specific rules into the engine.
 *
 * Skills: agency-backend-architect, agency-universal-document-compiler
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import { stringSimilarity } from '../pdf/templateMatcher';

export interface ParticipantProfile {
  id: string;
  name: string;
  groupTag: string;           // e.g. "Grupo 1", "Grupo 2", "Grupo 3"
  capabilityTags: string[];   // Generic capability/qualification tags
  phone?: string;
  email?: string;
}

/**
 * Normalizes a person's name into a canonical ASCII comparison key.
 * Automatically resolves diacritic variations such as "Assunção" vs "Assuncao"
 * and "Mariño" vs "Marino".
 */
export function normalizePersonKey(rawName?: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  return rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts significant name tokens (ignoring 1-letter middle initials and prepositions)
 * for resilient matching when users search by first + last name.
 */
function extractSignificantTokens(normalizedKey: string): string[] {
  const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'd', 'e']);
  return normalizedKey
    .split(' ')
    .filter((t) => t.length > 1 && !stopWords.has(t));
}

/**
 * Finds a participant profile by full name, abbreviated name, or fuzzy similarity.
 */
export function findParticipantProfile(
  queryName: string | undefined,
  directory: ParticipantProfile[]
): ParticipantProfile | undefined {
  const normQuery = normalizePersonKey(queryName);
  if (!normQuery || directory.length === 0) return undefined;

  // 1. Exact normalized match
  const exact = directory.find((p) => normalizePersonKey(p.name) === normQuery);
  if (exact) return exact;

  // 2. Significant token subset match (e.g. "Alex Nogueira" -> "Alex Nogueira")
  const queryTokens = extractSignificantTokens(normQuery);
  if (queryTokens.length >= 2) {
    const tokenMatch = directory.find((p) => {
      const candidateTokens = extractSignificantTokens(normalizePersonKey(p.name));
      return queryTokens.every((qt) =>
        candidateTokens.some((ct) => ct === qt || ct.startsWith(qt))
      );
    });
    if (tokenMatch) return tokenMatch;
  }

  // 3. Fuzzy Levenshtein similarity fallback (>= 0.82)
  let bestCandidate: ParticipantProfile | undefined;
  let bestScore = 0;
  for (const p of directory) {
    const score = stringSimilarity(normQuery, normalizePersonKey(p.name));
    if (score >= 0.82 && score > bestScore) {
      bestScore = score;
      bestCandidate = p;
    }
  }

  return bestCandidate;
}

/**
 * Enriches a FlatSkeletonEntry array with operational group tags and capability tags
 * resolved from the provided ParticipantProfile directory.
 */
export function enrichRegistryWithDirectory(
  flatRegistry: FlatSkeletonEntry[],
  directory: ParticipantProfile[]
): FlatSkeletonEntry[] {
  if (!directory || directory.length === 0) return flatRegistry;

  return flatRegistry.map((entry) => {
    const meta = { ...(entry.meta || {}) } as Record<string, any>;
    const primaryName = (meta.assignedTo as string) || entry.value || '';
    const assistantName = (meta.assistantTo as string) || '';

    const primaryProfile = findParticipantProfile(primaryName, directory);
    const assistantProfile = findParticipantProfile(assistantName, directory);

    if (primaryProfile) {
      meta.groupTag = primaryProfile.groupTag;
      meta.capabilityTags = primaryProfile.capabilityTags;
    }

    if (assistantProfile) {
      meta.assistantGroupTag = assistantProfile.groupTag;
    }

    return {
      ...entry,
      meta,
    };
  });
}

/**
 * Lists all unique operational group tags present in a participant directory.
 */
export function listOperationalGroups(directory: ParticipantProfile[]): string[] {
  const set = new Set<string>();
  for (const p of directory) {
    if (p.groupTag) set.add(p.groupTag);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
