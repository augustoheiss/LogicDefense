/**
 * Assistente Moeda (@sekundo/coin-engine) — Cooperative Import Pipeline Hook
 *
 * Orchestrates async spreadsheet parsing, encoding detection, validation, and
 * durable storage commits without freezing the UI thread:
 *   1. Paints the progress overlay immediately (`yieldToUiFrame`) before parsing.
 *   2. Enforces monotonic `requestId` guards so stale async work is ignored.
 *   3. Throttles high-frequency row progress updates (>= 50ms) except stage jumps.
 *   4. Locks cancellation once durable storage persistence (`saving_storage`) begins.
 *   5. Maps errors into actionable PT-BR diagnostics ("O que aconteceu" / "Como arrumar").
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IMPORT_STAGE_LABELS_PT,
  ImportCancelledError,
  buildDiagnosticReportText,
  isImportCancelledError,
  mapImportErrorToDiagnostics,
  sanitizeDiagnosticSnippet,
  throwIfImportAborted,
  yieldToUiFrame,
  type DiagnosticMappingContext,
  type ImportDiagnosticIssue,
  type ImportPipelineState,
  type ImportProgressInfo,
  type ImportStage,
} from '@coin/services/importPipelineContract';

const PROGRESS_THROTTLE_MS = 50;

export const STAGE_NON_CANCELLABLE: ReadonlySet<ImportStage> = new Set<ImportStage>([
  'saving_storage',
  'opening_table',
]);

export function sanitizeProgressCancellable(progress: ImportProgressInfo): ImportProgressInfo {
  const locked = STAGE_NON_CANCELLABLE.has(progress.stage);
  return {
    ...progress,
    stageLabel: progress.stageLabel || IMPORT_STAGE_LABELS_PT[progress.stage],
    cancellable: locked ? false : Boolean(progress.cancellable),
  };
}

export interface RunImportPipelineOptions {
  fileName: string;
  sizeBytes?: number;
  initialStage?: ImportStage;
  initialDetail?: string;
  diagnosticContext?: DiagnosticMappingContext;
  autoCloseOnSuccessMs?: number;
}

export interface WarningReviewRequest {
  summary: string;
  validCount: number;
  skippedCount: number;
  issues: ImportDiagnosticIssue[];
}

export interface RunImportSuccessResult<R> {
  result: R;
  summary: string;
  importedCount?: number;
  warnings?: ImportDiagnosticIssue[];
  suppressSuccessModal?: boolean;
}

export interface PipelineExecutorContext {
  requestId: number;
  signal: AbortSignal;
  reportProgress: (
    update: Omit<ImportProgressInfo, 'cancellable'> & { cancellable?: boolean }
  ) => void;
  setDiagnosticContext: (ctx: Partial<DiagnosticMappingContext>) => void;
  requestWarningReview: (payload: WarningReviewRequest) => Promise<boolean>;
  throwIfAborted: () => void;
}

export interface UseImportPipelineReturn<T = unknown> {
  state: ImportPipelineState<T>;
  isRunning: boolean;
  technicalReport: string;
  run: <R = T>(
    options: RunImportPipelineOptions,
    executor: (ctx: PipelineExecutorContext) => Promise<RunImportSuccessResult<R>>
  ) => Promise<R | undefined>;
  beginTracking: (options: RunImportPipelineOptions) => number;
  reportExternalProgress: (
    requestId: number,
    update: Omit<ImportProgressInfo, 'cancellable'> & { cancellable?: boolean }
  ) => void;
  failExternal: (
    requestId: number,
    error: unknown,
    context?: DiagnosticMappingContext
  ) => void;
  cancelImport: () => void;
  resolveWarningReview: (proceed: boolean) => void;
  dismiss: () => void;
}

function isSuccessEnvelope<R>(value: unknown): value is RunImportSuccessResult<R> {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    'result' in (value as Record<string, unknown>) &&
    'summary' in (value as Record<string, unknown>)
  );
}

export function extractRawErrorText(error: unknown): string {
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

export function useImportPipeline<T = unknown>(): UseImportPipelineReturn<T> {
  const [state, setState] = useState<ImportPipelineState<T>>({ status: 'idle' });
  const [technicalReport, setTechnicalReport] = useState('');

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const statusRef = useRef<ImportPipelineState<T>['status']>('idle');
  const commitLockedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastStageRef = useRef<ImportStage>('reading_file');
  const lastProgressEmitAtRef = useRef<number>(0);
  const diagContextRef = useRef<DiagnosticMappingContext>({});
  const warningResolverRef = useRef<((proceed: boolean) => void) | null>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current !== null) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

  const clearPendingWarningResolver = useCallback((value: boolean) => {
    if (warningResolverRef.current) {
      const resolver = warningResolverRef.current;
      warningResolverRef.current = null;
      resolver(value);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAutoCloseTimer();
      clearPendingWarningResolver(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [clearAutoCloseTimer, clearPendingWarningResolver]);

  const startNewRequest = useCallback(
    (options: RunImportPipelineOptions) => {
      clearAutoCloseTimer();
      clearPendingWarningResolver(false);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const initialStage: ImportStage = options.initialStage ?? 'reading_file';
      lastStageRef.current = initialStage;
      lastProgressEmitAtRef.current = 0;
      diagContextRef.current = {
        fileName: options.fileName,
        stageFailed: initialStage,
        ...(options.diagnosticContext ?? {}),
      };

      const initialProgress = sanitizeProgressCancellable({
        stage: initialStage,
        stageLabel: IMPORT_STAGE_LABELS_PT[initialStage],
        detailLabel: options.initialDetail,
        percent: initialStage === 'reading_file' ? 4 : undefined,
        cancellable: true,
        fileName: options.fileName,
        sizeBytes: options.sizeBytes,
      });

      statusRef.current = 'running';
      commitLockedRef.current = !initialProgress.cancellable;

      if (mountedRef.current) {
        setTechnicalReport('');
        setState({
          status: 'running',
          requestId,
          fileName: options.fileName,
          sizeBytes: options.sizeBytes,
          startedAt: Date.now(),
          progress: initialProgress,
        });
      }

      return { requestId, controller };
    },
    [clearAutoCloseTimer, clearPendingWarningResolver]
  );

  const reportProgressForRequest = useCallback(
    (
      requestId: number,
      update: Omit<ImportProgressInfo, 'cancellable'> & { cancellable?: boolean }
    ) => {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const now = Date.now();
      const stageChanged = update.stage !== lastStageRef.current;
      const isCompletion = typeof update.percent === 'number' && update.percent >= 100;

      if (!stageChanged && !isCompletion && now - lastProgressEmitAtRef.current < PROGRESS_THROTTLE_MS) {
        return;
      }

      lastStageRef.current = update.stage;
      lastProgressEmitAtRef.current = now;
      diagContextRef.current = {
        ...diagContextRef.current,
        stageFailed: update.stage,
      };

      const sanitized = sanitizeProgressCancellable({
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

      const mergedCtx: DiagnosticMappingContext = {
        ...diagContextRef.current,
        ...extraContext,
      };
      const fileName = mergedCtx.fileName || 'planilha.csv';

      if (isImportCancelledError(error)) {
        statusRef.current = 'idle';
        setState({ status: 'idle' });
        return;
      }

      const issues = mapImportErrorToDiagnostics(error, mergedCtx);
      const primary = issues[0];
      const summary = primary
        ? `${primary.title}: ${primary.explanation}`
        : `Não foi possível importar "${fileName}".`;
      const rawErrorText = extractRawErrorText(error);

      const report = buildDiagnosticReportText({
        fileName,
        stageFailed: mergedCtx.stageFailed,
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
        stageFailed: mergedCtx.stageFailed ?? lastStageRef.current,
      });
    },
    []
  );

  const beginTracking = useCallback(
    (options: RunImportPipelineOptions): number => {
      const { requestId } = startNewRequest(options);
      return requestId;
    },
    [startNewRequest]
  );

  const cancelImport = useCallback(() => {
    clearAutoCloseTimer();

    if (commitLockedRef.current || (state.status === 'running' && !state.progress.cancellable)) {
      return;
    }

    clearPendingWarningResolver(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort(new ImportCancelledError());
      abortControllerRef.current = null;
    }

    // Invalidate any lingering async callbacks tied to the cancelled requestId.
    requestIdRef.current += 1;
    statusRef.current = 'idle';
    commitLockedRef.current = false;

    if (mountedRef.current) {
      setTechnicalReport('');
      setState({ status: 'idle' });
    }
  }, [clearAutoCloseTimer, clearPendingWarningResolver, state]);

  const resolveWarningReview = useCallback(
    (proceed: boolean) => {
      clearPendingWarningResolver(proceed);
    },
    [clearPendingWarningResolver]
  );

  const dismiss = useCallback(() => {
    clearAutoCloseTimer();
    if (commitLockedRef.current || (state.status === 'running' && !state.progress.cancellable)) {
      return;
    }
    clearPendingWarningResolver(false);
    statusRef.current = 'idle';
    commitLockedRef.current = false;
    if (mountedRef.current) {
      setTechnicalReport('');
      setState({ status: 'idle' });
    }
  }, [clearAutoCloseTimer, clearPendingWarningResolver, state]);

  const run = useCallback(
    async <R = T>(
      options: RunImportPipelineOptions,
      executor: (ctx: PipelineExecutorContext) => Promise<RunImportSuccessResult<R>>
    ): Promise<R | undefined> => {
      if (statusRef.current === 'running' && commitLockedRef.current) {
        return undefined;
      }

      const { requestId, controller } = startNewRequest(options);

      // Give React Native / Web DOM one animation frame to paint the loading overlay
      // before synchronous/chunked CPU parsing kicks off.
      await yieldToUiFrame();

      if (!mountedRef.current || requestId !== requestIdRef.current || controller.signal.aborted) {
        return undefined;
      }

      const ctx: PipelineExecutorContext = {
        requestId,
        signal: controller.signal,
        reportProgress: (update) => reportProgressForRequest(requestId, update),
        setDiagnosticContext: (partial) => {
          if (requestId !== requestIdRef.current) return;
          diagContextRef.current = {
            ...diagContextRef.current,
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
            const fileName = diagContextRef.current.fileName || options.fileName;
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

        const unwrapped = isSuccessEnvelope<R>(outcome)
          ? outcome
          : ({
              result: outcome as R,
              summary: `"${options.fileName}" importada com sucesso.`,
            } as RunImportSuccessResult<R>);

        if (unwrapped.suppressSuccessModal) {
          statusRef.current = 'idle';
          commitLockedRef.current = false;
          setTechnicalReport('');
          setState({ status: 'idle' });
          return unwrapped.result;
        }

        const report =
          unwrapped.warnings && unwrapped.warnings.length > 0
            ? buildDiagnosticReportText({
                fileName: options.fileName,
                summary: unwrapped.summary,
                issues: unwrapped.warnings,
              })
            : '';
        statusRef.current = 'success';
        commitLockedRef.current = false;
        setTechnicalReport(report);

        setState({
          status: 'success',
          requestId,
          fileName: options.fileName,
          summary: unwrapped.summary,
          warnings: unwrapped.warnings ?? [],
          result: unwrapped.result as unknown as T,
        });

        if (options.autoCloseOnSuccessMs && options.autoCloseOnSuccessMs > 0) {
          autoCloseTimerRef.current = setTimeout(() => {
            if (mountedRef.current && requestId === requestIdRef.current) {
              statusRef.current = 'idle';
              commitLockedRef.current = false;
              setState({ status: 'idle' });
            }
          }, options.autoCloseOnSuccessMs);
        }

        return unwrapped.result;
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
    [failForRequest, reportProgressForRequest, startNewRequest]
  );

  return {
    state,
    isRunning: state.status === 'running',
    technicalReport,
    run,
    beginTracking,
    reportExternalProgress: reportProgressForRequest,
    failExternal: failForRequest,
    cancelImport,
    resolveWarningReview,
    dismiss,
  };
}
