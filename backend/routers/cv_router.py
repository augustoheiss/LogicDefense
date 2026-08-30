"""
cv_router.py — Roteador de Endpoints para o CV Maker 2.0
Suporta chamadas web do laboratório e integração com agentes externos via API Keys.
Suporta geração e renderização síncrona dos 5 arquétipos em HTML, ZIP ou JSON.
"""

import logging
import io
import os
import zipfile
import yaml
from typing import Optional, Dict, Any
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
    html_dashboard: Optional[str] = Field(default=None, description="HTML Standalone Dashboard com os 5 arquétipos embutidos e interativos")


class CVTailorRequest(BaseModel):
    base_yaml: str = Field(..., description="YAML base do currículo")
    job_description: str = Field(..., description="Descrição completa da vaga alvo")
    persona: Optional[str] = Field(default="professional", description="Persona desejada: professional, architect, historian, didactic")


class CVRenderRequest(BaseModel):
    yaml_content: Optional[str] = Field(default=None, alias="raw_text", description="Conteúdo do currículo em YAML ou texto")
    theme: Optional[str] = Field(default="executive", description="Tema visual: executive, creative, minimalist, white, terminal")
    format: Optional[str] = Field(default="html", description="Formato de saída: html, yaml, zip, json")
    filename: Optional[str] = Field(default="curriculo", description="Nome base para download do arquivo")

    model_config = {"populate_by_name": True}


class CVCompileBundleRequest(BaseModel):
    professional: Optional[str] = Field(default="", description="YAML do arquétipo Executivo / IBM Senior Lead")
    architect: Optional[str] = Field(default="", description="YAML do arquétipo AI Solutions Architect")
    historian: Optional[str] = Field(default="", description="YAML do arquétipo Biográfico / Narrativo")
    didactic: Optional[str] = Field(default="", description="YAML do arquétipo Didático / Learning Velocity")
    alien: Optional[str] = Field(default="", description="YAML do arquétipo Observador Extraterrestre")
    default_theme: Optional[str] = Field(default="executive", description="Tema visual inicial: executive, creative, minimalist, white, terminal")
    format: Optional[str] = Field(default="html", description="Formato de saída: html, zip, json")
    filename: Optional[str] = Field(default="curriculos_5_versoes", description="Nome base para download do arquivo")


def get_default_yaml_content() -> str:
    """Carrega o YAML de currículo padrão do repositório como fallback."""
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "cv-yaml", "cv-ptbr.yaml")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cv-yaml", "cv-ptbr.yaml")),
        os.path.abspath("cv-yaml/cv-ptbr.yaml"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return f.read()
            except Exception:
                pass
    return ""


from db.license_db import get_license_by_raw_key, deduct_license_tokens, is_godmode_key, get_spreadsheet_api_key, hash_key

# Multiplicador de Queima de Tokens para cobrir Raciocínio Pesado (Gemini 3.7 Thinking) e Margem Operacional
AI_TOKEN_BURN_MULTIPLIER = 3.0


async def verify_cv_license_and_quota(raw_key: Optional[str], estimated_text: str, num_calls: int = 1, x_gemini_key: Optional[str] = None) -> dict:
    """
    Valida a chave de licença ou API Key e verifica se há saldo de tokens suficiente com margem de segurança.
    Suporta chaves Pro (am_pro_...), chaves de planilha (am_sheet_...), Bring-Your-Own-Key Gemini (AIzaSy...) e God Mode (Mateus7:12@).
    """
    if x_gemini_key and x_gemini_key.strip().startswith("AIzaSy"):
        return {"tier": "byok_gemini", "token_balance": 999999999, "key_hash": "byok_gemini", "gemini_key": x_gemini_key.strip()}

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de Licença Pro ou Chave Gemini (BYOK) necessária para utilizar a IA do CV Maker. Ative sua chave ou informe sua chave própria de API.",
        )

    clean_k = raw_key.strip()
    if clean_k.startswith("Bearer "):
        clean_k = clean_k.replace("Bearer ", "").strip()

    if is_godmode_key(clean_k):
        return {"tier": "godmode", "token_balance": 999999999, "key_hash": "godmode"}

    # 1. Bring Your Own Key (Google Gemini API Key direta: AIzaSy...)
    if clean_k.startswith("AIzaSy"):
        return {"tier": "byok_gemini", "token_balance": 999999999, "key_hash": "byok_gemini", "gemini_key": clean_k}

    # 2. Tenta buscar como Chave de Licença de Usuário Pro (Turso DB)
    rec = get_license_by_raw_key(clean_k)
    if rec:
        # Estima tokens: (~3.5 chars por token) + System Prompts e Thinking Budget (3.500 por chamada) * multiplicador 3x
        est_prompt_tokens = int(((len(estimated_text) / 3.5) + (3500 * num_calls)) * AI_TOKEN_BURN_MULTIPLIER)
        if rec.get("token_balance", 0) < est_prompt_tokens:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Saldo de tokens insuficiente ({rec.get('token_balance', 0):,} restantes, estimado {est_prompt_tokens:,}). Adquira uma recarga ou faça upgrade do seu plano.",
            )
        return rec

    # 3. Tenta buscar como Chave de Planilha / API Key de Agente (am_sheet_... ou am_live_...)
    if clean_k.startswith("am_sheet_") or clean_k.startswith("am_live_"):
        sheet_rec = get_spreadsheet_api_key(hash_key(clean_k)) or get_spreadsheet_api_key(clean_k)
        if sheet_rec or len(clean_k) > 20:
            return {"tier": "sheet_api", "token_balance": 999999999, "key_hash": "sheet_api"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Chave de Licença inválida ou não encontrada. Verifique o código inserido ou ative sua chave Pro nas configurações.",
    )



@router.post("/generate")
async def generate_cv_endpoint(
    payload: CVGenerateRequest,
    format: Optional[str] = Query("json", description="Formato de retorno: json, html, zip"),
    theme: Optional[str] = Query("executive", description="Tema visual inicial: executive, creative, minimalist, white, terminal"),
    x_license_key: Optional[str] = Header(None, alias="X-License-Key"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    x_cv_key: Optional[str] = Header(None, alias="X-CV-Key"),
    x_spreadsheet_key: Optional[str] = Header(None, alias="X-Spreadsheet-Key"),
    authorization: Optional[str] = Header(None),
):
    """
    Gera todos os 5 arquétipos em paralelo usando o Gemini 3.7 Flash (High Thinking) de forma síncrona.
    Permite retornar diretamente:
    - format=html -> Super Dashboard HTML Standalone com os 5 currículos e 5 temas interativos
    - format=zip  -> Pacote .ZIP com os 5 arquivos .YAML separados + o HTML Dashboard
    - format=json -> Objeto JSON com os 5 YAMLs e o HTML embutido
    """
    raw_key = x_license_key or x_api_key or x_cv_key or x_spreadsheet_key or authorization
    license_rec = await verify_cv_license_and_quota(raw_key, payload.raw_text, num_calls=5, x_gemini_key=x_gemini_api_key)

    custom_gemini = license_rec.get("gemini_key") or x_gemini_api_key

    # Proteção Estrita de Custo: Chaves de automação gratuitas (am_sheet_...) exigem chave própria (BYOK)
    if license_rec.get("tier") == "sheet_api" and not custom_gemini:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A API opera no modelo BYOK (Bring-Your-Own-Key) para chamadas de IA. "
                "Informe sua chave própria do Google Gemini no header 'X-Gemini-API-Key' para gerar os arquétipos, "
                "ou envie o YAML pronto diretamente para '/api/v1/cv/render' (renderização e compilação de PDFs 100% gratuita)."
            ),
        )

    log.info("[CV Router] service='cv' action='generate' format='%s' tier='%s' byok=%s chars=%d", format, license_rec.get("tier"), bool(custom_gemini), len(payload.raw_text))

    try:
        results, total_tokens = await generate_all_archetypes(
            raw_text=payload.raw_text,
            job_description=payload.job_description,
            custom_api_key=custom_gemini,
        )

        # Debita os tokens consumidos da chave do usuário com multiplicador de queima 3x
        if total_tokens > 0 and license_rec.get("key_hash") not in ("godmode", "sheet_api", "byok_gemini"):
            charged_tokens = int(total_tokens * AI_TOKEN_BURN_MULTIPLIER)
            try:
                deduct_license_tokens(license_rec["key_hash"], charged_tokens, endpoint="/api/v1/cv/generate")
                log.info("[CV Router] Tokens debitados: %d (brutos: %d, multiplicador: %.1fx)", charged_tokens, total_tokens, AI_TOKEN_BURN_MULTIPLIER)
            except Exception as d_err:
                log.warning("[CV Router] Falha ao debitar tokens: %s", d_err)

        from services.cv_html_renderer import render_multi_cv_dashboard_html

        target_format = (format or "json").strip().lower()
        target_theme = (theme or "executive").strip().lower()

        # Renderiza o Super Dashboard HTML com os 5 arquétipos
        html_dashboard = render_multi_cv_dashboard_html(
            archetypes=results,
            default_persona="professional",
            default_theme=target_theme,
        )

        # 1. Retorno Direto em HTML Standalone
        if target_format == "html":
            return HTMLResponse(content=html_dashboard)

        # 2. Retorno em Pacote ZIP com os 5 YAMLs e o Dashboard HTML
        if target_format == "zip":
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                zip_file.writestr("curriculo_executivo_ibm.yaml", results.get("professional", ""))
                zip_file.writestr("curriculo_arquiteto_ia.yaml", results.get("architect", ""))
                zip_file.writestr("curriculo_biografo.yaml", results.get("historian", ""))
                zip_file.writestr("curriculo_didatico.yaml", results.get("didactic", ""))
                zip_file.writestr("curriculo_alien.yaml", results.get("alien", ""))
                zip_file.writestr("dashboard_curriculos_completo.html", html_dashboard)

            return Response(
                content=zip_buffer.getvalue(),
                media_type="application/zip",
                headers={"Content-Disposition": 'attachment; filename="curriculos_completo_5_versoes.zip"'}
            )

        # 3. Retorno Padrão em JSON Estruturado
        return CVGenerateResponse(
            professional=results.get("professional", ""),
            architect=results.get("architect", results.get("professional", "")),
            historian=results.get("historian", ""),
            didactic=results.get("didactic", ""),
            alien=results.get("alien", ""),
            html_dashboard=html_dashboard,
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
    x_license_key: Optional[str] = Header(None, alias="X-License-Key"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    authorization: Optional[str] = Header(None),
):
    """
    Endpoint para alfaiataria (tailoring) do currículo contra uma Job Description específica.
    Verifica a licença Pro ou aceita chave Gemini própria (BYOK) e debita os tokens se for servidor.
    """
    raw_key = x_license_key or x_api_key or authorization
    full_text = payload.base_yaml + "\n" + payload.job_description
    license_rec = await verify_cv_license_and_quota(raw_key, full_text, num_calls=1, x_gemini_key=x_gemini_api_key)

    custom_gemini = license_rec.get("gemini_key") or x_gemini_api_key

    # Proteção Estrita de Custo: Chaves de automação gratuitas (am_sheet_...) exigem chave própria (BYOK)
    if license_rec.get("tier") == "sheet_api" and not custom_gemini:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A rota de alfaiataria via API opera no modelo BYOK. "
                "Informe sua chave do Google Gemini no header 'X-Gemini-API-Key' para executar o tailoring."
            ),
        )

    persona_key = payload.persona if payload.persona in PERSONA_INSTRUCTIONS else "professional"
    persona_inst = PERSONA_INSTRUCTIONS[persona_key]

    log.info("[CV Router] service='cv' action='tailor' persona='%s' tier='%s' byok=%s", persona_key, license_rec.get("tier"), bool(custom_gemini))

    try:
        tailored_yaml, total_tokens = await generate_single_archetype(
            archetype=persona_key,
            persona_instruction=persona_inst,
            raw_text=payload.base_yaml,
            job_description=payload.job_description,
            index=0,
            custom_api_key=custom_gemini,
        )

        if total_tokens > 0 and license_rec.get("key_hash") not in ("godmode", "sheet_api", "byok_gemini"):
            charged_tokens = int(total_tokens * AI_TOKEN_BURN_MULTIPLIER)
            try:
                deduct_license_tokens(license_rec["key_hash"], charged_tokens, endpoint="/api/v1/cv/tailor")
                log.info("[CV Router] Tokens debitados (tailor): %d (brutos: %d, multiplicador: %.1fx)", charged_tokens, total_tokens, AI_TOKEN_BURN_MULTIPLIER)
            except Exception as d_err:
                log.warning("[CV Router] Falha ao debitar tokens: %s", d_err)

        return {"persona": persona_key, "tailored_yaml": tailored_yaml, "tokens_used": total_tokens}
    except Exception as e:
        log.error("[CV Router] service='cv' Tailoring error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro na alfaiataria de currículo: {str(e)}",
        )


@router.get("/download")
@router.get("/render")
@router.post("/render")
async def render_cv_endpoint(
    payload: Optional[CVRenderRequest] = None,
    format: Optional[str] = Query(None, description="Formato de saída: html, yaml, zip, json"),
    theme: Optional[str] = Query(None, description="Tema visual: executive, creative, minimalist, white, terminal"),
    lang: Optional[str] = Query(None, description="Idioma forçado: pt, en ou auto"),
    filename: Optional[str] = Query(None, description="Nome base para download do arquivo (sem extensão)"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Renderiza ou baixa o currículo em múltiplos formatos:
    - format=zip  -> Retorna pacote .zip com curriculo.html e curriculo.yaml
    - format=yaml -> Retorna o arquivo .yaml estruturado puro
    - format=html -> Retorna o HTML standalone interativo de alta densidade
    - format=json -> Retorna JSON {"html": ..., "yaml": ..., "theme": ...}
    """
    q_format = format if isinstance(format, str) else None
    q_theme = theme if isinstance(theme, str) else None
    q_lang = lang if isinstance(lang, str) else None
    q_filename = filename if isinstance(filename, str) else None

    yaml_text = (payload.yaml_content if payload and payload.yaml_content else None) or get_default_yaml_content()
    theme_name = q_theme or (payload.theme if payload and payload.theme else None) or "executive"
    target_format = (q_format or (payload.format if payload and payload.format else None) or "html").strip().lower()
    base_filename = (q_filename or (payload.filename if payload and payload.filename else None) or "curriculo").strip()
    target_lang = q_lang or "auto"

    from services.cv_html_renderer import render_cv_to_standalone_html

    # 1. YAML Puro
    if target_format in ("yaml", "yml"):
        return Response(
            content=yaml_text,
            media_type="text/yaml; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.yaml"'}
        )

    # Gera o HTML standalone
    html_content = render_cv_to_standalone_html(yaml_text, theme=theme_name, lang=target_lang)

    # 2. Pacote ZIP (HTML + YAML)
    if target_format == "zip":
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr(f"{base_filename}.html", html_content)
            zip_file.writestr(f"{base_filename}.yaml", yaml_text)

        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}_completo.zip"'}
        )

    # 3. JSON Estruturado para integrações
    if target_format == "json":
        return {
            "html": html_content,
            "yaml": yaml_text,
            "theme": theme_name,
            "filename": base_filename,
            "lang": target_lang
        }

    # 4. HTML Standalone (Padrão)
    return HTMLResponse(content=html_content)


@router.post("/compile")
async def compile_cv_bundle_endpoint(
    payload: CVCompileBundleRequest,
    format: Optional[str] = Query(None, description="Formato de saída: html, zip, json"),
    theme: Optional[str] = Query(None, description="Tema visual: executive, creative, minimalist, white, terminal"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Endpoint 100% Agent-Native (Zero Custo de Tokens de LLM no Servidor).
    Recebe os 5 YAMLs gerados pelo Agente de IA do próprio usuário (Claude, Cursor, Antigravity, GPT)
    e compila instantaneamente o Super Dashboard HTML Standalone e o pacote .ZIP.
    """
    from services.cv_html_renderer import render_multi_cv_dashboard_html

    target_theme = theme or payload.default_theme or "executive"
    target_format = (format or payload.format or "html").strip().lower()
    base_filename = (payload.filename or "curriculos_5_versoes").strip()

    archetypes_map = {
        "professional": payload.professional or "",
        "architect": payload.architect or payload.professional or "",
        "historian": payload.historian or "",
        "didactic": payload.didactic or "",
        "alien": payload.alien or "",
    }

    html_dashboard = render_multi_cv_dashboard_html(
        archetypes=archetypes_map,
        default_persona="professional",
        default_theme=target_theme,
    )

    if target_format == "zip":
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr("curriculo_executivo_ibm.yaml", archetypes_map.get("professional", ""))
            zip_file.writestr("curriculo_arquiteto_ia.yaml", archetypes_map.get("architect", ""))
            zip_file.writestr("curriculo_biografo.yaml", archetypes_map.get("historian", ""))
            zip_file.writestr("curriculo_didatico.yaml", archetypes_map.get("didactic", ""))
            zip_file.writestr("curriculo_alien.yaml", archetypes_map.get("alien", ""))
            zip_file.writestr(f"{base_filename}_dashboard.html", html_dashboard)

        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.zip"'}
        )

    if target_format == "json":
        return {
            "html_dashboard": html_dashboard,
            "archetypes": archetypes_map,
            "theme": target_theme,
        }

    return HTMLResponse(content=html_dashboard)


@router.get("/prompts")
async def get_cv_prompts_endpoint():
    """
    Retorna os System Prompts e instruções de arquétipos para agentes de IA externos (Claude, Cursor, GPT).
    """
    from prompts.cv_prompts import BASE_INSTRUCTION, PERSONA_INSTRUCTIONS

    prompts_list = [
        {
            "id": "ibm-executive",
            "title": "💼 Executivo IBM / Senior Tech Lead",
            "subtitle": "Fórmula X-Y-Z do Google/IBM, foco em impacto, governança e métricas de ROI",
            "persona": "professional",
            "system_prompt": f"{BASE_INSTRUCTION}\n\n{PERSONA_INSTRUCTIONS['professional']}"
        },
        {
            "id": "ai-solutions-architect",
            "title": "🧠 AI & Cloud Solutions Architect",
            "subtitle": "Pipelines de RAG, microsserviços assíncronos, cloud híbrida e engenharia de precisão",
            "persona": "architect",
            "system_prompt": f"{BASE_INSTRUCTION}\n\n{PERSONA_INSTRUCTIONS['architect']}"
        },
        {
            "id": "career-evolution-biographer",
            "title": "📜 Biógrafo / Evolução Estratégica",
            "subtitle": "Narrativa coesa da jornada profissional, contexto de negócio e legado sustentável",
            "persona": "historian",
            "system_prompt": f"{BASE_INSTRUCTION}\n\n{PERSONA_INSTRUCTIONS['historian']}"
        },
        {
            "id": "career-transition-didactic",
            "title": "🎓 Didático / Learning Velocity & Mentoria",
            "subtitle": "Foco em raciocínio analítico, comunicação técnica e velocidade de aprendizado",
            "persona": "didactic",
            "system_prompt": f"{BASE_INSTRUCTION}\n\n{PERSONA_INSTRUCTIONS['didactic']}"
        },
        {
            "id": "alien-field-observer",
            "title": "🤖 Observador / Relatório Extraterrestre (Sci-Fi & Humor)",
            "subtitle": "Relatório biológico intergaláctico sobre o espécime terráqueo e sua relação com código e café",
            "persona": "alien",
            "system_prompt": f"{BASE_INSTRUCTION}\n\n{PERSONA_INSTRUCTIONS['alien']}"
        },
        {
            "id": "ats-tailor-engine",
            "title": "🎯 Alfaiataria ATS (Match 100% com a Vaga)",
            "subtitle": "Otimização milimétrica de palavras-chave contra uma Job Description sem fabricação",
            "persona": "tailor",
            "system_prompt": f"{BASE_INSTRUCTION}\n\nTASK ADICIONAL: Adapte o currículo para dar match com os requisitos essenciais da vaga informada sem inventar dados."
        },
        {
            "id": "yaml-editor-direct-renderer",
            "title": "📝 Editor YAML & Compilador Standalone (Zero Mudança de Conteúdo)",
            "subtitle": "Validação estrita do schema JSON Resume, preservação 100% literal dos dados e compilação direta em HTML/PDF",
            "persona": "editor",
            "system_prompt": """VOCÊ É O COMPILADOR E EDITOR YAML DO CV MAKER 2.0.
SUA MISSÃO: Validar e estruturar o currículo fornecido pelo usuário no formato estrito do JSON Resume v1.0.0 em YAML puro, SEM ALTERAR OU FABRICAR QUALQUER DADO.

DIRETRIZES FUNDAMENTAIS DE PRESERVAÇÃO:
1. ZERO ALTERAÇÃO DE DADOS: Preserve 100% dos nomes de empresas, datas, cargos, resumos, tecnologias e links informados pelo usuário.
2. VALIDAÇÃO DE SCHEMA: Garanta que os blocos estejam corretamente aninhados: basics (name, label, email, phone, url, summary, location, profiles), work (name, position, url, startDate, endDate, summary, highlights), projects (name, description, url, keywords, highlights), skills (name, keywords), education (institution, area, studyType, startDate, endDate, courses), certificates (name, date, issuer, url), publications (name, publisher, releaseDate, url, summary), languages (language, fluency), interests (name, keywords).
3. FORMATAÇÃO LIMPA: Retorne apenas o código YAML válido em blocos limpos, sem formatações Markdown adicionais se for consumido via automação.
4. ROTA DE RENDERIZAÇÃO DIRETA: Para converter o YAML resultante em um documento HTML/PDF autônomo com os 5 modelos visuais (Executivo, Criativo, Minimalista, White, Terminal), faça uma requisição HTTP POST para:
   POST https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/render?format=html (ou ?format=zip)
   Body JSON: {"yaml_content": "<SEU_YAML_AQUI>", "theme": "executive"}
   Essa rota é pública, determinística e não gasta tokens."""
        }
    ]

    return {
        "service": "CV Maker 2.0 Engine",
        "description": "System Prompts corporativos para geração de currículos JSON Resume / YAML.",
        "prompts": prompts_list
    }
