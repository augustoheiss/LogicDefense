"""
RevenueCat Webhooks Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processes secure webhook events from RevenueCat to fulfill purchases.
"""

import os
import httpx
import logging
from datetime import datetime
from fastapi import APIRouter, Request, Header, HTTPException, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter()

async def credit_user_tokens(user_id: str, amount: int) -> bool:
    """Increment user settings token balance in Supabase bypassing RLS using service role key."""
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
                    new_balance = current_balance + amount
                    
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

async def update_user_premium_status(user_id: str, premium_tier: str, subscription_type: str) -> bool:
    """Update profile premium tier and user settings subscription status in Supabase."""
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
            profile_res = await client.patch(
                profile_url,
                headers=headers,
                json={
                    "premium_tier": premium_tier,
                    "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
                }
            )
            profile_ok = profile_res.status_code in (200, 201, 204)
            if not profile_ok:
                logger.error(f"Failed to update profile: {profile_res.text}")
                
            # 2. Update user_settings table
            settings_url = f"{supabase_url}/rest/v1/user_settings?id=eq.{user_id}"
            settings_res = await client.patch(
                settings_url,
                headers=headers,
                json={
                    "subscription_type": subscription_type,
                    "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
                }
            )
            settings_ok = settings_res.status_code in (200, 201, 204)
            
            # If user_settings doesn't exist, insert it
            if not settings_ok:
                insert_url = f"{supabase_url}/rest/v1/user_settings"
                insert_res = await client.post(
                    insert_url,
                    headers=headers,
                    json={
                        "id": user_id,
                        "token_balance": 100000, # Grant monthly tokens by default on creation
                        "ai_cost_current_month": 0.0,
                        "ai_cost_last_reset": "",
                        "subscription_type": subscription_type,
                        "goals": {},
                        "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
                    }
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
                
            success = await credit_user_tokens(app_user_id, amount)
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
                
    # Process PRO tier subscriptions (Monthly/Annual)
    elif event_type in ("INITIAL_PURCHASE", "RENEWAL"):
        profile_success = await update_user_premium_status(app_user_id, "premium", "active")
        token_success = await credit_user_tokens(app_user_id, 100000)
        
        if profile_success and token_success:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "fulfilled", "action": "activated_subscription_and_granted_tokens"}
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "failed", "reason": "database update error"}
            )
            
    # Default fallback for other events
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "received", "reason": "unhandled event type"}
    )
