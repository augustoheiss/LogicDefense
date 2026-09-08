/**
 * PageFormatEngine.ts
 *
 * Motor determinístico de geometria euclidiana de folha física para o PDF-Maker Geral.
 * Unifica a matemática de conversão de alta precisão entre:
 * - Milímetros (mundo físico pré-impressão: ISO 216 e ANSI/ASME)
 * - Pontos tipográficos PostScript (PDF / 72 DPI: 1in = 72pt = 25.4mm)
 * - Píxeis CSS de referência (ecrã / 96 DPI: 1in = 96px = 25.4mm)
 *
 * Elimina o Epsilon Drift do Blink LayoutNG (aritmética 24.6 fixed-point LayoutUnit),
 * governa variáveis globais CSS (--cv-page-width, --cv-page-height, etc.) e injeta
 * regras @page dinâmicas via `<style id="runtime-page-geometry">` para assegurar
 * paridade matemática 1:1 absoluta entre o editor interativo e o arquivo impresso/Playwright.
 */

import type { PageFormat, StandardPageFormat, CustomPageDimensions } from '../types/cv'

export interface PageDimension {
  id: PageFormat
  name: string
  label: string
  category: 'iso' | 'ansi' | 'custom'
  widthMm: number
  heightMm: number
  widthPx: number   // 96 DPI CSS reference pixels (1in = 96px = 25.4mm)
  heightPx: number  // 96 DPI CSS reference pixels
  widthPt: number   // 72 DPI PostScript points (1in = 72pt = 25.4mm)
  heightPt: number  // 72 DPI PostScript points
  cssPageSize: string
  aspectRatio: number
}

// Fórmulas de conversão de dupla precisão
export const mmToPx = (mm: number): number => Number(((mm * 96) / 25.4).toFixed(2))
export const mmToPt = (mm: number): number => Number(((mm * 72) / 25.4).toFixed(2))
export const pxToMm = (px: number): number => Number(((px * 25.4) / 96).toFixed(2))

export const PAGE_FORMATS: Record<StandardPageFormat, PageDimension> = {
  a4: {
    id: 'a4',
    name: 'A4',
    label: '📄 A4 (210 × 297 mm)',
    category: 'iso',
    widthMm: 210,
    heightMm: 297,
    widthPx: 793.70,
    heightPx: 1122.52,
    widthPt: 595.28,
    heightPt: 841.89,
    cssPageSize: '210mm 297mm',
    aspectRatio: 297 / 210 // 1.4142
  },
  a3: {
    id: 'a3',
    name: 'A3',
    label: '📑 A3 (297 × 420 mm)',
    category: 'iso',
    widthMm: 297,
    heightMm: 420,
    widthPx: 1122.52,
    heightPx: 1587.40,
    widthPt: 841.89,
    heightPt: 1190.55,
    cssPageSize: '297mm 420mm',
    aspectRatio: 420 / 297 // 1.4142
  },
  a5: {
    id: 'a5',
    name: 'A5',
    label: '📜 A5 (148 × 210 mm)',
    category: 'iso',
    widthMm: 148,
    heightMm: 210,
    widthPx: 559.37,
    heightPx: 793.70,
    widthPt: 419.53,
    heightPt: 595.28,
    cssPageSize: '148mm 210mm',
    aspectRatio: 210 / 148 // 1.4189
  },
  letter: {
    id: 'letter',
    name: 'US Letter',
    label: '🇺🇸 Carta / Letter (8.5 × 11 pol)',
    category: 'ansi',
    widthMm: 215.9,
    heightMm: 279.4,
    widthPx: 816.00,
    heightPx: 1056.00,
    widthPt: 612.00,
    heightPt: 792.00,
    cssPageSize: '215.9mm 279.4mm',
    aspectRatio: 279.4 / 215.9 // 1.2941
  },
  legal: {
    id: 'legal',
    name: 'US Legal',
    label: '⚖️ Legal (8.5 × 14 pol)',
    category: 'ansi',
    widthMm: 215.9,
    heightMm: 355.6,
    widthPx: 816.00,
    heightPx: 1344.00,
    widthPt: 612.00,
    heightPt: 1008.00,
    cssPageSize: '215.9mm 355.6mm',
    aspectRatio: 355.6 / 215.9 // 1.6470
  },
  tabloid: {
    id: 'tabloid',
    name: 'Tabloid',
    label: '📰 Tabloid / Ledger (11 × 17 pol)',
    category: 'ansi',
    widthMm: 279.4,
    heightMm: 431.8,
    widthPx: 1056.00,
    heightPx: 1632.00,
    widthPt: 792.00,
    heightPt: 1224.00,
    cssPageSize: '279.4mm 431.8mm',
    aspectRatio: 431.8 / 279.4 // 1.5454
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    label: '💼 Executive (7.25 × 10.5 pol)',
    category: 'ansi',
    widthMm: 184.15,
    heightMm: 266.7,
    widthPx: 696.00,
    heightPx: 1008.00,
    widthPt: 522.00,
    heightPt: 756.00,
    cssPageSize: '184.15mm 266.7mm',
    aspectRatio: 266.7 / 184.15 // 1.4482
  }
}

export class PageFormatEngine {
  private static styleElement: HTMLStyleElement | null = null

  /**
   * Constrói uma dimensão euclidiana customizada a partir de milímetros.
   */
  public static createCustomDimension(
    custom?: CustomPageDimensions
  ): PageDimension {
    const widthMm = Math.max(50, Math.min(1000, custom?.widthMm || 210))
    const heightMm = Math.max(50, Math.min(1500, custom?.heightMm || 297))
    const widthPx = mmToPx(widthMm)
    const heightPx = mmToPx(heightMm)
    const widthPt = mmToPt(widthMm)
    const heightPt = mmToPt(heightMm)
    const name = custom?.name || `Personalizado (${widthMm}×${heightMm}mm)`

    return {
      id: 'custom',
      name,
      label: `📐 ${name}`,
      category: 'custom',
      widthMm,
      heightMm,
      widthPx,
      heightPx,
      widthPt,
      heightPt,
      cssPageSize: `${widthMm}mm ${heightMm}mm`,
      aspectRatio: Number((heightMm / widthMm).toFixed(4))
    }
  }

  /**
   * Obtém os metadados de dimensão de um formato de página especificado.
   * Suporta formatos padronizados ou customizados arbitrários.
   */
  public static getDimension(
    format: PageFormat = 'a4',
    custom?: CustomPageDimensions
  ): PageDimension {
    if (format === 'custom') {
      return this.createCustomDimension(custom)
    }
    return PAGE_FORMATS[format as StandardPageFormat] || PAGE_FORMATS.a4
  }

  /**
   * Lista todos os formatos padronizados disponíveis para renderização.
   */
  public static getAvailableFormats(): PageDimension[] {
    return Object.values(PAGE_FORMATS)
  }

  /**
   * Aplica dinamicamente as variáveis CSS no elemento raiz e injeta a regra @page de impressão.
   */
  public static applyFormat(
    format: PageFormat = 'a4',
    root: HTMLElement = document.documentElement,
    custom?: CustomPageDimensions
  ): PageDimension {
    const dim = this.getDimension(format, custom)

    // 1. Sincronizar tokens CSS de geometria física no :root
    root.style.setProperty('--cv-page-width', `${dim.widthMm}mm`)
    root.style.setProperty('--cv-page-height', `${dim.heightMm}mm`)
    root.style.setProperty('--cv-page-width-px', `${dim.widthPx}px`)
    root.style.setProperty('--cv-page-height-px', `${dim.heightPx}px`)
    root.style.setProperty('--cv-page-width-pt', `${dim.widthPt}pt`)
    root.style.setProperty('--cv-page-height-pt', `${dim.heightPt}pt`)
    root.style.setProperty('--cv-page-ratio', `${dim.aspectRatio.toFixed(4)}`)
    root.style.setProperty('--cv-page-size', dim.cssPageSize)
    // Epsilon clipping buffer (LayoutNG subpixel safety)
    root.style.setProperty('--cv-page-epsilon-buffer', '0.5px')

    // 2. Injetar ou atualizar tag <style id="runtime-page-geometry"> para diretiva @page determinística
    if (typeof document !== 'undefined') {
      let el = document.getElementById('runtime-page-geometry') as HTMLStyleElement | null
      if (!el) {
        // Compatibilidade reversa com antigo ID
        el = document.getElementById('cv-dynamic-paged-media') as HTMLStyleElement | null
      }
      if (!el) {
        el = document.createElement('style')
        el.id = 'runtime-page-geometry'
        document.head.appendChild(el)
      } else {
        el.id = 'runtime-page-geometry'
      }
      this.styleElement = el

      this.styleElement.textContent = `
        @page {
          size: ${dim.cssPageSize};
          margin: 0;
        }
        @media print {
          /* Blindagem vetorial Skia: suprimir filtros que provocam fallback de 72 DPI */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            filter: none !important;
            backdrop-filter: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${dim.widthMm}mm !important;
            max-width: ${dim.widthMm}mm !important;
            min-width: ${dim.widthMm}mm !important;
            background-color: var(--cv-color-bg, #ffffff) !important;
            background-image: var(--cv-bg-image, none) !important;
            background-size: ${dim.widthMm}mm ${dim.heightMm}mm !important;
            background-position: top left !important;
            background-repeat: repeat-y !important;
          }
          .cv-page-a4,
          .sheet-page-container,
          .physical-page-sheet {
            width: ${dim.widthMm}mm !important;
            max-width: ${dim.widthMm}mm !important;
            min-width: ${dim.widthMm}mm !important;
            min-height: ${dim.heightMm}mm !important;
            height: calc(100% - 0.5px) !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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
