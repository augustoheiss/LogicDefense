"""
cv_generator_service.py — Motor de IA e RAG para CV Maker 2.0
Execução concorrente, conversão JSON Resume -> YAML e sanitização de logs.
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict

import yaml
from google import genai
from google.genai import types

from prompts.cv_prompts import (
    BASE_INSTRUCTION,
    BASE_INSTRUCTION_EN,
    BASE_INSTRUCTION_ES,
    PERSONA_INSTRUCTIONS,
    PERSONA_INSTRUCTIONS_EN,
    PERSONA_INSTRUCTIONS_ES,
    MASTER_SYNTHESIS_INSTRUCTION,
    MASTER_SYNTHESIS_INSTRUCTION_EN,
    MASTER_SYNTHESIS_INSTRUCTION_ES,
)

MODEL = os.getenv("CV_AI_MODEL", "gemini-3.7-flash")
MAX_TOKENS = 8192
MAX_RETRIES = 3
RETRY_DELAY = 1.5
STAGGER_STEP = 0.4

log = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def dict_to_yaml(data: dict[str, Any]) -> str:
    """Converts a JSON Resume dict to a clean, block-style YAML string."""
    return yaml.dump(
        data,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
    )


def _finish_reason(response: Any) -> str:
    try:
        return response.candidates[0].finish_reason.name
    except Exception:
        return "UNKNOWN"


async def generate_single_archetype(
    archetype: str,
    persona_instruction: str,
    raw_text: str,
    job_description: str | None = None,
    lang: str = "auto",
    index: int = 0,
    custom_api_key: str | None = None,
) -> tuple[str, int]:
    """
    Generates ONE CV archetype as a clean YAML string with retry logic.
    Supports Bring-Your-Own-Key (BYOK) via custom_api_key.
    Returns (yaml_string, total_tokens_used).
    """
    if not custom_api_key:
        raise RuntimeError("Chave de API do Gemini não fornecida na requisição. A geração de arquétipos opera em modelo BYOK (informe no header X-Gemini-API-Key) ou utilize a arquitetura 100% Agent-Native gerando os YAMLs no seu próprio agente.")

    active_client = genai.Client(api_key=custom_api_key)

    if index > 0:
        await asyncio.sleep(index * STAGGER_STEP)

    # Language resolution: auto, pt, en, es
    target_lang = lang.lower() if lang and lang != "auto" else ""
    if not target_lang:
        is_english = any(w in raw_text.lower() for w in ["software engineer", "intern", "experience", "education", "hybrid cloud"]) and ("desenvolvedor" not in raw_text.lower() and "experiência" not in raw_text.lower())
        is_spanish = any(w in raw_text.lower() for w in ["experiencia", "educación", "contabilidad", "español", "habilidades", "resumen"]) and ("ciências contábeis" not in raw_text.lower() and "experiência" not in raw_text.lower())
        if is_english:
            target_lang = "en"
        elif is_spanish:
            target_lang = "es"
        else:
            target_lang = "pt"

    if target_lang == "en":
        base_inst = BASE_INSTRUCTION_EN
        p_inst = PERSONA_INSTRUCTIONS_EN.get(archetype, persona_instruction)
        lang_directive = "IMPORTANT LANGUAGE RULE: Output 100% of all fields, labels, summaries and descriptions in fluent Professional English."
    elif target_lang == "es":
        base_inst = BASE_INSTRUCTION_ES
        p_inst = PERSONA_INSTRUCTIONS_ES.get(archetype, persona_instruction)
        lang_directive = "IMPORTANT LANGUAGE RULE: Output 100% of all fields, labels, summaries and descriptions in fluent Professional Spanish (Español)."
    else:
        base_inst = BASE_INSTRUCTION
        p_inst = PERSONA_INSTRUCTIONS.get(archetype, persona_instruction)
        lang_directive = "IMPORTANT LANGUAGE RULE: Output 100% of all fields, labels, summaries and descriptions in Brazilian Portuguese (PT-BR)."

    system_instruction = f"{base_inst}\n\n{p_inst}"

    job_desc_section = ""
    if job_description and job_description.strip():
        job_desc_section = f"\n\n--- TARGET JOB DESCRIPTION (ATS TAILORING) ---\n{job_description.strip()}\n"

    user_prompt = (
        f"Rewrite the candidate's background as a single JSON Resume object "
        f"in the {archetype.upper()} archetype persona style.\n{lang_directive}{job_desc_section}\n\n"
        "--- CANDIDATE RAW DATA START ---\n"
        f"{raw_text}\n"
        "--- CANDIDATE RAW DATA END ---"
    )

    log.info("[CV Engine] service='cv' archetype='%s' lang='%s' index=%d chars=%d byok=%s", archetype, target_lang, index, len(raw_text), bool(custom_api_key))

    last_exc: Exception = RuntimeError(f"Falha na geração do arquétipo '{archetype}'")

    for attempt in range(MAX_RETRIES):
        if attempt > 0:
            log.warning(
                "[CV Engine] service='cv' attempt=%d/%d archetype='%s' — retry in %.1fs",
                attempt + 1, MAX_RETRIES, archetype, RETRY_DELAY,
            )
            await asyncio.sleep(RETRY_DELAY)

        response: Any = None
        try:
            gen_config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.65,
                max_output_tokens=MAX_TOKENS,
            )
            gen_config.thinking_config = types.ThinkingConfig(thinking_budget=2048)

            response = await asyncio.to_thread(
                active_client.models.generate_content,
                model=MODEL,
                contents=user_prompt,
                config=gen_config,
            )

            raw_json = (response.text or "").strip()
            if not raw_json:
                raise ValueError(f"Resposta vazia da IA (finish_reason={_finish_reason(response)})")

            tokens_used = 0
            if response.usage_metadata:
                tokens_used = response.usage_metadata.total_token_count or 0

            data: dict[str, Any] = json.loads(raw_json)
            log.info(
                "[CV Engine] service='cv' archetype='%s' OK attempt=%d keys=%d tokens=%d finish_reason=%s",
                archetype, attempt + 1, len(data), tokens_used, _finish_reason(response),
            )
            return dict_to_yaml(data), tokens_used

        except json.JSONDecodeError as exc:
            reason = _finish_reason(response) if response is not None else "N/A"
            log.warning("[CV Engine] service='cv' JSONDecodeError for '%s' (reason=%s): %s", archetype, reason, exc)
            last_exc = ValueError(f"Formato JSON inválido para '{archetype}': {exc}")

        except Exception as exc:
            log.warning("[CV Engine] service='cv' API error for '%s': %s", archetype, exc)
            last_exc = exc

    raise last_exc


async def generate_master_synthesis(
    archetypes: dict[str, str],
    job_description: str | None = None,
    lang: str = "auto",
    custom_api_key: str | None = None,
) -> tuple[str, int]:
    """
    NÍVEL 2 — Executa a Síntese Magna a partir dos 5 arquétipos em YAML.
    Retorna (master_yaml, total_tokens_used).
    Opera sob o modelo BYOK (chave fornecida pelo cliente/agente).
    """
    if not custom_api_key:
        raise RuntimeError("Chave de API do Gemini não fornecida na requisição. A síntese opera em modelo BYOK (informe no header X-Gemini-API-Key) ou utilize seu próprio agente de IA.")

    active_client = genai.Client(api_key=custom_api_key)

    # Resolução de Idioma
    combined_sample = "\n".join(archetypes.values())
    target_lang = lang.lower() if lang and lang != "auto" else ""
    if not target_lang:
        is_english = any(w in combined_sample.lower() for w in ["software engineer", "intern", "experience", "education", "hybrid cloud"]) and ("desenvolvedor" not in combined_sample.lower() and "experiência" not in combined_sample.lower())
        is_spanish = any(w in combined_sample.lower() for w in ["experiencia", "educación", "contabilidad", "español", "habilidades", "resumen"]) and ("ciências contábeis" not in combined_sample.lower() and "experiência" not in combined_sample.lower())
        if is_english:
            target_lang = "en"
        elif is_spanish:
            target_lang = "es"
        else:
            target_lang = "pt"

    if target_lang == "en":
        system_instruction = f"{BASE_INSTRUCTION_EN}\n\n{MASTER_SYNTHESIS_INSTRUCTION_EN}"
        lang_directive = "IMPORTANT LANGUAGE RULE: Output 100% in fluent Professional English."
    elif target_lang == "es":
        system_instruction = f"{BASE_INSTRUCTION_ES}\n\n{MASTER_SYNTHESIS_INSTRUCTION_ES}"
        lang_directive = "IMPORTANT LANGUAGE RULE: Output 100% in fluent Professional Spanish (Español)."
    else:
        system_instruction = f"{BASE_INSTRUCTION}\n\n{MASTER_SYNTHESIS_INSTRUCTION}"
        lang_directive = "IMPORTANT LANGUAGE RULE: Output 100% in Brazilian Portuguese (PT-BR)."

    job_desc_section = ""
    if job_description and job_description.strip():
        job_desc_section = f"\n\n--- TARGET JOB DESCRIPTION (ATS TAILORING) ---\n{job_description.strip()}\n"

    # Monta os 5 arquétipos no prompt
    archetypes_text = ""
    for name, content in archetypes.items():
        archetypes_text += f"\n=== ARQUÉTIPO FONTE: {name.upper()} ===\n{content.strip()}\n"

    user_prompt = (
        f"Synthesize the following 5 specialized candidate profiles into the single, definitive 6th Master Official Version.\n"
        f"{lang_directive}{job_desc_section}\n\n"
        f"--- 5 SOURCE ARCHETYPES START ---"
        f"{archetypes_text}\n"
        f"--- 5 SOURCE ARCHETYPES END ---"
    )

    log.info("[CV Engine] service='cv_synthesis' lang='%s' archetypes_count=%d byok=%s", target_lang, len(archetypes), bool(custom_api_key))

    for attempt in range(MAX_RETRIES):
        if attempt > 0:
            await asyncio.sleep(RETRY_DELAY)
        try:
            gen_config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.45,
                max_output_tokens=MAX_TOKENS,
            )
            gen_config.thinking_config = types.ThinkingConfig(thinking_budget=2048)

            response = await asyncio.to_thread(
                active_client.models.generate_content,
                model=MODEL,
                contents=user_prompt,
                config=gen_config,
            )

            raw_json = (response.text or "").strip()
            if not raw_json:
                raise ValueError(f"Resposta vazia da IA na síntese (finish_reason={_finish_reason(response)})")

            tokens_used = 0
            if response.usage_metadata:
                tokens_used = response.usage_metadata.total_token_count or 0

            data: dict[str, Any] = json.loads(raw_json)
            log.info("[CV Engine] service='cv_synthesis' OK attempt=%d keys=%d tokens=%d", attempt + 1, len(data), tokens_used)
            return dict_to_yaml(data), tokens_used
        except Exception as exc:
            log.warning("[CV Engine] service='cv_synthesis' attempt=%d error: %s", attempt + 1, exc)
            if attempt == MAX_RETRIES - 1:
                raise exc

    raise RuntimeError("Falha na geração da síntese master.")


async def generate_all_archetypes(
    raw_text: str,
    job_description: str | None = None,
    lang: str = "auto",
    custom_api_key: str | None = None,
    include_synthesis: bool = True,
) -> tuple[Dict[str, str], int]:
    """
    Launches concurrent calls for all personas in parallel via asyncio.gather(),
    and then generates the 6th Master Synthesis version (Level 2).
    Supports Bring-Your-Own-Key (BYOK) via custom_api_key.
    Returns (dict_of_archetypes, total_tokens_used).
    """
    tasks = [
        generate_single_archetype(
            archetype=arch,
            persona_instruction=persona,
            raw_text=raw_text,
            job_description=job_description,
            lang=lang,
            index=i,
            custom_api_key=custom_api_key,
        )
        for i, (arch, persona) in enumerate(PERSONA_INSTRUCTIONS.items())
    ]

    results = await asyncio.gather(*tasks)
    
    archetypes_map: dict[str, str] = {}
    total_tokens = 0
    
    for i, arch in enumerate(PERSONA_INSTRUCTIONS.keys()):
        yaml_content, tokens = results[i]
        archetypes_map[arch] = yaml_content
        total_tokens += tokens

    # Nível 2: Se solicitado e com chave, executa a Síntese Magna
    if include_synthesis and custom_api_key:
        try:
            master_yaml, synth_tokens = await generate_master_synthesis(
                archetypes=archetypes_map,
                job_description=job_description,
                lang=lang,
                custom_api_key=custom_api_key,
            )
            archetypes_map["official_master"] = master_yaml
            total_tokens += synth_tokens
        except Exception as exc:
            log.warning("[CV Engine] Falha na síntese master automática (mantendo os 5 arquétipos): %s", exc)

    return archetypes_map, total_tokens

async def generate_standalone_cover_letter(
    cv_data: dict[str, Any],
    job_description: str | None = None,
    target_company: str | None = None,
    recipient_name: str | None = None,
    tone: str = "professional",
    language: str = "pt",
    custom_api_key: str | None = None,
) -> tuple[dict[str, Any], int]:
    """
    Gera uma carta de apresentação (Cover Letter) sob medida para o candidato e a vaga.
    """
    from prompts.cv_prompts import COVER_LETTER_GENERATION_PROMPT

    if not custom_api_key:
        raise RuntimeError("Chave de API do Gemini não fornecida na requisição. A geração de cover letter opera em modelo BYOK (informe no header X-Gemini-API-Key) ou utilize seu próprio agente de IA.")

    active_client = genai.Client(api_key=custom_api_key)

    user_prompt = f"""
DADOS ESTRUTURADOS DO CANDIDATO:
{yaml.dump(cv_data, allow_unicode=True)}

EMPRESA ALVO: {target_company or 'Não especificada'}
DESTINATÁRIO: {recipient_name or 'Comitê de Seleção'}
TOM DE VOZ: {tone}
IDIOMA: {language}

DESCRIÇÃO DA VAGA / REQUISITOS:
{job_description or 'Vaga alinhada com as principais competências e histórico de liderança do candidato.'}
"""

    response = await active_client.aio.models.generate_content(
        model=MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=COVER_LETTER_GENERATION_PROMPT,
            temperature=0.4,
            max_output_tokens=3072,
            response_mime_type="application/json",
        ),
    )

    raw_text = (response.text or "").strip()
    try:
        data = json.loads(raw_text)
    except Exception:
        # Tenta extrair bloco JSON se vier com caracteres extras
        import re
        m = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
        else:
            raise ValueError("Resposta do modelo não pôde ser convertida em JSON válido.")

    tokens_used = 0
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        tokens_used = (response.usage_metadata.prompt_token_count or 0) + (response.usage_metadata.candidates_token_count or 0)

    return data, tokens_used


