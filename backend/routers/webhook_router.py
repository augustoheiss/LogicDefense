"""
RevenueCat Webhooks Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processes secure webhook events from RevenueCat to fulfill purchases.
"""

import os
import httpx
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Header, HTTPException, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Token Tank Constants ────────────────────────────────────────────────────
# "Tank" approach: monthly gets 1M tokens, yearly gets 12M upfront.
# The same value is used as both the injection amount AND the ceiling cap.
MONTHLY_TOKEN_TANK = 1_000_000    # 1M tokens
YEARLY_TOKEN_TANK  = 12_000_000   # 12M tokens (12 × monthly)
FREE_TOKEN_TANK    = 100_000      # 100K tokens for free tier

def resolve_token_tank(product_identifier: str, amount_total: int = 0) -> int:
    """Determine the correct token tank size based on product/price identifier.
    
    Checks for yearly keywords first (more specific), then falls back to monthly.
    Also considers amount_total (in cents) as a heuristic when metadata is ambiguous.
    """
    pid = str(product_identifier).lower()
    if "year" in pid or "yearly" in pid or "anual" in pid or "annual" in pid:
        return YEARLY_TOKEN_TANK
    if "month" in pid or "monthly" in pid or "pro" in pid:
        return MONTHLY_TOKEN_TANK
    # Heuristic fallback based on price (Stripe amount_total in cents)
    if amount_total >= 10000:  # R$ 100+ → likely yearly
        return YEARLY_TOKEN_TANK
    return MONTHLY_TOKEN_TANK

async def credit_user_tokens(user_id: str, amount: int, set_balance: bool = False) -> bool:
    """Increment or set user settings token balance in Supabase bypassing RLS using service role key."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials missing in environment variables.")
        return False
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    url = f"{supabase_url}/rest/v1/user_settings?id=eq.{user_id}"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if data:
                    current_balance = data[0].get("token_balance")
                    current_balance = int(current_balance) if current_balance is not None else 0
                    
                    new_balance = amount if set_balance else (current_balance + amount)
                    
                    update_res = await client.patch(
                        url,
                        headers=headers,
                        json={
                            "token_balance": new_balance,
                            "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
                        }
                    )
                    return update_res.status_code in (200, 201, 204)
                else:
                    # Create user settings row
                    insert_url = f"{supabase_url}/rest/v1/user_settings"
                    insert_res = await client.post(
                        insert_url,
                        headers=headers,
                        json={
                            "id": user_id,
                            "token_balance": amount,
                            "ai_cost_current_month": 0.0,
                            "ai_cost_last_reset": "",
                            "subscription_type": "free",
                            "goals": {},
                            "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
                        }
                    )
                    return insert_res.status_code in (200, 201, 204)
            else:
                logger.error(f"Failed to fetch user settings: status {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Exception during credit_user_tokens: {e}")
            return False

async def credit_user_tokens_atomic(user_id: str, amount: int) -> bool:
    """Atomically increment user token balance using Postgres RPC to prevent race conditions."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials missing.")
        return False
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    rpc_url = f"{supabase_url}/rest/v1/rpc/increment_user_tokens"
    payload = {
        "target_user_id": user_id,
        "token_increment_amount": amount
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(rpc_url, headers=headers, json=payload)
            if response.status_code in (200, 204):
                logger.info(f"Successfully credited {amount:,} tokens to user {user_id}")
                return True
            else:
                logger.error(f"Failed to call RPC: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Exception during atomic token crediting: {e}")
            return False

async def update_user_premium_status(user_id: str, premium_tier: str, subscription_type: str, expiration_date: str = None, token_tank: int = MONTHLY_TOKEN_TANK) -> bool:
    """Update profile premium tier, subscription expiration and user settings subscription status in Supabase."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials missing in environment variables.")
        return False
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            # 1. Update profiles table
            profile_url = f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}"
            profile_payload = {
                "premium_tier": premium_tier,
                "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
            }
            if expiration_date:
                profile_payload["subscription_expires_at"] = expiration_date
                
            profile_res = await client.patch(
                profile_url,
                headers=headers,
                json=profile_payload
            )
            profile_ok = profile_res.status_code in (200, 201, 204)
            if not profile_ok:
                logger.error(f"Failed to update profile: {profile_res.text}")
                
            # 2. Update user_settings table
            settings_url = f"{supabase_url}/rest/v1/user_settings?id=eq.{user_id}"
            settings_payload = {
                "subscription_type": subscription_type,
                "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
            }
            if expiration_date:
                settings_payload["expires_at"] = expiration_date

            settings_res = await client.patch(
                settings_url,
                headers=headers,
                json=settings_payload
            )
            settings_ok = settings_res.status_code in (200, 201, 204)
            
            # If user_settings doesn't exist, insert it
            if not settings_ok:
                insert_url = f"{supabase_url}/rest/v1/user_settings"
                insert_payload = {
                    "id": user_id,
                    "token_balance": token_tank if premium_tier == "premium" else FREE_TOKEN_TANK,
                    "ai_cost_current_month": 0.0,
                    "ai_cost_last_reset": "",
                    "subscription_type": subscription_type,
                    "goals": {},
                    "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
                }
                if expiration_date:
                    insert_payload["expires_at"] = expiration_date

                insert_res = await client.post(
                    insert_url,
                    headers=headers,
                    json=insert_payload
                )
                settings_ok = insert_res.status_code in (200, 201, 204)
                
            return profile_ok and settings_ok
        except Exception as e:
            logger.error(f"Exception during update_user_premium_status: {e}")
            return False

@router.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request, authorization: str = Header(None)):
    """Secure endpoint that processes RevenueCat webhook notifications."""
    secret = os.getenv("REVENUECAT_WEBHOOK_SECRET")
    if not secret:
        logger.error("REVENUECAT_WEBHOOK_SECRET is not configured on the server.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured on server"
        )
        
    if not authorization:
        logger.warning("Missing Authorization header in webhook request.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing Authorization header"
        )
        
    token = authorization.strip()
    if token.startswith("Bearer "):
        token = token[7:].strip()
        
    if token != secret:
        logger.warning("Invalid webhook authorization attempt.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid webhook secret"
        )
        
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse webhook JSON: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
        
    event = payload.get("event", {})
    event_type = event.get("type")
    app_user_id = event.get("app_user_id")
    product_id = event.get("product_id")
    
    logger.info(f"Processing RevenueCat event {event_type} for user {app_user_id}")
    
    if not app_user_id:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ignored", "reason": "missing app_user_id"}
        )
        
    # Process consumable token package top-ups
    transaction_id = event.get("id") or event.get("transaction_id") or "unknown_tx"
    
    if event_type == "NON_RENEWING_PURCHASE":
        prod_id_lower = str(product_id).lower()
        if "token" in prod_id_lower or "consumable" in prod_id_lower:
            amount = 100000
            if "50k" in prod_id_lower:
                amount = 50000
            elif "200k" in prod_id_lower:
                amount = 200000
            elif "500k" in prod_id_lower:
                amount = 500000
                
            logger.info(f"Fulfilling RevenueCat token purchase: amount={amount}, user={app_user_id}, tx={transaction_id}")
            success = await credit_user_tokens_atomic(app_user_id, amount)
            if success:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={"status": "fulfilled", "action": "credited_tokens", "amount": amount, "transaction_id": transaction_id}
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={"status": "failed", "reason": "database update error", "transaction_id": transaction_id}
                )
                
    # Process PRO tier subscriptions (Monthly/Annual)
    elif event_type in ("INITIAL_PURCHASE", "RENEWAL"):
        # 1. Parse or calculate subscription expiration date
        expires_date_ms = event.get("expires_date_ms")
        expiration_date_iso = None
        if expires_date_ms:
            try:
                expiration_date_iso = datetime.utcfromtimestamp(int(expires_date_ms) / 1000.0).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            except Exception as e:
                logger.error(f"Error parsing expires_date_ms {expires_date_ms}: {e}")
                
        if not expiration_date_iso:
            # Fallback to calculated duration
            now = datetime.utcnow()
            prod_id_lower = str(product_id).lower()
            if "year" in prod_id_lower or "anual" in prod_id_lower or "yearly" in prod_id_lower:
                expiration_date_iso = (now + timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            else:
                expiration_date_iso = (now + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
                
        # 2. Resolve token tank based on product identifier (monthly=1M, yearly=12M)
        token_tank = resolve_token_tank(str(product_id))
        logger.info(f"Resolved token tank for product '{product_id}': {token_tank:,} tokens (tx={transaction_id})")
        
        # 3. Update premium tier status and save expiration date
        profile_success = await update_user_premium_status(app_user_id, "premium", "active", expiration_date=expiration_date_iso, token_tank=token_tank)
        
        # 4. Increment token balance atomically
        token_success = await credit_user_tokens_atomic(app_user_id, token_tank)
        
        if profile_success and token_success:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": "fulfilled", 
                    "action": "activated_subscription_and_granted_tokens", 
                    "expires_at": expiration_date_iso,
                    "transaction_id": transaction_id
                }
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "failed", "reason": "database update error", "transaction_id": transaction_id}
            )
            
    # Default fallback for other events
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "received", "reason": "unhandled event type"}
    )
