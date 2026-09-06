/**
 * PageFormatEngine.ts
 *
 * Motor determinístico de geometria de folha física (A4, US Letter, US Legal).
 * Unifica a matemática de conversão entre milímetros (físico), pontos tipográficos (PDF / 72 DPI)
 * e píxeis CSS (ecrã / 96 DPI).
 *
 * Governa as variáveis globais CSS (--cv-page-width, --cv-page-height) e injeta
 * regras @page dinâmicas para assegurar paridade matemática 1:1 entre o preview e a impressão.
 */

import type { PageFormat } from '../types/cv'

export interface PageDimension {
  id: PageFormat
  name: string
  label: string
  widthMm: number
  heightMm: number
  widthPx: number   // 96 DPI CSS reference pixels (1in = 96px = 25.4mm)
  heightPx: number  // 96 DPI CSS reference pixels
  widthPt: number   // 72 DPI PostScript points (1in = 72pt = 25.4mm)
  heightPt: number  // 72 DPI PostScript points
  cssPageSize: string
  aspectRatio: number
}

export const PAGE_FORMATS: Record<PageFormat, PageDimension> = {
  a4: {
    id: 'a4',
    name: 'A4',
    label: '📄 A4 (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    widthPx: 793.70,
    heightPx: 1122.52,
    widthPt: 595.28,
    heightPt: 841.89,
    cssPageSize: 'A4 portrait',
    aspectRatio: 297 / 210 // 1.4142
  },
  letter: {
    id: 'letter',
    name: 'US Letter',
    label: '🇺🇸 Carta / Letter (8.5 × 11 pol)',
    widthMm: 215.9,
    heightMm: 279.4,
    widthPx: 816.00,
    heightPx: 1056.00,
    widthPt: 612.00,
    heightPt: 792.00,
    cssPageSize: 'letter portrait',
    aspectRatio: 279.4 / 215.9 // 1.2941
  },
  legal: {
    id: 'legal',
    name: 'US Legal',
    label: '⚖️ Legal (8.5 × 14 pol)',
    widthMm: 215.9,
    heightMm: 355.6,
    widthPx: 816.00,
    heightPx: 1344.00,
    widthPt: 612.00,
    heightPt: 1008.00,
    cssPageSize: 'legal portrait',
    aspectRatio: 355.6 / 215.9 // 1.6470
  }
}

export class PageFormatEngine {
  private static styleElement: HTMLStyleElement | null = null

  /**
   * Obtém os metadados de dimensão de um formato de página especificado.
   */
  public static getDimension(format: PageFormat = 'a4'): PageDimension {
    return PAGE_FORMATS[format] || PAGE_FORMATS.a4
  }

  /**
   * Lista todos os formatos disponíveis para renderização.
   */
  public static getAvailableFormats(): PageDimension[] {
    return Object.values(PAGE_FORMATS)
  }

  /**
   * Aplica dinamicamente as variáveis CSS no elemento raiz e injeta a regra @page de impressão.
   */
  public static applyFormat(format: PageFormat = 'a4', root: HTMLElement = document.documentElement): PageDimension {
    const dim = this.getDimension(format)

    // 1. Sincronizar tokens CSS de geometria física no :root
    root.style.setProperty('--cv-page-width', `${dim.widthMm}mm`)
    root.style.setProperty('--cv-page-height', `${dim.heightMm}mm`)
    root.style.setProperty('--cv-page-width-px', `${dim.widthPx}px`)
    root.style.setProperty('--cv-page-height-px', `${dim.heightPx}px`)
    root.style.setProperty('--cv-page-width-pt', `${dim.widthPt}pt`)
    root.style.setProperty('--cv-page-height-pt', `${dim.heightPt}pt`)
    root.style.setProperty('--cv-page-ratio', `${dim.aspectRatio.toFixed(4)}`)
    root.style.setProperty('--cv-page-size', dim.cssPageSize)

    // 2. Injetar ou atualizar tag <style> reativa para a diretiva @page
    if (typeof document !== 'undefined') {
      let el = document.getElementById('cv-dynamic-paged-media') as HTMLStyleElement | null
      if (!el) {
        el = document.createElement('style')
        el.id = 'cv-dynamic-paged-media'
        document.head.appendChild(el)
      }
      this.styleElement = el

      this.styleElement.textContent = `
        @page {
          size: ${dim.cssPageSize};
          margin: 0;
        }
        @media print {
          html, body {
            width: ${dim.widthMm}mm !important;
            max-width: ${dim.widthMm}mm !important;
            min-width: ${dim.widthMm}mm !important;
          }
          .cv-page-a4 {
            width: ${dim.widthMm}mm !important;
            max-width: ${dim.widthMm}mm !important;
            min-width: ${dim.widthMm}mm !important;
            min-height: ${dim.heightMm}mm !important;
          }
          .cv-print-page-background {
            width: ${dim.widthMm}mm !important;
            height: ${dim.heightMm}mm !important;
            max-width: ${dim.widthMm}mm !important;
            max-height: ${dim.heightMm}mm !important;
          }
        }
      `
    }

    return dim
  }
}
