// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/state/persistence.ts — SaveRepository Resiliente (SaveV1)
// ──────────────────────────────────────────────────────────────────────────────
import { TRAP_LIST } from '../config/trapCatalog'
import { createInitialMastery } from '../domain/mastery'
import { CitadelBuildingId, SaveV1, TrapAlbumRecord, TrapId } from '../types'

export const SAVE_STORAGE_KEY = 'logicBattle.save.v1'
export const SAVE_BACKUP_KEY = 'logicBattle.save.v1.bak'

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
    settings: {
      notationMode: 'compact',
      calmMode: false,
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
    },
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

  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : defaults.updatedAt,
    reserveTroops:
      typeof obj.reserveTroops === 'number' && Number.isFinite(obj.reserveTroops)
        ? Math.max(0, Math.floor(obj.reserveTroops))
        : defaults.reserveTroops,
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
    settings: {
      ...defaults.settings,
      ...(obj.settings && typeof obj.settings === 'object' ? obj.settings : {}),
    },
    stats: {
      ...defaults.stats,
      ...(obj.stats && typeof obj.stats === 'object' ? obj.stats : {}),
    },
  }
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
          return { save: migrateSave(parsed), recoveredFromBackup: false }
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
          window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(migrated))
          return { save: migrated, recoveredFromBackup: true }
        }
      }
    } catch {
      // Fallback para save padrão
    }

    const fresh = createDefaultSaveV1()
    this.save(fresh)
    return { save: fresh, recoveredFromBackup: false }
  },

  save(data: SaveV1): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const prev = window.localStorage.getItem(SAVE_STORAGE_KEY)
      if (prev) {
        window.localStorage.setItem(SAVE_BACKUP_KEY, prev)
      }
      const next: SaveV1 = {
        ...data,
        updatedAt: new Date().toISOString(),
      }
      window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Silencioso caso quota exceda
    }
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
      } catch {
        // Ignorar
      }
    }
    this.save(fresh)
    return fresh
  },
}
