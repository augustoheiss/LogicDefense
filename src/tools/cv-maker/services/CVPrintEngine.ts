/**
 * CVPrintEngine.ts
 *
 * Fachada unificada de impressão A4 determinística e compilação de PDF vetorial.
 * Orquestra o DOMSnapshotSerializer, RealDOMSpatialBudgeter e a sincronização
 * com as APIs nativas do navegador (document.fonts.ready, window.print).
 */

import { RealDOMSpatialBudgeter, BudgeterResult } from './RealDOMSpatialBudgeter'
import { DOMSnapshotSerializer, SnapshotOptions } from './DOMSnapshotSerializer'

export interface DirectPrintOptions {
  candidateName?: string
  candidateLabel?: string
  viewMode?: string
  autoFitFirst?: boolean
  sourceElement?: HTMLElement | null
}

export class CVPrintEngine {
  /**
   * Localiza o nó raiz imprimível do currículo no DOM.
   */
  public static getPrintableRoot(explicitElement?: HTMLElement | null): HTMLElement {
    if (explicitElement) return explicitElement
    const el =
      (document.getElementById('cv-printable-document') as HTMLElement) ||
      (document.querySelector('.cv-print-wrapper') as HTMLElement) ||
      (document.querySelector('.cv-canvas-sheet') as HTMLElement) ||
      (document.querySelector('.cv-viewer-container') as HTMLElement)

    if (!el) {
      throw new Error('[CVPrintEngine] Nenhum elemento imprimível (#cv-printable-document ou .cv-print-wrapper) foi encontrado.')
    }
    return el
  }

  /**
   * Executa a otimização de altura em 1 página no elemento ativo via bissecção em sandbox.
   */
  public static async autoFitSinglePage(explicitElement?: HTMLElement | null): Promise<BudgeterResult> {
    const rootEl = this.getPrintableRoot(explicitElement)
    return await RealDOMSpatialBudgeter.fitToBudget(rootEl)
  }

  /**
   * Dispara a impressão nativa perfeita (window.print) sincronizando fontes,
   * travando classes de impressão e formatando o título padrão do PDF.
   */
  public static async triggerDirectPrint(options: DirectPrintOptions = {}): Promise<void> {
    const rootEl = this.getPrintableRoot(options.sourceElement)

    // 1. Formatar título do documento para sugestão automática no diálogo do navegador
    if (options.candidateName) {
      const name = options.candidateName.trim()
      const label = options.candidateLabel ? ` - ${options.candidateLabel.trim()}` : ''
      const modeSuffix =
        options.viewMode === 'cover_letter'
          ? ' - Carta de Apresentacao'
          : options.viewMode === 'both'
          ? ' - Dossie Completo'
          : ' - Curriculo'
      document.title = `${name}${label}${modeSuffix}`
    }

    // 2. Garantir sincronização e carregamento completo das fontes da página
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready
      } catch (e) {
        console.warn('[CVPrintEngine] Aviso ao sincronizar fontes antes da impressão:', e)
      }
    }

    // 3. Se solicitado, executa o auto-fit para 1 página antes de disparar o print
    if (options.autoFitFirst) {
      try {
        await RealDOMSpatialBudgeter.fitToBudget(rootEl)
      } catch (e) {
        console.warn('[CVPrintEngine] Auto-fit ignorado devido a erro:', e)
      }
    }

    // 4. Injeta as classes ativas de impressão para ocultar barras de ferramentas e interações
    document.body.classList.add('cv-is-printing')
    document.documentElement.classList.add('cv-is-printing')

    // Sincroniza tokens de fundo no :root (<html>) para preenchimento total em sangria e margens
    const cvRoot = (rootEl.querySelector('.cv-root') || rootEl) as HTMLElement
    if (cvRoot) {
      const computed = window.getComputedStyle(cvRoot)
      const bgColor = computed.getPropertyValue('--cv-color-bg').trim()
      const bgImage = computed.getPropertyValue('--cv-bg-image').trim()
      if (bgColor) document.documentElement.style.setProperty('--cv-color-bg', bgColor)
      if (bgImage) document.documentElement.style.setProperty('--cv-bg-image', bgImage)
    }

    const cleanupPrint = () => {
      document.body.classList.remove('cv-is-printing')
      document.documentElement.classList.remove('cv-is-printing')
      window.removeEventListener('afterprint', cleanupPrint)
    }

    window.addEventListener('afterprint', cleanupPrint)

    // 5. Invoca a API de impressão do Chromium/Blink
    window.print()

    // 6. Limpeza por timeout como fallback se afterprint não disparar
    setTimeout(cleanupPrint, 3000)
  }

  /**
   * Gera um documento HTML autônomo e isolado do DOM atual (útil para auditoria ou CDP).
   */
  public static async generateSnapshotHtml(
    options: DirectPrintOptions = {},
    snapshotOptions: SnapshotOptions = {}
  ): Promise<string> {
    const rootEl = this.getPrintableRoot(options.sourceElement)
    return await DOMSnapshotSerializer.serialize(rootEl, snapshotOptions)
  }
}
