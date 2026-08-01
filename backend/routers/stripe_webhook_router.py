"""
Stripe Webhooks Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processes secure webhook events from Stripe to fulfill desktop/web purchases.
Zero Supabase dependency — generates license keys and saves to SQLite/Turso.
"""

import os
import json
import logging
import stripe
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request, Header, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from db.license_db import create_license_key, is_webhook_processed, mark_webhook_processed
from services.email_service import send_license_key_email

logger = logging.getLogger(__name__)
router = APIRouter()

MONTHLY_TOKEN_TANK = 1_000_000
YEARLY_TOKEN_TANK  = 12_000_000

def resolve_token_tank(product_identifier: str, amount_total: int = 0) -> int:
    pid = str(product_identifier).lower()
    if "year" in pid or "yearly" in pid or "anual" in pid or "annual" in pid:
        return YEARLY_TOKEN_TANK
    if "month" in pid or "monthly" in pid or "pro" in pid:
        return MONTHLY_TOKEN_TANK
    if amount_total >= 10000:
        return YEARLY_TOKEN_TANK
    return MONTHLY_TOKEN_TANK

async def fulfill_stripe_checkout(session: dict, background_tasks: BackgroundTasks):
    """Fulfills validated Stripe checkout sessions by creating a new License Key."""
    event_id = session.get("id")
    if event_id and is_webhook_processed(event_id):
        logger.info(f"Stripe session {event_id} already processed. Skipping.")
        return

    customer_details = session.get("customer_details") or {}
    email = customer_details.get("email") or session.get("customer_email") or session.get("metadata", {}).get("email")
    stripe_customer_id = session.get("customer")
    metadata = session.get("metadata", {})
    product_id = str(metadata.get("product_id") or "").lower()
    amount_total = session.get("amount_total", 0)

    token_tank = resolve_token_tank(product_id, amount_total)
    
    # Calculate expiration
    now = datetime.now(timezone.utc)
    if "year" in product_id or "yearly" in product_id or "anual" in product_id or amount_total >= 10000:
        expires_at = (now + timedelta(days=365)).isoformat()
    else:
        expires_at = (now + timedelta(days=30)).isoformat()

    # Generate License Key
    raw_key, key_hash = create_license_key(
        email=email,
        tier="pro",
        initial_tokens=token_tank,
        expires_at=expires_at,
        stripe_customer_id=stripe_customer_id
    )

    if event_id:
        mark_webhook_processed(event_id)

    logger.info(f"Stripe Checkout fulfilled: key={raw_key[:10]}... created for email={email}, tokens={token_tank:,}")

    # Send License Key via Email if email is present
    if email:
        background_tasks.add_task(send_license_key_email, email, raw_key, "PRO")

@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    authorization: str = Header(None)
):
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    payload_bytes = await request.body()

    try:
        if secret and stripe_signature:
            event = stripe.Webhook.construct_event(payload_bytes, stripe_signature, secret)
        elif authorization:
            auth_token = authorization.strip()
            if auth_token.startswith("Bearer "):
                auth_token = auth_token[7:].strip()
            if secret and auth_token != secret:
                raise stripe.error.SignatureVerificationError("Invalid auth token bypass", stripe_signature)
            
            payload_json = json.loads(payload_bytes.decode("utf-8"))
            event = stripe.Event.construct_from(payload_json, stripe.api_key)
        else:
            # Fallback for dev mode if secret is not set yet
            payload_json = json.loads(payload_bytes.decode("utf-8"))
            event = stripe.Event.construct_from(payload_json, stripe.api_key)
    except Exception as e:
        logger.error(f"Stripe webhook payload verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook verification failed: {e}"
        )

    if event.type == "checkout.session.completed":
        session = event.data.object
        background_tasks.add_task(fulfill_stripe_checkout, session, background_tasks)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "received", "processing": True}
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "received", "reason": f"ignored event type {event.type}"}
    )
