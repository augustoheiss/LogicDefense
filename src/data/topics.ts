// ──────────────────────────────────────────────────────────────────────────────
// topics.ts — Master-Detail data model for the Repositório page.
//
// TOPICS is built from lessonCategories + a temporary mock demo topic.
// To promote a topic from "demo" to real, remove `isMock` and move its
// slugs into lessonCategories in content.ts.
// ──────────────────────────────────────────────────────────────────────────────
import { lessonPlans, lessonCategories, youtubeVideos } from './content'
import type { LessonPlan } from './content'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TopicItemType = 'lesson' | 'video'

export interface TopicItem {
  id: string
  type: TopicItemType
  title: string
  /** Short label shown below the title — grade range or YouTube context */
  meta: string
  description: string
  /** Present when type === 'lesson' */
  lessonData?: LessonPlan
  /** Present when type === 'video' — the YouTube video ID */
  youtubeId?: string
}

export interface Topic {
  id: string
  title: string
  description: string
  icon: string
  color: 'cyan' | 'purple' | 'gold' | 'green'
  items: TopicItem[]
  /** Flags a temporary demo/mock topic — renders a "Demo" badge on the card */
  isMock?: boolean
}

// ── Color mapping for real categories ─────────────────────────────────────────

const COLOR_MAP: Record<string, Topic['color']> = {
  'cat-equacao':       'cyan',
  'cat-porcentagem':   'gold',
  'cat-divisores':     'purple',
  'cat-simplificacao': 'green',
}

// ── Builder ───────────────────────────────────────────────────────────────────

function buildTopics(): Topic[] {
  const realTopics: Topic[] = lessonCategories.map((cat): Topic => ({
    id: cat.id,
    title: cat.title,
    description: cat.description,
    icon: cat.icon,
    color: COLOR_MAP[cat.id] ?? 'cyan',
    items: lessonPlans
      .filter((p) => cat.slugs.includes(p.slug))
      .map((p): TopicItem => ({
        id: p.id,
        type: 'lesson',
        title: p.title,
        meta: p.grade,
        description: p.description,
        lessonData: p,
      })),
  }))

  // ── Mock demo topic: Frações (lesson + two video episodes) ────────────────
  const fracaoLesson = lessonPlans.find((p) => p.slug === 'fracoes-operacoes')
  const vid11 = youtubeVideos.find((v) => v.id === 'vid-11')
  const vid12 = youtubeVideos.find((v) => v.id === 'vid-12')

  const mockFracoes: Topic = {
    id: 'cat-fracoes-demo',
    title: 'Frações: Das Pirâmides ao Presente',
    description:
      'Uma jornada completa pelas frações — da história milenar à aula prática com exercícios e vídeos.',
    icon: '🍕',
    color: 'purple',
    isMock: true,
    items: [
      ...(fracaoLesson
        ? [
            {
              id: `${fracaoLesson.id}-ref`,
              type: 'lesson' as TopicItemType,
              title: fracaoLesson.title,
              meta: fracaoLesson.grade,
              description: fracaoLesson.description,
              lessonData: fracaoLesson,
            },
          ]
        : []),
      ...(vid11
        ? [
            {
              id: vid11.id,
              type: 'video' as TopicItemType,
              title: vid11.title,
              meta: 'YouTube · Episódio 1',
              description: vid11.description,
              youtubeId: vid11.youtubeId,
            },
          ]
        : []),
      ...(vid12
        ? [
            {
              id: vid12.id,
              type: 'video' as TopicItemType,
              title: vid12.title,
              meta: 'YouTube · Episódio 2',
              description: vid12.description,
              youtubeId: vid12.youtubeId,
            },
          ]
        : []),
    ],
  }

  return [...realTopics, mockFracoes]
}

export const TOPICS: Topic[] = buildTopics()
