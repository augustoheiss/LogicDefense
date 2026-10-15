/**
 * canvasStudio.ts
 * ============================================================================
 * Tipagens e Presets do Estúdio de Engenharia Visual de Documentos
 * (Tríade AutoCAD + MS Word / Docx + MS Paint + Figma Container Frames)
 * ============================================================================
 * Projetado para funcionar tanto no CV Maker quanto na futura exportação
 * universal de PDFs do Sekundo (programação de eventos, cartões de territórios,
 * plantas técnicas e quadros operacionais).
 */

/**
 * Representa um fragmento atômico de texto em linha (inspirado no <w:r> TextRun do OpenXML/Docx).
 * Permite colocar várias frases lado a lado na mesma linha com fontes, tamanhos,
 * pesos, cores e fundos independentes, alinhadas pela linha de base tipográfica.
 */
export interface InlineTextSpan {
  id: string
  text: string
  fontFamily?: string
  fontSizePt?: number
  fontWeight?: 300 | 400 | 500 | 600 | 700 | 800 | 900
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'line-through'
  color?: string
  backgroundColor?: string
  paddingHorizontalPx?: number
  paddingVerticalPx?: number
  borderRadiusPx?: number
  letterSpacingEm?: number
  uppercase?: boolean
  marginLeftPx?: number
}

/**
 * Tipos de elementos ricos que podem ser adicionados dentro de qualquer
 * Sidebar / Zona Customizada (CanvasContainerFrame) ou soltos na folha A4.
 */
export type StudioElementType =
  | 'heading'          // Título principal com suporte a múltiplos spans lado a lado
  | 'subtitle'         // Subtítulo editorial ou técnico
  | 'rich_row'         // Linha multi-frase (Docx TextRun: frase A ao lado da frase B com outra fonte/cor)
  | 'paragraph'        // Parágrafo de texto rico
  | 'badge_group'      // Grupo de pílulas / tags coloridas lado a lado
  | 'divider'          // Linha divisória técnica / ornamental
  | 'key_value_pair'   // Par Rótulo + Valor (ideal para metadados de CV ou territórios/eventos Sekundo)
  | 'cad_callout'      // Cota / etiqueta técnica estilo AutoCAD com código e descrição

/**
 * Elemento estruturado do Estúdio PDF (pode residir dentro de uma CustomCanvasZone
 * ou diretamente sobre a folha como elemento livre).
 */
export interface CanvasStudioElement {
  id: string
  type: StudioElementType
  /**
   * Lista de fragmentos (frases lado a lado) que compõem este elemento.
   * Cada span pode ter sua própria fonte, cor, tamanho, peso e badge!
   */
  spans: InlineTextSpan[]
  align?: 'left' | 'center' | 'right' | 'justify'
  gapPx?: number
  marginTopPx?: number
  marginBottomPx?: number
  paddingPx?: number
  backgroundColor?: string
  borderColor?: string
  borderWidthPx?: number
  borderRadiusPx?: number
  dividerStyle?: 'solid' | 'dashed' | 'dotted' | 'double'
  dividerThicknessPx?: number
  dividerColor?: string
  // Coordenadas livres opcionais (0 a 100% da folha) quando o elemento é colocado solto na página
  x?: number
  y?: number
  width?: number
  zIndex?: number
}

/**
 * Configurações de Precisão Euclidiana estilo AutoCAD
 */
export interface CadCanvasSettings {
  showRulers?: boolean
  showGrid?: boolean
  snapToGrid?: boolean
  gridSizeMm?: number
  showCoordinatesHud?: boolean
}

/**
 * Formato copiado pelo Pintor de Estilo / Conta-Gotas (MS Paint / Word Format Painter)
 */
export interface CopiedSpanStyle {
  fontFamily?: string
  fontSizePt?: number
  fontWeight?: 300 | 400 | 500 | 600 | 700 | 800 | 900
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'line-through'
  color?: string
  backgroundColor?: string
  borderRadiusPx?: number
  paddingHorizontalPx?: number
  uppercase?: boolean
}

/**
 * Fábrica auxiliar para criar novos elementos ricos com spans iniciais prontos para edição
 */
export function createStudioElement(
  type: StudioElementType,
  options?: {
    darkBackground?: boolean
    accentColor?: string
    x?: number
    y?: number
    width?: number
  }
): CanvasStudioElement {
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const isDark = options?.darkBackground ?? false
  const primaryText = isDark ? '#f8fafc' : '#0f172a'
  const secondaryText = isDark ? '#94a3b8' : '#475569'
  const accent = options?.accentColor || (isDark ? '#38bdf8' : '#0284c7')

  const baseCoords =
    typeof options?.x === 'number'
      ? { x: options.x, y: options.y ?? 10, width: options.width ?? 45, zIndex: 15 }
      : {}

  switch (type) {
    case 'heading':
      return {
        id: `el-hd-${uid()}`,
        type: 'heading',
        align: 'left',
        gapPx: 8,
        marginTopPx: 6,
        marginBottomPx: 4,
        ...baseCoords,
        spans: [
          {
            id: `sp-${uid()}`,
            text: 'TÍTULO DA SEÇÃO',
            fontFamily: 'Plus Jakarta Sans',
            fontSizePt: 13,
            fontWeight: 800,
            color: primaryText,
            uppercase: true,
            letterSpacingEm: 0.05
          }
        ]
      }

    case 'subtitle':
      return {
        id: `el-sub-${uid()}`,
        type: 'subtitle',
        align: 'left',
        gapPx: 6,
        marginTopPx: 2,
        marginBottomPx: 6,
        ...baseCoords,
        spans: [
          {
            id: `sp-${uid()}`,
            text: 'Subtítulo ou Especialidade',
            fontFamily: 'Merriweather',
            fontSizePt: 10,
            fontWeight: 600,
            fontStyle: 'italic',
            color: accent
          }
        ]
      }

    case 'rich_row':
      return {
        id: `el-row-${uid()}`,
        type: 'rich_row',
        align: 'left',
        gapPx: 8,
        marginTopPx: 4,
        marginBottomPx: 4,
        ...baseCoords,
        spans: [
          {
            id: `sp-${uid()}`,
            text: 'Frase Principal',
            fontFamily: 'Plus Jakarta Sans',
            fontSizePt: 11,
            fontWeight: 700,
            color: primaryText
          },
          {
            id: `sp-${uid()}`,
            text: '• Frase ao lado com outra fonte',
            fontFamily: 'Cinzel',
            fontSizePt: 10,
            fontWeight: 600,
            color: accent
          }
        ]
      }

    case 'key_value_pair':
      return {
        id: `el-kv-${uid()}`,
        type: 'key_value_pair',
        align: 'left',
        gapPx: 6,
        marginTopPx: 3,
        marginBottomPx: 3,
        ...baseCoords,
        spans: [
          {
            id: `sp-${uid()}`,
            text: 'RÓTULO:',
            fontFamily: 'Fira Code',
            fontSizePt: 8.5,
            fontWeight: 700,
            color: accent,
            uppercase: true
          },
          {
            id: `sp-${uid()}`,
            text: 'Valor descritivo editável',
            fontFamily: 'Inter',
            fontSizePt: 9.5,
            fontWeight: 500,
            color: primaryText
          }
        ]
      }

    case 'badge_group':
      return {
        id: `el-bg-${uid()}`,
        type: 'badge_group',
        align: 'left',
        gapPx: 6,
        marginTopPx: 4,
        marginBottomPx: 6,
        ...baseCoords,
        spans: [
          {
            id: `sp-${uid()}`,
            text: 'TAG 01',
            fontFamily: 'Plus Jakarta Sans',
            fontSizePt: 8,
            fontWeight: 700,
            color: '#ffffff',
            backgroundColor: accent,
            paddingHorizontalPx: 8,
            paddingVerticalPx: 3,
            borderRadiusPx: 99
          },
          {
            id: `sp-${uid()}`,
            text: 'Destaque Lateral',
            fontFamily: 'Fira Code',
            fontSizePt: 8,
            fontWeight: 600,
            color: isDark ? '#e2e8f0' : '#1e293b',
            backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#e2e8f0',
            paddingHorizontalPx: 8,
            paddingVerticalPx: 3,
            borderRadiusPx: 6
          }
        ]
      }

    case 'cad_callout':
      return {
        id: `el-cad-${uid()}`,
        type: 'cad_callout',
        align: 'left',
        gapPx: 8,
        marginTopPx: 4,
        marginBottomPx: 4,
        paddingPx: 6,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : '#f8fafc',
        borderColor: accent,
        borderWidthPx: 1,
        borderRadiusPx: 4,
        ...baseCoords,
        spans: [
          {
            id: `sp-${uid()}`,
            text: '[CAD-REF 01]',
            fontFamily: 'Fira Code',
            fontSizePt: 8,
            fontWeight: 700,
            color: '#ffffff',
            backgroundColor: accent,
            paddingHorizontalPx: 6,
            paddingVerticalPx: 2,
            borderRadiusPx: 3
          },
          {
            id: `sp-${uid()}`,
            text: 'Especificação Técnica / Setor Norte',
            fontFamily: 'Plus Jakarta Sans',
            fontSizePt: 9.5,
            fontWeight: 600,
            color: primaryText
          }
        ]
      }

    case 'divider':
      return {
        id: `el-div-${uid()}`,
        type: 'divider',
        marginTopPx: 6,
        marginBottomPx: 6,
        dividerStyle: 'solid',
        dividerThicknessPx: 1.5,
        dividerColor: accent,
        ...baseCoords,
        spans: []
      }

    case 'paragraph':
    default:
      return {
        id: `el-par-${uid()}`,
        type: 'paragraph',
        align: 'left',
        gapPx: 4,
        marginTopPx: 3,
        marginBottomPx: 5,
        ...baseCoords,
        spans: [
          {
            id: `sp-${uid()}`,
            text: 'Texto editável. Dê duplo clique para alterar o conteúdo ou adicione outra frase ao lado com fonte e cor diferentes.',
            fontFamily: 'Inter',
            fontSizePt: 9.5,
            fontWeight: 400,
            color: secondaryText
          }
        ]
      }
  }
}
