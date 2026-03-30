import { useState } from 'react';
import type { CoinTable, TableMetrics } from '../types';

interface WhatsAppExporterProps {
  table: CoinTable;
  metrics: TableMetrics;
  onClose: () => void;
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildMessage(table: CoinTable, metrics: TableMetrics): string {
  const sortedMonths = Object.keys(metrics.byMonth).sort().reverse();
  const latestYM = sortedMonths[0];
  const latestMonth = latestYM ? metrics.byMonth[latestYM] : null;

  function formatMonth(ym: string): string {
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  const lines: string[] = [
    `📊 *Relatório Financeiro — ${table.name}*`,
    table.description ? `_${table.description}_` : '',
    '',
    `📅 *Totais Globais*`,
    `• Total Bruto: *${fmt(metrics.grossTotal)}*`,
    `• Média Diária: ${fmt(metrics.globalDailyAvg)}`,
    `• Média Semanal: ${fmt(metrics.globalWeeklyAvg)}`,
    `• Média Mensal: ${fmt(metrics.globalMonthlyAvg)}`,
    `• Média Anual: ${fmt(metrics.globalAnnualAvg)}`,
    '',
  ];

  if (latestMonth && latestYM) {
    lines.push(
      `📆 *${formatMonth(latestYM)}*`,
      `• Bruto: *${fmt(latestMonth.grossMonthly)}*`,
      `• Média Diária: ${fmt(latestMonth.dailyAvg)}`,
      `• Média Semanal: ${fmt(latestMonth.weeklyAvg)}`,
      `• Última Semana: ${fmt(latestMonth.lastWeekGross)}`,
      '',
    );
  }

  const goalDailyPct =
    metrics.globalDailyAvg > 0
      ? ((metrics.globalDailyAvg / table.goals.dailyGoal) * 100).toFixed(1)
      : '0.0';
  const annualPct =
    metrics.grossTotal > 0
      ? ((metrics.grossTotal / table.goals.annualCost) * 100).toFixed(1)
      : '0.0';

  lines.push(
    `🎯 *Metas*`,
    `• Meta Diária (${fmt(table.goals.dailyGoal)}): ${goalDailyPct}% atingida`,
    `• Custo Anual (${fmt(table.goals.annualCost)}): ${annualPct}% coberto`,
    '',
    `_Gerado pelo Assistente Moeda · LogicDefense_`,
  );

  return lines.filter((l) => l !== undefined).join('\n');
}

export function WhatsAppExporter({ table, metrics, onClose }: WhatsAppExporterProps) {
  const [phone, setPhone] = useState('');
  const message = buildMessage(table, metrics);

  function handleSend() {
    const cleaned = phone.replace(/\D/g, '');
    const full = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    const url = `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <h2 className="text-lg font-semibold text-white">Exportar para WhatsApp</h2>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            Pré-visualização da mensagem
          </label>
          <pre className="bg-[#0d1117] border border-white/10 rounded-lg px-4 py-3 text-xs text-white/70 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
            {message}
          </pre>
        </div>

        {/* Phone input */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">
            Número de telefone
          </label>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-white/40 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              +55
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="flex-1 bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#25D366] border border-white/10"
            />
          </div>
          <p className="text-xs text-white/30">
            Deixe em branco para abrir sem destinatário definido (você escolhe no WhatsApp).
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Abrir no WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
