import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../stores/useAppStore'
import { ThreeCanvas, type ThreeCanvasHandle } from './ThreeCanvas'
import { ControlPanel } from './ControlPanel'
import { saveModel } from '../io/saveModel'
import { exportSTL } from '../io/exportSTL'
import { exportScreenshot } from '../io/exportScreenshot'
import './Viewer.css'

interface Props {
  onLoadNew: () => void
}

export function Viewer({ onLoadNew }: Props) {
  const { t } = useTranslation('viewer')
  const handleRef = useRef<ThreeCanvasHandle | null>(null)
  const [isTouchDevice] = useState(() =>
    'ontouchstart' in window || navigator.maxTouchPoints > 0,
  )

  const onReady = useCallback((handle: ThreeCanvasHandle) => {
    handleRef.current = handle
  }, [])

  const onResetView = useCallback(() => {
    handleRef.current?.resetView()
  }, [])

  const onSetView = useCallback((name: string) => {
    handleRef.current?.setView(name)
  }, [])

  const onSave = useCallback(() => {
    const { layers, layerConfigs } = useAppStore.getState()
    saveModel(layers, layerConfigs)
  }, [])

  const onExportSTL = useCallback(() => {
    const { layers } = useAppStore.getState()
    exportSTL(layers)
  }, [])

  const onScreenshot = useCallback(() => {
    const ctx = handleRef.current?.getSceneContext()
    if (ctx) exportScreenshot(ctx.renderer, ctx.scene, ctx.camera)
  }, [])

  return (
    <div className="viewer">
      <div className="viewer-topbar">
        <span className="viewer-title">DicomDrift</span>
      </div>

      <ThreeCanvas onReady={onReady} />

      <ControlPanel
        onResetView={onResetView}
        onSetView={onSetView}
        onSave={onSave}
        onExportSTL={onExportSTL}
        onScreenshot={onScreenshot}
        onLoadNew={onLoadNew}
      />

      <div className="viewer-hint">
        {isTouchDevice ? t('hintTouch') : t('hintMouse')}
        {' · '}
        {t('hintReset')}
      </div>
    </div>
  )
}
