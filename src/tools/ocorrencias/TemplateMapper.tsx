import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './TemplateMapper.css';
import {
  DEFAULT_OCORRENCIA_FIELD_SPECS,
  TemplateVaultService,
  docSpecToLegacyMap,
  legacyMapToDocSpec,
  ptToMm,
  roundMm,
  type DisplayList,
  type FieldBackgroundMode,
  type Mm,
  type OcorrenciaDocSpec,
  type OcorrenciaFieldSpec,
  type OcorrenciaFieldType,
} from './engine';
import { OcorrenciasSvgOverlay } from './OcorrenciasSvgOverlay';

// ── Configure react-pdf worker for Vite ──
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface TemplateMapperProps {
  file: File;
  docSpec: OcorrenciaDocSpec;
  displayList: DisplayList;
  values?: Record<string, string | boolean | undefined>;
  selectedFieldId: string;
  vaultStatus?: 'matched' | 'saved' | 'new';
  onSelectField: (fieldId: string) => void;
  onUpdateDocSpec: (updater: (prev: OcorrenciaDocSpec) => OcorrenciaDocSpec) => void;
  onPdfDocumentLoaded?: (pdfjsDoc: any) => void;
  onAutoDiscoverRequest?: () => void;
  onResetToDefaults?: () => void;
}

export function TemplateMapper({
  file,
  docSpec,
  displayList,
  values = {},
  selectedFieldId,
  vaultStatus = 'new',
  onSelectField,
  onUpdateDocSpec,
  onPdfDocumentLoaded,
  onAutoDiscoverRequest,
  onResetToDefaults,
}: TemplateMapperProps) {
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.05);
  const [showFieldFrames, setShowFieldFrames] = useState<boolean>(true);
  const [drawModeActive, setDrawModeActive] = useState<boolean>(false);
  const [previewAnnexActive, setPreviewAnnexActive] = useState<boolean>(false);

  // New custom field creation state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<OcorrenciaFieldType>('text');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasContinuationAnnex = Boolean(
    displayList.continuationSections && displayList.continuationSections.length > 0
  );

  const selectedField =
    docSpec.fields.find((f) => f.id === selectedFieldId) || docSpec.fields[0];

  const currentPageGeom = docSpec.pages[pageNumber - 1] ||
    docSpec.pages[0] || { widthMm: 210, heightMm: 297 };

  const fieldsOnCurrentPage = docSpec.fields.filter(
    (f) => (f.page || 1) === pageNumber
  );

  const currentDisplayPage = displayList.pages.find(
    (p) => p.pageNumber === pageNumber
  );

  const handleFitToContainerWidth = useCallback(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const availPx = Math.max(220, cont.clientWidth - 36);
    const nextScale = Math.max(0.4, Math.min(2.0, +(availPx / 595.28).toFixed(2)));
    setScale(nextScale);
  }, []);

  useEffect(() => {
    const syncResponsiveScale = () => {
      const cont = containerRef.current;
      if (!cont) return;
      if (window.innerWidth <= 680 || cont.clientWidth < 600) {
        const availPx = Math.max(220, cont.clientWidth - 36);
        const fitScale = Math.max(0.4, Math.min(1.05, +(availPx / 595.28).toFixed(2)));
        setScale(fitScale);
      } else {
        setScale((prev) => (prev < 0.85 ? 1.05 : prev));
      }
    };
    syncResponsiveScale();
    window.addEventListener('resize', syncResponsiveScale);
    return () => window.removeEventListener('resize', syncResponsiveScale);
  }, []);

  function handleDocumentLoadSuccess(pdfProxy: any) {
    onPdfDocumentLoaded?.(pdfProxy);
  }

  function handlePageLoadSuccess(page: any) {
    if (page?.originalWidth && page?.originalHeight) {
      const wMm = roundMm(ptToMm(page.originalWidth));
      const hMm = roundMm(ptToMm(page.originalHeight));
      onUpdateDocSpec((prev) => {
        const existing = prev.pages[pageNumber - 1];
        if (
          existing &&
          Math.abs(existing.widthMm - wMm) < 0.2 &&
          Math.abs(existing.heightMm - hMm) < 0.2
        ) {
          return prev;
        }
        const nextPages = [...prev.pages];
        nextPages[pageNumber - 1] = { widthMm: wMm, heightMm: hMm };
        return { ...prev, pages: nextPages };
      });
    }
  }

  const handleUpdateFieldRect = useCallback(
    (fieldId: string, newRect: [Mm, Mm, Mm, Mm], targetPage: number) => {
      onUpdateDocSpec((prev) => ({
        ...prev,
        fields: prev.fields.map((f) =>
          f.id === fieldId
            ? { ...f, rect: newRect, page: targetPage, source: 'manual' }
            : f
        ),
      }));
    },
    [onUpdateDocSpec]
  );

  const handleUpdateSelectedFieldProp = <K extends keyof OcorrenciaFieldSpec>(
    key: K,
    value: OcorrenciaFieldSpec[K]
  ) => {
    if (!selectedField) return;
    onUpdateDocSpec((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.id === selectedField.id ? { ...f, [key]: value } : f
      ),
    }));
  };

  const handleSetAllBackgroundMode = (mode: FieldBackgroundMode) => {
    onUpdateDocSpec((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => ({ ...f, backgroundMode: mode })),
    }));
  };

  const handleAddCustomField = () => {
    const trimmed = newFieldName.trim();
    if (!trimmed) return;

    const id = trimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '');

    if (!id) return;
    if (docSpec.fields.some((f) => f.id === id)) {
      onSelectField(id);
      setNewFieldName('');
      return;
    }

    const defaultRect: [Mm, Mm, Mm, Mm] =
      newFieldType === 'checkbox'
        ? [25, 190, 5.5, 5.5]
        : newFieldType === 'textarea'
        ? [22, 130, 160, 35]
        : newFieldType === 'signature'
        ? [122, 242.5, 52, 12]
        : [40, 70, 65, 7.5];

    const newSpec: OcorrenciaFieldSpec = {
      id,
      label: trimmed,
      type: newFieldType,
      page: pageNumber,
      rect: defaultRect,
      fontSizePt: newFieldType === 'checkbox' ? 11 : 10,
      minFontSizePt: 6.5,
      weight: newFieldType === 'checkbox' ? 'bold' : 'normal',
      align: newFieldType === 'checkbox' ? 'center' : 'left',
      color: newFieldType === 'signature' ? '#0F296B' : '#0F172A',
      backgroundMode: 'transparent',
      source: 'manual',
    };

    onUpdateDocSpec((prev) => ({
      ...prev,
      fields: [...prev.fields, newSpec],
    }));
    onSelectField(id);
    setNewFieldName('');
  };

  const handleDeleteSelectedField = () => {
    if (!selectedField) return;
    const isCanonical = DEFAULT_OCORRENCIA_FIELD_SPECS.some(
      (f) => f.id === selectedField.id
    );
    if (isCanonical) {
      // Reset canonical field back to its default position instead of deleting it
      const def = DEFAULT_OCORRENCIA_FIELD_SPECS.find(
        (f) => f.id === selectedField.id
      );
      if (def) {
        handleUpdateFieldRect(def.id, [...def.rect] as [Mm, Mm, Mm, Mm], def.page);
      }
      return;
    }
    onUpdateDocSpec((prev) => {
      const remaining = prev.fields.filter((f) => f.id !== selectedField.id);
      return { ...prev, fields: remaining };
    });
    if (docSpec.fields.length > 1) {
      onSelectField(docSpec.fields[0].id);
    }
  };

  // ── Export / Import Map JSON (supports both Legacy PyMuPDF & v2 DocSpec) ──
  const handleExportMap = () => {
    const legacyCompatible = {
      ...docSpecToLegacyMap(docSpec),
      docSpecV2: docSpec,
    };
    const blob = new Blob([JSON.stringify(legacyCompatible, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapa_${file.name.replace(/\.pdf$/i, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const importedFile = e.target.files?.[0];
    if (!importedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const nextSpec = parsed?.docSpecV2
          ? legacyMapToDocSpec(parsed.docSpecV2, docSpec.sha256, file.name)
          : legacyMapToDocSpec(parsed, docSpec.sha256, file.name);
        onUpdateDocSpec(() => nextSpec);
        TemplateVaultService.save(nextSpec);
      } catch {
        alert('Não foi possível ler o arquivo JSON de mapeamento.');
      }
    };
    reader.readAsText(importedFile);
    e.target.value = '';
  };

  const selectedMetrics = selectedField
    ? displayList.fieldMetrics[selectedField.id]
    : undefined;

  const firstPageSigOp = displayList.pages[0]?.ops.find(
    (o) => o.kind === 'signature'
  );

  return (
    <div className="oc-mapper-studio">
      {/* ── Top Bar: Template Status, Zoom, Page & Actions ── */}
      <div className="oc-mapper-toolbar">
        <div className="oc-mapper-toolbar__group">
          <span
            className={`oc-vault-badge oc-vault-badge--${vaultStatus}`}
            title={`SHA-256: ${docSpec.sha256 || 'calculando...'}`}
          >
            {vaultStatus === 'matched'
              ? '⚡ Template Reconhecido (SHA-256)'
              : '💾 Mapa Salvo Automaticamente'}
          </span>

          {onAutoDiscoverRequest && (
            <button
              type="button"
              className="oc-toolbar-btn oc-toolbar-btn--accent"
              onClick={onAutoDiscoverRequest}
              title="Executar detecção automática de campos (AcroForm + Âncoras de Texto)"
            >
              🔍 Auto-Detectar
            </button>
          )}

          <button
            type="button"
            className={`oc-toolbar-btn ${
              showFieldFrames ? 'oc-toolbar-btn--active' : ''
            }`}
            onClick={() => setShowFieldFrames((v) => !v)}
            title="Alternar entre visualizar as caixas mapeadas ou ver o PDF limpo exatamente como será impresso"
          >
            {showFieldFrames ? '👁️ Molduras ON' : '📄 Visão Impressão'}
          </button>

          <button
            type="button"
            className={`oc-toolbar-btn ${
              drawModeActive ? 'oc-toolbar-btn--draw' : ''
            }`}
            onClick={() => setDrawModeActive((v) => !v)}
            title="Quando ativo, clique e arraste em qualquer área vazia do PDF para desenhar uma nova caixa para o campo selecionado"
          >
            {drawModeActive ? '✏️ Desenhar Caixa: ON' : '✋ Mover / Redimensionar'}
          </button>

          {hasContinuationAnnex && (
            <button
              type="button"
              data-testid="toggle-annex-preview-btn"
              className={`oc-toolbar-btn ${
                previewAnnexActive ? 'oc-toolbar-btn--active' : 'oc-toolbar-btn--accent'
              }`}
              onClick={() => setPreviewAnnexActive((v) => !v)}
              title="Alternar pré-visualização entre a Ficha Principal (Pág. 1) e a Folha Complementar Anexa (Pág. 2)"
            >
              {previewAnnexActive
                ? '📄 Voltar p/ Pág. 1'
                : '📑 Ver Folha Anexa (Pág. 2)'}
            </button>
          )}
        </div>

        <div className="oc-mapper-toolbar__group">
          {/* Zoom Controls (Zoom-Invariant Mm Engine!) */}
          <div className="oc-zoom-pill">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.45, +(s - 0.15).toFixed(2)))}
              title="Diminuir Zoom"
            >
              −
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)))}
              title="Aumentar Zoom"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleFitToContainerWidth}
              title="Ajustar largura da página ao tamanho da tela"
              style={{ fontSize: 11, padding: '2px 6px' }}
            >
              ↔
            </button>
          </div>

          {/* Pagination (includes dynamic Continuation Sheet pages) */}
          {(docSpec.pageCount > 1 || hasContinuationAnnex) && (
            <div className="oc-zoom-pill" data-testid="studio-pagination-pill">
              <button
                type="button"
                onClick={() => {
                  if (previewAnnexActive) {
                    setPreviewAnnexActive(false);
                  } else {
                    setPageNumber((p) => Math.max(1, p - 1));
                  }
                }}
                disabled={!previewAnnexActive && pageNumber <= 1}
              >
                ‹
              </button>
              <span>
                Pág {previewAnnexActive ? docSpec.pageCount + 1 : pageNumber}/
                {docSpec.pageCount + (hasContinuationAnnex ? 1 : 0)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (pageNumber < docSpec.pageCount) {
                    setPageNumber((p) => p + 1);
                  } else if (hasContinuationAnnex) {
                    setPreviewAnnexActive(true);
                  }
                }}
                disabled={
                  previewAnnexActive ||
                  (pageNumber >= docSpec.pageCount && !hasContinuationAnnex)
                }
              >
                ›
              </button>
            </div>
          )}

          <label className="oc-toolbar-btn" style={{ cursor: 'pointer' }}>
            📂 Importar JSON
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportMap}
            />
          </label>

          <button
            type="button"
            className="oc-toolbar-btn"
            onClick={handleExportMap}
          >
            ⬇ Exportar JSON
          </button>

          {onResetToDefaults && (
            <button
              type="button"
              className="oc-toolbar-btn"
              onClick={onResetToDefaults}
              title="Restaurar coordenadas padrão"
            >
              ↺ Padrão
            </button>
          )}
        </div>
      </div>

      {/* ── Second Bar: Selected Field Precision Inspector (Mm + Font + Background Mode) ── */}
      {selectedField && (
        <div className="oc-field-inspector">
          <div className="oc-field-inspector__left">
            <label className="oc-inspector-label">Campo Ativo:</label>
            <select
              className="oc-inspector-select"
              value={selectedField.id}
              onChange={(e) => {
                const nextId = e.target.value;
                onSelectField(nextId);
                setPreviewAnnexActive(false);
                const found = docSpec.fields.find((f) => f.id === nextId);
                if (found && found.page && found.page !== pageNumber) {
                  setPageNumber(found.page);
                }
              }}
            >
              {docSpec.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.type}) — [{f.rect[0]}×{f.rect[1]}mm]
                </option>
              ))}
            </select>

            <span className="oc-inspector-coords" title="Coordenadas Físicas em Milímetros (X, Y, Largura, Altura)">
              📐 {selectedField.rect[0]}mm, {selectedField.rect[1]}mm ·{' '}
              {selectedField.rect[2]}×{selectedField.rect[3]}mm
            </span>

            {selectedMetrics && (
              <span
                className={`oc-inspector-metric ${
                  selectedMetrics.overflowed
                    ? 'oc-inspector-metric--error'
                    : selectedMetrics.continuedOnAnnex || selectedMetrics.autoFitted
                    ? 'oc-inspector-metric--warn'
                    : ''
                }`}
                style={
                  selectedMetrics.continuedOnAnnex ? { cursor: 'pointer' } : undefined
                }
                onClick={() => {
                  if (selectedMetrics.continuedOnAnnex) {
                    setPreviewAnnexActive((v) => !v);
                  }
                }}
              >
                {selectedMetrics.overflowed
                  ? `⚠ Overflow (${selectedMetrics.fontSizePt}pt)`
                  : selectedMetrics.continuedOnAnnex
                  ? `📄 +Folha Anexa Pág. 2 (+${selectedMetrics.continuationLineCount || 0}L)`
                  : selectedMetrics.autoFitted
                  ? `✨ Auto-Fit ${selectedMetrics.fontSizePt}pt (${selectedMetrics.lineCount}L)`
                  : `${selectedMetrics.fontSizePt}pt · ${selectedMetrics.lineCount}L`}
              </span>
            )}
          </div>

          <div className="oc-field-inspector__right">
            {/* Font Size Control */}
            <label className="oc-inspector-mini">
              Fonte:
              <input
                type="number"
                min={6}
                max={20}
                step={0.5}
                value={selectedField.fontSizePt || 10}
                onChange={(e) =>
                  handleUpdateSelectedFieldProp(
                    'fontSizePt',
                    Math.max(6, Math.min(20, Number(e.target.value) || 10))
                  )
                }
              />
              pt
            </label>

            {/* Background Mode Toggle (Fixes Bug #4: Destructive Whiteout!) */}
            <button
              type="button"
              className={`oc-toolbar-btn ${
                selectedField.backgroundMode === 'whiteout'
                  ? 'oc-toolbar-btn--active'
                  : ''
              }`}
              onClick={() =>
                handleUpdateSelectedFieldProp(
                  'backgroundMode',
                  selectedField.backgroundMode === 'whiteout'
                    ? 'transparent'
                    : 'whiteout'
                )
              }
              title="Fundo Transparente preserva as linhas originais do PDF; Tarja Branca cobre o fundo (útil para PDFs escaneados)"
            >
              {selectedField.backgroundMode === 'whiteout'
                ? '⬜ Fundo: Tarja Branca'
                : '🔲 Fundo: Transparente'}
            </button>

            <button
              type="button"
              className="oc-toolbar-btn"
              onClick={() =>
                handleSetAllBackgroundMode(
                  selectedField.backgroundMode === 'whiteout'
                    ? 'transparent'
                    : 'whiteout'
                )
              }
              title="Alternar modo de fundo em todos os campos de uma vez"
            >
              Aplicar a Todos
            </button>

            <button
              type="button"
              className="oc-toolbar-btn"
              onClick={handleDeleteSelectedField}
              title="Restaurar posição padrão deste campo (ou excluir se for campo personalizado)"
            >
              ↺ Resetar Caixa
            </button>
          </div>
        </div>
      )}

      {/* ── Custom Field Creator Bar ── */}
      <div className="oc-custom-field-bar">
        <span className="oc-inspector-label">Adicionar Campo Extra:</span>
        <input
          type="text"
          placeholder="Ex: Matrícula, Período, Professor..."
          className="oc-custom-field-input"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomField()}
        />
        <select
          className="oc-inspector-select"
          value={newFieldType}
          onChange={(e) => setNewFieldType(e.target.value as OcorrenciaFieldType)}
        >
          <option value="text">Texto Curto (1 Linha)</option>
          <option value="textarea">Parágrafo (Multi-linha + Auto-Fit)</option>
          <option value="checkbox">Caixa de Marcação [X]</option>
          <option value="signature">✍️ Assinatura / Rubrica Vetorial</option>
          <option value="date">Data</option>
        </select>
        <button
          type="button"
          className="oc-toolbar-btn oc-toolbar-btn--accent"
          onClick={handleAddCustomField}
        >
          + Criar Campo
        </button>
        <span className="oc-custom-field-hint">
          Arraste qualquer caixa no PDF para mover ou puxe o canto inferior direito para redimensionar.
        </span>
      </div>

      {/* ── Interactive PDF Canvas + Millimeter SVG Overlay (or Continuation Annex DOM Preview) ── */}
      <div className="pdf-canvas-container" ref={containerRef}>
        {previewAnnexActive && hasContinuationAnnex && (
          <div
            className="pdf-draw-wrapper"
            data-testid="dom-annex-preview-sheet"
            style={{
              width: Math.round(595.28 * scale),
              height: Math.round(841.89 * scale),
              background: '#ffffff',
            }}
          >
            <svg
              className="oc-svg-overlay"
              viewBox={`0 0 ${currentPageGeom.widthMm} ${currentPageGeom.heightMm}`}
              preserveAspectRatio="none"
            >
              <rect
                x={0}
                y={0}
                width={currentPageGeom.widthMm}
                height={currentPageGeom.heightMm}
                fill="#ffffff"
              />
              {/* Header Banner Box */}
              <rect
                x={19.4}
                y={15}
                width={currentPageGeom.widthMm - 38.8}
                height={23}
                fill="#F8FAFC"
                stroke="#94A3B8"
                strokeWidth={0.35}
              />
              <text
                x={23}
                y={21.5}
                fontSize={3.88}
                fontWeight={700}
                fill="#0F172A"
                fontFamily="Helvetica, Arial, sans-serif"
              >
                ANEXO DE CONTINUACAO #1 - REGISTRO DE OCORRENCIA ESCOLAR
              </text>
              <text
                x={23}
                y={27.5}
                fontSize={3.17}
                fill="#1E293B"
                fontFamily="Helvetica, Arial, sans-serif"
              >
                {`Estudante: ${String(values.nome_aluno || 'Nao informado')}   |   Turma: ${String(
                  values.turma || '-'
                )}   |   Data: ${String(values.data || '-')}`}
              </text>
              <text
                x={23}
                y={33.2}
                fontSize={2.82}
                fill="#475569"
                fontFamily="Helvetica, Arial, sans-serif"
              >
                {`Vinculo Probatorio SHA-256: ${(docSpec.sha256 || 'local-session').slice(
                  0,
                  20
                )}   |   Folha Complementar Integrante do Prontuario`}
              </text>

              {/* Body Frame */}
              <rect
                x={19.4}
                y={42}
                width={currentPageGeom.widthMm - 38.8}
                height={210}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth={0.35}
              />

              {/* Continuation Sections Content */}
              {(() => {
                let cursorY = 49;
                const nodes: React.ReactNode[] = [];
                for (const sec of displayList.continuationSections || []) {
                  nodes.push(
                    <text
                      key={`title-${sec.fieldId}`}
                      x={23}
                      y={cursorY}
                      fontSize={3.5}
                      fontWeight={700}
                      fill="#0F172A"
                      fontFamily="Helvetica, Arial, sans-serif"
                    >
                      {`Continuacao - ${sec.fieldLabel}:`}
                    </text>
                  );
                  cursorY += 5.5;
                  sec.lines.slice(0, 42).forEach((ln, idx) => {
                    nodes.push(
                      <text
                        key={`ln-${sec.fieldId}-${idx}`}
                        x={23}
                        y={cursorY}
                        fontSize={3.1}
                        fill="#0F172A"
                        fontFamily="Helvetica, Arial, sans-serif"
                      >
                        {ln}
                      </text>
                    );
                    cursorY += 4.3;
                  });
                  cursorY += 4.5;
                }
                return nodes;
              })()}

              {/* Footer Signature Line + Coordinator Vector Rubric */}
              <text
                x={19.4}
                y={265}
                fontSize={3.5}
                fill="#0F172A"
                fontFamily="Helvetica, Arial, sans-serif"
              >
                {`Responsavel pelo Registro:  ${String(values.responsavel_registro || '')}`}
              </text>
              <line
                x1={64}
                y1={266.2}
                x2={184}
                y2={266.2}
                stroke="#334155"
                strokeWidth={0.3}
              />
              {firstPageSigOp && firstPageSigOp.kind === 'signature' && (
                <path
                  className="oc-svg-signature-path"
                  d={firstPageSigOp.strokes
                    .map((s) =>
                      s
                        .map(
                          ([sx, sy], idx) =>
                            `${idx === 0 ? 'M' : 'L'} ${sx} ${(
                              sy +
                              (255.2 - firstPageSigOp.y)
                            ).toFixed(2)}`
                        )
                        .join(' ')
                    )
                    .join(' ')}
                  fill="none"
                  stroke={firstPageSigOp.color || '#0F296B'}
                  strokeWidth={firstPageSigOp.strokeWidthMm || 0.42}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        )}

        <div
          className="pdf-draw-wrapper"
          ref={wrapperRef}
          style={{
            display:
              previewAnnexActive && hasContinuationAnnex ? 'none' : 'inline-block',
          }}
        >
          <Document
            file={file}
            onLoadSuccess={handleDocumentLoadSuccess}
            loading={
              <div style={{ padding: '3rem', color: '#94a3b8' }}>
                Renderizando documento PDF vetorial...
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={handlePageLoadSuccess}
            />
          </Document>

          {/* 1:1 Physical Millimeter SVG Overlay (Live Text + Interactive Boxes) */}
          <OcorrenciasSvgOverlay
            pageNumber={pageNumber}
            widthMm={currentPageGeom.widthMm}
            heightMm={currentPageGeom.heightMm}
            fieldsOnPage={fieldsOnCurrentPage}
            displayPage={currentDisplayPage}
            fieldMetrics={displayList.fieldMetrics}
            selectedFieldId={selectedField?.id || ''}
            showFieldFrames={showFieldFrames}
            drawModeActive={drawModeActive}
            onSelectField={onSelectField}
            onUpdateFieldRect={handleUpdateFieldRect}
          />
        </div>
      </div>
    </div>
  );
}
