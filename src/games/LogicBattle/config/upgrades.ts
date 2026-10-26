// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/config/upgrades.ts — Cidadela (5 Construções × 5 Níveis)
// ──────────────────────────────────────────────────────────────────────────────
import { CitadelBuildingId, CitadelBuildingSpec } from '../types'

export const CITADEL_BUILDINGS: Record<CitadelBuildingId, CitadelBuildingSpec> = {
  quartel: {
    id: 'quartel',
    name: 'Quartel da Legião',
    icon: '🛖',
    descriptionPt: 'Aumenta o exército inicial de cada corrida (1 → 3 → 5 → 10 → 20 → 35 soldados).',
    pedagogicalConceptPt: 'Mudar o exército inicial N₀ desloca o ponto de virada N > a/(b − 1) logo nos primeiros portões!',
    baseCost: 25,
    costGrowthFactor: 2.2,
    maxLevel: 5,
    levelEffects: [1, 3, 5, 10, 20, 35],
    levelLabels: ['1 Recruta', '3 Recrutas', '5 Recrutas', '1 Decurião (10)', '2 Decuriões (20)', '35 Soldados'],
  },
  observatorio: {
    id: 'observatorio',
    name: 'Observatório Socrático',
    icon: '🔭',
    descriptionPt: 'Ativa o Detector de Pegadinhas (⚠) nos portões-armadilha — um andaime que desbota sozinho quando sua maestria sobe.',
    pedagogicalConceptPt: 'Scaffolding Vygotskiano: apoia na zona de desenvolvimento proximal e se retira quando você domina o conceito.',
    baseCost: 30,
    costGrowthFactor: 2.1,
    maxLevel: 5,
    levelEffects: [0, 1, 2, 3, 4, 5],
    levelLabels: ['Apenas Estreias', '1 Alerta/Corrida', '2 Alertas/Corrida', '3 Alertas/Corrida', '4 Alertas/Corrida', 'Radar Pleno'],
  },
  academia: {
    id: 'academia',
    name: 'Academia de Arquimedes',
    icon: '📚',
    descriptionPt: 'Amplia o bônus de Estrelas de Sabedoria em Gêmeos Matemáticos e libera notas avançadas no Códice.',
    pedagogicalConceptPt: 'Metacognição: entender o porquê da regra libera o cérebro da decoreba.',
    baseCost: 20,
    costGrowthFactor: 2.0,
    maxLevel: 5,
    levelEffects: [1, 2, 3, 4, 5, 6],
    levelLabels: ['Nível 1 (+1 ★)', 'Nível 2 (+2 ★)', 'Nível 3 (+3 ★)', 'Nível 4 (+4 ★)', 'Nível 5 (+5 ★)', 'Mestre (+6 ★)'],
  },
  mina_resto: {
    id: 'mina_resto',
    name: 'Mina do Resto Euclidiano',
    icon: '⛏️',
    descriptionPt: 'Todo resto de divisão (ex.: 10 ÷ 3 = 3, resto 1) é guardado aqui! Converte restos acumulados em Recrutas extras.',
    pedagogicalConceptPt: 'Na divisão euclidiana D = d × q + r, o resto r não desaparece — ele tem valor e propósito!',
    baseCost: 35,
    costGrowthFactor: 2.15,
    maxLevel: 5,
    levelEffects: [10, 8, 6, 5, 4, 3],
    levelLabels: [
      'A cada 10 restos → +1 Recruta',
      'A cada 8 restos → +1 Recruta',
      'A cada 6 restos → +1 Recruta',
      'A cada 5 restos → +1 Recruta',
      'A cada 4 restos → +1 Recruta',
      'A cada 3 restos → +1 Recruta',
    ],
  },
  forja: {
    id: 'forja',
    name: 'Forja da Luneta',
    icon: '🔨',
    descriptionPt: 'Forja cargas de Luneta Tática para revelar a prévia exata de um par de portões durante a corrida.',
    pedagogicalConceptPt: 'Gestão de recursos cognitivos: saber quando usar uma ferramenta de verificação.',
    baseCost: 40,
    costGrowthFactor: 2.3,
    maxLevel: 5,
    levelEffects: [1, 1, 2, 2, 3, 4],
    levelLabels: ['1 Luneta/Corrida', '1 Luneta + Bônus', '2 Lunetas/Corrida', '2 Lunetas + Bônus', '3 Lunetas/Corrida', '4 Lunetas/Corrida'],
  },
}

export const CITADEL_BUILDING_LIST: readonly CitadelBuildingSpec[] = [
  CITADEL_BUILDINGS.quartel,
  CITADEL_BUILDINGS.observatorio,
  CITADEL_BUILDINGS.academia,
  CITADEL_BUILDINGS.mina_resto,
  CITADEL_BUILDINGS.forja,
]

export function getUpgradeCost(buildingId: CitadelBuildingId, currentLevel: number): number {
  const spec = CITADEL_BUILDINGS[buildingId]
  if (currentLevel >= spec.maxLevel) return Infinity
  return Math.round(spec.baseCost * Math.pow(spec.costGrowthFactor, currentLevel))
}
