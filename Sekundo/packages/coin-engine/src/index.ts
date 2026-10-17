/**
 * @sekundo/coin-engine — Public Barrel Export
 *
 * Exposes the complete Assistente Moeda Engine (Core Math, Sector Engines,
 * Security Sanitizer, Local-First Storage, Turso/Public API Services, Hooks, and UI).
 */

export * from './core';
export * from './core/healthEngine';
export * from './core/insightsEngine';
export * from './core/investorMetricsEngine';
export * from './core/smartRebalancer';
export * from './core/workspacePresets';
export * from './core/dbReducer';
export * from './core/opLog';
export * from './core/actions';
export * from './utils/securitySanitizer';
export * from './utils/csvEngine';
export * from './storage/asyncStorageAdapter';
export * from './storage/indexedDBAdapter';
export * from './storage/authService';
export * from './services/apiKeyService';
export * from './services/publicApiService';
export * from './services/exportService';
export * from './hooks/useCoinDB';
export * from './hooks/useAuth';
export * from './hooks/useLocalSync';
export * from './hooks/useSubscription';
export * from './hooks/useSectorRegistry';
