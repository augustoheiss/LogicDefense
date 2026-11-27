import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import {
  CylinderGeometry,
  DodecahedronGeometry,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  RingGeometry,
} from 'three'
import type { LagoaRasa } from '../biomaRecursos'
import { chaoRevelado, cobertoAgora, obraEmConstrucao, type Obra, type PartidaState } from '../partidaSim'
import { semRaycast } from '../raycastCena'
import { desnivelDaObraNoChao } from '../relevo/alturaVisual'
import type { ChaoDoDesenho } from '../relevo/alturaVisual'
import {
  calcularCurvaConstrucao,
  classificarSuporteObra,
  pegadaEfetivaFundacao,
  posicoesEstacasPier,
  type TipoSuporteFundacao,
  Y_AGUA_VISUAL,
  Y_SOLO_VISUAL,
} from './suporteFundacao'
import type { PacoteTexturasBlocos } from './texturasPbrProcedural'

interface GeosFundacaoCompartilhadas {
  estaca: CylinderGeometry
  bracadeira: CylinderGeometry
  anelOnda: RingGeometry
  poeira: DodecahedronGeometry
  baliza: CylinderGeometry
  pontaBaliza: DodecahedronGeometry
}

const ANGULOS_PARTICULA: readonly number[] = [0, 1.05, 2.09, 3.14, 4.19, 5.24]

const AnimacaoChaoConstrucao: React.FC<{
  dim: readonly [number, number, number]
  suporte: TipoSuporteFundacao
  progresso: number
  geos: GeosFundacaoCompartilhadas
}> = ({ dim, suporte, progresso, geos }) => {
  const ondaARef = useRef<Mesh>(null)
  const ondaBRef = useRef<Mesh>(null)
  const matARef = useRef<MeshBasicMaterial>(null)
  const matBRef = useRef<MeshBasicMaterial>(null)
  const particulasRef = useRef<(Mesh | null)[]>([])

  const raioBase = Math.max(dim[0], dim[2]) * 0.65
  const ySuperficie = suporte === 'agua' ? Y_AGUA_VISUAL + 0.015 : Y_SOLO_VISUAL + 0.032
  const corOnda = suporte === 'agua' ? '#bae6fd' : '#f59e0b'
  const corOndaSec = suporte === 'agua' ? '#7dd3fc' : '#e5c07b'
  const corPoeira = suporte === 'agua' ? '#e0f2fe' : '#d6b484'

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const curva = calcularCurvaConstrucao(progresso, t)

    if (ondaARef.current && matARef.current) {
      const sA = raioBase * curva.pulsoOndaA
      ondaARef.current.scale.set(sA, sA, 1)
      matARef.current.opacity = curva.opacidadeOndaA
    }
    if (ondaBRef.current && matBRef.current) {
      const sB = raioBase * curva.pulsoOndaB
      ondaBRef.current.scale.set(sB, sB, 1)
      matBRef.current.opacity = curva.opacidadeOndaB
    }

    for (let i = 0; i < ANGULOS_PARTICULA.length; i += 1) {
      const m = particulasRef.current[i]
      if (!m) continue
      const ciclo = (t * 1.15 + i * 0.167) % 1
      const ang = ANGULOS_PARTICULA[i] + t * 0.55
      const r = raioBase * (0.72 + ciclo * 0.55)
      m.position.set(Math.cos(ang) * r, ySuperficie + 0.06 + Math.sin(ciclo * Math.PI) * 0.42, Math.sin(ang) * r)
      const s = (1 - ciclo * 0.55) * 0.85
      m.scale.set(s, s, s)
    }
  })

  const balizaX = dim[0] * 0.5 + 0.48
  const balizaZ = dim[2] * 0.5 + 0.48

  return (
    <group>
      <mesh ref={ondaARef} position={[0, ySuperficie, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={geos.anelOnda} raycast={semRaycast}>
        <meshBasicMaterial ref={matARef} color={corOnda} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={ondaBRef} position={[0, ySuperficie + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={geos.anelOnda} raycast={semRaycast}>
        <meshBasicMaterial ref={matBRef} color={corOndaSec} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {ANGULOS_PARTICULA.map((_, idx) => (
        <mesh
          key={`po-${idx}`}
          ref={(node) => {
            particulasRef.current[idx] = node
          }}
          position={[0, ySuperficie + 0.08, 0]}
          geometry={geos.poeira}
          raycast={semRaycast}
        >
          <meshStandardMaterial color={corPoeira} roughness={0.9} transparent opacity={0.85} />
        </mesh>
      ))}
      {([-balizaX, balizaX] as const).map((bx) =>
        ([-balizaZ, balizaZ] as const).map((bz) => (
          <group key={`bal-${bx}-${bz}`} position={[bx, Y_SOLO_VISUAL + 0.22, bz]}>
            <mesh geometry={geos.baliza} raycast={semRaycast}>
              <meshStandardMaterial color="#78350f" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.24, 0]} geometry={geos.pontaBaliza} raycast={semRaycast}>
              <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.45} />
            </mesh>
          </group>
        )),
      )}
    </group>
  )
}

const FundacaoObraItem: React.FC<{
  obra: Obra
  suporte: TipoSuporteFundacao
  pegada: { readonly cx: number; readonly cz: number; readonly dim: readonly [number, number, number] }
  texturasBlocos: PacoteTexturasBlocos | null
  sombrasAtivas: boolean
  geos: GeosFundacaoCompartilhadas
  /** O desnível do relevo no CENTRO da pegada (Task 4). 0 sem campo: a fundação é a de hoje (I1). Entra UMA vez, no grupo pai: os filhos usam `Y_SOLO_VISUAL + k` relativos a ele. */
  desnivel?: number
}> = ({ obra, suporte, pegada, texturasBlocos, sombrasAtivas, geos, desnivel = 0 }) => {
  const marolaRef = useRef<Mesh>(null)
  const baseGrupoRef = useRef<Group>(null)

  const dim = pegada.dim
  const ruina = obra.hp <= 0
  const construindo = obraEmConstrucao(obra)
  const total = Math.max(0.01, obra.construindoTotal ?? 1)
  const progresso = construindo ? Math.max(0.08, 1 - (obra.construindoRestante ?? 0) / total) : 1
  const texChave = texturasBlocos ? `pbr-${texturasBlocos.resolucao}` : 'flat'

  useFrame(({ clock }) => {
    if (marolaRef.current) {
      const pulso = 1 + Math.sin(clock.elapsedTime * 2.4 + obra.id * 0.7) * 0.045
      marolaRef.current.scale.set(dim[0] * 0.65 * pulso, dim[2] * 0.65 * pulso, 1)
    }
    if (baseGrupoRef.current) {
      const escalaY = construindo ? calcularCurvaConstrucao(progresso, clock.elapsedTime).escalaAlicerceY : 1
      baseGrupoRef.current.scale.set(1, escalaY, 1)
    }
  })

  if (suporte === 'agua') {
    const estacas = posicoesEstacasPier(dim)
    const corMadeira = ruina
      ? '#3f2e21'
      : obra.lado === 'inimigo'
        ? '#5b2b2b'
        : construindo
          ? '#a16207'
          : '#8c5a32'
    const texMadeira = texturasBlocos?.madeiraPier

    return (
      <group position={[pegada.cx, desnivel, pegada.cz]}>
        {/* Marola na superfície da água ao redor das palafitas */}
        <mesh
          ref={marolaRef}
          position={[0, Y_AGUA_VISUAL + 0.008, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[dim[0] * 0.65, dim[2] * 0.65, 1]}
          geometry={geos.anelOnda}
          raycast={semRaycast}
        >
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.42} depthWrite={false} />
        </mesh>

        {/* Estrutura de píer/palafita crescendo a partir do leito (y = -0.45) até y = 0.02 */}
        <group position={[0, Y_SOLO_VISUAL, 0]} ref={baseGrupoRef}>
          {estacas.map(([px, pz], idx) => (
            <group key={`est-${idx}`} position={[px, 0.18, pz]}>
              <mesh geometry={geos.estaca} castShadow={sombrasAtivas} raycast={semRaycast}>
                <meshStandardMaterial
                  key={`est-${texChave}`}
                  color={corMadeira}
                  map={texMadeira?.map ?? null}
                  normalMap={texMadeira?.normalMap ?? null}
                  roughnessMap={texMadeira?.roughnessMap ?? null}
                  roughness={0.78}
                  metalness={0.08}
                />
              </mesh>
              <mesh position={[0, 0.09, 0]} geometry={geos.bracadeira} raycast={semRaycast}>
                <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.38} />
              </mesh>
            </group>
          ))}

          {/* Travessas horizontais entre as palafitas acima da água */}
          <mesh position={[0, 0.22, dim[2] * 0.44]} raycast={semRaycast}>
            <boxGeometry args={[dim[0] * 0.92, 0.08, 0.09]} />
            <meshStandardMaterial color={corMadeira} roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.22, -dim[2] * 0.44]} raycast={semRaycast}>
            <boxGeometry args={[dim[0] * 0.92, 0.08, 0.09]} />
            <meshStandardMaterial color={corMadeira} roughness={0.82} />
          </mesh>
          <mesh position={[dim[0] * 0.44, 0.22, 0]} raycast={semRaycast}>
            <boxGeometry args={[0.09, 0.08, dim[2] * 0.92]} />
            <meshStandardMaterial color={corMadeira} roughness={0.82} />
          </mesh>
          <mesh position={[-dim[0] * 0.44, 0.22, 0]} raycast={semRaycast}>
            <boxGeometry args={[0.09, 0.08, dim[2] * 0.92]} />
            <meshStandardMaterial color={corMadeira} roughness={0.82} />
          </mesh>

          {/* Tablado e vigas de apoio diretamente sob a construção */}
          {!ruina && (
            <>
              <mesh position={[0, 0.41, 0]} receiveShadow={sombrasAtivas} castShadow={sombrasAtivas} raycast={semRaycast}>
                <boxGeometry args={[dim[0] + 0.64, 0.11, dim[2] + 0.64]} />
                <meshStandardMaterial
                  key={`deck-${texChave}`}
                  color={corMadeira}
                  map={texMadeira?.map ?? null}
                  normalMap={texMadeira?.normalMap ?? null}
                  roughnessMap={texMadeira?.roughnessMap ?? null}
                  roughness={0.72}
                  metalness={0.06}
                />
              </mesh>
              <mesh position={[0, 0.33, -dim[2] * 0.28]} raycast={semRaycast}>
                <boxGeometry args={[dim[0] + 0.52, 0.08, 0.14]} />
                <meshStandardMaterial color="#4a2c16" roughness={0.86} />
              </mesh>
              <mesh position={[0, 0.33, dim[2] * 0.28]} raycast={semRaycast}>
                <boxGeometry args={[dim[0] + 0.52, 0.08, 0.14]} />
                <meshStandardMaterial color="#4a2c16" roughness={0.86} />
              </mesh>
            </>
          )}
        </group>

        {construindo && (
          <AnimacaoChaoConstrucao dim={dim} suporte="agua" progresso={progresso} geos={geos} />
        )}
      </group>
    )
  }

  // Fundação em terra: altera textura do chão em y = -0.435 + embasamento de cantaria de -0.46 até +0.02
  const corCanteiro = ruina
    ? '#574c48'
    : obra.lado === 'inimigo'
      ? '#7c5c5c'
      : construindo
        ? '#c79b63'
        : '#cec0a8'
  const corPedra = ruina
    ? '#44403c'
    : obra.lado === 'inimigo'
      ? '#6b474c'
      : '#b8c0cc'
  const texCanteiro = texturasBlocos?.canteiro
  const texPedra = texturasBlocos?.fundacaoPedra
  const largCanteiro = dim[0] + 1.48
  const profCanteiro = dim[2] + 1.48

  return (
    <group position={[pegada.cx, desnivel, pegada.cz]}>
      {/* Chão alterado sob a obra (terraplanagem / calçamento com textura própria) */}
      <mesh position={[0, Y_SOLO_VISUAL + 0.014, 0]} receiveShadow={sombrasAtivas} raycast={semRaycast}>
        <boxGeometry args={[largCanteiro, 0.032, profCanteiro]} />
        <meshStandardMaterial
          key={`cant-${texChave}`}
          color={corCanteiro}
          map={texCanteiro?.map ?? null}
          normalMap={texCanteiro?.normalMap ?? null}
          roughnessMap={texCanteiro?.roughnessMap ?? null}
          roughness={0.9}
          metalness={0.04}
        />
      </mesh>

      {/* Meio-fio de pedra contornando a área escavada */}
      <mesh position={[0, Y_SOLO_VISUAL + 0.036, -profCanteiro / 2 + 0.07]} raycast={semRaycast}>
        <boxGeometry args={[largCanteiro + 0.04, 0.055, 0.14]} />
        <meshStandardMaterial color="#78716c" roughness={0.88} />
      </mesh>
      <mesh position={[0, Y_SOLO_VISUAL + 0.036, profCanteiro / 2 - 0.07]} raycast={semRaycast}>
        <boxGeometry args={[largCanteiro + 0.04, 0.055, 0.14]} />
        <meshStandardMaterial color="#78716c" roughness={0.88} />
      </mesh>
      <mesh position={[-largCanteiro / 2 + 0.07, Y_SOLO_VISUAL + 0.036, 0]} raycast={semRaycast}>
        <boxGeometry args={[0.14, 0.055, profCanteiro - 0.22]} />
        <meshStandardMaterial color="#78716c" roughness={0.88} />
      </mesh>
      <mesh position={[largCanteiro / 2 - 0.07, Y_SOLO_VISUAL + 0.036, 0]} raycast={semRaycast}>
        <boxGeometry args={[0.14, 0.055, profCanteiro - 0.22]} />
        <meshStandardMaterial color="#78716c" roughness={0.88} />
      </mesh>

      {/* Oclusão de contato encostada no terreno */}
      <mesh position={[0, Y_SOLO_VISUAL + 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={semRaycast}>
        <circleGeometry args={[Math.max(dim[0], dim[2]) * 0.72, 18]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.2} depthWrite={false} />
      </mesh>

      {/* Embasamento de alvenaria escalonado ancorado no chão (y = -0.45) */}
      <group position={[0, Y_SOLO_VISUAL, 0]} ref={baseGrupoRef}>
        {ruina ? (
          <mesh position={[0, 0.12, 0]} receiveShadow={sombrasAtivas} raycast={semRaycast}>
            <boxGeometry args={[dim[0] + 0.36, 0.24, dim[2] + 0.36]} />
            <meshStandardMaterial
              key={`ruina-${texChave}`}
              color={corPedra}
              map={texPedra?.map ?? null}
              normalMap={texPedra?.normalMap ?? null}
              roughness={0.94}
            />
          </mesh>
        ) : (
          <>
            <mesh position={[0, 0.115, 0]} receiveShadow={sombrasAtivas} castShadow={sombrasAtivas} raycast={semRaycast}>
              <boxGeometry args={[dim[0] + 0.56, 0.25, dim[2] + 0.56]} />
              <meshStandardMaterial
                key={`al1-${texChave}`}
                color={corPedra}
                map={texPedra?.map ?? null}
                normalMap={texPedra?.normalMap ?? null}
                roughnessMap={texPedra?.roughnessMap ?? null}
                roughness={0.84}
                metalness={0.08}
              />
            </mesh>
            <mesh position={[0, 0.34, 0]} receiveShadow={sombrasAtivas} castShadow={sombrasAtivas} raycast={semRaycast}>
              <boxGeometry args={[dim[0] + 0.22, 0.26, dim[2] + 0.22]} />
              <meshStandardMaterial
                key={`al2-${texChave}`}
                color={corPedra}
                map={texPedra?.map ?? null}
                normalMap={texPedra?.normalMap ?? null}
                roughnessMap={texPedra?.roughnessMap ?? null}
                roughness={0.82}
                metalness={0.08}
              />
            </mesh>
          </>
        )}
      </group>

      {construindo && (
        <AnimacaoChaoConstrucao dim={dim} suporte="terra" progresso={progresso} geos={geos} />
      )}
    </group>
  )
}

/**
 * Renderiza o suporte aterrado (alvenaria com solo alterado em terra ou píer com palafitas em água)
 * e as animações de obra no chão para todas as construções visíveis no mapa.
 */
export const FundacoesObrasCena: React.FC<{
  state: PartidaState
  lagoas: readonly LagoaRasa[]
  texturasBlocos?: PacoteTexturasBlocos | null
  sombrasAtivas?: boolean
  /** O campo de relevo do quadrado (Task 4). OPCIONAL: sem ele (chave desligada, ou campo ainda gerando) cada fundação fica no plano de hoje (I1). */
  campo?: ChaoDoDesenho
}> = ({ state, lagoas, texturasBlocos = null, sombrasAtivas = false, campo }) => {
  const geos = useMemo<GeosFundacaoCompartilhadas>(
    () => ({
      estaca: new CylinderGeometry(0.11, 0.13, 0.58, 8),
      bracadeira: new CylinderGeometry(0.125, 0.125, 0.07, 8),
      anelOnda: new RingGeometry(0.84, 1.0, 28),
      poeira: new DodecahedronGeometry(0.11, 0),
      baliza: new CylinderGeometry(0.045, 0.055, 0.44, 6),
      pontaBaliza: new DodecahedronGeometry(0.07, 0),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose())
    }
  }, [geos])

  return (
    <group name="fundacoes-obras-cena">
      {state.obras.map((obra) => {
        const ruina = obra.hp <= 0
        const lembrada = chaoRevelado(state, obra.x, obra.z)
        const visivel =
          obra.lado === 'inimigo'
            ? ruina
              ? lembrada
              : cobertoAgora(state, obra.x, obra.z)
            : ruina
              ? lembrada
              : true
        if (!visivel) return null

        const pegada = pegadaEfetivaFundacao(obra)
        const suporte = classificarSuporteObra(lagoas, pegada.cx, pegada.cz, pegada.dim)
        return (
          <FundacaoObraItem
            key={`fund-${obra.id}`}
            obra={obra}
            suporte={suporte}
            pegada={pegada}
            texturasBlocos={texturasBlocos}
            sombrasAtivas={sombrasAtivas}
            geos={geos}
            desnivel={desnivelDaObraNoChao(obra, campo, lagoas)}
          />
        )
      })}
    </group>
  )
}
