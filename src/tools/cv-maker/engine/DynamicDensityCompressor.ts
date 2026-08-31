/**
 * Dynamic Density Compressor — LogicDefense & CV Maker 2.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Algoritmo matemático de orçamento espacial (Spatial Height Budgeting)
 * que mede e calibra fontes e espaçamentos fora do DOM via Canvas 2D,
 * garantindo convergência em <= 5 iterações sem layout thrashing.
 */

export interface DensityConstraints {
  minFontSize: number // ex: 8.5
  maxFontSize: number // ex: 11.5
  minPadding: number  // ex: 4
  maxPadding: number  // ex: 12
  lineHeightRatio: number // ex: 1.35
  precision: number   // ex: 0.1
}

export const DEFAULT_DENSITY_CONSTRAINTS: DensityConstraints = {
  minFontSize: 8.5,
  maxFontSize: 11.5,
  minPadding: 4,
  maxPadding: 12,
  lineHeightRatio: 1.35,
  precision: 0.1
}

export interface MeasurementPayload {
  text: string
  fontFamily: string
  fontWeight: string
  width: number
}

export class DynamicDensityCompressor {
  private canvasCtx: CanvasRenderingContext2D | null = null

  constructor() {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      this.canvasCtx = canvas.getContext('2d')
    }
  }

  /**
   * Estima a altura total de um bloco de texto quebrado em linhas usando métricas de Canvas 2D (zero reflow).
   */
  public estimateTextHeight(
    payload: MeasurementPayload,
    fontSize: number,
    lineHeightRatio: number
  ): number {
    if (!this.canvasCtx) return 0

    const { text, fontFamily, fontWeight, width } = payload
    this.canvasCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`

    const words = text.split(/\s+/)
    let currentLine = ''
    let lineCount = 0

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + (currentLine ? ' ' : '') + words[i]
      const metrics = this.canvasCtx.measureText(testLine)

      if (metrics.width > width && i > 0) {
        lineCount++
        currentLine = words[i]
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      lineCount++
    }

    const singleLineHeight = fontSize * lineHeightRatio
    return lineCount * singleLineHeight
  }

  /**
   * Executa busca binária logarítmica para ajustar fonte e padding ao teto de altura alvo.
   */
  public fitToHeightBudget(
    container: HTMLElement,
    targetHeight: number,
    constraints: DensityConstraints = DEFAULT_DENSITY_CONSTRAINTS
  ): Promise<number> {
    if (typeof window === 'undefined' || !this.canvasCtx) return Promise.resolve(constraints.maxFontSize)

    const computedStyle = window.getComputedStyle(container)
    const textContent = container.innerText.trim()
    const containerWidth =
      container.clientWidth -
      parseFloat(computedStyle.paddingLeft || '0') -
      parseFloat(computedStyle.paddingRight || '0')

    const payload: MeasurementPayload = {
      text: textContent,
      fontFamily: computedStyle.fontFamily || 'system-ui',
      fontWeight: computedStyle.fontWeight || '400',
      width: Math.max(containerWidth, 1)
    }

    let low = constraints.minFontSize
    let high = constraints.maxFontSize
    let optimalFontSize = low

    while (high - low >= constraints.precision) {
      const mid = (low + high) / 2
      const estimatedHeight = this.estimateTextHeight(payload, mid, constraints.lineHeightRatio)

      if (estimatedHeight <= targetHeight) {
        optimalFontSize = mid
        low = mid
      } else {
        high = mid
      }
    }

    const scaleFactor =
      (optimalFontSize - constraints.minFontSize) /
      (constraints.maxFontSize - constraints.minFontSize || 1)
    const calculatedPadding =
      constraints.minPadding + scaleFactor * (constraints.maxPadding - constraints.minPadding)

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        container.style.fontSize = `${optimalFontSize.toFixed(1)}px`
        container.style.lineHeight = `${constraints.lineHeightRatio}`
        container.style.padding = `${calculatedPadding.toFixed(1)}px`
        resolve(optimalFontSize)
      })
    })
  }
}
