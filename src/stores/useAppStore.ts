import { create } from 'zustand'
import type { VolumeData } from '../types/dicom'

export type Phase = 'landing' | 'processing' | 'viewing'

export interface LayerData {
  vertices: Float32Array
  indices: Uint32Array
  color: string
  opacity: number
  visible: boolean
}

export interface MeshParams {
  isoThreshold: number
  resolution: 1 | 2 | 4
  smoothIterations: number
}

export interface ProgressInfo {
  step: string
  percent: number
}

interface AppState {
  phase: Phase
  progress: ProgressInfo | null
  layers: Record<string, LayerData>
  params: MeshParams
  cachedVolume: ArrayBuffer | null
  volumeMeta: VolumeData | null

  setPhase: (phase: Phase) => void
  setProgress: (progress: ProgressInfo | null) => void
  setLayers: (layers: Record<string, LayerData>) => void
  updateLayerVisibility: (name: string, visible: boolean) => void
  updateLayerOpacity: (name: string, opacity: number) => void
  setParams: (params: Partial<MeshParams>) => void
  setCachedVolume: (volume: ArrayBuffer | null) => void
  resetToLanding: () => void
}

const DEFAULT_PARAMS: MeshParams = {
  isoThreshold: 300,
  resolution: 2,
  smoothIterations: 3,
}

export const useAppStore = create<AppState>((set) => ({
  phase: 'landing',
  progress: null,
  layers: {},
  params: DEFAULT_PARAMS,
  cachedVolume: null,
  volumeMeta: null,

  setPhase: (phase) => set({ phase }),
  setProgress: (progress) => set({ progress }),
  setLayers: (layers) => set({ layers }),
  updateLayerVisibility: (name, visible) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [name]: { ...state.layers[name], visible },
      },
    })),
  updateLayerOpacity: (name, opacity) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [name]: { ...state.layers[name], opacity },
      },
    })),
  setParams: (params) =>
    set((state) => ({ params: { ...state.params, ...params } })),
  setCachedVolume: (cachedVolume) => set({ cachedVolume }),
  resetToLanding: () =>
    set({
      phase: 'landing',
      progress: null,
      layers: {},
      cachedVolume: null,
      volumeMeta: null,
      params: DEFAULT_PARAMS,
    }),
}))
