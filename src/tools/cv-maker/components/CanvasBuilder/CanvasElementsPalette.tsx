import React from 'react'
import type { CVData, LayoutStructureConfig } from '../../types/cv'
import { getAtomicItemId } from '../../utils/atomicIdUtils'

interface CanvasElementsPaletteProps {
  data: CVData | null
  structureConfig: LayoutStructureConfig
  onUpdateStructureConfig: (config: LayoutStructureConfig) => void
  onResetStructure: () => void
}

export const CanvasElementsPalette: React.FC<CanvasElementsPaletteProps> = ({
  data,
  structureConfig,
  onUpdateStructureConfig,
  onResetStructure
}) => {
  if (!data) {
    return (
      <div className="cv-elements-palette cv-elements-palette--empty">
        <p>Nenhum dado de currículo carregado.</p>
      </div>
    )
  }

  const dimensions = structureConfig.sectionDimensions || {}

  // Alterna visibilidade (ocultar / exibir) de um bloco ou item atômico
  const handleToggleHide = (key: string) => {
    const cur = dimensions[key] || {}
    const nextHidden = !cur.hidden
    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: {
        ...dimensions,
        [key]: {
          ...cur,
          hidden: nextHidden
        }
      }
    })
  }

  // Altera a variante visual de um bloco
  const handleSelectVariant = (key: string, variantId: string) => {
    const cur = dimensions[key] || {}
    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: {
        ...dimensions,
        [key]: {
          ...cur,
          variant: variantId
        }
      }
    })
  }

  // Contagem de itens visíveis vs ocultos
  const totalHidden = Object.values(dimensions).filter(d => d.hidden).length

  return (
    <div className="cv-elements-palette">
      {/* Cabeçalho da Paleta */}
      <div className="cv-elements-palette__header">
        <div>
          <h4 className="cv-elements-palette__title">🎨 Elementos do Canvas</h4>
          <span className="cv-elements-palette__subtitle">
            Personalize variantes, visibilidade e ordem dos blocos
          </span>
        </div>
        <button
          type="button"
          className="cv-elements-palette__reset-btn"
          onClick={onResetStructure}
          title="Redefinir todas as alterações estruturais para o padrão do modelo"
        >
          ↺ Restaurar
        </button>
      </div>

      {totalHidden > 0 && (
        <div className="cv-elements-palette__alert">
          <span>👁️‍🗨️ {totalHidden} {totalHidden === 1 ? 'item ocultado' : 'itens ocultados'} da folha A4</span>
        </div>
      )}

      {/* Lista de Categorias & Itens Atômicos */}
      <div className="cv-elements-palette__sections">
        
        {/* ── Categoria: Identidade & Cabeçalho ── */}
        <div className="cv-palette-group">
          <div className="cv-palette-group__title">👤 Identidade & Foto</div>

          <div className="cv-palette-item">
            <div className="cv-palette-item__info">
              <span className="cv-palette-item__icon">🏷️</span>
              <span className="cv-palette-item__name">Nome & Título</span>
            </div>
            <button
              type="button"
              className={`cv-eye-btn ${dimensions['header']?.hidden ? 'is-hidden' : ''}`}
              onClick={() => handleToggleHide('header')}
              title={dimensions['header']?.hidden ? 'Exibir na folha' : 'Ocultar da folha'}
            >
              {dimensions['header']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
            </button>
          </div>

          {data.basics.image && (
            <div className="cv-palette-item">
              <div className="cv-palette-item__info">
                <span className="cv-palette-item__icon">📷</span>
                <span className="cv-palette-item__name">Foto de Perfil</span>
              </div>
              <div className="cv-palette-item__actions">
                <select
                  className="cv-palette-select"
                  value={dimensions['photo']?.variant || 'circle'}
                  onChange={e => handleSelectVariant('photo', e.target.value)}
                  title="Estilo da moldura da foto"
                >
                  <option value="circle">⭕ Redonda</option>
                  <option value="rounded_rect">🔲 Retangular</option>
                  <option value="editorial_stamp">📰 Selo Stamp</option>
                </select>
                <button
                  type="button"
                  className={`cv-eye-btn ${dimensions['photo']?.hidden ? 'is-hidden' : ''}`}
                  onClick={() => handleToggleHide('photo')}
                  title={dimensions['photo']?.hidden ? 'Exibir foto' : 'Ocultar foto'}
                >
                  {dimensions['photo']?.hidden ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
            </div>
          )}

          <div className="cv-palette-item">
            <div className="cv-palette-item__info">
              <span className="cv-palette-item__icon">📞</span>
              <span className="cv-palette-item__name">Contatos & Redes</span>
            </div>
            <button
              type="button"
              className={`cv-eye-btn ${dimensions['contacts']?.hidden ? 'is-hidden' : ''}`}
              onClick={() => handleToggleHide('contacts')}
              title={dimensions['contacts']?.hidden ? 'Exibir contatos' : 'Ocultar contatos'}
            >
              {dimensions['contacts']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
            </button>
          </div>

          {data.basics.summary && (
            <div className="cv-palette-item">
              <div className="cv-palette-item__info">
                <span className="cv-palette-item__icon">📝</span>
                <span className="cv-palette-item__name">Sobre Mim / Resumo</span>
              </div>
              <button
                type="button"
                className={`cv-eye-btn ${dimensions['summary']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('summary')}
              >
                {dimensions['summary']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
              </button>
            </div>
          )}
        </div>

        {/* ── Categoria: Experiências Profissionais (Desmembradas Atômicas) ── */}
        {data.work && data.work.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              💼 Experiência Profissional ({data.work.length})
            </div>
            {data.work.map((w, idx) => {
              const itemId = getAtomicItemId('work', w, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">🏢</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{w.company || w.name || `Empresa ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{w.position || 'Cargo'}</span>
                    </div>
                  </div>
                  <div className="cv-palette-item__actions">
                    <select
                      className="cv-palette-select"
                      value={itemDims.variant || 'card_box'}
                      onChange={e => handleSelectVariant(itemId, e.target.value)}
                      title="Variante de exibição deste cargo"
                    >
                      <option value="card_box">📦 Box Card</option>
                      <option value="timeline">⏱️ Timeline</option>
                      <option value="minimal">📄 Minimal</option>
                      <option value="ultra_compact">📏 1 Linha (A4)</option>
                    </select>
                    <button
                      type="button"
                      className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => handleToggleHide(itemId)}
                      title={isHidden ? 'Exibir na folha' : 'Ocultar cargo'}
                    >
                      {isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Formação Acadêmica (Desmembrada Atômica) ── */}
        {data.education && data.education.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              🎓 Formação Acadêmica ({data.education.length})
            </div>
            {data.education.map((ed, idx) => {
              const itemId = getAtomicItemId('education', ed, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">🏛️</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{ed.area || ed.studyType || `Curso ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{ed.institution}</span>
                    </div>
                  </div>
                  <div className="cv-palette-item__actions">
                    <select
                      className="cv-palette-select"
                      value={itemDims.variant || 'card_box'}
                      onChange={e => handleSelectVariant(itemId, e.target.value)}
                      title="Variante de layout desta formação"
                    >
                      <option value="card_box">📦 Box Card</option>
                      <option value="timeline">⏱️ Timeline</option>
                      <option value="ultra_compact">📏 1 Linha (A4)</option>
                    </select>
                    <button
                      type="button"
                      className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => handleToggleHide(itemId)}
                      title={isHidden ? 'Exibir na folha' : 'Ocultar curso'}
                    >
                      {isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Projetos em Destaque (Desmembrados Atômicos) ── */}
        {data.projects && data.projects.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              🚀 Projetos em Destaque ({data.projects.length})
            </div>
            {data.projects.map((p, idx) => {
              const itemId = getAtomicItemId('projects', p, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">💻</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{p.name || `Projeto ${idx + 1}`}</strong>
                      {p.url && <span className="cv-palette-item__tiny">🔗 Link ativo</span>}
                    </div>
                  </div>
                  <div className="cv-palette-item__actions">
                    <select
                      className="cv-palette-select"
                      value={itemDims.variant || 'card_box'}
                      onChange={e => handleSelectVariant(itemId, e.target.value)}
                      title="Variante deste projeto"
                    >
                      <option value="card_box">📦 Showcase Box</option>
                      <option value="minimal">📄 Minimal Link</option>
                      <option value="ultra_compact">📏 1 Linha (A4)</option>
                    </select>
                    <button
                      type="button"
                      className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => handleToggleHide(itemId)}
                      title={isHidden ? 'Exibir na folha' : 'Ocultar projeto'}
                    >
                      {isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Competências & Habilidades (Atômicas) ── */}
        {data.skills && data.skills.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              ⚡ Competências & Grupos ({data.skills.length})
            </div>
            {data.skills.map((s, idx) => {
              const itemId = getAtomicItemId('skills', s, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">🎯</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{s.name || `Grupo ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{s.keywords?.length || 0} termos</span>
                    </div>
                  </div>
                  <div className="cv-palette-item__actions">
                    <select
                      className="cv-palette-select"
                      value={itemDims.variant || 'badges'}
                      onChange={e => handleSelectVariant(itemId, e.target.value)}
                      title="Variante deste grupo de skills"
                    >
                      <option value="badges">🏷️ Pílulas / Badges</option>
                      <option value="bars">📊 Barras de Nível</option>
                      <option value="minimal">📝 Texto Simples</option>
                    </select>
                    <button
                      type="button"
                      className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => handleToggleHide(itemId)}
                      title={isHidden ? 'Exibir na folha' : 'Ocultar grupo'}
                    >
                      {isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Idiomas (Atômicos) ── */}
        {data.languages && data.languages.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              🌐 Idiomas ({data.languages.length})
            </div>
            {data.languages.map((l, idx) => {
              const itemId = getAtomicItemId('languages', l, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">🗣️</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{l.language}</strong>
                      <span className="cv-palette-item__tiny">{l.fluency || 'Básico'}</span>
                    </div>
                  </div>
                  <div className="cv-palette-item__actions">
                    <select
                      className="cv-palette-select"
                      value={itemDims.variant || 'pill_badge'}
                      onChange={e => handleSelectVariant(itemId, e.target.value)}
                      title="Variante deste idioma"
                    >
                      <option value="pill_badge">🏷️ Pill Badge</option>
                      <option value="dots">⚪ Pontos (Dots)</option>
                      <option value="minimal">📄 Texto Simples</option>
                    </select>
                    <button
                      type="button"
                      className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => handleToggleHide(itemId)}
                      title={isHidden ? 'Exibir na folha' : 'Ocultar idioma'}
                    >
                      {isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
