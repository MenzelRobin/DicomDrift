import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from './stores/useAppStore'
import { parseFiles, assembleVolume, generateMesh, terminateWorkers } from './pipeline/pipeline'
import type { DicomSlice, SeriesInfo, VolumeData } from './types/dicom'
import { Landing } from './components/Landing'
import { ProcessingOverlay } from './components/ProcessingOverlay'
import { SeriesSelector } from './components/SeriesSelector'
import { Viewer } from './components/Viewer'

export default function App() {
  const { t } = useTranslation('common')
  const phase = useAppStore((s) => s.phase)
  const setPhase = useAppStore((s) => s.setPhase)
  const setProgress = useAppStore((s) => s.setProgress)
  const setLayers = useAppStore((s) => s.setLayers)

  const [parsedSlices, setParsedSlices] = useState<DicomSlice[] | null>(null)
  const [seriesList, setSeriesList] = useState<SeriesInfo[] | null>(null)
  const [showSeriesSelector, setShowSeriesSelector] = useState(false)

  const handleFiles = useCallback(
    async (files: File[]) => {
      setPhase('processing')
      setProgress({ step: 'parsingDicom', percent: 0 })

      try {
        const { slices, seriesList: series } = await parseFiles(files)
        setParsedSlices(slices)
        setSeriesList(series)

        if (series.length > 1) {
          setShowSeriesSelector(true)
        } else {
          await processVolume(slices, series[0].seriesInstanceUID)
        }
      } catch (err) {
        console.error('Pipeline error:', err)
        alert(t('errorGeneric'))
        handleCancel()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const runMeshGeneration = async (volumeData: VolumeData) => {
    const { params } = useAppStore.getState()
    setProgress({ step: 'generatingMesh', percent: 0 })

    const mesh = await generateMesh(
      volumeData.volume,
      volumeData.dimensions,
      volumeData.spacing,
      params.isoThreshold,
      params.resolution,
      params.smoothIterations,
    )

    setLayers({
      bone: {
        vertices: mesh.vertices,
        indices: mesh.indices,
        color: '#e8dcc8',
        opacity: 1.0,
        visible: true,
      },
    })
  }

  const processVolume = async (slices: DicomSlice[], seriesUID: string) => {
    setShowSeriesSelector(false)
    setProgress({ step: 'buildingVolume', percent: 0 })

    try {
      const volumeData = await assembleVolume(slices, seriesUID)
      useAppStore.setState({
        cachedVolume: volumeData.volume.buffer as ArrayBuffer,
        volumeMeta: volumeData,
      })

      await runMeshGeneration(volumeData)

      setProgress(null)
      setPhase('viewing')
    } catch (err) {
      console.error('Pipeline error:', err)
      alert(t('errorGeneric'))
      handleCancel()
    }
  }

  const handleSeriesSelect = (seriesUID: string) => {
    if (parsedSlices) {
      processVolume(parsedSlices, seriesUID)
    }
  }

  const handleCancel = () => {
    setShowSeriesSelector(false)
    setParsedSlices(null)
    setSeriesList(null)
    setProgress(null)
    setPhase('landing')
    terminateWorkers()
  }

  return (
    <>
      {phase === 'landing' && <Landing onFilesSelected={handleFiles} />}

      {phase === 'processing' && !showSeriesSelector && <ProcessingOverlay />}

      {showSeriesSelector && seriesList && (
        <SeriesSelector
          seriesList={seriesList}
          onSelect={handleSeriesSelect}
          onCancel={handleCancel}
        />
      )}

      {phase === 'viewing' && (
        <Viewer onLoadNew={() => {
          useAppStore.getState().resetToLanding()
          terminateWorkers()
        }} />
      )}
    </>
  )
}
