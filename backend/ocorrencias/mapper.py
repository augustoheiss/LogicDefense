"""
mapper.py — In-Memory Overlay Engine (Texto → PDF)
Web-adapted version — zero disk writes.

Carimba texto preenchido sobre um template PDF usando PyMuPDF (fitz) em memória via BytesIO,
com suporte a:
- Modo de fundo configurável ('transparent' preserva linhas originais; 'whiteout' aplica tarja)
- Auto-Fit iterativo de fonte (evita desaparecimento silencioso quando insert_textbox < 0)
- Suporte completo a checkboxes e múltiplas páginas
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


def _is_truthy_checkbox(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("true", "1", "sim", "s", "yes", "x", "checked")


def _parse_sigv1_strokes(raw: str) -> list:
    if not raw or not isinstance(raw, str) or not raw.startswith("sigv1:"):
        return []
    body = raw[len("sigv1:") :].strip()
    if not body:
        return []
    strokes = []
    for raw_stroke in body.split("|"):
        pts = []
        for pair in raw_stroke.split(";"):
            parts = pair.split(",")
            if len(parts) >= 2:
                try:
                    nx = max(0.0, min(1.0, float(parts[0])))
                    ny = max(0.0, min(1.0, float(parts[1])))
                    pts.append((nx, ny))
                except ValueError:
                    pass
        if len(pts) >= 2:
            strokes.append(pts)
    return strokes


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
    template_doc = fitz.open(stream=template_bytes, filetype="pdf")

    font_config = config.get("font", {})
    color_rgb = font_config.get("color_rgb", [0, 0, 0])
    color = [v / 255.0 if v > 1 else v for v in color_rgb]
    default_size = font_config.get("size_normal", 10)
    field_defs = template_map.get("fields", {})
    continuation_sections = []

    for field_name, value in fields.items():
        if field_name not in field_defs:
            continue

        field_def = field_defs[field_name]
        target_page_index = int(field_def.get("page", 0) or 0)

        if target_page_index >= len(template_doc):
            target_page_index = len(template_doc) - 1
        if target_page_index < 0:
            target_page_index = 0

        template_page = template_doc[target_page_index]

        x = float(field_def.get("x", 0))
        y = float(field_def.get("y", 0))
        width = float(field_def.get("max_width", 200))
        font_size = float(field_def.get("font_size", default_size))
        field_type = field_def.get("type", "text")
        background_mode = field_def.get("background_mode", "transparent")

        max_lines = field_def.get("max_lines")
        default_height = (
            float(max_lines) * font_size * 1.45
            if max_lines
            else (font_size * 4.0 if field_type == "textarea" else font_size * 1.6)
        )
        height = float(field_def.get("height", default_height))

        if field_type == "checkbox":
            if not _is_truthy_checkbox(value):
                continue
            cb_w = max(width, 12.0)
            cb_h = max(height, 12.0)
            rect = fitz.Rect(x, y, x + cb_w, y + cb_h)
            if background_mode == "whiteout":
                template_page.draw_rect(rect, color=None, fill=(1, 1, 1), fill_opacity=0.88)
            rc = template_page.insert_textbox(
                rect,
                "X",
                fontsize=font_size,
                color=color,
                align=fitz.TEXT_ALIGN_CENTER,
            )
            if rc < 0:
                cx = x + max(0.0, (cb_w - font_size * 0.66) / 2.0)
                cy = y + (cb_h + font_size * 0.72) / 2.0
                template_page.insert_text(
                    fitz.Point(cx, cy),
                    "X",
                    fontsize=font_size,
                    color=color,
                )
            continue

        str_value = str(value if value is not None else "").strip()
        if not str_value:
            continue

        # Vector Handwritten Signature (`sigv1:...` or `field_type == "signature"`)
        if str_value.startswith("sigv1:") or field_type == "signature":
            strokes = _parse_sigv1_strokes(str_value)
            if strokes:
                pad = 1.7
                inner_w = max(6.0, width - pad * 2)
                inner_h = max(6.0, height - pad * 2)
                sig_color = (0.06, 0.16, 0.42)
                for stroke in strokes:
                    for idx in range(len(stroke) - 1):
                        nx0, ny0 = stroke[idx]
                        nx1, ny1 = stroke[idx + 1]
                        p0 = fitz.Point(x + pad + nx0 * inner_w, y + pad + ny0 * inner_h)
                        p1 = fitz.Point(x + pad + nx1 * inner_w, y + pad + ny1 * inner_h)
                        template_page.draw_line(p0, p1, color=sig_color, width=1.2)
                continue

        is_multiline = len(str_value) > 60 or "\n" in str_value
        is_known_paragraph = any(
            k in field_name.lower()
            for k in ["descri", "compromisso", "informac", "relato", "observac"]
        )
        is_textarea = field_type == "textarea"

        if is_multiline or is_known_paragraph or is_textarea:
            height = max(height, font_size * 2.2)
        else:
            height = max(height, font_size * 1.5)

        rect = fitz.Rect(x, y, x + width, y + height)

        # Only paint whiteout rectangle when explicitly requested (preserves form lines by default)
        if background_mode == "whiteout":
            template_page.draw_rect(rect, color=None, fill=(1, 1, 1), fill_opacity=0.88)

        if is_multiline or is_known_paragraph or is_textarea:
            # Auto-Fit loop: PyMuPDF's insert_textbox writes NOTHING and returns < 0 if text overflows.
            # We step down font_size until it fits inside rect (down to 6.5pt).
            cur_size = font_size
            rc = -1.0
            while cur_size >= 6.5:
                rc = template_page.insert_textbox(
                    rect,
                    str_value,
                    fontsize=cur_size,
                    color=color,
                    align=fitz.TEXT_ALIGN_LEFT,
                )
                if rc >= 0:
                    break
                cur_size -= 0.5

            if rc < 0:
                # Phase 2 (F2.1): Automatic Continuation Sheet (`Folha Complementar Anexa`)
                notice = "\n[... Continua na Folha Complementar Anexa (Pag. 2) ...]"
                words = str_value.split()
                low = 1
                high = len(words)
                best_k = 1
                while low <= high:
                    mid = (low + high) // 2
                    candidate = " ".join(words[:mid]) + notice
                    # Test on a temporary copy or measure
                    test_doc = fitz.open()
                    test_pg = test_doc.new_page(
                        width=template_page.rect.width, height=template_page.rect.height
                    )
                    test_rc = test_pg.insert_textbox(rect, candidate, fontsize=8.2)
                    test_doc.close()
                    if test_rc >= 0:
                        best_k = mid
                        low = mid + 1
                    else:
                        high = mid - 1

                head_text = " ".join(words[:best_k]) + notice
                tail_text = " ".join(words[best_k:])
                template_page.insert_textbox(
                    rect,
                    head_text,
                    fontsize=8.2,
                    color=color,
                    align=fitz.TEXT_ALIGN_LEFT,
                )
                if tail_text:
                    continuation_sections.append(
                        (field_def.get("label", field_name), tail_text)
                    )
        else:
            point = fitz.Point(x, y + font_size)
            template_page.insert_text(point, str_value, fontsize=font_size, color=color)

    if continuation_sections:
        first_pg = template_doc[0]
        pw, ph = first_pg.rect.width, first_pg.rect.height
        student = str(fields.get("nome_aluno", "Nao informado")).replace("\u2014", "-").replace("\u2013", "-")
        turma = str(fields.get("turma", "-")).replace("\u2014", "-").replace("\u2013", "-")
        data_s = str(fields.get("data", "-")).replace("\u2014", "-").replace("\u2013", "-")
        sha_s = str(template_map.get("sha256", "local-session"))[:20]
        resp = str(fields.get("responsavel_registro", "")).replace("\u2014", "-").replace("\u2013", "-")

        # Extract active vector signature strokes (if any) to stamp on each continuation sheet footer
        sig_raw = str(fields.get("assinatura_responsavel", "") or "")
        if not sig_raw.startswith("sigv1:"):
            for fv in fields.values():
                if isinstance(fv, str) and fv.startswith("sigv1:"):
                    sig_raw = fv
                    break
        sig_strokes = _parse_sigv1_strokes(sig_raw)

        combined_annex = "\n\n".join(
            f"Continuacao - {str(lbl).replace(chr(0x2014), '-').replace(chr(0x2013), '-')}:\n{str(txt).replace(chr(0x2014), '-').replace(chr(0x2013), '-')}"
            for lbl, txt in continuation_sections
        )

        remaining_words = combined_annex.split()
        annex_idx = 1

        while remaining_words:
            annex_pg = template_doc.new_page(width=pw, height=ph)
            hdr_rect = fitz.Rect(55, 42, pw - 55, 108)
            annex_pg.draw_rect(
                hdr_rect, color=(0.58, 0.64, 0.72), fill=(0.97, 0.98, 0.99), width=1.0
            )
            annex_pg.insert_text(
                fitz.Point(65, 62),
                f"ANEXO DE CONTINUACAO #{annex_idx} - REGISTRO DE OCORRENCIA ESCOLAR",
                fontsize=11,
                color=(0.06, 0.09, 0.16),
            )
            annex_pg.insert_text(
                fitz.Point(65, 80),
                f"Estudante: {student}   |   Turma: {turma}   |   Data: {data_s}",
                fontsize=9,
                color=(0.12, 0.16, 0.23),
            )
            annex_pg.insert_text(
                fitz.Point(65, 96),
                f"Vinculo Probatorio SHA-256: {sha_s}   |   Folha Complementar Integrante do Prontuario",
                fontsize=8,
                color=(0.28, 0.33, 0.41),
            )
            body_rect = fitz.Rect(55, 120, pw - 55, ph - 95)
            annex_pg.draw_rect(body_rect, color=(0.80, 0.84, 0.88), width=1.0)

            annex_text_rect = fitz.Rect(65, 132, pw - 65, ph - 105)
            candidate_full = " ".join(remaining_words)

            # First try fitting remaining text on this continuation page (9.0pt down to 8.0pt)
            fitted = False
            for try_fs in (9.0, 8.5, 8.0):
                rc_annex = annex_pg.insert_textbox(
                    annex_text_rect,
                    candidate_full,
                    fontsize=try_fs,
                    color=(0.06, 0.09, 0.16),
                )
                if rc_annex >= 0:
                    fitted = True
                    remaining_words = []
                    break

            if not fitted:
                # Binary search how many words fit on this continuation page at 8.5pt
                low_w = 1
                high_w = len(remaining_words)
                best_w = 1
                while low_w <= high_w:
                    mid_w = (low_w + high_w) // 2
                    slice_text = " ".join(remaining_words[:mid_w])
                    test_doc = fitz.open()
                    test_pg = test_doc.new_page(width=pw, height=ph)
                    test_rc = test_pg.insert_textbox(
                        annex_text_rect, slice_text, fontsize=8.5
                    )
                    test_doc.close()
                    if test_rc >= 0:
                        best_w = mid_w
                        low_w = mid_w + 1
                    else:
                        high_w = mid_w - 1

                page_chunk = " ".join(remaining_words[:best_w])
                annex_pg.insert_textbox(
                    annex_text_rect,
                    page_chunk,
                    fontsize=8.5,
                    color=(0.06, 0.09, 0.16),
                )
                remaining_words = remaining_words[best_w:]

            # Footer: Coordinator Name + Signature Line + Handwritten Vector Rubric
            annex_pg.insert_text(
                fitz.Point(55, ph - 65),
                f"Responsavel pelo Registro:  {resp}",
                fontsize=10,
                color=(0.06, 0.09, 0.16),
            )
            annex_pg.draw_line(
                fitz.Point(181.4, ph - 62),
                fitz.Point(521.6, ph - 62),
                color=(0.20, 0.25, 0.33),
                width=0.75,
            )
            if sig_strokes:
                sig_x = 345.8
                sig_y = ph - 93.0
                sig_w = 147.4
                sig_h = 34.0
                pad = 1.7
                inner_w = max(6.0, sig_w - pad * 2)
                inner_h = max(6.0, sig_h - pad * 2)
                sig_color = (0.06, 0.16, 0.42)
                for stroke in sig_strokes:
                    for idx in range(len(stroke) - 1):
                        nx0, ny0 = stroke[idx]
                        nx1, ny1 = stroke[idx + 1]
                        p0 = fitz.Point(sig_x + pad + nx0 * inner_w, sig_y + pad + ny0 * inner_h)
                        p1 = fitz.Point(sig_x + pad + nx1 * inner_w, sig_y + pad + ny1 * inner_h)
                        annex_pg.draw_line(p0, p1, color=sig_color, width=1.2)

            annex_idx += 1

    output_buffer = io.BytesIO()
    template_doc.save(output_buffer)
    template_doc.close()

    output_buffer.seek(0)
    return output_buffer.read()
