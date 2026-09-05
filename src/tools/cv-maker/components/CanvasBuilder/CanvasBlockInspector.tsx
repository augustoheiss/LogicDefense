import React, { useRef } from 'react'
import type { CanvasBlockConfig } from '../../types/cv'

interface CanvasBlockInspectorProps {
  block: CanvasBlockConfig | null
  onClose: () => void
  onUpdateBlock: (updated: CanvasBlockConfig) => void
  onDeleteBlock: (id: string) => void
}

const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans (Moderno Executivo)', value: 'Plus Jakarta Sans' },
  { label: 'Inter (Alta Legibilidade ATS)', value: 'Inter' },
  { label: 'Roboto (Google Clean)', value: 'Roboto' },
  { label: 'Lora (Editorial Serif Elegante)', value: 'Lora' },
  { label: 'Merriweather (Serif Literária)', value: 'Merriweather' },
  { label: 'Montserrat (Geométrico Forte)', value: 'Montserrat' },
  { label: 'Outfit (Tech & Modern)', value: 'Outfit' },
  { label: 'Cinzel (Clássico Romano)', value: 'Cinzel' },
  { label: 'Courier Prime (Terminal Monospaced)', value: 'Courier Prime' },
  { label: 'Fira Code (Desenvolvedor Mono)', value: 'Fira Code' }
]

const COLOR_SWATCHES = [
  '#0f172a', // Slate 900
  '#0284c7', // Sky 600
  '#059669', // Emerald 600
  '#7c3aed', // Violet 600
  '#d97706', // Amber 600
  '#dc2626', // Red 600
  '#475569', // Slate 600
  '#2563eb'  // Blue 600
]

const BG_SWATCHES = [
  { label: 'Transparente', value: 'transparent' },
  { label: 'Branco', value: '#ffffff' },
  { label: 'Cinza Suave', value: '#f8fafc' },
  { label: 'Azul Claro', value: '#f0f9ff' },
  { label: 'Verde Suave', value: '#f0fdf4' },
  { label: 'Dark Navy', value: '#0f172a' }
]

const PHOTO_SHAPES = [
  { id: 'circle', label: '⚪ Círculo (50%)', desc: 'Redondo Clássico' },
  { id: 'square', label: '🔲 Quadrado (0%)', desc: 'Cantos Retos' },
  { id: 'rounded', label: '🔲 Cantos Suaves', desc: 'Bordas Arredondadas' },
  { id: 'vertical', label: '📱 Editorial 3:4', desc: 'Retângulo Vertical' },
  { id: 'pill', label: '💊 Pílula / Oval', desc: 'Formato Alongado' },
  { id: 'hexagon', label: '⬡ Hexagonal', desc: 'Polígono Moderno' },
  { id: 'diamond', label: '💎 Losango', desc: 'Diamante Geométrico' },
  { id: 'shield', label: '🛡️ Brasão', desc: 'Formato Escudo' }
] as const

export const CanvasBlockInspector: React.FC<CanvasBlockInspectorProps> = ({
  block,
  onClose,
  onUpdateBlock,
  onDeleteBlock
}) => {
  if (!block) return null

  const handleChange = <K extends keyof CanvasBlockConfig>(key: K, value: CanvasBlockConfig[K]) => {
    onUpdateBlock({
      ...block,
      [key]: value
    })
  }

  const isPhoto = block.type === 'photo'
  const isCustomImage = block.type === 'custom_image'
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (dataUrl) {
        handleChange('imageUrl', dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="cv-canvas-inspector-backdrop" onClick={onClose}>
      <aside className="cv-canvas-inspector" onClick={e => e.stopPropagation()}>
        <div className="cv-canvas-inspector__header">
          <h3 className="cv-canvas-inspector__title">
            {isPhoto
              ? '📷 Personalizar Foto & Avatar'
              : isCustomImage
              ? '🖼️ Personalizar Imagem / Logo'
              : '⚙️ Personalizar Bloco'}
          </h3>
          <button
            type="button"
            className="cv-modal-close"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Título do Bloco */}
        {!isPhoto && (
          <div className="cv-canvas-inspector__group">
            <label className="cv-canvas-inspector__label">Título do Bloco (Opcional)</label>
            <input
              type="text"
              className="cv-canvas-inspector__input"
              value={block.customTitle || ''}
              onChange={e => handleChange('customTitle', e.target.value)}
              placeholder="Ex: Experiência Profissional"
            />
          </div>
        )}

        {/* Largura da Coluna (12-Col Grid) */}
        <div className="cv-canvas-inspector__group">
          <label className="cv-canvas-inspector__label">Largura na Folha A4</label>
          <select
            className="cv-canvas-inspector__select"
            value={block.colSpan}
            onChange={e => handleChange('colSpan', Number(e.target.value) as any)}
          >
            <option value={12}>100% (Largura Total - 12 colunas)</option>
            <option value={8}>66.6% (2/3 da folha - 8 colunas)</option>
            <option value={6}>50% (Metade da folha - 6 colunas)</option>
            <option value={4}>33.3% (1/3 da folha - 4 colunas)</option>
            <option value={3}>25% (1/4 da folha - 3 colunas)</option>
          </select>
        </div>

        {/* CONTROLES ESPECÍFICOS DE FOTO */}
        {isPhoto && (
          <div style={{ background: '#0b1120', padding: '0.85rem', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {/* Formato da Foto */}
            <div>
              <label className="cv-canvas-inspector__label" style={{ color: '#38bdf8' }}>
                Formato Geométrico da Foto
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.35rem' }}>
                {PHOTO_SHAPES.map(shape => {
                  const isActive = (block.photoShape || 'circle') === shape.id
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => handleChange('photoShape', shape.id)}
                      style={{
                        padding: '0.45rem 0.5rem',
                        background: isActive ? '#0284c7' : '#1e293b',
                        color: isActive ? '#fff' : '#cbd5e1',
                        border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {shape.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tamanho Real da Foto (Slider em Pixels) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="cv-canvas-inspector__label" style={{ color: '#38bdf8', margin: 0 }}>
                  Tamanho Real da Foto
                </label>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800, background: 'rgba(16,185,129,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  {block.photoSize || 90} px
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="240"
                step="5"
                value={block.photoSize || 90}
                onChange={e => handleChange('photoSize', parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#10b981', marginTop: '0.4rem' }}
              />
            </div>

            {/* Alinhamento da Foto */}
            <div>
              <label className="cv-canvas-inspector__label">Alinhamento na Coluna</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['left', 'center', 'right'] as const).map(align => {
                  const isActive = (block.photoAlign || 'center') === align
                  const labels = { left: '⬅️ Esquerda', center: '⏺️ Centro', right: '➡️ Direita' }
                  return (
                    <button
                      key={align}
                      type="button"
                      onClick={() => handleChange('photoAlign', align)}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        background: isActive ? '#0284c7' : '#1e293b',
                        color: isActive ? '#fff' : '#cbd5e1',
                        border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {labels[align]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Borda da Imagem */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="cv-canvas-inspector__label" style={{ margin: 0 }}>
                  Borda da Foto
                </label>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {(block.photoBorderWidth ?? 0) === 0 ? 'Sem borda' : `${block.photoBorderWidth} px`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                {[0, 2, 4, 6].map(bw => (
                  <button
                    key={bw}
                    type="button"
                    onClick={() => handleChange('photoBorderWidth', bw)}
                    style={{
                      flex: 1,
                      padding: '0.35rem',
                      background: (block.photoBorderWidth ?? 0) === bw ? '#0284c7' : '#1e293b',
                      color: (block.photoBorderWidth ?? 0) === bw ? '#fff' : '#cbd5e1',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {bw === 0 ? 'Nenhuma' : `${bw}px`}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor da Borda da Foto */}
            {(block.photoBorderWidth ?? 0) > 0 && (
              <div>
                <label className="cv-canvas-inspector__label">Cor da Borda</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {COLOR_SWATCHES.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleChange('photoBorderColor', color)}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: color,
                        border: block.photoBorderColor === color ? '2px solid #38bdf8' : '1px solid #475569',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sombra Suave & Caixa Flutuante */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#e2e8f0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={block.photoShadow ?? true}
                  onChange={e => handleChange('photoShadow', e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <span>Sombra elegante sob a foto</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#e2e8f0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={block.hideContainerBox ?? true}
                  onChange={e => handleChange('hideContainerBox', e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <span>Foto Flutuante (Sem caixa/fundo externo)</span>
              </label>
            </div>
          </div>
        )}

        {/* CONTROLES ESPECÍFICOS DE IMAGEM PERSONALIZADA / LOGO / QR CODE */}
        {isCustomImage && (
          <div style={{ background: '#0b1120', padding: '0.85rem', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {/* Upload de Arquivo ou URL */}
            <div>
              <label className="cv-canvas-inspector__label" style={{ color: '#38bdf8' }}>
                Origem da Imagem
              </label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageFileUpload}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="cv-btn-secondary"
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem', justifyContent: 'center' }}
                  onClick={() => imageInputRef.current?.click()}
                >
                  📁 Carregar do Computador
                </button>
                {block.imageUrl && (
                  <button
                    type="button"
                    className="cv-btn-secondary"
                    style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)', fontSize: '0.78rem', padding: '0.45rem' }}
                    onClick={() => handleChange('imageUrl', '')}
                    title="Remover imagem"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <input
                type="text"
                className="cv-canvas-inspector__input"
                style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}
                value={block.imageUrl?.startsWith('data:') ? '[Imagem Carregada do Computador]' : (block.imageUrl || '')}
                onChange={e => handleChange('imageUrl', e.target.value)}
                placeholder="Ou cole uma URL (https://...)"
              />
            </div>

            {/* Alt Text */}
            <div>
              <label className="cv-canvas-inspector__label">Descrição da Imagem (Acessibilidade)</label>
              <input
                type="text"
                className="cv-canvas-inspector__input"
                value={block.imageAlt || ''}
                onChange={e => handleChange('imageAlt', e.target.value)}
                placeholder="Ex: Logotipo da Empresa ou Selo de Certificação"
              />
            </div>

            {/* Altura da Imagem */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="cv-canvas-inspector__label">Altura Máxima</label>
                <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                  {block.imageHeight || 120} px
                </span>
              </div>
              <input
                type="range"
                min="40"
                max="350"
                step="5"
                value={block.imageHeight || 120}
                onChange={e => handleChange('imageHeight', Number(e.target.value))}
                style={{ width: '100%', marginTop: '0.35rem', accentColor: '#0284c7' }}
              />
            </div>

            {/* Ajuste / Fit */}
            <div>
              <label className="cv-canvas-inspector__label">Enquadramento</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => handleChange('imageFit', 'contain')}
                  style={{
                    padding: '0.45rem',
                    background: (block.imageFit || 'contain') === 'contain' ? '#0284c7' : '#1e293b',
                    color: (block.imageFit || 'contain') === 'contain' ? '#fff' : '#cbd5e1',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📐 Proporcional (Sem corte)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('imageFit', 'cover')}
                  style={{
                    padding: '0.45rem',
                    background: block.imageFit === 'cover' ? '#0284c7' : '#1e293b',
                    color: block.imageFit === 'cover' ? '#fff' : '#cbd5e1',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🖼️ Preencher Caixa
                </button>
              </div>
            </div>

            {/* Raio da Borda */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="cv-canvas-inspector__label">Bordas Arredondadas</label>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {block.imageBorderRadius ?? 6} px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                step="2"
                value={block.imageBorderRadius ?? 6}
                onChange={e => handleChange('imageBorderRadius', Number(e.target.value))}
                style={{ width: '100%', marginTop: '0.35rem', accentColor: '#0284c7' }}
              />
            </div>

            {/* Legenda Opcional */}
            <div>
              <label className="cv-canvas-inspector__label">Legenda (Opcional)</label>
              <input
                type="text"
                className="cv-canvas-inspector__input"
                value={block.imageCaption || ''}
                onChange={e => handleChange('imageCaption', e.target.value)}
                placeholder="Ex: Arquitetura de Nuvem AWS - 2025"
              />
            </div>

            {/* Link Opcional */}
            <div>
              <label className="cv-canvas-inspector__label">Link de Redirecionamento (Opcional)</label>
              <input
                type="text"
                className="cv-canvas-inspector__input"
                value={block.imageLink || ''}
                onChange={e => handleChange('imageLink', e.target.value)}
                placeholder="https://credly.com/badges/... ou https://portfolio.com"
              />
            </div>
          </div>
        )}

        {/* Tipografia / Fonte (para blocos com texto) */}
        {!isPhoto && !isCustomImage && (
          <>
            <div className="cv-canvas-inspector__group">
              <label className="cv-canvas-inspector__label">Família da Fonte</label>
              <select
                className="cv-canvas-inspector__select"
                value={block.fontFamily || 'inherit'}
                onChange={e => handleChange('fontFamily', e.target.value)}
              >
                <option value="inherit">Padrão do Tema Global</option>
                {FONT_OPTIONS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Escala de Fonte */}
            <div className="cv-canvas-inspector__group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="cv-canvas-inspector__label">Tamanho da Fonte</label>
                <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                  {(block.fontSizeScale || 1.0).toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.4"
                step="0.05"
                value={block.fontSizeScale || 1.0}
                onChange={e => handleChange('fontSizeScale', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
            </div>

            {/* Cores do Texto */}
            <div className="cv-canvas-inspector__group">
              <label className="cv-canvas-inspector__label">Cor do Texto Principal</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {COLOR_SWATCHES.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleChange('customTextColor', color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: color,
                      border: block.customTextColor === color ? '2px solid #38bdf8' : '1px solid #475569',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Fundo do Bloco */}
            <div className="cv-canvas-inspector__group">
              <label className="cv-canvas-inspector__label">Cor de Fundo do Bloco</label>
              <select
                className="cv-canvas-inspector__select"
                value={block.customBgColor || 'transparent'}
                onChange={e => handleChange('customBgColor', e.target.value)}
              >
                {BG_SWATCHES.map(bg => (
                  <option key={bg.value} value={bg.value}>{bg.label}</option>
                ))}
              </select>
            </div>

            {/* Espaçamento / Padding */}
            <div className="cv-canvas-inspector__group">
              <label className="cv-canvas-inspector__label">Espaçamento Interno (Padding)</label>
              <select
                className="cv-canvas-inspector__select"
                value={block.padding || 'normal'}
                onChange={e => handleChange('padding', e.target.value as any)}
              >
                <option value="none">Nenhum (0px)</option>
                <option value="compact">Compacto (0.35rem)</option>
                <option value="normal">Normal (0.75rem)</option>
                <option value="spacious">Espaçoso (1.25rem)</option>
              </select>
            </div>
          </>
        )}

        {/* Ações Inferiores */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #1e293b' }}>
          <button
            type="button"
            className="cv-btn-secondary"
            style={{ color: '#f87171', borderColor: '#ef4444', flex: 1 }}
            onClick={() => {
              onDeleteBlock(block.id)
              onClose()
            }}
          >
            🗑️ Excluir Bloco
          </button>
          <button
            type="button"
            className="cv-btn-primary"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            ✓ Concluído
          </button>
        </div>
      </aside>
    </div>
  )
}
