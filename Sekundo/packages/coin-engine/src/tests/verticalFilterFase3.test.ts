/**
 * Fase 3 — Vertical Searchable Filter Engine & UI Contract Tests (@sekundo/coin-engine)
 *
 * 100% synthetic clean-room test suite validating:
 *   1. Standalone `@coin/utils/verticalFilterEngine` parity (PT-BR accents, multi-token,
 *      deterministic ranking, zero matches, pinned options, keyboard navigation).
 *   2. Static contract across all 18 Coin UI screens/components + `SearchableVerticalFilter.tsx`
 *      ensuring vertical searchable comboboxes, search-clear preservation, `allowClear={false}`
 *      protection on required single-select selectors, and zero stale horizontal strip artifacts.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeFilterSearchText,
  tokenizeFilterQuery,
  filterAndRankVerticalOptions,
  computeNextHighlightedIndex,
  type VerticalFilterOption,
} from '../utils/verticalFilterEngine';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

const COIN_SRC_DIR = path.resolve(__dirname, '..');

const SYNTHETIC_LEDGER_OPTIONS: VerticalFilterOption<{ group: string }>[] = [
  {
    id: 'all',
    label: '🌐 Todos os Períodos',
    subtitle: 'Consolidado anual completo',
    pinned: true,
    keywords: ['todos', 'geral'],
  },
  {
    id: 'educacao-fixa',
    label: 'Educação & Capacitação',
    subtitle: 'Despesas Fixas Mensais',
    badge: 'Recorrente',
    keywords: ['curso', 'treinamento'],
    meta: { group: 'fixo' },
  },
  {
    id: 'alimentacao',
    label: 'Alimentação',
    subtitle: 'Supermercado Centro Sul',
    keywords: ['feira', 'insumos'],
    meta: { group: 'variavel' },
  },
  {
    id: 'alimentacao-feira',
    label: 'Alimentação Corporativa',
    subtitle: 'Refeições da Equipe',
    keywords: ['equipe'],
    meta: { group: 'variavel' },
  },
  {
    id: 'vale-alimentacao',
    label: 'Benefício Alimentação',
    subtitle: 'Programa Interno',
    meta: { group: 'beneficio' },
  },
];

describe('Fase 3 — @coin/utils/verticalFilterEngine Parity & Ranking', () => {
  it('normalizes PT-BR accents, whitespace, and nullish values identically', () => {
    expect(normalizeFilterSearchText('  Alocação   de   Caixa  ')).toBe('alocacao de caixa');
    expect(normalizeFilterSearchText('EDUCAÇÃO')).toBe('educacao');
    expect(normalizeFilterSearchText(null)).toBe('');
    expect(tokenizeFilterQuery('  caixa   mensal ')).toEqual(['caixa', 'mensal']);
  });

  it('returns all options immediately when query is empty', () => {
    const res = filterAndRankVerticalOptions(SYNTHETIC_LEDGER_OPTIONS, '');
    expect(res.isQueryActive).toBe(false);
    expect(res.totalCount).toBe(SYNTHETIC_LEDGER_OPTIONS.length);
    expect(res.matchedCount).toBe(SYNTHETIC_LEDGER_OPTIONS.length);
    expect(res.items).toHaveLength(SYNTHETIC_LEDGER_OPTIONS.length);
  });

  it('filters accent-insensitively and supports multi-token matching', () => {
    const resAccent = filterAndRankVerticalOptions(SYNTHETIC_LEDGER_OPTIONS, 'educacao');
    expect(resAccent.items.map((o) => o.id)).toEqual(['educacao-fixa']);

    const resMulti = filterAndRankVerticalOptions(SYNTHETIC_LEDGER_OPTIONS, 'supermercado insumos');
    expect(resMulti.items.map((o) => o.id)).toEqual(['alimentacao']);
  });

  it('ranks deterministically: exact > prefix > word_prefix', () => {
    const res = filterAndRankVerticalOptions(SYNTHETIC_LEDGER_OPTIONS, 'alimentacao');
    expect(res.items.map((o) => o.id)).toEqual([
      'alimentacao',
      'alimentacao-feira',
      'vale-alimentacao',
    ]);
  });

  it('handles zero matches, pinned options, and keyboard wrap navigation', () => {
    const none = filterAndRankVerticalOptions(SYNTHETIC_LEDGER_OPTIONS, 'sem-resultado-999');
    expect(none.isQueryActive).toBe(true);
    expect(none.matchedCount).toBe(0);
    expect(none.items).toHaveLength(0);

    const withPinned = filterAndRankVerticalOptions(SYNTHETIC_LEDGER_OPTIONS, 'sem-resultado-999', {
      keepPinnedOnSearch: true,
    });
    expect(withPinned.items.map((o) => o.id)).toEqual(['all']);

    expect(computeNextHighlightedIndex(-1, 'ArrowDown', 3)).toBe(0);
    expect(computeNextHighlightedIndex(2, 'ArrowDown', 3)).toBe(0);
    expect(computeNextHighlightedIndex(0, 'ArrowUp', 3)).toBe(2);
    expect(computeNextHighlightedIndex(1, 'Home', 3)).toBe(0);
    expect(computeNextHighlightedIndex(1, 'End', 3)).toBe(2);
    expect(computeNextHighlightedIndex(0, 'ArrowDown', 0)).toBe(-1);

    // Nullish/non-object items & regex metacharacters do not crash and respect immutability
    const frozenNoisy = Object.freeze([
      null,
      undefined,
      { id: 'taxa-1', label: 'Taxa (IOF [0.38%])', keywords: 'bad-kw' as unknown as string[] },
      ...SYNTHETIC_LEDGER_OPTIONS,
    ] as unknown as VerticalFilterOption[]);
    const safeRes = filterAndRankVerticalOptions(frozenNoisy, '(iof [0.38%])');
    expect(safeRes.items.map((o) => o.id)).toEqual(['taxa-1']);
    expect(filterAndRankVerticalOptions(frozenNoisy, '').totalCount).toBe(
      SYNTHETIC_LEDGER_OPTIONS.length + 1
    );
  });
});

describe('Fase 3 — @sekundo/coin-engine UI & Safety Contract', () => {
  it('Coin SearchableVerticalFilter supports A11y, virtualization, and always allows clearing search text', () => {
    const filterPath = path.join(COIN_SRC_DIR, 'components/ui/SearchableVerticalFilter.tsx');
    const src = fs.readFileSync(filterPath, 'utf8');

    expect(src).toContain("role: 'combobox'");
    expect(src).toContain("'aria-expanded': isOpen");
    expect(src).toContain("'aria-controls': isOpen ? listboxId : undefined");
    expect(src).toContain("'aria-activedescendant'");
    expect(src).toContain("'aria-autocomplete': 'list'");
    expect(src).toContain("'aria-multiselectable': multiSelect || undefined");
    expect(src).toContain('disabled={Boolean(item.disabled)}');
    expect(src).toContain("ev.key !== 'Escape'");
    expect(src).toContain('filteredResult.items.length > 50');
    expect(src).toContain('<FlatList');
    expect(src).toContain('minHeight: 46');
    expect(src).toContain('minHeight: 44');
    expect(src).not.toContain('minHeight: 32');
    expect(src).not.toContain('minHeight: 36');
    expect(src).not.toContain('minHeight: 38');
    expect(src).toContain('const canShowClearBtn = query.length > 0 || canClearSelection');
    expect(src).toContain('} else if (allowClear) {');
  });

  it('All 18 Coin UI modules adopt SearchableVerticalFilter cleanly without stale horizontal strips', () => {
    const expectedFiles = [
      'app/(app)/(tabs)/charts.tsx',
      'app/(app)/(tabs)/index.tsx',
      'app/(app)/(tabs)/metrics.tsx',
      'app/(app)/(tabs)/settings.tsx',
      'components/cad/CadWorkspaceShell.tsx',
      'components/charts/ChartControlPanel.tsx',
      'components/learning/LessonsViewer.tsx',
      'components/sectors/LegalAuditWidgets.tsx',
      'components/sectors/PFMRetentionWidgets.tsx',
      'components/ui/AddRowModal.tsx',
      'components/ui/APIManagementTester.tsx',
      'components/ui/CategorySummary.tsx',
      'components/ui/ColumnMappingWorkbenchModal.tsx',
      'components/ui/ExampleCSVGalleryModal.tsx',
      'components/ui/MonthPicker.tsx',
      'components/ui/PredictionPanel.tsx',
      'components/ui/TableSwitcherModal.tsx',
      'components/CSVImporter.tsx',
    ];

    for (const rel of expectedFiles) {
      const src = fs.readFileSync(path.join(COIN_SRC_DIR, rel), 'utf8');
      expect(src).toContain('<SearchableVerticalFilter');
    }

    // Specific Phase 3 compile & safety repairs remain intact
    const pfmSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/sectors/PFMRetentionWidgets.tsx'),
      'utf8'
    );
    expect(pfmSrc).not.toContain('styles.timelineScroll');
    expect(pfmSrc).not.toContain('selectedTimelineFilter');
    expect(pfmSrc).toContain('styles.timelineList');

    const predSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/ui/PredictionPanel.tsx'),
      'utf8'
    );
    expect(predSrc).not.toContain('horizontalPills');
    expect(predSrc).toContain('allowClear={false}');

    const csvImpSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/CSVImporter.tsx'),
      'utf8'
    );
    expect(csvImpSrc).not.toContain('prof.summary');
    expect(csvImpSrc).not.toContain('prof.persona');

    const switcherSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/ui/TableSwitcherModal.tsx'),
      'utf8'
    );
    expect(switcherSrc).not.toContain('prof.summary');
    expect(switcherSrc).not.toContain('prof.persona');

    // Required single-select selectors explicitly set allowClear={false}
    const singleSelectSafeFiles = [
      'components/ui/APIManagementTester.tsx',
      'components/ui/CategorySummary.tsx',
      'components/ui/ColumnMappingWorkbenchModal.tsx',
      'components/sectors/LegalAuditWidgets.tsx',
      'app/(app)/(tabs)/index.tsx',
      'app/(app)/(tabs)/metrics.tsx',
      'app/(app)/(tabs)/settings.tsx',
      'app/(app)/(tabs)/charts.tsx',
      'components/charts/ChartControlPanel.tsx',
      'components/learning/LessonsViewer.tsx',
      'components/CSVImporter.tsx',
      'components/ui/AddRowModal.tsx',
      'components/ui/TableSwitcherModal.tsx',
    ];
    for (const rel of singleSelectSafeFiles) {
      const src = fs.readFileSync(path.join(COIN_SRC_DIR, rel), 'utf8');
      expect(src).toContain('allowClear={false}');
    }

    const cadSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/cad/CadWorkspaceShell.tsx'),
      'utf8'
    );
    expect(cadSrc).toContain('clearValueId="__close__"');

    const monthSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/ui/MonthPicker.tsx'),
      'utf8'
    );
    expect(monthSrc).toContain('allowClear={activeMonthsList.length > 0}');
  });
});

describe('Fase 3 — Endurecimento P1-07..P1-10 (Foco, Teclado, Scroll e Responsividade Coin)', () => {
  it('garante focusInputWithoutReopen, focusin, blurOnSubmit={false}, auto-scroll e preservacao de ArrowDown em SearchableVerticalFilter.tsx', () => {
    const svfSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/ui/SearchableVerticalFilter.tsx'),
      'utf8'
    );

    expect(svfSrc).toContain('suppressFocusOpenRef');
    expect(svfSrc).toContain('focusInputWithoutReopen');
    expect(svfSrc).toContain("document.addEventListener('focusin'");
    expect(svfSrc).toContain('blurOnSubmit={false}');
    expect(svfSrc).toContain('flatListRef');
    expect(svfSrc).toContain('scrollToIndex');
    expect(svfSrc).toContain('scrollIntoView');
    expect(svfSrc).toContain('onScrollToIndexFailed');
    expect(svfSrc).toContain('onTouchStart=');
    expect(svfSrc).toContain('onClick:');
    expect(svfSrc).not.toContain('onKeyDown: handleKeyDownWeb');
    expect(svfSrc).not.toContain('[query, isOpen]');
    expect(svfSrc).toContain('if (!isOpen)');
    expect(svfSrc).toContain('tabIndex: -1');
    expect(svfSrc).toContain('getItemLayout={getOptionItemLayout}');
    expect(svfSrc).toContain('animated: false');
    expect(svfSrc).toContain('suppressNextEscapeKeyUpRef');
    expect(svfSrc).toContain("document.addEventListener('keyup'");
    expect(svfSrc).toContain('stopImmediatePropagation');
    expect(svfSrc).toContain('if (query.length > 0)');
    expect(svfSrc).toContain('const canShowClearBtn = query.length > 0 || canClearSelection;');
    expect(svfSrc).not.toContain('query.trim().length > 0 || canClearSelection');
    expect(svfSrc).toContain("if (Platform.OS === 'web')");
    expect(svfSrc).toContain('accessibilityLabel="Limpar pesquisa e mostrar todos"');
    expect(svfSrc).toContain('listboxWebProps');
    expect(svfSrc).toContain('filteredResult.items.length === 0');
    expect(computeNextHighlightedIndex(-1, 'ArrowDown', SYNTHETIC_LEDGER_OPTIONS.length)).toBe(0);
    expect(computeNextHighlightedIndex(-1, 'ArrowUp', SYNTHETIC_LEDGER_OPTIONS.length)).toBe(
      SYNTHETIC_LEDGER_OPTIONS.length - 1
    );
  });

  it('garante wrap responsivo para mobile 390px e target minimo 44px em ChartControlPanel e ColumnMappingWorkbenchModal', () => {
    const chartPanelSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/charts/ChartControlPanel.tsx'),
      'utf8'
    );
    const colMapSrc = fs.readFileSync(
      path.join(COIN_SRC_DIR, 'components/ui/ColumnMappingWorkbenchModal.tsx'),
      'utf8'
    );

    expect(chartPanelSrc).toContain("flexWrap: 'wrap'");
    expect(chartPanelSrc.includes('minWidth: 260') || chartPanelSrc.includes('minWidth: 220')).toBe(true);
    expect(chartPanelSrc).toContain('minHeight: 44');

    expect(colMapSrc).toContain("flexWrap: 'wrap'");
    expect(colMapSrc).toContain('minWidth: 220');
  });
});
