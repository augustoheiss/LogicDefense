"""
License Keys Router — Assistente Moeda
Endpoints for license key validation, balance checks, and email recovery.
Zero Supabase dependency.
"""

import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field, EmailStr
from db.license_db import get_license_by_raw_key, get_licenses_by_email, hash_key
from services.email_service import send_license_key_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/license", tags=["License Management"])

class ValidateKeyRequest(BaseModel):
    license_key: str = Field(..., description="Chave de licença crua (ex: am_pro_...)")

class ValidateKeyResponse(BaseModel):
    valid: bool
    tier: str
    token_balance: int
    token_cap: int
    expires_at: str | None = None
    message: str

class RecoverKeyRequest(BaseModel):
    email: str = Field(..., description="E-mail utilizado no Checkout do Stripe")

class RecoverKeyResponse(BaseModel):
    success: bool
    message: str

@router.post("/validate", response_model=ValidateKeyResponse)
async def validate_license_key(payload: ValidateKeyRequest):
    """
    Validates a raw license key string and returns tier and token quota.
    """
    key = payload.license_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Chave de licença não fornecida.")
        
    rec = get_license_by_raw_key(key)
    if not rec:
        return ValidateKeyResponse(
            valid=False,
            tier="free",
            token_balance=0,
            token_cap=0,
            message="Chave de licença inválida ou não encontrada."
        )
        
    return ValidateKeyResponse(
        valid=True,
        tier=rec.get("tier", "pro"),
        token_balance=rec.get("token_balance", 0),
        token_cap=rec.get("token_cap", 0),
        expires_at=rec.get("expires_at"),
        message="Chave de licença válida."
    )

@router.post("/recover", response_model=RecoverKeyResponse)
async def recover_license_keys(payload: RecoverKeyRequest, background_tasks: BackgroundTasks):
    """
    Sends all license keys associated with the email address to the user's inbox.
    Key recovery portal endpoint.
    """
    email = payload.email.strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="E-mail inválido.")
        
    records = get_licenses_by_email(email)
    if not records:
        # Return generic message to prevent email enumeration
        return RecoverKeyResponse(
            success=True,
            message="Se existir alguma chave associada a este e-mail, ela foi enviada para sua caixa de entrada."
        )
        
    # Queue email sending in background
    for rec in records:
        raw_key = rec.get("license_key")
        tier = rec.get("tier", "pro").upper()
        if raw_key:
            background_tasks.add_task(send_license_key_email, email, raw_key, tier)
            
    return RecoverKeyResponse(
        success=True,
        message="Se existir alguma chave associada a este e-mail, ela foi enviada para sua caixa de entrada."
    )
