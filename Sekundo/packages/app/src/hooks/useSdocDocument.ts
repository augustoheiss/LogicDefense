import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  FlatRegistry,
  SdocDocument,
  SdocPrimitive,
  DisplayList,
  parseSdocYaml,
  SdocCstMutator,
  solveLayout,
  sdocProvenanceBus,
  SdocTransactionOrigin,
  S89_4UP_SDOC_YAML,
  S13S_MULTICYCLE_SDOC_YAML,
  autoGenerateSdocFromRegistry,
  writeUnifiedOutput,
} from '@sekundo/core';
import { saveSdocTemplate, loadSdocTemplate, loadBlob } from '../storage/localStorage';
import { deliverFile } from '../utils/deliverFile';
import { streamPdfToSdocIngestion } from '../pdf/ingestPipeline';

export interface UseSdocDocumentOptions {
  eventId?: string;
  eventName?: string;
  registry?: FlatRegistry;
  initialPreset?: 's89-4up' | 's13-s' | 'auto';
}

export function useSdocDocument({
  eventId = 'global',
  eventName = 'Sekundo',
  registry = [],
  initialPreset = 's89-4up',
}: UseSdocDocumentOptions) {
  const templateStorageId = `studio_${eventId}`;
  const [yamlText, setYamlTextState] = useState<string>(S89_4UP_SDOC_YAML);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [snapMm, setSnapMm] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [ingestionStage, setIngestionStage] = useState<string | null>(null);
  const [underlayBytes, setUnderlayBytes] = useState<Uint8Array | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Load persisted template on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadSdocTemplate(templateStorageId).then((saved) => {
      if (saved && saved.trim().length > 0) {
        setYamlTextState(saved);
      } else if (initialPreset === 'auto' && registry.length > 0) {
        setYamlTextState(autoGenerateSdocFromRegistry(registry, eventName));
      } else if (initialPreset === 's13-s') {
        setYamlTextState(S13S_MULTICYCLE_SDOC_YAML);
      }
    });
  }, [templateStorageId, initialPreset, registry, eventName]);

  const commitYamlChange = useCallback(
    (nextYaml: string, origin: SdocTransactionOrigin = 'editor') => {
      sdocProvenanceBus.execute(origin, () => {
        setYamlTextState((prev) => {
          if (prev === nextYaml) return prev;
          setUndoStack((u) => [...u.slice(-29), prev]);
          setRedoStack([]);
          return nextYaml;
        });
      });
      saveSdocTemplate(templateStorageId, nextYaml).catch(() => {});
    },
    [templateStorageId]
  );

  const undo = useCallback(() => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const previous = u[u.length - 1];
      setYamlTextState((curr) => {
        setRedoStack((r) => [...r, curr]);
        saveSdocTemplate(templateStorageId, previous).catch(() => {});
        return previous;
      });
      return u.slice(0, -1);
    });
  }, [templateStorageId]);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setYamlTextState((curr) => {
        setUndoStack((u) => [...u, curr]);
        saveSdocTemplate(templateStorageId, next).catch(() => {});
        return next;
      });
      return r.slice(0, -1);
    });
  }, [templateStorageId]);

  const { sdoc, parseError } = useMemo<{
    sdoc: SdocDocument | null;
    parseError: string | null;
  }>(() => {
    const res = parseSdocYaml(yamlText);
    if (!res.doc) {
      return {
        sdoc: null,
        parseError: res.issues.map((i) => i.message).join(' | ') || 'Erro de sintaxe YAML',
      };
    }
    return { sdoc: res.doc, parseError: null };
  }, [yamlText]);

  // Load underlay blob if referenced by sdoc.underlay.source
  useEffect(() => {
    const ref = sdoc?.underlay?.source;
    if (!ref) {
      setUnderlayBytes(undefined);
      return;
    }
    loadBlob(ref).then((bytes) => {
      if (bytes) setUnderlayBytes(bytes);
    });
  }, [sdoc?.underlay?.source]);

  const { displayList, layoutError } = useMemo<{
    displayList: DisplayList | null;
    layoutError: string | null;
  }>(() => {
    if (!sdoc) return { displayList: null, layoutError: null };
    try {
      const dl = solveLayout(sdoc, registry);
      return { displayList: dl, layoutError: null };
    } catch (err: any) {
      return { displayList: null, layoutError: err?.message ?? 'Erro de layout' };
    }
  }, [sdoc, registry]);

  const updatePrimitive = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      try {
        const nextYaml = SdocCstMutator.updatePrimitiveInPlace(yamlText, id, patch);
        if (nextYaml !== yamlText) {
          commitYamlChange(nextYaml, 'canvas');
        }
      } catch (err: any) {
        setStatusMessage(`Erro ao atualizar elemento: ${err?.message ?? err}`);
      }
    },
    [yamlText, commitYamlChange]
  );

  const addPrimitive = useCallback(
    (primitive: SdocPrimitive) => {
      try {
        const nextYaml = SdocCstMutator.addPrimitiveInPlace(
          yamlText,
          primitive as unknown as Record<string, unknown>
        );
        commitYamlChange(nextYaml, 'canvas');
        setSelectedId(primitive.id);
      } catch (err: any) {
        setStatusMessage(`Erro ao adicionar elemento: ${err?.message ?? err}`);
      }
    },
    [yamlText, commitYamlChange]
  );

  const loadBuiltinPreset = useCallback(
    (preset: 's89-4up' | 's13-s' | 'auto') => {
      setCurrentPageIndex(0);
      setSelectedId(null);
      if (preset === 's89-4up') {
        commitYamlChange(S89_4UP_SDOC_YAML, 'editor');
        setStatusMessage('Template S-89 (4 por folha A4) carregado.');
      } else if (preset === 's13-s') {
        commitYamlChange(S13S_MULTICYCLE_SDOC_YAML, 'editor');
        setStatusMessage('Template S-13-S (Registro de Territórios Multi-Ciclo) carregado.');
      } else if (preset === 'auto') {
        const generated = autoGenerateSdocFromRegistry(registry, eventName);
        commitYamlChange(generated, 'editor');
        setStatusMessage('Auto-Template gerado a partir do evento.');
      }
    },
    [registry, eventName, commitYamlChange]
  );

  const ingestPdfBytes = useCallback(
    async (pdfBytes: Uint8Array, mode: 'overlay' | 'rebuild', fileName = 'documento.pdf') => {
      try {
        setIngestionStage('Iniciando ingestão PDF...');
        setUnderlayBytes(pdfBytes);

        for await (const progress of streamPdfToSdocIngestion(
          pdfBytes,
          fileName,
          mode,
          registry
        )) {
          setIngestionStage(progress.stageLabel);
          commitYamlChange(progress.yaml, 'ingest');
        }
        setIngestionStage(null);
        setStatusMessage(
          mode === 'overlay'
            ? `PDF "${fileName}" importado em modo Camada Híbrida (Overlay + PDF Fundo).`
            : `PDF "${fileName}" reconstruído para primitivas editáveis SDOC.`
        );
      } catch (err: any) {
        setIngestionStage(null);
        setStatusMessage(`Falha ao importar PDF: ${err?.message ?? err}`);
      }
    },
    [registry, commitYamlChange]
  );

  const exportDocument = useCallback(
    async (kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml' | 'sdoc') => {
      try {
        const slug = (sdoc?.name || eventName || 'sekundo-doc')
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, '-');

        if (kind === 'sdoc') {
          await deliverFile(yamlText, `${slug}.sdoc.yaml`, 'text/yaml;charset=utf-8');
          setStatusMessage(`Template salvo: ${slug}.sdoc.yaml`);
          return;
        }

        const blobs: Record<string, Uint8Array> = {};
        if (sdoc?.underlay?.source && underlayBytes) {
          blobs[sdoc.underlay.source] = underlayBytes;
        }

        const output = await writeUnifiedOutput(kind, {
          registry,
          eventName: sdoc?.name || eventName,
          sdocYaml: yamlText,
          options: { blobs },
        });

        const extMap = {
          pdf: { ext: 'pdf', mime: 'application/pdf' },
          whatsapp: { ext: 'whatsapp.txt', mime: 'text/plain;charset=utf-8' },
          csv: { ext: 'csv', mime: 'text/csv;charset=utf-8' },
          yaml: { ext: 'data.yaml', mime: 'text/yaml;charset=utf-8' },
        };
        const meta = extMap[kind];
        await deliverFile(output, `${slug}.${meta.ext}`, meta.mime);
        setStatusMessage(`Exportado com sucesso: ${slug}.${meta.ext}`);
      } catch (err: any) {
        setStatusMessage(`Erro na exportação (${kind}): ${err?.message ?? err}`);
      }
    },
    [registry, yamlText, underlayBytes, sdoc?.name, sdoc?.underlay?.source, eventName]
  );

  return {
    yamlText,
    setYamlText: (val: string) => commitYamlChange(val, 'editor'),
    sdoc,
    parseError,
    displayList,
    layoutError,
    currentPageIndex,
    setCurrentPageIndex,
    selectedId,
    setSelectedId,
    snapMm,
    setSnapMm,
    showGrid,
    setShowGrid,
    showRulers,
    setShowRulers,
    zoom,
    setZoom,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    updatePrimitive,
    addPrimitive,
    loadBuiltinPreset,
    ingestPdfBytes,
    exportDocument,
    ingestionStage,
    statusMessage,
    setStatusMessage,
  };
}
