/**
 * Sekundo Document Engine — Pre-flight Validator (`preflight.ts`)
 *
 * Audits an `SdocDocument`, its `DisplayList`, and input values before export/print:
 * - Detects XFA forms (`isXfa`, H4)
 * - Detects digital signatures (`hasSignature`, U8) and blocks silent flatten
 * - Detects encrypted PDFs (`isEncrypted`, U2/U7)
 * - Detects missing underlay blobs (C5)
 * - Detects empty fields, `maxLength` truncations (H2), `maxLines` truncations (H7),
 *   and non-WinAnsi / emoji glyphs (H3).
 */

import type { DisplayList, SdocDocument } from './types';
import { sanitizeForWinAnsiWithWarnings } from '../pdf/unicodeFont';

export type PreflightSeverity = 'info' | 'warning' | 'error';

export type PreflightIssueCode =
  | 'XFA_UNSUPPORTED'
  | 'DIGITAL_SIGNATURE_DETECTED'
  | 'ENCRYPTED_PDF'
  | 'MISSING_UNDERLAY_BLOB'
  | 'EMPTY_FIELD'
  | 'MAX_LENGTH_EXCEEDED'
  | 'TEXT_LINE_TRUNCATED'
  | 'UNICODE_SANITIZED';

export interface PreflightIssue {
  code: PreflightIssueCode;
  severity: PreflightSeverity;
  fieldName?: string;
  message: string;
}

export interface PreflightReport {
  ok: boolean;
  /** True when `/Sig` is present, preventing silent flatten without explicit confirmation (U8) */
  blocksSilentFlatten: boolean;
  issues: PreflightIssue[];
}

export function runDocumentPreflight(params: {
  doc: SdocDocument;
  displayList?: DisplayList;
  values?: Record<string, unknown>;
  blobs?: Record<string, Uint8Array>;
}): PreflightReport {
  const { doc, displayList, values = {}, blobs } = params;
  const issues: PreflightIssue[] = [];
  let blocksSilentFlatten = false;

  // 1. Underlay security & format checks
  if (doc.underlay) {
    if (doc.underlay.isXfa) {
      issues.push({
        code: 'XFA_UNSUPPORTED',
        severity: 'error',
        message:
          'Este PDF utiliza XFA dinâmico (Adobe LiveCycle), que não é suportado por leitores PDF padrão. Exporte uma cópia AcroForm estática antes de preencher.',
      });
    }
    if (doc.underlay.hasSignature) {
      blocksSilentFlatten = true;
      issues.push({
        code: 'DIGITAL_SIGNATURE_DETECTED',
        severity: 'warning',
        message:
          'Assinatura digital criptográfica (/Sig ICP-Brasil / Gov.br) detectada. Achatar (flatten) ou alterar campos assinados invalidará a assinatura original.',
      });
    }
    if (doc.underlay.isEncrypted) {
      issues.push({
        code: 'ENCRYPTED_PDF',
        severity: 'warning',
        message:
          'O PDF original contém restrições de criptografia (/Encrypt). Verifique se o destinatário exige preservação das permissões.',
      });
    }
    if (
      doc.underlay.source &&
      doc.underlay.mode !== 'rebuild' &&
      blobs &&
      !blobs[doc.underlay.source]
    ) {
      issues.push({
        code: 'MISSING_UNDERLAY_BLOB',
        severity: 'error',
        message: `Binário de fundo (${doc.underlay.source}) não encontrado no armazenamento local.`,
      });
    }
  }

  // 2. Field-level checks (empty, maxLength, Unicode/Emoji)
  const inputMap =
    values.input && typeof values.input === 'object'
      ? { ...values, ...(values.input as Record<string, unknown>) }
      : values;

  for (const field of doc.fields || []) {
    const key = field.name || field.id;
    const rawVal = inputMap[key] ?? field.defaultValue;
    const strVal = rawVal === undefined || rawVal === null ? '' : String(rawVal);

    if (field.fieldType !== 'checkbox' && strVal.trim() === '') {
      issues.push({
        code: 'EMPTY_FIELD',
        severity: 'info',
        fieldName: key,
        message: `Campo "${key}" está em branco.`,
      });
      continue;
    }

    if (field.maxLength && field.maxLength > 0 && strVal.length > field.maxLength) {
      issues.push({
        code: 'MAX_LENGTH_EXCEEDED',
        severity: 'warning',
        fieldName: key,
        message: `Campo "${key}" excede o limite de ${field.maxLength} caracteres (${strVal.length} informados).`,
      });
    }

    const san = sanitizeForWinAnsiWithWarnings(strVal, key);
    if (san.hadEmoji || san.hadNonWinAnsi) {
      for (const w of san.warnings) {
        issues.push({
          code: 'UNICODE_SANITIZED',
          severity: 'warning',
          fieldName: key,
          message: w,
        });
      }
    }
  }

  // 3. DisplayList layout warnings (e.g. H7 maxLines truncation)
  if (displayList?.warnings) {
    for (const w of displayList.warnings) {
      issues.push({
        code: 'TEXT_LINE_TRUNCATED',
        severity: 'warning',
        message: w,
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    ok: !hasErrors,
    blocksSilentFlatten,
    issues,
  };
}
