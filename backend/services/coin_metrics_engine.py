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

from collections import Counter

from datetime import date, timedelta
from typing import Optional

from models.coin_models import (
    TableRow,
    TableGoals,
    TableMetrics,
    MonthMetrics,
    YearMetrics,
    EntryType,
    PortfolioTimelinePoint,
)
from services.coin_date_utils import (
    _parse_date,
    _to_local_key,
    _calendar_day_span,
    _days_in_month,
    get_iso_week_key,
    iso_year_month,
    calculate_strict_global_balance,
    get_weekly_goal_for_date,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _round2(n: float) -> float:
    """Round to 2 decimal places (matches TS Math.round(n * 100) / 100)."""
    return round(n * 100) / 100

# ── Year-scoped expense allocation ──────────────────────────────────────────


def _compute_year_expenses(expense_rows: list, year: int) -> float:
    """
    Year-scoped expense allocation with proper overlap logic.

    - Point-in-time expenses (start == end): full value if date falls in year.
    - Multi-period expenses: dailyRate × overlapDays with this year.
    """
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"
    total = 0.0

    for row in expense_rows:
        if row.value <= 0:
            continue
        start = row.period_start or row.date
        end = row.period_end or row.date

        # No overlap with this year
        if start > year_end or end < year_start:
            continue

        if start == end:
            # Point-in-time expense — full value
            total += row.value
        else:
            # Multi-period: prorate by overlap days
            total_days = max(1, _calendar_day_span(start, end))
            overlap_start = max(start, year_start)
            overlap_end = min(end, year_end)
            overlap_days = max(1, _calendar_day_span(overlap_start, overlap_end))
            total += (row.value / total_days) * overlap_days

    return _round2(total)


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


def _get_consecutive_months(start_ym: str, end_ym: str) -> list[str]:
    """
    Returns all YYYY-MM consecutive month strings between start_ym and end_ym, inclusive.
    Mirrors: getConsecutiveMonths() in useMetricsEngine.ts
    """
    start_y, start_m = map(int, start_ym.split("-"))
    end_y, end_m = map(int, end_ym.split("-"))
    result = []
    curr_y = start_y
    curr_m = start_m
    while curr_y < end_y or (curr_y == end_y and curr_m <= end_m):
        result.append(f"{curr_y}-{curr_m:02d}")
        curr_m += 1
        if curr_m > 12:
            curr_m = 1
            curr_y += 1
    return result


# ── Main Engine ──────────────────────────────────────────────────────────────


def compute_metrics(
    rows: list[TableRow],
    goals: TableGoals,
    as_of_date: Optional[str] = None,
    total_waiver_credits: float = 0.0,
) -> TableMetrics:
    """
    Pure math engine — calendar-elapsed-time averaging.
    Mirrors: computeMetrics() in useMetricsEngine.ts

    Args:
        rows:         All table rows (revenue, deposit, waiver, expense).
        goals:        The full TableGoals hierarchy (Monthly > Annual > Global).
        as_of_date:   Optional "YYYY-MM-DD" — treats this as "today".
        total_waiver_credits: Pre-calculated waiver credits from the frontend.

    Returns:
        TableMetrics with all computed fields.
    """
    if not rows:
        return _empty_metrics()

    # Find all YYYY-MM months in the entire rows dataset (including ranges) to populate byMonthAcc
    all_months = set()
    for r in rows:
        start = r.period_start or r.date
        end = r.period_end or r.date
        start_ym = start[:7]
        end_ym = end[:7]
        start_y, start_m = map(int, start_ym.split("-"))
        end_y, end_m = map(int, end_ym.split("-"))
        
        curr_y = start_y
        curr_m = start_m
        while curr_y < end_y or (curr_y == end_y and curr_m <= end_m):
            all_months.add(f"{curr_y}-{curr_m:02d}")
            curr_m += 1
            if curr_m > 12:
                curr_m = 1
                curr_y += 1

    # ── Prorated monthly calculations for deposits and expenses ─────────────────
    deposit_rows = [r for r in rows if r.entry_type == EntryType.DEPOSIT and r.value > 0]
    expense_rows = [r for r in rows if r.entry_type == EntryType.EXPENSE]

    deposit_by_month: dict[str, float] = {}
    for row in deposit_rows:
        for contrib in row_contributions(row):
            ym = contrib["date"][:7]
            deposit_by_month[ym] = deposit_by_month.get(ym, 0.0) + contrib["value"]

    monthly_expenses: dict[str, float] = {}
    for row in expense_rows:
        for contrib in row_contributions(row):
            ym = contrib["date"][:7]
            monthly_expenses[ym] = monthly_expenses.get(ym, 0.0) + contrib["value"]

    # Filter out deposits, waivers, expenses, AND partner entries for revenue calculations
    # FIREWALL: partner_in and partner_out are isolated from operational revenue.
    revenue_rows = [
        r for r in rows
        if r.entry_type not in (EntryType.DEPOSIT, EntryType.WAIVER, EntryType.EXPENSE, EntryType.PARTNER_OUT, EntryType.PARTNER_IN)
    ]

    total_expenses = 0.0

    # Survival goal accumulators: track the global expense date span
    exp_earliest = ""
    exp_latest = ""

    for row in expense_rows:
        total_expenses += row.value

        # Widen global expense span for survival goals
        exp_start = row.period_start or row.date
        exp_end = row.period_end or row.date
        if row.value > 0:
            if not exp_earliest or exp_start < exp_earliest:
                exp_earliest = exp_start
            if not exp_latest or exp_end > exp_latest:
                exp_latest = exp_end

    # Note: total_expenses rounding deferred until after partner_out accumulation
    # annualExpenses = totalExpenses at global level;
    # per-year breakdown lives in by_year[yr].year_expenses

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

    # ── Partnership ledger — separate tracking for Time Bank + breakdown ─────
    partner_in_rows = [r for r in rows if r.entry_type == EntryType.PARTNER_IN]
    partner_out_rows = [r for r in rows if r.entry_type == EntryType.PARTNER_OUT]
    total_partner_in = _round2(sum(r.value for r in partner_in_rows))
    total_partner_out = _round2(sum(r.value for r in partner_out_rows))

    # FIREWALL: partner_out does NOT add to total_expenses.
    # Survival goals are based purely on operational expenses.

    total_expenses = _round2(total_expenses)
    annual_expenses = total_expenses

    # ── Investment / Deposit compound interest (0.8%/month CDI reference) ────
    MONTHLY_RATE = 0.008
    all_yms = sorted(list(all_months))
    earliest_invest_month = ""
    for ym in all_yms:
        if deposit_by_month.get(ym, 0.0) > 0:
            earliest_invest_month = ym
            break

    portfolio_timeline = []
    global_total_deposited = 0.0
    global_total_yield = 0.0
    global_balance = 0.0

    if earliest_invest_month:
        latest_month = all_yms[-1] if all_yms else earliest_invest_month
        consecutive_months = _get_consecutive_months(earliest_invest_month, latest_month)

        accumulated_principal = 0.0
        accumulated_yield = 0.0

        for ym in consecutive_months:
            monthly_deposit = deposit_by_month.get(ym, 0.0)
            current_month_yield = _round2((accumulated_principal + accumulated_yield) * MONTHLY_RATE)
            accumulated_yield = _round2(accumulated_yield + current_month_yield)
            accumulated_principal = _round2(accumulated_principal + monthly_deposit)
            total_balance = _round2(accumulated_principal + accumulated_yield)

            portfolio_timeline.append(
                PortfolioTimelinePoint(
                    month=ym,
                    monthlyDeposit=_round2(monthly_deposit),
                    currentMonthYield=current_month_yield,
                    accumulatedPrincipal=accumulated_principal,
                    accumulatedYield=accumulated_yield,
                    totalBalance=total_balance,
                )
            )

        global_total_deposited = accumulated_principal
        global_total_yield = accumulated_yield
        global_balance = accumulated_principal + accumulated_yield

    print(f"DEBUG PORTFOLIO: Deposited={global_total_deposited}, Yield={global_total_yield}, Balance={global_balance}")

    deposit_count = len(deposit_rows)
    total_invested = global_total_deposited
    total_interest_earned = global_total_yield
    investment_balance = global_balance

    invest_fields = {
        "depositCount": deposit_count,
        "totalInvested": total_invested,
        "totalInterestEarned": total_interest_earned,
        "investmentBalance": investment_balance,
        "globalTotalDeposited": global_total_deposited,
        "globalTotalYield": global_total_yield,
        "globalBalance": global_balance,
        "portfolioTimeline": portfolio_timeline,
    }

    # ── Advanced Statistics (revenue rows only, value > 0) ─────────────────
    positive_rev_values = [r.value for r in rows
                           if r.entry_type not in (EntryType.DEPOSIT, EntryType.WAIVER, EntryType.EXPENSE, EntryType.PARTNER_OUT, EntryType.PARTNER_IN)
                           and r.value > 0]

    if not positive_rev_values:
        stats_fields = {
            "maxTransaction": 0.0,
            "minTransaction": 0.0,
            "medianTransaction": 0.0,
            "modeTransaction": 0.0,
            "stdDeviation": 0.0,
        }
    else:
        sorted_vals = sorted(positive_rev_values)
        n = len(sorted_vals)
        max_tx = _round2(sorted_vals[-1])
        min_tx = _round2(sorted_vals[0])

        # Median
        if n % 2 == 1:
            median_tx = _round2(sorted_vals[n // 2])
        else:
            median_tx = _round2((sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2)

        # Mode (most frequent, need at least 2 occurrences)
        freq = Counter(positive_rev_values)
        mode_tx = 0.0
        max_freq = 1  # threshold: needs > 1 to count as mode
        for val, cnt in freq.items():
            if cnt > max_freq:
                max_freq = cnt
                mode_tx = val
        mode_tx = _round2(mode_tx)

        # Population standard deviation
        mean = sum(positive_rev_values) / n
        variance = sum((v - mean) ** 2 for v in positive_rev_values) / n
        std_dev = _round2(variance ** 0.5)

        stats_fields = {
            "maxTransaction": max_tx,
            "minTransaction": min_tx,
            "medianTransaction": median_tx,
            "modeTransaction": mode_tx,
            "stdDeviation": std_dev,
        }

    if not revenue_rows:
        m = _empty_metrics()
        return TableMetrics(
            **{**m.model_dump(by_alias=True), "totalExpenses": total_expenses, "annualExpenses": annual_expenses, **survival_fields, **invest_fields, **stats_fields}
        )

    active_rows = [r for r in revenue_rows if r.value > 0]
    if not active_rows:
        m = _empty_metrics()
        return TableMetrics(
            **{**m.model_dump(by_alias=True), "totalExpenses": total_expenses, "annualExpenses": annual_expenses, **survival_fields, **invest_fields, **stats_fields}
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
    gross_total_weeks = 0.0  # historically-accumulated week equivalent

    # byYear: {gross, dates[], months set, weeks set}
    by_year_acc: dict[str, dict] = {}
    by_month_acc: dict[str, dict] = {
        ym: {"gross": 0.0, "payments": {}, "weeks": set()}
        for ym in all_months
    }
    by_week_acc: dict[str, float] = {}  # YYYY-Www → total

    # ── Single-pass over active rows ───────────────────────────────────
    for row in active_rows:
        gross_total += row.value

        # Accumulate historically-correct week equivalent
        active_weekly_goal = get_weekly_goal_for_date(row.date, goals)
        if active_weekly_goal > 0:
            gross_total_weeks += row.value / active_weekly_goal

        # Distribute value across daily contributions into year, month, week
        for contrib in row_contributions(row):
            c_year_str = contrib["date"][:4]
            year_month = contrib["date"][:7]
            iso_week = get_iso_week_key(contrib["date"])

            # byYear
            if c_year_str not in by_year_acc:
                by_year_acc[c_year_str] = {
                    "gross": 0.0, "dates": [], "months": set(), "weeks": set(),
                }
            by_year_acc[c_year_str]["gross"] += contrib["value"]
            by_year_acc[c_year_str]["dates"].append(contrib["date"])
            by_year_acc[c_year_str]["months"].add(year_month)
            by_year_acc[c_year_str]["weeks"].add(iso_week)

            # byMonth
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

            # byWeek
            by_week_acc[iso_week] = by_week_acc.get(iso_week, 0.0) + contrib["value"]

    # ── Global averages ──────────────────────────────────────────────────
    global_daily_avg = _round2(gross_total / global_span_days)
    global_weekly_avg = _round2(global_daily_avg * 7)
    global_monthly_avg = _round2(global_daily_avg * 30.44)
    global_annual_avg = _round2(global_daily_avg * 365.25)

    # ── Per-year metrics ─────────────────────────────────────────────────
    by_year: dict[str, YearMetrics] = {}
    for yr, acc in by_year_acc.items():
        sorted_dates = sorted(set(acc["dates"]))
        span = max(1, _calendar_day_span(sorted_dates[0], sorted_dates[-1]))
        daily_avg = _round2(acc["gross"] / span)
        year_num = int(yr)
        by_year[yr] = YearMetrics(
            grossAnnual=_round2(acc["gross"]),
            yearExpenses=_compute_year_expenses(expense_rows, year_num),
            dailyAvg=daily_avg,
            weeklyAvg=_round2(acc["gross"] / max(1, len(acc["weeks"]))),
            monthlyAvg=_round2(acc["gross"] / max(1, len(acc["months"]))),
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
            investment=_round2(deposit_by_month.get(ym, 0.0)),
            expense=_round2(monthly_expenses.get(ym, 0.0)),
        )

    # ── Week totals ──────────────────────────────────────────────────────
    by_week: dict[str, float] = {wk: _round2(v) for wk, v in by_week_acc.items()}

    # ── Strict cumulative BRL balance + real elapsed weeks ───────────────
    raw_strict_balance, total_elapsed_weeks = calculate_strict_global_balance(
        revenue_rows,
        goals,
        _parse_date(as_of_date) if as_of_date else None,
    )

    # ── Waiver days (for billable weeks calculation) ──────────────────────────
    total_waived_days = 0.0
    # ── Waiver credits ───────────────────────────────────────────────
    waiver_total_weeks = 0.0  # historically-accumulated week equivalent for waivers
    waiver_rows = [r for r in rows if r.entry_type == EntryType.WAIVER and r.value > 0]
    for row in waiver_rows:
        active_weekly_goal = get_weekly_goal_for_date(row.date, goals)
        if active_weekly_goal > 0:
            waiver_total_weeks += row.value / active_weekly_goal

    # FIREWALL Goal Balance: add partner_in credit since it no longer flows through rawStrictBalance
    global_goal_balance = round((raw_strict_balance + total_waiver_credits + total_partner_in - total_partner_out) * 100) / 100
    waived_weeks = round((total_waived_days / 7) * 100) / 100
    billable_weeks = round((total_elapsed_weeks - waived_weeks) * 100) / 100

    # ── Time Bank balance (weeks) ────────────────────────────────────────
    # Uses the historically-accumulated net_balance_weeks instead of a naive
    # flat division (global_goal_balance / effective_weekly_goal).
    # Assigned below after the week equivalents are finalized.

    # ── Net balance ──────────────────────────────────────────────────────────────
    net_balance = _round2(gross_total - total_expenses)

    # ── Historically-Accumulated Week Equivalents ───────────────────────────
    gross_total_weeks  = _round2(gross_total_weeks)
    waiver_total_weeks = _round2(waiver_total_weeks)
    goal_total_weeks   = float(total_elapsed_weeks)  # 1 calendar week = 1 goal-week
    net_balance_weeks  = _round2(gross_total_weeks + waiver_total_weeks - goal_total_weeks)

    # time_bank_balance: uses the liquid formula (globalGoalBalance / currentWeeklyGoal)
    # to match the corrected UI in GoalsPanel.tsx and MetricsPanel.tsx.
    # This accounts for partner netting, unlike the legacy netBalanceWeeks.
    current_year = today.year
    effective_weekly_goal = resolve_goal_for_year(goals.weekly_goals, current_year)
    time_bank_balance = round(global_goal_balance / effective_weekly_goal, 2) if effective_weekly_goal > 0 else 0.0

    # ── Combined metrics (operational + partnership) ──────────────────────────
    gross_with_partner = _round2(gross_total + total_partner_in)
    expenses_with_partner = _round2(total_expenses + total_partner_out)
    net_with_partner = _round2(gross_with_partner - expenses_with_partner)

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
        **invest_fields,
        **stats_fields,
        totalPartnerIn=total_partner_in,
        totalPartnerOut=total_partner_out,
        grossWithPartner=gross_with_partner,
        expensesWithPartner=expenses_with_partner,
        netWithPartner=net_with_partner,
        grossTotalWeeks=gross_total_weeks,
        waiverTotalWeeks=waiver_total_weeks,
        goalTotalWeeks=goal_total_weeks,
        netBalanceWeeks=net_balance_weeks,
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
        depositCount=0,
        totalInvested=0,
        totalInterestEarned=0,
        investmentBalance=0,
        globalTotalDeposited=0,
        globalTotalYield=0,
        globalBalance=0,
        portfolioTimeline=[],
        maxTransaction=0,
        minTransaction=0,
        medianTransaction=0,
        modeTransaction=0,
        stdDeviation=0,
        totalPartnerIn=0,
        totalPartnerOut=0,
        grossWithPartner=0,
        expensesWithPartner=0,
        netWithPartner=0,
        grossTotalWeeks=0,
        waiverTotalWeeks=0,
        goalTotalWeeks=0,
        netBalanceWeeks=0,
    )
