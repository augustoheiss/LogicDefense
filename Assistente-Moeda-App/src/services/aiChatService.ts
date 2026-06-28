/**
 * AI Chat Service — Assistente Moeda
 *
 * Communicates with the backend API for AI-powered financial analysis.
 * Uses the same API contract as the web CoinAssistant.
 *
 * Endpoint: POST ${EXPO_PUBLIC_API_URL}/api/coinassistant/chat
 * Payload: { message, context, history }
 * Response: { response }
 */

import { buildAIScenarioContext } from '../core/aiContextBuilder';
import { formatCurrencyFull } from '../core/formatCurrency';
import type { TableRow, TableGoals, TableMetrics } from '../core/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  response: string;
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
  tokensUsed?: number;
}

// ── API Config ───────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// ── Context Builder ──────────────────────────────────────────────────────────

export function buildFinancialContext(
  rows: TableRow[],
  goals: TableGoals,
  metrics: TableMetrics,
  tableName: string,
): string {
  const lines: string[] = [];
  lines.push(`📋 Tabela: ${tableName}`);
  lines.push(`📊 ${rows.length} entradas registradas`);
  lines.push('');

  // Revenue summary
  lines.push('── RESUMO FINANCEIRO ──');
  lines.push(`Receita Bruta Total: ${formatCurrencyFull(metrics.grossTotal)}`);
  lines.push(`Média Diária: ${formatCurrencyFull(metrics.globalDailyAvg)}`);
  lines.push(`Média Semanal: ${formatCurrencyFull(metrics.globalWeeklyAvg)}`);
  lines.push(`Média Mensal: ${formatCurrencyFull(metrics.globalMonthlyAvg)}`);
  lines.push(`Saldo Líquido: ${formatCurrencyFull(metrics.netBalance)}`);
  lines.push('');

  // Goals
  const currentYear = new Date().getFullYear();
  const weeklyGoal = goals.weeklyGoals?.[currentYear] ?? 0;
  if (weeklyGoal > 0) {
    lines.push('── METAS ──');
    lines.push(`Meta Semanal ${currentYear}: ${formatCurrencyFull(weeklyGoal)}`);
    lines.push(`Saldo Meta: ${formatCurrencyFull(metrics.globalGoalBalance)}`);
    lines.push(`Banco de Tempo: ${metrics.timeBankBalance.toFixed(1)} semanas`);

    // Liquid Math
    const effectiveWeeks = metrics.globalGoalBalance / weeklyGoal;
    lines.push(`Semanas Efetivas (Liquid Math): ${effectiveWeeks.toFixed(2)}`);
    lines.push('');
  }

  // Expenses
  if (metrics.totalExpenses > 0) {
    lines.push('── DESPESAS ──');
    lines.push(`Total Despesas: ${formatCurrencyFull(metrics.totalExpenses)}`);
    lines.push(`Meta Sobrevivência Mensal: ${formatCurrencyFull(metrics.survivalMonthly)}`);
    lines.push('');
  }

  // Investments
  if (metrics.depositCount > 0) {
    lines.push('── INVESTIMENTOS ──');
    lines.push(`Total Investido: ${formatCurrencyFull(metrics.totalInvested)}`);
    lines.push(`Rendimento Acumulado: ${formatCurrencyFull(metrics.totalInterestEarned)}`);
    lines.push(`Saldo Portfólio: ${formatCurrencyFull(metrics.investmentBalance)}`);
    lines.push('');
  }

  // Partners
  if (metrics.totalPartnerIn > 0 || metrics.totalPartnerOut > 0) {
    lines.push('── PARCERIA ──');
    lines.push(`Recebido Sócio: ${formatCurrencyFull(metrics.totalPartnerIn)}`);
    lines.push(`Pago Sócio: ${formatCurrencyFull(metrics.totalPartnerOut)}`);
    lines.push(`Saldo c/ Parceria: ${formatCurrencyFull(metrics.netWithPartner)}`);
    lines.push('');
  }

  // Scenario projections
  const scenarioCtx = buildAIScenarioContext(rows);
  if (scenarioCtx) {
    lines.push(scenarioCtx);
  }

  return lines.join('\n');
}

// ── API Call ──────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  rows: TableRow[],
  goals: TableGoals,
  tableName: string,
  totalWaiverCredits: number,
  asOfDate?: string,
  tables?: any[],
  transactions?: any[],
  userSettings?: any,
): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_URL}/api/coin/ai-analyst`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rows,
        goals,
        userPrompt: message,
        asOfDate: asOfDate || null,
        tableName,
        totalWaiverCredits,
        tables: tables || [],
        transactions: transactions || [],
        userSettings: userSettings || null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { response: '', error: `Erro do servidor: ${response.status} — ${errorText}` };
    }

    const data = await response.json();
    const content = data.content || data.analysis || 'Sem resposta';
    const tokensUsed = data.tokens_used !== undefined ? Number(data.tokens_used) : (data.tokensUsed !== undefined ? Number(data.tokensUsed) : 0);

    const promptTokens = Math.ceil((message.length + JSON.stringify(rows).length + JSON.stringify(goals).length) / 4);
    const completionTokens = Math.ceil(content.length / 4);

    return { 
      response: content,
      promptTokens,
      completionTokens,
      tokensUsed
    };
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        response: '',
        error: 'Servidor de IA indisponível. Verifique se o backend está rodando.',
      };
    }
    return { response: '', error: `Erro: ${error.message}` };
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

export function createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}
