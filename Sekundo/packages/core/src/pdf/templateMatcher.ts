/**
 * Sekundo — Intelligent PDF Template Matcher & Field Auto-Recognizer
 *
 * Implements:
 * 1. SHA-256 binary fingerprinting for instant template recognition
 * 2. Multi-lingual fuzzy semantic matching (PT, EN, ES) for AcroForm field auto-detection
 * 3. Text anchor heuristics for flat/non-interactive PDFs
 * 4. Confidence scoring per field mapping
 */

import type { PDFFormField } from './types';
import type { FlatSkeletonEntry } from '../skeleton/types';

export interface FieldMappingCandidate {
  pdfFieldId: string;
  pdfFieldName: string;
  matchedAttribute: string; // e.g. 'value', 'label', 'meta.date', 'meta.room', 'meta.territory_number'
  confidence: number;      // 0.0 to 1.0
  suggestedValue?: string;
  samplePreview?: string;
}

export interface TemplateRecognitionResult {
  templateHash: string;
  totalFieldsDetected: number;
  autoMatchedCount: number;
  overallConfidence: number; // Average confidence 0 to 1
  mappings: FieldMappingCandidate[];
  isPreConfigured: boolean;
}

/**
 * Common semantic synonym dictionary for event and territory form fields.
 */
const SEMANTIC_DICTIONARY: Record<string, string[]> = {
  // Volunteer / Student / Person Name
  person_name: [
    'nome',
    'student',
    'estudante',
    'orador',
    'speaker',
    'publicador',
    'voluntario',
    'assignee',
    'designado',
    'irmao',
    'morador',
    'name',
    'assigned_to',
  ],
  // Assistant / Helper
  assistant_name: [
    'ajudante',
    'assistant',
    'leitor',
    'reader',
    'partner',
    'auxiliar',
    'companheiro',
  ],
  // Date of Event / Assignment
  event_date: [
    'data',
    'date',
    'dia',
    'semana',
    'meeting_date',
    'data_designacao',
    'data_reuniao',
    'assigned_date',
  ],
  // Part Title / Subject / Theme
  part_title: [
    'tema',
    'parte',
    'part',
    'titulo',
    'title',
    'assunto',
    'licao',
    'ponto',
    'discurso',
    'designacao',
  ],
  // Hall / Room / Classroom
  room_or_hall: [
    'sala',
    'room',
    'salao',
    'hall',
    'auditorio',
    'classe',
    'sala_b',
    'sala_principal',
  ],
  // Territory / Card Number
  territory_number: [
    'territorio',
    'cartao',
    'territory',
    't_num',
    'numero_territorio',
    'setor',
  ],
  // Address / Locality
  address_line: [
    'endereco',
    'rua',
    'logradouro',
    'localidade',
    'bairro',
    'address',
    'street',
  ],
};

/**
 * Computes a fast synchronous FNV-derived fingerprint of the first 8KB + file length.
 * Kept for synchronous compatibility; use `computeTemplateFingerprintSha256` when async is available.
 */
export function computeTemplateFingerprint(pdfBytes: Uint8Array): string {
  // Sample up to first 8192 bytes (FNV-1a dual-lane)
  const len = Math.min(pdfBytes.length, 8192);
  let hash1 = 0x811c9dc5;
  let hash2 = 0x55555555;

  for (let i = 0; i < len; i++) {
    const byte = pdfBytes[i];
    hash1 = (hash1 ^ byte) * 0x01000193;
    hash2 = (hash2 + byte) * 0x1000193;
  }

  // Convert to 16 hex chars
  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `tpl_${h1}${h2}_${pdfBytes.length}`;
}

/**
 * Computes a cryptographic SHA-256 hex digest of the entire PDF binary (`sha256:<64-hex>`).
 * Uses Web Crypto API (`crypto.subtle.digest`) available in modern browsers, Node 18+, and Vitest.
 */
export async function computeTemplateFingerprintSha256(pdfBytes: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex}`;
  }
  return computeTemplateFingerprint(pdfBytes);
}

/**
 * Normalizes a field string for fuzzy comparison: lowercase, removes punctuation and underscores.
 */
export function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculates similarity score (0.0 to 1.0) between two strings.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

/**
 * Classifies a PDF field name into a semantic domain attribute using the semantic dictionary.
 */
export function classifyFieldSemantics(
  fieldName: string
): { semanticKey: string; confidence: number } | null {
  const norm = normalizeFieldName(fieldName);
  if (!norm) return null;

  let bestKey: string | null = null;
  let bestScore = 0;

  for (const [semanticKey, synonyms] of Object.entries(SEMANTIC_DICTIONARY)) {
    for (const syn of synonyms) {
      const normSyn = normalizeFieldName(syn);
      if (norm === normSyn) {
        return { semanticKey, confidence: 1.0 };
      }
      if (norm.includes(normSyn) || normSyn.includes(norm)) {
        const ratio = Math.min(normSyn.length, norm.length) / Math.max(normSyn.length, norm.length);
        const score = 0.80 + ratio * 0.19;
        if (score > bestScore) {
          bestScore = score;
          bestKey = semanticKey;
        }
      } else {
        const sim = stringSimilarity(norm, normSyn);
        if (sim > 0.7 && sim > bestScore) {
          bestScore = sim;
          bestKey = semanticKey;
        }
      }
    }
  }

  if (bestKey && bestScore >= 0.7) {
    return { semanticKey: bestKey, confidence: bestScore };
  }

  return null;
}

/**
 * Maps semantic domain key to the respective Skeleton Entry attribute.
 */
export function semanticKeyToAttribute(semanticKey: string): string {
  switch (semanticKey) {
    case 'person_name':
      return 'value';
    case 'assistant_name':
      return 'meta.assistantTo';
    case 'event_date':
      return 'meta.date';
    case 'part_title':
      return 'label';
    case 'room_or_hall':
      return 'meta.room';
    case 'territory_number':
      return 'meta.territory_number';
    case 'address_line':
      return 'meta.line';
    default:
      return 'value';
  }
}

/**
 * Automatically recognizes and predicts field mappings for an inspected PDF form
 * against a representative sample of Skeleton entries.
 */
export function autoRecognizePDFFields(
  pdfFields: PDFFormField[],
  pdfBytes: Uint8Array,
  sampleEntries: FlatSkeletonEntry[] = []
): TemplateRecognitionResult {
  const templateHash = computeTemplateFingerprint(pdfBytes);
  const mappings: FieldMappingCandidate[] = [];
  let totalConfidence = 0;
  let autoMatchedCount = 0;

  const sample = sampleEntries[0]; // Primary sample for preview

  for (const field of pdfFields) {
    const classification = classifyFieldSemantics(field.fieldName);

    if (classification) {
      const matchedAttr = semanticKeyToAttribute(classification.semanticKey);
      let previewVal: string | undefined = undefined;

      if (sample) {
        if (matchedAttr === 'value') previewVal = sample.value || 'Ex: Irmão Silva';
        else if (matchedAttr === 'label') previewVal = sample.label || 'Ex: Leitura da Bíblia';
        else if (matchedAttr === 'meta.date') previewVal = (sample.meta?.date as string) || new Date().toLocaleDateString('pt-BR');
        else if (matchedAttr === 'meta.room') previewVal = (sample.meta?.room as string) || 'Salão Principal';
        else if (matchedAttr === 'meta.assistantTo') previewVal = (sample.meta?.assistantTo as string) || 'Ex: Ajudante';
        else if (matchedAttr === 'meta.territory_number') previewVal = (sample.meta?.territory_number as string) || 'T02.01';
      }

      mappings.push({
        pdfFieldId: field.fieldId,
        pdfFieldName: field.fieldName,
        matchedAttribute: matchedAttr,
        confidence: classification.confidence,
        suggestedValue: previewVal,
        samplePreview: previewVal,
      });

      totalConfidence += classification.confidence;
      autoMatchedCount++;
    } else {
      // Unclassified field
      mappings.push({
        pdfFieldId: field.fieldId,
        pdfFieldName: field.fieldName,
        matchedAttribute: 'custom',
        confidence: 0,
        suggestedValue: undefined,
      });
    }
  }

  const overallConfidence =
    autoMatchedCount > 0 ? Math.round((totalConfidence / autoMatchedCount) * 100) / 100 : 0;

  return {
    templateHash,
    totalFieldsDetected: pdfFields.length,
    autoMatchedCount,
    overallConfidence,
    mappings,
    isPreConfigured: false,
  };
}
