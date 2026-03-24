import * as THREE from 'three'

export interface SceneContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  pivot: THREE.Group
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x080810, 1)
  renderer.localClippingEnabled = true

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3000)
  camera.position.set(0, 0, 195)
  camera.lookAt(0, 0, 0)

  const pivot = new THREE.Group()
  scene.add(pivot)

  // 4-point lighting
  const ambient = new THREE.AmbientLight(0x334466, 0.75)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(1, -0.8, 1.4)
  scene.add(sun)

  const fill = new THREE.DirectionalLight(0x5577cc, 0.4)
  fill.position.set(-1, 1, -0.6)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffeecc, 0.2)
  rim.position.set(0, 1.2, -1)
  scene.add(rim)

  return { renderer, scene, camera, pivot }
}

export function resizeRenderer(ctx: SceneContext, width: number, height: number) {
  ctx.renderer.setSize(width, height, false)
  ctx.camera.aspect = width / height
  ctx.camera.updateProjectionMatrix()
}

export function disposeScene(ctx: SceneContext) {
  ctx.renderer.dispose()
  ctx.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose())
      } else {
        obj.material.dispose()
      }
    }
  })
}
