/**
 * API Configuration — Assistente Moeda
 *
 * Backend API base URL for the AI Analyst and other backend services.
 * Uses the same FastAPI backend as the web version — no changes needed.
 */

export const API_BASE = process.env.EXPO_PUBLIC_AI_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'https://ocorrencias-pdf-writer.onrender.com';

/**
 * AI Analyst endpoint — POST /api/coin/ai-analyst
 * Receives rows + goals + userPrompt, returns AI analysis.
 */
export const AI_ANALYST_ENDPOINT = `${API_BASE}/api/coin/ai-analyst`;
