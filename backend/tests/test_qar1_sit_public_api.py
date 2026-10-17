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
from db.license_db import init_db
from models.coin_models import TableRow, TableGoals, EntryType
from services.coin_metrics_engine import compute_metrics
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


if __name__ == "__main__":
    suite = [
        test_sit01_agent_prompt_profiles_and_openapi,
        test_sit02_negative_expense_parity_in_metrics_engine,
        test_sit03_stateful_merge_upsert_replace_and_partner_firewall,
        test_sit04_csv_formula_injection_neutralization,
        test_sit05_permission_matrix_and_kill_switch_revocation,
    ]
    print("\n=== QAR1 & SIT BACKEND FASTAPI TESTCLIENT SUITE ===")
    for fn in suite:
        fn()
        print(f"  [OK] {fn.__name__} PASSED")
    print(f"\n[OK] All {len(suite)}/{len(suite)} Backend SIT tests PASSED!\n")
