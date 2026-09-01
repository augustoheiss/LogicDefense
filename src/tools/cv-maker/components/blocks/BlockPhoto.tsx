import React from 'react'

export type PhotoShape = 'circle' | 'square' | 'rounded' | 'vertical' | 'pill' | 'hexagon' | 'diamond' | 'shield'

interface BlockPhotoProps {
  image?: string
  altName: string
  shape?: PhotoShape
  size?: number // px
  borderWidth?: number // px
  borderColor?: string
  shadow?: boolean
  align?: 'left' | 'center' | 'right'
  posX?: number
  posY?: number
  scale?: number
}

export const BlockPhoto: React.FC<BlockPhotoProps> = ({
  image,
  altName,
  shape = 'circle',
  size = 90,
  borderWidth = 0,
  borderColor = '#0284c7',
  shadow = true,
  align = 'center',
  posX = 50,
  posY = 50,
  scale = 1.0
}) => {
  if (!image) {
    return (
      <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', width: '100%' }}>
        <div
          className="cv-avatar-container cv-avatar-placeholder-box cv-no-print"
          style={{
            width: `${size}px`,
            height: shape === 'vertical' ? `${Math.round(size * 1.3)}px` : `${size}px`,
            borderRadius: shape === 'circle' || shape === 'pill' ? '50%' : shape === 'rounded' ? '12px' : '0px',
            border: '2px dashed #475569',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.5)',
            color: '#94a3b8',
            fontSize: '0.75rem'
          }}
        >
          <span style={{ fontSize: '1.5rem', marginBottom: '2px' }}>👤</span>
          <span>Sem Foto</span>
        </div>
      </div>
    )
  }

  // Clip paths para formas geométricas customizadas
  const clipPaths: Record<string, string | undefined> = {
    hexagon: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
    diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    shield: 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)'
  }

  // Border radius para formas padrão
  const getBorderRadius = () => {
    switch (shape) {
      case 'circle':
      case 'pill':
        return '50%'
      case 'rounded':
        return '14px'
      case 'vertical':
        return '8px'
      case 'square':
      default:
        return '0px'
    }
  }

  const heightPx = shape === 'vertical' ? Math.round(size * 1.32) : size

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${heightPx}px`,
    borderRadius: clipPaths[shape] ? '0' : getBorderRadius(),
    clipPath: clipPaths[shape],
    border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none',
    boxShadow: shadow && !clipPaths[shape] ? '0 8px 20px -4px rgba(0,0,0,0.25)' : 'none',
    overflow: 'hidden',
    display: 'block',
    position: 'relative',
    flexShrink: 0,
    backgroundColor: '#e2e8f0'
  }

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${posX}% ${posY}%`,
    transform: `scale(${scale})`,
    transformOrigin: `${posX}% ${posY}%`,
    display: 'block'
  }

  return (
    <div
      className="cv-avatar-align-wrap"
      style={{
        display: 'flex',
        justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        width: '100%',
        margin: '0.25rem 0'
      }}
    >
      <div className="cv-avatar-container has-photo" style={containerStyle}>
        <img
          src={image}
          alt={altName || 'Foto de Perfil'}
          className="cv-avatar-img"
          style={imgStyle}
        />
      </div>
    </div>
  )
}
