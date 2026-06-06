import { useState, useRef, useCallback } from 'react';
import type { CoinTable } from '../types';
import ReactMarkdown from 'react-markdown';

// ── Types ────────────────────────────────────────────────────────────────────

interface AIAnalystChatProps {
  table: CoinTable;
  cutoffDate?: string;
  totalWaiverCredits: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ── API Config ───────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { emoji: '📊', text: 'Como estou indo este mês?' },
  { emoji: '🎯', text: 'Estou cumprindo minhas metas?' },
  { emoji: '⏰', text: 'Qual é meu saldo no Banco de Tempo?' },
  { emoji: '📈', text: 'Análise completa do meu desempenho' },
  { emoji: '💡', text: 'Quantos dias preciso trabalhar para zerar o débito?' },
  { emoji: '📉', text: 'Compare meu mês atual com o anterior' },
];

// ── Helper: build payload ────────────────────────────────────────────────────

function buildPayload(
  table: CoinTable,
  userPrompt: string,
  totalWaiverCredits: number,
  cutoffDate?: string,
): Record<string, unknown> {
  return {
    rows: table.rows.map((r) => ({
      date: r.date,
      value: r.value,
      description: r.description,
      entryType: r.entryType ?? 'revenue',
      monthlyValue: r.monthlyValue,
      monthCount: r.monthCount,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      generatedBy: r.generatedBy,
      clonedFrom: r.clonedFrom,
    })),
    goals: {
      dailyGoals: table.goals.dailyGoals,
      weeklyGoals: table.goals.weeklyGoals,
      annualCosts: table.goals.annualCosts,
      globalGoals: table.goals.globalGoals,
      yearlyGoals: table.goals.yearlyGoals,
      monthlyGoals: table.goals.monthlyGoals,
    },
    userPrompt: userPrompt,
    asOfDate: cutoffDate || null,
    tableName: table.name,
    totalWaiverCredits: totalWaiverCredits,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function AIAnalystChat({ table, cutoffDate, totalWaiverCredits }: AIAnalystChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }, []);

  const sendMessage = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);
    setIsExpanded(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const payload = buildPayload(table, prompt.trim(), totalWaiverCredits, cutoffDate);
      const response = await fetch(`${API_BASE}/api/coin/ai-analyst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.detail || `Erro ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.analysis,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [table, cutoffDate, isLoading]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  const handleSuggestedPrompt = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col rounded-xl border border-[#a855f7]/30 bg-gradient-to-b from-[#a855f7]/5 to-transparent overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="text-lg">🤖</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0d1117]" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-white">Assistente Moeda IA</span>
            <span className="text-xs text-white/30 ml-2">Analista financeiro pessoal</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-xs text-white/20">
              {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Expandable body ── */}
      {isExpanded && (
        <div className="border-t border-white/10">
          {/* Messages area */}
          <div className="px-4 py-3 space-y-3">
            {/* Empty state with suggestions */}
            {messages.length === 0 && !isLoading && (
              <div className="py-4 space-y-3">
                <p className="text-xs text-white/30 text-center">
                  Pergunte qualquer coisa sobre suas finanças — eu analiso os dados em tempo real.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SUGGESTED_PROMPTS.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => handleSuggestedPrompt(s.text)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-left text-white/50 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/15 rounded-lg transition-all"
                    >
                      <span>{s.emoji}</span>
                      <span className="line-clamp-1">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                      ? 'bg-[#a855f7]/20 text-white/90 border border-[#a855f7]/30 rounded-br-sm'
                      : 'bg-white/[0.04] text-white/80 border border-white/10 rounded-bl-sm'
                    }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:text-white/75 [&_li]:text-white/75 [&_strong]:text-white [&_hr]:border-white/10 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_p]:my-1.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                  <div className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/20 text-right' : 'text-white/15'}`}>
                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/10 rounded-xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-white/30">Analisando seus dados...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <span className="text-sm shrink-0">⚠️</span>
                <div className="flex-1">
                  <span className="text-xs text-red-400">{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400/50 hover:text-red-400 text-sm leading-none"
                >
                  ×
                </button>
              </div>
            )}


          </div>

          {/* ── Input area ── */}
          <div className="border-t border-white/10 px-3 py-2.5">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre suas finanças..."
                disabled={isLoading}
                rows={1}
                className="flex-1 bg-white/[0.05] text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#a855f7]/50 border border-white/10 placeholder:text-white/20 resize-none disabled:opacity-40 transition-all"
                style={{ maxHeight: '120px' }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#a855f7] hover:bg-[#9333ea] disabled:bg-white/10 disabled:text-white/20 text-white transition-colors"
                aria-label="Enviar"
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[10px] text-white/15">
                {table.rows.length} registros • Shift+Enter para nova linha
              </span>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
                >
                  Limpar conversa
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
