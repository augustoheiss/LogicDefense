import { PARTIDA } from '../partidaPolicies'
import type { PartidaState } from '../partidaSim'
import type { QualidadeEfetiva } from './qualidadeGrafica'

/**
 * Avaliação pura das respostas visuais do mundo ao estado do jogo (F5, 27/11/2026).
 * Não importa `three` e nunca altera regras em `PartidaState`.
 */

export interface CorrupcaoInimiga {
  readonly x: number
  readonly z: number
  readonly raio: number
  readonly intensidade: number
}

export interface PulsoAltarVisual {
  readonly tipo: 'acerto' | 'erro'
  readonly cx: number
  readonly cz: number
  readonly assinatura: string
}

export interface PulsoNucleoVisual {
  readonly x: number
  readonly z: number
}

export interface EstadoRespostasMundo {
  readonly intensidadeOnda: number
  readonly corrupcao: CorrupcaoInimiga | null
  readonly pulsoAltar: PulsoAltarVisual | null
  readonly pulsoNucleo: PulsoNucleoVisual | null
  readonly tensaoCeu: number
  readonly animado: boolean
}

const NEUTRO: EstadoRespostasMundo = {
  intensidadeOnda: 0,
  corrupcao: null,
  pulsoAltar: null,
  pulsoNucleo: null,
  tensaoCeu: 0,
  animado: false,
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

export function avaliarRespostasDoMundo(
  state: PartidaState,
  opts: {
    readonly ativo: boolean
    readonly movimentoReduzido: boolean
    readonly noSubsolo: boolean
    readonly qualidade: QualidadeEfetiva
  },
): EstadoRespostasMundo {
  if (!opts.ativo || opts.noSubsolo || opts.qualidade === 'leve') return NEUTRO

  const restante = PARTIDA.ondaPeriodo - state.ondaRelogio
  const intensidadeOnda = restante >= 0 && restante <= 5 ? clamp((5 - restante) / 5, 0, 1) : 0

  const inimigo = state.obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo' && o.hp > 0)
  const fator = state.fatorInimigo ?? 1
  const corrupcao: CorrupcaoInimiga | null = inimigo
    ? {
        x: inimigo.x,
        z: inimigo.z,
        raio: clamp(5.5 + inimigo.nivel * 0.65 + (fator - 1) * 1.4, 5.5, 16),
        intensidade: clamp(0.35 + (inimigo.nivel - 1) * 0.08 + (fator - 1) * 0.12, 0.35, 0.92),
      }
    : null

  let pulsoAltar: PulsoAltarVisual | null = null
  if (state.altar?.resolvido) {
    const ehErro =
      /errou|incorret|errad/i.test(state.altar.aviso) ||
      (state.altar.ganhoVida !== undefined && state.altar.ganhoVida < 0)
    const tipo: 'acerto' | 'erro' = ehErro ? 'erro' : 'acerto'
    pulsoAltar = {
      tipo,
      cx: state.altar.cx,
      cz: state.altar.cz,
      assinatura: `${state.altar.cx.toFixed(1)}:${state.altar.cz.toFixed(1)}:${tipo}:${state.altar.aviso}`,
    }
  } else if (state.altar && state.altar.erros > 0) {
    pulsoAltar = {
      tipo: 'erro',
      cx: state.altar.cx,
      cz: state.altar.cz,
      assinatura: `${state.altar.cx.toFixed(1)}:${state.altar.cz.toFixed(1)}:erro:${state.altar.erros}`,
    }
  }

  let pulsoNucleo: PulsoNucleoVisual | null = null
  if (state.heroiCaido === true) {
    const nucleoNosso = state.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo' && o.hp > 0)
    if (nucleoNosso) {
      pulsoNucleo = { x: nucleoNosso.x, z: nucleoNosso.z }
    }
  }

  const tensaoCeu = clamp(
    intensidadeOnda * 0.35 + (state.heroiCaido === true ? 0.45 : 0) + (state.derrota ? 0.7 : 0),
    0,
    1,
  )

  return {
    intensidadeOnda,
    corrupcao,
    pulsoAltar,
    pulsoNucleo,
    tensaoCeu,
    animado: !opts.movimentoReduzido,
  }
}
