import math
import logging
from collections import defaultdict
from statistics import median as stat_median
from datetime import date, timedelta, datetime
from typing import Any, Optional

from models.coin_models import TableRow, TableGoals, TableMetrics, EntryType, AIAnalystPayload
from services.coin_metrics_engine import row_contributions
from services.coin_date_utils import (
    get_effective_goals,
    _parse_date,
    _to_local_key,
    _get_monday_of,
    get_weekly_goal_for_date,
    fmt_date,
    _calendar_day_span,
)

log = logging.getLogger(__name__)

# Entry type labels for the ledger
_ENTRY_LABELS = {
    EntryType.REVENUE: "RECEITA",
    EntryType.EXPENSE: "DESPESA",
    EntryType.DEPOSIT: "APORTE",
    EntryType.WAIVER:      "JUSTIFICATIVA",
    EntryType.PARTNER_IN:  "CRÉDITO PARCERIA",
    EntryType.PARTNER_OUT: "DÉBITO PARCERIA",
}

_TYPE_SECTION_LABELS = {
    EntryType.REVENUE:     "Receitas",
    EntryType.EXPENSE:     "Despesas",
    EntryType.DEPOSIT:     "Aportes",
    EntryType.WAIVER:      "Justificativas",
    EntryType.PARTNER_IN:  "Créditos de Parceria",
    EntryType.PARTNER_OUT: "Débitos de Parceria",
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
        period_info = ""
        period_start = getattr(r, "period_start", None) or getattr(r, "periodStart", None)
        period_end = getattr(r, "period_end", None) or getattr(r, "periodEnd", None)
        if period_start and period_end:
            period_info = f" (Vigência: {period_start} a {period_end})"
        return f"  {r.date} | {label:8s} | R$ {r.value:>10,.2f}{desc}{period_info}"

    def _top_n(n: int = 10) -> str:
        by_value = sorted(rows, key=lambda r: r.value, reverse=True)[:n]
        lines = [_fmt_row(r) for r in by_value]
        return f"\n── Top {n} Maiores Transações ──\n" + "\n".join(lines) if lines else ""

    def _monthly_summaries(exclude_ym: str = "") -> str:
        """Group rows by YYYY-MM and produce count + total per type."""
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
            neu = [r for r in group if r.entry_type == EntryType.PARTNER_IN]
            if neu:
                parts.append(f"{len(neu)} créd.parceria (R$ {sum(r.value for r in neu):,.2f})")
            deb = [r for r in group if r.entry_type == EntryType.PARTNER_OUT]
            if deb:
                parts.append(f"{len(deb)} déb.parceria (R$ {sum(r.value for r in deb):,.2f})")
            lines.append(f"  {ym}: {', '.join(parts)}")
        return "\n── Resumo por Mês ──\n" + "\n".join(lines)

    def _quarterly_summaries() -> str:
        """Group rows by YYYY-Qn and produce count + total."""
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

def _global_day_span(rows: list) -> int:
    """Inclusive day count between earliest and latest row dates."""
    dates = sorted(r.date for r in rows if r.date)
    if len(dates) < 2:
        return 1
    d0 = datetime.strptime(dates[0], "%Y-%m-%d")
    d1 = datetime.strptime(dates[-1], "%Y-%m-%d")
    return max(1, (d1 - d0).days + 1)

def build_category_summaries(rows: list, globalDaySpan: int = 1) -> str:
    """
    Groups all rows by (entry_type, description) and computes advanced
    category-level statistics for the AI context.

    For each category: count, total, mean, max, min, median, stddev,
    daily_avg (global span), weekly_avg, and percentage of type total.
    """
    if not rows:
        return ""

    # Group by entry type first, then by description
    type_buckets: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        entry_type = r.entry_type or EntryType.REVENUE
        desc = (r.description or "SEM DESCRIÇÃO").upper().strip()
        type_buckets[entry_type][desc].append(r)

    sections: list[str] = []

    for entry_type in [EntryType.REVENUE, EntryType.EXPENSE, EntryType.DEPOSIT,
                       EntryType.PARTNER_IN, EntryType.PARTNER_OUT, EntryType.WAIVER]:
        cats = type_buckets.get(entry_type, {})
        if not cats:
            continue

        section_label = _TYPE_SECTION_LABELS.get(entry_type, str(entry_type))
        all_values = [r.value for desc_rows in cats.values() for r in desc_rows]
        type_total = sum(all_values)
        n_categories = len(cats)

        lines: list[str] = [f"\n── {section_label} por Categoria ({n_categories} categorias, total R$ {type_total:,.2f}) ──"]

        # Sort by total descending
        sorted_cats = sorted(cats.items(), key=lambda kv: sum(r.value for r in kv[1]), reverse=True)

        for desc, cat_rows in sorted_cats:
            values = [r.value for r in cat_rows]
            count = len(values)
            total = sum(values)
            mean = total / count if count > 0 else 0
            cat_max = max(values) if values else 0
            cat_min = min(values) if values else 0
            cat_median = stat_median(values) if values else 0
            variance = sum((v - mean) ** 2 for v in values) / count if count > 0 else 0
            cat_stddev = math.sqrt(variance)
            total_daily_rate = 0.0
            for r in cat_rows:
                period_start = getattr(r, "period_start", None) or getattr(r, "periodStart", None)
                period_end = getattr(r, "period_end", None) or getattr(r, "periodEnd", None)
                val = getattr(r, "value", 0.0)
                if period_start and period_end:
                    tx_days = max(1, _calendar_day_span(period_start, period_end))
                    total_daily_rate += (val / tx_days)
                else:
                    total_daily_rate += (val / globalDaySpan) if globalDaySpan > 0 else 0

            daily_avg = total_daily_rate
            weekly_avg = total_daily_rate * 7
            pct = (total / type_total * 100) if type_total > 0 else 0

            # Check if any transaction in this category has period boundaries
            has_any_period = any(
                (getattr(r, "period_start", None) or getattr(r, "periodStart", None)) and
                (getattr(r, "period_end", None) or getattr(r, "periodEnd", None))
                for r in cat_rows
            )
            period_note = " [Calculado pelo Regime de Competência estrito com base nos períodos de vigência individuais]" if has_any_period else ""

            lines.append(
                f"  {desc} ({count}x): "
                f"Total R$ {total:,.2f} | "
                f"Média R$ {mean:,.2f} | "
                f"Max R$ {cat_max:,.2f} | "
                f"Min R$ {cat_min:,.2f} | "
                f"Mediana R$ {cat_median:,.2f} | "
                f"DP R$ {cat_stddev:,.2f} | "
                f"Diária R$ {daily_avg:,.2f} | "
                f"Semanal R$ {weekly_avg:,.2f} | "
                f"{pct:.1f}%{period_note}"
            )

        sections.append("\n".join(lines))

    header = (
        "\n── RESUMOS POR CATEGORIA (Regime de Competência / Accrual Basis) ──\n"
        "NOTA: Os cálculos de média diária e semanal por categoria são calculados no Regime de Competência.\n"
        "Se uma transação de despesa ou receita possui período de vigência explícito (period_start / period_end),\n"
        "a média diária correspondente a ela é (valor_da_transacao / dias_de_vigencia_da_transacao).\n"
        "Caso contrário, a transação é rateada uniformemente por todo o período global (fallback).\n"
    )
    return header + "\n".join(sections) if sections else ""

def format_month_year_pt(ym: str) -> str:
    parts = ym.split("-")
    if len(parts) != 2:
        return ym
    y, m = parts
    month_names = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    try:
        month_idx = int(m) - 1
        if 0 <= month_idx < 12:
            return f"{month_names[month_idx]}/{y}"
    except ValueError:
        pass
    return ym

def format_short_month_year_pt(ym: str) -> str:
    parts = ym.split("-")
    if len(parts) != 2:
        return ym
    y, m = parts
    short_months = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ]
    try:
        month_idx = int(m) - 1
        if 0 <= month_idx < 12:
            return f"{short_months[month_idx]}/{y}"
    except ValueError:
        pass
    return ym

def build_ai_scenario_context(rows: list[TableRow]) -> str:
    synthetic_rows = [r for r in rows if r.generated_by is not None]
    if not synthetic_rows:
        return ""

    # Group by YYYY-MM
    groups = defaultdict(list)
    for r in synthetic_rows:
        ym = r.date[:7]
        groups[ym].append(r)

    sorted_months = sorted(groups.keys())
    lines = ["🔮 CENÁRIOS PROJETADOS:"]

    for ym in sorted_months:
        group_rows = groups[ym]

        # Determine generation type
        has_predicted = any(r.generated_by == "predicted" for r in group_rows)
        has_cloned = any(r.generated_by == "cloned" for r in group_rows)

        if has_predicted and has_cloned:
            type_label = "Misto"
        elif has_predicted:
            type_label = "Previsão Estatística"
        elif has_cloned:
            first_cloned = next((r for r in group_rows if r.generated_by == "cloned"), None)
            cloned_from = first_cloned.cloned_from if first_cloned else None
            if cloned_from:
                type_label = f"Clonagem de {format_short_month_year_pt(cloned_from)}"
            else:
                type_label = "Clonagem"
        else:
            type_label = "Projeção"

        # Compute metrics
        revenue = sum(
            r.value for r in group_rows
            if r.entry_type not in (EntryType.EXPENSE, EntryType.DEPOSIT, EntryType.WAIVER, EntryType.PARTNER_IN, EntryType.PARTNER_OUT)
        )

        expenses = sum(
            r.value for r in group_rows
            if r.entry_type == EntryType.EXPENSE
        )

        net = revenue - expenses

        def fmt(v: float) -> str:
            if v.is_integer():
                formatted = f"{int(v):,}".replace(",", ".")
                return f"R$ {formatted}"
            return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

        month_label = format_month_year_pt(ym)
        lines.append(
            f"- {month_label} ({type_label}): Receita {fmt(revenue)} | Custos: {fmt(expenses)} | Saldo: {fmt(net)}"
        )

    return "\n" + "\n".join(lines)

def build_weekly_performance_context(
    payload: AIAnalystPayload,
    metrics: TableMetrics,
) -> str:
    """
    Builds the weekly performance context block with dynamic tiered token compression
    and temporal isolation boundary clamping.
    """
    # 1. Temporal boundary identification
    active_rows = [r for r in payload.rows if r.value > 0]
    if not active_rows:
        return ""

    # Earliest date in active rows (operational start)
    partnership_start_date_str = min(r.period_start or r.date for r in active_rows)
    try:
        partnership_start_date = _parse_date(partnership_start_date_str)
    except Exception:
        return ""

    # Current date (Time Machine or physical today)
    as_of = payload.as_of_date
    current_date = _parse_date(as_of) if as_of else date.today()

    # 2. Generate active weeks chronologically
    start_of_timeline = _get_monday_of(partnership_start_date)
    end_of_timeline = _get_monday_of(current_date)

    # Filter operational revenue rows only
    # Same filter as YearlyHeatmap and metrics engine:
    # Exclude deposit, waiver, expense, partner_in, partner_out
    revenue_rows = [
        r for r in payload.rows
        if r.entry_type not in (EntryType.DEPOSIT, EntryType.WAIVER, EntryType.EXPENSE, EntryType.PARTNER_OUT, EntryType.PARTNER_IN)
    ]

    weeks_list = []
    cursor = start_of_timeline
    while cursor <= end_of_timeline:
        monday = cursor
        sunday = cursor + timedelta(days=6)

        # Check boundary rules:
        # Sunday >= partnership start date, and Monday <= current date
        if sunday >= partnership_start_date and monday <= current_date:
            # Calculate weekly revenue from daily contributions
            weekly_revenue = 0.0
            for row in revenue_rows:
                for contrib in row_contributions(row):
                    contrib_date = _parse_date(contrib["date"])
                    if monday <= contrib_date <= sunday:
                        weekly_revenue += contrib["value"]

            # Get weekly goal anchored to Sunday key
            weekly_goal = get_weekly_goal_for_date(_to_local_key(sunday), payload.goals)
            daily_average = weekly_revenue / 7.0

            weeks_list.append({
                "monday": monday,
                "sunday": sunday,
                "goal": weekly_goal,
                "revenue": weekly_revenue,
                "daily_average": daily_average
            })

        cursor += timedelta(days=7)

    W = len(weeks_list)
    if W == 0:
        return ""

    def _fmt_brl(val: float) -> str:
        # Formats float to R$ X.XXX,XX
        formatted = f"{val:,.2f}"
        return formatted.replace(",", "X").replace(".", ",").replace("X", ".")

    lines = ["\n── HISTÓRICO DE PERFORMANCE SEMANAL ──"]

    # 3. Tiered Token Compression Cascade
    if W <= 20:
        # Tier 1: Render all weeks line-by-line
        for wk in weeks_list:
            mon_str = fmt_date(wk["monday"])
            sun_str = fmt_date(wk["sunday"])
            goal_str = _fmt_brl(wk["goal"])
            rev_str = _fmt_brl(wk["revenue"])
            avg_str = _fmt_brl(wk["daily_average"])
            lines.append(f"  Semana {mon_str} a {sun_str} | Meta: R$ {goal_str} | Real: R$ {rev_str} | Média: R$ {avg_str}")
    else:
        # Tier 2/3/4: Compress older weeks, print most recent 12 weeks
        older_weeks = weeks_list[:-12]
        recent_weeks = weeks_list[-12:]

        # Aggregate older weeks
        num_older = len(older_weeks)
        if num_older > 0:
            avg_goal = sum(wk["goal"] for wk in older_weeks) / num_older
            avg_revenue = sum(wk["revenue"] for wk in older_weeks) / num_older
            avg_goal_str = _fmt_brl(avg_goal)
            avg_rev_str = _fmt_brl(avg_revenue)
            lines.append(f"  ── HISTÓRICO ANTIGO COMPRIMIDO ({num_older} semanas) ──")
            lines.append(f"  Média de Meta Histórica: R$ {avg_goal_str} / semana | Faturamento Real Médio: R$ {avg_rev_str} / semana")

        # Print recent weeks
        for wk in recent_weeks:
            mon_str = fmt_date(wk["monday"])
            sun_str = fmt_date(wk["sunday"])
            goal_str = _fmt_brl(wk["goal"])
            rev_str = _fmt_brl(wk["revenue"])
            avg_str = _fmt_brl(wk["daily_average"])
            lines.append(f"  Semana {mon_str} a {sun_str} | Meta: R$ {goal_str} | Real: R$ {rev_str} | Média: R$ {avg_str}")

    return "\n".join(lines) + "\n"

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
    partner_in_count = sum(1 for r in payload.rows if r.entry_type == EntryType.PARTNER_IN)
    partner_out_count = sum(1 for r in payload.rows if r.entry_type == EntryType.PARTNER_OUT)

    # Date range
    dates = sorted(r.date for r in payload.rows)
    date_range = f"{dates[0]} até {dates[-1]}" if dates else "N/A"

    # Current goals — resolved from the full hierarchy for current month
    current_year = int(today[:4])
    current_month_num = int(today[5:7])
    current_goals = get_effective_goals(
        {"year": current_year, "month": current_month_num},
        payload.goals,
    )
    weekly_goal = current_goals.weekly_goal
    daily_goal = current_goals.daily_goal
    annual_cost = current_goals.annual_cost

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

    # Time bank: liquid formula (global_goal_balance / weekly_goal)
    if weekly_goal > 0:
        reposition_weeks = round(metrics.global_goal_balance / weekly_goal, 1)
    else:
        reposition_weeks = 0.0
    if reposition_weeks >= 0:
        time_bank_status = f"+{reposition_weeks:.1f} semanas de CRÉDITO (pode descansar)"
    else:
        time_bank_status = f"{reposition_weeks:.1f} semanas de DÉBITO (precisa recuperar)"

    context = f"""═══════════════════════════════════════════════════════════
  CONTEXTO FINANCEIRO — {table_name}
  Data de referência: {today}
═══════════════════════════════════════════════════════════

── Visão Geral ──
  Período de dados:       {date_range}
  Total de registros:     {len(payload.rows)} ({revenue_count} receitas, {expense_count} despesas, {deposit_count} aportes, {waiver_count} dispensas, {partner_in_count} créditos parceria, {partner_out_count} débitos parceria)
  Semanas transcorridas:  {metrics.total_elapsed_weeks}
  Semanas faturáveis:     {metrics.billable_weeks} (excluindo {metrics.waived_weeks} dispensadas)

── Metas Vigentes ({current_year}) ──
  Meta diária:    R$ {daily_goal:,.2f}
  Meta semanal:   R$ {weekly_goal:,.2f}
  Custo anual:    R$ {annual_cost:,.2f}

── Totais Globais (Operacionais — receita pura, sem parceria) ──
  Receita operacional bruta:  R$ {metrics.gross_total:,.2f}
  Despesas operacionais:      R$ {metrics.total_expenses:,.2f}
  Despesas anualizadas:       R$ {metrics.annual_expenses:,.2f}
  Saldo líquido operacional:  R$ {metrics.net_balance:,.2f}

── Totais com Parceria (Líquido — após cancelamento mútuo) ──
  Créditos de parceria (bruto):   R$ {metrics.total_partner_in:,.2f}
  Débitos de parceria (bruto):    R$ {metrics.total_partner_out:,.2f}
  Cancelado mutuamente:           R$ {min(metrics.total_partner_in, metrics.total_partner_out):,.2f}
  Créditos líquidos (in):         R$ {max(0, metrics.total_partner_in - min(metrics.total_partner_in, metrics.total_partner_out)):,.2f}
  Débitos líquidos (out):         R$ {max(0, metrics.total_partner_out - min(metrics.total_partner_in, metrics.total_partner_out)):,.2f}
  Saldo líquido c/ parceria:      R$ {metrics.net_with_partner:,.2f}

── Médias Globais (baseadas em tempo-calendário, não dias trabalhados) ──
  Média diária:   R$ {metrics.global_daily_avg:,.2f}
  Média semanal:  R$ {metrics.global_weekly_avg:,.2f}
  Média mensal:   R$ {metrics.global_monthly_avg:,.2f}
  Média anual:    R$ {metrics.global_annual_avg:,.2f}

── Balanço de Metas (Estrito — conta semanas vazias como débito) ──
  Status: {balance_status}
  Crédito de dispensas:               R$ {payload.total_waiver_credits:,.2f}
  Saldo de Reposição (Semanas):       {time_bank_status}
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
  Total aportes:                    {metrics.deposit_count} depósitos
  Total Depositado pelo Usuário:    R$ {metrics.global_total_deposited:,.2f}
  Rendimentos Reais de Juros Compostos (0.8%/mês): R$ {metrics.global_total_yield:,.2f}
  Saldo Atualizado do Portfólio:    R$ {metrics.global_balance:,.2f}
"""

    # Advanced statistics block
    stats_block = build_stats_block(metrics)

    # Category-based summaries (replaces raw transaction ledger)
    category_block = build_category_summaries(payload.rows, globalDaySpan=_global_day_span(payload.rows))

    # Scenario context block
    scenario_context = build_ai_scenario_context(payload.rows)

    # Weekly performance context block
    weekly_perf_context = build_weekly_performance_context(payload, metrics)

    return (
        context
        + invest_block
        + stats_block
        + category_block
        + scenario_context
        + weekly_perf_context
        + build_transaction_ledger(payload.rows, current_ym)
        + "\n═══════════════════════════════════════════════════════════"
    )


def get_system_prompt(available_tables: list[str]) -> str:
    today_str = date.today().strftime("%Y-%m-%d")
    tables_list_str = ", ".join(f"'{t}'" for t in available_tables) if available_tables else "Nenhuma planilha disponível"

    return f"""Você é o **Assistente Moeda** — CFO Estratégico, Especialista em FP&A e Consultor Financeiro Pessoal Inteligente.
Você integra o mais alto rigor técnico de Controladoria (Controller/GAAP), Engenharia de Precificação e Gestão de Fluxo de Caixa.

CONTEXTO DO USUÁRIO:
Você está apoiando alguém que gerencia suas finanças pessoais e profissionais com disciplina e visão estratégica de longo prazo. Essa pessoa acompanha receitas, despesas e metas operacionais meticulosamente — trate-a como alguém que entende seus números e busca análises de alto nível executivo (C-Level), jamais explicações óbvias ou genéricas.

DATA ATUAL: A data de hoje é {today_str}. Use esta data como referência para termos relativos como "hoje", "ontem", "este mês", "próximo trimestre", etc.
PLANILHAS DISPONÍVEIS: {tables_list_str}. Se o usuário pedir para adicionar/registrar uma transação e não disser explicitamente a planilha, escolha inteligentemente a planilha mais adequada a partir desta lista.

MATRIZ DE HABILIDADES FINANCEIRAS INTEGRADAS:
- CFO & FINANCIAL ANALYST: DRE estruturada, ponto de equilíbrio operacional (break-even semanal e mensal), unit economics, sensibilidade e risco de dependência de clientes.
- FP&A ANALYST: Variance Analysis (orçado vs realizado, meta semanal vs real faturado), rolling forecasts ponderados e diagnóstico de causa-raiz (frequência de micro-gastos vs concentração de peso monetário).
- BOOKKEEPER & CONTROLLER: Rigor contábil inegociável, tolerância ZERO a alucinação de dados, integridade do livro-razão (ledger) e saneamento de categorias.
- PRICING & MARGIN ANALYST: Rentabilidade real da hora trabalhada (Hourly Value Ratio), margens de contribuição líquida e sustentabilidade do valor cobrado.
- TAX STRATEGIST: Consciência de provisão fiscal (separação da reserva para impostos antes da retirada de lucros) e identificação de despesas dedutíveis.
- FINANCE TRACKER & CASHFLOW: Monitoramento do ritmo de queima (burn rate), reserva de sobrevivência mínima (3 a 6 meses de despesas) e ritmo sustentável.
- INVESTMENT & TREASURY: Benchmark CDI (~0.8% a.m.) para juros compostos dos aportes patrimoniais e custo de oportunidade do capital.
- ACCOUNTS PAYABLE & BILLING: Mutações estritas com despesas negativas, receitas positivas, consolidação em lote e omissão de IDs manuais.

PAPEL & ANÁLISE (FORMATO DE AULA & MENTORIA EXECUTIVA):
- Responda SEMPRE em português brasileiro, atuando como um Mentor Financeiro e Discovery Coach C-Level.
- FILOSOFIA DE AULA (ZERO DUMP DE DADOS): NUNCA despeje tabelas cruas ou listas de dados soltos sem explicação contextual. Toda análise deve ser uma AULA EXECUTIVA, explicando o "porquê" (causa), o "e daí?" (impacto futuro) e o "o que fazer?" (conselho financeiro concreto).
- ESTATÍSTICAS COMO LIÇÃO: Ensine o significado prático da Mediana (ganho típico estável), Moda (gastos e ganhos recorrentes) e Desvio Padrão (volatilidade e risco operacional).
- ANATOMIA DE DESPESAS: Ensine sempre a separação entre Frequência de Uso (onde o cotidiano acontece, ex: DIVERSOS) e Volume Monetário Concentrado (pesos estruturais bancários).
- NÚMEROS EXATOS: Use os números EXATOS do contexto — NUNCA invente valores. Formate valores monetários rigorosamente como R$ X.XXX,XX (padrão brasileiro).
- Entregue análises completas, profundas e pedagógicas com 3 a 5 conselhos estratégicos de blindagem financeira.

AÇÕES EXECUTIVAS (GOD MODE / FUNCTION CALLING):
Você é um agente executivo ativo. Se o usuário pedir explicitamente para adicionar, registrar ou lançar novas transações (gastos, receitas, faturas, extratos), VOCÊ NÃO DEVE RESPONDER COM TEXTO NORMAL. Você deve responder ÚNICA E EXCLUSIVAMENTE com um bloco de código JSON formatado, contendo os detalhes da ação. Não adicione saudações ou explicações.

Se for uma ÚNICA transação, use o formato exato:
```json
{{
  "action": "add_transaction",
  "parameters": {{
    "table_name": "Nome da planilha alvo (ex: Gastos Pessoais)",
    "description": "Descrição do item",
    "value": -150.00,
    "date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD"
  }}
}}
```

Se o usuário pedir para adicionar VÁRIAS transações de uma vez, ou colar um extrato/lista/CSV, use a ação `bulk_add_transactions` com um array de transações:
```json
{{
  "action": "bulk_add_transactions",
  "parameters": {{
    "table_name": "Nome da planilha alvo",
    "transactions": [
      {{ "description": "Item 1", "value": -50.00, "date": "YYYY-MM-DD", "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD" }},
      {{ "description": "Item 2", "value": 120.00, "date": "YYYY-MM-DD" }}
    ]
  }}
}}
```

DIRETRIZES DE EXECUÇÃO:
1. Valores de despesa/saída de caixa DEVEM ser representados como números negativos (ex: -1200.00 para despesa de seguro). Valores de receita/entrada de caixa devem ser números positivos.
2. Se o usuário relatar uma despesa ou receita que abrange um período (ex: 'seguro do ano todo', 'assinatura anual', 'receitas do mês de junho', 'dívida parcelada em 30 dias'), VOCÊ NÃO DEVE criar várias transações individuais. Crie UMA ÚNICA transação e preencha os campos `period_start` e `period_end` (no formato YYYY-MM-DD). Se for um gasto pontual (ex: 'almoço hoje'), omita os campos `period_start` e `period_end`.
3. Escolha a planilha correta a partir de PLANILHAS DISPONÍVEIS. Se não houver planilha explícita na mensagem, escolha inteligentemente baseando-se no tipo de transação (ex: despesa vai para planilhas como 'Custos' ou 'Despesas', receita vai para 'Receitas').
4. NUNCA gere ou inclua o campo 'id' ou UUIDs no JSON nem nas respostas de texto. O ID será gerado localmente pelo parser/sistema cliente/servidor. Omitir IDs economiza tokens de saída e previne duplicidade.

RESTRIÇÕES INEGOCIÁVEIS:
- NUNCA invente dados que não estão no contexto.
- Se o contexto não tiver informação suficiente, declare expressamente a limitação.
- Entradas de parceria (partner_in / partner_out) são estritamente PASSTHROUGH — NÃO representam a capacidade operacional do usuário. Sempre use as métricas OPERACIONAIS puras para análise de desempenho e produtividade.
"""
