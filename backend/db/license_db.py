"""
Database Access Layer for License Keys and Token Quotas — Assistente Moeda
Uses SQLite (standard library) with support for persistent local file or Turso URL fallback.
Zero Supabase dependency.
"""

import os
import sqlite3
import hashlib
import secrets
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")
DB_FILE = os.getenv("LICENSE_DB_PATH", "license_storage.db")

import importlib

def get_connection():
    """
    Returns a connection object.
    If TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set, connects to Turso (libsql).
    Otherwise, defaults to local SQLite file.
    """
    if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN:
        url = TURSO_DATABASE_URL.replace("libsql://", "https://")
        try:
            libsql = importlib.import_module("libsql_experimental")
            return libsql.connect(database=url, auth_token=TURSO_AUTH_TOKEN)
        except ImportError:
            try:
                libsql = importlib.import_module("libsql")
                return libsql.connect(database=url, auth_token=TURSO_AUTH_TOKEN)
            except ImportError:
                logger.warning("TURSO_DATABASE_URL configured but 'libsql-experimental' package not installed. Falling back to local SQLite.")
    
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema if tables do not exist."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # License Keys table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS license_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT UNIQUE NOT NULL,
                key_hash TEXT UNIQUE NOT NULL,
                email TEXT,
                tier TEXT NOT NULL DEFAULT 'pro',
                token_balance INTEGER NOT NULL DEFAULT 0,
                token_cap INTEGER NOT NULL DEFAULT 1000000,
                expires_at TEXT,
                stripe_customer_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        
        # Token Usage Transactions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS token_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key_hash TEXT NOT NULL,
                tokens_used INTEGER NOT NULL,
                endpoint TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (license_key_hash) REFERENCES license_keys(key_hash)
            );
        """)
        
        # Processed Webhooks (Idempotency)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_webhooks (
                event_id TEXT PRIMARY KEY,
                processed_at TEXT NOT NULL
            );
        """)

        # Spreadsheet API Keys
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS spreadsheet_api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id TEXT UNIQUE NOT NULL,
                key_hash TEXT UNIQUE NOT NULL,
                key_hint TEXT NOT NULL,
                license_key_hash TEXT NOT NULL,
                permissions TEXT DEFAULT 'read:write',
                created_at TEXT NOT NULL,
                last_used_at TEXT,
                FOREIGN KEY (license_key_hash) REFERENCES license_keys(key_hash)
            );
        """)
        
        conn.commit()
        logger.info("License Database initialized successfully.")

# Initialize on module load
init_db()

def hash_key(key: str) -> str:
    """Calculates SHA-256 hash of a license key or API key."""
    return hashlib.sha256(key.strip().encode("utf-8")).hexdigest()

def create_license_key(email: str | None, tier: str = "pro", initial_tokens: int = 1_000_000, expires_at: str | None = None, stripe_customer_id: str | None = None) -> tuple[str, str]:
    """
    Generates a new secure license key, saves it to DB, and returns (raw_key, key_hash).
    """
    raw_random = secrets.token_hex(16)
    raw_key = f"am_{tier}_{raw_random}"
    key_h = hash_key(raw_key)
    now = datetime.now(timezone.utc).isoformat()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO license_keys (license_key, key_hash, email, tier, token_balance, token_cap, expires_at, stripe_customer_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (raw_key, key_h, email, tier, initial_tokens, initial_tokens, expires_at, stripe_customer_id, now, now))
        conn.commit()
        
    logger.info(f"Created new license key for {email or 'anonymous'}: {raw_key[:10]}...")
    return raw_key, key_h

def get_license_by_raw_key(raw_key: str) -> dict | None:
    """Retrieves license record by raw license key string."""
    key_h = hash_key(raw_key)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM license_keys WHERE key_hash = ?", (key_h,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_licenses_by_email(email: str) -> list[dict]:
    """Retrieves all active license records associated with an email address."""
    clean_email = email.strip().lower()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM license_keys WHERE LOWER(email) = ? ORDER BY created_at DESC", (clean_email,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def credit_license_tokens(key_hash: str, token_amount: int, expires_at: str | None = None) -> bool:
    """Adds tokens to an existing license key or resets baseline balance."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        if expires_at:
            cursor.execute("""
                UPDATE license_keys 
                SET token_balance = token_balance + ?,
                    token_cap = MAX(token_cap, token_balance + ?),
                    expires_at = ?,
                    updated_at = ?
                WHERE key_hash = ?
            """, (token_amount, token_amount, expires_at, now, key_hash))
        else:
            cursor.execute("""
                UPDATE license_keys 
                SET token_balance = token_balance + ?,
                    token_cap = MAX(token_cap, token_balance + ?),
                    updated_at = ?
                WHERE key_hash = ?
            """, (token_amount, token_amount, now, key_hash))
        conn.commit()
        return cursor.rowcount > 0

def deduct_license_tokens(key_hash: str, amount: int, endpoint: str = "/api/coin/ai-analyst") -> bool:
    """Atomically deducts token amount from a license balance if sufficient tokens exist."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT token_balance FROM license_keys WHERE key_hash = ?", (key_hash,))
        row = cursor.fetchone()
        if not row or row["token_balance"] < amount:
            return False
        
        cursor.execute("""
            UPDATE license_keys
            SET token_balance = token_balance - ?,
                updated_at = ?
            WHERE key_hash = ?
        """, (amount, now, key_hash))
        
        cursor.execute("""
            INSERT INTO token_transactions (license_key_hash, tokens_used, endpoint, created_at)
            VALUES (?, ?, ?, ?)
        """, (key_hash, amount, endpoint, now))
        
        conn.commit()
        return True

def is_webhook_processed(event_id: str) -> bool:
    """Checks if a Stripe/RevenueCat event ID was already processed."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM processed_webhooks WHERE event_id = ?", (event_id,))
        return cursor.fetchone() is not None

def mark_webhook_processed(event_id: str):
    """Records a webhook event ID for idempotency."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO processed_webhooks (event_id, processed_at) VALUES (?, ?)", (event_id, now))
        conn.commit()

# ── Spreadsheet API Keys ─────────────────────────────────────────────────────

def create_spreadsheet_api_key(table_id: str, license_key_hash: str, permissions: str = "read:write") -> tuple[str, str]:
    """Generates a spreadsheet API key linked to a valid license key."""
    raw_token = secrets.token_hex(32)
    api_key = f"am_sheet_live_{raw_token}"
    key_h = hash_key(api_key)
    hint = f"...{api_key[-4:]}"
    now = datetime.now(timezone.utc).isoformat()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO spreadsheet_api_keys (table_id, key_hash, key_hint, license_key_hash, permissions, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(table_id) DO UPDATE SET
                key_hash = excluded.key_hash,
                key_hint = excluded.key_hint,
                license_key_hash = excluded.license_key_hash,
                permissions = excluded.permissions,
                created_at = excluded.created_at
        """, (table_id, key_h, hint, license_key_hash, permissions, now))
        conn.commit()
        
    return api_key, hint

def get_spreadsheet_api_key(key_hash: str) -> dict | None:
    """Retrieves spreadsheet API key info by its hash."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*, l.token_balance, l.expires_at
            FROM spreadsheet_api_keys s
            JOIN license_keys l ON s.license_key_hash = l.key_hash
            WHERE s.key_hash = ?
        """, (key_hash,))
        row = cursor.fetchone()
        return dict(row) if row else None
