/**
 * Hook & Shared Reader: useSekundoImportPipeline (@sekundo/app)
 *
 * Centralizes background loading overlays, AbortController cancellation,
 * smart byte/encoding decoding (`decodeSpreadsheetBytesSmart`), binary signature
 * validation (`.xlsx`, `.xls`, `.pdf`, `unknown_binary`), monotonic `requestId`
 * concurrency safety, and structured PT-BR error diagnostics ("O que aconteceu" /
 * "Como arrumar") across ALL Sekundo import entry points.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  IMPORT_STAGE_LABELS_PT,
  ImportCancelledError,
  buildDiagnosticReportText,
  decodeSpreadsheetBytesSmart,
  detectSpreadsheetBinarySignature,
  isImportCancelledError,
  mapImportErrorToDiagnostics,
  sanitizeDiagnosticSnippet,
  throwIfImportAborted,
  yieldToUiFrame,
  type BinarySpreadsheetSignature,
  type DiagnosticMappingContext,
  type ImportDiagnosticIssue,
  type ImportPipelineState,
  type ImportProgressInfo,
  type ImportStage,
  type SmartDecodedSpreadsheetResult,
} from '@sekundo/core';

const PROGRESS_THROTTLE_MS = 50;

export const SEKUNDO_NON_CANCELLABLE_STAGES: ReadonlySet<ImportStage> = new Set<ImportStage>([
  'saving_storage',
  'opening_table',
]);

export function sanitizeSekundoProgress(progress: ImportProgressInfo): ImportProgressInfo {
  const locked = SEKUNDO_NON_CANCELLABLE_STAGES.has(progress.stage);
  return {
    ...progress,
    stageLabel: progress.stageLabel || IMPORT_STAGE_LABELS_PT[progress.stage],
    cancellable: locked ? false : Boolean(progress.cancellable),
  };
}

export interface PickedBrowserSpreadsheetFile {
  fileName: string;
  sizeBytes: number;
  bytes: Uint8Array;
  decoded: SmartDecodedSpreadsheetResult;
  binarySignature: BinarySpreadsheetSignature;
}

export type BrowserFilePickOutcome =
  | { kind: 'cancelled' }
  | { kind: 'ok'; file: PickedBrowserSpreadsheetFile }
  | { kind: 'error'; fileName: string; sizeBytes?: number; error: unknown; binarySignature?: BinarySpreadsheetSignature };

export class SekundoBinaryMismatchError extends Error {
  binarySignature: BinarySpreadsheetSignature;
  fileName: string;
  constructor(message: string, binarySignature: BinarySpreadsheetSignature, fileName: string) {
    super(message);
    this.name = 'SekundoBinaryMismatchError';
    this.binarySignature = binarySignature;
    this.fileName = fileName;
  }
}

function validateAndDecodePickedBytes(
  fileName: string,
  sizeBytes: number,
  bytes: Uint8Array,
  allowXlsxBinary?: boolean
): BrowserFilePickOutcome {
  if (!bytes || bytes.length === 0) {
    return {
      kind: 'error',
      fileName,
      sizeBytes,
      error: new Error(`O arquivo "${fileName}" está vazio (0 bytes).`),
    };
  }

  const sig = detectSpreadsheetBinarySignature(bytes);
  if (sig === 'pdf' || sig === 'ole2_xls' || sig === 'unknown_binary') {
    return {
      kind: 'error',
      fileName,
      sizeBytes,
      binarySignature: sig,
      error: new SekundoBinaryMismatchError(
        `Formato binário incompatível (${sig}) no arquivo "${fileName}".`,
        sig,
        fileName
      ),
    };
  }

  if (sig === 'zip_or_xlsx' && !allowXlsxBinary) {
    return {
      kind: 'error',
      fileName,
      sizeBytes,
      binarySignature: sig,
      error: new SekundoBinaryMismatchError(
        'Arquivo Excel (.xlsx) enviado em importador somente CSV.',
        sig,
        fileName
      ),
    };
  }

  const decoded: SmartDecodedSpreadsheetResult =
    sig === 'zip_or_xlsx'
      ? {
          text: '',
          detectedEncoding: 'utf-8',
          hadReplacementChars: false,
          binarySignature: sig,
        }
      : decodeSpreadsheetBytesSmart(bytes);

  return {
    kind: 'ok',
    file: {
      fileName,
      sizeBytes: bytes.length,
      bytes,
      decoded,
      binarySignature: sig,
    },
  };
}

/**
 * Prompts the browser (Web) or native document picker (Android/iOS), invokes
 * `onFileSelected` immediately once the user chooses a file (before decoding
 * begins so a loading modal can paint), reads raw bytes, checks binary signatures
 * (`.xlsx`/`.xls`/`.pdf`), and decodes text using UTF-8 -> Windows-1252 smart fallback.
 */
export async function pickBrowserSpreadsheetFile(options: {
  accept?: string;
  allowXlsxBinary?: boolean;
  onFileSelected?: (meta: { fileName: string; sizeBytes: number }) => void | Promise<void>;
}): Promise<BrowserFilePickOutcome> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) {
        return { kind: 'cancelled' };
      }
      const asset = res.assets[0];
      const fileName = asset.name || 'planilha.csv';
      const sizeBytes = typeof asset.size === 'number' ? asset.size : 0;
      await options.onFileSelected?.({ fileName, sizeBytes });
      await yieldToUiFrame();

      const { File: ExpoFile } = await import('expo-file-system');
      const rawBytes = await new ExpoFile(asset.uri).bytes();
      const bytes = new Uint8Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
      return validateAndDecodePickedBytes(fileName, sizeBytes, bytes, options.allowXlsxBinary);
    } catch (err) {
      return {
        kind: 'error',
        fileName: 'planilha.csv',
        error: err,
      };
    }
  }

  return new Promise<BrowserFilePickOutcome>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept ?? '.csv,.xlsx,.kml,.geojson,.json,.txt';
    input.style.position = 'fixed';
    input.style.top = '-10000px';
    input.style.left = '-10000px';
    input.style.opacity = '0';

    let settled = false;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    const handleInputCancel = () => {
      finish({ kind: 'cancelled' });
    };

    const cleanup = () => {
      if (focusTimer) {
        clearTimeout(focusTimer);
        focusTimer = null;
      }
      input.removeEventListener('cancel', handleInputCancel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowFocus);
      }
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const finish = (outcome: BrowserFilePickOutcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };

    const handleWindowFocus = () => {
      focusTimer = setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          finish({ kind: 'cancelled' });
        }
      }, 800);
    };

    input.addEventListener('cancel', handleInputCancel);
    input.onchange = async () => {
      if (focusTimer) {
        clearTimeout(focusTimer);
        focusTimer = null;
      }
      const file = input.files?.[0];
      if (!file) {
        finish({ kind: 'cancelled' });
        return;
      }

      const fileName = file.name || 'planilha.csv';
      const sizeBytes = typeof file.size === 'number' ? file.size : 0;

      try {
        await options.onFileSelected?.({ fileName, sizeBytes });
        await yieldToUiFrame();

        let bytes: Uint8Array;
        if (typeof file.arrayBuffer === 'function') {
          const ab = await file.arrayBuffer();
          bytes = new Uint8Array(ab);
        } else {
          const fallbackText = await file.text();
          bytes = new TextEncoder().encode(fallbackText);
        }

        finish(
          validateAndDecodePickedBytes(fileName, sizeBytes, bytes, options.allowXlsxBinary)
        );
      } catch (err) {
        finish({
          kind: 'error',
          fileName,
          sizeBytes,
          error: err,
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus, { once: true });
    }
    if (document.body) {
      document.body.appendChild(input);
    }
    input.click();
  });
}

export interface RunSekundoImportOptions {
  fileName: string;
  sizeBytes?: number;
  initialStage?: ImportStage;
  initialDetail?: string;
  diagnosticContext?: DiagnosticMappingContext;
}

export interface SekundoWarningReviewRequest {
  summary: string;
  validCount: number;
  skippedCount: number;
  issues: ImportDiagnosticIssue[];
}

export interface RunSekundoImportSuccess<R> {
  result: R;
  summary: string;
  warnings?: ImportDiagnosticIssue[];
  suppressSuccessModal?: boolean;
}

export interface SekundoPipelineContext {
  requestId: number;
  signal: AbortSignal;
  reportProgress: (
    update: Omit<ImportProgressInfo, 'cancellable'> & { cancellable?: boolean }
  ) => void;
  setDiagnosticContext: (ctx: Partial<DiagnosticMappingContext>) => void;
  requestWarningReview: (payload: SekundoWarningReviewRequest) => Promise<boolean>;
  throwIfAborted: () => void;
}

function extractRawError(error: unknown): string {
  let raw = '';
  if (error instanceof Error) {
    raw = error.stack ? `${error.name}: ${error.message}\n${error.stack}` : error.message;
  } else if (typeof error === 'string') {
    raw = error;
  } else {
    try {
      raw = JSON.stringify(error, null, 2);
    } catch {
      raw = String(error ?? 'Erro desconhecido');
    }
  }
  return sanitizeDiagnosticSnippet(raw, { maxLength: 600, neutralizeFormulas: true });
}

export interface UseSekundoImportPipelineReturn<T = unknown> {
  state: ImportPipelineState<T>;
  isRunning: boolean;
  technicalReport: string;
  beginTracking: (options: RunSekundoImportOptions) => number;
  reportExternalProgress: (
    requestId: number,
    update: Omit<ImportProgressInfo, 'cancellable'> & { cancellable?: boolean }
  ) => void;
  failExternal: (
    requestId: number,
    error: unknown,
    context?: DiagnosticMappingContext
  ) => void;
  run: <R = T>(
    options: RunSekundoImportOptions,
    executor: (ctx: SekundoPipelineContext) => Promise<RunSekundoImportSuccess<R>>
  ) => Promise<R | undefined>;
  cancelImport: () => void;
  resolveWarningReview: (proceed: boolean) => void;
  dismiss: () => void;
}

export function useSekundoImportPipeline<T = unknown>(): UseSekundoImportPipelineReturn<T> {
  const [state, setState] = useState<ImportPipelineState<T>>({ status: 'idle' });
  const [technicalReport, setTechnicalReport] = useState('');

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const statusRef = useRef<ImportPipelineState<T>['status']>('idle');
  const commitLockedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastStageRef = useRef<ImportStage>('reading_file');
  const lastEmitAtRef = useRef<number>(0);
  const diagCtxRef = useRef<DiagnosticMappingContext>({});
  const warningResolverRef = useRef<((proceed: boolean) => void) | null>(null);

  const clearWarningResolver = useCallback((value: boolean) => {
    if (warningResolverRef.current) {
      const resolve = warningResolverRef.current;
      warningResolverRef.current = null;
      resolve(value);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearWarningResolver(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [clearWarningResolver]);

  const startRequest = useCallback(
    (options: RunSekundoImportOptions) => {
      clearWarningResolver(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const initialStage: ImportStage = options.initialStage ?? 'reading_file';
      lastStageRef.current = initialStage;
      lastEmitAtRef.current = 0;
      diagCtxRef.current = {
        fileName: options.fileName,
        stageFailed: initialStage,
        ...(options.diagnosticContext ?? {}),
      };

      const progress = sanitizeSekundoProgress({
        stage: initialStage,
        stageLabel: IMPORT_STAGE_LABELS_PT[initialStage],
        detailLabel: options.initialDetail,
        percent: initialStage === 'reading_file' ? 5 : undefined,
        cancellable: true,
        fileName: options.fileName,
        sizeBytes: options.sizeBytes,
      });

      statusRef.current = 'running';
      commitLockedRef.current = !progress.cancellable;

      if (mountedRef.current) {
        setTechnicalReport('');
        setState({
          status: 'running',
          requestId,
          fileName: options.fileName,
          sizeBytes: options.sizeBytes,
          startedAt: Date.now(),
          progress,
        });
      }

      return { requestId, controller };
    },
    [clearWarningResolver]
  );

  const reportProgressForRequest = useCallback(
    (
      requestId: number,
      update: Omit<ImportProgressInfo, 'cancellable'> & { cancellable?: boolean }
    ) => {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const now = Date.now();
      const stageChanged = update.stage !== lastStageRef.current;
      const isComplete = typeof update.percent === 'number' && update.percent >= 100;

      if (!stageChanged && !isComplete && now - lastEmitAtRef.current < PROGRESS_THROTTLE_MS) {
        return;
      }

      lastStageRef.current = update.stage;
      lastEmitAtRef.current = now;
      diagCtxRef.current = {
        ...diagCtxRef.current,
        stageFailed: update.stage,
      };

      const sanitized = sanitizeSekundoProgress({
        ...update,
        cancellable: update.cancellable ?? true,
      });

      statusRef.current = 'running';
      if (!sanitized.cancellable) {
        commitLockedRef.current = true;
      }

      setState((prev) => {
        if (prev.status !== 'running' && prev.status !== 'warning_review') {
          return prev;
        }
        return {
          status: 'running',
          requestId,
          fileName: sanitized.fileName || prev.fileName,
          sizeBytes: sanitized.sizeBytes ?? (prev.status === 'running' ? prev.sizeBytes : undefined),
          startedAt: prev.status === 'running' ? prev.startedAt : now,
          progress: sanitized,
        };
      });
    },
    []
  );

  const failForRequest = useCallback(
    (
      requestId: number,
      error: unknown,
      extraContext?: DiagnosticMappingContext
    ) => {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      commitLockedRef.current = false;

      if (isImportCancelledError(error)) {
        statusRef.current = 'idle';
        setState({ status: 'idle' });
        return;
      }

      const inferredSig =
        error instanceof SekundoBinaryMismatchError
          ? error.binarySignature
          : extraContext?.binarySignature;

      const mergedCtx: DiagnosticMappingContext = {
        ...diagCtxRef.current,
        ...extraContext,
        binarySignature: inferredSig ?? diagCtxRef.current.binarySignature,
      };
      const fileName = mergedCtx.fileName || 'planilha.csv';
      const issues = mapImportErrorToDiagnostics(error, mergedCtx);
      const primary = issues[0];
      const summary = primary
        ? `${primary.title}: ${primary.explanation}`
        : `Não foi possível importar "${fileName}".`;
      const rawErrorText = extractRawError(error);
      const stageFailed = mergedCtx.stageFailed ?? lastStageRef.current;

      const report = buildDiagnosticReportText({
        fileName,
        stageFailed,
        summary,
        issues,
        rawErrorText,
      });

      statusRef.current = 'error';
      setTechnicalReport(report);
      setState({
        status: 'error',
        requestId,
        fileName,
        summary,
        issues,
        rawErrorText,
        stageFailed,
      });
    },
    []
  );

  const beginTracking = useCallback(
    (options: RunSekundoImportOptions): number => {
      if (statusRef.current === 'running' && commitLockedRef.current) {
        return requestIdRef.current;
      }
      return startRequest(options).requestId;
    },
    [startRequest]
  );

  const cancelImport = useCallback(() => {
    if (commitLockedRef.current || (state.status === 'running' && !state.progress.cancellable)) {
      return;
    }
    clearWarningResolver(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(new ImportCancelledError());
      abortControllerRef.current = null;
    }
    requestIdRef.current += 1;
    statusRef.current = 'idle';
    commitLockedRef.current = false;
    if (mountedRef.current) {
      setTechnicalReport('');
      setState({ status: 'idle' });
    }
  }, [clearWarningResolver, state]);

  const resolveWarningReview = useCallback(
    (proceed: boolean) => {
      clearWarningResolver(proceed);
    },
    [clearWarningResolver]
  );

  const dismiss = useCallback(() => {
    if (commitLockedRef.current || (state.status === 'running' && !state.progress.cancellable)) {
      return;
    }
    clearWarningResolver(false);
    statusRef.current = 'idle';
    commitLockedRef.current = false;
    if (mountedRef.current) {
      setTechnicalReport('');
      setState({ status: 'idle' });
    }
  }, [clearWarningResolver, state]);

  const run = useCallback(
    async <R = T>(
      options: RunSekundoImportOptions,
      executor: (ctx: SekundoPipelineContext) => Promise<RunSekundoImportSuccess<R>>
    ): Promise<R | undefined> => {
      if (statusRef.current === 'running' && commitLockedRef.current) {
        return undefined;
      }

      const { requestId, controller } = startRequest(options);
      await yieldToUiFrame();

      if (!mountedRef.current || requestId !== requestIdRef.current || controller.signal.aborted) {
        return undefined;
      }

      const ctx: SekundoPipelineContext = {
        requestId,
        signal: controller.signal,
        reportProgress: (update) => reportProgressForRequest(requestId, update),
        setDiagnosticContext: (partial) => {
          if (requestId !== requestIdRef.current) return;
          diagCtxRef.current = {
            ...diagCtxRef.current,
            ...partial,
          };
        },
        throwIfAborted: () => throwIfImportAborted(controller.signal),
        requestWarningReview: (payload) => {
          if (!mountedRef.current || requestId !== requestIdRef.current || controller.signal.aborted) {
            return Promise.resolve(false);
          }
          return new Promise<boolean>((resolve) => {
            warningResolverRef.current = resolve;
            const fileName = diagCtxRef.current.fileName || options.fileName;
            statusRef.current = 'warning_review';
            commitLockedRef.current = false;
            setState({
              status: 'warning_review',
              requestId,
              fileName,
              summary: payload.summary,
              validCount: payload.validCount,
              skippedCount: payload.skippedCount,
              issues: payload.issues,
            });
          });
        },
      };

      try {
        const outcome = await executor(ctx);
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return undefined;
        }
        throwIfImportAborted(controller.signal);

        if (outcome.suppressSuccessModal) {
          statusRef.current = 'idle';
          commitLockedRef.current = false;
          setTechnicalReport('');
          setState({ status: 'idle' });
          return outcome.result;
        }

        const warnings = outcome.warnings ?? [];
        const report =
          warnings.length > 0
            ? buildDiagnosticReportText({
                fileName: options.fileName,
                summary: outcome.summary,
                issues: warnings,
              })
            : '';
        statusRef.current = 'success';
        commitLockedRef.current = false;
        setTechnicalReport(report);

        setState({
          status: 'success',
          requestId,
          fileName: options.fileName,
          summary: outcome.summary,
          warnings,
          result: outcome.result as unknown as T,
        });

        return outcome.result;
      } catch (err) {
        if (controller.signal.aborted || isImportCancelledError(err)) {
          commitLockedRef.current = false;
          if (mountedRef.current && requestId === requestIdRef.current) {
            statusRef.current = 'idle';
            setTechnicalReport('');
            setState({ status: 'idle' });
          }
          return undefined;
        }
        failForRequest(requestId, err);
        return undefined;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [failForRequest, reportProgressForRequest, startRequest]
  );

  return {
    state,
    isRunning: state.status === 'running',
    technicalReport,
    beginTracking,
    reportExternalProgress: reportProgressForRequest,
    failExternal: failForRequest,
    run,
    cancelImport,
    resolveWarningReview,
    dismiss,
  };
}
