import type { FlatSkeletonEntry } from '../skeleton/types';

export type SymbologyDimension =
  | 'none'
  | 'territory'
  | 'zone'
  | 'neighborhood'
  | 'city'
  | 'state_country'
  | 'property_type'
  | 'path_depth_1'
  | 'path_depth_2'
  | 'path_depth_3';

export type SymbologyShape =
  | 'circle'
  | 'pin'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'star'
  | 'pentagon'
  | 'hexagon';

export type SymbologyVisualChannel =
  | 'color_only'
  | 'shape_only'
  | 'color_and_shape';

export interface MapSymbologyConfig {
  /** Dimensão ativa de agrupamento. Padrão: 'none' (Ícone Único Universal, sem legenda) */
  dimension: SymbologyDimension;
  /** Canal visual quando dimension !== 'none' */
  visualChannel: SymbologyVisualChannel;
  /** Forma base universal (Padrão: 'circle' conforme Decisão #3 do Nó Górdio) */
  baseShape: SymbologyShape;
  /** Cor base para pontos pendentes quando dimension === 'none' ou visualChannel === 'shape_only' */
  baseColor: string;
  /** Cor de destaque para pontos concluídos quando dimension === 'none' */
  workedColor: string;
  /** Respeita customizações individuais salvas em entry.meta.pinColor / entry.meta.pinShape */
  respectManualPinOverrides: boolean;
}

export interface SymbologyLegendItem {
  categoryKey: string;
  label: string;
  color: string;
  shape: SymbologyShape;
  shapeGlyph: string;
  count: number;
}

export interface ResolvedPinSymbology {
  categoryKey: string;
  categoryLabel: string;
  color: string;
  shape: SymbologyShape;
  shapeGlyph: string;
}

export const DEFAULT_MAP_SYMBOLOGY_CONFIG: MapSymbologyConfig = {
  dimension: 'none',
  visualChannel: 'color_and_shape',
  baseShape: 'circle',
  baseColor: '#0EA5E9',
  workedColor: '#10B981',
  respectManualPinOverrides: false,
};

export const SYMBOLOGY_DIMENSION_OPTIONS: Array<{
  id: SymbologyDimension;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'none',
    label: 'Padrão: Ícone Único (Sem Legenda)',
    shortLabel: 'Ícone Único',
    description: 'Todos os pontos usam o mesmo ícone limpo de alto contraste. Oculta legendas automáticas.',
  },
  {
    id: 'territory',
    label: 'Por Território (T-01, T-02...)',
    shortLabel: 'Território',
    description: 'Diferencia os pontos pelo código do território ao qual pertencem.',
  },
  {
    id: 'zone',
    label: 'Por Zona / Região',
    shortLabel: 'Zona',
    description: 'Agrupa os pontos pela zona geográfica ou setor macro.',
  },
  {
    id: 'neighborhood',
    label: 'Por Bairro / Localidade',
    shortLabel: 'Bairro',
    description: 'Agrupa os pontos pelo bairro ou conjunto habitacional.',
  },
  {
    id: 'city',
    label: 'Por Cidade / Município',
    shortLabel: 'Cidade',
    description: 'Agrupa os pontos pela cidade ou município.',
  },
  {
    id: 'state_country',
    label: 'Por Estado / País',
    shortLabel: 'UF / País',
    description: 'Agrupa os pontos por unidade federativa ou país.',
  },
  {
    id: 'property_type',
    label: 'Por Tipo de Imóvel',
    shortLabel: 'Tipo Imóvel',
    description: 'Diferencia residências, comércios e edifícios.',
  },
  {
    id: 'path_depth_1',
    label: 'Hierarquia Nível 1 (Raiz)',
    shortLabel: 'Nível 1',
    description: 'Agrupa pelo 1º segmento estrutural da chave hierárquica (pathKey).',
  },
  {
    id: 'path_depth_2',
    label: 'Hierarquia Nível 2 (Subgrupo)',
    shortLabel: 'Nível 2',
    description: 'Agrupa pelo 2º segmento estrutural da chave hierárquica (pathKey).',
  },
  {
    id: 'path_depth_3',
    label: 'Hierarquia Nível 3 (Quadra/Setor)',
    shortLabel: 'Nível 3',
    description: 'Agrupa pelo 3º segmento estrutural da chave hierárquica (pathKey).',
  },
];

export const SYMBOLOGY_PALETTE: string[] = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#84CC16', // Lime
  '#F97316', // Orange
  '#14B8A6', // Teal
];

export const SYMBOLOGY_SHAPES: SymbologyShape[] = [
  'circle',
  'pin',
  'square',
  'diamond',
  'triangle',
  'star',
  'pentagon',
  'hexagon',
];

export const SYMBOLOGY_SHAPE_META: Record<
  SymbologyShape,
  { label: string; glyph: string }
> = {
  circle: { label: 'Círculo', glyph: '●' },
  pin: { label: 'Pino', glyph: '📍' },
  square: { label: 'Quadrado', glyph: '■' },
  diamond: { label: 'Losango', glyph: '◆' },
  triangle: { label: 'Triângulo', glyph: '▲' },
  star: { label: 'Estrela', glyph: '★' },
  pentagon: { label: 'Pentágono', glyph: '⬠' },
  hexagon: { label: 'Hexágono', glyph: '⬢' },
};

/**
 * Deterministic FNV-1a 32-bit hash for consistent category -> palette/shape assignment.
 */
export function hashCategoryKey(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Extracts a human-readable category label from a `FlatSkeletonEntry` (or pin metadata)
 * according to the active `SymbologyDimension`.
 */
export function extractSymbologyCategory(
  entry: Pick<FlatSkeletonEntry, 'key' | 'label' | 'meta'>,
  dimension: SymbologyDimension
): { categoryKey: string; categoryLabel: string } {
  if (dimension === 'none') {
    return { categoryKey: '__unified__', categoryLabel: 'Padrão Unificado' };
  }

  const meta = (entry.meta || {}) as Record<string, any>;
  const segments = String(entry.key || '')
    .split('.')
    .filter(Boolean);

  switch (dimension) {
    case 'territory': {
      const raw =
        meta.territoryNumber ||
        meta.territory_number ||
        segments[0] ||
        'T-01';
      const clean = String(raw).trim();
      const label = clean.startsWith('T-') || clean.startsWith('t-')
        ? clean.toUpperCase()
        : `Território ${clean}`;
      return { categoryKey: clean.toLowerCase(), categoryLabel: label };
    }
    case 'zone': {
      const raw =
        meta.zone ||
        meta.zona ||
        meta.region ||
        meta.regiao ||
        'Zona Central';
      const clean = String(raw).trim();
      return { categoryKey: clean.toLowerCase(), categoryLabel: clean };
    }
    case 'neighborhood': {
      const raw =
        meta.neighborhood ||
        meta.bairro ||
        meta.locality ||
        meta.line2 ||
        'Centro';
      const clean = String(raw).trim();
      return { categoryKey: clean.toLowerCase(), categoryLabel: clean };
    }
    case 'city': {
      const raw = meta.city || meta.cidade || 'Cidade Base';
      const clean = String(raw).trim();
      return { categoryKey: clean.toLowerCase(), categoryLabel: clean };
    }
    case 'state_country': {
      const state = meta.state || meta.uf || 'SP';
      const country = meta.country || meta.pais || 'BR';
      const combined = `${String(state).trim()} / ${String(country).trim()}`;
      return { categoryKey: combined.toLowerCase(), categoryLabel: combined };
    }
    case 'property_type': {
      const raw = String(meta.propertyType || meta.property_type || 'residencial')
        .trim()
        .toLowerCase();
      const mapLabels: Record<string, string> = {
        residencial: 'Residencial',
        comercial: 'Comercial',
        predio: 'Edifício / Condomínio',
      };
      return {
        categoryKey: raw,
        categoryLabel: mapLabels[raw] || raw.charAt(0).toUpperCase() + raw.slice(1),
      };
    }
    case 'path_depth_1': {
      const seg = segments[0] || 'raiz';
      return { categoryKey: seg.toLowerCase(), categoryLabel: `N1: ${seg}` };
    }
    case 'path_depth_2': {
      const seg = segments[1] || segments[0] || 'subgrupo';
      return { categoryKey: seg.toLowerCase(), categoryLabel: `N2: ${seg}` };
    }
    case 'path_depth_3': {
      const seg = segments[2] || segments[1] || segments[0] || 'setor';
      return { categoryKey: seg.toLowerCase(), categoryLabel: `N3: ${seg}` };
    }
    default:
      return { categoryKey: '__unified__', categoryLabel: 'Padrão Unificado' };
  }
}

/**
 * Resolves the exact color and shape for an entry/pin under the current `MapSymbologyConfig`.
 */
export function resolvePinSymbology(
  entry: Pick<FlatSkeletonEntry, 'key' | 'label' | 'meta'>,
  isWorked: boolean,
  config: MapSymbologyConfig = DEFAULT_MAP_SYMBOLOGY_CONFIG
): ResolvedPinSymbology {
  const meta = (entry.meta || {}) as Record<string, any>;

  if (config.respectManualPinOverrides && (meta.pinColor || meta.pinShape)) {
    const manualShape = (
      SYMBOLOGY_SHAPES.includes(meta.pinShape) ? meta.pinShape : config.baseShape
    ) as SymbologyShape;
    const manualColor = String(
      meta.pinColor || (isWorked ? config.workedColor : config.baseColor)
    );
    return {
      categoryKey: '__manual__',
      categoryLabel: 'Estilo Personalizado',
      color: manualColor,
      shape: manualShape,
      shapeGlyph: SYMBOLOGY_SHAPE_META[manualShape]?.glyph || '●',
    };
  }

  if (config.dimension === 'none') {
    const color = isWorked ? config.workedColor : config.baseColor;
    const shape = config.baseShape;
    return {
      categoryKey: '__unified__',
      categoryLabel: 'Padrão Unificado',
      color,
      shape,
      shapeGlyph: SYMBOLOGY_SHAPE_META[shape]?.glyph || '●',
    };
  }

  const { categoryKey, categoryLabel } = extractSymbologyCategory(entry, config.dimension);
  const hash = hashCategoryKey(categoryKey);
  const paletteColor = SYMBOLOGY_PALETTE[hash % SYMBOLOGY_PALETTE.length];
  const paletteShape = SYMBOLOGY_SHAPES[hash % SYMBOLOGY_SHAPES.length];

  const color =
    config.visualChannel === 'shape_only'
      ? isWorked
        ? config.workedColor
        : config.baseColor
      : paletteColor;

  const shape =
    config.visualChannel === 'color_only' ? config.baseShape : paletteShape;

  return {
    categoryKey,
    categoryLabel,
    color,
    shape,
    shapeGlyph: SYMBOLOGY_SHAPE_META[shape]?.glyph || '●',
  };
}

/**
 * Builds the legend items for a list of entries under the active `MapSymbologyConfig`.
 * Returns an empty array `[]` when `config.dimension === 'none'` (zero automatic legend clutter).
 */
export function buildSymbologyLegend(
  entries: Array<Pick<FlatSkeletonEntry, 'key' | 'label' | 'meta'>>,
  config: MapSymbologyConfig = DEFAULT_MAP_SYMBOLOGY_CONFIG
): SymbologyLegendItem[] {
  if (config.dimension === 'none') {
    return [];
  }

  const groups = new Map<string, SymbologyLegendItem>();

  for (const entry of entries) {
    const resolved = resolvePinSymbology(entry, false, {
      ...config,
      respectManualPinOverrides: false,
    });
    const existing = groups.get(resolved.categoryKey);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(resolved.categoryKey, {
        categoryKey: resolved.categoryKey,
        label: resolved.categoryLabel,
        color: resolved.color,
        shape: resolved.shape,
        shapeGlyph: resolved.shapeGlyph,
        count: 1,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR', { numeric: true })
  );
}
