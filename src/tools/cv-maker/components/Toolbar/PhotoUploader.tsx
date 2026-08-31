import React, { useState, useRef } from 'react'

interface PhotoUploaderProps {
  currentPhoto?: string
  currentPosX?: number
  currentPosY?: number
  currentScale?: number
  onSavePhoto: (photoUrlOrBase64: string | undefined, posX?: number, posY?: number, scale?: number) => void
  onClose: () => void
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  currentPhoto,
  currentPosX = 50,
  currentPosY = 50,
  currentScale = 1.0,
  onSavePhoto,
  onClose
}) => {
  const [photoInput, setPhotoInput] = useState<string>(currentPhoto || '')
  const [posX, setPosX] = useState<number>(currentPosX)
  const [posY, setPosY] = useState<number>(currentPosY)
  const [scale, setScale] = useState<number>(currentScale)
  const [previewShape, setPreviewShape] = useState<'circle' | 'rect'>('circle')
  const [previewError, setPreviewError] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number } | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoInput(reader.result)
        setPreviewError(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!photoInput || previewError) return
    setIsDragging(true)
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: posX,
      initPosY: posY
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return
    const deltaX = e.clientX - dragStartRef.current.startX
    const deltaY = e.clientY - dragStartRef.current.startY

    // Converter deslocamento em pixels para percentual (sensibilidade balanceada)
    const newPosX = Math.min(100, Math.max(0, dragStartRef.current.initPosX - deltaX * 0.4))
    const newPosY = Math.min(100, Math.max(0, dragStartRef.current.initPosY - deltaY * 0.4))

    setPosX(Math.round(newPosX))
    setPosY(Math.round(newPosY))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    dragStartRef.current = null
  }

  const handleSave = () => {
    onSavePhoto(photoInput.trim() ? photoInput.trim() : undefined, posX, posY, scale)
    onClose()
  }

  const handleRemove = () => {
    onSavePhoto(undefined, 50, 50, 1.0)
    onClose()
  }

  const resetFraming = () => {
    setPosX(50)
    setPosY(50)
    setScale(1.0)
  }

  return (
    <div className="cv-modal-backdrop" onClick={onClose} onMouseUp={handleMouseUp}>
      <div className="cv-modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="cv-modal-header">
          <h3>📷 Enquadramento & Foto do Perfil</h3>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Carregue sua foto e ajuste a posição (Pan) e zoom (Scale) arrastando o preview ou usando os controles.
          </p>

          {/* Área de Preview Interativo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#06090f', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <button
                type="button"
                className={`cv-btn-secondary ${previewShape === 'circle' ? 'active' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderColor: previewShape === 'circle' ? '#10b981' : undefined }}
                onClick={() => setPreviewShape('circle')}
              >
                ⚪ Círculo (Modelos 01, 03, 04, 05, 06, 09)
              </button>
              <button
                type="button"
                className={`cv-btn-secondary ${previewShape === 'rect' ? 'active' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderColor: previewShape === 'rect' ? '#10b981' : undefined }}
                onClick={() => setPreviewShape('rect')}
              >
                🔲 Retângulo (Modelos 02, 08)
              </button>
            </div>

            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              style={{
                width: previewShape === 'circle' ? '120px' : '100px',
                height: previewShape === 'circle' ? '120px' : '135px',
                borderRadius: previewShape === 'circle' ? '50%' : '8px',
                overflow: 'hidden',
                border: '3px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1e293b',
                position: 'relative',
                cursor: photoInput ? (isDragging ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
              }}
              title={photoInput ? 'Clique e arraste para posicionar o rosto' : ''}
            >
              {photoInput && !previewError ? (
                <img
                  src={photoInput}
                  alt="Preview"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${posX}% ${posY}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: `${posX}% ${posY}%`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                  }}
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <span style={{ fontSize: '2.5rem' }}>👤</span>
              )}
            </div>

            {photoInput && (
              <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                💡 <em>Dica: Clique e arraste dentro do quadro para mover a foto livremente.</em>
              </span>
            )}

            {/* Controles de Escala e Posição */}
            {photoInput && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', background: '#0b1120', padding: '0.85rem', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>🔍 Zoom / Escala: <strong>{scale.toFixed(1)}x</strong></label>
                  <button type="button" onClick={resetFraming} style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer' }}>Resetar</button>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.05"
                  value={scale}
                  onChange={e => setScale(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>↔ Posição Horizontal: <strong>{posX}%</strong></label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={posX}
                      onChange={e => setPosX(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>↕ Posição Vertical: <strong>{posY}%</strong></label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={posY}
                      onChange={e => setPosY(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ações de Upload */}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
              <label className="cv-btn-secondary" style={{ cursor: 'pointer', textAlign: 'center', flex: 1 }}>
                📁 Carregar Imagem
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              {photoInput && (
                <button type="button" className="cv-btn-secondary" style={{ color: '#f87171' }} onClick={() => setPhotoInput('')}>
                  🗑 Remover Foto
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>Ou cole o link direto da imagem (URL):</label>
            <input
              type="url"
              className="cv-chat-textarea"
              style={{ minHeight: 'auto', padding: '0.5rem 0.75rem' }}
              placeholder="https://exemplo.com/minha-foto.jpg"
              value={photoInput}
              onChange={e => {
                setPhotoInput(e.target.value)
                setPreviewError(false)
              }}
            />
          </div>
        </div>

        <div className="cv-modal-footer">
          <button className="cv-btn-secondary" onClick={handleRemove}>
            Deixar sem Foto
          </button>
          <button className="cv-btn-primary" onClick={handleSave}>
            Salvar e Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
