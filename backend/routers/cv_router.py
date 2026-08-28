"""
cv_router.py — Roteador de Endpoints para o CV Maker 2.0
Suporta chamadas web do laboratório e integração com agentes externos via API Keys.
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query, status
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

from services.cv_generator_service import generate_all_archetypes, generate_single_archetype, dict_to_yaml
from prompts.cv_prompts import PERSONA_INSTRUCTIONS

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cv", tags=["CV Maker 2.0 Engine"])


class CVGenerateRequest(BaseModel):
    raw_text: str = Field(..., min_length=40, description="Texto bruto do currículo, anotações ou LinkedIn.")
    job_description: Optional[str] = Field(default=None, description="Descrição da vaga para tailoring ATS.")


class CVGenerateResponse(BaseModel):
    professional: str = Field(..., description="YAML arquétipo Executivo / IBM Senior Lead")
    architect: Optional[str] = Field(default=None, description="YAML arquétipo AI Solutions Architect")
    historian: str = Field(..., description="YAML arquétipo Biográfico / Narrativo")
    didactic: str = Field(..., description="YAML arquétipo Didático / Learning Speed")
    alien: str = Field(..., description="YAML arquétipo Observador Extraterrestre")


class CVTailorRequest(BaseModel):
    base_yaml: str = Field(..., description="YAML base do currículo")
    job_description: str = Field(..., description="Descrição completa da vaga alvo")
    persona: Optional[str] = Field(default="professional", description="Persona desejada: professional, architect, historian, didactic")


class CVRenderRequest(BaseModel):
    yaml_content: Optional[str] = Field(default=None, alias="raw_text", description="Conteúdo do currículo em YAML ou texto")
    theme: Optional[str] = Field(default="executive", description="Tema visual: executive, creative, minimalist, white, terminal")
    format: Optional[str] = Field(default="html", description="Formato de saída: html ou yaml")

    model_config = {"populate_by_name": True}


@router.post("/generate", response_model=CVGenerateResponse)
async def generate_cv_endpoint(
    payload: CVGenerateRequest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_cv_key: Optional[str] = Header(None, alias="X-CV-Key"),
    x_spreadsheet_key: Optional[str] = Header(None, alias="X-Spreadsheet-Key"),
):
    """
    Gera até 5 arquétipos em paralelo usando o Gemini 2.5 Flash.
    Suporta autenticação transparente com as chaves temporárias do LogicDefense.
    """
    raw_key = x_api_key or x_cv_key or x_spreadsheet_key
    if raw_key:
        from db.license_db import get_spreadsheet_api_key, hash_key
        record = get_spreadsheet_api_key(hash_key(raw_key.strip()))
        if record and record.get("is_expired"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chave de API expirada.")

    log.info("[CV Router] service='cv' action='generate' chars=%d", len(payload.raw_text))

    try:
        results = await generate_all_archetypes(
            raw_text=payload.raw_text,
            job_description=payload.job_description,
        )
        return CVGenerateResponse(
            professional=results.get("professional", ""),
            architect=results.get("architect", results.get("professional", "")),
            historian=results.get("historian", ""),
            didactic=results.get("didactic", ""),
            alien=results.get("alien", ""),
        )
    except Exception as e:
        log.error("[CV Router] service='cv' Generation error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao processar currículo com a IA: {str(e)}",
        )


@router.post("/tailor")
async def tailor_cv_endpoint(
    payload: CVTailorRequest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Endpoint para agentes autônomos: Realiza a alfaiataria (tailoring) do currículo
    contra uma Job Description específica, aplicando a fórmula X-Y-Z e keywords ATS.
    """
    persona_key = payload.persona if payload.persona in PERSONA_INSTRUCTIONS else "professional"
    persona_inst = PERSONA_INSTRUCTIONS[persona_key]

    log.info("[CV Router] service='cv' action='tailor' persona='%s'", persona_key)

    try:
        tailored_yaml = await generate_single_archetype(
            archetype=persona_key,
            persona_instruction=persona_inst,
            raw_text=payload.base_yaml,
            job_description=payload.job_description,
            index=0,
        )
        return {"persona": persona_key, "tailored_yaml": tailored_yaml}
    except Exception as e:
        log.error("[CV Router] service='cv' Tailoring error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro na alfaiataria de currículo: {str(e)}",
        )


@router.post("/render")
async def render_cv_endpoint(
    payload: CVRenderRequest = CVRenderRequest(),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Renderiza um payload HTML standalone ou devolve o YAML normalizado para agentes externos.
    """
    yaml_text = payload.yaml_content or ""
    theme_name = payload.theme or "executive"

    if payload.format == "yaml":
        return Response(content=yaml_text, media_type="text/yaml")

    html_template = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Currículo Renderizado — LogicDefense</title>
  <style>
    body {{ font-family: sans-serif; padding: 2rem; max-width: 850px; margin: auto; }}
    pre {{ background: #f4f4f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }}
  </style>
</head>
<body class="theme-{theme_name}">
  <h2>Currículo Formatado (Tema: {theme_name})</h2>
  <pre>{yaml_text}</pre>
</body>
</html>"""

    return HTMLResponse(content=html_template)
