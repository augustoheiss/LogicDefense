"""
Sekundo Backend — Stateless Microservice
=========================================

🚨 ISOLATION NOTICE:
    This backend is COMPLETELY INDEPENDENT from Assistente-Moeda.
    - No shared database connections
    - No shared environment variables
    - No shared middleware (no X-Spreadsheet-Key, no financial auth)
    - Deployed as its own Render service: https://sekundo-api.onrender.com

Purpose:
    1. PDF Processing   — Extract form fields, map coordinates, fill PDFs
    2. Email Dispatch    — Send encrypted event links via Resend/SendGrid
    3. WebRTC Signaling  — Lightweight relay for P2P chat initial handshake

All endpoints are stateless. No database. No user sessions.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import pdf_router, signaling_router, health_router


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    print("🟢 Sekundo API starting — stateless, isolated, sovereign.")
    yield
    print("🔴 Sekundo API shutting down.")


# ---------------------------------------------------------------------------
# App Factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Sekundo API",
    description="Stateless microservice for PDF processing, email dispatch, and WebRTC signaling.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — reads allowed origins from env, defaults to localhost dev ports
cors_origins_raw = os.getenv("SEKUNDO_CORS_ORIGINS", "http://localhost:8081,http://localhost:19006")
cors_origins = [origin.strip() for origin in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,  # No cookies, no sessions — stateless
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Sekundo-Admin-Key"],
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(health_router.router, tags=["Health"])
app.include_router(pdf_router.router, prefix="/pdf", tags=["PDF"])
app.include_router(signaling_router.router, prefix="/signal", tags=["WebRTC Signaling"])


# ---------------------------------------------------------------------------
# Entry Point (local dev)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
