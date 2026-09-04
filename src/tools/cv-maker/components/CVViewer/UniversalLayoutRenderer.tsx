import React from 'react'
import type { CVData, LayoutBlueprint, ThemeVariant, ViewMode, CVDesignConfig } from '../../types/cv'
import { BlockHeader } from '../blocks/BlockHeader'
import { BlockContacts } from '../blocks/BlockContacts'
import { BlockCivilData } from '../blocks/BlockCivilData'
import { BlockSummary } from '../blocks/BlockSummary'
import { BlockWork } from '../blocks/BlockWork'
import { BlockProjects } from '../blocks/BlockProjects'
import { BlockEducation } from '../blocks/BlockEducation'
import { BlockSkillsTags } from '../blocks/BlockSkillsTags'
import { BlockSkillsBars } from '../blocks/BlockSkillsBars'
import { BlockLanguages } from '../blocks/BlockLanguages'
import { BlockCertificates } from '../blocks/BlockCertificates'
import { BlockReferences } from '../blocks/BlockReferences'
import { BlockInterests } from '../blocks/BlockInterests'
import { BlockCoverLetter } from '../blocks/BlockCoverLetter'
import { AtomicItemRenderer } from '../blocks/AtomicItemRenderer'
import { BlockPhoto } from '../blocks/BlockPhoto'
import { getAtomicItemId } from '../../utils/atomicIdUtils'
import { StructuralBoxWrapper } from '../CanvasBuilder/StructuralBoxWrapper'
import { ColumnSplitterHandle } from '../CanvasBuilder/ColumnSplitterHandle'
import type { LayoutStructureConfig, SectionBoxDimensions } from '../../types/cv'

interface UniversalLayoutRendererProps {
  data: CVData
  blueprint: LayoutBlueprint
  theme: ThemeVariant
  viewMode: ViewMode
  designConfig?: CVDesignConfig
  onRequestGenerateCoverLetter?: () => void
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
}

export const UniversalLayoutRenderer: React.FC<UniversalLayoutRendererProps> = ({
  data,
  blueprint,
  theme,
  viewMode,
  designConfig,
  onRequestGenerateCoverLetter,
  structureConfig,
  onUpdateStructureConfig
}) => {
  const { basics } = data
  const isFreeCanvas = Boolean(structureConfig?.isFreeCanvasActive)
  const pageRef = React.useRef<HTMLDivElement>(null)
  const [hasPageOverflow, setHasPageOverflow] = React.useState<boolean>(false)
  const [isOverflowBannerDismissed, setIsOverflowBannerDismissed] = React.useState<boolean>(false)

  // Monitora se o conteúdo acumulado excede a altura útil da folha A4 (1122px)
  React.useEffect(() => {
    if (!isFreeCanvas) {
      setHasPageOverflow(false)
      setIsOverflowBannerDismissed(false)
      return
    }

    const checkPageHeight = () => {
      const cardEl = pageRef.current?.querySelector('.cv-card') as HTMLElement | null
      if (cardEl) {
        // Quantidade de caixas atômicas e seções ativas no modo de edição do Canvas
        const activeBoxes = cardEl.querySelectorAll('.cv-structural-box--active')
        const boxCount = activeBoxes.length

        // Cada box ativo introduz paddings, bordas pontilhadas e espaçamentos no DOM do editor.
        // Descontamos esse overhead artificial do editor para não acusar overflow em currículos que cabem na A4:
        const editorOverhead = Math.round(boxCount * 22)
        const dynamicThreshold = 1180 + editorOverhead

        setHasPageOverflow(cardEl.scrollHeight > dynamicThreshold)
      } else if (pageRef.current) {
        setHasPageOverflow(pageRef.current.scrollHeight > 1250)
      }
    }

    checkPageHeight()
    const observer = new ResizeObserver(() => checkPageHeight())
    if (pageRef.current) observer.observe(pageRef.current)
    return () => observer.disconnect()
  }, [isFreeCanvas, structureConfig])

  const handleSwapOrder = (sourceId: string, targetId: string) => {
    if (!structureConfig || !onUpdateStructureConfig || sourceId === targetId) return
    const currentDims = structureConfig.sectionDimensions || {}

    const sourceEl = document.querySelector(`[data-section-id="${sourceId}"]`)
    const targetEl = document.querySelector(`[data-section-id="${targetId}"]`)

    if (sourceEl?.parentElement && sourceEl.parentElement === targetEl?.parentElement) {
      const parent = sourceEl.parentElement
      const siblingBoxes = Array.from(parent.children).filter(el =>
        el.classList.contains('cv-structural-box') && el.hasAttribute('data-section-id')
      ) as HTMLElement[]

      siblingBoxes.sort((a, b) => {
        const idA = a.getAttribute('data-section-id') || ''
        const idB = b.getAttribute('data-section-id') || ''
        const orderA = currentDims[idA]?.order ?? 0
        const orderB = currentDims[idB]?.order ?? 0
        if (orderA !== orderB) return orderA - orderB
        return siblingBoxes.indexOf(a) - siblingBoxes.indexOf(b)
      })

      const sortedIds = siblingBoxes.map(b => b.getAttribute('data-section-id')!).filter(Boolean)
      const srcIdx = sortedIds.indexOf(sourceId)
      const tgtIdx = sortedIds.indexOf(targetId)

      if (srcIdx !== -1 && tgtIdx !== -1) {
        const newSortedIds = [...sortedIds]
        const temp = newSortedIds[srcIdx]
        newSortedIds[srcIdx] = newSortedIds[tgtIdx]
        newSortedIds[tgtIdx] = temp

        const nextDims = { ...currentDims }
        newSortedIds.forEach((id, idx) => {
          nextDims[id] = {
            ...(nextDims[id] || {}),
            order: idx * 10
          }
        })

        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: nextDims
        })
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('cv-box-moved'))
        }, 50)
        return
      }
    }

    const sourceOrder = currentDims[sourceId]?.order ?? 0
    const targetOrder = currentDims[targetId]?.order ?? 10
    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: {
        ...currentDims,
        [sourceId]: { ...(currentDims[sourceId] || {}), order: targetOrder },
        [targetId]: { ...(currentDims[targetId] || {}), order: sourceOrder }
      }
    })
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cv-box-moved'))
    }, 50)
  }

  const handleMoveStep = (secId: string, direction: -1 | 1) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const currentDims = structureConfig.sectionDimensions || {}

    // Localiza o elemento e seus irmãos imediatos no mesmo container do layout
    const currentEl = document.querySelector(`[data-section-id="${secId}"]`)
    const parent = currentEl?.parentElement
    if (!parent) return

    const siblingBoxes = Array.from(parent.children).filter(el =>
      el.classList.contains('cv-structural-box') && el.hasAttribute('data-section-id')
    ) as HTMLElement[]

    if (siblingBoxes.length <= 1) return

    // Ordena de acordo com o CSS order atual, ou posição no DOM em caso de empate
    siblingBoxes.sort((a, b) => {
      const idA = a.getAttribute('data-section-id') || ''
      const idB = b.getAttribute('data-section-id') || ''
      const orderA = currentDims[idA]?.order ?? 0
      const orderB = currentDims[idB]?.order ?? 0
      if (orderA !== orderB) return orderA - orderB
      return siblingBoxes.indexOf(a) - siblingBoxes.indexOf(b)
    })

    const sortedIds = siblingBoxes.map(b => b.getAttribute('data-section-id')!).filter(Boolean)
    const currentIndex = sortedIds.indexOf(secId)
    if (currentIndex === -1) return

    const targetIndex = currentIndex + direction
    if (targetIndex < 0 || targetIndex >= sortedIds.length) {
      // Já está no extremo (topo ou fim do container)
      return
    }

    // Troca as posições exatas dos dois elementos vizinhos
    const newSortedIds = [...sortedIds]
    const temp = newSortedIds[currentIndex]
    newSortedIds[currentIndex] = newSortedIds[targetIndex]
    newSortedIds[targetIndex] = temp

    // Atribui valores de order com espaçamento de 10 para todos os irmãos
    const nextDims = { ...currentDims }
    newSortedIds.forEach((id, idx) => {
      nextDims[id] = {
        ...(nextDims[id] || {}),
        order: idx * 10
      }
    })

    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: nextDims
    })

    // Dispara evento para reavaliar colisões após troca de ordem
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cv-box-moved'))
    }, 50)
  }

  const isMultiColumnLayout = ['compact_split', 'sidebar', 'editorial_accent', 'corporate_timeline'].includes(blueprint.id)

  const handleSwitchZone = (sectionId: string, defaultZone: 'left' | 'right') => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const currentZones = structureConfig.sectionZone || {}
    const activeZone = currentZones[sectionId] || defaultZone
    const nextZone = activeZone === 'left' ? 'right' : 'left'

    onUpdateStructureConfig({
      ...structureConfig,
      sectionZone: {
        ...currentZones,
        [sectionId]: nextZone
      }
    })
  }

  const getSectionZone = (sectionId: string, defaultZone: 'left' | 'right'): 'left' | 'right' => {
    return structureConfig?.sectionZone?.[sectionId] || defaultZone
  }

  const wrapSection = (
    sectionId: string,
    title: string,
    node: React.ReactNode,
    defaultZone?: 'left' | 'right',
    category?: 'work' | 'education' | 'projects' | 'languages' | 'skills' | 'identity' | 'summary' | 'photo' | 'certificates' | 'interests' | 'references' | string
  ) => {
    if (!node) return null
    if (!isFreeCanvas) return node
    const canSwitch = isMultiColumnLayout && Boolean(defaultZone)
    const currentZone = defaultZone ? getSectionZone(sectionId, defaultZone) : undefined

    const baseCategory = category || (sectionId.endsWith('_title') ? sectionId.replace('_title', '') : undefined)
    const rawDims = structureConfig?.sectionDimensions?.[sectionId]
    const parentDims = baseCategory ? structureConfig?.sectionDimensions?.[baseCategory] : undefined
    const effectiveDims = {
      ...parentDims,
      ...rawDims,
      fontFamily: rawDims?.fontFamily || parentDims?.fontFamily,
      fontSizeScale: rawDims?.fontSizeScale ?? parentDims?.fontSizeScale,
      variant: rawDims?.variant || parentDims?.variant
    }

    return (
      <StructuralBoxWrapper
        key={sectionId}
        sectionId={sectionId}
        title={title}
        category={category || baseCategory}
        isFreeCanvasActive={isFreeCanvas}
        dimensions={effectiveDims}
        canSwitchZone={canSwitch}
        currentZone={currentZone}
        onSwitchZone={canSwitch && defaultZone ? () => handleSwitchZone(sectionId, defaultZone) : undefined}
        onSelectVariant={(variantId) => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const cur = structureConfig.sectionDimensions?.[sectionId] || {}
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              [sectionId]: { ...cur, variant: variantId }
            }
          })
        }}
        onToggleHide={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const cur = structureConfig.sectionDimensions?.[sectionId] || {}
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              [sectionId]: { ...cur, hidden: !cur.hidden }
            }
          })
        }}
        onUpdateDimensions={(dims: SectionBoxDimensions) => {
          if (!structureConfig || !onUpdateStructureConfig) return
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              [sectionId]: dims
            }
          })
        }}
        onMoveUp={() => handleMoveStep(sectionId, -1)}
        onMoveDown={() => handleMoveStep(sectionId, +1)}
        onSwapWithSection={(targetId) => handleSwapOrder(sectionId, targetId)}
        onResetDimensions={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const next = { ...structureConfig.sectionDimensions }
          delete next[sectionId]
          const nextZones = { ...(structureConfig.sectionZone || {}) }
          delete nextZones[sectionId]
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: next,
            sectionZone: nextZones
          })
        }}
      >
        {node}
      </StructuralBoxWrapper>
    )
  }

  const renderZoneSection = (
    secId: string,
    targetZone: 'left' | 'right',
    defZone: 'left' | 'right',
    title: string,
    node: React.ReactNode,
    category?: 'work' | 'education' | 'projects' | 'languages' | 'skills' | 'identity' | 'summary' | 'photo' | 'certificates' | 'interests' | 'references' | string
  ) => {
    if (!node) return null
    if (getSectionZone(secId, defZone) !== targetZone) return null
    return wrapSection(secId, title, node, defZone, category)
  }

  // ── Renderizadores com Granularidade Atômica de Itens (Canvas Livre) ──

  const renderPhotoSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Foto de Perfil',
    onlyInFreeCanvas = false
  ) => {
    const photoDims = structureConfig?.sectionDimensions?.['photo']
    if (photoDims?.hidden) return null

    // No modo Canvas Livre: foto soberana com suporte a polígonos, tamanho em px, borda, sombra e pan/zoom
    if (isFreeCanvas) {
      const photoContent = (
        <BlockPhoto
          image={basics.image}
          altName={basics.name}
          shape={photoDims?.photoShape || 'circle'}
          size={photoDims?.photoSize ?? 96}
          borderWidth={photoDims?.photoBorderWidth ?? 0}
          borderColor={photoDims?.photoBorderColor || '#0284c7'}
          shadow={photoDims?.photoShadow ?? true}
          align={photoDims?.photoAlign || 'center'}
          posX={basics.imagePosX ?? 50}
          posY={basics.imagePosY ?? 50}
          scale={basics.imageScale ?? 1.0}
        />
      )

      return targetZone
        ? renderZoneSection('photo', targetZone, defZone, fallbackTitle, photoContent, 'photo')
        : wrapSection('photo', fallbackTitle, photoContent, defZone, 'photo')
    }

    // No modo Template tradicional:
    if (onlyInFreeCanvas || !basics.image) return null
    const standardNode = (
      <BlockPhoto
        image={basics.image}
        altName={basics.name}
        shape="circle"
        size={96}
        borderWidth={0}
        shadow={false}
        align="center"
        posX={basics.imagePosX ?? 50}
        posY={basics.imagePosY ?? 50}
        scale={basics.imageScale ?? 1.0}
      />
    )
    if (targetZone) {
      return getSectionZone('photo', defZone) === targetZone ? standardNode : null
    }
    return standardNode
  }

  const renderWorkSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Experiência Profissional',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.work || data.work.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockWork work={data.work} />
      return targetZone
        ? renderZoneSection('work', targetZone, defZone, fallbackTitle, node, 'work')
        : wrapSection('work', fallbackTitle, node, defZone, 'work')
    }

    const titleNode = <h3 className="cv-section-title">💼 {fallbackTitle}</h3>
    const titleBox = targetZone
      ? renderZoneSection('work_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'work')
      : wrapSection('work_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'work')

    const itemBoxes = data.work.map((w, idx) => {
      const itemId = getAtomicItemId('work', w, idx)
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const companyName = w.company || w.name
      const boxTitle = companyName ? `${w.position ? `${w.position} • ` : ''}${companyName}` : `Experiência #${idx + 1}`
      const content = <AtomicItemRenderer category="work" item={w} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'work')
        : wrapSection(itemId, boxTitle, content, defZone, 'work')
    })

    return (
      <React.Fragment key="work_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const renderEducationSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Formação Acadêmica',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.education || data.education.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockEducation education={data.education} />
      return targetZone
        ? renderZoneSection('education', targetZone, defZone, fallbackTitle, node, 'education')
        : wrapSection('education', fallbackTitle, node, defZone, 'education')
    }

    const titleNode = <h3 className="cv-section-title">🎓 {fallbackTitle}</h3>
    const titleBox = targetZone
      ? renderZoneSection('education_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'education')
      : wrapSection('education_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'education')

    const itemBoxes = data.education.map((ed, idx) => {
      const itemId = getAtomicItemId('education', ed, idx)
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = ed.institution ? `${ed.area || ed.studyType || 'Formação'} • ${ed.institution}` : `Formação #${idx + 1}`
      const content = <AtomicItemRenderer category="education" item={ed} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'education')
        : wrapSection(itemId, boxTitle, content, defZone, 'education')
    })

    return (
      <React.Fragment key="education_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const renderProjectsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Projetos em Destaque',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.projects || data.projects.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockProjects projects={data.projects} />
      return targetZone
        ? renderZoneSection('projects', targetZone, defZone, fallbackTitle, node, 'projects')
        : wrapSection('projects', fallbackTitle, node, defZone, 'projects')
    }

    const titleNode = <h3 className="cv-section-title">🚀 {fallbackTitle}</h3>
    const titleBox = targetZone
      ? renderZoneSection('projects_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'projects')
      : wrapSection('projects_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'projects')

    const itemBoxes = data.projects.map((p, idx) => {
      const itemId = getAtomicItemId('projects', p, idx)
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = p.name ? `Projeto: ${p.name}` : `Projeto #${idx + 1}`
      const content = <AtomicItemRenderer category="projects" item={p} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'projects')
        : wrapSection(itemId, boxTitle, content, defZone, 'projects')
    })

    return (
      <React.Fragment key="projects_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const renderLanguagesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Idiomas',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.languages || data.languages.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockLanguages languages={data.languages} />
      return targetZone
        ? renderZoneSection('languages', targetZone, defZone, fallbackTitle, node, 'languages')
        : wrapSection('languages', fallbackTitle, node, defZone, 'languages')
    }

    const titleNode = <h4 className="cv-sidebar-title">🌐 {fallbackTitle}</h4>
    const titleBox = targetZone
      ? renderZoneSection('languages_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'languages')
      : wrapSection('languages_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'languages')

    const itemBoxes = data.languages.map((l, idx) => {
      const itemId = getAtomicItemId('languages', l, idx)
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'pill_badge'
      const boxTitle = `Idioma: ${l.language}`
      const content = <AtomicItemRenderer category="languages" item={l} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'languages')
        : wrapSection(itemId, boxTitle, content, defZone, 'languages')
    })

    return (
      <React.Fragment key="languages_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const renderSkillsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Competências',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.skills || data.skills.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockSkillsBars skills={data.skills} title={fallbackTitle} />
      return targetZone
        ? renderZoneSection('skills', targetZone, defZone, fallbackTitle, node, 'skills')
        : wrapSection('skills', fallbackTitle, node, defZone, 'skills')
    }

    const titleNode = <h4 className="cv-sidebar-title">⚡ {fallbackTitle}</h4>
    const titleBox = targetZone
      ? renderZoneSection('skills_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'skills')
      : wrapSection('skills_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'skills')

    const itemBoxes = data.skills.map((s, idx) => {
      const itemId = getAtomicItemId('skills', s, idx)
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'badges'
      const boxTitle = s.name ? `Competência: ${s.name}` : `Skill #${idx + 1}`
      const content = <AtomicItemRenderer category="skills" item={s} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'skills')
        : wrapSection(itemId, boxTitle, content, defZone, 'skills')
    })

    return (
      <React.Fragment key="skills_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const renderCertificatesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Licenças & Certificações',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.certificates || data.certificates.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockCertificates certificates={data.certificates} title={fallbackTitle} />
      return targetZone
        ? renderZoneSection('certificates', targetZone, defZone, fallbackTitle, node, 'certificates')
        : wrapSection('certificates', fallbackTitle, node, defZone, 'certificates')
    }

    const titleNode = <h3 className="cv-section-title">📜 {fallbackTitle}</h3>
    const titleBox = targetZone
      ? renderZoneSection('certificates_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'certificates')
      : wrapSection('certificates_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'certificates')

    const itemBoxes = data.certificates.map((c, idx) => {
      const itemId = getAtomicItemId('certificates', c, idx)
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = c.name ? `Certificação: ${c.name}` : `Certificação #${idx + 1}`
      const content = <AtomicItemRenderer category="certificates" item={c} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'certificates')
        : wrapSection(itemId, boxTitle, content, defZone, 'certificates')
    })

    return (
      <React.Fragment key="certificates_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const renderInterestsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Interesses & Pesquisa',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.interests || data.interests.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockInterests interests={data.interests} title={fallbackTitle} />
      return targetZone
        ? renderZoneSection('interests', targetZone, defZone, fallbackTitle, node, 'interests')
        : wrapSection('interests', fallbackTitle, node, defZone, 'interests')
    }

    const titleNode = <h4 className="cv-sidebar-title">💡 {fallbackTitle}</h4>
    const titleBox = targetZone
      ? renderZoneSection('interests_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'interests')
      : wrapSection('interests_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'interests')

    const itemBoxes = data.interests.map((it, idx) => {
      const itemId = getAtomicItemId('interests', it, idx)
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = it.name ? `Interesse: ${it.name}` : `Interesse #${idx + 1}`
      const content = <AtomicItemRenderer category="interests" item={it} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'interests')
        : wrapSection(itemId, boxTitle, content, defZone, 'interests')
    })

    return (
      <React.Fragment key="interests_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const renderReferencesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Referências',
    fallbackNode?: React.ReactNode
  ) => {
    if (!data.references || data.references.length === 0) return null

    if (!isFreeCanvas) {
      const node = fallbackNode || <BlockReferences references={data.references} title={fallbackTitle} />
      return targetZone
        ? renderZoneSection('references', targetZone, defZone, fallbackTitle, node, 'references')
        : wrapSection('references', fallbackTitle, node, defZone, 'references')
    }

    const titleNode = <h3 className="cv-section-title">👥 {fallbackTitle}</h3>
    const titleBox = targetZone
      ? renderZoneSection('references_title', targetZone, defZone, `Título: ${fallbackTitle}`, titleNode, 'references')
      : wrapSection('references_title', `Título: ${fallbackTitle}`, titleNode, defZone, 'references')

    const itemBoxes = data.references.map((r, idx) => {
      const itemId = getAtomicItemId('references', r, idx)
      const boxTitle = r.name ? `Referência: ${r.name}` : `Referência #${idx + 1}`
      const content = <AtomicItemRenderer category="references" item={r} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'references')
        : wrapSection(itemId, boxTitle, content, defZone, 'references')
    })

    return (
      <React.Fragment key="references_atomic_group">
        {titleBox}
        {itemBoxes}
      </React.Fragment>
    )
  }

  const handleUpdateSplitRatio = (newRatio: number) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    onUpdateStructureConfig({
      ...structureConfig,
      columnSplitRatio: newRatio
    })
  }

  const customRootStyles: React.CSSProperties = {
    '--cv-avatar-pos-x': `${basics.imagePosX ?? 50}%`,
    '--cv-avatar-pos-y': `${basics.imagePosY ?? 50}%`,
    '--cv-avatar-scale': `${basics.imageScale ?? 1.0}`,
    ...(designConfig ? {
      '--cv-font-heading': `${designConfig.fontHeading}, sans-serif`,
      '--cv-font-body': `${designConfig.fontBody}, sans-serif`,
      '--cv-font-scale': `${designConfig.fontScale}`,
      '--cv-font-size-base': designConfig.fontSizeBase,
      '--cv-color-primary': designConfig.colorPrimary,
      '--cv-color-secondary': designConfig.colorSecondary,
      '--cv-color-text': designConfig.colorText,
      '--cv-color-text-muted': designConfig.colorTextMuted,
      '--cv-color-bg': designConfig.colorBg,
      '--cv-color-surface': designConfig.colorSurface,
      '--cv-color-border': designConfig.colorBorder,
      '--cv-color-accent': designConfig.colorAccent,
      '--cv-color-sidebar': designConfig.colorSidebar || '#0f172a',
      '--cv-color-workspace-bg': designConfig.colorWorkspaceBg || '#0b1120',
      ...(designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none' ? {
        '--cv-bg-image': `url("${designConfig.backgroundPattern}")`,
      } : {
        '--cv-bg-image': 'none'
      }),
      ...(designConfig.sectionOverrides ? Object.entries(designConfig.sectionOverrides).reduce((acc, [secId, override]) => {
        if (override.textColor) acc[`--sec-${secId}-text`] = override.textColor
        if (override.titleColor) acc[`--sec-${secId}-title`] = override.titleColor
        if (override.bgColor) acc[`--sec-${secId}-bg`] = override.bgColor
        if (override.borderColor) acc[`--sec-${secId}-border`] = override.borderColor
        if (override.accentColor) acc[`--sec-${secId}-accent`] = override.accentColor
        return acc
      }, {} as Record<string, string>) : {})
    } : {})
  } as React.CSSProperties

  const renderCVPage = () => {
    // ── Modelo A4 05: Brand Accent Block (Basil Hailward) ──
    if (blueprint.id === 'editorial_accent') {
      const splitRatio = structureConfig?.columnSplitRatio || 34
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-editorial_accent">
            {wrapSection('header', 'Cabeçalho / Identificação', <BlockHeader basics={basics} variant="brand_block" hideImage={isFreeCanvas} />)}
            <div
              className="cv-editorial-grid"
              style={{
                position: 'relative',
                ...(structureConfig?.columnSplitRatio ? { gridTemplateColumns: `${structureConfig.columnSplitRatio}% 1fr` } : {})
              }}
            >
              <ColumnSplitterHandle
                splitRatio={splitRatio}
                onUpdateSplitRatio={handleUpdateSplitRatio}
                isFreeCanvasActive={isFreeCanvas}
              />
              <aside className="cv-editorial-left cv-sidebar-stack">
                {renderPhotoSection('left', 'left', 'Foto de Perfil', true)}
                {renderZoneSection('contacts', 'left', 'left', 'Contatos', (
                  <div className="cv-sidebar-section">
                    <h4 className="cv-sidebar-title">Contato</h4>
                    <BlockContacts basics={basics} layoutStyle="list" />
                  </div>
                ))}
                {basics.driverLicense || basics.nationality || basics.age ? (
                  renderZoneSection('civil', 'left', 'left', 'Dados Civis', (
                    <div className="cv-sidebar-section">
                      <h4 className="cv-sidebar-title">Dados Civis</h4>
                      <BlockCivilData basics={basics} />
                    </div>
                  ))
                ) : null}
                {renderSkillsSection('left', 'left', 'Expertise')}
                {renderLanguagesSection('left', 'left', 'Idiomas')}
                {renderCertificatesSection('left', 'left', 'Certificações')}
                {renderInterestsSection('left', 'left', 'Interesses')}
                {basics.summary && renderZoneSection('summary', 'left', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
                {renderWorkSection('left', 'right')}
                {renderProjectsSection('left', 'right')}
                {renderEducationSection('left', 'right')}
                {renderReferencesSection('left', 'right', 'Referências')}
              </aside>

              <main className="cv-editorial-main">
                {renderPhotoSection('right', 'left', 'Foto de Perfil', true)}
                {basics.summary && renderZoneSection('summary', 'right', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
                {renderWorkSection('right', 'right')}
                {renderProjectsSection('right', 'right')}
                {renderEducationSection('right', 'right')}
                {renderReferencesSection('right', 'right', 'Referências')}
                {renderZoneSection('contacts', 'right', 'left', 'Contatos', (
                  <div className="cv-sidebar-section">
                    <h4 className="cv-sidebar-title">Contato</h4>
                    <BlockContacts basics={basics} layoutStyle="list" />
                  </div>
                ))}
                {renderSkillsSection('right', 'left', 'Expertise')}
                {renderLanguagesSection('right', 'left', 'Idiomas')}
                {renderCertificatesSection('right', 'left', 'Certificações')}
                {renderInterestsSection('right', 'left', 'Interesses')}
              </main>
            </div>
          </div>
        </div>
      )
    }

    // ── Modelo A4 06: Navy Solid Timeline (Wilkins Micawber) ──
    if (blueprint.id === 'corporate_timeline') {
      const splitRatio = structureConfig?.columnSplitRatio || 32
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-corporate_timeline cv-bleed-card">
            <div
              className="cv-navy-layout"
              style={{
                display: 'grid',
                position: 'relative',
                ...(structureConfig?.columnSplitRatio ? { gridTemplateColumns: `${structureConfig.columnSplitRatio}% 1fr` } : {})
              }}
            >
              <ColumnSplitterHandle
                splitRatio={splitRatio}
                onUpdateSplitRatio={handleUpdateSplitRatio}
                isFreeCanvasActive={isFreeCanvas}
              />
              <aside className="cv-navy-sidebar cv-sidebar-stack">
                {renderPhotoSection('left', 'left', 'Foto de Perfil', true)}
                {renderZoneSection('header_profile', 'left', 'left', 'Perfil & Foto', (
                  <div>
                    {!isFreeCanvas && basics.image && (
                      <div className="cv-avatar-container has-photo">
                        <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                      </div>
                    )}
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.25rem 0', fontWeight: 800, color: '#ffffff' }}>
                        {basics.name}
                      </h2>
                      {basics.label && (
                        <div style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 700, letterSpacing: '0.04em' }}>
                          {basics.label}
                        </div>
                      )}
                    </div>
                    <BlockCivilData basics={basics} />
                  </div>
                ))}
                {renderZoneSection('contacts', 'left', 'left', 'Contatos', (
                  <div className="cv-sidebar-section">
                    <h4 className="cv-sidebar-title" style={{ color: '#f8fafc', borderBottomColor: 'rgba(255,255,255,0.2)' }}>
                      Contato
                    </h4>
                    <BlockContacts basics={basics} layoutStyle="list" />
                  </div>
                ))}
                {renderSkillsSection('left', 'left', 'Expertise')}
                {renderLanguagesSection('left', 'left', 'Idiomas')}
                {renderInterestsSection('left', 'left', 'Interesses')}
                {basics.summary && renderZoneSection('summary', 'left', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
                {renderWorkSection('left', 'right')}
                {renderEducationSection('left', 'right')}
                {renderProjectsSection('left', 'right')}
                {renderCertificatesSection('left', 'right', 'Certificações')}
                {renderReferencesSection('left', 'right', 'Referências')}
              </aside>

              <main className="cv-navy-main">
                {renderPhotoSection('right', 'left', 'Foto de Perfil', true)}
                {basics.summary && renderZoneSection('summary', 'right', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
                {renderWorkSection('right', 'right')}
                {renderEducationSection('right', 'right')}
                {renderProjectsSection('right', 'right')}
                {renderCertificatesSection('right', 'right', 'Certificações')}
                {renderReferencesSection('right', 'right', 'Referências')}
                {renderZoneSection('header_profile', 'right', 'left', 'Perfil & Foto', (
                  <div>
                    {!isFreeCanvas && basics.image && (
                      <div className="cv-avatar-container has-photo">
                        <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                      </div>
                    )}
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.25rem 0', fontWeight: 800, color: '#ffffff' }}>
                        {basics.name}
                      </h2>
                      {basics.label && (
                        <div style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 700, letterSpacing: '0.04em' }}>
                          {basics.label}
                        </div>
                      )}
                    </div>
                    <BlockCivilData basics={basics} />
                  </div>
                ))}
                {renderZoneSection('contacts', 'right', 'left', 'Contatos', (
                  <div className="cv-sidebar-section">
                    <h4 className="cv-sidebar-title" style={{ color: '#f8fafc', borderBottomColor: 'rgba(255,255,255,0.2)' }}>
                      Contato
                    </h4>
                    <BlockContacts basics={basics} layoutStyle="list" />
                  </div>
                ))}
                {renderSkillsSection('right', 'left', 'Expertise')}
                {renderLanguagesSection('right', 'left', 'Idiomas')}
                {renderInterestsSection('right', 'left', 'Interesses')}
              </main>
            </div>
          </div>
        </div>
      )
    }

    // ── Modelo A4 08: Hero Matrix (Mary Smith) ──
    if (blueprint.id === 'hero_matrix') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-hero_matrix">
            {wrapSection('contacts_top', 'Contatos no Topo', <BlockContacts basics={basics} layoutStyle="top_bar" />)}
            {wrapSection('hero_banner', 'Banner Principal', (
              <header className="cv-hero-banner">
                <BlockHeader basics={basics} variant="hero" />
                {!isFreeCanvas && basics.image && (
                  <div className="cv-avatar-container cv-avatar-rect has-photo" style={{ width: '85px', height: '95px', borderRadius: '8px', overflow: 'hidden', border: '2px solid currentColor', flexShrink: 0 }}>
                    <img src={basics.image} alt={basics.name} className="cv-avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </header>
            ))}
            {isFreeCanvas && renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                {renderWorkSection()}
              </div>
              <div>
                {renderEducationSection()}
                {renderProjectsSection()}
                {renderReferencesSection()}
              </div>
            </div>

            {renderSkillsSection(undefined, undefined, 'Matriz de Competências')}
            {renderLanguagesSection()}
            {renderCertificatesSection()}
            {renderInterestsSection()}
          </div>
        </div>
      )
    }

    // ── Modelo A4 04: Split Duo (Victoria Wotton) ──
    if (blueprint.id === 'compact_split') {
      const splitRatio = structureConfig?.columnSplitRatio || 34
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-compact_split">
            <div
              className="cv-duo-layout"
              style={{
                display: 'grid',
                position: 'relative',
                ...(structureConfig?.columnSplitRatio ? { gridTemplateColumns: `${structureConfig.columnSplitRatio}% 1fr` } : {})
              }}
            >
              <ColumnSplitterHandle
                splitRatio={splitRatio}
                onUpdateSplitRatio={handleUpdateSplitRatio}
                isFreeCanvasActive={isFreeCanvas}
              />
              <aside className="cv-duo-left cv-sidebar-stack">
                {renderPhotoSection('left', 'left', 'Foto de Perfil', false)}
                {basics.summary && renderZoneSection('summary', 'left', 'left', 'Perfil / Resumo', (
                  <section className="cv-section cv-avoid-break">
                    <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Perfil</h4>
                    <p className="cv-summary-text" style={{ fontSize: '0.82rem' }}>{basics.summary}</p>
                  </section>
                ))}
                {renderSkillsSection('left', 'left', 'Expertise')}
                {renderInterestsSection('left', 'left', 'Hobbies')}
                {renderZoneSection('civil', 'left', 'left', 'Dados Civis', <BlockCivilData basics={basics} />)}
                {renderLanguagesSection('left', 'left', 'Idiomas')}
                {renderZoneSection('header', 'left', 'right', 'Identificação & Contatos', (
                  <header className="cv-duo-header">
                    <h1 className="cv-name">{basics.name}</h1>
                    {basics.label && <div className="cv-label">{basics.label}</div>}
                    <BlockContacts basics={basics} layoutStyle="row" />
                  </header>
                ))}
                {renderWorkSection('left', 'right')}
                {renderEducationSection('left', 'right')}
                {renderProjectsSection('left', 'right')}
                {renderCertificatesSection('left', 'right', 'Certificações')}
                {renderReferencesSection('left', 'right', 'Referências')}
              </aside>

              <main className="cv-duo-right">
                {renderZoneSection('header', 'right', 'right', 'Identificação & Contatos', (
                  <header className="cv-duo-header">
                    <h1 className="cv-name">{basics.name}</h1>
                    {basics.label && <div className="cv-label">{basics.label}</div>}
                    <BlockContacts basics={basics} layoutStyle="row" />
                  </header>
                ))}
                {renderPhotoSection('right', 'left', 'Foto de Perfil', false)}
                {basics.summary && renderZoneSection('summary', 'right', 'left', 'Perfil / Resumo', (
                  <section className="cv-section cv-avoid-break">
                    <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Perfil</h4>
                    <p className="cv-summary-text" style={{ fontSize: '0.82rem' }}>{basics.summary}</p>
                  </section>
                ))}
                {renderSkillsSection('right', 'left', 'Expertise')}
                {renderWorkSection('right', 'right')}
                {renderEducationSection('right', 'right')}
                {renderProjectsSection('right', 'right')}
                {renderCertificatesSection('right', 'right', 'Certificações')}
                {renderZoneSection('civil', 'right', 'left', 'Dados Civis', <BlockCivilData basics={basics} />)}
                {renderLanguagesSection('right', 'left', 'Idiomas')}
                {renderInterestsSection('right', 'left', 'Hobbies')}
                {renderReferencesSection('right', 'right', 'Referências')}
              </main>
            </div>
          </div>
        </div>
      )
    }

    // ── Modelo A4 03: Executive Sidebar ──
    if (blueprint.id === 'sidebar') {
      const splitRatio = structureConfig?.columnSplitRatio || 32
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-sidebar">
            <div
              className="cv-sidebar-layout"
              style={{
                display: 'grid',
                position: 'relative',
                ...(structureConfig?.columnSplitRatio ? { gridTemplateColumns: `${structureConfig.columnSplitRatio}% 1fr` } : {})
              }}
            >
              <ColumnSplitterHandle
                splitRatio={splitRatio}
                onUpdateSplitRatio={handleUpdateSplitRatio}
                isFreeCanvasActive={isFreeCanvas}
              />
              <aside className="cv-sidebar-col cv-sidebar-stack">
                {renderPhotoSection('left', 'left', 'Foto de Perfil', true)}
                {renderZoneSection('header_profile', 'left', 'left', 'Perfil & Foto', (
                  <div className="cv-sidebar-profile">
                    {!isFreeCanvas && basics.image && (
                      <div className="cv-avatar-container has-photo">
                        <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.2rem 0', fontWeight: 800 }}>{basics.name}</h2>
                      {basics.label && <div style={{ fontSize: '0.85rem', opacity: 0.85, fontWeight: 600 }}>{basics.label}</div>}
                    </div>
                  </div>
                ))}
                {renderZoneSection('contacts', 'left', 'left', 'Contatos', (
                  <div className="cv-sidebar-section">
                    <h4 className="cv-sidebar-title">Contato</h4>
                    <BlockContacts basics={basics} layoutStyle="list" />
                  </div>
                ))}
                {renderSkillsSection('left', 'left', 'Competências', <BlockSkillsTags skills={data.skills} title="Competências" />)}
                {renderLanguagesSection('left', 'left', 'Idiomas')}
                {renderCertificatesSection('left', 'left', 'Certificações')}
                {renderReferencesSection('left', 'left', 'Referências')}
                {renderInterestsSection('left', 'left', 'Interesses')}
                {basics.summary && renderZoneSection('summary', 'left', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
                {renderWorkSection('left', 'right')}
                {renderProjectsSection('left', 'right')}
                {renderEducationSection('left', 'right')}
              </aside>
              <main className="cv-main-col">
                {renderPhotoSection('right', 'left', 'Foto de Perfil', true)}
                {basics.summary && renderZoneSection('summary', 'right', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
                {renderWorkSection('right', 'right')}
                {renderProjectsSection('right', 'right')}
                {renderEducationSection('right', 'right')}
                {renderZoneSection('header_profile', 'right', 'left', 'Perfil & Foto', (
                  <div className="cv-sidebar-profile">
                    {!isFreeCanvas && basics.image && (
                      <div className="cv-avatar-container has-photo">
                        <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.2rem 0', fontWeight: 800 }}>{basics.name}</h2>
                      {basics.label && <div style={{ fontSize: '0.85rem', opacity: 0.85, fontWeight: 600 }}>{basics.label}</div>}
                    </div>
                  </div>
                ))}
                {renderZoneSection('contacts', 'right', 'left', 'Contatos', (
                  <div className="cv-sidebar-section">
                    <h4 className="cv-sidebar-title">Contato</h4>
                    <BlockContacts basics={basics} layoutStyle="list" />
                  </div>
                ))}
                {renderSkillsSection('right', 'left', 'Competências', <BlockSkillsTags skills={data.skills} title="Competências" />)}
                {renderLanguagesSection('right', 'left', 'Idiomas')}
                {renderCertificatesSection('right', 'left', 'Certificações')}
                {renderReferencesSection('right', 'left', 'Referências')}
                {renderInterestsSection('right', 'left', 'Interesses')}
              </main>
            </div>
          </div>
        </div>
      )
    }

    // ── Modelo A4 09: Dynamic Grid Math (Augusto Heiss / Mathematical Balance) ──
    if (blueprint.id === 'dynamic_math') {
      const getGridClass = (count: number) => {
        if (count <= 1) return 'cv-grid-1'
        if (count === 2) return 'cv-grid-2'
        if (count === 3) return 'cv-grid-3'
        if (count === 4) return 'cv-grid-4'
        if (count === 5) return 'cv-grid-5'
        if (count % 3 === 0) return 'cv-grid-3'
        if (count % 3 === 1) return 'cv-grid-2'
        return 'cv-grid-split-3-2'
      }

      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-dynamic_math">
            {isFreeCanvas && renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}
            {wrapSection('header', 'Perfil & Contatos', (
              <header className="cv-math-header">
                <div className="cv-math-header-profile">
                  {!isFreeCanvas && basics.image && (
                    <div className="cv-avatar-container cv-math-avatar">
                      <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                    </div>
                  )}
                  <div>
                    <h1 className="cv-math-name cv-name">{basics.name}</h1>
                    {basics.label && <div className="cv-math-label cv-label">{basics.label}</div>}
                  </div>
                </div>

                <div className="cv-math-contacts">
                  {basics.email && (
                    <div>✉ <a href={`mailto:${basics.email}`} className="cv-link">{basics.email}</a></div>
                  )}
                  {basics.phone && (
                    <div>📞 <a href={`tel:${basics.phone.replace(/[^\d+]/g, '')}`} className="cv-link">{basics.phone}</a></div>
                  )}
                  {basics.location && (
                    <div>📍 {[basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(', ')}</div>
                  )}
                  {basics.url && (
                    <div>🌐 <a href={basics.url} target="_blank" rel="noreferrer" className="cv-link">{basics.url.replace(/^https?:\/\//, '')}</a></div>
                  )}
                  {basics.profiles && basics.profiles.length > 0 && (
                    <div className="cv-math-profiles">
                      {basics.profiles.map((p, idx) => (
                        <div key={idx}>
                          <a href={p.url} target="_blank" rel="noreferrer" className="cv-link">
                            🔗 {p.network}: {p.username}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </header>
            ))}

            {basics.summary && wrapSection('summary', 'Resumo / Sobre Mim', (
              <div className="cv-math-summary">
                {basics.summary}
              </div>
            ))}

            {renderWorkSection(undefined, undefined, 'EXPERIÊNCIA PROFISSIONAL', (
              <section className="cv-section">
                <h2 className="cv-math-section-title">
                  💼 EXPERIÊNCIA PROFISSIONAL
                </h2>
                <div className="cv-math-work-list">
                  {data.work?.map((w, idx) => (
                    <div key={idx} className="cv-math-work-item cv-avoid-break">
                      <div className="cv-item-header">
                        <span className="cv-item-title">{w.position}</span>
                        <span className="cv-item-date">
                          {w.startDate} — {w.endDate || 'Presente'}
                        </span>
                      </div>
                      <div className="cv-item-sub">
                        {w.url ? (
                          <a href={w.url} target="_blank" rel="noreferrer" className="cv-link">
                            {w.name} ↗
                          </a>
                        ) : (
                          w.name
                        )}
                      </div>
                      {w.summary && <p className="cv-item-desc">{w.summary}</p>}
                      {w.highlights && w.highlights.length > 0 && (
                        <ul className="cv-math-bullets">
                          {w.highlights.map((hl, hIdx) => (
                            <li key={hIdx}>{hl}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {renderProjectsSection(undefined, undefined, 'PROJETOS EM DESTAQUE & REPOSITÓRIOS', (
              <section className="cv-section">
                <h2 className="cv-math-section-title">
                  🚀 PROJETOS EM DESTAQUE & REPOSITÓRIOS
                </h2>
                <div className={`cv-math-grid projects-grid ${getGridClass(data.projects?.length || 0)}`}>
                  {data.projects?.map((pr, idx) => (
                    <div key={idx} className="cv-math-project-card cv-avoid-break">
                      <div className="cv-item-header">
                        <span className="cv-item-title">
                          {pr.url ? (
                            <a href={pr.url} target="_blank" rel="noreferrer" className="cv-link">
                              {pr.name} ↗
                            </a>
                          ) : (
                            pr.name
                          )}
                        </span>
                      </div>
                      {pr.description && <p className="cv-item-desc">{pr.description}</p>}
                      {pr.highlights && pr.highlights.length > 0 && (
                        <ul className="cv-math-bullets">
                          {pr.highlights.map((hl, hIdx) => (
                            <li key={hIdx}>{hl}</li>
                          ))}
                        </ul>
                      )}
                      {pr.keywords && pr.keywords.length > 0 && (
                        <div className="cv-math-tags">
                          {pr.keywords.map((kw, kIdx) => (
                            <span key={kIdx} className="cv-badge">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {renderSkillsSection(undefined, undefined, 'COMPETÊNCIAS & HABILIDADES TÉCNICAS', (
              <section className="cv-section">
                <h2 className="cv-math-section-title">
                  ⚡ COMPETÊNCIAS & HABILIDADES TÉCNICAS
                </h2>
                <div className={`cv-math-grid skills-grid ${getGridClass(data.skills?.length || 0)}`}>
                  {data.skills?.map((sk, idx) => (
                    <div key={idx} className="cv-math-skill-card cv-avoid-break">
                      <div className="cv-math-skill-title">
                        {sk.name.toUpperCase()} {sk.level ? `(${sk.level.toUpperCase()})` : ''}
                      </div>
                      {sk.keywords && sk.keywords.length > 0 && (
                        <div className="cv-math-tags">
                          {sk.keywords.map((kw, kIdx) => (
                            <span key={kIdx} className="cv-badge">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {renderEducationSection(undefined, undefined, 'FORMAÇÃO ACADÊMICA', (
              <section className="cv-section">
                <h2 className="cv-math-section-title">
                  🎓 FORMAÇÃO ACADÊMICA
                </h2>
                <div className={`cv-math-grid education-grid ${getGridClass(data.education?.length || 0)}`}>
                  {data.education?.map((edu, idx) => (
                    <div key={idx} className="cv-math-edu-card cv-avoid-break">
                      <div className="cv-item-header" style={{ marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '1rem' }}>🏛️</span>
                        <span className="cv-item-date">{edu.startDate} — {edu.endDate || 'Presente'}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {edu.studyType ? `${edu.studyType} em ` : ''}{edu.area}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '0.15rem' }}>
                        {edu.institution}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {renderLanguagesSection(undefined, undefined, 'IDIOMAS & FLUÊNCIA', (
              <section className="cv-section">
                <h2 className="cv-math-section-title">
                  🌐 IDIOMAS & FLUÊNCIA
                </h2>
                <div className={`cv-math-grid languages-grid ${getGridClass(data.languages?.length || 0)}`}>
                  {data.languages?.map((l, idx) => (
                    <div key={idx} className="cv-math-lang-card cv-avoid-break">
                      <span className="cv-lang-bullet">◆</span>
                      <span style={{ fontWeight: 700 }}>{l.language}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{l.fluency}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {renderCertificatesSection(undefined, undefined, 'CERTIFICAÇÕES & LICENÇAS')}
            {renderInterestsSection(undefined, undefined, 'INTERESSES & FRENTES DE PESQUISA')}
            {renderReferencesSection(undefined, undefined, 'REFERÊNCIAS')}
          </div>
        </div>
      )
    }

    // ── Modelo A4 02 (Linear) ──
    if (blueprint.id === 'linear') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-linear">
            {isFreeCanvas && renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}
            {wrapSection('header', 'Cabeçalho Linear', <BlockHeader basics={basics} variant="linear" hideImage={isFreeCanvas} />)}
            {wrapSection('contacts', 'Contatos', <BlockContacts basics={basics} layoutStyle="row" />)}
            {basics.summary && wrapSection('summary', 'Resumo', <BlockSummary basics={basics} />)}
            {renderWorkSection()}
            {renderProjectsSection()}
            {renderSkillsSection(undefined, undefined, 'Competências', <BlockSkillsTags skills={data.skills} />)}
            {renderEducationSection()}
            {renderLanguagesSection()}
            {renderCertificatesSection()}
            {renderReferencesSection()}
            {renderInterestsSection()}
          </div>
        </div>
      )
    }

    // ── Modelo A4 01 (Modular) e 07 (Warm Magazine) ──
    return (
      <div className="cv-page-a4">
        <div className={`cv-card ${blueprint.customClass || ''}`}>
          {isFreeCanvas && renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}
          {wrapSection('header', 'Cabeçalho Padrão', <BlockHeader basics={basics} variant="standard" hideImage={isFreeCanvas} />)}
          {basics.summary && wrapSection('summary', 'Resumo', <BlockSummary basics={basics} />)}
          {renderWorkSection()}
          {renderProjectsSection()}
          {renderSkillsSection(undefined, undefined, 'Competências', <BlockSkillsTags skills={data.skills} />)}
          {renderEducationSection()}
          {renderLanguagesSection()}
          {renderCertificatesSection()}
          {renderReferencesSection()}
          {renderInterestsSection()}
        </div>
      </div>
    )
  }

  const renderCoverLetterPage = () => {
    return (
      <div className="cv-page-a4 cv-cover-letter-page">
        <div className="cv-card cv-cover-letter-card">
          {wrapSection('cover_header', 'Cabeçalho da Carta', (
            <header className="cv-cover-letter-header">
              <h1 className="cv-name">{basics.name}</h1>
              {basics.label && <div className="cv-label">{basics.label}</div>}
              <div className="cv-contacts cv-contacts-row" style={{ marginTop: '0.4rem' }}>
                {basics.email && <span>✉ {basics.email}</span>}
                {basics.phone && <span>📞 {basics.phone}</span>}
                {basics.location && (
                  <span>📍 {[basics.location.city, basics.location.region].filter(Boolean).join(', ')}</span>
                )}
              </div>
            </header>
          ))}
          <div className="cv-cover-letter-divider" />
          {wrapSection('cover_body', 'Corpo da Carta de Apresentação', (
            <BlockCoverLetter
              coverLetter={data.coverLetter}
              basics={basics}
              onRequestGenerate={onRequestGenerateCoverLetter}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`cv-root theme-${theme} ${blueprint.customClass || ''}`} style={customRootStyles}>
      {hasPageOverflow && isFreeCanvas && !isOverflowBannerDismissed && (
        <div className="cv-page-overflow-banner cv-no-print">
          <span className="cv-page-overflow-icon">⚠️</span>
          <div className="cv-page-overflow-text">
            <strong>Atenção à Altura A4:</strong> O conteúdo reorganizado ultrapassou a altura física de 1 folha A4.
            Encurte caixas ou reduza margens para evitar que o conteúdo vaze para uma página extra na impressão/PDF.
          </div>
          <button
            type="button"
            className="cv-page-overflow-close"
            onClick={() => setIsOverflowBannerDismissed(true)}
            title="Dispensar aviso de altura A4"
          >
            ✕
          </button>
        </div>
      )}
      <div ref={pageRef} className="cv-render-wrapper">
        {viewMode === 'cv' && renderCVPage()}
        {viewMode === 'cover_letter' && renderCoverLetterPage()}
        {viewMode === 'both' && (
          <div className="cv-dossier-wrapper">
            {renderCVPage()}
            <div className="cv-page-break-indicator">
              <span>✂ ─── Quebra de Página A4 (Dossiê de 2 Páginas) ───</span>
            </div>
            {renderCoverLetterPage()}
          </div>
        )}
      </div>
    </div>
  )
}
