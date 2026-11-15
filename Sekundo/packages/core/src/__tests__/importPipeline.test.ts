import { describe, it, expect } from 'vitest';
import {
  IMPORT_STAGE_ORDER,
  IMPORT_STAGE_LABELS_PT,
  ImportCancelledError,
  isImportCancelledError,
  detectSpreadsheetBinarySignature,
  decodeSpreadsheetBytesSmart,
  sanitizeDiagnosticSnippet,
  mapImportErrorToDiagnostics,
  buildDiagnosticReportText,
  exportOmniCsvBundle,
  importOmniCsvBundle,
  importOmniCsvBundleAsync,
  parseRawOmniCsvTable,
  parseRawOmniCsvTableAsync,
  importTerritoryMultiFormat,
  importTerritoryMultiFormatAsync,
  type ImportProgressInfo,
} from '../index';

describe('Fase 1 — Import Pipeline Contract, Smart Decoding, Diagnostics & Async Parsers', () => {
  it('defines canonical 6 stages with localized PT-BR labels', () => {
    expect(IMPORT_STAGE_ORDER).toEqual([
      'reading_file',
      'decoding',
      'parsing_rows',
      'validating',
      'saving_storage',
      'opening_table',
    ]);
    for (const st of IMPORT_STAGE_ORDER) {
      expect(typeof IMPORT_STAGE_LABELS_PT[st]).toBe('string');
      expect(IMPORT_STAGE_LABELS_PT[st].length).toBeGreaterThan(5);
    }
  });

  it('decodes UTF-8 BOM, UTF-16LE BOM, and falls back cleanly to Windows-1252 without replacement chars', () => {
    // UTF-8 BOM + PT-BR accents
    const utf8BomBytes = new Uint8Array([
      0xef, 0xbb, 0xbf,
      ...Buffer.from('Data;Descrição;Valor\n2026-10-15;Educação Básica;150,00', 'utf8'),
    ]);
    const resBom = decodeSpreadsheetBytesSmart(utf8BomBytes);
    expect(resBom.detectedEncoding).toBe('utf-8-bom');
    expect(resBom.hadReplacementChars).toBe(false);
    expect(resBom.text).toContain('Descrição');
    expect(resBom.text.charCodeAt(0)).not.toBe(0xfeff);

    // Windows-1252 raw Latin-1 / CP1252 bytes: "Descrição;Ação;€ 10"
    // ç = 0xE7, ã = 0xE3, o = 0x6F, € = 0x80
    const win1252Bytes = Buffer.from('Descri', 'ascii');
    const cp1252Full = new Uint8Array([
      ...win1252Bytes,
      0xe7, 0xe3, 0x6f, // ção
      ...Buffer.from(';A', 'ascii'),
      0xe7, 0xe3, 0x6f, // ção
      0x3b, 0x80, 0x20, 0x31, 0x30, // ;€ 10
    ]);
    const resCp1252 = decodeSpreadsheetBytesSmart(cp1252Full);
    expect(resCp1252.detectedEncoding).toBe('windows-1252');
    expect(resCp1252.hadReplacementChars).toBe(false);
    expect(resCp1252.text).toBe('Descrição;Ação;€ 10');

    // UTF-16LE BOM must NOT be classified as binary
    const utf16Text = 'Data;Valor\n2026-10-01;50';
    const utf16Payload = Buffer.from(utf16Text, 'utf16le');
    const utf16Bytes = new Uint8Array([0xff, 0xfe, ...utf16Payload]);
    const resUtf16 = decodeSpreadsheetBytesSmart(utf16Bytes);
    expect(resUtf16.binarySignature).toBeNull();
    expect(resUtf16.detectedEncoding).toBe('utf-16le');
    expect(resUtf16.text).toContain('Valor');
  });

  it('detects binary signatures (.xlsx PKZIP, legacy .xls OLE2, and .pdf)', () => {
    expect(detectSpreadsheetBinarySignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(
      'zip_or_xlsx'
    );
    expect(detectSpreadsheetBinarySignature(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).toBe(
      'ole2_xls'
    );
    expect(
      detectSpreadsheetBinarySignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))
    ).toBe('pdf');
  });

  it('maps import failures to structured actionable diagnostics with line numbers and "Como arrumar"', () => {
    const xlsxIssues = mapImportErrorToDiagnostics('Arquivo inválido', {
      fileName: 'extratos.xlsx',
      binarySignature: 'zip_or_xlsx',
      stageFailed: 'decoding',
    });
    expect(xlsxIssues[0].code).toBe('BINARY_XLSX_IN_CSV_PICKER');
    expect(xlsxIssues[0].howToFix).toContain('CSV UTF-8');

    const corruptAllowedXlsxIssues = mapImportErrorToDiagnostics('Arquivo xlsx corrompido', {
      fileName: 'corrompido.xlsx',
      binarySignature: 'zip_or_xlsx',
      allowXlsxBinary: true,
      stageFailed: 'parsing_rows',
    });
    expect(corruptAllowedXlsxIssues[0].code).toBe('UNSUPPORTED_FORMAT');
    expect(corruptAllowedXlsxIssues[0].title).toContain('inválido ou corrompido');

    const dateIssues = mapImportErrorToDiagnostics('Linha 42: data inválida encontrada', {
      fileName: 'lancamentos.csv',
      stageFailed: 'validating',
    });
    expect(dateIssues[0].code).toBe('INVALID_DATE');
    expect(dateIssues[0].lineNumber).toBe(42);
    expect(dateIssues[0].columnName).toBe('Data');

    const keyIssues = mapImportErrorToDiagnostics(
      new Error('Coluna de cabeçalho obrigatório _key ausente na planilha CSV.'),
      { fileName: 'canonico.csv' }
    );
    expect(keyIssues[0].code).toBe('MISSING_KEY_COLUMN');
    expect(keyIssues[0].columnName).toBe('_key');

    const quotaErr = Object.assign(new Error('QuotaExceededError: Storage full'), {
      name: 'StorageQuotaError',
      quotaExceeded: true,
    });
    const quotaIssues = mapImportErrorToDiagnostics(quotaErr, {
      fileName: 'grande.csv',
      stageFailed: 'saving_storage',
    });
    expect(quotaIssues[0].code).toBe('STORAGE_QUOTA_EXCEEDED');

    const headerIssues = mapImportErrorToDiagnostics(
      'Cabeçalhos inválidos. O CSV precisa conter ao menos as colunas de data ("data", "date") e valor ("valor", "amount").',
      {
        fileName: 'errado.csv',
        detectedHeaders: ['col1', 'col2'],
        stageFailed: 'validating',
      }
    );
    expect(headerIssues[0].code).toBe('MISSING_REQUIRED_COLUMNS');
    expect(headerIssues[0].explanation).toContain('col1');

    const reportText = buildDiagnosticReportText({
      fileName: 'lancamentos.csv',
      stageFailed: 'validating',
      summary: '1 erro encontrado',
      issues: dateIssues,
    });
    expect(reportText).toContain('Linha 42');
    expect(reportText).toContain('Como arrumar:');
  });

  it('maintains 100% parity between importOmniCsvBundle and importOmniCsvBundleAsync while emitting progress', async () => {
    const baseBundle = importOmniCsvBundle(exportOmniCsvBundle());
    // Expand with 600 synthetic territory cycle entries to trigger multiple async chunks
    const extraTerritoryNodes = Array.from({ length: 600 }, (_, idx) => ({
      key: `90-${String(idx + 50).padStart(3, '0')}`,
      type: 'territory' as const,
      label: `Território Sintético ${idx + 50}`,
      value: `Participante ${(idx % 8) + 1}`,
      email: '',
      meta: {
        _enginePartition: 'territory_logistics',
        territoryNumber: `T${String((idx % 20) + 1).padStart(2, '0')}.01.${String((idx % 9) + 1).padStart(2, '0')}`,
        locality: `Setor Demo ${(idx % 5) + 1}`,
      },
    }));

    const heavyCsv = exportOmniCsvBundle({
      ...baseBundle,
      territoryRegistry: [...baseBundle.territoryRegistry, ...extraTerritoryNodes],
    });

    const syncRaw = parseRawOmniCsvTable(heavyCsv);
    const syncBundle = importOmniCsvBundle(heavyCsv);

    const progressEvents: ImportProgressInfo[] = [];
    const asyncRaw = await parseRawOmniCsvTableAsync(heavyCsv, {
      chunkSize: 150,
      fileName: 'heavy-omni.csv',
    });
    const asyncBundle = await importOmniCsvBundleAsync(heavyCsv, {
      chunkSize: 150,
      fileName: 'heavy-omni.csv',
      onProgress: (p) => progressEvents.push(p),
    });

    expect(asyncRaw.headers).toEqual(syncRaw.headers);
    expect(asyncRaw.rows.length).toBe(syncRaw.rows.length);
    expect(asyncBundle.territoryRegistry.length).toBe(syncBundle.territoryRegistry.length);
    expect(asyncBundle.participants.length).toBe(syncBundle.participants.length);
    expect(asyncBundle.scheduleRegistry.length).toBe(syncBundle.scheduleRegistry.length);
    expect(progressEvents.some((e) => e.stage === 'decoding')).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'parsing_rows')).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'validating')).toBe(true);
  });

  it('cancels importOmniCsvBundleAsync gracefully via AbortController', async () => {
    const baseCsv = exportOmniCsvBundle();
    const ac = new AbortController();
    ac.abort();

    let caught: unknown;
    try {
      await importOmniCsvBundleAsync(baseCsv, { signal: ac.signal, fileName: 'cancel.csv' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ImportCancelledError);
    expect(isImportCancelledError(caught)).toBe(true);
  });

  it('decodes Windows-1252 bytes cleanly in importTerritoryMultiFormatAsync and preserves accents', async () => {
    const csvUtf =
      'Codigo;Territorio;Nome_Territorio;Quadra;Logradouro;Bairro;Cidade;Observacoes\n' +
      '01-01;T01.01.01;Setor Demo Estação;Q1;Praça da Concórdia, 100;Vila Esperança;Campinas;Observação válida\n';
    // Encode with single-byte Latin-1 / CP1252 mapping
    const cp1252Bytes = Uint8Array.from(csvUtf, (ch) => ch.charCodeAt(0) & 0xff);

    const progress: ImportProgressInfo[] = [];
    const syncRes = importTerritoryMultiFormat({ bytes: cp1252Bytes, fileName: 'cp1252.csv' });
    const asyncRes = await importTerritoryMultiFormatAsync(
      { bytes: cp1252Bytes, fileName: 'cp1252.csv' },
      { onProgress: (p) => progress.push(p) }
    );

    expect(asyncRes.nodes.length).toBe(syncRes.nodes.length);
    const joinedLabels = JSON.stringify(asyncRes.nodes);
    expect(joinedLabels).toContain('Concórdia');
    expect(joinedLabels).toContain('Esperança');
    expect(joinedLabels).not.toContain('\uFFFD');
    expect(progress.map((p) => p.stage)).toEqual(['decoding', 'parsing_rows', 'validating']);
  });

  it('maps unknown_binary, unterminated quotes, and malformed KML/GeoJSON to actionable diagnostics', () => {
    const unknownDiag = mapImportErrorToDiagnostics('Formato binário incompatível.', {
      fileName: 'arquivo-desconhecido.bin',
      binarySignature: 'unknown_binary',
    });
    expect(unknownDiag[0].code).toBe('UNSUPPORTED_FORMAT');
    expect(unknownDiag[0].howToFix.length).toBeGreaterThan(10);

    const quoteDiag = mapImportErrorToDiagnostics(
      'CSV inválido: aspas duplas (") não fechadas até o final do arquivo.',
      { fileName: 'aspas-quebradas.csv' }
    );
    expect(quoteDiag[0].code).toBe('MALFORMED_QUOTES');

    const kmlDiag = mapImportErrorToDiagnostics('KML inválido: tag <Placemark> não fechada.', {
      fileName: 'mapa.kml',
    });
    expect(kmlDiag[0].code).toBe('UNSUPPORTED_FORMAT');
  });

  it('ignores single-hash # comments safely and rejects unterminated EOF quotes in parseRawOmniCsvTable & Async', async () => {
    const onlyComments = '# Comentario sintetico 1\n# Comentario sintetico 2\n';
    expect(parseRawOmniCsvTable(onlyComments)).toEqual({
      headers: [],
      rows: [],
      presentSheets: [],
    });

    const commentedTable = '# Comentario inicial\ncol_demo,valor_demo\nAlpha,100\n# Comentario final\nBeta,200\n';
    const parsedSync = parseRawOmniCsvTable(commentedTable);
    const parsedAsync = await parseRawOmniCsvTableAsync(commentedTable);
    expect(parsedSync.headers).toEqual(['col_demo', 'valor_demo']);
    expect(parsedSync.rows).toHaveLength(2);
    expect(parsedAsync).toEqual(parsedSync);

    const unclosedQuoteCsv = 'col_demo,valor_demo\n"Texto sem fechar,123\n';
    expect(() => parseRawOmniCsvTable(unclosedQuoteCsv)).toThrow(/aspas duplas.*não fechadas/i);
    await expect(parseRawOmniCsvTableAsync(unclosedQuoteCsv)).rejects.toThrow(
      /aspas duplas.*não fechadas/i
    );
  });

  it('rejects binary .xls, PDF, unknown_binary and malformed KML/GeoJSON in importTerritoryMultiFormat & Async', async () => {
    const xlsBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(() =>
      importTerritoryMultiFormat({ bytes: xlsBytes, fileName: 'territorios.csv' })
    ).toThrow(/\.xls/i);
    await expect(
      importTerritoryMultiFormatAsync({ bytes: xlsBytes, fileName: 'territorios.csv' })
    ).rejects.toThrow(/\.xls/i);

    const pdfBytes = Uint8Array.from(Buffer.from('%PDF-1.7\n1 0 obj\n', 'utf8'));
    await expect(
      importTerritoryMultiFormatAsync({ bytes: pdfBytes, fileName: 'relatorio.pdf' })
    ).rejects.toThrow(/PDF/i);

    const binaryGarbage = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x10]);
    expect(() =>
      importTerritoryMultiFormat({ bytes: binaryGarbage, fileName: 'lixo.csv' })
    ).toThrow(/binário incompatível/i);

    expect(() =>
      importTerritoryMultiFormat({ text: 'texto arbitrario sem tags xml', fileName: 'quebrado.kml' })
    ).toThrow(/KML inválido/i);
    expect(() =>
      importTerritoryMultiFormat({ text: '{ invalido', fileName: 'quebrado.geojson' })
    ).toThrow(/GeoJSON inválido/i);
    expect(() =>
      importTerritoryMultiFormat({ text: '{"notGeo":true}', fileName: 'objeto.geojson' })
    ).toThrow(/GeoJSON inválido/i);
  });

  it('aborts parseRawOmniCsvTableAsync and importTerritoryMultiFormatAsync cleanly when AbortSignal is aborted', async () => {
    const ac = new AbortController();
    ac.abort();

    await expect(
      parseRawOmniCsvTableAsync('a,b\n1,2\n', { signal: ac.signal })
    ).rejects.toBeInstanceOf(ImportCancelledError);

    await expect(
      importTerritoryMultiFormatAsync(
        {
          text: 'Codigo;Territorio;Logradouro\n01;T01.01.01;Rua Exemplo, 10',
          fileName: 't.csv',
        },
        { signal: ac.signal }
      )
    ).rejects.toBeInstanceOf(ImportCancelledError);
  });

  it('sanitizes CWE-1236 formulas, XSS vectors, bidi controls, and PII in diagnostic snippets and reports', () => {
    const formula = sanitizeDiagnosticSnippet('=cmd|\'/C calc\'!A0\n+SUM(A1:A2)', {
      neutralizeFormulas: true,
    });
    expect(formula.startsWith("'=cmd")).toBe(true);
    expect(formula).toContain("\n'+SUM(A1:A2)");

    const cleanText = sanitizeDiagnosticSnippet('Coluna Valor na Linha 42', {
      neutralizeFormulas: true,
    });
    expect(cleanText).toBe('Coluna Valor na Linha 42');

    const unsafeSnippet = sanitizeDiagnosticSnippet(
      '\u202E<script>alert(1)</script> javascript:void(0) onerror=hack() contato audit-tester@empresa-exemplo.com cpf 000.111.222-33 tel (11) 90000-1111 Bearer synth_tok_1234567890 chave am_live_synth9988776677 placeholder am_sheet_example_fictitious',
      { maxLength: 600 }
    );
    expect(unsafeSnippet).not.toContain('\u202E');
    expect(unsafeSnippet).not.toContain('<script>');
    expect(unsafeSnippet).toContain('[SCRIPT REMOVIDO]');
    expect(unsafeSnippet).toContain('javascript_blocked:');
    expect(unsafeSnippet).toContain('on_attr_blocked=');
    expect(unsafeSnippet).toContain('[EMAIL REDIGIDO]');
    expect(unsafeSnippet).toContain('[CPF REDIGIDO]');
    expect(unsafeSnippet).toContain('[TELEFONE REDIGIDO]');
    expect(unsafeSnippet).toContain('Bearer [TOKEN_REDIGIDO]');
    expect(unsafeSnippet).toContain('[CHAVE_REDIGIDA]');
    expect(unsafeSnippet).toContain('am_sheet_example_fictitious');

    const report = buildDiagnosticReportText({
      fileName: 'arquivo\u202E<script>x</script>.csv',
      stageFailed: 'parsing_rows',
      summary: 'Erro ao ler audit-tester@empresa-exemplo.com',
      issues: [
        {
          code: 'PARSE_ROW_MALFORMED',
          severity: 'error',
          title: 'Linha malformada',
          explanation: 'Verifique separador e delimitadores.',
          howToFix: 'Reexporte em UTF-8.',
          rowNumber: 3,
          rawSample: '=1+1;audit-tester@empresa-exemplo.com',
        },
      ],
      rawErrorText: '+CMD_SAMPLE am_live_synth1234567890',
    });
    expect(report).toContain('[SCRIPT REMOVIDO]');
    expect(report).toContain('[EMAIL REDIGIDO]');
    expect(report).toContain("Trecho: '=1+1;[EMAIL REDIGIDO]");
    expect(report).toContain("Detalhe técnico bruto: '+CMD_SAMPLE [CHAVE_REDIGIDA]");
  });
});
