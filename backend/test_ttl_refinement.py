import os
import sys
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

BASE_URL = "http://127.0.0.1:8000"

def test_ttl_refinement():
    print("[1] Generating default 1-day (24h) API key...")
    res1 = requests.post(f"{BASE_URL}/api/v1/api-keys/generate", json={
        "table_id": "test_ttl_refinement_1d",
        "ttl_days": 1
    })
    assert res1.status_code == 200, f"Generate 1d failed: {res1.text}"
    d1 = res1.json()
    exp1_str = d1.get("expiresAt") or d1.get("expires_at")
    assert exp1_str is not None, "expiresAt is missing in response"
    exp1_dt = datetime.fromisoformat(exp1_str.replace("Z", "+00:00"))
    now_dt = datetime.now(timezone.utc)
    diff_hours_1 = (exp1_dt - now_dt).total_seconds() / 3600.0
    print(f"   Default Key generated: {d1['keyHint']}, expires in ~{diff_hours_1:.2f} hours (expiresAt: {exp1_str})")
    assert 23.0 <= diff_hours_1 <= 25.0, f"Expected ~24h, got {diff_hours_1}h"

    print("[2] Generating custom 30-day API key...")
    res30 = requests.post(f"{BASE_URL}/api/v1/api-keys/generate", json={
        "table_id": "test_ttl_refinement_30d",
        "ttl_days": 30
    })
    assert res30.status_code == 200, f"Generate 30d failed: {res30.text}"
    d30 = res30.json()
    exp30_str = d30.get("expiresAt") or d30.get("expires_at")
    assert exp30_str is not None
    exp30_dt = datetime.fromisoformat(exp30_str.replace("Z", "+00:00"))
    diff_days_30 = (exp30_dt - now_dt).total_seconds() / 86400.0
    print(f"   30-Day Key generated: {d30['keyHint']}, expires in ~{diff_days_30:.2f} days (expiresAt: {exp30_str})")
    assert 29.0 <= diff_days_30 <= 31.0, f"Expected ~30 days, got {diff_days_30} days"

    print("[3] Validating key via POST /api/v1/api-keys/validate...")
    val_res = requests.post(f"{BASE_URL}/api/v1/api-keys/validate", json={"apiKey": d30["apiKey"]})
    assert val_res.status_code == 200, f"Validate failed: {val_res.text}"
    v_data = val_res.json()
    assert v_data["valid"] is True
    val_exp = v_data.get("expiresAt") or v_data.get("expires_at")
    assert val_exp == exp30_str, f"Validation expiresAt '{val_exp}' does not match '{exp30_str}'"
    print(f"   Validation SUCCESS: valid=True, expiresAt={val_exp}")

    print("\nSUCCESS: ALL TTL REFINEMENT TESTS PASSED!")

if __name__ == "__main__":
    test_ttl_refinement()
