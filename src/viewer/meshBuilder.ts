import * as THREE from 'three'
import type { LayerData } from '../stores/useAppStore'

export interface LayerMeshes {
  opaque?: THREE.Mesh
  backFace?: THREE.Mesh
  frontFace?: THREE.Mesh
}

export function buildLayerMesh(name: string, layer: LayerData): LayerMeshes {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(layer.vertices, 3))
  geometry.setIndex(new THREE.BufferAttribute(layer.indices, 1))
  geometry.computeVertexNormals()

  const color = new THREE.Color(layer.color)
  const isTransparent = layer.opacity < 0.98

  if (!isTransparent) {
    const material = new THREE.MeshPhongMaterial({
      color,
      shininess: 18,
      specular: new THREE.Color(0x444444),
      side: THREE.FrontSide,
      depthWrite: true,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.renderOrder = 0
    mesh.visible = layer.visible
    return { opaque: mesh }
  }

  // Transparent: render back faces first, then front
  const backMaterial = new THREE.MeshPhongMaterial({
    color,
    opacity: layer.opacity,
    transparent: true,
    shininess: 8,
    side: THREE.BackSide,
    depthWrite: false,
  })
  const backMesh = new THREE.Mesh(geometry, backMaterial)
  backMesh.name = `${name}_back`
  backMesh.renderOrder = 1
  backMesh.visible = layer.visible

  const frontMaterial = new THREE.MeshPhongMaterial({
    color,
    opacity: layer.opacity,
    transparent: true,
    shininess: 8,
    side: THREE.FrontSide,
    depthWrite: false,
  })
  const frontMesh = new THREE.Mesh(geometry.clone(), frontMaterial)
  frontMesh.name = `${name}_front`
  frontMesh.renderOrder = 2
  frontMesh.visible = layer.visible

  return { backFace: backMesh, frontFace: frontMesh }
}

export function updateLayerVisibility(meshes: LayerMeshes, visible: boolean) {
  if (meshes.opaque) meshes.opaque.visible = visible
  if (meshes.backFace) meshes.backFace.visible = visible
  if (meshes.frontFace) meshes.frontFace.visible = visible
}

export function updateLayerOpacity(meshes: LayerMeshes, opacity: number) {
  if (meshes.backFace) {
    const mat = meshes.backFace.material as THREE.MeshPhongMaterial
    mat.opacity = opacity
  }
  if (meshes.frontFace) {
    const mat = meshes.frontFace.material as THREE.MeshPhongMaterial
    mat.opacity = opacity
  }
}

export function addMeshesToPivot(pivot: THREE.Group, meshes: LayerMeshes) {
  if (meshes.opaque) pivot.add(meshes.opaque)
  if (meshes.backFace) pivot.add(meshes.backFace)
  if (meshes.frontFace) pivot.add(meshes.frontFace)
}

export function disposeMeshes(meshes: LayerMeshes) {
  const dispose = (m: THREE.Mesh) => {
    m.geometry.dispose()
    if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose())
    else m.material.dispose()
  }
  if (meshes.opaque) dispose(meshes.opaque)
  if (meshes.backFace) dispose(meshes.backFace)
  if (meshes.frontFace) dispose(meshes.frontFace)
}
