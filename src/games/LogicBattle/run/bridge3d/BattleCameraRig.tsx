// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/BattleCameraRig.tsx
// Rig de Câmera 3D Equilibrada (inspirado em LogicFriction) para a Ponte de 3 Rotas.
// Suporta modos BALANCED, LOCKED e FREE, enquadramento horizontal automático
// (Mobile 360x740, Tablet 768x1024, Desktop Widescreen 1440x900+) e bússola [-45° | N | +45°].
// ──────────────────────────────────────────────────────────────────────────────
import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BRIDGE_CAMERA_PRESETS,
  BridgeCameraMode,
  laneNormToWorldX,
} from './bridge3dPolicies'

export interface BattleCameraRigProps {
  readonly mode: BridgeCameraMode
  readonly laneNormX: number
  readonly yawStepDeg: number
  readonly pitchOffsetDeg: number
  readonly zoomMultiplier: number
  readonly isBattlePhase: boolean
}

export const BattleCameraRig: React.FC<BattleCameraRigProps> = ({
  mode,
  laneNormX,
  yawStepDeg,
  pitchOffsetDeg,
  zoomMultiplier,
  isBattlePhase,
}) => {
  const { camera, size } = useThree()
  const smoothedTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.2, -16))
  const smoothedPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 19, 26))

  useFrame((_, delta) => {
    const dt = Math.min(0.1, Math.max(0.004, delta))
    const preset = BRIDGE_CAMERA_PRESETS[mode] ?? BRIDGE_CAMERA_PRESETS.BALANCED
    const aspect = size.width / Math.max(1, size.height)

    // Ajuste automático de FOV e recuo para garantir que as 3 Rotas (largura 24.8m)
    // caibam inteiras tanto em telas retrato (celular) quanto em telas horizontais (telona)
    const portraitPullback = aspect < 0.75 ? 1.48 : aspect < 1.1 ? 1.22 : 1.0
    const targetFov = aspect < 0.85 ? preset.fovMobile : preset.fovDesktop

    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - targetFov) > 0.2) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-8 * dt))
      camera.updateProjectionMatrix()
    }

    const heroWorldX = laneNormToWorldX(laneNormX)
    const followRatio = mode === 'LOCKED' ? 0.22 : mode === 'BALANCED' ? 0.32 : 0.18

    // Durante a fase BATTLE aproximamos levemente o foco para o embate épico
    const battleZoom = isBattlePhase ? 0.88 : 1.0
    const effectiveZoom = THREE.MathUtils.clamp(
      zoomMultiplier * portraitPullback * battleZoom,
      0.65,
      1.75,
    )

    // Ângulo horizontal (Yaw) controlado pela bússola [-45° | N | +45°] ou arraste no topo
    const maxDeg = THREE.MathUtils.radToDeg(preset.maxYawRad)
    const clampedYawDeg =
      mode === 'LOCKED'
        ? 0
        : THREE.MathUtils.clamp(yawStepDeg, -Math.max(45, maxDeg), Math.max(45, maxDeg))
    const yawRad = THREE.MathUtils.degToRad(clampedYawDeg)

    const clampedPitchDeg =
      mode === 'LOCKED' ? 0 : THREE.MathUtils.clamp(pitchOffsetDeg, -18, 22)
    const pitchRad = THREE.MathUtils.degToRad(clampedPitchDeg)

    const baseY = preset.baseOffset[1] * effectiveZoom
    const baseZ = preset.baseOffset[2] * effectiveZoom
    const radiusXZ = baseZ * Math.cos(pitchRad * 0.45)

    const desiredCamX = heroWorldX * followRatio + Math.sin(yawRad) * radiusXZ
    const desiredCamY = Math.max(7.5, baseY + Math.sin(pitchRad) * 8.0)
    const desiredCamZ = 10.5 + Math.cos(yawRad) * radiusXZ

    const desiredLookX = heroWorldX * (followRatio * 0.85)
    const desiredLookY = isBattlePhase ? 2.2 : 1.1
    const desiredLookZ = isBattlePhase ? -24.0 : preset.lookAtZOffset

    const damp = 1 - Math.exp(-7.5 * dt)
    smoothedPosRef.current.lerp(
      new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ),
      damp,
    )
    smoothedTargetRef.current.lerp(
      new THREE.Vector3(desiredLookX, desiredLookY, desiredLookZ),
      damp,
    )

    camera.position.copy(smoothedPosRef.current)
    camera.lookAt(smoothedTargetRef.current)
  })

  return null
}
