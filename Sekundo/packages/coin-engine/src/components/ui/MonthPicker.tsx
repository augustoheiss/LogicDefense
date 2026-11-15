/**
 * MonthPicker Component — Assistente Moeda
 *
 * Filtro vertical pesquisável (Combobox Acessível) para seleção de período:
 *   - "Todos os períodos" (sem filtro de mês)
 *   - Anos completos ("📅 Ano 2026", "📅 Ano 2025" -> alterna todos os meses do ano)
 *   - Meses individuais (multi-seleção com busca live sem acentos)
 */

import { useMemo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@coin/theme/spacing';
import {
  parseSelectedMonthsSpec,
  serializeSelectedMonthsSpec,
  toggleMonthSelection,
  toggleYearSelection,
  formatSelectedMonthsLabel,
} from '@coin/core/dateUtils';
import type { VerticalFilterOption } from '@coin/utils/verticalFilterEngine';
import { SearchableVerticalFilter } from './SearchableVerticalFilter';

interface MonthPickerProps {
  months: string[]; // YYYY-MM sorted desc
  selected: string; // 'all', 'YYYY-MM', or 'YYYY-MM,YYYY-MM'
  selectedMonths?: string[];
  onSelect: (monthSpec: string) => void;
  onToggleMonth?: (month: string) => void;
  onToggleYear?: (year: string) => void;
}

const ALL_PERIODS_OPTION_ID = '__all__';
const YEAR_OPTION_PREFIX = '__year__';

function formatMonthLabel(ym?: string | null): string {
  if (!ym || ym === 'all' || typeof ym !== 'string') return 'Todos os períodos';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const [y, m] = parts;
  const shortMonths = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx < 0 || monthIdx >= 12 || isNaN(monthIdx)) return ym;
  const yearSuffix = y && y.length >= 2 ? y.slice(2) : y || '';
  return `${shortMonths[monthIdx]} ${yearSuffix}`.trim();
}

export function MonthPicker({
  months = [],
  selected,
  selectedMonths,
  onSelect,
  onToggleMonth,
  onToggleYear,
}: MonthPickerProps) {
  const safeMonths = useMemo(
    () =>
      Array.isArray(months)
        ? months.filter((m): m is string => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m))
        : [],
    [months],
  );

  const activeMonthsList = useMemo(
    () =>
      selectedMonths && Array.isArray(selectedMonths)
        ? parseSelectedMonthsSpec(selectedMonths)
        : parseSelectedMonthsSpec(selected),
    [selectedMonths, selected],
  );

  const selectedSet = useMemo(() => new Set<string>(activeMonthsList), [activeMonthsList]);

  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    for (const ym of safeMonths) {
      yrs.add(ym.slice(0, 4));
    }
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [safeMonths]);

  const activeLabel = useMemo(
    () => formatSelectedMonthsLabel(activeMonthsList, safeMonths),
    [activeMonthsList, safeMonths],
  );

  const handleToggleMonth = useCallback(
    (ym: string) => {
      if (onToggleMonth) {
        onToggleMonth(ym);
      } else {
        const next = toggleMonthSelection(activeMonthsList, ym);
        onSelect(serializeSelectedMonthsSpec(next));
      }
    },
    [onToggleMonth, activeMonthsList, onSelect],
  );

  const handleToggleYear = useCallback(
    (year: string) => {
      if (onToggleYear) {
        onToggleYear(year);
      } else {
        const next = toggleYearSelection(activeMonthsList, year, safeMonths);
        onSelect(serializeSelectedMonthsSpec(next));
      }
    },
    [onToggleYear, activeMonthsList, safeMonths, onSelect],
  );

  const options = useMemo<VerticalFilterOption[]>(() => {
    const items: VerticalFilterOption[] = [
      {
        id: ALL_PERIODS_OPTION_ID,
        label: 'Todos os períodos',
        subtitle: 'Exibir histórico completo sem restrição mensal',
        badge: `${safeMonths.length}m`,
        keywords: ['todos', 'all', 'limpar', 'completo'],
        pinned: true,
      },
    ];

    if (availableYears.length > 0 && safeMonths.length > 1) {
      for (const yr of availableYears) {
        const yrMonths = safeMonths.filter((m) => m.startsWith(`${yr}-`));
        items.push({
          id: `${YEAR_OPTION_PREFIX}${yr}`,
          label: `📅 Ano ${yr} (${yrMonths.length}m)`,
          subtitle: `Selecionar ou alternar todos os ${yrMonths.length} meses de ${yr}`,
          badge: `${yrMonths.length}m`,
          keywords: [yr, 'ano', 'year', `ano ${yr}`],
        });
      }
    }

    for (const m of safeMonths) {
      const shortLabel = formatMonthLabel(m);
      items.push({
        id: m,
        label: shortLabel,
        subtitle: m,
        keywords: [m, shortLabel, m.slice(0, 4)],
      });
    }

    return items;
  }, [safeMonths, availableYears]);

  const currentSelectedIds = useMemo(() => {
    if (activeMonthsList.length === 0) {
      return [ALL_PERIODS_OPTION_ID];
    }
    const ids = [...activeMonthsList];
    if (availableYears.length > 0 && safeMonths.length > 1) {
      for (const yr of availableYears) {
        const yrMonths = safeMonths.filter((m) => m.startsWith(`${yr}-`));
        if (yrMonths.length > 0 && yrMonths.every((m) => selectedSet.has(m))) {
          ids.push(`${YEAR_OPTION_PREFIX}${yr}`);
        }
      }
    }
    return ids;
  }, [activeMonthsList, availableYears, safeMonths, selectedSet]);

  const handleChangeSelectedIds = useCallback(
    (nextIds: string[]) => {
      if (nextIds.length === 0) {
        onSelect('all');
        return;
      }

      const prevSet = new Set(currentSelectedIds);
      const nextSet = new Set(nextIds);
      const added = nextIds.filter((id) => !prevSet.has(id));
      const removed = currentSelectedIds.filter((id) => !nextSet.has(id));

      if (added.includes(ALL_PERIODS_OPTION_ID)) {
        onSelect('all');
        return;
      }
      if (
        removed.includes(ALL_PERIODS_OPTION_ID) &&
        added.length === 0 &&
        removed.length === 1
      ) {
        onSelect('all');
        return;
      }

      if (added.length + removed.length === 1) {
        const changedId = added[0] ?? removed[0];
        if (changedId.startsWith(YEAR_OPTION_PREFIX)) {
          handleToggleYear(changedId.slice(YEAR_OPTION_PREFIX.length));
          return;
        }
        if (/^\d{4}-\d{2}$/.test(changedId)) {
          handleToggleMonth(changedId);
          return;
        }
      }

      const expandedMonths = new Set<string>();
      for (const id of nextIds) {
        if (/^\d{4}-\d{2}$/.test(id)) {
          expandedMonths.add(id);
        } else if (id.startsWith(YEAR_OPTION_PREFIX)) {
          const yr = id.slice(YEAR_OPTION_PREFIX.length);
          for (const ym of safeMonths) {
            if (ym.startsWith(`${yr}-`)) {
              expandedMonths.add(ym);
            }
          }
        }
      }
      onSelect(serializeSelectedMonthsSpec(expandedMonths));
    },
    [currentSelectedIds, safeMonths, onSelect, handleToggleMonth, handleToggleYear],
  );

  return (
    <View style={styles.wrapper} testID="month-picker-wrapper">
      <SearchableVerticalFilter
        label={`Período · ${activeLabel}`}
        testID="month-picker-vertical-filter"
        placeholder="🔍 Filtrar ou selecionar mês/ano (ex: 2026, Jan)..."
        emptyMessage="Nenhum mês ou ano encontrado para essa pesquisa."
        multiSelect
        selectedIds={currentSelectedIds}
        allowClear={activeMonthsList.length > 0}
        onChangeSelectedIds={handleChangeSelectedIds}
        options={options}
        showSelectFilteredAction
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
});
