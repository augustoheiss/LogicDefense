import { Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Group, InstancedMesh, Mesh } from 'three'
import { Object3D, Vector2 } from 'three'
import { getRecentMathSignaturesSnapshot, hydrateSeenMathSignatures, resetSeenMathMemory } from './infiniteMathEngine'
import { corDoChaoBioma, VOXEL_NV5 } from './biomaRecursos'
import {
  AlvoEdicaoUnificado,
  mensagemMotivoBloco,
  resolverAlvoBlocoMundoPorFace,
  resolverAlvoBlocoNoChao,
  temRecursoParaMaterial,
} from './alvoBlocoUnificado'
import {
  BlocoMaterial,
  blocoMundoParaCentro,
  PASSO_BLOCO_MUNDO,
  PlanoLinhaBlocos,
  SPEC_BLOCO_MATERIAL,
} from './blocosMundo'
import { meiaLarguraNv5 } from './blocosNv5Blueprints'
import { validarAdicionarBlocoObraLivre } from './obraBlocosLivres'
import { IndiceBlocoMundo, IndiceVoxelNv5, ObraArquiteturaMesh } from './ObrasArquiteturaCena'
import { GrauConta, OBSTACULOS, Olhar, PARTIDA, PecaId } from './partidaPolicies'
import {
  abrirAltar,
  alcanceDoTiro,
  alternarSubsolo,
  alvoDoBotao,
  alvoDoBotaoObra,
  aplicarConta,
  atirar,
  calcularReembolsoVenda,
  CELULAS_DO_DISCO,
  celulaColideObraExistente,
  chaoRevelado,
  cobertoAgora,
  consagrarEstruturaManual,
  construirLinhaBlocos,
  continuarNaRua,
  criarTropa,
  definirOlhar,
  editarBlocoMundo,
  editarBlocoObra,
  editarBlocoObraLivre,
  evoluir,
  fecharAltar,
  iniciarObra,
  inimigoVisivel,
  marcadoPelaTorre,
  mira,
  moverObra,
  obraEmConstrucao,
  ordenar,
  ordenarHeroi,
  planejarLinhaNoEstado,
  podeConsagrarEm,
  podeEvoluir,
  podeFundarEm,
  podeMoverObraEm,
  podeVenderObra,
  pular,
  registrarErroNoAltar,
  repararObra,
  pontosDoCorpo,
  selecionarAoClicarChaoVazio,
  selecionarAoClicarHeroi,
  selecionarAoClicarUnidade,
  selecionarPorRetanguloEstado,
  folgaDoTiro,
  venderObra,
  vetorDoOlhar,
  PartidaState,
  postura,
  posturaHeroi,
} from './partidaSim'
import {
  decidirAcaoPonteiro,
  filtrarHitEdicao,
  normalDominanteMundo,
  resolverAlvoEdicaoVoxel,
  VoxelAlvoHit,
} from './verticalidadeVoxel'
import {
  abrirMapa,
  criarAtlas,
  definirPoliticaMinimapas,
  Dono,
  escreverCena,
  estadoCena,
  estadoCorpo,
  fichaEm,
  resumoAtlas,
  stepAtlas,
  voltarAoCorpo,
} from './atlas'
import { IconeId, IconeSvg, META_INTENCOES } from './ilhaIcones'
import { armazenamentoDoNavegador, carregarAssinaturas, salvarAssinaturas } from './memoriaDeContas'
import { fatorDoBuff, textoDaContaComErros } from './buffPorErro'
import { carregarCaderno, chaveCurta, registrarTentativa, salvarCaderno, type Caderno } from './cadernoDeEstudo'
import { CadernoEstudoOverlay } from './estudo/CadernoEstudoOverlay'
import type { DesafioUnificado } from './estudo/contratosEstudo'
import { gerarDiagnosticoEstudo } from './estudo/diagnosticoEstudo'
import { ModalConta } from './estudo/ModalConta'
import { selecionarProximoDesafio } from './estudo/orquestradorQuestoes'
import {
  estadoEstudoVazio,
  type EstadoEstudoLocal,
  type EventoEstudo,
  type RepositorioEstudo,
} from './estudo/repositorioEstudo'
import { criarRepositorioIndexedDb } from './estudo/repositorioIndexedDb'
import {
  acaoDeAtalhoEstudo,
  alvoDoTeclado,
  cliqueAbreOPainelDaObra,
  destinoDoToque,
  jogoTomaConfirmar,
  jogoTomaEscape,
  painelValido,
  paraPropagacaoDoPointerdown,
  precoDeEvoluir,
  proximaEntradaPorTeclado,
  teclaDoBotaoFocado,
  type TelaEstudo,
} from './atalhosIlha'

interface ContaAtiva {
  readonly desafio: DesafioUnificado
  readonly dicasAbertas: 0 | 1 | 2 | 3
  readonly erradasClicadas: readonly string[]
  readonly diagnosticoAtual: string
  readonly ultimoGanhoPt?: string
  readonly abertaEmMs: number
  readonly erros: number
  readonly resolvida: boolean
  readonly gravada: boolean
}

// O preço de evoluir uma obra do nível `nivel` para o seguinte, lido da MESMA tabela que `evoluir` cobra (`custoDeEvoluir`, 1,5× por nível). Nenhum texto da tela reescreve esse número. No nível máximo não há preço: texto vazio.
function precoDeEvoluirNoNivel(nivel: number): string {
  const preco = custoDeEvoluir(nivel)
  return preco ? precoDeEvoluir(preco) : ''
}
import { MundoSandboxCena } from './MundoSandboxCena'
import { custoDeEvoluir, descricaoDaEvolucao } from './evolucaoObra'
import { BordaDoMapa } from './BordaDoMapa'
import {
  CAMERA_IMPERIO,
  combinarEntradaPan,
  entradaBordaCameraImperio,
  girarCameraImperioPorArrasto,
  normalizarYaw,
  passoCameraImperio,
  posicaoCameraImperio,
  yawDaBussolaNoImperio,
  type CameraImperioState,
  type CursorBordaEntrada,
} from './cameraImperio'

const SELETOR_HUD_SEM_BORDA =
  '.ilha-army, button, .ilha-modal, .ilha-caderno, .ilha-confirmar-card, .ilha-acoes-campo, .ilha-olhar, .ilha-barra, .ilha-minimapa, .ilha-base, .ilha-construcoes, .ilha-ferramentas, .ilha-painel-obra, .ilha-compass, .ilha-conta-atalhos, .ilha-imperio-rotacao, .ilha-enemies, .ilha-selecao-barra'
import { destinoDoClique } from './destinoDoClique'
import { PainelDeConstrucoes } from './PainelDeConstrucoes'
import { raycastCondicional, semRaycast } from './raycastCena'
import { SeloDeVida } from './SeloDeVida'
import { textoDaRecusaDeEvoluir, textoGanhoDaConta } from './textosVida'
import { TropasCena } from './TropasCena'
import './ilha.css'

/** O que o jogador lê ao passar o mouse num quadrado do minimapa: quem domina aquele mapa. `Record<Dono, string>`: um dono novo sem texto não compila. */
const TEXTO_DO_DONO: Record<Dono, string> = {
  nosso: 'seu (ou de aliados)',
  inimigo: 'do inimigo',
  selvagem: 'selvagem (dominado pela natureza)',
}

/** O que o jogador lê quando «Evoluir» é recusado: o MOTIVO REAL vindo de `podeEvoluir` (uma fonte só), com o preço só quando o motivo é falta de recurso. */
function motivoDeNaoEvoluir(estado: PartidaState, obraId: number): string {
  const obra = estado.obras.find((item) => item.id === obraId)
  return textoDaRecusaDeEvoluir(podeEvoluir(estado, obraId), obra ? precoDeEvoluirNoNivel(obra.nivel) : '')
}

function compassLetter(yaw: number): string {
  const angle = Math.atan2(Math.sin(yaw), Math.cos(yaw))
  if (angle >= -0.4 && angle <= 0.4) return 'N'
  if (angle > 0.4 && angle < 2.4) return 'L'
  if (angle < -0.4 && angle > -2.4) return 'O'
  return 'S'
}

function yawDoHeroi(group: Group, state: { yaw: number }) {
  group.rotation.y = -state.yaw
}

function distanciaTerceira(pitch: number, confinado = false): number {
  const sobe = Math.sin(pitch)
  let dist = confinado ? 2.25 : 6.5
  if (sobe > 0.02) {
    const cabe = (PARTIDA.eyeY - 0.5) / sobe
    if (dist > cabe) dist = Math.max(1.15, cabe)
  }
  return dist
}

function documentoAceitaLock(): boolean {
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature: (nome: string) => boolean }
    featurePolicy?: { allowsFeature: (nome: string) => boolean }
  }
  const politica = doc.permissionsPolicy ?? doc.featurePolicy
  if (politica && !politica.allowsFeature('pointer-lock')) return false
  return document.hasFocus()
}

function pedirLock(canvas: HTMLCanvasElement | null) {
  if (!canvas || document.pointerLockElement || !documentoAceitaLock()) return
  try {
    const pedido = canvas.requestPointerLock() as void | Promise<void>
    if (pedido && typeof pedido.catch === 'function') {
      void pedido.catch(() => undefined)
    }
  } catch {
    // Este documento não aceita pointer lock. O botão Olhar continua valendo.
  }
}

function assinaturaPenumbra(state: PartidaState): string {
  const quantizado = (valor: number) => Math.round(valor * 2)
  const partes: string[] = []
  if (!state.semCorpo) partes.push(`h${quantizado(state.heroi.x)},${quantizado(state.heroi.z)}`)
  for (const unidade of state.unidades) {
    if (unidade.lado === 'aliado' && unidade.hp > 0) {
      partes.push(`u${unidade.id}:${quantizado(unidade.x)},${quantizado(unidade.z)}`)
    }
  }
  for (const obra of state.obras) {
    if (obra.lado !== 'inimigo' && obra.hp > 0) {
      partes.push(`o${obra.id}:${quantizado(obra.x)},${quantizado(obra.z)}:${obraEmConstrucao(obra) ? 0 : 1}`)
    }
  }
  return partes.join('|')
}

function olharNome(olhar: PartidaState['olhar']): string {
  if (olhar === 'primeira') return 'Primeira'
  if (olhar === 'imperio') return 'Império'
  return 'Terceira'
}

type Controle = {
  forward: boolean
  back: boolean
  strafe: -1 | 0 | 1
  girarEsq?: boolean
  girarDir?: boolean
  eixoX?: number
  eixoY?: number
}

const RAIO_MANCHE = 56

function Cena(props: {
  sim: React.MutableRefObject<PartidaState>
  timeScale: React.MutableRefObject<number>
  keys: React.MutableRefObject<Controle>
  cam: React.MutableRefObject<CameraImperioState>
  rotacaoBotaoRef: React.MutableRefObject<-1 | 0 | 1>
  cursorBordaRef: React.MutableRefObject<CursorBordaEntrada | null>
  onBussolaImperio: (letra: string) => void
  tool: React.MutableRefObject<PecaId | null>
  moverObraIdRef: React.MutableRefObject<number | null>
  dragou: React.MutableRefObject<boolean>
  onHud: (state: PartidaState) => void
  onGround: (x: number, z: number) => void
  onGroundOrder: (x: number, z: number) => void
  onUnit: (id: number, lado: 'aliado' | 'inimigo', shiftKey?: boolean) => void
  onObra: (id: number) => void
  onRect: (x0: number, z0: number, x1: number, z1: number, shiftKey?: boolean) => void
  onCaixa: (caixa: { x: number; y: number; x2: number; y2: number } | null) => void
  onHeroi: (shiftKey?: boolean) => void
  heroiEscolhido: boolean
  selectedIds: readonly number[]
  atlas: React.MutableRefObject<ReturnType<typeof criarAtlas>>
  mapa: string
  onQuadro: (texto: string) => void
  modoBloco: 'adicionar' | 'remover' | null
  modoBlocoRef: React.MutableRefObject<'adicionar' | 'remover' | null>
  obraBlocoAlvoIdRef: React.MutableRefObject<number | null>
  /** `pointerId` do clique que caiu numa obra nossa: o container consome e não atira (A2b). */
  ponteiroDaObraRef: React.MutableRefObject<number | null>
materialBlocoRef: React.MutableRefObject<BlocoMaterial>
  modoLinhaRef: React.MutableRefObject<boolean>
  alturaLinhaRef: React.MutableRefObject<1 | 2 | 3>
  modoConsagrarRef: React.MutableRefObject<PecaId | null>
  cursorNdcRef: React.MutableRefObject<{ x: number; y: number } | null>
  voxelAlvoRef: React.MutableRefObject<AlvoEdicaoUnificado | null>
  resolverAlvoSyncRef: React.MutableRefObject<() => AlvoEdicaoUnificado | null>
  resolverBlocoConsagrarSyncRef: React.MutableRefObject<() => { gx: number; gy: number; gz: number } | null>
  ghostBloco: AlvoEdicaoUnificado | null
  onGhostBloco: (alvo: AlvoEdicaoUnificado | null) => void
  ghostObra: { tipo: PecaId; x: number; z: number; valido: boolean } | null
  onGhostObra: (ghost: { tipo: PecaId; x: number; z: number; valido: boolean } | null) => void
  previewLinha: { plano: PlanoLinhaBlocos; temRecurso: boolean } | null
  onPreviewLinha: (preview: { plano: PlanoLinhaBlocos; temRecurso: boolean } | null) => void
  onConcluirLinha: (x0: number, z0: number, x1: number, z1: number) => void
  onMiraAlvo: (ativo: boolean) => void
  onPedirSubsolo: () => void
}) {
  const avatar = useRef<Group>(null)
  const flash = useRef<Mesh>(null)
  const voxeisGroupRef = useRef<Group>(null)
  const blocosMapaGroupRef = useRef<Group>(null)
  const obrasLivresGroupRef = useRef<Group>(null)
  const ultimaAssinaturaGhost = useRef('')
  const ultimaAssinaturaGhostObra = useRef('')
  const ultimoMiraAlvo = useRef(false)
  const ultimaBussolaImperio = useRef('')
  const nuvem = useRef<InstancedMesh>(null)
  const penumbra = useRef<InstancedMesh>(null)
  const pedra = useRef<Mesh>(null)
  const marcaNuvem = useRef({ versao: -1, olhar: '', mapa: '' })
  const marcaPenumbra = useRef({ versao: -1, olhar: '', mapa: '', assinatura: '' })
  const moldeNuvem = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => {
    if (penumbra.current) penumbra.current.count = 0
    if (nuvem.current) nuvem.current.count = 0
  }, [])
  const unidades = useRef(new Map<number, Group>())
  const aneis = useRef(new Map<number, Mesh>())
  const corpos = useRef(new Map<string, Mesh>())
  const arrasto = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const linhaDrag = useRef<{ x0: number; z0: number; pointerId: number } | null>(null)
  const rmbDrag = useRef<{ x: number; y: number; worldX: number; worldZ: number; pointerId: number } | null>(null)
  const ultimoBoxSelectMs = useRef(0)

  // O ponteiro tocou a obra `obraId`. Se o clique vai abrir o painel dela, marca o ponteiro como «da obra»: o container
  // consome a marca e não atira nem prende o mouse (A2b). Serve às três malhas (comum e as duas instanciadas), que só
  // informam QUAL obra foi tocada; quem decide é a regra pura, com o estado de verdade (hp, olhar, modo de edição).
  const marcarPonteiroDaObra = (obraId: number, pointerId: number, botao: number): boolean => {
    const atual = props.sim.current
    const emEdicao = Boolean(props.modoBlocoRef.current || props.modoLinhaRef.current || props.modoConsagrarRef.current)
    const peca = atual.obras.find((item) => item.id === obraId) ?? null
    if (!cliqueAbreOPainelDaObra(peca, { botao, olhar: atual.olhar, modoEdicao: emEdicao, semCorpo: atual.semCorpo })) return false
    props.ponteiroDaObraRef.current = pointerId
    return true
  }
  /**
   * `pointerdown` de uma obra, para as TRÊS malhas (comum, Nv5 e consagrada). Obra nossa marca o ponteiro (A2b). Obra
   * inimiga viva e visível devolve `true`: a malha PARA o raycast do R3F, senão uma obra nossa colinear atrás marcava o
   * ponteiro e o tiro/ordem na inimiga morria sem efeito (OBS-F2-5). A regra é `paraPropagacaoDoPointerdown`.
   */
  const pointerdownDaObra = (obraId: number, pointerId: number, botao: number): boolean => {
    if (marcarPonteiroDaObra(obraId, pointerId, botao)) return false
    const atual = props.sim.current
    const emEdicao = Boolean(props.modoBlocoRef.current || props.modoLinhaRef.current || props.modoConsagrarRef.current)
    const peca = atual.obras.find((item) => item.id === obraId)
    return paraPropagacaoDoPointerdown(
      peca ? { lado: peca.lado, hp: peca.hp, coberta: cobertoAgora(atual, peca.x, peca.z) } : null,
      { botao, modoEdicao: emEdicao },
    )
  }
  const { camera, gl, raycaster } = useThree()

  const soloNoNdc = (ndcX: number, ndcY: number, planoY = 0) => {
    camera.updateMatrixWorld()
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera)
    const dirY = raycaster.ray.direction.y
    if (Math.abs(dirY) < 1e-5) return null
    const t = (planoY - raycaster.ray.origin.y) / dirY
    if (t < 0) return null
    return {
      x: raycaster.ray.origin.x + raycaster.ray.direction.x * t,
      z: raycaster.ray.origin.z + raycaster.ray.direction.z * t,
      t,
    }
  }

  const contextoBlocoMundo = (state: PartidaState) => ({
    blocosMapa: state.blocosMapa,
    recursos: { madeira: state.madeira, lingotes: state.lingotes, ouro: state.ouro },
    heroi: state.semCorpo ? null : state.heroi,
    unidades: state.unidades,
    chaoRevelado: (x: number, z: number) => !PARTIDA.nuvem || chaoRevelado(state, x, z),
    colideObraEm: (gx: number, gy: number, gz: number) => celulaColideObraExistente(state, gx, gy, gz),
  })

  const resolverAlvoNoGrupo = (state: PartidaState): AlvoEdicaoUnificado | null => {
    const modoAtual = props.modoBlocoRef.current
    if (!modoAtual || (!state.semCorpo && state.heroi.y < -0.9)) {
      return null
    }
    const olharDesenho = state.semCorpo ? 'imperio' : state.olhar
    const ndc = olharDesenho === 'imperio' ? props.cursorNdcRef.current : { x: 0, y: 0 }
    if (!ndc) return null
    camera.updateMatrixWorld()
    raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera)

    type CandidatoHit =
      | { kind: 'nv5'; meta: IndiceVoxelNv5; hit: VoxelAlvoHit }
      | { kind: 'mundo'; meta: IndiceBlocoMundo; hit: VoxelAlvoHit }
      | { kind: 'obraLivre'; meta: IndiceBlocoMundo; hit: VoxelAlvoHit }

    const candidatos: CandidatoHit[] = []
    const hitsMapeados: VoxelAlvoHit[] = []

    if (voxeisGroupRef.current) {
      voxeisGroupRef.current.updateMatrixWorld(true)
      const hitsNv5 = raycaster.intersectObject(voxeisGroupRef.current, true)
      for (const h of hitsNv5) {
        const idx = h.instanceId
        const lista = h.object.userData?.voxelNv5Indices as IndiceVoxelNv5[] | undefined
        const meta = idx !== undefined && lista ? lista[idx] : undefined
        if (!meta || meta.lado !== 'nosso') continue
        const mapped: VoxelAlvoHit = {
          hitPoint: { x: h.point.x, y: h.point.y, z: h.point.z },
          distance: h.distance,
          obraId: candidatos.length,
          bx: meta.bx,
          by: meta.by,
          bz: meta.bz,
          centro: meta.centro,
        }
        candidatos.push({ kind: 'nv5', meta, hit: mapped })
        hitsMapeados.push(mapped)
      }
    }

    if (blocosMapaGroupRef.current) {
      blocosMapaGroupRef.current.updateMatrixWorld(true)
      const hitsMundo = raycaster.intersectObject(blocosMapaGroupRef.current, true)
      for (const h of hitsMundo) {
        const idx = h.instanceId
        const lista = h.object.userData?.blocoMundoIndices as IndiceBlocoMundo[] | undefined
        const meta = idx !== undefined && lista ? lista[idx] : undefined
        if (!meta) continue
        if (modoAtual === 'remover' && meta.lado !== 'nosso') continue
        const mapped: VoxelAlvoHit = {
          hitPoint: { x: h.point.x, y: h.point.y, z: h.point.z },
          distance: h.distance,
          obraId: candidatos.length,
          bx: meta.gx,
          by: meta.gy,
          bz: meta.gz,
          centro: meta.centro,
        }
        candidatos.push({ kind: 'mundo', meta, hit: mapped })
        hitsMapeados.push(mapped)
      }
    }

    if (obrasLivresGroupRef.current) {
      obrasLivresGroupRef.current.updateMatrixWorld(true)
      const hitsLivres = raycaster.intersectObject(obrasLivresGroupRef.current, true)
      for (const h of hitsLivres) {
        const idx = h.instanceId
        const lista = h.object.userData?.blocoObraLivreIndices as IndiceBlocoMundo[] | undefined
        const meta = idx !== undefined && lista ? lista[idx] : undefined
        if (!meta || meta.lado !== 'nosso' || meta.obraId === undefined) continue
        const mapped: VoxelAlvoHit = {
          hitPoint: { x: h.point.x, y: h.point.y, z: h.point.z },
          distance: h.distance,
          obraId: candidatos.length,
          bx: meta.gx,
          by: meta.gy,
          bz: meta.gz,
          centro: meta.centro,
        }
        candidatos.push({ kind: 'obraLivre', meta, hit: mapped })
        hitsMapeados.push(mapped)
      }
    }

    const heroiEye = { x: state.heroi.x, y: PARTIDA.eyeY + state.heroi.y, z: state.heroi.z }
    const material = props.materialBlocoRef.current
    const escolhido = filtrarHitEdicao(
      hitsMapeados,
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      { x: raycaster.ray.direction.x, y: raycaster.ray.direction.y, z: raycaster.ray.direction.z },
      heroiEye,
      PARTIDA.alcanceEdicaoBlocos,
      olharDesenho === 'imperio',
    )

    if (escolhido) {
      const cand = candidatos[escolhido.obraId]
      const alvoPainel = props.obraBlocoAlvoIdRef.current
      if (alvoPainel !== null) {
        const idHit = cand.kind === 'mundo' ? null : cand.meta.obraId
        if (idHit !== alvoPainel) return null
      }
      if (cand.kind === 'nv5') {
        const obra = state.obras.find((o) => o.id === cand.meta.obraId)
        if (!obra) return null
        const res = resolverAlvoEdicaoVoxel(
          obra,
          cand.meta.bx,
          cand.meta.by,
          cand.meta.bz,
          escolhido.hitPoint,
          cand.meta.centro,
          modoAtual,
          state.madeira,
          state.semCorpo ? null : state.heroi,
        )
        return res ? { ...res, tipo: 'nv5', passo: VOXEL_NV5.passo } : null
      }
      if (cand.kind === 'mundo') {
        return resolverAlvoBlocoMundoPorFace(
          cand.meta.gx,
          cand.meta.gy,
          cand.meta.gz,
          escolhido.hitPoint,
          modoAtual,
          material,
          contextoBlocoMundo(state),
        )
      }
      // cand.kind === 'obraLivre'
      const obraId = cand.meta.obraId!
      const obra = state.obras.find((o) => o.id === obraId)
      if (!obra || !obra.blocosLivres) return null
      if (modoAtual === 'remover') {
        const unico = obra.blocosLivres.filter((b) => b.hp > 0).length <= 1
        return {
          tipo: 'obraLivre',
          obraId,
          gx: cand.meta.gx,
          gy: cand.meta.gy,
          gz: cand.meta.gz,
          material: cand.meta.material,
          wx: cand.meta.centro.x,
          wy: cand.meta.centro.y,
          wz: cand.meta.centro.z,
          passo: PASSO_BLOCO_MUNDO,
          acao: 'remover',
          valido: !unico,
          motivo: unico ? 'ultimo_bloco' : 'ok',
        }
      }
      const [dx, dy, dz] = normalDominanteMundo(escolhido.hitPoint, cand.meta.centro)
      const nx = cand.meta.gx + dx
      const ny = cand.meta.gy + dy
      const nz = cand.meta.gz + dz
      const c = blocoMundoParaCentro(nx, ny, nz)
      const check = validarAdicionarBlocoObraLivre(
        obra.blocosLivres,
        nx,
        ny,
        nz,
        material,
        { madeira: state.madeira, lingotes: state.lingotes, ouro: state.ouro },
        state.semCorpo ? null : state.heroi,
        state.unidades,
        state.blocosMapa,
      )
      return {
        tipo: 'obraLivre',
        obraId,
        gx: nx,
        gy: ny,
        gz: nz,
        material,
        wx: c.x,
        wy: c.y,
        wz: c.z,
        passo: PASSO_BLOCO_MUNDO,
        acao: 'adicionar',
        valido: check.valido,
        motivo: check.motivo,
      }
    }

    // Sem hit em bloco existente: em modo adicionar, permite colocar bloco livre direto no chão!
    // Com o editor preso a UMA obra (painel), o chão livre é o editor global: o painel não pode usá-lo (F2-D3).
    if (modoAtual === 'adicionar' && props.obraBlocoAlvoIdRef.current === null) {
      const chao = soloNoNdc(ndc.x, ndc.y, 0)
      if (!chao) return null
      if (olharDesenho !== 'imperio') {
        const tPlanoHeroi = Math.max(
          0,
          (heroiEye.x - camera.position.x) * raycaster.ray.direction.x +
            (heroiEye.y - camera.position.y) * raycaster.ray.direction.y +
            (heroiEye.z - camera.position.z) * raycaster.ray.direction.z,
        )
        if (chao.t < tPlanoHeroi - 0.15) return null
        if (Math.hypot(chao.x - heroiEye.x, 0 - heroiEye.y, chao.z - heroiEye.z) > PARTIDA.alcanceEdicaoBlocos) {
          return null
        }
      }
      return resolverAlvoBlocoNoChao(chao.x, chao.z, material, contextoBlocoMundo(state))
    }

    return null
  }

  const resolverBlocoConsagrar = (state: PartidaState): { gx: number; gy: number; gz: number } | null => {
    const olharDesenho = state.semCorpo ? 'imperio' : state.olhar
    const ndc = olharDesenho === 'imperio' ? props.cursorNdcRef.current : { x: 0, y: 0 }
    if (!ndc) return null
    camera.updateMatrixWorld()
    raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera)
    if (blocosMapaGroupRef.current) {
      blocosMapaGroupRef.current.updateMatrixWorld(true)
      const hits = raycaster.intersectObject(blocosMapaGroupRef.current, true)
      for (const h of hits) {
        const lista = h.object.userData?.blocoMundoIndices as IndiceBlocoMundo[] | undefined
        const meta = h.instanceId !== undefined && lista ? lista[h.instanceId] : undefined
        if (meta && meta.lado === 'nosso') return { gx: meta.gx, gy: meta.gy, gz: meta.gz }
      }
    }
    const chao = soloNoNdc(ndc.x, ndc.y, 0)
    if (chao) {
      const gx = Math.round(chao.x / PASSO_BLOCO_MUNDO)
      const gz = Math.round(chao.z / PASSO_BLOCO_MUNDO)
      for (let gy = 0; gy < 6; gy += 1) {
        const b = state.blocosMapa[`${gx},${gy},${gz}`]
        if (b && b.hp > 0 && b.lado === 'nosso') return { gx, gy, gz }
      }
    }
    return null
  }

  props.resolverAlvoSyncRef.current = () => {
    const alvo = resolverAlvoNoGrupo(props.sim.current)
    props.voxelAlvoRef.current = alvo
    return alvo
  }
  props.resolverBlocoConsagrarSyncRef.current = () => resolverBlocoConsagrar(props.sim.current)
  const soloNoChao = (clientX: number, clientY: number) => {
    const retangulo = gl.domElement.getBoundingClientRect()
    raycaster.setFromCamera(
      new Vector2(
        ((clientX - retangulo.left) / retangulo.width) * 2 - 1,
        -((clientY - retangulo.top) / retangulo.height) * 2 + 1,
      ),
      camera,
    )
    const dirY = raycaster.ray.direction.y
    if (Math.abs(dirY) < 1e-5) return null
    const t = (-0.45 - raycaster.ray.origin.y) / dirY
    if (t < 0) return null
    return {
      x: raycaster.ray.origin.x + raycaster.ray.direction.x * t,
      z: raycaster.ray.origin.z + raycaster.ray.direction.z * t,
    }
  }
  const callbacksCenaRef = useRef({
    onCaixa: props.onCaixa,
    onRect: props.onRect,
    onGroundOrder: props.onGroundOrder,
    onPreviewLinha: props.onPreviewLinha,
    onConcluirLinha: props.onConcluirLinha,
    soloNoChao,
  })
  callbacksCenaRef.current = {
    onCaixa: props.onCaixa,
    onRect: props.onRect,
    onGroundOrder: props.onGroundOrder,
    onPreviewLinha: props.onPreviewLinha,
    onConcluirLinha: props.onConcluirLinha,
    soloNoChao,
  }
  useEffect(() => {
    const moveJanela = (event: PointerEvent) => {
      const dragLinha = linhaDrag.current
      if (dragLinha && event.pointerId === dragLinha.pointerId) {
        const p = callbacksCenaRef.current.soloNoChao(event.clientX, event.clientY)
        if (p) {
          const st = props.sim.current
          const mat = props.materialBlocoRef.current
          const plano = planejarLinhaNoEstado(st, dragLinha.x0, dragLinha.z0, p.x, p.z, props.alturaLinhaRef.current, mat)
          const temRec = temRecursoParaMaterial(
            { madeira: st.madeira, lingotes: st.lingotes, ouro: st.ouro },
            mat,
            plano.celulas.length,
          )
          callbacksCenaRef.current.onPreviewLinha({ plano, temRecurso: temRec })
        }
        return
      }
      const inicio = arrasto.current
      if (!inicio || event.pointerId !== inicio.pointerId) return
      if (Math.hypot(event.clientX - inicio.x, event.clientY - inicio.y) < PARTIDA.limiarArrastoPx + 2) return
      props.dragou.current = true
      callbacksCenaRef.current.onCaixa({ x: inicio.x, y: inicio.y, x2: event.clientX, y2: event.clientY })
    }
    const soltaJanela = (event: PointerEvent) => {
      if (linhaDrag.current && event.pointerId === linhaDrag.current.pointerId) {
        const dragLinha = linhaDrag.current
        linhaDrag.current = null
        callbacksCenaRef.current.onPreviewLinha(null)
        if (event.type === 'pointerup') {
          ultimoBoxSelectMs.current = performance.now()
          const p = callbacksCenaRef.current.soloNoChao(event.clientX, event.clientY) ?? {
            x: dragLinha.x0,
            z: dragLinha.z0,
          }
          callbacksCenaRef.current.onConcluirLinha(dragLinha.x0, dragLinha.z0, p.x, p.z)
        }
        return
      }
      if (rmbDrag.current && event.pointerId === rmbDrag.current.pointerId) {
        const infoRmb = rmbDrag.current
        rmbDrag.current = null
        if (
          event.type === 'pointerup' &&
          !props.modoBlocoRef.current &&
          !props.modoLinhaRef.current &&
          !props.modoConsagrarRef.current &&
          !props.tool.current
        ) {
          const dist = Math.hypot(event.clientX - infoRmb.x, event.clientY - infoRmb.y)
          if (dist <= PARTIDA.limiarArrastoRmbPx) {
            const p =
              callbacksCenaRef.current.soloNoChao(event.clientX, event.clientY) ?? {
                x: infoRmb.worldX,
                z: infoRmb.worldZ,
              }
            callbacksCenaRef.current.onGroundOrder(p.x, p.z)
          }
        }
      }
      if (arrasto.current && event.pointerId === arrasto.current.pointerId) {
        const inicio = arrasto.current
        arrasto.current = null
        callbacksCenaRef.current.onCaixa(null)
        const foiArrasto = props.dragou.current
        props.dragou.current = false
        if (event.type === 'pointerup' && foiArrasto) {
          ultimoBoxSelectMs.current = performance.now()
          const a = callbacksCenaRef.current.soloNoChao(inicio.x, inicio.y)
          const b = callbacksCenaRef.current.soloNoChao(event.clientX, event.clientY)
          if (a && b) callbacksCenaRef.current.onRect(a.x, a.z, b.x, b.z, event.shiftKey)
        }
      }
    }
    window.addEventListener('pointermove', moveJanela)
    window.addEventListener('pointerup', soltaJanela)
    window.addEventListener('pointercancel', soltaJanela)
    return () => {
      window.removeEventListener('pointermove', moveJanela)
      window.removeEventListener('pointerup', soltaJanela)
      window.removeEventListener('pointercancel', soltaJanela)
    }
  }, [])
  useFrame((_, dt) => {
    const keys = props.keys.current
    const bruto = Math.min(dt, 0.05)
    props.atlas.current = escreverCena(props.atlas.current, props.sim.current)
    props.atlas.current = stepAtlas(
      props.atlas.current,
      {
        forward: keys.forward,
        back: keys.back,
        strafe: keys.strafe,
        ...(keys.eixoX !== undefined || keys.eixoY !== undefined
          ? { eixoX: keys.eixoX ?? 0, eixoY: keys.eixoY ?? 0 }
          : {}),
      },
      bruto,
      props.timeScale.current,
      dt * 1000,
    )
    props.sim.current = estadoCena(props.atlas.current)
    const state = props.sim.current
    const olharDesenho = state.semCorpo ? 'imperio' : state.olhar
    if (avatar.current) {
      avatar.current.position.set(state.heroi.x, 0.9 + state.heroi.y, state.heroi.z)
      yawDoHeroi(avatar.current, { yaw: state.heroi.yaw })
      avatar.current.visible =
        !state.semCorpo &&
        (olharDesenho === 'imperio' || (olharDesenho === 'terceira' && distanciaTerceira(state.heroi.pitch) > 2.2))
    }
    if (flash.current) {
      flash.current.visible = state.heroi.shootCooldown > PARTIDA.shootCooldown * 0.55
    }
    state.unidades.forEach((unidade) => {
      const group = unidades.current.get(unidade.id)
      if (!group) return
      const mostra = unidade.lado === 'inimigo' ? inimigoVisivel(state, unidade) : unidade.hp > 0
      group.visible = mostra
      group.position.set(unidade.x, 0, unidade.z)
      group.scale.set(1, 1, 1)
      if (unidade.ordem?.tipo === 'mover') {
        const dx = unidade.ordem.x - unidade.x
        const dz = unidade.ordem.z - unidade.z
        if (Math.hypot(dx, dz) > 0.1) group.rotation.y = Math.atan2(dx, dz)
      }
      const anel = aneis.current.get(unidade.id)
      if (anel) {
        anel.visible = marcadoPelaTorre(state, unidade)
        anel.position.set(unidade.x, 0.06, unidade.z)
      }
      if (unidade.papel === 'dragao') {
        const pontos = pontosDoCorpo(unidade)
        unidade.segmentos.forEach((numero, indice) => {
          const segmento = corpos.current.get(`${unidade.id}:${numero}`)
          const ponto = pontos[indice + 1]
          if (!segmento || !ponto) return
          const esticado = Math.hypot(ponto.x - unidade.x, ponto.z - unidade.z) > 0.6
          segmento.visible = mostra
          segmento.position.set(ponto.x, esticado ? 0.55 : 1.35 + indice * 0.38, ponto.z)
        })
      }
    })
    const yaw = state.heroi.yaw
    const pitch = state.heroi.pitch
    const olhar = vetorDoOlhar(yaw, pitch)
    const raioNv5 = meiaLarguraNv5() + 0.15
    const dentroDeFortaleza = state.obras.some(
      (o) =>
        o.hp > 0 &&
        state.heroi.y < 2.5 &&
        ((Boolean(o.blocosNv5) && Math.abs(state.heroi.x - o.x) < raioNv5 && Math.abs(state.heroi.z - o.z) < raioNv5) ||
          (Boolean(o.blocosLivres?.length) && Math.hypot(state.heroi.x - o.x, state.heroi.z - o.z) < 4.5)),
    )
    const confinado = state.heroi.y < -0.9 || dentroDeFortaleza
    if (olharDesenho === 'imperio') {
      const frenteTeclado = keys.eixoY !== undefined ? keys.eixoY : (keys.forward ? 1 : 0) - (keys.back ? 1 : 0)
      const ladoTeclado = keys.eixoX !== undefined ? keys.eixoX : keys.strafe
      const borda =
        typeof document !== 'undefined' && document.hasFocus()
          ? entradaBordaCameraImperio(props.cursorBordaRef.current)
          : { frente: 0, lado: 0 }
      const pan = combinarEntradaPan({ frente: frenteTeclado, lado: ladoTeclado }, borda)
      const girar = ((keys.girarDir ? 1 : 0) - (keys.girarEsq ? 1 : 0)) || props.rotacaoBotaoRef.current
      props.cam.current = passoCameraImperio(props.cam.current, { frente: pan.frente, lado: pan.lado, girar }, bruto)
      const posCam = posicaoCameraImperio(props.cam.current)
      camera.position.set(posCam.x, posCam.y, posCam.z)
      camera.lookAt(props.cam.current.x, 0, props.cam.current.z)
      const letraImperio = compassLetter(yawDaBussolaNoImperio(props.cam.current.yaw))
      if (letraImperio !== ultimaBussolaImperio.current) {
        ultimaBussolaImperio.current = letraImperio
        props.onBussolaImperio(letraImperio)
      }
    } else if (olharDesenho === 'primeira') {
      camera.position.set(state.heroi.x, PARTIDA.eyeY + state.heroi.y, state.heroi.z)
      camera.lookAt(state.heroi.x + olhar.x, PARTIDA.eyeY + state.heroi.y + olhar.y, state.heroi.z + olhar.z)
    } else {
      const dist = distanciaTerceira(pitch, confinado)
      const ombro = Math.min(0.8, dist * 0.14)
      const direitaX = -Math.cos(yaw)
      const direitaZ = -Math.sin(yaw)
      const camX = state.heroi.x - olhar.x * dist + direitaX * ombro
      const camY = PARTIDA.eyeY + state.heroi.y - olhar.y * dist
      const camZ = state.heroi.z - olhar.z * dist + direitaZ * ombro
      camera.position.set(camX, camY, camZ)
      camera.lookAt(camX + olhar.x, camY + olhar.y, camZ + olhar.z)
    }
    if (olharDesenho !== 'imperio' && !state.semCorpo) {
      const alcance = alcanceDoTiro(state.heroi.x, state.heroi.z, yaw)
      const fx = -Math.sin(yaw)
      const fz = Math.cos(yaw)
      const temAlvo = state.unidades.some((u) => {
        if (u.lado !== 'inimigo' || !inimigoVisivel(state, u)) return false
        return pontosDoCorpo(u).some((p) => {
          const along = (p.x - state.heroi.x) * fx + (p.z - state.heroi.z) * fz
          if (along < 0.35 || along > alcance + 0.05) return false
          const perp = Math.abs((p.x - state.heroi.x) * fz - (p.z - state.heroi.z) * fx)
          return perp <= folgaDoTiro(along)
        })
      })
      if (temAlvo !== ultimoMiraAlvo.current) {
        ultimoMiraAlvo.current = temAlvo
        props.onMiraAlvo(temAlvo)
      }
    } else if (ultimoMiraAlvo.current) {
      ultimoMiraAlvo.current = false
      props.onMiraAlvo(false)
    }

    const proximoAlvo = resolverAlvoNoGrupo(state)
    props.voxelAlvoRef.current = proximoAlvo
    const assGhost = proximoAlvo
      ? proximoAlvo.tipo === 'nv5'
        ? `nv5:${proximoAlvo.obraId}:${proximoAlvo.bx}:${proximoAlvo.by}:${proximoAlvo.bz}:${proximoAlvo.acao}:${proximoAlvo.valido ? 1 : 0}:${proximoAlvo.motivo}`
        : `${proximoAlvo.tipo}:${proximoAlvo.gx}:${proximoAlvo.gy}:${proximoAlvo.gz}:${proximoAlvo.material}:${proximoAlvo.acao}:${proximoAlvo.valido ? 1 : 0}:${proximoAlvo.motivo}`
      : ''
    if (assGhost !== ultimaAssinaturaGhost.current) {
      ultimaAssinaturaGhost.current = assGhost
      props.onGhostBloco(proximoAlvo)
    }

    const pecaAtiva = props.tool.current
    const moverId = props.moverObraIdRef.current
    const obraMover =
      !pecaAtiva && moverId !== null
        ? state.obras.find((o) => o.id === moverId && o.hp > 0 && o.lado !== 'inimigo')
        : undefined
    if ((pecaAtiva || obraMover) && olharDesenho === 'imperio' && props.cursorNdcRef.current) {
      const p = soloNoNdc(props.cursorNdcRef.current.x, props.cursorNdcRef.current.y, 0)
      if (p) {
        const px = Math.round(p.x * 2) / 2
        const pz = Math.round(p.z * 2) / 2
        const tipoGhost = pecaAtiva ?? obraMover!.tipo
        const check = pecaAtiva
          ? podeFundarEm(state, pecaAtiva, px, pz, { cobrarRecursos: true, exigirRevelado: true })
          : podeMoverObraEm(state, obraMover!.id, px, pz, { exigirRevelado: true })
        const ass = pecaAtiva
          ? `${pecaAtiva}:${px}:${pz}:${check.ok ? 1 : 0}`
          : `move:${obraMover!.id}:${px}:${pz}:${check.ok ? 1 : 0}`
        if (ass !== ultimaAssinaturaGhostObra.current) {
          ultimaAssinaturaGhostObra.current = ass
          props.onGhostObra({ tipo: tipoGhost, x: px, z: pz, valido: check.ok })
        }
      }
    } else if (ultimaAssinaturaGhostObra.current !== '') {
      ultimaAssinaturaGhostObra.current = ''
      props.onGhostObra(null)
    }
    if (nuvem.current) {
      const malhaNuvem = nuvem.current
      if (!PARTIDA.nuvem) {
        malhaNuvem.visible = false
      } else if (
        marcaNuvem.current.versao !== state.versaoChao ||
        marcaNuvem.current.olhar !== olharDesenho ||
        marcaNuvem.current.mapa !== props.mapa
      ) {
        const altura = olharDesenho === 'imperio' ? 4 : 24
        let n = 0
        for (const celula of CELULAS_DO_DISCO) {
          if (state.chaoVisto[celula.i] === 1) continue
          moldeNuvem.position.set(celula.x, altura / 2, celula.z)
          moldeNuvem.scale.set(1, altura, 1)
          moldeNuvem.updateMatrix()
          malhaNuvem.setMatrixAt(n, moldeNuvem.matrix)
          n += 1
        }
        malhaNuvem.count = n
        malhaNuvem.instanceMatrix.needsUpdate = true
        marcaNuvem.current = { versao: state.versaoChao, olhar: olharDesenho, mapa: props.mapa }
        malhaNuvem.visible = true
      }
    }
    if (pedra.current) {
      pedra.current.visible = state.pedraNoChao && chaoRevelado(state, PARTIDA.pedraX, PARTIDA.pedraZ)
    }
    if (penumbra.current && PARTIDA.nuvem) {
      const malhaPenumbra = penumbra.current
      const assinatura = assinaturaPenumbra(state)
      const marca = marcaPenumbra.current
      if (
        marca.versao !== state.versaoChao ||
        marca.olhar !== olharDesenho ||
        marca.mapa !== props.mapa ||
        marca.assinatura !== assinatura
      ) {
        const altura = olharDesenho === 'imperio' ? 1.2 : 8
        let n = 0
        for (const celula of CELULAS_DO_DISCO) {
          if (state.chaoVisto[celula.i] !== 1 || cobertoAgora(state, celula.x, celula.z)) continue
          moldeNuvem.position.set(celula.x, altura / 2, celula.z)
          moldeNuvem.scale.set(1, altura, 1)
          moldeNuvem.updateMatrix()
          malhaPenumbra.setMatrixAt(n, moldeNuvem.matrix)
          n += 1
        }
        malhaPenumbra.count = n
        malhaPenumbra.instanceMatrix.needsUpdate = true
        malhaPenumbra.visible = true
        marcaPenumbra.current = { versao: state.versaoChao, olhar: olharDesenho, mapa: props.mapa, assinatura }
      }
    }
    props.onQuadro(
      resumoAtlas(props.atlas.current)
        .map((ficha) => `${ficha.i},${ficha.j},${ficha.alerta},${ficha.ritmo},${ficha.cena ? 1 : 0},${ficha.corpo ? 1 : 0},${ficha.dono}`)
        .join('|') +
        `:${props.atlas.current.politica}:${props.atlas.current.cotaDinamica}:${estadoCorpo(props.atlas.current).derrota ? 1 : 0}:${estadoCorpo(props.atlas.current).heroi.army}`,
    )
    props.onHud(state)
  })

  const altar = props.sim.current.altar
  const pisos =
    altar && altar.placasAtivas !== false
      ? [
          { nome: 'N', x: altar.cx, z: altar.cz + PARTIDA.altarPasso },
          { nome: 'L', x: altar.cx + PARTIDA.altarPasso, z: altar.cz },
          { nome: 'S', x: altar.cx, z: altar.cz - PARTIDA.altarPasso },
          { nome: 'O', x: altar.cx - PARTIDA.altarPasso, z: altar.cz },
        ]
      : []

  return (
    <>
      <color attach="background" args={['#8ecff0']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[12, 18, 8]} intensity={1.15} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.45, 0]}
        onPointerDown={(event) => {
          if (props.modoBlocoRef.current || props.modoConsagrarRef.current) return
          if (!props.sim.current.semCorpo && props.sim.current.olhar !== 'imperio') return
          if (props.modoLinhaRef.current && (event.nativeEvent.button === 0 || event.pointerType === 'touch')) {
            event.stopPropagation()
            linhaDrag.current = { x0: event.point.x, z0: event.point.z, pointerId: event.pointerId }
            const st = props.sim.current
            const mat = props.materialBlocoRef.current
            const plano = planejarLinhaNoEstado(
              st,
              event.point.x,
              event.point.z,
              event.point.x,
              event.point.z,
              props.alturaLinhaRef.current,
              mat,
            )
            const temRec = temRecursoParaMaterial(
              { madeira: st.madeira, lingotes: st.lingotes, ouro: st.ouro },
              mat,
              plano.celulas.length,
            )
            props.onPreviewLinha({ plano, temRecurso: temRec })
            return
          }
          if (props.tool.current || props.moverObraIdRef.current !== null) return
          if (event.nativeEvent.button === 2) {
            rmbDrag.current = {
              x: event.clientX,
              y: event.clientY,
              worldX: event.point.x,
              worldZ: event.point.z,
              pointerId: event.pointerId,
            }
            return
          }
          if (event.nativeEvent.button === 0 || event.pointerType === 'touch') {
            arrasto.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
          }
        }}
        onClick={(event) => {
          if (props.modoBlocoRef.current || props.modoLinhaRef.current || props.modoConsagrarRef.current) return
          if (props.dragou.current || performance.now() - ultimoBoxSelectMs.current < 160) {
            props.dragou.current = false
            return
          }
          if (event.nativeEvent.button === 2) return
          event.stopPropagation()
          if (props.tool.current || props.moverObraIdRef.current !== null) {
            const rect = gl.domElement.getBoundingClientRect()
            const p =
              rect.width > 0 && rect.height > 0
                ? soloNoNdc(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    -((event.clientY - rect.top) / rect.height) * 2 + 1,
                    0,
                  )
                : null
            if (p) {
              props.onGround(Math.round(p.x * 2) / 2, Math.round(p.z * 2) / 2)
              return
            }
          }
          props.onGround(event.point.x, event.point.z)
        }}
      >
        <planeGeometry args={[PARTIDA.ladoMapa, PARTIDA.ladoMapa]} />
        <meshStandardMaterial color={corDoChaoBioma(props.sim.current.bioma)} />
      </mesh>
      <BordaDoMapa
        visivel={
          props.sim.current.olhar === 'imperio' &&
          !props.modoBloco &&
          !props.modoLinhaRef.current &&
          !props.modoConsagrarRef.current &&
          props.selectedIds.some((id) => props.sim.current.unidades.some((u) => u.id === id && u.lado === 'aliado' && u.hp > 0))
        }
      />
      <MundoSandboxCena
        state={props.sim.current}
        lagoas={props.sim.current.lagoas}
        recursos={props.sim.current.recursos}
        subsoloCentro={props.sim.current.subsoloCentro}
        modoBloco={props.modoBloco}
        voxeisGroupRef={voxeisGroupRef}
        blocosMapaGroupRef={blocosMapaGroupRef}
        obrasLivresGroupRef={obrasLivresGroupRef}
        ghostBloco={props.ghostBloco}
        ghostObra={props.ghostObra}
        previewLinha={props.previewLinha}
        bloqueiaCliqueObra={Boolean(props.modoBloco || props.modoLinhaRef.current || props.modoConsagrarRef.current)}
        onTocarObraInstanced={(obraId, pointerId, botao) => pointerdownDaObra(obraId, pointerId, botao)}
        onSelectObraInstanced={(obraId) => {
          if (props.modoBlocoRef.current || props.modoLinhaRef.current || props.modoConsagrarRef.current) return
          if (props.dragou.current || performance.now() - ultimoBoxSelectMs.current < 160) return
          const atual = props.sim.current
          const pecaInst = atual.obras.find((item) => item.id === obraId)
          if (pecaInst && pecaInst.hp > 0 && pecaInst.lado !== 'inimigo') {
            props.onObra(obraId)
            return
          }
          if (atual.semCorpo || atual.olhar === 'imperio') props.onObra(obraId)
        }}
        onPedirSubsolo={props.onPedirSubsolo}
      />
      {(props.sim.current.semCorpo || props.sim.current.heroi.y >= -0.9) && (
        <mesh position={[0, -0.35, 20]} raycast={() => null}>
          <boxGeometry args={[8, 0.2, 42]} />
          <meshStandardMaterial color="#7d8ea3" />
        </mesh>
      )}
      <mesh ref={pedra} position={[PARTIDA.pedraX, PARTIDA.pedraAltura / 2, PARTIDA.pedraZ]} raycast={() => null}>
        <boxGeometry args={[PARTIDA.pedraMeio * 2, PARTIDA.pedraAltura, PARTIDA.pedraMeio * 2]} />
        <meshStandardMaterial color="#78716c" />
      </mesh>
      <group
        ref={avatar}
        onClick={(event) => {
          if (props.modoBlocoRef.current) return
          if (props.dragou.current || performance.now() - ultimoBoxSelectMs.current < 160) return
          if (props.sim.current.olhar !== 'imperio' || props.sim.current.semCorpo) return
          event.stopPropagation()
          props.onHeroi(event.nativeEvent.shiftKey)
        }}
      >
        <mesh position={[0, 0.2, 0]} raycast={raycastCondicional(Boolean(props.modoBloco))}>
          <boxGeometry args={[0.7, 1.1, 0.5]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, 0.95, 0]} raycast={raycastCondicional(Boolean(props.modoBloco))}>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshStandardMaterial color="#f2b544" />
        </mesh>
        <mesh ref={flash} position={[0, 0.35, 1.05]} visible={false}>
          <boxGeometry args={[0.12, 0.12, 0.45]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.4} />
        </mesh>
        {props.heroiEscolhido && props.sim.current.olhar === 'imperio' && !props.sim.current.semCorpo && (
          <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={semRaycast}>
            <ringGeometry args={[0.55, 0.75, 20]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.6} />
          </mesh>
        )}
      </group>
      {OBSTACULOS.map((caixa) => (
        <mesh key={`${caixa.x}-${caixa.z}`} position={[caixa.x, caixa.altura / 2, caixa.z]} raycast={() => null}>
          <boxGeometry args={[caixa.hx * 2, caixa.altura, caixa.hz * 2]} />
          <meshStandardMaterial color="#c47a3a" />
        </mesh>
      ))}
      <group position={[0, 0, 20]}>
        <mesh position={[-1.4, 1.2, 0]} raycast={() => null}>
          <boxGeometry args={[0.4, 2.4, 0.4]} />
          <meshStandardMaterial color="#1a8f5c" />
        </mesh>
        <mesh position={[1.4, 1.2, 0]} raycast={() => null}>
          <boxGeometry args={[0.4, 2.4, 0.4]} />
          <meshStandardMaterial color="#1a8f5c" />
        </mesh>
        <mesh position={[0, 2.3, 0]} raycast={() => null}>
          <boxGeometry args={[3.2, 0.4, 0.4]} />
          <meshStandardMaterial color="#3ecf8e" />
        </mesh>
        {(props.sim.current.semCorpo || props.sim.current.heroi.y >= -0.9) && cobertoAgora(props.sim.current, 0, 20) && (
          <Html position={[0, 2.8, 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
            <div className="ilha-plate">+10</div>
          </Html>
        )}
      </group>
      {props.sim.current.obras.map((obra) => {
        const atualCena = props.sim.current
        const ruina = obra.hp <= 0
        const lembrada = chaoRevelado(atualCena, obra.x, obra.z)
        const visivel =
          obra.lado === 'inimigo'
            ? ruina
              ? lembrada
              : cobertoAgora(atualCena, obra.x, obra.z)
            : ruina
              ? lembrada
              : true
        return (
          <ObraArquiteturaMesh
            key={obra.id}
            obra={obra}
            visivel={visivel}
            modoBloco={Boolean(props.modoBloco || props.modoLinhaRef.current || props.modoConsagrarRef.current)}
            onPointerDown={(event) => {
              // Esta malha roda antes do `pointerdown` do container, que atiraria (medido: R3F vem antes).
              if (pointerdownDaObra(obra.id, event.pointerId, event.nativeEvent.button)) event.stopPropagation()
            }}
            onPointerUp={(event) => {
              if (props.modoBlocoRef.current || props.modoLinhaRef.current || props.modoConsagrarRef.current || event.nativeEvent.button !== 2) return
              const atual = props.sim.current
              const peca = atual.obras.find((item) => item.id === obra.id)
              if (!peca || peca.hp <= 0 || peca.lado !== 'inimigo' || !cobertoAgora(atual, peca.x, peca.z)) return
              event.stopPropagation()
              if (atual.semCorpo || atual.olhar === 'imperio') props.onObra(obra.id)
            }}
            onClick={(event) => {
              if (props.modoBlocoRef.current || props.modoLinhaRef.current || props.modoConsagrarRef.current) return
              if (props.dragou.current || performance.now() - ultimoBoxSelectMs.current < 160) return
              const atual = props.sim.current
              const peca = atual.obras.find((item) => item.id === obra.id)
              if (!peca || peca.hp <= 0 || (peca.lado === 'inimigo' && !cobertoAgora(atual, peca.x, peca.z))) return
              event.stopPropagation()
              if (peca.lado !== 'inimigo' || atual.semCorpo || atual.olhar === 'imperio') props.onObra(obra.id)
            }}
          />
        )
      })}
      <TropasCena
        sim={props.sim}
        unidades={props.sim.current.unidades}
        selectedIds={props.selectedIds}
        unidadesRef={unidades}
        aneisRef={aneis}
        corposRef={corpos}
        modoBloco={props.modoBloco}
        modoBlocoRef={props.modoBlocoRef}
        deveIgnorarClique={() => props.dragou.current || performance.now() - ultimoBoxSelectMs.current < 160}
        haloAtivo={
          !props.modoLinhaRef.current &&
          !props.modoConsagrarRef.current &&
          (props.selectedIds.some((id) => props.sim.current.unidades.some((u) => u.id === id && u.lado === 'aliado' && u.hp > 0)) ||
            (props.heroiEscolhido && !props.sim.current.semCorpo))
        }
        onUnit={props.onUnit}
      />
      {pisos.map((piso) => (
        <mesh key={piso.nome} position={[piso.x, 0.05, piso.z]} raycast={() => null}>
          <cylinderGeometry args={[0.7, 0.7, 0.12, 12]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
      <instancedMesh
        ref={penumbra}
        args={[undefined, undefined, CELULAS_DO_DISCO.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0b1220" transparent opacity={0.72} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={nuvem}
        args={[undefined, undefined, CELULAS_DO_DISCO.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d5e2ea" transparent opacity={0.92} depthWrite />
      </instancedMesh>
    </>
  )
}

export const IlhaRua: React.FC = () => {
  const atlasRef = useRef(criarAtlas())
  const sim = useRef(estadoCena(atlasRef.current))
  const camadaMini = useRef<HTMLDivElement>(null)
  const miniEscala = useRef(168 / (PARTIDA.ladoMapa * 5))
  const quadro = useRef('')
  const [mapaTick, setMapaTick] = useState(0)
  const timeScale = useRef(1)
  const memoriaRestaurada = useRef(false)
  const assinaturasVistasRef = useRef<Set<string>>(new Set())
  const arquetiposRecentesRef = useRef<string[]>([])
  // Caderno de estudo (E2 + Fases Q2–Q4): `repoEstudoRef` persiste em IndexedDB (com fallback em memória) os 4 eventos
  // pedagógicos e mantém compatibilidade não destrutiva com `cadernoDeEstudo` v1. `contaAtivaRef` evita closures velhos no `onHud`.
  const cadernoRef = useRef<Caderno | null>(null)
  const repoEstudoRef = useRef<RepositorioEstudo | null>(null)
  const eventoQueueRef = useRef<Promise<void>>(Promise.resolve())
  const modalOpen = useRef(false)
  const reqContaIdRef = useRef(0)
  const keys = useRef<Controle>({ forward: false, back: false, strafe: 0, girarEsq: false, girarDir: false })
  const lookDrag = useRef<{ x: number; y: number } | null>(null)
  const lookPonteiro = useRef<number | null>(null)
  const imperioOrbitDrag = useRef<{
    pointerId: number
    button: number
    x0: number
    y0: number
    lastX: number
    arrastou: boolean
  } | null>(null)
  const rotacaoBotaoRef = useRef<-1 | 0 | 1>(0)
  const rotacaoHoldInicioRef = useRef(0)
  const cursorBordaRef = useRef<CursorBordaEntrada | null>(null)
  const [bussolaImperio, setBussolaImperio] = useState(() => compassLetter(yawDaBussolaNoImperio(0)))
  const stickPonteiro = useRef<number | null>(null)
  const stickOrigem = useRef<{ x: number; y: number } | null>(null)
  const stickEl = useRef<HTMLDivElement>(null)
  const knobEl = useRef<HTMLSpanElement>(null)
  const segurandoTiro = useRef(false)
  const tiroPonteiro = useRef<number | null>(null)
  const [celular, setCelular] = useState(() => window.matchMedia('(pointer: coarse)').matches)
  const cam = useRef<CameraImperioState>({ x: 0, z: 18, yaw: 0 })
  const tool = useRef<PecaId | null>(null)
  const moverObraIdRef = useRef<number | null>(null)
  const dragou = useRef(false)
  const evoluirId = useRef<number | null>(null)
  const obraBlocoAlvoIdRef = useRef<number | null>(null)
  const ponteiroDaObraRef = useRef<number | null>(null)
  const [painelObraId, setPainelObraId] = useState<number | null>(null)
  const [confirmarVendaId, setConfirmarVendaId] = useState<number | null>(null)
  const painelObraRef = useRef<number | null>(null)
  const evoluirPainelRef = useRef<() => void>(() => {})
  const [heroiEscolhido, setHeroiEscolhido] = useState(false)
  const [caixa, setCaixa] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null)
  const selected = useRef<number[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [modoMoverTouch, setModoMoverTouch] = useState(false)
  const modoMoverTouchRef = useRef(false)
  modoMoverTouchRef.current = modoMoverTouch
  const [hud, setHud] = useState(sim.current)
  const [telaEstudo, setTelaEstudo] = useState<TelaEstudo>('jogo')
  const telaEstudoRef = useRef<TelaEstudo>('jogo')
  telaEstudoRef.current = telaEstudo
  const [tier, setTier] = useState<GrauConta>(1)
  const tierRef = useRef<GrauConta>(1)
  tierRef.current = tier
  const [contaAtiva, setContaAtiva] = useState<ContaAtiva | null>(null)
  const contaAtivaRef = useRef<ContaAtiva | null>(null)
  contaAtivaRef.current = contaAtiva
  const [carregandoConta, setCarregandoConta] = useState(false)
  const [erroCarregamentoConta, setErroCarregamentoConta] = useState(false)
  const [temaTreinoAtivo, setTemaTreinoAtivo] = useState<string | null>(null)
  const temaTreinoRef = useRef<string | null>(null)
  temaTreinoRef.current = temaTreinoAtivo
  const [estadoEstudo, setEstadoEstudo] = useState<EstadoEstudoLocal>(() => estadoEstudoVazio())
  const estadoEstudoRef = useRef(estadoEstudo)
  estadoEstudoRef.current = estadoEstudo
  const [statusCaderno, setStatusCaderno] = useState('')
  const openContaRef = useRef<
    (
      nextTier: GrauConta,
      opcoes?: { readonly temaPreferido?: string | null; readonly forcarNova?: boolean; readonly registrarAbandono?: boolean },
    ) => void
  >(() => {})
  const ativarTelaEstudoRef = useRef<(proxima: TelaEstudo) => void>(() => {})
  const alternarCadernoRef = useRef<() => void>(() => {})
  const diagnostico = useMemo(() => gerarDiagnosticoEstudo(estadoEstudo), [estadoEstudo])
  const [power, setPower] = useState('')
  const [ferramenta, setFerramenta] = useState('')
  const [intencao, setIntencao] = useState<IconeId | null>(null)
  const intencaoRef = useRef<IconeId | null>(null)
  intencaoRef.current = intencao
  const confirmarRef = useRef<(acao: IconeId) => void>(() => {})
  const entradaPorTeclado = useRef(false)
  const confirmarSimRef = useRef<HTMLButtonElement | null>(null)
  const [menuMiniAberto, setMenuMiniAberto] = useState(true)
  const [painelBlocosAberto, setPainelBlocosAberto] = useState(false)
  const [modoBloco, setModoBloco] = useState<'adicionar' | 'remover' | null>(null)
  const modoBlocoRef = useRef<'adicionar' | 'remover' | null>(null)
  modoBlocoRef.current = modoBloco
  const [materialBloco, setMaterialBloco] = useState<BlocoMaterial>(PARTIDA.materialBlocoPadrao)
  const materialBlocoRef = useRef<BlocoMaterial>(PARTIDA.materialBlocoPadrao)
  materialBlocoRef.current = materialBloco
  const [modoLinhaBlocos, setModoLinhaBlocos] = useState(false)
  const modoLinhaRef = useRef(false)
  modoLinhaRef.current = modoLinhaBlocos
  const [alturaLinha, setAlturaLinha] = useState<1 | 2 | 3>(PARTIDA.alturaLinhaPadrao)
  const alturaLinhaRef = useRef<1 | 2 | 3>(PARTIDA.alturaLinhaPadrao)
  alturaLinhaRef.current = alturaLinha
  const [modoConsagrar, setModoConsagrar] = useState<PecaId | null>(null)
  const modoConsagrarRef = useRef<PecaId | null>(null)
  modoConsagrarRef.current = modoConsagrar
  const shellRef = useRef<HTMLDivElement>(null)
  const cursorNdcRef = useRef<{ x: number; y: number } | null>(null)
  const voxelAlvoRef = useRef<AlvoEdicaoUnificado | null>(null)
  const resolverAlvoSyncRef = useRef<() => AlvoEdicaoUnificado | null>(() => null)
  const resolverBlocoConsagrarSyncRef = useRef<() => { gx: number; gy: number; gz: number } | null>(() => null)
  const blocoPonteiro = useRef<{ pointerId: number; x0: number; y0: number; arrastou: boolean; button: number } | null>(null)
  const [ghostBloco, setGhostBloco] = useState<AlvoEdicaoUnificado | null>(null)
  const [ghostObra, setGhostObra] = useState<{ tipo: PecaId; x: number; z: number; valido: boolean } | null>(null)
  const [previewLinha, setPreviewLinha] = useState<{ plano: PlanoLinhaBlocos; temRecurso: boolean } | null>(null)
  const [miraAlvo, setMiraAlvo] = useState(false)
  const mapaInteracao = useRef('0,0')

  const definirSelecao = (ids: number[]) => {
    const unicos = Array.from(new Set(ids))
    selected.current = unicos
    setSelectedIds(unicos)
  }

  const limparSelecao = () => {
    definirSelecao([])
    setHeroiEscolhido(false)
    setModoMoverTouch(false)
    evoluirId.current = null
    setFerramenta('')
  }

  const limparInteracao = (preservarMovimento = false) => {
    if (!preservarMovimento) {
      keys.current = { forward: false, back: false, strafe: 0, girarEsq: false, girarDir: false }
      lookDrag.current = null
      lookPonteiro.current = null
      imperioOrbitDrag.current = null
      rotacaoBotaoRef.current = 0
      rotacaoHoldInicioRef.current = 0
      cursorBordaRef.current = null
      stickPonteiro.current = null
      stickOrigem.current = null
      segurandoTiro.current = false
      tiroPonteiro.current = null
      blocoPonteiro.current = null
      stickEl.current?.classList.remove('ativo')
      document.exitPointerLock?.()
    }
    definirSelecao([])
    setModoMoverTouch(false)
    evoluirId.current = null
    // A cena trocou: o painel e o id preso do editor de blocos eram de uma obra do quadrado anterior (A3).
    painelObraRef.current = null
    obraBlocoAlvoIdRef.current = null
    setPainelObraId(null)
    setConfirmarVendaId(null)
    tool.current = null
    moverObraIdRef.current = null
    dragou.current = false
    voxelAlvoRef.current = null
    setHeroiEscolhido(false)
    setCaixa(null)
    setFerramenta('')
    setIntencao(null)
    modoBlocoRef.current = null
    setModoBloco(null)
    modoLinhaRef.current = false
    setModoLinhaBlocos(false)
    modoConsagrarRef.current = null
    setModoConsagrar(null)
    setGhostBloco(null)
    setGhostObra(null)
    setPreviewLinha(null)
    ativarTelaEstudo('jogo')
  }

  const podeComandar = () => !estadoCorpo(atlasRef.current).derrota && (sim.current.semCorpo || sim.current.olhar === 'imperio')

  const executarOrdemChao = (x: number, z: number) => {
    let atual = sim.current
    if (heroiEscolhido && !atual.semCorpo) atual = ordenarHeroi(atual, { tipo: 'mover', x, z })
    // As TROPAS ganham o destino da faixa da borda (M5, escolha do usuário 23/11): um clique nos 3 m da beira do chão manda atravessar para o mapa vizinho. O herói NÃO: ele atravessa andando.
    if (selected.current.length > 0) {
      const destino = destinoDoClique(x, z)
      atual = ordenar(atual, selected.current, { tipo: 'mover', x: destino.x, z: destino.z })
    }
    publicar(atual)
  }

  const publicar = (next: PartidaState) => {
    sim.current = next
    atlasRef.current = escreverCena(atlasRef.current, next)
    setHud((previous) => {
      const mudou =
        previous.olhar !== next.olhar ||
        previous.semCorpo !== next.semCorpo ||
        previous.heroi.army !== next.heroi.army ||
        previous.credito !== next.credito ||
        previous.derrota !== next.derrota ||
        previous.ruaPercorrida !== next.ruaPercorrida ||
        previous.versaoSolidos !== next.versaoSolidos ||
        previous.obras.length !== next.obras.length ||
        previous.obras
          .map(
            (obra) =>
              `${obra.id}:${obra.lado}:${obra.hp}:${obra.nivel}:${Math.ceil((obra.construindoRestante ?? 0) * 2)}:${obra.lado === 'inimigo' ? (cobertoAgora(previous, obra.x, obra.z) ? 1 : 0) : 1}`,
          )
          .join() !==
          next.obras
            .map(
              (obra) =>
                `${obra.id}:${obra.lado}:${obra.hp}:${obra.nivel}:${Math.ceil((obra.construindoRestante ?? 0) * 2)}:${obra.lado === 'inimigo' ? (cobertoAgora(next, obra.x, obra.z) ? 1 : 0) : 1}`,
            )
            .join() ||
        previous.unidades.length !== next.unidades.length ||
        previous.unidades
            .map((unidade) => `${unidade.id}:${unidade.postura}:${unidade.ordem?.tipo ?? ''}:${unidade.hp}:${unidade.segmentos.join('.')}:${inimigoVisivel(previous, unidade) ? 1 : 0}:${unidade.rota?.semCaminho ? 1 : 0}`)
            .join() !==
          next.unidades
            .map((unidade) => `${unidade.id}:${unidade.postura}:${unidade.ordem?.tipo ?? ''}:${unidade.hp}:${unidade.segmentos.join('.')}:${inimigoVisivel(next, unidade) ? 1 : 0}:${unidade.rota?.semCaminho ? 1 : 0}`)
            .join() ||
        previous.lingotes !== next.lingotes ||
        previous.resto !== next.resto ||
        previous.madeira !== next.madeira ||
        previous.ouro !== next.ouro ||
        previous.bioma !== next.bioma ||
        previous.versaoRecursos !== next.versaoRecursos ||
        Math.round(previous.heroi.y * 10) !== Math.round(next.heroi.y * 10) ||
        previous.heroi.carregandoKg !== next.heroi.carregandoKg ||
        previous.altar?.resolvido !== next.altar?.resolvido ||
        previous.altar?.aviso !== next.altar?.aviso ||
        compassLetter(previous.heroi.yaw) !== compassLetter(next.heroi.yaw) ||
        Math.ceil(PARTIDA.ondaPeriodo - previous.ondaRelogio) !==
          Math.ceil(PARTIDA.ondaPeriodo - next.ondaRelogio) ||
        previous.versaoChao !== next.versaoChao
      return mudou ? next : previous
    })
  }

  const aplicarEdicaoVoxel = () => {
    if (!sim.current.semCorpo && sim.current.heroi.y < -0.9) {
      setPower('Volte à superfície para editar blocos')
      return
    }
    if (modoConsagrarRef.current) {
      const tipo = modoConsagrarRef.current
      const bloco = resolverBlocoConsagrarSyncRef.current()
      if (!bloco) {
        setPower('Clique em um bloco aliado livre para consagrar')
        return
      }
      const check = podeConsagrarEm(sim.current, bloco.gx, bloco.gy, bloco.gz, tipo)
      if (!check.ok) {
        setPower(check.motivo ?? 'Estrutura ainda não atende os requisitos')
        return
      }
      publicar(consagrarEstruturaManual(sim.current, bloco.gx, bloco.gy, bloco.gz, tipo))
      modoConsagrarRef.current = null
      setModoConsagrar(null)
      setFerramenta('')
      setPower(`Estrutura consagrada como ${META_INTENCOES[tipo].titulo}!`)
      return
    }
    const alvo =
      sim.current.semCorpo || sim.current.olhar === 'imperio'
        ? resolverAlvoSyncRef.current()
        : (voxelAlvoRef.current ?? resolverAlvoSyncRef.current())
    setGhostBloco(alvo)
    if (!alvo) {
      setPower(modoBlocoRef.current === 'remover' ? 'Mire em um bloco seu para remover' : 'Mire no chão ou em um bloco até 7 m')
      return
    }
    if (!alvo.valido) {
      setPower(mensagemMotivoBloco(alvo.motivo, alvo.tipo === 'nv5' ? 'madeira' : alvo.material))
      return
    }
    if (alvo.tipo === 'nv5') {
      publicar(editarBlocoObra(sim.current, alvo.obraId, alvo.bx, alvo.by, alvo.bz, alvo.acao))
      return
    }
    if (alvo.tipo === 'mundo') {
      publicar(editarBlocoMundo(sim.current, alvo.gx, alvo.gy, alvo.gz, alvo.acao, alvo.material))
      return
    }
    publicar(editarBlocoObraLivre(sim.current, alvo.obraId, alvo.gx, alvo.gy, alvo.gz, alvo.acao, alvo.material))
  }

  const irParaOlhar = (olhar: Olhar) => {
    if (olhar === 'imperio') {
      document.exitPointerLock?.()
    } else {
      tool.current = null
      moverObraIdRef.current = null
      setConfirmarVendaId(null)
      setGhostObra(null)
      modoLinhaRef.current = false
      setModoLinhaBlocos(false)
      setPreviewLinha(null)
      modoConsagrarRef.current = null
      setModoConsagrar(null)
      setModoMoverTouch(false)
      if (!modoBlocoRef.current) setFerramenta('')
    }
    publicar(definirOlhar(sim.current, olhar))
  }
  const irParaOlharRef = useRef(irParaOlhar)
  irParaOlharRef.current = irParaOlhar

  const aplicarEdicaoVoxelRef = useRef(aplicarEdicaoVoxel)
  aplicarEdicaoVoxelRef.current = aplicarEdicaoVoxel

  useEffect(() => {
    // O jogador chegou no controle focado pelo teclado (Tab) ou por clique? `:focus-visible` não diz:
    // o Chrome o liga na primeira tecla depois do clique. Quem guarda a origem é este ref.
    const registrarPonteiro = () => {
      entradaPorTeclado.current = proximaEntradaPorTeclado({ tipo: 'ponteiro' }, entradaPorTeclado.current)
    }
    window.addEventListener('pointerdown', registrarPonteiro, true)
    const down = (event: KeyboardEvent) => {
      entradaPorTeclado.current = proximaEntradaPorTeclado({ tipo: 'tecla', code: event.code }, entradaPorTeclado.current)
      const acaoEstudo = acaoDeAtalhoEstudo({
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        tela: telaEstudoRef.current,
        alvo: alvoDoTeclado(event.target),
      })
      if (acaoEstudo === 'alternar_conta') {
        event.preventDefault()
        if (telaEstudoRef.current === 'conta') {
          ativarTelaEstudoRef.current('jogo')
        } else if (sim.current.semCorpo || estadoCorpo(atlasRef.current).derrota) {
          return
        } else if (contaAtivaRef.current && !contaAtivaRef.current.resolvida) {
          ativarTelaEstudoRef.current('conta')
        } else {
          openContaRef.current(tierRef.current, { forcarNova: true })
        }
        return
      }
      if (acaoEstudo === 'alternar_caderno') {
        event.preventDefault()
        alternarCadernoRef.current()
        return
      }
      if (acaoEstudo === 'voltar_jogo') {
        event.preventDefault()
        ativarTelaEstudoRef.current('jogo')
        return
      }
      if (modalOpen.current) return
      // O Esc é do jogo, EXCETO com o foco num campo de texto ou num controle que trata o próprio Esc (selo de vida: ele fecha a PRÓPRIA legenda).
      // Este handler é de CAPTURA na window e roda antes do onKeyDown do React: sem esta consulta o card/painel fechava por baixo da legenda.
      if (event.code === 'Escape' && jogoTomaEscape(alvoDoTeclado(event.target))) {
        // O card de confirmação fica NA FRENTE do painel (z-index 12 contra 10): o Esc fecha o que está por cima
        // primeiro, e o painel de trás espera o próximo Esc (OBS-F2-2). Com card aberto o painel não é tocado aqui;
        // o card cai nos ramos de baixo, que já o fecham junto com a ferramenta/fantasma, como sempre fizeram.
        if (
          painelObraRef.current !== null &&
          intencaoRef.current === null &&
          !modoBlocoRef.current &&
          !modoLinhaRef.current &&
          !modoConsagrarRef.current
        ) {
          painelObraRef.current = null
          obraBlocoAlvoIdRef.current = null
          setPainelObraId(null)
          setConfirmarVendaId(null)
          return
        }
        // Card na frente de um modo de edição (bloco, linha, consagrar): o 1º Esc fecha SÓ o card. O modo fica atrás e
        // espera o próximo Esc. Sem isto o Esc fechava o modo escondido e o jogador via um Esc que não fez nada
        // (OBS-F2-2b, medido: card + painel + modoBloco => 1º Esc sem efeito visível, 2º fecha o card, 3º o painel).
        // Não vira um `return` solto para todo card: o ramo da ferramenta, mais abaixo, fecha card + fantasma juntos.
        if (intencaoRef.current !== null && (modoBlocoRef.current || modoLinhaRef.current || modoConsagrarRef.current)) {
          setIntencao(null)
          return
        }
        if (modoBlocoRef.current || modoLinhaRef.current || modoConsagrarRef.current) {
          modoBlocoRef.current = null
          modoLinhaRef.current = false
          modoConsagrarRef.current = null
          voxelAlvoRef.current = null
          setModoBloco(null)
          setModoLinhaBlocos(false)
          setModoConsagrar(null)
          setGhostBloco(null)
          setPreviewLinha(null)
          setFerramenta('')
          return
        }
        if (moverObraIdRef.current !== null) {
          moverObraIdRef.current = null
          setGhostObra(null)
          setIntencao(null)
          setFerramenta('')
          return
        }
        if (modoMoverTouchRef.current || tool.current) {
          tool.current = null
          setGhostObra(null)
          setIntencao(null)
          setModoMoverTouch(false)
          setFerramenta('')
          return
        }
        setIntencao(null)
      }
      if (event.code === 'Digit1') irParaOlharRef.current('primeira')
      if (event.code === 'Digit2') irParaOlharRef.current('terceira')
      if (event.code === 'Digit3') irParaOlharRef.current('imperio')
      const alvoTecla = alvoDoTeclado(event.target)
      if (
        jogoTomaConfirmar(
          event.code,
          alvoTecla,
          {
            cardAberto: intencaoRef.current !== null,
            // O painel só conta aberto enquanto a obra dele existe, é nossa e está viva (A3b: painel fantasma).
            painelAberto: painelValido(painelObraRef.current, sim.current.obras, estadoCorpo(atlasRef.current).derrota),
          },
          entradaPorTeclado.current,
        )
      ) {
        event.preventDefault()
        if (event.repeat) return
        if (intencaoRef.current) confirmarRef.current(intencaoRef.current)
        else evoluirPainelRef.current()
        return
      }
      if (event.code === 'Space' && !teclaDoBotaoFocado(alvoTecla, entradaPorTeclado.current)) {
        event.preventDefault()
        if (event.repeat || sim.current.olhar === 'imperio' || sim.current.derrota || sim.current.semCorpo) return
        publicar(pular(sim.current))
        return
      }
      if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.current.forward = true
      if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.current.back = true
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.current.strafe = -1
      if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.current.strafe = 1
      if (!alvoTecla.ehCampoDeTexto && (sim.current.olhar === 'imperio' || sim.current.semCorpo)) {
        if (event.code === 'KeyZ') keys.current.girarEsq = true
        if (event.code === 'KeyE' || event.code === 'KeyC') keys.current.girarDir = true
        if (event.code === 'KeyR' && !event.repeat) {
          cam.current = { ...cam.current, yaw: 0 }
        }
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'KeyW' || event.code === 'ArrowUp') keys.current.forward = false
      if (event.code === 'KeyS' || event.code === 'ArrowDown') keys.current.back = false
      if ((event.code === 'KeyA' || event.code === 'ArrowLeft') && keys.current.strafe === -1) {
        keys.current.strafe = 0
      }
      if ((event.code === 'KeyD' || event.code === 'ArrowRight') && keys.current.strafe === 1) {
        keys.current.strafe = 0
      }
      if (event.code === 'KeyZ') keys.current.girarEsq = false
      if (event.code === 'KeyE' || event.code === 'KeyC') keys.current.girarDir = false
    }
    const moverManche = (clientX: number, clientY: number) => {
      const origem = stickOrigem.current
      if (!origem) return
      const dx = clientX - origem.x
      const dy = clientY - origem.y
      const dist = Math.hypot(dx, dy)
      const escala = dist > RAIO_MANCHE ? RAIO_MANCHE / dist : 1
      const px = dx * escala
      const py = dy * escala
      let eixoX = px / RAIO_MANCHE
      let eixoY = -py / RAIO_MANCHE
      if (Math.hypot(eixoX, eixoY) < 0.18) {
        eixoX = 0
        eixoY = 0
      }
      keys.current.eixoX = eixoX
      keys.current.eixoY = eixoY
      if (knobEl.current) knobEl.current.style.transform = `translate(${px}px, ${py}px)`
    }
    const soltarManche = () => {
      stickPonteiro.current = null
      stickOrigem.current = null
      delete keys.current.eixoX
      delete keys.current.eixoY
      stickEl.current?.classList.remove('ativo')
    }
    const atualizarCursorNdc = (clientX: number, clientY: number) => {
      const canvasEl = shellRef.current?.querySelector('canvas')
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      cursorNdcRef.current = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
      }
    }
    const atualizarCursorBorda = (event: PointerEvent) => {
      if (
        event.pointerType !== 'mouse' ||
        modalOpen.current ||
        imperioOrbitDrag.current?.arrastou ||
        (!sim.current.semCorpo && sim.current.olhar !== 'imperio')
      ) {
        cursorBordaRef.current = null
        return
      }
      const alvo = event.target as HTMLElement | null
      if (alvo && typeof alvo.closest === 'function' && alvo.closest(SELETOR_HUD_SEM_BORDA)) {
        cursorBordaRef.current = null
        return
      }
      const rect = shellRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        cursorBordaRef.current = null
        return
      }
      cursorBordaRef.current = {
        localX: event.clientX - rect.left,
        localY: event.clientY - rect.top,
        largura: rect.width,
        altura: rect.height,
      }
    }
    const moveLook = (event: PointerEvent) => {
      atualizarCursorNdc(event.clientX, event.clientY)
      if (blocoPonteiro.current && blocoPonteiro.current.pointerId === event.pointerId) {
        const dist = Math.hypot(event.clientX - blocoPonteiro.current.x0, event.clientY - blocoPonteiro.current.y0)
        if (decidirAcaoPonteiro(dist) === 'arrasto') {
          blocoPonteiro.current.arrastou = true
        }
      }
      const orbit = imperioOrbitDrag.current
      if (orbit && orbit.pointerId === event.pointerId) {
        if (!orbit.arrastou) {
          const dist = Math.hypot(event.clientX - orbit.x0, event.clientY - orbit.y0)
          const limiar = orbit.button === 2 ? PARTIDA.limiarArrastoRmbPx : 0
          if (dist > limiar) {
            orbit.arrastou = true
            orbit.lastX = event.clientX
            cursorBordaRef.current = null
          }
          if (!orbit.arrastou) atualizarCursorBorda(event)
          return
        }
        cursorBordaRef.current = null
        cam.current = girarCameraImperioPorArrasto(cam.current, event.clientX - orbit.lastX)
        orbit.lastX = event.clientX
        return
      }
      atualizarCursorBorda(event)
      if (modalOpen.current) return
      if (stickPonteiro.current === event.pointerId) {
        moverManche(event.clientX, event.clientY)
        return
      }
      if (sim.current.semCorpo || sim.current.olhar === 'imperio') return
      if (document.pointerLockElement && event.pointerType !== 'touch') {
        sim.current = mira(sim.current, event.movementX * 0.003, -event.movementY * 0.003)
        return
      }
      if (lookPonteiro.current !== null && event.pointerId !== lookPonteiro.current) return
      const drag = lookDrag.current
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      lookDrag.current = { x: event.clientX, y: event.clientY }
      sim.current = mira(sim.current, dx * 0.005, -dy * 0.004)
    }
    const stopLook = (event: PointerEvent) => {
      if (stickPonteiro.current === event.pointerId) soltarManche()
      if (imperioOrbitDrag.current && imperioOrbitDrag.current.pointerId === event.pointerId) {
        imperioOrbitDrag.current = null
      }
      if (lookPonteiro.current === event.pointerId) {
        lookDrag.current = null
        lookPonteiro.current = null
      }
      if (tiroPonteiro.current === event.pointerId) {
        segurandoTiro.current = false
        tiroPonteiro.current = null
      }
      if (blocoPonteiro.current && blocoPonteiro.current.pointerId === event.pointerId) {
        const info = blocoPonteiro.current
        blocoPonteiro.current = null
        if (
          event.type === 'pointerup' &&
          !info.arrastou &&
          (modoBlocoRef.current || modoConsagrarRef.current) &&
          (info.button === 0 || event.pointerType === 'touch')
        ) {
          atualizarCursorNdc(event.clientX, event.clientY)
          aplicarEdicaoVoxelRef.current()
        }
      }
    }
    const limparCursorBorda = () => {
      cursorBordaRef.current = null
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up)
    window.addEventListener('pointermove', moveLook)
    window.addEventListener('pointerup', stopLook)
    window.addEventListener('pointercancel', stopLook)
    window.addEventListener('blur', limparCursorBorda)
    document.documentElement.addEventListener('mouseleave', limparCursorBorda)
    return () => {
      window.removeEventListener('pointerdown', registrarPonteiro, true)
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up)
      window.removeEventListener('pointermove', moveLook)
      window.removeEventListener('pointerup', stopLook)
      window.removeEventListener('pointercancel', stopLook)
      window.removeEventListener('blur', limparCursorBorda)
      document.documentElement.removeEventListener('mouseleave', limparCursorBorda)
    }
  }, [])

  // O editor de blocos preso a uma obra do painel só vale enquanto o modo bloco está armado. O modo termina por muitos
  // caminhos (Esc, a barra normal, outra ferramenta, outra obra) e o alvo ficava preso ao id antigo, travando depois a
  // edição normal de blocos livres (F2-D3). Aqui é o funil: `modoBloco` virou `null`, o alvo do painel é descartado.
  useEffect(() => {
    if (modoBloco === null) obraBlocoAlvoIdRef.current = null
  }, [modoBloco])

  // A obra do painel morreu, sumiu ou trocou de dono, ou a partida acabou: o painel fecha de verdade. Só esconder
  // deixava o id vivo no ref, e o Espaço deixava de pular com um painel invisível (A3b, e de novo na derrota,
  // OBS-F2-1). `hud` muda a cada publicação do estado. A derrota que vale é a do CORPO (a mesma de `podeComandar` e do
  // JSX), lida no render: `hud.derrota` é a da cena OBSERVADA, e com o corpo morrendo em outro quadrado ela não muda,
  // então o painel ficava preso no ref (OBS-F2-1b, medido pelo T2 observando outro quadrado).
  const derrotaDoCorpo = estadoCorpo(atlasRef.current).derrota
  useEffect(() => {
    if (derrotaDoCorpo && telaEstudoRef.current === 'conta') {
      ativarTelaEstudoRef.current('jogo')
    }
    const idMover = moverObraIdRef.current
    if (idMover !== null) {
      const obraMover = hud.obras.find((o) => o.id === idMover)
      if (derrotaDoCorpo || !obraMover || obraMover.hp <= 0 || obraMover.lado === 'inimigo' || obraEmConstrucao(obraMover)) {
        moverObraIdRef.current = null
        setGhostObra(null)
        setFerramenta('')
      }
    }
    const id = painelObraRef.current
    if (id === null) return
    if (painelValido(id, hud.obras, derrotaDoCorpo)) return
    painelObraRef.current = null
    obraBlocoAlvoIdRef.current = null
    setPainelObraId(null)
    setConfirmarVendaId(null)
  }, [hud.obras, derrotaDoCorpo])

  // Card aberto: o foco entra no diálogo, em Confirmar. Sem isso o foco fica no ícone que o abriu e
  // Enter ou Espaço só reabrem o card em vez de confirmá-lo (D-C1 do laudo do T2).
  useEffect(() => {
    if (intencao) confirmarSimRef.current?.focus({ preventScroll: true })
  }, [intencao])

  const escolherFerramenta = (peca: PecaId, nome: string) => {
    if (!podeComandar()) return
    modoBlocoRef.current = null
    modoLinhaRef.current = false
    modoConsagrarRef.current = null
    setModoBloco(null)
    setModoLinhaBlocos(false)
    setModoConsagrar(null)
    setGhostBloco(null)
    setPreviewLinha(null)
    moverObraIdRef.current = null
    setConfirmarVendaId(null)
    tool.current = peca
    setFerramenta(nome)
    publicar(definirOlhar(sim.current, 'imperio'))
    document.exitPointerLock?.()
  }

  useEffect(() => {
    let ativo = true
    const repo = criarRepositorioIndexedDb()
    repoEstudoRef.current = repo
    void repo
      .inicializar()
      .then(() => repo.lerEstado())
      .then((st) => {
        if (ativo) setEstadoEstudo(st)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  const registrarEventoEstudo = (evento: EventoEstudo) => {
    const repo = repoEstudoRef.current
    if (!repo) return
    eventoQueueRef.current = eventoQueueRef.current
      .then(async () => {
        await repo.registrarEvento(evento)
        const atualizado = await repo.lerEstado()
        setEstadoEstudo(atualizado)
      })
      .catch(() => {})
  }

  const ativarTelaEstudo = (proxima: TelaEstudo) => {
    telaEstudoRef.current = proxima
    setTelaEstudo(proxima)
    if (proxima !== 'jogo') {
      keys.current = { forward: false, back: false, strafe: 0, girarEsq: false, girarDir: false }
      stickPonteiro.current = null
      stickOrigem.current = null
      lookDrag.current = null
      lookPonteiro.current = null
      imperioOrbitDrag.current = null
      rotacaoBotaoRef.current = 0
      rotacaoHoldInicioRef.current = 0
      cursorBordaRef.current = null
      segurandoTiro.current = false
      tiroPonteiro.current = null
      blocoPonteiro.current = null
      stickEl.current?.classList.remove('ativo')
      if (knobEl.current) knobEl.current.style.transform = 'translate(0px, 0px)'
      document.exitPointerLock?.()
    } else {
      const ativoEl = document.activeElement as HTMLElement | null
      if (ativoEl && ativoEl.closest('.ilha-hud, .ilha-modal, .ilha-caderno')) {
        ativoEl.blur()
      }
      entradaPorTeclado.current = false
    }
  }
  ativarTelaEstudoRef.current = ativarTelaEstudo

  const gravarContaV1 = (desafio: DesafioUnificado, erros: number, tempoMs: number) => {
    try {
      const armazenamento = armazenamentoDoNavegador()
      if (cadernoRef.current === null) cadernoRef.current = carregarCaderno(armazenamento)
      cadernoRef.current = registrarTentativa(cadernoRef.current, {
        q: Date.now(),
        g: desafio.grau,
        c: desafio.temaId,
        a: desafio.arquetipoOuItemId,
        e: erros,
        t: tempoMs,
        k: chaveCurta(desafio.assinatura),
      })
      salvarCaderno(armazenamento, cadernoRef.current)
    } catch {
      // Armazenamento indisponível ou cheio nunca interrompe o jogo
    }
  }

  const registrarAbandonoSePendente = () => {
    const ativa = contaAtivaRef.current
    if (!ativa || ativa.resolvida) return
    const tempoAbertoMs = Math.max(0, Math.round(performance.now() - ativa.abertaEmMs))
    registrarEventoEstudo({
      tipo: 'abandono',
      quando: Date.now(),
      itemId: ativa.desafio.id,
      origem: ativa.desafio.origem,
      temaId: ativa.desafio.temaId,
      grau: ativa.desafio.grau,
      errosAntesDeFechar: ativa.erros,
      maiorDicaUsada: ativa.dicasAbertas,
      tempoAbertoMs,
    })
    if (sim.current.altar && !sim.current.altar.resolvido) {
      publicar(fecharAltar(sim.current))
    }
  }

  const openConta = (
    nextTier: GrauConta,
    opcoes?: { readonly temaPreferido?: string | null; readonly forcarNova?: boolean; readonly registrarAbandono?: boolean },
  ) => {
    if (sim.current.semCorpo || estadoCorpo(atlasRef.current).derrota) return
    const grauReal: GrauConta = !PARTIDA.enemHabilitado && nextTier > 4 ? 4 : nextTier
    const ativa = contaAtivaRef.current
    if (ativa && !ativa.resolvida && opcoes?.registrarAbandono !== false) {
      registrarAbandonoSePendente()
    } else if (ativa && !ativa.resolvida && sim.current.altar && !sim.current.altar.resolvido) {
      publicar(fecharAltar(sim.current))
    }
    const proximoTema =
      opcoes && 'temaPreferido' in opcoes ? (opcoes.temaPreferido ?? null) : temaTreinoRef.current
    setTemaTreinoAtivo(proximoTema)
    temaTreinoRef.current = proximoTema
    setTier(grauReal)
    tierRef.current = grauReal
    contaAtivaRef.current = null
    setContaAtiva(null)
    setErroCarregamentoConta(false)
    setCarregandoConta(true)
    ativarTelaEstudo('conta')

    if (!memoriaRestaurada.current) {
      memoriaRestaurada.current = true
      const antigas = carregarAssinaturas(armazenamentoDoNavegador())
      hydrateSeenMathSignatures(antigas)
      for (const s of antigas) assinaturasVistasRef.current.add(s)
    }

    const reqId = ++reqContaIdRef.current
    const seed = Math.max(1, Math.round(42 + grauReal * 17 + sim.current.tempo * 100 + reqId * 31))
    void selecionarProximoDesafio({
      grau: grauReal,
      estadoEstudo: estadoEstudoRef.current,
      temaPreferido: proximoTema,
      assinaturasVistas: assinaturasVistasRef.current,
      arquetiposRecentes: arquetiposRecentesRef.current,
      seed,
    })
      .then((proxima) => {
        if (reqId !== reqContaIdRef.current) return
        if (sim.current.semCorpo || estadoCorpo(atlasRef.current).derrota) {
          setCarregandoConta(false)
          ativarTelaEstudo('jogo')
          return
        }
        arquetiposRecentesRef.current = [...arquetiposRecentesRef.current, proxima.arquetipoOuItemId].slice(-8)
        assinaturasVistasRef.current.add(proxima.assinatura)
        const combinadas = [...new Set([...getRecentMathSignaturesSnapshot(), ...assinaturasVistasRef.current])].slice(-120)
        salvarAssinaturas(armazenamentoDoNavegador(), combinadas)

        const novaConta: ContaAtiva = {
          desafio: proxima,
          dicasAbertas: 0,
          erradasClicadas: [],
          diagnosticoAtual: '',
          abertaEmMs: performance.now(),
          erros: 0,
          resolvida: false,
          gravada: false,
        }
        contaAtivaRef.current = novaConta
        setContaAtiva(novaConta)
        setCarregandoConta(false)

        const correta = proxima.alternativas.findIndex((item) => item.correta)
        const indice = ((correta < 0 ? 0 : correta) % 4) as 0 | 1 | 2 | 3
        publicar(abrirAltar(sim.current, grauReal, indice, proxima.altarFisicoCompativel))
      })
      .catch(() => {
        if (reqId === reqContaIdRef.current) {
          setCarregandoConta(false)
          setErroCarregamentoConta(true)
        }
      })
  }
  openContaRef.current = openConta

  alternarCadernoRef.current = () => {
    setStatusCaderno('')
    ativarTelaEstudo(telaEstudoRef.current === 'caderno' ? 'jogo' : 'caderno')
  }

  const pedirDica = (nivel: 1 | 2 | 3) => {
    const ativa = contaAtivaRef.current
    if (!ativa || ativa.resolvida || nivel <= ativa.dicasAbertas) return
    const novoNivel = Math.max(ativa.dicasAbertas, nivel) as 0 | 1 | 2 | 3
    const atualizada: ContaAtiva = { ...ativa, dicasAbertas: novoNivel }
    contaAtivaRef.current = atualizada
    setContaAtiva(atualizada)
    registrarEventoEstudo({
      tipo: 'dica_pedida',
      quando: Date.now(),
      itemId: ativa.desafio.id,
      origem: ativa.desafio.origem,
      temaId: ativa.desafio.temaId,
      grau: ativa.desafio.grau,
      nivelDica: nivel,
      tempoDesdeAberturaMs: Math.max(0, Math.round(performance.now() - ativa.abertaEmMs)),
    })
  }

  const responderAlternativa = (altId: string) => {
    const ativa = contaAtivaRef.current
    if (!ativa || ativa.resolvida) return
    if (sim.current.semCorpo || sim.current.derrota || estadoCorpo(atlasRef.current).derrota) return
    const alt = ativa.desafio.alternativas.find((item) => item.id === altId)
    if (!alt) return

    const tempoDesdeAberturaMs = Math.max(0, Math.round(performance.now() - ativa.abertaEmMs))
    if (!alt.correta) {
      const depoisErro = registrarErroNoAltar(sim.current)
      publicar(depoisErro)
      const novosErros = depoisErro.altar?.erros ?? ativa.erros + 1
      const erradasClicadas = ativa.erradasClicadas.includes(altId)
        ? ativa.erradasClicadas
        : [...ativa.erradasClicadas, altId]
      const atualizada: ContaAtiva = {
        ...ativa,
        erros: novosErros,
        erradasClicadas,
        diagnosticoAtual: alt.diagnosticoPt,
      }
      contaAtivaRef.current = atualizada
      setContaAtiva(atualizada)
      registrarEventoEstudo({
        tipo: 'erro_alternativa',
        quando: Date.now(),
        itemId: ativa.desafio.id,
        origem: ativa.desafio.origem,
        temaId: ativa.desafio.temaId,
        grau: ativa.desafio.grau,
        alternativaId: alt.id,
        tagErro: alt.tagErro,
        tempoDesdeAberturaMs,
      })
      return
    }

    const antes = sim.current
    const totalErros = Math.max(ativa.erros, antes.altar?.erros ?? 0)
    const depois = aplicarConta(antes, ativa.desafio.grau)
    publicar(depois)

    const ganhoBase = textoDaContaComErros(
      textoGanhoDaConta(antes.heroi.army, depois.heroi.army, depois.credito - antes.credito),
      totalErros,
    )
    const madeiraGanha = Math.max(0, depois.madeira - antes.madeira)
    const ouroGanho = Math.max(0, depois.ouro - antes.ouro)
    const extras: string[] = []
    if (madeiraGanha > 0) extras.push(`+${madeiraGanha} madeira`)
    if (ouroGanho > 0) extras.push(`+${ouroGanho} ouro`)
    const ganhoModal = extras.length > 0 ? `${ganhoBase} · ${extras.join(' · ')}` : ganhoBase

    const atualizada: ContaAtiva = {
      ...ativa,
      erros: totalErros,
      resolvida: true,
      gravada: true,
      diagnosticoAtual: alt.diagnosticoPt,
      ultimoGanhoPt: ganhoModal,
    }
    contaAtivaRef.current = atualizada
    setContaAtiva(atualizada)
    registrarEventoEstudo({
      tipo: 'acerto',
      quando: Date.now(),
      itemId: ativa.desafio.id,
      assinatura: ativa.desafio.assinatura,
      origem: ativa.desafio.origem,
      temaId: ativa.desafio.temaId,
      grau: ativa.desafio.grau,
      errosNaConta: totalErros,
      maiorDicaUsada: ativa.dicasAbertas,
      tempoTotalMs: tempoDesdeAberturaMs,
      fatorBuff: fatorDoBuff(totalErros),
    })
    gravarContaV1(ativa.desafio, totalErros, tempoDesdeAberturaMs)
    setPower(ganhoBase)
  }

  const desistirETrocar = () => {
    openConta(tierRef.current, { forcarNova: true, registrarAbandono: true })
  }

  const treinarTemaDoCaderno = (temaId: string) => {
    const ehTemaEnem = temaId.startsWith('enem_') || temaId === 'leitura_dados_codigo'
    const grauAlvo: GrauConta = ehTemaEnem
      ? PARTIDA.enemHabilitado
        ? (Math.max(5, tierRef.current) as GrauConta)
        : 4
      : tierRef.current <= 4
        ? tierRef.current
        : 3
    openConta(grauAlvo, { temaPreferido: temaId, forcarNova: true, registrarAbandono: true })
  }

  const exportarDadosEstudo = (): Promise<void> => {
    const repo = repoEstudoRef.current
    if (!repo) return Promise.resolve()
    const prom = eventoQueueRef.current.then(async () => {
      try {
        const json = await repo.exportarTudoJson()
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'logic-battle-caderno-estudo.json'
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        setStatusCaderno('Arquivo JSON exportado.')
      } catch {
        setStatusCaderno('Não foi possível exportar os dados neste navegador.')
      }
    })
    eventoQueueRef.current = prom.catch(() => {})
    return prom
  }

  const apagarDadosEstudo = (): Promise<void> => {
    const repo = repoEstudoRef.current
    if (!repo) return Promise.resolve()
    const prom = eventoQueueRef.current.then(async () => {
      await repo.apagarTudo()
      try {
        window.localStorage.removeItem('ld_ilha_caderno_v1')
        window.localStorage.removeItem('ld_ilha_contas_vistas_v1')
      } catch {
        // Ignora bloqueio de storage privado
      }
      cadernoRef.current = null
      assinaturasVistasRef.current.clear()
      arquetiposRecentesRef.current = []
      resetSeenMathMemory()
      setTemaTreinoAtivo(null)
      temaTreinoRef.current = null
      contaAtivaRef.current = null
      setContaAtiva(null)
      if (sim.current.altar && !sim.current.altar.resolvido) {
        publicar(fecharAltar(sim.current))
      }
      const limpo = await repo.lerEstado()
      setEstadoEstudo(limpo)
      setStatusCaderno('Dados locais de estudo apagados deste navegador.')
    })
    eventoQueueRef.current = prom.catch(() => {})
    return prom
  }

  useEffect(() => {
    if (!power) return
    const timer = window.setTimeout(() => setPower(''), 3500)
    return () => window.clearTimeout(timer)
  }, [power])

  // Tempo real 100%: não desaceleramos mais o jogo ao abrir contas ou caderno (compatível com multiplayer futuro).
  timeScale.current = 1
  modalOpen.current = telaEstudo !== 'jogo'

  const nucleoQualquer = hud.obras.find((obra) => obra.tipo === 'nucleo' && obra.lado !== 'inimigo')
  const nucleo = nucleoQualquer && nucleoQualquer.hp > 0 ? nucleoQualquer : undefined
  const ruinaNossa =
    hud.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0) ??
    hud.obras.find((obra) => obra.lado !== 'inimigo' && obra.hp <= 0)
  const tropasVivas = hud.unidades.filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
  const vivosAliadosSet = new Set(tropasVivas.map((unidade) => unidade.id))
  const selectedVivas = selectedIds.filter((id) => vivosAliadosSet.has(id))
  const emOrdens = tropasVivas.filter((unidade) => unidade.postura === 'ordens').length
  const emVigia = tropasVivas.filter((unidade) => unidade.postura === 'vigia' || unidade.postura === 'automatico').length
  const posturaMarcada = (valor: 'vigia' | 'noLugar' | 'calado') => {
    const tropasAlvo =
      selectedVivas.length > 0
        ? tropasVivas.filter((unidade) => selectedVivas.includes(unidade.id))
        : heroiEscolhido
          ? []
          : tropasVivas
    if (tropasAlvo.length === 0 && !heroiEscolhido) return valor === 'vigia'
    const tropasOk = tropasAlvo.every((unidade) => unidade.postura === valor)
    const heroiOk = !heroiEscolhido || (hud.heroiPostura ?? 'vigia') === valor
    return tropasOk && heroiOk
  }
  const dragaoVivo = hud.unidades.find((unidade) => unidade.papel === 'dragao' && inimigoVisivel(hud, unidade))
  const corpoAtual = estadoCorpo(atlasRef.current)
  const derrotado = corpoAtual.derrota
  // A mesma regra de `painelValido` decide aqui, no efeito que fecha o painel e no Enter: obra nossa e viva, e a
  // partida em andamento (OBS-F2-1: na derrota a tela de derrota manda). `derrotado` vem do corpo.
  const obraPainel = painelValido(painelObraId, hud.obras, derrotado)
    ? hud.obras.find((obra) => obra.id === painelObraId)
    : undefined
  const tatico = hud.semCorpo || hud.olhar === 'imperio'
  const heroiSelecionavel = heroiEscolhido && !hud.semCorpo
  const temSelecaoAtiva = tatico && !derrotado && (heroiSelecionavel || selectedVivas.length > 0)
  const textoSelecao =
    heroiSelecionavel && selectedVivas.length > 0
      ? `Herói + ${selectedVivas.length} ${selectedVivas.length === 1 ? 'tropa' : 'tropas'}`
      : heroiSelecionavel
        ? 'Herói selecionado'
        : `${selectedVivas.length} ${selectedVivas.length === 1 ? 'tropa' : 'tropas'}`

  const aplicarPostura = (valor: 'vigia' | 'noLugar' | 'calado') => {
    const temTropa = selected.current.length > 0
    const ids = temTropa
      ? selected.current
      : heroiEscolhido
        ? []
        : sim.current.unidades.filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0).map((unidade) => unidade.id)
    let atual = sim.current
    if (ids.length > 0) atual = postura(atual, ids, valor)
    if (heroiEscolhido) atual = posturaHeroi(atual, valor)
    if (atual === sim.current) return
    publicar(atual)
  }

  const confirmarIntencao = (acao: IconeId) => {
    setIntencao(null)
    if (
      acao === 'nucleo' ||
      acao === 'torre' ||
      acao === 'portao' ||
      acao === 'quartel' ||
      acao === 'britador' ||
      acao === 'serraria' ||
      acao === 'mina'
    ) {
      escolherFerramenta(acao, META_INTENCOES[acao].titulo)
      return
    }
    if (acao === 'evoluir') {
      const id = evoluirId.current ?? nucleo?.id
      if (!id) return
      const antes = sim.current.obras.find((o) => o.id === id)
      const prox = evoluir(sim.current, id)
      publicar(prox)
      const depois = prox.obras.find((o) => o.id === id)
      if (antes && depois && depois.nivel > antes.nivel) {
        setFerramenta(`${META_INTENCOES[depois.tipo].titulo} (Nv. ${depois.nivel})`)
        setPower(`${META_INTENCOES[depois.tipo].titulo} evoluiu para Nv. ${depois.nivel}!`)
      } else if (antes) {
        // O MOTIVO REAL vem de `podeEvoluir` (uma fonte só). Antes havia aqui uma cadeia de 3 mensagens, e qualquer recusa que não fosse «máximo» ou «em construção» caía no balde «Precisa de
        // X para evoluir»: uma recusa por FALTA DE ESPAÇO (a fortaleza do Nv5 sobre outra obra) diria ao jogador que faltava dinheiro.
        setPower(motivoDeNaoEvoluir(sim.current, id))
      }
      return
    }
    if (acao === 'tropa') {
      const selecionada = evoluirId.current
        ? sim.current.obras.find(
            (obra) =>
              obra.id === evoluirId.current &&
              obra.lado !== 'inimigo' &&
              (obra.tipo === 'quartel' || obra.tipo === 'nucleo') &&
              obra.hp > 0 &&
              !obraEmConstrucao(obra),
          )
        : undefined
      const casa =
        selecionada ??
        sim.current.obras.find(
          (obra) => obra.lado !== 'inimigo' && obra.tipo === 'quartel' && obra.hp > 0 && !obraEmConstrucao(obra),
        ) ??
        nucleo
      if (!casa) return
      const prox = criarTropa(sim.current, casa.id)
      if (prox === sim.current) {
        const vivasCount = sim.current.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0).length
        setPower(
          vivasCount >= PARTIDA.allyCap
            ? `Limite máximo de ${PARTIDA.allyCap} tropas atingido`
            : obraEmConstrucao(casa)
              ? 'Aguarde concluir a construção'
              : 'Precisa 1 licença ou 2 ouros para recrutar tropa',
        )
        return
      }
      publicar(prox)
      return
    }
    if (acao === 'todas') {
      const todas = sim.current.unidades
        .filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
        .map((unidade) => unidade.id)
      definirSelecao(todas)
      setFerramenta(`${todas.length} selecionados`)
      return
    }
    if (acao === 'atacar') {
      const ids =
        selected.current.length > 0
          ? selected.current
          : heroiEscolhido
            ? []
            : sim.current.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0).map((u) => u.id)
      if (ids.length === 0 && !heroiEscolhido) return
      if (ids.length > 0) definirSelecao(ids)
      const alvoId = alvoDoBotao(sim.current)
      if (alvoId !== null) {
        let atual = sim.current
        if (ids.length > 0) atual = ordenar(atual, ids, { tipo: 'atacar', alvoId })
        if (heroiEscolhido) atual = ordenarHeroi(atual, { tipo: 'atacar', alvoId })
        publicar(atual)
        return
      }
      const obraId = alvoDoBotaoObra(sim.current)
      if (obraId === null) return
      let atual = sim.current
      if (ids.length > 0) atual = ordenar(atual, ids, { tipo: 'atacarObra', obraId })
      if (heroiEscolhido) atual = ordenarHeroi(atual, { tipo: 'atacarObra', obraId })
      publicar(atual)
      return
    }
    if (acao === 'automatico') {
      aplicarPostura('vigia')
      return
    }
    if (acao === 'reparar') {
      const ruina =
        sim.current.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0) ??
        sim.current.obras.find((obra) => obra.lado !== 'inimigo' && obra.hp <= 0)
      if (!ruina) return
      publicar(repararObra(sim.current, ruina.id))
      return
    }
    if (acao === 'subsolo') {
      document.exitPointerLock?.()
      publicar(alternarSubsolo(sim.current))
      return
    }
    if (acao === 'editarBlocos') {
      modoLinhaRef.current = false
      setModoLinhaBlocos(false)
      setPreviewLinha(null)
      modoConsagrarRef.current = null
      setModoConsagrar(null)
      setPainelBlocosAberto((aberto) => {
        if (aberto) {
          modoBlocoRef.current = null
          voxelAlvoRef.current = null
          setModoBloco(null)
          setGhostBloco(null)
          setFerramenta('')
        }
        return !aberto
      })
      return
    }
    if (acao === 'blocoAdicionar') {
      document.exitPointerLock?.()
      tool.current = null
      moverObraIdRef.current = null
      setConfirmarVendaId(null)
      setGhostObra(null)
      modoLinhaRef.current = false
      setModoLinhaBlocos(false)
      setPreviewLinha(null)
      modoConsagrarRef.current = null
      setModoConsagrar(null)
      setPainelBlocosAberto(true)
      const proximo = modoBlocoRef.current === 'adicionar' ? null : 'adicionar'
      modoBlocoRef.current = proximo
      setModoBloco(proximo)
      setFerramenta(proximo ? `Modo Bloco: Adicionar (${SPEC_BLOCO_MATERIAL[materialBlocoRef.current].nome})` : '')
      if (!proximo) {
        voxelAlvoRef.current = null
        setGhostBloco(null)
      }
      return
    }
    if (acao === 'blocoRemover') {
      document.exitPointerLock?.()
      tool.current = null
      moverObraIdRef.current = null
      setConfirmarVendaId(null)
      setGhostObra(null)
      modoLinhaRef.current = false
      setModoLinhaBlocos(false)
      setPreviewLinha(null)
      modoConsagrarRef.current = null
      setModoConsagrar(null)
      setPainelBlocosAberto(true)
      const proximo = modoBlocoRef.current === 'remover' ? null : 'remover'
      modoBlocoRef.current = proximo
      setModoBloco(proximo)
      setFerramenta(proximo ? 'Modo Bloco: Remover' : '')
      if (!proximo) {
        voxelAlvoRef.current = null
        setGhostBloco(null)
      }
      return
    }
    if (acao === 'muralhaLinha') {
      document.exitPointerLock?.()
      tool.current = null
      moverObraIdRef.current = null
      setConfirmarVendaId(null)
      setGhostObra(null)
      setPainelBlocosAberto(false)
      modoBlocoRef.current = null
      setModoBloco(null)
      setGhostBloco(null)
      modoConsagrarRef.current = null
      setModoConsagrar(null)
      const proximo = !modoLinhaRef.current
      modoLinhaRef.current = proximo
      setModoLinhaBlocos(proximo)
      setPreviewLinha(null)
      setFerramenta(proximo ? `Linha 360° (${alturaLinhaRef.current}b · ${SPEC_BLOCO_MATERIAL[materialBlocoRef.current].nome})` : '')
      if (proximo) publicar(definirOlhar(sim.current, 'imperio'))
      return
    }
    if (acao === 'consagrar') {
      document.exitPointerLock?.()
      tool.current = null
      moverObraIdRef.current = null
      setConfirmarVendaId(null)
      setGhostObra(null)
      setPainelBlocosAberto(false)
      modoBlocoRef.current = null
      setModoBloco(null)
      setGhostBloco(null)
      modoLinhaRef.current = false
      setModoLinhaBlocos(false)
      setPreviewLinha(null)
      const proximo: PecaId | null = modoConsagrarRef.current ? null : 'torre'
      modoConsagrarRef.current = proximo
      setModoConsagrar(proximo)
      setFerramenta(proximo ? 'Consagrar: escolha o tipo e clique na estrutura' : '')
      return
    }
    if (acao === 'menuMinimapas') {
      setMenuMiniAberto((aberto) => !aberto)
      return
    }
    if (acao === 'minimapaAtual' || acao === 'minimapaAlguns' || acao === 'minimapaTodos') {
      const politica = acao === 'minimapaAtual' ? 'atual' : acao === 'minimapaTodos' ? 'todos' : 'alguns'
      atlasRef.current = definirPoliticaMinimapas(atlasRef.current, politica)
      sim.current = estadoCena(atlasRef.current)
      publicar(sim.current)
      setMapaTick((valor) => valor + 1)
    }
  }

  const evoluirDoPainel = () => {
    const id = painelObraRef.current
    if (id == null) return
    const antes = sim.current.obras.find((obra) => obra.id === id)
    if (!antes) return
    const prox = evoluir(sim.current, id)
    publicar(prox)
    const depois = prox.obras.find((obra) => obra.id === id)
    if (depois && depois.nivel > antes.nivel) {
      setFerramenta(`${META_INTENCOES[depois.tipo].titulo} (Nv. ${depois.nivel})`)
      setPower(`${META_INTENCOES[depois.tipo].titulo} evoluiu para Nv. ${depois.nivel}!`)
    } else {
      setPower(motivoDeNaoEvoluir(sim.current, id))
    }
  }
  evoluirPainelRef.current = evoluirDoPainel
  confirmarRef.current = confirmarIntencao

  const temMinaPronta = hud.obras.some(
    (obra) => obra.lado !== 'inimigo' && obra.tipo === 'mina' && obra.hp > 0 && !obraEmConstrucao(obra),
  )
  const noSubsoloHud = !hud.semCorpo && hud.heroi.y < -0.9

  return (
    <div
      ref={shellRef}
      className={celular ? 'ilha-shell ilha-celular' : 'ilha-shell'}
      onMouseDown={(event) => {
        if (event.button === 1 && (sim.current.olhar === 'imperio' || sim.current.semCorpo)) {
          event.preventDefault()
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerLeave={() => {
        cursorBordaRef.current = null
      }}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (
          target.closest(
            'button, .ilha-modal, .ilha-caderno, .ilha-confirmar-card, .ilha-acoes-campo, .ilha-olhar, .ilha-barra, .ilha-minimapa, .ilha-base, .ilha-construcoes, .ilha-ferramentas, .ilha-painel-obra, .ilha-army',
          )
        )
          return
        const canvasEl = shellRef.current?.querySelector('canvas')
        if (canvasEl) {
          const rectCanvas = canvasEl.getBoundingClientRect()
          if (rectCanvas.width > 0 && rectCanvas.height > 0) {
            cursorNdcRef.current = {
              x: ((event.clientX - rectCanvas.left) / rectCanvas.width) * 2 - 1,
              y: -((event.clientY - rectCanvas.top) / rectCanvas.height) * 2 + 1,
            }
          }
        }
        const toque = event.pointerType === 'touch'
        if (toque) setCelular(true)
        if (toque) {
          // A malha da obra marca o ponteiro também no toque. O container LÊ o marcador e o consome (zera), e um dedo
          // que caiu numa obra nossa abre o painel pelo `onClick` da malha: NÃO vira manche nem arrasto de câmera
          // (F2-D4, medido em toque real: tocar a obra na metade esquerda armava o joystick). Sem `preventDefault`
          // aqui, para o navegador seguir com o `click` que abre o painel.
          const retangulo = event.currentTarget.getBoundingClientRect()
          const localX = event.clientX - retangulo.left
          const destino = destinoDoToque({
            marcadoPelaObra: ponteiroDaObraRef.current,
            pointerId: event.pointerId,
            x: localX,
            largura: retangulo.width,
            olhar: sim.current.olhar,
            semCorpo: sim.current.semCorpo,
          })
          ponteiroDaObraRef.current = null
          if (destino === 'obra') return
          if (destino === 'manche') {
            event.preventDefault()
            stickPonteiro.current = event.pointerId
            stickOrigem.current = { x: event.clientX, y: event.clientY }
            keys.current.eixoX = 0
            keys.current.eixoY = 0
            if (stickEl.current) {
              stickEl.current.classList.add('ativo')
              stickEl.current.style.left = `${event.clientX - retangulo.left}px`
              stickEl.current.style.top = `${event.clientY - retangulo.top}px`
            }
            if (knobEl.current) knobEl.current.style.transform = 'translate(0px, 0px)'
            return
          }
          if (destino === 'imperio') {
            if (modoBlocoRef.current || modoConsagrarRef.current) {
              blocoPonteiro.current = {
                pointerId: event.pointerId,
                x0: event.clientX,
                y0: event.clientY,
                arrastou: false,
                button: event.button,
              }
            }
            return
          }
          event.preventDefault()
          lookDrag.current = { x: event.clientX, y: event.clientY }
          lookPonteiro.current = event.pointerId
          if (modoBlocoRef.current || modoConsagrarRef.current) {
            blocoPonteiro.current = {
              pointerId: event.pointerId,
              x0: event.clientX,
              y0: event.clientY,
              arrastou: false,
              button: event.button,
            }
          }
          return
        }
        // A malha da obra nossa roda ANTES deste handler e marca o ponteiro. Consome AQUI, antes de qualquer retorno
        // antecipado: um mouse tem sempre o mesmo `pointerId`, e o marcador que sobrava (retorno do império, de
        // «Observando» ou de um modo de edição) engolia o 1º tiro depois (OBS-F2-4, medido: 0 tiros contra 1).
        const ponteiroDaObra = ponteiroDaObraRef.current === event.pointerId
        ponteiroDaObraRef.current = null
        if (sim.current.olhar === 'imperio' || sim.current.semCorpo) {
          if (event.button === 1 || event.button === 2) {
            if (event.button === 1) {
              event.preventDefault()
              cursorBordaRef.current = null
            }
            imperioOrbitDrag.current = {
              pointerId: event.pointerId,
              button: event.button,
              x0: event.clientX,
              y0: event.clientY,
              lastX: event.clientX,
              arrastou: event.button === 1,
            }
            return
          }
          if ((modoBlocoRef.current || modoConsagrarRef.current) && event.button === 0) {
            blocoPonteiro.current = {
              pointerId: event.pointerId,
              x0: event.clientX,
              y0: event.clientY,
              arrastou: false,
              button: event.button,
            }
          }
          return
        }
        if (modoBlocoRef.current || modoConsagrarRef.current) {
          lookDrag.current = { x: event.clientX, y: event.clientY }
          lookPonteiro.current = event.pointerId
          blocoPonteiro.current = {
            pointerId: event.pointerId,
            x0: event.clientX,
            y0: event.clientY,
            arrastou: false,
            button: event.button,
          }
          return
        }
        if (event.button === 0 && !sim.current.derrota && !ponteiroDaObra) {
          segurandoTiro.current = true
          tiroPonteiro.current = event.pointerId
          publicar(atirar(sim.current))
        }
        lookDrag.current = { x: event.clientX, y: event.clientY }
        lookPonteiro.current = event.pointerId
        // Clique na obra abre o painel: o pointer lock esconderia o cursor e impediria de clicar nele.
        if (!ponteiroDaObra) pedirLock(event.currentTarget.querySelector('canvas'))
      }}
    >
      <Canvas camera={{ position: [0, 6, -8], fov: 55 }}>
        <Cena
          sim={sim}
          timeScale={timeScale}
          keys={keys}
          cam={cam}
          rotacaoBotaoRef={rotacaoBotaoRef}
          cursorBordaRef={cursorBordaRef}
          onBussolaImperio={setBussolaImperio}
          tool={tool}
          moverObraIdRef={moverObraIdRef}
          dragou={dragou}
          selectedIds={selectedIds}
          modoBloco={modoBloco}
          modoBlocoRef={modoBlocoRef}
          obraBlocoAlvoIdRef={obraBlocoAlvoIdRef}
          ponteiroDaObraRef={ponteiroDaObraRef}
          materialBlocoRef={materialBlocoRef}
          modoLinhaRef={modoLinhaRef}
          alturaLinhaRef={alturaLinhaRef}
          modoConsagrarRef={modoConsagrarRef}
          cursorNdcRef={cursorNdcRef}
          voxelAlvoRef={voxelAlvoRef}
          resolverAlvoSyncRef={resolverAlvoSyncRef}
          resolverBlocoConsagrarSyncRef={resolverBlocoConsagrarSyncRef}
          ghostBloco={ghostBloco}
          onGhostBloco={setGhostBloco}
          ghostObra={ghostObra}
          onGhostObra={setGhostObra}
          previewLinha={previewLinha}
          onPreviewLinha={setPreviewLinha}
          onConcluirLinha={(x0, z0, x1, z1) => {
            const st = sim.current
            const mat = materialBlocoRef.current
            const alt = alturaLinhaRef.current
            const plano = planejarLinhaNoEstado(st, x0, z0, x1, z1, alt, mat)
            if (plano.celulas.length === 0) return
            if (!temRecursoParaMaterial({ madeira: st.madeira, lingotes: st.lingotes, ouro: st.ouro }, mat, plano.celulas.length)) {
              setPower(`Precisa ${plano.custoTotal} ${SPEC_BLOCO_MATERIAL[mat].nome} para erguer esta linha`)
              return
            }
            publicar(construirLinhaBlocos(st, x0, z0, x1, z1, alt, mat))
            setPower(`Linha erguida: ${plano.celulas.length} blocos de ${SPEC_BLOCO_MATERIAL[mat].nome}`)
          }}
          onMiraAlvo={setMiraAlvo}
          onPedirSubsolo={() => {
            if (!modoBlocoRef.current && !modoLinhaRef.current && !modoConsagrarRef.current) setIntencao('subsolo')
          }}
          onHud={(state) => {
            const corpo = fichaEm(atlasRef.current, atlasRef.current.heroiI, atlasRef.current.heroiJ)
            const camada = camadaMini.current
            if (corpo && camada) {
              const escala = miniEscala.current
              const hx = atlasRef.current.heroiI * PARTIDA.ladoMapa + corpo.state.heroi.x
              const hz = atlasRef.current.heroiJ * PARTIDA.ladoMapa + corpo.state.heroi.z
              camada.style.transform = `translate(${84 - hx * escala}px, ${84 + hz * escala}px)`
            }
            const ativaHud = contaAtivaRef.current
            if (state.altar && ativaHud && !ativaHud.resolvida && state.altar.erros > ativaHud.erros) {
              const syncErro: ContaAtiva = {
                ...ativaHud,
                erros: state.altar.erros,
                diagnosticoAtual: state.altar.aviso ?? ativaHud.diagnosticoAtual,
              }
              contaAtivaRef.current = syncErro
              setContaAtiva(syncErro)
              registrarEventoEstudo({
                tipo: 'erro_alternativa',
                quando: Date.now(),
                itemId: ativaHud.desafio.id,
                origem: ativaHud.desafio.origem,
                temaId: ativaHud.desafio.temaId,
                grau: ativaHud.desafio.grau,
                alternativaId: 'piso_3d',
                tempoDesdeAberturaMs: Math.max(0, Math.round(performance.now() - ativaHud.abertaEmMs)),
              })
            }
            if (state.altar?.resolvido && ativaHud && !ativaHud.gravada) {
              const errosAltar = state.altar.erros
              const tempoTotalMs = Math.max(0, Math.round(performance.now() - ativaHud.abertaEmMs))
              const ganho = state.altar.ganhoVida
              const textoGanho = textoDaContaComErros(
                textoGanhoDaConta(0, ganho === undefined ? Number.NaN : ganho, state.altar.ganhoCredito ?? 0),
                errosAltar,
              )
              const corretaAlt = ativaHud.desafio.alternativas.find((a) => a.correta)
              const resolvidaHud: ContaAtiva = {
                ...ativaHud,
                erros: errosAltar,
                resolvida: true,
                gravada: true,
                diagnosticoAtual: corretaAlt?.diagnosticoPt ?? 'Conta resolvida pelo piso 3D!',
                ultimoGanhoPt: textoGanho,
              }
              contaAtivaRef.current = resolvidaHud
              setContaAtiva(resolvidaHud)
              registrarEventoEstudo({
                tipo: 'acerto',
                quando: Date.now(),
                itemId: ativaHud.desafio.id,
                assinatura: ativaHud.desafio.assinatura,
                origem: ativaHud.desafio.origem,
                temaId: ativaHud.desafio.temaId,
                grau: ativaHud.desafio.grau,
                errosNaConta: errosAltar,
                maiorDicaUsada: ativaHud.dicasAbertas,
                tempoTotalMs,
                fatorBuff: fatorDoBuff(errosAltar),
              })
              gravarContaV1(ativaHud.desafio, errosAltar, tempoTotalMs)
              setPower(textoGanho)
            }
            const tiro =
              segurandoTiro.current && state.olhar !== 'imperio' && !state.semCorpo && !state.derrota && state.heroi.shootCooldown <= 0
                ? atirar(state)
                : state
            publicar(tiro)
          }}
          onGround={(x, z) => {
            if (!podeComandar()) return
            if (tool.current) {
              const check = podeFundarEm(sim.current, tool.current, x, z, { cobrarRecursos: true, exigirRevelado: true })
              if (!check.ok) {
                if (check.motivo) setPower(check.motivo)
                return
              }
              publicar(iniciarObra(sim.current, tool.current, x, z))
              tool.current = null
              setGhostObra(null)
              setFerramenta('')
              return
            }
            if (moverObraIdRef.current !== null) {
              const idMover = moverObraIdRef.current
              const obraAlvo = sim.current.obras.find((o) => o.id === idMover && o.hp > 0 && o.lado !== 'inimigo')
              if (!obraAlvo) {
                moverObraIdRef.current = null
                setGhostObra(null)
                setFerramenta('')
                return
              }
              const check = podeMoverObraEm(sim.current, idMover, x, z, { exigirRevelado: true })
              if (!check.ok) {
                if (check.motivo) setPower(check.motivo)
                return
              }
              publicar(moverObra(sim.current, idMover, x, z, { exigirRevelado: true }))
              moverObraIdRef.current = null
              setGhostObra(null)
              setFerramenta('')
              setPower(`${META_INTENCOES[obraAlvo.tipo].titulo} movida`)
              return
            }
            if (modoMoverTouchRef.current) {
              executarOrdemChao(x, z)
              setModoMoverTouch(false)
              return
            }
            const proxima = selecionarAoClicarChaoVazio({ heroi: heroiEscolhido, tropas: selected.current }, false)
            definirSelecao(proxima.tropas)
            setHeroiEscolhido(proxima.heroi)
            evoluirId.current = null
            setFerramenta('')
            setIntencao(null)
          }}
          onGroundOrder={(x, z) => {
            if (
              !podeComandar() ||
              modoBlocoRef.current ||
              modoLinhaRef.current ||
              modoConsagrarRef.current ||
              tool.current ||
              moverObraIdRef.current !== null
            ) {
              return
            }
            executarOrdemChao(x, z)
          }}
          onUnit={(id, lado, shiftKey) => {
            if (
              !podeComandar() ||
              modoBlocoRef.current ||
              modoLinhaRef.current ||
              modoConsagrarRef.current ||
              moverObraIdRef.current !== null
            ) {
              return
            }
            const unidade = sim.current.unidades.find((item) => item.id === id)
            if (!unidade || unidade.hp <= 0 || (lado === 'inimigo' && !inimigoVisivel(sim.current, unidade))) return
            if (lado === 'aliado') {
              const proxima = selecionarAoClicarUnidade({ heroi: heroiEscolhido, tropas: selected.current }, id, Boolean(shiftKey))
              setHeroiEscolhido(proxima.heroi)
              setModoMoverTouch(false)
              evoluirId.current = null
              definirSelecao(proxima.tropas)
              setFerramenta(`${proxima.tropas.length} ${proxima.tropas.length === 1 ? 'selecionado' : 'selecionados'}`)
              return
            }
            if (selected.current.length > 0) {
              publicar(ordenar(sim.current, selected.current, { tipo: 'atacar', alvoId: id }))
            }
            if (heroiEscolhido && !sim.current.semCorpo) {
              publicar(ordenarHeroi(sim.current, { tipo: 'atacar', alvoId: id }))
            }
          }}
          onObra={(id) => {
            if (moverObraIdRef.current !== null) return
            const obra = sim.current.obras.find((item) => item.id === id)
            if (!obra || obra.hp <= 0) return
            if (obra.lado !== 'inimigo') {
              if (modoBlocoRef.current || modoLinhaRef.current || modoConsagrarRef.current) return
              // Partida encerrada: a tela de derrota manda. Painel interativo por cima dela evolui obra de partida
              // que já acabou (OBS-F2-1). A mesma regra do efeito, do Enter e do JSX, com a derrota do corpo.
              if (!painelValido(id, sim.current.obras, estadoCorpo(atlasRef.current).derrota)) return
              evoluirId.current = id
              painelObraRef.current = id
              setPainelObraId(id)
              setConfirmarVendaId(null)
              setFerramenta(`${META_INTENCOES[obra.tipo].titulo} (Nv. ${obra.nivel})`)
              // O painel tem botões: com o mouse preso no canvas (pointer lock) o jogador não alcança nenhum (F2-D5).
              document.exitPointerLock?.()
              return
            }
            if (!podeComandar() || modoBlocoRef.current || modoLinhaRef.current || modoConsagrarRef.current) return
            if (selected.current.length === 0 && (!heroiEscolhido || sim.current.semCorpo)) return
            let atual = sim.current
            if (heroiEscolhido && !atual.semCorpo) atual = ordenarHeroi(atual, { tipo: 'atacarObra', obraId: obra.id })
            if (selected.current.length > 0) atual = ordenar(atual, selected.current, { tipo: 'atacarObra', obraId: obra.id })
            publicar(atual)
          }}
          onRect={(x0, z0, x1, z1, shiftKey) => {
            if (!podeComandar() || modoBlocoRef.current || moverObraIdRef.current !== null) return
            const proxima = selecionarPorRetanguloEstado(
              sim.current,
              { heroi: heroiEscolhido, tropas: selected.current },
              x0,
              z0,
              x1,
              z1,
              Boolean(shiftKey),
            )
            setModoMoverTouch(false)
            evoluirId.current = null
            definirSelecao(proxima.tropas)
            setHeroiEscolhido(proxima.heroi)
            setFerramenta(`${proxima.tropas.length} no retângulo`)
          }}
          onCaixa={setCaixa}
          onHeroi={(shiftKey) => {
            if (!podeComandar() || sim.current.semCorpo || modoBlocoRef.current || moverObraIdRef.current !== null) return
            const proxima = selecionarAoClicarHeroi({ heroi: heroiEscolhido, tropas: selected.current }, Boolean(shiftKey))
            setModoMoverTouch(false)
            evoluirId.current = null
            definirSelecao(proxima.tropas)
            setHeroiEscolhido(proxima.heroi)
            setFerramenta(proxima.heroi ? 'Herói' : '')
          }}
          heroiEscolhido={heroiEscolhido}
          atlas={atlasRef}
          mapa={`${atlasRef.current.cenaI},${atlasRef.current.cenaJ}`}
          onQuadro={(texto) => {
            const indice = `${atlasRef.current.cenaI},${atlasRef.current.cenaJ}`
            if (mapaInteracao.current !== indice) {
              mapaInteracao.current = indice
              limparInteracao(!sim.current.semCorpo)
              setHud(sim.current)
            }
            if (texto === quadro.current) return
            quadro.current = texto
            setMapaTick((valor) => valor + 1)
          }}
        />
      </Canvas>
      <div className="ilha-hud">
        <div className="ilha-barra">
          <button
            type="button"
            className={!hud.semCorpo && hud.olhar === 'primeira' ? 'ativo' : undefined}
            aria-pressed={!hud.semCorpo && hud.olhar === 'primeira'}
            data-testid="ilha-olhar-primeira"
            onClick={() => irParaOlhar('primeira')}
          >
            Primeira
          </button>
          <button
            type="button"
            className={!hud.semCorpo && hud.olhar === 'terceira' ? 'ativo' : undefined}
            aria-pressed={!hud.semCorpo && hud.olhar === 'terceira'}
            data-testid="ilha-olhar-terceira"
            onClick={() => irParaOlhar('terceira')}
          >
            Terceira
          </button>
          <button
            type="button"
            className={hud.semCorpo || hud.olhar === 'imperio' ? 'ativo' : undefined}
            aria-pressed={hud.semCorpo || hud.olhar === 'imperio'}
            data-testid="ilha-olhar-imperio"
            onClick={() => irParaOlhar('imperio')}
          >
            Império
          </button>
          <span className={hud.semCorpo ? 'ilha-obs-sem-corpo' : undefined} data-testid="ilha-olhar">
            {hud.semCorpo ? 'Observando · Império' : olharNome(hud.olhar)}
          </span>
        </div>
        <SeloDeVida vida={corpoAtual.heroi.army} />
        {/* O STATUS DA BASE virou uma lista VERTICAL que abre ao clicar (pedido do usuário, 23/11: «o status dos seus edifícios não é pra ficar mostrando horizontalmente [...] um filtro vertical que ao clicar aparece as suas
            construções e o que você quer evoluir»). A linha horizontal antiga («Núcleo nível 1 · vida · tropas · ... · Torre Nv. 1 · Quartel Nv. 1 ...») cortava o que passava de ~900 px; os avisos dela (sem caminho, núcleo inimigo
            destruído, dragão, obra frágil, «Leva em Xs») continuam, agora no topo do painel aberto. A lógica é de `listaDeConstrucoes.ts`; o preço e o ganho de cada nível, de `evolucaoObra.ts`. */}
        <PainelDeConstrucoes
          obras={hud.obras}
          recursos={{ credito: hud.credito, madeira: hud.madeira, ouro: hud.ouro }}
          resumo={{
            tropas: tropasVivas.length,
            emOrdens,
            emVigia,
            levaEm:
              nucleoQualquer && nucleoQualquer.hp > 0 && hud.obras.some((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo' && obra.hp > 0)
                ? PARTIDA.ondaPeriodo - hud.ondaRelogio
                : null,
            dragao: Boolean(dragaoVivo),
            semCaminho: hud.unidades.some((unidade) => unidade.rota?.semCaminho),
            nucleoInimigoCaiu: hud.obras.some((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0),
          }}
          aoEvoluir={(id) => {
            const antes = sim.current.obras.find((obra) => obra.id === id)
            const prox = evoluir(sim.current, id)
            publicar(prox)
            const depois = prox.obras.find((obra) => obra.id === id)
            if (antes && depois && depois.nivel > antes.nivel) {
              setFerramenta(`${META_INTENCOES[depois.tipo].titulo} (Nv. ${depois.nivel})`)
              setPower(`${META_INTENCOES[depois.tipo].titulo} evoluiu para Nv. ${depois.nivel}!`)
            } else {
              setPower(motivoDeNaoEvoluir(sim.current, id))
            }
          }}
        />
        <div className="ilha-enemies" data-testid="ilha-recursos">
          Licenças {hud.credito} · Madeira {hud.madeira} · Ouro {hud.ouro}
          {hud.lingotes > 0 ? ` · Lingotes ${hud.lingotes} resto ${hud.resto}` : ''}
          {hud.heroi.carregandoKg > 0 ? ` · Pedra ${hud.heroi.carregandoKg} kg` : ''}
          {noSubsoloHud ? ' · Subsolo' : ''}
          {modoBloco ? ` · Blocos (${modoBloco} · ${SPEC_BLOCO_MATERIAL[materialBloco].nome})` : ''}
          {modoLinhaBlocos ? ` · Linha 360° (${alturaLinha}b · ${SPEC_BLOCO_MATERIAL[materialBloco].nome})` : ''}
          {modoConsagrar ? ` · Consagrar (${modoConsagrar})` : ''}
        </div>
        <div className="ilha-compass" data-testid="ilha-bussola">
          {tatico ? bussolaImperio : compassLetter(hud.heroi.yaw)}
        </div>
        {!tatico && <div className={miraAlvo ? 'ilha-mira alvo' : 'ilha-mira'} data-testid="ilha-mira" />}
        {!tatico && !derrotado && (
          <div className="ilha-acoes-campo" data-testid="ilha-acoes-campo">
            {(temMinaPronta || noSubsoloHud) && (
              <button
                type="button"
                className={noSubsoloHud || intencao === 'subsolo' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-subsolo"
                aria-label={META_INTENCOES.subsolo.titulo}
                onClick={() => setIntencao('subsolo')}
              >
                <IconeSvg id="subsolo" size={18} />
              </button>
            )}
            <button
              type="button"
              className={painelBlocosAberto || intencao === 'editarBlocos' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
              data-testid="ilha-editar-blocos"
              aria-label={META_INTENCOES.editarBlocos.titulo}
              onClick={() => setIntencao('editarBlocos')}
            >
              <IconeSvg id="editarBlocos" size={18} />
            </button>
            {painelBlocosAberto && (
              <>
                <button
                  type="button"
                  className={modoBloco === 'adicionar' || intencao === 'blocoAdicionar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid="ilha-bloco-adicionar"
                  aria-label={META_INTENCOES.blocoAdicionar.titulo}
                  onClick={() => setIntencao('blocoAdicionar')}
                >
                  <IconeSvg id="blocoAdicionar" size={18} />
                </button>
                <button
                  type="button"
                  className={modoBloco === 'remover' || intencao === 'blocoRemover' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid="ilha-bloco-remover"
                  aria-label={META_INTENCOES.blocoRemover.titulo}
                  onClick={() => setIntencao('blocoRemover')}
                >
                  <IconeSvg id="blocoRemover" size={18} />
                </button>
                <div className="ilha-subbarra-inline" data-testid="ilha-mat-campo">
                  {(['madeira', 'pedra', 'ouro'] as const).map((mat) => (
                    <button
                      key={mat}
                      type="button"
                      className={materialBloco === mat ? 'ilha-chip ativo' : 'ilha-chip'}
                      data-testid={`ilha-mat-${mat}`}
                      aria-label={`Material ${SPEC_BLOCO_MATERIAL[mat].nome}`}
                      onClick={() => {
                        materialBlocoRef.current = mat
                        setMaterialBloco(mat)
                      }}
                    >
                      {mat === 'madeira' ? 'Mad' : mat === 'pedra' ? 'Ped' : 'Our'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {tatico && !derrotado && (
          <div className="ilha-ferramentas" data-testid="ilha-ferramentas">
            <div className="ilha-ferramentas-grade">
              {(['nucleo', 'torre', 'portao', 'quartel', 'britador', 'serraria', 'mina'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={tool.current === id || intencao === id ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid={`ilha-construir-${id}`}
                  aria-label={META_INTENCOES[id].titulo}
                  onClick={() => setIntencao(id)}
                >
                  <IconeSvg id={id} size={18} />
                </button>
              ))}
              <button
                type="button"
                className={intencao === 'evoluir' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-evoluir"
                aria-label={META_INTENCOES.evoluir.titulo}
                onClick={() => setIntencao('evoluir')}
              >
                <IconeSvg id="evoluir" size={18} />
              </button>
              <button
                type="button"
                className={intencao === 'tropa' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-tropa"
                aria-label={META_INTENCOES.tropa.titulo}
                onClick={() => setIntencao('tropa')}
              >
                <IconeSvg id="tropa" size={18} />
              </button>
              <button
                type="button"
                className={intencao === 'todas' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-todas"
                aria-label={META_INTENCOES.todas.titulo}
                onClick={() => setIntencao('todas')}
              >
                <IconeSvg id="todas" size={18} />
              </button>
              <button
                type="button"
                className={intencao === 'atacar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-atacar"
                aria-label={META_INTENCOES.atacar.titulo}
                onClick={() => setIntencao('atacar')}
              >
                <IconeSvg id="atacar" size={18} />
              </button>
              <button
                type="button"
                className={posturaMarcada('vigia') ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-automatico"
                aria-label="Vigia"
                aria-pressed={posturaMarcada('vigia')}
                onClick={() => aplicarPostura('vigia')}
              >
                <IconeSvg id="automatico" size={18} />
              </button>
              <button
                type="button"
                className={posturaMarcada('noLugar') ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-postura-no-lugar"
                aria-label="No lugar"
                aria-pressed={posturaMarcada('noLugar')}
                onClick={() => aplicarPostura('noLugar')}
              >
                <IconeSvg id="desmarcar" size={18} />
              </button>
              <button
                type="button"
                className={posturaMarcada('calado') ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-postura-calado"
                aria-label="Calado"
                aria-pressed={posturaMarcada('calado')}
                onClick={() => aplicarPostura('calado')}
              >
                <IconeSvg id="cancelar" size={18} />
              </button>
              {(temMinaPronta || noSubsoloHud) && (
                <button
                  type="button"
                  className={noSubsoloHud || intencao === 'subsolo' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid="ilha-subsolo"
                  aria-label={META_INTENCOES.subsolo.titulo}
                  onClick={() => setIntencao('subsolo')}
                >
                  <IconeSvg id="subsolo" size={18} />
                </button>
              )}
              <button
                type="button"
                className={painelBlocosAberto || intencao === 'editarBlocos' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-editar-blocos"
                aria-label={META_INTENCOES.editarBlocos.titulo}
                onClick={() => setIntencao('editarBlocos')}
              >
                <IconeSvg id="editarBlocos" size={18} />
              </button>
              <button
                type="button"
                className={modoLinhaBlocos || intencao === 'muralhaLinha' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-muralha-linha"
                aria-label={META_INTENCOES.muralhaLinha.titulo}
                onClick={() => setIntencao('muralhaLinha')}
              >
                <IconeSvg id="muralhaLinha" size={18} />
              </button>
              <button
                type="button"
                className={Boolean(modoConsagrar) || intencao === 'consagrar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                data-testid="ilha-consagrar"
                aria-label={META_INTENCOES.consagrar.titulo}
                onClick={() => setIntencao('consagrar')}
              >
                <IconeSvg id="consagrar" size={18} />
              </button>
              {painelBlocosAberto && (
                <>
                  <button
                    type="button"
                    className={modoBloco === 'adicionar' || intencao === 'blocoAdicionar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                    data-testid="ilha-bloco-adicionar"
                    aria-label={META_INTENCOES.blocoAdicionar.titulo}
                    onClick={() => setIntencao('blocoAdicionar')}
                  >
                    <IconeSvg id="blocoAdicionar" size={18} />
                  </button>
                  <button
                    type="button"
                    className={modoBloco === 'remover' || intencao === 'blocoRemover' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                    data-testid="ilha-bloco-remover"
                    aria-label={META_INTENCOES.blocoRemover.titulo}
                    onClick={() => setIntencao('blocoRemover')}
                  >
                    <IconeSvg id="blocoRemover" size={18} />
                  </button>
                </>
              )}
              {ruinaNossa && (
                <button
                  type="button"
                  className={intencao === 'reparar' ? 'ilha-icone-btn ativo' : 'ilha-icone-btn'}
                  data-testid="ilha-reparar"
                  aria-label={META_INTENCOES.reparar.titulo}
                  onClick={() => setIntencao('reparar')}
                >
                  <IconeSvg id="reparar" size={18} />
                </button>
              )}
            </div>
            {(painelBlocosAberto || modoLinhaBlocos) && (
              <div className="ilha-subbarra" data-testid="ilha-subbarra-blocos">
                {(['madeira', 'pedra', 'ouro'] as const).map((mat) => (
                  <button
                    key={mat}
                    type="button"
                    className={materialBloco === mat ? 'ilha-chip ativo' : 'ilha-chip'}
                    data-testid={`ilha-mat-${mat}`}
                    aria-label={`Material ${SPEC_BLOCO_MATERIAL[mat].nome}`}
                    onClick={() => {
                      materialBlocoRef.current = mat
                      setMaterialBloco(mat)
                      if (modoLinhaRef.current) {
                        setFerramenta(`Linha 360° (${alturaLinhaRef.current}b · ${SPEC_BLOCO_MATERIAL[mat].nome})`)
                      } else if (modoBlocoRef.current === 'adicionar') {
                        setFerramenta(`Modo Bloco: Adicionar (${SPEC_BLOCO_MATERIAL[mat].nome})`)
                      }
                    }}
                  >
                    {SPEC_BLOCO_MATERIAL[mat].nome}
                  </button>
                ))}
                {modoLinhaBlocos &&
                  ([1, 2, 3] as const).map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      className={alturaLinha === alt ? 'ilha-chip ativo' : 'ilha-chip'}
                      data-testid={`ilha-linha-alt-${alt}`}
                      aria-label={`Altura ${alt} ${alt === 1 ? 'bloco' : 'blocos'}`}
                      onClick={() => {
                        alturaLinhaRef.current = alt
                        setAlturaLinha(alt)
                        setFerramenta(`Linha 360° (${alt}b · ${SPEC_BLOCO_MATERIAL[materialBlocoRef.current].nome})`)
                      }}
                    >
                      {alt === 1 ? '1b Trinch' : alt === 2 ? '2b Muralha' : '3b Alta'}
                    </button>
                  ))}
              </div>
            )}
            {modoConsagrar && (
              <div className="ilha-subbarra" data-testid="ilha-subbarra-consagrar">
                {(
                  [
                    ['nucleo', 'Núcleo'],
                    ['torre', 'Torre'],
                    ['quartel', 'Quartel'],
                    ['portao', 'Portão'],
                    ['britador', 'Britador'],
                    ['serraria', 'Serraria'],
                    ['mina', 'Mina'],
                  ] as const
                ).map(([peca, rotulo]) => (
                  <button
                    key={peca}
                    type="button"
                    className={modoConsagrar === peca ? 'ilha-chip ativo' : 'ilha-chip'}
                    data-testid={`ilha-consagrar-tipo-${peca}`}
                    onClick={() => {
                      modoConsagrarRef.current = peca
                      setModoConsagrar(peca)
                    }}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            )}
            <p>
              {previewLinha
                ? `Linha: ${previewLinha.plano.celulas.length} blocos · Custo ${previewLinha.plano.custoTotal} ${SPEC_BLOCO_MATERIAL[previewLinha.plano.material].nome}${previewLinha.temRecurso ? '' : ' (insuficiente)'}`
                : ferramenta || 'Toque num ícone para ver a descrição e confirmar.'}
            </p>
          </div>
        )}
        {derrotado ? (
          <>
            <div className="ilha-fim">
              {corpoAtual.obras.some((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0) ? 'A base caiu.' : 'O herói caiu.'}
            </div>
            <button
              type="button"
              className="ilha-continuar"
              onClick={() => {
                atlasRef.current = criarAtlas()
                sim.current = estadoCena(atlasRef.current)
                limparInteracao()
                publicar(sim.current)
                setPower('')
                contaAtivaRef.current = null
                setContaAtiva(null)
                ativarTelaEstudo('jogo')
              }}
            >
              Tentar de novo
            </button>
          </>
        ) : (
          PARTIDA.atlas !== 'grade' && hud.ruaPercorrida && (
            <>
              <div className="ilha-fim" data-testid="ilha-fim">
                A rua acabou.
              </div>
              <button
                type="button"
                className="ilha-continuar"
                onClick={() => publicar(continuarNaRua(sim.current))}
              >
                Continuar na rua
              </button>
            </>
          )
        )}
        {temSelecaoAtiva && !modoBloco && !modoLinhaBlocos && !modoConsagrar && (
          <div className="ilha-selecao-barra" data-testid="ilha-selecao-barra">
            <span data-testid="ilha-selecao-texto">{textoSelecao}</span>
            <button
              type="button"
              className={modoMoverTouch ? 'ativo' : undefined}
              aria-pressed={modoMoverTouch}
              data-testid="ilha-mover-aqui"
              onClick={() => setModoMoverTouch((valor) => !valor)}
            >
              <IconeSvg id="moverAqui" size={15} />
              {modoMoverTouch ? 'Toque no chão' : 'Mover'}
            </button>
            <button
              type="button"
              className="ilha-selecao-limpar"
              data-testid="ilha-desmarcar"
              onClick={() => limparSelecao()}
            >
              <IconeSvg id="desmarcar" size={15} />
              Limpar
            </button>
          </div>
        )}
        {!tatico && (
          <>
            <button
              type="button"
              className="ilha-pular"
              data-testid="ilha-pular"
              onPointerDown={(event) => {
                event.stopPropagation()
                event.preventDefault()
                publicar(pular(sim.current))
              }}
              onClick={(event) => {
                // Teclado (Enter ou Espaço no botão focado): `detail` é 0. Mouse e toque já pularam no pointerdown.
                if (event.detail === 0) publicar(pular(sim.current))
              }}
            >
              Pular
            </button>
            <button
              type="button"
              className="ilha-atirar"
              data-testid={modoBloco ? 'ilha-bloco-acao' : 'ilha-atirar'}
              onPointerDown={(event) => {
                event.stopPropagation()
                event.preventDefault()
                if (sim.current.derrota || sim.current.olhar === 'imperio' || sim.current.semCorpo) return
                if (modoBlocoRef.current) {
                  aplicarEdicaoVoxelRef.current()
                  return
                }
                segurandoTiro.current = true
                tiroPonteiro.current = event.pointerId
                publicar(atirar(sim.current))
              }}
              onPointerUp={(event) => {
                if (tiroPonteiro.current === event.pointerId) {
                  segurandoTiro.current = false
                  tiroPonteiro.current = null
                }
              }}
              onPointerCancel={(event) => {
                if (tiroPonteiro.current === event.pointerId) {
                  segurandoTiro.current = false
                  tiroPonteiro.current = null
                }
              }}
              onClick={(event) => {
                // Teclado (Enter ou Espaço no botão focado): `detail` é 0. Mouse e toque já agiram no pointerdown.
                if (event.detail !== 0) return
                if (sim.current.derrota || sim.current.olhar === 'imperio' || sim.current.semCorpo) return
                if (modoBlocoRef.current) {
                  aplicarEdicaoVoxelRef.current()
                  return
                }
                publicar(atirar(sim.current))
              }}
            >
              {modoBloco === 'adicionar' ? 'Pôr' : modoBloco === 'remover' ? 'Tirar' : 'Atirar'}
            </button>
          </>
        )}
        <div className="ilha-conta-atalhos">
          <button
            type="button"
            className="ilha-abrir-caderno"
            data-testid="ilha-abrir-caderno"
            onClick={() => alternarCadernoRef.current()}
          >
            {diagnostico.ondePrecisaAjuda.length > 0 ? (
              <>
                Caderno ({diagnostico.ondePrecisaAjuda.length})
              </>
            ) : (
              <>
                Caderno<span className="ilha-atalho-tecla"> (G)</span>
              </>
            )}
          </button>
          {!derrotado && !hud.semCorpo && (
            contaAtiva && !contaAtiva.resolvida && telaEstudo === 'jogo' ? (
              <button
                type="button"
                className="ilha-voltar-conta"
                data-testid="ilha-voltar-conta"
                onClick={() => ativarTelaEstudo('conta')}
              >
                Voltar à conta<span className="ilha-atalho-tecla"> (Q)</span>
              </button>
            ) : (
              <button
                type="button"
                className="ilha-conta"
                data-testid="ilha-btn-conta"
                onClick={() => openConta(tier)}
              >
                Fazer conta<span className="ilha-atalho-tecla"> (Q)</span>
              </button>
            )
          )}
        </div>
        {!tatico && (
          <div
            className="ilha-olhar"
            onPointerDown={(event) => {
              event.stopPropagation()
              lookDrag.current = { x: event.clientX, y: event.clientY }
              lookPonteiro.current = event.pointerId
            }}
          >
            Olhar
          </div>
        )}
        {tatico && !derrotado && (
          <div className="ilha-imperio-rotacao" role="group" aria-label="Girar câmera do império">
            <button
              type="button"
              data-testid="ilha-cam-girar-esq"
              title="Girar câmera para a esquerda (Z)"
              aria-label="Girar câmera para a esquerda"
              onPointerDown={() => {
                rotacaoBotaoRef.current = -1
                rotacaoHoldInicioRef.current = performance.now()
              }}
              onPointerUp={() => {
                rotacaoBotaoRef.current = 0
              }}
              onPointerLeave={() => {
                rotacaoBotaoRef.current = 0
              }}
              onPointerCancel={() => {
                rotacaoBotaoRef.current = 0
              }}
              onClick={(event) => {
                if (event.detail === 0 || performance.now() - rotacaoHoldInicioRef.current < 180) {
                  cam.current = {
                    ...cam.current,
                    yaw: normalizarYaw(cam.current.yaw - CAMERA_IMPERIO.passoCliqueRad),
                  }
                }
                rotacaoHoldInicioRef.current = 0
              }}
            >
              ↺
            </button>
            <button
              type="button"
              data-testid="ilha-cam-reset-rot"
              title="Alinhar câmera para o Norte (R)"
              aria-label="Alinhar câmera para o Norte"
              onClick={() => {
                cam.current = { ...cam.current, yaw: 0 }
              }}
            >
              0°
            </button>
            <button
              type="button"
              data-testid="ilha-cam-girar-dir"
              title="Girar câmera para a direita (C ou E)"
              aria-label="Girar câmera para a direita"
              onPointerDown={() => {
                rotacaoBotaoRef.current = 1
                rotacaoHoldInicioRef.current = performance.now()
              }}
              onPointerUp={() => {
                rotacaoBotaoRef.current = 0
              }}
              onPointerLeave={() => {
                rotacaoBotaoRef.current = 0
              }}
              onPointerCancel={() => {
                rotacaoBotaoRef.current = 0
              }}
              onClick={(event) => {
                if (event.detail === 0 || performance.now() - rotacaoHoldInicioRef.current < 180) {
                  cam.current = {
                    ...cam.current,
                    yaw: normalizarYaw(cam.current.yaw + CAMERA_IMPERIO.passoCliqueRad),
                  }
                }
                rotacaoHoldInicioRef.current = 0
              }}
            >
              ↻
            </button>
          </div>
        )}
        <div className="ilha-joystick" ref={stickEl} data-testid="ilha-joystick">
          <span ref={knobEl} />
        </div>
      </div>
      {obraPainel &&
        (() => {
          const reembolsoPainel = obraPainel.tipo !== 'nucleo' ? calcularReembolsoVenda(hud, obraPainel.id) : null
          const partesReembolso = reembolsoPainel
            ? [
                reembolsoPainel.madeira > 0 ? `${reembolsoPainel.madeira} mad` : '',
                reembolsoPainel.ouro > 0 ? `${reembolsoPainel.ouro} ouro` : '',
              ].filter(Boolean)
            : []
          const textoReembolso = partesReembolso.join(' + ')
          const confirmandoVenda = confirmarVendaId === obraPainel.id
          return (
            <div
              className="ilha-painel-obra"
              data-testid="ilha-painel-obra"
              role="dialog"
              aria-label={META_INTENCOES[obraPainel.tipo].titulo}
            >
              <strong data-testid="ilha-painel-titulo">
                {META_INTENCOES[obraPainel.tipo].titulo} (Nv. {obraPainel.nivel})
              </strong>
              {obraPainel.nivel < PARTIDA.nivelMaximoObra ? (
                <>
                  <p data-testid="ilha-painel-preco">Evoluir custa {precoDeEvoluirNoNivel(obraPainel.nivel)}.</p>
                  <p data-testid="ilha-painel-ganho">Ao evoluir: {descricaoDaEvolucao(obraPainel.tipo, obraPainel.nivel)}.</p>
                </>
              ) : (
                <p data-testid="ilha-painel-preco">Nível máximo.</p>
              )}
              <div className="ilha-painel-acoes">
                <button type="button" data-testid="ilha-painel-evoluir" onClick={evoluirDoPainel}>
                  Evoluir
                </button>
                <button
                  type="button"
                  data-testid="ilha-painel-blocos"
                  onClick={() => {
                    // Entrar no editor solta a ferramenta de fundação armada, como o Esc faz: com `tool.current` vivo o próximo
                    // clique no chão tentava FUNDAR a obra em vez de editar bloco (OBS-F2-3, lido no ref: 'mina' sobrevive
                    // ao painel e a «Editar blocos»).
                    tool.current = null
                    moverObraIdRef.current = null
                    setConfirmarVendaId(null)
                    setGhostObra(null)
                    setPreviewLinha(null)
                    setFerramenta('')
                    obraBlocoAlvoIdRef.current = obraPainel.id
                    modoLinhaRef.current = false
                    setModoLinhaBlocos(false)
                    modoConsagrarRef.current = null
                    setModoConsagrar(null)
                    modoBlocoRef.current = 'adicionar'
                    setModoBloco('adicionar')
                    setPainelBlocosAberto(true)
                  }}
                >
                  Editar blocos
                </button>
                {obraPainel.tipo !== 'nucleo' && (
                  <>
                    <button
                      type="button"
                      data-testid="ilha-painel-mover"
                      onClick={() => {
                        if (obraEmConstrucao(obraPainel)) {
                          setPower('Aguarde concluir a construção antes de mover')
                          return
                        }
                        painelObraRef.current = null
                        obraBlocoAlvoIdRef.current = null
                        setPainelObraId(null)
                        setConfirmarVendaId(null)
                        tool.current = null
                        modoBlocoRef.current = null
                        setModoBloco(null)
                        modoLinhaRef.current = false
                        setModoLinhaBlocos(false)
                        modoConsagrarRef.current = null
                        setModoConsagrar(null)
                        setGhostBloco(null)
                        setPreviewLinha(null)
                        moverObraIdRef.current = obraPainel.id
                        publicar(definirOlhar(sim.current, 'imperio'))
                        document.exitPointerLock?.()
                        setFerramenta(`Mover ${META_INTENCOES[obraPainel.tipo].titulo} · clique no chão`)
                        setPower('Clique em um terreno livre para mover (Esc cancela)')
                      }}
                    >
                      Mover
                    </button>
                    <button
                      type="button"
                      data-testid="ilha-painel-vender"
                      className={confirmandoVenda ? 'ilha-painel-perigo' : undefined}
                      onClick={() => {
                        if (confirmarVendaId !== obraPainel.id) {
                          setConfirmarVendaId(obraPainel.id)
                          return
                        }
                        const check = podeVenderObra(sim.current, obraPainel.id)
                        if (!check.ok) {
                          setPower(check.motivo ?? 'Não é possível vender esta construção')
                          setConfirmarVendaId(null)
                          return
                        }
                        const prox = venderObra(sim.current, obraPainel.id)
                        publicar(prox)
                        painelObraRef.current = null
                        obraBlocoAlvoIdRef.current = null
                        setPainelObraId(null)
                        setConfirmarVendaId(null)
                        setFerramenta('')
                        const ganhoPartes = [
                          check.reembolso && check.reembolso.madeira > 0 ? `+${check.reembolso.madeira} madeira` : '',
                          check.reembolso && check.reembolso.ouro > 0 ? `+${check.reembolso.ouro} ouro` : '',
                        ].filter(Boolean)
                        const titulo = META_INTENCOES[obraPainel.tipo].titulo
                        setPower(ganhoPartes.length > 0 ? `${titulo} vendida (${ganhoPartes.join(', ')})` : `${titulo} demolida`)
                      }}
                    >
                      {confirmandoVenda
                        ? 'Confirmar venda'
                        : textoReembolso
                          ? `Vender (${textoReembolso})`
                          : 'Vender (demolir)'}
                    </button>
                  </>
                )}
              </div>
              {obraPainel.tipo === 'nucleo' && (
                <p className="ilha-painel-nota">O Núcleo é fixo e não pode ser movido nem vendido.</p>
              )}
            </div>
          )
        })()}
      {intencao && (
        <div className="ilha-confirmar-card" data-testid="ilha-confirmar-card" role="dialog" aria-label={META_INTENCOES[intencao].titulo}>
          <div className="ilha-confirmar-topo">
            <span className="ilha-confirmar-selo">
              <IconeSvg id={intencao} size={22} />
            </span>
            <strong data-testid="ilha-confirmar-titulo">{META_INTENCOES[intencao].titulo}</strong>
          </div>
          <p className="ilha-confirmar-resumo">{META_INTENCOES[intencao].resumo}</p>
          <p className="ilha-confirmar-detalhe">{META_INTENCOES[intencao].detalhe}</p>
          <div className="ilha-confirmar-acoes">
            <button
              type="button"
              className="ilha-confirmar-nao"
              data-testid="ilha-confirmar-nao"
              onClick={() => setIntencao(null)}
            >
              <IconeSvg id="cancelar" size={15} />
              Cancelar
            </button>
            <button
              type="button"
              ref={confirmarSimRef}
              className="ilha-confirmar-sim"
              data-testid="ilha-confirmar-sim"
              onClick={() => confirmarIntencao(intencao)}
            >
              <IconeSvg id="confirmar" size={15} />
              Confirmar
            </button>
          </div>
        </div>
      )}
      {mapaTick >= 0 && (
        <div className="ilha-minimapa" data-testid="ilha-minimapa">
          <div className="ilha-mini-cabecalho">
            <button
              type="button"
              className={menuMiniAberto || intencao === 'menuMinimapas' ? 'ilha-icone-btn ilha-mini-btn ativo' : 'ilha-icone-btn ilha-mini-btn'}
              data-testid="ilha-menu-minimapas"
              aria-label={META_INTENCOES.menuMinimapas.titulo}
              onClick={(event) => {
                event.stopPropagation()
                setIntencao('menuMinimapas')
              }}
            >
              <IconeSvg id="menuMinimapas" size={16} />
            </button>
            {menuMiniAberto && (
              <div className="ilha-mini-modos" data-testid="ilha-minimapa-opcoes">
                {([
                  ['minimapaAtual', 'atual'],
                  ['minimapaAlguns', 'alguns'],
                  ['minimapaTodos', 'todos'],
                ] as const).map(([icone, modo]) => (
                  <button
                    key={icone}
                    type="button"
                    className={
                      atlasRef.current.politica === modo || intencao === icone
                        ? 'ilha-icone-btn ilha-mini-btn ativo'
                        : 'ilha-icone-btn ilha-mini-btn'
                    }
                    data-testid={`ilha-minimapa-${modo}`}
                    aria-label={META_INTENCOES[icone].titulo}
                    onClick={(event) => {
                      event.stopPropagation()
                      setIntencao(icone)
                    }}
                  >
                    <IconeSvg id={icone} size={15} />
                  </button>
                ))}
              </div>
            )}
            <span className="ilha-mini-status" data-testid="ilha-minimapa-status">
              {atlasRef.current.fichas.filter((f) => f.ritmo === 'cheio').length}/{atlasRef.current.fichas.length}
            </span>
          </div>
          <div className="ilha-mini-janela">
            <div className="ilha-mini-camada" ref={camadaMini}>
              {(() => {
                const atlasAgora = atlasRef.current
                const resumo = resumoAtlas(atlasAgora)
                const porChave = new Map(resumo.map((ficha) => [`${ficha.i},${ficha.j}`, ficha]))
                let minI = atlasAgora.heroiI - 2
                let maxI = atlasAgora.heroiI + 2
                let minJ = atlasAgora.heroiJ - 2
                let maxJ = atlasAgora.heroiJ + 2
                for (const ficha of resumo) {
                  minI = Math.min(minI, ficha.i)
                  maxI = Math.max(maxI, ficha.i)
                  minJ = Math.min(minJ, ficha.j)
                  maxJ = Math.max(maxJ, ficha.j)
                }
                minI = Math.min(minI, atlasAgora.cenaI)
                maxI = Math.max(maxI, atlasAgora.cenaI)
                minJ = Math.min(minJ, atlasAgora.cenaJ)
                maxJ = Math.max(maxJ, atlasAgora.cenaJ)
                const span = Math.max(maxI - minI + 1, maxJ - minJ + 1, 5)
                const escala = 168 / (span * PARTIDA.ladoMapa)
                miniEscala.current = escala
                const ladoPx = PARTIDA.ladoMapa * escala
                const quadrados = []
                for (let j = maxJ; j >= minJ; j -= 1) {
                  for (let i = minI; i <= maxI; i += 1) quadrados.push({ i, j, ficha: porChave.get(`${i},${j}`) })
                }
                return quadrados.map(({ i, j, ficha }) => (
                  <button
                    key={`${i}-${j}`}
                    type="button"
                    data-testid={`ilha-mapa-${i}-${j}`}
                    data-dono={ficha?.dono}
                    title={ficha ? `${i}, ${j}: ${TEXTO_DO_DONO[ficha.dono]}` : `${i}, ${j}`}
                    className={[
                      'ilha-mini-quadrado',
                      ficha ? `ilha-dono-${ficha.dono}` : 'ilha-mapa-vazio',
                      ficha?.ritmo === 'cheio' ? 'ilha-mapa-cheio' : '',
                      ficha?.corpo ? 'ilha-mapa-corpo' : '',
                      ficha?.cena ? 'ilha-mapa-vendo' : '',
                      ficha?.alerta === 'verde' ? 'ilha-alerta-verde' : '',
                      ficha?.alerta === 'vermelho' ? 'ilha-alerta-vermelho' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: i * PARTIDA.ladoMapa * escala - ladoPx / 2,
                      top: -(j * PARTIDA.ladoMapa * escala) - ladoPx / 2,
                      width: ladoPx,
                      height: ladoPx,
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      limparInteracao()
                      atlasRef.current = abrirMapa(atlasRef.current, i, j)
                      sim.current = estadoCena(atlasRef.current)
                      cam.current = { x: 0, z: 0, yaw: cam.current.yaw }
                      publicar(sim.current)
                    }}
                  />
                ))
              })()}
            </div>
            <div className="ilha-pipa" />
          </div>
          <button
            type="button"
            className="ilha-voltar"
            data-testid="ilha-voltar-corpo"
            onClick={(event) => {
              event.stopPropagation()
              limparInteracao()
              atlasRef.current = voltarAoCorpo(atlasRef.current)
              sim.current = estadoCena(atlasRef.current)
              cam.current = { x: sim.current.heroi.x, z: sim.current.heroi.z, yaw: 0 }
              publicar(sim.current)
            }}
          >
            Voltar ao corpo
          </button>
        </div>
      )}
      {caixa && (
        <div
          className="ilha-retangulo"
          style={{
            left: Math.min(caixa.x, caixa.x2),
            top: Math.min(caixa.y, caixa.y2),
            width: Math.abs(caixa.x2 - caixa.x),
            height: Math.abs(caixa.y2 - caixa.y),
          }}
        />
      )}
      {power && (
        <div className="ilha-power" data-testid="ilha-power">
          {power}
        </div>
      )}
      {telaEstudo === 'conta' && (
        <ModalConta
          desafio={contaAtiva?.desafio ?? null}
          grauSelecionado={tier}
          carregando={carregandoConta}
          erroCarregamento={erroCarregamentoConta}
          dicasAbertas={contaAtiva?.dicasAbertas ?? 0}
          erradasClicadas={contaAtiva?.erradasClicadas ?? []}
          diagnosticoAtual={contaAtiva?.diagnosticoAtual ?? ''}
          ultimoGanhoPt={contaAtiva?.ultimoGanhoPt}
          erros={contaAtiva?.erros ?? 0}
          resolvida={contaAtiva?.resolvida ?? false}
          temaTreinoAtivo={temaTreinoAtivo}
          onSelecionarGrau={(g) =>
            openConta(g, {
              temaPreferido: null,
              forcarNova: true,
              registrarAbandono: Boolean(
                contaAtivaRef.current && (contaAtivaRef.current.erros > 0 || contaAtivaRef.current.dicasAbertas > 0),
              ),
            })
          }
          onResponder={responderAlternativa}
          onPedirDica={pedirDica}
          onProximaQuestao={() =>
            openConta(tier, { temaPreferido: temaTreinoAtivo, forcarNova: true, registrarAbandono: false })
          }
          onTentarNovamente={() =>
            openConta(tier, { temaPreferido: temaTreinoAtivo, forcarNova: true, registrarAbandono: false })
          }
          onMinimizarJogo={() => ativarTelaEstudo('jogo')}
          onDesistirETrocar={desistirETrocar}
          onAbrirCaderno={() => alternarCadernoRef.current()}
          onLimparTemaTreino={() =>
            openConta(tier, { temaPreferido: null, forcarNova: true, registrarAbandono: false })
          }
        />
      )}
      {telaEstudo === 'caderno' && (
        <CadernoEstudoOverlay
          estadoEstudo={estadoEstudo}
          diagnostico={diagnostico}
          statusAcao={statusCaderno}
          onFechar={() => ativarTelaEstudo('jogo')}
          onTreinarTema={treinarTemaDoCaderno}
          onExportarJson={exportarDadosEstudo}
          onApagarTudo={apagarDadosEstudo}
        />
      )}
    </div>
  )
}
