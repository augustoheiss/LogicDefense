// ============================================================
// Logic Friction — Touch & Pointer Camera Gesture Gate
// Phase 01 (2.5D Next-Gen & Balanced Mobile Camera)
//
// Solves the 1-finger mobile collision between OrbitControls
// (drag to rotate camera) and Arena floor actions (tap to move
// or build a tower).
//
// Contract:
//   - Tracks pointer down/move/up across the viewport.
//   - Any gesture with > 10px of travel or >= 2 simultaneous
//     touch points is classified as a CAMERA_DRAG_OR_PINCH.
//   - World floor actions (MOVE / BUILD) only commit on clean
//     single-pointer taps (travel <= 10px).
// ============================================================

const TAP_SLOP_PX = 10

interface GestureTracker {
  downX: number
  downY: number
  downTime: number
  maxDragDist: number
  hadMultiTouch: boolean
  isDragging: boolean
  activePointerIds: Set<number>
  lastCameraAzimuth: number
  lastCameraPolar: number
}

const tracker: GestureTracker = {
  downX: 0,
  downY: 0,
  downTime: 0,
  maxDragDist: 0,
  hadMultiTouch: false,
  isDragging: false,
  activePointerIds: new Set<number>(),
  lastCameraAzimuth: 0,
  lastCameraPolar: Math.PI / 4,
}

let listenersAttached = false

export function ensureTouchCameraGateListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return
  listenersAttached = true

  window.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      tracker.activePointerIds.add(e.pointerId)
      if (tracker.activePointerIds.size === 1) {
        tracker.downX = e.clientX
        tracker.downY = e.clientY
        tracker.downTime = performance.now()
        tracker.maxDragDist = 0
        tracker.hadMultiTouch = false
        tracker.isDragging = false
      } else if (tracker.activePointerIds.size >= 2) {
        tracker.hadMultiTouch = true
        tracker.isDragging = true
      }
    },
    { passive: true, capture: true }
  )

  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (!tracker.activePointerIds.has(e.pointerId)) return
      const dx = e.clientX - tracker.downX
      const dy = e.clientY - tracker.downY
      const dist = Math.hypot(dx, dy)
      if (dist > tracker.maxDragDist) {
        tracker.maxDragDist = dist
      }
      if (tracker.maxDragDist > TAP_SLOP_PX) {
        tracker.isDragging = true
      }
    },
    { passive: true, capture: true }
  )

  const handleEnd = (e: PointerEvent) => {
    tracker.activePointerIds.delete(e.pointerId)
    if (tracker.activePointerIds.size === 0) {
      tracker.isDragging = false
    }
  }

  window.addEventListener('pointerup', handleEnd, { passive: true, capture: true })
  window.addEventListener('pointercancel', handleEnd, { passive: true, capture: true })
}

/**
 * Records the start of a pointer interaction on an R3F mesh.
 */
export function recordPointerDown(clientX: number, clientY: number): void {
  ensureTouchCameraGateListeners()
  if (tracker.activePointerIds.size <= 1) {
    tracker.downX = clientX
    tracker.downY = clientY
    tracker.downTime = performance.now()
    tracker.maxDragDist = 0
  }
}

/**
 * Returns true if and only if the current pointerup event represents a clean
 * intentional tap (<= 10px movement, single finger) rather than a camera orbit drag or pinch.
 */
export function isCleanTapGesture(clientX: number, clientY: number, maxSlopPx = TAP_SLOP_PX): boolean {
  if (tracker.hadMultiTouch) return false
  const directDist = Math.hypot(clientX - tracker.downX, clientY - tracker.downY)
  const travel = Math.max(tracker.maxDragDist, directDist)
  return travel <= maxSlopPx
}

/**
 * Returns true while the user is actively dragging or pinching the camera.
 */
export function isCameraGestureActive(): boolean {
  return tracker.isDragging || tracker.activePointerIds.size >= 2
}

/**
 * Updates live camera spherical orientation so HUD compass can read it without React re-renders.
 */
export function setLiveCameraAngles(azimuthRad: number, polarRad: number): void {
  tracker.lastCameraAzimuth = azimuthRad
  tracker.lastCameraPolar = polarRad
}

export function getLiveCameraAngles(): { azimuthRad: number; polarRad: number } {
  return {
    azimuthRad: tracker.lastCameraAzimuth,
    polarRad: tracker.lastCameraPolar,
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__LF_CAM_ANGLES__ = getLiveCameraAngles
}
