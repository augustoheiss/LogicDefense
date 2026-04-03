// ──────────────────────────────────────────────────────────────────────────────
// topics.ts — Master-Detail data model for the Repositório page.
// ──────────────────────────────────────────────────────────────────────────────
import { lessonPlans, lessonCategories, youtubeVideos } from './content'
import type { LessonPlan } from './content'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TopicItemType = 'lesson' | 'video'

export interface TopicItem {
  id: string
  type: TopicItemType
  title: string
  meta: string
  description: string
  lessonData?: LessonPlan
  youtubeId?: string
}

export interface Topic {
  id: string
  title: string
  description: string
  icon: string
  color: 'cyan' | 'purple' | 'gold' | 'green' | 'blue' | 'rose'
  items: TopicItem[]
}

// ── Color mapping for real categories ─────────────────────────────────────────

const COLOR_MAP: Record<string, Topic['color']> = {
  'cat-equacao': 'cyan',
  'cat-porcentagem': 'gold',
  'cat-divisores': 'purple',
  'cat-fracoes': 'rose',
  'cat-regra-de-tres': 'blue',
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

  // Função utilitária para injetar vídeos em tópicos
  const injectVideos = (topicId: string, videoIds: string[]) => {
    const topic = realTopics.find((t) => t.id === topicId)
    if (topic) {
      videoIds.forEach((vidId, index) => {
        const video = youtubeVideos.find((v) => v.id === vidId)
        if (video) {
          topic.items.push({
            id: video.id,
            type: 'video',
            title: video.title,
            meta: `YouTube · Episódio ${index + 1}`,
            description: video.description,
            youtubeId: video.youtubeId,
          })
        }
      })
    }
  }

  // ── Injetando Vídeos nas Trilhas ───────────────────────────────
  // Já amarramos os vídeos corretos do seu content.ts nestas trilhas:
  injectVideos('cat-equacao', ['vid-13', 'vid-14'])
  injectVideos('cat-fracoes', ['vid-11', 'vid-12'])
  injectVideos('cat-regra-de-tres', ['vid-9', 'vid-10', 'vid-17', 'vid-18'])


  return realTopics
}

export const TOPICS: Topic[] = buildTopics()