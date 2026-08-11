"""
Spreadsheet API Keys Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manages API keys for external spreadsheet automation (e.g. Python scripts, Google Sheets).
Zero Supabase dependency — links directly to License Keys in SQLite/Turso.
"""

import logging
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field
from db.license_db import (
    get_license_by_raw_key,
    create_spreadsheet_api_key,
    get_spreadsheet_api_key,
    hash_key
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/api-keys", tags=["API Keys Management"])

class GenerateKeyRequest(BaseModel):
    table_id: str = Field(..., description="ID da planilha para a qual a chave será gerada")
    license_key: str | None = Field(default=None, description="Sua Chave de Licença PRO (am_pro_...)")
    permissions: str = Field(default="read:write", description="Permissões da chave: 'read-only' ou 'read:write'")
    ttl_days: int = Field(default=1, alias="ttlDays", description="Validade da chave em dias: 1, 7 ou 30 (padrão 1)")

    model_config = {"populate_by_name": True}

class GenerateKeyResponse(BaseModel):
    api_key: str = Field(..., alias="apiKey", description="Chave de API em texto puro (exibida apenas uma vez)")
    key_hint: str = Field(..., alias="keyHint", description="Dica visual da chave (últimos 4 caracteres)")
    table_id: str = Field(..., alias="tableId")
    permissions: str
    expires_at: str = Field(..., alias="expiresAt", description="Data/Hora ISO de expiração da chave")
    ttl_days: int = Field(default=1, alias="ttlDays")

    model_config = {"populate_by_name": True}

@router.post("/generate", response_model=GenerateKeyResponse)
async def generate_api_key(
    payload: GenerateKeyRequest,
    x_license_key: str | None = Header(None, alias="X-License-Key")
):
    """
    Generates a spreadsheet API key for external automation (100% free open-source feature).
    """
    raw_license = payload.license_key or x_license_key
    license_key_hash = None
    if raw_license:
        license_rec = get_license_by_raw_key(raw_license.strip())
        if license_rec:
            license_key_hash = license_rec.get("key_hash")
            
    if not license_key_hash:
        license_key_hash = hash_key("free_community_license")
        
    table_id = payload.table_id.strip()
    ttl = payload.ttl_days if payload.ttl_days in (1, 7, 30) else 1
    
    try:
        from services.sync_broadcaster import broadcaster
        # Disconnect any active SSE listeners for this table_id
        # create_spreadsheet_api_key deactivates old keys in DB
        api_key, hint, expires_at = create_spreadsheet_api_key(
            table_id=table_id,
            license_key_hash=license_key_hash,
            permissions=payload.permissions,
            raw_license=raw_license or "free_community_license",
            expires_in_days=ttl
        )
    except Exception as e:
        log.error(f"Failed to generate API key for table {table_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao criar a chave de API: {e}"
        )
    
    return GenerateKeyResponse(
        apiKey=api_key,
        keyHint=hint,
        tableId=table_id,
        permissions=payload.permissions,
        expiresAt=expires_at,
        ttlDays=ttl
    )

class ValidateKeyRequest(BaseModel):
    api_key: str = Field(..., alias="apiKey", description="Chave de API a ser validada")

    model_config = {"populate_by_name": True}

class ValidateKeyResponse(BaseModel):
    valid: bool
    table_id: str = Field(..., alias="tableId")
    key_hint: str = Field(..., alias="keyHint")
    expires_at: str | None = Field(None, alias="expiresAt")

    model_config = {"populate_by_name": True}

@router.post("/validate", response_model=ValidateKeyResponse)
async def validate_api_key_endpoint(payload: ValidateKeyRequest):
    """
    Validates if an API key is active and not expired.
    Returns HTTP 401 Unauthorized with {"detail": "API Key Expired"} if key is expired.
    """
    raw_key = payload.api_key.strip()
    if not raw_key.startswith("am_sheet_live_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de chave de API inválido."
        )

    k_hash = hash_key(raw_key)
    record = get_spreadsheet_api_key(k_hash)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de API inválida ou revogada."
        )

    if record.get("is_expired"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key Expired"
        )

    return ValidateKeyResponse(
        valid=True,
        tableId=record.get("table_id", ""),
        keyHint=record.get("key_hint", f"...{raw_key[-4:]}"),
        expiresAt=record.get("expires_at")
    )

