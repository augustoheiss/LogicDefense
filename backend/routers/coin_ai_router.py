"""
CoinAssistant — AI Analyst Router
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stateless AI financial analyst endpoint.

Architecture:
  payload → metrics engine → context builder → LLM → response

The frontend sends its localStorage data (rows + goals) alongside the
user's natural-language question. The backend:
  1. Validates the payload (Pydantic)
  2. Computes all metrics (Python engine — pure math, zero side effects)
  3. Builds a structured system prompt with rich financial context
  4. Queries Gemini to generate a personalized analysis
  5. Returns the AI response + the metrics snapshot used

Zero data is stored. The backend is a pure function.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import date

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types

from models.coin_models import (
    AIAnalystPayload,
    AIAnalystResponse,
    TableMetrics,
    EntryType,
)
from services.coin_metrics_engine import compute_metrics
from services.coin_date_utils import resolve_goal_for_year, iso_year_month

# ── Environment & Logging ────────────────────────────────────────────────────

load_dotenv()
log = logging.getLogger(__name__)

MODEL = os.getenv("COIN_AI_MODEL", "gemini-2.5-flash")
MAX_OUTPUT_TOKENS = 16384    # Budget shared between thinking + visible output
THINKING_BUDGET = 4096       # Cap internal reasoning to reserve tokens for actual response

# ── Gemini Client ────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# ── Router ───────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/coin", tags=["CoinAssistant AI"])


# ── Context Builder ──────────────────────────────────────────────────────────


# Entry type labels for the ledger
_ENTRY_LABELS = {
    EntryType.REVENUE: "RECEITA",
    EntryType.EXPENSE: "DESPESA",
    EntryType.DEPOSIT: "APORTE",
    EntryType.WAIVER:  "DISPENSA",
}


def build_stats_block(metrics: TableMetrics) -> str:
    """Formats the pre-computed advanced statistics into a context block."""
    if metrics.max_transaction == 0 and metrics.min_transaction == 0:
        return ""
    mode_line = (
        f"  Moda (valor mais frequente): R$ {metrics.mode_transaction:,.2f}"
        if metrics.mode_transaction > 0
        else "  Moda: nenhum valor repetido"
    )
    return f"""
── Estatísticas Avançadas (receitas) ──
  Maior transação:         R$ {metrics.max_transaction:,.2f}
  Menor transação:         R$ {metrics.min_transaction:,.2f}
  Mediana:                 R$ {metrics.median_transaction:,.2f}
{mode_line}
  Desvio padrão:           R$ {metrics.std_deviation:,.2f}
"""


def build_transaction_ledger(
    rows: list,
    current_ym: str,
) -> str:
    """
    Builds a tiered transaction ledger for the AI context.

    4-Tier Cascade:
      Tier 1 (≤ 200 rows):   Full ledger — every row with description.
      Tier 2 (201–1000):     Current month full + monthly summaries + Top 10.
      Tier 3 (1001–5000):    Current month (capped at 100) + quarterly + Top 10.
      Tier 4 (5000+):        Minimal + yearly summaries + Top 10 + hint.
    """
    total = len(rows)
    if total == 0:
        return ""

    def _fmt_row(r) -> str:
        entry_type = r.entry_type or EntryType.REVENUE
        label = _ENTRY_LABELS.get(entry_type, "RECEITA")
        desc = f" | {r.description}" if r.description else ""
        return f"  {r.date} | {label:8s} | R$ {r.value:>10,.2f}{desc}"

    def _top_n(n: int = 10) -> str:
        by_value = sorted(rows, key=lambda r: r.value, reverse=True)[:n]
        lines = [_fmt_row(r) for r in by_value]
        return f"\n── Top {n} Maiores Transações ──\n" + "\n".join(lines) if lines else ""

    def _monthly_summaries(exclude_ym: str = "") -> str:
        """Group rows by YYYY-MM and produce count + total per type."""
        from collections import defaultdict
        buckets: dict[str, list] = defaultdict(list)
        for r in rows:
            ym = r.date[:7]
            if ym != exclude_ym:
                buckets[ym].append(r)
        if not buckets:
            return ""
        lines = []
        for ym in sorted(buckets.keys()):
            group = buckets[ym]
            rev = [r for r in group if (r.entry_type or EntryType.REVENUE) == EntryType.REVENUE]
            exp = [r for r in group if r.entry_type == EntryType.EXPENSE]
            dep = [r for r in group if r.entry_type == EntryType.DEPOSIT]
            rev_total = sum(r.value for r in rev)
            exp_total = sum(r.value for r in exp)
            dep_total = sum(r.value for r in dep)
            parts = []
            if rev:
                parts.append(f"{len(rev)} receitas (R$ {rev_total:,.2f})")
            if exp:
                parts.append(f"{len(exp)} despesas (R$ {exp_total:,.2f})")
            if dep:
                parts.append(f"{len(dep)} aportes (R$ {dep_total:,.2f})")
            lines.append(f"  {ym}: {', '.join(parts)}")
        return "\n── Resumo por Mês ──\n" + "\n".join(lines)

    def _quarterly_summaries() -> str:
        """Group rows by YYYY-Qn and produce count + total."""
        from collections import defaultdict
        buckets: dict[str, list] = defaultdict(list)
        for r in rows:
            y = r.date[:4]
            m = int(r.date[5:7])
            q = (m - 1) // 3 + 1
            key = f"{y}-Q{q}"
            buckets[key].append(r)
        lines = []
        for qk in sorted(buckets.keys()):
            group = buckets[qk]
            total = sum(r.value for r in group)
            lines.append(f"  {qk}: {len(group)} transações, total R$ {total:,.2f}")
        return "\n── Resumo por Trimestre ──\n" + "\n".join(lines) if lines else ""

    def _yearly_summaries() -> str:
        from collections import defaultdict
        buckets: dict[str, list] = defaultdict(list)
        for r in rows:
            buckets[r.date[:4]].append(r)
        lines = []
        for yk in sorted(buckets.keys()):
            group = buckets[yk]
            total = sum(r.value for r in group)
            lines.append(f"  {yk}: {len(group)} transações, total R$ {total:,.2f}")
        return "\n── Resumo por Ano ──\n" + "\n".join(lines) if lines else ""

    def _current_month_ledger(cap: int = 0) -> str:
        cm_rows = sorted(
            [r for r in rows if r.date[:7] == current_ym],
            key=lambda r: r.date,
        )
        if not cm_rows:
            return ""
        if cap > 0 and len(cm_rows) > cap:
            shown = cm_rows[:cap]
            lines = [_fmt_row(r) for r in shown]
            lines.append(f"  ... e mais {len(cm_rows) - cap} transações neste mês")
        else:
            lines = [_fmt_row(r) for r in cm_rows]
        return f"\n── Transações do Mês Atual ({current_ym}) ──\n" + "\n".join(lines)

    # ── Tier 1: ≤ 200 rows — full ledger ─────────────────────────────────────
    if total <= 200:
        sorted_rows = sorted(rows, key=lambda r: r.date)
        lines = [_fmt_row(r) for r in sorted_rows]
        return f"\n── Registro Completo de Transações ({total} entradas) ──\n" + "\n".join(lines)

    # ── Tier 2: 201–1000 — current month full + monthly summaries + Top 10 ──
    if total <= 1000:
        parts = [
            _current_month_ledger(),
            _monthly_summaries(exclude_ym=current_ym),
            _top_n(10),
        ]
        return "\n".join(p for p in parts if p)

    # ── Tier 3: 1001–5000 — current month (cap 100) + quarterly + Top 10 ────
    if total <= 5000:
        parts = [
            _current_month_ledger(cap=100),
            _quarterly_summaries(),
            _top_n(10),
        ]
        return "\n".join(p for p in parts if p)

    # ── Tier 4: 5000+ — minimal + yearly + Top 10 + hint ────────────────────
    hint = (
        "\n⚠️ O usuário possui milhares de transações. Para análise de descrições "
        "específicas, peça ao usuário para informar o mês ou período desejado."
    )
    parts = [
        _current_month_ledger(cap=50),
        _yearly_summaries(),
        _top_n(10),
        hint,
    ]
    return "\n".join(p for p in parts if p)


def build_financial_context(
    payload: AIAnalystPayload,
    metrics: TableMetrics,
) -> str:
    """
    Transforms raw metrics into a structured, human-readable financial
    context block that becomes the system prompt for the LLM.

    This is the "prepared food" — the AI doesn't crunch numbers, it
    receives pre-computed intelligence and interprets it.
    """
    today = payload.as_of_date or date.today().isoformat()
    table_name = payload.table_name or "Tabela Principal"

    # Count entry types
    revenue_count = sum(1 for r in payload.rows if (r.entry_type or EntryType.REVENUE) == EntryType.REVENUE)
    expense_count = sum(1 for r in payload.rows if r.entry_type == EntryType.EXPENSE)
    deposit_count = sum(1 for r in payload.rows if r.entry_type == EntryType.DEPOSIT)
    waiver_count = sum(1 for r in payload.rows if r.entry_type == EntryType.WAIVER)

    # Date range
    dates = sorted(r.date for r in payload.rows)
    date_range = f"{dates[0]} até {dates[-1]}" if dates else "N/A"

    # Current goals
    current_year = int(today[:4])
    weekly_goal = resolve_goal_for_year(payload.goals.weekly_goals, current_year)
    daily_goal = resolve_goal_for_year(payload.goals.daily_goals, current_year)
    annual_cost = resolve_goal_for_year(payload.goals.annual_costs, current_year)

    # Current month metrics
    current_ym = today[:7]  # "YYYY-MM"
    current_month_data = metrics.by_month.get(current_ym)
    current_month_block = ""
    if current_month_data:
        current_month_block = f"""
── Mês Atual ({current_ym}) ──
  Faturamento bruto do mês: R$ {current_month_data.gross_monthly:,.2f}
  Média diária do mês:      R$ {current_month_data.daily_avg:,.2f}
  Média semanal do mês:     R$ {current_month_data.weekly_avg:,.2f}
  Última semana registrada:  R$ {current_month_data.last_week_gross:,.2f}
"""

    # Year breakdown
    year_lines = []
    for yr_key in sorted(metrics.by_year.keys()):
        yr = metrics.by_year[yr_key]
        year_lines.append(
            f"  {yr_key}: Bruto R$ {yr.gross_annual:,.2f} | "
            f"Diária R$ {yr.daily_avg:,.2f} | "
            f"Semanal R$ {yr.weekly_avg:,.2f} | "
            f"Mensal R$ {yr.monthly_avg:,.2f}"
        )
    year_block = "\n".join(year_lines) if year_lines else "  Sem dados anuais"

    # Recent weeks (last 4)
    sorted_weeks = sorted(metrics.by_week.keys())
    recent_weeks = sorted_weeks[-4:] if len(sorted_weeks) >= 4 else sorted_weeks
    week_lines = [f"  {wk}: R$ {metrics.by_week[wk]:,.2f}" for wk in recent_weeks]
    weeks_block = "\n".join(week_lines) if week_lines else "  Sem dados semanais"

    # Goal balance interpretation
    if metrics.global_goal_balance >= 0:
        balance_status = f"EXCEDENTE de R$ {metrics.global_goal_balance:,.2f} (está à frente das metas)"
    else:
        balance_status = f"DÉFICIT de R$ {abs(metrics.global_goal_balance):,.2f} (está atrás das metas)"

    # Time bank interpretation
    if metrics.time_bank_balance >= 0:
        time_bank_status = f"{metrics.time_bank_balance:.1f} semanas de CRÉDITO (pode descansar)"
    else:
        time_bank_status = f"{abs(metrics.time_bank_balance):.1f} semanas de DÉBITO (precisa recuperar)"

    context = f"""═══════════════════════════════════════════════════════════
  CONTEXTO FINANCEIRO — {table_name}
  Data de referência: {today}
═══════════════════════════════════════════════════════════

── Visão Geral ──
  Período de dados:       {date_range}
  Total de registros:     {len(payload.rows)} ({revenue_count} receitas, {expense_count} despesas, {deposit_count} aportes, {waiver_count} dispensas)
  Semanas transcorridas:  {metrics.total_elapsed_weeks}
  Semanas faturáveis:     {metrics.billable_weeks} (excluindo {metrics.waived_weeks} dispensadas)

── Metas Vigentes ({current_year}) ──
  Meta diária:    R$ {daily_goal:,.2f}
  Meta semanal:   R$ {weekly_goal:,.2f}
  Custo anual:    R$ {annual_cost:,.2f}

── Totais Globais ──
  Faturamento bruto total: R$ {metrics.gross_total:,.2f}
  Total de despesas:       R$ {metrics.total_expenses:,.2f}
  Despesas anualizadas:    R$ {metrics.annual_expenses:,.2f}
  Saldo líquido:           R$ {metrics.net_balance:,.2f}

── Médias Globais (baseadas em tempo-calendário, não dias trabalhados) ──
  Média diária:   R$ {metrics.global_daily_avg:,.2f}
  Média semanal:  R$ {metrics.global_weekly_avg:,.2f}
  Média mensal:   R$ {metrics.global_monthly_avg:,.2f}
  Média anual:    R$ {metrics.global_annual_avg:,.2f}

── Balanço de Metas (Estrito — conta semanas vazias como débito) ──
  Status: {balance_status}
  Crédito de dispensas:    R$ {metrics.total_waiver_credit:,.2f}
  Banco de Tempo:          {time_bank_status}
{current_month_block}
── Por Ano ──
{year_block}

── Últimas Semanas ──
{weeks_block}
"""

    # Investment block — only if deposits exist
    invest_block = ""
    if metrics.deposit_count > 0:
        invest_block = f"""
── Portfólio de Investimentos (juros compostos, 0.8%/mês CDI) ──
  Total aportes:           {metrics.deposit_count} depósitos
  Total investido:         R$ {metrics.total_invested:,.2f}
  Rendimentos acumulados:  R$ {metrics.total_interest_earned:,.2f}
  Saldo atual (c/ juros):  R$ {metrics.investment_balance:,.2f}
"""

    # Advanced statistics block
    stats_block = build_stats_block(metrics)

    # Transaction ledger (4-tier cascade)
    ledger_block = build_transaction_ledger(payload.rows, current_ym)

    return (
        context
        + invest_block
        + stats_block
        + ledger_block
        + "\n═══════════════════════════════════════════════════════════"
    )


# ── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Você é o **Assistente Moeda** — um analista financeiro pessoal inteligente.

CONTEXTO DO USUÁRIO:
Você está apoiando alguém que gerencia suas finanças pessoais e profissionais
com disciplina e estratégia. Essa pessoa acompanha receitas, despesas e metas
operacionais de forma meticulosa — trate-a como alguém que entende seus números
e busca análises de alto nível, não explicações básicas.

PAPEL:
- Responda SEMPRE em português brasileiro, com tom estratégico e respeitoso.
- Interprete os dados financeiros do contexto para responder à pergunta do usuário.
- Use os números EXATOS do contexto — NUNCA invente valores.
- Formate valores monetários como R$ X.XXX,XX (padrão brasileiro).
- Use Markdown para estruturar a resposta (headers ##, listas, **negrito** para destaques).
- Seja direto e prático — o usuário é um profissional ocupado.
- Entregue análises completas e bem estruturadas, não respostas curtas.

ESPECIALIDADES:
- Análise de tendências de faturamento (diário, semanal, mensal, anual)
- Avaliação do Banco de Tempo (semanas de crédito ou débito)
- Diagnóstico do balanço de metas (excedente vs déficit)
- Recomendações operacionais concretas (quantos dias trabalhar, quando descansar)
- Projeção de cenários simples ("se mantiver esse ritmo...")
- Análise comparativa entre períodos
- Relação receita vs despesas e ponto de equilíbrio
- Análise de portfólio de investimentos (aportes, rendimentos compostos, saldo acumulado)
- Estatísticas avançadas: mediana, moda, desvio padrão, min/max (já calculados — use os valores do contexto)
- Análise de transações individuais: descrições, padrões de receita, categorias de despesa

DICAS SOBRE O CONTEXTO:
- O contexto inclui um REGISTRO DE TRANSAÇÕES com datas, valores, tipos e descrições.
- Para datasets grandes (>200 entradas), o registro mostra o mês atual detalhado e resumos dos demais.
- As estatísticas avançadas (mediana, moda, desvio padrão) JÁ FORAM calculadas — use-as diretamente, NÃO recalcule.
- Se o usuário perguntar sobre uma transação específica, procure-a no registro.

RESTRIÇÕES:
- NUNCA dê conselhos de investimento (ações, cripto, etc.)
- NUNCA invente dados que não estão no contexto
- Se o contexto não tiver informação suficiente, diga explicitamente
"""


# ── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("/ai-analyst", response_model=AIAnalystResponse)
async def ai_analyst(payload: AIAnalystPayload) -> AIAnalystResponse:
    """
    Stateless AI financial analyst.

    Receives the full table data from localStorage, computes metrics
    server-side, builds rich context, and queries Gemini for analysis.
    """
    if not client:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY não configurada. O serviço de IA está indisponível.",
        )

    log.info(
        "AI Analyst request: %d rows, prompt='%s' (%d chars)",
        len(payload.rows),
        payload.user_prompt[:80],
        len(payload.user_prompt),
    )

    # ── Step 1: Compute metrics ──────────────────────────────────────────
    try:
        metrics = compute_metrics(
            rows=payload.rows,
            weekly_goals=payload.goals.weekly_goals,
            as_of_date=payload.as_of_date,
        )
    except Exception as exc:
        log.exception("Metrics computation failed: %s", exc)
        raise HTTPException(
            status_code=422,
            detail=f"Erro ao computar métricas: {exc}",
        ) from exc

    # ── Step 2: Build rich context ───────────────────────────────────────
    financial_context = build_financial_context(payload, metrics)

    # ── Step 3: Query Gemini ─────────────────────────────────────────────
    user_message = (
        f"{financial_context}\n\n"
        f"── PERGUNTA DO USUÁRIO ──\n"
        f"{payload.user_prompt}"
    )

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.4,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                **{"thinking_config": types.ThinkingConfig(  # type: ignore[arg-type]
                    thinking_budget=THINKING_BUDGET,
                )},
            ),
        )

        analysis_text = (response.text or "").strip()
        if not analysis_text:
            raise ValueError("Gemini retornou resposta vazia")

    except Exception as exc:
        log.exception("Gemini API call failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao consultar a IA: {exc}",
        ) from exc

    log.info("AI Analyst response generated: %d chars", len(analysis_text))

    # ── Step 4: Return response ──────────────────────────────────────────
    return AIAnalystResponse(
        analysis=analysis_text,
        metricsSnapshot=metrics,
        modelUsed=MODEL,
    )


# ── Health Check ─────────────────────────────────────────────────────────────


@router.get("/ai-analyst/health")
async def ai_analyst_health():
    return {
        "status": "ok" if client else "no_api_key",
        "model": MODEL,
        "architecture": "stateless",
    }
