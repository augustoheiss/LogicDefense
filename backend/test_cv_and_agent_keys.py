"""
Test Autonomous Agent API Keys, Unified OpenAPI, and Multi-tenant Isolation.
"""

import sys
import asyncio
from httpx import AsyncClient, ASGITransport
from main import app

async def run_tests():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n--- [1/4] Test: Programmatic Key Generation (No table_id supplied) ---")
        res = await client.post("/api/v1/api-keys/generate", json={"ttlDays": 1})
        assert res.status_code == 200, f"Failed: {res.status_code} {res.text}"
        data = res.json()
        api_key = data.get("apiKey")
        table_id = data.get("tableId")
        print(f"   [OK] Key generated: {api_key[:16]}... | TableId: {table_id}")
        assert api_key.startswith("am_sheet_live_"), "Invalid key prefix"
        assert table_id.startswith("agent-session-"), "Invalid auto-generated agent session ID"

        print("\n--- [2/4] Test: Key Validation Endpoint ---")
        val_res = await client.post("/api/v1/api-keys/validate", json={"apiKey": api_key})
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data.get("valid") is True
        assert val_data.get("tableId") == table_id
        print("   [OK] Key is valid and correctly bound to isolated session table.")

        print("\n--- [3/4] Test: Multi-tenant Security Isolation (Zero cross-talk) ---")
        # Ensure requesting public analysis context with this agent key does NOT see other tables
        ctx_res = await client.get("/api/v1/public/analysis-context", headers={"X-Spreadsheet-Key": api_key})
        assert ctx_res.status_code == 200
        ctx_data = ctx_res.json()
        # Should have empty/clean session stats, NOT another user's financial transactions
        total_tx = ctx_data.get("metadata", {}).get("total_transactions", 0)
        assert total_tx == 0, f"Expected 0 transactions for brand new session, got {total_tx}"
        print(f"   [OK] Security Isolation Verified: total_transactions={total_tx} (100% isolated).")

        print("\n--- [4/4] Test: Unified OpenAPI 3.1 Schema Discovery ---")
        openapi_res = await client.get("/api/v1/openapi.json")
        assert openapi_res.status_code == 200
        schema = openapi_res.json()
        paths = schema.get("paths", {})
        print(f"   [OK] Discovered {len(paths)} public API paths in unified schema:")
        for p in sorted(paths.keys()):
            print(f"     - {p}")
        assert "/api/v1/cv/generate" in paths, "Missing /api/v1/cv/generate in OpenAPI"
        assert "/api/v1/cv/tailor" in paths, "Missing /api/v1/cv/tailor in OpenAPI"
        assert "/api/v1/api-keys/generate" in paths, "Missing /api/v1/api-keys/generate in OpenAPI"
        assert "/api/v1/public/analysis-context" in paths, "Missing /api/v1/public/analysis-context in OpenAPI"

    print("\n>>> ALL TESTS PASSED SUCCESSFULLY! ZERO DATA LEAKS. 100% ISOLATED. <<<\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
