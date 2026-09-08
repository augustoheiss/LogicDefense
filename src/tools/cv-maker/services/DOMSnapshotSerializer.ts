/**
 * DOMSnapshotSerializer.ts
 *
 * Serializador profundo do DOM vivo do React para documentos A4 e impressão de alta fidelidade.
 * Converte o nó renderizado na tela em um documento HTML autônomo e autocontido,
 * com CSS embutido, imagens convertidas em Base64 Data URI, higienização anti-XSS
 * e diretrizes da Skia anti-rasterização (eliminando bitmaps a 72 DPI).
 */

export interface SnapshotOptions {
  stripInteractive?: boolean
  inlineAssets?: boolean
  allowedOrigins?: string[]
  extraStyles?: string
  targetOrientation?: 'portrait' | 'landscape'
  pageWidthMm?: number
  pageHeightMm?: number
  cssPageSize?: string
  backgroundPattern?: string
  colorBg?: string
}

export class DOMSnapshotSerializer {
  public static async serialize(
    sourceElement: HTMLElement,
    options: SnapshotOptions = {}
  ): Promise<string> {
    // 1. Garantir que fontes estejam carregadas
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready
        const checkFamilies = ['Inter', 'Plus Jakarta Sans', 'Merriweather', 'Fira Code', 'Outfit', 'Poppins']
        for (const fam of checkFamilies) {
          document.fonts.check(`12px "${fam}"`)
        }
      } catch (e) {
        console.warn('[DOMSnapshotSerializer] Aviso ao aguardar fonts.ready:', e)
      }
    }

    // 2. Clone profundo do nó DOM vivo do React
    const clone = sourceElement.cloneNode(true) as HTMLElement

    // 3. Higienização de segurança: remover scripts executáveis, iframes e atributos inline on*
    const dangerousTags = clone.querySelectorAll('script, iframe, object, embed')
    dangerousTags.forEach((el) => el.remove())

    const allElements = clone.querySelectorAll('*')
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name)
        }
      })
    })

    // 4. Capturar e embutir CSS Custom Properties calculadas do elemento raiz
    const rootStyle = typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement) : null
    const computedStyle = window.getComputedStyle(sourceElement)
    const customProps = [
      '--cv-font-scale',
      '--cv-gap-scale',
      '--cv-padding-scale',
      '--cv-line-height',
      '--cv-primary-color',
      '--cv-bg-color',
      '--cv-sidebar-width',
      '--cv-page-width',
      '--cv-page-height',
      '--cv-page-width-px',
      '--cv-page-height-px',
      '--cv-page-width-pt',
      '--cv-page-height-pt',
      '--cv-page-ratio',
      '--cv-page-size',
      '--cv-page-epsilon-buffer',
      '--cv-color-primary',
      '--cv-color-secondary',
      '--cv-color-text',
      '--cv-color-text-muted',
      '--cv-color-bg',
      '--cv-color-surface',
      '--cv-color-border',
      '--cv-color-accent',
      '--cv-color-sidebar',
      '--cv-color-workspace-bg',
    ]

    let rootVariablesCss = ':root {\n'
    for (const prop of customProps) {
      const val = computedStyle.getPropertyValue(prop).trim() || (rootStyle ? rootStyle.getPropertyValue(prop).trim() : '')
      if (val) {
        rootVariablesCss += `  ${prop}: ${val};\n`
      }
    }

    // 4.1. Inspecionar e embutir Texturas de Fundo (--cv-bg-image) em Base64 Data URI
    const cvRootEl = (sourceElement.querySelector('.cv-root') || clone.querySelector('.cv-root')) as HTMLElement | null
    let rawBgImage = (
      (options.backgroundPattern ? options.backgroundPattern.trim() : '') ||
      (typeof document !== 'undefined' ? document.documentElement.style.getPropertyValue('--cv-bg-image').trim() : '') ||
      (cvRootEl ? cvRootEl.style.getPropertyValue('--cv-bg-image').trim() : '') ||
      (typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement).getPropertyValue('--cv-bg-image').trim() : '') ||
      (computedStyle ? computedStyle.getPropertyValue('--cv-bg-image').trim() : '') ||
      (rootStyle ? rootStyle.getPropertyValue('--cv-bg-image').trim() : '')
    )

    const effectiveColorBg = (
      (options.colorBg ? options.colorBg.trim() : '') ||
      (typeof document !== 'undefined' ? document.documentElement.style.getPropertyValue('--cv-color-bg').trim() : '') ||
      (cvRootEl ? cvRootEl.style.getPropertyValue('--cv-color-bg').trim() : '') ||
      (computedStyle ? computedStyle.getPropertyValue('--cv-color-bg').trim() : '') ||
      '#ffffff'
    )

    let inlinedBgImage = 'none'

    if (rawBgImage && rawBgImage !== 'none' && rawBgImage !== 'undefined') {
      let bgUrl = rawBgImage
      const match = rawBgImage.match(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/i)
      if (match && match[1]) {
        bgUrl = match[1].trim()
      } else {
        bgUrl = rawBgImage.trim().replace(/^["']|["']$/g, '')
      }

      if (bgUrl && bgUrl !== 'none') {
        if (bgUrl.startsWith('data:')) {
          inlinedBgImage = `url("${bgUrl}")`
        } else if (options.inlineAssets !== false) {
          try {
            const absoluteUrl = bgUrl.startsWith('/') && typeof window !== 'undefined'
              ? `${window.location.origin}${bgUrl}`
              : bgUrl
            const base64Bg = await this.urlToBase64(absoluteUrl)
            inlinedBgImage = `url("${base64Bg}")`
          } catch (err) {
            console.warn('[DOMSnapshotSerializer] Não foi possível embutir background em Base64:', err)
            const fallbackUrl = bgUrl.startsWith('/') && typeof window !== 'undefined'
              ? `${window.location.origin}${bgUrl}`
              : bgUrl
            inlinedBgImage = `url("${fallbackUrl}")`
          }
        } else {
          inlinedBgImage = `url("${bgUrl}")`
        }
      }
    }
    rootVariablesCss += `  --cv-bg-image: ${inlinedBgImage};\n`
    rootVariablesCss += `  --cv-color-bg: ${effectiveColorBg};\n`
    rootVariablesCss += '}\n'

    const pageWidthCss = (rootStyle && rootStyle.getPropertyValue('--cv-page-width').trim()) || (options.pageWidthMm ? `${options.pageWidthMm}mm` : '210mm')
    const pageHeightCss = (rootStyle && rootStyle.getPropertyValue('--cv-page-height').trim()) || (options.pageHeightMm ? `${options.pageHeightMm}mm` : '297mm')
    const pageSizeRule = options.cssPageSize || (rootStyle && rootStyle.getPropertyValue('--cv-page-size').trim()) || `${pageWidthCss} ${pageHeightCss}`

    // 5. Remover artefatos interativos do editor e cabeçalhos textuais redundantes de continuação
    if (options.stripInteractive !== false) {
      const interactiveElements = clone.querySelectorAll(
        '[data-cv-interactive="true"], button, .cv-no-print, .no-print, .cv-continuation-header'
      )
      interactiveElements.forEach((el) => el.remove())
    } else {
      // Sempre remove o cabeçalho textual de continuação conforme solicitação expressa de design limpo
      clone.querySelectorAll('.cv-continuation-header').forEach((el) => el.remove())
    }

    // 5.1. Camada de fundo soberana é tratada diretamente via html, body (repeat-y euclidiano)
    clone.querySelectorAll('.cv-print-page-background').forEach((el) => el.remove())

    if (cvRootEl) {
      cvRootEl.style.setProperty('--cv-bg-image', inlinedBgImage)
      cvRootEl.style.setProperty('--cv-color-bg', effectiveColorBg)
    }

    // 6. Converter imagens externas para Base64 Data URI com validação de protocolo
    if (options.inlineAssets !== false) {
      const images = clone.querySelectorAll('img')
      for (const img of Array.from(images)) {
        if (img.src && !img.src.startsWith('data:')) {
          try {
            this.validateAssetUrl(img.src, options.allowedOrigins)
            img.src = await this.urlToBase64(img.src)
          } catch (e) {
            console.warn(`[DOMSnapshotSerializer] Ativo ignorado por segurança ou falha de rede: ${img.src}`, e)
          }
        }
      }
    }

    // 7. Agregar folhas de estilo locais em CSS unificado embutido
    let aggregatedCss = rootVariablesCss
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          for (const rule of Array.from(sheet.cssRules)) {
            aggregatedCss += rule.cssText + '\n'
          }
        }
      } catch {
        // Ignora folhas de estilo com restrição cross-origin do navegador
      }
    }

    // 8. Injetar blindagem vetorial Skia contra rasterização em 72 DPI e geometria euclidiana
    const skiaVectorOverrides = `
      @media print, all {
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Skia Anti-Rasterization: Elimina o fallback do SkPDFDevice para bitmap de 72 DPI */
        *, *::before, *::after {
          filter: none !important;
          backdrop-filter: none !important;
          text-shadow: none !important;
        }
        .cv-card, .cv-shadow, .cv-box-shadow {
          box-shadow: 0 1pt 0 rgba(0, 0, 0, 0.08) !important; /* Zero-blur vetorial */
        }
        /* Paged Media: Impressão A4/Letter com margens zeradas para controle total via W3C Table-Flow */
        @page {
          size: ${pageSizeRule};
          margin: 0;
        }
        table.cv-print-flow-table {
          display: table !important;
          width: 100% !important;
          border-collapse: collapse !important;
          border-spacing: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
        }
        thead.cv-print-flow-spacer {
          display: table-header-group !important;
        }
        thead.cv-print-flow-spacer td {
          height: 14mm !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
          background-color: transparent !important;
        }
        td.cv-print-flow-body-cell {
          display: table-cell !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          width: 100% !important;
          background: transparent !important;
        }
        /* Offset de topo da Página 1: compensa os 14mm de thead na folha inicial */
        .cv-page-content {
          margin-top: -11mm !important;
        }
        .cv-card > header,
        .cv-card > div.cv-brand-header,
        .cv-card > div.cv-sidebar-layout,
        .cv-sidebar-layout,
        .cv-header,
        .cv-brand-header,
        .cv-math-header,
        .cv-hero-header,
        .cv-hero-text,
        .cv-cover-letter-header,
        .cv-header-standard,
        .cv-header-banner,
        .cv-header-creative,
        .cv-header-split,
        .cv-header-minimal,
        .cv-header-corporate {
          position: relative !important;
          z-index: 50 !important;
          background: transparent !important;
          background-color: transparent !important;
        }
        :root, html, body, #cv-printable-document, .cv-root {
          --cv-bg-image: ${inlinedBgImage} !important;
          --cv-color-bg: ${effectiveColorBg} !important;
        }
        .cv-print-page-background {
          display: none !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${pageWidthCss} !important;
          max-width: ${pageWidthCss} !important;
          min-width: ${pageWidthCss} !important;
          background-color: ${effectiveColorBg} !important;
          background-image: ${inlinedBgImage} !important;
          background-size: ${pageWidthCss} ${pageHeightCss} !important;
          background-position: top left !important;
          background-repeat: repeat-y !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
        }
        .cv-root,
        [class*="theme-"],
        .theme-executive,
        .theme-creative,
        .theme-minimalist,
        .theme-white,
        .theme-terminal,
        :root .cv-root,
        :root .cv-root .cv-page-a4,
        :root .cv-root .cv-canvas-sheet,
        .cv-root .cv-page-a4,
        .cv-root .cv-canvas-sheet,
        .cv-page-a4,
        .cv-page-card,
        .cv-card,
        :root .theme-terminal .cv-card,
        .theme-terminal .cv-card,
        .cv-cover-letter-card,
        .cv-cover-letter-page,
        .cv-dossier-wrapper,
        .cv-render-wrapper,
        #cv-printable-document,
        .cv-print-wrapper,
        .sheet-page-container,
        .physical-page-sheet {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
        }
        .cv-dossier-wrapper {
          display: block !important;
          gap: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        .cv-card {
          padding-top: 0 !important;
          background: transparent !important;
          background-color: transparent !important;
        }
        .cv-cover-letter-card {
          padding-top: 0 !important;
        }
        .cv-page-card {
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-start !important;
        }
        .cv-page-card .cv-print-flow-table {
          flex: 1 1 auto !important;
          width: 100% !important;
        }
        .layout-hero_matrix .cv-hero-top-bar,
        .layout-hero_matrix .cv-top-contact-bar {
          margin-bottom: 0.35rem !important;
          padding-bottom: 0.2rem !important;
        }
        .layout-hero_matrix .cv-hero-banner {
          padding: 0.45rem 0.85rem !important;
          margin-bottom: 0.6rem !important;
        }
        .cv-math-header {
          margin-bottom: 0.5rem !important;
          padding-bottom: 0.5rem !important;
        }
        .cv-continuation-header {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .cv-print-wrapper, #cv-printable-document {
          width: ${pageWidthCss} !important;
          max-width: ${pageWidthCss} !important;
          min-width: ${pageWidthCss} !important;
          margin: 0 auto !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          box-shadow: none !important;
          border: none !important;
        }
        .cv-page-a4, .sheet-page-container, .physical-page-sheet {
          width: ${pageWidthCss} !important;
          max-width: ${pageWidthCss} !important;
          min-width: ${pageWidthCss} !important;
          min-height: ${pageHeightCss} !important;
          box-sizing: border-box !important;
          box-shadow: none !important;
          border: none !important;
        }
        /* ── Fragmentação e Quebras Limpas (Zero quebras no meio de textos ou seções) ── */
        .cv-work-item,
        .cv-item,
        .timeline-entry,
        .cv-math-work-item,
        .project-card,
        .cv-math-project-card,
        .cv-education-item,
        .cv-education-card,
        .cv-math-edu-card,
        .cv-skills-group,
        .skills-grid,
        .cv-math-skill-card,
        .cv-section-languages,
        .cv-languages-row,
        .cv-language-card,
        .cv-math-lang-card,
        .cv-interests-wrap,
        .cv-interest-card,
        .cv-math-interest-card,
        .cv-cert-card,
        .cv-award-card,
        .cv-section-atomic,
        .cv-avoid-break,
        .signature-block,
        tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .cv-section-title,
        .section-title,
        .cv-math-section-title,
        h2, h3 {
          break-after: avoid !important;
          page-break-after: avoid !important;
          orphans: 3;
          widows: 3;
        }
        p, li, .cv-bullet-item, .cv-description, .cv-bio {
          orphans: 2;
          widows: 2;
        }
        /* Elimina folha em branco acidental no final */
        :last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      }
    `

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Curriculo - Exportacao Vetorial A4</title>
  <style>
    ${aggregatedCss}
    ${skiaVectorOverrides}
    ${options.extraStyles || ''}
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`
  }

  private static validateAssetUrl(url: string, allowedOrigins?: string[]): void {
    try {
      const parsed = new URL(url, window.location.href)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Protocolo proibido: ${parsed.protocol}`)
      }
      if (allowedOrigins && allowedOrigins.length > 0) {
        if (!allowedOrigins.includes(parsed.origin)) {
          throw new Error(`Origem não permitida: ${parsed.origin}`)
        }
      }
    } catch (err) {
      throw new Error(`URL de ativo inválida: ${(err as Error).message}`)
    }
  }

  private static async urlToBase64(url: string): Promise<string> {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
}
