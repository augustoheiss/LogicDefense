import React from 'react'

export type PhotoShape =
  | 'circle'
  | 'square'
  | 'rounded'
  | 'vertical'
  | 'pill'
  | 'hexagon'
  | 'diamond'
  | 'shield'
  | 'octagon'
  | 'teardrop'
  | 'editorial_stamp'

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
            borderRadius: shape === 'circle' || shape === 'pill' ? '50%' : shape === 'rounded' ? '12px' : shape === 'teardrop' ? '50% 50% 50% 0%' : '0px',
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

  // Clip paths para formas geométricas e polígonos
  const clipPaths: Record<string, string | undefined> = {
    hexagon: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
    diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    shield: 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)',
    octagon: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
  }

  const isPolygon = Boolean(clipPaths[shape])

  // Border radius para formas padrão
  const getBorderRadius = () => {
    switch (shape) {
      case 'circle':
      case 'pill':
        return '50%'
      case 'rounded':
        return '16px'
      case 'vertical':
        return '8px'
      case 'teardrop':
        return '50% 50% 50% 0%'
      case 'editorial_stamp':
        return '4px'
      case 'square':
      default:
        return '0px'
    }
  }

  const heightPx = shape === 'vertical' ? Math.round(size * 1.32) : size

  // Borda especial para selo stamp
  const isStamp = shape === 'editorial_stamp'
  const stampPadding = isStamp ? 4 : 0
  const stampBorder = isStamp
    ? `3px dashed ${borderColor || '#38bdf8'}`
    : borderWidth > 0 && !isPolygon
    ? `${borderWidth}px solid ${borderColor}`
    : 'none'

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${heightPx}px`,
    borderRadius: isPolygon ? '0' : getBorderRadius(),
    clipPath: clipPaths[shape],
    border: stampBorder,
    padding: stampPadding ? `${stampPadding}px` : undefined,
    boxShadow: shadow && !isPolygon ? '0 8px 20px -4px rgba(0,0,0,0.25)' : 'none',
    filter: shadow && isPolygon ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.3))' : undefined,
    overflow: 'hidden',
    display: 'block',
    position: 'relative',
    flexShrink: 0,
    backgroundColor: '#e2e8f0',
    boxSizing: 'border-box'
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
        margin: 0
      }}
    >
      <div className={`cv-avatar-container has-photo cv-avatar--${shape}`} style={containerStyle}>
        <img
          src={image}
          alt={altName || 'Foto de Perfil'}
          className="cv-avatar-img"
          draggable={false}
          style={{
            ...imgStyle,
            userSelect: 'none',
            ['WebkitUserDrag' as any]: 'none',
            pointerEvents: 'none'
          }}
        />
      </div>
    </div>
  )
}
