import { unzipSync, strFromU8 } from 'fflate'
import type { LayerData, LayerConfig } from '../stores/useAppStore'

interface DicomDriftMeta {
  version: number
  layers: Record<string, { color: string; opacity: number; visible: boolean }>
  layerConfigs?: LayerConfig[]
}

export interface LoadedModel {
  layers: Record<string, LayerData>
  layerConfigs?: LayerConfig[]
}

export async function loadModel(file: File): Promise<LoadedModel> {
  const buffer = await file.arrayBuffer()
  const unzipped = unzipSync(new Uint8Array(buffer))

  const metaBytes = unzipped['meta.json']
  if (!metaBytes) {
    throw new Error('Invalid .dicomdrift file: missing meta.json')
  }

  const meta: DicomDriftMeta = JSON.parse(strFromU8(metaBytes))
  const layers: Record<string, LayerData> = {}

  for (const [name, layerMeta] of Object.entries(meta.layers)) {
    const vertBytes = unzipped[`${name}.vertices`]
    const idxBytes = unzipped[`${name}.indices`]
    if (!vertBytes || !idxBytes) {
      throw new Error(`Invalid .dicomdrift file: missing data for layer "${name}"`)
    }

    layers[name] = {
      vertices: new Float32Array(vertBytes.buffer, vertBytes.byteOffset, vertBytes.byteLength / 4),
      indices: new Uint32Array(idxBytes.buffer, idxBytes.byteOffset, idxBytes.byteLength / 4),
      color: layerMeta.color,
      opacity: layerMeta.opacity,
      visible: layerMeta.visible,
    }
  }

  return { layers, layerConfigs: meta.layerConfigs }
}
