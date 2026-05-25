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

// ── Waves ───────────────────────────────────────────────────────────────────────
export const WAVE_BASE_COUNT    = 5        // [PLACEHOLDER] — enemies at wave 1
export const WAVE_COUNT_SCALE   = 3        // [PLACEHOLDER] — additional enemies per wave
export const WAVE_SPAWN_INTERVAL = 0.8     // [PLACEHOLDER] — seconds between spawns

// ── Tower Blueprints ────────────────────────────────────────────────────────────
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
export const BUFF_DAMAGE_MULT    = 2.0       // [PLACEHOLDER] — damage multiplier when buff active
export const BUFF_COOLDOWN_MULT  = 0.5       // [PLACEHOLDER] — cooldown multiplier (halved)
export const BUFF_AOE_RANGE      = 4         // [PLACEHOLDER] — AoE nuke splash radius (grid units)
export const BUFF_AOE_DURATION   = 15        // [PLACEHOLDER] — seconds the AoE nuke buff lasts
export const BUFF_AOE_SPLASH_MULT = 1.0      // [PLACEHOLDER] — 100% of damage applied to ALL enemies in radius

// ── Collision Groups (bitmasks for Rapier) ──────────────────────────────────────
// Not used for filtering yet, but defined for Sprint 3+ tower projectiles
export const GROUP_PLAYER       = 0b0000_0001
export const GROUP_ENEMY        = 0b0000_0010
export const GROUP_CORE         = 0b0000_0100
export const GROUP_TOWER_PROJ   = 0b0000_1000
export const GROUP_ANSWER_PAD   = 0b0001_0000
export const GROUP_CONSTRUCTION = 0b0010_0000
