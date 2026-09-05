import React, { useRef, useState } from 'react'
import type { CanvasBlockConfig } from '../../types/cv'
import { compressImageFile } from '../../utils/imageCompressor'

interface BlockCustomImageProps {
  blockConfig?: CanvasBlockConfig
  onUploadImage?: (dataUrl: string) => void
}

export const BlockCustomImage: React.FC<BlockCustomImageProps> = ({
  blockConfig,
  onUploadImage
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCompressing, setIsCompressing] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsCompressing(true)
      const compressedDataUrl = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.82
      })
      if (onUploadImage) {
        onUploadImage(compressedDataUrl)
      }
    } catch (err) {
      console.error('[BlockCustomImage] Erro ao comprimir imagem:', err)
      // Fallback: leitura padrão se a compressão falhar
      const reader = new FileReader()
      reader.onload = (event) => {
        const fallbackDataUrl = event.target?.result as string
        if (fallbackDataUrl && onUploadImage) {
          onUploadImage(fallbackDataUrl)
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setIsCompressing(false)
    }
  }

  const imageUrl = blockConfig?.imageUrl
  const alt = blockConfig?.imageAlt || 'Imagem anexada'
  const height = blockConfig?.imageHeight || 120
  const fit = blockConfig?.imageFit || 'contain'
  const borderRadius = blockConfig?.imageBorderRadius ?? 6
  const caption = blockConfig?.imageCaption
  const link = blockConfig?.imageLink

  if (!imageUrl) {
    return (
      <div
        className="cv-custom-image-placeholder cv-avoid-break"
        style={{
          border: '1.5px dashed #94a3b8',
          borderRadius: '8px',
          padding: '1.25rem 1rem',
          textAlign: 'center',
          backgroundColor: 'rgba(241, 245, 249, 0.5)',
          color: '#64748b'
        }}
      >
        <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>🖼️</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
          Imagem / Logo / QR Code
        </div>
        <p style={{ fontSize: '0.75rem', margin: '0 0 0.6rem 0', color: '#64748b' }}>
          Adicione um logotipo corporativo, selo de certificação, QR Code ou print de projeto.
        </p>

        {onUploadImage && (
          <div className="cv-no-print">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={isCompressing}
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: '0.76rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: isCompressing ? '#94a3b8' : '#0f172a',
                cursor: isCompressing ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              {isCompressing ? '⏳ Otimizando Imagem...' : '📤 Carregar Imagem do Computador'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const imageElement = (
    <img
      src={imageUrl}
      alt={alt}
      style={{
        display: 'block',
        width: '100%',
        maxHeight: `${height}px`,
        objectFit: fit,
        borderRadius: `${borderRadius}px`,
        margin: '0 auto'
      }}
    />
  )

  return (
    <figure
      className="cv-custom-image-figure cv-avoid-break"
      style={{ margin: 0, padding: 0, textAlign: 'center' }}
    >
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-block', width: '100%', textDecoration: 'none' }}
        >
          {imageElement}
        </a>
      ) : (
        imageElement
      )}

      {caption && (
        <figcaption
          style={{
            fontSize: '0.72rem',
            color: '#64748b',
            marginTop: '0.35rem',
            fontStyle: 'italic'
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
