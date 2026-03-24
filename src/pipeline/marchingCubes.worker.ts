import { EDGE_TABLE, TRI_TABLE } from './marchingCubesTables'

export interface MarchingCubesMessage {
  type: 'generate'
  volume: Int16Array
  dimensions: [number, number, number]
  spacing: [number, number, number]
  isoThreshold: number
  resolution: 1 | 2 | 4
  smoothIterations: number
}

export interface MarchingCubesResponse {
  type: 'progress' | 'complete' | 'error'
  step?: string
  percent?: number
  vertices?: Float32Array
  indices?: Uint32Array
  message?: string
}

function postMsg(msg: MarchingCubesResponse) {
  postMessage(msg)
}

// Interpolate vertex position along an edge
function interpolate(
  p1x: number, p1y: number, p1z: number, v1: number,
  p2x: number, p2y: number, p2z: number, v2: number,
  iso: number,
): [number, number, number] {
  if (Math.abs(iso - v1) < 0.00001) return [p1x, p1y, p1z]
  if (Math.abs(iso - v2) < 0.00001) return [p2x, p2y, p2z]
  if (Math.abs(v1 - v2) < 0.00001) return [p1x, p1y, p1z]

  const mu = (iso - v1) / (v2 - v1)
  return [
    p1x + mu * (p2x - p1x),
    p1y + mu * (p2y - p1y),
    p1z + mu * (p2z - p1z),
  ]
}

function marchingCubes(
  volume: Int16Array,
  dims: [number, number, number],
  spacing: [number, number, number],
  iso: number,
  step: number,
): { vertices: number[]; indices: number[] } {
  const [nx, ny, nz] = dims
  const [sx, sy, sz] = spacing

  // Vertex welding via spatial hash
  const vertexMap = new Map<string, number>()
  const vertices: number[] = []
  const indices: number[] = []

  function addVertex(x: number, y: number, z: number): number {
    // Quantize to avoid floating point issues
    const key = `${(x * 1000) | 0},${(y * 1000) | 0},${(z * 1000) | 0}`
    const existing = vertexMap.get(key)
    if (existing !== undefined) return existing
    const idx = vertices.length / 3
    vertices.push(x, y, z)
    vertexMap.set(key, idx)
    return idx
  }

  function getVoxel(x: number, y: number, z: number): number {
    // Treat boundary voxels as below any threshold to avoid edge artifacts
    if (x <= 0 || y <= 0 || z <= 0 || x >= nx - 1 || y >= ny - 1 || z >= nz - 1) {
      return -1024
    }
    return volume[z * nx * ny + y * nx + x]
  }

  const totalCubes = Math.ceil((nx - 1) / step) * Math.ceil((ny - 1) / step) * Math.ceil((nz - 1) / step)
  let processedCubes = 0
  let lastReportedPercent = 0

  for (let z = 0; z < nz - 1; z += step) {
    for (let y = 0; y < ny - 1; y += step) {
      for (let x = 0; x < nx - 1; x += step) {
        // Clamp upper bounds
        const x1 = Math.min(x + step, nx - 1)
        const y1 = Math.min(y + step, ny - 1)
        const z1 = Math.min(z + step, nz - 1)

        // Get voxel values at 8 corners
        const v0 = getVoxel(x, y, z)
        const v1 = getVoxel(x1, y, z)
        const v2 = getVoxel(x1, y1, z)
        const v3 = getVoxel(x, y1, z)
        const v4 = getVoxel(x, y, z1)
        const v5 = getVoxel(x1, y, z1)
        const v6 = getVoxel(x1, y1, z1)
        const v7 = getVoxel(x, y1, z1)

        // Determine cube index
        let cubeIndex = 0
        if (v0 >= iso) cubeIndex |= 1
        if (v1 >= iso) cubeIndex |= 2
        if (v2 >= iso) cubeIndex |= 4
        if (v3 >= iso) cubeIndex |= 8
        if (v4 >= iso) cubeIndex |= 16
        if (v5 >= iso) cubeIndex |= 32
        if (v6 >= iso) cubeIndex |= 64
        if (v7 >= iso) cubeIndex |= 128

        const edges = EDGE_TABLE[cubeIndex]
        if (edges === 0) {
          processedCubes++
          continue
        }

        // Corner positions in world space
        const px0 = x * sx, py0 = y * sy, pz0 = z * sz
        const px1 = x1 * sx, py1 = y1 * sy, pz1 = z1 * sz

        // Compute edge vertices (only those needed)
        const edgeVerts: [number, number, number][] = new Array(12)

        if (edges & 1) edgeVerts[0] = interpolate(px0, py0, pz0, v0, px1, py0, pz0, v1, iso)
        if (edges & 2) edgeVerts[1] = interpolate(px1, py0, pz0, v1, px1, py1, pz0, v2, iso)
        if (edges & 4) edgeVerts[2] = interpolate(px1, py1, pz0, v2, px0, py1, pz0, v3, iso)
        if (edges & 8) edgeVerts[3] = interpolate(px0, py0, pz0, v0, px0, py1, pz0, v3, iso)
        if (edges & 16) edgeVerts[4] = interpolate(px0, py0, pz1, v4, px1, py0, pz1, v5, iso)
        if (edges & 32) edgeVerts[5] = interpolate(px1, py0, pz1, v5, px1, py1, pz1, v6, iso)
        if (edges & 64) edgeVerts[6] = interpolate(px1, py1, pz1, v6, px0, py1, pz1, v7, iso)
        if (edges & 128) edgeVerts[7] = interpolate(px0, py0, pz1, v4, px0, py1, pz1, v7, iso)
        if (edges & 256) edgeVerts[8] = interpolate(px0, py0, pz0, v0, px0, py0, pz1, v4, iso)
        if (edges & 512) edgeVerts[9] = interpolate(px1, py0, pz0, v1, px1, py0, pz1, v5, iso)
        if (edges & 1024) edgeVerts[10] = interpolate(px1, py1, pz0, v2, px1, py1, pz1, v6, iso)
        if (edges & 2048) edgeVerts[11] = interpolate(px0, py1, pz0, v3, px0, py1, pz1, v7, iso)

        // Build triangles
        const triRow = TRI_TABLE[cubeIndex]
        for (let i = 0; triRow[i] !== -1; i += 3) {
          const e0 = edgeVerts[triRow[i]]
          const e1 = edgeVerts[triRow[i + 1]]
          const e2 = edgeVerts[triRow[i + 2]]
          const i0 = addVertex(e0[0], e0[1], e0[2])
          const i1 = addVertex(e1[0], e1[1], e1[2])
          const i2 = addVertex(e2[0], e2[1], e2[2])
          indices.push(i0, i1, i2)
        }

        processedCubes++
        const percent = Math.round((processedCubes / totalCubes) * 80)
        if (percent > lastReportedPercent + 4) {
          lastReportedPercent = percent
          postMsg({ type: 'progress', step: 'generatingMesh', percent })
        }
      }
    }
  }

  return { vertices, indices }
}

function laplacianSmooth(
  vertices: Float32Array,
  indices: Uint32Array,
  iterations: number,
): void {
  if (iterations <= 0) return

  const vertexCount = vertices.length / 3

  // Build adjacency list
  const neighbors: Set<number>[] = new Array(vertexCount)
  for (let i = 0; i < vertexCount; i++) neighbors[i] = new Set()

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2]
    neighbors[a].add(b); neighbors[a].add(c)
    neighbors[b].add(a); neighbors[b].add(c)
    neighbors[c].add(a); neighbors[c].add(b)
  }

  const lambda = 0.5

  for (let iter = 0; iter < iterations; iter++) {
    const newPositions = new Float32Array(vertices.length)

    for (let i = 0; i < vertexCount; i++) {
      const adj = neighbors[i]
      if (adj.size === 0) {
        newPositions[i * 3] = vertices[i * 3]
        newPositions[i * 3 + 1] = vertices[i * 3 + 1]
        newPositions[i * 3 + 2] = vertices[i * 3 + 2]
        continue
      }

      let avgX = 0, avgY = 0, avgZ = 0
      for (const j of adj) {
        avgX += vertices[j * 3]
        avgY += vertices[j * 3 + 1]
        avgZ += vertices[j * 3 + 2]
      }
      const n = adj.size
      avgX /= n; avgY /= n; avgZ /= n

      newPositions[i * 3] = vertices[i * 3] + lambda * (avgX - vertices[i * 3])
      newPositions[i * 3 + 1] = vertices[i * 3 + 1] + lambda * (avgY - vertices[i * 3 + 1])
      newPositions[i * 3 + 2] = vertices[i * 3 + 2] + lambda * (avgZ - vertices[i * 3 + 2])
    }

    vertices.set(newPositions)

    postMsg({
      type: 'progress',
      step: 'smoothingMesh',
      percent: 80 + Math.round(((iter + 1) / iterations) * 18),
    })
  }
}

self.onmessage = (e: MessageEvent<MarchingCubesMessage>) => {
  const { volume, dimensions, spacing, isoThreshold, resolution, smoothIterations } = e.data

  try {
    postMsg({ type: 'progress', step: 'generatingMesh', percent: 0 })

    const { vertices: rawVerts, indices: rawIndices } = marchingCubes(
      volume, dimensions, spacing, isoThreshold, resolution,
    )

    if (rawIndices.length === 0) {
      postMsg({ type: 'error', message: 'No surface found at this threshold' })
      return
    }

    const vertices = new Float32Array(rawVerts)
    const indices = new Uint32Array(rawIndices)

    postMsg({ type: 'progress', step: 'smoothingMesh', percent: 80 })

    laplacianSmooth(vertices, indices, smoothIterations)

    postMsg({ type: 'progress', step: 'smoothingMesh', percent: 100 })

    // Transfer buffers (zero-copy)
    postMsg(
      { type: 'complete', vertices, indices },
    )
  } catch (err) {
    postMsg({ type: 'error', message: String(err) })
  }
}
