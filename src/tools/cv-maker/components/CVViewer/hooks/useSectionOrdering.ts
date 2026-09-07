import React from 'react'
import type { CVData, LayoutStructureConfig } from '../../../types/cv'
import { getAtomicItemId } from '../../../utils/atomicIdUtils'
import { useCanvasStore } from '../../../store/useCanvasStore'

interface UseSectionOrderingProps {
  data: CVData
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
}

export function useSectionOrdering({
  data,
  structureConfig,
  onUpdateStructureConfig
}: UseSectionOrderingProps) {
  const notifyBoxMoved = useCanvasStore((s) => s.notifyBoxMoved)

  const handleUpdateSplitRatio = (newRatio: number) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    onUpdateStructureConfig({
      ...structureConfig,
      columnSplitRatio: newRatio
    })
  }

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
          notifyBoxMoved()
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
      notifyBoxMoved()
    }, 50)
  }

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
            notifyBoxMoved()
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
          notifyBoxMoved()
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
      notifyBoxMoved()
    }, 50)
  }

  return {
    handleUpdateSplitRatio,
    handleSwitchZone,
    getSectionZone,
    getSortedItems,
    getDynamicMathSections,
    handleSwapOrder,
    handleMoveStep
  }
}
