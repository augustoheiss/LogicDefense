"""
formalizer.py — Módulo de Formalização de Texto via IA (Gemini)
Gerador de Ocorrências Heiss-Lab

Transforma relatos informais em linguagem pedagógica técnica
usando a API Google Gemini (SDK google-genai).
"""

import os

from google import genai
from google.genai import types


def _get_client(config: dict) -> tuple:
    """
    Inicializa e retorna o cliente Gemini e a config de geração.

    Returns:
        Tupla (client, model_name, generation_config).
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "Variavel de ambiente GEMINI_API_KEY nao encontrada.\n"
            "   Defina com: set GEMINI_API_KEY=sua_chave_aqui (Windows)\n"
            "   ou: export GEMINI_API_KEY=sua_chave_aqui (Linux/Mac)"
        )

    client = genai.Client(api_key=api_key)

    gemini_cfg = config.get("gemini", {})
    model_name = gemini_cfg.get("model", "gemini-2.0-flash")

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


def formalize_text(
    informal_text: str,
    config: dict,
    context: str = "descricao da ocorrencia"
) -> str:
    """
    Formaliza um texto informal em linguagem pedagógica técnica.

    Args:
        informal_text: O relato informal do usuário.
        config: Dicionário de configuração carregado do config.json.
        context: Contexto do campo (ex: 'descricao da ocorrencia').

    Returns:
        Texto formalizado ou texto original com aviso em caso de falha.
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
            print("  IA retornou resposta vazia. Usando texto original.")
            return informal_text

    except EnvironmentError:
        raise  # Re-raise para que o main.py trate
    except Exception as e:
        print(f"  Erro ao conectar com IA: {e}")
        print("   Usando texto original sem formalizacao.")
        return informal_text


def formalize_measures(informal_measures: str, config: dict) -> str:
    """
    Formaliza o texto de medidas/encaminhamentos adotados.

    Args:
        informal_measures: Texto informal das medidas.
        config: Dicionário de configuração.

    Returns:
        Texto formalizado das medidas.
    """
    return formalize_text(
        informal_measures,
        config,
        context="medidas e encaminhamentos pedagogicos adotados"
    )


def formalize_commitments(informal_commitments: str, config: dict) -> str:
    """
    Formaliza o texto de compromissos firmados.

    Args:
        informal_commitments: Texto informal dos compromissos.
        config: Dicionário de configuração.

    Returns:
        Texto formalizado dos compromissos.
    """
    return formalize_text(
        informal_commitments,
        config,
        context="compromissos firmados entre escola, aluno e responsaveis"
    )
