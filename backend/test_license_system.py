"""
Unit Tests — License Key System & Local SQLite DB (Assistente Moeda)
"""

import os
import unittest
from db.license_db import (
    create_license_key,
    get_license_by_raw_key,
    get_licenses_by_email,
    deduct_license_tokens,
    is_webhook_processed,
    mark_webhook_processed,
    create_spreadsheet_api_key,
    get_spreadsheet_api_key
)

class TestLicenseSystem(unittest.TestCase):

    def test_01_create_and_validate_license(self):
        raw_key, key_h = create_license_key(email="teste@moeda.app", tier="pro", initial_tokens=1_000_000)
        self.assertTrue(raw_key.startswith("am_pro_"))
        
        record = get_license_by_raw_key(raw_key)
        self.assertIsNotNone(record)
        self.assertEqual(record["email"], "teste@moeda.app")
        self.assertEqual(record["token_balance"], 1_000_000)

    def test_02_token_deduction_and_exhaustion(self):
        raw_key, key_h = create_license_key(email="deduction@moeda.app", tier="pro", initial_tokens=1_500)
        
        # Deduct 500 tokens
        success = deduct_license_tokens(key_h, 500)
        self.assertTrue(success)
        
        record = get_license_by_raw_key(raw_key)
        self.assertEqual(record["token_balance"], 1_000)
        
        # Attempt to deduct 2,000 tokens (more than available)
        fail = deduct_license_tokens(key_h, 2_000)
        self.assertFalse(fail)
        
        # Balance remains unchanged
        record2 = get_license_by_raw_key(raw_key)
        self.assertEqual(record2["token_balance"], 1_000)

    def test_03_email_recovery_lookup(self):
        email = "recover_me@moeda.app"
        key1, _ = create_license_key(email=email, tier="pro")
        key2, _ = create_license_key(email=email, tier="pro")
        
        found = get_licenses_by_email(email)
        self.assertGreaterEqual(len(found), 2)
        keys_found = [f["license_key"] for f in found]
        self.assertIn(key1, keys_found)
        self.assertIn(key2, keys_found)

    def test_04_webhook_idempotency(self):
        import uuid
        event_id = f"evt_stripe_test_{uuid.uuid4()}"
        self.assertFalse(is_webhook_processed(event_id))
        
        mark_webhook_processed(event_id)
        self.assertTrue(is_webhook_processed(event_id))

    def test_05_spreadsheet_api_key(self):
        raw_key, key_h = create_license_key(email="sheet@moeda.app", tier="pro", initial_tokens=500_000)
        table_id = "table_test_xyz"
        
        api_key, hint, _ = create_spreadsheet_api_key(table_id, key_h, permissions="read:write")
        self.assertTrue(api_key.startswith("am_sheet_live_"))
        
        import hashlib
        sheet_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
        rec = get_spreadsheet_api_key(sheet_hash)
        self.assertIsNotNone(rec)
        self.assertEqual(rec["table_id"], table_id)
        self.assertEqual(rec["token_balance"], 500_000)

if __name__ == "__main__":
    unittest.main()
