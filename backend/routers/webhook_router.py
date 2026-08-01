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
from db.license_db import create_license_key, is_webhook_processed, mark_webhook_processed

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
        now = datetime.now(timezone.utc)
        prod_id_lower = str(product_id).lower()
        if "year" in prod_id_lower or "anual" in prod_id_lower or "yearly" in prod_id_lower:
            expiration_date_iso = (now + timedelta(days=365)).isoformat()
        else:
            expiration_date_iso = (now + timedelta(days=30)).isoformat()

        raw_key, key_hash = create_license_key(
            email=f"{app_user_id}@mobile.app",
            tier="pro",
            initial_tokens=token_tank,
            expires_at=expiration_date_iso,
            stripe_customer_id=app_user_id
        )

        if event_id:
            mark_webhook_processed(event_id)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "fulfilled", 
                "license_key": raw_key,
                "expires_at": expiration_date_iso
            }
        )

    return JSONResponse(status_code=status.HTTP_200_OK, content={"status": "received", "reason": "unhandled event"})
