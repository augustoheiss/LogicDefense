import { useState, useRef, useCallback } from 'react';
import './ocorrencias.css';

const API_BASE = 'http://localhost:8000';

/** Returns today's date as DD/MM/YYYY. */
function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

import { TemplateMapper } from './TemplateMapper';

export function OcorrenciasApp() {
  // ── File & Mapping state ──
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dynamicMap, setDynamicMap] = useState<any>(null);
  const [mappedFields, setMappedFields] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Form state ──
  const [dynamicData, setDynamicData] = useState<Record<string, string>>({});
  const [descricao, setDescricao] = useState('');

  const [checkOrientacao, setCheckOrientacao] = useState(true);
  const [checkConvocar, setCheckConvocar] = useState(false);

  // ── UI state ──
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // ── Drag & Drop handlers ──
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
    } else {
      setMessage('Por favor, envie um arquivo PDF.');
      setStatus('error');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    setDynamicMap(null);
    setMappedFields([]);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleMapComplete = useCallback((map: any, ids: string[]) => {
    setDynamicMap(map);
    setMappedFields(ids);
    
    // Initialize dynamic data state for any field not hardcoded
    const initialData: Record<string, string> = {};
    ids.forEach(id => {
      if (!['descricao_ocorrencia', 'compromissos'].includes(id)) {
        initialData[id] = '';
      }
    });
    // Auto-fill some common fields if present
    if (ids.includes('data')) initialData['data'] = todayBR();
    setDynamicData(initialData);
  }, []);

  const handleMapProgress = useCallback((ids: string[]) => {
    setMappedFields(ids);
  }, []);

  const handleDynamicChange = (id: string, value: string) => {
    setDynamicData(prev => ({ ...prev, [id]: value }));
  };

  // ── Submit handler ──
  const canSubmit = file && dynamicMap && descricao.trim() && Object.values(dynamicData).every(v => v.trim() !== '');

  async function handleSubmit() {
    if (!canSubmit || !file) return;

    setStatus('loading');
    setMessage('');

    const formData = new FormData();
    formData.append('template_pdf', file);
    formData.append('template_map_json', JSON.stringify(dynamicMap));
    
    // Append all dynamic fields
    Object.entries(dynamicData).forEach(([key, val]) => {
      formData.append(key, val.trim());
    });
    
    // Append hardcoded AI fields
    formData.append('descricao_ocorrencia', descricao.trim());

    formData.append('checkbox_orientacao', String(checkOrientacao));
    formData.append('checkbox_convocar', String(checkConvocar));

    try {
      const res = await fetch(`${API_BASE}/api/ocorrencias/gerar`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Erro ${res.status}`);
      }

      // Download the returned PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ocorrencia_gerada.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus('success');
      setMessage('Ocorrência gerada com sucesso! O download iniciou automaticamente.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erro desconhecido ao gerar ocorrência.');
    }
  }

  // ── Drop zone CSS class ──
  const dropzoneClass = [
    'oc-dropzone',
    dragActive ? 'oc-dropzone--active' : '',
    file ? 'oc-dropzone--has-file' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* ── Hero ── */}
      <div className="hero">
        <p className="hero__eyebrow">Laboratório · Ferramentas</p>
        <h1 className="hero__title">Gerador de Ocorrências</h1>
        <p className="hero__sub">
          Faça upload do template PDF da escola, descreva a ocorrência de forma informal e deixe a IA
          formalizar o texto em linguagem pedagógica técnica. O PDF carimbado é gerado instantaneamente.
        </p>
      </div>

      <div className="oc-page">

        {/* ── Step 1: File Upload ── */}
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
                Arraste o <strong>template.pdf</strong> aqui ou clique para selecionar
              </span>
              <span className="oc-dropzone__hint">Apenas arquivos PDF · O arquivo NÃO é armazenado</span>
            </>
          ) : (
            <div className="oc-dropzone__file-info">
              <span>✅</span>
              <span className="oc-dropzone__file-name">{file.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
              <button className="oc-dropzone__file-remove" onClick={removeFile} title="Remover arquivo">
                ✕
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

        {/* ── Main Content Area ── */}
        {file && (
          <div className="flex flex-col gap-8 mt-8">
            
            {/* TOP: Template Mapper (always full width) */}
            {!dynamicMap && (
              <div className="w-full">
                <TemplateMapper 
                  file={file} 
                  onMapComplete={handleMapComplete} 
                  onMapProgress={handleMapProgress}
                  onCancel={removeFile}
                />
              </div>
            )}

            {/* BOTTOM: Form with Progressive Disclosure */}
            <div className="w-full max-w-[800px] mx-auto">
              <form className="oc-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                
                <div className="oc-form-header">
                  <h3>Preenchimento da Ocorrência</h3>
                  {!dynamicMap && <p className="oc-form-hint">Mapeie os campos no PDF ao lado para liberar o preenchimento.</p>}
                  {dynamicMap && <p className="oc-form-hint" style={{color: 'var(--success)'}}>✓ Mapeamento concluído. Preencha os dados finais.</p>}
                </div>

                <div className="flex flex-col gap-4">
                  {mappedFields.filter(id => !['descricao_ocorrencia', 'compromissos'].includes(id)).map(id => (
                    <div key={id} className="oc-field fade-in">
                      <label className="oc-field__label oc-field__label--required">
                        {dynamicMap?.fields?.[id]?.label || id.replace(/_/g, ' ').toUpperCase()}
                      </label>
                      <input
                        className="oc-field__input"
                        type="text"
                        placeholder={`Preencher ${id.replace(/_/g, ' ')}...`}
                        value={dynamicData[id] || ''}
                        onChange={(e) => handleDynamicChange(id, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>

                {mappedFields.includes('descricao_ocorrencia') && (
                  <>
                    <div className="oc-divider fade-in" />
                    <div className="oc-field fade-in">
                      <label className="oc-field__label oc-field__label--required">
                        Descrição da Ocorrência (relato informal)
                      </label>
                      <textarea
                        id="oc-descricao"
                        className="oc-field__input"
                        placeholder="Descreva o que aconteceu de forma natural — a IA irá formalizar o texto automaticamente..."
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        rows={5}
                        required
                      />
                    </div>
                    


                    <div className="oc-divider fade-in" />

                    {/* Checkboxes also shown after mapping is advanced */}
                    <div className="oc-field fade-in">
                      <label className="oc-field__label">Encaminhamentos</label>
                      <div className="oc-checkboxes">
                        <label
                          className={`oc-checkbox ${checkOrientacao ? 'oc-checkbox--checked' : ''}`}
                          htmlFor="oc-check-orientacao"
                        >
                          <span className="oc-checkbox__box">
                            {checkOrientacao && <span className="oc-checkbox__check">✓</span>}
                          </span>
                          <span className="oc-checkbox__label">Orientação ao aluno</span>
                          <input
                            id="oc-check-orientacao"
                            type="checkbox"
                            checked={checkOrientacao}
                            onChange={(e) => setCheckOrientacao(e.target.checked)}
                            style={{ display: 'none' }}
                          />
                        </label>

                        <label
                          className={`oc-checkbox ${checkConvocar ? 'oc-checkbox--checked' : ''}`}
                          htmlFor="oc-check-convocar"
                        >
                          <span className="oc-checkbox__box">
                            {checkConvocar && <span className="oc-checkbox__check">✓</span>}
                          </span>
                          <span className="oc-checkbox__label">Convocar responsável</span>
                          <input
                            id="oc-check-convocar"
                            type="checkbox"
                            checked={checkConvocar}
                            onChange={(e) => setCheckConvocar(e.target.checked)}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Submit ── */}
                {dynamicMap && (
                  <div className="oc-submit fade-in">
                    <button
                      type="submit"
                      className="oc-submit__btn"
                      disabled={!canSubmit || status === 'loading'}
                    >
                      {status === 'loading' ? (
                        <>
                          <span className="oc-spinner" />
                          Formalizando com IA...
                        </>
                      ) : (
                        <>
                          📋 Gerar Ocorrência
                        </>
                      )}
                    </button>

                    {status === 'loading' && (
                      <span className="oc-submit__status">
                        Processando PDF e consultando IA...
                      </span>
                    )}
                  </div>
                )}

                {/* ── Messages ── */}
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
              </form>
            </div>
          </div>
        )}

        {/* ── Privacy badge ── */}
        <div className="oc-privacy">
          <span className="oc-privacy__icon">🔒</span>
          <span className="oc-privacy__text">
            <strong>Zero-Storage Policy:</strong> O PDF enviado e o documento gerado existem apenas na memória
            durante o processamento. Nenhum arquivo é salvo no servidor. Seus dados são descartados imediatamente
            após o download.
          </span>
        </div>
      </div>
    </>
  );
}
