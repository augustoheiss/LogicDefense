import requests
import hashlib
import sys
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))
from db.license_db import get_connection

BASE_URL = "http://127.0.0.1:8000"

def test_api_key_expiration_flow():
    print("[1] Generating new API key for table_test_ttl...")
    gen_res = requests.post(f"{BASE_URL}/api/v1/api-keys/generate", json={
        "table_id": "table_test_ttl",
        "permissions": "read:write"
    })
    assert gen_res.status_code == 200, f"Generate key failed: {gen_res.text}"
    data = gen_res.json()
    raw_key = data["api_key"]
    print(f"   Generated key: {raw_key[:20]}...")

    print("[2] Validating fresh key (should be valid)...")
    val_res = requests.post(f"{BASE_URL}/api/v1/api-keys/validate", json={"apiKey": raw_key})
    assert val_res.status_code == 200, f"Validation failed for fresh key: {val_res.text}"
    assert val_res.json()["valid"] is True
    print("   Fresh key validation SUCCESS (200 OK)")

    print("[3] Simulating key expiration in DB (setting expires_at to 2020-01-01)...")
    key_h = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("UPDATE spreadsheet_api_keys SET expires_at = '2020-01-01T00:00:00Z' WHERE key_hash = ?", (key_h,))
        print(f"   Updated rowcount: {c.rowcount}")
        conn.commit()

    print("[4] Testing validation of expired key...")
    val_exp_res = requests.post(f"{BASE_URL}/api/v1/api-keys/validate", json={"apiKey": raw_key})
    print(f"   Status Code: {val_exp_res.status_code}")
    print(f"   Response Body: {val_exp_res.text}")
    assert val_exp_res.status_code == 401
    assert "API Key Expired" in val_exp_res.text

    print("[5] Testing public endpoint access with expired key (X-Spreadsheet-Key)...")
    pub_res = requests.get(f"{BASE_URL}/api/v1/public/analysis-context", headers={"X-Spreadsheet-Key": raw_key})
    print(f"   Status Code: {pub_res.status_code}")
    print(f"   Response Body: {pub_res.text}")
    assert pub_res.status_code == 401
    assert "API Key Expired" in pub_res.text

    print("[6] Simulating CSV import auto-renewal: Generating replacement key...")
    renew_res = requests.post(f"{BASE_URL}/api/v1/api-keys/generate", json={
        "table_id": "table_test_ttl",
        "permissions": "read:write"
    })
    assert renew_res.status_code == 200
    new_raw_key = renew_res.json()["api_key"]
    assert new_raw_key != raw_key
    print(f"   New Auto-Renewed Key: {new_raw_key[:20]}...")

    print("[7] Validating new auto-renewed key...")
    val_new_res = requests.post(f"{BASE_URL}/api/v1/api-keys/validate", json={"apiKey": new_raw_key})
    assert val_new_res.status_code == 200
    assert val_new_res.json()["valid"] is True
    print("   New key validation SUCCESS (200 OK)")

    print("\nSUCCESS: ALL API KEY EXPIRATION AND AUTO-RENEWAL TESTS PASSED!")

if __name__ == "__main__":
    test_api_key_expiration_flow()
