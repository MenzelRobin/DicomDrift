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

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB
const SUPPORTED_VERSION = 1

export async function loadModel(file: File): Promise<LoadedModel> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large (max 200 MB)')
  }

  const buffer = await file.arrayBuffer()
  const unzipped = unzipSync(new Uint8Array(buffer))

  const metaBytes = unzipped['meta.json']
  if (!metaBytes) {
    throw new Error('Invalid .dicomdrift file: missing meta.json')
  }

  const meta: DicomDriftMeta = JSON.parse(strFromU8(metaBytes))

  if (typeof meta.version !== 'number' || meta.version !== SUPPORTED_VERSION) {
    throw new Error(`Unsupported .dicomdrift version ${meta.version} (expected ${SUPPORTED_VERSION})`)
  }
  if (!meta.layers || typeof meta.layers !== 'object') {
    throw new Error('Invalid .dicomdrift file: missing layers metadata')
  }

  const layers: Record<string, LayerData> = {}

  for (const [name, layerMeta] of Object.entries(meta.layers)) {
    const vertBytes = unzipped[`${name}.vertices`]
    const idxBytes = unzipped[`${name}.indices`]
    if (!vertBytes || !idxBytes) {
      throw new Error(`Invalid .dicomdrift file: missing data for layer "${name}"`)
    }
    if (vertBytes.byteLength % 4 !== 0 || idxBytes.byteLength % 4 !== 0) {
      throw new Error(`Invalid .dicomdrift file: corrupted data for layer "${name}"`)
    }

    layers[name] = {
      vertices: new Float32Array(vertBytes.buffer, vertBytes.byteOffset, vertBytes.byteLength / 4),
      indices: new Uint32Array(idxBytes.buffer, idxBytes.byteOffset, idxBytes.byteLength / 4),
      color: layerMeta.color,
      opacity: layerMeta.opacity,
      visible: layerMeta.visible,
    }
  }

  // Normalize configs: force generating=false in case it was saved mid-generation
  const layerConfigs = meta.layerConfigs?.map((c) => ({ ...c, generating: false }))

  return { layers, layerConfigs }
}
