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

export interface LayerConfig {
  id: string
  name: string
  threshold: number
  color: string
  opacity: number
  resolution: number
  smoothing: number
  invertNormals: boolean
  generating: boolean
}

export interface ProgressInfo {
  step: string
  percent: number
}

interface AppState {
  phase: Phase
  progress: ProgressInfo | null
  layers: Record<string, LayerData>
  layerConfigs: LayerConfig[]
  cachedVolume: ArrayBuffer | null
  volumeMeta: VolumeData | null

  setPhase: (phase: Phase) => void
  setProgress: (progress: ProgressInfo | null) => void
  setLayers: (layers: Record<string, LayerData>) => void
  setLayer: (id: string, data: LayerData) => void
  removeLayer: (id: string) => void
  updateLayerVisibility: (id: string, visible: boolean) => void
  updateLayerOpacity: (id: string, opacity: number) => void

  setLayerConfigs: (configs: LayerConfig[]) => void
  updateLayerConfig: (id: string, update: Partial<LayerConfig>) => void
  addLayerConfig: (config: LayerConfig) => void
  removeLayerConfig: (id: string) => void

  setCachedVolume: (volume: ArrayBuffer | null) => void
  resetToLanding: () => void
}

export const DEFAULT_LAYER_CONFIGS: LayerConfig[] = [
  { id: 'bone', name: 'Bone', threshold: 200, color: '#d4c4a8', opacity: 1.0, resolution: 2, smoothing: 5, invertNormals: true, generating: false },
]

export const PRESET_LAYERS: Record<string, Omit<LayerConfig, 'id' | 'generating'>> = {
  bone: { name: 'Bone', threshold: 200, color: '#d4c4a8', opacity: 1.0, resolution: 2, smoothing: 5, invertNormals: true },
  softTissue: { name: 'Soft Tissue', threshold: -100, color: '#c4988a', opacity: 0.35, resolution: 2, smoothing: 10, invertNormals: true },
  skin: { name: 'Skin', threshold: -300, color: '#d4a89c', opacity: 0.15, resolution: 2, smoothing: 15, invertNormals: true },
}

export const useAppStore = create<AppState>((set) => ({
  phase: 'landing',
  progress: null,
  layers: {},
  layerConfigs: [...DEFAULT_LAYER_CONFIGS],
  cachedVolume: null,
  volumeMeta: null,

  setPhase: (phase) => set({ phase }),
  setProgress: (progress) => set({ progress }),
  setLayers: (layers) => set({ layers }),
  setLayer: (id, data) =>
    set((state) => ({ layers: { ...state.layers, [id]: data } })),
  removeLayer: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.layers
      void _removed
      return { layers: rest }
    }),
  updateLayerVisibility: (id, visible) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], visible },
      },
    })),
  updateLayerOpacity: (id, opacity) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], opacity },
      },
    })),

  setLayerConfigs: (layerConfigs) => set({ layerConfigs }),
  updateLayerConfig: (id, update) =>
    set((state) => ({
      layerConfigs: state.layerConfigs.map((c) =>
        c.id === id ? { ...c, ...update } : c,
      ),
    })),
  addLayerConfig: (config) =>
    set((state) => ({ layerConfigs: [...state.layerConfigs, config] })),
  removeLayerConfig: (id) =>
    set((state) => ({
      layerConfigs: state.layerConfigs.filter((c) => c.id !== id),
    })),

  setCachedVolume: (cachedVolume) => set({ cachedVolume }),
  resetToLanding: () =>
    set({
      phase: 'landing',
      progress: null,
      layers: {},
      layerConfigs: [...DEFAULT_LAYER_CONFIGS],
      cachedVolume: null,
      volumeMeta: null,
    }),
}))
