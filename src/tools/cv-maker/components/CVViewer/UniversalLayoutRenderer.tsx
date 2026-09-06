import React from 'react'
import type { CVData, LayoutBlueprint, ThemeVariant, ViewMode, CVDesignConfig, CustomCanvasZone, LayoutStructureConfig, SectionBoxDimensions } from '../../types/cv'
import { BlockHeader } from '../blocks/BlockHeader'
import { BlockContacts } from '../blocks/BlockContacts'
import { BlockCivilData } from '../blocks/BlockCivilData'
import { BlockSummary } from '../blocks/BlockSummary'
import { BlockSkillsTags } from '../blocks/BlockSkillsTags'
import { BlockCoverLetter } from '../blocks/BlockCoverLetter'
import { AtomicItemRenderer } from '../blocks/AtomicItemRenderer'
import { BlockPhoto } from '../blocks/BlockPhoto'
import { getAtomicItemId } from '../../utils/atomicIdUtils'
import { StructuralBoxWrapper } from '../CanvasBuilder/StructuralBoxWrapper'
import { ColumnSplitterHandle } from '../CanvasBuilder/ColumnSplitterHandle'

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
  const [isTemporalBannerDismissed, setIsTemporalBannerDismissed] = React.useState<boolean>(false)
  const [isTemporalExpanded, setIsTemporalExpanded] = React.useState<boolean>(false)

  // Sincroniza em tempo real as variáveis de fundo no :root (<html>)
  // Isso assegura que na impressão (PDF/Papel) o Chromium preencha 100% da folha física e qualquer margem personalizada
  React.useEffect(() => {
    const root = document.documentElement
    const themeDefaultBg = theme === 'terminal' ? '#090d16' : '#ffffff'
    const effectiveBgColor = designConfig?.colorBg || themeDefaultBg
    const effectiveBgPattern = designConfig?.backgroundPattern && designConfig.backgroundPattern !== 'none'
      ? `url("${designConfig.backgroundPattern}")`
      : 'none'

    root.style.setProperty('--cv-color-bg', effectiveBgColor)
    root.style.setProperty('--cv-bg-image', effectiveBgPattern)

    return () => {
      root.style.removeProperty('--cv-color-bg')
      root.style.removeProperty('--cv-bg-image')
    }
  }, [designConfig?.colorBg, designConfig?.backgroundPattern, theme])

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

  const getSortedItems = React.useCallback(<T,>(
    _category: string,
    items: T[] | undefined,
    getId: (item: T, index: number) => string
  ): { item: T; originalIndex: number; itemId: string }[] => {
    if (!items || items.length === 0) return []
    return items
      .map((item, originalIndex) => ({
        item,
        originalIndex,
        itemId: getId(item, originalIndex)
      }))
      .sort((a, b) => {
        const orderA = structureConfig?.sectionDimensions?.[a.itemId]?.order ?? (a.originalIndex * 10)
        const orderB = structureConfig?.sectionDimensions?.[b.itemId]?.order ?? (b.originalIndex * 10)
        return orderA - orderB
      })
  }, [structureConfig?.sectionDimensions])

  const getDynamicMathSections = React.useCallback(() => {
    const defaultSections = [
      'photo',
      'header',
      ...(data.basics?.summary ? ['summary'] : []),
      ...(data.work && data.work.length > 0 ? ['work'] : []),
      ...(data.projects && data.projects.length > 0 ? ['projects'] : []),
      ...(data.skills && data.skills.length > 0 ? ['skills_tags'] : []),
      ...(data.education && data.education.length > 0 ? ['education'] : []),
      ...(data.languages && data.languages.length > 0 ? ['languages'] : []),
      ...(data.certificates && data.certificates.length > 0 ? ['certificates'] : []),
      ...(data.interests && data.interests.length > 0 ? ['interests'] : []),
      ...(data.references && data.references.length > 0 ? ['references'] : [])
    ]

    return [...defaultSections].sort((a, b) => {
      const titleA = `${a.replace('_tags', '')}_title`
      const titleB = `${b.replace('_tags', '')}_title`
      const orderA = structureConfig?.sectionDimensions?.[titleA]?.order ??
                     structureConfig?.sectionDimensions?.[a]?.order ??
                     (defaultSections.indexOf(a) * 10)
      const orderB = structureConfig?.sectionDimensions?.[titleB]?.order ??
                     structureConfig?.sectionDimensions?.[b]?.order ??
                     (defaultSections.indexOf(b) * 10)
      return orderA - orderB
    })
  }, [data, structureConfig?.sectionDimensions])

  const handleMoveStep = (secId: string, direction: -1 | 1) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const currentDims = structureConfig.sectionDimensions || {}

    // 1. Caso item atômico (ex: work-0, proj-1, edu-2)
    const atomicPrefixes = [
      { prefix: 'work-', category: 'work', list: data.work, getId: (w: any, i: number) => getAtomicItemId('work', w, i) },
      { prefix: 'proj-', category: 'projects', list: data.projects, getId: (p: any, i: number) => getAtomicItemId('projects', p, i) },
      { prefix: 'edu-', category: 'education', list: data.education, getId: (e: any, i: number) => getAtomicItemId('education', e, i) },
      { prefix: 'lang-', category: 'languages', list: data.languages, getId: (l: any, i: number) => getAtomicItemId('languages', l, i) },
      { prefix: 'skill-', category: 'skills', list: data.skills, getId: (s: any, i: number) => getAtomicItemId('skills', s, i) },
      { prefix: 'cert-', category: 'certificates', list: data.certificates, getId: (c: any, i: number) => getAtomicItemId('certificates', c, i) },
      { prefix: 'int-', category: 'interests', list: data.interests, getId: (it: any, i: number) => getAtomicItemId('interests', it, i) },
      { prefix: 'ref-', category: 'references', list: data.references, getId: (r: any, i: number) => getAtomicItemId('references', r, i) }
    ]

    const matchedAtomic = atomicPrefixes.find(a => secId.startsWith(a.prefix))
    if (matchedAtomic && matchedAtomic.list) {
      const sorted = getSortedItems(matchedAtomic.category, matchedAtomic.list, matchedAtomic.getId)
      const idList = sorted.map(x => x.itemId)
      const curIndex = idList.indexOf(secId)
      if (curIndex !== -1) {
        const targetIndex = curIndex + direction
        if (targetIndex >= 0 && targetIndex < idList.length) {
          const newIdList = [...idList]
          const temp = newIdList[curIndex]
          newIdList[curIndex] = newIdList[targetIndex]
          newIdList[targetIndex] = temp

          const nextDims = { ...currentDims }
          newIdList.forEach((id, idx) => {
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
    }

    // 2. Caso seção de alto nível (ex: projects_title, work_title, header, photo, summary)
    const normSec = secId.replace('_title', '')
    const activeSections = getDynamicMathSections()
    const mappedSec = normSec === 'skills' ? 'skills_tags' : normSec
    const curIndex = activeSections.indexOf(mappedSec)

    if (curIndex !== -1) {
      const targetIndex = curIndex + direction
      if (targetIndex >= 0 && targetIndex < activeSections.length) {
        const newSecList = [...activeSections]
        const temp = newSecList[curIndex]
        newSecList[curIndex] = newSecList[targetIndex]
        newSecList[targetIndex] = temp

        const nextDims = { ...currentDims }
        newSecList.forEach((key, idx) => {
          const titleKey = `${key.replace('_tags', '')}_title`
          const newOrder = idx * 10
          nextDims[key] = { ...(nextDims[key] || {}), order: newOrder }
          nextDims[titleKey] = { ...(nextDims[titleKey] || {}), order: newOrder }
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

    // 3. Fallback genérico para irmãos no DOM
    const currentEl = document.querySelector(`[data-section-id="${secId}"]`)
    const parent = currentEl?.parentElement
    if (!parent) return

    const siblingBoxes = Array.from(parent.children).filter(el =>
      el.classList.contains('cv-structural-box') && el.hasAttribute('data-section-id')
    ) as HTMLElement[]

    if (siblingBoxes.length <= 1) return

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
    if (targetIndex < 0 || targetIndex >= sortedIds.length) return

    const newSortedIds = [...sortedIds]
    const temp = newSortedIds[currentIndex]
    newSortedIds[currentIndex] = newSortedIds[targetIndex]
    newSortedIds[targetIndex] = temp

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
    const baseCategory = category || (sectionId.endsWith('_title') ? sectionId.replace('_title', '') : undefined)
    const rawDims = structureConfig?.sectionDimensions?.[sectionId]
    const parentDims = baseCategory ? structureConfig?.sectionDimensions?.[baseCategory] : undefined
    const effectiveDims = {
      ...parentDims,
      ...rawDims,
      fontFamily: rawDims?.fontFamily || parentDims?.fontFamily,
      fontSizeScale: rawDims?.fontSizeScale ?? parentDims?.fontSizeScale,
      variant: rawDims?.variant || parentDims?.variant,
      hidden: rawDims?.hidden ?? parentDims?.hidden
    }

    if (effectiveDims.hidden && !isFreeCanvas) {
      return null
    }

    if (!isFreeCanvas) {
      const widthPercent = effectiveDims.widthPercent
      const hasCustomWidth = typeof widthPercent === 'number' && widthPercent > 0 && widthPercent < 100
      const hasCustomFont = Boolean(effectiveDims.fontFamily)
      const hasCustomScale = typeof effectiveDims.fontSizeScale === 'number' && effectiveDims.fontSizeScale !== 1
      const alignment = effectiveDims.alignment

      if (hasCustomWidth || hasCustomFont || hasCustomScale || alignment || effectiveDims.order !== undefined) {
        const marginLeftStyle = alignment === 'center' || alignment === 'right' ? 'auto' : undefined
        const marginRightStyle = alignment === 'center' ? 'auto' : alignment === 'right' ? '0' : undefined

        return (
          <div
            key={sectionId}
            className="cv-atomic-box-wrapper cv-avoid-break"
            style={{
              width: hasCustomWidth ? `${widthPercent}%` : undefined,
              display: hasCustomWidth ? 'inline-block' : undefined,
              verticalAlign: hasCustomWidth ? 'top' : undefined,
              boxSizing: 'border-box',
              marginLeft: marginLeftStyle,
              marginRight: marginRightStyle,
              order: effectiveDims.order,
              fontFamily: effectiveDims.fontFamily ? `"${effectiveDims.fontFamily}", sans-serif` : undefined,
              fontSize: hasCustomScale ? `${effectiveDims.fontSizeScale}em` : undefined
            }}
            data-section-id={sectionId}
          >
            {node}
          </div>
        )
      }
      return node
    }

    const canSwitch = isMultiColumnLayout && Boolean(defaultZone)
    const currentZone = defaultZone ? getSectionZone(sectionId, defaultZone) : undefined

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
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.work || data.work.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">💼 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('work_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'work')
      : wrapSection('work_title', `Título: ${titleText}`, titleNode, defZone, 'work')

    const sorted = getSortedItems('work', data.work, (w, i) => getAtomicItemId('work', w, i))
    const itemBoxes = sorted.map(({ item: w, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const companyName = w.company || w.name
      const boxTitle = companyName ? `${w.position ? `${w.position} • ` : ''}${companyName}` : `Experiência #${idx + 1}`
      const content = <AtomicItemRenderer category="work" item={w} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'work')
        : wrapSection(itemId, boxTitle, content, defZone, 'work')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-work-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="work_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderEducationSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Formação Acadêmica',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.education || data.education.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">🎓 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('education_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'education')
      : wrapSection('education_title', `Título: ${titleText}`, titleNode, defZone, 'education')

    const sorted = getSortedItems('education', data.education, (ed, i) => getAtomicItemId('education', ed, i))
    const itemBoxes = sorted.map(({ item: ed, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = ed.institution ? `${ed.area || ed.studyType || 'Formação'} • ${ed.institution}` : `Formação #${idx + 1}`
      const content = <AtomicItemRenderer category="education" item={ed} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'education')
        : wrapSection(itemId, boxTitle, content, defZone, 'education')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-education-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="education_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderProjectsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Projetos em Destaque',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.projects || data.projects.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">🚀 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('projects_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'projects')
      : wrapSection('projects_title', `Título: ${titleText}`, titleNode, defZone, 'projects')

    const sorted = getSortedItems('projects', data.projects, (p, i) => getAtomicItemId('projects', p, i))
    const itemBoxes = sorted.map(({ item: p, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = p.name ? `Projeto: ${p.name}` : `Projeto #${idx + 1}`
      const content = <AtomicItemRenderer category="projects" item={p} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'projects')
        : wrapSection(itemId, boxTitle, content, defZone, 'projects')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-projects-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="projects_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderLanguagesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Idiomas',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.languages || data.languages.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h4 className="cv-sidebar-title">🌐 {titleText}</h4>
    const titleBox = targetZone
      ? renderZoneSection('languages_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'languages')
      : wrapSection('languages_title', `Título: ${titleText}`, titleNode, defZone, 'languages')

    const sorted = getSortedItems('languages', data.languages, (l, i) => getAtomicItemId('languages', l, i))
    const itemBoxes = sorted.map(({ item: l, originalIndex: _idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'pill_badge'
      const boxTitle = `Idioma: ${l.language}`
      const content = <AtomicItemRenderer category="languages" item={l} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'languages')
        : wrapSection(itemId, boxTitle, content, defZone, 'languages')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-languages-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="languages_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderSkillsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Competências',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.skills || data.skills.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h4 className="cv-sidebar-title">⚡ {titleText}</h4>
    const titleBox = targetZone
      ? renderZoneSection('skills_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'skills')
      : wrapSection('skills_title', `Título: ${titleText}`, titleNode, defZone, 'skills')

    const sorted = getSortedItems('skills', data.skills, (s, i) => getAtomicItemId('skills', s, i))
    const itemBoxes = sorted.map(({ item: s, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'badges'
      const boxTitle = s.name ? `Competência: ${s.name}` : `Skill #${idx + 1}`
      const content = <AtomicItemRenderer category="skills" item={s} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'skills')
        : wrapSection(itemId, boxTitle, content, defZone, 'skills')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-skills-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="skills_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderCertificatesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Licenças & Certificações',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.certificates || data.certificates.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">📜 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('certificates_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'certificates')
      : wrapSection('certificates_title', `Título: ${titleText}`, titleNode, defZone, 'certificates')

    const sorted = getSortedItems('certificates', data.certificates, (c, i) => getAtomicItemId('certificates', c, i))
    const itemBoxes = sorted.map(({ item: c, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = c.name ? `Certificação: ${c.name}` : `Certificação #${idx + 1}`
      const content = <AtomicItemRenderer category="certificates" item={c} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'certificates')
        : wrapSection(itemId, boxTitle, content, defZone, 'certificates')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-certificates-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="certificates_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderInterestsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Interesses & Pesquisa',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.interests || data.interests.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h4 className="cv-sidebar-title">💡 {titleText}</h4>
    const titleBox = targetZone
      ? renderZoneSection('interests_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'interests')
      : wrapSection('interests_title', `Título: ${titleText}`, titleNode, defZone, 'interests')

    const sorted = getSortedItems('interests', data.interests, (it, i) => getAtomicItemId('interests', it, i))
    const itemBoxes = sorted.map(({ item: it, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'pill_badge'
      const boxTitle = it.name ? `Interesse: ${it.name}` : `Interesse #${idx + 1}`
      const content = <AtomicItemRenderer category="interests" item={it} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'interests')
        : wrapSection(itemId, boxTitle, content, defZone, 'interests')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-interests-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="interests_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderReferencesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Referências',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => {
    if (!data.references || data.references.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">👥 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('references_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'references')
      : wrapSection('references_title', `Título: ${titleText}`, titleNode, defZone, 'references')

    const sorted = getSortedItems('references', data.references, (r, i) => getAtomicItemId('references', r, i))
    const itemBoxes = sorted.map(({ item: r, originalIndex: idx, itemId }) => {
      const boxTitle = r.name ? `Referência: ${r.name}` : `Referência #${idx + 1}`
      const content = <AtomicItemRenderer category="references" item={r} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'references')
        : wrapSection(itemId, boxTitle, content, defZone, 'references')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-references-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="references_atomic_group">
        {titleBox}
        {wrappedItems}
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

  const customRootStyles: React.CSSProperties = ({
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
      '--cv-color-sidebar': designConfig.colorSidebar || '#f8fafc',
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
        if (override.bgImage && override.bgImage !== 'none') acc[`--sec-${secId}-bg-image`] = `url("${override.bgImage}")`
        return acc
      }, {} as Record<string, string>) : {})
    } : {})
  } as React.CSSProperties)

  // Estados de Zonas Customizadas e Desenho Interativo (Paint / Polígono)
  const [selectedZoneId, setSelectedZoneId] = React.useState<string | null>(null)
  const [draggingZoneId, setDraggingZoneId] = React.useState<string | null>(null)
  const [drawingMode, setDrawingMode] = React.useState<'rect' | 'polygon' | null>(null)
  const [drawingStart, setDrawingStart] = React.useState<{ x: number; y: number } | null>(null)
  const [drawingCurrent, setDrawingCurrent] = React.useState<{ x: number; y: number } | null>(null)
  const [polygonPoints, setPolygonPoints] = React.useState<Array<{ x: number; y: number }>>([])
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null)
  const drawingOverlayRef = React.useRef<HTMLDivElement>(null)

  // Escuta de eventos globais de desenho e seleção vindos da barra lateral
  React.useEffect(() => {
    const handleStartDraw = (e: any) => {
      // Assegura que o modo canvas seja ativado caso ainda não estivesse
      if (!structureConfig?.isFreeCanvasActive && onUpdateStructureConfig && structureConfig) {
        onUpdateStructureConfig({
          ...structureConfig,
          isFreeCanvasActive: true
        })
      }
      setDrawingMode(e.detail?.mode || 'rect')
      setDrawingStart(null)
      setDrawingCurrent(null)
      setPolygonPoints([])
      setMousePos(null)
    }

    const handleCancelDraw = () => {
      setDrawingMode(null)
      setDrawingStart(null)
      setDrawingCurrent(null)
      setPolygonPoints([])
      setMousePos(null)
    }

    const handleSelectZoneEvent = (e: any) => {
      setSelectedZoneId(e.detail?.zoneId || null)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelDraw()
      }
    }

    window.addEventListener('cv-canvas-start-draw' as any, handleStartDraw)
    window.addEventListener('cv-canvas-cancel-draw' as any, handleCancelDraw)
    window.addEventListener('cv-canvas-select-zone' as any, handleSelectZoneEvent)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('cv-canvas-start-draw' as any, handleStartDraw)
      window.removeEventListener('cv-canvas-cancel-draw' as any, handleCancelDraw)
      window.removeEventListener('cv-canvas-select-zone' as any, handleSelectZoneEvent)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [structureConfig, onUpdateStructureConfig])

  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId)
    window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId } }))
  }

  const handleDeleteZone = (zoneId: string) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const nextZones = (structureConfig.customZones || []).filter(z => z.id !== zoneId)
    onUpdateStructureConfig({
      ...structureConfig,
      customZones: nextZones
    })
    if (selectedZoneId === zoneId) setSelectedZoneId(null)
    window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: null } }))
  }

  const handleCancelDrawing = () => {
    setDrawingMode(null)
    setDrawingStart(null)
    setDrawingCurrent(null)
    setPolygonPoints([])
    setMousePos(null)
    window.dispatchEvent(new CustomEvent('cv-canvas-cancel-draw'))
  }

  const getPointFromEvent = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  }

  const handleDrawingPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (drawingMode !== 'rect') return
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
    const pt = getPointFromEvent(e)
    setDrawingStart(pt)
    setDrawingCurrent(pt)
  }

  const handleDrawingPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = getPointFromEvent(e)
    if (drawingMode === 'rect' && drawingStart) {
      setDrawingCurrent(pt)
    } else if (drawingMode === 'polygon') {
      setMousePos(pt)
    }
  }

  const handleDrawingPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawingMode !== 'rect' || !drawingStart) return
    e.preventDefault()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}

    const cur = drawingCurrent || drawingStart
    const minX = Math.min(drawingStart.x, cur.x)
    const minY = Math.min(drawingStart.y, cur.y)
    const rawW = Math.abs(cur.x - drawingStart.x)
    const rawH = Math.abs(cur.y - drawingStart.y)

    let finalX = minX
    let finalY = minY
    let finalW = rawW
    let finalH = rawH

    // Se o usuário apenas clicou sem arrastar (menos de 2%), cria um box padrão de 35% x 25% centralizado
    if (rawW < 2 && rawH < 2) {
      finalW = 35
      finalH = 25
      finalX = Math.max(0, Math.min(65, Math.round((drawingStart.x - 17.5) * 10) / 10))
      finalY = Math.max(0, Math.min(75, Math.round((drawingStart.y - 12.5) * 10) / 10))
    }

    const newZone: CustomCanvasZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: finalW < 40 && finalH > 50 ? 'Sidebar Personalizada' : 'Box Personalizado',
      shape: 'rect',
      x: Math.round(finalX * 10) / 10,
      y: Math.round(finalY * 10) / 10,
      width: Math.round(finalW * 10) / 10,
      height: Math.round(finalH * 10) / 10,
      backgroundColor: 'rgba(30, 41, 59, 0.12)',
      borderColor: '#0284c7',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 6,
      backgroundOpacity: 1
    }

    const updatedZones = [...(structureConfig?.customZones || []), newZone]
    if (onUpdateStructureConfig && structureConfig) {
      onUpdateStructureConfig({
        ...structureConfig,
        isFreeCanvasActive: true,
        customZones: updatedZones
      })
    }

    setSelectedZoneId(newZone.id)
    setDrawingMode(null)
    setDrawingStart(null)
    setDrawingCurrent(null)
    window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: newZone.id } }))
  }

  const finishPolygon = (points: Array<{ x: number; y: number }>) => {
    const newZone: CustomCanvasZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'Polígono Personalizado',
      shape: 'polygon',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: points,
      backgroundColor: 'rgba(30, 41, 59, 0.12)',
      borderColor: '#0284c7',
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: 0,
      backgroundOpacity: 1
    }

    const updatedZones = [...(structureConfig?.customZones || []), newZone]
    if (onUpdateStructureConfig && structureConfig) {
      onUpdateStructureConfig({
        ...structureConfig,
        isFreeCanvasActive: true,
        customZones: updatedZones
      })
    }

    setSelectedZoneId(newZone.id)
    setDrawingMode(null)
    setPolygonPoints([])
    setMousePos(null)
    window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: newZone.id } }))
  }

  const handleDrawingClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawingMode !== 'polygon') return
    const pt = getPointFromEvent(e)

    if (polygonPoints.length >= 3) {
      const p0 = polygonPoints[0]
      const dist = Math.hypot(pt.x - p0.x, pt.y - p0.y)
      if (dist < 4) {
        finishPolygon(polygonPoints)
        return
      }
    }

    setPolygonPoints(prev => [...prev, pt])
  }

  const handleDrawingDoubleClick = () => {
    if (drawingMode !== 'polygon' || polygonPoints.length < 3) return
    finishPolygon(polygonPoints)
  }

  // Arraste livre da Zona no plano 2D (Mouse + Touch)
  const handleZoneMovePointerDown = (
    e: React.PointerEvent<HTMLElement>,
    zone: CustomCanvasZone
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    setSelectedZoneId(zone.id)
    window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: zone.id } }))

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)
    setDraggingZoneId(zone.id)

    const startX = e.clientX
    const startY = e.clientY
    const startZoneX = zone.x
    const startZoneY = zone.y

    const zoneEl = document.getElementById(`custom_zone_${zone.id}`)
    const cardEl = zoneEl?.closest('.cv-card') || pageRef.current
    const cardRect = cardEl?.getBoundingClientRect() || { width: 794, height: 1122 }

    let latestX = startZoneX
    let latestY = startZoneY

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const dxPx = moveEvt.clientX - startX
      const dyPx = moveEvt.clientY - startY

      const dxPct = (dxPx / cardRect.width) * 100
      const dyPct = (dyPx / cardRect.height) * 100

      latestX = Math.max(0, Math.min(100 - zone.width, Math.round((startZoneX + dxPct) * 10) / 10))
      latestY = Math.max(0, Math.min(100 - zone.height, Math.round((startZoneY + dyPct) * 10) / 10))

      if (zoneEl) {
        zoneEl.style.left = `${latestX}%`
        zoneEl.style.top = `${latestY}%`
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {}
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      setDraggingZoneId(null)

      if (!structureConfig || !onUpdateStructureConfig) return
      const nextZones = (structureConfig.customZones || []).map(z => {
        if (z.id === zone.id) {
          return { ...z, x: latestX, y: latestY }
        }
        return z
      })
      onUpdateStructureConfig({
        ...structureConfig,
        customZones: nextZones
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Redimensionamento manual em 8 direções (Estilo Paint / Figma)
  const handleZoneResizePointerDown = (
    e: React.PointerEvent<HTMLElement>,
    zone: CustomCanvasZone,
    handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    setSelectedZoneId(zone.id)
    window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: zone.id } }))

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)

    const startX = e.clientX
    const startY = e.clientY
    const startZoneX = zone.x
    const startZoneY = zone.y
    const startZoneW = zone.width
    const startZoneH = zone.height

    const zoneEl = document.getElementById(`custom_zone_${zone.id}`)
    const cardEl = zoneEl?.closest('.cv-card') || pageRef.current
    const cardRect = cardEl?.getBoundingClientRect() || { width: 794, height: 1122 }

    let latestX = startZoneX
    let latestY = startZoneY
    let latestW = startZoneW
    let latestH = startZoneH

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const dxPx = moveEvt.clientX - startX
      const dyPx = moveEvt.clientY - startY

      const dxPct = (dxPx / cardRect.width) * 100
      const dyPct = (dyPx / cardRect.height) * 100

      // Ajuste horizontal
      if (handle === 'w' || handle === 'nw' || handle === 'sw') {
        const candidateX = Math.max(0, Math.min(startZoneX + startZoneW - 4, startZoneX + dxPct))
        latestX = Math.round(candidateX * 10) / 10
        latestW = Math.round((startZoneW - (latestX - startZoneX)) * 10) / 10
      } else if (handle === 'e' || handle === 'ne' || handle === 'se') {
        const candidateW = Math.max(4, Math.min(100 - startZoneX, startZoneW + dxPct))
        latestW = Math.round(candidateW * 10) / 10
      }

      // Ajuste vertical
      if (handle === 'n' || handle === 'nw' || handle === 'ne') {
        const candidateY = Math.max(0, Math.min(startZoneY + startZoneH - 3, startZoneY + dyPct))
        latestY = Math.round(candidateY * 10) / 10
        latestH = Math.round((startZoneH - (latestY - startZoneY)) * 10) / 10
      } else if (handle === 's' || handle === 'sw' || handle === 'se') {
        const candidateH = Math.max(3, Math.min(100 - startZoneY, startZoneH + dyPct))
        latestH = Math.round(candidateH * 10) / 10
      }

      if (zoneEl) {
        zoneEl.style.left = `${latestX}%`
        zoneEl.style.top = `${latestY}%`
        zoneEl.style.width = `${latestW}%`
        zoneEl.style.height = `${latestH}%`
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {}
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      if (!structureConfig || !onUpdateStructureConfig) return
      const nextZones = (structureConfig.customZones || []).map(z => {
        if (z.id === zone.id) {
          return {
            ...z,
            x: latestX,
            y: latestY,
            width: latestW,
            height: latestH
          }
        }
        return z
      })
      onUpdateStructureConfig({
        ...structureConfig,
        customZones: nextZones
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const renderCustomZonesLayer = () => {
    const zones = structureConfig?.customZones || []
    if (zones.length === 0) return null

    return (
      <div className="cv-custom-zones-container">
        {zones.map(zone => {
          const isSelected = selectedZoneId === zone.id

          if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
            const clipPathVal = `polygon(${zone.points.map(p => `${p.x}% ${p.y}%`).join(', ')})`
            return (
              <div
                key={zone.id}
                id={`custom_zone_${zone.id}`}
                className={`cv-custom-zone-item cv-custom-zone-polygon ${isSelected ? 'is-selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  clipPath: clipPathVal,
                  backgroundColor: zone.backgroundColor || 'rgba(30, 41, 59, 0.12)',
                  opacity: zone.backgroundOpacity ?? 1,
                  backgroundImage: zone.backgroundImage && zone.backgroundImage !== 'none' ? `url("${zone.backgroundImage}")` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  zIndex: 0,
                  pointerEvents: isFreeCanvas ? 'auto' : 'none'
                }}
                onClick={(e) => {
                  if (isFreeCanvas) {
                    e.stopPropagation()
                    handleSelectZone(zone.id)
                  }
                }}
              >
                {isFreeCanvas && isSelected && (
                  <div className="cv-custom-zone-badge cv-no-print" data-cv-interactive="true" style={{ left: `${zone.points[0].x}%`, top: `${zone.points[0].y}%` }}>
                    <span>📐 {zone.label}</span>
                    <button
                      type="button"
                      className="cv-custom-zone-del"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteZone(zone.id)
                      }}
                      title="Excluir polígono"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )
          }

          return (
            <div
              key={zone.id}
              id={`custom_zone_${zone.id}`}
              className={`cv-custom-zone-item cv-custom-zone-rect ${isSelected ? 'is-selected' : ''} ${draggingZoneId === zone.id ? 'is-dragging' : ''}`}
              style={{
                position: 'absolute',
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
                backgroundColor: zone.backgroundColor || 'rgba(30, 41, 59, 0.12)',
                opacity: zone.backgroundOpacity ?? 1,
                backgroundImage: zone.backgroundImage && zone.backgroundImage !== 'none' ? `url("${zone.backgroundImage}")` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderColor: zone.borderColor || 'transparent',
                borderWidth: `${zone.borderWidth ?? 0}px`,
                borderStyle: zone.borderStyle || 'solid',
                borderRadius: `${zone.borderRadius ?? 0}px`,
                zIndex: 0,
                pointerEvents: isFreeCanvas ? 'auto' : 'none',
                boxSizing: 'border-box'
              }}
              onClick={(e) => {
                if (isFreeCanvas) {
                  e.stopPropagation()
                  handleSelectZone(zone.id)
                }
              }}
              onPointerDown={(e) => {
                if (isFreeCanvas && isSelected) {
                  handleZoneMovePointerDown(e, zone)
                }
              }}
            >
              {isFreeCanvas && isSelected && (
                <>
                  {/* Cabeçalho de Controle e Arraste */}
                  <div className="cv-custom-zone-badge cv-no-print" data-cv-interactive="true">
                    <span
                      className="cv-zone-drag-handle"
                      onPointerDown={(e) => handleZoneMovePointerDown(e, zone)}
                      title="Arrastar para reposicionar na folha"
                    >
                      ⠿ Mover
                    </span>
                    <span>📐 {zone.label}</span>
                    <span className="cv-zone-dim-pill">
                      L: {Math.round(zone.width)}% | A: {Math.round(zone.height)}%
                    </span>
                    <button
                      type="button"
                      className="cv-custom-zone-del"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteZone(zone.id)
                      }}
                      title="Excluir área"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 8 Alças de Redimensionamento Manual (Paint / Figma) */}
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--nw cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'nw')}
                    title="Redimensionar canto superior esquerdo"
                  />
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--ne cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'ne')}
                    title="Redimensionar canto superior direito"
                  />
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--se cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'se')}
                    title="Redimensionar canto inferior direito"
                  />
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--sw cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'sw')}
                    title="Redimensionar canto inferior esquerdo"
                  />
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--n cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'n')}
                    title="Redimensionar topo (altura)"
                  />
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--s cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 's')}
                    title="Redimensionar base (altura)"
                  />
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--w cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'w')}
                    title="Redimensionar esquerda (largura)"
                  />
                  <div
                    className="cv-zone-resize-handle cv-zone-resize-handle--e cv-no-print"
                    data-cv-interactive="true"
                    onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'e')}
                    title="Redimensionar direita (largura)"
                  />
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderDrawingOverlay = () => {
    if (!drawingMode) return null

    let previewRectStyle: React.CSSProperties | null = null
    if (drawingMode === 'rect' && drawingStart && drawingCurrent) {
      const minX = Math.min(drawingStart.x, drawingCurrent.x)
      const minY = Math.min(drawingStart.y, drawingCurrent.y)
      const width = Math.abs(drawingCurrent.x - drawingStart.x)
      const height = Math.abs(drawingCurrent.y - drawingStart.y)
      previewRectStyle = {
        position: 'absolute',
        left: `${minX}%`,
        top: `${minY}%`,
        width: `${width}%`,
        height: `${height}%`,
        border: '2px dashed #38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderRadius: '6px',
        pointerEvents: 'none'
      }
    }

    return (
      <div
        ref={drawingOverlayRef}
        className="cv-canvas-drawing-overlay cv-no-print"
        data-cv-interactive="true"
        onPointerDown={handleDrawingPointerDown}
        onPointerMove={handleDrawingPointerMove}
        onPointerUp={handleDrawingPointerUp}
        onClick={handleDrawingClick}
        onDoubleClick={handleDrawingDoubleClick}
      >
        <div className="cv-drawing-instruction-banner">
          {drawingMode === 'rect' ? (
            <span>🖱️ <strong>Modo Desenho:</strong> Clique e arraste para desenhar (ou clique para criar um box padrão)</span>
          ) : (
            <span>📐 <strong>Modo Polígono:</strong> Clique para marcar os vértices ({polygonPoints.length} marcados). Duplo clique para fechar.</span>
          )}
          <button
            type="button"
            className="cv-drawing-cancel-btn"
            onClick={handleCancelDrawing}
          >
            Cancelar (Esc)
          </button>
        </div>

        {previewRectStyle && <div style={previewRectStyle} />}

        {drawingMode === 'polygon' && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          >
            {polygonPoints.length > 0 && (
              <polyline
                points={
                  polygonPoints.map(p => `${p.x},${p.y}`).join(' ') +
                  (mousePos ? ` ${mousePos.x},${mousePos.y}` : '')
                }
                fill="rgba(56, 189, 248, 0.15)"
                stroke="#38bdf8"
                strokeWidth="0.6"
                strokeDasharray="1 1"
              />
            )}
            {polygonPoints.map((p, idx) => (
              <circle
                key={idx}
                cx={p.x}
                cy={p.y}
                r="1"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="0.3"
              />
            ))}
          </svg>
        )}
      </div>
    )
  }

  const renderCanvasDecorations = () => {
    return (
      <>
        {renderCustomZonesLayer()}
        {Boolean(drawingMode) && renderDrawingOverlay()}
      </>
    )
  }

  const renderCVPage = () => {
    // ── Modelo A4 05: Brand Accent Block (Basil Hailward) ──
    if (blueprint.id === 'editorial_accent') {
      const splitRatio = structureConfig?.columnSplitRatio || 34
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-editorial_accent">
            {renderCanvasDecorations()}
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
            {renderCanvasDecorations()}
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
            {renderCanvasDecorations()}
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

            <div className="cv-hero-matrix-grid">
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
            {renderCanvasDecorations()}
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
            {renderCanvasDecorations()}
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
            {renderCanvasDecorations()}
            {getDynamicMathSections().map(secKey => {
              switch (secKey) {
                case 'photo':
                  return isFreeCanvas ? (
                    <React.Fragment key="dyn_photo">
                      {renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}
                    </React.Fragment>
                  ) : null

                case 'header':
                  return (
                    <React.Fragment key="dyn_header">
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
                    </React.Fragment>
                  )

                case 'summary':
                  return basics.summary ? (
                    <React.Fragment key="dyn_summary">
                      {wrapSection('summary', 'Resumo / Sobre Mim', (
                        <div className="cv-math-summary">
                          {basics.summary}
                        </div>
                      ))}
                    </React.Fragment>
                  ) : null

                case 'work':
                  return (
                    <React.Fragment key="dyn_work">
                      {renderWorkSection(
                        undefined,
                        undefined,
                        'EXPERIÊNCIA PROFISSIONAL',
                        <h2 className="cv-math-section-title">
                          💼 EXPERIÊNCIA PROFISSIONAL
                        </h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className="cv-math-work-list">
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                case 'projects':
                  return (
                    <React.Fragment key="dyn_projects">
                      {renderProjectsSection(
                        undefined,
                        undefined,
                        'PROJETOS EM DESTAQUE & REPOSITÓRIOS',
                        <h2 className="cv-math-section-title">
                          🚀 PROJETOS EM DESTAQUE & REPOSITÓRIOS
                        </h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className={`cv-math-grid projects-grid ${getGridClass(data.projects?.length || 0)}`}>
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                case 'skills':
                case 'skills_tags':
                  return (
                    <React.Fragment key="dyn_skills">
                      {renderSkillsSection(
                        undefined,
                        undefined,
                        'COMPETÊNCIAS & HABILIDADES TÉCNICAS',
                        <h2 className="cv-math-section-title">
                          ⚡ COMPETÊNCIAS & HABILIDADES TÉCNICAS
                        </h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className={`cv-math-grid skills-grid ${getGridClass(data.skills?.length || 0)}`}>
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                case 'education':
                  return (
                    <React.Fragment key="dyn_education">
                      {renderEducationSection(
                        undefined,
                        undefined,
                        'FORMAÇÃO ACADÊMICA',
                        <h2 className="cv-math-section-title">
                          🎓 FORMAÇÃO ACADÊMICA
                        </h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className={`cv-math-grid education-grid ${getGridClass(data.education?.length || 0)}`}>
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                case 'languages':
                  return (
                    <React.Fragment key="dyn_languages">
                      {renderLanguagesSection(
                        undefined,
                        undefined,
                        'IDIOMAS & FLUÊNCIA',
                        <h2 className="cv-math-section-title">
                          🌐 IDIOMAS & FLUÊNCIA
                        </h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className={`cv-math-grid languages-grid ${getGridClass(data.languages?.length || 0)}`}>
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                case 'certificates':
                  return (
                    <React.Fragment key="dyn_certificates">
                      {renderCertificatesSection(
                        undefined,
                        undefined,
                        'CERTIFICAÇÕES & LICENÇAS',
                        <h2 className="cv-math-section-title">📜 CERTIFICAÇÕES & LICENÇAS</h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className={`cv-math-grid certificates-grid ${getGridClass(data.certificates?.length || 0)}`}>
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                case 'interests':
                  return (
                    <React.Fragment key="dyn_interests">
                      {renderInterestsSection(
                        undefined,
                        undefined,
                        'INTERESSES & FRENTES DE PESQUISA',
                        <h2 className="cv-math-section-title">💡 INTERESSES & FRENTES DE PESQUISA</h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className={`cv-math-grid interests-grid ${getGridClass(data.interests?.length || 0)}`}>
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                case 'references':
                  return (
                    <React.Fragment key="dyn_references">
                      {renderReferencesSection(
                        undefined,
                        undefined,
                        'REFERÊNCIAS',
                        <h2 className="cv-math-section-title">👥 REFERÊNCIAS</h2>,
                        (items) => (
                          <section className="cv-section">
                            <div className="cv-math-work-list">
                              {items}
                            </div>
                          </section>
                        )
                      )}
                    </React.Fragment>
                  )

                default:
                  return null
              }
            })}
          </div>
        </div>
      )
    }

    // ── Modelo A4 02 (Linear) ──
    if (blueprint.id === 'linear') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-linear">
            {renderCanvasDecorations()}
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

    // ── Modelo A4 10: Canvas Livre (Folha em Branco) ──
    if (blueprint.id === 'canvas_livre') {
      const hasAnyContent = (
        (structureConfig?.sectionOrder && structureConfig.sectionOrder.length > 0) ||
        ((structureConfig?.customZones || []).length > 0)
      )

      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-canvas_livre" style={{ minHeight: '100%', position: 'relative' }}>
            {renderCanvasDecorations()}

            {/* Renderizar seções que o usuário adicionar ao canvas livre */}
            {(structureConfig?.sectionOrder || []).map((secId) => {
              if (secId === 'photo') return renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)
              if (secId === 'header') return wrapSection('header', 'Cabeçalho', <BlockHeader basics={basics} variant="standard" hideImage={isFreeCanvas} />)
              if (secId === 'summary' && basics.summary) return wrapSection('summary', 'Resumo Profissional', <BlockSummary basics={basics} />)
              if (secId === 'contacts') return wrapSection('contacts', 'Contatos', <BlockContacts basics={basics} layoutStyle="row" />)
              if (secId === 'civil') return wrapSection('civil', 'Dados Civis', <BlockCivilData basics={basics} />)
              if (secId.startsWith('work')) return renderWorkSection()
              if (secId.startsWith('education')) return renderEducationSection()
              if (secId.startsWith('projects')) return renderProjectsSection()
              if (secId.startsWith('skills')) return renderSkillsSection(undefined, undefined, 'Competências', <BlockSkillsTags skills={data.skills} />)
              if (secId.startsWith('languages')) return renderLanguagesSection()
              if (secId.startsWith('certificates')) return renderCertificatesSection()
              if (secId.startsWith('interests')) return renderInterestsSection()
              if (secId.startsWith('references')) return renderReferencesSection()
              return null
            })}

            {/* Placeholder de folha em branco quando nada foi adicionado ainda */}
            {!hasAnyContent && (
              <div className="cv-canvas-blank-placeholder cv-no-print" data-cv-interactive="true">
                <div className="cv-blank-icon">🎨</div>
                <h3>Folha em Branco - Canvas Livre</h3>
                <p>
                  Sua página está pronta para criação! Use o menu lateral <strong>"🎨 Elementos (Canvas)"</strong> para:
                </p>
                <div className="cv-canvas-blank-tips">
                  <div className="cv-blank-tip-item">
                    <span>📐</span>
                    <strong>Zonas & Sidebars:</strong> Desenhe caixas, colunas ou sidebars arrastando com o mouse.
                  </div>
                  <div className="cv-blank-tip-item">
                    <span>🖼️</span>
                    <strong>Fundos & Texturas:</strong> Aplique cores elegantes ou texturas IA com opacidade.
                  </div>
                  <div className="cv-blank-tip-item">
                    <span>🧱</span>
                    <strong>Blocos de Conteúdo:</strong> Ative seções de Experiência, Formação e Habilidades.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    // ── Modelo A4 01 (Modular) e 07 (Warm Magazine) ──
    return (
      <div className="cv-page-a4">
        <div className={`cv-card ${blueprint.customClass || ''}`}>
          {renderCanvasDecorations()}
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
        <div className="cv-page-overflow-banner cv-no-print" data-cv-interactive="true">
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

      {data.meta?.temporalWarnings && data.meta.temporalWarnings.length > 0 && !isTemporalBannerDismissed && (
        <div
          className="cv-page-temporal-banner cv-no-print"
          data-cv-interactive="true"
          style={{
            margin: '0.75rem auto',
            maxWidth: '210mm',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(254, 243, 199, 0.95)',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            fontSize: '0.82rem',
            color: '#92400e',
            lineHeight: 1.4
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#78350f' }}>
              Auditoria de Datas e Integridade Temporal ({data.meta.temporalWarnings.length} {data.meta.temporalWarnings.length === 1 ? 'alerta' : 'alertas'})
            </strong>
            <p style={{ margin: '0 0 0.4rem 0' }}>
              A IA identificou datas ausentes ou potencialmente estimadas no documento. Por favor, confira os itens antes de exportar:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {data.meta.temporalWarnings.slice(0, isTemporalExpanded ? undefined : 2).map((w, idx) => (
                <li key={idx} style={{ marginBottom: '0.15rem' }}>{w}</li>
              ))}
            </ul>
            {data.meta.temporalWarnings.length > 2 && (
              <button
                type="button"
                onClick={() => setIsTemporalExpanded(!isTemporalExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#b45309',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginTop: '0.25rem'
                }}
              >
                {isTemporalExpanded ? 'Mostrar menos' : `Ver todos os ${data.meta.temporalWarnings.length} alertas...`}
              </button>
            )}
          </div>
          <button
            type="button"
            className="cv-page-overflow-close"
            onClick={() => setIsTemporalBannerDismissed(true)}
            title="Dispensar aviso temporal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              color: '#92400e',
              padding: '0 0.25rem'
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div ref={pageRef} className="cv-render-wrapper">
        <div className="cv-print-page-background" aria-hidden="true" />
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
