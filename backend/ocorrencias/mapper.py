"""
mapper.py — In-Memory Overlay Engine (Texto → PDF)
Web-adapted version — zero disk writes.

Carimba texto preenchido sobre um template PDF usando
PyMuPDF (leitura/merge) + ReportLab (geração de overlay).
Tudo em memória via BytesIO.
"""

import io
import json
import os

import fitz  # PyMuPDF


# ── Paths resolved relative to this file ─────────────────────────────────────
_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG_PATH = os.path.join(_DIR, "config.json")
DEFAULT_MAP_PATH = os.path.join(_DIR, "template_map.json")


def load_config() -> dict:
    """Load the default config.json shipped with this package."""
    with open(DEFAULT_CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_template_map() -> dict:
    """Load the default template_map.json shipped with this package."""
    with open(DEFAULT_MAP_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# Removed ReportLab overlay logic as we now use PyMuPDF directly.


def generate_pdf_buffer(
    template_bytes: bytes,
    fields: dict,
    template_map: dict,
    config: dict,
) -> bytes:
    """
    Gera o PDF final mesclando o overlay sobre o template — TUDO EM MEMÓRIA.

    Args:
        template_bytes: Bytes do PDF template (uploaded pelo usuário).
        fields: Dicionário campo→valor.
        template_map: Mapa de coordenadas.
        config: Configuração global.

    Returns:
        Bytes do PDF final pronto para download.
    """
    # 1. Abre o template com PyMuPDF a partir de buffers
    template_doc = fitz.open(stream=template_bytes, filetype="pdf")
    
    font_config = config.get("font", {})
    color_rgb = font_config.get("color_rgb", [0, 0, 0])
    color = [v / 255.0 if v > 1 else v for v in color_rgb]
    default_size = font_config.get("size_normal", 12)
    field_defs = template_map.get("fields", {})

    # 2. Escreve diretamente em cada página usando a matemática exata do bounding box
    for page_num in range(len(template_doc)):
        template_page = template_doc[page_num]

        for field_name, value in fields.items():
            if field_name not in field_defs:
                continue

            # Failsafe for empty values
            str_value = str(value).strip()
            if not str_value:
                import logging
                logger = logging.getLogger("uvicorn.error")
                logger.warning(f"Missing text payload for mapped key: {field_name}")

            field_def = field_defs[field_name]
            x = field_def.get("x", 0)
            y = field_def.get("y", 0)
            width = field_def.get("max_width", 200)
            height = field_def.get("height", 30) # Default if older map
            font_size = field_def.get("font_size", default_size)
            field_type = field_def.get("type", "text")

            # Smart Multi-line Detection
            str_value = str(value)
            is_multiline = len(str_value) > 60 or '\n' in str_value
            is_known_paragraph = any(k in field_name.lower() for k in ['descri', 'compromisso'])
            is_textarea = field_type == "textarea"

            # Failsafe: Ensure height is large enough to not clip text
            if is_multiline or is_known_paragraph or is_textarea:
                if height < font_size * 2:
                    height = max(height, font_size * 2)
            else:
                if height < font_size * 1.5:
                    height = font_size * 1.5

            # Create the exact bounding box drawn on the frontend
            rect = fitz.Rect(x, y, x + width, y + height)

            # Debug: Draw a red bounding box to visually verify coordinate math
            template_page.draw_rect(rect, color=(1, 0, 0), width=1)

            if field_type == "checkbox":
                if value:
                    # Draw a checkmark or X within the box
                    template_page.insert_textbox(rect, "X", fontsize=font_size, color=color, align=fitz.TEXT_ALIGN_CENTER)
            elif is_multiline or is_known_paragraph or is_textarea:
                # Multi-line fields use insert_textbox which handles auto-wrapping
                template_page.insert_textbox(rect, str_value, fontsize=font_size, color=color, align=fitz.TEXT_ALIGN_LEFT)
            else:
                # Single-line fields use insert_text to bypass strict height constraints.
                # The point (x, y) for insert_text is the bottom-left baseline.
                point = fitz.Point(x, y + font_size)
                template_page.insert_text(point, str_value, fontsize=font_size, color=color)

    # 3. Serializa o resultado para bytes (ZERO disk writes)
    output_buffer = io.BytesIO()
    template_doc.save(output_buffer)
    template_doc.close()

    output_buffer.seek(0)
    return output_buffer.read()
