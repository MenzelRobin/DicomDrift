import type { DicomSlice, VolumeAssemblerMessage, VolumeAssemblerResponse } from '../types/dicom'

function postMsg(msg: VolumeAssemblerResponse) {
  postMessage(msg)
}

function computeSliceNormal(iop: [number, number, number, number, number, number]): [number, number, number] {
  // Cross product of row direction and column direction
  return [
    iop[1] * iop[5] - iop[2] * iop[4],
    iop[2] * iop[3] - iop[0] * iop[5],
    iop[0] * iop[4] - iop[1] * iop[3],
  ]
}

function dotProduct(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function extractPixelValues(slice: DicomSlice): Int16Array {
  const { rows, columns, bitsAllocated, pixelRepresentation, rescaleSlope, rescaleIntercept, pixelData } = slice
  const numPixels = rows * columns
  const output = new Int16Array(numPixels)

  if (bitsAllocated === 16) {
    const view = new DataView(pixelData)
    const maxOffset = pixelData.byteLength - 2
    for (let i = 0; i < numPixels; i++) {
      const offset = i * 2
      if (offset > maxOffset) break
      const raw = pixelRepresentation === 1
        ? view.getInt16(offset, true)
        : view.getUint16(offset, true)
      output[i] = Math.round(raw * rescaleSlope + rescaleIntercept)
    }
  } else if (bitsAllocated === 8) {
    const bytes = new Uint8Array(pixelData)
    const max = Math.min(numPixels, bytes.length)
    for (let i = 0; i < max; i++) {
      output[i] = Math.round(bytes[i] * rescaleSlope + rescaleIntercept)
    }
  }

  return output
}

self.onmessage = (e: MessageEvent<VolumeAssemblerMessage>) => {
  try {

  const { slices, seriesUID } = e.data

  // Filter to selected series
  const seriesSlices = slices.filter((s) => s.seriesInstanceUID === seriesUID)

  if (seriesSlices.length < 2) {
    postMsg({ type: 'error', message: 'Not enough slices to build a volume' })
    return
  }

  postMsg({ type: 'progress', percent: 5 })

  // Compute slice normal from the first slice's orientation
  const iop = seriesSlices[0].imageOrientationPatient
  const normal = computeSliceNormal(iop)

  // Sort slices by projection of ImagePositionPatient onto the slice normal
  seriesSlices.sort((a, b) => {
    const projA = dotProduct(normal, a.imagePositionPatient)
    const projB = dotProduct(normal, b.imagePositionPatient)
    return projA - projB
  })

  postMsg({ type: 'progress', percent: 10 })

  const { rows, columns } = seriesSlices[0]

  // Find the most common slice dimensions (series can have mixed sizes like localizers)
  const dimCounts = new Map<string, number>()
  for (const s of seriesSlices) {
    const key = `${s.rows}x${s.columns}`
    dimCounts.set(key, (dimCounts.get(key) ?? 0) + 1)
  }
  let bestKey = `${rows}x${columns}`
  let bestCount = 0
  for (const [key, count] of dimCounts) {
    if (count > bestCount) { bestKey = key; bestCount = count }
  }
  const [useRows, useCols] = bestKey.split('x').map(Number)

  const validSlices = seriesSlices.filter(
    (s) => s.rows === useRows && s.columns === useCols,
  )
  if (validSlices.length < 2) {
    postMsg({ type: 'error', message: 'Not enough valid slices to build a volume' })
    return
  }

  // Recalculate spacing from the actual valid slices (not the unfiltered set)
  const vPos0 = validSlices[0].imagePositionPatient
  const vPos1 = validSlices[1].imagePositionPatient
  const validSliceSpacing = Math.sqrt(
    (vPos1[0] - vPos0[0]) ** 2 +
    (vPos1[1] - vPos0[1]) ** 2 +
    (vPos1[2] - vPos0[2]) ** 2,
  )
  const validSpacing: [number, number, number] = [
    validSlices[0].pixelSpacing[1],
    validSlices[0].pixelSpacing[0],
    validSliceSpacing || validSlices[0].sliceThickness,
  ]
  assembleWithSlices(validSlices, useRows, useCols, validSpacing, vPos0)

  } catch (err) {
    console.error('[VolumeAssembler] Top-level error:', err)
    postMsg({ type: 'error', message: String(err) })
  }
}

function assembleWithSlices(
  slices: DicomSlice[],
  rows: number,
  columns: number,
  spacing: [number, number, number],
  origin: [number, number, number],
) {
  const validDepth = slices.length
  const dimensions: [number, number, number] = [columns, rows, validDepth]
  const rawVoxels = columns * rows * validDepth
  const sliceSize = columns * rows

  const rawVolume = new Int16Array(rawVoxels)

  for (let z = 0; z < validDepth; z++) {
    try {
      const sliceData = extractPixelValues(slices[z])
      rawVolume.set(sliceData, z * sliceSize)
    } catch (err) {
      console.warn(`Skipping slice ${z}: ${err}`)
    }

    if (z % 10 === 0 || z === validDepth - 1) {
      postMsg({ type: 'progress', percent: 10 + Math.round((z / validDepth) * 40) })
    }
  }

  // Resample to isotropic voxels if Z spacing is significantly coarser than XY
  const xySpacing = Math.min(spacing[0], spacing[1])
  const zSpacing = spacing[2]
  const anisotropyRatio = zSpacing / xySpacing

  let volume: Int16Array
  let finalDimensions: [number, number, number] = dimensions
  let finalSpacing: [number, number, number] = spacing

  if (anisotropyRatio > 1.5) {
    // Resample Z axis via linear interpolation to make voxels more isotropic
    const targetZSpacing = xySpacing
    const newDepth = Math.round(validDepth * zSpacing / targetZSpacing)

    // Cap to prevent memory explosion (max ~500MB for the resampled volume)
    const maxVoxels = 250_000_000 // ~500MB as Int16
    const maxDepth = Math.floor(maxVoxels / (columns * rows))
    const cappedDepth = Math.min(newDepth, maxDepth)

    postMsg({ type: 'progress', percent: 55 })

    const newVolume = new Int16Array(columns * rows * cappedDepth)

    for (let nz = 0; nz < cappedDepth; nz++) {
      // Map new Z index back to original Z coordinate
      const origZ = (nz / (cappedDepth - 1)) * (validDepth - 1)
      const z0 = Math.floor(origZ)
      const z1 = Math.min(z0 + 1, validDepth - 1)
      const t = origZ - z0

      const offset0 = z0 * sliceSize
      const offset1 = z1 * sliceSize
      const outOffset = nz * sliceSize

      if (t < 0.001) {
        // Exact slice — just copy
        newVolume.set(rawVolume.subarray(offset0, offset0 + sliceSize), outOffset)
      } else {
        // Linear interpolation between two slices
        for (let i = 0; i < sliceSize; i++) {
          newVolume[outOffset + i] = Math.round(rawVolume[offset0 + i] * (1 - t) + rawVolume[offset1 + i] * t)
        }
      }

      if (nz % 20 === 0) {
        postMsg({ type: 'progress', percent: 55 + Math.round((nz / cappedDepth) * 40) })
      }
    }

    volume = newVolume
    finalDimensions = [columns, rows, cappedDepth]
    finalSpacing = [spacing[0], spacing[1], targetZSpacing]
  } else {
    volume = rawVolume
  }

  postMsg({ type: 'progress', percent: 95 })

  postMsg({
    type: 'complete',
    volume,
    dimensions: finalDimensions,
    spacing: finalSpacing,
    origin,
  })
}
