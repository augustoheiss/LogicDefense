import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  FlatRegistry, SdocDocument, SdocPrimitive, PreflightReport, DocFieldOperation, FormFieldValue,
  parseSdocYaml, SdocCstMutator, solveLayout, renderDisplayListToPdf, fillAcroForm,
  runDocumentPreflight, extractInitialFormRecord, stringifyFormRecordYaml, parseFormRecordYaml,
  createSetFieldValueOp, reconcileDocFieldOps, createHLC, tickHLC,
  computeTemplateFingerprintSha256, sdocProvenanceBus, SdocTransactionOrigin,
  S89_4UP_SDOC_YAML, S13S_MULTICYCLE_SDOC_YAML, autoGenerateSdocFromRegistry, writeUnifiedOutput,
} from '@sekundo/core';
import {
  saveSdocTemplate, loadSdocTemplate, loadBlob, saveFormYaml, loadFormYaml,
} from '../storage/localStorage';
import { deliverFile } from '../utils/deliverFile';
import { streamPdfToSdocIngestion } from '../pdf/ingestPipeline';
import { rasterizeUnderlayPage } from '../pdf/underlayRaster';
import { buildShareableDocDelta, parseReceivedDocDelta } from '../sync/blobExchange';

export interface UseSdocDocumentOptions {
  eventId?: string;
  eventName?: string;
  registry?: FlatRegistry;
  initialPreset?: 'fichas-4up' | 'territorios-multiciclo' | 'auto' | string;
}

export function useSdocDocument({
  eventId = 'global',
  eventName = 'Sekundo',
  registry = [],
  initialPreset = 'fichas-4up',
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
  const [underlayDataUrl, setUnderlayDataUrl] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, FormFieldValue>>({});
  const [hlcOps, setHlcOps] = useState<DocFieldOperation[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const hlcClockRef = useRef(createHLC('node-studio'));
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadSdocTemplate(templateStorageId).then((saved) => {
      const isLegacyImitatedTemplate =
        saved &&
        (saved.includes('REGISTRO DE DESIGNACAO') ||
          saved.includes('Registro de Designação') ||
          saved.includes('Terr. n.o') ||
          saved.includes('Ao iniciar uma nova folha') ||
          saved.includes('REG-TERR-4C') ||
          saved.includes('territorios-multiciclo.sdoc.yaml') ||
          saved.includes('fichas-4up.sdoc.yaml'));

      if (saved && saved.trim().length > 0 && !isLegacyImitatedTemplate) {
        setYamlTextState(saved);
      } else if (initialPreset === 'auto' && registry.length > 0) {
        const next = autoGenerateSdocFromRegistry(registry, eventName);
        setYamlTextState(next);
        saveSdocTemplate(templateStorageId, next).catch(() => {});
      } else if (
        initialPreset === 'territorios-multiciclo' ||
        (isLegacyImitatedTemplate && saved?.includes('Terr. n.o'))
      ) {
        setYamlTextState(S13S_MULTICYCLE_SDOC_YAML);
        saveSdocTemplate(templateStorageId, S13S_MULTICYCLE_SDOC_YAML).catch(() => {});
      } else if (isLegacyImitatedTemplate) {
        setYamlTextState(S89_4UP_SDOC_YAML);
        saveSdocTemplate(templateStorageId, S89_4UP_SDOC_YAML).catch(() => {});
      }
    });
    loadFormYaml(templateStorageId).then((savedForm) => {
      if (!savedForm) return;
      try {
        const firstVals = parseFormRecordYaml(savedForm).records[0]?.values;
        if (firstVals) setFormValues(firstVals);
      } catch {
        // ignore malformed saved form
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

  const { sdoc, parseError } = useMemo(() => {
    const res = parseSdocYaml(yamlText);
    if (!res.doc) {
      return {
        sdoc: null,
        parseError: res.issues.map((i) => i.message).join(' | ') || 'Erro de sintaxe YAML',
      };
    }
    return { sdoc: res.doc, parseError: null };
  }, [yamlText]);

  useEffect(() => {
    if (!sdoc?.fields || sdoc.fields.length === 0) return;
    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const f of sdoc.fields || []) {
        const key = f.name || f.bind.replace(/^input\./, '') || f.id;
        if (next[key] === undefined && f.defaultValue !== undefined) {
          next[key] = f.defaultValue;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sdoc?.fields]);

  useEffect(() => {
    const ref = sdoc?.underlay?.source;
    if (!ref) {
      setUnderlayBytes(undefined);
      setUnderlayDataUrl(null);
      return;
    }
    loadBlob(ref).then((bytes) => {
      if (bytes) setUnderlayBytes(bytes);
    });
  }, [sdoc?.underlay?.source]);

  useEffect(() => {
    if (!underlayBytes || !sdoc?.underlay?.source) return setUnderlayDataUrl(null);
    let cancelled = false;
    rasterizeUnderlayPage(underlayBytes, currentPageIndex + 1, sdoc.underlay.source).then((url) => {
      if (!cancelled) setUnderlayDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [underlayBytes, currentPageIndex, sdoc?.underlay?.source]);

  const { displayList, layoutError } = useMemo(() => {
    if (!sdoc) return { displayList: null, layoutError: null };
    try {
      return { displayList: solveLayout(sdoc, registry, { formValues }), layoutError: null };
    } catch (err: any) {
      return { displayList: null, layoutError: err?.message ?? 'Erro de layout' };
    }
  }, [sdoc, registry, formValues]);

  const preflight = useMemo<PreflightReport | null>(() => {
    if (!sdoc) return null;
    const blobs = sdoc.underlay?.source && underlayBytes ? { [sdoc.underlay.source]: underlayBytes } : {};
    return runDocumentPreflight({ doc: sdoc, displayList: displayList ?? undefined, values: formValues, blobs });
  }, [sdoc, underlayBytes, formValues, displayList]);

  const updateFormField = useCallback(
    (fieldKey: string, value: string | boolean) => {
      hlcClockRef.current = tickHLC(hlcClockRef.current, 'node-studio');
      setHlcOps((prev) => [...prev, createSetFieldValueOp('rec_1', fieldKey, value, hlcClockRef.current)]);
      setFormValues((prev) => {
        const next = { ...prev, [fieldKey]: value };
        if (sdoc) {
          const yamlRec = stringifyFormRecordYaml({
            form: 1, template: sdoc.underlay?.source || sdoc.name, records: [{ id: 'rec_1', values: next }],
          });
          saveFormYaml(templateStorageId, yamlRec).catch(() => {});
        }
        return next;
      });
    },
    [sdoc, templateStorageId]
  );

  const exportHlcDelta = useCallback(
    (): string => buildShareableDocDelta(sdoc?.underlay?.source || sdoc?.name || eventId, hlcOps),
    [sdoc?.name, sdoc?.underlay?.source, eventId, hlcOps]
  );

  const importHlcDelta = useCallback((envelopeStr: string) => {
    try {
      const env = parseReceivedDocDelta(envelopeStr);
      if (!env) return setStatusMessage('⚠️ Envelope Delta HLC inválido.');
      const fieldOps = env.ops.filter((o): o is DocFieldOperation => o.kind === 'setFieldValue');
      setHlcOps((prev) => {
        const combined = [...prev, ...fieldOps];
        setFormValues((curr) => {
          const reconciled = reconcileDocFieldOps(
            { form: 1, records: [{ id: 'rec_1', values: curr }] },
            combined
          );
          return reconciled.doc.records[0]?.values || curr;
        });
        return combined;
      });
      setStatusMessage(`Delta HLC sincronizado (${env.ops.length} operações).`);
    } catch (err: any) {
      setStatusMessage(`Erro ao importar Delta HLC: ${err?.message ?? err}`);
    }
  }, []);

  const updatePrimitive = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      try {
        const nextYaml = SdocCstMutator.updatePrimitiveInPlace(yamlText, id, patch);
        if (nextYaml !== yamlText) commitYamlChange(nextYaml, 'canvas');
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
    (preset: 'fichas-4up' | 'territorios-multiciclo' | 'auto' | string) => {
      setCurrentPageIndex(0);
      setSelectedId(null);
      setHlcOps([]);
      setFormValues({});
      if (preset === 'fichas-4up' || preset.endsWith('-4up')) {
        commitYamlChange(S89_4UP_SDOC_YAML, 'editor');
        setStatusMessage('Template Fichas 4-Up (4 por folha A4) carregado.');
      } else if (preset === 'territorios-multiciclo' || preset !== 'auto') {
        commitYamlChange(S13S_MULTICYCLE_SDOC_YAML, 'editor');
        setStatusMessage('Template Registro de Territórios Multi-Ciclo carregado.');
      } else {
        commitYamlChange(autoGenerateSdocFromRegistry(registry, eventName), 'editor');
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
        setCurrentPageIndex(0);
        setSelectedId(null);
        setHlcOps([]);
        let finalDoc: SdocDocument | null = null;
        for await (const progress of streamPdfToSdocIngestion(pdfBytes, fileName, mode, registry)) {
          setIngestionStage(progress.stageLabel);
          commitYamlChange(progress.yaml, 'ingest');
          finalDoc = progress.doc;
        }
        if (finalDoc) setFormValues(extractInitialFormRecord(finalDoc).records[0]?.values || {});
        setIngestionStage(null);
        setStatusMessage(
          mode === 'overlay'
            ? `PDF "${fileName}" importado em modo Camada Híbrida (Overlay + PDF Fundo).`
            : `PDF "${fileName}" reconstruído para primitivas editáveis SDOC.`
        );
      } catch (err: any) {
        setIngestionStage(null);
        setStatusMessage(`⚠️ Erro ao importar PDF: ${err?.message ?? err}`);
      }
    },
    [registry, commitYamlChange]
  );

  const exportEditableAcroFormPdf = useCallback(
    async (stripSignatures = false) => {
      try {
        const slug = (sdoc?.name || eventName || 'sekundo-doc').trim();
        if (underlayBytes) {
          const strMap: Record<string, string> = {};
          for (const [k, v] of Object.entries(formValues)) {
            strMap[k] = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
          }
          const editableRes = await fillAcroForm(underlayBytes, strMap, {
            flatten: false,
            stripSignatures,
          });
          const suffix = stripSignatures ? '-copia-sem-assinatura.pdf' : '-editavel.pdf';
          await deliverFile(editableRes.pdfBytes, `${slug}${suffix}`, 'application/pdf');
          setStatusMessage(`PDF exportado: ${slug}${suffix}`);
          return;
        }
        if (displayList) {
          const pdfBytes = await renderDisplayListToPdf(displayList);
          await deliverFile(pdfBytes, `${slug}.pdf`, 'application/pdf');
          setStatusMessage(`PDF exportado: ${slug}.pdf`);
        }
      } catch (err: any) {
        setStatusMessage(`Erro ao exportar PDF editável: ${err?.message ?? err}`);
      }
    },
    [sdoc?.name, eventName, underlayBytes, formValues, displayList]
  );

  const exportDocument = useCallback(
    async (kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml' | 'sdoc' | 'form-yaml') => {
      try {
        const slug = (sdoc?.name || eventName || 'sekundo-doc').trim();
        if (kind === 'sdoc') {
          await deliverFile(yamlText, `${slug}.sdoc.yaml`, 'text/yaml;charset=utf-8');
          return setStatusMessage(`Template salvo: ${slug}.sdoc.yaml`);
        }
        if (kind === 'form-yaml') {
          const formYaml = stringifyFormRecordYaml({
            form: 1,
            template: sdoc?.underlay?.source || slug,
            records: [{ id: 'rec_1', values: formValues }],
          });
          await deliverFile(formYaml, `${slug}.form.yaml`, 'text/yaml;charset=utf-8');
          return setStatusMessage(`Respostas salvas: ${slug}.form.yaml`);
        }
        const blobs: Record<string, Uint8Array> = {};
        if (sdoc?.underlay?.source && underlayBytes) blobs[sdoc.underlay.source] = underlayBytes;
        if (kind === 'pdf' && displayList) {
          const dataBytes = new TextEncoder().encode(JSON.stringify(formValues));
          const dataHash = await computeTemplateFingerprintSha256(dataBytes);
          const pdfBytes = await renderDisplayListToPdf(displayList, {
            blobs,
            provenance: { templateHash: sdoc?.underlay?.source, dataHash },
          });
          await deliverFile(pdfBytes, `${slug}.pdf`, 'application/pdf');
          return setStatusMessage(`Exportado com sucesso (Final Achatado): ${slug}.pdf`);
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
    [registry, yamlText, underlayBytes, displayList, formValues, sdoc?.name, sdoc?.underlay?.source, eventName]
  );

  return {
    yamlText, setYamlText: (val: string) => commitYamlChange(val, 'editor'),
    sdoc, parseError, displayList, layoutError, preflight, underlayDataUrl,
    formValues, updateFormField, hlcOps, exportHlcDelta, importHlcDelta,
    currentPageIndex, setCurrentPageIndex, selectedId, setSelectedId,
    snapMm, setSnapMm, showGrid, setShowGrid, showRulers, setShowRulers, zoom, setZoom,
    undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0,
    updatePrimitive, addPrimitive, loadBuiltinPreset, ingestPdfBytes, exportDocument,
    exportEditableAcroFormPdf: () => exportEditableAcroFormPdf(false),
    exportUnsignedCopy: () => exportEditableAcroFormPdf(true),
    ingestionStage, statusMessage, setStatusMessage,
  };
}
