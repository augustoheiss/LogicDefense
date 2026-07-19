/**
 * Sekundo — CSV Serializer
 *
 * Formats CSV rows back to a string compliant with RFC 4180.
 * Handles cell escaping for commas, newlines, and double quotes.
 */

import type { CSVRow } from './types';

/**
 * Serialize an array of CSVRow objects back into a raw CSV string.
 * Escapes characters correctly (quotes, commas, newlines).
 *
 * @param rows - The CSV rows to serialize.
 * @returns Raw formatted CSV string.
 */
export function serializeCSV(rows: CSVRow[]): string {
  if (rows.length === 0) {
    return '_key,_type,label,value,email,_meta_json\n';
  }

  // Detect all headers dynamically, ensuring standard ones are first
  const standardHeaders = ['_key', '_type', 'label', 'value', 'email', '_meta_json'];
  const allHeadersSet = new Set<string>(standardHeaders);

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (
        key !== '_key' &&
        key !== '_type' &&
        key !== 'label' &&
        key !== 'value' &&
        key !== 'email' &&
        key !== '_meta_json'
      ) {
        allHeadersSet.add(key);
      }
    }
  }

  const headers = Array.from(allHeadersSet);

  const escapeCell = (value: string | undefined): string => {
    if (value === undefined || value === null) {
      return '';
    }
    const str = String(value);
    // If cell contains comma, double quote, carriage return, or newline, it must be escaped
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines: string[] = [];
  
  // Add headers line
  csvLines.push(headers.join(','));

  // Add data lines
  for (const row of rows) {
    const line = headers.map(header => escapeCell(row[header]));
    csvLines.push(line.join(','));
  }

  return csvLines.join('\n') + '\n';
}
