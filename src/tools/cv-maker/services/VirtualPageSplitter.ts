/**
 * VirtualPageSplitter.ts
 *
 * Divisor determinístico de páginas virtuais para documentos A4 multi-página (Dossiês Executivos).
 * Bypassa a fragmentação arbitrária do LayoutNG medindo a altura real dos blocos
 * e agrupando-os em contêineres .virtual-page com dimensões físicas exatas (210mm x 297mm).
 *
 * Elimina quebras de cards pela metade e páginas órfãs terminais.
 */

export interface PageSplitOptions {
  pageHeightPx?: number       // 1122.52px para A4
  pageHeaderHeightPx?: number // Altura de cabeçalho persistente se aplicável
  pageFooterHeightPx?: number // Altura de rodapé de numeração
  cardSelector?: string       // Seletor dos blocos atômicos
}

export interface VirtualPageGroup {
  pages: HTMLElement[]
  totalPageCount: number
  orphanSlackPx: number
}

export class VirtualPageSplitter {
  private static readonly DEFAULT_OPTIONS: Required<PageSplitOptions> = {
    pageHeightPx: 1122.52,
    pageHeaderHeightPx: 0,
    pageFooterHeightPx: 0,
    cardSelector: '.cv-structural-box, .cv-section-box, .cv-card, .cv-item',
  }

  public static splitIntoPages(
    container: HTMLElement,
    options: PageSplitOptions = {}
  ): VirtualPageGroup {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    const cards = Array.from(container.querySelectorAll(opts.cardSelector)) as HTMLElement[]
    const pages: HTMLElement[] = []

    let currentPage = this.createPageContainer()
    let currentHeight = 0
    const maxUsableHeight = opts.pageHeightPx - opts.pageHeaderHeightPx - opts.pageFooterHeightPx

    for (const card of cards) {
      // Ignora elementos marcados para não impressão
      if (card.classList.contains('cv-no-print') || card.getAttribute('data-cv-interactive') === 'true') {
        continue
      }

      const cardRect = card.getBoundingClientRect()
      const cardHeight = cardRect.height > 0 ? cardRect.height : (card.offsetHeight || 40)

      if (currentHeight + cardHeight > maxUsableHeight && currentHeight > 0) {
        pages.push(currentPage)
        currentPage = this.createPageContainer()
        currentHeight = 0
      }

      currentPage.appendChild(card.cloneNode(true))
      currentHeight += cardHeight
    }

    if (currentPage.childNodes.length > 0) {
      pages.push(currentPage)
    }

    const orphanSlackPx = maxUsableHeight - currentHeight

    return {
      pages,
      totalPageCount: pages.length,
      orphanSlackPx: Math.max(0, orphanSlackPx),
    }
  }

  public static createPageContainer(): HTMLElement {
    const page = document.createElement('div')
    page.className = 'virtual-page'
    page.style.cssText = `
      width: 210mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      page-break-after: always !important;
      break-after: page !important;
      position: relative !important;
      background-color: #ffffff !important;
      margin: 0 auto !important;
    `
    return page
  }
}
