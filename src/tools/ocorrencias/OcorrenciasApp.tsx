import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import './ocorrencias.css';
import { TemplateMapper } from './TemplateMapper';
import { SignaturePadModal } from './SignaturePadModal';
import {
  DEFAULT_OCORRENCIA_FIELD_SPECS,
  TemplateVaultService,
  autoDiscoverOcorrenciaFields,
  computeTemplateFingerprintSha256,
  docSpecToLegacyMap,
  generateCleanRoomSampleTemplatePdfBytes,
  renderOcorrenciaToPdfBytes,
  runOcorrenciaPreflight,
  solveOcorrenciaDisplayList,
  type OcorrenciaDocSpec,
} from './engine';
import {
  formalizeTextWithAI,
  parseCsvBatchRecords,
  resolveApiBaseUrl,
  type FormalizeResult,
} from './services/formalizerClient';
import { executeBatchMailMergeWithWorker } from './services/batchWorkerClient';

const API_BASE = resolveApiBaseUrl();

/** Returns today's date as DD/MM/YYYY. */
function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1
  ).padStart(2, '0')}/${d.getFullYear()}`;
}

type Status = 'idle' | 'loading' | 'success' | 'error';
type StudioTab = 'single' | 'batch';

function createInitialDocSpec(fileName = 'template_ocorrencia.pdf'): OcorrenciaDocSpec {
  return {
    version: 2,
    name: fileName,
    sha256: '',
    pageCount: 1,
    pages: [{ widthMm: 210, heightMm: 297 }],
    fields: DEFAULT_OCORRENCIA_FIELD_SPECS.map((f) => ({
      ...f,
      rect: [...f.rect] as [number, number, number, number],
    })),
  };
}

const SAMPLE_CSV_BATCH = `nome_aluno;turma;data;telefone;descricao_ocorrencia;checkbox_orientacao_aluno;checkbox_convocar_responsavel;compromissos_firmados;responsavel_registro
Participante A (Matrícula 0001);Turma A-01;${todayBR()};(00) 00000-0001;Registra-se que durante a sessão letiva o participante utilizou dispositivo eletrônico fora do protocolo pedagógico acordado, comprometendo a realização dos exercícios propostos.;sim;nao;O participante comprometeu-se a manter o dispositivo acondicionado durante todo o período letivo.;Coordenação Pedagógica Alfa
Participante B (Matrícula 0002);Turma A-01;${todayBR()};(00) 00000-0002;Registra-se que no intervalo recreativo houve divergência verbal entre integrantes da turma, sendo realizada mediação imediata pela equipe de apoio escolar.;sim;sim;Realizada mediação restaurativa e agendado atendimento de acompanhamento com os responsáveis legais.;Coordenação Pedagógica Alfa
Participante C (Matrícula 0003);Turma B-02;${todayBR()};(00) 00000-0003;O participante compareceu com atraso ao início do segundo período de aula, necessitando alinhamento quanto ao registro das atividades curriculares.;sim;nao;Orientado quanto à pontualidade regimental e reposição integral das atividades em aberto.;Operador Pedagógico 01`;

export function OcorrenciasApp() {
  // ── Pre-flight ping (cold-start mitigation) ──
  useEffect(() => {
    fetch(`${API_BASE}/api/health`).catch(() => {});
  }, []);

  // ── PDF Binary & Canonical DocSpec State ──
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfjsDoc, setPdfjsDoc] = useState<any>(null);
  const [docSpec, setDocSpec] = useState<OcorrenciaDocSpec>(() =>
    createInitialDocSpec()
  );
  const [vaultStatus, setVaultStatus] = useState<'matched' | 'saved' | 'new'>('new');
  const isVaultMatchedRef = useRef<boolean>(false);
  const hasRunInitialDiscoveryRef = useRef<boolean>(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('nome_aluno');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Studio Mode (Single Student vs CSV Mail-Merge Batch) ──
  const [studioTab, setStudioTab] = useState<StudioTab>('single');

  // ── Unified Form Values (All 9 canonical fields + custom fields) ──
  const [values, setValues] = useState<Record<string, string | boolean | undefined>>({
    nome_aluno: '',
    turma: '',
    data: todayBR(),
    telefone: '',
    responsavel_registro: '',
    descricao_ocorrencia: '',
    checkbox_orientacao_aluno: true,
    checkbox_convocar_responsavel: false,
    compromissos_firmados: '',
  });

  // ── AI Pedagogical Formalizer State (Human-in-the-Loop Diff Review) ──
  const [formalizingField, setFormalizingField] = useState<
    'descricao_ocorrencia' | 'compromissos_firmados' | null
  >(null);
  const [aiStatusText, setAiStatusText] = useState<string>('');
  const [aiReviewProposal, setAiReviewProposal] = useState<{
    fieldId: 'descricao_ocorrencia' | 'compromissos_firmados';
    result: FormalizeResult;
  } | null>(null);

  // ── CSV Mail-Merge Batch State ──
  const [csvRawText, setCsvRawText] = useState<string>('');
  const batchRecords = useMemo(() => parseCsvBatchRecords(csvRawText), [csvRawText]);
  const [batchProgress, setBatchProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  // ── Vector Handwritten Signature Modal State (Phase 2) ──
  const [signatureModalTarget, setSignatureModalTarget] = useState<{
    fieldId: string;
    fieldLabel: string;
  } | null>(null);

  // ── Export & Notification State ──
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // ── Load PDF File into Memory & Run SHA-256 Vault Lookup / Auto-Discovery ──
  const loadPdfFile = useCallback(async (selectedFile: File) => {
    setStatus('idle');
    setMessage('');
    hasRunInitialDiscoveryRef.current = false;

    try {
      const arrayBuf = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const sha256 = await computeTemplateFingerprintSha256(bytes);
      const cachedSpec = TemplateVaultService.getBySha256(sha256);

      if (cachedSpec) {
        isVaultMatchedRef.current = true;
        hasRunInitialDiscoveryRef.current = true;
        setDocSpec({
          ...cachedSpec,
          name: selectedFile.name,
          sha256,
        });
        setVaultStatus('matched');
      } else {
        isVaultMatchedRef.current = false;
        const discovered = await autoDiscoverOcorrenciaFields(
          bytes,
          undefined,
          selectedFile.name
        );
        setDocSpec(discovered);
        TemplateVaultService.save(discovered);
        setVaultStatus('new');
      }

      setPdfBytes(bytes);
      setFile(selectedFile);
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error
          ? `Erro ao inspecionar PDF: ${err.message}`
          : 'Erro ao ler o arquivo PDF.'
      );
    }
  }, []);

  // Re-run client-side anchor discovery when pdf.js finishes parsing text items (only once per non-cached upload)
  const handlePdfDocumentLoaded = useCallback(
    async (loadedPdfProxy: any) => {
      setPdfjsDoc(loadedPdfProxy);
      if (!pdfBytes || !file) return;
      if (
        isVaultMatchedRef.current ||
        vaultStatus === 'matched' ||
        hasRunInitialDiscoveryRef.current
      ) {
        return;
      }
      hasRunInitialDiscoveryRef.current = true;

      try {
        const discovered = await autoDiscoverOcorrenciaFields(
          pdfBytes,
          loadedPdfProxy,
          file.name
        );
        setDocSpec(discovered);
        TemplateVaultService.save(discovered);
      } catch {
        // Non-fatal
      }
    },
    [pdfBytes, file, vaultStatus]
  );

  const handleManualAutoDiscover = useCallback(async () => {
    if (!pdfBytes || !file) return;
    try {
      isVaultMatchedRef.current = false;
      const discovered = await autoDiscoverOcorrenciaFields(
        pdfBytes,
        pdfjsDoc,
        file.name
      );
      const hasActiveSig = String(values.assinatura_responsavel || '').startsWith(
        'sigv1:'
      );
      const mergedFields = [...discovered.fields];
      if (
        hasActiveSig &&
        !mergedFields.some((f) => f.id === 'assinatura_responsavel')
      ) {
        const existingSig = docSpec.fields.find(
          (f) => f.id === 'assinatura_responsavel'
        );
        mergedFields.push(
          existingSig || {
            id: 'assinatura_responsavel',
            label: 'Assinatura / Rubrica Vetorial',
            type: 'signature',
            page: 1,
            rect: [122.0, 242.5, 52.0, 12.0],
            fontSizePt: 10,
            minFontSizePt: 6.5,
            weight: 'normal',
            align: 'left',
            color: '#0F296B',
            backgroundMode: 'transparent',
            source: 'manual',
          }
        );
      }
      const nextSpec: OcorrenciaDocSpec = {
        ...discovered,
        fields: mergedFields,
      };
      setDocSpec(nextSpec);
      TemplateVaultService.save(nextSpec);
      setVaultStatus('saved');
      setStatus('success');
      setMessage(
        'Auto-detecção concluída! Verifique as caixas no preview ao lado e arraste se desejar ajustar.'
      );
    } catch {
      // Ignore
    }
  }, [pdfBytes, pdfjsDoc, file, values.assinatura_responsavel, docSpec.fields]);

  const handleResetToDefaults = useCallback(() => {
    if (!file) return;
    isVaultMatchedRef.current = false;
    const baseSpec = createInitialDocSpec(file.name);
    const hasActiveSig = String(values.assinatura_responsavel || '').startsWith(
      'sigv1:'
    );
    const nextFields = [...baseSpec.fields];
    if (
      hasActiveSig &&
      !nextFields.some((f) => f.id === 'assinatura_responsavel')
    ) {
      nextFields.push({
        id: 'assinatura_responsavel',
        label: 'Assinatura / Rubrica Vetorial',
        type: 'signature',
        page: 1,
        rect: [122.0, 242.5, 52.0, 12.0],
        fontSizePt: 10,
        minFontSizePt: 6.5,
        weight: 'normal',
        align: 'left',
        color: '#0F296B',
        backgroundMode: 'transparent',
        source: 'manual',
      });
    }
    const resetSpec: OcorrenciaDocSpec = {
      ...baseSpec,
      fields: nextFields,
      sha256: docSpec.sha256,
      pageCount: docSpec.pageCount,
      pages: docSpec.pages,
    };
    setDocSpec(resetSpec);
    TemplateVaultService.save(resetSpec);
    setVaultStatus('saved');
  }, [
    file,
    docSpec.sha256,
    docSpec.pageCount,
    docSpec.pages,
    values.assinatura_responsavel,
  ]);

  const handleUpdateDocSpec = useCallback(
    (updater: (prev: OcorrenciaDocSpec) => OcorrenciaDocSpec) => {
      setDocSpec((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (next.sha256) {
          TemplateVaultService.save(next);
        }
        // Only transition from 'matched' to 'saved' if the user explicitly modified fields
        if (next.fields !== prev.fields) {
          setVaultStatus((curr) => (curr === 'matched' ? 'matched' : 'saved'));
        }
        return next;
      });
    },
    []
  );

  // ── Solve DisplayList & Preflight in Real Time (< 2ms) ──
  const displayList = useMemo(
    () => solveOcorrenciaDisplayList(docSpec, values),
    [docSpec, values]
  );

  const preflight = useMemo(
    () => runOcorrenciaPreflight(docSpec, displayList, values),
    [docSpec, displayList, values]
  );

  // ── Drag & Drop Handlers ──
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped && dropped.type === 'application/pdf') {
        loadPdfFile(dropped);
      } else {
        setMessage('Por favor, envie um arquivo PDF válido.');
        setStatus('error');
      }
    },
    [loadPdfFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) loadPdfFile(selected);
    },
    [loadPdfFile]
  );

  const removeFile = useCallback(() => {
    setFile(null);
    setPdfBytes(null);
    setPdfjsDoc(null);
    setStatus('idle');
    setMessage('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const setFieldValue = (fieldId: string, val: string | boolean) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  // ── AI Pedagogical Formalizer Handler ──
  const handleFormalizeWithAI = async (
    targetField: 'descricao_ocorrencia' | 'compromissos_firmados'
  ) => {
    const currentText = String(values[targetField] || '').trim();
    if (!currentText) {
      setStatus('error');
      setMessage(
        'Digite primeiro um rascunho ou relato informal no campo para que a IA possa formalizá-lo.'
      );
      return;
    }

    setFormalizingField(targetField);
    setAiStatusText('Reescrevendo em linguagem técnica pedagógica...');
    try {
      const res = await formalizeTextWithAI(
        currentText,
        targetField === 'compromissos_firmados' ? 'compromissos' : 'descricao',
        String(values.nome_aluno || ''),
        (msg) => setAiStatusText(msg)
      );
      setAiReviewProposal({ fieldId: targetField, result: res });
    } finally {
      setFormalizingField(null);
      setAiStatusText('');
    }
  };

  const handleAcceptAiProposal = () => {
    if (!aiReviewProposal) return;
    setFieldValue(
      aiReviewProposal.fieldId,
      aiReviewProposal.result.formalizedText
    );
    setAiReviewProposal(null);
  };

  // ── Primary Export: Instant Client-Side Vector PDF (`pdf-lib`) ──
  const handleInstantClientExport = async () => {
    if (!pdfBytes || !file) return;

    setStatus('loading');
    setMessage('');
    try {
      const t0 = performance.now();
      const stampedBytes = await renderOcorrenciaToPdfBytes(
        pdfBytes,
        docSpec,
        values,
        displayList,
        {
          flatten: true,
          stripSignatures: Boolean(docSpec.security?.hasSignature),
        }
      );
      const elapsedMs = Math.round(performance.now() - t0);

      const safeBytes = new Uint8Array(stampedBytes.byteLength);
      safeBytes.set(stampedBytes);
      const blob = new Blob([safeBytes.buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const studentSlug = String(values.nome_aluno || 'estudante')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `ocorrencia_${studentSlug || 'gerada'}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus('success');
      setMessage(
        `PDF vetorial gerado no navegador em ${elapsedMs}ms! Download iniciado com 100% de fidelidade.`
      );
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error
          ? `Erro na geração vetorial client-side: ${err.message}`
          : 'Erro ao gerar PDF no navegador.'
      );
    }
  };

  // ── Secondary Export: Backend Python PyMuPDF Fallback ──
  const handleServerFallbackExport = async () => {
    if (!file) return;

    setStatus('loading');
    setMessage('');

    const legacyMap = docSpecToLegacyMap(docSpec);
    const formData = new FormData();
    formData.append('template_pdf', file);
    formData.append('template_map_json', JSON.stringify(legacyMap));

    for (const field of docSpec.fields) {
      const val = values[field.id];
      if (field.type === 'checkbox') {
        formData.append(field.id, val === true || val === 'true' ? 'true' : 'false');
      } else {
        formData.append(field.id, String(val ?? '').trim());
      }
    }
    // Legacy compatibility keys expected by older backend versions
    formData.append(
      'checkbox_orientacao',
      String(Boolean(values.checkbox_orientacao_aluno))
    );
    formData.append(
      'checkbox_convocar',
      String(Boolean(values.checkbox_convocar_responsavel))
    );

    try {
      const res = await fetch(`${API_BASE}/api/ocorrencias/gerar`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Erro HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ocorrencia_gerada_servidor.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus('success');
      setMessage('Ocorrência gerada via servidor PyMuPDF com sucesso!');
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error
          ? `${err.message} (Dica: use o botão "⚡ Baixar PDF Instantâneo" que funciona 100% offline no navegador).`
          : 'Erro ao comunicar com o servidor.'
      );
    }
  };

  // ── Vector Handwritten Signature Handler (Phase 2) ──
  const handleApplySignatureVector = (encodedSig: string) => {
    if (!signatureModalTarget) return;
    const { fieldId, fieldLabel } = signatureModalTarget;
    handleUpdateDocSpec((prev) => {
      if (prev.fields.some((f) => f.id === fieldId)) {
        return prev;
      }
      return {
        ...prev,
        fields: [
          ...prev.fields,
          {
            id: fieldId,
            label: fieldLabel,
            type: 'signature',
            page: 1,
            rect: [122.0, 242.5, 52.0, 12.0],
            fontSizePt: 10,
            minFontSizePt: 6.5,
            weight: 'normal',
            align: 'left',
            color: '#0F296B',
            backgroundMode: 'transparent',
            source: 'manual',
          },
        ],
      };
    });
    setFieldValue(fieldId, encodedSig);
    setSelectedFieldId(fieldId);
  };

  // ── Batch Export: CSV Mail-Merge via Dedicated Web Worker (`executeBatchMailMergeWithWorker`) ──
  const handleBatchMailMergeExport = async () => {
    if (!pdfBytes || batchRecords.length === 0) return;

    setStatus('loading');
    setMessage('');
    setBatchProgress({ completed: 0, total: batchRecords.length });
    try {
      const t0 = performance.now();
      const sessionSig = String(values.assinatura_responsavel || '');
      const sessionResp = String(values.responsavel_registro || '');
      const enrichedRecords = batchRecords.map((rec) => ({
        ...rec,
        assinatura_responsavel: rec.assinatura_responsavel || sessionSig || '',
        responsavel_registro: rec.responsavel_registro || sessionResp || '',
      }));

      let effectiveDocSpec = docSpec;
      if (
        sessionSig.startsWith('sigv1:') &&
        !docSpec.fields.some((f) => f.id === 'assinatura_responsavel')
      ) {
        effectiveDocSpec = {
          ...docSpec,
          fields: [
            ...docSpec.fields,
            {
              id: 'assinatura_responsavel',
              label: 'Assinatura / Rubrica Vetorial',
              type: 'signature',
              page: 1,
              rect: [122.0, 242.5, 52.0, 12.0],
              fontSizePt: 10,
              minFontSizePt: 6.5,
              weight: 'normal',
              align: 'left',
              color: '#0F296B',
              backgroundMode: 'transparent',
              source: 'manual',
            },
          ],
        };
      }

      const { pdfBytes: mergedBytes, pageCount, usedWorker } =
        await executeBatchMailMergeWithWorker(
          pdfBytes,
          effectiveDocSpec,
          enrichedRecords,
          (completed, total) => {
            setBatchProgress({ completed, total });
          }
        );
      const elapsedMs = Math.round(performance.now() - t0);

      const safeBytes = new Uint8Array(mergedBytes.byteLength);
      safeBytes.set(mergedBytes);
      const blob = new Blob([safeBytes.buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `lote_ocorrencias_${batchRecords.length}_alunos.pdf`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus('success');
      setMessage(
        `Lote de ${batchRecords.length} ocorrências (${pageCount} páginas) gerado em ${elapsedMs}ms com compartilhamento vetorial Form XObject${usedWorker ? ' (Web Worker Assíncrono)' : ''}!`
      );
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error
          ? `Erro ao gerar lote CSV: ${err.message}`
          : 'Erro ao processar lote CSV.'
      );
    } finally {
      setBatchProgress(null);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const csvFile = e.target.files?.[0];
    if (!csvFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvRawText(String(ev.target?.result || ''));
    };
    reader.readAsText(csvFile);
    e.target.value = '';
  };

  // Categorize fields for clean progressive UI rendering (exclude canonical assinatura_responsavel since its trigger button is inside responsavel_registro)
  const shortFields = docSpec.fields.filter(
    (f) =>
      f.type !== 'textarea' &&
      f.type !== 'checkbox' &&
      f.id !== 'assinatura_responsavel'
  );
  const checkboxFields = docSpec.fields.filter((f) => f.type === 'checkbox');
  const textareaFields = docSpec.fields.filter((f) => f.type === 'textarea');

  const dropzoneClass = [
    'oc-dropzone',
    dragActive ? 'oc-dropzone--active' : '',
    file ? 'oc-dropzone--has-file' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* ── Hero ── */}
      <div className="hero">
        <p className="hero__eyebrow">Laboratório · Ferramentas Educacionais</p>
        <h1 className="hero__title">Gerador de Ocorrências 2.0</h1>
        <p className="hero__sub">
          Estúdio WYSIWYG em milímetros reais com Auto-Fit algorítmico,
          formalização pedagógica via IA e carimbo vetorial instantâneo no navegador.
        </p>
      </div>

      <div className={`oc-page ${file ? 'oc-page--wide' : ''}`}>
        {/* ── Step 1: File Upload Dropzone (Compact when file is loaded) ── */}
        <div
          className={dropzoneClass}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {!file ? (
            <>
              <span className="oc-dropzone__icon">📄</span>
              <span className="oc-dropzone__label">
                Arraste o <strong>template.pdf</strong> da instituição aqui ou clique para selecionar
              </span>
              <span className="oc-dropzone__hint">
                Detecção automática de campos AcroForm + Âncoras · Reconhecimento instantâneo via SHA-256
              </span>
              <button
                type="button"
                data-testid="load-synthetic-template-btn"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const bytes = await generateCleanRoomSampleTemplatePdfBytes();
                  const syntheticFile = new File(
                    [bytes.buffer as ArrayBuffer],
                    'modelo_ocorrencia_sintetico_a4.pdf',
                    { type: 'application/pdf' }
                  );
                  await loadPdfFile(syntheticFile);
                }}
                style={{
                  position: 'relative',
                  zIndex: 5,
                  marginTop: '10px',
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '999px',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  background: 'rgba(14, 165, 233, 0.14)',
                  color: '#7dd3fc',
                  cursor: 'pointer',
                }}
              >
                ✨ Ou Gerar Modelo PDF Sintético Padrão (100% em Memória)
              </button>
            </>
          ) : (
            <div className="oc-dropzone__file-info">
              <span>✅</span>
              <span className="oc-dropzone__file-name">{file.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                ({(file.size / 1024).toFixed(1)} KB · {docSpec.pageCount} pág ·{' '}
                {docSpec.pages[0]?.widthMm || 210}×{docSpec.pages[0]?.heightMm || 297}mm)
              </span>
              <button
                type="button"
                className="oc-dropzone__file-remove"
                onClick={removeFile}
                title="Trocar arquivo PDF"
              >
                ✕ Trocar PDF
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
          />
        </div>

        {/* ── Step 2: Split-Screen Interactive Studio (Left: Form & AI / Right: Live PDF Preview) ── */}
        {file && (
          <div className="oc-studio-grid">
            {/* ── LEFT PANE: Form Inputs, AI Formalizer, Preflight & Export ── */}
            <div className="oc-studio-left">
              {/* Mode Tabs: Individual vs Batch Mail-Merge */}
              <div className="oc-mode-tabs">
                <button
                  type="button"
                  className={`oc-mode-tab ${
                    studioTab === 'single' ? 'oc-mode-tab--active' : ''
                  }`}
                  onClick={() => setStudioTab('single')}
                >
                  📝 Preenchimento Individual (Live Preview)
                </button>
                <button
                  type="button"
                  className={`oc-mode-tab ${
                    studioTab === 'batch' ? 'oc-mode-tab--active' : ''
                  }`}
                  onClick={() => setStudioTab('batch')}
                >
                  📦 Lote por Turma (CSV Mail-Merge)
                </button>
              </div>

              {studioTab === 'single' ? (
                <form
                  className="oc-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleInstantClientExport();
                  }}
                >
                  {/* 1. Identification & Short Fields */}
                  <div className="oc-section-card">
                    <div className="oc-section-card__header">
                      <h3>1. Dados de Identificação</h3>
                      <span className="oc-section-card__badge">
                        Clique em um campo para destacá-lo no PDF →
                      </span>
                    </div>

                    <div className="oc-form__row">
                      {shortFields.map((field) => {
                        const isSelected = selectedFieldId === field.id;
                        const isSignatureField = field.type === 'signature';
                        const hasSignatureVector = String(
                          values[field.id] || ''
                        ).startsWith('sigv1:');

                        return (
                          <div
                            key={field.id}
                            className={`oc-field ${
                              isSelected ? 'oc-field--selected' : ''
                            }`}
                          >
                            <label
                              className={`oc-field__label ${
                                field.required ? 'oc-field__label--required' : ''
                              }`}
                            >
                              {field.label}
                            </label>

                            {isSignatureField ? (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.45rem',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <button
                                  type="button"
                                  className="oc-ai-btn"
                                  onClick={() => {
                                    setSelectedFieldId(field.id);
                                    setSignatureModalTarget({
                                      fieldId: field.id,
                                      fieldLabel: field.label,
                                    });
                                  }}
                                >
                                  {hasSignatureVector
                                    ? '✍️ Atualizar Rubrica Vetorial'
                                    : '✍️ Coletar Assinatura Vetorial'}
                                </button>
                                {hasSignatureVector && (
                                  <button
                                    type="button"
                                    className="oc-toolbar-btn"
                                    onClick={() => setFieldValue(field.id, '')}
                                  >
                                    🗑️ Limpar
                                  </button>
                                )}
                              </div>
                            ) : (
                              <>
                                <input
                                  className="oc-field__input"
                                  type="text"
                                  placeholder={`Preencher ${field.label.toLowerCase()}...`}
                                  value={String(values[field.id] ?? '')}
                                  onFocus={() => setSelectedFieldId(field.id)}
                                  onChange={(e) =>
                                    setFieldValue(field.id, e.target.value)
                                  }
                                />
                                {field.id === 'responsavel_registro' && (
                                  <div
                                    style={{
                                      marginTop: '0.4rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.45rem',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="oc-ai-btn"
                                      data-testid="open-signature-pad-btn"
                                      onClick={() =>
                                        setSignatureModalTarget({
                                          fieldId: 'assinatura_responsavel',
                                          fieldLabel:
                                            'Assinatura / Rubrica Vetorial',
                                        })
                                      }
                                    >
                                      {String(
                                        values.assinatura_responsavel || ''
                                      ).startsWith('sigv1:')
                                        ? '✓ Rubrica Vetorial Ativa (Editar)'
                                        : '✍️ Assinar Digitalmente (Rubrica Vetorial)'}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Encaminhamentos Pedagógicos (Checkboxes — Fixed!) */}
                  {checkboxFields.length > 0 && (
                    <div className="oc-section-card">
                      <div className="oc-section-card__header">
                        <h3>2. Medidas e Encaminhamentos (Checkboxes)</h3>
                        <span className="oc-section-card__badge">
                          Marca [X] em tempo real no PDF
                        </span>
                      </div>

                      <div className="oc-checkboxes">
                        {checkboxFields.map((cbField) => {
                          const checked = Boolean(values[cbField.id]);
                          const isSelected = selectedFieldId === cbField.id;
                          return (
                            <label
                              key={cbField.id}
                              className={`oc-checkbox ${
                                checked ? 'oc-checkbox--checked' : ''
                              } ${isSelected ? 'oc-checkbox--focused' : ''}`}
                              onClick={() => setSelectedFieldId(cbField.id)}
                            >
                              <span className="oc-checkbox__box">
                                {checked && (
                                  <span className="oc-checkbox__check">✓</span>
                                )}
                              </span>
                              <span className="oc-checkbox__label">
                                {cbField.label.replace(/^\[X\]\s*/i, '')}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setFieldValue(cbField.id, e.target.checked)
                                }
                                style={{ display: 'none' }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3. Multi-line Narratives + AI Pedagogical Formalizer + Auto-Fit Telemetry */}
                  <div className="oc-section-card">
                    <div className="oc-section-card__header">
                      <h3>3. Relato Pedagógico e Compromissos</h3>
                      <span className="oc-section-card__badge">
                        Auto-Fit Bisseccional + Folha Anexa Automática
                      </span>
                    </div>

                    {textareaFields.map((tField) => {
                      const metrics = displayList.fieldMetrics[tField.id];
                      const supportsAi =
                        tField.id === 'descricao_ocorrencia' ||
                        tField.id === 'compromissos_firmados';
                      const isFormalizingThis = formalizingField === tField.id;
                      const activeProposal =
                        aiReviewProposal?.fieldId === tField.id
                          ? aiReviewProposal
                          : null;

                      return (
                        <div
                          key={tField.id}
                          className={`oc-field ${
                            selectedFieldId === tField.id
                              ? 'oc-field--selected'
                              : ''
                          }`}
                        >
                          <div className="oc-textarea-header">
                            <label
                              className={`oc-field__label ${
                                tField.required
                                  ? 'oc-field__label--required'
                                  : ''
                              }`}
                            >
                              {tField.label}
                            </label>

                            <div className="oc-textarea-actions">
                              {metrics && (
                                <span
                                  className={`oc-autofit-pill ${
                                    metrics.overflowed
                                      ? 'oc-autofit-pill--error'
                                      : metrics.continuedOnAnnex ||
                                        metrics.autoFitted
                                      ? 'oc-autofit-pill--warn'
                                      : ''
                                  }`}
                                  title="Telemetria do motor de Auto-Fit e Paginação Automática em tempo real"
                                >
                                  {metrics.overflowed
                                    ? `⚠ Excedeu caixa (${metrics.fontSizePt}pt)`
                                    : metrics.continuedOnAnnex
                                    ? `📄 +Folha Anexa Automática (Pág. 2 · +${
                                        metrics.continuationLineCount || 0
                                      } linhas)`
                                    : metrics.autoFitted
                                    ? `✨ Auto-Fit: ${metrics.fontSizePt}pt (${metrics.lineCount} linhas)`
                                    : `${metrics.fontSizePt}pt · ${metrics.lineCount} linhas`}
                                </span>
                              )}

                              {supportsAi && (
                                <button
                                  type="button"
                                  className="oc-ai-btn"
                                  disabled={isFormalizingThis}
                                  onClick={() =>
                                    handleFormalizeWithAI(
                                      tField.id as
                                        | 'descricao_ocorrencia'
                                        | 'compromissos_firmados'
                                    )
                                  }
                                >
                                  {isFormalizingThis
                                    ? `⏳ ${aiStatusText || 'Formalizando...'}`
                                    : '✨ Formalizar com IA Pedagógica'}
                                </button>
                              )}
                            </div>
                          </div>

                          <textarea
                            className="oc-field__input"
                            rows={tField.id === 'descricao_ocorrencia' ? 5 : 3}
                            placeholder={
                              tField.id === 'descricao_ocorrencia'
                                ? 'Escreva o relato informal (ex: "No recreio o aluno ficou bagunçando e mexendo no celular...") e clique em "✨ Formalizar com IA Pedagógica"'
                                : 'Descreva os combinados e encaminhamentos firmados com o estudante e/ou responsáveis...'
                            }
                            value={String(values[tField.id] ?? '')}
                            onFocus={() => setSelectedFieldId(tField.id)}
                            onChange={(e) =>
                              setFieldValue(tField.id, e.target.value)
                            }
                          />

                          {/* Human-in-the-Loop AI Pedagogical Diff Card */}
                          {activeProposal && (
                            <div className="oc-ai-review-card fade-in">
                              <div className="oc-ai-review-card__top">
                                <strong>
                                  ✨ Sugestão de Redação Pedagógica Formal (
                                  {activeProposal.result.provider === 'gemini'
                                    ? 'Gemini 2.0 Flash'
                                    : 'Motor Institucional Local'}
                                  )
                                </strong>
                                {activeProposal.result.notice && (
                                  <span className="oc-ai-review-card__notice">
                                    {activeProposal.result.notice}
                                  </span>
                                )}
                              </div>
                              <p className="oc-ai-review-card__text">
                                {activeProposal.result.formalizedText}
                              </p>
                              <div className="oc-ai-review-card__actions">
                                <button
                                  type="button"
                                  className="oc-ai-accept-btn"
                                  onClick={handleAcceptAiProposal}
                                >
                                  ✓ Aplicar Texto Formalizado no PDF
                                </button>
                                <button
                                  type="button"
                                  className="oc-ai-cancel-btn"
                                  onClick={() => setAiReviewProposal(null)}
                                >
                                  Manter Rascunho Original
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 4. Real-Time Preflight Gate Banner */}
                  {preflight.issues.length > 0 && (
                    <div className="oc-preflight-panel">
                      <div className="oc-preflight-panel__title">
                        🛡️ Diagnóstico Preflight em Tempo Real (
                        {displayList.stats.ms}ms)
                      </div>
                      <ul className="oc-preflight-list">
                        {preflight.issues.map((issue, idx) => (
                          <li
                            key={`${issue.code}-${idx}`}
                            className={`oc-preflight-item oc-preflight-item--${issue.severity}`}
                            onClick={() =>
                              issue.fieldId && setSelectedFieldId(issue.fieldId)
                            }
                          >
                            <span>
                              {issue.severity === 'error'
                                ? '⛔'
                                : issue.severity === 'warning'
                                ? '⚠️'
                                : 'ℹ️'}
                            </span>
                            <span>{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 5. Dual Export Action Bar */}
                  <div className="oc-submit">
                    <button
                      type="submit"
                      className="oc-submit__btn"
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? (
                        <>
                          <span className="oc-spinner" />
                          Processando PDF...
                        </>
                      ) : (
                        <>⚡ Baixar PDF Carimbado (Instantâneo no Navegador)</>
                      )}
                    </button>

                    <button
                      type="button"
                      className="oc-submit__btn-secondary"
                      disabled={status === 'loading'}
                      onClick={handleServerFallbackExport}
                      title="Envia o PDF e o mapa de coordenadas para o backend Python (PyMuPDF)"
                    >
                      ☁️ Gerar via Servidor Python
                    </button>
                  </div>
                </form>
              ) : (
                /* ── TAB 2: CSV Mail-Merge Batch Mode ── */
                <div className="oc-batch-panel fade-in">
                  <div className="oc-section-card">
                    <div className="oc-section-card__header">
                      <h3>📦 Geração em Lote por Turma (Mail-Merge Vetorial)</h3>
                      <span className="oc-section-card__badge">
                        Otimização Form XObject + Web Worker
                      </span>
                    </div>
                    <p className="oc-batch-desc">
                      Carregue uma planilha <strong>.CSV</strong> (separada por
                      ponto-e-vírgula ou vírgula) com os dados dos estudantes ou
                      teste agora mesmo com o exemplo abaixo. Todas as ocorrências
                      serão geradas em um único arquivo PDF pronto para impressão.
                    </p>

                    <div className="oc-batch-toolbar">
                      <label
                        className="oc-toolbar-btn oc-toolbar-btn--accent"
                        style={{ cursor: 'pointer' }}
                      >
                        📂 Enviar Arquivo .CSV
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          style={{ display: 'none' }}
                          onChange={handleCsvFileUpload}
                        />
                      </label>

                      <button
                        type="button"
                        className="oc-toolbar-btn"
                        onClick={() => setCsvRawText(SAMPLE_CSV_BATCH)}
                      >
                        ✨ Carregar Exemplo de Turma (3 Estudantes)
                      </button>

                      {csvRawText && (
                        <button
                          type="button"
                          className="oc-toolbar-btn"
                          onClick={() => {
                            if (batchRecords[0]) {
                              setValues((prev) => ({
                                ...prev,
                                ...batchRecords[0],
                              }));
                            }
                          }}
                        >
                          👁️ Visualizar 1º Aluno no PDF ao Lado
                        </button>
                      )}
                    </div>

                    <textarea
                      className="oc-field__input"
                      rows={6}
                      placeholder="Cole aqui o conteúdo CSV (cabeçalhos: nome_aluno;turma;data;telefone;descricao_ocorrencia;checkbox_orientacao_aluno;checkbox_convocar_responsavel;compromissos_firmados;responsavel_registro)..."
                      value={csvRawText}
                      onChange={(e) => setCsvRawText(e.target.value)}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    />

                    {batchRecords.length > 0 && (
                      <div className="oc-batch-preview">
                        <div className="oc-batch-preview__header">
                          ✓ <strong>{batchRecords.length} registros</strong>{' '}
                          prontos para carimbo em lote (clique em uma linha para
                          testar no preview ao lado):
                        </div>
                        <div className="oc-batch-table-wrap">
                          <table className="oc-batch-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Estudante</th>
                                <th>Turma</th>
                                <th>Data</th>
                                <th>Orient.</th>
                                <th>Convoc.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchRecords.map((rec, idx) => (
                                <tr
                                  key={idx}
                                  onClick={() =>
                                    setValues((prev) => ({ ...prev, ...rec }))
                                  }
                                  title="Clique para visualizar este estudante no PDF ao lado"
                                >
                                  <td>{idx + 1}</td>
                                  <td>{String(rec.nome_aluno || '—')}</td>
                                  <td>{String(rec.turma || '—')}</td>
                                  <td>{String(rec.data || '—')}</td>
                                  <td>
                                    {rec.checkbox_orientacao_aluno ? '✓' : '—'}
                                  </td>
                                  <td>
                                    {rec.checkbox_convocar_responsavel
                                      ? '✓'
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {batchProgress && (
                      <div
                        className="oc-batch-progress"
                        data-testid="batch-worker-progress"
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.6rem 0.85rem',
                          background: 'rgba(14, 165, 233, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          color: '#38bdf8',
                        }}
                      >
                        ⚡ Processando lote em Web Worker:{' '}
                        <strong>
                          {batchProgress.completed} / {batchProgress.total}
                        </strong>{' '}
                        ({Math.round((batchProgress.completed / Math.max(1, batchProgress.total)) * 100)}%)
                      </div>
                    )}

                    <div className="oc-submit" style={{ marginTop: 16 }}>
                      <button
                        type="button"
                        className="oc-submit__btn"
                        disabled={
                          batchRecords.length === 0 || status === 'loading'
                        }
                        onClick={handleBatchMailMergeExport}
                      >
                        ⚡ Gerar PDF Único da Turma ({batchRecords.length}{' '}
                        Ocorrências)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {status === 'error' && message && (
                <div className="oc-message oc-message--error fade-in">
                  <span>⚠</span> {message}
                </div>
              )}
              {status === 'success' && message && (
                <div className="oc-message oc-message--success fade-in">
                  <span>✅</span> {message}
                </div>
              )}
            </div>

            {/* ── RIGHT PANE: Always-Visible Interactive PDF Canvas & Millimeter SVG Overlay ── */}
            <div className="oc-studio-right">
              <TemplateMapper
                file={file}
                docSpec={docSpec}
                displayList={displayList}
                values={values}
                selectedFieldId={selectedFieldId}
                vaultStatus={vaultStatus}
                onSelectField={setSelectedFieldId}
                onUpdateDocSpec={handleUpdateDocSpec}
                onPdfDocumentLoaded={handlePdfDocumentLoaded}
                onAutoDiscoverRequest={handleManualAutoDiscover}
                onResetToDefaults={handleResetToDefaults}
              />
            </div>
          </div>
        )}

        {/* ── Vector Signature Capture Modal (Phase 2) ── */}
        <SignaturePadModal
          isOpen={Boolean(signatureModalTarget)}
          fieldLabel={signatureModalTarget?.fieldLabel || 'Rubrica Vetorial'}
          initialValue={
            signatureModalTarget
              ? String(values[signatureModalTarget.fieldId] || '')
              : ''
          }
          onClose={() => setSignatureModalTarget(null)}
          onApplySignature={handleApplySignatureVector}
        />

        {/* ── Privacy badge ── */}
        <div className="oc-privacy">
          <span className="oc-privacy__icon">🔒</span>
          <span className="oc-privacy__text">
            <strong>Arquitetura Zero-Storage & Client-Side Vector PDF:</strong> O
            carimbo instantâneo utiliza o motor vetorial <code>pdf-lib</code>{' '}
            diretamente na memória do seu navegador (0 bytes trafegados na rede). O
            mapa de coordenadas da sua escola é salvo localmente via impressão
            digital <strong>SHA-256</strong> para uso imediato nos próximos acessos.
          </span>
        </div>
      </div>
    </>
  );
}
