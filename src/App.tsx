import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, DEFAULT_LAYER_CONFIGS } from './stores/useAppStore'
import { parseFiles, assembleVolume, generateMesh, terminateWorkers } from './pipeline/pipeline'
import { loadModel } from './io/loadModel'
import { saveSession, loadSession, hasSession, clearSession } from './io/sessionCache'
import type { DicomSlice, SeriesInfo } from './types/dicom'
import { Landing } from './components/Landing'
import { ProcessingOverlay } from './components/ProcessingOverlay'
import { SeriesSelector } from './components/SeriesSelector'
import { Viewer } from './components/Viewer'

export default function App() {
  const { t } = useTranslation('common')
  const phase = useAppStore((s) => s.phase)
  const setPhase = useAppStore((s) => s.setPhase)
  const setProgress = useAppStore((s) => s.setProgress)
  const layers = useAppStore((s) => s.layers)
  const layerConfigs = useAppStore((s) => s.layerConfigs)

  const [parsedSlices, setParsedSlices] = useState<DicomSlice[] | null>(null)
  const [seriesList, setSeriesList] = useState<SeriesInfo[] | null>(null)
  const [showSeriesSelector, setShowSeriesSelector] = useState(false)
  const [cachedSessionInfo, setCachedSessionInfo] = useState<{ timestamp: number } | null>(null)

  // Check for cached session on mount
  useEffect(() => {
    hasSession().then((info) => {
      if (info.exists && info.timestamp) {
        setCachedSessionInfo({ timestamp: info.timestamp })
      }
    }).catch(() => { /* IndexedDB unavailable */ })
  }, [])

  // Auto-save session when layers change (debounced)
  useEffect(() => {
    if (phase !== 'viewing' || Object.keys(layers).length === 0) return
    const timer = setTimeout(() => {
      saveSession(layers, layerConfigs).catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [layers, layerConfigs, phase])

  const handleResumeSession = useCallback(async () => {
    const session = await loadSession()
    if (session) {
      useAppStore.getState().setLayers(session.layers)
      useAppStore.getState().setLayerConfigs(session.layerConfigs)
      setPhase('viewing')
      setCachedSessionInfo(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const processVolume = async (slices: DicomSlice[], seriesUID: string) => {
    setShowSeriesSelector(false)
    setProgress({ step: 'buildingVolume', percent: 0 })

    try {
      const volumeData = await assembleVolume(slices, seriesUID)
      useAppStore.setState({
        cachedVolume: volumeData.volume.buffer as ArrayBuffer,
        volumeMeta: volumeData,
      })

      const defaultConfig = DEFAULT_LAYER_CONFIGS[0]
      setProgress({ step: 'generatingMesh', percent: 0 })

      const mesh = await generateMesh(
        volumeData.volume,
        volumeData.dimensions,
        volumeData.spacing,
        defaultConfig.threshold,
        defaultConfig.resolution,
        defaultConfig.smoothing,
        defaultConfig.invertNormals,
      )

      useAppStore.getState().setLayer(defaultConfig.id, {
        vertices: mesh.vertices,
        indices: mesh.indices,
        color: defaultConfig.color,
        opacity: defaultConfig.opacity,
        visible: true,
      })

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

  const handleModelLoaded = useCallback(async (file: File) => {
    try {
      const { layers: loadedLayers, layerConfigs: loadedConfigs } = await loadModel(file)
      useAppStore.getState().setLayers(loadedLayers)
      if (loadedConfigs) useAppStore.getState().setLayerConfigs(loadedConfigs)
      setPhase('viewing')
    } catch (err) {
      console.error('Failed to load model:', err)
      alert(t('errorGeneric'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = () => {
    setShowSeriesSelector(false)
    setParsedSlices(null)
    setSeriesList(null)
    setProgress(null)
    setPhase('landing')
    terminateWorkers()
    clearSession().catch(() => {})
  }

  return (
    <>
      {phase === 'landing' && (
        <Landing
          onFilesSelected={handleFiles}
          onModelLoaded={handleModelLoaded}
          cachedSession={cachedSessionInfo}
          onResumeSession={handleResumeSession}
        />
      )}

      {phase === 'processing' && !showSeriesSelector && <ProcessingOverlay />}

      {showSeriesSelector && seriesList && (
        <SeriesSelector
          seriesList={seriesList}
          onSelect={handleSeriesSelect}
          onCancel={handleCancel}
        />
      )}

      {phase === 'viewing' && (
        <Viewer onLoadNew={handleCancel} />
      )}
    </>
  )
}
