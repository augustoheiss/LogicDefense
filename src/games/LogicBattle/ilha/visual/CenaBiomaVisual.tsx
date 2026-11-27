import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PARTIDA } from '../partidaPolicies'
import { riosDoQuadrado } from '../relevo/aguaDoMundo'
import type { CampoRelevo } from '../relevo/campoRelevo'
import { chaoDaMalha } from '../relevo/chaoDaMalha'
import { alturaDeBaseDoMundo } from '../relevo/geradorRelevo'
import { passoDaMalha } from '../relevo/geometriaDoTerreno'
import type { PartidaState } from '../partidaSim'
import { AguaBiomaShader } from './AguaBiomaShader'
import { AtmosferaBioma } from './AtmosferaBioma'
import { type AmbienteGpu, gerarAmbientePmrem } from './ambientePmrem'
import { ambienteDeveExistir, chaveDoAmbiente } from './ceuEIbl'
import { CicloDePacote } from './cicloDePacote'
import { anisotropiaEfetiva } from './decisaoPosProcessamento'
import { HorizonteRelevo } from './HorizonteRelevo'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import { PropsBiomaInstanced } from './PropsBiomaInstanced'
import { BiomeGpuAssetPool } from './recursoGpuPool'
import { paisagemNaturalVisivel } from './suporteFundacao'
import { TerrenoBiomaCena } from './TerrenoBiomaCena'
import { TerrenoRelevoCena } from './TerrenoRelevoCena'
import {
  defaultBiomaTextureProvider,
  type PacoteTexturasBioma,
  type PacoteTexturasBlocos,
} from './texturasPbrProcedural'

export interface PerfSnapshotLogicBattle {
  calls: number
  triangles: number
  textures: number
  geometries: number
  poolAtivos: number
  poolEvictados: number
  poolDescartados: number
  bioma: string
  qualidade: string
  fichasVivas: number
  cartografiaTotal: number
}

declare global {
  interface Window {
    __LOGICBATTLE_PERF__?: PerfSnapshotLogicBattle
  }
}

export interface CenaBiomaVisualProps {
  readonly state: PartidaState
  readonly mapaI: number
  readonly mapaJ: number
  readonly focoX: number
  readonly focoZ: number
  readonly spec: SpecQualidadeGrafica
  readonly fichasVivas: number
  readonly cartografiaTotal: number
  readonly onBlocosTexturasProntas?: (blocos: PacoteTexturasBlocos | null) => void
  /**
   * O campo de relevo PRONTO deste quadrado (F2, 25/11/2026), ou `undefined`: a chave `PARTIDA.relevo.visual` desligada, ou a geração fatiada ainda não terminou (~19 quadros). Quem o entrega é o
   * `RelevoDoMundo` que mora em `Cena` (`IlhaRua`): aqui só se DESENHA. `undefined` = o chão plano de hoje (I1).
   */
  readonly campoDoRelevo?: CampoRelevo
  /**
   * As uniforms da NÉVOA pintada, PUBLICADAS pela `NevoaPintada` (a REF é preenchida quando ela monta, DEPOIS desta cena: no 1º compile pode ser `null`). O chão com relevo as copia a cada quadro para
   * injetar a mesma névoa no próprio shader. Opcional: a cena de antes (sem relevo) não passa e nada muda (I1).
   */
  readonly nevoaUniforms?: React.MutableRefObject<Record<string, { value: unknown }> | null>
  readonly onPointerDownGround: (event: ThreeEvent<PointerEvent>) => void
  readonly onClickGround: (event: ThreeEvent<MouseEvent>) => void
}

export const CenaBiomaVisual: React.FC<CenaBiomaVisualProps> = ({
  state,
  mapaI,
  mapaJ,
  focoX,
  focoZ,
  spec,
  fichasVivas,
  cartografiaTotal,
  onBlocosTexturasProntas,
  campoDoRelevo,
  nevoaUniforms,
  onPointerDownGround,
  onClickGround,
}) => {
  const { gl, scene } = useThree()
  const poolRef = useRef<BiomeGpuAssetPool<PacoteTexturasBioma> | null>(null)
  // O pool dos AMBIENTES (IBL): capacidade 2, como o das texturas. Ao trocar de bioma o mais antigo é expulso e descartado com `dispose()` (vazamento zero, testado em `biomaVisual.test.ts`).
  const ambientesRef = useRef<BiomeGpuAssetPool<AmbienteGpu> | null>(null)
  if (!ambientesRef.current) {
    ambientesRef.current = new BiomeGpuAssetPool<AmbienteGpu>(2)
  }
  if (!poolRef.current) {
    poolRef.current = new BiomeGpuAssetPool<PacoteTexturasBioma>(2)
  }

  const [texturasBioma, setTexturasBioma] = useState<PacoteTexturasBioma | null>(() =>
    poolRef.current!.obterOuCriar(
      `${state.bioma}:${spec.texturaRes}`,
      () => defaultBiomaTextureProvider.gerarBioma(state.bioma, spec.texturaRes) as PacoteTexturasBioma,
    ) ?? null,
  )

  const texturasBlocos = useMemo(
    () => defaultBiomaTextureProvider.gerarBlocos(spec.texturaRes),
    [spec.texturaRes],
  )

  // CICLO DE VIDA do pacote de blocos (24/11/2026). ANTES: o cleanup deste efeito descartava `texturasBlocos` no MESMO passo em que o efeito novo anunciava o pacote novo. Só que o consumidor
  // (`IlhaRua` → obras) só passa a usar o novo no commit SEGUINTE (o `setState` do pai): naquele quadro as obras ainda apontavam para as texturas já descartadas e o three as REENVIAVA à GPU
  // (12 texturas por troca de resolução, folga de exatamente 1 quadro, medido com `instrumentos/rastro-texturas.js`); como o dono já as tinha descartado, ninguém as descartava de novo (GPU de 29 a
  // 137 texturas em 4 voltas de qualidade, sem platô). Agora o pacote que SAI fica RETIDO (`CicloDePacote`) e só é descartado no commit seguinte, quando o consumidor já commitou o novo.
  // A ORDEM DESTES DOIS EFEITOS É O CONTRATO: o de `confirmar` vem ANTES do de `anunciar`, e dentro de um commit os efeitos rodam na ordem em que foram declarados. Assim cada commit confirma o que
  // foi anunciado no commit ANTERIOR, e só então anuncia o seu. Inverter a ordem faria o retido sair no mesmo commit que o anuncia (o defeito de volta).
  const cicloBlocosRef = useRef<CicloDePacote<PacoteTexturasBlocos> | null>(null)
  if (!cicloBlocosRef.current) cicloBlocosRef.current = new CicloDePacote<PacoteTexturasBlocos>()
  useEffect(() => {
    cicloBlocosRef.current?.confirmar()
  })
  useEffect(() => {
    const ciclo = cicloBlocosRef.current
    ciclo?.anunciar(texturasBlocos)
    onBlocosTexturasProntas?.(texturasBlocos)
  }, [texturasBlocos, onBlocosTexturasProntas])
  useEffect(() => {
    const ciclo = cicloBlocosRef.current
    return () => {
      ciclo?.encerrar()
    }
  }, [])

  useEffect(() => {
    const pool = poolRef.current
    if (!pool) return
    let ativo = true
    const chave = `${state.bioma}:${spec.texturaRes}`
    const imediato = pool.obterExistente(chave)
    if (imediato) {
      setTexturasBioma(imediato)
      return
    }
    void pool
      .adquirirAsync(chave, async () => defaultBiomaTextureProvider.gerarBioma(state.bioma, spec.texturaRes))
      .then((pacote) => {
        if (ativo && pacote) setTexturasBioma(pacote)
      })
    return () => {
      ativo = false
    }
  }, [state.bioma, spec.texturaRes])

  useEffect(() => {
    return () => {
      poolRef.current?.descartarTudo()
      ambientesRef.current?.descartarTudo()
    }
  }, [])

  // AMBIENTE (IBL) do bioma (relevo e visual AoE, F1 Task 8b). Só quando `ambienteDeveExistir` (chave `ambienteIbl` ligada E nível Bonito/Ultra). O contexto WebGL perdido NÃO entra por prop: o
  // `aplicarContextLost` força o preset Leve, e o spec do Leve não tem ambiente. A geração pode FALHAR (GPU sem suporte, memória): dentro de try/catch o jogo segue sem ambiente, nunca com a cena
  // derrubada. O ambiente vive no pool (capacidade 2): trocar de bioma expulsa e descarta o mais antigo. Ao sair, `scene.environment` volta a null.
  const querAmbiente = ambienteDeveExistir(spec, { chaveLigada: PARTIDA.ambienteIbl, contextoPerdido: false })
  useEffect(() => {
    const pool = ambientesRef.current
    if (!pool || !querAmbiente) return undefined
    let ambiente: AmbienteGpu | null = null
    try {
      ambiente = pool.obterOuCriar(chaveDoAmbiente(state.bioma), () => gerarAmbientePmrem(gl, state.bioma))
    } catch (erro) {
      console.warn('[LogicBattle] o ambiente (IBL) não pôde ser gerado; seguindo sem ele', erro)
      return undefined
    }
    scene.environment = ambiente.textura
    scene.environmentIntensity = ambiente.intensidade
    return () => {
      scene.environment = null
      scene.environmentIntensity = 1
    }
  }, [gl, scene, state.bioma, querAmbiente])

  // ANISOTROPIA das texturas do chão (relevo e visual AoE, F1): o jogo rodava com anisotropia 1 (o padrão do three) e o chão rasante, como a estrada vista de 3ª pessoa, borrava. O valor é o do
  // spec (2×/8×/16×) limitado ao que a GPU suporta (`anisotropiaEfetiva`). Mudar o parâmetro de uma textura já enviada exige `needsUpdate` para o three reenviar o sampler. Só o `map` (a cor)
  // importa para a nitidez; normal e rugosidade acompanham para o relevo não borrar.
  useEffect(() => {
    const valor = anisotropiaEfetiva(spec, gl.capabilities.getMaxAnisotropy())
    const texturas = [
      texturasBioma?.solo, texturasBioma?.estrada, texturasBioma?.margem, texturasBioma?.rocha,
      texturasBlocos?.madeira, texturasBlocos?.pedra, texturasBlocos?.ouro, texturasBlocos?.canteiro,
    ]
    for (const trio of texturas) {
      if (!trio) continue
      for (const t of [trio.map, trio.normalMap, (trio as { roughnessMap?: { anisotropy: number; needsUpdate: boolean } }).roughnessMap]) {
        if (t && t.anisotropy !== valor) {
          t.anisotropy = valor
          t.needsUpdate = true
        }
      }
    }
  }, [gl, spec, texturasBioma, texturasBlocos])

  const quadroPerfRef = useRef(0)
  const ultimaMarcaPerfRef = useRef('')
  useFrame(() => {
    quadroPerfRef.current += 1
    const marca = `${state.bioma}:${spec.efetiva}:${fichasVivas}:${cartografiaTotal}`
    if (quadroPerfRef.current % 10 !== 1 && marca === ultimaMarcaPerfRef.current) return
    if (typeof window === 'undefined') return
    ultimaMarcaPerfRef.current = marca
    const stats = poolRef.current?.estatisticas()
    window.__LOGICBATTLE_PERF__ = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      poolAtivos: stats?.ativos ?? 0,
      poolEvictados: stats?.evictados ?? 0,
      poolDescartados: stats?.descartados ?? 0,
      bioma: state.bioma,
      qualidade: spec.efetiva,
      fichasVivas,
      cartografiaTotal,
    }
  })

  // O RELEVO só aparece com a chave LIGADA e o campo PRONTO. Antes de o campo chegar (a geração fatiada leva ~19 quadros a cada quadrado novo) o chão é o PLANO de hoje: o plano só some (`semPlano`)
  // quando a malha existe, nunca antes, senão o jogador ficaria sem chão por ~19 quadros.
  const relevoVisivel = PARTIDA.relevo.visual && campoDoRelevo !== undefined
  // O CHÃO QUE OS PROPS PISAM é a MALHA que o GPU desenha (F2, 26/11, decisão do usuário): o campo `alturaEm` é bilinear e a malha (passo 1/2/4 m pela qualidade EM USO) é linear por partes; entre os vértices diferem até 1,08 m.
  // O terreno continua com o campo CRU (a malha é construída dele); só quem POSICIONA um objeto no chão lê a malha. Sem campo (chave desligada ou campo ainda não pronto) é `undefined`: o plano de hoje, +0 exato.
  const chaoDaMalhaDaCena = chaoDaMalha(relevoVisivel ? campoDoRelevo : undefined, passoDaMalha(spec.efetiva))
  // OS RIOS (F2, 26/11/2026): só com a chave `PARTIDA.relevo.agua` LIGADA E o relevo DESENHADO (`relevoVisivel`: a chave `visual` ligada E o campo já chegou). A guarda é `agua && relevoVisivel`, NUNCA só a chave: com `visual` desligada,
  // ou nos ~19 quadros em que o campo fatiado ainda gera, a fita seria desenhada sobre o plano de hoje, SEM valeta, flutuando. `alturaDeBaseDoMundo` é a MESMA referência em todo lugar: a memória dos rios só reaproveita um
  // rio calculado com a mesma função. O `useMemo` evita refazer a lista (e recriar as fitas) a cada quadro.
  const rios = useMemo(() => (PARTIDA.relevo.agua && relevoVisivel ? riosDoQuadrado(mapaI, mapaJ, alturaDeBaseDoMundo) : undefined), [relevoVisivel, mapaI, mapaJ])
  const olharEfetivo = state.semCorpo ? 'imperio' : state.olhar
  const noSubsolo = !state.semCorpo && state.heroi.y < -0.9

  return (
    <group name="cena-bioma-visual">
      <AtmosferaBioma
        bioma={state.bioma}
        olhar={olharEfetivo}
        spec={spec}
        focoX={focoX}
        focoZ={focoZ}
      />
      <TerrenoBiomaCena
        bioma={state.bioma}
        texturas={texturasBioma}
        marcoVisivel={PARTIDA.nevoaPintada ? (x, z) => paisagemNaturalVisivel(state, x, z) : undefined}
        sombrasAtivas={spec.sombrasAtivas}
        semPlano={relevoVisivel}
        onPointerDown={onPointerDownGround}
        onClick={onClickGround}
      />
      {relevoVisivel && campoDoRelevo && (
        <TerrenoRelevoCena
          bioma={state.bioma}
          campo={campoDoRelevo}
          nevoaUniforms={nevoaUniforms}
          texturas={texturasBioma}
          spec={spec}
          onPointerDown={onPointerDownGround}
          onClick={onClickGround}
        />
      )}
      {/* O HORIZONTE (F2, Task 8 + decisão 26/11): o anel de terra em volta do quadrado, só com o relevo VISÍVEL (a MESMA guarda do chão), fora do subsolo e fora do Império (no Império o anel fora do quadrado deve ser névoa preta e furava na serra (3,0), foto 34). */}
      {relevoVisivel && !noSubsolo && olharEfetivo !== 'imperio' && (
        <HorizonteRelevo
          bioma={state.bioma}
          i={mapaI}
          j={mapaJ}
          spec={spec}
        />
      )}
      {!noSubsolo && (
        <AguaBiomaShader
          state={state}
          bioma={state.bioma}
          lagoas={state.lagoas}
          texturas={texturasBioma}
          spec={spec}
          rios={rios}
          quadrado={{ i: mapaI, j: mapaJ }}
          nevoaUniforms={nevoaUniforms}
        />
      )}
      <PropsBiomaInstanced
        state={state}
        mapaI={mapaI}
        mapaJ={mapaJ}
        bioma={state.bioma}
        recursos={state.recursos}
        lagoas={state.lagoas}
        texturas={texturasBioma}
        spec={spec}
        campo={chaoDaMalhaDaCena}
      />
    </group>
  )
}
