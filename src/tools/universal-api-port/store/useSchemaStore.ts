/**
 * Zustand store — Global state for the Universal API Port.
 * Holds the parsed schema, selected endpoint, execution history,
 * and authentication configuration.
 */

import { create } from 'zustand';
import type { OpenApiDocument, ParsedEndpoint } from '../types/openapi';
import { parseOpenApiDocument, extractTags } from '../core/schemaParser';
import { validateSchema, type ValidationResult } from '../core/schemaValidator';
import type { ExecutionResult } from '../core/apiExecutor';

interface SchemaState {
  /* ── Schema data ─────────────────────────────── */
  rawDocument: OpenApiDocument | null;
  endpoints: ParsedEndpoint[];
  tags: string[];
  activeTag: string | null;
  selectedEndpoint: ParsedEndpoint | null;
  validationResult: ValidationResult | null;

  /* ── Connection config ───────────────────────── */
  baseUrl: string;
  apiKey: string;
  authHeaderName: string;

  /* ── Execution trace (Transparência Total) ───── */
  executionHistory: ExecutionResult[];
  isExecuting: boolean;

  /* ── Actions ─────────────────────────────────── */
  loadSchema: (doc: OpenApiDocument) => void;
  clearSchema: () => void;
  setActiveTag: (tag: string | null) => void;
  selectEndpoint: (endpoint: ParsedEndpoint | null) => void;
  setBaseUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setAuthHeaderName: (name: string) => void;
  pushExecution: (result: ExecutionResult) => void;
  clearHistory: () => void;
  setIsExecuting: (val: boolean) => void;
}

export const useSchemaStore = create<SchemaState>((set) => ({
  rawDocument: null,
  endpoints: [],
  tags: [],
  activeTag: null,
  selectedEndpoint: null,
  validationResult: null,
  baseUrl: '',
  apiKey: '',
  authHeaderName: 'Authorization',
  executionHistory: [],
  isExecuting: false,

  loadSchema: (doc) => {
    const endpoints = parseOpenApiDocument(doc);
    const tags = extractTags(doc);
    const baseUrl = doc.servers?.[0]?.url ?? '';
    const validationResult = validateSchema(doc);
    set({
      rawDocument: doc,
      endpoints,
      tags,
      activeTag: tags[0] ?? null,
      selectedEndpoint: null,
      baseUrl,
      validationResult,
      executionHistory: [],
    });
  },

  clearSchema: () =>
    set({
      rawDocument: null,
      endpoints: [],
      tags: [],
      activeTag: null,
      selectedEndpoint: null,
      baseUrl: '',
      validationResult: null,
      executionHistory: [],
    }),

  setActiveTag: (tag) => set({ activeTag: tag, selectedEndpoint: null }),
  selectEndpoint: (endpoint) => set({ selectedEndpoint: endpoint }),
  setBaseUrl: (url) => set({ baseUrl: url }),
  setApiKey: (key) => set({ apiKey: key }),
  setAuthHeaderName: (name) => set({ authHeaderName: name }),
  pushExecution: (result) =>
    set((s) => ({ executionHistory: [result, ...s.executionHistory].slice(0, 50) })),
  clearHistory: () => set({ executionHistory: [] }),
  setIsExecuting: (val) => set({ isExecuting: val }),
}));
