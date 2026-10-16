/**
 * Sekundo Document Engine — Free-Form Record Schema (`*.form.yaml`)
 *
 * Decouples arbitrary PDF form filling (CPF, RG, Telefone, Endereço, etc.)
 * from the hierarchical `PathKey` (`XX-YY`) registry (resolves C9, U5).
 */

import { parseDocument, stringify } from 'yaml';
import type { SdocDocument } from './types';

export type FormFieldValue = string | boolean | number;

export interface FormRecordEntry {
  id: string;
  values: Record<string, FormFieldValue>;
  updatedAt?: string;
}

export interface FormRecordDocument {
  form: 1;
  template?: string;
  records: FormRecordEntry[];
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeValuesMap(raw: unknown): Record<string, FormFieldValue> {
  const out: Record<string, FormFieldValue> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v;
    } else if (v !== null && v !== undefined) {
      out[k] = String(v);
    }
  }
  return out;
}

/**
 * Parses a `*.form.yaml` string into a normalized `FormRecordDocument`.
 * Supports:
 * 1. Canonical multi-record `{ form: 1, template: '...', records: [{ id, values }] }`
 * 2. Single-record shorthand `{ form: 1, values: { CPF: '...' } }`
 * 3. Flat key-value map `{ CPF: '...', Telefone: '...' }`
 */
export function parseFormRecordYaml(yamlText: string): FormRecordDocument {
  if (!yamlText || !yamlText.trim()) {
    return { form: 1, records: [{ id: 'rec_1', values: {} }] };
  }

  const parsed = parseDocument(yamlText);
  const js = parsed.toJS({ maxAliasCount: 25 }) as Record<string, unknown> | null;
  if (!js || typeof js !== 'object' || Array.isArray(js)) {
    return { form: 1, records: [{ id: 'rec_1', values: {} }] };
  }

  const template = typeof js.template === 'string' ? js.template : undefined;

  if (Array.isArray(js.records)) {
    const records: FormRecordEntry[] = js.records.map((item, idx) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `rec_${idx + 1}`;
        const rawVals = obj.values && typeof obj.values === 'object' ? obj.values : obj;
        const values = sanitizeValuesMap(rawVals);
        if (obj.values === undefined) {
          delete values.id;
        }
        return { id, values };
      }
      return { id: `rec_${idx + 1}`, values: {} };
    });
    return {
      form: 1,
      ...(template ? { template } : {}),
      records: records.length > 0 ? records : [{ id: 'rec_1', values: {} }],
    };
  }

  if (js.values && typeof js.values === 'object' && !Array.isArray(js.values)) {
    return {
      form: 1,
      ...(template ? { template } : {}),
      records: [{ id: 'rec_1', values: sanitizeValuesMap(js.values) }],
    };
  }

  // Flat dictionary fallback
  const flatValues = sanitizeValuesMap(js);
  delete flatValues.form;
  delete flatValues.template;
  return {
    form: 1,
    ...(template ? { template } : {}),
    records: [{ id: 'rec_1', values: flatValues }],
  };
}

/**
 * Serializes a `FormRecordDocument` into clean, deterministic YAML.
 */
export function stringifyFormRecordYaml(doc: FormRecordDocument): string {
  return stringify(doc, { lineWidth: 100 });
}

/**
 * Converts a `FormRecordDocument` or a plain `Record<string, FormFieldValue>` into
 * template evaluation contexts where both `{{input.<fieldName>}}` and `{{<fieldName>}}` resolve.
 */
export function formRecordToContexts(
  source: FormRecordDocument | Record<string, FormFieldValue>
): Record<string, unknown>[] {
  if ('form' in source && Array.isArray((source as FormRecordDocument).records)) {
    const doc = source as FormRecordDocument;
    return doc.records.map((rec, idx) => ({
      id: rec.id || `rec_${idx + 1}`,
      index: idx + 1,
      ...rec.values,
      input: { ...rec.values },
    }));
  }

  const values = sanitizeValuesMap(source);
  return [
    {
      id: 'rec_1',
      index: 1,
      ...values,
      input: { ...values },
    },
  ];
}

/**
 * Generates an initial `FormRecordDocument` from an `SdocDocument`'s `fields[]`,
 * pre-populating any `defaultValue` extracted from the PDF (C6).
 */
export function extractInitialFormRecord(sdoc: SdocDocument): FormRecordDocument {
  const values: Record<string, FormFieldValue> = {};
  for (const field of sdoc.fields || []) {
    const key = field.name || field.id;
    if (!key) continue;
    if (field.defaultValue !== undefined) {
      values[key] =
        field.fieldType === 'checkbox'
          ? field.defaultValue === 'true'
          : field.defaultValue;
    } else {
      values[key] = field.fieldType === 'checkbox' ? false : '';
    }
  }
  return {
    form: 1,
    ...(sdoc.underlay?.source ? { template: sdoc.underlay.source } : {}),
    records: [{ id: 'rec_1', values }],
  };
}
