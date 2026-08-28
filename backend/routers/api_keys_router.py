"""
Spreadsheet API Keys Router — Assistente Moeda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manages API keys for external spreadsheet automation (e.g. Python scripts, Google Sheets).
Zero Supabase dependency — links directly to License Keys in SQLite/Turso.
"""

import logging
import uuid
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field
from db.license_db import (
    get_license_by_raw_key,
    create_spreadsheet_api_key,
    get_spreadsheet_api_key,
    revoke_spreadsheet_api_key,
    hash_key
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/api-keys", tags=["API Keys Management"])

class GenerateKeyRequest(BaseModel):
    table_id: str | None = Field(
        default=None,
        alias="tableId",
        description="ID da planilha ou sessão do agente. Se omitido, uma sessão autônoma efêmera é gerada automaticamente."
    )
    license_key: str | None = Field(default=None, alias="licenseKey", description="Sua Chave de Licença PRO (am_pro_...) ou omitida para Community")
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
    payload: GenerateKeyRequest = GenerateKeyRequest(),
    x_license_key: str | None = Header(None, alias="X-License-Key")
):
    """
    Generates an API key for external AI agents, scripts, or spreadsheet automation.
    If table_id is omitted, an ephemeral autonomous agent session is created automatically.
    """
    raw_license = payload.license_key or x_license_key
    license_key_hash = None
    if raw_license:
        license_rec = get_license_by_raw_key(raw_license.strip())
        if license_rec:
            license_key_hash = license_rec.get("key_hash")
            
    if not license_key_hash:
        license_key_hash = hash_key("free_community_license")
        
    table_id = payload.table_id.strip() if payload.table_id and payload.table_id.strip() else f"agent-session-{uuid.uuid4().hex[:12]}"
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

class RevokeKeyRequest(BaseModel):
    table_id: str = Field(..., alias="tableId", description="ID da planilha cuja chave será revogada")
    api_key: str | None = Field(default=None, alias="apiKey", description="Chave de API opcional a ser revogada")

    model_config = {"populate_by_name": True}

class RevokeKeyResponse(BaseModel):
    success: bool
    already_inactive: bool = Field(default=False, alias="alreadyInactive")
    message: str
    table_id: str = Field(..., alias="tableId")

    model_config = {"populate_by_name": True}

@router.post("/revoke", response_model=RevokeKeyResponse)
async def revoke_api_key_endpoint(
    payload: RevokeKeyRequest,
    x_spreadsheet_key: str | None = Header(None, alias="X-Spreadsheet-Key")
):
    """
    Kill-Switch: Revoga e desativa imediatamente a chave de API da planilha.
    Desconecta SSE em tempo real e purga caches de memória associados.
    Idempotente: retorna 200 OK mesmo se a chave já estiver inativa.
    """
    table_id = payload.table_id.strip()
    raw_key = payload.api_key or x_spreadsheet_key
    
    try:
        success, was_active = revoke_spreadsheet_api_key(table_id=table_id, raw_key=raw_key)
        
        # Purge in-memory active tables
        from routers.public_api_router import TABLE_IN_MEMORY_STORAGE
        TABLE_IN_MEMORY_STORAGE.pop(table_id, None)

        msg = "Chave de API revogada e desativada com sucesso." if was_active else "Nenhuma chave ativa encontrada (já revogada ou expirada)."

        return RevokeKeyResponse(
            success=True,
            alreadyInactive=not was_active,
            message=msg,
            tableId=table_id
        )
    except Exception as e:
        log.error(f"Erro ao revogar chave para table_id {table_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao revogar a chave de API: {e}"
        )


