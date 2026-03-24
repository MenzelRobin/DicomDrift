import * as THREE from 'three'

const DAMP = 0.82
const LROT = 0.16
const LPAN = 0.15
const LZOOM = 0.11
const PAN_SPEED = 0.0011
const MOUSE_SPEED = 1.8
const TOUCH_SPEED = 2.0
const MIN_DIST = 25
const MAX_DIST = 700

const HOME_DIST = 195

// DICOM HFS coordinate system:
//   X+ = Patient Left, Y+ = Patient Posterior, Z+ = Patient Superior
// Camera sits at (0, 0, dist) looking at origin. Screen up = Y+, right = X+.
// View orientations rotate the MODEL so the correct face points at camera.
function quatFromMatrix(
  sx: [number, number, number],
  sy: [number, number, number],
  sz: [number, number, number],
): THREE.Quaternion {
  const m = new THREE.Matrix4().set(
    sx[0], sy[0], sz[0], 0,
    sx[1], sy[1], sz[1], 0,
    sx[2], sy[2], sz[2], 0,
    0, 0, 0, 1,
  )
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

export const VIEW_ORIENTATIONS: Record<string, { quat: THREE.Quaternion; label: string; icon: string }> = {
  // Anterior (face): DICOM-X→screenX, DICOM-Z→screenY (up), -DICOM-Y→screenZ (toward cam)
  anterior: { quat: quatFromMatrix([1, 0, 0], [0, 0, 1], [0, -1, 0]), label: 'Anterior', icon: 'A' },
  // Posterior (back of head): -DICOM-X→screenX, DICOM-Z→screenY, DICOM-Y→screenZ
  posterior: { quat: quatFromMatrix([-1, 0, 0], [0, 0, 1], [0, 1, 0]), label: 'Posterior', icon: 'P' },
  // Right (patient's right ear): DICOM-Y→screenX, DICOM-Z→screenY, DICOM-X→screenZ
  right: { quat: quatFromMatrix([0, -1, 0], [0, 0, 1], [-1, 0, 0]), label: 'Right', icon: 'R' },
  // Left (patient's left ear): -DICOM-Y→screenX, DICOM-Z→screenY, -DICOM-X→screenZ
  left: { quat: quatFromMatrix([0, 1, 0], [0, 0, 1], [1, 0, 0]), label: 'Left', icon: 'L' },
  // Superior (top of head): DICOM-X→screenX, -DICOM-Y→screenY, -DICOM-Z→screenZ
  superior: { quat: quatFromMatrix([1, 0, 0], [0, -1, 0], [0, 0, -1]), label: 'Superior', icon: 'S' },
  // Inferior (chin): DICOM-X→screenX, DICOM-Y→screenY, DICOM-Z→screenZ
  inferior: { quat: quatFromMatrix([1, 0, 0], [0, 1, 0], [0, 0, 1]), label: 'Inferior', icon: 'I' },
}

const HOME_QUAT = VIEW_ORIENTATIONS.anterior.quat.clone()

export interface ArcballState {
  currentQuat: THREE.Quaternion
  targetQuat: THREE.Quaternion
  velocityQuat: THREE.Quaternion
  panTarget: THREE.Vector3
  panCurrent: THREE.Vector3
  distTarget: number
  distCurrent: number
  homeDist: number
}

export function createArcballState(): ArcballState {
  return {
    currentQuat: HOME_QUAT.clone(),
    targetQuat: HOME_QUAT.clone(),
    velocityQuat: new THREE.Quaternion(),
    panTarget: new THREE.Vector3(),
    panCurrent: new THREE.Vector3(),
    distTarget: HOME_DIST,
    distCurrent: HOME_DIST,
    homeDist: HOME_DIST,
  }
}

function projectToSphere(x: number, y: number): THREE.Vector3 {
  const len2 = x * x + y * y
  if (len2 <= 1) {
    return new THREE.Vector3(x, y, Math.sqrt(1 - len2))
  }
  const len = Math.sqrt(len2)
  return new THREE.Vector3(x / len, y / len, 0)
}

function arcballRotation(
  fromX: number, fromY: number,
  toX: number, toY: number,
  speed: number,
): THREE.Quaternion {
  const v0 = projectToSphere(fromX * speed, fromY * speed)
  const v1 = projectToSphere(toX * speed, toY * speed)
  const axis = new THREE.Vector3().crossVectors(v0, v1)
  const dot = Math.min(1, Math.max(-1, v0.dot(v1)))
  const angle = Math.acos(dot)
  if (axis.lengthSq() < 1e-10) return new THREE.Quaternion()
  axis.normalize()
  return new THREE.Quaternion().setFromAxisAngle(axis, angle)
}

export function attachControls(
  canvas: HTMLCanvasElement,
  state: ArcballState,
): () => void {
  let isDragging = false
  let isRightDrag = false
  let prevX = 0
  let prevY = 0
  let lastDeltaQuat = new THREE.Quaternion()

  // Touch state
  let activeTouches: Touch[] = []
  let initialPinchDist = 0
  let initialPinchCenter = { x: 0, y: 0 }

  function toNDC(clientX: number, clientY: number): [number, number] {
    const rect = canvas.getBoundingClientRect()
    return [
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    ]
  }

  // ---- Mouse ----
  function onMouseDown(e: MouseEvent) {
    isDragging = true
    isRightDrag = e.button === 2
    prevX = e.clientX
    prevY = e.clientY
    lastDeltaQuat = new THREE.Quaternion()
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return

    if (isRightDrag) {
      // Pan
      const dx = (e.clientX - prevX) * PAN_SPEED * state.distCurrent
      const dy = -(e.clientY - prevY) * PAN_SPEED * state.distCurrent
      state.panTarget.x += dx
      state.panTarget.y += dy
    } else {
      // Rotate
      const [fx, fy] = toNDC(prevX, prevY)
      const [tx, ty] = toNDC(e.clientX, e.clientY)
      const dq = arcballRotation(fx, fy, tx, ty, MOUSE_SPEED)
      state.targetQuat.premultiply(dq)
      lastDeltaQuat.copy(dq)
    }
    prevX = e.clientX
    prevY = e.clientY
  }

  function onMouseUp() {
    if (isDragging && !isRightDrag) {
      state.velocityQuat.copy(lastDeltaQuat)
    }
    isDragging = false
    isRightDrag = false
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.08 : 0.93
    state.distTarget = Math.max(MIN_DIST, Math.min(MAX_DIST, state.distTarget * factor))
  }

  function onDblClick() {
    resetView(state)
  }

  function onContextMenu(e: Event) {
    e.preventDefault()
  }

  // ---- Touch ----
  function touchDist(t: Touch[]): number {
    if (t.length < 2) return 0
    const dx = t[1].clientX - t[0].clientX
    const dy = t[1].clientY - t[0].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function touchCenter(t: Touch[]): { x: number; y: number } {
    if (t.length < 2) return { x: t[0].clientX, y: t[0].clientY }
    return {
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    }
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault()
    activeTouches = Array.from(e.touches)
    if (activeTouches.length === 1) {
      prevX = activeTouches[0].clientX
      prevY = activeTouches[0].clientY
      lastDeltaQuat = new THREE.Quaternion()
    } else if (activeTouches.length === 2) {
      initialPinchDist = touchDist(activeTouches)
      initialPinchCenter = touchCenter(activeTouches)
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault()
    const touches = Array.from(e.touches)

    if (touches.length === 1) {
      // Rotate
      const [fx, fy] = toNDC(prevX, prevY)
      const [tx, ty] = toNDC(touches[0].clientX, touches[0].clientY)
      const dq = arcballRotation(fx, fy, tx, ty, TOUCH_SPEED)
      state.targetQuat.premultiply(dq)
      lastDeltaQuat.copy(dq)
      prevX = touches[0].clientX
      prevY = touches[0].clientY
    } else if (touches.length === 2) {
      // Pinch zoom
      const dist = touchDist(touches)
      if (initialPinchDist > 0) {
        const ratio = initialPinchDist / dist
        state.distTarget = Math.max(MIN_DIST, Math.min(MAX_DIST, state.distTarget * ratio))
        initialPinchDist = dist
      }

      // Two-finger pan
      const center = touchCenter(touches)
      const dx = (center.x - initialPinchCenter.x) * PAN_SPEED * state.distCurrent
      const dy = -(center.y - initialPinchCenter.y) * PAN_SPEED * state.distCurrent
      state.panTarget.x += dx
      state.panTarget.y += dy
      initialPinchCenter = center
    }

    activeTouches = touches
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length === 0 && activeTouches.length === 1) {
      state.velocityQuat.copy(lastDeltaQuat)
    }
    activeTouches = Array.from(e.touches)
    if (activeTouches.length === 1) {
      prevX = activeTouches[0].clientX
      prevY = activeTouches[0].clientY
    }
  }

  // Double-tap detection
  let lastTapTime = 0
  function onTouchEndDoubleTap(e: TouchEvent) {
    if (e.touches.length === 0) {
      const now = Date.now()
      if (now - lastTapTime < 300) {
        resetView(state)
      }
      lastTapTime = now
    }
  }

  canvas.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('dblclick', onDblClick)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd)
  canvas.addEventListener('touchend', onTouchEndDoubleTap)

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('dblclick', onDblClick)
    canvas.removeEventListener('contextmenu', onContextMenu)
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
    canvas.removeEventListener('touchend', onTouchEndDoubleTap)
  }
}

export function resetView(state: ArcballState) {
  state.targetQuat.copy(HOME_QUAT)
  state.velocityQuat.set(0, 0, 0, 1)
  state.panTarget.set(0, 0, 0)
  state.distTarget = state.homeDist
}

export function setView(state: ArcballState, name: string) {
  const view = VIEW_ORIENTATIONS[name]
  if (!view) return
  state.targetQuat.copy(view.quat)
  state.velocityQuat.set(0, 0, 0, 1)
  state.panTarget.set(0, 0, 0)
}

export function fitToSphere(state: ArcballState, radius: number) {
  // Place camera far enough to see the whole bounding sphere
  // FOV is 42deg, so half-angle is 21deg
  const fovRad = (42 / 2) * (Math.PI / 180)
  const dist = (radius / Math.sin(fovRad)) * 1.15 // 15% padding
  state.homeDist = dist
  state.distTarget = dist
  state.distCurrent = dist
  // Reset pan so model stays centered after regeneration
  state.panTarget.set(0, 0, 0)
  state.panCurrent.set(0, 0, 0)
}

// Hoisted identity quaternion to avoid per-frame allocation
const IDENTITY_QUAT = new THREE.Quaternion()

export function updateArcball(
  state: ArcballState,
  pivot: THREE.Group,
  camera: THREE.PerspectiveCamera,
) {
  // Apply inertia
  state.velocityQuat.slerp(IDENTITY_QUAT, 1 - DAMP)
  if (Math.abs(1 - state.velocityQuat.w) > 0.0001) {
    state.targetQuat.premultiply(state.velocityQuat)
  }

  // Smooth interpolation
  state.currentQuat.slerp(state.targetQuat, LROT)
  state.panCurrent.lerp(state.panTarget, LPAN)
  state.distCurrent += (state.distTarget - state.distCurrent) * LZOOM

  // Apply to scene
  pivot.quaternion.copy(state.currentQuat)
  camera.position.set(
    state.panCurrent.x,
    state.panCurrent.y,
    state.panCurrent.z + state.distCurrent,
  )
  camera.lookAt(state.panCurrent.x, state.panCurrent.y, state.panCurrent.z)
}
