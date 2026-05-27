// ============================================================
// Logic Friction — Shared Constants & Tuning Values
// All [PLACEHOLDER] values require playtest tuning.
// ============================================================
import * as THREE from 'three'

// ── Arena ───────────────────────────────────────────────────────────────────────
export const ARENA_RADIUS       = 50
export const ARENA_HEIGHT       = 1
export const ARENA_SEGMENTS     = 64
export const ARENA_WALL_HEIGHT  = 4
export const ARENA_WALL_SEGMENTS = 32
export const ARENA_WALL_THICKNESS = 0.5

// ── Player ──────────────────────────────────────────────────────────────────────
export const PLAYER_RADIUS      = 0.6
export const PLAYER_SPEED       = 14       // [PLACEHOLDER] — arcade-snappy feel
export const PLAYER_MAX_HP      = 100      // [PLACEHOLDER]
export const PLAYER_ATTACK_RANGE = 3.5     // [PLACEHOLDER] — melee radius
export const PLAYER_ATTACK_DAMAGE = 35     // [PLACEHOLDER] — damage per hit
export const PLAYER_ATTACK_COOLDOWN = 0.35 // [PLACEHOLDER] — seconds between attacks
export const PLAYER_RESPAWN_TIME = 10       // [PLACEHOLDER] — seconds to respawn after death

// ── Camera ──────────────────────────────────────────────────────────────────────
export const CAMERA_OFFSET      = new THREE.Vector3(0, 30, 30)
export const CAMERA_LERP        = 0.08     // Lower = smoother follow

// ── Central Core ────────────────────────────────────────────────────────────────
export const CORE_MAX_HP        = 500      // [PLACEHOLDER]
export const CORE_SIZE          = 2.0      // Visual radius of the core mesh
export const CORE_COLLIDER_SIZE = 2.5      // Physics collider radius (slightly larger)
export const CORE_UPGRADE_BASE_COST = 200  // Cost multiplier: coreLevel * this

// ── Enemies ─────────────────────────────────────────────────────────────────────
export const ENEMY_RADIUS       = 0.5
export const ENEMY_BASE_HP      = 30       // [PLACEHOLDER] — HP at wave 1
export const ENEMY_HP_SCALE     = 8        // [PLACEHOLDER] — additional HP per wave
export const ENEMY_BASE_SPEED   = 4        // [PLACEHOLDER] — movement speed
export const ENEMY_SPEED_SCALE  = 0.3      // [PLACEHOLDER] — additional speed per wave
export const ENEMY_MAX_SPEED    = 10       // [PLACEHOLDER] — cap
export const ENEMY_DAMAGE       = 15       // [PLACEHOLDER] — damage dealt to core on contact
export const ENEMY_SPAWN_RADIUS = 48       // Just inside the arena wall
export const ENEMY_KILL_GOLD    = 10       // [PLACEHOLDER] — gold per kill

// ── Boss Enemies ────────────────────────────────────────────────────────────
export const BOSS_BASE_COUNT        = 4        // Bosses at wave 10
export const BOSS_COUNT_INCREMENT   = 1        // +1 boss per subsequent boss wave
export const BOSS_NORMAL_HP_MULT    = 10       // HP multiplier when player meets toll
export const BOSS_PUNISH_HP_MULT    = 30       // HP multiplier when player fails toll
export const BOSS_TOLL_PER_WAVE     = 50       // requiredMoney = wave * this
export const BOSS_SPEED_MULT        = 0.35     // Boss moves at 35% of normal speed
export const BOSS_SCALE             = 2.5      // Visual scale multiplier
export const BOSS_TROJAN_SPAWN_COUNT = 10      // Normal enemies spawned on boss death
export const BOSS_DAMAGE            = 40       // [PLACEHOLDER] — core damage on boss contact
export const BOSS_KILL_GOLD         = 50       // Gold reward for killing a boss
export const BOSS_FAILSAFE_TTL      = 90000    // 90s failsafe TTL for slow bosses

// ── Waves ───────────────────────────────────────────────────────────────────────
export const WAVE_BASE_COUNT    = 5        // [PLACEHOLDER] — enemies at wave 1
export const WAVE_COUNT_SCALE   = 3        // [PLACEHOLDER] — additional enemies per wave
export const WAVE_SPAWN_INTERVAL = 0.8     // [PLACEHOLDER] — seconds between spawns

// ── Tower Blueprints ────────────────────────────────────────────────────────────
export type ProjectileType = 'BOLT' | 'MORTAR' | 'SHOCKWAVE' | 'RAILGUN'

export interface TowerBlueprint {
  key: string
  label: string
  cost: number
  damage: number
  cooldown: number
  range: number
  color: string       // Turret head + beam color
  emissive: string    // Emissive glow
  icon: string
  projectileType: ProjectileType
  isAoE?: boolean        // For SLOW tower — damages/slows all in range
  slowFactor?: number    // Movement speed multiplier (0.5 = 50% slow)
  slowDuration?: number  // Seconds the slow lasts
}

export const TOWER_BLUEPRINTS: Record<string, TowerBlueprint> = {
  RAPID: {
    key: 'RAPID',
    label: 'Rápida',
    cost: 50,
    damage: 10,
    cooldown: 0.5,
    range: 12,
    color: '#00ffff',
    emissive: '#00d4ff',
    icon: '⚡',
    projectileType: 'BOLT',
  },
  HEAVY: {
    key: 'HEAVY',
    label: 'Pesada',
    cost: 100,
    damage: 40,
    cooldown: 2.0,
    range: 20,
    color: '#ff00ff',
    emissive: '#a855f7',
    icon: '💥',
    projectileType: 'MORTAR',
  },
  SLOW: {
    key: 'SLOW',
    label: 'Lenta',
    cost: 75,
    damage: 5,
    cooldown: 3.0,
    range: 18,
    color: '#00ddff',
    emissive: '#0088cc',
    icon: '❄️',
    projectileType: 'SHOCKWAVE',
    isAoE: true,
    slowFactor: 0.5,
    slowDuration: 3,
  },
  SNIPER: {
    key: 'SNIPER',
    label: 'Sniper',
    cost: 200,
    damage: 150,
    cooldown: 5.0,
    range: 100,   // Global — sees entire arena
    color: '#ff2200',
    emissive: '#cc0000',
    icon: '🎯',
    projectileType: 'RAILGUN',
  },
}

export const TOWER_BLUEPRINT_KEYS = Object.keys(TOWER_BLUEPRINTS) as string[]

// ── Tower Shared ────────────────────────────────────────────────────────────────
export const TOWER_SIZE          = 1.0       // Visual half-extent of tower base
export const TOWER_HEIGHT        = 3.5       // Visual height of the tower pillar
export const SITE_SIZE           = 1.5       // Visual half-extent of construction site
export const SITE_COLLIDER_HALF  = 1.8       // Sensor collider half-extent (slightly larger for walk-over)
export const SITE_EXPIRY_MS      = 15000     // 15 seconds before unfunded site auto-destroys
export const STARTING_GOLD       = 100       // [PLACEHOLDER] — gold the player starts with
export const MAX_TOWERS          = 50        // Effectively unlimited — gold is the real constraint
export const TOWER_SELL_REFUND   = 0.6       // 60% refund on sell
export const TOWER_RELOCATE_COST = 0.25      // 25% of base cost to relocate
export const TOWER_RELOCATE_MIN  = 15        // Minimum relocate cost in gold

// ── Siege Mode (enemy) ──────────────────────────────────────────────────────────
export const SIEGE_FIRE_INTERVAL = 2.0       // Seconds between siege laser shots

// ── Math Zone ──────────────────────────────────────────────────────────────────
export const MATH_ZONE_OFFSET    = 15        // Distance from core center to math zone
export const MATH_ZONE_Y         = 5         // Height of floating equation text
export const MATH_ZONE_SENSOR_RADIUS = 12    // Large cylinder sensor for transparency trigger
export const ANSWER_PAD_RADIUS   = 1.8       // [PLACEHOLDER] — cylinder radius for answer pads
export const ANSWER_PAD_HEIGHT   = 0.3       // Visual height of pads
export const ANSWER_PAD_SPACING  = 5         // [PLACEHOLDER] — gap between pads (center to center)
export const ANSWER_PAD_SENSOR   = 2.2       // Sensor collider radius (slightly larger for walk-over)

// ── Math Zone Direction Offsets ─────────────────────────────────────────────────
// Resolved in MathChallenge.tsx based on mathZonePosition from store
export type MathZoneDir = 'N' | 'S' | 'E' | 'W'
export const MATH_ZONE_POSITIONS: Record<MathZoneDir, [number, number, number]> = {
  N: [0,  0, -MATH_ZONE_OFFSET],
  S: [0,  0,  MATH_ZONE_OFFSET],
  E: [MATH_ZONE_OFFSET,  0, 0],
  W: [-MATH_ZONE_OFFSET, 0, 0],
}

// ── Divine Buff ─────────────────────────────────────────────────────────────────
export const BUFF_COOLDOWN_MULT  = 0.5       // Cooldown multiplier (halved = double attack speed)

// ── Collision Groups (bitmasks for Rapier) ──────────────────────────────────────
// Not used for filtering yet, but defined for Sprint 3+ tower projectiles
export const GROUP_PLAYER       = 0b0000_0001
export const GROUP_ENEMY        = 0b0000_0010
export const GROUP_CORE         = 0b0000_0100
export const GROUP_TOWER_PROJ   = 0b0000_1000
export const GROUP_ANSWER_PAD   = 0b0001_0000
export const GROUP_CONSTRUCTION = 0b0010_0000

