"""
main_cv.py — CV Maker 2.0 Standalone Engine (FastAPI)
=============================================================================
Servidor autônomo, ultraleve e dedicado exclusivamente ao CV Maker 2.0:
  - Geração de 5 arquétipos em paralelo (Gemini 3.7 Flash)
  - Síntese Magna Nível 2 (Multi-Agent Ensemble)
  - Alfaiataria ATS (Tailoring) e Cover Letter sob demanda
  - Gestão de Licenças Pro (Turso DB) e Chaves Efêmeras
  - Catálogo aberto de Prompts, Blueprints A4 e Temas Visuais

Porta padrão de desenvolvimento: 8001 (ou PORT do ambiente)
"""

import json
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
log = logging.getLogger("cv-maker-engine")

# ── Instância FastAPI ────────────────────────────────────────────────────────
app = FastAPI(
    title="CV Maker 2.0 Engine",
    description="Motor Agent-Native de IA para geração, tailoring e síntese de currículos executivos.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Roteadores do CV Maker ───────────────────────────────────────────────────
from routers.cv_router import router as cv_router
from routers.license_router import router as license_router
from routers.api_keys_router import router as api_keys_router

app.include_router(cv_router)
app.include_router(license_router)
app.include_router(api_keys_router)

# ── Health Checks ────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "service": "CV Maker 2.0 Engine",
        "status": "online",
        "mode": "yaml-first",
        "engine": "gemini-3.7-flash",
    }


@app.get("/")
async def root_index():
    """Entrypoint de descoberta e documentação do CV Maker Standalone."""
    return {
        "service": "CV Maker 2.0 Standalone API",
        "status": "online",
        "version": "2.0.0",
        "openapi_schema": "/api/v1/openapi.json",
        "primary_endpoints": {
            "generate": "/api/v1/cv/generate",
            "tailor": "/api/v1/cv/tailor",
            "synthesize": "/api/v1/cv/synthesize",
            "cover_letter": "/api/v1/cv/generate-cover-letter",
            "prompts": "/api/v1/cv/prompts",
            "layouts": "/api/v1/cv/layouts",
            "themes": "/api/v1/cv/themes",
            "render_data": "/api/v1/cv/render",
            "compile_data": "/api/v1/cv/compile",
            "api_keys": "/api/v1/api-keys/generate",
            "license_validate": "/api/license/validate",
        },
        "description": "API stateless de inteligência de carreira e geração de currículos A4.",
    }


# ── OpenAPI Schema Dedicado do CV Maker ───────────────────────────────────────

@app.get("/api/v1/openapi.json", include_in_schema=False)
async def get_cv_openapi(request: Request):
    """Retorna o esquema OpenAPI 3.1 com foco nas rotas do CV Maker e Licenciamento."""
    full_schema = get_openapi(
        title="CV Maker 2.0 Engine API",
        version="2.0.0",
        description="Stateless CV Generation, Tailoring, Synthesis & Blueprint Engine.",
        routes=app.routes,
    )
    server_url = str(request.base_url).rstrip("/")
    full_schema["servers"] = [{"url": server_url, "description": "Active CV Maker Server"}]
    return JSONResponse(content=full_schema)


# ── Execução Local ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    log.info("Iniciando CV Maker 2.0 Engine na porta %d...", port)
    uvicorn.run("main_cv:app", host="0.0.0.0", port=port, reload=True)
