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
  backgroundPattern?: string
  colorBg?: string
  onProgress?: (status: string) => void
}

export class CVPrintEngine {
  private static activeAbortController: AbortController | null = null

  /**
   * Cancela imediatamente qualquer requisição ativa de compilação Playwright,
   * liberando a thread para retry imediato quando o usuário solicitar.
   */
  public static abortActive(): void {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort()
      } catch {}
      this.activeAbortController = null
    }
  }

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
   * Acorda silenciosamente as instâncias em hibernação no Render (Cold Start prevention).
   * Dispara requisições assíncronas /health em background sem bloquear o usuário.
   */
  public static prewarmWorkers(): void {
    const workers = [
      'https://ocorrencias-pdf-writer.onrender.com/health',
      'https://heiss-cv-engine.onrender.com/health'
    ]
    for (const url of workers) {
      try {
        fetch(url, { method: 'GET', mode: 'cors' }).catch(() => {})
      } catch {}
    }
  }

  /**
   * Sonda ativa de despertar (Wakeup Probe):
   * Verifica se o backend já está acordado ou monitora o boot frio pingando /health a cada 2s.
   * O milissegundo exato em que o container no Render acorda e responde 200 OK,
   * a compilação do PDF é disparada automaticamente na hora, sem exigir que o usuário fique clicando!
   */
  private static async waitForServerAwake(
    baseUrl: string,
    masterSignal: AbortSignal,
    maxWaitMs: number,
    onProgress?: (status: string) => void
  ): Promise<boolean> {
    if (!baseUrl) return true // Local ou relativo dispensa sonda

    const healthUrl = `${baseUrl}/health`
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      if (masterSignal.aborted) {
        throw new DOMException('Operação abortada pelo usuário.', 'AbortError')
      }

      const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
      if (onProgress) {
        if (elapsedSec > 0) {
          onProgress(`Aguardando inicialização do servidor Playwright (${elapsedSec}s decorridos)...`)
        } else {
          onProgress('Verificando status do servidor Playwright...')
        }
      }

      try {
        const pingCtrl = new AbortController()
        const pingTimer = setTimeout(() => pingCtrl.abort(), 8000)
        const res = await fetch(healthUrl, { method: 'GET', signal: pingCtrl.signal, mode: 'cors' }).catch(() => null)
        clearTimeout(pingTimer)

        if (res && res.ok) {
          // SERVIDOR ACORDADO! Libera na hora!
          return true
        }
      } catch {}

      // Aguarda 2 segundos antes do próximo ping
      await new Promise((r) => setTimeout(r, 2000))
    }

    return false
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
      backgroundPattern: options.backgroundPattern,
      colorBg: options.colorBg,
      ...snapshotOptions
    })

    // 3. Formata nome amigável e seguro do arquivo PDF (compatível com Windows, Chrome e SmartScreen)
    const sanitizePart = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

    const cleanCandidate = sanitizePart(options.candidateName || 'curriculo')
    const cleanLabel = options.candidateLabel ? `-${sanitizePart(options.candidateLabel)}` : ''
    const modeSuffix =
      options.viewMode === 'cover_letter'
        ? '-carta'
        : options.viewMode === 'both'
        ? '-dossie'
        : ''
    const filename = `curriculo-${cleanCandidate || 'profissional'}${cleanLabel}${modeSuffix}.pdf`

    // 4. Candidatos de Backend priorizando o worker oficial do CV Maker (heiss-cv-engine)
    const cvWorkerEnv = (import.meta as any).env?.VITE_CV_WORKER_URL
    const backendEnv = (import.meta as any).env?.VITE_BACKEND_URL
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const candidates: string[] = []

    // 4.1. Prioridade 1: URL customizada explícita no ambiente (.env)
    if (cvWorkerEnv) candidates.push(cvWorkerEnv.replace(/\/$/, ''))
    if (backendEnv && !candidates.includes(backendEnv.replace(/\/$/, ''))) {
      candidates.push(backendEnv.replace(/\/$/, ''))
    }

    // 4.2. Se rodando localmente no desktop, tenta workers locais
    if (isLocal) {
      candidates.push('http://localhost:8001')
      candidates.push('http://localhost:8000')
      candidates.push('')
    }

    // 4.3. Worker oficial de alta velocidade do CV Maker no Render (heiss-cv-engine)
    const officialCvWorker = 'https://heiss-cv-engine.onrender.com'
    if (!candidates.includes(officialCvWorker)) {
      candidates.push(officialCvWorker)
    }

    // 4.4. Worker de contingência (ocorrencias-pdf-writer)
    const backupWorker = 'https://ocorrencias-pdf-writer.onrender.com'
    if (!candidates.includes(backupWorker)) {
      candidates.push(backupWorker)
    }

    // 4.5. Fallback para VITE_API_URL se definida e diferente
    const apiUrlEnv = (import.meta as any).env?.VITE_API_URL
    if (apiUrlEnv && !candidates.includes(apiUrlEnv.replace(/\/$/, ''))) {
      candidates.push(apiUrlEnv.replace(/\/$/, ''))
    }

    let lastError: any = null
    options.onProgress?.('Preparando documento e conectando ao worker...')

    // Configura controle de cancelamento mestre para esta sessão
    this.abortActive()
    const masterController = new AbortController()
    this.activeAbortController = masterController

    try {
      for (let i = 0; i < candidates.length; i++) {
        if (masterController.signal.aborted) {
          throw new DOMException('Operação abortada pelo usuário para nova tentativa.', 'AbortError')
        }

        const baseUrl = candidates[i]
        const endpoint = baseUrl ? `${baseUrl}/api/v1/cv/export-pdf-headless` : '/api/v1/cv/export-pdf-headless'
        const timeoutMs = isLocal ? 15000 : 25000

        try {
          // 1. Sonda ativa de despertar: pinga /health e libera no instante exato em que o servidor acordar
          if (baseUrl) {
            const isAwake = await this.waitForServerAwake(
              baseUrl,
              masterController.signal,
              isLocal ? 4000 : 65000,
              options.onProgress
            )
            if (!isAwake) {
              console.warn(`[CVPrintEngine] Servidor ${baseUrl} não respondeu ao health check a tempo. Acionando failover...`)
              lastError = new Error(`Servidor ${baseUrl} demorou mais que o esperado para acordar.`)
              continue
            }
          }

          options.onProgress?.(
            i > 0
              ? `Servidor reserva acordado! Compilando PDF (${i + 1}/${candidates.length})...`
              : 'Servidor acordado! Compilando PDF vetorial de alta definição...'
          )

          const candidateController = new AbortController()
          const timerId = setTimeout(() => candidateController.abort(), timeoutMs)

          const onMasterAbort = () => {
            try { candidateController.abort() } catch {}
          }
          masterController.signal.addEventListener('abort', onMasterAbort, { once: true })

          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              signal: candidateController.signal,
              body: JSON.stringify({
                html: snapshotHtml,
                filename,
                format: options.pageFormat,
                width: options.customWidthMm ? `${options.customWidthMm}mm` : undefined,
                height: options.customHeightMm ? `${options.customHeightMm}mm` : undefined
              })
            })
            clearTimeout(timerId)
            masterController.signal.removeEventListener('abort', onMasterAbort)

            if (response.ok) {
              options.onProgress?.('PDF gerado com sucesso! Iniciando download...')
              const arrayBuffer = await response.arrayBuffer()
              const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.style.display = 'none'
              a.href = url
              a.setAttribute('download', filename)
              a.download = filename
              document.body.appendChild(a)
              a.click()
              // Mantém o Blob URL ativo por 60 segundos para que o download manager do Chromium
              // no Windows não aborte a gravação do arquivo e reverta para nome UUID sem extensão
              setTimeout(() => {
                try {
                  if (document.body.contains(a)) document.body.removeChild(a)
                } catch {}
                URL.revokeObjectURL(url)
              }, 60000)
              return true
            } else {
              let errDetail = ''
              try {
                const errJson = await response.json()
                errDetail = errJson.detail || JSON.stringify(errJson)
              } catch {
                errDetail = await response.text().catch(() => '')
              }
              console.warn(`[CVPrintEngine] Servidor ${endpoint} retornou status ${response.status}:`, errDetail)
              lastError = new Error(`Servidor (${baseUrl || 'local'}) respondeu ${response.status}: ${errDetail || 'Erro interno'}`)
            }
          } finally {
            clearTimeout(timerId)
            masterController.signal.removeEventListener('abort', onMasterAbort)
          }
        } catch (err: any) {
          if (masterController.signal.aborted) {
            throw new DOMException('Operação abortada pelo usuário para nova tentativa.', 'AbortError')
          }
          if (err.name === 'AbortError') {
            console.warn(`[CVPrintEngine] Timeout de ${timeoutMs}ms ao aguardar ${baseUrl}. Acionando failover...`)
            lastError = new Error(`Timeout de conexão com ${baseUrl || 'servidor'}`)
          } else {
            console.warn(`[CVPrintEngine] Exceção ao conectar com ${baseUrl}:`, err)
            lastError = err
          }
        }
      }

      console.warn('[CVPrintEngine] Nenhum servidor Playwright headless disponível. Último erro:', lastError)
      throw lastError || new Error('Falha ao conectar com o serviço Playwright.')
    } finally {
      if (this.activeAbortController === masterController) {
        this.activeAbortController = null
      }
    }
  }
}
