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

          {(data.basics.driverLicense || data.basics.nationality || data.basics.age || data.basics.civilStatus) && (
            <div className="cv-palette-item">
              <div className="cv-palette-item__info">
                <span className="cv-palette-item__icon">🪪</span>
                <span className="cv-palette-item__name">Dados Civis</span>
              </div>
              <button
                type="button"
                className={`cv-eye-btn ${dimensions['civil']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('civil')}
                title={dimensions['civil']?.hidden ? 'Exibir dados civis' : 'Ocultar dados civis'}
              >
                {dimensions['civil']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
              </button>
            </div>
          )}

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

        {/* ── Categoria: Licenças & Certificações (Atômicas) ── */}
        {data.certificates && data.certificates.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              📜 Licenças & Certificações ({data.certificates.length})
            </div>
            {data.certificates.map((c, idx) => {
              const itemId = getAtomicItemId('certificates', c, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">📜</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{c.name || `Certificado ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{c.issuer || c.date || 'Certificação'}</span>
                    </div>
                  </div>
                  <div className="cv-palette-item__actions">
                    <select
                      className="cv-palette-select"
                      value={itemDims.variant || 'card_box'}
                      onChange={e => handleSelectVariant(itemId, e.target.value)}
                      title="Variante visual deste certificado"
                    >
                      <option value="card_box">📦 Box Card</option>
                      <option value="pill_badge">🏷️ Badge Pill</option>
                      <option value="minimal">📄 Linha Simples</option>
                    </select>
                    <button
                      type="button"
                      className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => handleToggleHide(itemId)}
                      title={isHidden ? 'Exibir na folha' : 'Ocultar certificação'}
                    >
                      {isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Interesses & Pesquisa (Atômicos) ── */}
        {data.interests && data.interests.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              💡 Interesses & Pesquisa ({data.interests.length})
            </div>
            {data.interests.map((it, idx) => {
              const itemId = getAtomicItemId('interests', it, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">💡</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{it.name || `Interesse ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{it.keywords?.length ? `${it.keywords.length} tópicos` : 'Área de interesse'}</span>
                    </div>
                  </div>
                  <div className="cv-palette-item__actions">
                    <select
                      className="cv-palette-select"
                      value={itemDims.variant || 'card_box'}
                      onChange={e => handleSelectVariant(itemId, e.target.value)}
                      title="Variante deste tópico de interesse"
                    >
                      <option value="card_box">📦 Card com Tags</option>
                      <option value="circles">⭕ Círculo Hobbies</option>
                      <option value="minimal">📝 Linha Textual</option>
                    </select>
                    <button
                      type="button"
                      className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => handleToggleHide(itemId)}
                      title={isHidden ? 'Exibir na folha' : 'Ocultar interesse'}
                    >
                      {isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Referências (Atômicas) ── */}
        {data.references && data.references.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              👥 Referências Profissionais ({data.references.length})
            </div>
            {data.references.map((r, idx) => {
              const itemId = getAtomicItemId('references', r, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">👥</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{r.name || `Referência ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{r.company || r.position || r.reference || 'Contato'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                    onClick={() => handleToggleHide(itemId)}
                    title={isHidden ? 'Exibir na folha' : 'Ocultar referência'}
                  >
                    {isHidden ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Prêmios & Distinções (Se existir no YAML) ── */}
        {data.awards && data.awards.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              🏆 Prêmios & Distinções ({data.awards.length})
            </div>
            {data.awards.map((aw, idx) => {
              const itemId = getAtomicItemId('awards', aw, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">🏆</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{aw.title || `Prêmio ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{aw.awarder || aw.date || 'Distinção'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                    onClick={() => handleToggleHide(itemId)}
                    title={isHidden ? 'Exibir na folha' : 'Ocultar prêmio'}
                  >
                    {isHidden ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Trabalho Voluntário (Se existir no YAML) ── */}
        {data.volunteer && data.volunteer.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title">
              🤝 Trabalho Voluntário ({data.volunteer.length})
            </div>
            {data.volunteer.map((v, idx) => {
              const itemId = getAtomicItemId('volunteer', v, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)

              return (
                <div key={itemId} className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                  <div className="cv-palette-item__info">
                    <span className="cv-palette-item__icon">🤝</span>
                    <div className="cv-palette-item__texts">
                      <strong className="cv-palette-item__bold">{v.organization || `Voluntariado ${idx + 1}`}</strong>
                      <span className="cv-palette-item__tiny">{v.position || 'Voluntário'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                    onClick={() => handleToggleHide(itemId)}
                    title={isHidden ? 'Exibir na folha' : 'Ocultar voluntariado'}
                  >
                    {isHidden ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
