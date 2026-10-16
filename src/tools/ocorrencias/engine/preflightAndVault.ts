/**
 * Ocorrências 2.0 PDF Engine — Preflight Quality Gate & SHA-256 Template Vault
 * (`engine/preflightAndVault.ts`)
 *
 * Isolated and unified from:
 * - `@sekundo/core/pdf/preflightEngine.ts` (H12 Pre-Export Quality & Security Gate)
 * - `@sekundo/core/pdf/templateMatcher.ts` (SHA-256 Template Recognition)
 * - `cv-maker/services/CVStorageService.ts` (LocalStorage Persistence & Schema Migration)
 */

import type {
  DisplayList,
  LegacyPyMuPDFCoords,
  LegacyTemplateMap,
  Mm,
  OcorrenciaDocSpec,
  OcorrenciaFieldSpec,
  OcorrenciaFieldType,
  PreflightIssue,
  PreflightReport,
} from './types';
import { mmToPt, ptToMm, roundMm } from './units';
import { DEFAULT_OCORRENCIA_FIELD_SPECS } from './pdfAutoDiscovery';

const VAULT_STORAGE_KEY = 'ocorrencias_template_vault_v2';

/**
 * Executes a deterministic preflight inspection over the `OcorrenciaDocSpec`,
 * current field `values`, and solved `DisplayList`.
 */
export function runOcorrenciaPreflight(
  docSpec: OcorrenciaDocSpec,
  displayList: DisplayList,
  values: Record<string, string | boolean | undefined>
): PreflightReport {
  const issues: PreflightIssue[] = [];
  let blocksSilentFlatten = false;

  // 1. Security & Architecture inspections
  if (docSpec.security?.isXfa) {
    blocksSilentFlatten = true;
    issues.push({
      code: 'XFA_UNSUPPORTED',
      severity: 'error',
      message:
        'Este PDF utiliza formulários dinâmicos Adobe XFA (XML Forms Architecture). A camada de carimbo visual funcionará normalmente sobre as páginas visíveis.',
    });
  }

  if (docSpec.security?.hasSignature) {
    blocksSilentFlatten = true;
    issues.push({
      code: 'DIGITAL_SIGNATURE_DETECTED',
      severity: 'warning',
      message:
        'Assinatura Digital ICP-Brasil/Adobe (/Sig) detectada no PDF base. O carimbo gerará uma cópia preenchida com a assinatura original removida para evitar aviso de assinatura corrompida.',
    });
  }

  if (docSpec.security?.isScannedLikely) {
    issues.push({
      code: 'SCANNED_PDF_NOTICE',
      severity: 'info',
      message:
        'PDF escaneado detectado (sem texto nativo selecionável). O modo "Tarja Branca" foi ativado nos campos para garantir legibilidade sobre a imagem.',
    });
  }

  // 2. Field-level validation & layout telemetry
  for (const field of docSpec.fields) {
    const rawVal = values[field.id];
    const strVal = typeof rawVal === 'string' ? rawVal.trim() : '';

    if (field.required && field.type !== 'checkbox' && strVal.length === 0) {
      issues.push({
        code: 'EMPTY_REQUIRED_FIELD',
        severity: 'warning',
        fieldId: field.id,
        fieldLabel: field.label,
        message: `Campo essencial "${field.label}" ainda está vazio.`,
      });
    }

    if (field.maxLength && field.maxLength > 0 && strVal.length > field.maxLength) {
      issues.push({
        code: 'MAX_LENGTH_EXCEEDED',
        severity: 'warning',
        fieldId: field.id,
        fieldLabel: field.label,
        message: `"${field.label}" possui ${strVal.length} caracteres (limite sugerido do campo: ${field.maxLength}).`,
      });
    }

    const metrics = displayList.fieldMetrics[field.id];
    if (metrics) {
      if (metrics.continuedOnAnnex) {
        issues.push({
          code: 'CONTINUATION_SHEET_GENERATED',
          severity: 'info',
          fieldId: field.id,
          fieldLabel: field.label,
          message: `Folha Complementar Anexa (Página 2) gerada automaticamente para "${field.label}": +${metrics.continuationLineCount || 0} linhas excedentes vinculadas via SHA-256 sem cortes.`,
        });
      } else if (metrics.overflowed) {
        issues.push({
          code: 'TEXT_BOX_OVERFLOW',
          severity: 'error',
          fieldId: field.id,
          fieldLabel: field.label,
          message: `O texto em "${field.label}" excedeu a altura da caixa mesmo reduzindo a fonte para ${metrics.fontSizePt}pt. Aumente a caixa no preview ou resuma o texto.`,
        });
      } else if (metrics.autoFitted) {
        issues.push({
          code: 'AUTOFIT_APPLIED',
          severity: 'info',
          fieldId: field.id,
          fieldLabel: field.label,
          message: `Auto-Fit ativo em "${field.label}": fonte ajustada automaticamente para ${metrics.fontSizePt}pt (${metrics.lineCount} linhas) para caber sem cortes.`,
        });
      }
    }
  }

  // 3. Unicode / WinAnsi sanitization notices
  for (const warning of displayList.warnings) {
    issues.push({
      code: 'UNICODE_SANITIZED',
      severity: 'info',
      message: warning,
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    ok: !hasErrors,
    blocksSilentFlatten,
    issues,
  };
}

/**
 * Converts a canonical `OcorrenciaDocSpec` (in physical `Mm`, 1-indexed pages)
 * to the legacy `template_map.json` format (`pymupdf_top_left` in `pt`, 0-indexed pages)
 * so existing `.json` map downloads and `/api/ocorrencias/gerar` remain 100% compatible.
 */
export function docSpecToLegacyMap(docSpec: OcorrenciaDocSpec): LegacyTemplateMap {
  const firstPage = docSpec.pages[0] || { widthMm: 210, heightMm: 297 };
  const fields: Record<string, LegacyPyMuPDFCoords> = {};

  for (const f of docSpec.fields) {
    const [xMm, yMm, wMm, hMm] = f.rect;
    fields[f.id] = {
      x: Math.round(mmToPt(xMm) * 100) / 100,
      y: Math.round(mmToPt(yMm) * 100) / 100,
      max_width: Math.round(mmToPt(wMm) * 100) / 100,
      height: Math.round(mmToPt(hMm) * 100) / 100,
      font_size: f.fontSizePt || 10,
      type: f.type,
      label: f.label,
      page: Math.max(0, (f.page || 1) - 1),
      background_mode: f.backgroundMode || 'transparent',
    };
  }

  return {
    _comment:
      'Mapa de coordenadas gerado pelo Gerador de Ocorrências 2.0 (Unified PDF Engine Mm -> PyMuPDF pt).',
    sha256: docSpec.sha256,
    page_width: Math.round(mmToPt(firstPage.widthMm) * 100) / 100,
    page_height: Math.round(mmToPt(firstPage.heightMm) * 100) / 100,
    coordinate_system: 'pymupdf_top_left',
    fields,
  };
}

/**
 * Converts either a v2 `OcorrenciaDocSpec` JSON or a legacy `LegacyTemplateMap` (`template_map.json`)
 * into a canonical `OcorrenciaDocSpec` in physical Millimeters (`Mm`).
 * Automatically merges any missing canonical fields (like checkboxes or compromissos) so old
 * 5-field maps are seamlessly upgraded to full 9-field support.
 */
export function legacyMapToDocSpec(
  rawJson: any,
  sha256Override?: string,
  fileNameOverride?: string
): OcorrenciaDocSpec {
  // Already v2 OcorrenciaDocSpec
  if (rawJson && rawJson.version === 2 && Array.isArray(rawJson.fields)) {
    return {
      ...rawJson,
      sha256: sha256Override || rawJson.sha256 || '',
      name: fileNameOverride || rawJson.name || 'template_ocorrencia.pdf',
    };
  }

  const widthMm = roundMm(ptToMm(Number(rawJson?.page_width || 595.28)));
  const heightMm = roundMm(ptToMm(Number(rawJson?.page_height || 841.89)));
  const rawFields: Record<string, LegacyPyMuPDFCoords> = rawJson?.fields || {};

  const byId = new Map<string, OcorrenciaFieldSpec>();

  for (const [id, coord] of Object.entries(rawFields)) {
    if (!coord || typeof coord !== 'object') continue;
    const xMm = roundMm(ptToMm(Number(coord.x || 0)));
    const yMm = roundMm(ptToMm(Number(coord.y || 0)));
    const wMm = roundMm(Math.max(4, ptToMm(Number(coord.max_width || 18))));
    const hMm = roundMm(
      Math.max(
        4,
        ptToMm(
          Number(
            coord.height ||
              (coord.max_lines ? coord.max_lines * (coord.font_size || 10) * 1.35 : 22)
          )
        )
      )
    );
    const type = normalizeFieldType(coord.type, id);

    byId.set(id, {
      id,
      label: coord.label || id,
      type,
      page: Number(coord.page ?? 0) + 1,
      rect: [xMm, yMm, wMm, hMm] as [Mm, Mm, Mm, Mm],
      fontSizePt: Number(coord.font_size || 10),
      minFontSizePt: 6.5,
      weight: type === 'checkbox' ? 'bold' : 'normal',
      align: type === 'checkbox' ? 'center' : 'left',
      backgroundMode: coord.background_mode || 'transparent',
      source: 'imported',
    });
  }

  // Ensure all 9 canonical fields are present
  const mergedFields: OcorrenciaFieldSpec[] = [];
  for (const defField of DEFAULT_OCORRENCIA_FIELD_SPECS) {
    const imported = byId.get(defField.id);
    if (imported) {
      mergedFields.push({ ...defField, ...imported });
      byId.delete(defField.id);
    } else {
      mergedFields.push({ ...defField, rect: [...defField.rect] as [Mm, Mm, Mm, Mm] });
    }
  }
  for (const custom of byId.values()) {
    mergedFields.push(custom);
  }

  const maxPage = mergedFields.reduce((acc, f) => Math.max(acc, f.page || 1), 1);
  const pages = Array.from({ length: maxPage }, () => ({ widthMm, heightMm }));

  return {
    version: 2,
    name: fileNameOverride || 'template_importado.pdf',
    sha256: sha256Override || rawJson?.sha256 || '',
    pageCount: maxPage,
    pages,
    fields: mergedFields,
  };
}

function normalizeFieldType(rawType?: string, id = ''): OcorrenciaFieldType {
  if (
    rawType === 'textarea' ||
    rawType === 'checkbox' ||
    rawType === 'date' ||
    rawType === 'signature' ||
    rawType === 'dropdown'
  ) {
    return rawType;
  }
  if (id.startsWith('checkbox_')) return 'checkbox';
  if (id.includes('assinatura') || id.includes('rubrica')) return 'signature';
  if (id.includes('descri') || id.includes('compromisso') || id.includes('relato')) return 'textarea';
  if (id === 'data') return 'date';
  return 'text';
}

/**
 * LocalStorage vault that remembers `OcorrenciaDocSpec` mappings by PDF SHA-256 hash.
 * When a school coordinator uploads their school's PDF template again tomorrow,
 * all mapped coordinates are restored in 0ms without re-drawing boxes.
 */
export class TemplateVaultService {
  static loadAll(): Record<string, OcorrenciaDocSpec> {
    try {
      const raw = localStorage.getItem(VAULT_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  static getBySha256(sha256: string): OcorrenciaDocSpec | null {
    if (!sha256) return null;
    const vault = this.loadAll();
    return vault[sha256] || null;
  }

  static save(docSpec: OcorrenciaDocSpec): void {
    if (!docSpec.sha256) return;
    try {
      const vault = this.loadAll();
      vault[docSpec.sha256] = {
        ...docSpec,
        fields: docSpec.fields.map((f) => ({
          ...f,
          source: f.source || 'vault',
        })),
      };
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
    } catch {
      // Ignore quota errors
    }
  }

  static remove(sha256: string): void {
    if (!sha256) return;
    try {
      const vault = this.loadAll();
      delete vault[sha256];
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
    } catch {
      // Ignore
    }
  }
}
