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
  pageFormat?: string
  customWidthMm?: number
  customHeightMm?: number
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
        // Verificação determinística das famílias tipográficas essenciais
        const checkFamilies = ['Inter', 'Plus Jakarta Sans', 'Merriweather', 'Fira Code', 'Outfit', 'Poppins']
        for (const fam of checkFamilies) {
          document.fonts.check(`12px "${fam}"`)
        }
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

  /**
   * Compila o snapshot HTML do currículo diretamente no servidor via Chromium Headless Playwright.
   * Não abre diálogo de impressão do navegador; realiza o download direto do binário PDF vetorial de alta definição.
   */
  public static async downloadDirectHeadlessPdf(
    options: DirectPrintOptions = {},
    snapshotOptions: SnapshotOptions = {}
  ): Promise<boolean> {
    const rootEl = this.getPrintableRoot(options.sourceElement)

    // 1. Garante carregamento das fontes antes do snapshot
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready
      } catch (e) {
        console.warn('[CVPrintEngine] Aviso ao sincronizar fontes:', e)
      }
    }

    // 2. Gera snapshot HTML limpo e autocontido
    const snapshotHtml = await DOMSnapshotSerializer.serialize(rootEl, {
      stripInteractive: true,
      inlineAssets: true,
      ...snapshotOptions
    })

    // 3. Formata nome amigável do arquivo
    const candidateName = (options.candidateName || 'curriculo').trim().toLowerCase().replace(/\s+/g, '-')
    const label = options.candidateLabel ? `-${options.candidateLabel.trim().toLowerCase().replace(/\s+/g, '-')}` : ''
    const modeSuffix =
      options.viewMode === 'cover_letter'
        ? '-carta'
        : options.viewMode === 'both'
        ? '-dossie'
        : ''
    const filename = `curriculo-${candidateName}${label}${modeSuffix}.pdf`

    // 4. Candidatos de Backend (local 8001, local 8000, relativo, produção)
    const envUrl = (import.meta as any).env?.VITE_BACKEND_URL
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const candidates: string[] = []
    if (envUrl) candidates.push(envUrl.replace(/\/$/, ''))
    if (isLocal) {
      candidates.push('http://localhost:8001')
      candidates.push('http://localhost:8000')
      candidates.push('')
    }
    candidates.push('https://ocorrencias-pdf-writer.onrender.com')
    candidates.push('https://heiss-cv-engine.onrender.com')

    let lastError: any = null

    for (const baseUrl of candidates) {
      try {
        const endpoint = baseUrl ? `${baseUrl}/api/v1/cv/export-pdf-headless` : '/api/v1/cv/export-pdf-headless'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            html: snapshotHtml,
            filename,
            format: options.pageFormat,
            width: options.customWidthMm ? `${options.customWidthMm}mm` : undefined,
            height: options.customHeightMm ? `${options.customHeightMm}mm` : undefined
          })
        })

        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 1500)
          return true
        } else {
          lastError = new Error(`Servidor respondeu com status ${response.status}`)
        }
      } catch (err) {
        lastError = err
      }
    }

    console.warn('[CVPrintEngine] Nenhum servidor Playwright headless disponível. Erro:', lastError)
    throw lastError || new Error('Falha ao conectar com o serviço Playwright.')
  }
}
