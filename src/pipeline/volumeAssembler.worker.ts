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
    for (let i = 0; i < numPixels; i++) {
      const raw = pixelRepresentation === 1
        ? view.getInt16(i * 2, true)
        : view.getUint16(i * 2, true)
      // Convert to Hounsfield Units
      output[i] = Math.round(raw * rescaleSlope + rescaleIntercept)
    }
  } else if (bitsAllocated === 8) {
    const bytes = new Uint8Array(pixelData)
    for (let i = 0; i < numPixels; i++) {
      output[i] = Math.round(bytes[i] * rescaleSlope + rescaleIntercept)
    }
  }

  return output
}

self.onmessage = (e: MessageEvent<VolumeAssemblerMessage>) => {
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

  const { rows, columns, pixelSpacing } = seriesSlices[0]

  // Calculate slice spacing from the first two slice positions
  const pos0 = seriesSlices[0].imagePositionPatient
  const pos1 = seriesSlices[1].imagePositionPatient
  const sliceSpacing = Math.sqrt(
    (pos1[0] - pos0[0]) ** 2 +
    (pos1[1] - pos0[1]) ** 2 +
    (pos1[2] - pos0[2]) ** 2,
  )

  const depth = seriesSlices.length
  const dimensions: [number, number, number] = [columns, rows, depth]
  const spacing: [number, number, number] = [pixelSpacing[1], pixelSpacing[0], sliceSpacing || seriesSlices[0].sliceThickness]
  const origin: [number, number, number] = [...pos0]

  // Build the contiguous volume
  const totalVoxels = columns * rows * depth
  const volume = new Int16Array(totalVoxels)

  for (let z = 0; z < depth; z++) {
    const sliceData = extractPixelValues(seriesSlices[z])
    volume.set(sliceData, z * columns * rows)

    // Report progress (10% to 95%)
    if (z % 10 === 0 || z === depth - 1) {
      postMsg({ type: 'progress', percent: 10 + Math.round((z / depth) * 85) })
    }
  }

  postMsg({
    type: 'complete',
    volume,
    dimensions,
    spacing,
    origin,
  })
}
