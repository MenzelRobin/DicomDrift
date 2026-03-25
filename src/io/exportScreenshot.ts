import type * as THREE from 'three'

export function exportScreenshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  filename = 'dicomdrift-screenshot.png',
) {
  // Force a render then read pixels directly from WebGL context
  // (works regardless of preserveDrawingBuffer setting)
  renderer.render(scene, camera)

  const gl = renderer.getContext()
  const width = renderer.domElement.width
  const height = renderer.domElement.height
  const pixels = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

  // Flip vertically (WebGL reads bottom-up)
  const rowSize = width * 4
  const tempRow = new Uint8Array(rowSize)
  for (let y = 0; y < Math.floor(height / 2); y++) {
    const topOffset = y * rowSize
    const bottomOffset = (height - 1 - y) * rowSize
    tempRow.set(pixels.subarray(topOffset, topOffset + rowSize))
    pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize)
    pixels.set(tempRow, bottomOffset)
  }

  // Draw to 2D canvas and export as PNG
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  const ctx = offscreen.getContext('2d')!
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(pixels)
  ctx.putImageData(imageData, 0, 0)

  offscreen.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
