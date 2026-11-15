/**
 * Assistente Moeda (@sekundo/coin-engine) — Import Pipeline Contract & Diagnostics
 *
 * Self-contained state machine, smart encoding decoder (UTF-8 / Windows-1252),
 * binary signature detector (.xlsx / .xls / .pdf), frame/event-loop yielding,
 * and actionable PT-BR diagnostic builder ("Como arrumar").
 *
 * Kept structurally compatible with `@sekundo/core`'s `importPipeline.ts` so
 * `@sekundo/app` and `@sekundo/coin-engine` share a single unified UX contract.
 */

export type ImportStage =
  | 'reading_file'
  | 'decoding'
  | 'parsing_rows'
  | 'validating'
  | 'saving_storage'
  | 'opening_table';

export const IMPORT_STAGE_ORDER: readonly ImportStage[] = [
  'reading_file',
  'decoding',
  'parsing_rows',
  'validating',
  'saving_storage',
  'opening_table',
] as const;

export const IMPORT_STAGE_LABELS_PT: Record<ImportStage, string> = {
  reading_file: 'Lendo arquivo selecionado...',
  decoding: 'Verificando formato e codificação...',
  parsing_rows: 'Processando linhas da planilha...',
  validating: 'Validando colunas, datas e valores...',
  saving_storage: 'Gravando planilha no cofre local...',
  opening_table: 'Preparando e abrindo planilha...',
};

export type ImportDiagnosticCode =
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'BINARY_XLSX_IN_CSV_PICKER'
  | 'LEGACY_XLS_BINARY'
  | 'PDF_IN_SPREADSHEET_PICKER'
  | 'ENCODING_CORRUPTED'
  | 'ENCODING_WINDOWS_1252_AUTO'
  | 'MISSING_REQUIRED_COLUMNS'
  | 'MISSING_KEY_COLUMN'
  | 'INVALID_DATE'
  | 'INVALID_AMOUNT'
  | 'MALFORMED_QUOTES'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_WRITE_FAILED'
  | 'FILE_READ_FAILED'
  | 'CANCELLED'
  | 'PARTIAL_ROWS_SKIPPED'
  | 'UNKNOWN_IMPORT_ERROR';

export interface ImportDiagnosticIssue {
  code: ImportDiagnosticCode;
  severity: 'error' | 'warning';
  title: string;
  explanation: string;
  howToFix: string;
  lineNumber?: number;
  columnName?: string;
  rawSample?: string;
}

export interface ImportProgressInfo {
  stage: ImportStage;
  stageLabel: string;
  detailLabel?: string;
  processedCount?: number;
  totalCount?: number;
  percent?: number;
  cancellable: boolean;
  fileName?: string;
  sizeBytes?: number;
}

export type ImportPipelineState<T = unknown> =
  | { status: 'idle' }
  | {
      status: 'running';
      requestId: number;
      fileName: string;
      sizeBytes?: number;
      startedAt: number;
      progress: ImportProgressInfo;
    }
  | {
      status: 'warning_review';
      requestId: number;
      fileName: string;
      summary: string;
      validCount: number;
      skippedCount: number;
      issues: ImportDiagnosticIssue[];
      result?: T;
    }
  | {
      status: 'error';
      requestId: number;
      fileName: string;
      stageFailed: ImportStage;
      summary: string;
      issues: ImportDiagnosticIssue[];
      rawErrorText?: string;
    }
  | {
      status: 'success';
      requestId: number;
      fileName: string;
      summary: string;
      warnings: ImportDiagnosticIssue[];
      result?: T;
    };

export interface AsyncImportControllerOptions {
  onProgress?: (progress: ImportProgressInfo) => void;
  signal?: AbortSignal;
  chunkSize?: number;
  fileName?: string;
  sizeBytes?: number;
}

export type BinarySpreadsheetSignature =
  | 'zip_or_xlsx'
  | 'ole2_xls'
  | 'pdf'
  | 'unknown_binary'
  | null;

export interface SmartDecodedSpreadsheetResult {
  text: string;
  detectedEncoding: 'utf-8' | 'utf-8-bom' | 'windows-1252' | 'utf-16le' | 'utf-16be';
  hadReplacementChars: boolean;
  binarySignature: BinarySpreadsheetSignature;
}

export class ImportCancelledError extends Error {
  readonly code = 'ABORT_ERR';
  constructor(message = 'Importação cancelada pelo usuário.') {
    super(message);
    this.name = 'ImportCancelledError';
  }
}

export function isImportCancelledError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { name?: string; code?: string };
  return (
    err instanceof ImportCancelledError ||
    anyErr.name === 'ImportCancelledError' ||
    anyErr.name === 'AbortError' ||
    anyErr.code === 'ABORT_ERR'
  );
}

export function throwIfImportAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ImportCancelledError();
  }
}

export async function yieldToUiFrame(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.requestAnimationFrame === 'function' && typeof g.document !== 'undefined') {
    const raf = g.requestAnimationFrame as (cb: () => void) => number;
    await Promise.race([
      new Promise<void>((resolve) => {
        raf(() => {
          raf(() => resolve());
        });
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 40)),
    ]);
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export function formatByteSize(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function detectSpreadsheetBinarySignature(bytes: Uint8Array): BinarySpreadsheetSignature {
  if (!bytes || bytes.length === 0) return null;

  if (
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
  ) {
    return null;
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  ) {
    return 'zip_or_xlsx';
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return 'ole2_xls';
  }

  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'pdf';
  }

  const limit = Math.min(bytes.length, 2048);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0x00) {
      return 'unknown_binary';
    }
  }

  return null;
}

const CP1252_EXTRA_MAP: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

function decodeWindows1252Fallback(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      // Fallback
    }
  }
  const chunks: string[] = [];
  const blockSize = 8192;
  for (let start = 0; start < bytes.length; start += blockSize) {
    const end = Math.min(start + blockSize, bytes.length);
    const codes: number[] = new Array(end - start);
    for (let i = start; i < end; i++) {
      const b = bytes[i];
      codes[i - start] = CP1252_EXTRA_MAP[b] ?? b;
    }
    chunks.push(String.fromCharCode(...codes));
  }
  return chunks.join('');
}

export function decodeSpreadsheetBytesSmart(
  input: ArrayBuffer | Uint8Array
): SmartDecodedSpreadsheetResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const binarySignature = detectSpreadsheetBinarySignature(bytes);

  if (bytes.length === 0) {
    return {
      text: '',
      detectedEncoding: 'utf-8',
      hadReplacementChars: false,
      binarySignature: null,
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe && typeof TextDecoder !== 'undefined') {
    try {
      const text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
      return {
        text,
        detectedEncoding: 'utf-16le',
        hadReplacementChars: text.includes('\uFFFD'),
        binarySignature: null,
      };
    } catch {
      // fall through
    }
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff && typeof TextDecoder !== 'undefined') {
    try {
      const text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
      return {
        text,
        detectedEncoding: 'utf-16be',
        hadReplacementChars: text.includes('\uFFFD'),
        binarySignature: null,
      };
    } catch {
      // fall through
    }
  }

  const hasUtf8Bom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const payload = hasUtf8Bom ? bytes.subarray(3) : bytes;

  if (typeof TextDecoder !== 'undefined') {
    try {
      const strictUtf8 = new TextDecoder('utf-8', { fatal: true }).decode(payload);
      return {
        text: strictUtf8,
        detectedEncoding: hasUtf8Bom ? 'utf-8-bom' : 'utf-8',
        hadReplacementChars: strictUtf8.includes('\uFFFD'),
        binarySignature,
      };
    } catch {
      const cp1252Text = decodeWindows1252Fallback(payload);
      return {
        text: cp1252Text,
        detectedEncoding: 'windows-1252',
        hadReplacementChars: cp1252Text.includes('\uFFFD'),
        binarySignature,
      };
    }
  }

  const fallbackText = decodeWindows1252Fallback(payload);
  return {
    text: fallbackText,
    detectedEncoding: 'windows-1252',
    hadReplacementChars: fallbackText.includes('\uFFFD'),
    binarySignature,
  };
}

export function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  const g = globalThis as Record<string, unknown>;
  if (typeof g.atob === 'function') {
    const binStr = (g.atob as (s: string) => string)(clean);
    const out = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      out[i] = binStr.charCodeAt(i);
    }
    return out;
  }
  const Buf = g.Buffer as
    | { from: (data: string, encoding: string) => Uint8Array }
    | undefined;
  if (Buf) {
    return new Uint8Array(Buf.from(clean, 'base64'));
  }
  throw new Error('Base64 decoder indisponível neste ambiente.');
}

function extractLineNumberFromMessage(msg: string): number | undefined {
  const match =
    /(?:linha|line|row)\s*[:#]?\s*(\d+)/i.exec(msg) ||
    /\[(?:linha|line)\s*(\d+)\]/i.exec(msg);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export interface DiagnosticMappingContext {
  fileName?: string;
  binarySignature?: BinarySpreadsheetSignature;
  allowXlsxBinary?: boolean;
  detectedHeaders?: string[];
  detectedEncoding?: string;
  stageFailed?: ImportStage;
}

export function mapImportErrorToDiagnostics(
  errorOrMessages: unknown,
  context: DiagnosticMappingContext = {}
): ImportDiagnosticIssue[] {
  const fileName = context.fileName || 'planilha.csv';
  const extMatch = /\.([a-z0-9]+)$/i.exec(fileName);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  if (isImportCancelledError(errorOrMessages)) {
    return [
      {
        code: 'CANCELLED',
        severity: 'warning',
        title: 'Importação cancelada',
        explanation: `A importação de "${fileName}" foi cancelada antes de salvar alterações.`,
        howToFix: 'Você pode selecionar a planilha novamente quando estiver pronto.',
      },
    ];
  }

  if (context.binarySignature === 'zip_or_xlsx' || ext === 'xlsx') {
    const rawMsg =
      errorOrMessages instanceof Error ? errorOrMessages.message : String(errorOrMessages || '');
    if (context.allowXlsxBinary) {
      if (!rawMsg || /cabeçalho|header|colunas|zip|xlsx|formato|vazio|inválid|corromp/i.test(rawMsg)) {
        return [
          {
            code: 'UNSUPPORTED_FORMAT',
            severity: 'error',
            title: 'Arquivo Excel (.xlsx) inválido ou corrompido',
            explanation: rawMsg
              ? `Não foi possível ler a estrutura interna de "${fileName}": ${sanitizeDiagnosticSnippet(rawMsg)}`
              : `O arquivo "${fileName}" possui assinatura ZIP/.xlsx, mas não contém planilhas válidas legíveis.`,
            howToFix:
              'Abra a planilha no Excel, LibreOffice ou Google Sheets, salve novamente como ".xlsx" válido ou ".csv (UTF-8)" e tente importar outra vez.',
          },
        ];
      }
    } else if (!rawMsg || /cabeçalho|header|colunas|zip|xlsx|formato|vazio|inválid/i.test(rawMsg)) {
      return [
        {
          code: 'BINARY_XLSX_IN_CSV_PICKER',
          severity: 'error',
          title: 'Arquivo Excel (.xlsx) enviado em importador somente CSV',
          explanation: `O arquivo "${fileName}" tem estrutura binária .xlsx/ZIP, não texto CSV.`,
          howToFix:
            'No Excel, LibreOffice ou Google Sheets, escolha "Salvar como" -> "CSV UTF-8 (delimitado por vírgulas ou ponto-e-vírgula)", ou utilize a Estação Multi-Formato do Sekundo para importar .xlsx diretamente.',
        },
      ];
    }
  }

  if (context.binarySignature === 'ole2_xls' || ext === 'xls') {
    return [
      {
        code: 'LEGACY_XLS_BINARY',
        severity: 'error',
        title: 'Formato legado Excel 97-2003 (.xls) não suportado',
        explanation: `O arquivo "${fileName}" usa o formato binário antigo (.xls).`,
        howToFix:
          'Abra o arquivo no Excel/LibreOffice e salve como ".csv (UTF-8)" antes de importar.',
      },
    ];
  }

  if (context.binarySignature === 'pdf' || ext === 'pdf') {
    return [
      {
        code: 'PDF_IN_SPREADSHEET_PICKER',
        severity: 'error',
        title: 'Documento PDF enviado no importador de planilha',
        explanation: `"${fileName}" é um PDF, e não um arquivo CSV tabular.`,
        howToFix: 'Exporte os dados do seu banco/sistema como ".csv" antes de importar aqui.',
      },
    ];
  }

  if (context.binarySignature === 'unknown_binary') {
    return [
      {
        code: 'UNSUPPORTED_FORMAT',
        severity: 'error',
        title: 'Arquivo binário ou corrompido não suportado como planilha CSV',
        explanation: `O arquivo "${fileName}" contém bytes binários incompatíveis ou estrutura corrompida, não podendo ser lido como CSV de texto.`,
        howToFix:
          'Abra os dados no aplicativo de origem e exporte novamente em ".csv (UTF-8)" sem criptografia ou senha.',
      },
    ];
  }

  const messages: string[] = Array.isArray(errorOrMessages)
    ? errorOrMessages.map((m) => String(m)).filter(Boolean)
    : [
        errorOrMessages instanceof Error
          ? errorOrMessages.message
          : typeof errorOrMessages === 'string'
            ? errorOrMessages
            : JSON.stringify(errorOrMessages ?? 'Erro desconhecido'),
      ].filter(Boolean);

  if (messages.length === 0) {
    messages.push('Erro desconhecido ao processar a planilha.');
  }

  const anyErrObj =
    errorOrMessages && typeof errorOrMessages === 'object'
      ? (errorOrMessages as { name?: string; quotaExceeded?: boolean })
      : undefined;

  if (
    anyErrObj?.quotaExceeded === true ||
    anyErrObj?.name === 'StorageQuotaError' ||
    messages.some((m) => /QuotaExceeded|NS_ERROR_DOM_QUOTA|cota de armazenamento|storage full/i.test(m))
  ) {
    return [
      {
        code: 'STORAGE_QUOTA_EXCEEDED',
        severity: 'error',
        title: 'Espaço local cheio (Quota de armazenamento excedida)',
        explanation:
          'O navegador ou aparelho atingiu o limite de armazenamento local ao tentar salvar os novos dados. Sua planilha anterior permanece intacta.',
        howToFix:
          'Exporte um backup CSV de segurança, exclua planilhas antigas na lixeira para liberar espaço ou importe os registros divididos em arquivos menores.',
      },
    ];
  }

  if (
    anyErrObj?.name === 'StorageWriteError' ||
    messages.some((m) => /falha ao gravar|failed to write DB|IndexedDB/i.test(m))
  ) {
    return [
      {
        code: 'STORAGE_WRITE_FAILED',
        severity: 'error',
        title: 'Falha ao salvar no armazenamento local',
        explanation: messages.join(' '),
        howToFix:
          'Verifique se o navegador não está bloqueando armazenamento local (aba anônima restrita) e tente novamente.',
      },
    ];
  }

  return messages.map((msg) => {
    const lineNumber = extractLineNumberFromMessage(msg);
    if (/vazio|empty|nenhuma linha de (?:transação|dados)|sem linhas/i.test(msg)) {
      return {
        code: 'EMPTY_FILE',
        severity: 'error',
        title: 'Planilha vazia ou sem linhas válidas',
        explanation: msg,
        howToFix: 'Adicione um cabeçalho (ex.: Data;Descrição;Valor) e pelo menos 1 linha de dados.',
        lineNumber,
      };
    }
    if (
      /cabeçalhos?\s*(?:inválid|ausent)|precisa conter ao menos as colunas|Data e Valor|nenhuma linha válida|colunas mínimas|colunas obrigatórias/i.test(
        msg
      )
    ) {
      const headersNote =
        context.detectedHeaders && context.detectedHeaders.length > 0
          ? ` Cabeçalhos lidos: [${context.detectedHeaders.join(', ')}].`
          : '';
      return {
        code: 'MISSING_REQUIRED_COLUMNS',
        severity: 'error',
        title: 'Colunas obrigatórias não encontradas (Data e/ou Valor)',
        explanation: `${msg}${headersNote}`,
        howToFix:
          'Inclua colunas nomeadas como "Data" (ou "date") e "Valor" (ou "amount" / "value") na linha de cabeçalho, separadas por ";" ou ",".',
        lineNumber: lineNumber ?? 1,
      };
    }
    if (/aspas[^.\n]{0,20}não fechad|unterminated quote|malformed/i.test(msg)) {
      return {
        code: 'MALFORMED_QUOTES',
        severity: 'error',
        title: 'Aspas ou quebra de linha malformada no CSV',
        explanation: msg,
        howToFix:
          'Verifique aspas duplas (") abertas e não fechadas próximas à linha indicada. Re-salvar pelo Excel ou LibreOffice em CSV UTF-8 corrige a formatação.',
        lineNumber,
      };
    }
    if (/data inválid|invalid date|formato de data/i.test(msg)) {
      return {
        code: 'INVALID_DATE',
        severity: 'error',
        title: 'Data em formato não reconhecido',
        explanation: msg,
        howToFix: 'Padronize a coluna de data como DD/MM/AAAA (ex.: 20/10/2026) ou YYYY-MM-DD.',
        lineNumber,
        columnName: 'Data',
      };
    }
    if (/valor (?:numérico )?inválid|invalid amount|amount inválid|\bNaN\b|numéric/i.test(msg)) {
      return {
        code: 'INVALID_AMOUNT',
        severity: 'error',
        title: 'Valor numérico inválido',
        explanation: msg,
        howToFix: 'Garanta apenas números válidos na coluna Valor (ex.: 1.250,50 ou 1250.50).',
        lineNumber,
        columnName: 'Valor',
      };
    }
    if (/Formato de arquivo não suportado|extensão|binário incompatível|KML inválido|GeoJSON inválido|JSON inválido|ZIP/i.test(msg)) {
      return {
        code: 'UNSUPPORTED_FORMAT',
        severity: 'error',
        title: 'Formato ou estrutura do arquivo inválida',
        explanation: msg,
        howToFix:
          'Confira se o arquivo realmente está em formato CSV UTF-8 tabular e se não está corrompido ou protegido por senha.',
        lineNumber,
      };
    }
    if (/ler arquivo|readAsString|Permission|NotReadableError/i.test(msg)) {
      return {
        code: 'FILE_READ_FAILED',
        severity: 'error',
        title: 'Não foi possível ler o arquivo',
        explanation: msg,
        howToFix:
          'Feche o arquivo em outros programas caso esteja bloqueado e selecione-o novamente.',
      };
    }
    return {
      code: 'UNKNOWN_IMPORT_ERROR',
      severity: 'error',
      title: 'Falha ao processar a planilha',
      explanation: msg,
      howToFix: 'Confira a linha indicada e copie o diagnóstico completo caso precise revisar o CSV.',
      lineNumber,
    };
  });
}

/**
 * Sanitizes raw diagnostic snippets, cell samples, filenames, and error details against:
 *  - Unicode Bidi overrides / ASCII control characters
 *  - Active HTML/script vectors when pasted into rich ticket viewers
 *  - Accidental PII / credential leaks (email, CPF, phones, bearer/API keys)
 *  - CWE-1236 spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
 */
export function sanitizeDiagnosticSnippet(
  value: unknown,
  options?: { maxLength?: number; neutralizeFormulas?: boolean }
): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (!text) return '';

  text = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

  text = text
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '[SCRIPT REMOVIDO]')
    .replace(/<\/?\s*(?:script|iframe|object|embed)\b[^>]*>/gi, '[TAG REMOVIDA]')
    .replace(/\bjavascript\s*:/gi, 'javascript_blocked:')
    .replace(/\bon[a-z]{2,18}\s*=\s*/gi, 'on_attr_blocked=');

  text = text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDIGIDO]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF REDIGIDO]')
    .replace(/(?:\+55\s*)?(?:\(?\d{2}\)?\s*)(?:9\d{4}|\d{4})-\d{4}\b/g, '[TELEFONE REDIGIDO]')
    .replace(/\bBearer\s+[A-Za-z0-9._\-]{12,}\b/gi, 'Bearer [TOKEN_REDIGIDO]')
    .replace(/\bam_(?:live|sheet)_(?!example_fictitious\b|live_local\b)[A-Za-z0-9_\-]{8,}\b/g, '[CHAVE_REDIGIDA]');

  if (options?.neutralizeFormulas) {
    text = text
      .split(/\r?\n/)
      .map((line) => (/^[=+\-@\t\r]/.test(line) ? `'${line}` : line))
      .join('\n');
  }

  const maxLength = options?.maxLength ?? 240;
  if (text.length > maxLength) {
    text = `${text.slice(0, Math.max(0, maxLength - 3))}...`;
  }
  return text.trim();
}

export function buildDiagnosticReportText(params: {
  fileName: string;
  stageFailed?: ImportStage;
  summary: string;
  issues: ImportDiagnosticIssue[];
  rawErrorText?: string;
}): string {
  const safeFileName = sanitizeDiagnosticSnippet(params.fileName, {
    maxLength: 160,
    neutralizeFormulas: false,
  });
  const safeSummary = sanitizeDiagnosticSnippet(params.summary, {
    maxLength: 400,
    neutralizeFormulas: false,
  });
  const lines: string[] = [
    '=== Diagnóstico de Importação Sekundo ===',
    `Arquivo: ${safeFileName}`,
    ...(params.stageFailed
      ? [`Etapa: ${IMPORT_STAGE_LABELS_PT[params.stageFailed] || params.stageFailed}`]
      : []),
    `Resumo: ${safeSummary}`,
    '',
    'Detalhes:',
  ];

  params.issues.forEach((issue, idx) => {
    const locParts: string[] = [];
    if (issue.lineNumber) locParts.push(`Linha ${issue.lineNumber}`);
    if (issue.columnName) {
      locParts.push(
        `Coluna "${sanitizeDiagnosticSnippet(issue.columnName, { maxLength: 60, neutralizeFormulas: false })}"`
      );
    }
    const locSuffix = locParts.length > 0 ? ` (${locParts.join(', ')})` : '';
    const safeTitle = sanitizeDiagnosticSnippet(issue.title, {
      maxLength: 140,
      neutralizeFormulas: false,
    });
    const safeExplanation = sanitizeDiagnosticSnippet(issue.explanation, {
      maxLength: 500,
      neutralizeFormulas: false,
    });
    const safeFix = sanitizeDiagnosticSnippet(issue.howToFix, {
      maxLength: 500,
      neutralizeFormulas: false,
    });
    lines.push(`${idx + 1}. [${issue.severity.toUpperCase()} | ${issue.code}] ${safeTitle}${locSuffix}`);
    lines.push(`   O que ocorreu: ${safeExplanation}`);
    lines.push(`   Como arrumar: ${safeFix}`);
    if (issue.rawSample) {
      lines.push(
        `   Trecho: ${sanitizeDiagnosticSnippet(issue.rawSample, { maxLength: 240, neutralizeFormulas: true })}`
      );
    }
  });

  if (params.rawErrorText) {
    lines.push('');
    lines.push(
      `Detalhe técnico bruto: ${sanitizeDiagnosticSnippet(params.rawErrorText, { maxLength: 600, neutralizeFormulas: true })}`
    );
  }

  return lines.join('\n');
}
