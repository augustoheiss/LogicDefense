"""
CoinAssistant — Date & Goal Utilities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Python port of: src/tools/CoinAssistant/utils/dateUtils.ts

Pure functions — zero side effects, zero imports from frameworks.
Every function here has an exact TypeScript counterpart whose behaviour
it must replicate identically, including edge cases around:
  - ISO week numbering (Jan 4 anchor)
  - Monday-based week grouping
  - Fallback resolution for per-year goal records
  - Strict Mon→Sun timeline walking for global balance
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Optional

from models.coin_models import TableRow, GoalProfile, TableGoals


# ── Internal Helpers ─────────────────────────────────────────────────────────


def _parse_date(date_str: str) -> date:
    """Parse a 'YYYY-MM-DD' string into a date object."""
    y, m, d = date_str.split("-")
    return date(int(y), int(m), int(d))


def _to_local_key(d: date) -> str:
    """Stable 'YYYY-MM-DD' key from a date object."""
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def _get_monday_of(d: date) -> date:
    """Returns the Monday of the week containing `d`."""
    # Monday = 0, Sunday = 6 in Python's weekday()
    return d - timedelta(days=d.weekday())


def _get_sunday_of(monday: date) -> date:
    """Returns the Sunday of the week starting on `monday`."""
    return monday + timedelta(days=6)


def _days_in_month(year: int, month: int) -> int:
    """Total calendar days in a given month (1-indexed)."""
    # Jump to the first day of the next month and subtract 1 day
    if month == 12:
        return 31
    return (date(year, month + 1, 1) - timedelta(days=1)).day


def _calendar_day_span(date_a: str, date_b: str) -> int:
    """
    Calendar days between two 'YYYY-MM-DD' strings, inclusive.
    Mirrors: calendarDaySpan() in useMetricsEngine.ts
    """
    a = _parse_date(date_a)
    b = _parse_date(date_b)
    return abs((b - a).days) + 1


# ── Public Helpers ───────────────────────────────────────────────────────────


def fmt_date(d: date) -> str:
    """Formats a date as 'DD/MM'."""
    return f"{d.day:02d}/{d.month:02d}"


def resolve_goal_for_year(goals: dict[int, float], year: int) -> float:
    """
    Resolves the goal amount for a specific year from a per-year dict.

    Fallback priority (mirrors dateUtils.ts resolveGoalForYear):
      1. Exact year match
      2. Closest year BEFORE `year`
      3. Closest year AFTER `year`
      4. 0 — only if the record is completely empty
    """
    if year in goals:
        return goals[year]

    years = sorted(goals.keys())
    if not years:
        return 0.0

    earlier = [y for y in years if y < year]
    if earlier:
        return goals[earlier[-1]]

    return goals[years[0]]  # earliest later year


def get_effective_goals(
    scope: dict | str,
    goals: TableGoals,
) -> GoalProfile:
    """
    Resolves the effective GoalProfile for a given scope using the hierarchy:
      monthly ("YYYY-MM") → yearly (number) → global → legacy flat records.

    Mirrors: getEffectiveGoals() in dateUtils.ts

    Args:
        scope: Either {'year': int, 'month': int | None} or 'global'.
        goals: The full TableGoals object.
    """
    # Monthly override
    if isinstance(scope, dict) and scope.get("month") is not None:
        month_key = f"{scope['year']:04d}-{scope['month']:02d}"
        if goals.monthly_goals and month_key in goals.monthly_goals:
            return goals.monthly_goals[month_key]

    # Yearly override
    if isinstance(scope, dict):
        year = scope["year"]
        if goals.yearly_goals and year in goals.yearly_goals:
            return goals.yearly_goals[year]

    # Global override
    if goals.global_goals is not None:
        return goals.global_goals

    # Legacy flat-record fallback
    from datetime import date as _date

    year = _date.today().year if scope == "global" else scope["year"]
    return GoalProfile(
        dailyGoal=resolve_goal_for_year(goals.daily_goals, year),
        weeklyGoal=resolve_goal_for_year(goals.weekly_goals, year),
        annualCost=resolve_goal_for_year(goals.annual_costs, year),
    )


def get_daily_goal_for_date(date_str: str, goals: TableGoals) -> float:
    """
    Resolves the effective daily goal for a specific date using the hierarchy:
      Monthly ("YYYY-MM") → Yearly (number) → Global → Legacy flat records.

    Mirrors: getDailyGoalForDate() in dateUtils.ts
    """
    year = int(date_str[:4])
    month = int(date_str[5:7])
    return get_effective_goals({"year": year, "month": month}, goals).daily_goal


def get_weekly_goal_for_date(date_str: str, goals: TableGoals) -> float:
    """
    Resolves the effective weekly goal for a specific date using the hierarchy:
      Monthly ("YYYY-MM") → Yearly (number) → Global → Legacy flat records.

    Mirrors: getWeeklyGoalForDate() in dateUtils.ts
    """
    year = int(date_str[:4])
    month = int(date_str[5:7])
    return get_effective_goals({"year": year, "month": month}, goals).weekly_goal


def get_iso_week_key(date_str: str) -> str:
    """
    ISO 8601 week key 'YYYY-Www'.
    Mirrors: getISOWeekKey() in useMetricsEngine.ts
    Uses Python's built-in isocalendar() which follows the same Jan-4 anchor rule.
    """
    d = _parse_date(date_str)
    iso_year, iso_week, _ = d.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def iso_year_month(d: date) -> str:
    """'YYYY-MM' key from a date object."""
    return f"{d.year:04d}-{d.month:02d}"


# ── Week Grouping ────────────────────────────────────────────────────────────


class WeekGroup:
    """A Mon–Sun calendar week with associated revenue entries."""

    __slots__ = (
        "week_start_date",
        "week_end_date",
        "daily_entries",
        "weekly_total",
        "difference_from_goal",
    )

    def __init__(
        self,
        week_start_date: date,
        week_end_date: date,
        daily_entries: list[TableRow],
        weekly_total: float,
        difference_from_goal: float,
    ):
        self.week_start_date = week_start_date
        self.week_end_date = week_end_date
        self.daily_entries = daily_entries
        self.weekly_total = weekly_total
        self.difference_from_goal = difference_from_goal


def group_rows_by_week(
    rows: list[TableRow],
    goals: TableGoals,
) -> list[WeekGroup]:
    """
    Groups revenue rows chronologically into Mon–Sun calendar weeks.
    Mirrors: groupRowsByWeek() in dateUtils.ts
    """
    if not rows:
        return []

    sorted_rows = sorted(rows, key=lambda r: r.date)

    # Map: monday-key → rows whose date falls in that Mon–Sun window
    week_map: dict[str, list[TableRow]] = {}
    for row in sorted_rows:
        row_date = _parse_date(row.date)
        monday = _get_monday_of(row_date)
        key = _to_local_key(monday)
        if key not in week_map:
            week_map[key] = []
        week_map[key].append(row)

    result: list[WeekGroup] = []
    for monday_str in sorted(week_map.keys()):
        entries = week_map[monday_str]
        monday = _parse_date(monday_str)
        sunday = _get_sunday_of(monday)
        weekly_total = sum(r.value for r in entries)
        # Goal resolved from the full hierarchy, anchored to Sunday's date
        # (Monthly > Annual > Global).
        sunday_key = _to_local_key(sunday)
        week_goal = get_weekly_goal_for_date(sunday_key, goals)
        result.append(
            WeekGroup(
                week_start_date=monday,
                week_end_date=sunday,
                daily_entries=sorted(entries, key=lambda r: r.date),
                weekly_total=weekly_total,
                difference_from_goal=weekly_total - week_goal,
            )
        )

    return result


# ── Strict Global Balance ────────────────────────────────────────────────────


def calculate_strict_global_balance(
    rows: list[TableRow],
    goals: TableGoals,
    as_of_date: Optional[date] = None,
) -> tuple[float, int]:
    """
    Strict global goal balance across the ENTIRE timeline.
    Mirrors: calculateStrictGlobalBalance() in dateUtils.ts

    Every Mon–Sun window is scored, even completely empty ones.
    An empty week contributes −weeklyGoal to the running total.

    Returns:
        (balance_brl, elapsed_weeks)
    """
    active_rows = [r for r in rows if r.value > 0]
    if not active_rows:
        return (0.0, 0)

    # Step A — earliest date (use periodStart if available)
    min_date_str = min(r.period_start or r.date for r in active_rows)
    start_of_timeline = _get_monday_of(_parse_date(min_date_str))

    # Step B — Monday of the current calendar week
    ref_date = as_of_date if as_of_date else date.today()
    end_of_timeline = _get_monday_of(ref_date)

    # Build a fast O(1) lookup: "YYYY-MM-DD" → total revenue for that date
    # Period rows are spread as daily contributions
    date_value_map: dict[str, float] = {}
    for row in active_rows:
        if row.period_start and row.period_end:
            start = _parse_date(row.period_start)
            end = _parse_date(row.period_end)
            period_days = max(1, (end - start).days + 1)
            daily_value = row.value / period_days
            cursor = start
            while cursor <= end:
                key = _to_local_key(cursor)
                date_value_map[key] = date_value_map.get(key, 0.0) + daily_value
                cursor += timedelta(days=1)
        else:
            date_value_map[row.date] = date_value_map.get(row.date, 0.0) + row.value

    # Walk each Mon–Sun window from start to end of timeline
    total_balance = 0.0
    elapsed_weeks = 0
    cursor = start_of_timeline

    while cursor <= end_of_timeline:
        week_sum = 0.0
        for i in range(7):
            day_key = _to_local_key(cursor + timedelta(days=i))
            week_sum += date_value_map.get(day_key, 0.0)

        # Score against the goal resolved from the FULL hierarchy,
        # anchored to the Sunday's date (Monthly > Annual > Global).
        sunday = cursor + timedelta(days=6)
        sunday_key = _to_local_key(sunday)
        week_goal = get_weekly_goal_for_date(sunday_key, goals)
        total_balance += week_sum - week_goal
        elapsed_weeks += 1
        cursor += timedelta(days=7)

    return (round(total_balance * 100) / 100, elapsed_weeks)


# ── Time Bank Balance ────────────────────────────────────────────────────────


def calculate_time_bank_balance(
    rows: list[TableRow],
    gross_total: float,
    effective_weekly_goal: float,
) -> float:
    """
    Time Bank balance in WEEKS.
    Mirrors: calculateTimeBankBalance() in dateUtils.ts

    Positive → credit weeks (ahead of schedule).
    Negative → weeks of work still owed.
    """
    if effective_weekly_goal <= 0 or gross_total <= 0:
        return 0.0

    active_rows = [r for r in rows if r.value > 0]
    if not active_rows:
        return 0.0

    min_date_str = min(r.date for r in active_rows)
    min_date = _parse_date(min_date_str)
    today = date.today()

    elapsed_ms = (today - min_date).days
    elapsed_weeks = max(0, elapsed_ms) // 7

    paid_weeks = gross_total / effective_weekly_goal
    balance = paid_weeks - elapsed_weeks
    return round(balance * 100) / 100
