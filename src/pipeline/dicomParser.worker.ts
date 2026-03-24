import dicomParser from 'dicom-parser'
import { TAG, parseNumberArray, parseFloat_, parseInt_ } from './dicomUtils'
import type { DicomSlice, DicomParserMessage, DicomParserResponse, SeriesInfo } from '../types/dicom'

function postMsg(msg: DicomParserResponse) {
  postMessage(msg)
}

function parseSingleFile(buffer: ArrayBuffer, fileName: string): DicomSlice | null {
  try {
    const byteArray = new Uint8Array(buffer)
    const dataSet = dicomParser.parseDicom(byteArray)

    const rows = parseInt_(dataSet.uint16(TAG.Rows), 0)
    const columns = parseInt_(dataSet.uint16(TAG.Columns), 0)
    if (rows === 0 || columns === 0) return null

    const pixelDataElement = dataSet.elements[TAG.PixelData]
    if (!pixelDataElement) return null

    const bitsAllocated = parseInt_(dataSet.uint16(TAG.BitsAllocated), 16)
    const pixelRepresentation = parseInt_(dataSet.uint16(TAG.PixelRepresentation), 0)

    // Extract pixel data as a copy (the original buffer may be neutered on transfer)
    const pixelDataOffset = pixelDataElement.dataOffset
    const pixelDataLength = pixelDataElement.length
    const pixelData = buffer.slice(pixelDataOffset, pixelDataOffset + pixelDataLength)

    const ipp = parseNumberArray(dataSet.string(TAG.ImagePositionPatient), 3)
    const iop = parseNumberArray(dataSet.string(TAG.ImageOrientationPatient), 6)
    const ps = parseNumberArray(dataSet.string(TAG.PixelSpacing), 2)

    return {
      seriesInstanceUID: dataSet.string(TAG.SeriesInstanceUID) ?? 'unknown',
      seriesDescription: dataSet.string(TAG.SeriesDescription) ?? '',
      modality: dataSet.string(TAG.Modality) ?? '',
      imagePositionPatient: [ipp[0], ipp[1], ipp[2]],
      imageOrientationPatient: [iop[0], iop[1], iop[2], iop[3], iop[4], iop[5]],
      pixelSpacing: [ps[0] || 1, ps[1] || 1],
      sliceThickness: parseFloat_(dataSet.string(TAG.SliceThickness), 1),
      rows,
      columns,
      bitsAllocated,
      bitsStored: parseInt_(dataSet.uint16(TAG.BitsStored), bitsAllocated),
      pixelRepresentation,
      rescaleSlope: parseFloat_(dataSet.string(TAG.RescaleSlope), 1),
      rescaleIntercept: parseFloat_(dataSet.string(TAG.RescaleIntercept), 0),
      windowCenter: parseFloat_(dataSet.string(TAG.WindowCenter), 400),
      windowWidth: parseFloat_(dataSet.string(TAG.WindowWidth), 1500),
      pixelData,
    }
  } catch {
    console.warn(`Failed to parse DICOM file: ${fileName}`)
    return null
  }
}

self.onmessage = (e: MessageEvent<DicomParserMessage>) => {
  const { files, fileNames } = e.data
  const total = files.length
  const slices: DicomSlice[] = []

  for (let i = 0; i < total; i++) {
    const slice = parseSingleFile(files[i], fileNames[i])
    if (slice) {
      slices.push(slice)
    }
    postMsg({ type: 'progress', current: i + 1, total })
  }

  if (slices.length === 0) {
    postMsg({ type: 'error', message: 'No valid DICOM files found' })
    return
  }

  // Group by series and build series info
  const seriesMap = new Map<string, DicomSlice[]>()
  for (const slice of slices) {
    const existing = seriesMap.get(slice.seriesInstanceUID)
    if (existing) {
      existing.push(slice)
    } else {
      seriesMap.set(slice.seriesInstanceUID, [slice])
    }
  }

  const seriesList: SeriesInfo[] = Array.from(seriesMap.entries()).map(
    ([uid, seriesSlices]) => ({
      seriesInstanceUID: uid,
      seriesDescription: seriesSlices[0].seriesDescription,
      modality: seriesSlices[0].modality,
      sliceCount: seriesSlices.length,
      rows: seriesSlices[0].rows,
      columns: seriesSlices[0].columns,
    }),
  )

  // Sort by slice count descending so the largest series is first
  seriesList.sort((a, b) => b.sliceCount - a.sliceCount)

  postMsg({ type: 'complete', slices, seriesList })
}
