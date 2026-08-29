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

from prompts.cv_prompts import BASE_INSTRUCTION, BASE_INSTRUCTION_EN, PERSONA_INSTRUCTIONS, PERSONA_INSTRUCTIONS_EN

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
    index: int = 0,
) -> tuple[str, int]:
    """
    Generates ONE CV archetype as a clean YAML string with retry logic.
    Returns (yaml_string, total_tokens_used).
    """
    if not client:
        raise RuntimeError("GEMINI_API_KEY não configurada no servidor.")

    if index > 0:
        await asyncio.sleep(index * STAGGER_STEP)

    # Auto-detect language of raw input
    is_english = any(w in raw_text.lower() for w in ["software engineer", "intern", "experience", "education", "hybrid cloud"]) and ("desenvolvedor" not in raw_text.lower() and "experiência" not in raw_text.lower())

    if is_english:
        base_inst = BASE_INSTRUCTION_EN
        p_inst = PERSONA_INSTRUCTIONS_EN.get(archetype, persona_instruction)
        lang_directive = "IMPORTANT LANGUAGE RULE: Output 100% of all fields, labels, summaries and descriptions in fluent Professional English."
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

    log.info("[CV Engine] service='cv' archetype='%s' index=%d chars=%d", archetype, index, len(raw_text))

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
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.65,
                    max_output_tokens=MAX_TOKENS,
                    thinking_config=types.ThinkingConfig(thinking_budget=2048),
                ),
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


async def generate_all_archetypes(raw_text: str, job_description: str | None = None) -> tuple[Dict[str, str], int]:
    """
    Launches concurrent calls for all personas in parallel via asyncio.gather().
    Returns (dict_of_archetypes, total_tokens_used).
    """
    tasks = [
        generate_single_archetype(
            archetype=arch,
            persona_instruction=persona,
            raw_text=raw_text,
            job_description=job_description,
            index=i,
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

    return archetypes_map, total_tokens
