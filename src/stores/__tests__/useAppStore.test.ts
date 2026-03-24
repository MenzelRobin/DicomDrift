import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      phase: 'landing',
      progress: null,
      layers: {},
      params: { isoThreshold: 300, resolution: 2, smoothIterations: 3 },
      cachedVolume: null,
    })
  })

  it('starts in landing phase', () => {
    expect(useAppStore.getState().phase).toBe('landing')
  })

  it('can transition phases', () => {
    useAppStore.getState().setPhase('processing')
    expect(useAppStore.getState().phase).toBe('processing')
  })

  it('has correct default params', () => {
    const { params } = useAppStore.getState()
    expect(params.isoThreshold).toBe(300)
    expect(params.resolution).toBe(2)
    expect(params.smoothIterations).toBe(3)
  })

  it('can update params partially', () => {
    useAppStore.getState().setParams({ isoThreshold: -200 })
    const { params } = useAppStore.getState()
    expect(params.isoThreshold).toBe(-200)
    expect(params.resolution).toBe(2)
  })

  it('can reset to landing', () => {
    useAppStore.getState().setPhase('viewing')
    useAppStore.getState().resetToLanding()
    expect(useAppStore.getState().phase).toBe('landing')
  })
})
