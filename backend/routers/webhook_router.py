"""
RevenueCat Webhooks Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processes secure webhook events from RevenueCat to fulfill mobile purchases.
Zero Supabase dependency — saves directly to SQLite database.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request, Header, HTTPException, status
from fastapi.responses import JSONResponse
from db.license_db import fulfill_or_extend_license, is_webhook_processed, mark_webhook_processed

logger = logging.getLogger(__name__)
router = APIRouter()

MONTHLY_TOKEN_TANK = 1_000_000
YEARLY_TOKEN_TANK  = 12_000_000

def resolve_token_tank(product_identifier: str) -> int:
    pid = str(product_identifier).lower()
    if "year" in pid or "yearly" in pid or "anual" in pid or "annual" in pid:
        return YEARLY_TOKEN_TANK
    return MONTHLY_TOKEN_TANK

@router.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request, authorization: str = Header(None)):
    secret = os.getenv("REVENUECAT_WEBHOOK_SECRET")
    if secret:
        if not authorization:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
        token = authorization.strip()
        if token.startswith("Bearer "):
            token = token[7:].strip()
        if token != secret:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")
        
    try:
        payload = await request.json()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON payload: {e}")
        
    event = payload.get("event", {})
    event_type = event.get("type")
    app_user_id = event.get("app_user_id")
    product_id = event.get("product_id")
    event_id = event.get("id") or event.get("transaction_id")
    
    logger.info(f"Processing RevenueCat event {event_type} for user {app_user_id}")
    
    if event_id and is_webhook_processed(event_id):
        return JSONResponse(status_code=status.HTTP_200_OK, content={"status": "already_processed"})
        
    if event_type in ("INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"):
        token_tank = resolve_token_tank(str(product_id))
        prod_id_lower = str(product_id).lower()
        is_yearly = ("year" in prod_id_lower or "anual" in prod_id_lower or "yearly" in prod_id_lower)
        duration_days = 365 if is_yearly else 30
        tier = "pro_yearly" if is_yearly else "pro"
        user_email = f"{app_user_id}@mobile.app"

        raw_key, key_hash, total_tokens, expiration_date_iso = fulfill_or_extend_license(
            email=user_email,
            tier=tier,
            token_tank=token_tank,
            duration_days=duration_days,
            stripe_customer_id=app_user_id
        )

        if event_id:
            mark_webhook_processed(event_id)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "fulfilled", 
                "license_key": raw_key,
                "token_balance": total_tokens,
                "expires_at": expiration_date_iso
            }
        )

    return JSONResponse(status_code=status.HTTP_200_OK, content={"status": "received", "reason": "unhandled event"})
