/**
 * Sekundo — Universal Territory Multi-Format Import/Export Engine
 * (.xlsx, .csv, .kml, .geojson, .json) with LGPD / GDPR / C-25/17 Privacy Guard
 *
 * Features:
 * 1. Zero-dependency OpenXML (.xlsx) reader & writer (supports stored & DEFLATE-compressed ZIP entries).
 * 2. Universal Spreadsheet Column Mapper:
 *    - 18-column external address schema (territory_number, territory_locality, line, line2, city, state,
 *      postalcode, dnc, lang, locationType, status, latitude, longitude, sortOrder, hideOnMap, lastWorked, notes, tags)
 *    - 19-column Sekundo editable model schema (Codigo, Territorio, Nome_Territorio, Quadra, Logradouro, ...)
 *    - 17-column canonical hierarchical schema (_key, _type, label, value, email, _meta_json, ...)
 * 3. KML (.kml) Import & Export:
 *    - Supports Folder=Bairro -> Placemark=Território with <Polygon> boundaries WITHOUT requiring individual house pins.
 *    - Supports <Point> address pins and <ExtendedData> attributes.
 * 4. GeoJSON (.geojson) & JSON (.json) Import & Export with proper [lng, lat] <-> [lat, lng] polygon ring conversion.
 * 5. LGPD Art. 5º II & Art. 11 / CJEU C-25/17 Privacy Guard (privacySafeMode = true by default on export).
 * 6. 100% Synthetic Clean-Room Sample Templates for all formats.
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import {
  extractQuadrasFromRegistry,
  parseAddressLine,
} from './quadraPolygonEngine';
import { ensureLatLngRing } from './geoJsonAdapter';
import {
  buildTerritoryModelCsvText,
  sanitizeTerritoryNodeForPrivacy,
} from '../territory/territoryCrudEngine';
import { sanitizeCanvassNotesForLgpd } from '../engines/canvassingEngine';

function normalizeTerritoryId(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 'T01.01.01';
  if (/^T\d{2}\.\d{2}\.\d{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^\d{2}[.\-]\d{2}[.\-]\d{2}$/.test(trimmed)) {
    return 'T' + trimmed.replace(/-/g, '.');
  }
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(2, '0');
  }
  return trimmed;
}

export type TerritoryMultiIoFormat = 'xlsx' | 'csv' | 'kml' | 'geojson' | 'json';

export type TerritorySpreadsheetSchemaType =
  | 'external_18col'
  | 'sekundo_19col'
  | 'canonical_17col';

export interface TerritoryMultiImportOptions {
  format?: TerritoryMultiIoFormat;
  fileName?: string;
  privacySafeMode?: boolean;
  defaultCity?: string;
  defaultState?: string;
}

export interface TerritoryMultiImportResult {
  format: TerritoryMultiIoFormat;
  schemaType?: TerritorySpreadsheetSchemaType;
  nodes: FlatSkeletonEntry[];
  territoriesCount: number;
  polygonsCount: number;
  addressesCount: number;
  privacySanitized: boolean;
}

export interface TerritoryMultiExportOptions {
  format: TerritoryMultiIoFormat;
  privacySafeMode?: boolean;
  spreadsheetSchema?: 'external_18col' | 'sekundo_19col';
  includeKmlPoints?: boolean;
  documentName?: string;
}

export interface TerritoryMultiExportPayload {
  format: TerritoryMultiIoFormat;
  fileName: string;
  mimeType: string;
  text?: string;
  bytes?: Uint8Array;
  privacySanitized: boolean;
}

// ============================================================================
// 1. Pure TypeScript ZIP + RFC 1951 Raw Inflate + OpenXML (.xlsx) Engine
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const FIXED_LIT_LEN_LENGTHS = (() => {
  const arr = new Uint8Array(288);
  arr.fill(8, 0, 144);
  arr.fill(9, 144, 256);
  arr.fill(7, 256, 280);
  arr.fill(8, 280, 288);
  return arr;
})();

const FIXED_DIST_LENGTHS = (() => {
  const arr = new Uint8Array(32);
  arr.fill(5, 0, 32);
  return arr;
})();

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface HuffmanTable {
  maxBits: number;
  table: Int32Array;
}

function buildHuffmanTable(lengths: Uint8Array): HuffmanTable {
  let maxBits = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > maxBits) maxBits = lengths[i];
  }
  if (maxBits === 0) {
    return { maxBits: 1, table: new Int32Array(2).fill(-1) };
  }
  const size = 1 << maxBits;
  const table = new Int32Array(size).fill(-1);
  const blCount = new Int32Array(maxBits + 1);
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 0) blCount[lengths[i]]++;
  }
  const nextCode = new Int32Array(maxBits + 1);
  let code = 0;
  for (let bits = 1; bits <= maxBits; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }
  for (let sym = 0; sym < lengths.length; sym++) {
    const len = lengths[sym];
    if (len === 0) continue;
    let c = nextCode[len]++;
    // Reverse bit order for LSB-first lookup
    let rev = 0;
    for (let b = 0; b < len; b++) {
      rev = (rev << 1) | (c & 1);
      c >>>= 1;
    }
    const step = 1 << len;
    const val = (sym << 8) | len;
    for (let idx = rev; idx < size; idx += step) {
      table[idx] = val;
    }
  }
  return { maxBits, table };
}

/**
 * Synchronous RFC 1951 raw DEFLATE decompressor in pure TypeScript.
 */
function inflateRawSync(src: Uint8Array): Uint8Array {
  let bitPos = 0;
  const totalBits = src.length * 8;

  const readBits = (n: number): number => {
    let val = 0;
    for (let i = 0; i < n; i++) {
      if (bitPos >= totalBits) return val;
      const byteIdx = bitPos >>> 3;
      const bitIdx = bitPos & 7;
      val |= ((src[byteIdx] >>> bitIdx) & 1) << i;
      bitPos++;
    }
    return val;
  };

  const decodeSymbol = (huff: HuffmanTable): number => {
    let look = 0;
    const byteIdx = bitPos >>> 3;
    const bitOffset = bitPos & 7;
    const availBytes = Math.min(4, src.length - byteIdx);
    for (let i = 0; i < availBytes; i++) {
      look |= src[byteIdx + i] << (i * 8);
    }
    look >>>= bitOffset;
    const mask = (1 << huff.maxBits) - 1;
    const entry = huff.table[look & mask];
    if (entry < 0) {
      throw new Error('Invalid DEFLATE Huffman symbol');
    }
    const sym = entry >>> 8;
    const len = entry & 0xff;
    bitPos += len;
    return sym;
  };

  let out = new Uint8Array(Math.max(4096, src.length * 4));
  let outLen = 0;
  const ensureCap = (extra: number) => {
    if (outLen + extra <= out.length) return;
    let nextCap = out.length * 2;
    while (nextCap < outLen + extra) nextCap *= 2;
    const next = new Uint8Array(nextCap);
    next.set(out.subarray(0, outLen));
    out = next;
  };

  let bfinal = 0;
  while (!bfinal && bitPos < totalBits) {
    bfinal = readBits(1);
    const btype = readBits(2);
    if (btype === 0) {
      // Uncompressed block
      bitPos = (bitPos + 7) & ~7;
      const bytePos = bitPos >>> 3;
      const len = src[bytePos] | (src[bytePos + 1] << 8);
      bitPos += 32; // skip LEN and NLEN
      const dataStart = bitPos >>> 3;
      ensureCap(len);
      out.set(src.subarray(dataStart, dataStart + len), outLen);
      outLen += len;
      bitPos += len * 8;
    } else if (btype === 1 || btype === 2) {
      let litLenTable: HuffmanTable;
      let distTable: HuffmanTable;
      if (btype === 1) {
        litLenTable = buildHuffmanTable(FIXED_LIT_LEN_LENGTHS);
        distTable = buildHuffmanTable(FIXED_DIST_LENGTHS);
      } else {
        const hlit = readBits(5) + 257;
        const hdist = readBits(5) + 1;
        const hclen = readBits(4) + 4;
        const clLengths = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) {
          clLengths[CL_ORDER[i]] = readBits(3);
        }
        const clTable = buildHuffmanTable(clLengths);
        const allLengths = new Uint8Array(hlit + hdist);
        let idx = 0;
        while (idx < hlit + hdist) {
          const sym = decodeSymbol(clTable);
          if (sym < 16) {
            allLengths[idx++] = sym;
          } else if (sym === 16) {
            const repeat = readBits(2) + 3;
            const prev = idx > 0 ? allLengths[idx - 1] : 0;
            for (let r = 0; r < repeat; r++) allLengths[idx++] = prev;
          } else if (sym === 17) {
            const repeat = readBits(3) + 3;
            for (let r = 0; r < repeat; r++) allLengths[idx++] = 0;
          } else if (sym === 18) {
            const repeat = readBits(7) + 11;
            for (let r = 0; r < repeat; r++) allLengths[idx++] = 0;
          }
        }
        litLenTable = buildHuffmanTable(allLengths.subarray(0, hlit));
        distTable = buildHuffmanTable(allLengths.subarray(hlit));
      }

      while (true) {
        const sym = decodeSymbol(litLenTable);
        if (sym === 256) break;
        if (sym < 256) {
          ensureCap(1);
          out[outLen++] = sym;
        } else {
          const lenIdx = sym - 257;
          const length = LENGTH_BASE[lenIdx] + readBits(LENGTH_EXTRA[lenIdx]);
          const distSym = decodeSymbol(distTable);
          const dist = DIST_BASE[distSym] + readBits(DIST_EXTRA[distSym]);
          ensureCap(length);
          for (let i = 0; i < length; i++) {
            out[outLen] = out[outLen - dist];
            outLen++;
          }
        }
      }
    } else {
      throw new Error(`Unsupported DEFLATE block type: ${btype}`);
    }
  }

  return out.subarray(0, outLen);
}

function readUint16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUint32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

function writeUint16LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeUint32LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

function extractZipEntries(zipBytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder('utf-8');

  // Prefer Central Directory at end of ZIP (supports data descriptors cleanly)
  let eocdOffset = -1;
  for (let i = zipBytes.length - 22; i >= Math.max(0, zipBytes.length - 65557); i--) {
    if (
      zipBytes[i] === 0x50 &&
      zipBytes[i + 1] === 0x4b &&
      zipBytes[i + 2] === 0x05 &&
      zipBytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const totalEntries = readUint16LE(zipBytes, eocdOffset + 10);
    const cdOffset = readUint32LE(zipBytes, eocdOffset + 16);
    let ptr = cdOffset;
    for (let idx = 0; idx < totalEntries && ptr + 46 <= zipBytes.length; idx++) {
      if (readUint32LE(zipBytes, ptr) !== 0x02014b50) break;
      const method = readUint16LE(zipBytes, ptr + 10);
      const compSize = readUint32LE(zipBytes, ptr + 20);
      const nameLen = readUint16LE(zipBytes, ptr + 28);
      const extraLen = readUint16LE(zipBytes, ptr + 30);
      const commentLen = readUint16LE(zipBytes, ptr + 32);
      const localHeaderOffset = readUint32LE(zipBytes, ptr + 42);
      const name = decoder.decode(zipBytes.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;

      if (localHeaderOffset + 30 <= zipBytes.length) {
        const lNameLen = readUint16LE(zipBytes, localHeaderOffset + 26);
        const lExtraLen = readUint16LE(zipBytes, localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
        const rawSlice = zipBytes.subarray(dataStart, dataStart + compSize);
        if (method === 0) {
          entries.set(name, rawSlice);
        } else if (method === 8) {
          entries.set(name, inflateRawSync(rawSlice));
        }
      }
    }
    return entries;
  }

  // Fallback: sequential local file headers
  let offset = 0;
  while (offset + 30 <= zipBytes.length) {
    const sig = readUint32LE(zipBytes, offset);
    if (sig !== 0x04034b50) break;
    const method = readUint16LE(zipBytes, offset + 8);
    const compSize = readUint32LE(zipBytes, offset + 18);
    const nameLen = readUint16LE(zipBytes, offset + 26);
    const extraLen = readUint16LE(zipBytes, offset + 28);
    const name = decoder.decode(zipBytes.subarray(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    const rawSlice = zipBytes.subarray(dataStart, dataStart + compSize);
    if (method === 0) {
      entries.set(name, rawSlice);
    } else if (method === 8) {
      entries.set(name, inflateRawSync(rawSlice));
    }
    offset = dataStart + compSize;
  }
  return entries;
}

function buildStoredZipArchive(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const crc = computeCrc32(f.data);
    return { nameBytes, data: f.data, crc };
  });

  let localSize = 0;
  let cdSize = 0;
  for (const item of prepared) {
    localSize += 30 + item.nameBytes.length + item.data.length;
    cdSize += 46 + item.nameBytes.length;
  }

  const totalSize = localSize + cdSize + 22;
  const out = new Uint8Array(totalSize);
  let localOffset = 0;
  const localOffsets: number[] = [];

  for (const item of prepared) {
    localOffsets.push(localOffset);
    writeUint32LE(out, localOffset, 0x04034b50);
    writeUint16LE(out, localOffset + 4, 20); // version needed
    writeUint16LE(out, localOffset + 6, 0); // flags
    writeUint16LE(out, localOffset + 8, 0); // method = 0 (Store)
    writeUint16LE(out, localOffset + 10, 0); // mod time
    writeUint16LE(out, localOffset + 12, 0); // mod date
    writeUint32LE(out, localOffset + 14, item.crc);
    writeUint32LE(out, localOffset + 18, item.data.length);
    writeUint32LE(out, localOffset + 22, item.data.length);
    writeUint16LE(out, localOffset + 26, item.nameBytes.length);
    writeUint16LE(out, localOffset + 28, 0);
    out.set(item.nameBytes, localOffset + 30);
    out.set(item.data, localOffset + 30 + item.nameBytes.length);
    localOffset += 30 + item.nameBytes.length + item.data.length;
  }

  const cdStart = localOffset;
  let cdOffset = cdStart;
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    writeUint32LE(out, cdOffset, 0x02014b50);
    writeUint16LE(out, cdOffset + 4, 20);
    writeUint16LE(out, cdOffset + 6, 20);
    writeUint16LE(out, cdOffset + 8, 0);
    writeUint16LE(out, cdOffset + 10, 0);
    writeUint16LE(out, cdOffset + 12, 0);
    writeUint16LE(out, cdOffset + 14, 0);
    writeUint32LE(out, cdOffset + 16, item.crc);
    writeUint32LE(out, cdOffset + 20, item.data.length);
    writeUint32LE(out, cdOffset + 24, item.data.length);
    writeUint16LE(out, cdOffset + 28, item.nameBytes.length);
    writeUint16LE(out, cdOffset + 30, 0);
    writeUint16LE(out, cdOffset + 32, 0);
    writeUint16LE(out, cdOffset + 34, 0);
    writeUint16LE(out, cdOffset + 36, 0);
    writeUint32LE(out, cdOffset + 38, 0);
    writeUint32LE(out, cdOffset + 42, localOffsets[i]);
    out.set(item.nameBytes, cdOffset + 46);
    cdOffset += 46 + item.nameBytes.length;
  }

  writeUint32LE(out, cdOffset, 0x06054b50);
  writeUint16LE(out, cdOffset + 4, 0);
  writeUint16LE(out, cdOffset + 6, 0);
  writeUint16LE(out, cdOffset + 8, prepared.length);
  writeUint16LE(out, cdOffset + 10, prepared.length);
  writeUint32LE(out, cdOffset + 12, cdSize);
  writeUint32LE(out, cdOffset + 16, cdStart);
  writeUint16LE(out, cdOffset + 20, 0);

  return out;
}

function unescapeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function escapeXmlEntities(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLettersToZeroIndex(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

function zeroIndexToColLetters(index: number): string {
  let n = index + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

/**
 * Parses an OpenXML `.xlsx` binary (`Uint8Array`) into a 2D string grid (`rows[rowIdx][colIdx]`).
 */
export function parseXlsxBytesToGrid(xlsxBytes: Uint8Array): string[][] {
  const entries = extractZipEntries(xlsxBytes);
  const decoder = new TextDecoder('utf-8');

  // Parse sharedStrings.xml if present
  const sharedStrings: string[] = [];
  const ssBytes = entries.get('xl/sharedStrings.xml');
  if (ssBytes) {
    const ssXml = decoder.decode(ssBytes);
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(ssXml)) !== null) {
      const siBody = siMatch[1];
      const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      const parts: string[] = [];
      while ((tMatch = tRegex.exec(siBody)) !== null) {
        parts.push(unescapeXmlEntities(tMatch[1]));
      }
      sharedStrings.push(parts.join(''));
    }
  }

  // Find worksheet XML (sheet1.xml or first worksheet in xl/worksheets/)
  let sheetBytes = entries.get('xl/worksheets/sheet1.xml');
  if (!sheetBytes) {
    for (const [k, v] of entries.entries()) {
      if (k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml')) {
        sheetBytes = v;
        break;
      }
    }
  }
  if (!sheetBytes) {
    throw new Error('Arquivo .xlsx inválido: planilha xl/worksheets/sheet1.xml não encontrada.');
  }

  const sheetXml = decoder.decode(sheetBytes);
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowBody = rowMatch[1];
    const rowCells: string[] = [];
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let nextSequentialCol = 0;

    while ((cellMatch = cellRegex.exec(rowBody)) !== null) {
      const attrs = cellMatch[1] || '';
      const cellContent = cellMatch[2] || '';
      const rMatch = /\br="([A-Z]+)\d+"/.exec(attrs);
      const colIdx = rMatch ? colLettersToZeroIndex(rMatch[1]) : nextSequentialCol;
      nextSequentialCol = colIdx + 1;

      const tMatch = /\bt="([^"]+)"/.exec(attrs);
      const cellType = tMatch ? tMatch[1] : '';

      let cellValue = '';
      if (cellType === 'inlineStr') {
        const isTMatch = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/.exec(cellContent);
        cellValue = isTMatch ? unescapeXmlEntities(isTMatch[1]) : '';
      } else {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(cellContent);
        const rawV = vMatch ? unescapeXmlEntities(vMatch[1]) : '';
        if (cellType === 's') {
          const sIdx = parseInt(rawV, 10);
          cellValue = !isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawV;
        } else if (cellType === 'b') {
          cellValue = rawV === '1' || rawV.toLowerCase() === 'true' ? 'TRUE' : 'FALSE';
        } else {
          cellValue = rawV;
        }
      }

      while (rowCells.length <= colIdx) {
        rowCells.push('');
      }
      rowCells[colIdx] = cellValue;
    }

    if (rowCells.some((c) => c.trim() !== '')) {
      rows.push(rowCells);
    }
  }

  return rows;
}

/**
 * Builds a standard OpenXML `.xlsx` binary (`Uint8Array`) from a 2D string grid.
 */
export function buildXlsxBytesFromGrid(
  grid: string[][],
  sheetName: string = 'addresses'
): Uint8Array {
  const encoder = new TextEncoder();
  const safeSheetName = escapeXmlEntities(sheetName || 'addresses');

  const sharedIndexMap = new Map<string, number>();
  const sharedStringsList: string[] = [];
  const getSharedStringIdx = (val: string): number => {
    let idx = sharedIndexMap.get(val);
    if (idx === undefined) {
      idx = sharedStringsList.length;
      sharedIndexMap.set(val, idx);
      sharedStringsList.push(val);
    }
    return idx;
  };

  const rowXmlParts: string[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    const rowNum = r + 1;
    const cellParts: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const rawVal = row[c] ?? '';
      if (rawVal === '') continue;
      const cellRef = `${zeroIndexToColLetters(c)}${rowNum}`;
      // CWE-1236 formula injection protection
      const safeVal = /^[=+\-@]/.test(rawVal) && isNaN(Number(rawVal)) ? `'${rawVal}` : rawVal;
      const sIdx = getSharedStringIdx(safeVal);
      cellParts.push(`<c r="${cellRef}" t="s"><v>${sIdx}</v></c>`);
    }
    rowXmlParts.push(`<row r="${rowNum}">${cellParts.join('')}</row>`);
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStringsList.length}" uniqueCount="${sharedStringsList.length}">
${sharedStringsList.map((s) => `  <si><t xml:space="preserve">${escapeXmlEntities(s)}</t></si>`).join('\n')}
</sst>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowXmlParts.join('\n    ')}
  </sheetData>
</worksheet>`;

  return buildStoredZipArchive([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
    { name: 'xl/sharedStrings.xml', data: encoder.encode(sharedStringsXml) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheet1Xml) },
  ]);
}

// ============================================================================
// 2. Universal Spreadsheet Grid (18-col, 19-col, 17-col) Mapper
// ============================================================================

export const EXTERNAL_18COL_HEADERS = [
  'territory_number',
  'territory_locality',
  'line',
  'line2',
  'city',
  'state',
  'postalcode',
  'dnc',
  'lang',
  'locationType',
  'status',
  'latitude',
  'longitude',
  'sortOrder',
  'hideOnMap',
  'lastWorked',
  'notes',
  'tags',
] as const;

export function parseCsvTextToGrid(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delim = semiCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let curRow: string[] = [];
  let curCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          curCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        curCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        curRow.push(curCell);
        curCell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && cleanText[i + 1] === '\n') i++;
        curRow.push(curCell);
        if (curRow.some((c) => c.trim() !== '')) {
          rows.push(curRow);
        }
        curRow = [];
        curCell = '';
      } else {
        curCell += ch;
      }
    }
  }
  curRow.push(curCell);
  if (curRow.some((c) => c.trim() !== '')) {
    rows.push(curRow);
  }
  return rows;
}

function normalizeHeaderName(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_');
}

function parseOptionalCoordNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(String(val).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n === 0) return undefined;
  return n;
}

function formatHierarchicalTerritoryKey(tNum: string): string {
  const clean = tNum.replace(/^T/i, '').trim();
  const parts = clean.split(/[.-]/).filter(Boolean);
  if (parts.length === 3) {
    return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return normalizeTerritoryId(tNum);
}

/**
 * Detects whether a raw CSV string matches a Territory Spreadsheet schema
 * (17-col canonical, 18-col external `Territory/Locality/Line`, or 19-col semicolon `Codigo;Territorio;Nome_Territorio;...`)
 * rather than an Omni-CSV or a generic schedule CSV.
 */
export function isTerritorySpreadsheetCsvText(csvText: string): boolean {
  const clean = (csvText || '').replace(/^\uFEFF/, '').trim();
  if (!clean) return false;
  if (clean.includes('#PLANILHA,')) return false;

  const firstLine = (clean.split(/\r?\n/)[0] || '').trim();
  if (!firstLine) return false;

  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delim = semiCount > commaCount ? ';' : ',';
  const headers = firstLine
    .split(delim)
    .map((h) => normalizeHeaderName(h.replace(/^"|"$/g, '')));

  if (headers.includes('_record_kind') || headers.includes('title_or_name')) {
    return false;
  }

  const hasTerritoryIdHeader = headers.some((h) =>
    ['territory_number', 'territorio', 'territory', 'territory_locality', 'nome_territorio'].includes(h)
  );
  const hasAddressOrGeoHeader = headers.some((h) =>
    [
      'locality',
      'territory_locality',
      'nome_territorio',
      'line',
      'logradouro',
      'endereco',
      'lat',
      'latitude',
      'lng',
      'longitude',
      'worked',
      'trabalhado',
    ].includes(h)
  );

  return hasTerritoryIdHeader && hasAddressOrGeoHeader;
}

/**
 * Converts a 2D spreadsheet grid (18-col external, 19-col Sekundo model, or 17-col canonical)
 * into clean `FlatSkeletonEntry[]` nodes ready for Sekundo.
 */
export function importTerritorySpreadsheetGrid(
  grid: string[][],
  options: TerritoryMultiImportOptions = {}
): {
  schemaType: TerritorySpreadsheetSchemaType;
  nodes: FlatSkeletonEntry[];
  territoriesCount: number;
  addressesCount: number;
} {
  if (grid.length < 2) {
    return { schemaType: 'external_18col', nodes: [], territoriesCount: 0, addressesCount: 0 };
  }

  const rawHeaders = grid[0].map(normalizeHeaderName);
  const colIdx = (aliases: string[]): number => {
    for (const a of aliases) {
      const idx = rawHeaders.indexOf(normalizeHeaderName(a));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const hasKeyAndType = colIdx(['_key']) !== -1 && colIdx(['_type']) !== -1;
  const hasTerritoryLocality =
    colIdx(['territory_locality', 'locationtype', 'hideonmap', 'sortorder']) !== -1;

  const schemaType: TerritorySpreadsheetSchemaType = hasKeyAndType
    ? 'canonical_17col'
    : hasTerritoryLocality
    ? 'external_18col'
    : 'sekundo_19col';

  if (schemaType === 'canonical_17col') {
    const iKey = colIdx(['_key']);
    const iType = colIdx(['_type']);
    const iLabel = colIdx(['label']);
    const iValue = colIdx(['value']);
    const iEmail = colIdx(['email']);
    const iMetaJson = colIdx(['_meta_json']);
    const iTerrNum = colIdx(['territory_number']);
    const iLocality = colIdx(['locality']);
    const iLine = colIdx(['line', 'logradouro', 'endereco']);
    const iLine2 = colIdx(['line2', 'bairro', 'neighborhood']);
    const iCity = colIdx(['city']);
    const iState = colIdx(['state']);
    const iCountry = colIdx(['country', 'pais']);
    const iPropertyType = colIdx(['property_type', 'locationtype', 'tipo_imovel']);
    const iPostal = colIdx(['postalcode']);
    const iLat = colIdx(['lat', 'latitude']);
    const iLng = colIdx(['lng', 'longitude']);
    const iWorked = colIdx(['worked']);
    const iNotes = colIdx(['notes']);
    const iAssigned = colIdx(['assigned_date']);
    const iCompleted = colIdx(['completed_date']);

    const nodes: FlatSkeletonEntry[] = [];
    const terrSet = new Set<string>();
    let addressesCount = 0;

    for (let r = 1; r < grid.length; r++) {
      const row = grid[r];
      const key = (row[iKey] || '').trim();
      if (!key) continue;
      const type = ((row[iType] || 'territory').trim() || 'territory') as FlatSkeletonEntry['type'];
      let meta: Record<string, any> = {};
      if (iMetaJson !== -1 && row[iMetaJson]) {
        try {
          meta = JSON.parse(row[iMetaJson]);
        } catch {
          meta = {};
        }
      }
      const tNum = (iTerrNum !== -1 ? row[iTerrNum] : meta.territory_number) || '';
      if (tNum) {
        meta.territory_number = tNum;
        meta.territoryNumber = tNum;
        terrSet.add(tNum);
      }
      if (iLocality !== -1 && row[iLocality]) meta.locality = row[iLocality];
      if (iLine !== -1 && row[iLine]) {
        meta.line = row[iLine];
        if (type !== 'header' && !meta.street) {
          const parsedLine = parseAddressLine(row[iLine]);
          meta.street = parsedLine.street;
          meta.number = parsedLine.number;
        }
      }
      if (iLine2 !== -1 && row[iLine2]) meta.line2 = row[iLine2];
      if (iCity !== -1 && row[iCity]) meta.city = row[iCity];
      if (iState !== -1 && row[iState]) meta.state = row[iState];
      if (iCountry !== -1 && row[iCountry]) meta.country = row[iCountry];
      if (iPropertyType !== -1 && row[iPropertyType]) meta.property_type = row[iPropertyType];
      if (iPostal !== -1 && row[iPostal]) meta.postalcode = row[iPostal];
      const lat = iLat !== -1 ? parseOptionalCoordNumber(row[iLat]) : parseOptionalCoordNumber(meta.lat);
      const lng = iLng !== -1 ? parseOptionalCoordNumber(row[iLng]) : parseOptionalCoordNumber(meta.lng);
      if (lat !== undefined) meta.lat = lat;
      if (lng !== undefined) meta.lng = lng;
      if (iWorked !== -1 && row[iWorked] !== undefined && row[iWorked] !== '') {
        meta.worked = Number(row[iWorked]) === 1 ? 1 : 0;
      }
      if (iNotes !== -1 && row[iNotes]) meta.notes = row[iNotes];
      if (iAssigned !== -1 && row[iAssigned]) meta.assigned_date = row[iAssigned];
      if (iCompleted !== -1 && row[iCompleted]) meta.completed_date = row[iCompleted];
      meta.engine_id = 'territory_logistics';

      if (type !== 'header') addressesCount++;

      const entry: FlatSkeletonEntry = {
        key,
        type,
        label: iLabel !== -1 ? row[iLabel] || key : key,
        value: iValue !== -1 ? row[iValue] || '' : '',
        email: iEmail !== -1 ? row[iEmail] || '' : '',
        meta,
      };
      nodes.push(options.privacySafeMode ? sanitizeTerritoryNodeForPrivacy(entry) : entry);
    }

    return {
      schemaType,
      nodes,
      territoriesCount: terrSet.size,
      addressesCount,
    };
  }

  // Handle 18-column external format or 19-column Sekundo model format
  const iTerrNum = colIdx(['territory_number', 'territorio', 'territory']);
  const iLocality = colIdx(['territory_locality', 'nome_territorio', 'locality', 'bairro']);
  const iLine = colIdx(['line', 'logradouro', 'endereco', 'street']);
  const iNumber = colIdx(['numero', 'number']);
  const iLine2 = colIdx(['line2', 'bairro', 'neighborhood', 'complemento']);
  const iCity = colIdx(['city', 'cidade']);
  const iState = colIdx(['state', 'uf']);
  const iPostal = colIdx(['postalcode', 'cep']);
  const iDnc = colIdx(['dnc']);
  const iLang = colIdx(['lang', 'idioma', 'language']);
  const iLocType = colIdx(['locationtype', 'tipo_imovel', 'property_type']);
  const iStatus = colIdx(['status', 'trabalhado', 'worked']);
  const iLat = colIdx(['latitude', 'lat']);
  const iLng = colIdx(['longitude', 'lng', 'lon']);
  const iSortOrder = colIdx(['sortorder', 'ordem']);
  const iHideOnMap = colIdx(['hideonmap']);
  const iLastWorked = colIdx(['lastworked', 'data_conclusao', 'completed_date']);
  const iAssignedDate = colIdx(['data_designacao', 'assigned_date']);
  const iWorker = colIdx(['responsavel', 'worker', 'workername']);
  const iNotes = colIdx(['notes', 'observacoes', 'obs']);
  const iTags = colIdx(['tags']);

  interface GroupedAddr {
    tNum: string;
    locality: string;
    line: string;
    line2: string;
    street: string;
    numberStr: string;
    city: string;
    state: string;
    postalcode: string;
    dnc: boolean;
    lang: string;
    propertyType: string;
    worked: 0 | 1;
    lat?: number;
    lng?: number;
    sortOrder?: number;
    hideOnMap: boolean;
    lastWorked: string;
    assignedDate: string;
    workerName: string;
    notes: string;
    tags: string;
  }

  const byTerritory = new Map<string, GroupedAddr[]>();

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const rawTNum = (iTerrNum !== -1 ? row[iTerrNum] : '')?.trim() || '';
    const rawLine = (iLine !== -1 ? row[iLine] : '')?.trim() || '';
    if (!rawTNum && !rawLine) continue;

    const tNum = normalizeTerritoryId(rawTNum || '01');
    const locality = (iLocality !== -1 ? row[iLocality] : '')?.trim() || `Setor ${tNum}`;
    const explicitNum = (iNumber !== -1 ? row[iNumber] : '')?.trim() || '';
    const parsedLine = parseAddressLine(rawLine);
    const street = explicitNum ? rawLine : parsedLine.street;
    const numberStr = explicitNum || parsedLine.number;
    const fullLine = explicitNum ? `${street}, ${explicitNum}` : rawLine;
    const line2 = (iLine2 !== -1 ? row[iLine2] : '')?.trim() || locality;
    const city = (iCity !== -1 ? row[iCity] : '')?.trim() || options.defaultCity || '';
    const state = (iState !== -1 ? row[iState] : '')?.trim() || options.defaultState || 'SP';
    const postalcode = (iPostal !== -1 ? row[iPostal] : '')?.trim() || '';
    const rawDnc = (iDnc !== -1 ? row[iDnc] : '')?.trim().toLowerCase() || '';
    const dnc = rawDnc === 'true' || rawDnc === '1' || rawDnc === 'sim' || rawDnc === 'yes';
    const lang = (iLang !== -1 ? row[iLang] : '')?.trim() || '';
    const rawLocType = (iLocType !== -1 ? row[iLocType] : '')?.trim().toLowerCase() || '';
    const propertyType =
      rawLocType === 'business' || rawLocType === 'comercial' || rawLocType === 'commercial'
        ? 'comercial'
        : rawLocType || 'residencial';
    const rawStatus = (iStatus !== -1 ? row[iStatus] : '')?.trim().toLowerCase() || '';
    const worked: 0 | 1 =
      rawStatus === '1' ||
      rawStatus === 'true' ||
      rawStatus === 'concluido' ||
      rawStatus === 'worked' ||
      rawStatus === 'done'
        ? 1
        : 0;
    const lat = iLat !== -1 ? parseOptionalCoordNumber(row[iLat]) : undefined;
    const lng = iLng !== -1 ? parseOptionalCoordNumber(row[iLng]) : undefined;
    const sortOrder =
      iSortOrder !== -1 && row[iSortOrder] !== '' && !isNaN(Number(row[iSortOrder]))
        ? Number(row[iSortOrder])
        : undefined;
    const rawHide = (iHideOnMap !== -1 ? row[iHideOnMap] : '')?.trim().toLowerCase() || '';
    const hideOnMap = rawHide === 'true' || rawHide === '1';
    const lastWorked = (iLastWorked !== -1 ? row[iLastWorked] : '')?.trim() || '';
    const assignedDate = (iAssignedDate !== -1 ? row[iAssignedDate] : '')?.trim() || '';
    const workerName = (iWorker !== -1 ? row[iWorker] : '')?.trim() || '';
    const notes = (iNotes !== -1 ? row[iNotes] : '')?.trim() || '';
    const tags = (iTags !== -1 ? row[iTags] : '')?.trim() || '';

    if (!byTerritory.has(tNum)) {
      byTerritory.set(tNum, []);
    }
    byTerritory.get(tNum)!.push({
      tNum,
      locality,
      line: fullLine,
      line2,
      street,
      numberStr,
      city,
      state,
      postalcode,
      dnc,
      lang,
      propertyType,
      worked,
      lat,
      lng,
      sortOrder,
      hideOnMap,
      lastWorked,
      assignedDate,
      workerName,
      notes,
      tags,
    });
  }

  const nodes: FlatSkeletonEntry[] = [];
  let addressesCount = 0;

  for (const [tNum, addrs] of Array.from(byTerritory.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const groupKey = formatHierarchicalTerritoryKey(tNum);
    const first = addrs[0];
    const coords = addrs.filter((a) => a.lat !== undefined && a.lng !== undefined);
    const avgLat =
      coords.length > 0
        ? Math.round((coords.reduce((s, a) => s + (a.lat as number), 0) / coords.length) * 1e6) / 1e6
        : undefined;
    const avgLng =
      coords.length > 0
        ? Math.round((coords.reduce((s, a) => s + (a.lng as number), 0) / coords.length) * 1e6) / 1e6
        : undefined;
    const allWorked: 0 | 1 = addrs.length > 0 && addrs.every((a) => a.worked === 1) ? 1 : 0;

    const headerEntry: FlatSkeletonEntry = {
      key: groupKey,
      type: 'header',
      label: `${tNum} — ${first.locality}`,
      value: first.workerName || '',
      email: '',
      meta: {
        engine_id: 'territory_logistics',
        territory_number: tNum,
        territoryNumber: tNum,
        locality: first.locality,
        city: first.city,
        state: first.state,
        postalcode: first.postalcode,
        totalAddresses: addrs.length,
        worked: allWorked,
        lat: avgLat,
        lng: avgLng,
      },
    };
    nodes.push(options.privacySafeMode ? sanitizeTerritoryNodeForPrivacy(headerEntry) : headerEntry);

    addrs.forEach((addr, idx) => {
      addressesCount++;
      const leafKey = `${groupKey}-${String(idx + 1).padStart(2, '0')}`;
      const labelSuffix = addr.line2 ? ` (${addr.line2})` : '';
      const rawLabel = `${addr.line}${labelSuffix}`;
      const leafEntry: FlatSkeletonEntry = {
        key: leafKey,
        type: 'territory',
        label: rawLabel,
        value: addr.worked === 1 ? addr.workerName : '',
        email: '',
        meta: {
          engine_id: 'territory_logistics',
          territory_number: tNum,
          territoryNumber: tNum,
          locality: addr.locality,
          street: addr.street,
          number: addr.numberStr,
          line: addr.line,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          postalcode: addr.postalcode,
          property_type: addr.propertyType,
          worked: addr.worked,
          lat: addr.lat,
          lng: addr.lng,
          sortOrder: addr.sortOrder,
          hideOnMap: addr.hideOnMap || undefined,
          lastWorkedAt: addr.lastWorked || undefined,
          assignedAt: addr.assignedDate || undefined,
          workerName: addr.workerName || undefined,
          notes: addr.notes || undefined,
          tags: addr.tags || undefined,
          dnc: options.privacySafeMode ? undefined : addr.dnc || undefined,
          language: options.privacySafeMode ? undefined : addr.lang || undefined,
        },
      };
      nodes.push(options.privacySafeMode ? sanitizeTerritoryNodeForPrivacy(leafEntry) : leafEntry);
    });
  }

  return {
    schemaType,
    nodes,
    territoriesCount: byTerritory.size,
    addressesCount,
  };
}

/**
 * Exports `cleanTerritoryNodes` into a 2D spreadsheet grid in either the 18-column external format
 * (`territory_number`, `territory_locality`, `line`, ...) or the 19-column Sekundo model format.
 */
export function exportTerritorySpreadsheetGrid(
  cleanTerritoryNodes: FlatSkeletonEntry[],
  options: {
    schema?: 'external_18col' | 'sekundo_19col';
    privacySafeMode?: boolean;
  } = {}
): string[][] {
  const privacySafeMode = options.privacySafeMode !== false; // Default TRUE for LGPD / C-25/17 safety!
  const schema = options.schema || 'external_18col';

  if (schema === 'sekundo_19col') {
    const csvText = buildTerritoryModelCsvText(cleanTerritoryNodes, { privacySafeMode });
    return parseCsvTextToGrid(csvText);
  }

  const effectiveNodes = privacySafeMode
    ? cleanTerritoryNodes.map((n) => sanitizeTerritoryNodeForPrivacy(n))
    : cleanTerritoryNodes;

  const parentKeys = new Set<string>();
  for (const node of effectiveNodes) {
    const parts = node.key.split('-');
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        parentKeys.add(parts.slice(0, i).join('-'));
      }
    }
  }

  const grid: string[][] = [[...EXTERNAL_18COL_HEADERS]];
  let seq = 0;

  for (const node of effectiveNodes) {
    const meta = (node.meta || {}) as Record<string, any>;
    const isPolygonOnlyQuadra =
      node.type === 'header' &&
      !parentKeys.has(node.key) &&
      Array.isArray(meta.boundaryPolygon) &&
      meta.boundaryPolygon.length >= 3;
    if ((parentKeys.has(node.key) || node.type === 'header') && !isPolygonOnlyQuadra) continue;
    seq++;
    const tNum = String(meta.territory_number || meta.territoryNumber || 'T01.01.01').trim();
    const locality = String(meta.locality || meta.territory_name || meta.neighborhood || '').trim();
    const line = String(meta.line || node.label || '').trim();
    const line2 = String(meta.line2 || meta.neighborhood || locality || '').trim();
    const city = String(meta.city || meta.cidade || '').trim();
    const state = String(meta.state || meta.uf || 'SP').trim();
    const postalcode = String(meta.postalcode || meta.cep || '').trim();
    const dnc = privacySafeMode ? 'FALSE' : meta.dnc ? 'TRUE' : 'FALSE';
    const lang = privacySafeMode ? '' : String(meta.language || meta.lang || '').trim();
    const propType = String(meta.property_type || meta.propertyType || 'residencial').toLowerCase();
    const locationType = isPolygonOnlyQuadra
      ? 'polygon_quadra'
      : propType === 'comercial' || propType === 'business'
      ? 'business'
      : 'residence';
    const status = Number(meta.worked) === 1 ? 'worked' : 'valid';
    const lat = meta.lat !== undefined && meta.lat !== null ? String(meta.lat) : '';
    const lng = meta.lng !== undefined && meta.lng !== null ? String(meta.lng) : '';
    const sortOrder = String(meta.sortOrder ?? meta.custom_Order ?? seq);
    const hideOnMap = meta.hideOnMap ? 'TRUE' : 'FALSE';
    const lastWorked = String(meta.lastWorkedAt || meta.completed_date || meta.completedAt || '').trim();
    const notes = privacySafeMode
      ? ''
      : sanitizeCanvassNotesForLgpd(String(meta.notes || meta.observacoes || ''));
    const tags = Array.isArray(meta.tags) ? meta.tags.join(',') : String(meta.tags || (isPolygonOnlyQuadra ? 'kml_polygon' : ''));

    grid.push([
      tNum,
      locality,
      line,
      line2,
      city,
      state,
      postalcode,
      dnc,
      lang,
      locationType,
      status,
      lat,
      lng,
      sortOrder,
      hideOnMap,
      lastWorked,
      notes,
      tags,
    ]);
  }

  return grid;
}

// ============================================================================
// 3. KML (.kml) Import & Export (Folder=Bairro -> Placemark=Território)
//    Supports Polygon-only territories WITHOUT requiring prior house pins!
// ============================================================================

function parseKmlCoordinateTuples(coordText: string): [number, number][] {
  const pts: [number, number][] = [];
  const tokens = String(coordText || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const tok of tokens) {
    const parts = tok.split(',');
    if (parts.length >= 2) {
      const lng = Number(parts[0]);
      const lat = Number(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
        pts.push([lat, lng]);
      }
    }
  }
  // Remove duplicate closing vertex if identical to first vertex
  if (
    pts.length > 3 &&
    Math.abs(pts[0][0] - pts[pts.length - 1][0]) < 1e-7 &&
    Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-7
  ) {
    pts.pop();
  }
  return pts;
}

function parseExtendedDataFromKmlBlock(blockXml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const dataRegex = /<Data\s+name="([^"]+)"[^>]*>[\s\S]*?<value>([\s\S]*?)<\/value>[\s\S]*?<\/Data>/gi;
  let m: RegExpExecArray | null;
  while ((m = dataRegex.exec(blockXml)) !== null) {
    out[m[1].trim()] = unescapeXmlEntities(m[2].trim());
  }
  const simpleRegex = /<SimpleData\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/SimpleData>/gi;
  while ((m = simpleRegex.exec(blockXml)) !== null) {
    out[m[1].trim()] = unescapeXmlEntities(m[2].trim());
  }
  return out;
}

/**
 * Parses a `.kml` document (`Folder=Bairro -> Placemark=Território`) into `FlatSkeletonEntry[]`.
 * Works with Polygon-only KML maps (0 individual houses) as well as Point pins!
 */
export function parseKmlToCleanTerritoryNodes(
  kmlText: string,
  options: TerritoryMultiImportOptions = {}
): {
  nodes: FlatSkeletonEntry[];
  territoriesCount: number;
  polygonsCount: number;
  addressesCount: number;
} {
  const nodes: FlatSkeletonEntry[] = [];
  const terrSet = new Set<string>();
  let polygonsCount = 0;
  let addressesCount = 0;

  interface KmlFolderContext {
    folderName: string;
    placemarksXml: string[];
  }

  const contexts: KmlFolderContext[] = [];
  const folderRegex = /<Folder\b[^>]*>([\s\S]*?)<\/Folder>/gi;
  let folderMatch: RegExpExecArray | null;
  let remainingXml = kmlText;

  while ((folderMatch = folderRegex.exec(kmlText)) !== null) {
    const folderBody = folderMatch[1];
    const withoutPlacemarks = folderBody.replace(/<Placemark\b[\s\S]*?<\/Placemark>/gi, '');
    const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(withoutPlacemarks);
    const folderName = nameMatch ? unescapeXmlEntities(nameMatch[1].trim()) : 'Setor Geral';
    const pmRegex = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
    const pms: string[] = [];
    let pmMatch: RegExpExecArray | null;
    while ((pmMatch = pmRegex.exec(folderBody)) !== null) {
      pms.push(pmMatch[1]);
    }
    if (pms.length > 0) {
      contexts.push({ folderName, placemarksXml: pms });
    }
    remainingXml = remainingXml.replace(folderMatch[0], '');
  }

  // Also capture top-level Placemarks outside any <Folder>
  const topPmRegex = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
  const topPms: string[] = [];
  let topPmMatch: RegExpExecArray | null;
  while ((topPmMatch = topPmRegex.exec(remainingXml)) !== null) {
    topPms.push(topPmMatch[1]);
  }
  if (topPms.length > 0) {
    contexts.push({ folderName: 'Setor Geral', placemarksXml: topPms });
  }

  let territorySeq = 0;
  const territoryKeyByNum = new Map<string, string>();
  const childCountByGroup = new Map<string, number>();

  for (const ctx of contexts) {
    for (const pmBody of ctx.placemarksXml) {
      const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(pmBody);
      const pmName = nameMatch ? unescapeXmlEntities(nameMatch[1].trim()) : '';
      const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(pmBody);
      const pmDesc = descMatch
        ? unescapeXmlEntities(descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim())
        : '';
      const extData = parseExtendedDataFromKmlBlock(pmBody);

      // Extract territory number from ExtendedData or Placemark name
      const rawTerrFromName = /\b(T?\d{2}[.\-]\d{2}[.\-]\d{2}|\b\d{1,3})\b/i.exec(pmName)?.[1];
      const rawTNum =
        extData.territory_number ||
        extData.territoryNumber ||
        rawTerrFromName ||
        `T01.01.${String(++territorySeq).padStart(2, '0')}`;
      const tNum = normalizeTerritoryId(rawTNum);
      terrSet.add(tNum);

      const locality =
        extData.locality ||
        extData.territory_locality ||
        (ctx.folderName !== 'Setor Geral' ? ctx.folderName : '') ||
        (pmName.includes('—') ? pmName.split('—')[1].trim() : pmName) ||
        `Setor ${tNum}`;

      const polyRegex = /<Polygon\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Polygon>/gi;
      const polyMatches: string[] = [];
      let pMatch: RegExpExecArray | null;
      while ((pMatch = polyRegex.exec(pmBody)) !== null) {
        polyMatches.push(pMatch[1]);
      }
      const pointMatch = /<Point\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i.exec(
        pmBody
      );

      if (polyMatches.length > 0) {
        for (let pIdx = 0; pIdx < polyMatches.length; pIdx++) {
          const ring = parseKmlCoordinateTuples(polyMatches[pIdx]);
          if (ring.length >= 3) {
            polygonsCount++;
            const baseKey = extData.quadra_key || formatHierarchicalTerritoryKey(tNum);
            let groupKey = baseKey;
            let suffix = 1;
            while (nodes.some((n) => n.key === groupKey)) {
              suffix++;
              const parts = baseKey.split('-');
              if (parts.length === 3 && /^\d+$/.test(parts[2])) {
                groupKey = `${parts[0]}-${parts[1]}-${String(Number(parts[2]) + suffix - 1).padStart(2, '0')}`;
              } else {
                groupKey = `${baseKey}-${String(suffix).padStart(2, '0')}`;
              }
            }
            if (!territoryKeyByNum.has(tNum)) {
              territoryKeyByNum.set(tNum, groupKey);
            }
            const avgLat =
              Math.round((ring.reduce((s, p) => s + p[0], 0) / ring.length) * 1e6) / 1e6;
            const avgLng =
              Math.round((ring.reduce((s, p) => s + p[1], 0) / ring.length) * 1e6) / 1e6;
            const worked: 0 | 1 =
              extData.worked === '1' || extData.status === 'worked' ? 1 : 0;

            const polyNode: FlatSkeletonEntry = {
              key: groupKey,
              type: 'header',
              label:
                polyMatches.length > 1
                  ? `${pmName || `${tNum} — ${locality}`} (${pIdx + 1})`
                  : pmName || `${tNum} — ${locality}`,
              value: '',
              email: '',
              meta: {
                engine_id: 'territory_logistics',
                is_quadra: true,
                quadra_number: groupKey,
                territory_number: tNum,
                territoryNumber: tNum,
                locality,
                city: extData.city || options.defaultCity || '',
                state: extData.state || options.defaultState || 'SP',
                boundaryPolygon: ring,
                boundarySource: 'imported',
                bufferMeters: 0,
                lat: avgLat,
                lng: avgLng,
                worked,
                notes: options.privacySafeMode ? undefined : sanitizeCanvassNotesForLgpd(pmDesc),
              },
            };
            nodes.push(options.privacySafeMode ? sanitizeTerritoryNodeForPrivacy(polyNode) : polyNode);
          }
        }
      } else if (pointMatch) {
        const pts = parseKmlCoordinateTuples(pointMatch[1]);
        if (pts.length > 0) {
          addressesCount++;
          const [lat, lng] = pts[0];
          let groupKey = territoryKeyByNum.get(tNum);
          if (!groupKey) {
            groupKey = formatHierarchicalTerritoryKey(tNum);
            territoryKeyByNum.set(tNum, groupKey);
            nodes.push({
              key: groupKey,
              type: 'header',
              label: `${tNum} — ${locality}`,
              value: '',
              email: '',
              meta: {
                engine_id: 'territory_logistics',
                territory_number: tNum,
                territoryNumber: tNum,
                locality,
                city: extData.city || options.defaultCity || '',
                state: extData.state || options.defaultState || 'SP',
                worked: 0,
              },
            });
          }
          const nextIdx = (childCountByGroup.get(groupKey) || 0) + 1;
          childCountByGroup.set(groupKey, nextIdx);
          const leafKey = `${groupKey}-${String(nextIdx).padStart(2, '0')}`;
          const parsedAddr = parseAddressLine(pmName || ` Ponto ${nextIdx}`);
          const worked: 0 | 1 =
            extData.worked === '1' || extData.status === 'worked' ? 1 : 0;

          const ptNode: FlatSkeletonEntry = {
            key: leafKey,
            type: 'territory',
            label: pmName || `Endereço ${nextIdx}`,
            value: '',
            email: '',
            meta: {
              engine_id: 'territory_logistics',
              territory_number: tNum,
              territoryNumber: tNum,
              locality,
              street: parsedAddr.street,
              number: parsedAddr.number,
              line: pmName || `Endereço ${nextIdx}`,
              city: extData.city || options.defaultCity || '',
              state: extData.state || options.defaultState || 'SP',
              lat,
              lng,
              worked,
              notes: options.privacySafeMode ? undefined : sanitizeCanvassNotesForLgpd(pmDesc),
            },
          };
          nodes.push(options.privacySafeMode ? sanitizeTerritoryNodeForPrivacy(ptNode) : ptNode);
        }
      }
    }
  }

  return {
    nodes,
    territoriesCount: terrSet.size,
    polygonsCount,
    addressesCount,
  };
}

/**
 * Exports `cleanTerritoryNodes` to a Google Earth / My Maps / GIS
 * compatible `.kml` file organized by `<Folder>` (Bairro/Locality) -> `<Placemark>` (Polygons & Optional Points).
 */
export function exportCleanTerritoryNodesToKml(
  cleanTerritoryNodes: FlatSkeletonEntry[],
  options: {
    privacySafeMode?: boolean;
    includePoints?: boolean;
    documentName?: string;
  } = {}
): string {
  const privacySafeMode = options.privacySafeMode !== false; // Default TRUE
  const effectiveNodes = privacySafeMode
    ? cleanTerritoryNodes.map((n) => sanitizeTerritoryNodeForPrivacy(n))
    : cleanTerritoryNodes;

  const quadras = extractQuadrasFromRegistry(effectiveNodes);
  const byLocality = new Map<string, typeof quadras>();

  for (const q of quadras) {
    const loc = (q.locality || 'Setor Geral').trim();
    if (!byLocality.has(loc)) {
      byLocality.set(loc, []);
    }
    byLocality.get(loc)!.push(q);
  }

  const docTitle = escapeXmlEntities(options.documentName || 'Sekundo — Mapa de Territórios e Quadras');
  const folderXmlParts: string[] = [];

  for (const [locality, qList] of Array.from(byLocality.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const placemarkParts: string[] = [];

    for (const q of qList) {
      if (q.boundaryPolygon && q.boundaryPolygon.length >= 3) {
        const closedRing = [...q.boundaryPolygon, q.boundaryPolygon[0]];
        const coordsStr = closedRing.map(([lat, lng]) => `${lng},${lat},0`).join(' ');
        const styleId = q.isCompleted ? '#polyWorked' : '#polyPending';
        const pmName = escapeXmlEntities(
          q.label.includes(q.territoryNumber) ? q.label : `${q.territoryNumber} — ${q.label}`
        );
        const desc = escapeXmlEntities(
          `Território ${q.territoryNumber} (${locality}) • Cobertura: ${q.coveragePercent}%`
        );

        placemarkParts.push(`      <Placemark>
        <name>${pmName}</name>
        <description>${desc}</description>
        <styleUrl>${styleId}</styleUrl>
        <ExtendedData>
          <Data name="territory_number"><value>${escapeXmlEntities(q.territoryNumber)}</value></Data>
          <Data name="locality"><value>${escapeXmlEntities(locality)}</value></Data>
          <Data name="quadra_key"><value>${escapeXmlEntities(q.key)}</value></Data>
          <Data name="worked"><value>${q.isCompleted ? '1' : '0'}</value></Data>
          <Data name="total_units"><value>${q.totalUnits}</value></Data>
        </ExtendedData>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${coordsStr}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>`);
      }

      if (options.includePoints) {
        for (const st of q.streets) {
          for (const u of st.units) {
            if (typeof u.lat === 'number' && typeof u.lng === 'number') {
              const uName = escapeXmlEntities(`${u.street}, ${u.numberOrComplement}`);
              placemarkParts.push(`      <Placemark>
        <name>${uName}</name>
        <ExtendedData>
          <Data name="territory_number"><value>${escapeXmlEntities(q.territoryNumber)}</value></Data>
          <Data name="locality"><value>${escapeXmlEntities(locality)}</value></Data>
          <Data name="worked"><value>${u.worked}</value></Data>
        </ExtendedData>
        <Point>
          <coordinates>${u.lng},${u.lat},0</coordinates>
        </Point>
      </Placemark>`);
            }
          }
        }
      }
    }

    folderXmlParts.push(`    <Folder>
      <name>${escapeXmlEntities(locality)}</name>
${placemarkParts.join('\n')}
    </Folder>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${docTitle}</name>
    <Style id="polyPending">
      <LineStyle><color>ff4444ef</color><width>2</width></LineStyle>
      <PolyStyle><color>4d4444ef</color></PolyStyle>
    </Style>
    <Style id="polyWorked">
      <LineStyle><color>ff81b910</color><width>2</width></LineStyle>
      <PolyStyle><color>4d81b910</color></PolyStyle>
    </Style>
${folderXmlParts.join('\n')}
  </Document>
</kml>`;
}

// ============================================================================
// 4. GeoJSON (.geojson) & JSON (.json) Import & Export
// ============================================================================

export function parseGeoJsonToCleanTerritoryNodes(
  geoJsonText: string,
  options: TerritoryMultiImportOptions = {}
): {
  nodes: FlatSkeletonEntry[];
  territoriesCount: number;
  polygonsCount: number;
  addressesCount: number;
} {
  const parsed = JSON.parse(geoJsonText);
  const features: any[] = Array.isArray(parsed?.features) ? parsed.features : [];
  const nodes: FlatSkeletonEntry[] = [];
  const terrSet = new Set<string>();
  let polygonsCount = 0;
  let addressesCount = 0;
  let seq = 0;

  for (const feat of features) {
    seq++;
    const props = feat?.properties || {};
    const geom = feat?.geometry || {};
    const rawTNum =
      props.territory_number ||
      props.territoryNumber ||
      props.territory ||
      `T01.01.${String(seq).padStart(2, '0')}`;
    const tNum = normalizeTerritoryId(String(rawTNum));
    terrSet.add(tNum);
    const locality = String(
      props.locality || props.territory_locality || props.neighborhood || `Setor ${tNum}`
    ).trim();

    if (
      (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) ||
      (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates?.[0]?.[0]))
    ) {
      polygonsCount++;
      const ringLngLat: [number, number][] =
        geom.type === 'MultiPolygon' ? geom.coordinates[0][0] : geom.coordinates[0];
      const ringLatLng = ensureLatLngRing(ringLngLat, 'lng_lat');
      const avgLat =
        ringLatLng.length > 0
          ? Math.round((ringLatLng.reduce((s, p) => s + p[0], 0) / ringLatLng.length) * 1e6) / 1e6
          : undefined;
      const avgLng =
        ringLatLng.length > 0
          ? Math.round((ringLatLng.reduce((s, p) => s + p[1], 0) / ringLatLng.length) * 1e6) / 1e6
          : undefined;
      const groupKey = String(props._key || formatHierarchicalTerritoryKey(tNum));
      const polyNode: FlatSkeletonEntry = {
        key: groupKey,
        type: 'header',
        label: String(props.label || props.name || `${tNum} — ${locality}`),
        value: '',
        email: '',
        meta: {
          engine_id: 'territory_logistics',
          is_quadra: true,
          quadra_number: groupKey,
          territory_number: tNum,
          territoryNumber: tNum,
          locality,
          city: props.city || options.defaultCity || '',
          state: props.state || options.defaultState || 'SP',
          boundaryPolygon: ringLatLng,
          boundarySource: 'imported',
          bufferMeters: 0,
          lat: avgLat,
          lng: avgLng,
          worked: Number(props.worked) === 1 ? 1 : 0,
        },
      };
      nodes.push(options.privacySafeMode ? sanitizeTerritoryNodeForPrivacy(polyNode) : polyNode);
    } else if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      addressesCount++;
      const lng = Number(geom.coordinates[0]);
      const lat = Number(geom.coordinates[1]);
      const groupKey = formatHierarchicalTerritoryKey(tNum);
      if (!nodes.some((n) => n.key === groupKey)) {
        nodes.push({
          key: groupKey,
          type: 'header',
          label: `${tNum} — ${locality}`,
          value: '',
          email: '',
          meta: {
            engine_id: 'territory_logistics',
            territory_number: tNum,
            territoryNumber: tNum,
            locality,
            worked: 0,
          },
        });
      }
      const leafKey = String(props._key || `${groupKey}-${String(addressesCount).padStart(2, '0')}`);
      const label = String(props.label || props.line || props.name || `Endereço ${addressesCount}`);
      const parsedAddr = parseAddressLine(label);
      const ptNode: FlatSkeletonEntry = {
        key: leafKey,
        type: 'territory',
        label,
        value: '',
        email: '',
        meta: {
          engine_id: 'territory_logistics',
          territory_number: tNum,
          territoryNumber: tNum,
          locality,
          street: parsedAddr.street,
          number: parsedAddr.number,
          line: label,
          lat,
          lng,
          worked: Number(props.worked) === 1 ? 1 : 0,
        },
      };
      nodes.push(options.privacySafeMode ? sanitizeTerritoryNodeForPrivacy(ptNode) : ptNode);
    }
  }

  return {
    nodes,
    territoriesCount: terrSet.size,
    polygonsCount,
    addressesCount,
  };
}

export function exportCleanTerritoryNodesToGeoJson(
  cleanTerritoryNodes: FlatSkeletonEntry[],
  options: { privacySafeMode?: boolean } = {}
): string {
  const privacySafeMode = options.privacySafeMode !== false;
  const effectiveNodes = privacySafeMode
    ? cleanTerritoryNodes.map((n) => sanitizeTerritoryNodeForPrivacy(n))
    : cleanTerritoryNodes;
  const quadras = extractQuadrasFromRegistry(effectiveNodes);
  const features: any[] = [];

  for (const q of quadras) {
    if (q.boundaryPolygon && q.boundaryPolygon.length >= 3) {
      const closedLngLat = [...q.boundaryPolygon, q.boundaryPolygon[0]].map(([lat, lng]) => [
        lng,
        lat,
      ]);
      features.push({
        type: 'Feature',
        properties: {
          _key: q.key,
          label: q.label,
          territory_number: q.territoryNumber,
          locality: q.locality || '',
          worked: q.isCompleted ? 1 : 0,
          coveragePercent: q.coveragePercent,
          totalUnits: q.totalUnits,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [closedLngLat],
        },
      });
    }
    for (const st of q.streets) {
      for (const u of st.units) {
        if (typeof u.lat === 'number' && typeof u.lng === 'number') {
          features.push({
            type: 'Feature',
            properties: {
              _key: u.key,
              label: `${u.street}, ${u.numberOrComplement}`,
              territory_number: q.territoryNumber,
              locality: q.locality || '',
              worked: u.worked,
              propertyType: u.propertyType || 'residencial',
            },
            geometry: {
              type: 'Point',
              coordinates: [u.lng, u.lat],
            },
          });
        }
      }
    }
  }

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features,
    },
    null,
    2
  );
}

// ============================================================================
// 5. Unified Multi-Format Import & Export Dispatcher + Clean-Room Samples
// ============================================================================

export function detectTerritoryFileFormat(
  fileName?: string,
  contentPreview?: string
): TerritoryMultiIoFormat {
  const lowerName = String(fileName || '').trim().toLowerCase();
  if (lowerName.endsWith('.xlsx')) return 'xlsx';
  if (lowerName.endsWith('.kml')) return 'kml';
  if (lowerName.endsWith('.geojson')) return 'geojson';
  if (lowerName.endsWith('.json')) return 'json';
  if (lowerName.endsWith('.csv')) return 'csv';

  const trimmed = String(contentPreview || '').trim();
  if (trimmed.startsWith('<?xml') || trimmed.includes('<kml')) return 'kml';
  if (trimmed.startsWith('{') && trimmed.includes('"FeatureCollection"')) return 'geojson';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'csv';
}

export function importTerritoryMultiFormat(
  input: {
    bytes?: Uint8Array;
    text?: string;
    fileName?: string;
  },
  options: TerritoryMultiImportOptions = {}
): TerritoryMultiImportResult {
  const format =
    options.format ||
    (input.bytes && input.bytes.length >= 4 && input.bytes[0] === 0x50 && input.bytes[1] === 0x4b
      ? 'xlsx'
      : detectTerritoryFileFormat(input.fileName, input.text));

  const privacySafeMode = Boolean(options.privacySafeMode);

  if (format === 'xlsx') {
    if (!input.bytes) {
      throw new Error('Para importar .xlsx, forneça os bytes binários do arquivo.');
    }
    const grid = parseXlsxBytesToGrid(input.bytes);
    const res = importTerritorySpreadsheetGrid(grid, { ...options, privacySafeMode });
    return {
      format: 'xlsx',
      schemaType: res.schemaType,
      nodes: res.nodes,
      territoriesCount: res.territoriesCount,
      polygonsCount: 0,
      addressesCount: res.addressesCount,
      privacySanitized: privacySafeMode,
    };
  }

  const text =
    input.text ?? (input.bytes ? new TextDecoder('utf-8').decode(input.bytes) : '');

  if (format === 'kml') {
    const res = parseKmlToCleanTerritoryNodes(text, { ...options, privacySafeMode });
    return {
      format: 'kml',
      nodes: res.nodes,
      territoriesCount: res.territoriesCount,
      polygonsCount: res.polygonsCount,
      addressesCount: res.addressesCount,
      privacySanitized: privacySafeMode,
    };
  }

  if (format === 'geojson') {
    const res = parseGeoJsonToCleanTerritoryNodes(text, { ...options, privacySafeMode });
    return {
      format: 'geojson',
      nodes: res.nodes,
      territoriesCount: res.territoriesCount,
      polygonsCount: res.polygonsCount,
      addressesCount: res.addressesCount,
      privacySanitized: privacySafeMode,
    };
  }

  if (format === 'json') {
    const parsed = JSON.parse(text);
    if (parsed?.type === 'FeatureCollection') {
      const res = parseGeoJsonToCleanTerritoryNodes(text, { ...options, privacySafeMode });
      return {
        format: 'geojson',
        nodes: res.nodes,
        territoriesCount: res.territoriesCount,
        polygonsCount: res.polygonsCount,
        addressesCount: res.addressesCount,
        privacySanitized: privacySafeMode,
      };
    }
    const rawArr: FlatSkeletonEntry[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.nodes)
      ? parsed.nodes
      : [];
    const nodes = privacySafeMode
      ? rawArr.map((n) => sanitizeTerritoryNodeForPrivacy(n))
      : rawArr;
    return {
      format: 'json',
      nodes,
      territoriesCount: new Set(
        nodes.map((n) => String(n.meta?.territory_number || n.meta?.territoryNumber || '')).filter(Boolean)
      ).size,
      polygonsCount: nodes.filter((n) => Array.isArray(n.meta?.boundaryPolygon)).length,
      addressesCount: nodes.filter((n) => n.type !== 'header').length,
      privacySanitized: privacySafeMode,
    };
  }

  // Default: CSV
  const grid = parseCsvTextToGrid(text);
  const res = importTerritorySpreadsheetGrid(grid, { ...options, privacySafeMode });
  return {
    format: 'csv',
    schemaType: res.schemaType,
    nodes: res.nodes,
    territoriesCount: res.territoriesCount,
    polygonsCount: 0,
    addressesCount: res.addressesCount,
    privacySanitized: privacySafeMode,
  };
}

export function exportTerritoryMultiFormat(
  cleanTerritoryNodes: FlatSkeletonEntry[],
  options: TerritoryMultiExportOptions
): TerritoryMultiExportPayload {
  const privacySafeMode = options.privacySafeMode !== false; // Default TRUE per LGPD / C-25/17!
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (options.format === 'xlsx') {
    const grid = exportTerritorySpreadsheetGrid(cleanTerritoryNodes, {
      schema: options.spreadsheetSchema || 'external_18col',
      privacySafeMode,
    });
    const bytes = buildXlsxBytesFromGrid(grid, 'addresses');
    return {
      format: 'xlsx',
      fileName: `sekundo-territorios-${dateStamp}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes,
      privacySanitized: privacySafeMode,
    };
  }

  if (options.format === 'kml') {
    const text = exportCleanTerritoryNodesToKml(cleanTerritoryNodes, {
      privacySafeMode,
      includePoints: options.includeKmlPoints,
      documentName: options.documentName,
    });
    return {
      format: 'kml',
      fileName: `sekundo-territorios-${dateStamp}.kml`,
      mimeType: 'application/vnd.google-earth.kml+xml;charset=utf-8',
      text,
      privacySanitized: privacySafeMode,
    };
  }

  if (options.format === 'geojson') {
    const text = exportCleanTerritoryNodesToGeoJson(cleanTerritoryNodes, { privacySafeMode });
    return {
      format: 'geojson',
      fileName: `sekundo-territorios-${dateStamp}.geojson`,
      mimeType: 'application/geo+json;charset=utf-8',
      text,
      privacySanitized: privacySafeMode,
    };
  }

  if (options.format === 'json') {
    const effectiveNodes = privacySafeMode
      ? cleanTerritoryNodes.map((n) => sanitizeTerritoryNodeForPrivacy(n))
      : cleanTerritoryNodes;
    const text = JSON.stringify(
      {
        schema: 'sekundo.territory.clean_room.v1',
        privacySanitized: privacySafeMode,
        exportedAt: new Date().toISOString(),
        nodes: effectiveNodes,
      },
      null,
      2
    );
    return {
      format: 'json',
      fileName: `sekundo-territorios-${dateStamp}.json`,
      mimeType: 'application/json;charset=utf-8',
      text,
      privacySanitized: privacySafeMode,
    };
  }

  // CSV (either 18-col external or 19-col Sekundo model)
  if (options.spreadsheetSchema === 'external_18col') {
    const grid = exportTerritorySpreadsheetGrid(cleanTerritoryNodes, {
      schema: 'external_18col',
      privacySafeMode,
    });
    const lines = grid.map((row) =>
      row
        .map((c) => {
          const s = String(c ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(',')
    );
    return {
      format: 'csv',
      fileName: `sekundo-enderecos-18col-${dateStamp}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      text: '\uFEFF' + lines.join('\n'),
      privacySanitized: privacySafeMode,
    };
  }

  const text = buildTerritoryModelCsvText(cleanTerritoryNodes, { privacySafeMode });
  return {
    format: 'csv',
    fileName: `sekundo-territorios-modelo-${dateStamp}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    text,
    privacySanitized: privacySafeMode,
  };
}

/**
 * Generates 100% synthetic Clean-Room sample files (`xlsx_18col`, `csv_18col`, `csv_19col`, `kml_folders`, `geojson`)
 * so users can test importing and migrating from other territory systems without any real personal data.
 */
export function buildCleanRoomTerritoryImportSample(
  sampleType: 'xlsx_18col' | 'csv_18col' | 'csv_19col' | 'kml_folders' | 'geojson'
): TerritoryMultiExportPayload {
  const sampleGrid18: string[][] = [
    [...EXTERNAL_18COL_HEADERS],
    [
      'T01.01.01',
      'Setor Demo Central',
      'Rua das Acácias, 100',
      'Centro',
      'Município Exemplo',
      'SP',
      '01001-000',
      'FALSE',
      '',
      'residence',
      'valid',
      '-23.55052',
      '-46.63331',
      '1',
      'FALSE',
      '',
      'Portão lateral logístico',
      'demo',
    ],
    [
      'T01.01.01',
      'Setor Demo Central',
      'Rua das Acácias, 120',
      'Centro',
      'Município Exemplo',
      'SP',
      '01001-000',
      'FALSE',
      '',
      'business',
      'worked',
      '-23.55085',
      '-46.63365',
      '2',
      'FALSE',
      '2026-10-15',
      'Comércio térreo',
      'demo',
    ],
    [
      'T01.02.01',
      'Setor Demo Norte',
      'Avenida do Contorno, 450',
      'Jardim Botânico',
      'Município Exemplo',
      'SP',
      '01002-000',
      'FALSE',
      '',
      'residence',
      'valid',
      '-23.5489',
      '-46.6312',
      '1',
      'FALSE',
      '',
      'Esquina com Praça Central',
      'demo',
    ],
  ];

  if (sampleType === 'xlsx_18col') {
    return {
      format: 'xlsx',
      fileName: 'modelo-clean-room-18col-enderecos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: buildXlsxBytesFromGrid(sampleGrid18, 'addresses'),
      privacySanitized: true,
    };
  }

  if (sampleType === 'csv_18col') {
    const csvLines = sampleGrid18.map((r) =>
      r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')
    );
    return {
      format: 'csv',
      fileName: 'modelo-clean-room-18col-enderecos.csv',
      mimeType: 'text/csv;charset=utf-8',
      text: '\uFEFF' + csvLines.join('\n'),
      privacySanitized: true,
    };
  }

  const imported = importTerritorySpreadsheetGrid(sampleGrid18, { privacySafeMode: true });

  if (sampleType === 'csv_19col') {
    const exported19 = exportTerritoryMultiFormat(imported.nodes, {
      format: 'csv',
      spreadsheetSchema: 'sekundo_19col',
      privacySafeMode: true,
    });
    return {
      ...exported19,
      fileName: 'modelo-clean-room-19col-sekundo.csv',
    };
  }

  if (sampleType === 'kml_folders') {
    const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Modelo Clean-Room Sekundo (Folder=Bairro -> Placemark=Território)</name>
    <Folder>
      <name>Setor Demo Central</name>
      <Placemark>
        <name>T01.01.01 — Quadra Demo A (Apenas Polígono)</name>
        <description>Polígono de território sem necessidade de cadastrar casas individuais</description>
        <ExtendedData>
          <Data name="territory_number"><value>T01.01.01</value></Data>
          <Data name="locality"><value>Setor Demo Central</value></Data>
          <Data name="worked"><value>0</value></Data>
        </ExtendedData>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>-46.63420,-23.55010,0 -46.63250,-23.55010,0 -46.63250,-23.55140,0 -46.63420,-23.55140,0 -46.63420,-23.55010,0</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>
    <Folder>
      <name>Setor Demo Norte</name>
      <Placemark>
        <name>T01.02.01 — Quadra Demo B (Concluída)</name>
        <description>Polígono de território concluído</description>
        <ExtendedData>
          <Data name="territory_number"><value>T01.02.01</value></Data>
          <Data name="locality"><value>Setor Demo Norte</value></Data>
          <Data name="worked"><value>1</value></Data>
        </ExtendedData>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>-46.63210,-23.54840,0 -46.63050,-23.54840,0 -46.63050,-23.54970,0 -46.63210,-23.54970,0 -46.63210,-23.54840,0</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>
  </Document>
</kml>`;
    return {
      format: 'kml',
      fileName: 'modelo-clean-room-poligonos-bairros.kml',
      mimeType: 'application/vnd.google-earth.kml+xml;charset=utf-8',
      text: sampleKml,
      privacySanitized: true,
    };
  }

  const exportedGeoJson = exportTerritoryMultiFormat(imported.nodes, {
    format: 'geojson',
    privacySafeMode: true,
  });
  return {
    ...exportedGeoJson,
    fileName: 'modelo-clean-room-poligonos.geojson',
  };
}

// Master Plan Contract Aliases
export const importTerritoryUniversalFile = importTerritoryMultiFormat;
export const exportTerritoryUniversalFile = exportTerritoryMultiFormat;
export const importTerritoryGeoJsonToCleanNodes = parseGeoJsonToCleanTerritoryNodes;
export const exportCleanTerritoryNodesToGeoJsonText = exportCleanTerritoryNodesToGeoJson;
