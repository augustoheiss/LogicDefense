/**
 * Validador puro Zero-Spoiler (Fases Q2–Q4).
 *
 * Garante que NENHUMA dica progressiva (níveis 1, 2 e 3) nem nenhum `diagnosticoPt` de alternativa
 * ERRADA entregue ao aluno o valor numérico, fração formatada, rótulo completo ou letra da resposta certa.
 */
import type { DesafioUnificado } from './contratosEstudo'

/** Mesma semântica estrita do E2.5, estendida para reconhecer separador de milhar BR (`1.460` ou `1 460`). */
export function valorIsoladoNoTexto(valor: string, texto: string): boolean {
  if (!valor || !texto) return false
  const escaped = valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^0-9.,-])${escaped}([^0-9]|[.,](?![0-9])|$)`).test(texto)
}

function formasNumericasDaResposta(valorNumerico: number | undefined, rotulo: string): string[] {
  const formas = new Set<string>()
  if (typeof valorNumerico === 'number' && Number.isFinite(valorNumerico)) {
    const abs = Math.abs(valorNumerico)
    const strDot = String(valorNumerico)
    const strComma = strDot.replace('.', ',')
    formas.add(strDot)
    formas.add(strComma)
    if (Number.isInteger(abs) && abs >= 1000) {
      const sinal = valorNumerico < 0 ? '-' : ''
      const s = String(abs)
      const ptBrDot = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      const ptBrSpc = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
      formas.add(`${sinal}${ptBrDot}`)
      formas.add(`${sinal}${ptBrSpc}`)
    }
  }
  const limpoRotulo = rotulo.trim().replace(/[.,;!?]+$/, '')
  // Se o rótulo inteiro é um número (com ou sem espaço/ponto), também protege esse texto exato
  if (/^-?\d[\d\s.,]*\d$|^-?\d$/.test(limpoRotulo)) {
    formas.add(limpoRotulo)
  } else if (valorNumerico === undefined) {
    // Rótulos compostos (ex.: "29,60 e 11,11"): protege números decimais individuais
    for (const dec of limpoRotulo.matchAll(/-?\d+,\d+/g)) {
      formas.add(dec[0])
    }
  }
  return [...formas].filter((f) => f.length > 0)
}

function mencionaLetraCorreta(letra: string, texto: string): boolean {
  const l = letra.toUpperCase()
  return new RegExp(`\\b(letra|alternativa|op[çc][aã]o|gabarito|item|marque|marcar|resposta)\\s*[:\\-]?\\s*${l}\\b`, 'i').test(texto)
}

function checarTextoSemSpoiler(
  campo: string,
  texto: string,
  formasValor: readonly string[],
  letraCorreta: string,
  rotuloCorretoLimpo: string,
  rotuloNoEnunciado: boolean,
  enunciado: string,
): string[] {
  const violacoes: string[] = []
  if (!texto || !texto.trim()) {
    violacoes.push(`${campo}: texto vazio`)
    return violacoes
  }
  if (mencionaLetraCorreta(letraCorreta, texto)) {
    violacoes.push(`${campo}: revela a letra correta (${letraCorreta}) em «${texto}»`)
  }
  for (const fv of formasValor) {
    // Se a própria forma exata já constava no enunciado original, não é segredo
    if (valorIsoladoNoTexto(fv, enunciado)) continue
    if (valorIsoladoNoTexto(fv, texto)) {
      violacoes.push(`${campo}: vaza o valor certo «${fv}» em «${texto}»`)
    }
  }
  if (!rotuloNoEnunciado && rotuloCorretoLimpo.length >= 4 && !/^-?\d[\d\s.,]*$/.test(rotuloCorretoLimpo)) {
    const tNorm = texto.toLowerCase().replace(/\s+/g, ' ')
    const rNorm = rotuloCorretoLimpo.toLowerCase().replace(/\s+/g, ' ')
    // Só acusa substring textual exata quando não for apenas uma palavra genérica do enunciado
    if (rNorm.length >= 8 && tNorm.includes(rNorm)) {
      violacoes.push(`${campo}: vaza rótulo textual da correta «${rotuloCorretoLimpo}»`)
    }
  }
  return violacoes
}

export function validarDesafioZeroSpoiler(desafio: DesafioUnificado): { ok: boolean; violacoes: string[] } {
  const violacoes: string[] = []
  if (desafio.dicas.length !== 3) {
    violacoes.push(`Esperava exatamente 3 dicas progressivas, veio ${desafio.dicas.length}`)
  }
  const corretas = desafio.alternativas.filter((a) => a.correta)
  if (corretas.length !== 1) {
    violacoes.push(`Esperava exatamente 1 alternativa correta, achei ${corretas.length}`)
    return { ok: false, violacoes }
  }
  const certa = corretas[0]
  const enunciadoNorm = desafio.enunciadoMarkdown.replace(/\{,\}/g, ',')
  const formasValor = formasNumericasDaResposta(certa.valorNumerico, certa.rotulo)
  const rotuloLimpo = certa.rotulo.trim().replace(/[.,;!?]+$/, '')
  const rotuloNoEnunciado = enunciadoNorm.toLowerCase().includes(rotuloLimpo.toLowerCase())

  for (const dica of desafio.dicas) {
    violacoes.push(
      ...checarTextoSemSpoiler(
        `dica[${dica.nivel}]`,
        dica.textoPt,
        formasValor,
        certa.letra,
        rotuloLimpo,
        rotuloNoEnunciado,
        enunciadoNorm,
      ),
    )
  }

  for (const alt of desafio.alternativas) {
    if (alt.correta) continue
    violacoes.push(
      ...checarTextoSemSpoiler(
        `alternativa_errada[${alt.letra}].diagnosticoPt`,
        alt.diagnosticoPt,
        formasValor,
        certa.letra,
        rotuloLimpo,
        rotuloNoEnunciado,
        enunciadoNorm,
      ),
    )
  }

  return { ok: violacoes.length === 0, violacoes }
}
