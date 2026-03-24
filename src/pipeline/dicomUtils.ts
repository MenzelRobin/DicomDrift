// DICOM tag constants (group, element) as hex strings for dicom-parser
export const TAG = {
  SeriesInstanceUID: 'x0020000e',
  SeriesDescription: 'x0008103e',
  Modality: 'x00080060',
  ImagePositionPatient: 'x00200032',
  ImageOrientationPatient: 'x00200037',
  PixelSpacing: 'x00280030',
  SliceThickness: 'x00180050',
  Rows: 'x00280010',
  Columns: 'x00280011',
  BitsAllocated: 'x00280100',
  BitsStored: 'x00280101',
  PixelRepresentation: 'x00280103',
  RescaleSlope: 'x00281053',
  RescaleIntercept: 'x00281052',
  WindowCenter: 'x00281050',
  WindowWidth: 'x00281051',
  PixelData: 'x7fe00010',
} as const

export function parseNumberArray(value: string | undefined, count: number): number[] {
  if (!value) return new Array(count).fill(0)
  return value.split('\\').map(Number)
}

export function parseFloat_(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = parseFloat(value)
  return isNaN(n) ? fallback : n
}

export function parseInt_(value: number | undefined, fallback: number): number {
  return value !== undefined ? value : fallback
}
