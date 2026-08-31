import React from 'react'

interface BlockPhotoProps {
  image?: string
  altName: string
  shape?: 'circle' | 'square' | 'vertical'
}

export const BlockPhoto: React.FC<BlockPhotoProps> = ({ image, altName, shape = 'circle' }) => {
  if (!image) return null

  if (shape === 'vertical') {
    return (
      <div className="cv-editorial-photo-wrap">
        <img src={image} alt={altName} className="cv-editorial-photo" />
      </div>
    )
  }

  return (
    <div className="cv-avatar-container">
      <img
        src={image}
        alt={altName}
        className={shape === 'square' ? 'cv-avatar-square' : 'cv-avatar-img'}
      />
    </div>
  )
}
