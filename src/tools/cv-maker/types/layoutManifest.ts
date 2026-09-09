/**
 * layoutManifest.ts
 *
 * Contrato de persistência não-destrutiva de apresentação visual (Sidecar Pattern)
 * do Universal Document Compiler / LogicDefense CV Maker.
 *
 * Desacopla 100% o código-fonte YAML (que permanece semântico, limpo e sem poluição de tags visuais)
 * das propriedades de geometria contínua, tipografia, escala, profundidade (Z-index) e visibilidade
 * ajustadas pelo usuário na folha A4/Letter do Modo Livre Canvas.
 *
 * Cada override é indexado por um SemanticPathPointer estável (ex: "/[section='cronograma_entregas']"),
 * garantindo que reordenações no código ou no canvas não quebrem a associação visual.
 */

export interface BoxVisualOverride {
  // Geometria e Dimensões Contínuas
  widthPercent?: number          // 10% a 100% da largura útil da folha A4/Letter
  minHeightPx?: number           // Altura mínima em pixels
  maxHeightPx?: number           // Altura máxima com corte suave protetivo
  marginTopPx?: number           // Deslocamento vertical livre no plano (offset 2D)
  marginLeftPx?: number          // Deslocamento horizontal livre no plano (offset 2D)
  alignment?: 'left' | 'center' | 'right'
  zIndex?: number                // Profundidade Z de sobreposição na folha (0 a 50)
  order?: number                 // Ordem flexível dentro da coluna/zona

  // Tipografia e Escala Local por Caixa
  fontFamily?: string            // Família tipográfica individual (ex: "Space Grotesk")
  fontSizeScale?: number         // Multiplicador contínuo de fonte (0.70 a 1.40)
  variant?: string               // Variante visual (ex: 'card_box', 'minimal_border')
  hidden?: boolean               // Se o usuário ocultou esta caixa específica da folha e do PDF

  // Cores de Superfície e Borda do Box
  bgColor?: string
  borderColor?: string
  textColor?: string
  titleColor?: string
  accentColor?: string
  bgImage?: string
}

export interface LayoutManifestSidecar {
  version: '2.0.0'
  documentId?: string
  pageFormat?: 'a4' | 'a3' | 'a5' | 'letter' | 'legal' | 'tabloid' | 'custom'
  columnSplitRatio?: number      // Splitter de colunas mestres (ex: 32%)
  
  // Overrides visuais indexados por SemanticPathPointer ou chave de seção
  // Ex: "/[section='cronograma_entregas']" -> Override da seção inteira
  // Ex: "/[section='modulos_sistema']/[item='0']" -> Override do card interno
  blocks: Record<string, BoxVisualOverride>

  // Ordem declarativa de apresentação das seções no documento
  sectionOrder?: string[]

  // Seção atribuída à coluna/zona (para layouts multicoluna como sidebar)
  sectionZone?: Record<string, 'left' | 'right'>
}
