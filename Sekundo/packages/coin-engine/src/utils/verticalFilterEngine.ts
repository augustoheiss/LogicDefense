/**
 * Engine headless puro para filtragem e ranqueamento de listas verticais pesquisáveis
 * no @sekundo/coin-engine (espelho de contrato do `@sekundo/core`).
 */

export interface VerticalFilterOption<TMeta = unknown> {
  id: string;
  label: string;
  subtitle?: string;
  badge?: string;
  keywords?: string[];
  dotColor?: string;
  pinned?: boolean;
  disabled?: boolean;
  meta?: TMeta;
}

export interface VerticalFilterConfig {
  maxResults?: number;
  keepPinnedOnSearch?: boolean;
  sortPinnedFirst?: boolean;
}

export interface VerticalFilterResult<TMeta = unknown> {
  items: VerticalFilterOption<TMeta>[];
  totalCount: number;
  matchedCount: number;
  isQueryActive: boolean;
  normalizedQuery: string;
}

export function normalizeFilterSearchText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeFilterQuery(query: string): string[] {
  const norm = normalizeFilterSearchText(query);
  if (!norm) return [];
  return norm.split(' ').filter((t) => t.length > 0);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreVerticalOption<TMeta>(
  option: VerticalFilterOption<TMeta>,
  normalizedQuery: string,
  tokens: string[]
): number {
  const normLabel = normalizeFilterSearchText(option.label);
  const normId = normalizeFilterSearchText(option.id);
  const normSub = normalizeFilterSearchText(option.subtitle);
  const normBadge = normalizeFilterSearchText(option.badge);
  const normKeywords = (Array.isArray(option.keywords) ? option.keywords : [])
    .map(normalizeFilterSearchText)
    .join(' ');

  const combined = `${normLabel} ${normId} ${normSub} ${normBadge} ${normKeywords}`.trim();
  if (!combined) return -1;

  const allTokensMatch = tokens.every((tok) => combined.includes(tok));
  if (!allTokensMatch) return -1;

  let score = 100;
  if (normLabel === normalizedQuery || normId === normalizedQuery) {
    score = 1000;
  } else if (normLabel.startsWith(normalizedQuery) || normId.startsWith(normalizedQuery)) {
    score = 800;
  } else {
    const wordPrefixRegex = new RegExp(`(?:^|[\\s\\-_/.,()])${escapeRegExp(normalizedQuery)}`);
    if (wordPrefixRegex.test(normLabel) || wordPrefixRegex.test(normId)) {
      score = 600;
    } else if (normLabel.includes(normalizedQuery) || normId.includes(normalizedQuery)) {
      score = 400;
    } else if (
      normSub.includes(normalizedQuery) ||
      normKeywords.includes(normalizedQuery) ||
      normBadge.includes(normalizedQuery)
    ) {
      score = 250;
    }
  }

  return score + (option.pinned ? 10 : 0);
}

export function filterAndRankVerticalOptions<TMeta = unknown>(
  options: readonly VerticalFilterOption<TMeta>[],
  query: string,
  config: VerticalFilterConfig = {}
): VerticalFilterResult<TMeta> {
  const safeOptions = Array.isArray(options)
    ? options.filter((o): o is VerticalFilterOption<TMeta> => Boolean(o && typeof o === 'object'))
    : [];
  const normalizedQuery = normalizeFilterSearchText(query);
  const tokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];
  const totalCount = safeOptions.length;

  if (!normalizedQuery || tokens.length === 0) {
    const ordered = config.sortPinnedFirst
      ? [
          ...safeOptions.filter((o) => o.pinned),
          ...safeOptions.filter((o) => !o.pinned),
        ]
      : safeOptions;
    const sliced =
      typeof config.maxResults === 'number' && config.maxResults > 0
        ? ordered.slice(0, config.maxResults)
        : ordered;
    return {
      items: sliced,
      totalCount,
      matchedCount: ordered.length,
      isQueryActive: false,
      normalizedQuery: '',
    };
  }

  const scored: Array<{ option: VerticalFilterOption<TMeta>; score: number; index: number }> = [];

  for (let i = 0; i < safeOptions.length; i++) {
    const opt = safeOptions[i];
    const s = scoreVerticalOption(opt, normalizedQuery, tokens);
    if (s >= 0) {
      scored.push({ option: opt, score: s, index: i });
    } else if (config.keepPinnedOnSearch && opt.pinned) {
      scored.push({ option: opt, score: 10, index: i });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  const ranked = scored.map((entry) => entry.option);
  const sliced =
    typeof config.maxResults === 'number' && config.maxResults > 0
      ? ranked.slice(0, config.maxResults)
      : ranked;

  return {
    items: sliced,
    totalCount,
    matchedCount: ranked.length,
    isQueryActive: true,
    normalizedQuery,
  };
}

export function computeNextHighlightedIndex(
  currentIndex: number,
  key: string,
  itemCount: number
): number {
  if (itemCount <= 0) return -1;
  switch (key) {
    case 'ArrowDown':
      if (currentIndex < 0 || currentIndex >= itemCount - 1) return 0;
      return currentIndex + 1;
    case 'ArrowUp':
      if (currentIndex <= 0) return itemCount - 1;
      return currentIndex - 1;
    case 'Home':
      return 0;
    case 'End':
      return itemCount - 1;
    default:
      return currentIndex >= 0 && currentIndex < itemCount ? currentIndex : -1;
  }
}
