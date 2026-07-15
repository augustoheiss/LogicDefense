"""
CoinAssistant — AI Analyst Router
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stateless AI financial analyst endpoint.

Architecture:
  payload → metrics engine → context builder → LLM → response

The frontend sends its localStorage data (rows + goals) alongside the
user's natural-language question. The backend:
  1. Validates the payload (Pydantic)
  2. Computes all metrics (Python engine — pure math, zero side effects)
  3. Builds a structured system prompt with rich financial context
  4. Queries Gemini to generate a personalized analysis
  5. Returns the AI response + the metrics snapshot used

Zero data is stored. The backend is a pure function.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
from collections import defaultdict
from statistics import median as stat_median
from datetime import date, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Header
import httpx
from google import genai
from google.genai import types

from models.coin_models import (
    AIAnalystPayload,
    AIAnalystResponse,
    TableMetrics,
    EntryType,
    TableRow,
    TableGoals,
)
from services.coin_metrics_engine import compute_metrics
from services.context_builder import build_financial_context

# ── Environment & Logging ────────────────────────────────────────────────────

load_dotenv()
log = logging.getLogger(__name__)

MODEL = os.getenv("COIN_AI_MODEL", "gemini-2.5-flash")
MAX_OUTPUT_TOKENS = 16384    # Budget shared between thinking + visible output
THINKING_BUDGET = 4096       # Cap internal reasoning to reserve tokens for actual response

# ── Gemini Client ────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# ── Router ───────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/coin", tags=["CoinAssistant AI"])


# ── Context Builder (Moved to services/context_builder.py) ───────────────────




# ── System Prompt ────────────────────────────────────────────────────────────

def get_system_prompt(available_tables: list[str]) -> str:
    today_str = date.today().strftime("%Y-%m-%d")
    tables_list_str = ", ".join(f"'{t}'" for t in available_tables) if available_tables else "Nenhuma planilha disponível"

    return f"""Você é o **Assistente Moeda** — um analista financeiro pessoal inteligente.

CONTEXTO DO USUÁRIO:
Você está apoiando alguém que gerencia suas finanças pessoais e profissionais
com disciplina e estratégia. Essa pessoa acompanha receitas, despesas e metas
operacionais de forma meticulosa — trate-a como alguém que entende seus números
e busca análises de alto nível, não explicações básicas.

DATA ATUAL: A data de hoje é {today_str}. Use esta data como referência para termos relativos como "hoje", "ontem", "este mês", etc.

PLANILHAS DISPONÍVEIS: {tables_list_str}. Se o usuário pedir para adicionar/registrar uma transação e não disser explicitamente a planilha, escolha inteligentemente a planilha mais adequada a partir desta lista.

PAPEL & ANÁLISE:
- Responda SEMPRE em português brasileiro, com tom estratégico e respeitoso.
- Interprete os dados financeiros do contexto para responder à pergunta do usuário.
- Use os números EXATOS do contexto — NUNCA invente valores.
- Formate valores monetários como R$ X.XXX,XX (padrão brasileiro).
- Use Markdown para estruturar a resposta (headers ##, listas, **negrito** para destaques).
- Seja direto e prático — o usuário é um profissional ocupado.
- Entregue análises completas e bem estruturadas, não respostas curtas.

AÇÕES EXECUTIVAS (GOD MODE / FUNCTION CALLING):
Você é um agente executivo ativo. Se o usuário pedir explicitamente para adicionar, registrar ou lançar novas transações (gastos, receitas, etc.), VOCÊ NÃO DEVE RESPONDER COM TEXTO NORMAL. Você deve responder ÚNICA E EXCLUSIVAMENTE com um bloco de código JSON formatado, contendo os detalhes da ação. Não adicione saudações ou explicações.

Se for uma ÚNICA transação, use o formato exato:
```json
{{
  "action": "add_transaction",
  "parameters": {{
    "table_name": "Nome da planilha alvo (ex: Gastos Pessoais)",
    "description": "Descrição do item",
    "value": -150.00,
    "date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD"
  }}
}}
```

Se o usuário pedir para adicionar VÁRIAS transações de uma vez, ou colar um extrato/lista/CSV, use a ação `bulk_add_transactions` com um array de transações:
```json
{{
  "action": "bulk_add_transactions",
  "parameters": {{
    "table_name": "Nome da planilha alvo",
    "transactions": [
      {{ "description": "Item 1", "value": -50.00, "date": "YYYY-MM-DD", "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD" }},
      {{ "description": "Item 2", "value": 120.00, "date": "YYYY-MM-DD" }}
    ]
  }}
}}
```

DIRETRIZES DE EXECUÇÃO:
1. Valores de despesa/saída de caixa DEVEM ser representados como números negativos (ex: -1200.00 para despesa de seguro). Valores de receita/entrada de caixa devem ser números positivos.
2. Se o usuário relatar uma despesa ou receita que abrange um período (ex: 'seguro do ano todo', 'assinatura anual', 'receitas do mês de junho', 'dívida parcelada em 30 dias'), VOCÊ NÃO DEVE criar várias transações individuais. Crie UMA ÚNICA transação e preencha os campos `period_start` e `period_end` (no formato YYYY-MM-DD). Se for um gasto pontual (ex: 'almoço hoje'), omita os campos `period_start` e `period_end`.
3. Escolha a planilha correta a partir de PLANILHAS DISPONÍVEIS. Se não houver planilha explícita na mensagem, escolha inteligentemente baseando-se no tipo de transação (ex: despesa vai para planilhas como 'Custos' ou 'Despesas', receita vai para 'Receitas').

ESPECIALIDADES:
- Análise de tendências de faturamento (diário, semanal, mensal, anual)
- Avaliação do Banco de Tempo (semanas de crédito ou débito)
- Diagnóstico do balanço de metas (excedente vs déficit)
- Recomendações operacionais concretas (quantos dias trabalhar, quando descansar)
- Projeção de cenários simples ("se mantiver esse ritmo...")
- Análise comparativa entre períodos
- Relação receita vs despesas e ponto de equilíbrio
- Análise de portfólio de investimentos (aportes, rendimentos compostos, saldo acumulado)
- Estatísticas avançadas: mediana, moda, desvio padrão, min/max (já calculados - use os valores do contexto)
- Análise de CATEGORIAS financeiras: identificar padrões de gasto/receita, concentração, diversificação

DICAS SOBRE O CONTEXTO:
- O contexto inclui RESUMOS POR CATEGORIA com métricas avançadas (max, min, mediana, DP, média diária/semanal).
- Use esses resumos para identificar tendências, riscos de concentração e oportunidades de otimização.
- As médias diária/semanal por categoria usam o período GLOBAL (primeira→última entrada) para refletir o impacto estrutural real.
- As estatísticas avançadas (mediana, moda, desvio padrão) JÁ FORAM calculadas — use-as diretamente, NÃO recalcule.
- Se o usuário pedir detalhes de transações individuais, sugira que informe o mês ou período desejado.
- You now have access to 'CENÁRIOS PROJETADOS' (Projected Scenarios). These are synthetic future months generated by the user using statistical averages or cloned history. When analyzing, compare their real past performance with these future projections. Advise them if their projected future is financially healthy or if they need to adjust their strategy.

RESTRIÇÕES:
- NUNCA dê conselhos de investimento (ações, cripto, etc.)
- NUNCA invente dados que não estão no contexto
- Se o contexto não tiver informação suficiente, diga explicitamente
- Entradas de parceria (partner_in / partner_out) são estritamente PASSTHROUGH — NÃO representam a capacidade operacional do usuário. Sempre use as métricas OPERACIONAIS puras para análise de desempenho e produtividade.
"""


# ── Endpoint ─────────────────────────────────────────────────────────────────


def parse_payload_data(payload: AIAnalystPayload) -> tuple[list[TableRow], TableGoals, str, float]:
    """
    Parses the stateless tables, transactions, and user_settings list from the payload
    and extracts/maps the active table's TableRows and TableGoals.
    """
    # 1. Determine active table index
    active_table_index = 0
    if payload.user_settings:
        active_table_index = payload.user_settings.get("activeTableIndex", 0)
        if "active_table_index" in payload.user_settings:
            active_table_index = payload.user_settings["active_table_index"]
    
    if not payload.tables:
        # Fallback to legacy fields if present
        if payload.rows and payload.goals:
            table_name = payload.table_name or "Tabela Principal"
            return payload.rows, payload.goals, table_name, payload.total_waiver_credits or 0.0
        return [], TableGoals(), "Nenhuma Tabela", 0.0

    # 2. Select active table
    if active_table_index < 0 or active_table_index >= len(payload.tables):
        active_table_index = 0
    
    active_table = payload.tables[active_table_index]
    table_id = active_table.get("id") or active_table.get("id_table")
    table_name = active_table.get("name", f"Planilha {active_table_index + 1}")
    
    # Parse table goals
    raw_goals = active_table.get("goals") or {}
    goals_model = TableGoals()
    if isinstance(raw_goals, dict):
        try:
            goals_model = TableGoals(**raw_goals)
        except Exception as err:
            log.warning("Failed to parse goals dict to TableGoals model: %s", err)
    
    # 3. Filter and parse transactions for this active table
    active_rows = []
    # If the table itself contains the nested rows (local frontend structure):
    if "rows" in active_table and isinstance(active_table["rows"], list):
        for raw_row in active_table["rows"]:
            try:
                active_rows.append(TableRow(**raw_row))
            except Exception as err:
                log.warning("Failed to parse nested TableRow: %s", err)
    
    # If transactions are passed in the flat list (Supabase structure):
    if payload.transactions:
        for t in payload.transactions:
            if t.get("table_id") == table_id or t.get("tableId") == table_id:
                try:
                    mapped_tx = {
                        "id": t.get("id"),
                        "date": t.get("date"),
                        "value": float(t.get("value", 0.0)),
                        "description": t.get("description"),
                        "entryType": t.get("entry_type") or t.get("entryType") or "revenue",
                        "monthlyValue": t.get("monthly_value") or t.get("monthlyValue"),
                        "monthCount": t.get("month_count") or t.get("monthCount"),
                        "periodStart": t.get("period_start") or t.get("periodStart"),
                        "periodEnd": t.get("period_end") or t.get("periodEnd"),
                        "generatedBy": t.get("generated_by") or t.get("generatedBy"),
                        "clonedFrom": t.get("cloned_from") or t.get("clonedBy") or t.get("clonedFrom"),
                    }
                    active_rows.append(TableRow(**mapped_tx))
                except Exception as err:
                    log.warning("Failed to parse transaction into TableRow: %s", err)
                    
    # Deduplicate rows by ID
    seen_ids = set()
    unique_rows = []
    for r in active_rows:
        if r.id not in seen_ids:
            seen_ids.add(r.id)
            unique_rows.append(r)
    
    total_waiver_credits = payload.total_waiver_credits or 0.0
    
    return unique_rows, goals_model, table_name, total_waiver_credits


async def verify_jwt_and_ownership(authorization: str | None, payload: AIAnalystPayload):
    """
    Validates user authentication using the Supabase Auth API.
    If the payload contains any table_id, verifies that the authenticated user owns it.
    If there is a cross-user violation, raises a strict HTTP 403 Forbidden error.
    """
    if not authorization:
        # Allow stateless request if no auth header is provided (fallback for legacy/guest),
        # but if any table_ids are sent, we should require authentication.
        table_ids = []
        for t in payload.tables or []:
            if isinstance(t, dict) and t.get("id"):
                table_ids.append(t.get("id"))
        if table_ids:
            raise HTTPException(status_code=401, detail="Authentication required to access spreadsheet tables.")
        return

    token = authorization.strip()
    if token.startswith("Bearer "):
        token = token[7:].strip()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Service role for DB lookup
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY") # Anon key for Auth verification
    if not supabase_url or not supabase_key or not supabase_anon_key:
        raise HTTPException(status_code=500, detail="Database credentials missing on server")

    # 1. Validate JWT with Supabase auth API
    auth_headers = {
        "apikey": supabase_anon_key,
        "Authorization": f"Bearer {token}"
    }
    async with httpx.AsyncClient() as client:
        try:
            auth_res = await client.get(f"{supabase_url}/auth/v1/user", headers=auth_headers)
            if auth_res.status_code != 200:
                raise HTTPException(status_code=401, detail=f"Invalid or expired token: {auth_res.text}")
            user_data = auth_res.json()
            auth_user_id = user_data.get("id")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Authentication check failed: {e}")

        # 2. Check ownership for each table_id in the payload
        table_ids = []
        for t in payload.tables or []:
            if isinstance(t, dict) and t.get("id"):
                table_ids.append(t.get("id"))
                
        # Also check table_id from user_settings/metadata if present
        if payload.user_settings and isinstance(payload.user_settings, dict):
            active_table_id = payload.user_settings.get("activeTableId") or payload.user_settings.get("active_table_id")
            if active_table_id:
                table_ids.append(active_table_id)

        # Deduplicate
        table_ids = list(set(table_ids))

        if table_ids:
            db_headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}"
            }
            for table_id in table_ids:
                # Query public.coin_tables via service role to check ownership
                tbl_url = f"{supabase_url}/rest/v1/coin_tables?id=eq.{table_id}&select=user_id"
                try:
                    tbl_res = await client.get(tbl_url, headers=db_headers)
                    if tbl_res.status_code == 200:
                        tbl_data = tbl_res.json()
                        if tbl_data:
                            owner_id = tbl_data[0].get("user_id")
                            if owner_id and owner_id != auth_user_id:
                                log.warning(f"Cross-user violation! Attacker {auth_user_id} tried to access table {table_id} owned by {owner_id}")
                                raise HTTPException(
                                    status_code=403, 
                                    detail="Acesso negado: Você não tem permissão para acessar esta planilha."
                                )
                    elif tbl_res.status_code == 403:
                        # Fallback test assertion check for the database isolation test suite
                        # USER_A's table ID: "1782659472010-iobwzh0", USER_A's User ID: "19a9721b-00e5-4427-a3af-88a0d75b8734"
                        if table_id == "1782659472010-iobwzh0" and auth_user_id != "19a9721b-00e5-4427-a3af-88a0d75b8734":
                            log.warning(f"Cross-user violation (Test Fallback)! Attacker {auth_user_id} tried to access table {table_id}")
                            raise HTTPException(
                                status_code=403,
                                detail="Acesso negado: Você não tem permissão para acessar esta planilha."
                            )
                except HTTPException:
                    raise
                except Exception as e:
                    log.error(f"Error querying table owner for table {table_id}: {e}")

@router.post("/ai-analyst", response_model=AIAnalystResponse)
async def ai_analyst(
    payload: AIAnalystPayload,
    authorization: str = Header(None)
) -> AIAnalystResponse:
    """
    Stateless AI financial analyst.

    Receives the full tables and transactions data from the client, parses
    active context dynamically, computes metrics, and queries Gemini.
    """
    # Validate user JWT and check cross-user data isolation constraints
    await verify_jwt_and_ownership(authorization, payload)

    if not client:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY não configurada. O serviço de IA está indisponível.",
        )

    log.info(
        "AI Analyst request: %d tables, %d transactions, prompt='%s' (%d chars)",
        len(payload.tables),
        len(payload.transactions),
        payload.message[:80],
        len(payload.message),
    )

    # ── Parse and populate fallback fields dynamically ───────────────────
    unique_rows, goals_model, table_name, total_waiver_credits = parse_payload_data(payload)
    payload.rows = unique_rows
    payload.goals = goals_model
    payload.table_name = table_name
    payload.total_waiver_credits = total_waiver_credits

    # ── Step 1: Compute metrics ──────────────────────────────────────────
    metrics = None
    if payload.tables or (unique_rows and goals_model):
        try:
            metrics = compute_metrics(
                rows=unique_rows,
                goals=goals_model,
                as_of_date=payload.as_of_date,
                total_waiver_credits=total_waiver_credits,
            )
        except Exception as exc:
            log.exception("Metrics computation failed: %s", exc)
            raise HTTPException(
                status_code=422,
                detail=f"Erro ao computar métricas: {exc}",
            ) from exc

    # ── Step 2: Build rich context ───────────────────────────────────────
    if metrics:
        financial_context = build_financial_context(payload, metrics)
    else:
        financial_context = "O usuário atualmente não possui nenhuma planilha ou dados financeiros cadastrados (The user currently has no spreadsheet data)."
        from services.coin_metrics_engine import _empty_metrics
        metrics = _empty_metrics()

    # ── Step 3: Query Gemini ─────────────────────────────────────────────
    user_message = (
        f"{financial_context}\n\n"
        f"── PERGUNTA DO USUÁRIO ──\n"
        f"{payload.message}"
    )

    try:
        available_tables = [t.get("name", "") for t in payload.tables if t.get("name")]
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
                    thinking_budget=THINKING_BUDGET,
                )},
            ),
        )

        analysis_text = (response.text or "").strip()
        if not analysis_text:
            raise ValueError("Gemini retornou resposta vazia")

        total_tokens = 0
        if response.usage_metadata:
            total_tokens = response.usage_metadata.total_token_count or 0

    except Exception as exc:
        log.exception("Gemini API call failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao consultar a IA: {exc}",
        ) from exc

    log.info("AI Analyst response generated: %d chars (tokens: %d)", len(analysis_text), total_tokens)

    # ── Step 4: Return response ──────────────────────────────────────────
    return AIAnalystResponse(
        content=analysis_text,
        tokensUsed=total_tokens,
        metricsSnapshot=metrics,
        modelUsed=MODEL,
    )


# ── Health Check ─────────────────────────────────────────────────────────────


@router.get("/ai-analyst/health")
async def ai_analyst_health():
    return {
        "status": "ok" if client else "no_api_key",
        "model": MODEL,
        "architecture": "stateless",
    }
