import { get, set, del } from 'idb-keyval'
import type { LayerData, LayerConfig } from '../stores/useAppStore'

const SESSION_KEY = 'dicomdrift-session'

interface CachedSession {
  timestamp: number
  layers: Record<string, {
    vertices: ArrayBuffer
    indices: ArrayBuffer
    color: string
    opacity: number
    visible: boolean
  }>
  layerConfigs: LayerConfig[]
}

export async function saveSession(
  layers: Record<string, LayerData>,
  layerConfigs: LayerConfig[],
): Promise<void> {
  if (Object.keys(layers).length === 0) return

  const serialized: CachedSession = {
    timestamp: Date.now(),
    layers: {},
    layerConfigs,
  }

  for (const [name, layer] of Object.entries(layers)) {
    serialized.layers[name] = {
      vertices: layer.vertices.buffer.slice(0) as ArrayBuffer,
      indices: layer.indices.buffer.slice(0) as ArrayBuffer,
      color: layer.color,
      opacity: layer.opacity,
      visible: layer.visible,
    }
  }

  await set(SESSION_KEY, serialized)
}

export async function loadSession(): Promise<{
  layers: Record<string, LayerData>
  layerConfigs: LayerConfig[]
  timestamp: number
} | null> {
  const cached = await get<CachedSession>(SESSION_KEY)
  if (!cached || !cached.layers || Object.keys(cached.layers).length === 0) return null

  const layers: Record<string, LayerData> = {}

  for (const [name, data] of Object.entries(cached.layers)) {
    layers[name] = {
      vertices: new Float32Array(data.vertices),
      indices: new Uint32Array(data.indices),
      color: data.color,
      opacity: data.opacity,
      visible: data.visible,
    }
  }

  return {
    layers,
    layerConfigs: cached.layerConfigs,
    timestamp: cached.timestamp,
  }
}

export async function hasSession(): Promise<{ exists: boolean; timestamp?: number }> {
  const cached = await get<CachedSession>(SESSION_KEY)
  if (!cached || Object.keys(cached.layers).length === 0) return { exists: false }
  return { exists: true, timestamp: cached.timestamp }
}

export async function clearSession(): Promise<void> {
  await del(SESSION_KEY)
}
