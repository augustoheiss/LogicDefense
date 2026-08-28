import React, { useState } from 'react'

interface PhotoUploaderProps {
  currentPhoto?: string
  onSavePhoto: (photoUrlOrBase64: string | undefined) => void
  onClose: () => void
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({ currentPhoto, onSavePhoto, onClose }) => {
  const [photoInput, setPhotoInput] = useState<string>(currentPhoto || '')
  const [previewError, setPreviewError] = useState<boolean>(false)

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

  const handleSave = () => {
    onSavePhoto(photoInput.trim() ? photoInput.trim() : undefined)
    onClose()
  }

  const handleRemove = () => {
    onSavePhoto(undefined)
    onClose()
  }

  return (
    <div className="cv-modal-backdrop" onClick={onClose}>
      <div className="cv-modal-card" onClick={e => e.stopPropagation()}>
        <div className="cv-modal-header">
          <h3>📷 Foto / Avatar Profissional</h3>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Carregue sua foto de perfil ou insira o link direto de uma imagem (ex: LinkedIn, GitHub ou CDN).
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '1rem', background: '#06090f', borderRadius: '0.5rem' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b' }}>
              {photoInput && !previewError ? (
                <img
                  src={photoInput}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <span style={{ fontSize: '2rem' }}>👤</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="cv-btn-secondary" style={{ cursor: 'pointer', textAlign: 'center' }}>
                📁 Escolher do Computador
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              {photoInput && (
                <button className="cv-btn-secondary" style={{ color: '#f87171' }} onClick={() => setPhotoInput('')}>
                  🗑 Remover Foto
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>Ou cole o link direto da imagem:</label>
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
