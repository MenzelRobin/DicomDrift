import * as THREE from 'three'

export interface SceneContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  pivot: THREE.Group
  envMap: THREE.Texture | null
}

function generateEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  // Create a simple gradient environment for subtle reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  pmremGenerator.compileEquirectangularShader()

  const envScene = new THREE.Scene()

  // Dark gradient environment — warm top, cool bottom
  const topColor = new THREE.Color(0x1a1a2e)
  const bottomColor = new THREE.Color(0x0a0a14)
  const midColor = new THREE.Color(0x16182a)

  const hemiLight = new THREE.HemisphereLight(topColor, bottomColor, 1.0)
  envScene.add(hemiLight)

  // Add subtle warm point to simulate key light reflection
  const warmLight = new THREE.PointLight(0x443322, 0.5, 100)
  warmLight.position.set(5, 3, 5)
  envScene.add(warmLight)

  const coolLight = new THREE.PointLight(0x222233, 0.3, 100)
  coolLight.position.set(-5, -2, -3)
  envScene.add(coolLight)

  // Background gradient sphere
  const bgGeo = new THREE.SphereGeometry(20, 32, 32)
  const bgMat = new THREE.MeshBasicMaterial({
    color: midColor,
    side: THREE.BackSide,
  })
  envScene.add(new THREE.Mesh(bgGeo, bgMat))

  const renderTarget = pmremGenerator.fromScene(envScene, 0.04)
  pmremGenerator.dispose()
  bgGeo.dispose()
  bgMat.dispose()

  return renderTarget.texture
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3000)
  camera.position.set(0, 0, 195)
  camera.lookAt(0, 0, 0)

  const pivot = new THREE.Group()
  scene.add(pivot)

  // Environment map for PBR reflections
  const envMap = generateEnvMap(renderer)
  scene.environment = envMap

  // Hemisphere light for soft ambient (warm top, cool bottom)
  const hemi = new THREE.HemisphereLight(0xc8b898, 0x283848, 0.6)
  scene.add(hemi)

  // Key light (warm, strong)
  const key = new THREE.DirectionalLight(0xfff5e8, 1.2)
  key.position.set(1.5, 1, 2)
  scene.add(key)

  // Fill light (cool, softer)
  const fill = new THREE.DirectionalLight(0x8899bb, 0.4)
  fill.position.set(-2, 0.5, -1)
  scene.add(fill)

  // Rim/back light (subtle edge definition)
  const rim = new THREE.DirectionalLight(0xffeedd, 0.3)
  rim.position.set(0, -1, -2)
  scene.add(rim)

  return { renderer, scene, camera, pivot, envMap }
}

export function resizeRenderer(ctx: SceneContext, width: number, height: number) {
  ctx.renderer.setSize(width, height, false)
  ctx.camera.aspect = width / height
  ctx.camera.updateProjectionMatrix()
}

export function disposeScene(ctx: SceneContext) {
  ctx.renderer.dispose()
  ctx.envMap?.dispose()
}
