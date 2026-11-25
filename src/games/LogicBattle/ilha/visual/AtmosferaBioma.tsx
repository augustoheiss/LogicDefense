import { useFrame, useThree } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import { BackSide, Color, type DirectionalLight, Fog, ShaderMaterial, Vector3 } from 'three'
import type { BiomaId } from '../biomaRecursos'
import { type Olhar, PARTIDA } from '../partidaPolicies'
import { semRaycast } from '../raycastCena'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { direcaoDoSol, posicaoDoSol } from './ceuEIbl'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'

export interface AtmosferaBiomaProps {
  readonly bioma: BiomaId
  readonly olhar: Olhar
  readonly spec: SpecQualidadeGrafica
  readonly focoX: number
  readonly focoZ: number
}

export const AtmosferaBioma: React.FC<AtmosferaBiomaProps> = ({
  bioma,
  olhar,
  spec,
  focoX,
  focoZ,
}) => {
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  const dirLightRef = useRef<DirectionalLight>(null)
  const { camera, scene } = useThree()

  const skyMaterial = useMemo(() => {
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTopo: { value: new Color(cat.ceuTopo) },
        uHorizonte: { value: new Color(cat.ceuHorizonte) },
        uSolCor: { value: new Color(cat.corSol) },
        uSolDir: { value: new Vector3() },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopo;
        uniform vec3 uHorizonte;
        uniform vec3 uSolCor;
        uniform vec3 uSolDir;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos - cameraPosition);
          float h = clamp(dir.y * 0.9 + 0.12, 0.0, 1.0);
          vec3 sky = mix(uHorizonte, uTopo, pow(h, 0.72));
          float sunDot = max(dot(dir, uSolDir), 0.0);
          sky += uSolCor * pow(sunDot, 28.0) * 0.45;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
  }, [])

  useEffect(() => {
    skyMaterial.uniforms.uTopo.value.set(cat.ceuTopo)
    skyMaterial.uniforms.uHorizonte.value.set(cat.ceuHorizonte)
    skyMaterial.uniforms.uSolCor.value.set(cat.corSol)
  }, [skyMaterial, cat.ceuTopo, cat.ceuHorizonte, cat.corSol])

  useEffect(() => {
    return () => {
      skyMaterial.dispose()
    }
  }, [skyMaterial])

  useFrame((state) => {
    // O sol do CÉU e o sol da LUZ saem da mesma função (`ceuEIbl`): o disco que se vê é de onde vem a luz. Antes o disco apontava para uma direção fixa em todos os biomas e só a clareira coincidia.
    // O relógio é o `clock` do R3F (monotônico: um quadro longo não faz o sol saltar). O uniform é escrito ANTES do `return` das sombras: o céu não depende delas.
    const d = direcaoDoSol(bioma, state.clock.elapsedTime)
    skyMaterial.uniforms.uSolDir.value.set(d[0], d[1], d[2])
    const luz = dirLightRef.current
    if (!luz || !spec.sombrasAtivas) return
    const q = 2
    const cx = Math.round(focoX / q) * q
    const cz = Math.round(focoZ / q) * q
    const raio = olhar === 'imperio' ? 50 : 26
    const p = posicaoDoSol(bioma, state.clock.elapsedTime)
    luz.position.set(cx + p[0], p[1], cz + p[2])
    luz.target.position.set(cx, 0, cz)
    luz.target.updateMatrixWorld()
    if (luz.shadow.camera.right !== raio) {
      luz.shadow.camera.left = -raio
      luz.shadow.camera.right = raio
      luz.shadow.camera.top = raio
      luz.shadow.camera.bottom = -raio
      luz.shadow.camera.near = 4
      luz.shadow.camera.far = 140
      luz.shadow.camera.updateProjectionMatrix()
    }
    void camera
  })

  const fogNear = olhar === 'imperio' ? cat.fogNearImperio : cat.fogNearCorpo
  const fogFar = olhar === 'imperio' ? cat.fogFarImperio : cat.fogFarCorpo
  const shadowSize = spec.sombrasAtivas ? spec.shadowMapSize : 512

  // FOG E FUNDO NA CENA (24/11/2026). Medindo a cena viva, `scene.fog` e `scene.background` eram `null`: o `<fog attach="fog">` e o `<color attach="background">` abaixo são anexados ao PAI
  // IMEDIATO, que aqui é o `Group` `cena-bioma-visual` (o R3F não procura a Scene), e `Group.fog`/`Group.background` não são lidos por ninguém. Desde o commit `1fbc372` os números `fogNear*` e
  // `fogFar*` do catálogo (34 m e 98 m na clareira) NUNCA tiveram efeito. Aqui o fog e o fundo vão para a CENA, mas SÓ com a chave `nevoaPintada` ligada (chave desligada = o jogo de hoje, I1,
  // porque ligar o fog muda o visual do jogo inteiro: tudo além de `fogNear` desbota para a cor do horizonte). Ao desligar ou desmontar são devolvidos a `null`.
  useEffect(() => {
    if (!PARTIDA.nevoaPintada) return undefined
    scene.fog = new Fog(cat.fogCor, fogNear, fogFar)
    scene.background = new Color(cat.ceuHorizonte)
    return () => {
      scene.fog = null
      scene.background = null
    }
  }, [scene, cat.fogCor, cat.ceuHorizonte, fogNear, fogFar])

  return (
    <>
      {spec.ceuProcedural && (
        <mesh raycast={semRaycast} material={skyMaterial}>
          <sphereGeometry args={[210, 20, 12]} />
        </mesh>
      )}
      <hemisphereLight args={[cat.luzCeu, cat.luzChao, cat.intensidadeHemisf]} />
      <directionalLight
        ref={dirLightRef}
        position={posicaoDoSol(bioma, 0)}
        intensity={cat.intensidadeSol}
        color={cat.corSol}
        castShadow={spec.sombrasAtivas}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-18, 14, -22]} intensity={0.34} color={cat.luzCeu} />
    </>
  )
}
