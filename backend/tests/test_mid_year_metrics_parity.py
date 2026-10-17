"""
Backend Python Parity Tests — Mid-Year Onboarding & 4 Precision Locks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verifies 100% mathematical parity between Backend Python services
(`coin_metrics_engine.py`, `coin_date_utils.py`, `context_builder.py`, `finance_prompts.py`)
and the TypeScript Frontend (`metricsEngine.ts`, `dateUtils.ts`, `localAiAnalystSynthesizer.ts`).
"""

import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.coin_models import TableRow, TableGoals, GoalProfile, EntryType
from services.coin_date_utils import (
    resolve_goal_for_year,
    get_weekly_goal_for_date,
    get_daily_goal_for_date,
    get_effective_period_span_days,
)
from services.coin_metrics_engine import compute_metrics
from services.context_builder import _global_day_span, build_category_summaries
from prompts.finance_prompts import (
    get_agent_native_master_prompt,
    get_cfo_fpa_prompt,
    get_operational_godmode_prompt,
    get_goals_timebank_prompt,
    get_developer_script_prompt,
)


def _base_goals() -> TableGoals:
    return TableGoals(
        dailyGoals={2026: 200.0},
        weeklyGoals={2026: 1400.0},
        annualCosts={2026: 36000.0},
        globalGoals=GoalProfile(
            dailyGoal=200.0,
            weeklyGoal=1400.0,
            annualCost=36000.0,
        ),
    )


def test_lock1_mid_year_june_only_full_competence_envelope():
    """
    Scenario 1 (Lock 1): Mid-year onboarding in June only (Day 10 to Day 25)
    uses the full 30-day calendar envelope of June, avoiding 2x daily/annual inflation
    and avoiding 4x early-month spikes when as_of_date is early in the month.
    """
    june_rows = [
        TableRow(
            id="rev_jun_1",
            date="2026-06-10",
            value=3000.0,
            entryType=EntryType.REVENUE,
            category="CONSULTORIA",
            description="Projeto Etapa 1",
        ),
        TableRow(
            id="rev_jun_2",
            date="2026-06-25",
            value=3000.0,
            entryType=EntryType.REVENUE,
            category="CONSULTORIA",
            description="Projeto Etapa 2",
        ),
        TableRow(
            id="exp_jun_1",
            date="2026-06-10",
            value=1800.0,
            entryType=EntryType.EXPENSE,
            category="ALUGUEL",
            description="Aluguel Operacional",
        ),
        TableRow(
            id="exp_jun_2",
            date="2026-06-25",
            value=1200.0,
            entryType=EntryType.EXPENSE,
            category="INFRAESTRUTURA",
            description="Servidores e Links",
        ),
    ]

    goals = _base_goals()

    # Early month check (2026-06-07): must still use 30 days in June, never 7 elapsed days
    m_early = compute_metrics(june_rows, goals, as_of_date="2026-06-07")
    assert m_early.by_month["2026-06"].daily_avg == 200.0
    assert m_early.by_month["2026-06"].weekly_avg == 1400.0

    m = compute_metrics(june_rows, goals, as_of_date="2026-06-30")
    assert m.gross_total == 6000.0
    assert m.total_expenses == 3000.0

    # Revenue averages reconcile 100% with June competence (30 days, 1 active month)
    assert m.global_daily_avg == 200.0
    assert m.global_weekly_avg == 1400.0
    assert m.global_monthly_avg == 6000.0
    assert m.global_annual_avg == 72000.0
    assert m.by_year["2026"].daily_avg == 200.0
    assert m.by_year["2026"].weekly_avg == 1400.0
    assert m.by_year["2026"].monthly_avg == 6000.0
    assert m.global_monthly_avg == m.by_year["2026"].monthly_avg

    # Survival / Break-Even averages reconcile 100% with June expenses
    assert m.survival_daily == 100.0
    assert m.survival_weekly == 700.0
    assert m.survival_monthly == 3000.0
    assert m.survival_annual_cost == 36000.0


def test_lock1_sparse_months_march_and_october_no_gap_dilution():
    """
    Scenario 2 (Lock 1): Sparse months with intermediate empty months (March + October)
    uses 62 active competence days (31 + 31), never 245 continuous days.
    """
    sparse_rows = [
        TableRow(
            id="rev_mar",
            date="2026-03-15",
            value=6200.0,
            entryType=EntryType.REVENUE,
            category="VENDAS",
            description="Vendas de Serviços",
        ),
        TableRow(
            id="rev_oct",
            date="2026-10-20",
            value=6200.0,
            entryType=EntryType.REVENUE,
            category="VENDAS",
            description="Vendas de Serviços",
        ),
        TableRow(
            id="exp_mar",
            date="2026-03-10",
            value=3100.0,
            entryType=EntryType.EXPENSE,
            category="OPERACIONAL",
            description="Custo Operacional",
        ),
        TableRow(
            id="exp_oct",
            date="2026-10-10",
            value=3100.0,
            entryType=EntryType.EXPENSE,
            category="OPERACIONAL",
            description="Custo Operacional",
        ),
    ]

    assert get_effective_period_span_days({"2026-03", "2026-10"}) == 62
    assert _global_day_span(sparse_rows) == 62

    m = compute_metrics(sparse_rows, _base_goals(), as_of_date="2026-10-31")
    assert m.gross_total == 12400.0
    assert m.total_expenses == 6200.0
    assert m.global_daily_avg == 200.0
    assert m.global_weekly_avg == 1400.0
    assert m.global_monthly_avg == 6200.0
    assert m.global_annual_avg == 74400.0
    assert m.by_year["2026"].monthly_avg == 6200.0

    assert m.survival_daily == 100.0
    assert m.survival_weekly == 700.0
    assert m.survival_monthly == 3100.0
    assert m.survival_annual_cost == 37200.0

    cat_summary = build_category_summaries(sparse_rows, globalDaySpan=62)
    assert "Diária R$ 200.00" in cat_summary
    assert "Semanal R$ 1,400.00" in cat_summary


def test_lock4_mixed_keys_and_hierarchical_time_bank_balance():
    """
    Scenario 4 (Lock 4):
    - resolve_goal_for_year handles mixed int/str keys ("2026-W10", "global") without TypeError.
    - compute_metrics uses get_weekly_goal_for_date for time_bank_balance even when legacy
      weekly_goals is empty and only global_goals / monthly_goals are configured.
    """
    mixed_goals_dict = {
        2025: 1000.0,
        "2026": 1400.0,
        "2026-W10": 2100.0,
        "global": 1200.0,
    }
    assert resolve_goal_for_year(mixed_goals_dict, 2026) == 1400.0
    assert resolve_goal_for_year(mixed_goals_dict, 2027) == 1400.0
    assert resolve_goal_for_year(mixed_goals_dict, 2024) == 1000.0

    hierarchical_only_goals = TableGoals(
        dailyGoals={},
        weeklyGoals={},
        annualCosts={},
        globalGoals=GoalProfile(
            dailyGoal=200.0,
            weeklyGoal=1400.0,
            annualCost=36000.0,
        ),
        monthlyGoals={
            "2026-06": GoalProfile(
                dailyGoal=300.0,
                weeklyGoal=2100.0,
                annualCost=48000.0,
            ),
        },
    )

    assert get_weekly_goal_for_date("2026-06-15", hierarchical_only_goals) == 2100.0
    assert get_daily_goal_for_date("2026-06-15", hierarchical_only_goals) == 300.0

    rows = [
        TableRow(
            id="r1",
            date="2026-06-03",
            value=4200.0,
            entryType=EntryType.REVENUE,
            category="VENDAS",
            description="Receita Junho",
        ),
    ]
    m = compute_metrics(rows, hierarchical_only_goals, as_of_date="2026-06-07")
    # 1 elapsed week with 2100 goal -> global_goal_balance = 4200 - 2100 = +2100 -> time_bank_balance = +1.00 week
    assert m.global_goal_balance == 2100.0
    assert m.time_bank_balance == 1.0


def test_lock4_all_5_specialist_agent_profiles():
    """Verifies all 5 specialist agent prompt builders return non-empty, domain-specific prompts."""
    p_native = get_agent_native_master_prompt("https://api.example.com")
    p_cfo = get_cfo_fpa_prompt("https://api.example.com")
    p_ops = get_operational_godmode_prompt("https://api.example.com")
    p_goals = get_goals_timebank_prompt("https://api.example.com")
    p_dev = get_developer_script_prompt("https://api.example.com")

    for prompt in (p_native, p_cfo, p_ops, p_goals, p_dev):
        assert isinstance(prompt, str)
        assert len(prompt) > 500
        assert "/api/v1/public/ai-analyst" in prompt


if __name__ == "__main__":
    tests = [
        test_lock1_mid_year_june_only_full_competence_envelope,
        test_lock1_sparse_months_march_and_october_no_gap_dilution,
        test_lock4_mixed_keys_and_hierarchical_time_bank_balance,
        test_lock4_all_5_specialist_agent_profiles,
    ]
    for t in tests:
        t()
        print(f"  [PASS] {t.__name__}")
    print(f"\nAll {len(tests)} Python backend parity tests passed successfully!")

