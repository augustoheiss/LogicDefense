/**
 * Fase 3 — Testes Unitários da Engine Vertical Pesquisável & Contrato UI (@sekundo/core + @sekundo/app)
 *
 * Dados 100% sintéticos (clean-room). Valida:
 *   1. `normalizeFilterSearchText` & `tokenizeFilterQuery` (diacríticos PT-BR, caixa, espaços, nulos).
 *   2. `filterAndRankVerticalOptions` (busca vazia retorna tudo, acento-insensível, multi-token,
 *      ranqueamento determinístico exato > prefixo > palavra > substring > subtítulo/keywords,
 *      0 correspondências, opções `pinned` com `sortPinnedFirst` e `keepPinnedOnSearch`, `maxResults`).
 *   3. `computeNextHighlightedIndex` (navegação ArrowDown/ArrowUp/Home/End com wrap e lista vazia).
 *   4. Contrato estático UI & A11y dos componentes verticais em `@sekundo/app` e `@sekundo/coin-engine`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  normalizeFilterSearchText,
  tokenizeFilterQuery,
  filterAndRankVerticalOptions,
  computeNextHighlightedIndex,
  type VerticalFilterOption,
} from '../index';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const SYNTHETIC_TERRITORIES: VerticalFilterOption<{ zone: string }>[] = [
  {
    id: 'all',
    label: '🌐 Todos os Territórios',
    subtitle: 'Exibir malha territorial completa',
    pinned: true,
    keywords: ['todos', 'geral'],
  },
  {
    id: 'centro',
    label: 'Centro',
    subtitle: 'Distrito Central Histórico',
    badge: '12 quadras',
    keywords: ['matriz', 'comercio'],
    meta: { zone: 'central' },
  },
  {
    id: 'centro-norte',
    label: 'Centro Administrativo Norte',
    subtitle: 'Zona de Expansão Urbana',
    badge: '8 quadras',
    keywords: ['prefeitura', 'avenida'],
    meta: { zone: 'norte' },
  },
  {
    id: 'bairro-centro-sul',
    label: 'Vila Centro-Sul',
    subtitle: 'Quadra Residencial 04',
    keywords: ['residencial'],
    meta: { zone: 'sul' },
  },
  {
    id: 'jardim-centro',
    label: 'Parque JardimSubcentro',
    subtitle: 'Área Verde Municipal',
    keywords: ['parque'],
    meta: { zone: 'leste' },
  },
  {
    id: 'sao-jose',
    label: 'São José das Palmeiras',
    subtitle: 'Acesso pela Educação & Saúde',
    badge: 'Urgente',
    keywords: ['rodovia', 'rural', 'palmeiral'],
    meta: { zone: 'oeste' },
  },
];

describe('Fase 3 — Engine Headless VerticalFilterEngine (@sekundo/core)', () => {
  it('normalizes PT-BR diacritics, whitespace, case, and nullish values', () => {
    expect(normalizeFilterSearchText('  São   José — Ação & Saúde  ')).toBe('sao jose — acao & saude');
    expect(normalizeFilterSearchText('CAMPINAS ÇÃÕÊ')).toBe('campinas caoe');
    expect(normalizeFilterSearchText(null)).toBe('');
    expect(normalizeFilterSearchText(undefined)).toBe('');
    expect(normalizeFilterSearchText(404)).toBe('404');
  });

  it('tokenizes multi-term search queries consistently', () => {
    expect(tokenizeFilterQuery('   São   José  04  ')).toEqual(['sao', 'jose', '04']);
    expect(tokenizeFilterQuery('   ')).toEqual([]);
  });

  it('returns all options immediately when query is empty or whitespace-only', () => {
    const res = filterAndRankVerticalOptions(SYNTHETIC_TERRITORIES, '   ');
    expect(res.isQueryActive).toBe(false);
    expect(res.normalizedQuery).toBe('');
    expect(res.totalCount).toBe(SYNTHETIC_TERRITORIES.length);
    expect(res.matchedCount).toBe(SYNTHETIC_TERRITORIES.length);
    expect(res.items.map((i) => i.id)).toEqual(SYNTHETIC_TERRITORIES.map((i) => i.id));
  });

  it('matches accent-insensitively and handles multi-token queries across fields', () => {
    const accentRes = filterAndRankVerticalOptions(SYNTHETIC_TERRITORIES, 'sao jose');
    expect(accentRes.isQueryActive).toBe(true);
    expect(accentRes.items.map((i) => i.id)).toEqual(['sao-jose']);

    const spreadTokens = filterAndRankVerticalOptions(SYNTHETIC_TERRITORIES, 'educacao urgente');
    expect(spreadTokens.items.map((i) => i.id)).toEqual(['sao-jose']);

    const keywordRes = filterAndRankVerticalOptions(SYNTHETIC_TERRITORIES, 'palmeiral');
    expect(keywordRes.items.map((i) => i.id)).toEqual(['sao-jose']);
  });

  it('ranks deterministically: exact > prefix > word_prefix > contains > subtitle/keywords', () => {
    const rankingSample: VerticalFilterOption[] = [
      { id: 'opt-sub', label: 'Sub-distrito Alfa', subtitle: 'Vizinho ao Centro Comercial' },
      { id: 'opt-contains', label: 'Parque Microcentro', subtitle: 'Setor 9' },
      { id: 'opt-word', label: 'Vila Centro Oeste', subtitle: 'Setor 4' },
      { id: 'opt-prefix', label: 'Centro Histórico', subtitle: 'Setor 2' },
      { id: 'opt-exact', label: 'Centro', subtitle: 'Setor 1' },
    ];

    const res = filterAndRankVerticalOptions(rankingSample, 'centro');
    expect(res.items.map((i) => i.id)).toEqual([
      'opt-exact',
      'opt-prefix',
      'opt-word',
      'opt-contains',
      'opt-sub',
    ]);
  });

  it('returns empty items on zero matches unless keepPinnedOnSearch is enabled', () => {
    const emptyRes = filterAndRankVerticalOptions(SYNTHETIC_TERRITORIES, 'inexistente-xyz');
    expect(emptyRes.isQueryActive).toBe(true);
    expect(emptyRes.matchedCount).toBe(0);
    expect(emptyRes.items).toEqual([]);

    const pinnedKept = filterAndRankVerticalOptions(SYNTHETIC_TERRITORIES, 'inexistente-xyz', {
      keepPinnedOnSearch: true,
    });
    expect(pinnedKept.items.map((i) => i.id)).toEqual(['all']);
  });

  it('supports sortPinnedFirst and maxResults cleanly', () => {
    const unordered: VerticalFilterOption[] = [
      { id: 'z', label: 'Zona B' },
      { id: 'pin', label: 'Fixado', pinned: true },
      { id: 'a', label: 'Zona A' },
    ];
    const sorted = filterAndRankVerticalOptions(unordered, '', {
      sortPinnedFirst: true,
      maxResults: 2,
    });
    expect(sorted.items.map((i) => i.id)).toEqual(['pin', 'z']);
    expect(sorted.matchedCount).toBe(3);
    expect(sorted.totalCount).toBe(3);
  });

  it('navigates keyboard indices accurately with wrap-around and empty safety', () => {
    expect(computeNextHighlightedIndex(0, 'ArrowDown', 0)).toBe(-1);
    expect(computeNextHighlightedIndex(-1, 'ArrowDown', 4)).toBe(0);
    expect(computeNextHighlightedIndex(2, 'ArrowDown', 4)).toBe(3);
    expect(computeNextHighlightedIndex(3, 'ArrowDown', 4)).toBe(0);
    expect(computeNextHighlightedIndex(0, 'ArrowUp', 4)).toBe(3);
    expect(computeNextHighlightedIndex(2, 'ArrowUp', 4)).toBe(1);
    expect(computeNextHighlightedIndex(2, 'Home', 4)).toBe(0);
    expect(computeNextHighlightedIndex(1, 'End', 4)).toBe(3);
    expect(computeNextHighlightedIndex(9, 'Tab', 4)).toBe(-1);
  });

  it('safely ignores nullish/corrupted option items, handles regex chars, and never mutates frozen input', () => {
    const frozenWithNoise = Object.freeze([
      null,
      undefined,
      { id: 'c-plus', label: 'Plano C++ (Setor [1])', keywords: 'invalido' as unknown as string[] },
      { id: 'setor-2', label: 'Setor 2', pinned: true, keywords: ['sintetico'] },
    ] as unknown as VerticalFilterOption[]);

    const allRes = filterAndRankVerticalOptions(frozenWithNoise, '');
    expect(allRes.totalCount).toBe(2);
    expect(allRes.items.map((o) => o.id)).toEqual(['c-plus', 'setor-2']);

    const regexRes = filterAndRankVerticalOptions(frozenWithNoise, 'c++ (setor [1])');
    expect(regexRes.items.map((o) => o.id)).toEqual(['c-plus']);

    const nonArrayRes = filterAndRankVerticalOptions(null as unknown as VerticalFilterOption[], 'algo');
    expect(nonArrayRes.totalCount).toBe(0);
    expect(nonArrayRes.items).toEqual([]);
  });
});

describe('Fase 3 — Contratos UI Verticais & Acessibilidade (@sekundo/app)', () => {
  it('App SearchableVerticalFilter preserves search clear button even when allowClear=false and enforces A11y', () => {
    const appFilterPath = path.join(
      REPO_ROOT,
      'packages/app/src/components/ui/SearchableVerticalFilter.tsx'
    );
    const src = fs.readFileSync(appFilterPath, 'utf8');

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
    // Search text clear button must remain available regardless of allowClear (including whitespace-only input)
    expect(src).toContain('const canShowClearBtn = query.length > 0 || canClearSelection');
    expect(src).toContain('} else if (allowClear) {');
  });

  it('FieldAutoComplete delegates search/ranking, preserves full count without truncation, and guards Tab blur', () => {
    const autoPath = path.join(REPO_ROOT, 'packages/app/src/components/ui/FieldAutoComplete.tsx');
    const src = fs.readFileSync(autoPath, 'utf8');
    expect(src).toContain('filterAndRankVerticalOptions');
    expect(src).toContain('computeNextHighlightedIndex');
    expect(src).toContain("'aria-controls': isOpen ? listboxId : undefined");
    expect(src).toContain("'aria-activedescendant'");
    expect(src).toContain('relatedTarget');
    expect(src).not.toContain('maxResults: 60');
    expect(src).not.toContain('minHeight: 34');
  });

  it('All converted Sekundo screens and modals use SearchableVerticalFilter without horizontal filter strips', () => {
    const appConsumers = [
      'packages/app/src/app/publisher.tsx',
      'packages/app/src/app/roster-swap.tsx',
      'packages/app/src/app/schedule-hub.tsx',
      'packages/app/src/app/territory-checklist.tsx',
      'packages/app/src/app/territory-map.tsx',
      'packages/app/src/app/tournament-bracket.tsx',
      'packages/app/src/components/audit/ActivityLogModal.tsx',
      'packages/app/src/components/csv/GranularExportModal.tsx',
      'packages/app/src/components/forms/PdfFormsSections.tsx',
      'packages/app/src/components/forms/QuickFillForm.tsx',
      'packages/app/src/components/share/QuickShareSheet.tsx',
      'packages/app/src/components/territory/PinStyleModal.tsx',
      'packages/app/src/components/territory/TerritoryManageModal.tsx',
    ];

    for (const rel of appConsumers) {
      const fullPath = path.join(REPO_ROOT, rel);
      const src = fs.readFileSync(fullPath, 'utf8');
      expect(src).toContain('<SearchableVerticalFilter');
    }

    // schedule-hub cycle year picker uses vertical combobox with unique testIDs (no duplicated territory filter in Tab 1)
    const hubSrc = fs.readFileSync(path.join(REPO_ROOT, 'packages/app/src/app/schedule-hub.tsx'), 'utf8');
    expect(hubSrc).toContain('testID="schedule-hub-cycle-year-filter"');
    expect(hubSrc.match(/testID="schedule-hub-territory-sector-filter"/g)?.length).toBe(1);
    expect(hubSrc).not.toContain("(['all', '2027', '2026'] as const).map");
    expect(hubSrc).not.toContain('sess.slots');

    const pdfSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/app/src/components/forms/PdfFormsSections.tsx'),
      'utf8'
    );
    expect(pdfSrc).toContain('testID="pdf-forms-cycle-year-filter"');
  });
});

describe('Fase 3 — Endurecimento P1-07..P1-10 (Foco, Teclado, A11y e Auto-Scroll)', () => {
  it('evita reabertura ao fechar com Escape/Concluir, fecha no Tab externo (focusin) e faz auto-scroll (@sekundo/app)', () => {
    const svfPath = path.join(REPO_ROOT, 'packages/app/src/components/ui/SearchableVerticalFilter.tsx');
    const facPath = path.join(REPO_ROOT, 'packages/app/src/components/ui/FieldAutoComplete.tsx');
    const svfSrc = fs.readFileSync(svfPath, 'utf8');
    const facSrc = fs.readFileSync(facPath, 'utf8');

    for (const src of [svfSrc, facSrc]) {
      expect(src).toContain('suppressFocusOpenRef');
      expect(src).toContain('focusInputWithoutReopen');
      expect(src).toContain("document.addEventListener('focusin'");
      expect(src).toContain('blurOnSubmit={false}');
      expect(src).toContain('flatListRef');
      expect(src).toContain('scrollToIndex');
      expect(src).toContain('scrollIntoView');
      expect(src).toContain('onScrollToIndexFailed');
      expect(src).toContain('onTouchStart=');
      expect(src).toContain('onClick:');
      expect(src).not.toContain('onKeyDown: handleKeyDownWeb');
      expect(src).toContain('if (!isOpen)');
      expect(src).toContain('tabIndex: -1');
      expect(src).toContain('getItemLayout={getOptionItemLayout}');
      expect(src).toContain('animated: false');
      expect(src).toContain('suppressNextEscapeKeyUpRef');
      expect(src).toContain("document.addEventListener('keyup'");
      expect(src).toContain('stopImmediatePropagation');
    }

    expect(svfSrc).not.toContain('[query, isOpen]');
    expect(svfSrc).toContain('if (query.length > 0)');
    expect(svfSrc).toContain('const canShowClearBtn = query.length > 0 || canClearSelection;');
    expect(svfSrc).not.toContain('query.trim().length > 0 || canClearSelection');
    expect(svfSrc).toContain("if (Platform.OS === 'web')");
    expect(svfSrc).toContain('accessibilityLabel="Limpar pesquisa e mostrar todos"');

    expect(facSrc).not.toContain('[value, isOpen]');
    expect(facSrc).toContain('{value.length > 0 ? (');
    expect(facSrc).not.toContain('{value.trim().length > 0 ? (');
    expect(facSrc).toContain('testID="field-autocomplete-reset-query-btn"');
    expect(facSrc).toContain('Array.isArray(flatRegistry)');
    expect(facSrc).toContain('selectingOptionRef.current = true');
    expect(svfSrc).toContain('listboxWebProps');
    expect(facSrc).toContain('listboxWebProps');
    expect(svfSrc).toContain('filteredResult.items.length === 0');
    expect(facSrc).toContain('filteredResult.items.length === 0');
  });

  it('computeNextHighlightedIndex preserva destaque inicial no ArrowDown/ArrowUp ao abrir lista fechada', () => {
    const count = SYNTHETIC_TERRITORIES.length;
    expect(computeNextHighlightedIndex(-1, 'ArrowDown', count)).toBe(0);
    expect(computeNextHighlightedIndex(0, 'ArrowDown', count)).toBe(1);
    expect(computeNextHighlightedIndex(count - 1, 'ArrowDown', count)).toBe(0);
    expect(computeNextHighlightedIndex(-1, 'ArrowUp', count)).toBe(count - 1);
    expect(computeNextHighlightedIndex(-1, 'Home', count)).toBe(0);
    expect(computeNextHighlightedIndex(-1, 'End', count)).toBe(count - 1);
    expect(computeNextHighlightedIndex(-1, 'ArrowDown', 0)).toBe(-1);
  });
});
