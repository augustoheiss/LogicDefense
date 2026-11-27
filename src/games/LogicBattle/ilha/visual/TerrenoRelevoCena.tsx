import { useFrame, type ThreeEvent } from '@react-three/fiber'
import React, { useEffect, useMemo } from 'react'
import { BufferGeometry, DataTexture, Float32BufferAttribute, LinearFilter, MeshStandardMaterial, RedFormat, Uint32BufferAttribute, UnsignedByteType, Color } from 'three'
import { corDoChaoBioma, type BiomaId } from '../biomaRecursos'
import type { CampoRelevo } from '../relevo/campoRelevo'
import { geometriaDoTerreno, passoDaMalha, saiaDoTerreno } from '../relevo/geometriaDoTerreno'
import { ESCALA_DA_ROCHA, injetarMisturaDeRocha } from '../relevo/materialTerrenoRelevo'
import { injetarNevoaNoTerreno } from '../relevo/nevoaNoTerreno'
import { ALTURA_DO_PLANO } from './NevoaPintada'
import { fatorDeReflexo } from './ceuEIbl'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import { semRaycast } from '../raycastCena'
import { Y_SOLO_VISUAL } from './suporteFundacao'
import type { PacoteTexturasBioma } from './texturasPbrProcedural'

export interface TerrenoRelevoCenaProps {
  readonly bioma: BiomaId
  /** O campo de relevo PRONTO do quadrado (o pai só monta este componente quando ele existe: antes disso o chão é o plano de hoje). */
  readonly campo: CampoRelevo
  readonly texturas: PacoteTexturasBioma | null
  readonly spec: SpecQualidadeGrafica
  /**
   * As uniforms da NÉVOA pintada, publicadas pela `NevoaPintada` (um irmão em `Cena`, montado DEPOIS desta cena: no 1º compile a ref pode ser `null`). O chão as copia a cada quadro para a névoa
   * dele ser a mesma do plano. Ausente ou `null`, vale o estado seguro inicial: «tudo coberto».
   */
  readonly nevoaUniforms?: React.MutableRefObject<Record<string, { value: unknown }> | null>
  readonly onPointerDown: (event: ThreeEvent<PointerEvent>) => void
  readonly onClick: (event: ThreeEvent<MouseEvent>) => void
}

/** Os nomes das 6 uniforms da névoa (os MESMOS de `DECLARACOES_DA_NEVOA`): o terreno as copia da `NevoaPintada` pelo nome. */
const UNIFORMS_DA_NEVOA = ['uMapa', 'uTempo', 'uCorNunca', 'uOpNunca', 'uCorJa', 'uOpJa'] as const

/**
 * O CHÃO COM RELEVO (F2, Task 3, 25/11/2026): uma malha única cuja altura em cada vértice é `alturaEm(campo, x, z)`, com a MESMA textura de solo do bioma, uma mistura de rocha nos declives
 * (`injetarMisturaDeRocha`) e a NÉVOA pintada no próprio shader (`injetarNevoaNoTerreno`, a decisão do usuário de 25/11). Substitui só o PLANO principal do `TerrenoBiomaCena` (que ganhou
 * `semPlano`); a estrada, a praça e os marcos continuam vindo de lá.
 *
 * Fica em `Y_SOLO_VISUAL` (−0,45): a geometria guarda a altura ACIMA DA RUA, então campo plano ⇒ chão em −0,45 exatos (I1). A malha recebe o clique e o arrasto como o plano de hoje.
 *
 * RISCO 11 (a âncora que some): a injeção de shader é a parte frágil. Se o `three` renomear um chunk, a injeção LANÇA; aqui cada uma tem o SEU try/catch (a rocha sem a névoa e a névoa sem a rocha
 * são aceitáveis; as duas caladas, não) e a console AVISA: o jogo não cai e o defeito não passa em silêncio. Um erro de GLSL (que não lança aqui) só o navegador mostra.
 */
export const TerrenoRelevoCena: React.FC<TerrenoRelevoCenaProps> = ({ bioma, campo, texturas, spec, nevoaUniforms, onPointerDown, onClick }) => {
  // A geometria depende do campo e do passo (qualidade). `useMemo` a mantém estável entre renders; trocar de qualidade ou de quadrado cria outra e o efeito abaixo DESCARTA a anterior
  // (sem o `dispose` cada troca vazaria uma geometria na GPU: o defeito de ontem, com a mesma forma).
  const geometria = useMemo(() => {
    const g = geometriaDoTerreno(campo, passoDaMalha(spec.efetiva))
    const malha = new BufferGeometry()
    malha.setAttribute('position', new Float32BufferAttribute(g.posicoes, 3))
    malha.setAttribute('normal', new Float32BufferAttribute(g.normais, 3))
    malha.setAttribute('uv', new Float32BufferAttribute(g.uvs, 2))
    malha.setIndex(new Uint32BufferAttribute(g.indices, 1))
    malha.computeBoundingSphere()
    return malha
  }, [campo, spec.efetiva])
  useEffect(() => {
    return () => {
      geometria.dispose()
    }
  }, [geometria])

  // A SAIA (25/11, o «fio azul»): uma parede em cada aresta, da quina do terreno até o plano da névoa. O terreno é uma folha sem espessura e o plano da névoa tem um furo no quadrado inteiro: sem a
  // saia, um raio da câmera do Império que cruza o furo perto da aresta passa por cima da quina e por baixo do plano e vê o céu (medido: 7/7/8 px; com a saia 0/0/0). O topo é `ALTURA_DO_PLANO`,
  // a MESMA constante que posiciona o plano. Mesmo passo da malha, para a base da saia casar com a quina.
  const geometriaDaSaia = useMemo(() => {
    const s = saiaDoTerreno(campo, passoDaMalha(spec.efetiva), ALTURA_DO_PLANO)
    const malha = new BufferGeometry()
    malha.setAttribute('position', new Float32BufferAttribute(s.posicoes, 3))
    malha.setIndex(new Uint32BufferAttribute(s.indices, 1))
    // a luz precisa de normais; a saia é vertical e a névoa a cobre, então as normais saem do cálculo da própria malha
    malha.computeVertexNormals()
    malha.computeBoundingSphere()
    return malha
  }, [campo, spec.efetiva])
  useEffect(() => {
    return () => {
      geometriaDaSaia.dispose()
    }
  }, [geometriaDaSaia])

  // As UNIFORMS DA NÉVOA do chão: objetos `{ value }` PRÓPRIOS, no estado seguro «tudo coberto» (a opacidade de «nunca visto» em 0,94, não 0: por um quadro o erro é escurecer demais, nunca
  // revelar o que o jogador não viu). `uMapa` nasce como uma textura 1×1 com o valor 0 («nunca visto») para o 1º compile nunca ter o sampler vazio. A `NevoaPintada` mantém as verdadeiras e o
  // `useFrame` abaixo as copia por cima.
  const uniformsDaNevoa = useMemo(() => {
    const vazio = new DataTexture(new Uint8Array([0]), 1, 1, RedFormat, UnsignedByteType)
    vazio.magFilter = LinearFilter
    vazio.minFilter = LinearFilter
    vazio.generateMipmaps = false
    vazio.needsUpdate = true
    return {
      uMapa: { value: vazio as DataTexture },
      uTempo: { value: 0 },
      uCorNunca: { value: new Color('#06070c') },
      uOpNunca: { value: 0.94 },
      uCorJa: { value: new Color('#0e1424') },
      uOpJa: { value: 0.5 },
    }
  }, [])
  useEffect(() => {
    const vazio = uniformsDaNevoa.uMapa.value
    return () => {
      vazio.dispose()
    }
  }, [uniformsDaNevoa])
  // Copia, a cada quadro, o que a `NevoaPintada` publicou (textura viva, tempo, cores e opacidades). Sem ela (ainda não montou, ou a chave da névoa está desligada) o estado seguro fica.
  useFrame(() => {
    const publicas = nevoaUniforms?.current
    if (!publicas) return
    for (const nome of UNIFORMS_DA_NEVOA) {
      const fonte = publicas[nome]
      if (fonte) (uniformsDaNevoa[nome] as { value: unknown }).value = fonte.value
    }
  })

  // O material: o mesmo `MeshStandardMaterial` do plano de hoje (cor, mapa, normal e rugosidade do solo do bioma), com a rocha (quando há a textura dela) E a névoa injetadas. Um por (bioma, texturas).
  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: texturas ? '#ffffff' : corDoChaoBioma(bioma),
      map: texturas?.solo.map ?? null,
      normalMap: texturas?.solo.normalMap ?? null,
      roughnessMap: texturas?.solo.roughnessMap ?? null,
      roughness: texturas ? 1 : 0.92,
      metalness: 0.04,
      envMapIntensity: fatorDeReflexo(0.04, 1),
    })
    const rocha = texturas?.rocha.map
    mat.onBeforeCompile = (shader) => {
      // A ROCHA (só com a textura dela: sem ela o sampler ficaria vazio e o declive, preto)
      if (rocha) {
        try {
          const injetado = injetarMisturaDeRocha(shader.vertexShader, shader.fragmentShader)
          shader.vertexShader = injetado.vertice
          shader.fragmentShader = injetado.fragmento
          shader.uniforms.uRochaMap = { value: rocha }
          shader.uniforms.uRochaEscala = { value: ESCALA_DA_ROCHA }
        } catch (erro) {
          // âncora perdida (o three mudou): o terreno segue SEM a rocha, e a console AVISA (silêncio seria o risco 11)
          console.warn('[LogicBattle] a mistura de rocha do terreno não pôde ser injetada; o chão segue sem rocha nos declives', erro)
        }
      }
      // A NÉVOA (não depende das texturas): o chão com relevo não pode vazar o que o jogador não viu
      try {
        const injetado = injetarNevoaNoTerreno(shader.vertexShader, shader.fragmentShader)
        shader.vertexShader = injetado.vertice
        shader.fragmentShader = injetado.fragmento
        shader.uniforms.uMapa = uniformsDaNevoa.uMapa
        shader.uniforms.uTempo = uniformsDaNevoa.uTempo
        shader.uniforms.uCorNunca = uniformsDaNevoa.uCorNunca
        shader.uniforms.uOpNunca = uniformsDaNevoa.uOpNunca
        shader.uniforms.uCorJa = uniformsDaNevoa.uCorJa
        shader.uniforms.uOpJa = uniformsDaNevoa.uOpJa
      } catch (erro) {
        // âncora perdida: o chão ficaria SEM névoa e mostraria o terreno que o jogador não explorou. Avisa em voz alta (a névoa do PLANO continua cobrindo a estrada, a praça e o fora do quadrado)
        console.warn('[LogicBattle] a névoa do terreno não pôde ser injetada; o chão com relevo vaza o que o jogador não viu', erro)
      }
    }
    // o three reaproveita o programa pela chave: a versão no nome invalida o cache quando o shader muda (a névoa entrou na versão «nevoa-v1»)
    mat.customProgramCacheKey = () => 'terreno-relevo-nevoa-v1'
    return mat
  }, [bioma, texturas, uniformsDaNevoa])
  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  return (
    <>
      <mesh
        name="terreno-relevo"
        geometry={geometria}
        material={material}
        position={[0, Y_SOLO_VISUAL, 0]}
        receiveShadow={spec.sombrasAtivas}
        onPointerDown={onPointerDown}
        onClick={onClick}
      />
      <mesh
        name="terreno-relevo-saia"
        geometry={geometriaDaSaia}
        material={material}
        position={[0, Y_SOLO_VISUAL, 0]}
        raycast={semRaycast}
      />
    </>
  )
}
