import type { DicomSlice, DicomParserResponse, SeriesInfo, VolumeAssemblerResponse, VolumeData } from '../types/dicom'
import { useAppStore } from '../stores/useAppStore'

let dicomWorker: Worker | null = null
let volumeWorker: Worker | null = null

function getDicomWorker(): Worker {
  if (!dicomWorker) {
    dicomWorker = new Worker(
      new URL('./dicomParser.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return dicomWorker
}

function getVolumeWorker(): Worker {
  if (!volumeWorker) {
    volumeWorker = new Worker(
      new URL('./volumeAssembler.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return volumeWorker
}

export interface ParseResult {
  slices: DicomSlice[]
  seriesList: SeriesInfo[]
}

export function parseFiles(files: File[]): Promise<ParseResult> {
  const { setProgress } = useAppStore.getState()

  return new Promise((resolve, reject) => {
    // Read all files into ArrayBuffers
    const readPromises = files.map((f) => f.arrayBuffer())

    Promise.all(readPromises).then((buffers) => {
      const worker = getDicomWorker()
      const fileNames = files.map((f) => f.name)

      worker.onmessage = (e: MessageEvent<DicomParserResponse>) => {
        const msg = e.data
        if (msg.type === 'progress') {
          setProgress({
            step: 'parsingDicom',
            percent: Math.round((msg.current / msg.total) * 100),
          })
        } else if (msg.type === 'complete') {
          resolve({ slices: msg.slices, seriesList: msg.seriesList })
        } else if (msg.type === 'error') {
          reject(new Error(msg.message))
        }
      }

      worker.onerror = (err) => reject(new Error(err.message))

      worker.postMessage({ type: 'parse', files: buffers, fileNames })
    }).catch(reject)
  })
}

export function assembleVolume(slices: DicomSlice[], seriesUID: string): Promise<VolumeData> {
  const { setProgress } = useAppStore.getState()

  return new Promise((resolve, reject) => {
    const worker = getVolumeWorker()

    worker.onmessage = (e: MessageEvent<VolumeAssemblerResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setProgress({ step: 'buildingVolume', percent: msg.percent })
      } else if (msg.type === 'complete') {
        resolve({
          volume: msg.volume,
          dimensions: msg.dimensions,
          spacing: msg.spacing,
          origin: msg.origin,
        })
      } else if (msg.type === 'error') {
        reject(new Error(msg.message))
      }
    }

    worker.onerror = (err) => reject(new Error(err.message))

    worker.postMessage({ type: 'assemble', slices, seriesUID })
  })
}

export function terminateWorkers() {
  dicomWorker?.terminate()
  dicomWorker = null
  volumeWorker?.terminate()
  volumeWorker = null
}
