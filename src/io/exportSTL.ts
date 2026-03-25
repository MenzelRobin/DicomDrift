import type { LayerData } from '../stores/useAppStore'

export function exportSTL(layers: Record<string, LayerData>, filename = 'model.stl') {
  const visibleLayers = Object.values(layers).filter((l) => l.visible)
  if (visibleLayers.length === 0) return

  let totalTriangles = 0
  for (const layer of visibleLayers) {
    totalTriangles += layer.indices.length / 3
  }

  const bufferSize = 84 + totalTriangles * 50
  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  const header = 'DicomDrift STL Export'
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0)
  }
  view.setUint32(80, totalTriangles, true)

  let offset = 84
  for (const layer of visibleLayers) {
    const { vertices, indices } = layer
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3, i1 = indices[i + 1] * 3, i2 = indices[i + 2] * 3
      const ax = vertices[i0], ay = vertices[i0 + 1], az = vertices[i0 + 2]
      const bx = vertices[i1], by = vertices[i1 + 1], bz = vertices[i1 + 2]
      const cx = vertices[i2], cy = vertices[i2 + 1], cz = vertices[i2 + 2]

      const ux = bx - ax, uy = by - ay, uz = bz - az
      const vx = cx - ax, vy = cy - ay, vz = cz - az
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len > 0) { nx /= len; ny /= len; nz /= len }

      view.setFloat32(offset, nx, true); offset += 4
      view.setFloat32(offset, ny, true); offset += 4
      view.setFloat32(offset, nz, true); offset += 4
      view.setFloat32(offset, ax, true); offset += 4
      view.setFloat32(offset, ay, true); offset += 4
      view.setFloat32(offset, az, true); offset += 4
      view.setFloat32(offset, bx, true); offset += 4
      view.setFloat32(offset, by, true); offset += 4
      view.setFloat32(offset, bz, true); offset += 4
      view.setFloat32(offset, cx, true); offset += 4
      view.setFloat32(offset, cy, true); offset += 4
      view.setFloat32(offset, cz, true); offset += 4
      view.setUint16(offset, 0, true); offset += 2
    }
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
