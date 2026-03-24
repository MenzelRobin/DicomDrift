import * as THREE from 'three'
import type { LayerData } from '../stores/useAppStore'

export interface LayerMeshes {
  opaque?: THREE.Mesh
  backFace?: THREE.Mesh
  frontFace?: THREE.Mesh
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

  if (!isTransparent) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0.05,
      envMapIntensity: 0.4,
      side: THREE.FrontSide,
      depthWrite: true,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.renderOrder = 0
    mesh.visible = layer.visible
    return { opaque: mesh, boundingSphere: geometry.boundingSphere ?? undefined, sharedGeometry: geometry }
  }

  // Transparent: share geometry between back and front passes (no clone needed)
  const backMaterial = new THREE.MeshStandardMaterial({
    color,
    opacity: layer.opacity,
    transparent: true,
    roughness: 0.7,
    metalness: 0.0,
    envMapIntensity: 0.2,
    side: THREE.BackSide,
    depthWrite: false,
  })
  const backMesh = new THREE.Mesh(geometry, backMaterial)
  backMesh.name = `${name}_back`
  backMesh.renderOrder = 1
  backMesh.visible = layer.visible

  const frontMaterial = new THREE.MeshStandardMaterial({
    color,
    opacity: layer.opacity,
    transparent: true,
    roughness: 0.7,
    metalness: 0.0,
    envMapIntensity: 0.2,
    side: THREE.FrontSide,
    depthWrite: false,
  })
  const frontMesh = new THREE.Mesh(geometry, frontMaterial)
  frontMesh.name = `${name}_front`
  frontMesh.renderOrder = 2
  frontMesh.visible = layer.visible

  return { backFace: backMesh, frontFace: frontMesh, boundingSphere: geometry.boundingSphere ?? undefined, sharedGeometry: geometry }
}

export function updateLayerVisibility(meshes: LayerMeshes, visible: boolean) {
  if (meshes.opaque) meshes.opaque.visible = visible
  if (meshes.backFace) meshes.backFace.visible = visible
  if (meshes.frontFace) meshes.frontFace.visible = visible
}

export function updateLayerOpacity(meshes: LayerMeshes, opacity: number) {
  if (meshes.backFace) {
    const mat = meshes.backFace.material as THREE.MeshStandardMaterial
    mat.opacity = opacity
  }
  if (meshes.frontFace) {
    const mat = meshes.frontFace.material as THREE.MeshStandardMaterial
    mat.opacity = opacity
  }
}

export function addMeshesToPivot(pivot: THREE.Group, meshes: LayerMeshes) {
  if (meshes.opaque) pivot.add(meshes.opaque)
  if (meshes.backFace) pivot.add(meshes.backFace)
  if (meshes.frontFace) pivot.add(meshes.frontFace)
}

export function removeMeshesFromParent(meshes: LayerMeshes) {
  if (meshes.opaque) meshes.opaque.removeFromParent()
  if (meshes.backFace) meshes.backFace.removeFromParent()
  if (meshes.frontFace) meshes.frontFace.removeFromParent()
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
  if (meshes.backFace) disposeMaterial(meshes.backFace)
  if (meshes.frontFace) disposeMaterial(meshes.frontFace)
}
