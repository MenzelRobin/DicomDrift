import type * as THREE from 'three'

export function exportScreenshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  filename = 'dicomdrift-screenshot.png',
) {
  // Force a fresh render then read the canvas
  renderer.render(scene, camera)
  renderer.domElement.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
