"""
Stripe Webhooks Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processes secure webhook events from Stripe to fulfill desktop/web purchases.
"""

import os
import hmac
import hashlib
import time
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Header, HTTPException, status
from fastapi.responses import JSONResponse
from routers.webhook_router import credit_user_tokens, update_user_premium_status

logger = logging.getLogger(__name__)
router = APIRouter()

def verify_stripe_signature(payload_bytes: bytes, sig_header: str, secret: str) -> bool:
    """Validate Stripe-Signature header using HMAC-SHA256 in pure Python."""
    try:
        parts = sig_header.split(",")
        timestamp = None
        signatures = []
        for part in parts:
            kv = part.split("=")
            if len(kv) == 2:
                k, v = kv[0].strip(), kv[1].strip()
                if k == "t":
                    timestamp = v
                elif k == "v1":
                    signatures.append(v)
                    
        if not timestamp or not signatures:
            return False
            
        # Verify timestamp drift (max 5 minutes)
        if abs(time.time() - int(timestamp)) > 300:
            logger.warning(f"Stripe Webhook timestamp drift too high: {timestamp}")
            return False
            
        signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256
        ).hexdigest()
        
        for sig in signatures:
            if hmac.compare_digest(sig, expected_sig):
                return True
        return False
    except Exception as e:
        logger.error(f"Error validating Stripe signature: {e}")
        return False

@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    authorization: str = Header(None)
):
    """Processes Stripe checkout.session.completed webhook notifications securely."""
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not configured on the server.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe secret not configured on server"
        )
        
    payload_bytes = await request.body()
    
    # 1. Authenticate Request
    is_authenticated = False
    
    # Verify via standard stripe signature if header exists
    if stripe_signature:
        is_authenticated = verify_stripe_signature(payload_bytes, stripe_signature, secret)
    # Fallback to authorization header (useful for developer mock calls and curl tests)
    elif authorization:
        auth_token = authorization.strip()
        if auth_token.startswith("Bearer "):
            auth_token = auth_token[7:].strip()
        is_authenticated = (auth_token == secret)
        
    if not is_authenticated:
        logger.warning("Unauthorized Stripe Webhook attempt.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid Stripe signature or secret"
        )
        
    # 2. Parse Webhook Event
    try:
        payload_json = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Stripe JSON payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
        
    event_type = payload_json.get("type")
    
    # Only process checkout.session.completed
    if event_type != "checkout.session.completed":
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ignored", "reason": f"unhandled event type {event_type}"}
        )
        
    session = payload_json.get("data", {}).get("object", {})
    app_user_id = session.get("client_reference_id")
    
    if not app_user_id:
        logger.warning("Stripe checkout completed but client_reference_id (Supabase UUID) is missing.")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ignored", "reason": "missing client_reference_id"}
        )
        
    metadata = session.get("metadata", {})
    product_id = str(metadata.get("product_id") or "").lower()
    
    logger.info(f"Fulfilling Stripe checkout for user {app_user_id}, product: {product_id}")
    
    # 3. Process Product Types
    amount_total = session.get("amount_total", 0)
    is_subscription = "pro" in product_id or "monthly" in product_id or "yearly" in product_id
    is_consumable = "token" in product_id or "consumable" in product_id
    
    # If not defined in metadata, guess based on amount_total or default to tokens
    if not is_subscription and not is_consumable:
        if amount_total >= 10000: # R$ 100+ -> Yearly subscription
            is_subscription = True
        elif amount_total >= 1900: # R$ 19+ -> Monthly subscription
            is_subscription = True
        else:
            is_consumable = True
            
    if is_subscription:
        # Extract current_period_end from payload
        current_period_end_raw = session.get("current_period_end") or session.get("subscription", {}).get("current_period_end") if isinstance(session.get("subscription"), dict) else None
        
        expiration_date_iso = None
        if current_period_end_raw:
            try:
                expiration_date_iso = datetime.utcfromtimestamp(int(current_period_end_raw)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            except Exception as e:
                logger.error(f"Error parsing current_period_end timestamp {current_period_end_raw}: {e}")
                
        if not expiration_date_iso:
            # Fallback based on annual vs monthly
            now = datetime.utcnow()
            if "year" in product_id or "yearly" in product_id or "anual" in product_id or amount_total >= 10000:
                expiration_date_iso = (now + timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            else:
                expiration_date_iso = (now + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
                
        profile_success = await update_user_premium_status(app_user_id, "premium", "active", expiration_date=expiration_date_iso)
        
        # Set token balance to 1,000,000 (1M) tokens directly
        token_success = await credit_user_tokens(app_user_id, 1000000, set_balance=True)
        
        if profile_success and token_success:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": "fulfilled", 
                    "action": "activated_subscription_and_granted_tokens", 
                    "expires_at": expiration_date_iso
                }
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "failed", "reason": "database update error"}
            )
            
    elif is_consumable:
        amount = 100000
        if "50k" in product_id:
            amount = 50000
        elif "200k" in product_id:
            amount = 200000
        elif "500k" in product_id:
            amount = 500000
            
        success = await credit_user_tokens(app_user_id, amount, set_balance=False)
        if success:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "fulfilled", "action": "credited_tokens", "amount": amount}
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "failed", "reason": "database update error"}
            )
            
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "received", "reason": "unhandled checkout configuration"}
    )
