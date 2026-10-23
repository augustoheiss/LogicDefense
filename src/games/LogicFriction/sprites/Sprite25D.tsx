// ============================================================
// Logic Friction — 2.5D Volumetric Sprite Rigs
// Phase 01: Multi-Layer Parallax Billboard & Cross-Quad 2.5D
//
// Implements:
//   1. StackedBillboard25D: 3-5 parallel 2D sprite layers spaced
//      along local Z (Δz) inside a pitch-clamped camera-facing rig.
//      Creates genuine stereoscopic 3D parallax when the camera
//      follows the player or orbits 360°.
//   2. CrossQuad25D: Intersecting vertical sprite planes (0°/60°/120°)
//      for architectural bases, pillars, and scenery props.
//
// RAYCAST SAFETY:
//   All visual meshes default to raycast={noRaycast} so transparent
//   quad corners NEVER hijack Arena floor clicks (BUILD / MOVE).
// ============================================================
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  getSharedFlipbookTextures,
  getSharedSpriteTexture,
  getSharedUnitPlaneGeometry,
  noRaycast,
  type LayerSpec25D,
  type SpriteEntityCategory,
} from './spriteAtlasRegistry'

const _worldPos = new THREE.Vector3()

export interface StackedBillboard25DProps {
  layers: LayerSpec25D[]
  position?: [number, number, number]
  yOffset?: number
  scale?: number
  flipX?: boolean
  flipXRef?: React.MutableRefObject<boolean>
  opacity?: number
  tintColor?: string
  tint?: string
  tintRef?: React.MutableRefObject<string | undefined>
  pitchClamp?: number
  squashX?: number
  stretchY?: number
  leanZ?: number
  yawOverride?: number
}

export function StackedBillboard25D({
  layers,
  position = [0, 0, 0],
  yOffset = 0,
  scale = 1,
  flipX = false,
  flipXRef,
  opacity = 1,
  tintColor,
  tint,
  tintRef,
  pitchClamp = -0.38,
  squashX = 1,
  stretchY = 1,
  leanZ = 0,
  yawOverride,
}: StackedBillboard25DProps) {
  const rigRef = useRef<THREE.Group>(null)
  const innerFlipRef = useRef<THREE.Group>(null)
  const meshRefs = useRef<Array<THREE.Mesh | null>>([])
  const { camera } = useThree()
  const resolvedTint = tintColor ?? tint

  const planeGeo = useMemo(() => getSharedUnitPlaneGeometry(), [])
  const textures = useMemo(
    () =>
      layers.map((l) =>
        getSharedSpriteTexture((l.textureKey ?? l.spriteKey ?? 'CORE_CITADEL_BODY') as SpriteEntityCategory)
      ),
    [layers],
  )
  const flipbookSets = useMemo(
    () =>
      layers.map((l) =>
        l.flipbookFps && l.flipbookFps > 0
          ? getSharedFlipbookTextures((l.textureKey ?? l.spriteKey ?? 'CORE_CITADEL_BODY') as SpriteEntityCategory)
          : null
      ),
    [layers],
  )

  useFrame((state, delta) => {
    const rig = rigRef.current
    if (!rig) return

    if (yawOverride !== undefined) {
      rig.rotation.set(pitchClamp, yawOverride, leanZ)
    } else {
      rig.getWorldPosition(_worldPos)
      const dx = camera.position.x - _worldPos.x
      const dz = camera.position.z - _worldPos.z
      const azimuth = Math.atan2(dx, dz)
      rig.rotation.set(pitchClamp, azimuth, leanZ)
    }

    const effectiveFlipX = flipXRef ? flipXRef.current : flipX
    if (innerFlipRef.current) {
      const targetFlip = (effectiveFlipX ? -1 : 1) * scale * squashX
      innerFlipRef.current.scale.set(
        THREE.MathUtils.lerp(innerFlipRef.current.scale.x, targetFlip, Math.min(1, delta * 18)),
        scale * stretchY,
        scale,
      )
    }

    const activeTint = tintRef?.current ?? resolvedTint
    const elapsed = state.clock.elapsedTime
    const instancePhase = Math.abs(_worldPos.x * 0.37 + _worldPos.z * 0.53)
    for (let i = 0; i < layers.length; i++) {
      const spec = layers[i]
      const mesh = meshRefs.current[i]
      if (!mesh) continue

      if (spec.spinSpeed) {
        mesh.rotation.z += delta * spec.spinSpeed
      }
      const bAmp = spec.bobAmp ?? spec.bobAmplitude ?? 0
      if (bAmp && spec.bobSpeed) {
        mesh.position.y = (spec.yOffset ?? 0) + Math.sin(elapsed * spec.bobSpeed + i) * bAmp
      }
      if (spec.pulseSpeed && spec.pulseAmplitude) {
        const p = 1 + Math.sin(elapsed * spec.pulseSpeed + i) * spec.pulseAmplitude
        mesh.scale.set(spec.width * p, spec.height * p, 1)
      }

      const mat = mesh.material as THREE.MeshBasicMaterial
      const fb = flipbookSets[i]
      if (fb && spec.flipbookFps) {
        const frameIdx = Math.floor((elapsed + instancePhase) * spec.flipbookFps) % fb.length
        if (mat.map !== fb[frameIdx]) {
          mat.map = fb[frameIdx]
          mat.needsUpdate = true
        }
      }
      const layerOp = spec.opacityMult ?? spec.opacity ?? 1
      const targetOpacity = opacity * layerOp
      mat.opacity = targetOpacity
      mat.transparent = targetOpacity < 0.99 || !!spec.additive
      if (activeTint && !spec.additive) {
        mat.color.set(activeTint)
      } else if (!activeTint) {
        mat.color.set('#ffffff')
      }
    }
  })

  return (
    <group ref={rigRef} position={[position[0], position[1] + yOffset, position[2]]}>
      <group ref={innerFlipRef} scale={[scale, scale, scale]}>
        {layers.map((spec, idx) => {
          const layerKey = spec.textureKey ?? spec.spriteKey ?? 'CORE_CITADEL_BODY'
          const layerOp = spec.opacityMult ?? spec.opacity ?? 1
          return (
            <mesh
              key={`${layerKey}-${idx}`}
              ref={(el) => {
                meshRefs.current[idx] = el
              }}
              geometry={planeGeo}
              position={[spec.xOffset ?? 0, spec.yOffset ?? 0, spec.zOffset]}
              scale={[spec.width, spec.height, 1]}
              renderOrder={3}
              raycast={noRaycast}
              frustumCulled={false}
            >
              <meshBasicMaterial
                map={textures[idx]}
                transparent={opacity < 0.99 || layerOp < 0.99 || !!spec.additive}
                opacity={opacity * layerOp}
                alphaTest={spec.additive ? 0.01 : (spec.alphaTest ?? 0.12)}
                depthWrite={!spec.additive && opacity * layerOp >= 0.85}
                blending={spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

// ── Cross-Quad 2.5D Component (For Fixed Structures & Scenery Props) ────────────
export interface CrossQuad25DProps {
  textureKey?: SpriteEntityCategory
  spriteKey?: SpriteEntityCategory
  width: number
  height: number
  yOffset?: number
  planes?: 2 | 3
  position?: [number, number, number]
  opacity?: number
  tintColor?: string
  tint?: string
  rotationY?: number
  additive?: boolean
  swaySpeed?: number
  swayAmp?: number
}

export function CrossQuad25D({
  textureKey,
  spriteKey,
  width,
  height,
  yOffset,
  planes = 2,
  position = [0, 0, 0],
  opacity = 1,
  tintColor,
  tint,
  rotationY = 0,
  additive = false,
  swaySpeed = 0,
  swayAmp = 0,
}: CrossQuad25DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const matRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const resolvedKey = (textureKey ?? spriteKey ?? 'PROP_CRYSTAL_CLUSTER') as SpriteEntityCategory
  const resolvedTint = tintColor ?? tint
  const centerOffset = yOffset ?? height / 2

  const planeGeo = useMemo(() => getSharedUnitPlaneGeometry(), [])
  const tex = useMemo(() => getSharedSpriteTexture(resolvedKey), [resolvedKey])

  const angles = useMemo(() => {
    if (planes === 3) return [0, Math.PI / 3, (2 * Math.PI) / 3]
    return [0, Math.PI / 2]
  }, [planes])

  useFrame((state) => {
    if (groupRef.current && swaySpeed > 0 && swayAmp > 0) {
      const t = state.clock.elapsedTime
      groupRef.current.rotation.z = Math.sin(t * swaySpeed + position[0]) * swayAmp
    }
    for (let i = 0; i < matRefs.current.length; i++) {
      const mat = matRefs.current[i]
      if (!mat) continue
      mat.opacity = opacity
      mat.transparent = opacity < 0.99 || additive
      if (resolvedTint) mat.color.set(resolvedTint)
      else mat.color.set('#ffffff')
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {angles.map((rotY, idx) => (
        <mesh
          key={idx}
          geometry={planeGeo}
          position={[0, centerOffset, 0]}
          rotation={[0, rotY, 0]}
          scale={[width, height, 1]}
          renderOrder={2}
          raycast={noRaycast}
        >
          <meshBasicMaterial
            ref={(el) => {
              matRefs.current[idx] = el
            }}
            map={tex}
            transparent={opacity < 0.99 || additive}
            opacity={opacity}
            alphaTest={additive ? 0.02 : 0.14}
            depthWrite={!additive && opacity >= 0.85}
            blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
