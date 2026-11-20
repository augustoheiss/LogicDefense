export interface RightTierBuffPolicySpec {
  readonly tier: 1 | 2 | 3 | 4
  readonly icon: string
  readonly badgePt: string
  readonly durationMs: number
  readonly armyBonusRatio: number
  readonly minFlatSoldiers: number
  readonly weaponDmgMult: number
  readonly fireRateMult: number
  readonly extraParallelBarrels: number
  readonly piercingShots: boolean
  readonly enemyWipeRatio: number
  readonly bossRoyalVolleyRatio: number
  readonly gate0SubLabelPt: string
  readonly gate1SubLabelPt: string
  readonly gate1RatioLabelPt: string
  readonly activeHudSummaryPt: string
  readonly plaqueBorderColor: string
  readonly plaqueAccentColor: string
}

export const RIGHT_CORRIDOR_TIER_BUFF_POLICIES: Record<
  1 | 2 | 3 | 4,
  RightTierBuffPolicySpec
> = {
  1: {
    tier: 1,
    icon: '🟢',
    badgePt: '🟢 Fácil',
    durationMs: 12000,
    armyBonusRatio: 0.65,
    minFlatSoldiers: 260,
    weaponDmgMult: 2.8,
    fireRateMult: 1.3,
    extraParallelBarrels: 1,
    piercingShots: false,
    enemyWipeRatio: 0.35,
    bossRoyalVolleyRatio: 0.2,
    gate0SubLabelPt: '🟢 CONTA · ABATE 35%',
    gate1SubLabelPt: '🟢 +65% EXÉRCITO',
    gate1RatioLabelPt: '+65%',
    activeHudSummaryPt: '🟢 Abate 35% Inimigos + 65% Soldados',
    plaqueBorderColor: '#4ade80',
    plaqueAccentColor: '#bbf7d0',
  },
  2: {
    tier: 2,
    icon: '🔵',
    badgePt: '🔵 Médio',
    durationMs: 15000,
    armyBonusRatio: 1.25,
    minFlatSoldiers: 580,
    weaponDmgMult: 4.2,
    fireRateMult: 1.45,
    extraParallelBarrels: 2,
    piercingShots: false,
    enemyWipeRatio: 0.6,
    bossRoyalVolleyRatio: 0.4,
    gate0SubLabelPt: '🔵 CONTA · ABATE 60%',
    gate1SubLabelPt: '🔵 +125% · TIRO DUPLO',
    gate1RatioLabelPt: '+125%',
    activeHudSummaryPt: '🔵 Abate 60% Inimigos + Tiro Duplo',
    plaqueBorderColor: '#38bdf8',
    plaqueAccentColor: '#bae6fd',
  },
  3: {
    tier: 3,
    icon: '🟣',
    badgePt: '🟣 Difícil',
    durationMs: 18000,
    armyBonusRatio: 2.1,
    minFlatSoldiers: 1250,
    weaponDmgMult: 6.5,
    fireRateMult: 1.65,
    extraParallelBarrels: 3,
    piercingShots: true,
    enemyWipeRatio: 0.85,
    bossRoyalVolleyRatio: 0.7,
    gate0SubLabelPt: '🟣 CONTA · ABATE 85%',
    gate1SubLabelPt: '🟣 +210% · PERFURANTE',
    gate1RatioLabelPt: '+210%',
    activeHudSummaryPt: '🟣 Abate 85% Inimigos + Canhão Perfurante',
    plaqueBorderColor: '#c084fc',
    plaqueAccentColor: '#e9d5ff',
  },
  4: {
    tier: 4,
    icon: '👑',
    badgePt: '👑 Muito Difícil',
    durationMs: 24000,
    armyBonusRatio: 3.5,
    minFlatSoldiers: 2800,
    weaponDmgMult: 9.5,
    fireRateMult: 1.9,
    extraParallelBarrels: 4,
    piercingShots: true,
    enemyWipeRatio: 1.0,
    bossRoyalVolleyRatio: 1.0,
    gate0SubLabelPt: '👑 WIPE 100% · TODOS ABATIDOS',
    gate1SubLabelPt: '👑 ×4,5 SUPER · SALVA TOTAL',
    gate1RatioLabelPt: '×4,5 WIPE',
    activeHudSummaryPt: '👑 DERROTA TODOS DE UMA VEZ + ×4,5 Exército',
    plaqueBorderColor: '#facc15',
    plaqueAccentColor: '#fef08a',
  },
} as const
