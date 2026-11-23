import {
  abrirMapa,
  criarAtlas,
  definirPoliticaMinimapas,
  escreverFicha,
  fichaEm,
  resumoCartograficoAtlas,
  stepAtlas,
  voltarAoCorpo,
} from './atlas'
import { biomaDoQuadrado } from './biomaRecursos'
import { camadaDoMapa } from './camadaDoMapa'
import { PARTIDA } from './partidaPolicies'
import { createPartida, editarBlocoMundo, fundar, INPUT_PARADO } from './partidaSim'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  // 1. Modo 'atual': abrir 25 mapas vazios NÃO retém fichas vazias na RAM; mantém toda a cartografia.
  let atlasAtual = definirPoliticaMinimapas(criarAtlas(), 'atual')
  for (let idx = 1; idx <= 25; idx += 1) {
    atlasAtual = abrirMapa(atlasAtual, idx + 2, 0)
  }
  assert(
    atlasAtual.fichas.length <= 2,
    `modo atual: esperava no máximo 2 fichas vivas (corpo + cena), vieram ${atlasAtual.fichas.length}`,
  )
  assert(
    Object.keys(atlasAtual.cartografia).length === 26,
    `cartografia deve lembrar os 26 quadrados visitados (veio ${Object.keys(atlasAtual.cartografia).length})`,
  )
  const resumoCarto = resumoCartograficoAtlas(atlasAtual)
  assert(
    resumoCarto.length === 26 && resumoCarto.filter((e) => !e.emMemoria).length >= 24,
    'resumoCartograficoAtlas expõe mapas descarregados da RAM com dono e bioma preservados',
  )

  // 2. Modo 'alguns': abrir 15 mapas vazios mantém apenas PARTIDA.mapasResidentes fichas vivas
  let atlasAlguns = criarAtlas()
  for (let idx = 1; idx <= 15; idx += 1) {
    atlasAlguns = abrirMapa(atlasAlguns, 0, idx + 2)
  }
  assert(
    atlasAlguns.fichas.length <= PARTIDA.mapasResidentes,
    `modo alguns: esperava <= ${PARTIDA.mapasResidentes} fichas vivas, vieram ${atlasAlguns.fichas.length}`,
  )
  assert(
    Object.keys(atlasAlguns.cartografia).length === 16,
    'modo alguns: cartografia preserva os 16 mapas visitados mesmo após descarte',
  )

  // 3. Mapas com presença nossa (obra/bloco) NÃO são descartados mesmo no modo 'atual'
  const comNossaBase = fundar(createPartida(4, 0, false), 'nucleo', 5, 0)
  assert(
    comNossaBase.obras.some((o) => o.lado === 'nosso' && o.tipo === 'nucleo'),
    'arranjo: base nossa fundada em (4,0)',
  )
  let atlasPreserva = definirPoliticaMinimapas(criarAtlas(), 'atual')
  atlasPreserva = escreverFicha(atlasPreserva, 4, 0, { ...comNossaBase, semCorpo: true }, 'cheio')
  const comBloco = editarBlocoMundo(
    { ...createPartida(5, 0, false), semCorpo: true, madeira: 5, obras: [], unidades: [] },
    6,
    0,
    6,
    'adicionar',
    'madeira',
  )
  assert(Object.keys(comBloco.blocosMapa).length === 1, 'arranjo: bloco livre colocado em (5,0)')
  atlasPreserva = escreverFicha(atlasPreserva, 5, 0, comBloco, 'cheio')
  for (let idx = 6; idx <= 16; idx += 1) {
    atlasPreserva = abrirMapa(atlasPreserva, idx, 0)
  }
  assert(
    fichaEm(atlasPreserva, 4, 0) !== undefined && fichaEm(atlasPreserva, 5, 0) !== undefined,
    'mapas com base nossa ou blocos editados são preservados em memória mesmo sob pressão',
  )
  assert(
    fichaEm(atlasPreserva, 6, 0) === undefined && fichaEm(atlasPreserva, 7, 0) === undefined,
    'mapas apenas espiados sem presença saem da memória',
  )

  // 4. Reabrir um mapa descartado pela cartografia regenera deterministicamente com o mesmo bioma
  const biomaEsperado = atlasAtual.cartografia['10,0'].bioma
  const reaberto = abrirMapa(atlasAtual, 10, 0)
  assert(
    fichaEm(reaberto, 10, 0)?.state.bioma === biomaEsperado,
    'reabrir mapa descartado restaura exatamente o mesmo bioma determinístico',
  )
  const voltou = voltarAoCorpo(reaberto)
  assert(voltou.cenaI === 0 && voltou.cenaJ === 0, 'voltarAoCorpo continua retornando à ficha do corpo')

  // 5. Anti-thundering herd: 8 mapas preservados em `lento` acumulando 1.0s juntos executam no máximo PARTIDA.maxLentosPorFrame por frame de 0.05s
  let atlasLento = definirPoliticaMinimapas(criarAtlas(), 'atual')
  for (let k = 3; k <= 10; k += 1) {
    const st = fundar(createPartida(k, 0, false), 'nucleo', 0, 0)
    atlasLento = escreverFicha(atlasLento, k, 0, { ...st, semCorpo: true }, 'lento')
  }
  // Acumula 0.98s em todos os lentos simultaneamente
  for (let p = 0; p < 20; p += 1) {
    atlasLento = stepAtlas(atlasLento, INPUT_PARADO, 0.049)
  }
  const prontosAntes = atlasLento.fichas.filter((f) => f.ritmo === 'lento' && f.relogio >= 0.98).length
  assert(prontosAntes >= 6, `arranjo: esperava >= 6 lentos prontos para disparar, vieram ${prontosAntes}`)
  atlasLento = stepAtlas(atlasLento, INPUT_PARADO, 0.04)
  const aindaAcimaDe1 = atlasLento.fichas.filter((f) => f.ritmo === 'lento' && f.relogio >= 1).length
  assert(
    aindaAcimaDe1 >= prontosAntes - PARTIDA.maxLentosPorFrame,
    `staggering: esperava no máximo ${PARTIDA.maxLentosPorFrame} lentos executados neste frame`,
  )
  // Em mais alguns frames todos drenam
  for (let p = 0; p < 10; p += 1) {
    atlasLento = stepAtlas(atlasLento, INPUT_PARADO, 0.04)
  }
  assert(
    atlasLento.fichas.filter((f) => f.ritmo === 'lento' && f.relogio >= 1).length === 0,
    'staggering drena toda a fila de mapas lentos nos frames subsequentes sem travar',
  )

  // 6. Biomas novos (tundra_cristal e basalto_brasa) só aparecem em camada >= 2 e nunca quebram camada 0/1
  const biomasCamada1 = new Set<string>()
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      if (camadaDoMapa(i, j) <= 1) biomasCamada1.add(biomaDoQuadrado(i, j))
    }
  }
  assert(
    !biomasCamada1.has('tundra_cristal') && !biomasCamada1.has('basalto_brasa'),
    'tundra_cristal e basalto_brasa nunca nascem na camada 0 ou 1',
  )
  const biomasCamada2Plus = new Set<string>()
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      if (camadaDoMapa(i, j) >= 2) biomasCamada2Plus.add(biomaDoQuadrado(i, j))
    }
  }
  assert(
    biomasCamada2Plus.has('tundra_cristal') && biomasCamada2Plus.has('basalto_brasa'),
    'tundra_cristal e basalto_brasa aparecem nas camadas externas (>= 2)',
  )
}
