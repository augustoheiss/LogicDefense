import React from 'react'
import {
  centroBlocoMundo,
  indiceVoxelLocal,
  LagoaRasa,
  RecursoNatural,
  SUBSOLO_CFG,
  VOXEL_NV5,
} from './biomaRecursos'
import { DIMENSOES_OBRA, PARTIDA } from './partidaPolicies'
import { chaoRevelado, cobertoAgora, obraEmConstrucao, Obra, PartidaState } from './partidaSim'

export interface MundoSandboxCenaProps {
  state: PartidaState
  lagoas: readonly LagoaRasa[]
  recursos: readonly RecursoNatural[]
  subsoloCentro: { x: number; z: number } | null
  modoBloco: 'adicionar' | 'remover' | null
  onEditarBloco: (obraId: number, bx: number, by: number, bz: number, acao: 'adicionar' | 'remover') => void
  onPedirSubsolo: () => void
}

export const MundoSandboxCena: React.FC<MundoSandboxCenaProps> = ({
  state,
  lagoas,
  recursos,
  subsoloCentro,
  modoBloco,
  onEditarBloco,
  onPedirSubsolo,
}) => {
  const olharEfetivo = state.semCorpo ? 'imperio' : state.olhar
  const noSubsolo = !state.semCorpo && state.heroi.y < -0.9

  return (
    <group>
      {/* 1. Água Rasa (Lagoas e Riachos Rasos) */}
      {lagoas.map((lagoa, idx) => {
        const visivel = !PARTIDA.nuvem || chaoRevelado(state, lagoa.x, lagoa.z)
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

      {/* 2. Recursos Naturais: Árvores (Madeira) e Veios de Ouro (Superfície + Subsolo) */}
      {recursos.map((rec) => {
        const ehSubsolo = rec.yBase < -0.9
        if (ehSubsolo && !noSubsolo) return null
        if (!ehSubsolo && PARTIDA.nuvem && !chaoRevelado(state, rec.x, rec.z)) return null

        if (rec.tipo === 'arvore') {
          if (rec.hp <= 0) {
            return (
              <mesh key={`rec-${rec.id}`} position={[rec.x, rec.yBase + 0.14, rec.z]} raycast={() => null}>
                <cylinderGeometry args={[0.28, 0.34, 0.28, 8]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
            )
          }
          return (
            <group key={`rec-${rec.id}`} position={[rec.x, rec.yBase, rec.z]}>
              <mesh position={[0, 0.65, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.24, 0.32, 1.3, 8]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0, 1.45, 0]} raycast={() => null}>
                <coneGeometry args={[0.95, 1.15, 8]} />
                <meshStandardMaterial color="#15803d" />
              </mesh>
              <mesh position={[0, 2.05, 0]} raycast={() => null}>
                <coneGeometry args={[0.72, 0.95, 8]} />
                <meshStandardMaterial color="#22c55e" />
              </mesh>
            </group>
          )
        }

        // Veio / Rocha de Ouro
        if (rec.hp <= 0) {
          return (
            <mesh key={`rec-${rec.id}`} position={[rec.x, rec.yBase + 0.08, rec.z]} raycast={() => null}>
              <cylinderGeometry args={[0.42, 0.5, 0.16, 7]} />
              <meshStandardMaterial color="#44403c" />
            </mesh>
          )
        }
        return (
          <group key={`rec-${rec.id}`} position={[rec.x, rec.yBase, rec.z]}>
            <mesh position={[0, 0.38, 0]} raycast={() => null}>
              <dodecahedronGeometry args={[0.58, 0]} />
              <meshStandardMaterial color="#57534e" roughness={0.85} />
            </mesh>
            <mesh position={[0.18, 0.66, 0.1]} rotation={[0.3, 0.4, -0.2]} raycast={() => null}>
              <octahedronGeometry args={[0.26, 0]} />
              <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.45} metalness={0.5} roughness={0.25} />
            </mesh>
            <mesh position={[-0.2, 0.56, -0.14]} rotation={[-0.2, 0.2, 0.35]} raycast={() => null}>
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
        const temVoxel = Boolean((obra as Obra & { blocosNv5?: Uint8Array }).blocosNv5)
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
                position={[obra.x, 0.04, obra.z + 1.65]}
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

      {/* 5. Construções Nível 5+ Entráveis e Editáveis Bloco-a-Bloco (7x5x7) */}
      {state.obras.map((obra) => {
        const blocos = (obra as Obra & { blocosNv5?: Uint8Array }).blocosNv5
        if (!blocos || obra.hp <= 0 || obraEmConstrucao(obra)) return null
        if (obra.lado === 'inimigo' && PARTIDA.nuvem && !cobertoAgora(state, obra.x, obra.z)) return null

        const { nx, ny, nz, passo } = VOXEL_NV5
        const itens: { bx: number; by: number; bz: number; val: number; x: number; y: number; z: number }[] = []
        for (let by = 0; by < ny; by++) {
          for (let bz = 0; bz < nz; bz++) {
            for (let bx = 0; bx < nx; bx++) {
              const val = blocos[indiceVoxelLocal(bx, by, bz)]
              if (val === 0) continue
              const c = centroBlocoMundo(obra.x, obra.z, bx, by, bz)
              itens.push({ bx, by, bz, val, x: c.x, y: c.y, z: c.z })
            }
          }
        }

        return (
          <group key={`fortaleza-nv5-${obra.id}`}>
            {itens.map((b) => (
              <mesh
                key={`${b.bx}-${b.by}-${b.bz}`}
                position={[b.x, b.y, b.z]}
                onClick={(event) => {
                  if (!modoBloco) return
                  event.stopPropagation()
                  if (modoBloco === 'remover') {
                    onEditarBloco(obra.id, b.bx, b.by, b.bz, 'remover')
                    return
                  }
                  const n = event.face?.normal
                  const dbx = n ? Math.round(n.x) : 0
                  const dby = n ? Math.round(n.y) : 1
                  const dbz = n ? Math.round(n.z) : 0
                  onEditarBloco(obra.id, b.bx + dbx, b.by + dby, b.bz + dbz, 'adicionar')
                }}
              >
                <boxGeometry args={[passo * 0.98, passo * 0.98, passo * 0.98]} />
                <meshStandardMaterial
                  color={b.val === 2 ? '#d97706' : b.by === 4 ? '#facc15' : '#cbd5e1'}
                  roughness={0.75}
                />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}
