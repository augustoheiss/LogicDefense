import os
import logging
import hashlib
import uuid
import datetime
import re
import json
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Security, HTTPException, Header, status, Depends, Query, Request
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse, Response
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

# Import backend metrics engine and models
from services.coin_metrics_engine import compute_metrics
from services.context_builder import build_financial_context, get_system_prompt
from prompts.finance_prompts import (
    SKILLS_MANIFEST,
    get_agent_native_master_prompt,
    get_cfo_fpa_prompt,
    get_operational_godmode_prompt,
    get_goals_timebank_prompt,
    get_developer_script_prompt,
)
from models.coin_models import (
    TableRow,
    TableGoals,
    EntryType,
    AIAnalystPayload
)

from google import genai
from google.genai import types

MODEL = os.getenv("COIN_AI_MODEL", "gemini-3.7-flash")
MAX_OUTPUT_TOKENS = 16384
THINKING_BUDGET = 4096

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Setup logger
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["Public API Integration"])


class PublicAgentPromptResponse(BaseModel):
    status: str = Field("success", description="Status da resposta.")
    version: str = Field("2.0.0", description="Versão da especificação de Prompts & Habilidades.")
    workflow_steps: List[Dict[str, Any]] = Field(..., description="Sequência mandatória de execução do agente.")
    skills_integrated: List[Dict[str, str]] = Field(..., description="Manifesto das 8 skills financeiras integradas.")
    prompt: str = Field(..., description="Texto do prompt de instrução selecionado.")
    profile_used: str = Field(..., description="Perfil de prompt retornado.")
    mandatory_next_route: str = Field("POST /api/v1/public/ai-analyst", description="Próxima rota mandatória a ser chamada pela IA.")
    api_key_status: str = Field("anonymous", description="Status da chave informada ('active' ou 'anonymous').")

@router.get("/openapi.json", include_in_schema=False)
async def get_public_openapi(request: Request):
    app = request.app
    full_schema = get_openapi(
        title="HeissLab & LogicDefense — Unified Public API (Assistente Moeda & CV Maker 2.0)",
        version="2.0.0",
        description="Public in-memory and stateless endpoints for financial analysis, DRE computation, and CV generation/rendering.",
        routes=app.routes,
    )

    public_paths = {}
    for path, path_item in full_schema.get("paths", {}).items():
        if path.startswith("/api/v1/public") or path.startswith("/api/v1/cv"):
            if path == "/api/v1/public/openapi.json":
                continue
            public_paths[path] = path_item

    filtered_components = {"schemas": {}}
    used_schemas = set()
    
    public_paths_str = json.dumps(public_paths)
    for schema_name in full_schema.get("components", {}).get("schemas", {}).keys():
        if f"#/components/schemas/{schema_name}" in public_paths_str:
            used_schemas.add(schema_name)
            filtered_components["schemas"][schema_name] = full_schema["components"]["schemas"][schema_name]

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

    server_url = str(request.base_url).rstrip("/")

    public_openapi_schema = {
        "openapi": full_schema.get("openapi", "3.1.0"),
        "info": full_schema.get("info"),
        "servers": [{"url": server_url, "description": "Active API Server"}],
        "paths": public_paths,
        "components": filtered_components
    }

    return JSONResponse(content=public_openapi_schema)

# API Key header dependency
API_KEY_HEADER = APIKeyHeader(name="X-Spreadsheet-Key", auto_error=True)

# In-memory storage for active table transactions and exports
TABLE_IN_MEMORY_STORAGE: Dict[str, Dict[str, Any]] = {}


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
    api_key = (api_key or "").strip()
    if not api_key.startswith("am_sheet_live_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de chave de API inválido. Deve iniciar com 'am_sheet_live_'"
        )
    
    key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    
    from db.license_db import get_spreadsheet_api_key
    record = get_spreadsheet_api_key(key_hash)
    if not record:
        log.warning(f"[API Auth Debug] key_hash {key_hash} not found for raw key '{api_key[:15]}...' (len {len(api_key)})")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de API inválida ou revogada."
        )
    if record.get("is_expired"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key Expired"
        )
        
    permissions = record.get("permissions", "read:write")
    if request_type == "write" and permissions == "read-only":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Chave de API possui apenas permissão de leitura ('read-only')."
        )
        
    return record["table_id"]

class APIKeyValidator:
    def __init__(self, request_type: str):
        self.request_type = request_type

    async def __call__(self, api_key: str = Security(API_KEY_HEADER)) -> str:
        return await validate_api_key_and_get_table_id(self.request_type, api_key)

def get_table_id_for_read(table_id: str = Depends(APIKeyValidator("read"))) -> str:
    return table_id

def get_table_id_for_write(table_id: str = Depends(APIKeyValidator("write"))) -> str:
    return table_id

# ── Models & Security Helpers ────────────────────────────────────────────────

def neutralize_csv_formula(val: str) -> str:
    """Neutralizes CSV formula injection vectors (=, +, -, @, \\t, \\r) matching src/utils/securitySanitizer.ts."""
    if not val:
        return ""
    trimmed = val.lstrip()
    if not trimmed:
        return val
    first_char = trimmed[0]
    if first_char in ("=", "@", "\t", "\r"):
        return f"'{val}"
    if first_char in ("+", "-"):
        if not re.match(r"^[+-]?\d+([.,]\d+)?$", trimmed):
            return f"'{val}"
    return val


class AppendTransactionItem(BaseModel):
    date: str = Field(..., description="Data em formato YYYY-MM-DD")
    value: float = Field(..., description="Valor monetário da transação")
    description: str = Field(..., description="Descrição da transação")
    entry_type: Optional[str] = Field(None, description="Tipo: expense, revenue, partner_in, partner_out, waiver, deposit, unresolved", alias="entryType")
    category: Optional[str] = Field("Geral", description="Categoria")
    tags: Optional[str] = Field("", description="Tags da transação")
    external_id: Optional[str] = Field(None, description="ID externo para idempotência (ex: n8n_invoice_9841)", alias="externalId")
    metadata_json: Optional[str] = Field("{}", description="String JSON de metadados", alias="metadataJson")
    period_start: Optional[str] = Field(None, description="Início do período YYYY-MM-DD", alias="periodStart")
    period_end: Optional[str] = Field(None, description="Fim do período YYYY-MM-DD", alias="periodEnd")
    monthly_value: Optional[float] = Field(None, description="Valor mensal de recorrência", alias="monthlyValue")
    month_count: Optional[int] = Field(None, description="Quantidade de meses", alias="monthCount")
    ticker: Optional[str] = Field(None, description="Ticker do ativo de investimento")
    quantity: Optional[float] = Field(None, description="Quantidade de cotas/ações")
    unit_price: Optional[float] = Field(None, description="Preço unitário do ativo", alias="unitPrice")
    custom_values: Optional[Dict[str, Any]] = Field(None, description="Colunas dinâmicas customizadas", alias="customValues")

    model_config = {"populate_by_name": True}

class AppendSpreadsheetPayload(BaseModel):
    mode: Optional[str] = Field("merge", description="Modo de importação: 'merge' (acumular entradas) ou 'replace' (substituir planilha). Padrão 'merge'.")
    transactions: Optional[List[AppendTransactionItem]] = Field(None, description="Array de transações estruturadas")
    csv_content: Optional[str] = Field(None, description="Bloco de texto CSV bruto", alias="csvContent")

    model_config = {"populate_by_name": True}

class AppendSpreadsheetResponse(BaseModel):
    success: bool
    mode: str
    inserted_count: int = Field(..., alias="insertedCount")
    updated_count: int = Field(..., alias="updatedCount")
    total_count: int = Field(..., alias="totalCount")
    message: str
    csv_content: Optional[str] = Field(None, description="Texto CSV v2 padronizado e gerado em memória", alias="csvContent")

    model_config = {"populate_by_name": True}

class PublicAnalysisContextResponse(BaseModel):
    context: str = Field(..., description="Contexto financeiro estruturado em Markdown compilado 100% em memória RAM.")

# ── Endpoints (100% Stateless / In-Memory) ───────────────────────────────────

@router.post("/spreadsheet/append", response_model=AppendSpreadsheetResponse)
async def append_to_spreadsheet(
    payload: AppendSpreadsheetPayload,
    request: Request = None,
    table_id: str = Depends(get_table_id_for_write),
    api_key: str = Security(API_KEY_HEADER)
):
    """
    Processa transações enviadas por ferramentas ou agentes de IA 100% em memória RAM.
    Valida, padroniza e gera o CSV formatado sem armazenar dados em banco de dados remoto.
    """
    items_to_process: List[AppendTransactionItem] = []

    # 1. JSON Estruturado
    if payload.transactions:
        items_to_process.extend(payload.transactions)

    # 2. Texto CSV bruto
    if payload.csv_content and payload.csv_content.strip():
        raw_lines = payload.csv_content.strip().split("\n")
        for line in raw_lines:
            if line.startswith("##") or not line.strip():
                continue
            parts = [p.strip().strip('"') for p in line.split(",")]
            if len(parts) >= 3:
                line_lower = line.lower()
                if "date" in line_lower or "data" in line_lower or "description" in line_lower or "entrytype" in line_lower:
                    continue
                try:
                    # Detect if col 1 is date (standard Expo export v3)
                    if len(parts) >= 4 and re.search(r"\d{4}-\d{2}-\d{2}", parts[1]):
                        dt = parts[1]
                        val = float(parts[2])
                        desc = parts[3]
                        entry_type = parts[4] if len(parts) > 4 and parts[4] else ("expense" if val < 0 else "revenue")
                        cat = parts[9] if len(parts) > 9 and parts[9] else "Geral"
                        tag = parts[10] if len(parts) > 10 else ""
                        ext_id = parts[0]
                    else:
                        dt = parts[0]
                        val = float(parts[1])
                        desc = parts[2]
                        entry_type = parts[3] if len(parts) > 3 and parts[3] else ("expense" if val < 0 else "revenue")
                        cat = parts[4] if len(parts) > 4 else "Geral"
                        tag = parts[5] if len(parts) > 5 else ""
                        ext_id = parts[6] if len(parts) > 6 else None

                    items_to_process.append(AppendTransactionItem(
                        date=dt,
                        value=val,
                        description=desc,
                        entryType=entry_type,
                        category=cat,
                        tags=tag,
                        externalId=ext_id
                    ))
                except Exception as parse_err:
                    log.warning(f"Ignorando linha CSV no append: {line} ({parse_err})")

    if not items_to_process:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma transação válida foi fornecida (informe 'transactions' ou 'csv_content')."
        )

    mode = (payload.mode or "merge").lower()

    # Stateful merge vs replace in TABLE_IN_MEMORY_STORAGE
    merged_items: List[AppendTransactionItem] = []
    ext_id_to_index: Dict[str, int] = {}

    if mode == "merge":
        existing_items: List[AppendTransactionItem] = list(
            TABLE_IN_MEMORY_STORAGE.get(table_id, {}).get("items", [])
        )
        for idx, existing in enumerate(existing_items):
            ext_id = existing.external_id or f"tx_api_{idx+1:04d}"
            resolved_et = existing.entry_type or ("expense" if existing.value < 0 else "revenue")
            norm_existing = existing.model_copy(update={
                "external_id": ext_id,
                "entry_type": resolved_et,
            })
            ext_id_to_index[ext_id] = len(merged_items)
            merged_items.append(norm_existing)

    inserted_count = 0
    updated_count = 0
    auto_seq = len(merged_items)

    for item in items_to_process:
        auto_seq += 1
        tx_id = item.external_id or f"tx_api_{auto_seq:04d}"
        entry_type = item.entry_type or ("expense" if item.value < 0 else "revenue")
        norm_item = item.model_copy(update={
            "external_id": tx_id,
            "entry_type": entry_type,
            "category": item.category or "Geral",
            "tags": item.tags or "",
            "description": item.description or "Transação API",
        })

        if tx_id in ext_id_to_index:
            merged_items[ext_id_to_index[tx_id]] = norm_item
            if mode == "merge":
                updated_count += 1
        else:
            ext_id_to_index[tx_id] = len(merged_items)
            merged_items.append(norm_item)
            inserted_count += 1

    total_count = len(merged_items)

    # Processar transações em memória para exportação CSV v2 com blindagem contra CSV Formula Injection
    csv_lines = [
        "## COIN_BACKUP_V2 ##",
        "table_name,Planilha Principal",
        f"id,{table_id}",
        "## ROWS ##",
        "id,date,value,description,entryType,category,tags,external_id"
    ]

    for idx, item in enumerate(merged_items):
        tx_id = neutralize_csv_formula(re.sub(r"[\r\n,]+", "_", item.external_id or f"tx_api_{idx+1:04d}"))
        entry_type = item.entry_type or ("expense" if item.value < 0 else "revenue")
        cat = neutralize_csv_formula(re.sub(r"[\r\n,]+", " ", item.category or "Geral"))
        tag = neutralize_csv_formula(re.sub(r"[\r\n,]+", " ", item.tags or ""))
        desc = neutralize_csv_formula(re.sub(r"[\r\n,]+", " ", item.description or "Transação API"))
        ext_id = neutralize_csv_formula(re.sub(r"[\r\n,]+", "_", item.external_id or tx_id))

        csv_lines.append(f"{tx_id},{item.date},{abs(item.value):.2f},{desc},{entry_type},{cat},{tag},{ext_id}")

    csv_output = "\n".join(csv_lines)

    parsed_goals_dict = {}
    if payload.csv_content and payload.csv_content.strip():
        raw_lines = payload.csv_content.strip().split("\n")
        for line in raw_lines:
            line_str = line.strip()
            if not line_str or line_str.startswith("##"):
                continue
            parts = [p.strip().strip('"') for p in line_str.split(",")]
            if len(parts) >= 2 and parts[0].lower().startswith(("goal_", "meta_", "custo_")):
                key = parts[0].lower()
                try:
                    val = float(parts[1])
                    parsed_goals_dict[key] = val
                except ValueError:
                    pass

    goals_obj = TableGoals()
    for k, v in parsed_goals_dict.items():
        if k in ("goal_global_daily", "meta_global_diaria"):
            if not goals_obj.global_goals:
                goals_obj.global_goals = {}
            goals_obj.global_goals["dailyGoal"] = v
            goals_obj.daily_goals["global"] = v
        elif k in ("goal_global_weekly", "meta_global_semanal"):
            if not goals_obj.global_goals:
                goals_obj.global_goals = {}
            goals_obj.global_goals["weeklyGoal"] = v
            goals_obj.weekly_goals["global"] = v
        elif k in ("goal_global_annual", "meta_global_anual"):
            if not goals_obj.global_goals:
                goals_obj.global_goals = {}
            goals_obj.global_goals["annualCost"] = v
            goals_obj.annual_costs["global"] = v
        else:
            m_year = re.match(r"^(?:goal_|meta_|custo_)(daily|weekly|annual|diaria|semanal|anual)_(\d{4})$", k)
            if m_year:
                g_type, y_str = m_year.groups()
                y_num = int(y_str)
                if g_type in ("daily", "diaria"):
                    goals_obj.daily_goals[y_num] = v
                elif g_type in ("weekly", "semanal"):
                    goals_obj.weekly_goals[y_num] = v
                elif g_type in ("annual", "anual"):
                    goals_obj.annual_costs[y_num] = v
            m_iso = re.match(r"^(?:goal_weekly_|meta_semanal_)(\d{4}-w\d{2})$", k)
            if m_iso:
                iso_key = m_iso.group(1).upper()
                goals_obj.weekly_goals[iso_key] = v

    # ── Update In-Memory Storage for GET routes & Analysis ───────────────
    TABLE_IN_MEMORY_STORAGE[table_id] = {
        "items": merged_items,
        "csv_content": csv_output,
        "goals": goals_obj if parsed_goals_dict else TABLE_IN_MEMORY_STORAGE.get(table_id, {}).get("goals", TableGoals()),
        "updated_at": datetime.datetime.now().isoformat()
    }

    # ── Sequence Versioning & Real-Time SSE / Queue ─────────────────────────
    from db.license_db import get_next_table_sequence, enqueue_pending_sync, hash_key
    from services.sync_broadcaster import broadcaster

    seq_number = get_next_table_sequence(table_id)
    key_h = hash_key(api_key)

    # Build payload object for sync
    sync_event = {
        "event": "MUTATION",
        "tableId": table_id,
        "seqNumber": seq_number,
        "mode": mode,
        "rows": [
            {
                "id": item.external_id or f"tx_api_{idx+1:04d}",
                "date": item.date,
                "value": abs(item.value),
                "description": item.description or "Transação API",
                "entryType": item.entry_type or ("expense" if item.value < 0 else "revenue"),
                "category": item.category or "Geral",
                "tags": item.tags or "",
                "externalId": item.external_id,
                "metadataJson": getattr(item, "metadata_json", "{}") or "{}",
                "periodStart": getattr(item, "period_start", None),
                "periodEnd": getattr(item, "period_end", None),
                "monthlyValue": getattr(item, "monthly_value", None),
                "monthCount": getattr(item, "month_count", None),
                "ticker": getattr(item, "ticker", None),
                "quantity": getattr(item, "quantity", None),
                "unitPrice": getattr(item, "unit_price", None),
                "customValues": getattr(item, "custom_values", None),
            }
            for idx, item in enumerate(items_to_process)
        ]
    }

    # Check if this push came from the browser itself to avoid echo loop
    is_from_browser = False
    if request:
        is_from_browser = request.headers.get("x-origin-browser", "").lower() == "true"

    if not is_from_browser:
        # Check if browser is connected via SSE
        if key_h and broadcaster.has_subscribers(key_h):
            broadcaster.broadcast(key_h, sync_event)
        elif key_h:
            enqueue_pending_sync(key_h, table_id, seq_number, json.dumps(sync_event))

    msg = (
        f"Sucesso! {inserted_count} inseridas, {updated_count} atualizadas "
        f"(total: {total_count}) em memória RAM (seq #{seq_number}, Modo: {mode})."
    )

    return AppendSpreadsheetResponse(
        success=True,
        mode=mode,
        insertedCount=inserted_count,
        updatedCount=updated_count,
        totalCount=total_count,
        message=msg,
        csvContent=csv_output
    )

@router.get("/summary")
async def get_summary_endpoint(
    table_id: str = Depends(get_table_id_for_read)
):
    """
    Retorna os totais consolidados da planilha (Receitas, Despesas, Saldo Líquido, Contagem),
    isolando estritamente aportes/retiradas de sócios (partner_in / partner_out), abonos (waiver) e não-resolvidos.
    """
    stored = TABLE_IN_MEMORY_STORAGE.get(table_id, {})
    items: List[AppendTransactionItem] = stored.get("items", [])

    def _resolve_et(it: AppendTransactionItem) -> str:
        return it.entry_type or ("expense" if it.value < 0 else "revenue")

    total_income = round(sum(abs(it.value) for it in items if _resolve_et(it) == "revenue"), 2)
    total_expense = round(sum(abs(it.value) for it in items if _resolve_et(it) == "expense"), 2)
    total_deposits = round(sum(abs(it.value) for it in items if _resolve_et(it) == "deposit"), 2)
    total_partner_in = round(sum(abs(it.value) for it in items if _resolve_et(it) == "partner_in"), 2)
    total_partner_out = round(sum(abs(it.value) for it in items if _resolve_et(it) == "partner_out"), 2)
    total_waivers = round(sum(abs(it.value) for it in items if _resolve_et(it) == "waiver"), 2)
    net_balance = round(total_income - total_expense, 2)
    
    return {
        "status": "success",
        "table_id": table_id,
        "total_income": total_income,
        "total_expense": total_expense,
        "total_deposits": total_deposits,
        "total_partner_in": total_partner_in,
        "total_partner_out": total_partner_out,
        "total_waivers": total_waivers,
        "net_balance": net_balance,
        "row_count": len(items),
        "updated_at": stored.get("updated_at")
    }

@router.get("/transactions")
async def get_transactions_endpoint(
    table_id: str = Depends(get_table_id_for_read),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
):
    """
    Retorna a lista de transações com suporte a filtros opcionais de data.
    """
    stored = TABLE_IN_MEMORY_STORAGE.get(table_id, {})
    items: List[AppendTransactionItem] = stored.get("items", [])
    
    filtered = []
    for it in items:
        if start_date and it.date < start_date:
            continue
        if end_date and it.date > end_date:
            continue
        et = it.entry_type or ("expense" if it.value < 0 else "revenue")
        val = -abs(it.value) if et in ("expense", "partner_out") else abs(it.value)
        filtered.append({
            "id": it.external_id or "tx",
            "date": it.date,
            "value": val,
            "description": it.description,
            "category": it.category,
            "tags": it.tags,
            "entry_type": et
        })
        
    return {
        "status": "success",
        "table_id": table_id,
        "count": len(filtered),
        "transactions": filtered
    }

@router.post("/transactions", response_model=AppendSpreadsheetResponse)
@router.post("/transactions/batch-sync", response_model=AppendSpreadsheetResponse)
async def post_transactions_batch(
    payload: AppendSpreadsheetPayload,
    request: Request,
    table_id: str = Depends(get_table_id_for_write),
    api_key: str = Security(API_KEY_HEADER)
):
    """
    Ingestão atômica ou em lote de transações financeiras para a planilha ativa.
    """
    return await append_to_spreadsheet(payload=payload, request=request, table_id=table_id, api_key=api_key)

# ── Sync Endpoints (SSE Stream & Pending Queue) ───────────────────────────────

@router.get("/sync/stream")
async def sync_stream_sse(
    api_key: str = Query(..., description="Chave API da planilha am_sheet_live_..."),
):
    """
    Endpoint de streaming SSE (Server-Sent Events) em tempo real.
    Transmite atualizações instantâneas da API diretamente para o navegador.
    """
    if not api_key.startswith("am_sheet_live_"):
        raise HTTPException(status_code=401, detail="Chave API inválida.")
        
    key_h = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    from db.license_db import get_spreadsheet_api_key
    record = get_spreadsheet_api_key(key_h)
    if not record or not record.get("is_active", 1):
        raise HTTPException(status_code=401, detail="Chave API revogada ou inválida.")
    if record.get("is_expired"):
        raise HTTPException(status_code=401, detail="API Key Expired")

    from services.sync_broadcaster import broadcaster

    async def event_generator():
        q = broadcaster.subscribe(key_h)
        try:
            # Yield initial connection confirmation
            yield f"data: {json.dumps({'event': 'CONNECTED', 'tableId': record['table_id']})}\n\n"
            while True:
                try:
                    # Wait for next event or heartbeat timeout (15s)
                    msg_str = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {msg_str}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'event': 'ping'})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(key_h, q)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/sync/pending")
async def sync_pending_queue(
    api_key: str = Query(..., description="Chave API da planilha am_sheet_live_..."),
    since_seq: int = Query(0, description="Última versão da sequência (seq_number) já aplicada localmente")
):
    """
    Drena mutações offline da fila pending_sync_queue com seq_number > since_seq.
    """
    if not api_key.startswith("am_sheet_live_"):
        raise HTTPException(status_code=401, detail="Chave API inválida.")
        
    key_h = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    from db.license_db import get_spreadsheet_api_key, pop_pending_sync
    record = get_spreadsheet_api_key(key_h)
    if not record or not record.get("is_active", 1):
        raise HTTPException(status_code=401, detail="Chave API revogada ou inválida.")
    if record.get("is_expired"):
        raise HTTPException(status_code=401, detail="API Key Expired")

    pending_items = pop_pending_sync(key_h, since_seq=since_seq)
    
    parsed_events = []
    for item in pending_items:
        try:
            p_data = json.loads(item["payload_json"])
            p_data["seqNumber"] = item["seq_number"]
            parsed_events.append(p_data)
        except Exception:
            pass

    return {
        "success": True,
        "pendingCount": len(parsed_events),
        "events": parsed_events
    }

@router.get("/agent-prompt", response_model=PublicAgentPromptResponse, summary="[ROTA OBRIGATÓRIA #0] Ingestão de Prompt & Habilidades Financeiras")
@router.get("/prompt", response_model=PublicAgentPromptResponse, summary="[ROTA OBRIGATÓRIA #0] Ingestão de Prompt & Habilidades Financeiras")
async def get_agent_prompt(
    request: Request,
    profile: str = Query("native", description="Perfil do prompt: 'native' (padrão / Agent Native), 'cfo' (CFO & FP&A), 'operational' (God Mode Batch), 'goals' (Metas & Tempo), 'dev' (Scripting)"),
    format: str = Query("json", description="Formato de saída: 'json' (padrão), 'text' ou 'markdown'"),
    x_spreadsheet_key: Optional[str] = Header(None, alias="X-Spreadsheet-Key")
):
    """
    [ROTA OBRIGATÓRIA #0] Ponto de partida inegociável para agentes de IA e integrações externas.
    Entrega a matriz das 8 habilidades financeiras integradas e estipula o protocolo obrigatório:
    SEMPRE consultar a rota AI-analyst primeiro (POST /api/v1/public/ai-analyst) antes de responder ou mutar dados.
    """
    server_base_url = str(request.base_url).rstrip("/")
    api_key_str = "<SUA_CHAVE_API>"
    api_key_status = "anonymous"

    if x_spreadsheet_key and x_spreadsheet_key.strip().startswith("am_sheet_live_"):
        try:
            k_hash = hashlib.sha256(x_spreadsheet_key.strip().encode("utf-8")).hexdigest()
            from db.license_db import get_spreadsheet_api_key
            rec = get_spreadsheet_api_key(k_hash)
            if rec and not rec.get("is_expired") and rec.get("is_active", 1):
                api_key_str = x_spreadsheet_key.strip()
                api_key_status = "active"
        except Exception:
            pass

    prof = (profile or "native").strip().lower()
    if prof in ["cfo", "fpa", "mentoria"]:
        selected_prompt = get_cfo_fpa_prompt(base_url=server_base_url, api_key=api_key_str)
        profile_label = "cfo_fpa"
    elif prof in ["operational", "operacional", "godmode", "batch"]:
        selected_prompt = get_operational_godmode_prompt(base_url=server_base_url, api_key=api_key_str)
        profile_label = "operational_godmode"
    elif prof in ["goals", "metas", "timebank", "burnout"]:
        selected_prompt = get_goals_timebank_prompt(base_url=server_base_url, api_key=api_key_str)
        profile_label = "goals_timebank"
    elif prof in ["dev", "script", "cli", "curl"]:
        selected_prompt = get_developer_script_prompt(base_url=server_base_url, api_key=api_key_str)
        profile_label = "developer_script"
    else:
        selected_prompt = get_agent_native_master_prompt(base_url=server_base_url, api_key=api_key_str)
        profile_label = "agent_native_master"

    accept_hdr = request.headers.get("accept", "")
    if format.lower() in ["text", "txt", "markdown", "md"] or "text/plain" in accept_hdr:
        return Response(content=selected_prompt, media_type="text/plain; charset=utf-8")

    workflow_steps = [
        {
            "step": 1,
            "name": "Ingestão de Prompt & Skills (Atual)",
            "route": "GET /api/v1/public/agent-prompt",
            "status": "completed",
            "description": "Adquirir identidade executiva e o ecossistema de 8 skills financeiras integradas."
        },
        {
            "step": 2,
            "name": "Consulta Obrigatória à AI-Analyst (SEMPRE A AI-ANALYST PRIMEIRO)",
            "route": "POST /api/v1/public/ai-analyst",
            "status": "mandatory_next_step",
            "description": "Disparar a solicitação para a ai-analyst obter o diagnóstico em memória, métricas estatísticas avançadas e análise estratégica antes de qualquer decisão."
        },
        {
            "step": 3,
            "name": "Operações Secundárias sob Demanda",
            "route": "GET /summary, GET /transactions, POST /transactions/batch-sync, GET /spreadsheet/export",
            "status": "on_demand",
            "description": "Executar consultas analíticas ou mutações em lote conforme a recomendação do diagnóstico."
        }
    ]

    return PublicAgentPromptResponse(
        status="success",
        version="2.0.0",
        workflow_steps=workflow_steps,
        skills_integrated=SKILLS_MANIFEST,
        prompt=selected_prompt,
        profile_used=profile_label,
        mandatory_next_route="POST /api/v1/public/ai-analyst",
        api_key_status=api_key_status
    )

@router.get("", response_model=PublicAnalysisContextResponse, summary="[ROTA PRINCIPAL #1] Snapshot Financeiro Completo")
@router.get("/", response_model=PublicAnalysisContextResponse, summary="[ROTA PRINCIPAL #1] Snapshot Financeiro Completo")
@router.get("/analysis-context", response_model=PublicAnalysisContextResponse, summary="[ROTA PRINCIPAL #1] Snapshot Financeiro Completo")
@router.post("/analysis-context", response_model=PublicAnalysisContextResponse)
@router.get("/spreadsheet", response_model=PublicAnalysisContextResponse)
@router.get("/spreadsheet/analysis-context", response_model=PublicAnalysisContextResponse)
async def generate_analysis_context_in_memory(
    payload: Optional[AppendSpreadsheetPayload] = None,
    table_id: str = Depends(get_table_id_for_read),
    as_of_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Reference date YYYY-MM-DD"),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional start date filter YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Optional end date filter YYYY-MM-DD")
):
    """Gera o contexto de inteligência financeira em Markdown 100% em memória RAM."""
    items_to_process: List[AppendTransactionItem] = []
    
    if payload:
        if payload.transactions:
            items_to_process.extend(payload.transactions)

        if payload.csv_content and payload.csv_content.strip():
            raw_lines = payload.csv_content.strip().split("\n")
            for line in raw_lines:
                if line.startswith("##") or not line.strip():
                    continue
                parts = [p.strip().strip('"') for p in line.split(",")]
                if len(parts) >= 3:
                    line_lower = line.lower()
                    if "date" in line_lower or "data" in line_lower or "description" in line_lower or "entrytype" in line_lower:
                        continue
                    try:
                        if len(parts) >= 4 and re.search(r"\d{4}-\d{2}-\d{2}", parts[1]):
                            dt = parts[1]
                            val = float(parts[2])
                            desc = parts[3]
                            entry_type = parts[4] if len(parts) > 4 and parts[4] else ("expense" if val < 0 else "revenue")
                            cat = parts[9] if len(parts) > 9 and parts[9] else "Geral"
                            tag = parts[10] if len(parts) > 10 else ""
                            ext_id = parts[0]
                        else:
                            dt = parts[0]
                            val = float(parts[1])
                            desc = parts[2]
                            entry_type = parts[3] if len(parts) > 3 and parts[3] else ("expense" if val < 0 else "revenue")
                            cat = parts[4] if len(parts) > 4 else "Geral"
                            tag = parts[5] if len(parts) > 5 else ""
                            ext_id = parts[6] if len(parts) > 6 else None

                        items_to_process.append(AppendTransactionItem(
                            date=dt,
                            value=abs(val),
                            description=desc,
                            entryType=entry_type,
                            category=cat,
                            tags=tag,
                            externalId=ext_id
                        ))
                    except Exception:
                        pass

    # Fallback ao armazenamento em memória do table_id se não veio payload de itens
    if not items_to_process and table_id in TABLE_IN_MEMORY_STORAGE:
        items_to_process = TABLE_IN_MEMORY_STORAGE[table_id].get("items", [])

    start_date_str = start_date if isinstance(start_date, str) else None
    end_date_str = end_date if isinstance(end_date, str) else None
    ref_date = as_of_date if isinstance(as_of_date, str) else datetime.date.today().isoformat()

    # Filtrar por intervalo de datas se fornecido
    if start_date_str or end_date_str:
        filtered = []
        for it in items_to_process:
            if start_date_str and it.date < start_date_str:
                continue
            if end_date_str and it.date > end_date_str:
                continue
            filtered.append(it)
        items_to_process = filtered

    rows: List[TableRow] = []
    for idx, it in enumerate(items_to_process):
        tx_id = it.external_id or f"tx_{idx+1}"
        raw_et = it.entry_type or ("expense" if it.value < 0 else "revenue")
        entry_tp = EntryType(raw_et) if raw_et in [e.value for e in EntryType] else EntryType.EXPENSE
        rows.append(TableRow(
            id=tx_id,
            date=it.date,
            value=abs(it.value),
            description=it.description or "Transação API",
            entry_type=entry_tp,
            period_start=getattr(it, "period_start", None),
            period_end=getattr(it, "period_end", None),
            monthly_value=getattr(it, "monthly_value", None),
            month_count=getattr(it, "month_count", None),
        ))

    stored_data = TABLE_IN_MEMORY_STORAGE.get(table_id, {})
    goals = stored_data.get("goals", TableGoals())
    metrics = compute_metrics(rows=rows, goals=goals, as_of_date=ref_date)
    
    ai_payload = AIAnalystPayload(
        message="",
        rows=rows,
        goals=goals,
        tableName="Planilha Principal",
        totalWaiverCredits=0.0,
        asOfDate=ref_date
    )

    context_md = build_financial_context(ai_payload, metrics)
    return PublicAnalysisContextResponse(context=context_md)

@router.get("/spreadsheet/export")
async def export_spreadsheet_csv(
    table_id: str = Depends(get_table_id_for_read),
    download: bool = Query(False, description="Se True, retorna como arquivo para download .csv")
):
    """
    Retorna o conteúdo CSV da planilha ativa mantido em memória RAM.
    """
    stored = TABLE_IN_MEMORY_STORAGE.get(table_id, {})
    csv_content = stored.get("csv_content")
    items = stored.get("items", [])

    if not csv_content:
        csv_content = "\n".join([
            "## COIN_BACKUP_V2 ##",
            "table_name,Planilha Principal",
            f"id,{table_id}",
            "## ROWS ##",
            "id,date,value,description,entryType,category,tags,external_id"
        ])

    if download:
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="coin_backup_{table_id}.csv"'}
        )

    return {
        "status": "success",
        "table_name": "Planilha Principal",
        "total_rows": len(items),
        "csv_content": csv_content
    }

@router.post("/ai-analyst", response_model=PublicAIAnalystResponse)
async def public_ai_analyst(
    payload: PublicAIAnalystPayload,
    table_id: str = Depends(get_table_id_for_write)
):
    """Executa o agente de IA com contexto financeiro compilado em memória RAM."""
    if not client:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY não configurada. O serviço de IA está indisponível.",
        )

    stored = TABLE_IN_MEMORY_STORAGE.get(table_id, {})
    stored_items: List[AppendTransactionItem] = list(stored.get("items", []))
    goals = stored.get("goals", TableGoals())

    if payload.start_date or payload.end_date:
        filtered_items = []
        for it in stored_items:
            if payload.start_date and it.date < payload.start_date:
                continue
            if payload.end_date and it.date > payload.end_date:
                continue
            filtered_items.append(it)
        stored_items = filtered_items

    rows: List[TableRow] = []
    for idx, it in enumerate(stored_items):
        tx_id = it.external_id or f"tx_{idx+1}"
        raw_et = it.entry_type or ("expense" if it.value < 0 else "revenue")
        entry_tp = EntryType(raw_et) if raw_et in [e.value for e in EntryType] else EntryType.EXPENSE
        rows.append(TableRow(
            id=tx_id,
            date=it.date,
            value=abs(it.value),
            description=it.description or "Transação API",
            entry_type=entry_tp,
            period_start=getattr(it, "period_start", None),
            period_end=getattr(it, "period_end", None),
            monthly_value=getattr(it, "monthly_value", None),
            month_count=getattr(it, "month_count", None),
        ))

    ref_date = payload.as_of_date or datetime.date.today().isoformat()
    metrics = compute_metrics(rows=rows, goals=goals, as_of_date=ref_date)
    
    ai_payload = AIAnalystPayload(
        message=payload.user_prompt,
        rows=rows,
        goals=goals,
        tableName="Planilha Principal",
        totalWaiverCredits=0.0,
        asOfDate=ref_date
    )

    context_md = build_financial_context(ai_payload, metrics)
    system_prompt = get_system_prompt(context_md)

    try:
        gen_kwargs = {
            "system_instruction": system_prompt,
            "max_output_tokens": MAX_OUTPUT_TOKENS,
        }
        if "thinking" in MODEL.lower():
            gen_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=THINKING_BUDGET)

        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL,
            contents=payload.user_prompt,
            config=types.GenerateContentConfig(**gen_kwargs)
        )
        return PublicAIAnalystResponse(content=response.text, modelUsed=MODEL)
    except Exception as err:
        log.exception(f"Erro no processamento da IA: {err}")
        raise HTTPException(status_code=500, detail=f"Erro no agente de IA: {err}")
