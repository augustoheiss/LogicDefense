"""
ocorrencias_router.py — Roteador do Gerador de Relatórios de Ocorrências (PDF Stamping + IA)
=============================================================================
Processamento 100% em memória, sem gravação de PII ou PDFs em disco.
"""

import io
import json
import logging
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from ocorrencias import mapper as oc_mapper
from ocorrencias import formalizer as oc_formalizer

log = logging.getLogger(__name__)

router = APIRouter(tags=["Ocorrências PDF Generator"])


class FormalizarRequest(BaseModel):
    texto: str
    contexto: str = "descricao da ocorrencia escolar"
    nome_aluno: str = ""


@router.post("/api/ocorrencias/formalizar")
async def formalizar_relato(payload: FormalizarRequest):
    """
    Reescreve um relato informal de ocorrência ou compromissos firmados
    em linguagem técnica pedagógica formal (Gemini 2.0 Flash com fallback institucional).
    """
    if not payload.texto or not payload.texto.strip():
        raise HTTPException(status_code=422, detail="Texto para formalização não pode ser vazio.")

    oc_config = oc_mapper.load_config()
    formalized, provider, notice = oc_formalizer.formalize_text_with_metadata(
        informal_text=payload.texto,
        config=oc_config,
        context=payload.contexto,
        nome_aluno=payload.nome_aluno,
    )

    return {
        "texto_original": payload.texto,
        "texto_formalizado": formalized,
        "provider": provider,
        "notice": notice,
    }


@router.post("/api/ocorrencias/gerar")
async def gerar_ocorrencia(request: Request):
    """
    Generates a stamped incident report PDF — ZERO disk writes.

    Flow:
    1. Extracts dynamic form payload containing arbitrary user-mapped fields
    2. Reads the uploaded template PDF into memory
    3. Stamps text onto the correct pages using the dynamic JSON map
    4. Streams the result back as application/pdf
    """
    form_data = await request.form()

    template_pdf = form_data.get("template_pdf")
    if template_pdf is None or not hasattr(template_pdf, "read"):
        raise HTTPException(status_code=422, detail="PDF template não enviado ou inválido.")

    checkbox_orientacao = str(
        form_data.get(
            "checkbox_orientacao_aluno",
            form_data.get("checkbox_orientacao", "false"),
        )
    ).lower() in ("true", "1", "sim", "x")
    checkbox_convocar = str(
        form_data.get(
            "checkbox_convocar_responsavel",
            form_data.get("checkbox_convocar", "false"),
        )
    ).lower() in ("true", "1", "sim", "x")

    template_map_json = str(form_data.get("template_map_json", ""))

    log.info("Received ocorrencia request")

    # 1. Read template bytes into memory (NEVER saved to disk)
    template_bytes = await template_pdf.read()
    if not template_bytes:
        raise HTTPException(status_code=422, detail="Arquivo PDF vazio ou inválido.")

    if not template_bytes[:5] == b"%PDF-":
        raise HTTPException(status_code=422, detail="O arquivo enviado não é um PDF válido.")

    # 2. Load config and template map
    oc_config = oc_mapper.load_config()
    if template_map_json:
        template_map = json.loads(template_map_json)
    else:
        template_map = oc_mapper.load_template_map()

    # 3. Build the dynamic fields dict
    fields = {}
    for key, value in form_data.items():
        if isinstance(value, str) and key not in ["template_map_json"]:
            if key.startswith("checkbox_"):
                fields[key] = value.lower() in ("true", "1", "sim", "x")
            else:
                fields[key] = value

    # Normalize canonical checkbox fields to booleans
    fields["checkbox_orientacao_aluno"] = checkbox_orientacao
    fields["checkbox_convocar_responsavel"] = checkbox_convocar

    log.info(
        "Form Keys: %s | Map Keys: %s",
        list(fields.keys()),
        list(template_map.get("fields", {}).keys()),
    )

    # 4. Generate stamped PDF in memory
    try:
        pdf_bytes = oc_mapper.generate_pdf_buffer(
            template_bytes=template_bytes,
            fields=fields,
            template_map=template_map,
            config=oc_config,
        )
    except Exception as exc:
        log.exception("PDF generation failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar PDF: {exc}",
        ) from exc

    log.info(
        "Ocorrência generated successfully in-memory: %d bytes (zero-PII log)",
        len(pdf_bytes),
    )

    headers = {"Content-Disposition": 'attachment; filename="ocorrencia_gerada.pdf"'}
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers,
    )
