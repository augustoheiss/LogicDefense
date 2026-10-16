"""Comprehensive test for the upgraded Ocorrências 2.0 package and router."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fitz
from ocorrencias import mapper, formalizer
from routers.ocorrencias_router import router

print("OK: imports work")

cfg = mapper.load_config()
tmap = mapper.load_template_map()

print(f"Config keys: {list(cfg.keys())}")
print(f"Template map fields: {list(tmap['fields'].keys())}")
routes = [r.path for r in router.routes]
print(f"Router routes: {routes}")
assert "/api/ocorrencias/gerar" in routes
assert "/api/ocorrencias/formalizar" in routes

# Test AI / Institutional Formalizer
formal_text, provider, notice = formalizer.formalize_text_with_metadata(
    "No recreio o aluno ficou bagunçando e mexendo no celular sem autorização",
    cfg,
    context="descricao da ocorrencia escolar",
    nome_aluno="Participante A",
)
assert len(formal_text) > 30
print(f"OK: Formalizer ({provider}) -> {formal_text[:80]}...")

# Create an in-memory blank A4 PDF and test generate_pdf_buffer with Auto-Fit & Checkboxes
blank_doc = fitz.open()
blank_doc.new_page(width=595.28, height=841.89)
template_bytes = blank_doc.tobytes()
blank_doc.close()

long_relato = " ".join([formal_text] * 8)
stamped_bytes = mapper.generate_pdf_buffer(
    template_bytes=template_bytes,
    fields={
        "nome_aluno": "Participante A",
        "turma": "Turma A-01",
        "data": "15/01/2026",
        "telefone": "(00) 00000-0001",
        "descricao_ocorrencia": long_relato,
        "checkbox_orientacao_aluno": True,
        "checkbox_convocar_responsavel": True,
        "compromissos_firmados": "Participante comprometeu-se a seguir o regimento.",
        "responsavel_registro": "Operador 01",
    },
    template_map=tmap,
    config=cfg,
)

result_doc = fitz.open(stream=stamped_bytes, filetype="pdf")
extracted = result_doc[0].get_text()
result_doc.close()

assert "Participante A" in extracted
assert "Turma A-01" in extracted
assert "Operador 01" in extracted
assert "X" in extracted
assert "acompanhamento pedagógico" in extracted or "intervalo recreativo" in extracted
print("OK: Stamped PDF verified with long auto-fitted relato & checkboxes!")

# Test Multi-Page Continuation Sheet + Vector Signature on Annex (Sprint R2 BUG-13)
massive_relato = (
    "Relato pedagógico detalhado para verificação de múltiplas folhas complementares anexas sem corte de palavras. "
    * 115
) + "SENTINELA_MASSIVA_SERVIDOR_777"
tmap_with_sig = dict(tmap)
tmap_with_sig["fields"] = dict(tmap["fields"])
tmap_with_sig["fields"]["assinatura_responsavel"] = {
    "x": 345.8,
    "y": 687.4,
    "max_width": 147.4,
    "height": 34.0,
    "font_size": 10,
    "type": "signature",
    "label": "Assinatura / Rubrica Vetorial",
    "page": 0,
}

massive_bytes = mapper.generate_pdf_buffer(
    template_bytes=template_bytes,
    fields={
        "nome_aluno": "Participante A",
        "turma": "Turma A-01",
        "data": "15/01/2026",
        "telefone": "(00) 00000-0001",
        "descricao_ocorrencia": massive_relato,
        "checkbox_orientacao_aluno": True,
        "checkbox_convocar_responsavel": True,
        "compromissos_firmados": "Compromisso integral firmado.",
        "responsavel_registro": "Operador 01",
        "assinatura_responsavel": "sigv1:0.1,0.5;0.5,0.2;0.9,0.6|0.2,0.8;0.8,0.8",
    },
    template_map=tmap_with_sig,
    config=cfg,
)

massive_doc = fitz.open(stream=massive_bytes, filetype="pdf")
assert len(massive_doc) >= 3, f"Expected >= 3 pages for massive annex, got {len(massive_doc)}"
all_pages_text = "\n".join(pg.get_text() for pg in massive_doc)
p2_text = massive_doc[1].get_text()
p2_drawings = len(massive_doc[1].get_drawings())
massive_doc.close()

assert "SENTINELA_MASSIVA_SERVIDOR_777" in all_pages_text, "Sentinel word missing from multi-page server annex!"
assert "Continuacao ?" not in p2_text, f"Found broken glyph 'Continuacao ?' in server Page 2: {p2_text}"
assert p2_drawings >= 5, f"Expected vector signature drawings in server Page 2 footer, got {p2_drawings}"
print(f"OK: Multi-page continuation sheet ({len(all_pages_text)} chars) & vector signature ({p2_drawings} drawings) verified!")
print("ALL TESTS PASSED")
