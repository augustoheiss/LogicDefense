import os
import httpx
import logging
import secrets
import hashlib
import datetime
from fastapi import APIRouter, HTTPException, Header, status, Depends
from pydantic import BaseModel, Field

# Setup logger
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/api-keys", tags=["API Keys Management"])

class GenerateKeyRequest(BaseModel):
    table_id: str = Field(..., description="ID da planilha para a qual a chave será gerada")
    permissions: str = Field(default="read:write", description="Permissões da chave: 'read-only' ou 'read:write'")

class GenerateKeyResponse(BaseModel):
    api_key: str = Field(..., description="Chave de API em texto puro (exibida apenas uma vez)")
    key_hint: str = Field(..., description="Dica visual da chave (últimos 4 caracteres)")
    table_id: str
    permissions: str

async def get_authenticated_user_and_token(authorization: str = Header(None)) -> tuple[str, str]:
    """Valida o token JWT com o Supabase Auth e retorna a ID do usuário e o token limpo."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabeçalho de autorização ausente."
        )
    
    token = authorization.strip()
    if token.startswith("Bearer "):
        token = token[7:].strip()
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuração do Supabase ausente no servidor do backend."
        )
    
    auth_headers = {
        "apikey": supabase_anon_key,
        "Authorization": f"Bearer {token}"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            auth_res = await client.get(f"{supabase_url}/auth/v1/user", headers=auth_headers)
            if auth_res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Sessão expirada ou inválida: {auth_res.text}"
                )
            user_data = auth_res.json()
            user_id = user_data.get("id")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="ID de usuário não encontrado no token de autenticação."
                )
            return user_id, token
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Falha na verificação de autenticação: {e}"
            )

async def verify_table_ownership_and_premium(user_id: str, token: str, table_id: str):
    """Verifica se o usuário é dono da planilha e valida regras Freemium usando o JWT do próprio usuário."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Credenciais do banco de dados ausentes."
        )
    
    user_headers = {
        "apikey": supabase_anon_key,
        "Authorization": f"Bearer {token}"
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Verificar se a tabela existe e pertence ao usuário (RLS filtra e retorna apenas se for dono)
        tbl_url = f"{supabase_url}/rest/v1/coin_tables?id=eq.{table_id}&select=user_id"
        try:
            tbl_res = await client.get(tbl_url, headers=user_headers)
            if tbl_res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Erro ao consultar planilha no banco: {tbl_res.text}"
                )
            
            tbl_data = tbl_res.json()
            if not tbl_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Planilha não encontrada ou você não tem permissão para acessá-la."
                )
                
            owner_id = tbl_data[0].get("user_id")
            if owner_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Acesso negado: Você não é o dono desta planilha."
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de verificação da planilha: {e}"
            )
            
        # 2. Obter plano de assinatura usando o token do próprio usuário (satisfaz RLS da profiles)
        profile_url = f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}&select=premium_tier"
        try:
            profile_res = await client.get(profile_url, headers=user_headers)
            premium_tier = "free"
            if profile_res.status_code == 200 and profile_res.json():
                premium_tier = profile_res.json()[0].get("premium_tier", "free")
        except Exception as e:
            log.error(f"Erro ao obter premium_tier: {e}")
            premium_tier = "free"
            
        # 3. Se for gratuito, verificar se já possui outra chave de API ativa
        if premium_tier != "premium":
            # Obter todas as tabelas do usuário (via JWT do usuário para segurança)
            all_tbl_url = f"{supabase_url}/rest/v1/coin_tables?user_id=eq.{user_id}&select=id"
            all_tbl_res = await client.get(all_tbl_url, headers=user_headers)
            if all_tbl_res.status_code == 200:
                user_table_ids = [t.get("id") for t in all_tbl_res.json() if t.get("id")]
                if user_table_ids:
                    # Buscar chaves de API existentes pertencentes a essas planilhas
                    keys_url = f"{supabase_url}/rest/v1/spreadsheet_api_keys?select=table_id"
                    keys_res = await client.get(keys_url, headers=user_headers)
                    if keys_res.status_code == 200:
                        existing_keys = keys_res.json()
                        other_keys = [
                            k for k in existing_keys 
                            if k.get("table_id") in user_table_ids and k.get("table_id") != table_id
                        ]
                        if len(other_keys) >= 1:
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Upgrade to PRO to manage additional API keys."
                            )

@router.post("/generate", response_model=GenerateKeyResponse)
async def generate_api_key(
    payload: GenerateKeyRequest,
    auth_data: tuple[str, str] = Depends(get_authenticated_user_and_token)
):
    user_id, token = auth_data
    table_id = payload.table_id
    
    # Valida ownership e limite Freemium usando o token do usuário
    await verify_table_ownership_and_premium(user_id, token, table_id)
    
    # Gerar token cru seguro
    raw_token = secrets.token_hex(32) # 64 hex chars
    api_key = f"am_sheet_live_{raw_token}"
    
    # Calcular hash SHA-256 e dica visual (hint)
    key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    key_hint = f"...{api_key[-4:]}"
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    
    # Usar cabeçalhos com o JWT do usuário para passar com as devidas permissões RLS
    headers = {
        "apikey": supabase_anon_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    upsert_payload = {
        "table_id": table_id,
        "key_hash": key_hash,
        "key_hint": key_hint,
        "permissions": payload.permissions,
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    
    # Executar upsert via fluxo robusto de Verificação -> Inserção/Atualização
    async with httpx.AsyncClient() as client:
        # 1. Verificar se a chave já existe para esta planilha (usando JWT do usuário)
        check_url = f"{supabase_url}/rest/v1/spreadsheet_api_keys?table_id=eq.{table_id}"
        check_res = await client.get(check_url, headers=headers)
        
        if check_res.status_code == 200 and check_res.json():
            # 2. Se já existe, atualizar (PATCH)
            db_res = await client.patch(
                f"{supabase_url}/rest/v1/spreadsheet_api_keys?table_id=eq.{table_id}",
                json=upsert_payload,
                headers=headers
            )
        else:
            # 3. Se não existe, criar (POST)
            db_res = await client.post(
                f"{supabase_url}/rest/v1/spreadsheet_api_keys",
                json=upsert_payload,
                headers=headers
            )
            
        if db_res.status_code not in (200, 201, 204):
            log.error(f"Erro ao salvar chave de API: {db_res.text}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao salvar chave de API no banco de dados."
            )
            
    return GenerateKeyResponse(
        api_key=api_key,
        key_hint=key_hint,
        table_id=table_id,
        permissions=payload.permissions
    )
