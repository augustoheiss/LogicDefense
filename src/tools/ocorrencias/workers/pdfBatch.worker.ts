/**
 * Ocorrências 3.0 (Phase 2) — Dedicated Web Worker for Massive Batch Mail-Merge
 * (`workers/pdfBatch.worker.ts`)
 *
 * Offloads `renderOcorrenciaMailMergeToPdfBytes` (PDF Form XObject embedding +
 * per-student DisplayList solving + vector stamping + Continuation Sheet generation)
 * off the browser main thread, streaming `{ type: 'PROGRESS', completed, total }`
 * events back to the React studio so 200–600+ student batches never freeze the UI.
 */

import { renderOcorrenciaMailMergeToPdfBytes } from '../engine/pdfClientPainter';
import type { OcorrenciaDocSpec } from '../engine/types';

export interface BatchWorkerRequest {
  type: 'START_BATCH';
  templatePdfBytes: Uint8Array;
  docSpec: OcorrenciaDocSpec;
  records: Record<string, string | boolean | undefined>[];
}

export type BatchWorkerResponse =
  | {
      type: 'PROGRESS';
      completed: number;
      total: number;
    }
  | {
      type: 'DONE';
      pdfBytes: Uint8Array;
      pageCount: number;
    }
  | {
      type: 'ERROR';
      message: string;
    };

const ctx: Worker = self as any;

ctx.onmessage = async (event: MessageEvent<BatchWorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'START_BATCH') return;

  try {
    const { templatePdfBytes, docSpec, records } = data;
    const result = await renderOcorrenciaMailMergeToPdfBytes(
      templatePdfBytes,
      docSpec,
      records,
      (completed, total) => {
        const msg: BatchWorkerResponse = {
          type: 'PROGRESS',
          completed,
          total,
        };
        ctx.postMessage(msg);
      }
    );

    const doneMsg: BatchWorkerResponse = {
      type: 'DONE',
      pdfBytes: result.pdfBytes,
      pageCount: result.pageCount,
    };
    ctx.postMessage(doneMsg, [result.pdfBytes.buffer]);
  } catch (err: any) {
    const errMsg: BatchWorkerResponse = {
      type: 'ERROR',
      message: err?.message || 'Erro interno no Web Worker de Mala Direta PDF.',
    };
    ctx.postMessage(errMsg);
  }
};
