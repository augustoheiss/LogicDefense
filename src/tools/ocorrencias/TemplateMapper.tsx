import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './TemplateMapper.css';

// ── Configure react-pdf worker for Vite ──
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface MappedField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface TemplateMapperProps {
  file: File;
  onMapComplete: (dynamicMap: any, mappedFieldIds: string[]) => void;
  onMapProgress: (mappedFieldIds: string[]) => void;
  onCancel: () => void;
}

const DEFAULT_FIELDS = [
  { id: 'nome_aluno', label: 'Nome do Aluno', type: 'text' },
  { id: 'turma', label: 'Turma', type: 'text' },
  { id: 'data', label: 'Data', type: 'text' },
  { id: 'descricao_ocorrencia', label: 'Descrição da Ocorrência', type: 'textarea' },
  { id: 'responsavel_registro', label: 'Responsável (Assinatura)', type: 'text' },
];

// Backend expected coordinate schema
interface PyMuPDFCoords {
  x: number;
  y: number;
  max_width: number;
  height: number;
  max_lines?: number;
  font_size: number;
  type: string;
  label: string;
  page: number;
}

export function TemplateMapper({ file, onMapComplete, onMapProgress, onCancel }: TemplateMapperProps) {
  const [availableFields, setAvailableFields] = useState(DEFAULT_FIELDS);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [activeFieldId, setActiveFieldId] = useState<string>(DEFAULT_FIELDS[0].id);
  const [mappedFields, setMappedFields] = useState<Record<string, MappedField>>({});
  const [scale, setScale] = useState<number>(1.5);
  const [newFieldName, setNewFieldName] = useState("");
  
  // PDF metadata
  const [pdfIntrinsicSize, setPdfIntrinsicSize] = useState({ width: 595.28, height: 841.89 }); // default A4
  
  // Drawing state
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function onPageLoadSuccess(page: any) {
    // page.originalWidth / originalHeight are in PDF points (1/72 inch)
    if (page.originalWidth && page.originalHeight) {
      setPdfIntrinsicSize({ width: page.originalWidth, height: page.originalHeight });
    }
  }

  // ── Drawing Handlers ──
  // Unified coordinate extractor for mouse and touch events
  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!wrapperRef.current) return { x: 0, y: 0 };
    const rect = wrapperRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? (e as React.TouchEvent).changedTouches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? (e as React.TouchEvent).changedTouches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!activeFieldId) return;
    const pos = getPointerPos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    setCurrentPos(getPointerPos(e));
  };

  const handlePointerUp = () => {
    if (!isDrawing || !activeFieldId) return;
    setIsDrawing(false);
    
    // Calculate final box
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    // Ignore tiny accidental clicks
    if (width > 10 && height > 10) {
      setMappedFields(prev => {
        const next = {
          ...prev,
          [activeFieldId]: { id: activeFieldId, x, y, width, height, page: pageNumber - 1 }
        };
        onMapProgress(Object.keys(next));
        return next;
      });

      // Auto-advance to next unmapped field
      const currentIndex = availableFields.findIndex(f => f.id === activeFieldId);
      for (let i = 1; i < availableFields.length; i++) {
        const nextIdx = (currentIndex + i) % availableFields.length;
        const nextId = availableFields[nextIdx].id;
        if (!mappedFields[nextId] && nextId !== activeFieldId) {
          setActiveFieldId(nextId);
          break;
        }
      }
    }
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    
    // Strict key normalization
    const slugify = (text: string) => 
      text.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/(^_|_$)/g, '');
          
    const id = slugify(newFieldName);
      
    if (availableFields.some(f => f.id === id)) {
      alert("Este campo já existe.");
      return;
    }
    
    const newField = { id, label: newFieldName.trim(), type: 'text' };
    setAvailableFields(prev => [...prev, newField]);
    setActiveFieldId(id);
    setNewFieldName("");
  };

  // ── Map Generation ──
  const handleConfirm = () => {
    if (!wrapperRef.current) return;
    
    // The strict rendered dimensions of the physical PDF canvas in CSS pixels
    const canvasEl = wrapperRef.current.querySelector('canvas');
    const renderedWidth = canvasEl ? canvasEl.clientWidth : wrapperRef.current.clientWidth;
    const renderedHeight = canvasEl ? canvasEl.clientHeight : wrapperRef.current.clientHeight;

    // Scaling factors: PDF Points / CSS Pixels
    const scaleX = pdfIntrinsicSize.width / renderedWidth;
    const scaleY = pdfIntrinsicSize.height / renderedHeight;

    const dynamicMap: any = {
      _comment: "Dynamic map generated by React TemplateMapper",
      page_width: pdfIntrinsicSize.width,
      page_height: pdfIntrinsicSize.height,
      coordinate_system: "pymupdf_top_left",
      fields: {}
    };

    const mappedIds = Object.keys(mappedFields);

    mappedIds.forEach(id => {
      const fieldDef = availableFields.find(f => f.id === id);
      if (!fieldDef) return;

      const box = mappedFields[id];
      const pdfX = box.x * scaleX;
      const pdfY = box.y * scaleY;
      const pdfWidth = box.width * scaleX;
      const pdfHeight = box.height * scaleY;

      const mappedField: PyMuPDFCoords = {
        x: Math.round(pdfX),
        y: Math.round(pdfY),
        max_width: Math.round(pdfWidth),
        height: Math.round(pdfHeight),
        font_size: fieldDef.type === 'textarea' ? 11 : 12, // default sizes matching config
        type: fieldDef.type,
        label: fieldDef.label,
        page: box.page || 0
      };

      if (fieldDef.type === 'textarea') {
        // Assume roughly 18pt line spacing to calculate physical max lines
        mappedField.max_lines = Math.max(1, Math.floor(pdfHeight / 18));
      }

      dynamicMap.fields[id] = mappedField;
    });

    onMapComplete(dynamicMap, mappedIds);
  };

  // ── Map IO (Export / Import) ──
  const handleExportMap = () => {
    // Generate map first just like handleConfirm
    if (!wrapperRef.current) return;
    
    const canvasEl = wrapperRef.current.querySelector('canvas');
    const renderedWidth = canvasEl ? canvasEl.clientWidth : wrapperRef.current.clientWidth;
    const renderedHeight = canvasEl ? canvasEl.clientHeight : wrapperRef.current.clientHeight;
    
    const scaleX = pdfIntrinsicSize.width / renderedWidth;
    const scaleY = pdfIntrinsicSize.height / renderedHeight;
    
    const dynamicMap: any = {
      _comment: "Exported Template Map",
      page_width: pdfIntrinsicSize.width,
      page_height: pdfIntrinsicSize.height,
      coordinate_system: "pymupdf_top_left",
      fields: {}
    };

    Object.keys(mappedFields).forEach(id => {
      const fieldDef = availableFields.find(f => f.id === id);
      if (!fieldDef) return;
      const box = mappedFields[id];
      const mappedField: PyMuPDFCoords = {
        x: Math.round(box.x * scaleX),
        y: Math.round(box.y * scaleY),
        max_width: Math.round(box.width * scaleX),
        height: Math.round(box.height * scaleY),
        font_size: fieldDef.type === 'textarea' ? 11 : 12,
        type: fieldDef.type,
        label: fieldDef.label,
        page: box.page || 0
      };
      if (fieldDef.type === 'textarea') {
        mappedField.max_lines = Math.max(1, Math.floor((box.height * scaleY) / 18));
      }
      dynamicMap.fields[id] = mappedField;
    });

    const blob = new Blob([JSON.stringify(dynamicMap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meu_mapa_ocorrencia.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.fields) {
          const mappedIds = Object.keys(json.fields);
          
          // Reconstruct available fields so custom imported fields appear
          const importedFields = mappedIds.map(id => {
            const fieldMap = json.fields[id];
            return {
              id,
              label: fieldMap.label || id,
              type: fieldMap.type || 'text'
            };
          });
          
          // Merge with DEFAULT_FIELDS to ensure standard fields are always there
          const mergedFields = [...DEFAULT_FIELDS];
          importedFields.forEach(imp => {
            if (!mergedFields.some(f => f.id === imp.id)) {
              mergedFields.push(imp);
            }
          });
          
          setAvailableFields(mergedFields);
          onMapProgress(mappedIds);
          onMapComplete(json, mappedIds);
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de mapa JSON.");
      }
    };
    reader.readAsText(file);
  };

  // Rendering the current drawing box
  const drawBoxStyle = isDrawing ? {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y)
  } : {};

  const mappedCount = Object.keys(mappedFields).length;
  // We only require the DEFAULT_FIELDS to be mapped. Custom fields are optional but mapped if drawn.
  const isFullyMapped = DEFAULT_FIELDS.every(f => mappedFields[f.id]);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {/* ── Control Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-900 border border-gray-700 rounded-md w-full">
        <div className="flex items-center gap-3">
          <select 
            className="px-3 py-2 bg-gray-800 text-gray-100 border border-gray-600 rounded-md outline-none text-sm"
            value={activeFieldId}
            onChange={(e) => setActiveFieldId(e.target.value)}
          >
            {availableFields.map(f => (
              <option key={f.id} value={f.id}>
                {mappedFields[f.id] ? '✓ ' : ''}{f.label}
              </option>
            ))}
          </select>
          
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Novo campo..." 
              className="px-3 py-1 bg-gray-800 text-gray-100 border border-gray-600 rounded-md text-sm outline-none"
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddField()}
            />
            <button 
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-md transition-colors"
              onClick={handleAddField}
            >
              Add
            </button>
          </div>
          
          <span className="text-sm text-gray-400">
            Selecione o campo e desenhe a caixa no PDF.
          </span>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-md border border-gray-700">
            <button className="px-3 py-1 hover:bg-gray-700 text-gray-200 rounded transition-colors" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}>-</button>
            <span className="text-sm w-12 text-center text-gray-200 font-mono">{Math.round(scale * 100)}%</span>
            <button className="px-3 py-1 hover:bg-gray-700 text-gray-200 rounded transition-colors" onClick={() => setScale(s => Math.min(3.0, s + 0.25))}>+</button>
          </div>

          <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-md border border-gray-700">
            <button 
              className="px-3 py-1 hover:bg-gray-700 text-gray-200 rounded transition-colors disabled:opacity-50" 
              onClick={() => setPageNumber(p => Math.max(1, p - 1))} 
              disabled={pageNumber <= 1}
            >&lt;</button>
            <span className="text-sm font-medium text-gray-200 text-center w-20">
              Pág. {pageNumber} / {numPages || '?'}
            </span>
            <button 
              className="px-3 py-1 hover:bg-gray-700 text-gray-200 rounded transition-colors disabled:opacity-50" 
              onClick={() => setPageNumber(p => Math.min(numPages || p, p + 1))} 
              disabled={pageNumber >= (numPages || 1)}
            >&gt;</button>
          </div>

          <label className="px-4 py-2 text-sm font-medium border border-gray-600 hover:bg-gray-800 text-gray-200 rounded-md transition-colors cursor-pointer">
            Importar JSON
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportMap} />
          </label>
          <button 
            className="px-4 py-2 text-sm font-medium border border-gray-600 hover:bg-gray-800 text-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleExportMap} 
            disabled={mappedCount === 0}
          >
            Exportar
          </button>
          <button 
            className="px-4 py-2 text-sm font-medium border border-gray-600 hover:bg-gray-800 text-gray-200 rounded-md transition-colors" 
            onClick={onCancel}
          >
            Voltar
          </button>
          <button 
            className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleConfirm}
            disabled={!isFullyMapped}
          >
            Confirmar ({mappedCount}/{availableFields.length})
          </button>
        </div>
      </div>

      {/* ── PDF Canvas ── */}
      <div className="pdf-canvas-container">
        <div 
          className="pdf-draw-wrapper" 
          ref={wrapperRef}
          data-can-draw={!!activeFieldId}
        >
          <Document 
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div style={{ padding: '2rem' }}>Carregando PDF...</div>}
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              renderTextLayer={false} 
              renderAnnotationLayer={false}
              onLoadSuccess={onPageLoadSuccess}
            />
          </Document>

          <div 
            className="drawing-overlay"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
          >
            {/* Draw existing boxes */}
            {Object.values(mappedFields)
              .filter(box => (box.page || 0) === pageNumber - 1)
              .map(box => {
              const label = availableFields.find(f => f.id === box.id)?.label || box.id;
              return (
                <div 
                  key={box.id} 
                  className="mapped-box"
                  style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                >
                  <span className="mapped-box__label">{label}</span>
                </div>
              );
            })}

            {/* Draw active box */}
            {isDrawing && (
              <div className="drawing-box" style={drawBoxStyle} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
