import { cadernoVazio, registrarTentativa, salvarCaderno } from '../cadernoDeEstudo'
import {
  ABANDONO_MIN_MS,
  CHUTE_MAX_MS,
  aplicarEventoNoEstado,
  criarRepositorioMemoria,
  estadoEstudoVazio,
  migrarCadernoV1ParaEstado,
} from './repositorioEstudo'
import { criarRepositorioIndexedDb } from './repositorioIndexedDb'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function criarStorageMemoria() {
  const map = new Map<string, string>()
  return {
    getItem(k: string) {
      return map.get(k) ?? null
    },
    setItem(k: string, v: string) {
      map.set(k, v)
    },
  }
}

export async function run(): Promise<void> {
  // 1. Ciclo dos 4 eventos + isolamento de chute rápido (< 1.500 ms)
  let st = estadoEstudoVazio()
  st = aplicarEventoNoEstado(st, {
    tipo: 'dica_pedida',
    quando: 1000,
    itemId: 'enem_2025_136',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    nivelDica: 1,
    tempoDesdeAberturaMs: 3000,
  })
  assert(st.perfis.enem_razoes_escalas?.dicasPedidas === 1, 'dica_pedida não incrementou')

  // Chute rápido (< 1500 ms): entra em chutesRapidos e marca chute_rapido sem inflar peso como erro pensado
  st = aplicarEventoNoEstado(st, {
    tipo: 'erro_alternativa',
    quando: 2000,
    itemId: 'enem_2025_136',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    alternativaId: 'A',
    tagErro: 'unidade_escala',
    tempoDesdeAberturaMs: CHUTE_MAX_MS - 100,
  })
  const pChute = st.perfis.enem_razoes_escalas!
  assert(pChute.chutesRapidos === 1, 'chute rápido não marcado')
  assert(pChute.errosPorTag.chute_rapido === 1, 'tag chute_rapido esperada')
  assert((pChute.errosPorTag.unidade_escala ?? 0) === 0, 'chute não deve poluir tagErrors conceitual')
  assert(pChute.errosPonderados < 0.2, `peso do chute devia ser <= 0.15, veio ${pChute.errosPonderados}`)

  // Erro pensado (>= 8000 ms): tag específica entra com peso 1.0
  st = aplicarEventoNoEstado(st, {
    tipo: 'erro_alternativa',
    quando: 10_000,
    itemId: 'enem_2025_136',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    alternativaId: 'B',
    tagErro: 'unidade_escala',
    tempoDesdeAberturaMs: 9_500,
  })
  assert(st.perfis.enem_razoes_escalas!.errosPorTag.unidade_escala === 1, 'erro pensado não registrou tagErro')

  // Abandono muito rápido sem erro nem dica (< 2000 ms) é ignorado (abriu sem querer)
  const antesAbandonoCurto = st.perfis.enem_razoes_escalas!.abandonos
  st = aplicarEventoNoEstado(st, {
    tipo: 'abandono',
    quando: 11_000,
    itemId: 'enem_2025_136',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    errosAntesDeFechar: 0,
    maiorDicaUsada: 0,
    tempoAbertoMs: ABANDONO_MIN_MS - 500,
  })
  assert(st.perfis.enem_razoes_escalas!.abandonos === antesAbandonoCurto, 'abandono curto sem erro devia ser ignorado')

  // Abandono real (>= 2000 ms) entra no perfil e agenda revisão rápida
  st = aplicarEventoNoEstado(st, {
    tipo: 'abandono',
    quando: 20_000,
    itemId: 'enem_2025_136',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    errosAntesDeFechar: 1,
    maiorDicaUsada: 1,
    tempoAbertoMs: 5_000,
  })
  assert(st.perfis.enem_razoes_escalas!.abandonos === 1, 'abandono legítimo não incrementou')
  assert(st.historicoItens.enem_2025_136?.vezesAbandonada === 1, 'historicoItem devia guardar abandono')

  // Acerto final libera SRS
  st = aplicarEventoNoEstado(st, {
    tipo: 'acerto',
    quando: 50_000,
    itemId: 'enem_2025_136',
    assinatura: 'enem_2025_136',
    origem: 'enem_oficial',
    temaId: 'enem_razoes_escalas',
    grau: 5,
    errosNaConta: 0,
    maiorDicaUsada: 0,
    tempoTotalMs: 7_000,
    fatorBuff: 1,
  })
  assert(st.perfis.enem_razoes_escalas!.acertosDePrimeira === 1, 'acerto de primeira esperado')
  assert(st.historicoItens.enem_2025_136?.dominada === true, 'item devia marcar dominada ao acertar sem erro/dica')

  // 2. Migração idempotente e não destrutiva de ld_ilha_caderno_v1
  const storageV1 = criarStorageMemoria()
  let v1 = cadernoVazio()
  v1 = registrarTentativa(v1, {
    q: 1234,
    g: 2,
    c: 'assimetria_porcentagem',
    a: 'g2_porcentagem_universo_100',
    e: 2,
    t: 9_000,
    k: 'abc',
  })
  salvarCaderno(storageV1, v1)
  const brutoV1Antes = storageV1.getItem('ld_ilha_caderno_v1')

  const migrado1 = migrarCadernoV1ParaEstado(v1, estadoEstudoVazio())
  const migrado2 = migrarCadernoV1ParaEstado(v1, migrado1)
  assert(migrado1.migradoV1 && migrado1.perfis.assimetria_porcentagem?.errosTotais === 2, 'migração v1 falhou')
  assert(
    migrado2.perfis.assimetria_porcentagem?.tentativas === migrado1.perfis.assimetria_porcentagem?.tentativas,
    'migração v1 não foi idempotente',
  )

  // 3. Fallback silencioso para memória no Node (sem indexedDB) + exportar + apagar
  const repoMemFallback = criarRepositorioIndexedDb({ storageV1 })
  await repoMemFallback.inicializar()
  assert(storageV1.getItem('ld_ilha_caderno_v1') === brutoV1Antes, 'migração nunca pode apagar chave v1')
  const estadoInit = await repoMemFallback.lerEstado()
  assert(estadoInit.migradoV1 && estadoInit.perfis.assimetria_porcentagem?.tentativas === 1, 'repo IDB fallback não migrou v1')

  await repoMemFallback.registrarEvento({
    tipo: 'erro_alternativa',
    quando: 9999,
    itemId: 'x',
    origem: 'motor_parametrico',
    temaId: 'ponto_de_virada',
    grau: 1,
    alternativaId: 'c1',
    tagErro: 'calculo_aritmetico',
    tempoDesdeAberturaMs: 4000,
  })
  const json = await repoMemFallback.exportarTudoJson()
  assert(json.includes('"ponto_de_virada"'), 'exportarTudoJson não contém evento gravado')
  await repoMemFallback.apagarTudo()
  const aposApagar = await repoMemFallback.lerEstado()
  assert(aposApagar.eventos.length === 0 && Object.keys(aposApagar.perfis).length === 0, 'apagarTudo não limpou estado')

  const repoMemDireto = criarRepositorioMemoria({ storageV1 })
  await repoMemDireto.inicializar()
  assert((await repoMemDireto.lerEstado()).perfis.assimetria_porcentagem?.errosTotais === 2, 'repositorioMemoria falhou na migração v1')
}
