export interface DicomSlice {
  seriesInstanceUID: string
  seriesDescription: string
  modality: string
  imagePositionPatient: [number, number, number]
  imageOrientationPatient: [number, number, number, number, number, number]
  pixelSpacing: [number, number]
  sliceThickness: number
  rows: number
  columns: number
  bitsAllocated: number
  bitsStored: number
  pixelRepresentation: number
  rescaleSlope: number
  rescaleIntercept: number
  windowCenter: number
  windowWidth: number
  pixelData: ArrayBuffer
}

export interface SeriesInfo {
  seriesInstanceUID: string
  seriesDescription: string
  modality: string
  sliceCount: number
  rows: number
  columns: number
}

export interface VolumeData {
  volume: Int16Array
  dimensions: [number, number, number]
  spacing: [number, number, number]
  origin: [number, number, number]
}

export interface MeshResult {
  vertices: Float32Array
  indices: Uint32Array
}

// Worker message types
export type DicomParserMessage =
  | { type: 'parse'; files: ArrayBuffer[]; fileNames: string[] }

export type DicomParserResponse =
  | { type: 'progress'; current: number; total: number }
  | { type: 'complete'; slices: DicomSlice[]; seriesList: SeriesInfo[] }
  | { type: 'error'; message: string }

export type VolumeAssemblerMessage =
  | { type: 'assemble'; slices: DicomSlice[]; seriesUID: string }

export type VolumeAssemblerResponse =
  | { type: 'progress'; percent: number }
  | { type: 'complete'; volume: Int16Array; dimensions: [number, number, number]; spacing: [number, number, number]; origin: [number, number, number] }
  | { type: 'error'; message: string }
