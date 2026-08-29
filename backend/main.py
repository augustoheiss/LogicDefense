"""
LogicDefense CV RAG Engine
FastAPI backend — generates 4 CV archetype YAMLs from raw resume text via Gemini.

Architecture (parallel concurrent generation):
  Each archetype is generated in its own Gemini call running concurrently via
  asyncio.gather().  This reduces the per-call output by 75 %, eliminating the
  token-limit truncation that occurred when all 4 CVs were squeezed into a single
  response.

  Per call:
    1. asyncio.to_thread() runs the synchronous SDK call off the event loop.
    2. response_mime_type="application/json" (schema-less mode) avoids the
       "additionalProperties is not supported" Gemini error.
    3. json.loads(response.text) — safe, pure nested JSON, no embedded YAML strings.
    4. yaml.dump() converts the dict to a YAML string server-side.
    5. All 4 coroutines run in parallel; total wall-clock time ≈ one call.
"""

import asyncio
import io
import json
import logging
import os
from typing import Any

import yaml
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# ── Environment ──────────────────────────────────────────────────────────────
load_dotenv()

MODEL         = "gemini-3.7-flash"
MAX_TOKENS    = 8192     # one CV per call; 8 k gives headroom for rich resumes
MAX_RETRIES   = 3        # attempts per archetype before giving up
RETRY_DELAY   = 1.5      # seconds to wait between retries
STAGGER_STEP  = 0.5      # seconds between staggered concurrent call starts

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Gemini client ────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("⚠️ AVISO: GEMINI_API_KEY não encontrada. Iniciando servidor sem suporte à IA.")

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Heiss-Lab Backend",
    description="Backend services: CV Generator, CoinAssistant AI Analyst, Ocorrências.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CoinAssistant AI Router ──────────────────────────────────────────────────
from routers.coin_ai_router import router as coin_ai_router
app.include_router(coin_ai_router)

# ── RevenueCat Webhook Router ────────────────────────────────────────────────
from routers.webhook_router import router as webhook_router
app.include_router(webhook_router)

# ── Stripe Webhook Router ────────────────────────────────────────────────────
from routers.stripe_webhook_router import router as stripe_webhook_router
app.include_router(stripe_webhook_router)

# ── Spreadsheet API Keys Router ──────────────────────────────────────────────
from routers.api_keys_router import router as api_keys_router
app.include_router(api_keys_router)

# ── Public API Integration Router ────────────────────────────────────────────
from routers.public_api_router import router as public_api_router
app.include_router(public_api_router)

# ── License Management Router ─────────────────────────────────────────────────
from routers.license_router import router as license_router
app.include_router(license_router)

# ── CV Maker 2.0 Router ──────────────────────────────────────────────────────
from routers.cv_router import router as cv_router
app.include_router(cv_router)

# ── Health Check (cold-start mitigation) ─────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {"status": "awake"}

@app.get("/")
async def root_index(request: Request):
    """
    Root Endpoint — Auto-discovery & Universal Entrypoint.
    If X-Spreadsheet-Key is provided, it serves the Analysis Context directly.
    Otherwise, returns API documentation links and usage guide for external clients and LLMs.
    """
    key = request.headers.get("x-spreadsheet-key") or request.headers.get("X-Spreadsheet-Key")
    if key and key.startswith("am_sheet_live_"):
        from routers.public_api_router import generate_analysis_context_in_memory, validate_api_key_and_get_table_id
        table_id = await validate_api_key_and_get_table_id("read", api_key=key)
        return await generate_analysis_context_in_memory(table_id=table_id)

    return {
        "service": "Assistente Moeda & CV Maker API",
        "status": "online",
        "version": "3.0.0",
        "openapi_schema": "/api/v1/openapi.json",
        "primary_endpoints": {
            "coin_analysis": "/api/v1/public/analysis-context",
            "cv_generator": "/api/v1/cv/generate",
            "cv_tailor": "/api/v1/cv/tailor",
            "api_keys": "/api/v1/api-keys/generate"
        },
        "description": "API unificada de inteligência financeira e gerador de currículos de alta precisão."
    }

# ── Unified Public OpenAPI Catalog ──────────────────────────────────────────
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

@app.get("/api/v1/openapi.json", include_in_schema=False)
async def get_unified_v1_openapi(request: Request):
    """
    Returns unified OpenAPI 3.1 schema for external AI agents, MCP tools, and integrations
    covering Assistente Moeda (/api/v1/public), CV Maker (/api/v1/cv), and API Keys (/api/v1/api-keys).
    """
    full_schema = get_openapi(
        title="Assistente Moeda & CV Maker Unified API",
        version="3.0.0",
        description="Unified stateless AI and spreadsheet integration API with zero remote PII storage.",
        routes=app.routes,
    )

    allowed_prefixes = ("/api/v1/public", "/api/v1/cv", "/api/v1/api-keys")
    public_paths = {}
    for path, path_item in full_schema.get("paths", {}).items():
        if any(path.startswith(prefix) for prefix in allowed_prefixes):
            if path in ("/api/v1/openapi.json", "/api/v1/public/openapi.json"):
                continue
            public_paths[path] = path_item

    filtered_components = {"schemas": {}}
    used_schemas = set()
    public_paths_str = json.dumps(public_paths)
    schema_definitions = full_schema.get("components", {}).get("schemas", {})

    for schema_name in schema_definitions.keys():
        if f"#/components/schemas/{schema_name}" in public_paths_str:
            used_schemas.add(schema_name)
            filtered_components["schemas"][schema_name] = schema_definitions[schema_name]

    resolved_any = True
    while resolved_any:
        resolved_any = False
        components_str = json.dumps(filtered_components)
        for schema_name in schema_definitions.keys():
            if schema_name not in used_schemas and f"#/components/schemas/{schema_name}" in components_str:
                used_schemas.add(schema_name)
                filtered_components["schemas"][schema_name] = schema_definitions[schema_name]
                resolved_any = True

    server_url = str(request.base_url).rstrip("/")
    return JSONResponse(content={
        "openapi": full_schema.get("openapi", "3.1.0"),
        "info": full_schema.get("info"),
        "servers": [{"url": server_url, "description": "Active Production Server"}],
        "paths": public_paths,
        "components": filtered_components
    })

# ── Legacy CV Route Proxy (100% Backward Compatibility) ──────────────────────
from services.cv_generator_service import generate_all_archetypes

# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL, "mode": "parallel-4x"}


# ── CoinAssistant: Bulk Input API ────────────────────────────────────────────

class BulkInputRequest(BaseModel):
    """Comma-separated expense values + optional date."""
    values: str = Field(
        ...,
        min_length=1,
        description="Comma-separated numeric values, e.g. '45.50, 120, 33.90, 88'",
    )
    date: str = Field(
        default_factory=lambda: __import__("datetime").date.today().isoformat(),
        description="ISO date for all entries (default: today). Format: YYYY-MM-DD",
    )


class BulkTransaction(BaseModel):
    date: str
    value: float
    description: str
    entryType: str


class BulkInputResponse(BaseModel):
    transactions: list[BulkTransaction]
    skipped: int = Field(default=0, description="Count of non-numeric or negative values skipped")


@app.post("/api/coin/bulk-input", response_model=BulkInputResponse)
async def coin_bulk_input(request: BulkInputRequest) -> BulkInputResponse:
    """
    Parse a comma-separated string of expense values and return structured
    transaction objects ready for the frontend to commit.

    Validation rules:
      - Non-numeric tokens are skipped (counted in `skipped`)
      - Negative or zero values are skipped
      - Values are rounded to 2 decimal places
    """
    parts = [s.strip() for s in request.values.split(",") if s.strip()]
    transactions: list[BulkTransaction] = []
    skipped = 0

    for part in parts:
        try:
            value = float(part)
        except ValueError:
            skipped += 1
            continue

        if value <= 0 or not __import__("math").isfinite(value):
            skipped += 1
            continue

        transactions.append(
            BulkTransaction(
                date=request.date,
                value=round(value, 2),
                description="Sem descrição",
                entryType="expense",
            )
        )

    if not transactions:
        raise HTTPException(
            status_code=422,
            detail="Nenhum valor numérico positivo encontrado na string fornecida.",
        )

    log.info(
        "Bulk input: %d transactions parsed, %d skipped",
        len(transactions), skipped,
    )
    return BulkInputResponse(transactions=transactions, skipped=skipped)


# ── Ocorrências: Incident Report Generator ───────────────────────────────────

from ocorrencias import mapper as oc_mapper


@app.post("/api/ocorrencias/gerar")
async def gerar_ocorrencia(request: Request):
    """
    Generates a stamped incident report PDF — ZERO disk writes.

    Flow:
    1. Extracts dynamic form payload containing arbitrary user-mapped fields
    2. Reads the uploaded template PDF into memory
    3. Stamps text onto the correct pages using the dynamic JSON map
    4. Streams the result back as application/pdf
    """
    form_data = await request.form()
    
    template_pdf = form_data.get("template_pdf")
    if template_pdf is None or not hasattr(template_pdf, "read"):
        raise HTTPException(status_code=422, detail="PDF template não enviado ou inválido.")

    # Checkboxes
    checkbox_orientacao = str(form_data.get("checkbox_orientacao", "false")).lower() == "true"
    checkbox_convocar = str(form_data.get("checkbox_convocar", "false")).lower() == "true"
    
    # Template Map
    template_map_json = str(form_data.get("template_map_json", ""))

    log.info("Received ocorrencia request")

    # 1. Read template bytes into memory (NEVER saved to disk)
    template_bytes = await template_pdf.read()
    if not template_bytes:
        raise HTTPException(status_code=422, detail="Arquivo PDF vazio ou inválido.")

    # Basic PDF validation
    if not template_bytes[:5] == b"%PDF-":
        raise HTTPException(status_code=422, detail="O arquivo enviado não é um PDF válido.")

    # 2. Load config and template map
    oc_config = oc_mapper.load_config()
    if template_map_json:
        template_map = json.loads(template_map_json)
    else:
        template_map = oc_mapper.load_template_map()

    # 3. Build the dynamic fields dict — direct passthrough, no AI
    fields = {}
    
    # Inject all string fields from the form payload
    for key, value in form_data.items():
        if isinstance(value, str) and key not in ["template_map_json"]:
            fields[key] = value

    # Normalize checkbox fields to booleans
    fields["checkbox_orientacao_aluno"] = checkbox_orientacao
    fields["checkbox_convocar_responsavel"] = checkbox_convocar

    log.info(f"Form Keys: {list(fields.keys())} | Map Keys: {list(template_map.get('fields', {}).keys())}")

    # 5. Generate stamped PDF in memory
    try:
        pdf_bytes = oc_mapper.generate_pdf_buffer(
            template_bytes=template_bytes,
            fields=fields,
            template_map=template_map,
            config=oc_config,
        )
    except Exception as exc:
        log.exception("PDF generation failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar PDF: {exc}"
        ) from exc

    log.info(
        "Ocorrência generated successfully: %d bytes, aluno='%s'",
        len(pdf_bytes), form_data.get('nome_aluno', 'Não informado'),
    )

    # 6. Stream the PDF back — nothing touches disk
    headers = {"Content-Disposition": 'attachment; filename="ocorrencia_gerada.pdf"'}
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers,
    )


# ── Dev entrypoint ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
