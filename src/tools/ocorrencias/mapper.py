"""
mapper.py — Overlay Engine (Texto → PDF)
Gerador de Ocorrências Heiss-Lab

Carimba texto preenchido sobre um template PDF usando
PyMuPDF (leitura/merge) + ReportLab (geração de overlay).
"""

import io
import json
import os
import textwrap

import fitz  # PyMuPDF
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def load_template_map(path: str) -> dict:
    """
    Carrega o mapa de coordenadas do template.

    Args:
        path: Caminho para o template_map.json.

    Returns:
        Dicionário com as coordenadas dos campos.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"❌ Arquivo de mapa não encontrado: {path}\n"
            f"   Execute 'python auto_mapper.py' para gerar o mapa."
        )

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _wrap_text(text: str, max_width: float, font_name: str, font_size: float) -> list[str]:
    """
    Quebra texto em múltiplas linhas respeitando a largura máxima em pontos.

    Usa estimativa baseada na largura média de caracteres para a fonte.
    Para Helvetica, ~0.5 * font_size por caractere é uma boa aproximação.

    Args:
        text: Texto a ser quebrado.
        max_width: Largura máxima em pontos PDF.
        font_name: Nome da fonte.
        font_size: Tamanho da fonte em pontos.

    Returns:
        Lista de strings, cada uma representando uma linha.
    """
    if not text:
        return []

    # Estimativa de largura média por caractere
    avg_char_width = font_size * 0.52
    chars_per_line = int(max_width / avg_char_width) if avg_char_width > 0 else 80

    # Usa textwrap para quebra inteligente (respeita palavras)
    lines = []
    for paragraph in text.split("\n"):
        if paragraph.strip():
            wrapped = textwrap.wrap(paragraph, width=chars_per_line)
            lines.extend(wrapped)
        else:
            lines.append("")  # Preserva linhas em branco intencionais

    return lines


def _pymupdf_y_to_reportlab_y(y_pymupdf: float, page_height: float) -> float:
    """
    Converte coordenada Y do sistema PyMuPDF (topo=0) para ReportLab (base=0).

    Args:
        y_pymupdf: Coordenada Y no sistema PyMuPDF.
        page_height: Altura total da página em pontos.

    Returns:
        Coordenada Y no sistema ReportLab.
    """
    return page_height - y_pymupdf


def create_overlay(
    fields: dict,
    template_map: dict,
    config: dict
) -> bytes:
    """
    Gera um PDF de overlay transparente com o texto posicionado.

    Args:
        fields: Dicionário campo→valor (ex: {'nome_aluno': 'João Silva', ...}).
        template_map: Mapa de coordenadas do template.
        config: Configuração global.

    Returns:
        Bytes do PDF de overlay.
    """
    page_width = template_map.get("page_width", A4[0])
    page_height = template_map.get("page_height", A4[1])
    field_defs = template_map.get("fields", {})
    font_config = config.get("font", {})
    wrap_config = config.get("text_wrap", {})

    default_font = font_config.get("name", "Helvetica")
    default_size = font_config.get("size_normal", 10)
    color_rgb = font_config.get("color_rgb", [0, 0, 0])
    line_spacing = wrap_config.get("line_spacing_pt", 13)

    # Cria o PDF overlay em memória
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(page_width, page_height))

    # Define cor do texto (normalizada 0-1)
    r, g, b = [v / 255.0 if v > 1 else v for v in color_rgb]
    c.setFillColorRGB(r, g, b)

    for field_name, value in fields.items():
        if field_name not in field_defs:
            continue

        field_def = field_defs[field_name]
        x = field_def.get("x", 0)
        y_pymupdf = field_def.get("y", 0)
        font_size = field_def.get("font_size", default_size)
        field_type = field_def.get("type", "text")
        max_width = field_def.get("max_width", 400)
        max_lines = field_def.get("max_lines", 1)

        # Converte Y para sistema ReportLab
        y_rl = _pymupdf_y_to_reportlab_y(y_pymupdf, page_height)

        c.setFont(default_font, font_size)

        if field_type == "checkbox":
            # Carimba um 'X' maiúsculo na posição do checkbox
            if value:  # Apenas se marcado (True/truthy)
                c.setFont(default_font, font_size)
                c.drawString(x, y_rl - font_size, "X")

        elif field_type == "textarea":
            # Quebra o texto em linhas e carimba linha por linha
            lines = _wrap_text(value, max_width, default_font, font_size)
            lines = lines[:max_lines]  # Limita ao máximo de linhas

            for i, line in enumerate(lines):
                y_line = y_rl - font_size - (i * line_spacing)
                c.drawString(x, y_line, line)

        else:  # text (campo simples, uma linha)
            c.drawString(x, y_rl - font_size, str(value))

    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_pdf(
    template_path: str,
    fields: dict,
    template_map: dict,
    config: dict,
    output_path: str
) -> str:
    """
    Gera o PDF final mesclando o overlay sobre o template.

    Fluxo:
    1. Abre o template com PyMuPDF
    2. Gera overlay com ReportLab (texto posicionado)
    3. Mescla overlay sobre o template
    4. Salva o resultado

    Args:
        template_path: Caminho para o PDF template.
        fields: Dicionário campo→valor.
        template_map: Mapa de coordenadas.
        config: Configuração global.
        output_path: Caminho de saída para o PDF final.

    Returns:
        Caminho absoluto do arquivo gerado.
    """
    if not os.path.exists(template_path):
        raise FileNotFoundError(
            f"❌ Template não encontrado: {template_path}\n"
            f"   Coloque o PDF do formulário escolar neste caminho."
        )

    # 1. Gera o overlay PDF em memória
    overlay_bytes = create_overlay(fields, template_map, config)

    # 2. Abre ambos com PyMuPDF
    template_doc = fitz.open(template_path)
    overlay_doc = fitz.open(stream=overlay_bytes, filetype="pdf")

    # 3. Mescla overlay sobre cada página do template
    for page_num in range(len(template_doc)):
        template_page = template_doc[page_num]

        if page_num < len(overlay_doc):
            overlay_page = overlay_doc[page_num]
            # Renderiza a página do overlay como XObject e insere no template
            template_page.show_pdf_page(
                template_page.rect,  # Cobre a página inteira
                overlay_doc,
                page_num
            )

    # 4. Garante que o diretório de saída existe
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # 5. Salva o resultado
    template_doc.save(output_path)
    template_doc.close()
    overlay_doc.close()

    return os.path.abspath(output_path)
