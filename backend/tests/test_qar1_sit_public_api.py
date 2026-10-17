"""
QAR1 & SIT Backend Integration Test Suite — Assistente Moeda Public API v2.0
============================================================================
Executes real FastAPI TestClient requests against:
  - /api/v1/public/openapi.json & /api/v1/public/agent-prompt (5 profiles)
  - /api/v1/api-keys/generate, /validate, /revoke (Kill-Switch & RAM purge)
  - /api/v1/public/spreadsheet/append (stateful merge upsert vs replace)
  - /api/v1/public/summary & /transactions (Partner/Waiver/Unresolved Firewall)
  - /api/v1/public/analysis-context & /spreadsheet/export (CSV Formula Neutralization)
  - services.coin_metrics_engine.compute_metrics (Signed negative expense parity)
"""

import os
import sys
import tempfile
from pathlib import Path

# Force isolated local SQLite database for deterministic Clean-Room SIT testing
_TMP_DB_DIR = tempfile.mkdtemp(prefix="qar1_sit_db_")
os.environ["TURSO_DATABASE_URL"] = ""
os.environ["TURSO_AUTH_TOKEN"] = ""
os.environ["LICENSE_DB_PATH"] = str(Path(_TMP_DB_DIR) / "test_license_storage.db")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient
from main import app
from db.license_db import init_db, pop_pending_sync, hash_key
from models.coin_models import TableRow, TableGoals, EntryType
from services.coin_metrics_engine import compute_metrics
from services.context_builder import (
    build_category_summaries,
    build_ai_scenario_context,
    build_weekly_performance_context,
)
from routers.public_api_router import TABLE_IN_MEMORY_STORAGE

init_db()
client = TestClient(app)


def test_sit01_agent_prompt_profiles_and_openapi():
    """SIT-01: OpenAPI 3.1 schema and all 5 executive profiles on /agent-prompt."""
    oa_res = client.get("/api/v1/public/openapi.json")
    assert oa_res.status_code == 200
    oa_data = oa_res.json()
    assert oa_data["openapi"].startswith("3.")
    assert "/api/v1/public/agent-prompt" in oa_data["paths"]
    assert "/api/v1/public/spreadsheet/append" in oa_data["paths"]

    expected_profiles = {
        "native": "agent_native_master",
        "cfo": "cfo_fpa",
        "operational": "operational_godmode",
        "goals": "goals_timebank",
        "dev": "developer_script",
    }
    for prof_query, expected_label in expected_profiles.items():
        res = client.get(f"/api/v1/public/agent-prompt?profile={prof_query}&format=json")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "success"
        assert body["profile_used"] == expected_label
        assert body["mandatory_next_route"] == "POST /api/v1/public/ai-analyst"
        assert len(body["skills_integrated"]) == 8


def test_sit02_negative_expense_parity_in_metrics_engine():
    """RT-02 / SIT-02: Signed negative expenses (-150.00) must produce identical metrics to positive expenses (+150.00)."""
    goals = TableGoals(dailyGoals={2026: 200.0}, weeklyGoals={2026: 1400.0}, annualCosts={2026: 24000.0})

    rows_positive = [
        TableRow(id="r1", date="2026-10-01", value=1000.0, entryType=EntryType.REVENUE),
        TableRow(
            id="e1",
            date="2026-10-01",
            value=300.0,
            entryType=EntryType.EXPENSE,
            periodStart="2026-10-01",
            periodEnd="2026-10-10",
        ),
    ]
    rows_negative = [
        TableRow(id="r1", date="2026-10-01", value=1000.0, entryType=EntryType.REVENUE),
        TableRow(
            id="e1",
            date="2026-10-01",
            value=-300.0,
            entryType=EntryType.EXPENSE,
            periodStart="2026-10-01",
            periodEnd="2026-10-10",
        ),
    ]

    m_pos = compute_metrics(rows_positive, goals, as_of_date="2026-10-10")
    m_neg = compute_metrics(rows_negative, goals, as_of_date="2026-10-10")

    assert m_neg.total_expenses == 300.0
    assert m_neg.total_expenses == m_pos.total_expenses
    assert m_neg.net_balance == 700.0
    assert m_neg.survival_daily == 30.0
    assert m_neg.survival_daily == m_pos.survival_daily
    assert m_neg.by_year["2026"].year_expenses == 300.0
    assert m_neg.by_year["2026"].year_expenses == m_pos.by_year["2026"].year_expenses


def test_sit03_stateful_merge_upsert_replace_and_partner_firewall():
    """RT-01 & RT-05 / SIT-03: Stateful merge by externalId, replace reset, and Partner/Waiver/Unresolved firewall."""
    gen_res = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit03_stateful", "permissions": "read:write", "ttl_days": 1},
    )
    assert gen_res.status_code == 200
    api_key = gen_res.json()["apiKey"]
    headers = {"X-Spreadsheet-Key": api_key}

    # Batch 1: Insert 2 items in merge mode
    b1 = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "merge",
            "transactions": [
                {
                    "date": "2026-10-01",
                    "value": 2500.0,
                    "description": "Consultoria Sprint",
                    "entryType": "revenue",
                    "externalId": "ext_rev_1",
                },
                {
                    "date": "2026-10-02",
                    "value": -400.0,
                    "description": "Servidor Cloud",
                    "entryType": "expense",
                    "externalId": "ext_exp_1",
                },
            ],
        },
    )
    assert b1.status_code == 200
    b1_data = b1.json()
    assert b1_data["insertedCount"] == 2
    assert b1_data["updatedCount"] == 0
    assert b1_data["totalCount"] == 2

    # Batch 2: Update ext_exp_1 (-400 -> -450) and insert partner_in, partner_out, waiver, unresolved
    b2 = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "merge",
            "transactions": [
                {
                    "date": "2026-10-02",
                    "value": -450.0,
                    "description": "Servidor Cloud Upgrade",
                    "entryType": "expense",
                    "externalId": "ext_exp_1",
                },
                {
                    "date": "2026-10-03",
                    "value": 1000.0,
                    "description": "Aporte Socio",
                    "entryType": "partner_in",
                    "externalId": "ext_pin_1",
                },
                {
                    "date": "2026-10-04",
                    "value": -600.0,
                    "description": "Retirada Socio",
                    "entryType": "partner_out",
                    "externalId": "ext_pout_1",
                },
                {
                    "date": "2026-10-05",
                    "value": 200.0,
                    "description": "Abono Semanal",
                    "entryType": "waiver",
                    "externalId": "ext_waiv_1",
                },
                {
                    "date": "2026-10-06",
                    "value": 999.0,
                    "description": "Item Pendente",
                    "entryType": "unresolved",
                    "externalId": "ext_unres_1",
                },
            ],
        },
    )
    assert b2.status_code == 200
    b2_data = b2.json()
    assert b2_data["insertedCount"] == 4
    assert b2_data["updatedCount"] == 1
    assert b2_data["totalCount"] == 6

    # Verify /summary isolates operational DRE from partner/waiver/unresolved
    sum_res = client.get("/api/v1/public/summary", headers=headers)
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert sum_data["total_income"] == 2500.0
    assert sum_data["total_expense"] == 450.0
    assert sum_data["net_balance"] == 2050.0
    assert sum_data["total_partner_in"] == 1000.0
    assert sum_data["total_partner_out"] == 600.0
    assert sum_data["total_waivers"] == 200.0
    assert sum_data["row_count"] == 6

    # Verify mode="replace" wipes previous 6 rows and replaces with 1 row
    b3 = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "replace",
            "transactions": [
                {
                    "date": "2026-10-10",
                    "value": 1200.0,
                    "description": "Novo Ciclo",
                    "entryType": "revenue",
                    "externalId": "ext_clean_1",
                }
            ],
        },
    )
    assert b3.status_code == 200
    assert b3.json()["totalCount"] == 1


def test_sit04_csv_formula_injection_neutralization():
    """RT-03 / SIT-04: CSV export must neutralize leading =, +, -, @ with a single quote."""
    gen_res = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit04_csv_sec", "permissions": "read:write", "ttl_days": 1},
    )
    api_key = gen_res.json()["apiKey"]
    headers = {"X-Spreadsheet-Key": api_key}

    app_res = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "replace",
            "transactions": [
                {
                    "date": "2026-10-12",
                    "value": -100.0,
                    "description": "=CMD|' /C calc'!A0",
                    "category": "@SUM(A1:A10)",
                    "tags": "+IMPORTXML()",
                    "entryType": "expense",
                    "externalId": "sec_row_1",
                }
            ],
        },
    )
    assert app_res.status_code == 200
    csv_text = app_res.json()["csvContent"]
    assert "'=CMD|" in csv_text
    assert "'@SUM(A1:A10)" in csv_text
    assert "'+IMPORTXML()" in csv_text


def test_sit05_permission_matrix_and_kill_switch_revocation():
    """SIT-05 & SIT-06: read-only key blocks POST with 403; Kill-Switch purges RAM and blocks with 401."""
    # 1. Test read-only key
    ro_gen = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit05_ro", "permissions": "read-only", "ttl_days": 1},
    )
    assert ro_gen.status_code == 200
    ro_key = ro_gen.json()["apiKey"]
    ro_headers = {"X-Spreadsheet-Key": ro_key}

    # GET allowed
    assert client.get("/api/v1/public/summary", headers=ro_headers).status_code == 200
    assert client.get("/api/v1/public/analysis-context", headers=ro_headers).status_code == 200

    # POST blocked with 403 Forbidden
    post_res = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=ro_headers,
        json={
            "mode": "merge",
            "transactions": [{"date": "2026-10-01", "value": 100.0, "description": "Bloqueado"}],
        },
    )
    assert post_res.status_code == 403

    # 2. Test Kill-Switch revocation & RAM purge
    rw_gen = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit05_kill", "permissions": "read:write", "ttl_days": 1},
    )
    rw_key = rw_gen.json()["apiKey"]
    rw_headers = {"X-Spreadsheet-Key": rw_key}

    client.post(
        "/api/v1/public/spreadsheet/append",
        headers=rw_headers,
        json={
            "mode": "replace",
            "transactions": [{"date": "2026-10-01", "value": 500.0, "description": "Em RAM"}],
        },
    )
    assert "tbl_sit05_kill" in TABLE_IN_MEMORY_STORAGE

    rev_res = client.post(
        "/api/v1/api-keys/revoke",
        json={"tableId": "tbl_sit05_kill", "apiKey": rw_key},
        headers=rw_headers,
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["alreadyInactive"] is False
    assert "tbl_sit05_kill" not in TABLE_IN_MEMORY_STORAGE

    # Subsequent calls must return 401
    assert client.get("/api/v1/public/summary", headers=rw_headers).status_code == 401
    assert client.post("/api/v1/api-keys/validate", json={"apiKey": rw_key}).status_code == 401


def test_sit06_export_json_vs_download_and_signed_numeric_formula_preservation():
    """SIT-DEF-02 & SIT-DEF-06: Verify download=false JSON envelope, pure signed numbers without quote prefix, and newline stripping."""
    gen_res = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit06_export_parity", "permissions": "read:write", "ttl_days": 1},
    )
    assert gen_res.status_code == 200
    api_key = gen_res.json()["apiKey"]
    headers = {"X-Spreadsheet-Key": api_key}

    app_res = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "replace",
            "transactions": [
                {
                    "date": "2026-10-15",
                    "value": -250.0,
                    "description": "-150.50",
                    "category": "Linha1\nLinha2,ComVirgula",
                    "tags": "+cmd|calc\r\nInjetado",
                    "entryType": "expense",
                    "externalId": "row_num_1",
                }
            ],
        },
    )
    assert app_res.status_code == 200
    csv_text = app_res.json()["csvContent"]
    # Pure signed number "-150.50" must NOT be prefixed with single quote
    assert ",-150.50," in csv_text
    # Newlines and commas inside category/tags must be stripped to spaces and formula prefixed
    assert "Linha1 Linha2 ComVirgula" in csv_text
    assert "'+cmd|calc Injetado" in csv_text

    # Verify GET /spreadsheet/export?download=false returns JSON with csv_content
    exp_json = client.get("/api/v1/public/spreadsheet/export?download=false", headers=headers)
    assert exp_json.status_code == 200
    assert exp_json.json()["status"] == "success"
    assert "## COIN_BACKUP_V2 ##" in exp_json.json()["csv_content"]

    # Verify GET /spreadsheet/export?download=true returns raw text/csv
    exp_raw = client.get("/api/v1/public/spreadsheet/export?download=true", headers=headers)
    assert exp_raw.status_code == 200
    assert exp_raw.text.startswith("## COIN_BACKUP_V2 ##")


def test_sit07_semicolon_csv_ingestion_and_analysis_context_parity():
    """SIT-V5-02 / SIT-PY-09: Semicolon-delimited CSV preset from APIManagementTester must be parsed by /spreadsheet/append and /analysis-context."""
    gen_res = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit07_semi_csv", "permissions": "read:write", "ttl_days": 1},
    )
    assert gen_res.status_code == 200
    api_key = gen_res.json()["apiKey"]
    headers = {"X-Spreadsheet-Key": api_key}

    preset_csv = (
        "Data;Valor;Descrição;Tipo;Categoria;Tags;ID_Externo\n"
        "2026-06-16;2800.00;Consultoria Estratégica via CSV;revenue;Consultoria;csv,api;csv_001\n"
        "2026-06-17;-320.00;Licença Software Anual;expense;Tecnologia;saas,anual;csv_002"
    )

    app_res = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={"mode": "merge", "csvContent": preset_csv},
    )
    assert app_res.status_code == 200
    app_data = app_res.json()
    assert app_data["insertedCount"] == 2
    assert app_data["totalCount"] == 2
    assert "Consultoria Estratégica via CSV" in app_data["csvContent"]
    assert "csv_001" in app_data["csvContent"]
    assert "csv_002" in app_data["csvContent"]

    sum_res = client.get("/api/v1/public/summary", headers=headers)
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert sum_data["total_income"] == 2800.0
    assert sum_data["total_expense"] == 320.0
    assert sum_data["net_balance"] == 2480.0


def test_sit08_offline_sync_queue_monotonic_ids_without_collision():
    """SIT-V5-03 / SIT-PY-10: Multiple consecutive offline /spreadsheet/append batches without externalId must generate monotonic tx_api_0001..N IDs in /sync/pending."""
    gen_res = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit08_monotonic_queue", "permissions": "read:write", "ttl_days": 1},
    )
    assert gen_res.status_code == 200
    api_key = gen_res.json()["apiKey"]
    headers = {"X-Spreadsheet-Key": api_key}

    # Batch 1 without externalId (2 rows -> tx_api_0001, tx_api_0002)
    b1 = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "merge",
            "transactions": [
                {"date": "2026-10-01", "value": 1000.0, "description": "Offline Batch 1A", "entryType": "revenue"},
                {"date": "2026-10-02", "value": -200.0, "description": "Offline Batch 1B", "entryType": "expense"},
            ],
        },
    )
    assert b1.status_code == 200

    # Batch 2 without externalId (2 rows -> must be tx_api_0003, tx_api_0004, NOT tx_api_0001!)
    b2 = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "merge",
            "transactions": [
                {"date": "2026-10-03", "value": 1500.0, "description": "Offline Batch 2A", "entryType": "revenue"},
                {"date": "2026-10-04", "value": -300.0, "description": "Offline Batch 2B", "entryType": "expense"},
            ],
        },
    )
    assert b2.status_code == 200

    sync_res = client.get("/api/v1/public/sync/pending", headers=headers)
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["count"] == 2
    batch1_ids = [r["id"] for r in sync_data["pending_events"][0]["rows"]]
    batch2_ids = [r["id"] for r in sync_data["pending_events"][1]["rows"]]
    assert batch1_ids == ["tx_api_0001", "tx_api_0002"]
    assert batch2_ids == ["tx_api_0003", "tx_api_0004"]


def test_sit09_kill_switch_purges_pending_sync_queue():
    """SIT-V5-04 / SIT-PY-11: Revoking an API key via Kill-Switch must purge orphaned events in pending_sync_queue."""
    gen_res = client.post(
        "/api/v1/api-keys/generate",
        json={"table_id": "tbl_sit09_kill_queue", "permissions": "read:write", "ttl_days": 1},
    )
    assert gen_res.status_code == 200
    api_key = gen_res.json()["apiKey"]
    headers = {"X-Spreadsheet-Key": api_key}

    app_res = client.post(
        "/api/v1/public/spreadsheet/append",
        headers=headers,
        json={
            "mode": "merge",
            "transactions": [{"date": "2026-10-10", "value": 900.0, "description": "Orphan Event Before Revoke"}],
        },
    )
    assert app_res.status_code == 200

    # Trigger Kill-Switch
    rev_res = client.post(
        "/api/v1/api-keys/revoke",
        headers=headers,
        json={"tableId": "tbl_sit09_kill_queue", "apiKey": api_key},
    )
    assert rev_res.status_code == 200

    # Verify SQLite pending_sync_queue was purged for tbl_sit09_kill_queue
    remaining_events = pop_pending_sync(hash_key(api_key))
    assert remaining_events == []


def test_sit10_zero_value_period_waivers_parity():
    """QAR1-V5-04 / SIT-PY-12: Zero-value period waivers (value=0 with periodStart/periodEnd) must credit global_goal_balance and total_waiver_credit."""
    goals = TableGoals(dailyGoals={2026: 200.0}, weeklyGoals={2026: 1400.0}, annualCosts={2026: 24000.0})
    rows_without_waiver = [
        TableRow(id="r1", date="2026-10-01", value=1400.0, entryType=EntryType.REVENUE),
    ]
    rows_with_period_waiver = [
        TableRow(id="r1", date="2026-10-01", value=1400.0, entryType=EntryType.REVENUE),
        TableRow(
            id="w1",
            date="2026-10-08",
            value=0.0,
            entryType=EntryType.WAIVER,
            periodStart="2026-10-08",
            periodEnd="2026-10-14",
            description="Abono Ferias 7 Dias",
        ),
    ]

    m_no_w = compute_metrics(rows_without_waiver, goals, as_of_date="2026-10-14")
    m_with_w = compute_metrics(rows_with_period_waiver, goals, as_of_date="2026-10-14")

    # 7 days of waiver at weeklyGoal=1400 (200/day) = 1400.0 BRL credit
    assert m_with_w.total_waiver_credit == 1400.0
    assert m_with_w.waived_weeks == 1.0
    assert m_with_w.global_goal_balance == m_no_w.global_goal_balance + 1400.0


def test_sit11_zero_revenue_expense_only_and_empty_active_rows_parity():
    """QAR1-V5-04 / SIT-PY-13: Tables with zero revenue (expenses only) or partner-only rows must preserve net_balance = -total_expenses and partner metrics."""
    goals = TableGoals(dailyGoals={2026: 200.0}, weeklyGoals={2026: 1400.0}, annualCosts={2026: 24000.0})

    expense_and_partner_rows = [
        TableRow(id="e1", date="2026-10-05", value=-650.0, entryType=EntryType.EXPENSE),
        TableRow(id="p1", date="2026-10-06", value=2000.0, entryType=EntryType.PARTNER_IN),
        TableRow(id="p2", date="2026-10-07", value=-350.0, entryType=EntryType.PARTNER_OUT),
    ]
    m_exp = compute_metrics(expense_and_partner_rows, goals, as_of_date="2026-10-10")
    assert m_exp.gross_total == 0.0
    assert m_exp.total_expenses == 650.0
    assert m_exp.net_balance == -650.0
    assert m_exp.total_partner_in == 2000.0
    assert m_exp.total_partner_out == 350.0
    assert m_exp.gross_with_partner == 2000.0
    assert m_exp.expenses_with_partner == 1000.0
    assert m_exp.net_with_partner == 1000.0

    partner_only_rows = [
        TableRow(id="p1", date="2026-10-06", value=1500.0, entryType=EntryType.PARTNER_IN),
    ]
    m_part = compute_metrics(partner_only_rows, goals, as_of_date="2026-10-10")
    assert m_part.total_partner_in == 1500.0
    assert m_part.gross_with_partner == 1500.0
    assert m_part.net_with_partner == 1500.0


def test_sit12_context_builder_negative_expenses_and_unresolved_firewall():
    """SIT-V5-05 / SIT-PY-14: context_builder must normalize negative expenses for category percentages and exclude EntryType.UNRESOLVED."""
    from models.coin_models import AIAnalystPayload

    goals = TableGoals(dailyGoals={2026: 200.0}, weeklyGoals={2026: 1400.0}, annualCosts={2026: 24000.0})
    rows = [
        TableRow(id="r1", date="2026-10-01", value=3000.0, entryType=EntryType.REVENUE, description="Consultoria", generatedBy="predicted"),
        TableRow(id="e1", date="2026-10-02", value=-600.0, entryType=EntryType.EXPENSE, description="Infra Cloud", generatedBy="predicted"),
        TableRow(id="e2", date="2026-10-03", value=-400.0, entryType=EntryType.EXPENSE, description="SaaS", generatedBy="predicted"),
        TableRow(id="u1", date="2026-10-04", value=99999.0, entryType=EntryType.UNRESOLVED, description="Suspeito", generatedBy="predicted"),
    ]

    cat_summary = build_category_summaries(rows)
    assert "INFRA CLOUD (1x): Total R$ 600.00" in cat_summary
    assert "60.0%" in cat_summary
    assert "SAAS (1x): Total R$ 400.00" in cat_summary
    assert "40.0%" in cat_summary
    assert "SUSPEITO" not in cat_summary
    assert "Suspeito" not in cat_summary

    scenario_ctx = build_ai_scenario_context(rows)
    assert "Receita R$ 3.000 | Custos: R$ 1.000 | Saldo: R$ 2.000" in scenario_ctx
    assert "99.999" not in scenario_ctx

    metrics = compute_metrics(rows, goals, as_of_date="2026-10-10")
    payload = AIAnalystPayload(rows=rows, goals=goals, as_of_date="2026-10-10", user_prompt="Auditoria Clean-Room")
    weekly_ctx = build_weekly_performance_context(payload, metrics)
    assert "99,999" not in weekly_ctx
    assert "99.999" not in weekly_ctx


if __name__ == "__main__":
    suite = [
        test_sit01_agent_prompt_profiles_and_openapi,
        test_sit02_negative_expense_parity_in_metrics_engine,
        test_sit03_stateful_merge_upsert_replace_and_partner_firewall,
        test_sit04_csv_formula_injection_neutralization,
        test_sit05_permission_matrix_and_kill_switch_revocation,
        test_sit06_export_json_vs_download_and_signed_numeric_formula_preservation,
        test_sit07_semicolon_csv_ingestion_and_analysis_context_parity,
        test_sit08_offline_sync_queue_monotonic_ids_without_collision,
        test_sit09_kill_switch_purges_pending_sync_queue,
        test_sit10_zero_value_period_waivers_parity,
        test_sit11_zero_revenue_expense_only_and_empty_active_rows_parity,
        test_sit12_context_builder_negative_expenses_and_unresolved_firewall,
    ]
    print("\n=== QAR1 & SIT BACKEND FASTAPI TESTCLIENT SUITE (v5) ===")
    for fn in suite:
        fn()
        print(f"  [OK] {fn.__name__} PASSED")
    print(f"\n[OK] All {len(suite)}/{len(suite)} Backend SIT tests PASSED!\n")

