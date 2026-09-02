"""
LogicDefense Unified Backend Gateway
=============================================================================
FastAPI Gateway unificado que orquestra todos os módulos do ecossistema:
  - CV Maker 2.0 Engine (/api/v1/cv/*)
  - Assistente Moeda & Coin AI (/api/v1/public/*, /api/v1/coin-ai/*, /api/coin/*)
  - Ocorrências PDF Stamping (/api/ocorrencias/*)
  - Gestão Unificada de Licenças e Chaves de Planilha
  - Webhooks de Pagamento (RevenueCat & Stripe)

Cada produto também pode ser executado em modo Standalone isolado:
  - CV Maker: `python main_cv.py` (porta 8001)
  - Assistente Moeda: `python main_moeda.py` (porta 8002)
"""

import json
import logging
import os
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

# ── Environment ──────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("logicdefense-gateway")

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="LogicDefense Unified Gateway",
    description="Gateway de microsserviços: CV Maker 2.0, Assistente Moeda e Ocorrências.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Roteadores do Ecossistema ────────────────────────────────────────────────

# 1. Assistente Moeda & Finanças
from routers.public_api_router import router as public_api_router
from routers.coin_ai_router import router as coin_ai_router
from routers.coin_bulk_router import router as coin_bulk_router

app.include_router(public_api_router)
app.include_router(coin_ai_router)
app.include_router(coin_bulk_router)

# 2. CV Maker 2.0 Engine
from routers.cv_router import router as cv_router
app.include_router(cv_router)

# 3. Ocorrências PDF Generator
from routers.ocorrencias_router import router as ocorrencias_router
app.include_router(ocorrencias_router)

# 4. Licenciamento & Chaves de API
from routers.license_router import router as license_router
from routers.api_keys_router import router as api_keys_router

app.include_router(license_router)
app.include_router(api_keys_router)

# 5. Webhooks de Pagamento
from routers.webhook_router import router as webhook_router
from routers.stripe_webhook_router import router as stripe_webhook_router

app.include_router(webhook_router)
app.include_router(stripe_webhook_router)


# ── Health Checks & Root Auto-Discovery ───────────────────────────────────────

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "service": "LogicDefense Unified Gateway",
        "status": "online",
        "version": "3.0.0",
        "modules": ["cv-maker", "assistente-moeda", "ocorrencias", "licenses", "api-keys"],
    }


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
        "service": "LogicDefense Unified Gateway API",
        "status": "online",
        "version": "3.0.0",
        "openapi_schema": "/api/v1/openapi.json",
        "primary_endpoints": {
            "coin_analysis": "/api/v1/public/analysis-context",
            "coin_bulk_input": "/api/coin/bulk-input",
            "cv_generator": "/api/v1/cv/generate",
            "cv_tailor": "/api/v1/cv/tailor",
            "cv_synthesize": "/api/v1/cv/synthesize",
            "ocorrencias": "/api/ocorrencias/gerar",
            "api_keys": "/api/v1/api-keys/generate",
            "license_validate": "/api/license/validate",
        },
        "description": "API unificada de inteligência financeira, gerador de currículos e relatórios.",
    }


# ── Unified Public OpenAPI Catalog ──────────────────────────────────────────

@app.get("/api/v1/openapi.json", include_in_schema=False)
async def get_unified_v1_openapi(request: Request):
    """
    Returns unified OpenAPI 3.1 schema for external AI agents, MCP tools, and integrations
    covering Assistente Moeda (/api/v1/public), CV Maker (/api/v1/cv), and API Keys (/api/v1/api-keys).
    """
    full_schema = get_openapi(
        title="LogicDefense Unified API",
        version="3.0.0",
        description="Unified stateless AI, financial and document generation API.",
        routes=app.routes,
    )

    allowed_prefixes = ("/api/v1/public", "/api/v1/cv", "/api/v1/api-keys", "/api/coin", "/api/ocorrencias")
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


# ── Dev entrypoint ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    log.info("Iniciando LogicDefense Gateway na porta %d...", port)
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
