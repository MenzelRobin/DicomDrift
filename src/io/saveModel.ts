import { zipSync, strToU8 } from 'fflate'
import type { LayerData, LayerConfig } from '../stores/useAppStore'

interface DicomDriftMeta {
  version: 1
  layers: Record<string, { color: string; opacity: number; visible: boolean }>
  layerConfigs: LayerConfig[]
}

export function saveModel(
  layers: Record<string, LayerData>,
  layerConfigs: LayerConfig[],
  filename = 'model.dicomdrift',
) {
  const meta: DicomDriftMeta = {
    version: 1,
    layers: {},
    layerConfigs: layerConfigs.map((c) => ({ ...c, generating: false })),
  }

  const zipFiles: Record<string, Uint8Array> = {}

  for (const [name, layer] of Object.entries(layers)) {
    meta.layers[name] = {
      color: layer.color,
      opacity: layer.opacity,
      visible: layer.visible,
    }
    zipFiles[`${name}.vertices`] = new Uint8Array(layer.vertices.buffer)
    zipFiles[`${name}.indices`] = new Uint8Array(layer.indices.buffer)
  }

  zipFiles['meta.json'] = strToU8(JSON.stringify(meta))

  const zipped = zipSync(zipFiles)
  const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/octet-stream' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
