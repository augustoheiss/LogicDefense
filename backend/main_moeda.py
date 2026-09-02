"""
main_moeda.py — Assistente Moeda & Coin AI Standalone Engine (FastAPI)
=============================================================================
Servidor autônomo e dedicado exclusivamente ao ecossistema do Assistente Moeda:
  - Análise Financeira com IA e RAG Semântico
  - Entrada em Massa de Transações (/api/coin/bulk-input)
  - Integrações Públicas de Planilha (/api/v1/public/*)
  - Webhooks de Pagamento (RevenueCat & Stripe)
  - Gestão de Licenças e Chaves de Planilha

Porta padrão de desenvolvimento: 8002 (ou PORT do ambiente)
"""

import logging
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

# ── Carregar variáveis de ambiente ───────────────────────────────────────────
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("assistente-moeda-engine")

# ── Instância FastAPI ────────────────────────────────────────────────────────
app = FastAPI(
    title="Assistente Moeda API",
    description="Motor de Inteligência Financeira e Integração de Planilhas.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Roteadores do Assistente Moeda ───────────────────────────────────────────
from routers.public_api_router import router as public_api_router
from routers.coin_ai_router import router as coin_ai_router
from routers.coin_bulk_router import router as coin_bulk_router
from routers.license_router import router as license_router
from routers.api_keys_router import router as api_keys_router
from routers.webhook_router import router as webhook_router
from routers.stripe_webhook_router import router as stripe_webhook_router

app.include_router(public_api_router)
app.include_router(coin_ai_router)
app.include_router(coin_bulk_router)
app.include_router(license_router)
app.include_router(api_keys_router)
app.include_router(webhook_router)
app.include_router(stripe_webhook_router)

# ── Health Checks ────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "service": "Assistente Moeda Engine",
        "status": "online",
        "version": "3.0.0",
    }


@app.get("/")
async def root_index(request: Request):
    """
    Root Endpoint — Auto-discovery para Assistente Moeda.
    Se X-Spreadsheet-Key for fornecido, serve o contexto de análise diretamente.
    """
    key = request.headers.get("x-spreadsheet-key") or request.headers.get("X-Spreadsheet-Key")
    if key and key.startswith("am_sheet_live_"):
        from routers.public_api_router import generate_analysis_context_in_memory, validate_api_key_and_get_table_id
        table_id = await validate_api_key_and_get_table_id("read", api_key=key)
        return await generate_analysis_context_in_memory(table_id=table_id)

    return {
        "service": "Assistente Moeda Standalone API",
        "status": "online",
        "version": "3.0.0",
        "openapi_schema": "/api/v1/openapi.json",
        "primary_endpoints": {
            "coin_analysis": "/api/v1/public/analysis-context",
            "bulk_input": "/api/coin/bulk-input",
            "api_keys": "/api/v1/api-keys/generate",
            "license_validate": "/api/license/validate",
        },
        "description": "API de inteligência financeira e conciliação de planilhas com zero armazenamento de PII.",
    }


# ── OpenAPI Schema Dedicado do Assistente Moeda ──────────────────────────────

@app.get("/api/v1/openapi.json", include_in_schema=False)
async def get_moeda_openapi(request: Request):
    """Retorna o esquema OpenAPI 3.1 com foco nas rotas do Assistente Moeda e Licenciamento."""
    full_schema = get_openapi(
        title="Assistente Moeda API",
        version="3.0.0",
        description="Stateless Financial AI and Spreadsheet Integration API.",
        routes=app.routes,
    )
    server_url = str(request.base_url).rstrip("/")
    full_schema["servers"] = [{"url": server_url, "description": "Active Assistente Moeda Server"}]
    return JSONResponse(content=full_schema)


# ── Execução Local ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8002))
    log.info("Iniciando Assistente Moeda Engine na porta %d...", port)
    uvicorn.run("main_moeda:app", host="0.0.0.0", port=port, reload=True)
