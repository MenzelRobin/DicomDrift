import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.getState().resetToLanding()
  })

  it('starts in landing phase', () => {
    expect(useAppStore.getState().phase).toBe('landing')
  })

  it('can transition phases', () => {
    useAppStore.getState().setPhase('processing')
    expect(useAppStore.getState().phase).toBe('processing')
  })

  it('has default layer configs', () => {
    const { layerConfigs } = useAppStore.getState()
    expect(layerConfigs.length).toBeGreaterThan(0)
    expect(layerConfigs[0].name).toBe('Bone')
  })

  it('can add and remove layer configs', () => {
    useAppStore.getState().addLayerConfig({
      id: 'test', name: 'Test', threshold: 100, color: '#fff',
      opacity: 0.5, resolution: 2, smoothing: 3, invertNormals: true, generating: false,
    })
    expect(useAppStore.getState().layerConfigs.length).toBe(2)
    useAppStore.getState().removeLayerConfig('test')
    expect(useAppStore.getState().layerConfigs.length).toBe(1)
  })

  it('can set and remove individual layers', () => {
    const fakeLayer = {
      vertices: new Float32Array([0, 0, 0]),
      indices: new Uint32Array([0]),
      color: '#fff', opacity: 1, visible: true,
    }
    useAppStore.getState().setLayer('test', fakeLayer)
    expect(useAppStore.getState().layers['test']).toBeDefined()
    useAppStore.getState().removeLayer('test')
    expect(useAppStore.getState().layers['test']).toBeUndefined()
  })

  it('can reset to landing', () => {
    useAppStore.getState().setPhase('viewing')
    useAppStore.getState().resetToLanding()
    expect(useAppStore.getState().phase).toBe('landing')
    expect(Object.keys(useAppStore.getState().layers).length).toBe(0)
  })
})
