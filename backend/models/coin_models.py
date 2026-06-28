"""
CoinAssistant — Pydantic Data Contract
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mirrors the TypeScript interfaces from:
  src/tools/CoinAssistant/types.ts

Every model here is a 1:1 translation of the frontend type system.
The frontend sends its localStorage data to the API as a JSON payload;
these models validate and parse that payload with zero ambiguity.

Key design decisions:
  - entry_type uses a Python StrEnum (not Literal) for extensibility.
  - All monetary values are float (R$ with centavos), never int.
  - Date strings remain "YYYY-MM-DD" — parsed/validated by regex,
    not converted to datetime, so the engine logic matches TS exactly.
  - Optional fields use `None` default, matching TS `undefined`.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Optional, Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Enums ────────────────────────────────────────────────────────────────────


class EntryType(StrEnum):
    """Matches frontend: 'revenue' | 'deposit' | 'waiver' | 'expense' | 'partner_in' | 'partner_out'."""

    REVENUE = "revenue"
    DEPOSIT = "deposit"
    WAIVER = "waiver"
    EXPENSE = "expense"
    PARTNER_IN = "partner_in"
    PARTNER_OUT = "partner_out"


# ── Goal Hierarchy ───────────────────────────────────────────────────────────


class GoalProfile(BaseModel):
    """
    A complete set of financial targets for a single scope (global, year, or month).
    Mirrors: interface GoalProfile in types.ts.
    """

    daily_goal: float = Field(..., alias="dailyGoal", description="Daily revenue target (R$)")
    weekly_goal: float = Field(..., alias="weeklyGoal", description="Weekly revenue target (R$)")
    annual_cost: float = Field(..., alias="annualCost", description="Annual vehicle/operating cost (R$)")

    model_config = {"populate_by_name": True}


class CostBasedTarget(BaseModel):
    """
    Cost-based survival targets derived from expense data.
    Never persisted — always computed on the fly.
    Mirrors: interface CostBasedTarget in types.ts.
    """

    weekly_survival: float = Field(..., alias="weeklySurvival")
    daily_survival: float = Field(..., alias="dailySurvival")
    monthly_survival: float = Field(..., alias="monthlySurvival")
    annual_cost: float = Field(..., alias="annualCost")

    model_config = {"populate_by_name": True}


# ── Persisted Data ───────────────────────────────────────────────────────────


class TableRow(BaseModel):
    """
    A single ledger entry.
    Mirrors: interface TableRow in types.ts.

    The `id` field is present in persisted data but NOT required in API input
    (the backend never stores rows — stateless architecture).
    """

    id: Optional[str] = Field(default=None, description="UUID — optional in API payloads")
    date: str = Field(
        ...,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Entry date in YYYY-MM-DD format",
    )
    value: float = Field(..., ge=0, description="Monetary value (R$) — meaning depends on entryType")
    description: Optional[str] = Field(default=None)
    entry_type: EntryType = Field(
        default=EntryType.REVENUE,
        alias="entryType",
        description="revenue | deposit | waiver | expense",
    )
    monthly_value: Optional[float] = Field(
        default=None,
        alias="monthlyValue",
        description="For 'expense' entries — the monthly cost amount (R$)",
    )
    month_count: Optional[int] = Field(
        default=None,
        alias="monthCount",
        ge=1,
        description="For 'expense' entries — how many months this cost spans",
    )
    period_start: Optional[str] = Field(
        default=None,
        alias="periodStart",
        description="Period start date (YYYY-MM-DD) — for distributed revenue",
    )
    period_end: Optional[str] = Field(
        default=None,
        alias="periodEnd",
        description="Period end date (YYYY-MM-DD) — must pair with periodStart",
    )
    generated_by: Optional[str] = Field(
        default=None,
        alias="generatedBy",
        description="'predicted' | 'cloned' — marks synthetic rows from the prediction engine",
    )
    cloned_from: Optional[str] = Field(
        default=None,
        alias="clonedFrom",
        description="Audit trail: source YYYY-MM from which this cloned row was copied",
    )
    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def clean_empty_periods(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k in ["period_start", "periodStart"]:
                if k in data and (data[k] == "" or data[k] is None):
                    data[k] = None
            for k in ["period_end", "periodEnd"]:
                if k in data and (data[k] == "" or data[k] is None):
                    data[k] = None
        return data


class TableGoals(BaseModel):
    """
    Financial goal configuration.
    Mirrors: interface TableGoals in types.ts.

    The flat per-year Records (dailyGoals, weeklyGoals, annualCosts) are the
    legacy format kept for backward compatibility with calculateStrictGlobalBalance.
    The new hierarchical system (globalGoals → yearlyGoals → monthlyGoals) adds
    finer granularity without replacing the legacy fields.
    """

    # Legacy flat records — per-year keyed
    daily_goals: dict[int, float] = Field(
        default_factory=dict,
        alias="dailyGoals",
        description="Per-year daily revenue target: { 2026: 86.00 }",
    )
    weekly_goals: dict[int, float] = Field(
        default_factory=dict,
        alias="weeklyGoals",
        description="Per-year weekly revenue target: { 2026: 600.00 }",
    )
    annual_costs: dict[int, float] = Field(
        default_factory=dict,
        alias="annualCosts",
        description="Per-year vehicle/operating cost: { 2026: 34736.50 }",
    )

    # New hierarchical goal system
    global_goals: Optional[GoalProfile] = Field(
        default=None,
        alias="globalGoals",
        description="Ultimate fallback — applied when no year/month override exists",
    )
    yearly_goals: Optional[dict[int, GoalProfile]] = Field(
        default=None,
        alias="yearlyGoals",
        description="Per-year overrides: { 2026: GoalProfile }",
    )
    monthly_goals: Optional[dict[str, GoalProfile]] = Field(
        default=None,
        alias="monthlyGoals",
        description='Per-month overrides: { "2026-05": GoalProfile }',
    )

    model_config = {"populate_by_name": True}

    @field_validator("daily_goals", "weekly_goals", "annual_costs", mode="before")
    @classmethod
    def coerce_string_keys_to_int(cls, v: dict) -> dict[int, float]:
        """
        JSON keys are always strings. The frontend sends { "2026": 600 },
        but our model expects { 2026: 600.0 }. This coerces automatically.
        """
        if isinstance(v, dict):
            return {int(k): float(val) for k, val in v.items()}
        return v

    @field_validator("yearly_goals", mode="before")
    @classmethod
    def coerce_yearly_goals_keys(cls, v: dict | None) -> dict[int, GoalProfile] | None:
        """Same string-to-int key coercion for yearly_goals."""
        if v is None:
            return None
        if isinstance(v, dict):
            return {int(k): (val if isinstance(val, GoalProfile) else GoalProfile(**val)) for k, val in v.items()}
        return v


# ── Computed Metrics (never persisted, always derived) ───────────────────────


class MonthMetrics(BaseModel):
    """Metrics for a single calendar month."""

    gross_monthly: float = Field(..., alias="grossMonthly")
    daily_avg: float = Field(..., alias="dailyAvg")
    weekly_avg: float = Field(..., alias="weeklyAvg")
    last_week_gross: float = Field(..., alias="lastWeekGross")
    daily_payments: dict[str, float] = Field(
        default_factory=dict,
        alias="dailyPayments",
        description='"YYYY-MM-DD" → value',
    )
    investment: Optional[float] = Field(default=None)
    expense: Optional[float] = Field(default=None)

    model_config = {"populate_by_name": True}


class YearMetrics(BaseModel):
    """Metrics for a single calendar year."""

    gross_annual: float = Field(..., alias="grossAnnual")
    year_expenses: float = Field(
        default=0,
        alias="yearExpenses",
        description="Year-scoped expenses: point-in-time full value, multi-year prorated by overlap days",
    )
    daily_avg: float = Field(..., alias="dailyAvg")
    weekly_avg: float = Field(
        ...,
        alias="weeklyAvg",
        description="grossAnnual / active weeks in this year",
    )
    monthly_avg: float = Field(
        ...,
        alias="monthlyAvg",
        description="grossAnnual / active months in this year",
    )

    model_config = {"populate_by_name": True}


class PortfolioTimelinePoint(BaseModel):
    """A single month in the chronological portfolio yield calculation."""

    month: str = Field(..., description="YYYY-MM month key")
    monthly_deposit: float = Field(..., alias="monthlyDeposit")
    current_month_yield: float = Field(..., alias="currentMonthYield")
    accumulated_principal: float = Field(..., alias="accumulatedPrincipal")
    accumulated_yield: float = Field(..., alias="accumulatedYield")
    total_balance: float = Field(..., alias="totalBalance")

    model_config = {"populate_by_name": True}


class TableMetrics(BaseModel):
    """
    Full computed metrics for a table.
    Mirrors: interface TableMetrics in types.ts.

    This is the OUTPUT of the Python metrics engine — the "prepared food"
    that gets injected into the AI context prompt.
    """

    gross_total: float = Field(..., alias="grossTotal")
    global_daily_avg: float = Field(..., alias="globalDailyAvg")
    global_weekly_avg: float = Field(..., alias="globalWeeklyAvg")
    global_monthly_avg: float = Field(..., alias="globalMonthlyAvg")
    global_annual_avg: float = Field(..., alias="globalAnnualAvg")
    global_goal_balance: float = Field(
        ...,
        alias="globalGoalBalance",
        description="Cumulative BRL balance vs goals. Positive = surplus, negative = debt",
    )
    total_elapsed_weeks: int = Field(..., alias="totalElapsedWeeks")
    waived_weeks: float = Field(..., alias="waivedWeeks")
    billable_weeks: float = Field(..., alias="billableWeeks")
    total_waiver_credit: float = Field(..., alias="totalWaiverCredit")
    time_bank_balance: float = Field(
        ...,
        alias="timeBankBalance",
        description="Weeks of credit (+) or debt (−)",
    )
    by_year: dict[str, YearMetrics] = Field(default_factory=dict, alias="byYear")
    by_month: dict[str, MonthMetrics] = Field(default_factory=dict, alias="byMonth")
    by_week: dict[str, float] = Field(default_factory=dict, alias="byWeek")
    total_expenses: float = Field(..., alias="totalExpenses")
    annual_expenses: float = Field(..., alias="annualExpenses")
    net_balance: float = Field(
        ...,
        alias="netBalance",
        description="grossTotal − totalExpenses",
    )

    # ── Survival / Break-Even Goals (always computed) ────────────────────────
    survival_daily: float = Field(
        default=0,
        alias="survivalDaily",
        description="Break-even daily revenue = totalExpenses / globalExpenseDaySpan",
    )
    survival_weekly: float = Field(
        default=0,
        alias="survivalWeekly",
        description="survivalDaily × 7",
    )
    survival_monthly: float = Field(
        default=0,
        alias="survivalMonthly",
        description="survivalDaily × 30.44",
    )
    survival_annual_cost: float = Field(
        default=0,
        alias="survivalAnnualCost",
        description="survivalDaily × 365.25 — projected annual cost burden",
    )

    # ── Investment / Deposit Metrics (compound interest at 0.8%/month) ────────
    deposit_count: int = Field(
        default=0,
        alias="depositCount",
        description="Number of 'deposit' entries",
    )
    total_invested: float = Field(
        default=0,
        alias="totalInvested",
        description="Sum of all deposit row values (user's physical effort)",
    )
    total_interest_earned: float = Field(
        default=0,
        alias="totalInterestEarned",
        description="Total compound interest earned across all months with deposits",
    )
    investment_balance: float = Field(
        default=0,
        alias="investmentBalance",
        description="Current balance: totalInvested + totalInterestEarned",
    )
    global_total_deposited: float = Field(
        default=0.0,
        alias="globalTotalDeposited",
        description="Total deposited by the user",
    )
    global_total_yield: float = Field(
        default=0.0,
        alias="globalTotalYield",
        description="Total accumulated yield",
    )
    global_balance: float = Field(
        default=0.0,
        alias="globalBalance",
        description="Current total balance with interest",
    )
    portfolio_timeline: list[PortfolioTimelinePoint] = Field(
        default_factory=list,
        alias="portfolioTimeline",
        description="Chronological portfolio timeline metrics",
    )

    # ── Advanced Statistics (deterministic, never let the LLM compute) ────────
    max_transaction: float = Field(
        default=0,
        alias="maxTransaction",
        description="Largest single revenue transaction value",
    )
    min_transaction: float = Field(
        default=0,
        alias="minTransaction",
        description="Smallest single revenue transaction value (value > 0)",
    )
    median_transaction: float = Field(
        default=0,
        alias="medianTransaction",
        description="Median revenue transaction value (50th percentile)",
    )
    mode_transaction: float = Field(
        default=0,
        alias="modeTransaction",
        description="Most frequent revenue transaction value. 0 if no repeats",
    )
    std_deviation: float = Field(
        default=0,
        alias="stdDeviation",
        description="Population standard deviation of revenue transaction values",
    )

    # ── Partnership Ledger ────────────────────────────────────────────────
    total_partner_in: float = Field(
        default=0,
        alias="totalPartnerIn",
        description="Sum of all partner_in (credit/reimbursement) row values",
    )
    total_partner_out: float = Field(
        default=0,
        alias="totalPartnerOut",
        description="Sum of all partner_out (debit/charge) row values",
    )

    # ── Combined Metrics (operational + partnership) ──────────────────────────
    gross_with_partner: float = Field(
        default=0,
        alias="grossWithPartner",
        description="grossTotal + totalPartnerIn — full cash inflow picture",
    )
    expenses_with_partner: float = Field(
        default=0,
        alias="expensesWithPartner",
        description="totalExpenses + totalPartnerOut — full cash outflow picture",
    )
    net_with_partner: float = Field(
        default=0,
        alias="netWithPartner",
        description="grossWithPartner − expensesWithPartner — net including partnership",
    )

    # ── Historically-Accumulated Week Equivalents (Time-Aware) ────────────────
    gross_total_weeks: float = Field(
        default=0.0,
        alias="grossTotalWeeks",
        description="Sum of each revenue row's value / activeWeeklyGoal at that date",
    )
    waiver_total_weeks: float = Field(
        default=0.0,
        alias="waiverTotalWeeks",
        description="Same incremental accumulation for waiver credit rows",
    )
    goal_total_weeks: float = Field(
        default=0.0,
        alias="goalTotalWeeks",
        description="Total elapsed calendar weeks scored against goals (= totalElapsedWeeks)",
    )
    net_balance_weeks: float = Field(
        default=0.0,
        alias="netBalanceWeeks",
        description="grossTotalWeeks + waiverTotalWeeks − goalTotalWeeks",
    )

    model_config = {"populate_by_name": True}


# ── Projection Engine ────────────────────────────────────────────────────────


class ProjectionPoint(BaseModel):
    """A single month in the compound interest projection."""

    month: int = Field(..., ge=1, le=360)
    total_deposited: float = Field(..., alias="totalDeposited")
    accumulated_interest: float = Field(..., alias="accumulatedInterest")
    total_balance: float = Field(..., alias="totalBalance")
    monthly_yield: float = Field(
        ...,
        alias="monthlyYield",
        description="Interest earned by accumulated capital this month alone",
    )

    model_config = {"populate_by_name": True}


class ProjectionSummary(BaseModel):
    """End-of-projection summary."""

    final_balance: float = Field(..., alias="finalBalance")
    total_deposited: float = Field(..., alias="totalDeposited")
    total_interest: float = Field(..., alias="totalInterest")
    final_monthly_yield: float = Field(..., alias="finalMonthlyYield")
    multiplier: float

    model_config = {"populate_by_name": True}


# ── API Payload & Response ───────────────────────────────────────────────────


class AIAnalystPayload(BaseModel):
    """
    The complete stateless payload sent by the frontend.

    Contains everything the backend needs to:
      1. Compute metrics (rows + goals)
      2. Build rich AI context (metrics + prompt)
      3. Query the LLM and return a response

    Zero data is stored. The backend is a pure function:
      payload → metrics → context → LLM → response.
    """

    message: str = Field(
        ...,
        alias="userPrompt",
        description="The user's natural language question about their finances",
    )
    tables: list[dict] = Field(
        default_factory=list,
        description="List of all tables / spreadsheets"
    )
    transactions: list[dict] = Field(
        default_factory=list,
        description="List of all transactions"
    )
    user_settings: Optional[dict] = Field(
        default=None,
        alias="userSettings",
        description="Additional configuration like active table index and/or time machine date"
    )

    # Optional fields for backward compatibility or when parsed
    rows: Optional[list[TableRow]] = Field(default=None)
    goals: Optional[TableGoals] = Field(default=None)
    as_of_date: Optional[str] = Field(
        default=None, 
        alias="asOfDate",
        pattern=r"^\d{4}-\d{2}-\d{2}$"
    )
    table_name: Optional[str] = Field(default=None, alias="tableName")
    total_waiver_credits: Optional[float] = Field(default=0.0, alias="totalWaiverCredits")

    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def map_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map userPrompt/user_prompt to message if message is not present
            if "message" not in data:
                if "userPrompt" in data:
                    data["message"] = data["userPrompt"]
                elif "user_prompt" in data:
                    data["message"] = data["user_prompt"]
            # Map userSettings to user_settings if not present
            if "user_settings" not in data and "userSettings" in data:
                data["user_settings"] = data["userSettings"]
            # Map asOfDate to as_of_date if not present
            if "as_of_date" not in data:
                if "asOfDate" in data:
                    data["as_of_date"] = data["asOfDate"]
                elif data.get("user_settings") and isinstance(data["user_settings"], dict):
                    data["as_of_date"] = data["user_settings"].get("asOfDate") or data["user_settings"].get("as_of_date")
        return data


class AIAnalystResponse(BaseModel):
    """Response from the AI Analyst endpoint."""

    analysis: str = Field(
        ...,
        description="The AI-generated financial analysis in Markdown format",
    )
    metrics_snapshot: TableMetrics = Field(
        ...,
        alias="metricsSnapshot",
        description="The computed metrics used as context for the AI response",
    )
    model_used: str = Field(
        ...,
        alias="modelUsed",
        description="Which LLM model generated this analysis",
    )

    model_config = {"populate_by_name": True}
