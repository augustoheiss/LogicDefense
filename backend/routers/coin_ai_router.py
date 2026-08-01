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
from services.context_builder import build_financial_context, get_system_prompt

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


from db.license_db import get_license_by_raw_key, deduct_license_tokens

async def verify_license_key_and_quota(x_license_key: str | None, estimated_text: str) -> dict:
    """
    Validates license key and checks/deducts token quota (with 15% safety buffer).
    Raises HTTP 401 if missing/invalid key, or HTTP 402 if tokens are exhausted.
    """
    if not x_license_key:
        raise HTTPException(
            status_code=401,
            detail="Chave de Licença necessária para utilizar o Assistente de IA PRO. Insira sua chave nas configurações."
        )
    
    rec = get_license_by_raw_key(x_license_key.strip())
    if not rec:
        raise HTTPException(
            status_code=401,
            detail="Chave de Licença inválida. Verifique o código inserido ou recupere sua chave por e-mail."
        )

    # Estimate tokens: ~4 chars per token + 15% safety buffer
    est_prompt_tokens = int((len(estimated_text) / 4) * 1.15) + 500
    if rec.get("token_balance", 0) < est_prompt_tokens:
        raise HTTPException(
            status_code=402,
            detail=f"Saldo de tokens insuficiente ({rec.get('token_balance', 0):,} restantes, necessário {est_prompt_tokens:,}). Faça um upgrade para renovar seus tokens."
        )

    return rec

@router.post("/ai-analyst", response_model=AIAnalystResponse)
async def ai_analyst(
    payload: AIAnalystPayload,
    authorization: str = Header(None),
    x_license_key: str = Header(None, alias="X-License-Key")
) -> AIAnalystResponse:
    """
    Stateless AI financial analyst.

    Receives financial payload alongside license key in X-License-Key header.
    Validates quota, computes metrics, queries Gemini, and deducts actual tokens used.
    """
    # License key can be passed via X-License-Key header or Bearer authorization fallback
    raw_key = x_license_key or (authorization.replace("Bearer ", "").strip() if authorization and not authorization.startswith("eyJ") else None)
    
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

    # ── Step 3: Verify License Key & Token Quota ─────────────────────────
    user_message = (
        f"{financial_context}\n\n"
        f"── PERGUNTA DO USUÁRIO ──\n"
        f"{payload.message}"
    )

    license_rec = await verify_license_key_and_quota(raw_key, user_message)

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

        # Deduct actual tokens used from license key
        if total_tokens > 0 and license_rec:
            deduct_license_tokens(license_rec["key_hash"], total_tokens, endpoint="/api/coin/ai-analyst")

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
