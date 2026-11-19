import { chaveBlocoMundo, criarBlocoMundo, MapaBlocos } from './blocosMundo'
import {
  blocoColideHeroi,
  mensagemMotivoBloco,
  resolverAlvoBlocoMundoPorFace,
  resolverAlvoBlocoNoChao,
  temRecursoParaMaterial,
} from './alvoBlocoUnificado'

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`alvoBlocoUnificado: ${msg}`)
}

export function run(): void {
  const baseRecursos = { madeira: 3, lingotes: 2, ouro: 1 }
  assert(temRecursoParaMaterial(baseRecursos, 'madeira', 3), 'tem 3 madeiras')
  assert(!temRecursoParaMaterial(baseRecursos, 'madeira', 4), 'não tem 4 madeiras')
  assert(temRecursoParaMaterial(baseRecursos, 'pedra', 2), 'pedra usa lingotes')
  assert(temRecursoParaMaterial(baseRecursos, 'ouro', 1), 'ouro usa ouro')
  assert(!temRecursoParaMaterial(baseRecursos, 'ouro', 2), 'bloqueia ouro insuficiente')

  const mapa: MapaBlocos = {
    [chaveBlocoMundo(5, 0, 5)]: criarBlocoMundo(5, 0, 5, 'madeira'),
  }
  const ctxBase = {
    blocosMapa: mapa,
    recursos: baseRecursos,
    heroi: { x: 0, y: 0, z: 0 },
    unidades: [{ x: 10, z: 10, hp: 12 }],
    chaoRevelado: (x: number, z: number) => Math.hypot(x, z) < 20,
    colideObraEm: (gx: number, _gy: number, gz: number) => gx === 8 && gz === 8,
  }

  // Empilhar no topo de um bloco existente (face +Y)
  const topo = resolverAlvoBlocoMundoPorFace(5, 0, 5, { x: 5, y: 0.99, z: 5 }, 'adicionar', 'pedra', ctxBase)
  assert(topo !== null && topo.tipo === 'mundo' && topo.valido && topo.gx === 5 && topo.gy === 1 && topo.gz === 5, 'empilha no topo (5,1,5)')

  // Remover bloco existente mesmo sem recursos
  const remover = resolverAlvoBlocoMundoPorFace(
    5,
    0,
    5,
    { x: 5, y: 0.5, z: 5 },
    'remover',
    'madeira',
    { ...ctxBase, recursos: { madeira: 0, lingotes: 0, ouro: 0 } },
  )
  assert(remover !== null && remover.tipo === 'mundo' && remover.valido && remover.acao === 'remover', 'remoção funciona com recurso 0')

  // Chão válido vs bloqueios DbC
  const chaoOk = resolverAlvoBlocoNoChao(4.2, 4.1, 'madeira', ctxBase)
  assert(chaoOk.valido && chaoOk.gx === 4 && chaoOk.gy === 0 && chaoOk.gz === 4, 'chão arredonda para célula (4,0,4)')

  const chaoHeroi = resolverAlvoBlocoNoChao(0, 0, 'madeira', ctxBase)
  assert(!chaoHeroi.valido && chaoHeroi.motivo === 'colide_corpo', 'bloqueia colocar bloco sobre o herói')
  assert(blocoColideHeroi(0, 0, 0, { x: 0, y: 0, z: 0 }), 'colide com corpo do herói em (0,0,0)')
  assert(!blocoColideHeroi(0, 2, 0, { x: 0, y: 0, z: 0 }), 'bloco acima da cabeça não colide com herói')

  const chaoUnidade = resolverAlvoBlocoNoChao(10, 10, 'madeira', ctxBase)
  assert(!chaoUnidade.valido && chaoUnidade.motivo === 'colide_entidade', 'bloqueia colocar bloco sobre unidade')

  const chaoObra = resolverAlvoBlocoNoChao(8, 8, 'madeira', ctxBase)
  assert(!chaoObra.valido && chaoObra.motivo === 'ocupado', 'bloqueia colocar bloco dentro de obra')

  const chaoNeblina = resolverAlvoBlocoNoChao(30, 30, 'madeira', ctxBase)
  assert(!chaoNeblina.valido && chaoNeblina.motivo === 'nao_revelado', 'bloqueia colocar bloco na neblina')

  const semOuro = resolverAlvoBlocoNoChao(4, 4, 'ouro', { ...ctxBase, recursos: { madeira: 5, lingotes: 5, ouro: 0 } })
  assert(!semOuro.valido && semOuro.motivo === 'sem_recurso', 'bloqueia ouro quando ouro === 0')
  assert(mensagemMotivoBloco(semOuro.motivo, 'ouro').includes('Ouro'), 'mensagem de motivo descreve material')
}
