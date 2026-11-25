/**
 * Liga a questão à figura recortada da prova e separa o papel de cada imagem
 * para a apresentação editorial ("Abertura"):
 *
 * ENEM:  public/enem/figuras, chave `ano:questão` (136 a 180).
 * SENAI: public/senai/figuras, chave `senai:ano:cge:questão`.
 * ETEC:  public/etec/figuras, chave `etec:ano:semestre:questão`.
 */
import type { DesafioUnificado, FiguraOficial } from './contratosEstudo'
import { FIGURAS_ENEM } from './bancos/figurasEnem.manifest'
import { FIGURAS as FIGURAS_ETEC } from './bancos/figurasEtec.manifest'
import { FIGURAS as FIGURAS_SENAI } from './bancos/figurasSenai.manifest'

export type LetraAlternativaVisual = 'A' | 'B' | 'C' | 'D' | 'E'

export interface FigurasClassificadas {
  readonly enunciado: readonly FiguraOficial[]
  readonly alternativasPorLetra: Readonly<Partial<Record<LetraAlternativaVisual, FiguraOficial>>>
  readonly modoAlternativaVisual: boolean
}

export function chaveDaFigura(ano: number, questao: number): string {
  return `${ano}:${questao}`
}

export function figurasPelaChave(chave: string): readonly FiguraOficial[] {
  return FIGURAS_ENEM[chave] ?? FIGURAS_SENAI[chave] ?? FIGURAS_ETEC[chave] ?? []
}

export function figurasEfetivas(
  desafio: Pick<DesafioUnificado, 'figuras' | 'chaveFigura' | 'referenciaOficial'>,
): readonly FiguraOficial[] {
  if (Array.isArray(desafio.figuras)) return desafio.figuras
  if (desafio.chaveFigura) return figurasPelaChave(desafio.chaveFigura)
  const ref = desafio.referenciaOficial
  if (!ref) return []
  return figurasPelaChave(chaveDaFigura(ref.ano, ref.questao))
}

/**
 * Separa figuras em arranjo de enunciado vs arranjo visual por alternativa A–E.
 *
 * Regras da auditoria/apresentação:
 *  1. Só promove a `modoAlternativaVisual = true` se houver >= 3 letras distintas e sem duplicatas.
 *  2. Se o enunciado já renderiza uma tabela Markdown estruturada (`enunciadoTemTabela`),
 *     figuras puramente de `tipoVisual === 'tabela'` são omitidas para não duplicar dados na tela.
 */
export function classificarFigurasParaApresentacao(
  figuras: readonly FiguraOficial[],
  opcoes?: { readonly enunciadoTemTabela?: boolean },
): FigurasClassificadas {
  const filtradas = opcoes?.enunciadoTemTabela
    ? figuras.filter((f) => f.tipoVisual !== 'tabela')
    : figuras

  if (filtradas.length === 0) {
    return { enunciado: [], alternativasPorLetra: {}, modoAlternativaVisual: false }
  }

  const porLetra: Partial<Record<LetraAlternativaVisual, FiguraOficial>> = {}
  const candidatasAlt: FiguraOficial[] = []
  let duplicada = false

  for (const fig of filtradas) {
    if (fig.papel === 'alternativa' && fig.letra) {
      if (porLetra[fig.letra]) {
        duplicada = true
        break
      }
      porLetra[fig.letra] = fig
      candidatasAlt.push(fig)
    }
  }

  const letrasValidas = Object.keys(porLetra).length
  if (!duplicada && letrasValidas >= 3) {
    const enunciado = filtradas.filter((f) => f.papel !== 'alternativa')
    return {
      enunciado,
      alternativasPorLetra: porLetra,
      modoAlternativaVisual: true,
    }
  }

  return {
    enunciado: filtradas,
    alternativasPorLetra: {},
    modoAlternativaVisual: false,
  }
}
