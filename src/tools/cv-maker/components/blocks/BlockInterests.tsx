import React from 'react'
import type { CVInterest } from '../../types/cv'

const HOBBY_ICONS: Record<string, string> = {
  camera: '📷',
  palette: '🎨',
  plane: '✈️',
  book: '📚',
  code: '💻',
  music: '🎵',
  coffee: '☕',
  globe: '🌐',
  chess: '♟️',
  gym: '🏋️'
}

interface BlockInterestsProps {
  interests?: CVInterest[]
  title?: string
  layoutStyle?: 'grid' | 'circles'
}

export const BlockInterests: React.FC<BlockInterestsProps> = ({
  interests,
  title = 'Interesses & Pesquisa',
  layoutStyle = 'grid'
}) => {
  if (!interests || interests.length === 0) return null

  if (layoutStyle === 'circles') {
    return (
      <section className="cv-section cv-section-interests cv-avoid-break">
        {title && <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>{title}</h4>}
        <div className="cv-hobbies-grid">
          {interests.map((item, idx) => {
            const icon = item.icon && HOBBY_ICONS[item.icon] ? HOBBY_ICONS[item.icon] : '🎯'
            return (
              <div key={idx}>
                <div className="cv-hobby-circle">{icon}</div>
                <div className="cv-hobby-label">{item.name}</div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className="cv-section cv-section-interests cv-avoid-break">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-interests-grid">
        {interests.map((item, idx) => {
          const icon = item.icon && HOBBY_ICONS[item.icon] ? HOBBY_ICONS[item.icon] : '🎯'
          return (
            <div key={idx} className="cv-interest-card">
              <span className="cv-interest-icon">{icon}</span>
              <div className="cv-interest-info">
                <span className="cv-interest-name">{item.name}</span>
                {item.keywords && item.keywords.length > 0 && (
                  <span className="cv-interest-keywords">{item.keywords.join(', ')}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
