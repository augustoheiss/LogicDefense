// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/state/persistence.ts — SaveRepository Resiliente (SaveV1 + IndexedDB + Cache de Pontuação)
// ──────────────────────────────────────────────────────────────────────────────
import { TRAP_LIST } from '../config/trapCatalog'
import { createInitialMastery } from '../domain/mastery'
import {
  ActiveBridgeRunCheckpoint,
  CitadelBuildingId,
  PlayerScoreCacheV1,
  SaveV1,
  TrapAlbumRecord,
  TrapId,
} from '../types'

export const SAVE_STORAGE_KEY = 'logicBattle.save.v1'
export const SAVE_BACKUP_KEY = 'logicBattle.save.v1.bak'
export const SCORE_CACHE_STORAGE_KEY = 'logicBattle.score.cache.v1'

export const IDB_DB_NAME = 'logicBattle_db'
export const IDB_DB_VERSION = 1
export const IDB_SAVE_STORE = 'saves'
export const IDB_SCORE_STORE = 'score_cache'

export function createInitialAlbum(): Record<TrapId, TrapAlbumRecord> {
  const album = {} as Record<TrapId, TrapAlbumRecord>
  for (const trap of TRAP_LIST) {
    album[trap.id] = {
      trapId: trap.id,
      encounteredCount: 0,
      tamedCount: 0,
    }
  }
  return album
}

export function createInitialTrapSeenMap(): Record<TrapId, number> {
  const seen = {} as Record<TrapId, number>
  for (const trap of TRAP_LIST) {
    seen[trap.id] = 0
  }
  return seen
}

export function createDefaultSaveV1(): SaveV1 {
  const initialCitadel: Record<CitadelBuildingId, number> = {
    quartel: 1,
    observatorio: 1,
    academia: 0,
    mina_resto: 0,
    forja: 0,
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    reserveTroops: 35,
    remainderVault: 0,
    wisdomStars: 1,
    conqueredRegionIds: ['reg_cidadela_origem'],
    selectedRegionId: 'reg_ponte_leste',
    citadelLevels: initialCitadel,
    album: createInitialAlbum(),
    twinsDiscovered: [],
    mastery: createInitialMastery(),
    trapAlertSeenCount: createInitialTrapSeenMap(),
    mergeTutorialSeenCount: 0,
    coachMarksSeen: false,
    recentMathSignatures: [],
    activeRunCheckpoint: null,
    settings: {
      notationMode: 'compact',
      calmMode: false,
      simpleTapMode: false,
      soundEnabled: true,
      reducedMotion: false,
      fpsCap: 60,
    },
    stats: {
      runsPlayed: 0,
      runsWon: 0,
      surgicalPrecisions: 0,
      trapsTamedTotal: 0,
      highestArmyReached: 5,
      highestSectorReached: 1,
      totalPlayerScore: 35,
    },
  }
}

function sanitizeCheckpoint(raw: unknown): ActiveBridgeRunCheckpoint | null {
  if (!raw || typeof raw !== 'object') return null
  const cp = raw as Partial<ActiveBridgeRunCheckpoint>
  const sectorIndex =
    typeof cp.sectorIndex === 'number' && Number.isFinite(cp.sectorIndex)
      ? Math.max(1, Math.floor(cp.sectorIndex))
      : 1
  const currentArmy =
    typeof cp.currentArmy === 'number' && Number.isFinite(cp.currentArmy)
      ? Math.max(0, Math.floor(cp.currentArmy))
      : 0
  if (currentArmy <= 0 && sectorIndex <= 1) return null
  return {
    sectorIndex,
    currentArmy,
    bridgeCoinsEarned:
      typeof cp.bridgeCoinsEarned === 'number' && Number.isFinite(cp.bridgeCoinsEarned)
        ? Math.max(0, Math.floor(cp.bridgeCoinsEarned))
        : 0,
    bridgeKills:
      typeof cp.bridgeKills === 'number' && Number.isFinite(cp.bridgeKills)
        ? Math.max(0, Math.floor(cp.bridgeKills))
        : 0,
    leftCannonLevel:
      typeof cp.leftCannonLevel === 'number' && Number.isFinite(cp.leftCannonLevel)
        ? Math.max(1, Math.floor(cp.leftCannonLevel))
        : 1,
    rightWeaponLevel:
      typeof cp.rightWeaponLevel === 'number' && Number.isFinite(cp.rightWeaponLevel)
        ? Math.max(0, Math.floor(cp.rightWeaponLevel))
        : 0,
    mathChallengesSolved:
      typeof cp.mathChallengesSolved === 'number' && Number.isFinite(cp.mathChallengesSolved)
        ? Math.max(0, Math.floor(cp.mathChallengesSolved))
        : 0,
    seed:
      typeof cp.seed === 'number' && Number.isFinite(cp.seed)
        ? Math.floor(cp.seed)
        : 42,
    bankedScoreMark:
      typeof cp.bankedScoreMark === 'number' && Number.isFinite(cp.bankedScoreMark)
        ? Math.max(0, Math.floor(cp.bankedScoreMark))
        : 0,
    updatedAt:
      typeof cp.updatedAt === 'string' ? cp.updatedAt : new Date().toISOString(),
  }
}

export function buildScoreCacheFromSave(save: SaveV1): PlayerScoreCacheV1 {
  const cp = save.activeRunCheckpoint
  const currentSector = cp?.sectorIndex ?? 1
  const highestSectorReached = Math.max(
    save.stats.highestSectorReached ?? 1,
    currentSector,
  )
  const currentArmy = cp?.currentArmy ?? save.reserveTroops
  const coinsEarned = cp?.bridgeCoinsEarned ?? 0
  const killsTotal = cp?.bridgeKills ?? 0
  const computedLiveScore = Math.max(
    save.stats.totalPlayerScore ?? 0,
    save.reserveTroops +
      (cp ? Math.max(0, cp.currentArmy - (cp.bankedScoreMark ?? 0)) : 0) +
      coinsEarned * 5 +
      (highestSectorReached - 1) * 50,
  )

  return {
    version: 1,
    playerScore: computedLiveScore,
    highestSectorReached,
    currentSector,
    currentArmy,
    reserveTroops: save.reserveTroops,
    wisdomStars: save.wisdomStars,
    coinsEarned,
    killsTotal,
    updatedAt: save.updatedAt || new Date().toISOString(),
  }
}

export function migrateSave(raw: unknown): SaveV1 {
  const defaults = createDefaultSaveV1()
  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const obj = raw as Partial<SaveV1>
  if (obj.version !== 1) {
    return defaults
  }

  const activeRunCheckpoint = sanitizeCheckpoint(obj.activeRunCheckpoint)
  const mergedStats = {
    ...defaults.stats,
    ...(obj.stats && typeof obj.stats === 'object' ? obj.stats : {}),
  }
  mergedStats.highestSectorReached = Math.max(
    1,
    mergedStats.highestSectorReached ?? 1,
    activeRunCheckpoint?.sectorIndex ?? 1,
  )
  const reserveTroops =
    typeof obj.reserveTroops === 'number' && Number.isFinite(obj.reserveTroops)
      ? Math.max(0, Math.floor(obj.reserveTroops))
      : defaults.reserveTroops
  mergedStats.totalPlayerScore = Math.max(
    reserveTroops,
    mergedStats.totalPlayerScore ?? reserveTroops,
  )

  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : defaults.updatedAt,
    reserveTroops,
    remainderVault:
      typeof obj.remainderVault === 'number' && Number.isFinite(obj.remainderVault)
        ? Math.max(0, Math.floor(obj.remainderVault))
        : defaults.remainderVault,
    wisdomStars:
      typeof obj.wisdomStars === 'number' && Number.isFinite(obj.wisdomStars)
        ? Math.max(0, Math.floor(obj.wisdomStars))
        : defaults.wisdomStars,
    conqueredRegionIds: Array.isArray(obj.conqueredRegionIds) && obj.conqueredRegionIds.length > 0
      ? obj.conqueredRegionIds.filter((x): x is string => typeof x === 'string')
      : defaults.conqueredRegionIds,
    selectedRegionId:
      typeof obj.selectedRegionId === 'string'
        ? obj.selectedRegionId
        : defaults.selectedRegionId,
    citadelLevels: {
      ...defaults.citadelLevels,
      ...(obj.citadelLevels && typeof obj.citadelLevels === 'object' ? obj.citadelLevels : {}),
    },
    album: {
      ...defaults.album,
      ...(obj.album && typeof obj.album === 'object' ? obj.album : {}),
    },
    twinsDiscovered: Array.isArray(obj.twinsDiscovered)
      ? obj.twinsDiscovered
      : defaults.twinsDiscovered,
    mastery: {
      ...defaults.mastery,
      ...(obj.mastery && typeof obj.mastery === 'object' ? obj.mastery : {}),
    },
    trapAlertSeenCount: {
      ...defaults.trapAlertSeenCount,
      ...(obj.trapAlertSeenCount && typeof obj.trapAlertSeenCount === 'object'
        ? obj.trapAlertSeenCount
        : {}),
    },
    mergeTutorialSeenCount:
      typeof obj.mergeTutorialSeenCount === 'number'
        ? obj.mergeTutorialSeenCount
        : defaults.mergeTutorialSeenCount,
    coachMarksSeen:
      typeof obj.coachMarksSeen === 'boolean'
        ? obj.coachMarksSeen
        : defaults.coachMarksSeen,
    recentMathSignatures: Array.isArray(obj.recentMathSignatures)
      ? obj.recentMathSignatures.filter((x): x is string => typeof x === 'string')
      : defaults.recentMathSignatures,
    activeRunCheckpoint,
    settings: {
      ...defaults.settings,
      ...(obj.settings && typeof obj.settings === 'object' ? obj.settings : {}),
    },
    stats: mergedStats,
  }
}

function openLogicBattleIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window) || !window.indexedDB) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_SAVE_STORE)) {
          db.createObjectStore(IDB_SAVE_STORE)
        }
        if (!db.objectStoreNames.contains(IDB_SCORE_STORE)) {
          db.createObjectStore(IDB_SCORE_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function writeSaveToIndexedDB(
  save: SaveV1,
  scoreCache: PlayerScoreCacheV1,
): Promise<boolean> {
  const db = await openLogicBattleIdb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([IDB_SAVE_STORE, IDB_SCORE_STORE], 'readwrite')
      tx.objectStore(IDB_SAVE_STORE).put(save, 'primary')
      tx.objectStore(IDB_SAVE_STORE).put(save, 'backup')
      tx.objectStore(IDB_SCORE_STORE).put(scoreCache, 'latest')
      tx.oncomplete = () => {
        db.close()
        resolve(true)
      }
      tx.onerror = () => {
        db.close()
        resolve(false)
      }
    } catch {
      db.close()
      resolve(false)
    }
  })
}

async function readSaveFromIndexedDB(): Promise<{
  save: SaveV1 | null
  scoreCache: PlayerScoreCacheV1 | null
}> {
  const db = await openLogicBattleIdb()
  if (!db) return { save: null, scoreCache: null }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([IDB_SAVE_STORE, IDB_SCORE_STORE], 'readonly')
      const saveReq = tx.objectStore(IDB_SAVE_STORE).get('primary')
      const scoreReq = tx.objectStore(IDB_SCORE_STORE).get('latest')
      tx.oncomplete = () => {
        const rawSave = saveReq.result
        const rawScore = scoreReq.result
        db.close()
        const migrated =
          rawSave && typeof rawSave === 'object' && rawSave.version === 1
            ? migrateSave(rawSave)
            : null
        const scoreCache =
          rawScore && typeof rawScore === 'object' && rawScore.version === 1
            ? (rawScore as PlayerScoreCacheV1)
            : migrated
              ? buildScoreCacheFromSave(migrated)
              : null
        resolve({ save: migrated, scoreCache })
      }
      tx.onerror = () => {
        db.close()
        resolve({ save: null, scoreCache: null })
      }
    } catch {
      db.close()
      resolve({ save: null, scoreCache: null })
    }
  })
}

async function clearLogicBattleIndexedDB(): Promise<void> {
  const db = await openLogicBattleIdb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([IDB_SAVE_STORE, IDB_SCORE_STORE], 'readwrite')
      tx.objectStore(IDB_SAVE_STORE).clear()
      tx.objectStore(IDB_SCORE_STORE).clear()
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        resolve()
      }
    } catch {
      db.close()
      resolve()
    }
  })
}

export const SaveRepository = {
  load(): { save: SaveV1; recoveredFromBackup: boolean } {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { save: createDefaultSaveV1(), recoveredFromBackup: false }
    }

    try {
      const rawPrimary = window.localStorage.getItem(SAVE_STORAGE_KEY)
      if (rawPrimary) {
        const parsed = JSON.parse(rawPrimary)
        if (parsed && typeof parsed === 'object' && parsed.version === 1) {
          const migrated = migrateSave(parsed)
          const scoreCache = buildScoreCacheFromSave(migrated)
          try {
            window.localStorage.setItem(SCORE_CACHE_STORAGE_KEY, JSON.stringify(scoreCache))
          } catch {
            // Silencioso
          }
          void writeSaveToIndexedDB(migrated, scoreCache)
          return { save: migrated, recoveredFromBackup: false }
        }
      }
    } catch {
      // Se o save primário estiver corrompido, tenta o .bak
    }

    try {
      const rawBackup = window.localStorage.getItem(SAVE_BACKUP_KEY)
      if (rawBackup) {
        const parsedBak = JSON.parse(rawBackup)
        if (parsedBak && typeof parsedBak === 'object' && parsedBak.version === 1) {
          const migrated = migrateSave(parsedBak)
          const scoreCache = buildScoreCacheFromSave(migrated)
          window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(migrated))
          window.localStorage.setItem(SCORE_CACHE_STORAGE_KEY, JSON.stringify(scoreCache))
          void writeSaveToIndexedDB(migrated, scoreCache)
          return { save: migrated, recoveredFromBackup: true }
        }
      }
    } catch {
      // Fallback para save padrão
    }

    const fresh = createDefaultSaveV1()
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const freshScore = buildScoreCacheFromSave(fresh)
        window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(fresh))
        window.localStorage.setItem(SCORE_CACHE_STORAGE_KEY, JSON.stringify(freshScore))
      } catch {
        // Silencioso
      }
    }
    return { save: fresh, recoveredFromBackup: false }
  },

  save(data: SaveV1): PlayerScoreCacheV1 {
    const next: SaveV1 = {
      ...data,
      updatedAt: new Date().toISOString(),
    }
    const scoreCache = buildScoreCacheFromSave(next)

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const prev = window.localStorage.getItem(SAVE_STORAGE_KEY)
        if (prev && prev.trim().startsWith('{') && prev.trim().endsWith('}')) {
          try {
            const parsedPrev = JSON.parse(prev)
            if (parsedPrev && typeof parsedPrev === 'object' && parsedPrev.version === 1) {
              window.localStorage.setItem(SAVE_BACKUP_KEY, prev)
            }
          } catch {
            // Nunca sobrescrever o backup (.bak) com um save primário corrompido!
          }
        }
        window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(next))
        window.localStorage.setItem(SCORE_CACHE_STORAGE_KEY, JSON.stringify(scoreCache))
      } catch {
        // Silencioso caso quota exceda
      }
    }

    void writeSaveToIndexedDB(next, scoreCache)
    return scoreCache
  },

  loadScoreCache(): PlayerScoreCacheV1 {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(SCORE_CACHE_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object' && parsed.version === 1) {
            return parsed as PlayerScoreCacheV1
          }
        }
      } catch {
        // Ignorar e reconstruir a partir do save
      }
    }
    const { save } = this.load()
    return buildScoreCacheFromSave(save)
  },

  async hydrateFromIndexedDB(
    onHydrated?: (save: SaveV1, scoreCache: PlayerScoreCacheV1) => void,
  ): Promise<SaveV1 | null> {
    const { save: idbSave, scoreCache: idbScore } = await readSaveFromIndexedDB()
    if (!idbSave) {
      // Se o IndexedDB ainda estava vazio, sincroniza o save local atual para o IndexedDB
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = window.localStorage.getItem(SAVE_STORAGE_KEY)
          if (raw) {
            const migratedLocal = migrateSave(JSON.parse(raw))
            const localCache = buildScoreCacheFromSave(migratedLocal)
            await writeSaveToIndexedDB(migratedLocal, localCache)
            return migratedLocal
          }
        } catch {
          // Silencioso
        }
      }
      return null
    }

    // Comparar com o save atual no localStorage para ver se o IndexedDB possui mais progresso
    // (ex.: quando o localStorage foi limpo ou o IndexedDB tem setor/pontuação maior)
    let localSave: SaveV1 | null = null
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(SAVE_STORAGE_KEY)
        if (raw) {
          localSave = migrateSave(JSON.parse(raw))
        }
      } catch {
        localSave = null
      }
    }

    const idbSector = idbSave.activeRunCheckpoint?.sectorIndex ?? 1
    const localSector = localSave?.activeRunCheckpoint?.sectorIndex ?? 1
    const idbScoreVal = idbSave.stats.totalPlayerScore ?? idbSave.reserveTroops
    const localScoreVal = localSave?.stats.totalPlayerScore ?? localSave?.reserveTroops ?? 0
    const idbReserve = idbSave.reserveTroops
    const localReserve = localSave?.reserveTroops ?? 0

    const idbHasMoreProgress =
      !localSave ||
      idbSector > localSector ||
      idbScoreVal > localScoreVal ||
      idbReserve > localReserve ||
      (idbSave.stats.highestSectorReached ?? 1) > (localSave.stats.highestSectorReached ?? 1)

    if (idbHasMoreProgress) {
      const cache = idbScore ?? buildScoreCacheFromSave(idbSave)
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(idbSave))
          window.localStorage.setItem(SCORE_CACHE_STORAGE_KEY, JSON.stringify(cache))
        } catch {
          // Silencioso
        }
      }
      onHydrated?.(idbSave, cache)
      return idbSave
    }

    return localSave
  },

  exportJson(): string {
    const { save } = this.load()
    return JSON.stringify(save, null, 2)
  },

  reset(): SaveV1 {
    const fresh = createDefaultSaveV1()
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(SAVE_STORAGE_KEY)
        window.localStorage.removeItem(SAVE_BACKUP_KEY)
        window.localStorage.removeItem(SCORE_CACHE_STORAGE_KEY)
      } catch {
        // Ignorar
      }
    }
    void clearLogicBattleIndexedDB()
    this.save(fresh)
    return fresh
  },
}
