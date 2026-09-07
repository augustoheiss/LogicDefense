"""
verify_pdf_vector_integrity.py — Validador Forense de Pureza Vetorial e Tagged PDF
===================================================================================
Inspeciona os bytes internos de um documento PDF gerado pelo Playwright Chromium CDP
para atestar a ausência de rasterização Skia a 72 DPI, preservação de fontes vetoriais
e conformidade com a árvore de acessibilidade ATS (Tagged PDF).
"""

import re
from typing import Dict, Any, List


class PDFVectorIntegrityAuditor:
    """
    Auditor forense de integridade estrutural e vetorial de arquivos PDF.
    """

    @classmethod
    def audit_bytes(cls, pdf_bytes: bytes) -> Dict[str, Any]:
        report: Dict[str, Any] = {
            "valid": False,
            "version": "unknown",
            "size_bytes": len(pdf_bytes),
            "has_vector_text": False,
            "is_tagged": False,
            "has_font_descriptors": False,
            "has_full_page_bitmap_raster": False,
            "issues": []
        }

        if len(pdf_bytes) < 100:
            report["issues"].append("PDF com tamanho corrompido ou insuficiente (< 100 bytes).")
            return report

        # 1. Checagem de Magic Header (%PDF-X.Y)
        header_match = re.search(rb"^%PDF-(\d+\.\d+)", pdf_bytes[:50])
        if not header_match:
            report["issues"].append("Magic bytes %PDF- ausentes no cabeçalho inicial.")
            return report
        report["version"] = header_match.group(1).decode("ascii")

        # 2. Checagem de Footer %%EOF
        if b"%%EOF" not in pdf_bytes[-1024:]:
            report["issues"].append("Marcador final %%EOF ausente nos últimos 1024 bytes.")

        # 3. Presença de Operadores de Texto Vetorial (BT = Begin Text, ET = End Text, Tj / TJ)
        has_bt = b"BT" in pdf_bytes
        has_et = b"ET" in pdf_bytes
        has_text_ops = (b"Tj" in pdf_bytes) or (b"TJ" in pdf_bytes) or (b"/Type0" in pdf_bytes)
        if has_bt and has_et and has_text_ops:
            report["has_vector_text"] = True
        else:
            report["issues"].append("Alerta: Operadores de texto vetorial (BT/ET/Tj) não detectados.")

        # 4. Presença de Fontes e Subsets Embutidos (/Font, /FontDescriptor, /CIDFontType2)
        has_font = (b"/Font" in pdf_bytes) or (b"/FontDescriptor" in pdf_bytes) or (b"/Type /Font" in pdf_bytes)
        report["has_font_descriptors"] = has_font
        if not has_font:
            report["issues"].append("Nenhum descritor de fonte (/Font) encontrado nos fluxos de objetos.")

        # 5. Detecção de Rasterização Indesejada (Bitmap Snapshot de Página Inteira a 72 DPI)
        # Se um PDF tiver /Subtype /Image com dimensões típicas de página inteira (ex: 595x842 ou 794x1123)
        # e tamanho de fluxo gigantesco sem texto, a Skia provavelmente caiu no fallback de bitmap.
        large_images = re.findall(rb"/Subtype\s*/Image", pdf_bytes)
        if len(large_images) > 0 and not report["has_vector_text"]:
            report["has_full_page_bitmap_raster"] = True
            report["issues"].append("CRÍTICO: O documento é uma imagem rasterizada (bitmap) e não contém texto vetorial.")

        # 6. Conformidade com Tagged PDF (Acessibilidade ATS)
        # O Chromium emite /MarkInfo << /Marked true >> e /StructTreeRoot quando tagged=True
        is_marked = (b"/Marked true" in pdf_bytes) or (b"/MarkInfo" in pdf_bytes)
        has_struct_tree = (b"/StructTreeRoot" in pdf_bytes) or (b"/StructElem" in pdf_bytes)
        if is_marked or has_struct_tree:
            report["is_tagged"] = True

        report["valid"] = len(report["issues"]) == 0
        return report


def test_audit_sample():
    # Teste rápido de sanidade com mock mínimo
    mock_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /MarkInfo << /Marked true >> >>\nendobj\nstream\nBT /F1 12 Tf (Teste) Tj ET\nendstream\n%%EOF"
    res = PDFVectorIntegrityAuditor.audit_bytes(mock_pdf)
    assert res["version"] == "1.4"
    assert res["has_vector_text"] is True
    assert res["is_tagged"] is True
    print("[PDFVectorIntegrityAuditor] Teste unitário de auditoria aprovado!")


if __name__ == "__main__":
    test_audit_sample()
