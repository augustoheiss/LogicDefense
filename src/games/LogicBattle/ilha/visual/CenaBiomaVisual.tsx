import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { PartidaState } from '../partidaSim'
import { AguaBiomaShader } from './AguaBiomaShader'
import { AtmosferaBioma } from './AtmosferaBioma'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import { PropsBiomaInstanced } from './PropsBiomaInstanced'
import { BiomeGpuAssetPool } from './recursoGpuPool'
import { TerrenoBiomaCena } from './TerrenoBiomaCena'
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
  onPointerDownGround,
  onClickGround,
}) => {
  const { gl } = useThree()
  const poolRef = useRef<BiomeGpuAssetPool<PacoteTexturasBioma> | null>(null)
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

  useEffect(() => {
    onBlocosTexturasProntas?.(texturasBlocos)
    return () => {
      texturasBlocos?.dispose()
    }
  }, [texturasBlocos, onBlocosTexturasProntas])

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
    }
  }, [])

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
        mostrarEstrada={!noSubsolo}
        sombrasAtivas={spec.sombrasAtivas}
        onPointerDown={onPointerDownGround}
        onClick={onClickGround}
      />
      {!noSubsolo && (
        <AguaBiomaShader
          state={state}
          bioma={state.bioma}
          lagoas={state.lagoas}
          texturas={texturasBioma}
          spec={spec}
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
      />
    </group>
  )
}
