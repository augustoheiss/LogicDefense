import { chaveBlocoMundo, criarBlocoMundo } from './blocosMundo'
import {
  bateObraLivre,
  bloqueiosDeObraLivre,
  calcularEstornoMadeiraNv5,
  COTA_ESTORNO_BLUEPRINT_NV5,
  editarBlocoEmObraLivre,
  meiaLarguraObraLivre,
  pisoObraLivreEm,
  tetoObraLivreEm,
  validarAdicionarBlocoObraLivre,
} from './obraBlocosLivres'

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`obraBlocosLivres: ${msg}`)
}

export function run(): void {
  // 1. Guarda anti-exploit de madeira infinita ao desmontar fortaleza Nv5
  let saldo: number | undefined = undefined
  let madeira = 0
  for (let i = 0; i < 30; i += 1) {
    const r = calcularEstornoMadeiraNv5(saldo, 'remover')
    madeira += r.deltaMadeira
    saldo = r.proximosEstornos
  }
  assert(
    madeira === COTA_ESTORNO_BLUEPRINT_NV5,
    `desmontar 30 blocos do blueprint rende no máximo ${COTA_ESTORNO_BLUEPRINT_NV5} madeiras (obteve ${madeira})`,
  )
  // Adicionar 2 blocos e remover 2 blocos preserva saldo líquido 0
  const add1 = calcularEstornoMadeiraNv5(saldo, 'adicionar')
  const add2 = calcularEstornoMadeiraNv5(add1.proximosEstornos, 'adicionar')
  const rem1 = calcularEstornoMadeiraNv5(add2.proximosEstornos, 'remover')
  const rem2 = calcularEstornoMadeiraNv5(rem1.proximosEstornos, 'remover')
  const rem3 = calcularEstornoMadeiraNv5(rem2.proximosEstornos, 'remover')
  assert(
    add1.deltaMadeira === -1 && add2.deltaMadeira === -1 && rem1.deltaMadeira === 1 && rem2.deltaMadeira === 1 && rem3.deltaMadeira === 0,
    'blocos adicionados pelo jogador são 100% estornáveis sem inflacionar madeira',
  )

  // 2. Física e edição de estrutura manual consagrada (arco/sala oca 1.0 m)
  const sala = [
    criarBlocoMundo(10, 0, 10, 'pedra'),
    criarBlocoMundo(10, 1, 10, 'pedra'),
    criarBlocoMundo(12, 0, 10, 'pedra'),
    criarBlocoMundo(12, 1, 10, 'pedra'),
    criarBlocoMundo(11, 2, 10, 'madeira'), // teto do arco sobre (11, z=10)
  ]
  assert(bateObraLivre(10, 0, 10, sala), 'pilar oeste bloqueia no térreo')
  assert(!bateObraLivre(11, 0, 10, sala), 'vão central (11,10) é transitável sob o teto y=2')
  assert(tetoObraLivreEm(11, 0, 10, sala) < 1.0, 'teto y=2 limita salto dentro do arco')
  assert(pisoObraLivreEm(11, 2.7, 10, sala) === 3, 'topo do arco (y=3) é caminhável')

  const blqs = bloqueiosDeObraLivre(sala)
  assert(blqs.length === 2, 'bloqueios A* incluem apenas os 2 pilares no térreo, mantendo corredor (11,10) aberto')

  const meia = meiaLarguraObraLivre(sala, 11, 10)
  assert(meia.hx === 1.5 && meia.hz === 1.0, 'meia largura deriva da envoltória real dos blocos livres')

  // Edição de obra consagrada + proteção contra remoção do último bloco
  const added = editarBlocoEmObraLivre(sala, 11, 3, 10, 'adicionar', 'ouro', { x: 0, y: 0, z: 0 }, [])
  assert(added.ok && added.blocos.length === 6 && added.materialAfetado === 'ouro', 'adiciona bloco ouro em obra consagrada')

  const soloBloco = [criarBlocoMundo(10, 0, 10, 'madeira')]
  const bloqueioUltimo = editarBlocoEmObraLivre(soloBloco, 10, 0, 10, 'remover', 'madeira', null, [])
  assert(!bloqueioUltimo.ok && bloqueioUltimo.motivo === 'ultimo_bloco', 'impede apagar o último bloco de uma obra consagrada')

  // Validação unificada DbC (Ghost Highlight === editarBlocoEmObraLivre)
  const recCheio = { madeira: 3, lingotes: 2, ouro: 1 }
  const mapaOcup = { [chaveBlocoMundo(11, 0, 10)]: criarBlocoMundo(11, 0, 10, 'pedra') }
  assert(!validarAdicionarBlocoObraLivre(sala, 10, 6, 10, 'madeira', recCheio, null, []).valido, 'recusa acima da altura máxima')
  assert(!validarAdicionarBlocoObraLivre(sala, 10, 0, 10, 'madeira', recCheio, null, []).valido, 'recusa célula ocupada na própria obra')
  assert(
    validarAdicionarBlocoObraLivre(sala, 11, 0, 10, 'madeira', recCheio, null, [], mapaOcup).motivo === 'ocupado',
    'recusa sobreposição com blocosMapa',
  )
  assert(
    validarAdicionarBlocoObraLivre(sala, 11, 0, 10, 'ouro', { madeira: 0, lingotes: 0, ouro: 0 }, null, []).motivo === 'sem_recurso',
    'recusa ouro sem ouro',
  )
  assert(
    validarAdicionarBlocoObraLivre(sala, 11, 0, 10, 'madeira', recCheio, { x: 11, y: 0, z: 10 }, []).motivo === 'colide_corpo',
    'recusa colocar bloco em cima do herói',
  )
  assert(
    validarAdicionarBlocoObraLivre(sala, 11, 0, 10, 'madeira', recCheio, null, [{ x: 11, z: 10, hp: 10 }]).motivo === 'colide_entidade',
    'recusa colocar bloco em cima de unidade',
  )
  assert(validarAdicionarBlocoObraLivre(sala, 11, 3, 10, 'ouro', recCheio, { x: 0, y: 0, z: 0 }, []).valido, 'aceita célula livre com recurso')
}
