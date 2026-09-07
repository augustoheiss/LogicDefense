"""
cv_pdf_service.py — Serviço Headless de Exportação Direta de PDF via Playwright Chromium
========================================================================================
Compila snapshots HTML autocontidos gerados pelo cliente em documentos PDF A4 vetoriais
de alta fidelidade utilizando o Chromium Headless com suporte a tagged PDF (acessibilidade ATS).
"""

import asyncio
import logging
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import Browser, Playwright  # type: ignore
else:
    Browser = object
    Playwright = object

try:
    from playwright.async_api import async_playwright  # type: ignore
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    async_playwright = None  # type: ignore
    PLAYWRIGHT_AVAILABLE = False

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
        if not PLAYWRIGHT_AVAILABLE or async_playwright is None:
            raise RuntimeError(
                "O pacote 'playwright' não está disponível no interpretador ativo. "
                "Execute no terminal: pip install playwright && playwright install chromium"
            )

        lock = cls._get_lock()
        async with lock:
            if cls._browser is None or not cls._browser.is_connected():
                if cls._playwright is None:
                    cls._playwright = await async_playwright().start()
                log.info("[PlaywrightPDF] Inicializando Chromium Headless...")
                launch_args = [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu"
                ]
                try:
                    cls._browser = await cls._playwright.chromium.launch(
                        headless=True,
                        args=launch_args
                    )
                except Exception as launch_err:
                    err_str = str(launch_err)
                    if "Executable doesn't exist" in err_str or "playwright install" in err_str:
                        log.warning("[PlaywrightPDF] Executável do Chromium ausente. Tentando auto-instalação resiliente com 'playwright install chromium'...")
                        import subprocess
                        import sys
                        install_res = await asyncio.to_thread(
                            subprocess.run,
                            [sys.executable, "-m", "playwright", "install", "chromium"],
                            capture_output=True,
                            text=True,
                            timeout=300
                        )
                        log.info(f"[PlaywrightPDF] Auto-instalação concluída (retorno={install_res.returncode}). Inicializando Chromium novamente...")
                        cls._browser = await cls._playwright.chromium.launch(
                            headless=True,
                            args=launch_args
                        )
                    else:
                        raise launch_err
                log.info("[PlaywrightPDF] Chromium Headless inicializado com sucesso.")
            return cls._browser

    @classmethod
    async def warmup(cls):
        """Pré-aquece o Chromium Headless em background para garantir disponibilidade imediata."""
        try:
            log.info("[PlaywrightPDF] Iniciando pré-aquecimento do Chromium Headless...")
            await cls.get_browser()
            log.info("[PlaywrightPDF] Chromium Headless pré-aquecido com sucesso.")
        except Exception as e:
            log.warning(f"[PlaywrightPDF] Aviso no pré-aquecimento do Chromium: {e}")

    @classmethod
    async def render_pdf_from_html(
        cls,
        html_content: str,
        wait_for_fonts: bool = True,
        timeout_ms: int = 20000,
        page_format: Optional[str] = None,
        page_width: Optional[str] = None,
        page_height: Optional[str] = None,
    ) -> bytes:
        """
        Renderiza um HTML completo em PDF vetorial com alta definição, geometria euclidiana
        e suporte a Tagged PDF (PDF/UA-1 para máxima acessibilidade e pontuação ATS).
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

            # 5. Parâmetros de geração nativa do PDF via CDP
            pdf_kwargs: dict = {
                "print_background": True,
                "prefer_css_page_size": True,
                "margin": {"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                "tagged": True  # Tagged PDF para máxima pontuação em parsers ATS / PDF/UA-1
            }

            if page_width and page_height:
                pdf_kwargs["width"] = page_width
                pdf_kwargs["height"] = page_height
            elif page_format and page_format.lower() in ("a4", "a3", "a5", "letter", "legal", "tabloid"):
                pdf_kwargs["format"] = page_format.upper()

            pdf_bytes = await page.pdf(**pdf_kwargs)

            # 6. Pós-processamento de conformidade com pikepdf (se disponível)
            try:
                import io
                import pikepdf  # type: ignore
                with pikepdf.open(io.BytesIO(pdf_bytes)) as pdf:
                    if "/MarkInfo" not in pdf.Root:
                        pdf.Root.MarkInfo = pikepdf.Dictionary(Marked=True)
                    else:
                        pdf.Root.MarkInfo.Marked = True
                    out_io = io.BytesIO()
                    pdf.save(out_io)
                    pdf_bytes = out_io.getvalue()
            except ImportError:
                pass
            except Exception as pike_err:
                log.warning(f"[PlaywrightPDF] pikepdf post-processing ignorado: {pike_err}")

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
