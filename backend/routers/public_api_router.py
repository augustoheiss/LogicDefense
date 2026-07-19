import os
import httpx
import logging
import hashlib
import uuid
import datetime
from fastapi import APIRouter, Security, HTTPException, Header, status, Depends, Query, Request
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from typing import List, Optional

import re
import json
import asyncio
from google import genai
from google.genai import types

# Import backend metrics engine and models
from services.coin_metrics_engine import compute_metrics
from services.context_builder import build_financial_context, get_system_prompt
from models.coin_models import (
    TableRow,
    TableGoals,
    EntryType,
    AIAnalystPayload
)

MODEL = os.getenv("COIN_AI_MODEL", "gemini-2.5-flash")
MAX_OUTPUT_TOKENS = 16384
THINKING_BUDGET = 4096

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Setup logger
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["Public API Integration"])

@router.get("/openapi.json", include_in_schema=False)
async def get_public_openapi(request: Request):
    app = request.app
    # 1. Generate the master openapi schema
    full_schema = get_openapi(
        title="Assistente Moeda - Public API Integration",
        version="1.0.0",
        description="Public endpoints to integrate your spreadsheet with external IAs (ChatGPT, Claude) and automated tools.",
        routes=app.routes,
    )

    # 2. Filter paths to only include those under /api/v1/public
    public_paths = {}
    for path, path_item in full_schema.get("paths", {}).items():
        if path.startswith("/api/v1/public"):
            if path == "/api/v1/public/openapi.json":
                continue
            public_paths[path] = path_item

    # 3. Filter components/schemas to only keep models used in public routes (e.g. TableRow, etc.)
    filtered_components = {"schemas": {}}
    used_schemas = set()
    
    import json
    public_paths_str = json.dumps(public_paths)
    for schema_name in full_schema.get("components", {}).get("schemas", {}).keys():
        if f"#/components/schemas/{schema_name}" in public_paths_str:
            used_schemas.add(schema_name)
            filtered_components["schemas"][schema_name] = full_schema["components"]["schemas"][schema_name]

    # Resolve schema dependency references recursively
    schema_definitions = full_schema.get("components", {}).get("schemas", {})
    resolved_any = True
    while resolved_any:
        resolved_any = False
        components_str = json.dumps(filtered_components)
        for schema_name in schema_definitions.keys():
            if schema_name not in used_schemas:
                if f"#/components/schemas/{schema_name}" in components_str:
                    used_schemas.add(schema_name)
                    filtered_components["schemas"][schema_name] = schema_definitions[schema_name]
                    resolved_any = True

    # 4. Resolve the active host url dynamically (Localhost, Staging, or Production)
    server_url = str(request.base_url).rstrip("/")

    # 5. Build clean public specification
    public_openapi_schema = {
        "openapi": full_schema.get("openapi", "3.1.0"),
        "info": full_schema.get("info"),
        "servers": [{"url": server_url, "description": "Active API Server"}],
        "paths": public_paths,
        "components": filtered_components
    }

    return JSONResponse(content=public_openapi_schema)

# Chave API header
API_KEY_HEADER = APIKeyHeader(name="X-Spreadsheet-Key", auto_error=True)

class PublicAIAnalystPayload(BaseModel):
    user_prompt: str = Field(..., description="The natural language question or command from the user.", alias="userPrompt")
    as_of_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional reference date in YYYY-MM-DD format.", alias="asOfDate")
    start_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional start date for filtering in YYYY-MM-DD format.", alias="startDate")
    end_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional end date for filtering in YYYY-MM-DD format.", alias="endDate")

    model_config = {"populate_by_name": True}

class PublicAIAnalystResponse(BaseModel):
    content: str = Field(..., description="The textual response from the AI or confirmation of executed action.")
    model_used: str = Field(..., description="The LLM model backing the generation.", alias="modelUsed")

    model_config = {"populate_by_name": True}

# ── Dependency: Resolve API Key ──────────────────────────────────────────────

async def validate_api_key_and_get_table_id(
    request_type: str, # 'read' or 'write'
    api_key: str = Security(API_KEY_HEADER)
) -> str:
    """Valida a chave de API estática (SHA-256) e retorna a table_id autorizada."""
    if not api_key.startswith("am_sheet_live_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de chave de API inválido. Deve iniciar com 'am_sheet_live_'"
        )
    
    # Calcular hash SHA-256
    key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuração do Supabase ausente no servidor do backend."
        )
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    async with httpx.AsyncClient() as client:
        url = f"{supabase_url}/rest/v1/spreadsheet_api_keys?key_hash=eq.{key_hash}&select=table_id,permissions"
        try:
            res = await client.get(url, headers=headers)
            if res.status_code != 200 or not res.json():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Chave de API inválida ou revogada."
                )
            
            data = res.json()[0]
            table_id = data.get("table_id")
            permissions = data.get("permissions", "read:write")
            
            # Validar permissões de escrita
            if request_type == "write" and permissions == "read-only":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Acesso negado: Chave de API possui apenas permissão de leitura ('read-only')."
                )
                
            # Atualizar last_used_at de forma assíncrona/segura
            # (Não bloqueia a execução da rota principal em caso de falha menor)
            try:
                update_url = f"{supabase_url}/rest/v1/spreadsheet_api_keys?key_hash=eq.{key_hash}"
                await client.patch(
                    update_url, 
                    json={"last_used_at": datetime.datetime.utcnow().isoformat()}, 
                    headers=headers
                )
            except Exception:
                pass
                
            return table_id
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro interno de validação: {e}"
            )

class APIKeyValidator:
    def __init__(self, request_type: str):
        self.request_type = request_type

    async def __call__(self, api_key: str = Security(API_KEY_HEADER)) -> str:
        return await validate_api_key_and_get_table_id(self.request_type, api_key)

def get_table_id_for_read(table_id: str = Depends(APIKeyValidator("read"))) -> str:
    return table_id

def get_table_id_for_write(table_id: str = Depends(APIKeyValidator("write"))) -> str:
    return table_id

# ── Endpoints ─────────────────────────────────────────────────────────────────

class PublicAnalysisContextResponse(BaseModel):
    context: str = Field(..., description="Pre-computed operational financial intelligence formatted in Markdown, optimized with tiered token compression.")

@router.get("/analysis-context", response_model=PublicAnalysisContextResponse)
async def get_analysis_context(
    table_id: str = Depends(get_table_id_for_read),
    as_of_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Reference date YYYY-MM-DD"),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional start date for temporal filtering YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional end date for temporal filtering YYYY-MM-DD")
):
    """Retorna o contexto financeiro estruturado em Markdown para uso por IAs externas."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    ref_date = as_of_date or datetime.date.today().isoformat()
    
    async with httpx.AsyncClient() as client:
        # 1. Obter metadados da planilha
        tbl_url = f"{supabase_url}/rest/v1/coin_tables?id=eq.{table_id}&select=*"
        tbl_res = await client.get(tbl_url, headers=headers)
        if tbl_res.status_code != 200 or not tbl_res.json():
            raise HTTPException(status_code=404, detail="Planilha não localizada.")
        table_data = tbl_res.json()[0]
        table_name = table_data.get("name", "Sem Nome")
        total_waiver_credits = float(table_data.get("total_waiver_credits") or 0.0)
        
        # 2. Obter todas as transações (ordenadas por data ascendente para a performance semanal)
        tx_url = f"{supabase_url}/rest/v1/transactions?table_id=eq.{table_id}&select=*&order=date.asc"
        tx_res = await client.get(tx_url, headers=headers)
        if tx_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Erro ao buscar transações da planilha.")
            
        # Parse para modelos pydantic
        raw_rows = tx_res.json()
        rows = []
        for r in raw_rows:
            try:
                rows.append(TableRow(**r))
            except Exception as e:
                log.warning(f"Erro ao converter TableRow nas chaves de API: {e}")
                
        raw_goals = table_data.get("goals") or {}
        goals = TableGoals()
        if isinstance(raw_goals, dict):
            try:
                goals = TableGoals(**raw_goals)
            except Exception:
                pass
                
        # 3. Computar métricas no motor matemático
        try:
            metrics = compute_metrics(
                rows=rows,
                goals=goals,
                as_of_date=ref_date,
                total_waiver_credits=total_waiver_credits
            )
        except Exception as e:
            log.exception(f"Erro ao computar métricas para o contexto: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao compilar métricas: {e}")
            
        # 4. Filtrar transações temporais (Token Economy) mantendo as métricas de histórico intactas
        focused_rows = rows
        if start_date and end_date:
            focused_rows = [r for r in rows if start_date <= r.date <= end_date]

        # 5. Construir o payload temporário do AIAnalyst
        payload = AIAnalystPayload(
            message="",
            rows=focused_rows,
            goals=goals,
            tableName=table_name,
            totalWaiverCredits=total_waiver_credits,
            asOfDate=ref_date
        )
        
        # 6. Gerar o contexto em Markdown usando o serviço compartilhado
        try:
            context_markdown = build_financial_context(payload, metrics)
        except Exception as e:
            log.exception(f"Erro ao gerar o contexto em Markdown: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao gerar o contexto em Markdown: {e}")
            
        return PublicAnalysisContextResponse(context=context_markdown)

async def execute_add_transaction(
    table_id: str,
    description: str,
    value: float,
    date: str,
    entry_type: str,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None
) -> dict:
    # Validar formato da data YYYY-MM-DD
    try:
        datetime.datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Formato de data '{date}' inválido. Use o padrão YYYY-MM-DD."
        )
        
    # Validar tipo de transação
    allowed_types = [t.value for t in EntryType]
    if entry_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"entry_type '{entry_type}' inválido. Tipos permitidos: {allowed_types}"
        )
        
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client_http:
        # Gerar ID único no padrão do app
        tx_uuid = str(uuid.uuid4())
        new_tx_id = f"tx_api_{tx_uuid.replace('-', '')[:16]}"
        
        transaction_row = {
            "id": new_tx_id,
            "table_id": table_id,
            "date": date,
            "value": abs(value),
            "description": description or "Sem descrição",
            "entry_type": entry_type,
            "generated_by": "public_api_ai",
            "period_start": period_start,
            "period_end": period_end,
            "updated_at": datetime.datetime.utcnow().isoformat()
        }
        
        insert_url = f"{supabase_url}/rest/v1/transactions"
        post_headers = {**headers, "Prefer": "return=representation"}
        
        res = await client_http.post(insert_url, json=transaction_row, headers=post_headers)
        if res.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao salvar transação via IA: {res.text}"
            )
            
        return res.json()[0]

@router.post("/ai-analyst", response_model=PublicAIAnalystResponse)
async def public_ai_analyst(
    payload: PublicAIAnalystPayload,
    table_id: str = Depends(get_table_id_for_write)
):
    """Garante inteligência financeira via IA pública com auto-execução de transações (God Mode)."""
    if not client:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY não configurada. O serviço de IA está indisponível.",
        )

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    ref_date = payload.as_of_date or datetime.date.today().isoformat()
    
    async with httpx.AsyncClient() as client_http:
        # 1. Obter metadados da planilha
        tbl_url = f"{supabase_url}/rest/v1/coin_tables?id=eq.{table_id}&select=*"
        tbl_res = await client_http.get(tbl_url, headers=headers)
        if tbl_res.status_code != 200 or not tbl_res.json():
            raise HTTPException(status_code=404, detail="Planilha não localizada.")
        table_data = tbl_res.json()[0]
        table_name = table_data.get("name", "Sem Nome")
        total_waiver_credits = float(table_data.get("total_waiver_credits") or 0.0)
        
        # 2. Obter todas as transações (ordenadas por data ascendente para a performance semanal)
        tx_url = f"{supabase_url}/rest/v1/transactions?table_id=eq.{table_id}&select=*&order=date.asc"
        tx_res = await client_http.get(tx_url, headers=headers)
        if tx_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Erro ao buscar transações da planilha.")
            
        raw_rows = tx_res.json()
        rows = []
        for r in raw_rows:
            try:
                rows.append(TableRow(**r))
            except Exception as e:
                log.warning(f"Erro ao converter TableRow nas chaves de API: {e}")
                
        raw_goals = table_data.get("goals") or {}
        goals = TableGoals()
        if isinstance(raw_goals, dict):
            try:
                goals = TableGoals(**raw_goals)
            except Exception:
                pass
                
        # 3. Computar métricas no motor matemático
        try:
            metrics = compute_metrics(
                rows=rows,
                goals=goals,
                as_of_date=ref_date,
                total_waiver_credits=total_waiver_credits
            )
        except Exception as e:
            log.exception(f"Erro ao computar métricas para o analista de IA: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao compilar métricas: {e}")
            
        # 4. Filtrar transações temporais (Token Economy) mantendo as métricas de histórico intactas
        focused_rows = rows
        if payload.start_date and payload.end_date:
            focused_rows = [r for r in rows if payload.start_date <= r.date <= payload.end_date]

        # 5. Construir o payload temporário do AIAnalyst
        analyst_payload = AIAnalystPayload(
            message=payload.user_prompt,
            rows=focused_rows,
            goals=goals,
            tableName=table_name,
            totalWaiverCredits=total_waiver_credits,
            asOfDate=ref_date
        )
        
        # 6. Gerar o contexto em Markdown usando o serviço compartilhado
        try:
            financial_context = build_financial_context(analyst_payload, metrics)
        except Exception as e:
            log.exception(f"Erro ao gerar o contexto em Markdown para IA: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao gerar o contexto em Markdown: {e}")
            
    # 6. Query Gemini
    user_message = (
        f"{financial_context}\n\n"
        f"── PERGUNTA DO USUÁRIO ──\n"
        f"{payload.user_prompt}"
    )
    
    try:
        available_tables = [table_name]
        system_prompt = get_system_prompt(available_tables)
        
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.4,
                max_output_tokens=MAX_OUTPUT_TOKENS,
                **{"thinking_config": types.ThinkingConfig(  # type: ignore[arg-type]
                    thinking_budget=THINKING_BUDGET
                )}
            )
        )
        
        analysis_text = (response.text or "").strip()
        if not analysis_text:
            raise ValueError("Gemini retornou resposta vazia")
            
    except Exception as exc:
        log.exception("Erro ao chamar API do Gemini na rota pública: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao consultar a IA pública: {exc}"
        ) from exc
        
    # 7. Interceptor "God Mode" (Auto-Execution)
    match = re.search(r"```json\s*(.*?)\s*```", analysis_text, re.DOTALL)
    if match:
        try:
            action_data = json.loads(match.group(1).strip())
            action = action_data.get("action")
            params = action_data.get("parameters", {})
            
            if action == "add_transaction":
                desc = params.get("description", "")
                val = float(params.get("value", 0.0))
                dt = params.get("date") or ref_date
                entry_type = params.get("entry_type") or params.get("entryType")
                if not entry_type:
                    entry_type = "expense" if val < 0 else "revenue"
                
                period_start = params.get("period_start") or params.get("periodStart") or None
                period_end = params.get("period_end") or params.get("periodEnd") or None
                
                if period_start == "":
                    period_start = None
                if period_end == "":
                    period_end = None
                    
                await execute_add_transaction(
                    table_id=table_id,
                    description=desc,
                    value=val,
                    date=dt,
                    entry_type=entry_type,
                    period_start=period_start,
                    period_end=period_end
                )
                
                analysis_text = f"✓ Ação executada com sucesso: Salva transação '{desc}' de R$ {abs(val):,.2f} em {dt}."
                
            elif action == "bulk_add_transactions":
                transactions = params.get("transactions", [])
                inserted_count = 0
                lines = []
                for tx in transactions:
                    desc = tx.get("description", "")
                    val = float(tx.get("value", 0.0))
                    dt = tx.get("date") or ref_date
                    entry_type = tx.get("entry_type") or tx.get("entryType")
                    if not entry_type:
                        entry_type = "expense" if val < 0 else "revenue"
                    
                    period_start = tx.get("period_start") or tx.get("periodStart") or None
                    period_end = tx.get("period_end") or tx.get("periodEnd") or None
                    
                    if period_start == "":
                        period_start = None
                    if period_end == "":
                        period_end = None
                        
                    await execute_add_transaction(
                        table_id=table_id,
                        description=desc,
                        value=val,
                        date=dt,
                        entry_type=entry_type,
                        period_start=period_start,
                        period_end=period_end
                    )
                    inserted_count += 1
                    lines.append(f"- '{desc}' de R$ {abs(val):,.2f} em {dt}")
                    
                analysis_text = f"✓ Ação executada com sucesso: Salvas {inserted_count} transações:\n" + "\n".join(lines)
                
        except Exception as e:
            log.exception("Erro ao interceptar e auto-executar transações no God Mode: %s", e)
            analysis_text = f"{analysis_text}\n\n⚠️ Erro ao processar a ação sugerida pela IA no banco de dados: {e}"
            
    return PublicAIAnalystResponse(content=analysis_text, model_used=MODEL)
