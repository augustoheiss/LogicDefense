/**
 * Ocorrências 3.0 (Phase 2) — Batch Mail-Merge Worker Orchestrator
 * (`services/batchWorkerClient.ts`)
 *
 * Executes multi-student CSV Mail-Merge inside `pdfBatch.worker.ts` with real-time
 * progress callbacks (`completed / total`), falling back automatically to
 * main-thread `renderOcorrenciaMailMergeToPdfBytes` if Web Workers are blocked.
 */

import { renderOcorrenciaMailMergeToPdfBytes } from '../engine';
import type { OcorrenciaDocSpec } from '../engine';
import type { BatchWorkerRequest, BatchWorkerResponse } from '../workers/pdfBatch.worker';

export interface BatchMailMergeResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  usedWorker: boolean;
}

export async function executeBatchMailMergeWithWorker(
  templatePdfBytes: Uint8Array,
  docSpec: OcorrenciaDocSpec,
  records: Record<string, string | boolean | undefined>[],
  onProgress?: (completed: number, total: number) => void
): Promise<BatchMailMergeResult> {
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise<BatchMailMergeResult>((resolve, reject) => {
        const worker = new Worker(
          new URL('../workers/pdfBatch.worker.ts', import.meta.url),
          { type: 'module' }
        );

        const cleanup = () => {
          try {
            worker.terminate();
          } catch {
            // Ignore
          }
        };

        worker.onmessage = (event: MessageEvent<BatchWorkerResponse>) => {
          const msg = event.data;
          if (!msg) return;

          if (msg.type === 'PROGRESS') {
            onProgress?.(msg.completed, msg.total);
            return;
          }

          if (msg.type === 'DONE') {
            cleanup();
            resolve({
              pdfBytes: new Uint8Array(msg.pdfBytes),
              pageCount: msg.pageCount,
              usedWorker: true,
            });
            return;
          }

          if (msg.type === 'ERROR') {
            cleanup();
            reject(new Error(msg.message));
          }
        };

        worker.onerror = (err) => {
          cleanup();
          reject(new Error(err?.message || 'Falha na thread do Web Worker PDF.'));
        };

        // Clone templatePdfBytes so the main thread's copy is never detached
        const bytesCopy = new Uint8Array(templatePdfBytes);
        const req: BatchWorkerRequest = {
          type: 'START_BATCH',
          templatePdfBytes: bytesCopy,
          docSpec,
          records,
        };
        worker.postMessage(req, [bytesCopy.buffer]);
      });
    } catch {
      // Graceful fallback to main thread if Worker fails
    }
  }

  const fallback = await renderOcorrenciaMailMergeToPdfBytes(
    templatePdfBytes,
    docSpec,
    records,
    onProgress
  );
  return {
    pdfBytes: fallback.pdfBytes,
    pageCount: fallback.pageCount,
    usedWorker: false,
  };
}
