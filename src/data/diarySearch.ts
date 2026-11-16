import type { DiaryEntry } from './diary'

export type DiaryMatchKind = 'titulo' | 'data' | 'citacao'

export interface DiaryMatch {
  entry: DiaryEntry
  kinds: DiaryMatchKind[]
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function diaryDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const monthName = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
  return `${day} de ${monthName} de ${year}`
}

function dateHaystack(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  const monthIndex = Number(month) - 1
  const monthName = MONTHS[monthIndex] ?? ''
  const dayNumber = String(Number(day))
  return fold(
    [
      isoDate,
      `${day}/${month}/${year}`,
      `${dayNumber}/${month}/${year}`,
      `${dayNumber} de ${monthName} de ${year}`,
      monthName,
      year,
    ].join(' '),
  )
}

function titleHaystack(entry: DiaryEntry): string {
  return fold(`${entry.title} ${entry.subtitle} ${entry.edition} ${entry.slug}`)
}

/** `rotulos` casa título e data. `completo` inclui o corpo, onde estão as citações. */
export function searchDiary(
  entries: DiaryEntry[],
  rawQuery: string,
  scope: 'rotulos' | 'completo',
): DiaryMatch[] {
  const query = fold(rawQuery.trim())
  if (!query) {
    return entries.map((entry) => ({ entry, kinds: [] }))
  }

  const matches: DiaryMatch[] = []
  for (const entry of entries) {
    const kinds: DiaryMatchKind[] = []
    if (titleHaystack(entry).includes(query)) kinds.push('titulo')
    if (dateHaystack(entry.date).includes(query)) kinds.push('data')
    if (scope === 'completo' && fold(entry.body).includes(query)) kinds.push('citacao')
    if (kinds.length > 0) matches.push({ entry, kinds })
  }
  return matches
}
