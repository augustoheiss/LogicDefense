import os
import httpx
import logging
import hashlib
import uuid
import datetime
from fastapi import APIRouter, Security, HTTPException, Header, status, Depends, Query
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from typing import List, Optional

# Import backend metrics engine and models
from services.coin_metrics_engine import compute_metrics
from models.coin_models import TableRow, TableGoals, EntryType, ProjectionPoint, ProjectionSummary

# Setup logger
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["Public API Integration"])

# Chave API header
API_KEY_HEADER = APIKeyHeader(name="X-Spreadsheet-Key", auto_error=True)

class PublicTransactionCreate(BaseModel):
    date: str = Field(..., description="Data da transação no formato YYYY-MM-DD")
    value: float = Field(..., gt=0, description="Valor monetário positivo")
    description: str = Field("Sem descrição", description="Descrição opcional")
    entry_type: str = Field("expense", description="Tipo da transação: 'revenue', 'expense', 'deposit', 'waiver', 'partner_in', 'partner_out'")

class PublicSummaryResponse(BaseModel):
    table_name: str = Field(..., alias="tableName")
    global_balance: float = Field(..., alias="globalBalance")
    gross_total: float = Field(..., alias="grossTotal")
    total_expenses: float = Field(..., alias="totalExpenses")
    net_balance: float = Field(..., alias="netBalance")
    global_monthly_avg: float = Field(..., alias="globalMonthlyAvg")
    global_goal_balance: float = Field(..., alias="globalGoalBalance")
    recent_transactions_count: int = Field(..., alias="recentTransactionsCount")

    model_config = {"populate_by_name": True}

class PublicProjectionResponse(BaseModel):
    summary: ProjectionSummary
    points: List[ProjectionPoint]

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

@router.get("/transactions", response_model=List[TableRow])
async def get_transactions(
    table_id: str = Depends(get_table_id_for_read),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """Lista transações da planilha vinculada à chave de API."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    url = f"{supabase_url}/rest/v1/transactions?table_id=eq.{table_id}&select=*&order=date.desc&limit={limit}&offset={offset}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
        if res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao carregar transações do banco de dados."
            )
        return res.json()

@router.post("/transactions", response_model=TableRow, status_code=status.HTTP_201_CREATED)
async def add_transaction(
    payload: PublicTransactionCreate,
    table_id: str = Depends(get_table_id_for_write),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """Insere uma transação com suporte a cabeçalho opcional de idempotência."""
    # Validar formato da data YYYY-MM-DD
    try:
        datetime.datetime.strptime(payload.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Formato de data inválido. Use o padrão YYYY-MM-DD."
        )
        
    # Validar tipo de transação
    allowed_types = [t.value for t in EntryType]
    if payload.entry_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"entry_type inválido. Tipos permitidos: {allowed_types}"
        )
        
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        # Se enviou X-Idempotency-Key, verificar se já existe a transação
        if x_idempotency_key:
            check_url = f"{supabase_url}/rest/v1/transactions?table_id=eq.{table_id}&idempotency_key=eq.{x_idempotency_key}&select=*"
            check_res = await client.get(check_url, headers=headers)
            if check_res.status_code == 200 and check_res.json():
                log.info(f"Transação duplicada detectada pelo X-Idempotency-Key: {x_idempotency_key}. Retornando registro existente.")
                return check_res.json()[0]
                
        # Gerar ID único no padrão do app
        tx_uuid = str(uuid.uuid4())
        new_tx_id = f"tx_api_{tx_uuid.replace('-', '')[:16]}"
        
        transaction_row = {
            "id": new_tx_id,
            "table_id": table_id,
            "date": payload.date,
            "value": payload.value,
            "description": payload.description,
            "entry_type": payload.entry_type,
            "generated_by": "public_api",
            "idempotency_key": x_idempotency_key,
            "updated_at": datetime.datetime.utcnow().isoformat()
        }
        
        insert_url = f"{supabase_url}/rest/v1/transactions"
        post_headers = {**headers, "Prefer": "return=representation"}
        
        res = await client.post(insert_url, json=transaction_row, headers=post_headers)
        if res.status_code not in (200, 201):
            # Lidar com concorrência se outra thread inseriu simultaneamente
            if x_idempotency_key and "unique_table_idempotency" in res.text:
                fallback_res = await client.get(f"{supabase_url}/rest/v1/transactions?table_id=eq.{table_id}&idempotency_key=eq.{x_idempotency_key}&select=*", headers=headers)
                if fallback_res.status_code == 200 and fallback_res.json():
                    return fallback_res.json()[0]
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao salvar transação: {res.text}"
            )
            
        return res.json()[0]

@router.get("/summary", response_model=PublicSummaryResponse)
async def get_summary(table_id: str = Depends(get_table_id_for_read)):
    """Retorna estatísticas compiladas da planilha ativa rodando o Metrics Engine."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Obter planilha
        tbl_url = f"{supabase_url}/rest/v1/coin_tables?id=eq.{table_id}&select=*"
        tbl_res = await client.get(tbl_url, headers=headers)
        if tbl_res.status_code != 200 or not tbl_res.json():
            raise HTTPException(status_code=404, detail="Planilha não localizada.")
        table_data = tbl_res.json()[0]
        
        # 2. Obter todas as transações
        tx_url = f"{supabase_url}/rest/v1/transactions?table_id=eq.{table_id}&select=*"
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
                log.warning(f"Ignorado erro de parse de TableRow: {e}")
                
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
                as_of_date=datetime.date.today().isoformat()
            )
        except Exception as e:
            log.exception(f"Erro ao computar métricas: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao compilar métricas: {e}")
            
        return PublicSummaryResponse(
            tableName=table_data.get("name", "Sem Nome"),
            globalBalance=metrics.global_balance,
            grossTotal=metrics.gross_total,
            totalExpenses=metrics.total_expenses,
            netBalance=metrics.net_balance,
            globalMonthlyAvg=metrics.global_monthly_avg,
            globalGoalBalance=metrics.global_goal_balance,
            recentTransactionsCount=len(rows)
        )

@router.get("/projection", response_model=PublicProjectionResponse)
async def get_projection(
    table_id: str = Depends(get_table_id_for_read),
    monthly_deposit: Optional[float] = Query(None, gt=0, alias="monthlyDeposit"),
    months: int = Query(72, ge=1, le=360)
):
    """Calcula simulação de juros compostos a partir do saldo médio ou valor customizado."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
    
    final_deposit = monthly_deposit
    
    # Se monthly_deposit não foi fornecido, calculamos a média líquida de poupança mensal
    if final_deposit is None:
        async with httpx.AsyncClient() as client:
            tx_url = f"{supabase_url}/rest/v1/transactions?table_id=eq.{table_id}&select=*"
            tx_res = await client.get(tx_url, headers=headers)
            
            tbl_url = f"{supabase_url}/rest/v1/coin_tables?id=eq.{table_id}&select=goals"
            tbl_res = await client.get(tbl_url, headers=headers)
            
            if tx_res.status_code == 200:
                raw_rows = tx_res.json()
                rows = []
                for r in raw_rows:
                    try:
                        rows.append(TableRow(**r))
                    except Exception:
                        pass
                
                goals = TableGoals()
                if tbl_res.status_code == 200 and tbl_res.json():
                    raw_goals = tbl_res.json()[0].get("goals") or {}
                    if isinstance(raw_goals, dict):
                        try:
                            goals = TableGoals(**raw_goals)
                        except Exception:
                            pass
                
                try:
                    metrics = compute_metrics(rows=rows, goals=goals, as_of_date=datetime.date.today().isoformat())
                    # Média diária de economia convertida para mensal
                    if metrics.global_monthly_avg > 0:
                        final_deposit = metrics.global_monthly_avg
                except Exception:
                    pass
                    
        # Fallback se não conseguir calcular a média líquida ou for negativa
        if final_deposit is None or final_deposit <= 0:
            final_deposit = 100.0 # Fallback básico padrão
            
    # Executar projeção com juros compostos (0.8% ao mês)
    monthly_rate = 0.008
    points = []
    running_balance = 0.0
    
    for m in range(1, months + 1):
        previous_balance = running_balance
        running_balance += final_deposit
        interest_this_month = running_balance * monthly_rate
        running_balance += interest_this_month
        
        pts_yield = round(previous_balance * monthly_rate, 2)
        total_dep = round(final_deposit * m, 2)
        tot_bal = round(running_balance, 2)
        acc_int = round(tot_bal - total_dep, 2)
        
        points.append(
            ProjectionPoint(
                month=m,
                totalDeposited=total_dep,
                accumulatedInterest=acc_int,
                totalBalance=tot_bal,
                monthlyYield=pts_yield
            )
        )
        
    last = points[-1]
    summary = ProjectionSummary(
        finalBalance=last.total_balance,
        totalDeposited=last.total_deposited,
        totalInterest=last.accumulated_interest,
        finalMonthlyYield=last.monthly_yield,
        multiplier=round(last.total_balance / last.total_deposited, 2) if last.total_deposited > 0 else 1.0
    )
    
    return PublicProjectionResponse(summary=summary, points=points)
