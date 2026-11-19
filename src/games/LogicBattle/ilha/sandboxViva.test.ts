import { PARTIDA } from './partidaPolicies'
import {
  atingirRecursoNoTiro,
  centroBlocoMundo,
  criarBlocosFortalezaNv5,
  emAguaRasa,
  gerarPaisagemBioma,
  gerarVeiosSubsolo,
  passoRecursosNaturais,
  SUBSOLO_CFG,
  VOXEL_NV5,
} from './biomaRecursos'
import {
  bateBlocoNv5,
  bateObraUniversal,
  decidirAcaoPonteiro,
  editarBlocoEmArray,
  filtrarHitEdicao,
  normalDominanteMundo,
  ObraVertical,
  pisoUniversalEm,
  resolverAlvoEdicaoVoxel,
  tetoUniversalEm,
  topoObraPadrao,
} from './verticalidadeVoxel'

function assert(condition: boolean, name: string): asserts condition {
  if (!condition) throw new Error(name)
}

export function run(): void {
  // 1. Biomas, árvores, minas de ouro e água rasa
  const m00 = gerarPaisagemBioma(0, 0)
  assert(m00.bioma === 'clareira', 'quadrado inicial é clareira')
  assert(m00.recursos.some((r) => r.tipo === 'arvore') && m00.recursos.some((r) => r.tipo === 'ouro'), 'há árvores e ouro no mapa')
  assert(
    m00.recursos.every((r) => !(Math.abs(r.x) < 7.5 && r.z > -8 && r.z < 49)),
    'corredor central da pista nasce livre de árvores e rochas',
  )

  const lagoa = { x: 20, z: -16, rx: 5, rz: 4 }
  assert(emAguaRasa([lagoa], 20, -16, 0), 'superfície dentro da elipse está na água rasa')
  assert(!emAguaRasa([lagoa], 20, -16, 0.9), 'pulo acima da lâmina sai da água rasa')
  assert(!emAguaRasa([lagoa], 20, -16, SUBSOLO_CFG.pisoY), 'subsolo abaixo da lagoa não sofre lentidão de superfície')

  // Colheita de árvore e rebrote após 45s
  const arvoreTeste = [{ id: 1, tipo: 'arvore' as const, x: 0, z: 5, yBase: 0, hp: 24, maxHp: 24, regeneraEm: 0 }]
  const golpe1 = atingirRecursoNoTiro(arvoreTeste, 0, 0, 0, 0, 14, 45)
  assert(golpe1.acertou && golpe1.ganhoMadeira === 1 && golpe1.recursos[0].hp === 12, '1º golpe na árvore rende madeira')
  const golpe2 = atingirRecursoNoTiro(golpe1.recursos, 0, 0, 0, 0, 14, 45)
  assert(golpe2.acertou && golpe2.ganhoMadeira === 3 && golpe2.recursos[0].hp === 0 && golpe2.recursos[0].regeneraEm === 45, 'derrubar árvore rende bônus e inicia toco')
  const rebrotou = passoRecursosNaturais(golpe2.recursos, [{ x: 2, z: 5 }], [{ x: 10, z: 10 }], 0, 46)
  assert(rebrotou.recursos[0].hp === 24 && rebrotou.ganhoMadeira > 0 && rebrotou.ganhoOuro > 0, 'árvore rebrota e serraria/mina geram recursos passivos')

  // Mineração no subsolo (y = -3,2m)
  const subOuro = gerarVeiosSubsolo(10, 10, 8000)
  const alvoSub = subOuro[0]
  const yawSub = Math.atan2(-(alvoSub.x - 10), alvoSub.z - 10)
  const minerouSub = atingirRecursoNoTiro([...arvoreTeste, ...subOuro], 10, SUBSOLO_CFG.pisoY, 10, yawSub, 14, 45)
  assert(minerouSub.acertou && minerouSub.ganhoOuro >= 1, 'herói no subsolo minera veio de ouro subterrâneo')

  // 2. Pulo universal sobre construções (Núcleo 1,6m e Torre 2,0m via peitoril 1,1m)
  const nucleo: ObraVertical = { id: 10, lado: 'nosso', tipo: 'nucleo', x: 8, z: 8, nivel: 1, hp: 100 }
  const torre: ObraVertical = { id: 11, lado: 'nosso', tipo: 'torre', x: -8, z: -8, nivel: 1, hp: 50 }
  assert(bateObraUniversal(8, 8, [nucleo], -1, 0), 'no chão a parede do núcleo bloqueia')
  assert(!bateObraUniversal(8, 8, [nucleo], -1, topoObraPadrao(nucleo)), 'no topo do núcleo o herói caminha livre')
  assert(pisoUniversalEm(8, 1.62, 8, false, [nucleo], [], null) === topoObraPadrao(nucleo), 'teto do núcleo sustenta os pés')
  assert(pisoUniversalEm(-8 + 0.7, 1.05, -8, false, [torre], [], null) === 1.1, 'peitoril intermediário da torre sustenta o 1º salto')
  assert(pisoUniversalEm(-8, 1.98, -8, false, [torre], [], null) === topoObraPadrao(torre), 'topo da torre sustenta o 2º salto')

  // 3. Fortaleza Nível 5+ entrável e editável bloco a bloco
  const fortalezaNv5: ObraVertical = {
    id: 50,
    lado: 'nosso',
    tipo: 'nucleo',
    x: 20,
    z: 20,
    nivel: 5,
    hp: 180,
    blocosNv5: criarBlocosFortalezaNv5(),
  }
  const portaSul = centroBlocoMundo(20, 20, 3, 0, VOXEL_NV5.nz - 1)
  const paredeOeste = centroBlocoMundo(20, 20, 0, 0, 2)
  assert(!bateBlocoNv5(portaSul.x, 0, portaSul.z, fortalezaNv5), 'porta frontal da fortaleza Nv.5 é aberta para entrar')
  assert(!bateBlocoNv5(20, 0, 20, fortalezaNv5), 'salão interno da fortaleza Nv.5 é caminhável')
  assert(bateBlocoNv5(paredeOeste.x, 0, paredeOeste.z, fortalezaNv5), 'parede fechada bloqueia antes de esculpir')

  // Esculpir passagem na parede oeste (remover bloco by=0 e by=1)
  let editados = editarBlocoEmArray(fortalezaNv5.blocosNv5!, 20, 20, 0, 0, 2, 'remover', { x: 20, y: 0, z: 20 })
  assert(editados !== null, 'remove bloco térreo da parede')
  editados = editarBlocoEmArray(editados, 20, 20, 0, 1, 2, 'remover', { x: 20, y: 0, z: 20 })
  assert(editados !== null, 'remove bloco superior da nova porta')
  assert(!bateBlocoNv5(paredeOeste.x, 0, paredeOeste.z, { ...fortalezaNv5, blocosNv5: editados }), 'nova porta esculpida permite passagem')

  // Adicionar bloquinho no salão para subir e validar piso + proteção anti-sufocamento
  const recusadoNoCorpo = editarBlocoEmArray(editados, 20, 20, 3, 0, 3, 'adicionar', { x: 20, y: 0, z: 20 })
  assert(recusadoNoCorpo === null, 'não coloca bloco sólido em cima do próprio corpo do herói')
  const degrauNovo = editarBlocoEmArray(editados, 20, 20, 4, 0, 3, 'adicionar', { x: 20, y: 0, z: 20 })
  assert(degrauNovo !== null, 'adiciona bloquinho ao lado no salão')
  const centroDegrau = centroBlocoMundo(20, 20, 4, 0, 3)
  assert(
    Math.abs(pisoUniversalEm(centroDegrau.x, 0.85, centroDegrau.z, false, [{ ...fortalezaNv5, blocosNv5: degrauNovo }], [], null) - VOXEL_NV5.passo) < 1e-6,
    'bloquinho adicionado vira degrau caminhável',
  )
  assert(tetoUniversalEm(20, 0, 20, [fortalezaNv5], null) < 2, 'laje do 2º andar atua como teto físico no térreo')

  // 4. Fase 1: FSM de clique vs arrasto + filtro de raycast em 3ª pessoa + alvo ghost voxel
  assert(decidirAcaoPonteiro(8) === 'arrasto' && decidirAcaoPonteiro(5) === 'clique', 'limiar 6px separa giro de câmera de clique em bloco')

  const nTop = normalDominanteMundo({ x: 0, y: 0.42, z: 0.1 }, { x: 0, y: 0, z: 0 })
  const nSul = normalDominanteMundo({ x: 0.1, y: 0.05, z: 0.42 }, { x: 0, y: 0, z: 0 })
  const nOeste = normalDominanteMundo({ x: -0.42, y: 0.05, z: 0.1 }, { x: 0, y: 0, z: 0 })
  assert(nTop[1] === 1 && nSul[2] === 1 && nOeste[0] === -1, 'normalDominanteMundo resolve faces sem depender do espaço local')

  // Câmera de 3ª pessoa em z = -6.5, herói em z = 0 olhando para +z (rayDir = 0,0,1)
  const hitAtrasDoHeroi = {
    hitPoint: { x: 0, y: 1.6, z: -2 },
    distance: 4.5,
    obraId: 50,
    bx: 0,
    by: 1,
    bz: 0,
    centro: { x: 0, y: 1.275, z: -2 },
  }
  const hitLongeDemais = {
    hitPoint: { x: 0, y: 1.6, z: 8.5 },
    distance: 15.0,
    obraId: 50,
    bx: 1,
    by: 1,
    bz: 1,
    centro: { x: 0, y: 1.275, z: 8.5 },
  }
  const hitNaMira = {
    hitPoint: { x: 0, y: 1.6, z: 4.0 },
    distance: 10.5,
    obraId: 50,
    bx: 2,
    by: 1,
    bz: 2,
    centro: { x: 0, y: 1.275, z: 4.0 },
  }
  const filtrado = filtrarHitEdicao(
    [hitAtrasDoHeroi, hitLongeDemais, hitNaMira],
    { x: 0, y: 1.6, z: -6.5 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 1.6, z: 0 },
    7.0,
  )
  assert(filtrado === hitNaMira, '3ª pessoa ignora parede atrás do herói e hits além de 7 m do olho do herói')
  assert(
    filtrarHitEdicao([hitAtrasDoHeroi, hitLongeDemais], { x: 0, y: 1.6, z: -6.5 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1.6, z: 0 }, 7.0) === null,
    'sem hit válido na faixa de 7 m à frente retorna null',
  )

  const centro404 = centroBlocoMundo(20, 20, 4, 0, 4)
  const alvoSemMadeira = resolverAlvoEdicaoVoxel(
    fortalezaNv5,
    4,
    0,
    4,
    { x: centro404.x, y: centro404.y + 0.42, z: centro404.z },
    centro404,
    'adicionar',
    0,
    { x: 20, y: 0, z: 20 },
  )
  assert(alvoSemMadeira !== null && !alvoSemMadeira.valido && alvoSemMadeira.motivo === 'sem_madeira', 'ghost indica sem_madeira quando madeira === 0')

  const alvoValido = resolverAlvoEdicaoVoxel(
    fortalezaNv5,
    4,
    0,
    4,
    { x: centro404.x, y: centro404.y + 0.42, z: centro404.z },
    centro404,
    'adicionar',
    3,
    { x: 20, y: 0, z: 20 },
  )
  assert(alvoValido !== null && alvoValido.valido && alvoValido.by === 1, 'ghost calcula célula adjacente válida quando madeira >= 1')

  const alvoColide = resolverAlvoEdicaoVoxel(
    fortalezaNv5,
    4,
    0,
    4,
    { x: centro404.x, y: centro404.y + 0.42, z: centro404.z },
    centro404,
    'adicionar',
    3,
    { x: centro404.x, y: VOXEL_NV5.passo, z: centro404.z },
  )
  assert(alvoColide !== null && !alvoColide.valido && alvoColide.motivo === 'colide_corpo', 'ghost bloqueia em vermelho quando colide com o herói')

  const centroParede = centroBlocoMundo(20, 20, 0, 0, 2)
  const alvoRemover = resolverAlvoEdicaoVoxel(
    fortalezaNv5,
    0,
    0,
    2,
    centroParede,
    centroParede,
    'remover',
    0,
    { x: 20, y: 0, z: 20 },
  )
  assert(alvoRemover !== null && alvoRemover.valido && alvoRemover.bx === 0 && alvoRemover.bz === 2, 'ghost de remoção aceita bloco sólido mesmo com madeira 0')

  assert(
    decidirAcaoPonteiro(PARTIDA.limiarArrastoPx) === 'clique' &&
      decidirAcaoPonteiro(PARTIDA.limiarArrastoPx + 0.01) === 'arrasto',
    'fronteira exata do limiar de arrasto separa clique de giro',
  )
  assert(
    filtrarHitEdicao(
      [hitAtrasDoHeroi, hitLongeDemais, hitNaMira],
      { x: 0, y: 1.6, z: -6.5 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 1.6, z: 0 },
      7.0,
      true,
    ) === hitAtrasDoHeroi,
    'modo império ignora plano do herói e escolhe hit mais próximo',
  )
  const centroTopo = centroBlocoMundo(20, 20, 4, VOXEL_NV5.ny - 1, 4)
  const alvoForaLimite = resolverAlvoEdicaoVoxel(
    fortalezaNv5,
    4,
    VOXEL_NV5.ny - 1,
    4,
    { x: centroTopo.x, y: centroTopo.y + 0.42, z: centroTopo.z },
    centroTopo,
    'adicionar',
    3,
    { x: 20, y: 0, z: 20 },
  )
  assert(
    alvoForaLimite !== null && !alvoForaLimite.valido && alvoForaLimite.motivo === 'fora_limite',
    'ghost indica fora_limite ao tentar empilhar além da altura máxima da fortaleza',
  )
}
