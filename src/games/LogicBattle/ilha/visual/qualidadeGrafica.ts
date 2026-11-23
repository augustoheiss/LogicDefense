import type { QualidadeGraficaPreset } from '../partidaPolicies'

export type QualidadeEfetiva = 'leve' | 'bonito' | 'ultra'

export interface SpecQualidadeGrafica {
  readonly efetiva: QualidadeEfetiva
  readonly rotulo: string
  readonly texturaRes: 256 | 512 | 1024
  readonly shadowMapSize: 0 | 1024 | 2048
  readonly sombrasAtivas: boolean
  readonly dprMax: number
  readonly maxGrama: number
  readonly maxFlores: number
  readonly maxPedras: number
  readonly aguaAnimada: boolean
  readonly ceuProcedural: boolean
  readonly suportaPackExternoUltra: boolean
}

export const SPEC_QUALIDADE: Readonly<Record<QualidadeEfetiva, SpecQualidadeGrafica>> = {
  leve: {
    efetiva: 'leve',
    rotulo: 'Leve',
    texturaRes: 256,
    shadowMapSize: 0,
    sombrasAtivas: false,
    dprMax: 1,
    maxGrama: 0,
    maxFlores: 0,
    maxPedras: 24,
    aguaAnimada: false,
    ceuProcedural: false,
    suportaPackExternoUltra: false,
  },
  bonito: {
    efetiva: 'bonito',
    rotulo: 'Bonito',
    texturaRes: 512,
    shadowMapSize: 1024,
    sombrasAtivas: true,
    dprMax: 1.5,
    maxGrama: 950,
    maxFlores: 140,
    maxPedras: 80,
    aguaAnimada: true,
    ceuProcedural: true,
    suportaPackExternoUltra: false,
  },
  ultra: {
    efetiva: 'ultra',
    rotulo: 'Ultra',
    texturaRes: 512,
    shadowMapSize: 2048,
    sombrasAtivas: true,
    dprMax: 2,
    maxGrama: 2200,
    maxFlores: 280,
    maxPedras: 140,
    aguaAnimada: true,
    ceuProcedural: true,
    suportaPackExternoUltra: true,
  },
}

export interface EstadoQualidadeGrafica {
  readonly preset: QualidadeGraficaPreset
  readonly efetiva: QualidadeEfetiva
  readonly tempoAcimaDe33Ms: number
  readonly tempoAbaixoDe17Ms: number
  readonly contextLost: boolean
}

export const CHAVE_QUALIDADE_STORAGE = 'ld_ilha_qualidade_v1'

export function criarEstadoQualidade(preset: QualidadeGraficaPreset = 'auto'): EstadoQualidadeGrafica {
  return {
    preset,
    efetiva: preset === 'auto' ? 'bonito' : preset,
    tempoAcimaDe33Ms: 0,
    tempoAbaixoDe17Ms: 0,
    contextLost: false,
  }
}

export function definirPresetQualidade(
  estado: EstadoQualidadeGrafica,
  preset: QualidadeGraficaPreset,
): EstadoQualidadeGrafica {
  if (estado.contextLost) {
    return { ...estado, preset: 'leve', efetiva: 'leve', tempoAcimaDe33Ms: 0, tempoAbaixoDe17Ms: 0 }
  }
  return {
    preset,
    efetiva: preset === 'auto' ? 'bonito' : preset,
    tempoAcimaDe33Ms: 0,
    tempoAbaixoDe17Ms: 0,
    contextLost: false,
  }
}

export function aplicarContextLost(estado: EstadoQualidadeGrafica): EstadoQualidadeGrafica {
  return {
    ...estado,
    preset: 'leve',
    efetiva: 'leve',
    tempoAcimaDe33Ms: 0,
    tempoAbaixoDe17Ms: 0,
    contextLost: true,
  }
}

export function passoAutoQualidade(
  estado: EstadoQualidadeGrafica,
  emaFrameMs: number,
  dt: number,
): EstadoQualidadeGrafica {
  if (estado.contextLost || estado.preset !== 'auto' || !Number.isFinite(emaFrameMs) || !Number.isFinite(dt) || dt <= 0) {
    return estado
  }
  if (emaFrameMs > 33) {
    const tempoAcimaDe33Ms = estado.tempoAcimaDe33Ms + dt
    if (tempoAcimaDe33Ms >= 3.0) {
      const proxima: QualidadeEfetiva = estado.efetiva === 'ultra' ? 'bonito' : 'leve'
      if (proxima !== estado.efetiva) {
        return { ...estado, efetiva: proxima, tempoAcimaDe33Ms: 0, tempoAbaixoDe17Ms: 0 }
      }
    }
    return { ...estado, tempoAcimaDe33Ms, tempoAbaixoDe17Ms: 0 }
  }
  if (emaFrameMs < 17) {
    const tempoAbaixoDe17Ms = estado.tempoAbaixoDe17Ms + dt
    if (tempoAbaixoDe17Ms >= 10.0) {
      const proxima: QualidadeEfetiva = estado.efetiva === 'leve' ? 'bonito' : 'ultra'
      if (proxima !== estado.efetiva) {
        return { ...estado, efetiva: proxima, tempoAcimaDe33Ms: 0, tempoAbaixoDe17Ms: 0 }
      }
    }
    return { ...estado, tempoAcimaDe33Ms: 0, tempoAbaixoDe17Ms }
  }
  return { ...estado, tempoAcimaDe33Ms: 0, tempoAbaixoDe17Ms: 0 }
}

export function specDeQualidade(estado: EstadoQualidadeGrafica): SpecQualidadeGrafica {
  return SPEC_QUALIDADE[estado.efetiva]
}

export function carregarPresetQualidadeSalvo(): QualidadeGraficaPreset {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'auto'
    const salvo = window.localStorage.getItem(CHAVE_QUALIDADE_STORAGE)
    if (salvo === 'auto' || salvo === 'leve' || salvo === 'bonito' || salvo === 'ultra') return salvo
    return 'auto'
  } catch {
    return 'auto'
  }
}

export function salvarPresetQualidade(preset: QualidadeGraficaPreset): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(CHAVE_QUALIDADE_STORAGE, preset)
  } catch {
    // Ignora storage privado/bloqueado
  }
}
