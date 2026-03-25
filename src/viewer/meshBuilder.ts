import * as THREE from 'three'
import type { LayerData } from '../stores/useAppStore'

export interface LayerMeshes {
  opaque?: THREE.Mesh
  boundingSphere?: THREE.Sphere
  sharedGeometry?: THREE.BufferGeometry
}

// Shared center is passed in from the component (stored in a ref there)
// to survive React StrictMode remounts
export type SharedCenterRef = { current: THREE.Vector3 | null }

export function buildLayerMesh(name: string, layer: LayerData, centerRef?: SharedCenterRef): LayerMeshes {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(layer.vertices, 3))
  geometry.setIndex(new THREE.BufferAttribute(layer.indices, 1))

  // Center all layers to the same origin (first layer determines the center)
  geometry.computeBoundingBox()
  if (centerRef) {
    if (!centerRef.current) {
      centerRef.current = new THREE.Vector3()
      geometry.boundingBox!.getCenter(centerRef.current)
    }
    geometry.translate(-centerRef.current.x, -centerRef.current.y, -centerRef.current.z)
  } else {
    geometry.center()
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  const color = new THREE.Color(layer.color)
  const isTransparent = layer.opacity < 0.98

  // Front-side only — no back-face pass (back faces cause inside surfaces to show)
  // depthWrite off for transparent layers so layers behind can show through
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.05,
    envMapIntensity: 0.4,
    side: THREE.FrontSide,
    depthWrite: !isTransparent,
    transparent: isTransparent,
    opacity: layer.opacity,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.renderOrder = isTransparent ? 1 : 0
  mesh.visible = layer.visible
  return { opaque: mesh, boundingSphere: geometry.boundingSphere ?? undefined, sharedGeometry: geometry }
}

export function updateLayerVisibility(meshes: LayerMeshes, visible: boolean) {
  if (meshes.opaque) meshes.opaque.visible = visible
}

export function updateLayerOpacity(meshes: LayerMeshes, opacity: number) {
  if (meshes.opaque) {
    const mat = meshes.opaque.material as THREE.MeshStandardMaterial
    const wasTransparent = mat.transparent
    const isTransparent = opacity < 0.98
    mat.opacity = opacity
    mat.transparent = isTransparent
    mat.depthWrite = !isTransparent
    if (wasTransparent !== isTransparent) mat.needsUpdate = true
  }
}

export function updateLayerColor(meshes: LayerMeshes, color: string) {
  const c = new THREE.Color(color)
  if (meshes.opaque) (meshes.opaque.material as THREE.MeshStandardMaterial).color.copy(c)
}

export function addMeshesToPivot(pivot: THREE.Group, meshes: LayerMeshes) {
  if (meshes.opaque) pivot.add(meshes.opaque)
}

export function removeMeshesFromParent(meshes: LayerMeshes) {
  if (meshes.opaque) meshes.opaque.removeFromParent()
}

export function disposeMeshes(meshes: LayerMeshes) {
  // Dispose shared geometry once
  if (meshes.sharedGeometry) {
    meshes.sharedGeometry.dispose()
  }
  // Dispose materials only (geometry already handled above)
  const disposeMaterial = (m: THREE.Mesh) => {
    if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose())
    else m.material.dispose()
  }
  if (meshes.opaque) disposeMaterial(meshes.opaque)
}
