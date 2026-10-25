"""
Sekundo — Stateless Relay & Capability Blob Hardening Tests (SEC-08, Phase F1 & F2)

Verifies:
- PUT /signal/share/blob/{blob_id} and GET /signal/share/blob/{blob_id} roundtrip
- 400 Bad Request when plaintext (non-SEKUNDO_CAP_v3:) is uploaded
- 413 Content Too Large when ciphertext exceeds 256 KB
- 404 Not Found when blob TTL expires
- 429 Too Many Requests when per-IP write rate limit is exceeded
"""

import time
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers import signaling_router

app = FastAPI()
app.include_router(signaling_router.router, prefix="/signal")
client = TestClient(app)


def setup_function():
    signaling_router._rooms.clear()
    signaling_router._blobs.clear()
    signaling_router._rate_buckets.clear()


def test_capability_blob_put_and_get_roundtrip():
    cipher = "SEKUNDO_CAP_v3:iv123456.ciphertext987654"
    res_put = client.put(
        "/signal/share/blob/test_blob_01",
        json={"cipher_blob": cipher, "ttl_seconds": 3600},
    )
    assert res_put.status_code == 200
    data_put = res_put.json()
    assert data_put["status"] == "blob_stored"
    assert data_put["blob_id"] == "test_blob_01"

    res_get = client.get("/signal/share/blob/test_blob_01")
    assert res_get.status_code == 200
    assert res_get.json()["cipher_blob"] == cipher


def test_capability_blob_rejects_plaintext_and_oversized():
    # Plaintext rejected with 400
    res_plain = client.put(
        "/signal/share/blob/bad_plain",
        json={"cipher_blob": '{"plaintext": true}'},
    )
    assert res_plain.status_code == 400

    # > 256 KB rejected with 413
    oversized = "SEKUNDO_CAP_v3:" + ("A" * 270_000)
    res_big = client.put(
        "/signal/share/blob/bad_big",
        json={"cipher_blob": oversized},
    )
    assert res_big.status_code == 413


def test_capability_blob_expires_after_ttl():
    cipher = "SEKUNDO_CAP_v3:iv.cipher"
    res_put = client.put(
        "/signal/share/blob/expiring_blob",
        json={"cipher_blob": cipher, "ttl_seconds": 1},
    )
    assert res_put.status_code == 200

    # Force expiration in store
    signaling_router._blobs["expiring_blob"]["expires_at"] = time.time() - 1

    res_get = client.get("/signal/share/blob/expiring_blob")
    assert res_get.status_code == 404


def test_relay_enforces_per_ip_rate_limit_429():
    cipher = "SEKUNDO_CAP_v3:iv.cipher"
    statuses = []
    for i in range(signaling_router.RATE_LIMIT_MAX_WRITES_PER_WINDOW + 2):
        r = client.put(
            f"/signal/share/blob/rate_blob_{i}",
            json={"cipher_blob": cipher},
        )
        statuses.append(r.status_code)

    assert 429 in statuses


if __name__ == "__main__":
    for fn in [
        test_capability_blob_put_and_get_roundtrip,
        test_capability_blob_rejects_plaintext_and_oversized,
        test_capability_blob_expires_after_ttl,
        test_relay_enforces_per_ip_rate_limit_429,
    ]:
        setup_function()
        fn()
        print(f"PASS: {fn.__name__}")
    print("ALL 4 RELAY HARDENING TESTS PASSED")

