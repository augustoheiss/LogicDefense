import { useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useRef, useState } from 'react'
import { HalfFloatType, Vector2, WebGLRenderTarget, type ToneMapping } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { PARTIDA } from '../partidaPolicies'
import { configDoComposer, resolucaoDoBloom } from './decisaoPosProcessamento'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'

/**
 * O pós-processamento HDR (24/11/2026, F1): bloom seletivo, oclusão ambiente de tela (só no Ultra) e o mapeamento de tom aplicado UMA vez, no fim. Substitui o render direto do Canvas.
 *
 * O PERIGO DESTE COMPONENTE É A TELA PRETA. Um `useFrame` com prioridade POSITIVA desliga o render automático do R3F para o Canvas inteiro e passa a ser quem desenha. Se este componente
 * falhar sem devolver o controle, ninguém desenha. Por isso: (1) a decisão de «ligar ou não» é a função pura `configDoComposer` (testada: Leve, chave desligada e contexto perdido SEMPRE
 * desligam), consultada a cada render; (2) o `useFrame` de prioridade 1 só existe enquanto `ativo`; (3) um `try/catch` ao redor do `composer.render` DESLIGA o composer e desenha a cena na hora
 * (um erro de shader no meio do jogo nunca vira tela preta).
 *
 * TOM: o three aplica o mapeamento de tom no MATERIAL só quando o alvo de render é a tela (`currentRenderTarget === null`, `WebGLPrograms.js:177`). O `RenderPass` desenha para um alvo
 * (HDR linear), então o ACES NÃO é aplicado duas vezes: o `OutputPass`, que desenha para a tela, lê `renderer.toneMapping` e o aplica uma vez no fim. Por isso aqui só se grava o tom desejado
 * em `gl.toneMapping` e se restaura o anterior ao sair.
 *
 * MSAA: o `EffectComposer` cria o alvo SEM amostras (`{ type: HalfFloatType }`). Com o composer ligado o antialias do framebuffer padrão não vale, então o alvo é criado aqui com `samples`.
 */

export interface PosProcessamentoProps {
  readonly spec: SpecQualidadeGrafica
  /** O mapeamento de tom aplicado no fim (decidido por foto em F1). */
  readonly tom: ToneMapping
  /** O contexto WebGL foi perdido: devolve o render ao R3F na hora. */
  readonly contextoPerdido: boolean
}

export const PosProcessamento: React.FC<PosProcessamentoProps> = ({ spec, tom, contextoPerdido }) => {
  const { gl, scene, camera, size } = useThree()
  const config = configDoComposer(spec, { chaveLigada: PARTIDA.posProcessamento, contextoPerdido })
  // se o composer lançar um erro em jogo, desliga-se por aqui e o R3F volta a desenhar sozinho
  const [falhou, setFalhou] = useState(false)
  const ativo = config.ativo && !falhou
  const composerRef = useRef<EffectComposer | null>(null)
  const bloomRef = useRef<UnrealBloomPass | null>(null)
  const tomRef = useRef(tom)
  tomRef.current = tom

  // O composer é recriado só quando a sua FORMA muda (ligar, desligar, AO, bloom, MSAA). O tamanho vai pelo efeito seguinte.
  useEffect(() => {
    if (!ativo) return undefined
    const dpr = gl.getPixelRatio()
    const alvo = new WebGLRenderTarget(Math.max(1, Math.floor(size.width * dpr)), Math.max(1, Math.floor(size.height * dpr)), { type: HalfFloatType, samples: config.msaa })
    const composer = new EffectComposer(gl, alvo)
    composer.setPixelRatio(dpr)
    composer.setSize(size.width, size.height)
    composer.addPass(new RenderPass(scene, camera))
    if (config.ao) {
      const ao = new GTAOPass(scene, camera, size.width, size.height)
      ao.blendIntensity = 0.85
      composer.addPass(ao)
    }
    if (config.bloom) {
      const meia = resolucaoDoBloom(size.width * dpr, size.height * dpr)
      const bloom = new UnrealBloomPass(new Vector2(meia.largura, meia.altura), config.bloomForca, config.bloomRaio, config.bloomLimiar)
      bloomRef.current = bloom
      composer.addPass(bloom)
    }
    composer.addPass(new OutputPass())
    composerRef.current = composer
    // Gancho de MEDIÇÃO, só em DEV (o mesmo critério de `__ILHA_BENCH__`): `__composerRender()` executa o MESMO que o `useFrame` faz num quadro. O instrumento de GPU (`gpu-ms.js`) chama
    // `renderer.render(scene, cam)` direto e IGNORARIA o composer, dizendo que o pós-processamento é «grátis»; com este gancho ele mede o quadro com o composer. Não existe em produção.
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      ;(window as unknown as { __composerRender?: () => void }).__composerRender = () => {
        const tomAntes = gl.toneMapping
        gl.toneMapping = tomRef.current
        try {
          composer.render(0.016)
        } finally {
          gl.toneMapping = tomAntes
        }
      }
    }
    return () => {
      composerRef.current = null
      bloomRef.current = null
      if (import.meta.env.DEV && typeof window !== 'undefined') delete (window as unknown as { __composerRender?: () => void }).__composerRender
      composer.dispose()
      alvo.dispose()
    }
    // o tamanho NÃO entra aqui de propósito: mudar a janela só reajusta (efeito abaixo), sem recriar os alvos de render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, config.ao, config.bloom, config.msaa, config.bloomForca, config.bloomRaio, config.bloomLimiar, gl, scene, camera])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    const dpr = gl.getPixelRatio()
    composer.setPixelRatio(dpr)
    composer.setSize(size.width, size.height)
    const meia = resolucaoDoBloom(size.width * dpr, size.height * dpr)
    bloomRef.current?.setSize(meia.largura, meia.altura)
  }, [size.width, size.height, gl, ativo])

  // Prioridade 1 assume o render do Canvas inteiro, e SÓ existe enquanto `ativo`. Sem ele o R3F desenha sozinho (prioridade 0).
  useFrame(
    (_, dt) => {
      const composer = composerRef.current
      if (!ativo || !composer) return
      const tomAntes = gl.toneMapping
      try {
        gl.toneMapping = tomRef.current
        composer.render(Math.min(dt, 0.05))
      } catch {
        // um erro do composer em jogo nunca pode virar tela preta: desliga o composer e desenha a cena AGORA, sem esperar o próximo quadro
        setFalhou(true)
        gl.toneMapping = tomAntes
        gl.setRenderTarget(null)
        gl.render(scene, camera)
      } finally {
        gl.toneMapping = tomAntes
      }
    },
    ativo ? 1 : 0,
  )

  return null
}
