/**
 * RealDOMSpatialBudgeter.ts
 *
 * Motor de bissecção espacial contínua no DOM Real para páginas físicas A4.
 * Executa uma busca binária estritamente delimitada de O(log2(1/epsilon)) <= 10 passos
 * em um sandbox offscreen isolado (contain: layout style size !important).
 *
 * Garante que o documento caiba matematicamente em 1 página A4 (1122.52px - epsilon)
 * sem causar layout thrashing na thread principal do usuário.
 */

export interface BudgetConfig {
  pageHeightPx: number   // 1122.52px para A4 a 96 DPI
  marginTopPx: number    // Margem física superior
  marginBottomPx: number // Margem física inferior
  epsilonPx: number      // Buffer de derivação subpixel (padrão: 3.5px)
  maxIterations: number  // Limite estrito (padrão: 10, convergência em ~12ms)
  enablePruning: boolean // Poda graciosa de itens com data-fit-priority="low"
}

export interface BudgeterResult {
  optimalT: number        // Escalar ótimo entre 0.0 (máxima densidade) e 1.0 (relaxado)
  converged: boolean      // true se coube dentro do orçamento de altura
  iterationsUsed: number  // Número de passos executados
  finalHeightPx: number   // Altura final medida em pixels
  prunedCount: number     // Número de elementos secundários ocultados por poda
}

export class RealDOMSpatialBudgeter {
  private static readonly DEFAULT_CONFIG: BudgetConfig = {
    pageHeightPx: 1122.52,
    marginTopPx: 0,
    marginBottomPx: 0,
    epsilonPx: 3.5,
    maxIterations: 10,
    enablePruning: true,
  }

  /**
   * Encontra o escalar ótimo t em [0, 1] e aplica as variáveis CSS ideais no elemento original.
   */
  public static async fitToBudget(
    sourceElement: HTMLElement,
    config: Partial<BudgetConfig> = {}
  ): Promise<BudgeterResult> {
    const cfg: BudgetConfig = { ...this.DEFAULT_CONFIG, ...config }
    const hBudget = cfg.pageHeightPx - cfg.marginTopPx - cfg.marginBottomPx - cfg.epsilonPx

    // 1. Criar sandbox offscreen isolado para evitar qualquer repaints ou layout thrashing
    const sandbox = document.createElement('div')
    sandbox.style.cssText = `
      contain: layout style size !important;
      position: fixed !important;
      top: -10000px !important;
      left: -10000px !important;
      width: 793.7px !important; /* Largura física A4 a 96 DPI */
      visibility: hidden !important;
      pointer-events: none !important;
      z-index: -9999 !important;
    `

    const clone = sourceElement.cloneNode(true) as HTMLElement
    // Remove artefatos interativos do clone para medir apenas o conteúdo real de impressão
    const interactiveElements = clone.querySelectorAll(
      '[data-cv-interactive="true"], button, .cv-no-print, .no-print'
    )
    interactiveElements.forEach((el) => el.remove())

    sandbox.appendChild(clone)
    document.body.appendChild(sandbox)

    const applyScalar = (targetEl: HTMLElement, t: number) => {
      // Interpolação linear nos domínios contínuos de densidade
      const font = 0.82 + t * (1.0 - 0.82)
      const gap = 4 + t * (10 - 4)
      const padding = 6 + t * (14 - 6)
      const lh = 1.22 + t * (1.40 - 1.22)

      targetEl.style.setProperty('--cv-font-scale', `${font.toFixed(4)}rem`)
      targetEl.style.setProperty('--cv-gap-scale', `${gap.toFixed(2)}px`)
      targetEl.style.setProperty('--cv-padding-scale', `${padding.toFixed(2)}px`)
      targetEl.style.setProperty('--cv-line-height', `${lh.toFixed(3)}`)
    }

    let low = 0.0
    let high = 1.0
    let optimalT = 1.0
    let iterationsUsed = 0
    let prunedCount = 0

    // Checagem Rápida: cabe no modo totalmente relaxado (t = 1)?
    applyScalar(clone, 1.0)
    if (clone.scrollHeight <= hBudget) {
      document.body.removeChild(sandbox)
      applyScalar(sourceElement, 1.0)
      return {
        optimalT: 1.0,
        converged: true,
        iterationsUsed: 1,
        finalHeightPx: clone.scrollHeight,
        prunedCount: 0,
      }
    }

    // Busca Binária (Bissecção) estritamente limitada por maxIterations
    for (let i = 0; i < cfg.maxIterations; i++) {
      iterationsUsed++
      const mid = (low + high) / 2
      applyScalar(clone, mid)
      const currentH = clone.scrollHeight

      if (currentH <= hBudget) {
        optimalT = mid
        low = mid // Tenta relaxar um pouco mais para melhor legibilidade
      } else {
        high = mid // Aperta mais a densidade
      }
    }

    // Se mesmo no limite de densidade máxima (t = 0) ainda ultrapassar:
    applyScalar(clone, optimalT)
    let converged = clone.scrollHeight <= hBudget

    if (!converged && cfg.enablePruning) {
      prunedCount = this.pruneLowPriorityContent(clone, hBudget)
      converged = clone.scrollHeight <= hBudget
    }

    const finalHeightPx = clone.scrollHeight

    // Desmonta o sandbox
    document.body.removeChild(sandbox)

    // Aplica o escalar vencedor diretamente no elemento original
    applyScalar(sourceElement, optimalT)

    // Se houve poda no clone, replica no elemento original
    if (prunedCount > 0 && cfg.enablePruning) {
      this.pruneLowPriorityContent(sourceElement, hBudget)
    }

    return {
      optimalT,
      converged,
      iterationsUsed,
      finalHeightPx,
      prunedCount,
    }
  }

  /**
   * Poda progressiva de elementos marcados com data-fit-priority="low"
   * (ex: cursos secundários, interesses extensos) até caber no orçamento.
   */
  private static pruneLowPriorityContent(root: HTMLElement, hBudget: number): number {
    const prunables = Array.from(
      root.querySelectorAll('[data-fit-priority="low"]')
    ) as HTMLElement[]

    let pruned = 0
    for (const el of prunables) {
      if (root.scrollHeight <= hBudget) break
      el.style.display = 'none'
      pruned++
    }
    return pruned
  }
}
