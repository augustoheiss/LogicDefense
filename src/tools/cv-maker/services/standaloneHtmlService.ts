/**
 * standaloneHtmlService.ts — Empacotador e Exportador ZIP de Dados Estruturados (Client-Side)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Gera pacotes ZIP 100% autônomos e offline contendo os dados canônicos em YAML
 * (JSON Resume v1.0.0), a carta de apresentação em TXT limpo e o guia de integração LEIAME.txt.
 * 
 * Conforme a arquitetura 2.0/3.0, a geração de cópias estáticas em HTML foi descontinuada
 * em favor da compilação vetorial determinística via DOMSnapshotSerializer / CVPrintEngine.
 */

import JSZip from 'jszip'
import type { ThemeVariant, LayoutVariant, CVDesignConfig } from '../types/cv'
import { parseYamlToCV } from './yamlService'

/**
 * @deprecated O exportador para HTML standalone foi desativado conforme decisão arquitetural (foco em PDF nativo e YAML/ZIP).
 */
export function downloadCVHtmlFile(): void {
  console.warn('[CV-Maker] Exportação para HTML standalone desativada. Utilize Imprimir / Salvar PDF ou Baixar .yaml / .zip.')
}

/**
 * @deprecated O exportador para HTML standalone foi desativado conforme decisão arquitetural.
 */
export function downloadCVCoverLetterHtml(): void {
  console.warn('[CV-Maker] Exportação para HTML standalone desativada. Utilize Imprimir / Salvar PDF ou Baixar .yaml / .zip.')
}

/**
 * Dispara o download do pacote ZIP de dados estruturados (.yaml + carta + metadados/guia IA)
 */
export async function downloadCVZipPackage(params: {
  yaml: string
  name: string
  persona?: string
  theme?: ThemeVariant
  layout?: LayoutVariant
  designConfig?: CVDesignConfig
}): Promise<void> {
  try {
    const parsed = parseYamlToCV(params.yaml)
    const cleanName = params.name.toLowerCase().replace(/\s+/g, '-') || 'curriculo'
    const baseName = `curriculo-${cleanName}-dados`

    const zip = new JSZip()
    // 1. Arquivo principal YAML estruturado (fonte única de verdade)
    zip.file(`1_curriculo_${cleanName}.yaml`, params.yaml)

    // 2. Se houver coverLetter nos dados, salvar arquivo de texto limpo
    if (parsed.data?.coverLetter) {
      const cl = parsed.data.coverLetter
      const recipientName = typeof cl.recipient === 'string' ? cl.recipient : cl.recipient?.name || ''
      const companyName = cl.company || (typeof cl.recipient !== 'string' ? cl.recipient?.company : '') || ''
      const clLines = [
        `# Carta de Apresentação — ${parsed.data.basics?.name || params.name}`,
        `# Data: ${cl.date || new Date().toLocaleDateString('pt-BR')}`,
        recipientName ? `# Destinatário: ${recipientName}` : '',
        companyName ? `# Empresa: ${companyName}` : '',
        cl.subject ? `# Assunto: ${cl.subject}` : '',
        '',
        cl.salutation ? `${cl.salutation}\n` : '',
        ...(cl.paragraphs || (cl.body ? [cl.body] : [])),
        '',
        cl.closing || 'Atenciosamente,',
        cl.signature || parsed.data.basics?.name || params.name
      ].filter(line => line !== '').join('\n\n')

      zip.file(`2_carta_apresentacao_${cleanName}.txt`, clLines)
    }

    // 3. LEIAME.txt com instruções de uso com IAs
    const readmeLines = [
      'CV Maker — Pacote de Dados Estruturados (YAML)',
      '================================================================',
      `Candidato: ${params.name}`,
      `Data de Exportação: ${new Date().toLocaleString('pt-BR')}`,
      `Modelo A4 Utilizado: ${params.layout || 'modular'}`,
      params.persona ? `Persona IA: ${params.persona}` : '',
      '',
      'Arquivos incluídos neste pacote:',
      `1. 1_curriculo_${cleanName}.yaml -> Fonte única de verdade em formato YAML (padrão JSON Resume).`,
      parsed.data?.coverLetter ? `2. 2_carta_apresentacao_${cleanName}.txt -> Carta de apresentação gerada para a vaga.` : '',
      '',
      'Como usar este arquivo .yaml:',
      '• No CV Maker: Você pode importar este arquivo .yaml a qualquer momento para editar ou trocar de modelo A4.',
      '• Com Inteligências Artificiais (ChatGPT, Claude, Gemini, DeepSeek):',
      '  Copie e cole o conteúdo do .yaml e use prompts como:',
      '  "Com base nos meus dados profissionais estruturados em YAML abaixo, adapte meus resumos e experiências para a vaga X:"',
      '• Para envio oficial a recrutadores: Utilize a exportação nativa em PDF do CV Maker (Imprimir / Salvar PDF), que gera o layout A4 com tipografia e diagramação impecáveis.',
      '',
      'Gerado com tecnologia LogicDefense & HeissLab: https://www.heisslab.com.br/laboratorio/cv-maker'
    ].filter(line => line !== '').join('\n')

    zip.file('LEIAME.txt', readmeLines)

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Falha ao gerar ZIP local:', err)
  }
}
