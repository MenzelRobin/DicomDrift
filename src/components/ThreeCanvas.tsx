import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { createScene, resizeRenderer, disposeScene, type SceneContext } from '../viewer/sceneSetup'
import { createArcballState, attachControls, updateArcball, resetView, fitToSphere, type ArcballState } from '../viewer/arcballControls'
import { buildLayerMesh, addMeshesToPivot, updateLayerVisibility, updateLayerOpacity, disposeMeshes, type LayerMeshes } from '../viewer/meshBuilder'

export interface ThreeCanvasHandle {
  resetView: () => void
  getCanvas: () => HTMLCanvasElement | null
}

interface Props {
  onReady?: (handle: ThreeCanvasHandle) => void
}

export function ThreeCanvas({ onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneContext | null>(null)
  const arcballRef = useRef<ArcballState | null>(null)
  const meshMapRef = useRef<Map<string, LayerMeshes>>(new Map())
  const animFrameRef = useRef<number>(0)

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
      getCanvas: () => canvasRef.current,
    })

    const currentMeshMap = meshMapRef.current

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      detach()
      window.removeEventListener('resize', onResize)
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

    // Remove meshes for layers that no longer exist
    for (const [name, meshes] of currentMap) {
      if (!layers[name]) {
        if (meshes.opaque) ctx.pivot.remove(meshes.opaque)
        if (meshes.backFace) ctx.pivot.remove(meshes.backFace)
        if (meshes.frontFace) ctx.pivot.remove(meshes.frontFace)
        disposeMeshes(meshes)
        currentMap.delete(name)
      }
    }

    // Add/update meshes
    for (const [name, layer] of Object.entries(layers)) {
      const existing = currentMap.get(name)
      if (existing) {
        // Update visibility and opacity
        updateLayerVisibility(existing, layer.visible)
        updateLayerOpacity(existing, layer.opacity)
      } else {
        // Build new mesh
        const meshes = buildLayerMesh(name, layer)
        addMeshesToPivot(ctx.pivot, meshes)
        currentMap.set(name, meshes)

        // Auto-fit camera to first mesh added
        if (meshes.boundingSphere && arcballRef.current) {
          fitToSphere(arcballRef.current, meshes.boundingSphere.radius)
        }
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
