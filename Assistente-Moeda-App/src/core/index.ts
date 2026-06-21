/**
 * Core Barrel — Assistente Moeda
 *
 * Re-exports all pure logic modules for convenient usage.
 */

export type {
  TableRow,
  TableGoals,
  CoinTable,
  DB,
  TableMetrics,
  MonthMetrics,
  YearMetrics,
  GoalProfile,
  CostBasedTarget,
  ProjectionPoint,
  ModalMode,
} from './types';

export { computeMetrics, emptyMetrics, rowContributions } from './metricsEngine';

export {
  generateClonedData,
  generateStatisticalData,
  countGeneratedRows,
  getGeneratedPeriods,
} from './predictionEngine';
export type { CloneConfig, SourceMode, GeneratedPeriodInfo } from './predictionEngine';

export {
  computeWeeklyDebtTimeline,
} from './computeWeeklyDebtTimeline';

export {
  computeProjection,
} from './projectionEngine';

export {
  formatCurrencyShort,
  formatCurrencyFull,
  formatBalanceShort,
  formatCurrencySmart,
} from './formatCurrency';

export {
  calculateStrictGlobalBalance,
  getWeeklyGoalForDate,
} from './dateUtils';
