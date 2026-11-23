import type { Papel } from '../partidaPolicies'

export type ArquetipoVisualUnidade =
  | 'aliado_cavaleiro'
  | 'inimigo_saqueador'
  | 'inimigo_ariete'
  | 'inimigo_dragao'
  | 'inimigo_batedor'

export interface PerfilVisualUnidade {
  readonly arquetipo: ArquetipoVisualUnidade
  readonly escala: readonly [number, number, number]
  readonly corArmadura: string
  readonly corArmaduraSecundaria: string
  readonly corDetalhes: string
  readonly corArma: string
  readonly corEscudo: string
  readonly corOlhosEmissive: string
  readonly intensidadeOlhos: number
  readonly metalness: number
  readonly roughness: number
  readonly frequenciaMarcha: number
  readonly amplitudeMarcha: number
}

/**
 * Mapeia facção, papel tático e seleção para o arquétipo visual 3D da unidade,
 * diferenciando silhuetas, cores e materiais entre aliados e cada classe inimiga.
 */
export function perfilVisualDaUnidade(
  lado: 'aliado' | 'inimigo',
  papel: Papel,
  selecionada: boolean,
): PerfilVisualUnidade {
  if (lado === 'aliado') {
    return {
      arquetipo: 'aliado_cavaleiro',
      escala: [1, 1, 1],
      corArmadura: selecionada ? '#22c55e' : '#16a34a',
      corArmaduraSecundaria: '#334155',
      corDetalhes: selecionada ? '#facc15' : '#94a3b8',
      corArma: '#e2e8f0',
      corEscudo: '#15803d',
      corOlhosEmissive: '#000000',
      intensidadeOlhos: 0,
      metalness: 0.45,
      roughness: 0.42,
      frequenciaMarcha: 5.5,
      amplitudeMarcha: 0.03,
    }
  }

  switch (papel) {
    case 'sitiante':
      return {
        arquetipo: 'inimigo_ariete',
        escala: [1.32, 1.26, 1.32],
        corArmadura: '#14121a',
        corArmaduraSecundaria: '#9f1239',
        corDetalhes: '#4c0519',
        corArma: '#52525b',
        corEscudo: '#3f0d1c',
        corOlhosEmissive: '#f97316',
        intensidadeOlhos: 1.35,
        metalness: 0.68,
        roughness: 0.34,
        frequenciaMarcha: 3.6,
        amplitudeMarcha: 0.045,
      }
    case 'dragao':
      return {
        arquetipo: 'inimigo_dragao',
        escala: [1.12, 1.12, 1.12],
        corArmadura: '#4c1d95',
        corArmaduraSecundaria: '#a855f7',
        corDetalhes: '#2e1065',
        corArma: '#c084fc',
        corEscudo: '#581c87',
        corOlhosEmissive: '#f59e0b',
        intensidadeOlhos: 1.4,
        metalness: 0.42,
        roughness: 0.36,
        frequenciaMarcha: 4.8,
        amplitudeMarcha: 0.08,
      }
    case 'isca':
      return {
        arquetipo: 'inimigo_batedor',
        escala: [0.94, 0.96, 0.94],
        corArmadura: '#27272a',
        corArmaduraSecundaria: '#be123c',
        corDetalhes: '#18181b',
        corArma: '#fda4af',
        corEscudo: '#3f3f46',
        corOlhosEmissive: '#fb7185',
        intensidadeOlhos: 1.1,
        metalness: 0.35,
        roughness: 0.58,
        frequenciaMarcha: 6.4,
        amplitudeMarcha: 0.035,
      }
    case 'horda':
    case 'tropa':
    default:
      return {
        arquetipo: 'inimigo_saqueador',
        escala: [1.04, 1.02, 1.04],
        corArmadura: '#1f1b24',
        corArmaduraSecundaria: '#7f1d1d',
        corDetalhes: '#dc2626',
        corArma: '#cbd5e1',
        corEscudo: '#450a0a',
        corOlhosEmissive: '#ff3b30',
        intensidadeOlhos: 1.25,
        metalness: 0.65,
        roughness: 0.38,
        frequenciaMarcha: 5.8,
        amplitudeMarcha: 0.04,
      }
  }
}
