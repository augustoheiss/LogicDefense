"""
formalizer.py — Módulo de Formalização de Texto via IA (Gemini)
Web-adapted version — uses asyncio.to_thread for non-blocking calls.

Transforma relatos informais em linguagem pedagógica técnica
usando a API Google Gemini (SDK google-genai).
"""

import asyncio
import logging
import os

from google import genai
from google.genai import types

log = logging.getLogger(__name__)


def _get_client(config: dict) -> tuple:
    """
    Inicializa e retorna o cliente Gemini e a config de geração.

    Returns:
        Tupla (client, model_name, generation_config).
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "Variavel de ambiente GEMINI_API_KEY nao encontrada."
        )

    client = genai.Client(api_key=api_key)

    gemini_cfg = config.get("gemini", {})
    model_name = gemini_cfg.get("model", "gemini-1.5-flash")

    system_instruction = gemini_cfg.get(
        "system_prompt",
        "Voce e um pedagogo escolar experiente. Reescreva o relato "
        "em linguagem tecnica pedagogica formal."
    )

    generation_config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=gemini_cfg.get("temperature", 0.3),
        max_output_tokens=gemini_cfg.get("max_output_tokens", 1024),
    )

    return client, model_name, generation_config


def _formalize_sync(
    informal_text: str,
    config: dict,
    context: str = "descricao da ocorrencia"
) -> str:
    """
    Synchronous formalization — called via asyncio.to_thread().

    Args:
        informal_text: O relato informal do usuário.
        config: Dicionário de configuração.
        context: Contexto do campo.

    Returns:
        Texto formalizado ou texto original em caso de falha.
    """
    if not informal_text or not informal_text.strip():
        return informal_text

    try:
        client, model_name, gen_config = _get_client(config)

        prompt = (
            f"Formalize o seguinte relato informal de {context} escolar.\n"
            f"Mantenha TODOS os fatos. Use linguagem tecnica pedagogica.\n"
            f"Retorne APENAS o texto formalizado, sem aspas, sem explicacoes.\n\n"
            f"Relato informal:\n\"{informal_text}\""
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=gen_config,
        )

        if response and response.text:
            formalized = response.text.strip()
            # Remove aspas que a IA às vezes adiciona
            if formalized.startswith('"') and formalized.endswith('"'):
                formalized = formalized[1:-1]
            return formalized
        else:
            log.warning("IA retornou resposta vazia. Usando texto original.")
            return informal_text

    except EnvironmentError:
        raise  # Re-raise para que o endpoint trate
    except Exception as e:
        log.error("Erro ao conectar com IA: %s", e)
        return informal_text


async def formalize_text(
    informal_text: str,
    config: dict,
    context: str = "descricao da ocorrencia"
) -> str:
    """Async wrapper — runs the synchronous Gemini call off the event loop."""
    return await asyncio.to_thread(
        _formalize_sync, informal_text, config, context
    )


async def formalize_description(informal: str, config: dict) -> str:
    """Formaliza a descrição da ocorrência."""
    return await formalize_text(
        informal, config, context="descricao da ocorrencia"
    )


async def formalize_measures(informal: str, config: dict) -> str:
    """Formaliza o texto de medidas/encaminhamentos adotados."""
    return await formalize_text(
        informal, config, context="medidas e encaminhamentos pedagogicos adotados"
    )


async def formalize_commitments(informal: str, config: dict) -> str:
    """Formaliza o texto de compromissos firmados."""
    return await formalize_text(
        informal, config, context="compromissos firmados entre escola, aluno e responsaveis"
    )
