#!/usr/bin/env python3
"""
Create Tester License Key Script — Assistente Moeda Mobile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generates a 12M Annual License Key (or custom token/duration key)
directly into Turso/SQLite database for mobile beta testers.

Usage:
  python Assistente-Moeda-App/scripts/create_tester_key.py tester@email.com
  python Assistente-Moeda-App/scripts/create_tester_key.py tester@email.com --tokens 12000000 --days 365
"""

import sys
import os
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Dynamically locate root backend directory (../../backend)
script_dir = Path(__file__).resolve().parent
app_dir = script_dir.parent
root_dir = app_dir.parent
backend_dir = root_dir / "backend"

for path in [str(root_dir), str(backend_dir)]:
    if path not in sys.path:
        sys.path.insert(0, path)

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

try:
    from backend.db.license_db import create_license_key
except ImportError:
    from db.license_db import create_license_key

def main():
    parser = argparse.ArgumentParser(description="Generate a Tester License Key")
    parser.add_argument("email", help="Tester's email address")
    parser.add_argument("--tokens", type=int, default=12_000_000, help="Initial token amount (default: 12,000,000)")
    parser.add_argument("--days", type=int, default=365, help="Validity period in days (default: 365 days)")
    parser.add_argument("--tier", type=str, default="pro_yearly", help="License tier name (default: pro_yearly)")

    args = parser.parse_args()

    email = args.email.strip()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=args.days)).isoformat()

    raw_key, key_hash = create_license_key(
        email=email,
        tier=args.tier,
        initial_tokens=args.tokens,
        expires_at=expires_at,
        stripe_customer_id=f"tester_manual_{email}"
    )

    print("\n" + "="*60)
    print("  CHAVE DE LICENCA DE TESTER GERADA COM SUCESSO!")
    print("="*60)
    print(f"  E-mail:       {email}")
    print(f"  Chave Pro:    {raw_key}")
    print(f"  Saldo Tokens: {args.tokens:,} tokens")
    print(f"  Validade:     {expires_at[:10]} ({args.days} dias)")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
