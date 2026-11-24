import type { ClasseHeroi, PecaId, TipoTropaAliada } from './partidaPolicies'

export type ContextoHud =
  | 'mapa_livre'
  | 'heroi_construtor'
  | 'heroi_combate'
  | 'tropas'
  | 'nucleo'
  | 'quartel'
  | 'obra'
  | 'modo_construir'

export interface EntradaContextoHud {
  readonly qtdTropasSelecionadas: number
  readonly heroiEscolhido: boolean
  readonly heroiAtivoClasse?: ClasseHeroi
  readonly obraPainelTipo: PecaId | null
  readonly modoConstruirAberto: boolean
  readonly posseAtiva?: boolean
}

export interface EstadoHudContextual {
  readonly contexto: ContextoHud
  readonly tituloPt: string
  readonly mostrarAtalhosGlobais: boolean
  readonly mostrarConstrucao: boolean
  readonly mostrarOrdensCombate: boolean
  readonly mostrarPosturas: boolean
  readonly mostrarAcoesConstrutor: boolean
  readonly mostrarProducaoQuartel: boolean
  readonly mostrarProducaoNucleo: boolean
}

/**
 * Deriva a fatia limpa do HUD contextual AoE para a barra inferior, garantindo
 * que comandos irrelevantes (ex.: atacar sem tropa ou construir quando em tropa) fiquem ocultos.
 */
export function derivarContextoHud(entrada: EntradaContextoHud): EstadoHudContextual {
  if (entrada.modoConstruirAberto) {
    return {
      contexto: 'modo_construir',
      tituloPt: 'Construir & Blocos',
      mostrarAtalhosGlobais: true,
      mostrarConstrucao: true,
      mostrarOrdensCombate: false,
      mostrarPosturas: false,
      mostrarAcoesConstrutor: entrada.heroiEscolhido && entrada.heroiAtivoClasse === 'construtor',
      mostrarProducaoQuartel: false,
      mostrarProducaoNucleo: false,
    }
  }
  if (entrada.qtdTropasSelecionadas > 0) {
    return {
      contexto: 'tropas',
      tituloPt:
        entrada.qtdTropasSelecionadas === 1
          ? '1 unidade selecionada'
          : `${entrada.qtdTropasSelecionadas} unidades`,
      mostrarAtalhosGlobais: true,
      mostrarConstrucao: false,
      mostrarOrdensCombate: true,
      mostrarPosturas: true,
      mostrarAcoesConstrutor: false,
      mostrarProducaoQuartel: false,
      mostrarProducaoNucleo: false,
    }
  }
  if (entrada.heroiEscolhido && entrada.heroiAtivoClasse === 'construtor') {
    return {
      contexto: 'heroi_construtor',
      tituloPt: 'Herói Construtor',
      mostrarAtalhosGlobais: true,
      mostrarConstrucao: true,
      mostrarOrdensCombate: false,
      mostrarPosturas: false,
      mostrarAcoesConstrutor: true,
      mostrarProducaoQuartel: false,
      mostrarProducaoNucleo: false,
    }
  }
  if (entrada.heroiEscolhido) {
    return {
      contexto: 'heroi_combate',
      tituloPt: entrada.heroiAtivoClasse === 'tanque' ? 'Herói Tanque' : 'Herói de Combate',
      mostrarAtalhosGlobais: true,
      mostrarConstrucao: false,
      mostrarOrdensCombate: true,
      mostrarPosturas: true,
      mostrarAcoesConstrutor: false,
      mostrarProducaoQuartel: false,
      mostrarProducaoNucleo: false,
    }
  }
  if (entrada.obraPainelTipo === 'quartel') {
    return {
      contexto: 'quartel',
      tituloPt: 'Quartel',
      mostrarAtalhosGlobais: true,
      mostrarConstrucao: false,
      mostrarOrdensCombate: false,
      mostrarPosturas: false,
      mostrarAcoesConstrutor: false,
      mostrarProducaoQuartel: true,
      mostrarProducaoNucleo: false,
    }
  }
  if (entrada.obraPainelTipo === 'nucleo') {
    return {
      contexto: 'nucleo',
      tituloPt: 'Núcleo',
      mostrarAtalhosGlobais: true,
      mostrarConstrucao: false,
      mostrarOrdensCombate: false,
      mostrarPosturas: false,
      mostrarAcoesConstrutor: false,
      mostrarProducaoQuartel: false,
      mostrarProducaoNucleo: true,
    }
  }
  if (entrada.obraPainelTipo !== null) {
    return {
      contexto: 'obra',
      tituloPt: 'Construção',
      mostrarAtalhosGlobais: true,
      mostrarConstrucao: false,
      mostrarOrdensCombate: false,
      mostrarPosturas: false,
      mostrarAcoesConstrutor: false,
      mostrarProducaoQuartel: false,
      mostrarProducaoNucleo: false,
    }
  }
  return {
    contexto: 'mapa_livre',
    tituloPt: 'Mapa Livre',
    mostrarAtalhosGlobais: true,
    mostrarConstrucao: false,
    mostrarOrdensCombate: false,
    mostrarPosturas: false,
    mostrarAcoesConstrutor: false,
    mostrarProducaoQuartel: false,
    mostrarProducaoNucleo: false,
  }
}

export interface UnidadeViewport {
  readonly id: number
  readonly lado: 'aliado' | 'inimigo'
  readonly hp: number
  readonly x: number
  readonly z: number
  readonly tipoTropa?: TipoTropaAliada
}

/**
 * Seleciona todas as tropas aliadas vivas do mesmo tipo visíveis dentro do retângulo NDC da câmera.
 * Garante inclusão do próprio `alvoId` clicado caso esteja vivo e aliado.
 */
export function selecionarMesmoTipoNoViewport(
  unidades: readonly UnidadeViewport[],
  alvoId: number,
  projetarParaNdc: (x: number, z: number) => { readonly x: number; readonly y: number; readonly z: number } | null,
): number[] {
  const alvo = unidades.find((u) => u.id === alvoId && u.lado === 'aliado' && u.hp > 0)
  if (!alvo) return []
  const tipoAlvo = alvo.tipoTropa ?? 'soldado'
  const ids: number[] = []
  for (const u of unidades) {
    if (u.lado !== 'aliado' || u.hp <= 0) continue
    if ((u.tipoTropa ?? 'soldado') !== tipoAlvo) continue
    if (u.id === alvo.id) {
      ids.push(u.id)
      continue
    }
    const ndc = projetarParaNdc(u.x, u.z)
    if (!ndc) continue
    if (Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1) {
      ids.push(u.id)
    }
  }
  return ids
}

export type GruposDeControle = Readonly<Record<number, readonly number[]>>

export function salvarGrupoControle(
  grupos: GruposDeControle,
  slot: number,
  ids: readonly number[],
): GruposDeControle {
  if (!Number.isInteger(slot) || slot < 1 || slot > 9) return grupos
  const filtrados = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
  if (filtrados.length === 0) {
    const copia = { ...grupos }
    delete copia[slot]
    return copia
  }
  return { ...grupos, [slot]: filtrados }
}

export function recuperarGrupoControle(
  grupos: GruposDeControle,
  slot: number,
  unidadesVivas: ReadonlySet<number>,
): number[] {
  if (!Number.isInteger(slot) || slot < 1 || slot > 9) return []
  const salvo = grupos[slot]
  if (!salvo) return []
  return salvo.filter((id) => unidadesVivas.has(id))
}
