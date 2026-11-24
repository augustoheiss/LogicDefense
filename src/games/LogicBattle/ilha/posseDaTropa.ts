import { SPEC_TROPA_ALIADA, type Olhar } from './partidaPolicies'
import type { PartidaState, Unidade } from './partidaSim'

/**
 * Retorna a unidade aliada viva atualmente possuída pelo jogador, ou `null` caso não exista posse ativa ou a unidade tenha morrido.
 */
export function alvoPossuidoVivo(state: PartidaState): Unidade | null {
  if (!state.posse) return null
  const u = state.unidades.find((item) => item.id === state.posse!.unidadeId && item.lado === 'aliado' && item.hp > 0)
  return u ?? null
}

/**
 * Assume controle direto em 1ª ou 3ª pessoa de uma tropa aliada viva, suspendendo ordens autônomas e limpando âncora/rota prévia.
 */
export function entrarEmPosseTropa(
  state: PartidaState,
  unidadeId: number,
  modo: 'primeira' | 'terceira',
): PartidaState {
  if (state.derrota) return state
  const alvo = state.unidades.find((u) => u.id === unidadeId && u.lado === 'aliado' && u.hp > 0)
  if (!alvo) return state
  const preservandoMesmoAlvo = state.posse?.unidadeId === unidadeId
  return {
    ...state,
    olhar: modo,
    posse: {
      tipo: 'tropa',
      unidadeId: alvo.id,
      modo,
      yaw: preservandoMesmoAlvo ? state.posse!.yaw : state.heroi.yaw,
      pitch: preservandoMesmoAlvo ? state.posse!.pitch : 0,
      y: preservandoMesmoAlvo ? state.posse!.y : 0,
      vy: preservandoMesmoAlvo ? state.posse!.vy : 0,
      shootCooldown: preservandoMesmoAlvo ? state.posse!.shootCooldown : 0,
    },
    unidades: state.unidades.map((u) =>
      u.id === alvo.id
        ? { ...u, ordem: null, rota: null, ancora: null, postura: u.posturaBase ?? 'vigia' }
        : u,
    ),
  }
}

/**
 * Libera a posse de tropa atual e retorna o olhar para o modo solicitado (`'imperio'` por padrão ao apertar `3`, ou `'terceira'` ao focar o Herói `H`).
 */
export function sairDaPosse(state: PartidaState, olharDestino: Olhar = 'imperio'): PartidaState {
  if (!state.posse) {
    if (state.semCorpo || state.olhar === olharDestino) return state
    return { ...state, olhar: olharDestino }
  }
  return {
    ...state,
    posse: null,
    olhar: state.semCorpo ? 'imperio' : olharDestino,
  }
}

export function tituloUnidadePossuida(unidade: Unidade): string {
  return SPEC_TROPA_ALIADA[unidade.tipoTropa ?? 'soldado'].tituloPt
}
