"""
Database Access Layer for License Keys and Token Quotas — Assistente Moeda
Uses local SQLite file in dev mode, and pure HTTP (via httpx) for Turso in production.
Zero C/Rust compilation requirements — 100% compatible with all Python versions and platforms.
"""

import os
import sqlite3
import hashlib
import secrets
import logging
import httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

def get_godmode_secret() -> str:
    return (os.getenv("GODMODE_SECRET_KEY") or "").strip(' "\' \t\r\n')

def is_godmode_key(raw_key: str) -> bool:
    clean_k = raw_key.strip()
    if not clean_k:
        return False
    godmode_secret = get_godmode_secret()
    if godmode_secret and clean_k == godmode_secret:
        return True
    return False

def is_turso_configured() -> bool:
    db_url = (os.getenv("TURSO_DATABASE_URL") or "").strip(' "\' \t\r\n')
    token = (os.getenv("TURSO_AUTH_TOKEN") or "").strip(' "\' \t\r\n')
    return bool(db_url and token)

def get_turso_token() -> str:
    return (os.getenv("TURSO_AUTH_TOKEN") or "").strip(' "\' \t\r\n')

def get_turso_http_url() -> str:
    db_url = (os.getenv("TURSO_DATABASE_URL") or "").strip(' "\' \t\r\n[').rstrip("/")
    if db_url.startswith("libsql://"):
        db_url = db_url.replace("libsql://", "https://")
    elif not db_url.startswith("http"):
        db_url = f"https://{db_url}"
    return db_url.rstrip("/") + "/v2/pipeline"

class TursoHTTPCursor:
    """Wrapper that mimics sqlite3 cursor interface using Turso's v2 HTTP pipeline API."""
    
    def __init__(self, http_url: str, auth_token: str):
        self.http_url = http_url
        self.auth_token = auth_token
        self._rows: list[dict] = []
        self._rowcount: int = 0

    def execute(self, sql: str, params: tuple | list = ()):
        # Convert positional params to Turso HTTP JSON format
        args = []
        for p in params:
            if p is None:
                args.append({"type": "null"})
            elif isinstance(p, int):
                args.append({"type": "integer", "value": str(p)})
            elif isinstance(p, float):
                args.append({"type": "float", "value": p})
            else:
                args.append({"type": "text", "value": str(p)})

        payload = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": sql,
                        "args": args
                    }
                },
                {"type": "close"}
            ]
        }

        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }

        with httpx.Client(timeout=10.0) as client:
            res = client.post(self.http_url, headers=headers, json=payload)
            if res.status_code not in (200, 201):
                logger.error(f"Turso HTTP query failed ({res.status_code}): {res.text}")
                raise RuntimeError(f"Turso HTTP query failed: {res.text}")
            
            data = res.json()
            results = data.get("results", [])
            if not results:
                self._rows = []
                self._rowcount = 0
                return self

            first_res = results[0]
            if first_res.get("type") == "error":
                err_msg = first_res.get("error", {}).get("message", "Unknown Turso error")
                logger.error(f"Turso SQL error: {err_msg}")
                raise RuntimeError(f"Turso SQL error: {err_msg}")

            exec_res = first_res.get("response", {}).get("result", {})
            cols = [c.get("name") for c in exec_res.get("cols", [])]
            raw_rows = exec_res.get("rows", [])
            self._rowcount = exec_res.get("affected_row_count", 0)

            # Map Turso HTTP cell values to python dicts
            mapped_rows = []
            for r in raw_rows:
                row_dict = {}
                for idx, col_name in enumerate(cols):
                    cell = r[idx]
                    val = cell.get("value")
                    cell_type = cell.get("type")
                    if cell_type == "null" or val is None:
                        row_dict[col_name] = None
                    elif cell_type == "integer":
                        row_dict[col_name] = int(val)
                    elif cell_type == "float":
                        row_dict[col_name] = float(val)
                    else:
                        row_dict[col_name] = str(val)
                mapped_rows.append(row_dict)

            self._rows = mapped_rows
            return self

    def fetchone(self) -> dict | None:
        return self._rows[0] if self._rows else None

    def fetchall(self) -> list[dict]:
        return self._rows

    @property
    def rowcount(self) -> int:
        return self._rowcount

class TursoHTTPConnection:
    """Wrapper that mimics sqlite3 connection interface."""
    def __init__(self, http_url: str, auth_token: str):
        self.http_url = http_url
        self.auth_token = auth_token

    def cursor(self):
        return TursoHTTPCursor(self.http_url, self.auth_token)

    def commit(self):
        pass # Turso HTTP executes statement immediately

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

def get_connection():
    """Returns sqlite3 connection or Turso HTTP connection wrapper."""
    if is_turso_configured():
        return TursoHTTPConnection(get_turso_http_url(), get_turso_token())
    
    db_file = os.getenv("LICENSE_DB_PATH", "license_storage.db")
    conn = sqlite3.connect(db_file, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema if tables do not exist."""
    try:
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
    except Exception as e:
        logger.error(f"Failed to initialize License Database: {e}")

# Initialize on module load
init_db()

def hash_key(key: str) -> str:
    """Calculates SHA-256 hash of a license key or API key."""
    return hashlib.sha256(key.strip().encode("utf-8")).hexdigest()

def create_license_key(email: str | None, tier: str = "pro", initial_tokens: int = 1_000_000, expires_at: str | None = None, stripe_customer_id: str | None = None) -> tuple[str, str]:
    """Generates a new secure license key, saves to DB, and returns (raw_key, key_hash)."""
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

def fulfill_or_extend_license(
    email: str | None,
    tier: str = "pro",
    token_tank: int = 1_000_000,
    duration_days: int = 30,
    stripe_customer_id: str | None = None
) -> tuple[str, str, int, str]:
    """
    Smart License Fulfillment & Cumulative Stacker:
    - If user already has an active license key:
        1. Additively stacks token_tank onto token_balance and token_cap.
        2. Cumulatively extends expires_at by +duration_days onto existing future expiration.
        3. Returns (license_key, key_hash, new_total_tokens, new_expires_at).
    - If no existing license key:
        Creates a new license key with now + duration_days.
    """
    now = datetime.now(timezone.utc)
    clean_email = email.strip().lower() if email else None

    existing_recs = get_licenses_by_email(clean_email) if clean_email else []

    if existing_recs:
        rec = existing_recs[0]
        raw_key = rec["license_key"]
        key_h = rec["key_hash"]
        current_balance = rec.get("token_balance", 0)
        current_exp_str = rec.get("expires_at")

        # Base date for cumulative extension
        base_date = now
        if current_exp_str:
            try:
                exp_dt = datetime.fromisoformat(current_exp_str.replace("Z", "+00:00"))
                if exp_dt > now:
                    base_date = exp_dt
            except Exception as e:
                logger.warning(f"Could not parse existing expires_at '{current_exp_str}': {e}")

        new_expires_at = (base_date + timedelta(days=duration_days)).isoformat()
        new_balance = current_balance + token_tank

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE license_keys
                SET token_balance = token_balance + ?,
                    token_cap = MAX(token_cap, token_balance + ?),
                    expires_at = ?,
                    tier = ?,
                    updated_at = ?
                WHERE key_hash = ?
            """, (token_tank, token_tank, new_expires_at, tier, now.isoformat(), key_h))
            conn.commit()

        logger.info(f"Cumulative License Stacked for {clean_email}: +{token_tank:,} tokens, +{duration_days} days. New expires_at: {new_expires_at}")
        return raw_key, key_h, new_balance, new_expires_at

    # New License Creation
    new_expires_at = (now + timedelta(days=duration_days)).isoformat()
    raw_key, key_h = create_license_key(
        email=clean_email,
        tier=tier,
        initial_tokens=token_tank,
        expires_at=new_expires_at,
        stripe_customer_id=stripe_customer_id
    )
    return raw_key, key_h, token_tank, new_expires_at

def get_license_by_raw_key(raw_key: str) -> dict | None:
    """Retrieves license record by raw license key string. Supports Master God Mode key for owner."""
    clean_k = raw_key.strip()
    if is_godmode_key(clean_k):
        return {
            "id": 999999,
            "license_key": clean_k,
            "key_hash": hash_key(clean_k),
            "email": "augustoheiss@heisslab.com.br",
            "tier": "godmode_owner",
            "token_balance": 999_999_999,
            "token_cap": 999_999_999,
            "expires_at": "2099-12-31T23:59:59Z",
            "stripe_customer_id": "cust_godmode",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z"
        }
        
    key_h = hash_key(clean_k)
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
    godmode_secret = get_godmode_secret()
    if godmode_secret and key_hash == hash_key(godmode_secret):
        return True

    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT token_balance, tier FROM license_keys WHERE key_hash = ?", (key_hash,))
        row = cursor.fetchone()
        if not row or row.get("tier") == "godmode_owner":
            return True
        if row["token_balance"] < amount:
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
        if is_turso_configured():
            cursor.execute("""
                INSERT INTO spreadsheet_api_keys (table_id, key_hash, key_hint, license_key_hash, permissions, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (table_id, key_h, hint, license_key_hash, permissions, now))
        else:
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
