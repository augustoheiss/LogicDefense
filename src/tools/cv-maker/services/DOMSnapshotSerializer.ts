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
    const computedStyle = window.getComputedStyle(sourceElement)
    const customProps = [
      '--cv-font-scale',
      '--cv-gap-scale',
      '--cv-padding-scale',
      '--cv-line-height',
      '--cv-primary-color',
      '--cv-bg-color',
      '--cv-sidebar-width',
    ]

    let rootVariablesCss = ':root {\n'
    for (const prop of customProps) {
      const val = computedStyle.getPropertyValue(prop).trim()
      if (val) {
        rootVariablesCss += `  ${prop}: ${val};\n`
      }
    }
    rootVariablesCss += '}\n'

    // 5. Remover artefatos interativos do editor (alças de drag, botões, bordas ativas)
    if (options.stripInteractive !== false) {
      const interactiveElements = clone.querySelectorAll(
        '[data-cv-interactive="true"], button, .cv-no-print, .no-print'
      )
      interactiveElements.forEach((el) => el.remove())
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

    // 8. Injetar blindagem vetorial Skia contra rasterização em 72 DPI
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
        @page {
          size: A4 ${options.targetOrientation || 'portrait'};
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff !important;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
        }
        .cv-print-wrapper, #cv-printable-document {
          width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
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
