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
from datetime import datetime, timezone, timedelta

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

            # Spreadsheet API Keys with Rotation Support (is_active)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS spreadsheet_api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    table_id TEXT NOT NULL,
                    key_hash TEXT UNIQUE NOT NULL,
                    key_hint TEXT NOT NULL,
                    license_key_hash TEXT NOT NULL,
                    permissions TEXT DEFAULT 'read:write',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    last_used_at TEXT,
                    FOREIGN KEY (license_key_hash) REFERENCES license_keys(key_hash)
                );
            """)

            # Table Sequence Tracker for Atomic Versioning (seq_number)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS table_sequence_tracker (
                    table_id TEXT PRIMARY KEY,
                    last_seq INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );
            """)

            # Offline Buffer Queue
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pending_sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key_hash TEXT NOT NULL,
                    table_id TEXT NOT NULL,
                    seq_number INTEGER NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            """)

            # Key Generation & Rotation Audit Log (Rate Limiting & Zero Collision)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS spreadsheet_api_key_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    table_id TEXT NOT NULL,
                    key_hash TEXT NOT NULL,
                    key_hint TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)

            # Migration: Ensure is_active and expires_at columns exist if database was created prior
            try:
                cursor.execute("ALTER TABLE spreadsheet_api_keys ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
            except Exception:
                pass # Column already exists

            try:
                cursor.execute("ALTER TABLE spreadsheet_api_keys ADD COLUMN expires_at TEXT")
            except Exception:
                pass # Column already exists
            
            conn.commit()
            logger.info("License Database initialized successfully.")
            seed_godmode_keys()
    except Exception as e:
        logger.error(f"Failed to initialize License Database: {e}")

def hash_key(key: str) -> str:
    """Calculates SHA-256 hash of a license key or API key."""
    return hashlib.sha256(key.strip().encode("utf-8")).hexdigest()

def seed_godmode_keys():
    """Seeds and updates God Mode / Admin license keys in DB on startup if configured."""
    try:
        godmode_secret = get_godmode_secret()
        if not godmode_secret:
            return

        god_keys = [godmode_secret]

        now = datetime.now(timezone.utc).isoformat()
        with get_connection() as conn:
            cursor = conn.cursor()

            for key in god_keys:
                clean_k = key.strip()
                if not clean_k:
                    continue
                k_hash = hash_key(clean_k)
                cursor.execute("SELECT id FROM license_keys WHERE key_hash = ? OR license_key = ?", (k_hash, clean_k))
                row = cursor.fetchone()
                if row:
                    cursor.execute("""
                        UPDATE license_keys
                        SET tier = 'godmode_owner',
                            token_balance = 999999999,
                            token_cap = -1,
                            expires_at = '2099-12-31T23:59:59Z',
                            updated_at = ?
                        WHERE key_hash = ? OR license_key = ?
                    """, (now, k_hash, clean_k))
                else:
                    cursor.execute("""
                        INSERT INTO license_keys (license_key, key_hash, email, tier, token_balance, token_cap, expires_at, stripe_customer_id, created_at, updated_at)
                        VALUES (?, ?, ?, 'godmode_owner', 999999999, -1, '2099-12-31T23:59:59Z', 'cust_godmode', ?, ?)
                    """, (clean_k, k_hash, 'admin@logicdefense.local', now, now))

            cursor.execute("""
                UPDATE license_keys
                SET token_balance = 999999999,
                    token_cap = -1,
                    expires_at = '2099-12-31T23:59:59Z',
                    updated_at = ?
                WHERE LOWER(tier) IN ('godmode_owner', 'admin')
            """, (now,))

            conn.commit()
            logger.info("God Mode license keys seeded and updated successfully.")
    except Exception as e:
        logger.error(f"Error seeding God Mode license keys: {e}")

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
    
    token_cap = -1 if tier in ("godmode_owner", "admin") else initial_tokens

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO license_keys (license_key, key_hash, email, tier, token_balance, token_cap, expires_at, stripe_customer_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (raw_key, key_h, email, tier, initial_tokens, token_cap, expires_at, stripe_customer_id, now, now))
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
        target_cap = -1 if tier in ("godmode_owner", "admin") else (rec.get("token_cap", 0) + token_tank if rec.get("token_cap", 0) != -1 else -1)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE license_keys
                SET token_balance = token_balance + ?,
                    token_cap = ?,
                    expires_at = ?,
                    tier = ?,
                    updated_at = ?
                WHERE key_hash = ?
            """, (token_tank, target_cap, new_expires_at, tier, now.isoformat(), key_h))
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
            "token_cap": -1,
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
        if not row or dict(row).get("tier") == "godmode_owner":
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

def check_key_generation_rate_limit(table_id: str, max_per_day: int = 10) -> bool:
    """Verifies that no more than max_per_day keys were generated for this table_id in the last 24 hours."""
    since_dt = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as count FROM spreadsheet_api_key_history
            WHERE table_id = ? AND created_at >= ?
        """, (table_id, since_dt))
        row = cursor.fetchone()
        count = row.get("count", 0) if isinstance(row, dict) else (row[0] if row else 0)
        return count < max_per_day

def create_spreadsheet_api_key(
    table_id: str, 
    license_key_hash: str, 
    permissions: str = "read:write", 
    raw_license: str | None = None, 
    expires_in_days: int = 1,
    bypass_rate_limit: bool = False
) -> tuple[str, str, str]:
    """
    Generates a spreadsheet API key linked to a valid license key with Key Rotation & Expiration TTL (default 1 day = 24h).
    Enforces a strict rate limit of 10 key generations per 24 hours per spreadsheet for anti-abuse and stability.
    """
    is_god = bool(raw_license and is_godmode_key(raw_license.strip()))
    if not is_god and not bypass_rate_limit and not check_key_generation_rate_limit(table_id, max_per_day=10):
        raise RuntimeError("Limite diário de 10 gerações de chave atingido para esta planilha. Tente novamente mais tarde.")

    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Zero Collision Loop: Guarantee this cryptographic key was NEVER assigned to any spreadsheet
        while True:
            raw_token = secrets.token_hex(32)
            api_key = f"am_sheet_live_{raw_token}"
            key_h = hash_key(api_key)
            hint = f"...{api_key[-4:]}"
            
            cursor.execute("SELECT 1 FROM spreadsheet_api_keys WHERE key_hash = ?", (key_h,))
            if cursor.fetchone():
                continue
            cursor.execute("SELECT 1 FROM spreadsheet_api_key_history WHERE key_hash = ?", (key_h,))
            if cursor.fetchone():
                continue
            break

        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        exp_dt = (now_dt + timedelta(days=expires_in_days)).isoformat()
        
        # Ensure license_key_hash exists in license_keys table to satisfy foreign key
        cursor.execute("SELECT 1 FROM license_keys WHERE key_hash = ?", (license_key_hash,))
        if not cursor.fetchone():
            lic_key_str = raw_license.strip() if raw_license else license_key_hash
            tier_name = "godmode_owner" if is_god else "pro"
            tokens = 999999999 if is_god else 1000000
            cap = -1 if is_god else 1000000
            cursor.execute("""
                INSERT OR IGNORE INTO license_keys (license_key, key_hash, email, tier, token_balance, token_cap, expires_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (lic_key_str, license_key_hash, "user@heisslab.com.br", tier_name, tokens, cap, "2099-12-31T23:59:59Z", now, now))

        # Key Rotation Rule: Deactivate & replace old keys for this table_id
        cursor.execute("DELETE FROM spreadsheet_api_keys WHERE table_id = ?", (table_id,))

        # Insert new active API Key with TTL expires_at
        cursor.execute("""
            INSERT INTO spreadsheet_api_keys (table_id, key_hash, key_hint, license_key_hash, permissions, is_active, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """, (table_id, key_h, hint, license_key_hash, permissions, now, exp_dt))

        # Record into Key Generation Audit Log
        cursor.execute("""
            INSERT INTO spreadsheet_api_key_history (table_id, key_hash, key_hint, created_at)
            VALUES (?, ?, ?, ?)
        """, (table_id, key_h, hint, now))

        conn.commit()
        
    return api_key, hint, exp_dt

def revoke_spreadsheet_api_key(table_id: str, raw_key: str | None = None, key_hash: str | None = None) -> tuple[bool, bool]:
    """
    Immediately revokes the active API key for a table_id or key_hash.
    Idempotent: returns (success: bool, was_active: bool).
    """
    target_hash = key_hash or (hash_key(raw_key.strip()) if raw_key and raw_key.strip() else None)
    now = datetime.now(timezone.utc).isoformat()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Check if active key exists
        if target_hash:
            cursor.execute("SELECT * FROM spreadsheet_api_keys WHERE key_hash = ? OR table_id = ?", (target_hash, table_id))
        else:
            cursor.execute("SELECT * FROM spreadsheet_api_keys WHERE table_id = ?", (table_id,))
            
        rows = cursor.fetchall()
        if not rows:
            return True, False  # Idempotent: already revoked/inactive
            
        for r in rows:
            row_dict = dict(r)
            kh = row_dict.get("key_hash")
            hint = row_dict.get("key_hint", "...")
            tid = row_dict.get("table_id", table_id)
            
            # Record audit revocation in history
            try:
                cursor.execute("""
                    INSERT INTO spreadsheet_api_key_history (table_id, key_hash, key_hint, created_at)
                    VALUES (?, ?, ?, ?)
                """, (tid, kh, f"{hint} [REVOKED]", now))
            except Exception:
                pass
                
        # Delete from active spreadsheet_api_keys table
        if target_hash:
            cursor.execute("DELETE FROM spreadsheet_api_keys WHERE key_hash = ? OR table_id = ?", (target_hash, table_id))
        else:
            cursor.execute("DELETE FROM spreadsheet_api_keys WHERE table_id = ?", (table_id,))
            
        conn.commit()
        return True, True

def get_spreadsheet_api_key(key_hash: str) -> dict | None:
    """Retrieves spreadsheet API key info by its hash if active (is_active == 1) and not expired."""
    env_key = (os.getenv("SPREADSHEET_API_KEY") or "").strip()
    if env_key and key_hash == hash_key(env_key):
        return {
            "id": 999,
            "table_id": "1786238740535-4iyjdbh",
            "key_hash": key_hash,
            "key_hint": f"...{env_key[-4:]}",
            "license_key_hash": hash_key(get_godmode_secret() or "godmode_admin_key"),
            "permissions": "read:write",
            "is_active": 1,
            "token_balance": 999_999_999,
            "expires_at": "2099-12-31T23:59:59Z",
        }

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM spreadsheet_api_keys WHERE key_hash = ?", (key_hash,))
        row = cursor.fetchone()
        if not row:
            logger.warning(f"[DB Debug] No row found for key_hash {key_hash}")
            return None
        
        api_key_data = dict(row)
        logger.info(f"[DB Debug] get_spreadsheet_api_key record: {api_key_data}")
        is_act = api_key_data.get("is_active")
        if is_act is not None and not bool(int(is_act)):
            logger.warning(f"[DB Debug] Key is_active is 0/False for key_hash {key_hash}: {api_key_data}")
            return None

        # Check API Key expiration TTL (expires_at)
        key_exp_str = api_key_data.get("expires_at")
        if key_exp_str:
            try:
                exp_dt = datetime.fromisoformat(key_exp_str.replace("Z", "+00:00"))
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                if exp_dt < datetime.now(timezone.utc):
                    logger.warning(f"[DB Debug] API Key EXPIRED for key_hash {key_hash}: {key_exp_str}")
                    api_key_data["is_active"] = 0
                    api_key_data["is_expired"] = True
                    api_key_data["error"] = "API Key Expired"
                    return api_key_data
            except Exception as exp_err:
                logger.warning(f"[DB Debug] Could not parse key expires_at '{key_exp_str}': {exp_err}")

        lic_hash = api_key_data.get("license_key_hash")
        
        # Support God Mode key
        godmode_secret = get_godmode_secret()
        if godmode_secret and lic_hash == hash_key(godmode_secret):
            api_key_data["token_balance"] = 999_999_999
            api_key_data["expires_at"] = "2099-12-31T23:59:59Z"
            return api_key_data

        # Standard license check
        cursor.execute("SELECT token_balance, expires_at FROM license_keys WHERE key_hash = ?", (lic_hash,))
        lic_row = cursor.fetchone()
        if lic_row:
            api_key_data["token_balance"] = lic_row["token_balance"]
            if not api_key_data.get("expires_at"):
                api_key_data["expires_at"] = lic_row["expires_at"]
        else:
            api_key_data["token_balance"] = 0

        return api_key_data

# ── Sequence Versioning & Offline Buffer Queue ───────────────────────────────

def get_next_table_sequence(table_id: str) -> int:
    """Atomically increments and returns the next seq_number version for a table_id."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT last_seq FROM table_sequence_tracker WHERE table_id = ?", (table_id,))
        row = cursor.fetchone()
        next_seq = (row["last_seq"] + 1) if row else 1

        cursor.execute("""
            INSERT INTO table_sequence_tracker (table_id, last_seq, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(table_id) DO UPDATE SET
                last_seq = excluded.last_seq,
                updated_at = excluded.updated_at
        """, (table_id, next_seq, now))
        conn.commit()
        return next_seq

def enqueue_pending_sync(key_hash: str, table_id: str, seq_number: int, payload_json: str):
    """Enqueues a sync event in pending_sync_queue when offline."""
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pending_sync_queue (key_hash, table_id, seq_number, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (key_hash, table_id, seq_number, payload_json, now))
        conn.commit()

def pop_pending_sync(key_hash: str, since_seq: int = 0) -> list[dict]:
    """Retrieves and removes pending sync mutations with seq_number > since_seq for a key_hash."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, table_id, seq_number, payload_json, created_at
            FROM pending_sync_queue
            WHERE key_hash = ? AND seq_number > ?
            ORDER BY seq_number ASC
        """, (key_hash, since_seq))
        rows = [dict(r) for r in cursor.fetchall()]
        
        if rows:
            cursor.execute("DELETE FROM pending_sync_queue WHERE key_hash = ? AND seq_number <= ?", 
                           (key_hash, max(r["seq_number"] for r in rows)))
            conn.commit()
            
        return rows
