// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/sandbox/sandboxCatalog.ts
// LogicBattle V13: Catálogo de Blocos-Portais Físicos (Stepping-Block Portals)
// e Catálogo de Assets Voxel 3D ([I] Inventory — inspirado nas Abas 4 e 52)
// ──────────────────────────────────────────────────────────────────────────────

import { EngineId } from '../engines/engineContract'
import { SandboxZoneKey } from './voxelChunkGrid'

export interface SandboxSteppingPortalSpec {
  readonly id: string
  readonly targetZoneKey: SandboxZoneKey
  readonly targetWorld: 'realm' | 'run'
  readonly targetEngineId?: EngineId
  readonly labelPt: string
  readonly shortBadge: string
  readonly icon: string
  readonly colorHex: string
  readonly worldX: number
  readonly worldZ: number
}

/**
 * Os 7 Blocos-Portais Físicos 3D do Mundo Aberto Voxel:
 * Quando o Avatar caminha/pisa sobre qualquer um destes blocos (dist <= 1.95),
 * o jogo dispara uma animação de transição 3D (portalTransition) e alterna para
 * a Base ou Engine correspondente compartilhando a mesma Carteira!
 */
export const SANDBOX_STEPPING_PORTALS: readonly SandboxSteppingPortalSpec[] = [
  {
    id: 'portal_cidadela_realm',
    targetZoneKey: 'cidadela_realm',
    targetWorld: 'realm',
    labelPt: 'Base Cidadela & Fronteira',
    shortBadge: '🏰 Base 3D',
    icon: '🏰',
    colorHex: '#14b8a6',
    worldX: -18,
    worldZ: -15,
  },
  {
    id: 'portal_ponte_portoes',
    targetZoneKey: 'ponte_portoes',
    targetWorld: 'run',
    targetEngineId: 'ponte_portoes',
    labelPt: 'Ponte dos Portões 3D',
    shortBadge: '🌉 Ponte',
    icon: '🌉',
    colorHex: '#38bdf8',
    worldX: -12,
    worldZ: -17,
  },
  {
    id: 'portal_cerco_torres',
    targetZoneKey: 'cerco_torres',
    targetWorld: 'run',
    targetEngineId: 'cerco_torres',
    labelPt: 'Cerco das Torres Voxel',
    shortBadge: '🏹 Cerco',
    icon: '🏹',
    colorHex: '#f59e0b',
    worldX: -6,
    worldZ: -17,
  },
  {
    id: 'portal_forte_bandeira',
    targetZoneKey: 'forte_bandeira',
    targetWorld: 'run',
    targetEngineId: 'forte_bandeira',
    labelPt: 'Forte da Bandeira Voxel',
    shortBadge: '🚩 Bandeira',
    icon: '🚩',
    colorHex: '#10b981',
    worldX: 0,
    worldZ: -17,
  },
  {
    id: 'portal_pedreira_rei',
    targetZoneKey: 'pedreira_rei',
    targetWorld: 'run',
    targetEngineId: 'pedreira_rei',
    labelPt: 'Pedreira do Rei Voxel',
    shortBadge: '⛏️ Pedreira',
    icon: '⛏️',
    colorHex: '#eab308',
    worldX: 6,
    worldZ: -17,
  },
  {
    id: 'portal_arena_ondas',
    targetZoneKey: 'arena_ondas',
    targetWorld: 'run',
    targetEngineId: 'arena_ondas',
    labelPt: 'Arena de Ondas Voxel',
    shortBadge: '🏟️ Arena',
    icon: '🏟️',
    colorHex: '#ec4899',
    worldX: 12,
    worldZ: -17,
  },
  {
    id: 'portal_serpente_numeros',
    targetZoneKey: 'serpente_numeros',
    targetWorld: 'run',
    targetEngineId: 'serpente_numeros',
    labelPt: 'Serpente dos Números Voxel',
    shortBadge: '🐉 Serpente',
    icon: '🐉',
    colorHex: '#a855f7',
    worldX: 18,
    worldZ: -15,
  },
]

export type SandboxAssetCategory =
  | 'DEFENSE'
  | 'MATH_GATE'
  | 'VEHICLE'
  | 'TRAP'
  | 'NATURE'

export interface SandboxAssetBlueprint {
  readonly id: string
  readonly namePt: string
  readonly category: SandboxAssetCategory
  readonly icon: string
  readonly costCoins: number
  readonly colorHex: string
  readonly descriptionPt: string
}

/**
 * Catálogo de Assets Voxel 3D ([I] Inventory / Studio Builder) inspirado nas Abas 4 e 52.
 * Torres e Bastiões seguem a regra econômica 100× mais difícil (1.500+ 🪙).
 */
export const SANDBOX_ASSET_CATALOG: readonly SandboxAssetBlueprint[] = [
  {
    id: 'voxel_defense_tower',
    namePt: 'Torre Voxel de Besteiros',
    category: 'DEFENSE',
    icon: '🗼',
    costCoins: 1500,
    colorHex: '#0284c7',
    descriptionPt: 'Torre defensiva Voxel 3D que dispara rajadas contra a Horda 15×+.',
  },
  {
    id: 'voxel_mortar_bastion',
    namePt: 'Bastião Morteiro Voxel',
    category: 'DEFENSE',
    icon: '💣',
    costCoins: 2600,
    colorHex: '#f59e0b',
    descriptionPt: 'Canhão Voxel pesado de área contra Golems e Bosses.',
  },
  {
    id: 'voxel_math_altar',
    namePt: 'Altar da Conta [E]',
    category: 'MATH_GATE',
    icon: '🧮',
    costCoins: 0,
    colorHex: '#facc15',
    descriptionPt: 'Totem Voxel luminoso: resolva contas (👑 Grau IV = Wipe 100% dos inimigos!).',
  },
  {
    id: 'voxel_multiplier_gate',
    namePt: 'Arco Multiplicador ×2',
    category: 'MATH_GATE',
    icon: '✨',
    costCoins: 1200,
    colorHex: '#10b981',
    descriptionPt: 'Portão Voxel 3D que multiplica o poder de fogo do esquadrão.',
  },
  {
    id: 'voxel_hoverboard_pad',
    namePt: 'Hoverboard Turbo [E]',
    category: 'VEHICLE',
    icon: '🛹',
    costCoins: 400,
    colorHex: '#38bdf8',
    descriptionPt: 'Ativa o Hoverboard Voxel (125 KM/H) inspirado no The Sandbox Studio.',
  },
  {
    id: 'voxel_tnt_barrel',
    namePt: 'Barril Explosivo TNT',
    category: 'TRAP',
    icon: '🧨',
    costCoins: 650,
    colorHex: '#ef4444',
    descriptionPt: 'Detona quando inimigos Voxel se aproximam.',
  },
]
