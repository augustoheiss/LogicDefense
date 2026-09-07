import asyncio
import io
import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from services.cv_pdf_service import PlaywrightPDFService

HTML_MULTI_PAGE_TEST = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Teste Paged Media e Quebras Limpas</title>
  <style>
    :root {
      --cv-color-primary: #0284c7;
      --cv-color-bg: #f8fafc;
      --cv-bg-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23f1f5f9'/%3E%3Ccircle cx='20' cy='20' r='5' fill='%230284c7' opacity='0.2'/%3E%3C/svg%3E");
    }

    @page {
      size: A4 portrait;
      margin-top: 15mm;
      margin-bottom: 12mm;
      margin-left: 0mm;
      margin-right: 0mm;
    }
    @page :first {
      margin-top: 0mm;
      margin-bottom: 0mm;
      margin-left: 0mm;
      margin-right: 0mm;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      background-color: var(--cv-color-bg);
      background-image: var(--cv-bg-image);
      font-family: sans-serif;
    }

    .cv-header {
      padding: 20mm 15mm 10mm 15mm;
      background: #0284c7;
      color: white;
    }

    .cv-section {
      padding: 0 15mm;
    }

    .cv-section-title {
      font-size: 16px;
      border-bottom: 2px solid #0284c7;
      margin-top: 15px;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    .cv-work-item, .cv-section-atomic {
      background: white;
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body>
  <div class="cv-header">
    <h1>Candidato de Teste</h1>
    <p>Engenheiro de Software & Sistemas Distribuídos</p>
  </div>

  <div class="cv-section">
    <div class="cv-section-title">Experiências Profissionais</div>
    <div class="cv-work-item" style="height: 120px;">
      <h3>Senior Software Engineer — BigTech A</h3>
      <p>Liderança de projetos de alta escala com processamento distribuído.</p>
    </div>
    <div class="cv-work-item" style="height: 120px;">
      <h3>Tech Lead — FinTech B</h3>
      <p>Desenvolvimento de gateways de pagamento e microsserviços stateless.</p>
    </div>
    <div class="cv-work-item" style="height: 120px;">
      <h3>Full Stack Architect — Startup C</h3>
      <p>Implementação de arquiteturas serverless e otimizações de banco de dados.</p>
    </div>
    <div class="cv-work-item" style="height: 120px;">
      <h3>Software Developer — Corp D</h3>
      <p>Construção de pipelines de dados e integrações com terceiros.</p>
    </div>
    <div class="cv-work-item" style="height: 120px;">
      <h3>Systems Engineer — Enterprise E</h3>
      <p>Infraestrutura como código, containers Docker e automações CI/CD.</p>
    </div>
    <div class="cv-work-item" style="height: 120px;">
      <h3>Backend Developer — Agency F</h3>
      <p>APIs RESTful de alta performance em Python e Node.js.</p>
    </div>

    <div class="cv-section-title">Idiomas & Certificações</div>
    <div class="cv-section-atomic" style="height: 100px;">
      <p><strong>Português:</strong> Nativo | <strong>Inglês:</strong> Fluente / C2 | <strong>Espanhol:</strong> Avançado</p>
    </div>
  </div>
</body>
</html>
"""

async def main():
    print("Iniciando teste de PDF com W3C Paged Media, Background SVG/Base64 e quebras limpas...")
    pdf_bytes = await PlaywrightPDFService.render_pdf_from_html(
        HTML_MULTI_PAGE_TEST,
        wait_for_fonts=False,
        page_format="A4"
    )
    print(f"Sucesso! PDF gerado com {len(pdf_bytes)} bytes.")
    assert len(pdf_bytes) > 2000, "PDF muito pequeno"
    assert pdf_bytes.startswith(b"%PDF-"), "Header PDF inválido"

    # Salva temporariamente para inspeção de páginas
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    num_pages = len(reader.pages)
    print(f"Número de páginas geradas no documento: {num_pages}")
    assert num_pages >= 2, f"Esperado ao menos 2 páginas pelo volume de itens, obtido: {num_pages}"
    print("[OK] Teste multi-paginas e fragmentacao aprovado com sucesso!")

    await PlaywrightPDFService.close()

if __name__ == "__main__":
    asyncio.run(main())
