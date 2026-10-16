"""
formalizer.py — Módulo de Formalização Pedagógica via IA (Gemini + Fallback Institucional)
Gerador de Ocorrências 2.0 · Heiss-Lab

Transforma relatos informais em linguagem pedagógica técnica usando a API Google Gemini
(SDK google-genai), com fallback determinístico institucional caso GEMINI_API_KEY não
esteja configurada no ambiente.
"""

import os
import re
from typing import Tuple

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


_INSTITUTIONAL_REPLACEMENTS = [
    (r"\brecreio\b", "intervalo recreativo"),
    (r"\bbagunç(?:ou|ando|a)\b", "apresentou conduta incompatível com as normas de convivência escolar"),
    (r"\bxingou\b", "proferiu expressões verbais inadequadas direcionadas a"),
    (r"\bbrigou\b", "envolveu-se em conflito interpessoal"),
    (r"\bbateu\b", "desferiu agressão física"),
    (r"\bmexendo no celular\b", "utilizando dispositivo eletrônico móvel sem autorização pedagógica"),
    (r"\bcelular\b", "aparelho eletrônico portátil (celular) durante atividade letiva"),
    (r"\bnão quis fazer\b", "recusou-se a realizar as atividades pedagógicas propostas"),
    (r"\brespondeu mal\b", "manifestou postura desrespeitosa diante das orientações docentes"),
    (r"\bsaiu da sala\b", "ausentou-se do ambiente de sala de aula sem anuência prévia"),
    (r"\bmatou aula\b", "evadiu-se do período letivo regular"),
]


def formalize_offline_institutional(
    informal_text: str,
    context: str = "descricao da ocorrencia escolar",
    nome_aluno: str = "",
) -> str:
    """Reescrita institucional determinística para ambientes offline ou sem chave Gemini."""
    raw = (informal_text or "").strip()
    if not raw:
        return ""

    subject = f"o(a) estudante {nome_aluno.strip()}" if nome_aluno and nome_aluno.strip() else "o(a) estudante"
    transformed = raw
    for pattern, repl in _INSTITUTIONAL_REPLACEMENTS:
        transformed = re.sub(pattern, repl, transformed, flags=re.IGNORECASE)

    if transformed:
        transformed = transformed[0].lower() + transformed[1:]
    if not transformed.endswith((".", "!", "?")):
        transformed += "."

    if "compromisso" in context.lower() or "encaminhamento" in context.lower():
        return (
            f"Em atendimento pedagógico realizado pela equipe escolar, ficou estabelecido que {subject} "
            f"comprometer-se-á com o cumprimento integral das normas regimentais de convivência, "
            f"observando-se as seguintes tratativas: {transformed}"
        )

    return (
        f"Registra-se, para os devidos fins de acompanhamento pedagógico, que durante as atividades escolares "
        f"{subject} {transformed} A equipe docente realizou intervenção imediata visando à recomposição "
        f"do ambiente pedagógico e ao cumprimento do Regimento Escolar."
    )


def formalize_text_with_metadata(
    informal_text: str,
    config: dict,
    context: str = "descricao da ocorrencia escolar",
    nome_aluno: str = "",
) -> Tuple[str, str, str]:
    """
    Formaliza um relato informal em linguagem pedagógica técnica.

    Returns:
        Tupla (texto_formalizado, provider, notice)
        onde provider é 'gemini' ou 'local-institutional'.
    """
    if not informal_text or not informal_text.strip():
        return "", "local-institutional", ""

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if HAS_GENAI and api_key:
        try:
            client = genai.Client(api_key=api_key)
            gemini_cfg = config.get("gemini", {})
            model_name = gemini_cfg.get("model", "gemini-2.0-flash")
            system_instruction = gemini_cfg.get(
                "system_prompt",
                "Você é um pedagogo escolar experiente. Reescreva o relato em linguagem técnica pedagógica formal.",
            )

            gen_config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=gemini_cfg.get("temperature", 0.3),
                max_output_tokens=gemini_cfg.get("max_output_tokens", 1024),
            )

            student_ctx = f" Estudante: {nome_aluno.strip()}." if nome_aluno and nome_aluno.strip() else ""
            prompt = (
                f"Formalize o seguinte relato informal de {context}.{student_ctx}\n"
                f"Mantenha TODOS os fatos. Use linguagem técnica pedagógica formal.\n"
                f"Retorne APENAS o texto formalizado, sem aspas, sem explicações.\n\n"
                f'Relato informal:\n"{informal_text.strip()}"'
            )

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=gen_config,
            )

            if response and response.text:
                formalized = response.text.strip()
                if formalized.startswith('"') and formalized.endswith('"'):
                    formalized = formalized[1:-1].strip()
                return formalized, "gemini", ""
        except Exception as exc:
            fallback = formalize_offline_institutional(informal_text, context, nome_aluno)
            return (
                fallback,
                "local-institutional",
                f"Fallback institucional aplicado ({type(exc).__name__}).",
            )

    fallback = formalize_offline_institutional(informal_text, context, nome_aluno)
    return (
        fallback,
        "local-institutional",
        "Formalização institucional local aplicada (defina GEMINI_API_KEY para usar o modelo Gemini 2.0 Flash).",
    )
