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
  /** Pós-processamento HDR (`EffectComposer`): o Leve NUNCA liga (é a rede de segurança de máquina fraca). */
  readonly posProcessamento: boolean
  /** Bloom seletivo (só o que passa de 1,1 de luminância HDR brilha: lava, tocha, cristal, sol na água). */
  readonly bloom: boolean
  /** Oclusão ambiente de tela (GTAO), a meia resolução: só o Ultra. */
  readonly ao: boolean
  /** Amostras de MSAA do alvo do composer (0 = sem pós-processamento). */
  readonly msaa: 0 | 4
  /** Filtragem anisotrópica das texturas do chão (o chão rasante deixa de borrar). Limitada em runtime por `getMaxAnisotropy()`. */
  readonly anisotropia: 2 | 8 | 16
  /** Ambiente por IBL (`scene.environment`, do céu do bioma): o ouro, a água e a pedra úmida refletem o céu. O Leve NUNCA o liga. Independente do pós-processamento. */
  readonly ambiente: boolean
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
    posProcessamento: false,
    bloom: false,
    ao: false,
    msaa: 0,
    anisotropia: 2,
    ambiente: false,
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
    posProcessamento: true,
    bloom: true,
    ao: false,
    msaa: 4,
    anisotropia: 8,
    ambiente: true,
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
    posProcessamento: true,
    bloom: true,
    ao: true,
    msaa: 4,
    anisotropia: 16,
    ambiente: true,
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
