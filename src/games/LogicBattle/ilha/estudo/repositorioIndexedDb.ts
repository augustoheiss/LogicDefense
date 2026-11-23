/**
 * Adaptador assincrono em IndexedDB para o `RepositorioEstudo` (Fase Q3).
 *
 * Isolado atras da porta `RepositorioEstudo`:
 *  - Object stores: `eventos`, `perfis`, `historico_itens`, `meta`.
 *  - Qualquer falha (aba privada restritiva, cota cheia, `typeof indexedDB === 'undefined'` no Node,
 *    timeout ou erro de transacao) cai silenciosamente em `criarRepositorioMemoria()` sem lancar.
 *  - Migra `ld_ilha_caderno_v1` na primeira abertura sem apagar a chave v1 (rollback seguro).
 */
import { carregarCaderno } from '../cadernoDeEstudo'
import { armazenamentoDoNavegador, type ArmazenamentoSimples } from '../memoriaDeContas'
import {
  aplicarEventoNoEstado,
  CHAVE_MIGRADA_V1,
  criarRepositorioMemoria,
  estadoEstudoVazio,
  LIMITE_EVENTOS_MEMORIA,
  migrarCadernoV1ParaEstado,
  type EstadoEstudoLocal,
  type EventoEstudo,
  type PerfilTema,
  type RegistroItemEstudo,
  type RepositorioEstudo,
} from './repositorioEstudo'

export const NOME_IDB_ESTUDO = 'ld_ilha_estudo_v2'
const VERSAO_IDB = 1
const STORES = ['eventos', 'perfis', 'historico_itens', 'meta'] as const

function esperarReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDBRequest falhou'))
  })
}

function esperarTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IDBTransaction falhou'))
    tx.onabort = () => reject(tx.error ?? new Error('IDBTransaction abortada'))
  })
}

function abrirBancoIdb(nomeDb: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(nomeDb, VERSAO_IDB)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('eventos')) {
        db.createObjectStore('eventos', { autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('perfis')) {
        db.createObjectStore('perfis', { keyPath: 'temaId' })
      }
      if (!db.objectStoreNames.contains('historico_itens')) {
        db.createObjectStore('historico_itens', { keyPath: 'itemId' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'chave' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open falhou'))
    req.onblocked = () => reject(new Error('indexedDB.open bloqueado'))
  })
}

export function criarRepositorioIndexedDb(opcoes?: {
  nomeDb?: string
  storageV1?: ArmazenamentoSimples | null
}): RepositorioEstudo {
  const nomeDb = opcoes?.nomeDb ?? NOME_IDB_ESTUDO
  const fallback = criarRepositorioMemoria({ storageV1: opcoes?.storageV1 })
  let db: IDBDatabase | null = null
  let cacheEstado: EstadoEstudoLocal = estadoEstudoVazio()
  let usandoFallback = false
  let promessaInit: Promise<void> | null = null

  async function lerDoBanco(banco: IDBDatabase): Promise<EstadoEstudoLocal> {
    const tx = banco.transaction([...STORES], 'readonly')
    const [eventosRaw, perfisRaw, itensRaw, migradoRaw] = await Promise.all([
      esperarReq(tx.objectStore('eventos').getAll()),
      esperarReq(tx.objectStore('perfis').getAll()),
      esperarReq(tx.objectStore('historico_itens').getAll()),
      esperarReq(tx.objectStore('meta').get(CHAVE_MIGRADA_V1)),
    ])
    const perfis: Record<string, PerfilTema> = {}
    for (const p of perfisRaw as PerfilTema[]) {
      if (p?.temaId) perfis[p.temaId] = p
    }
    const historicoItens: Record<string, RegistroItemEstudo> = {}
    for (const it of itensRaw as RegistroItemEstudo[]) {
      if (it?.itemId) historicoItens[it.itemId] = it
    }
    return {
      versao: 2,
      migradoV1: Boolean((migradoRaw as { valor?: unknown } | undefined)?.valor),
      eventos: (eventosRaw as EventoEstudo[]).slice(-LIMITE_EVENTOS_MEMORIA),
      perfis,
      historicoItens,
    }
  }

  async function persistirMigracaoV1(banco: IDBDatabase, estadoDepois: EstadoEstudoLocal): Promise<void> {
    const tx = banco.transaction(['perfis', 'meta'], 'readwrite')
    const storePerfis = tx.objectStore('perfis')
    for (const p of Object.values(estadoDepois.perfis)) {
      storePerfis.put(p)
    }
    tx.objectStore('meta').put({ chave: CHAVE_MIGRADA_V1, valor: true })
    await esperarTx(tx)
  }

  const inicializar = async (): Promise<void> => {
    if (promessaInit) return promessaInit
    promessaInit = (async () => {
      if (typeof indexedDB === 'undefined') {
        usandoFallback = true
        await fallback.inicializar()
        cacheEstado = await fallback.lerEstado()
        return
      }
      let aberto: IDBDatabase | null = null
      try {
        aberto = await abrirBancoIdb(nomeDb)
        let lido = await lerDoBanco(aberto)
        if (!lido.migradoV1) {
          const storageV1 = opcoes?.storageV1 !== undefined ? opcoes.storageV1 : armazenamentoDoNavegador()
          const cadernoV1 = carregarCaderno(storageV1)
          lido = migrarCadernoV1ParaEstado(cadernoV1, lido)
          await persistirMigracaoV1(aberto, lido)
        }
        db = aberto
        cacheEstado = lido
      } catch {
        aberto?.close()
        usandoFallback = true
        db = null
        await fallback.inicializar()
        cacheEstado = await fallback.lerEstado()
      }
    })()
    return promessaInit
  }

  return {
    inicializar,
    async registrarEvento(evento: EventoEstudo): Promise<void> {
      await inicializar()
      const proximo = aplicarEventoNoEstado(cacheEstado, evento)
      if (proximo === cacheEstado) return
      cacheEstado = proximo
      if (usandoFallback || !db) {
        await fallback.registrarEvento(evento)
        return
      }
      try {
        const tx = db.transaction(['eventos', 'perfis', 'historico_itens'], 'readwrite')
        tx.objectStore('eventos').add(evento)
        const perfilAtualizado = proximo.perfis[evento.temaId]
        if (perfilAtualizado) tx.objectStore('perfis').put(perfilAtualizado)
        const itemAtualizado = proximo.historicoItens[evento.itemId]
        if (itemAtualizado) tx.objectStore('historico_itens').put(itemAtualizado)
        await esperarTx(tx)
      } catch {
        // Mantem cache em memoria ativo mesmo se uma gravacao em disco falhar (aba privada/cota)
      }
    },
    async lerEstado(): Promise<EstadoEstudoLocal> {
      await inicializar()
      return usandoFallback ? fallback.lerEstado() : cacheEstado
    },
    async exportarTudoJson(): Promise<string> {
      await inicializar()
      const atual = await this.lerEstado()
      return JSON.stringify(atual, null, 2)
    },
    async apagarTudo(): Promise<void> {
      await inicializar()
      cacheEstado = { ...estadoEstudoVazio(), migradoV1: true }
      await fallback.apagarTudo()
      if (usandoFallback || !db) return
      try {
        const tx = db.transaction([...STORES], 'readwrite')
        tx.objectStore('eventos').clear()
        tx.objectStore('perfis').clear()
        tx.objectStore('historico_itens').clear()
        tx.objectStore('meta').put({ chave: CHAVE_MIGRADA_V1, valor: true })
        await esperarTx(tx)
      } catch {
        // Sem excecoes para a UI
      }
    },
  }
}
