"""
cv_pdf_service.py — Serviço Headless de Exportação Direta de PDF via Playwright Chromium
========================================================================================
Compila snapshots HTML autocontidos gerados pelo cliente em documentos PDF A4 vetoriais
de alta fidelidade utilizando o Chromium Headless com suporte a tagged PDF (acessibilidade ATS).
"""

import asyncio
import logging
from typing import Optional
from playwright.async_api import async_playwright, Browser, Playwright

log = logging.getLogger("cv-maker-pdf-service")


class PlaywrightPDFService:
    """
    Gerenciador singleton de Chromium Headless para geração vetorial determinística de PDFs.
    """
    _playwright: Optional[Playwright] = None
    _browser: Optional[Browser] = None
    _lock: Optional[asyncio.Lock] = None

    @classmethod
    def _get_lock(cls) -> asyncio.Lock:
        if cls._lock is None:
            cls._lock = asyncio.Lock()
        return cls._lock

    @classmethod
    async def get_browser(cls) -> Browser:
        lock = cls._get_lock()
        async with lock:
            if cls._browser is None or not cls._browser.is_connected():
                if cls._playwright is None:
                    cls._playwright = await async_playwright().start()
                log.info("[PlaywrightPDF] Inicializando Chromium Headless...")
                cls._browser = await cls._playwright.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--no-first-run",
                        "--no-zygote",
                        "--disable-gpu"
                    ]
                )
                log.info("[PlaywrightPDF] Chromium Headless inicializado com sucesso.")
            return cls._browser

    @classmethod
    async def render_pdf_from_html(
        cls,
        html_content: str,
        wait_for_fonts: bool = True,
        timeout_ms: int = 20000
    ) -> bytes:
        """
        Renderiza um HTML completo em PDF A4 vetorial com alta definição e suporte a ATS.
        """
        browser = await cls.get_browser()
        context = await browser.new_context(
            viewport={"width": 1240, "height": 1754},
            device_scale_factor=2
        )
        page = await context.new_page()
        try:
            # 1. Configurar emulação de mídia de impressão (@media print)
            await page.emulate_media(media="print")

            # 2. Carregar o HTML autocontido
            await page.set_content(
                html_content,
                wait_until="load",
                timeout=timeout_ms
            )

            # 3. Aguardar fontes nativas e da web
            if wait_for_fonts:
                try:
                    await page.evaluate("() => document.fonts ? document.fonts.ready : Promise.resolve()")
                except Exception as font_err:
                    log.warning(f"[PlaywrightPDF] Aviso ao aguardar fonts.ready: {font_err}")

            # 4. Pequeno delay para acomodação de micro-layouts e CSS flex/grid
            await asyncio.sleep(0.1)

            # 5. Disparar geração nativa do PDF via CDP
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                tagged=True  # Tagged PDF para máxima pontuação em parsers ATS
            )
            log.info(f"[PlaywrightPDF] PDF gerado com sucesso: {len(pdf_bytes)} bytes.")
            return pdf_bytes
        except Exception as e:
            log.error(f"[PlaywrightPDF] Erro ao renderizar PDF: {e}", exc_info=True)
            raise e
        finally:
            try:
                await page.close()
                await context.close()
            except Exception:
                pass

    @classmethod
    async def close(cls):
        """Finaliza os processos do Chromium e Playwright."""
        lock = cls._get_lock()
        async with lock:
            if cls._browser:
                log.info("[PlaywrightPDF] Encerrando Chromium...")
                await cls._browser.close()
                cls._browser = None
            if cls._playwright:
                log.info("[PlaywrightPDF] Parando Playwright...")
                await cls._playwright.stop()
                cls._playwright = None
