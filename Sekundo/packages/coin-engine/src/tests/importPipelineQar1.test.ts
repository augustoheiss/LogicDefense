/**
 * QAR1 Import Pipeline Contract, Smart Decoding, Cooperative Async Chunking & Storage Quota Tests
 *
 * Strictly uses 100% synthetic clean-room fixtures.
 * Note: custom runner supports assertions via `expect(...).toBe/.toEqual/.toContain` and `try/catch`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearDB,
  loadDB,
  saveDB,
  saveDBWithResult,
  saveDBOrThrow,
  StorageQuotaError,
} from '../storage/asyncStorageAdapter';
import {
  parseCSVText,
  parseCSVTextAsync,
} from '../utils/csvEngine';
import { parseDynamicCSV, parseDynamicCSVAsync } from '../core/dynamicCsvParser';
import { parseCSVAsync } from '../services/csvImportService';
import {
  IMPORT_STAGE_ORDER,
  ImportCancelledError,
  isImportCancelledError,
  decodeSpreadsheetBytesSmart,
  detectSpreadsheetBinarySignature,
  mapImportErrorToDiagnostics,
  buildDiagnosticReportText,
  type ImportProgressInfo,
} from '../services/importPipelineContract';
import type { DB } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

describe('Fase 1 QAR1 — Import Pipeline, Smart Decoding, Async Chunking & Strict Storage Quota', () => {
  it('QAR1-IMP-01: parseCSVTextAsync produces exact row & sector parity with parseCSVText on 1,200+ rows while yielding progress', async () => {
    const header = 'Data;Descrição;Categoria;Valor;Tipo\n';
    const lines: string[] = [];
    for (let i = 1; i <= 1250; i++) {
      const day = String(((i - 1) % 28) + 1).padStart(2, '0');
      const month = String(((i - 1) % 12) + 1).padStart(2, '0');
      const amount = ((i * 13.75) % 900 + 10).toFixed(2).replace('.', ',');
      lines.push(`${day}/${month}/2026;Lançamento Sintético ${i};Operacional;${amount};${i % 3 === 0 ? 'Receita' : 'Despesa'}`);
    }
    const syntheticCsv = header + lines.join('\n');

    const syncRes = parseCSVText(syntheticCsv);
    const progressEvents: ImportProgressInfo[] = [];
    const asyncRes = await parseCSVTextAsync(
      syntheticCsv,
      undefined,
      {
        chunkSize: 200,
        fileName: 'sintetico-1250.csv',
        onProgress: (p) => progressEvents.push(p),
      }
    );

    expect(asyncRes.rows.length).toBe(1250);
    expect(asyncRes.rows.length).toBe(syncRes.rows.length);
    expect(asyncRes.errors.length).toBe(syncRes.errors.length);
    expect(asyncRes.detectedSectors).toEqual(syncRes.detectedSectors);
    expect(asyncRes.rows[0].description).toBe('Lançamento Sintético 1');
    expect(asyncRes.rows[1249].description).toBe('Lançamento Sintético 1250');

    expect(progressEvents.some((e) => e.stage === 'decoding')).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'parsing_rows' && (e.processedCount || 0) >= 200)).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'validating')).toBe(true);
  });

  it('QAR1-IMP-02: parseCSVTextAsync aborts mid-flight cleanly when AbortController aborts', async () => {
    const header = 'Data;Descrição;Valor\n';
    const rows = Array.from({ length: 800 }, (_, i) => `10/10/2026;Item ${i};${i + 1},00`).join('\n');
    const ac = new AbortController();
    let caught: unknown;

    try {
      await parseCSVTextAsync(header + rows, undefined, {
        chunkSize: 100,
        fileName: 'abort-mid.csv',
        signal: ac.signal,
        onProgress: (p) => {
          if (p.stage === 'parsing_rows' && (p.processedCount || 0) >= 200) {
            ac.abort();
          }
        },
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught instanceof ImportCancelledError || isImportCancelledError(caught)).toBe(true);
  });

  it('QAR1-IMP-03: decodeSpreadsheetBytesSmart handles UTF-8 BOM, Windows-1252 and binary .xlsx/.pdf signatures', () => {
    // Windows-1252: "Descrição;Ação;12,50" -> ç = 0xE7, ã = 0xE3
    const winBytes = new Uint8Array([
      68, 101, 115, 99, 114, 105, 0xe7, 0xe3, 111, 59, // Descrição;
      65, 0xe7, 0xe3, 111, 59, 49, 50, 44, 53, 48, // Ação;12,50
    ]);
    const decoded = decodeSpreadsheetBytesSmart(winBytes);
    expect(decoded.detectedEncoding).toBe('windows-1252');
    expect(decoded.hadReplacementChars).toBe(false);
    expect(decoded.text).toBe('Descrição;Ação;12,50');

    expect(detectSpreadsheetBinarySignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(
      'zip_or_xlsx'
    );
    expect(detectSpreadsheetBinarySignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      'pdf'
    );
  });

  it('QAR1-IMP-04: invalid CSV headers surface detectedHeaders and clear "Como arrumar" diagnostics', async () => {
    const invalidCsv = 'ColunaA;ColunaB;ColunaC\nFoo;Bar;Baz';
    const parsed = await parseCSVTextAsync(invalidCsv, undefined, { fileName: 'colunas-erradas.csv' });

    expect(parsed.rows.length).toBe(0);
    expect(parsed.detectedHeaders).toEqual(['colunaa', 'colunab', 'colunac']);

    const issues = mapImportErrorToDiagnostics(parsed.errors, {
      fileName: 'colunas-erradas.csv',
      detectedHeaders: parsed.detectedHeaders,
      stageFailed: 'validating',
    });

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe('MISSING_REQUIRED_COLUMNS');
    expect(issues[0].explanation).toContain('colunaa');
    expect(issues[0].howToFix).toContain('Data');

    const report = buildDiagnosticReportText({
      fileName: 'colunas-erradas.csv',
      stageFailed: 'validating',
      summary: 'Colunas inválidas',
      issues,
    });
    expect(report).toContain('Como arrumar:');
  });

  it('QAR1-IMP-05: saveDBWithResult & saveDBOrThrow expose QuotaExceededError explicitly while preserving prior snapshot and saveDB compat', async () => {
    await clearDB();
    const validDB: DB = {
      activeTableIndex: 0,
      isPrivacyMode: false,
      aiCostCurrentMonth: 0,
      aiCostLastReset: '2026-10',
      tables: [
        {
          id: 'tbl_imp_safe',
          name: 'Planilha Segura',
          description: 'Estado Inicial Íntegro',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
          rows: [],
          goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
          activeSectors: ['personal_finance'],
        },
      ],
    };
    await saveDB(validDB);

    const origSetItem = AsyncStorage.setItem;
    AsyncStorage.setItem = async (key: string, value: string) => {
      if (key === 'coin_assistant_db' && value.length > 5_000) {
        const err = new Error('QuotaExceededError: Storage limit exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return origSetItem(key, value);
    };

    try {
      const largeDB: DB = {
        ...validDB,
        tables: [{ ...validDB.tables[0], description: 'Z'.repeat(20_000) }],
      };

      const res = await saveDBWithResult(largeDB);
      expect(res.ok).toBe(false);
      expect(res.quotaExceeded).toBe(true);
      expect(res.error?.name).toBe('StorageQuotaError');

      let thrownErr: unknown;
      try {
        await saveDBOrThrow(largeDB);
      } catch (err) {
        thrownErr = err;
      }
      expect(thrownErr instanceof StorageQuotaError).toBe(true);

      const diags = mapImportErrorToDiagnostics(thrownErr, {
        fileName: 'grande.csv',
        stageFailed: 'saving_storage',
      });
      expect(diags[0].code).toBe('STORAGE_QUOTA_EXCEEDED');

      const survived = await loadDB();
      expect(survived?.tables[0].description).toBe('Estado Inicial Íntegro');
      expect(IMPORT_STAGE_ORDER.length).toBe(6);
    } finally {
      AsyncStorage.setItem = origSetItem;
    }
  });

  it('QAR1-IMP-06: parseCSVTextAsync & parseDynamicCSVAsync chunk Backup v3 and Multi-Partition Omni-CSV with parity and AbortController', async () => {
    // 1. Backup v3 with ## SCHEMA_COLUMNS ## and 600 synthetic rows
    const v3Header = [
      '## COIN ASSISTANT BACKUP v3 ##',
      'table_id,tbl_v3_sintetico',
      'name,Planilha V3 Sintética',
      '## SCHEMA_COLUMNS ##',
      'id;label;originalHeader;dataType;role;visible;invertSign',
      'id;ID;id;text;id;true;false',
      'date;Data;date;date;primary_date;true;false',
      'value;Valor;value;money;primary_amount;true;false',
      'description;Descrição;description;text;primary_description;true;false',
      'entryType;Tipo;entryType;text;entry_type;true;false',
      '## ROWS ##',
      'id;date;value;description;entryType',
    ].join('\n');
    const v3Rows: string[] = [];
    for (let i = 1; i <= 600; i++) {
      const day = String(((i - 1) % 28) + 1).padStart(2, '0');
      v3Rows.push(`v3-${i};2026-08-${day};${(i * 10.5).toFixed(2)};Item Sintético V3 #${i};expense`);
    }
    const v3Csv = `${v3Header}\n${v3Rows.join('\n')}`;

    const syncV3 = parseCSVText(v3Csv);
    const v3Progress: ImportProgressInfo[] = [];
    const asyncV3 = await parseCSVTextAsync(v3Csv, undefined, {
      chunkSize: 120,
      fileName: 'backup-v3.csv',
      onProgress: (p) => v3Progress.push(p),
    });

    expect(asyncV3.rows.length).toBe(600);
    expect(asyncV3.rows.length).toBe(syncV3.rows.length);
    expect(asyncV3.rows[0].description).toBe(syncV3.rows[0].description);
    expect(asyncV3.rows[599].value).toBe(syncV3.rows[599].value);
    expect(v3Progress.filter((p) => p.stage === 'parsing_rows').length).toBeGreaterThan(3);

    // Mid-flight cancel on parseDynamicCSVAsync
    const acV3 = new AbortController();
    let v3Cancelled: unknown;
    try {
      await parseDynamicCSVAsync(v3Csv, 'tbl_v3_sintetico', undefined, {
        chunkSize: 100,
        signal: acV3.signal,
        onProgress: (p) => {
          if ((p.processedCount || 0) >= 200) acV3.abort();
        },
      });
    } catch (err) {
      v3Cancelled = err;
    }
    expect(isImportCancelledError(v3Cancelled)).toBe(true);
    expect(parseDynamicCSV(v3Csv, 'tbl_v3_sintetico').rows.length).toBe(600);

    // 2. Multi-Partition Omni-CSV across two separate tableIds
    const omniLines = [
      '#PLANILHA,coin_ledger_row',
      '_container_id,_key,_type,_engines,title_or_name,primary_assignee,secondary_assignee,date_or_cycle,group_or_tier,capabilities_or_tags',
    ];
    for (let i = 1; i <= 320; i++) {
      const container = i <= 160 ? 'tbl_part_a::Conta Alfa' : 'tbl_part_b::Conta Beta';
      omniLines.push(
        `${container},omni-${i},slot,financial_ledger,Registro ${i},${(i * 5).toFixed(2)},${i % 2 === 0 ? 'revenue' : 'expense'},2026-09-10,Operacional,PIX`
      );
    }
    const omniCsv = omniLines.join('\n');
    const syncOmni = parseCSVText(omniCsv);
    const omniProgress: ImportProgressInfo[] = [];
    const asyncOmni = await parseCSVTextAsync(omniCsv, undefined, {
      chunkSize: 80,
      fileName: 'omni-multi.csv',
      onProgress: (p) => omniProgress.push(p),
    });

    expect(asyncOmni.rows.length).toBe(320);
    expect(asyncOmni.rows.length).toBe(syncOmni.rows.length);
    expect(asyncOmni.tablePartitions?.length).toBe(2);
    expect(asyncOmni.tablePartitions?.[0].rows.length).toBe(160);
    expect(asyncOmni.tablePartitions?.[1].rows.length).toBe(160);
    expect(omniProgress.filter((p) => p.stage === 'parsing_rows').length).toBeGreaterThan(2);

    const acOmni = new AbortController();
    let omniCancelled: unknown;
    try {
      await parseCSVTextAsync(omniCsv, undefined, {
        chunkSize: 80,
        signal: acOmni.signal,
        onProgress: (p) => {
          if (p.stage === 'parsing_rows') acOmni.abort();
        },
      });
    } catch (err) {
      omniCancelled = err;
    }
    expect(isImportCancelledError(omniCancelled)).toBe(true);
  });

  it('QAR1-IMP-07: handles single-hash # comments safely, enforces contract parity for unknown_binary/MALFORMED_QUOTES, and aborts parseCSVAsync', async () => {
    const commentOnly = '# apenas um comentario sintetico\n# segundo comentario\n';
    const parsedEmpty = parseCSVText(commentOnly);
    const parsedEmptyAsync = await parseCSVTextAsync(commentOnly);
    expect(parsedEmpty.rows.length).toBe(0);
    expect(parsedEmptyAsync.rows.length).toBe(0);
    expect(mapImportErrorToDiagnostics(parsedEmpty.errors)[0].code).toBe('EMPTY_FILE');

    const withComments = [
      '# Gerado sinteticamente',
      'Data;Descrição;Categoria;Valor;Tipo',
      '# Linha comentada no meio',
      '2026-10-12;Lançamento Comentado;Servicos;240,50;Despesa',
    ].join('\n');
    const parsedValid = await parseCSVTextAsync(withComments);
    expect(parsedValid.rows.length).toBe(1);
    expect(parsedValid.rows[0].value).toBe(240.5);

    const unknownDiag = mapImportErrorToDiagnostics('Formato binário incompatível.', {
      fileName: 'binario.csv',
      binarySignature: 'unknown_binary',
    });
    expect(unknownDiag[0].code).toBe('UNSUPPORTED_FORMAT');

    const quoteDiag = mapImportErrorToDiagnostics(
      'CSV inválido: aspas duplas (") não fechadas até o final do arquivo.'
    );
    expect(quoteDiag[0].code).toBe('MALFORMED_QUOTES');

    const kmlDiag = mapImportErrorToDiagnostics('KML inválido: estrutura XML inválida.');
    expect(kmlDiag[0].code).toBe('UNSUPPORTED_FORMAT');

    const acService = new AbortController();
    acService.abort();
    let serviceCancelled: unknown;
    try {
      await parseCSVAsync('Data;Valor\n2026-10-01;10,00', { signal: acService.signal });
    } catch (err) {
      serviceCancelled = err;
    }
    expect(serviceCancelled instanceof ImportCancelledError).toBe(true);
  });
});
