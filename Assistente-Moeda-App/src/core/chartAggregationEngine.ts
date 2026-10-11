/**
 * Chart Aggregation Engine — Assistente Moeda
 *
 * Pure mathematical aggregation pipeline for the Interactive Dynamic Chart Builder.
 * Zero DOM dependencies, 100% deterministic, handles dense multi-year datasets in <10ms.
 */

import type { TableRow, TableGoals } from './types';
import { getDailyGoalForDate, getEffectiveGoals } from './dateUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TimeScopeType = 'day' | 'month' | 'year' | 'multi_date' | 'custom_range';

export type MetricType = 'revenue' | 'expense' | 'balance' | 'deposit' | 'waiver';

export type VisualType = 'composed' | 'bar' | 'line_area' | 'donut';

export interface ChartBuilderConfig {
  scopeType: TimeScopeType;
  selectedYear: number;
  selectedMonth: string;          // 'YYYY-MM'
  multiDates: string[];           // e.g. ['2026-09-01', '2026-09-15']
  customRange: { start: string; end: string };
  activeMetrics: MetricType[];
  selectedCategories: string[];   // empty array = all categories
  visualType: VisualType;
  showGoals: boolean;
  cumulativeBalance: boolean;
}

export interface ChartDataPoint {
  label: string;                  // '01/09', 'Set/26', '2026', etc.
  dateISO: string;                // '2026-09-01', '2026-09', or '2026'
  revenue: number;
  expense: number;                // positive magnitude for bar height
  expenseSigned: number;          // negative value for balance calculation
  balance: number;                // revenue - expense
  deposit: number;
  waiver: number;
  cumulativeBalance: number;
  goal?: number;
  rawRowIds: string[];
  rowCount: number;
}

export interface ChartCategorySlice {
  name: string;
  value: number;
  color: string;
  count: number;
  pct: number;
  rawRowIds: string[];
}

export interface ChartAggregationResult {
  points: ChartDataPoint[];
  donutSlices: ChartCategorySlice[];
  totalRevenue: number;
  totalExpense: number;
  netBalance: number;
  totalDeposit: number;
  totalWaiver: number;
  topCategory: { name: string; amount: number; pct: number } | null;
  availableYears: number[];
  availableMonths: string[];
  availableCategories: string[];
  rowLookupMap: Map<string, TableRow[]>;
}

// ── Curated Color Palette for Categories & Series ──────────────────────────────

export const CHART_PALETTE = [
  '#10b981', // Emerald / Revenue
  '#ef4444', // Red / Expense
  '#8b5cf6', // Violet / Balance
  '#3b82f6', // Blue / Deposit
  '#f59e0b', // Amber / Waiver
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#f97316', // Orange
  '#a855f7', // Purple
];

const MONTH_SHORT_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// ── Helper Pure Functions ─────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getDefaultChartConfig(): ChartBuilderConfig {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  return {
    scopeType: 'day',
    selectedYear: y,
    selectedMonth: `${y}-${m}`,
    multiDates: [],
    customRange: {
      start: `${y}-${m}-01`,
      end: `${y}-${m}-${pad2(daysInMonth(y, Number(m)))}`,
    },
    activeMetrics: ['revenue', 'expense', 'balance'],
    selectedCategories: [],
    visualType: 'composed',
    showGoals: true,
    cumulativeBalance: false,
  };
}

// ── Main Aggregation Pipeline ─────────────────────────────────────────────────

export function aggregateChartData(
  allRows: TableRow[],
  config: ChartBuilderConfig,
  goals?: TableGoals,
): ChartAggregationResult {
  const validRows = allRows.filter((r) => r.entryType !== 'unresolved');

  // 1. Discover available years, months, and categories from dataset
  const yearsSet = new Set<number>();
  const monthsSet = new Set<string>();
  const categoriesSet = new Set<string>();

  for (const r of validRows) {
    if (r.date && r.date.length >= 7) {
      const y = parseInt(r.date.slice(0, 4), 10);
      if (!isNaN(y)) {
        yearsSet.add(y);
        monthsSet.add(r.date.slice(0, 7));
      }
    }
    const cat = (r.category || r.description || '').trim();
    if (cat) {
      categoriesSet.add(cat.toUpperCase());
    }
  }

  const currentYear = new Date().getFullYear();
  yearsSet.add(currentYear);
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a); // newest first
  const availableMonths = Array.from(monthsSet).sort().reverse();    // newest first
  const availableCategories = Array.from(categoriesSet).sort();

  // 2. Filter rows by category if specified
  let filteredRows = validRows;
  if (config.selectedCategories && config.selectedCategories.length > 0) {
    const selectedUpper = new Set(config.selectedCategories.map((c) => c.trim().toUpperCase()));
    filteredRows = validRows.filter((r) => {
      const rowCat = (r.category || r.description || '').trim().toUpperCase();
      return selectedUpper.has(rowCat);
    });
  }

  // 3. Build row lookup map and group bins
  const rowLookupMap = new Map<string, TableRow[]>();

  const addRowToLookup = (key: string, row: TableRow) => {
    const list = rowLookupMap.get(key) || [];
    list.push(row);
    rowLookupMap.set(key, list);
  };

  // 4. Determine points based on scopeType
  const points: ChartDataPoint[] = [];

  if (config.scopeType === 'day') {
    // Daily view for the selected month
    const [yStr, mStr] = config.selectedMonth.split('-');
    const year = parseInt(yStr, 10) || currentYear;
    const month = parseInt(mStr, 10) || 1;
    const totalDays = daysInMonth(year, month);

    // Map rows of this month by day
    const dayRowsMap = new Map<string, TableRow[]>();
    for (const r of filteredRows) {
      if (r.date && r.date.startsWith(config.selectedMonth)) {
        const dayList = dayRowsMap.get(r.date) || [];
        dayList.push(r);
        dayRowsMap.set(r.date, dayList);
        addRowToLookup(r.date, r);
      }
    }

    let runningBalance = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dateISO = `${config.selectedMonth}-${pad2(day)}`;
      const label = `${pad2(day)}/${pad2(month)}`;
      const rowsForDay = dayRowsMap.get(dateISO) || [];

      let rev = 0;
      let exp = 0;
      let dep = 0;
      let wai = 0;
      const ids: string[] = [];

      for (const r of rowsForDay) {
        ids.push(r.id);
        const val = Number(r.value) || 0;
        if (r.entryType === 'revenue' || r.entryType === 'partner_in') rev += val;
        else if (r.entryType === 'expense' || r.entryType === 'partner_out') exp += val;
        else if (r.entryType === 'deposit') dep += val;
        else if (r.entryType === 'waiver') wai += val;
      }

      const dayBalance = rev - exp;
      runningBalance += dayBalance;

      const dailyGoal = goals ? getDailyGoalForDate(dateISO, goals) : undefined;

      points.push({
        label,
        dateISO,
        revenue: Math.round(rev * 100) / 100,
        expense: Math.round(exp * 100) / 100,
        expenseSigned: -Math.round(exp * 100) / 100,
        balance: Math.round(dayBalance * 100) / 100,
        deposit: Math.round(dep * 100) / 100,
        waiver: Math.round(wai * 100) / 100,
        cumulativeBalance: Math.round(runningBalance * 100) / 100,
        goal: dailyGoal && dailyGoal > 0 ? dailyGoal : undefined,
        rawRowIds: ids,
        rowCount: rowsForDay.length,
      });
    }
  } else if (config.scopeType === 'month') {
    // 12 months for the selected year
    const year = config.selectedYear || currentYear;
    let runningBalance = 0;

    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${pad2(m)}`;
      const label = MONTH_SHORT_PT[m - 1];

      const rowsForMonth = filteredRows.filter((r) => r.date && r.date.startsWith(ym));
      for (const r of rowsForMonth) {
        addRowToLookup(ym, r);
      }

      let rev = 0;
      let exp = 0;
      let dep = 0;
      let wai = 0;
      const ids: string[] = [];

      for (const r of rowsForMonth) {
        ids.push(r.id);
        const val = Number(r.value) || 0;
        if (r.entryType === 'revenue' || r.entryType === 'partner_in') rev += val;
        else if (r.entryType === 'expense' || r.entryType === 'partner_out') exp += val;
        else if (r.entryType === 'deposit') dep += val;
        else if (r.entryType === 'waiver') wai += val;
      }

      const mBalance = rev - exp;
      runningBalance += mBalance;

      const effectiveGoal = goals ? getEffectiveGoals({ year, month: m }, goals).dailyGoal * daysInMonth(year, m) : undefined;

      points.push({
        label,
        dateISO: ym,
        revenue: Math.round(rev * 100) / 100,
        expense: Math.round(exp * 100) / 100,
        expenseSigned: -Math.round(exp * 100) / 100,
        balance: Math.round(mBalance * 100) / 100,
        deposit: Math.round(dep * 100) / 100,
        waiver: Math.round(wai * 100) / 100,
        cumulativeBalance: Math.round(runningBalance * 100) / 100,
        goal: effectiveGoal && effectiveGoal > 0 ? Math.round(effectiveGoal) : undefined,
        rawRowIds: ids,
        rowCount: rowsForMonth.length,
      });
    }
  } else if (config.scopeType === 'year') {
    // All available years sorted ascending
    const sortedYears = [...availableYears].sort((a, b) => a - b);
    let runningBalance = 0;

    for (const y of sortedYears) {
      const yStr = String(y);
      const rowsForYear = filteredRows.filter((r) => r.date && r.date.startsWith(yStr));
      for (const r of rowsForYear) {
        addRowToLookup(yStr, r);
      }

      let rev = 0;
      let exp = 0;
      let dep = 0;
      let wai = 0;
      const ids: string[] = [];

      for (const r of rowsForYear) {
        ids.push(r.id);
        const val = Number(r.value) || 0;
        if (r.entryType === 'revenue' || r.entryType === 'partner_in') rev += val;
        else if (r.entryType === 'expense' || r.entryType === 'partner_out') exp += val;
        else if (r.entryType === 'deposit') dep += val;
        else if (r.entryType === 'waiver') wai += val;
      }

      const yBalance = rev - exp;
      runningBalance += yBalance;

      points.push({
        label: yStr,
        dateISO: yStr,
        revenue: Math.round(rev * 100) / 100,
        expense: Math.round(exp * 100) / 100,
        expenseSigned: -Math.round(exp * 100) / 100,
        balance: Math.round(yBalance * 100) / 100,
        deposit: Math.round(dep * 100) / 100,
        waiver: Math.round(wai * 100) / 100,
        cumulativeBalance: Math.round(runningBalance * 100) / 100,
        rawRowIds: ids,
        rowCount: rowsForYear.length,
      });
    }
  } else if (config.scopeType === 'multi_date') {
    // Custom set of specific dates
    const dates = [...new Set(config.multiDates)].sort();
    let runningBalance = 0;

    for (const dateISO of dates) {
      const parts = dateISO.split('-');
      const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateISO;
      const rowsForDate = filteredRows.filter((r) => r.date === dateISO);
      for (const r of rowsForDate) {
        addRowToLookup(dateISO, r);
      }

      let rev = 0;
      let exp = 0;
      let dep = 0;
      let wai = 0;
      const ids: string[] = [];

      for (const r of rowsForDate) {
        ids.push(r.id);
        const val = Number(r.value) || 0;
        if (r.entryType === 'revenue' || r.entryType === 'partner_in') rev += val;
        else if (r.entryType === 'expense' || r.entryType === 'partner_out') exp += val;
        else if (r.entryType === 'deposit') dep += val;
        else if (r.entryType === 'waiver') wai += val;
      }

      const b = rev - exp;
      runningBalance += b;

      points.push({
        label,
        dateISO,
        revenue: Math.round(rev * 100) / 100,
        expense: Math.round(exp * 100) / 100,
        expenseSigned: -Math.round(exp * 100) / 100,
        balance: Math.round(b * 100) / 100,
        deposit: Math.round(dep * 100) / 100,
        waiver: Math.round(wai * 100) / 100,
        cumulativeBalance: Math.round(runningBalance * 100) / 100,
        rawRowIds: ids,
        rowCount: rowsForDate.length,
      });
    }
  } else if (config.scopeType === 'custom_range') {
    // Range between customRange.start and customRange.end
    const startDate = config.customRange.start || `${currentYear}-01-01`;
    const endDate = config.customRange.end || `${currentYear}-12-31`;

    const rowsInRange = filteredRows.filter((r) => r.date >= startDate && r.date <= endDate);

    // Collect distinct dates in range
    const distinctDates = Array.from(new Set(rowsInRange.map((r) => r.date))).sort();
    let runningBalance = 0;

    for (const dateISO of distinctDates) {
      const parts = dateISO.split('-');
      const label = `${parts[2]}/${parts[1]}`;
      const rowsForDate = rowsInRange.filter((r) => r.date === dateISO);
      for (const r of rowsForDate) {
        addRowToLookup(dateISO, r);
      }

      let rev = 0;
      let exp = 0;
      let dep = 0;
      let wai = 0;
      const ids: string[] = [];

      for (const r of rowsForDate) {
        ids.push(r.id);
        const val = Number(r.value) || 0;
        if (r.entryType === 'revenue' || r.entryType === 'partner_in') rev += val;
        else if (r.entryType === 'expense' || r.entryType === 'partner_out') exp += val;
        else if (r.entryType === 'deposit') dep += val;
        else if (r.entryType === 'waiver') wai += val;
      }

      const b = rev - exp;
      runningBalance += b;

      points.push({
        label,
        dateISO,
        revenue: Math.round(rev * 100) / 100,
        expense: Math.round(exp * 100) / 100,
        expenseSigned: -Math.round(exp * 100) / 100,
        balance: Math.round(b * 100) / 100,
        deposit: Math.round(dep * 100) / 100,
        waiver: Math.round(wai * 100) / 100,
        cumulativeBalance: Math.round(runningBalance * 100) / 100,
        rawRowIds: ids,
        rowCount: rowsForDate.length,
      });
    }
  }

  // 5. Aggregate overall totals across points
  let totalRevenue = 0;
  let totalExpense = 0;
  let totalDeposit = 0;
  let totalWaiver = 0;

  for (const pt of points) {
    totalRevenue += pt.revenue;
    totalExpense += pt.expense;
    totalDeposit += pt.deposit;
    totalWaiver += pt.waiver;
  }

  const netBalance = Math.round((totalRevenue - totalExpense) * 100) / 100;

  // 6. Aggregate category distribution (Donut slices) for the current view
  // Consider rows included in the points
  const activeRowIds = new Set<string>();
  for (const pt of points) {
    for (const id of pt.rawRowIds) {
      activeRowIds.add(id);
    }
  }

  const includedRows = filteredRows.filter((r) => activeRowIds.has(r.id));
  const categoryAmountMap = new Map<string, { amount: number; count: number; ids: string[] }>();

  for (const r of includedRows) {
    // Focus on expense categories or general category volume
    const cat = (r.category || r.description || 'Outros').trim().toUpperCase();
    const val = Number(r.value) || 0;
    const current = categoryAmountMap.get(cat) || { amount: 0, count: 0, ids: [] };
    current.amount += val;
    current.count += 1;
    current.ids.push(r.id);
    categoryAmountMap.set(cat, current);

    // Also register category key in lookup map for drill-down
    addRowToLookup(`cat:${cat}`, r);
  }

  const totalCatAmount = Array.from(categoryAmountMap.values()).reduce((sum, item) => sum + item.amount, 0);

  const sortedCategories = Array.from(categoryAmountMap.entries())
    .sort((a, b) => b[1].amount - a[1].amount);

  const donutSlices: ChartCategorySlice[] = sortedCategories.map(([cat, data], idx) => ({
    name: cat,
    value: Math.round(data.amount * 100) / 100,
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
    count: data.count,
    pct: totalCatAmount > 0 ? Math.round((data.amount / totalCatAmount) * 1000) / 10 : 0,
    rawRowIds: data.ids,
  }));

  const topCategory = donutSlices.length > 0
    ? { name: donutSlices[0].name, amount: donutSlices[0].value, pct: donutSlices[0].pct }
    : null;

  return {
    points,
    donutSlices,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netBalance,
    totalDeposit: Math.round(totalDeposit * 100) / 100,
    totalWaiver: Math.round(totalWaiver * 100) / 100,
    topCategory,
    availableYears,
    availableMonths,
    availableCategories,
    rowLookupMap,
  };
}
