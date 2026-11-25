import React from 'react'
import type { Group } from 'three'
import type { AlvoEdicaoUnificado } from './alvoBlocoUnificado'
import {
  LagoaRasa,
  RecursoNatural,
  SUBSOLO_CFG,
  VOXEL_NV5,
} from './biomaRecursos'
import type { PlanoLinhaBlocos } from './blocosMundo'
import {
  BlocosMundoInstanced,
  GhostBlueprintObra,
  ObrasLivresInstanced,
  ObrasNv5Instanced,
  PreviewLinhaBlocos,
} from './ObrasArquiteturaCena'
import { DIMENSOES_OBRA, PARTIDA, PecaId } from './partidaPolicies'
import { cobertoAgora, obraEmConstrucao, PartidaState } from './partidaSim'
import type { AlvoEdicaoVoxel } from './verticalidadeVoxel'
import { FundacoesObrasCena } from './visual/FundacaoObraCena'
import { alturaVisualRecurso, classificarSuporteObra, paisagemNaturalVisivel, Y_SOLO_VISUAL } from './visual/suporteFundacao'
import type { CampoRelevo } from './relevo/campoRelevo'
import type { PacoteTexturasBlocos } from './visual/texturasPbrProcedural'

export interface MundoSandboxCenaProps {
  state: PartidaState
  lagoas: readonly LagoaRasa[]
  recursos: readonly RecursoNatural[]
  subsoloCentro: { x: number; z: number } | null
  modoBloco: 'adicionar' | 'remover' | null
  visualAprimorado?: boolean
  texturasBlocos?: PacoteTexturasBlocos | null
  sombrasAtivas?: boolean
  voxeisGroupRef?: React.RefObject<Group | null>
  blocosMapaGroupRef?: React.RefObject<Group | null>
  obrasLivresGroupRef?: React.RefObject<Group | null>
  ghostVoxel?: AlvoEdicaoVoxel | null
  ghostBloco?: AlvoEdicaoUnificado | null
  ghostObra?: { tipo: PecaId; x: number; z: number; valido: boolean } | null
  previewLinha?: { plano: PlanoLinhaBlocos; temRecurso: boolean } | null
  bloqueiaCliqueObra?: boolean
  onSelectObraInstanced?: (obraId: number, lado: 'nosso' | 'inimigo', button: number) => void
  /** O ponteiro tocou uma obra instanciada, antes do `click`. Só repasse: a decisão é de `IlhaRua`. */
  onTocarObraInstanced?: (obraId: number, pointerId: number, button: number) => boolean | void
  onPedirSubsolo: () => void
  /** O campo de relevo do quadrado (F2, Task 4). OPCIONAL: sem ele (chave desligada, ou campo ainda gerando) tudo fica no plano de hoje (I1). Repassado à fundação e aos pontos de chão do sandbox. */
  campo?: CampoRelevo
}

export const MundoSandboxCena: React.FC<MundoSandboxCenaProps> = ({
  state,
  lagoas,
  recursos,
  subsoloCentro,
  modoBloco,
  visualAprimorado = false,
  texturasBlocos = null,
  sombrasAtivas = false,
  voxeisGroupRef,
  blocosMapaGroupRef,
  obrasLivresGroupRef,
  ghostVoxel,
  ghostBloco,
  ghostObra,
  previewLinha,
  bloqueiaCliqueObra,
  onSelectObraInstanced,
  onTocarObraInstanced,
  onPedirSubsolo,
  campo,
}) => {
  const olharEfetivo = state.semCorpo ? 'imperio' : state.olhar
  const noSubsolo = !state.semCorpo && state.heroi.y < -0.9
  const ghostAtivo = ghostBloco ?? (ghostVoxel ? { ...ghostVoxel, passo: VOXEL_NV5.passo } : null)

  return (
    <group>
      {/* 1. Água Rasa (quando visualAprimorado ativo, renderizada via AguaBiomaShader) */}
      {!visualAprimorado &&
        lagoas.map((lagoa, idx) => {
          const visivel = paisagemNaturalVisivel(state, lagoa.x, lagoa.z)
          if (!visivel) return null
          return (
            <group key={`lagoa-${idx}`} position={[lagoa.x, -0.41, lagoa.z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[lagoa.rx + 0.55, lagoa.rz + 0.55, 1]} raycast={() => null}>
                <circleGeometry args={[1, 24]} />
                <meshStandardMaterial color="#d6c394" roughness={0.95} />
              </mesh>
              <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[lagoa.rx, lagoa.rz, 1]} raycast={() => null}>
                <circleGeometry args={[1, 24]} />
                <meshStandardMaterial color="#0ea5e9" transparent opacity={0.76} roughness={0.2} metalness={0.15} />
              </mesh>
            </group>
          )
        })}

      {/* 2. Recursos Naturais: superfície renderizada via PropsBiomaInstanced quando visualAprimorado está ativo; subsolo sempre aqui */}
      {recursos.map((rec) => {
        const ehSubsolo = rec.yBase < -0.9
        if (ehSubsolo && !noSubsolo) return null
        if (!ehSubsolo && visualAprimorado) return null
        if (!ehSubsolo && !paisagemNaturalVisivel(state, rec.x, rec.z)) return null
        const ySolo = alturaVisualRecurso(rec.yBase)

        if (rec.tipo === 'arvore') {
          if (rec.hp <= 0) {
            return (
              <mesh key={`rec-${rec.id}`} position={[rec.x, ySolo + 0.12, rec.z]} raycast={() => null}>
                <cylinderGeometry args={[0.28, 0.34, 0.28, 8]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
            )
          }
          return (
            <group key={`rec-${rec.id}`} position={[rec.x, ySolo, rec.z]}>
              <mesh position={[0, 0.6, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.24, 0.32, 1.3, 8]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0, 1.4, 0]} raycast={() => null}>
                <coneGeometry args={[0.95, 1.15, 8]} />
                <meshStandardMaterial color="#15803d" />
              </mesh>
              <mesh position={[0, 2.0, 0]} raycast={() => null}>
                <coneGeometry args={[0.72, 0.95, 8]} />
                <meshStandardMaterial color="#22c55e" />
              </mesh>
            </group>
          )
        }

        // Veio / Rocha de Ouro
        if (rec.hp <= 0) {
          return (
            <mesh key={`rec-${rec.id}`} position={[rec.x, ySolo + 0.06, rec.z]} raycast={() => null}>
              <cylinderGeometry args={[0.42, 0.5, 0.16, 7]} />
              <meshStandardMaterial color="#44403c" />
            </mesh>
          )
        }
        return (
          <group key={`rec-${rec.id}`} position={[rec.x, ySolo, rec.z]}>
            <mesh position={[0, 0.3, 0]} raycast={() => null}>
              <dodecahedronGeometry args={[0.58, 0]} />
              <meshStandardMaterial color="#57534e" roughness={0.85} />
            </mesh>
            <mesh position={[0.18, 0.58, 0.1]} rotation={[0.3, 0.4, -0.2]} raycast={() => null}>
              <octahedronGeometry args={[0.26, 0]} />
              <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.45} metalness={0.5} roughness={0.25} />
            </mesh>
            <mesh position={[-0.2, 0.48, -0.14]} rotation={[-0.2, 0.2, 0.35]} raycast={() => null}>
              <octahedronGeometry args={[0.22, 0]} />
              <meshStandardMaterial color="#fde047" emissive="#ca8a04" emissiveIntensity={0.35} metalness={0.5} roughness={0.25} />
            </mesh>
          </group>
        )
      })}

      {/* 3. Peitoril de Escalada nas Obras Altas (Torre e Portão Nv < 5) + Escotilha de Subsolo nas Minas */}
      {state.obras.map((obra) => {
        if (obra.hp <= 0 || obraEmConstrucao(obra)) return null
        if (obra.lado === 'inimigo' && PARTIDA.nuvem && !cobertoAgora(state, obra.x, obra.z)) return null
        const temVoxel = Boolean(obra.blocosNv5) || Boolean(obra.blocosLivres?.length)
        const dim = DIMENSOES_OBRA[obra.tipo]

        return (
          <group key={`extra-obra-${obra.id}`}>
            {!temVoxel && (obra.tipo === 'torre' || obra.tipo === 'portao') && (
              <mesh position={[obra.x, 1.04, obra.z]} raycast={() => null}>
                <boxGeometry args={[dim[0] + 0.62, 0.12, dim[2] + 0.62]} />
                <meshStandardMaterial color={obra.lado === 'inimigo' ? '#881337' : '#38bdf8'} />
              </mesh>
            )}
            {obra.lado !== 'inimigo' && obra.tipo === 'mina' && (
              <group
                position={[obra.x, Y_SOLO_VISUAL + 0.06, obra.z + 1.65]}
                onClick={(event) => {
                  event.stopPropagation()
                  onPedirSubsolo()
                }}
              >
                <mesh>
                  <boxGeometry args={[1.1, 0.12, 1.1]} />
                  <meshStandardMaterial color="#eab308" />
                </mesh>
                <mesh position={[0, 0.05, 0]}>
                  <boxGeometry args={[0.78, 0.06, 0.78]} />
                  <meshStandardMaterial color="#090d16" />
                </mesh>
              </group>
            )}
          </group>
        )
      })}

      {/* 4. Galeria Subterrânea (Subsolo em y = -3.2m) */}
      {subsoloCentro && noSubsolo && (
        <group position={[subsoloCentro.x, 0, subsoloCentro.z]}>
          <pointLight position={[0, SUBSOLO_CFG.pisoY + 2.3, 0]} intensity={2.2} distance={24} color="#fde68a" />
          <pointLight position={[-5, SUBSOLO_CFG.pisoY + 2.0, -5]} intensity={1.2} distance={16} color="#38bdf8" />
          <pointLight position={[5, SUBSOLO_CFG.pisoY + 2.0, 5]} intensity={1.2} distance={16} color="#f59e0b" />
          {/* Piso da caverna */}
          <mesh position={[0, SUBSOLO_CFG.pisoY - 0.08, 0]} raycast={() => null}>
            <boxGeometry args={[SUBSOLO_CFG.meiaLargura * 2 + 1, 0.16, SUBSOLO_CFG.meiaProfundidade * 2 + 1]} />
            <meshStandardMaterial color="#292524" roughness={0.95} />
          </mesh>
          {/* Teto da caverna em 1ª/3ª pessoa */}
          {olharEfetivo !== 'imperio' && (
            <mesh position={[0, SUBSOLO_CFG.tetoY + 0.08, 0]} raycast={() => null}>
              <boxGeometry args={[SUBSOLO_CFG.meiaLargura * 2 + 1, 0.16, SUBSOLO_CFG.meiaProfundidade * 2 + 1]} />
              <meshStandardMaterial color="#1c1917" roughness={1} />
            </mesh>
          )}
          {/* Paredes laterais de rocha */}
          <mesh position={[0, (SUBSOLO_CFG.pisoY + SUBSOLO_CFG.tetoY) / 2, -SUBSOLO_CFG.meiaProfundidade - 0.25]} raycast={() => null}>
            <boxGeometry args={[SUBSOLO_CFG.meiaLargura * 2 + 1, 3.1, 0.5]} />
            <meshStandardMaterial color="#44403c" />
          </mesh>
          <mesh position={[0, (SUBSOLO_CFG.pisoY + SUBSOLO_CFG.tetoY) / 2, SUBSOLO_CFG.meiaProfundidade + 0.25]} raycast={() => null}>
            <boxGeometry args={[SUBSOLO_CFG.meiaLargura * 2 + 1, 3.1, 0.5]} />
            <meshStandardMaterial color="#44403c" />
          </mesh>
          <mesh position={[-SUBSOLO_CFG.meiaLargura - 0.25, (SUBSOLO_CFG.pisoY + SUBSOLO_CFG.tetoY) / 2, 0]} raycast={() => null}>
            <boxGeometry args={[0.5, 3.1, SUBSOLO_CFG.meiaProfundidade * 2 + 1]} />
            <meshStandardMaterial color="#44403c" />
          </mesh>
          <mesh position={[SUBSOLO_CFG.meiaLargura + 0.25, (SUBSOLO_CFG.pisoY + SUBSOLO_CFG.tetoY) / 2, 0]} raycast={() => null}>
            <boxGeometry args={[0.5, 3.1, SUBSOLO_CFG.meiaProfundidade * 2 + 1]} />
            <meshStandardMaterial color="#44403c" />
          </mesh>
          {/* Escada iluminada de retorno à superfície */}
          <group
            position={[0, SUBSOLO_CFG.pisoY, 1.65]}
            onClick={(event) => {
              event.stopPropagation()
              onPedirSubsolo()
            }}
          >
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.45, 0.45, 2.8, 12]} />
              <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.6} transparent opacity={0.85} />
            </mesh>
          </group>
        </group>
      )}

      {/* 5. Fundações Aterradas (Terra vs Água + Animação de Obra), Construções Nível 5+ e Blocos Livres */}
      <FundacoesObrasCena
        state={state}
        lagoas={lagoas}
        texturasBlocos={texturasBlocos}
        sombrasAtivas={sombrasAtivas}
        campo={campo}
      />
      <ObrasNv5Instanced
        state={state}
        versaoSolidos={state.versaoSolidos}
        versaoChao={state.versaoChao}
        groupRef={voxeisGroupRef}
        texturasBlocos={texturasBlocos}
        sombrasAtivas={sombrasAtivas}
        bloqueiaCliqueObra={bloqueiaCliqueObra}
        onSelectObra={onSelectObraInstanced}
        onTocarObra={onTocarObraInstanced}
        campo={campo}
        lagoas={lagoas}
      />
      <BlocosMundoInstanced
        blocosMapa={state.blocosMapa}
        versaoSolidos={state.versaoSolidos}
        versaoChao={state.versaoChao}
        state={state}
        groupRef={blocosMapaGroupRef}
        texturasBlocos={texturasBlocos}
        sombrasAtivas={sombrasAtivas}
        campo={campo}
        lagoas={lagoas}
      />
      <ObrasLivresInstanced
        state={state}
        versaoSolidos={state.versaoSolidos}
        versaoChao={state.versaoChao}
        groupRef={obrasLivresGroupRef}
        texturasBlocos={texturasBlocos}
        sombrasAtivas={sombrasAtivas}
        bloqueiaCliqueObra={bloqueiaCliqueObra}
        onSelectObra={onSelectObraInstanced}
        onTocarObra={onTocarObraInstanced}
        campo={campo}
        lagoas={lagoas}
      />

      {/* 6. Ghost Blueprint de Fundação (Torre/Obra seguindo cursor ou toque) */}
      {ghostObra && (
        <GhostBlueprintObra
          tipo={ghostObra.tipo}
          x={ghostObra.x}
          z={ghostObra.z}
          valido={ghostObra.valido}
          sobreAgua={classificarSuporteObra(lagoas, ghostObra.x, ghostObra.z, DIMENSOES_OBRA[ghostObra.tipo]) === 'agua'}
          campo={campo}
          lagoas={lagoas}
        />
      )}

      {/* 7. Preview 360° da Linha de Blocos (Trincheira / Muralha) */}
      {previewLinha && (
        <PreviewLinhaBlocos plano={previewLinha.plano} temRecurso={previewLinha.temRecurso} campo={campo} lagoas={lagoas} />
      )}

      {/* 8. Ghost Highlight do Bloco/Voxel Alvo na Edição */}
      {modoBloco && ghostAtivo && (
        <group position={[ghostAtivo.wx, ghostAtivo.wy, ghostAtivo.wz]}>
          <mesh raycast={() => null}>
            <boxGeometry args={[ghostAtivo.passo * 1.03, ghostAtivo.passo * 1.03, ghostAtivo.passo * 1.03]} />
            <meshBasicMaterial
              color={ghostAtivo.valido ? '#22d3ee' : '#ef4444'}
              transparent
              opacity={0.38}
              depthWrite={false}
            />
          </mesh>
          <mesh raycast={() => null}>
            <boxGeometry args={[ghostAtivo.passo * 1.04, ghostAtivo.passo * 1.04, ghostAtivo.passo * 1.04]} />
            <meshBasicMaterial
              color={ghostAtivo.valido ? '#f8fafc' : '#fecaca'}
              wireframe
              transparent
              opacity={0.95}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  )
}
