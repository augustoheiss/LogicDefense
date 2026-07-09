"""
Stripe Webhooks Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processes secure webhook events from Stripe to fulfill desktop/web purchases.
"""

import os
import logging
import httpx
import stripe
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Header, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from routers.webhook_router import credit_user_tokens, update_user_premium_status, resolve_token_tank

logger = logging.getLogger(__name__)
router = APIRouter()

async def credit_user_tokens_atomic(user_id: str, amount: int) -> bool:
    """Atomically increment user token balance using Postgres RPC to prevent race conditions."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Bypasses RLS safely
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials missing.")
        return False
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    # Call the stored function via PostgREST RPC
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

async def fulfill_stripe_checkout(session: dict):
    """Asynchronous background task to process and fulfill validated checkout sessions."""
    app_user_id = session.get("client_reference_id") or session.get("metadata", {}).get("user_id")
    if not app_user_id:
        logger.warning("Fulfillment ignored: client_reference_id (Supabase UUID) is missing from Stripe session.")
        return

    metadata = session.get("metadata", {})
    product_id = str(metadata.get("product_id") or "").lower()
    amount_total = session.get("amount_total", 0)

    logger.info(f"Fulfilling Stripe checkout for user {app_user_id}, product: {product_id}, amount: {amount_total}")

    # Determine product type
    is_subscription = "pro" in product_id or "monthly" in product_id or "yearly" in product_id
    is_consumable = "token" in product_id or "consumable" in product_id

    # Fallback heuristics based on Stripe session amount if not explicitly defined
    if not is_subscription and not is_consumable:
        if amount_total >= 10000:  # R$ 100+ -> Yearly subscription
            is_subscription = True
        elif amount_total >= 1900:  # R$ 19+ -> Monthly subscription
            is_subscription = True
        else:
            is_consumable = True

    if is_subscription:
        current_period_end_raw = session.get("current_period_end") or (
            session.get("subscription", {}).get("current_period_end") 
            if isinstance(session.get("subscription"), dict) else None
        )
        
        expiration_date_iso = None
        if current_period_end_raw:
            try:
                expiration_date_iso = datetime.utcfromtimestamp(int(current_period_end_raw)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            except Exception as e:
                logger.error(f"Error parsing current_period_end timestamp {current_period_end_raw}: {e}")
                
        if not expiration_date_iso:
            # Fallback subscription expiration offset
            now = datetime.utcnow()
            if "year" in product_id or "yearly" in product_id or "anual" in product_id or amount_total >= 10000:
                expiration_date_iso = (now + timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            else:
                expiration_date_iso = (now + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S+00:00")

        # Resolve token tank size (e.g. 1M for monthly, 12M for yearly)
        token_tank = resolve_token_tank(product_id, amount_total)
        logger.info(f"Fulfilling subscription: granting {token_tank:,} tokens and setting PRO until {expiration_date_iso}")

        # Update premium tier status in Supabase profiles
        profile_success = await update_user_premium_status(
            app_user_id, 
            premium_tier="premium", 
            subscription_type="active", 
            expiration_date=expiration_date_iso, 
            token_tank=token_tank
        )
        
        # Reset subscription token balance to the premium tank limit
        token_success = await credit_user_tokens(app_user_id, token_tank, set_balance=True)

        if profile_success and token_success:
            logger.info(f"Subscription successfully fulfilled in database for user {app_user_id}")
        else:
            logger.error(f"Database fulfillment failed for user subscription: profile_success={profile_success}, token_success={token_success}")

    elif is_consumable:
        # Resolve consumable top-up package amounts
        amount = 100000
        if "50k" in product_id:
            amount = 50000
        elif "200k" in product_id:
            amount = 200000
        elif "500k" in product_id:
            amount = 500000

        logger.info(f"Fulfilling consumable top-up: adding {amount:,} tokens to user {app_user_id}")
        success = await credit_user_tokens_atomic(app_user_id, amount)
        if success:
            logger.info(f"Consumable top-up successfully credited to user {app_user_id}")
        else:
            logger.error(f"Database fulfillment failed for user consumable top-up: {app_user_id}")

@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
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

    # 1. Authenticate Request & Construct Stripe Event
    try:
        if stripe_signature:
            # Strictly validate Stripe signature to prevent faking token purchases
            event = stripe.Webhook.construct_event(payload_bytes, stripe_signature, secret)
        elif authorization:
            # Secure developer fallback token bypass
            auth_token = authorization.strip()
            if auth_token.startswith("Bearer "):
                auth_token = auth_token[7:].strip()
            if auth_token != secret:
                raise stripe.error.SignatureVerificationError("Invalid auth token bypass", stripe_signature)
            
            # Construct event dummy structure from raw JSON for bypass path
            import json
            payload_json = json.loads(payload_bytes.decode("utf-8"))
            event = stripe.Event.construct_from(payload_json, stripe.api_key)
        else:
            logger.warning("Stripe Webhook attempt rejected: missing Stripe-Signature or Authorization header.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing Stripe-Signature or Authorization Header"
            )
    except (ValueError, json.JSONDecodeError) as e:
        logger.error(f"Invalid JSON payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError as e:
        logger.warning(f"Signature verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signature verification failed"
        )

    # 2. Process checkout.session.completed via BackgroundTasks
    if event.type == "checkout.session.completed":
        session = event.data.object
        # Dispatch processing asynchronously in the background to respond to Stripe under 2 seconds
        background_tasks.add_task(fulfill_stripe_checkout, session)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "received", "processing": True}
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "received", "reason": f"ignored event type {event.type}"}
    )
