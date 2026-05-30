"""
CoinAssistant — Metrics Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Python port of: src/tools/CoinAssistant/hooks/useMetricsEngine.ts

Pure math engine — calendar-elapsed-time averaging.

Key invariants (identical to the TypeScript version):
  - grossTotal is always the sum of rows with value > 0 only.
  - ALL averages are calendar-elapsed-time based, never "active day count".
  - globalWeeklyAvg  = globalDailyAvg × 7
  - globalMonthlyAvg = globalDailyAvg × 30.44
  - globalAnnualAvg  = globalDailyAvg × 365.25
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from models.coin_models import (
    TableRow,
    TableMetrics,
    MonthMetrics,
    YearMetrics,
    EntryType,
)
from services.coin_date_utils import (
    _parse_date,
    _to_local_key,
    _calendar_day_span,
    _days_in_month,
    get_iso_week_key,
    iso_year_month,
    calculate_strict_global_balance,
    resolve_goal_for_year,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _round2(n: float) -> float:
    """Round to 2 decimal places (matches TS Math.round(n * 100) / 100)."""
    return round(n * 100) / 100


# ── Period Distribution ──────────────────────────────────────────────────────


def row_contributions(row: TableRow) -> list[dict]:
    """
    Returns a list of daily contribution dicts for a revenue row.
    Mirrors: rowContributions() in useMetricsEngine.ts

    Period rows: distributes value / periodDays to each calendar day.
    Single-day rows: returns a single entry with the full value.
    """
    if (
        row.period_start
        and row.period_end
        and row.period_start != row.period_end
    ):
        start = _parse_date(row.period_start)
        end = _parse_date(row.period_end)
        if end < start:
            return [{"date": row.date, "value": row.value}]

        period_days = max(1, (end - start).days + 1)
        daily_value = row.value / period_days
        contributions = []
        cursor = start
        while cursor <= end:
            contributions.append({
                "date": _to_local_key(cursor),
                "value": daily_value,
            })
            cursor += timedelta(days=1)
        return contributions

    return [{"date": row.date, "value": row.value}]


# ── Main Engine ──────────────────────────────────────────────────────────────


def compute_metrics(
    rows: list[TableRow],
    weekly_goals: dict[int, float],
    as_of_date: Optional[str] = None,
) -> TableMetrics:
    """
    Pure math engine — calendar-elapsed-time averaging.
    Mirrors: computeMetrics() in useMetricsEngine.ts

    Args:
        rows:         All table rows (revenue, deposit, waiver, expense).
        weekly_goals: Per-year weekly goal record { 2026: 600.0 }.
        as_of_date:   Optional "YYYY-MM-DD" — treats this as "today".

    Returns:
        TableMetrics with all 23 computed fields.
    """
    if not rows:
        return _empty_metrics()

    # Filter out deposits, waivers, expenses for revenue calculations
    revenue_rows = [
        r for r in rows
        if r.entry_type not in (EntryType.DEPOSIT, EntryType.WAIVER, EntryType.EXPENSE)
    ]

    # ── Expense metrics — computed before the early-return guard ──────────
    expense_rows = [r for r in rows if r.entry_type == EntryType.EXPENSE]
    total_expenses = 0.0
    annual_expenses = 0.0

    # Survival goal accumulators: track the global expense date span
    exp_earliest = ""
    exp_latest = ""

    for row in expense_rows:
        total_expenses += row.value

        # Annualize via daily rate × 365 (fixes multi-year expense inflation)
        exp_start = row.period_start or row.date
        exp_end = row.period_end or row.date
        lifespan_days = max(1, _calendar_day_span(exp_start, exp_end))
        annual_expenses += (row.value / lifespan_days) * 365

        # Widen global expense span for survival goals
        if row.value > 0:
            if not exp_earliest or exp_start < exp_earliest:
                exp_earliest = exp_start
            if not exp_latest or exp_end > exp_latest:
                exp_latest = exp_end

    total_expenses = _round2(total_expenses)
    annual_expenses = _round2(annual_expenses)

    # ── Survival / Break-Even Goals (always computed) ─────────────────────
    global_expense_day_span = (
        max(1, _calendar_day_span(exp_earliest, exp_latest))
        if exp_earliest and exp_latest
        else 0
    )
    survival_daily = _round2(total_expenses / global_expense_day_span) if global_expense_day_span > 0 else 0.0
    survival_weekly = _round2(survival_daily * 7)
    survival_monthly = _round2(survival_daily * 30.44)
    survival_annual_cost = _round2(survival_daily * 365.25)

    survival_fields = {
        "survivalDaily": survival_daily,
        "survivalWeekly": survival_weekly,
        "survivalMonthly": survival_monthly,
        "survivalAnnualCost": survival_annual_cost,
    }

    if not revenue_rows:
        m = _empty_metrics()
        return TableMetrics(
            **{**m.model_dump(by_alias=True), "totalExpenses": total_expenses, "annualExpenses": annual_expenses, **survival_fields}
        )

    active_rows = [r for r in revenue_rows if r.value > 0]
    if not active_rows:
        m = _empty_metrics()
        return TableMetrics(
            **{**m.model_dump(by_alias=True), "totalExpenses": total_expenses, "annualExpenses": annual_expenses, **survival_fields}
        )

    # ── Global date span — uses periodStart/periodEnd when present ───────
    all_effective_dates: list[str] = []
    for r in revenue_rows:
        all_effective_dates.append(r.date)
        if r.period_start:
            all_effective_dates.append(r.period_start)
        if r.period_end:
            all_effective_dates.append(r.period_end)
    all_effective_dates.sort()
    global_span_days = max(1, _calendar_day_span(
        all_effective_dates[0],
        all_effective_dates[-1],
    ))

    # ── Today — for current-month partial-month denominator ──────────────
    today = _parse_date(as_of_date) if as_of_date else date.today()
    today_ym = iso_year_month(today)
    today_day_of_month = today.day

    # ── Accumulators ─────────────────────────────────────────────────────
    gross_total = 0.0

    by_year_acc: dict[str, dict] = {}   # year_str → {gross, dates}
    by_month_acc: dict[str, dict] = {}  # YYYY-MM → {gross, payments, weeks}
    by_week_acc: dict[str, float] = {}  # YYYY-Www → total

    # ── Single-pass over active rows ─────────────────────────────────────
    for row in active_rows:
        gross_total += row.value

        # byYear: attribute to year of periodStart or payment date
        effective_start = row.period_start or row.date
        year_str = effective_start[:4]
        if year_str not in by_year_acc:
            by_year_acc[year_str] = {"gross": 0.0, "dates": []}
        by_year_acc[year_str]["gross"] += row.value
        by_year_acc[year_str]["dates"].append(effective_start)
        if row.period_end:
            end_year_str = row.period_end[:4]
            if end_year_str == year_str:
                by_year_acc[year_str]["dates"].append(row.period_end)

        # byMonth + byWeek: distribute value across daily contributions
        for contrib in row_contributions(row):
            c_year_str = contrib["date"][:4]
            c_month_str = contrib["date"][5:7]
            year_month = f"{c_year_str}-{c_month_str}"
            iso_week = get_iso_week_key(contrib["date"])

            if year_month not in by_month_acc:
                by_month_acc[year_month] = {
                    "gross": 0.0,
                    "payments": {},
                    "weeks": set(),
                }
            by_month_acc[year_month]["gross"] += contrib["value"]
            by_month_acc[year_month]["payments"][contrib["date"]] = (
                by_month_acc[year_month]["payments"].get(contrib["date"], 0.0)
                + contrib["value"]
            )
            by_month_acc[year_month]["weeks"].add(iso_week)

            by_week_acc[iso_week] = by_week_acc.get(iso_week, 0.0) + contrib["value"]

    # ── Global averages ──────────────────────────────────────────────────
    global_daily_avg = _round2(gross_total / global_span_days)
    global_weekly_avg = _round2(global_daily_avg * 7)
    global_monthly_avg = _round2(global_daily_avg * 30.44)
    global_annual_avg = _round2(global_daily_avg * 365.25)

    # ── Per-year metrics ─────────────────────────────────────────────────
    by_year: dict[str, YearMetrics] = {}
    for yr, acc in by_year_acc.items():
        sorted_dates = sorted(acc["dates"])
        span = max(1, _calendar_day_span(sorted_dates[0], sorted_dates[-1]))
        daily_avg = _round2(acc["gross"] / span)
        by_year[yr] = YearMetrics(
            grossAnnual=_round2(acc["gross"]),
            dailyAvg=daily_avg,
            weeklyAvg=_round2(daily_avg * 7),
            monthlyAvg=_round2(daily_avg * 30.44),
        )

    # ── Per-month metrics ────────────────────────────────────────────────
    by_month: dict[str, MonthMetrics] = {}
    for ym, acc in by_month_acc.items():
        ym_year = int(ym[:4])
        ym_month = int(ym[5:7])

        # Denominator: current month → days elapsed; past month → full length
        if ym == today_ym:
            denominator = max(1, today_day_of_month)
        else:
            denominator = max(1, _days_in_month(ym_year, ym_month))

        daily_avg = _round2(acc["gross"] / denominator)

        # Weekly average — two strategies (mirrors TS)
        if ym == today_ym:
            weekly_avg = _round2(
                acc["gross"] / max(1, -(-today_day_of_month // 7))  # ceiling division
            )
        else:
            weekly_avg = _round2(daily_avg * 7)

        # Last ISO week that touched this month
        sorted_weeks = sorted(acc["weeks"])
        last_week = sorted_weeks[-1] if sorted_weeks else ""
        last_week_gross = _round2(by_week_acc.get(last_week, 0.0)) if last_week else 0.0

        by_month[ym] = MonthMetrics(
            grossMonthly=_round2(acc["gross"]),
            dailyAvg=daily_avg,
            weeklyAvg=weekly_avg,
            lastWeekGross=last_week_gross,
            dailyPayments=acc["payments"],
        )

    # ── Week totals ──────────────────────────────────────────────────────
    by_week: dict[str, float] = {wk: _round2(v) for wk, v in by_week_acc.items()}

    # ── Strict cumulative BRL balance + real elapsed weeks ───────────────
    raw_strict_balance, total_elapsed_weeks = calculate_strict_global_balance(
        revenue_rows,
        weekly_goals,
        _parse_date(as_of_date) if as_of_date else None,
    )

    # ── Waiver credits ───────────────────────────────────────────────────
    total_waiver_credits = 0.0
    total_waived_days = 0.0
    waiver_rows = [r for r in rows if r.entry_type == EntryType.WAIVER and r.value > 0]

    for row in waiver_rows:
        waiver_year = int(row.date[:4])
        goal_for_year = resolve_goal_for_year(weekly_goals, waiver_year)
        total_waiver_credits += (row.value / 7) * goal_for_year
        total_waived_days += row.value

    global_goal_balance = round((raw_strict_balance + total_waiver_credits) * 100) / 100
    waived_weeks = round((total_waived_days / 7) * 100) / 100
    billable_weeks = round((total_elapsed_weeks - waived_weeks) * 100) / 100

    # ── Time Bank balance (weeks) ────────────────────────────────────────
    current_year = today.year
    effective_weekly_goal = resolve_goal_for_year(weekly_goals, current_year)
    time_bank_balance = (
        round((global_goal_balance / effective_weekly_goal) * 100) / 100
        if effective_weekly_goal > 0
        else 0.0
    )

    # ── Net balance ──────────────────────────────────────────────────────
    net_balance = _round2(gross_total - total_expenses)

    return TableMetrics(
        grossTotal=_round2(gross_total),
        globalDailyAvg=global_daily_avg,
        globalWeeklyAvg=global_weekly_avg,
        globalMonthlyAvg=global_monthly_avg,
        globalAnnualAvg=global_annual_avg,
        globalGoalBalance=global_goal_balance,
        totalElapsedWeeks=total_elapsed_weeks,
        waivedWeeks=waived_weeks,
        billableWeeks=billable_weeks,
        totalWaiverCredit=round(total_waiver_credits * 100) / 100,
        timeBankBalance=time_bank_balance,
        byYear=by_year,
        byMonth=by_month,
        byWeek=by_week,
        totalExpenses=total_expenses,
        annualExpenses=annual_expenses,
        netBalance=net_balance,
        **survival_fields,
    )


# ── Empty Metrics Fallback ───────────────────────────────────────────────────


def _empty_metrics() -> TableMetrics:
    return TableMetrics(
        grossTotal=0,
        globalDailyAvg=0,
        globalWeeklyAvg=0,
        globalMonthlyAvg=0,
        globalAnnualAvg=0,
        globalGoalBalance=0,
        totalElapsedWeeks=0,
        waivedWeeks=0,
        billableWeeks=0,
        totalWaiverCredit=0,
        timeBankBalance=0,
        byYear={},
        byMonth={},
        byWeek={},
        totalExpenses=0,
        annualExpenses=0,
        netBalance=0,
        survivalDaily=0,
        survivalWeekly=0,
        survivalMonthly=0,
        survivalAnnualCost=0,
    )
