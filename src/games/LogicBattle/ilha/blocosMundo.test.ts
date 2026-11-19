import {
  bateBlocoMundo,
  blocoMundoParaCentro,
  bloqueiosDeBlocosMundo,
  chaveBlocoMundo,
  coletarEstruturaConexa,
  construirAlturasColunas,
  cotaVisaoHeroiBlocos,
  cotaVisaoTorreBlocos,
  criarBlocoMundo,
  linhaVisaoLivre25D,
  MapaBlocos,
  MAX_BLOCOS_ESTRUTURA,
  pisoBlocoMundoEm,
  planejarLinhaBlocos,
  rasterizarLinha360,
  SPEC_BLOCO_MATERIAL,
  tetoBlocoMundoEm,
} from './blocosMundo'

function assert(condition: boolean, name: string): asserts condition {
  if (!condition) throw new Error(name)
}

export function run(): void {
  // 1. Rasterização 360° 4-conexa (sem furos diagonais em 45° e quadrantes opostos)
  const diag = rasterizarLinha360(0, 5, 6, 11)
  assert(diag[0].x === 0 && diag[0].z === 5, 'linha 45° inicia no ponto exato')
  assert(diag[diag.length - 1].x === 6 && diag[diag.length - 1].z === 11, 'linha 45° termina no ponto exato')
  for (let i = 1; i < diag.length; i += 1) {
    const manhattan = Math.abs(diag[i].x - diag[i - 1].x) + Math.abs(diag[i].z - diag[i - 1].z)
    assert(manhattan === 1, `passo ${i} da linha 45° é estritamente 4-conexo (sem furo diagonal)`)
  }
  const diagReversa = rasterizarLinha360(5, 5, -1, -2)
  assert(diagReversa.length >= 13, 'linha reversa em quadrante negativo é contínua')
  for (let i = 1; i < diagReversa.length; i += 1) {
    const manhattan =
      Math.abs(diagReversa[i].x - diagReversa[i - 1].x) + Math.abs(diagReversa[i].z - diagReversa[i - 1].z)
    assert(manhattan === 1, 'linha 360° em direção negativa também é 4-conexa')
  }

  // 2. Planejamento de linha 360° (custo exato e dedupe contra blocos já existentes)
  const inicial: Record<string, ReturnType<typeof criarBlocoMundo>> = {
    [chaveBlocoMundo(0, 0, 5)]: criarBlocoMundo(0, 0, 5, 'madeira'),
  }
  const planoMuralha = planejarLinhaBlocos(inicial, 0, 5, 4, 5, 2, 'madeira', () => true)
  // 5 colunas x 2 altura = 10 blocos menos 1 já existente = 9 novos blocos
  assert(planoMuralha.celulas.length === 9 && planoMuralha.custoTotal === 9, 'planejarLinhaBlocos desconta células já ocupadas e cobra custo exato')
  assert(planoMuralha.recurso === 'madeira', 'material madeira usa recurso madeira')
  const planoPedra = planejarLinhaBlocos({}, 0, 5, 2, 5, 1, 'pedra', () => true)
  assert(planoPedra.celulas.length === 3 && planoPedra.recurso === 'lingotes' && SPEC_BLOCO_MATERIAL.pedra.hp > SPEC_BLOCO_MATERIAL.madeira.hp, 'bloco de pedra usa lingotes e tem mais HP que madeira')

  // 3. Verticalidade, piso e bloqueios A* dos blocos livres (1,0 m)
  const mapaMuro: Record<string, ReturnType<typeof criarBlocoMundo>> = {}
  for (let gx = -2; gx <= 2; gx += 1) {
    mapaMuro[chaveBlocoMundo(gx, 0, 5)] = criarBlocoMundo(gx, 0, 5, 'madeira')
  }
  assert(bateBlocoMundo(0, 0, 5, mapaMuro), 'trincheira de 1 bloco bloqueia lateralmente no chão')
  assert(!bateBlocoMundo(0, 1.0, 5, mapaMuro), 'herói no topo da trincheira (y=1) não colide lateralmente')
  assert(pisoBlocoMundoEm(0, 0.9, 5, mapaMuro) === 1, 'topo do bloco y=0 vira piso caminhável em y=1.0')
  assert(bloqueiosDeBlocosMundo(mapaMuro).length === 5, 'bloqueiosDeBlocosMundo emite 1 bloqueio por coluna ocupada')

  const mapaTeto: MapaBlocos = {
    [chaveBlocoMundo(3, 2, 3)]: criarBlocoMundo(3, 2, 3, 'pedra'),
  }
  const teto = tetoBlocoMundoEm(3, 0, 3, mapaTeto)
  assert(teto < 0.6 && teto > 0.4, 'bloco suspenso em y=2 atua como teto físico')
  assert(blocoMundoParaCentro(2, 1, -3).y === 1.5, 'centro do bloco y=1 fica em 1.5m')

  // 4. LoS 2.5D DDA Supercover: Trincheira (1 bloco) vs Muralha (2 blocos) vs Torre Nv5 (até 3 blocos)
  const colunasTrincheira = construirAlturasColunas(mapaMuro) // altura = 1 em z = 5
  assert(
    linhaVisaoLivre25D(0, 0, cotaVisaoTorreBlocos(1), 0, 10, colunasTrincheira),
    'torre Nv1 enxerga por cima de trincheira de 1 bloco',
  )
  const mapaMuralha2: Record<string, ReturnType<typeof criarBlocoMundo>> = { ...mapaMuro }
  for (let gx = -2; gx <= 2; gx += 1) {
    mapaMuralha2[chaveBlocoMundo(gx, 1, 5)] = criarBlocoMundo(gx, 1, 5, 'madeira')
  }
  const colunas2 = construirAlturasColunas(mapaMuralha2)
  assert(
    !linhaVisaoLivre25D(0, 0, cotaVisaoTorreBlocos(1), 0, 10, colunas2),
    'muralha de 2 blocos oclui visão de torre Nv1..4',
  )
  assert(
    !linhaVisaoLivre25D(0, 0, cotaVisaoHeroiBlocos(0), 0, 10, colunas2),
    'muralha de 2 blocos oclui tiro do herói no chão',
  )
  assert(
    linhaVisaoLivre25D(0, 0, cotaVisaoHeroiBlocos(2.0), 0, 10, colunas2),
    'herói em plano elevado (y=2) atira por cima da muralha de 2 blocos',
  )
  assert(
    linhaVisaoLivre25D(0, 0, cotaVisaoTorreBlocos(5), 0, 10, colunas2),
    'torre Nv5 enxerga por cima de muralha de 2 blocos',
  )

  const mapaMuralha3: Record<string, ReturnType<typeof criarBlocoMundo>> = { ...mapaMuralha2 }
  for (let gx = -2; gx <= 2; gx += 1) {
    mapaMuralha3[chaveBlocoMundo(gx, 2, 5)] = criarBlocoMundo(gx, 2, 5, 'pedra')
  }
  const colunas3 = construirAlturasColunas(mapaMuralha3)
  assert(
    linhaVisaoLivre25D(0, 0, cotaVisaoTorreBlocos(5), 0, 10, colunas3),
    'torre Nv5 enxerga e atira acima de muralha de 3 blocos',
  )
  const mapaMuralha4: Record<string, ReturnType<typeof criarBlocoMundo>> = {
    ...mapaMuralha3,
    [chaveBlocoMundo(0, 3, 5)]: criarBlocoMundo(0, 3, 5, 'ouro'),
  }
  const colunas4 = construirAlturasColunas(mapaMuralha4)
  assert(
    !linhaVisaoLivre25D(0, 0, cotaVisaoTorreBlocos(5), 0, 10, colunas4),
    'muralha de 4 blocos oclui até a torre Nv5',
  )

  // Muralha diagonal 45° de 2 blocos não deixa raio cruzar em diagonal
  const mapaDiag2: Record<string, ReturnType<typeof criarBlocoMundo>> = {}
  for (const c of rasterizarLinha360(-3, 5, 3, 11)) {
    mapaDiag2[chaveBlocoMundo(c.x, 0, c.z)] = criarBlocoMundo(c.x, 0, c.z, 'madeira')
    mapaDiag2[chaveBlocoMundo(c.x, 1, c.z)] = criarBlocoMundo(c.x, 1, c.z, 'madeira')
  }
  assert(
    !linhaVisaoLivre25D(-3, 11, cotaVisaoTorreBlocos(1), 3, 5, construirAlturasColunas(mapaDiag2)),
    'muralha diagonal 45° de 2 blocos sela completamente a linha de visão',
  )

  // 5. BFS 3D 6-conexo e Circuit Breaker para Consagração (Fase 6)
  const torreManual: Record<string, ReturnType<typeof criarBlocoMundo>> = {}
  for (let by = 0; by < 3; by += 1) {
    torreManual[chaveBlocoMundo(8, by, 8)] = criarBlocoMundo(8, by, 8, 'pedra')
    torreManual[chaveBlocoMundo(9, by, 8)] = criarBlocoMundo(9, by, 8, 'pedra')
  }
  // Bloco desconexo e bloco apenas diagonal (não 6-conexo) não devem entrar na coleta
  torreManual[chaveBlocoMundo(20, 0, 20)] = criarBlocoMundo(20, 0, 20, 'madeira')
  torreManual[chaveBlocoMundo(10, 0, 9)] = criarBlocoMundo(10, 0, 9, 'madeira')
  const bfsOk = coletarEstruturaConexa(torreManual, 8, 0, 8)
  assert(bfsOk.ok && bfsOk.blocos.length === 6 && bfsOk.altura === 3, 'BFS 3D 6-conexo coleta apenas a estrutura conectada sem unir diagonais')

  // Circuit breaker de span > 13
  const muroLongo: Record<string, ReturnType<typeof criarBlocoMundo>> = {}
  for (let gx = 0; gx < 16; gx += 1) {
    muroLongo[chaveBlocoMundo(gx, 0, 0)] = criarBlocoMundo(gx, 0, 0, 'madeira')
  }
  const bfsSpan = coletarEstruturaConexa(muroLongo, 0, 0, 0)
  assert(!bfsSpan.ok && bfsSpan.motivo === 'span_excedido', 'circuit breaker bloqueia estrutura maior que 13x13')

  // Circuit breaker de > 256 blocos
  const cuboGigante: Record<string, ReturnType<typeof criarBlocoMundo>> = {}
  for (let x = 0; x < 7; x += 1) {
    for (let z = 0; z < 7; z += 1) {
      for (let y = 0; y < 6; y += 1) {
        cuboGigante[chaveBlocoMundo(x, y, z)] = criarBlocoMundo(x, y, z, 'madeira')
      }
    }
  }
  assert(Object.keys(cuboGigante).length > MAX_BLOCOS_ESTRUTURA, 'setup > 256 blocos')
  const bfsMax = coletarEstruturaConexa(cuboGigante, 0, 0, 0)
  assert(!bfsMax.ok && bfsMax.motivo === 'muito_grande', 'circuit breaker bloqueia estrutura com > 256 blocos')
}
