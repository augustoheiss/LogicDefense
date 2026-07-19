/**
 * Sekundo — CSV Parser
 *
 * Implements a robust RFC 4180-compliant CSV parser.
 * Handles double quotes, commas within fields, and newlines within fields.
 */

import type { CSVRow } from './types';

/**
 * Parse a CSV string into an array of CSVRow objects.
 * Uses header names to map values.
 *
 * @param csvText - The raw CSV string to parse.
 * @returns Array of parsed CSVRow structures.
 * @throws {Error} If required headers (like _key) are missing.
 */
export function parseCSV(csvText: string): CSVRow[] {
  const result: CSVRow[] = [];
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // skip next char
        } else {
          // End of quote block
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
          lines.push(currentRow);
        }
        currentRow = [];
        // Skip next character if it is a CRLF pair
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentField += char;
      }
    }
  }

  // Handle final field/row if not terminated by newline
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return [];
  }

  // First line is headers
  const headers = lines[0].map(h => h.trim());
  const keyIndex = headers.indexOf('_key');
  const typeIndex = headers.indexOf('_type');
  const labelIndex = headers.indexOf('label');
  const valueIndex = headers.indexOf('value');
  const emailIndex = headers.indexOf('email');
  const metaIndex = headers.indexOf('_meta_json');

  // Verify _key is present
  if (keyIndex === -1) {
    throw new Error('CSV is missing required header: "_key"');
  }

  for (let i = 1; i < lines.length; i++) {
    const rowData = lines[i];
    // Skip empty lines
    if (rowData.length === 0 || (rowData.length === 1 && rowData[0] === '')) {
      continue;
    }

    const row: Partial<CSVRow> = {};

    // Get basic fields
    row._key = rowData[keyIndex] !== undefined ? rowData[keyIndex].trim() : '';
    row._type = typeIndex !== -1 && rowData[typeIndex] !== undefined ? rowData[typeIndex].trim() : '';
    row.label = labelIndex !== -1 && rowData[labelIndex] !== undefined ? rowData[labelIndex].trim() : '';
    
    if (valueIndex !== -1 && rowData[valueIndex] !== undefined) {
      row.value = rowData[valueIndex];
    }
    if (emailIndex !== -1 && rowData[emailIndex] !== undefined) {
      row.email = rowData[emailIndex].trim();
    }
    if (metaIndex !== -1 && rowData[metaIndex] !== undefined) {
      row._meta_json = rowData[metaIndex];
    }

    // Map any extra columns
    headers.forEach((header, idx) => {
      if (
        header !== '_key' &&
        header !== '_type' &&
        header !== 'label' &&
        header !== 'value' &&
        header !== 'email' &&
        header !== '_meta_json' &&
        header !== ''
      ) {
        row[header] = rowData[idx];
      }
    });

    result.push(row as CSVRow);
  }

  return result;
}
