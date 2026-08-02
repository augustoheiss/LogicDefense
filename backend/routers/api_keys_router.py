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
    Generates a spreadsheet API key tied to a valid PRO license key.
    """
    raw_license = payload.license_key or x_license_key
    if not raw_license:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Por favor, ative uma Chave de Licença PRO para gerar chaves de integração via API para IAs externas."
        )

    license_rec = get_license_by_raw_key(raw_license.strip())
    if not license_rec:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de Licença PRO inválida ou não encontrada."
        )
        
    if license_rec.get("token_balance", 0) <= 0 and license_rec.get("tier") != "godmode_owner":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Saldo de tokens insuficiente na sua licença PRO."
        )
        
    license_key_hash = license_rec["key_hash"]
    table_id = payload.table_id.strip()
    
    api_key, hint = create_spreadsheet_api_key(
        table_id=table_id,
        license_key_hash=license_key_hash,
        permissions=payload.permissions
    )
    
    return GenerateKeyResponse(
        api_key=api_key,
        key_hint=hint,
        table_id=table_id,
        permissions=payload.permissions
    )
