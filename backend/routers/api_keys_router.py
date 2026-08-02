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
    get_spreadsheet_api_key
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/api-keys", tags=["API Keys Management"])

class GenerateKeyRequest(BaseModel):
    table_id: str = Field(..., description="ID da planilha para a qual a chave será gerada")
    license_key: str | None = Field(default=None, description="Sua Chave de Licença PRO (am_pro_...)")
    permissions: str = Field(default="read:write", description="Permissões da chave: 'read-only' ou 'read:write'")

class GenerateKeyResponse(BaseModel):
    api_key: str = Field(..., description="Chave de API em texto puro (exibida apenas uma vez)")
    key_hint: str = Field(..., description="Dica visual da chave (últimos 4 caracteres)")
    table_id: str
    permissions: str

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
    
    try:
        api_key, hint = create_spreadsheet_api_key(
            table_id=table_id,
            license_key_hash=license_key_hash,
            permissions=payload.permissions,
            raw_license=raw_license or "free_community_license"
        )
    except Exception as e:
        log.error(f"Failed to generate API key for table {table_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao criar a chave de API: {e}"
        )
    
    return GenerateKeyResponse(
        api_key=api_key,
        key_hint=hint,
        table_id=table_id,
        permissions=payload.permissions
    )
