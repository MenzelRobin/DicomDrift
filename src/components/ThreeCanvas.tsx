import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { createScene, resizeRenderer, disposeScene, type SceneContext } from '../viewer/sceneSetup'
import { createArcballState, attachControls, updateArcball, resetView, setView, fitToSphere, type ArcballState } from '../viewer/arcballControls'
import { buildLayerMesh, removeMeshesFromParent, addMeshesToPivot, updateLayerVisibility, updateLayerOpacity, updateLayerColor, disposeMeshes, type LayerMeshes, type SharedCenterRef } from '../viewer/meshBuilder'

export interface ThreeCanvasHandle {
  resetView: () => void
  setView: (name: string) => void
  getCanvas: () => HTMLCanvasElement | null
  getSceneContext: () => import('../viewer/sceneSetup').SceneContext | null
}

interface Props {
  onReady?: (handle: ThreeCanvasHandle) => void
}

export function ThreeCanvas({ onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneContext | null>(null)
  const arcballRef = useRef<ArcballState | null>(null)
  const meshMapRef = useRef<Map<string, LayerMeshes>>(new Map())
  const layerDataRef = useRef<Map<string, Float32Array>>(new Map())
  const animFrameRef = useRef<number>(0)
  const hasFittedRef = useRef(false)
  const sharedCenterRef = useRef<SharedCenterRef>({ current: null })

  const layers = useAppStore((s) => s.layers)

  // Initialize scene
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = createScene(canvas)
    sceneRef.current = ctx

    const arcball = createArcballState()
    arcballRef.current = arcball

    const detach = attachControls(canvas, arcball)

    // Resize handling
    const onResize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w > 0 && h > 0) {
        resizeRenderer(ctx, w, h)
      }
    }
    window.addEventListener('resize', onResize)
    onResize()

    // Render loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      if (arcballRef.current && sceneRef.current) {
        updateArcball(arcballRef.current, sceneRef.current.pivot, sceneRef.current.camera)
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera)
      }
    }
    animate()

    // Expose handle
    onReady?.({
      resetView: () => arcballRef.current && resetView(arcballRef.current),
      setView: (name: string) => {
        if (arcballRef.current) {
          setView(arcballRef.current, name)
        }
      },
      getCanvas: () => canvasRef.current,
      getSceneContext: () => sceneRef.current,
    })

    const currentMeshMap = meshMapRef.current

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      detach()
      window.removeEventListener('resize', onResize)
      // Only dispose meshes here — disposeScene handles renderer only
      currentMeshMap.forEach(disposeMeshes)
      currentMeshMap.clear()
      if (sceneRef.current) disposeScene(sceneRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync layers to meshes
  useEffect(() => {
    const ctx = sceneRef.current
    if (!ctx) return

    const currentMap = meshMapRef.current

    // If all layers are new (fresh load), reset shared center and allow camera refit
    const allNew = Object.keys(layers).every((name) => !currentMap.has(name))
    if (allNew && Object.keys(layers).length > 0) {
      sharedCenterRef.current = { current: null }
      hasFittedRef.current = false
    }

    // Remove meshes for layers that no longer exist
    for (const [name, meshes] of currentMap) {
      if (!layers[name]) {
        removeMeshesFromParent(meshes)
        disposeMeshes(meshes)
        currentMap.delete(name)
        layerDataRef.current.delete(name)
      }
    }

    // Add/update meshes
    const isFirstLoad = !hasFittedRef.current
    for (const [name, layer] of Object.entries(layers)) {
      const existing = currentMap.get(name)
      const prevData = layerDataRef.current.get(name)
      const geometryChanged = !existing || layer.vertices !== prevData

      if (geometryChanged) {
        if (existing) {
          removeMeshesFromParent(existing)
          disposeMeshes(existing)
          currentMap.delete(name)
        }
        const meshes = buildLayerMesh(name, layer, sharedCenterRef.current)
        addMeshesToPivot(ctx.pivot, meshes)
        currentMap.set(name, meshes)
        layerDataRef.current.set(name, layer.vertices)

        // Only auto-fit camera on very first load
        if (isFirstLoad && meshes.boundingSphere && arcballRef.current) {
          fitToSphere(arcballRef.current, meshes.boundingSphere.radius)
          hasFittedRef.current = true
        }
      } else if (existing) {
        updateLayerVisibility(existing, layer.visible)
        updateLayerOpacity(existing, layer.opacity)
        updateLayerColor(existing, layer.color)
      }
    }
  }, [layers])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        touchAction: 'none',
        outline: 'none',
      }}
    />
  )
}
