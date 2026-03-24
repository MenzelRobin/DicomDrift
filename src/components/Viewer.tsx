import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ThreeCanvas, type ThreeCanvasHandle } from './ThreeCanvas'
import { ControlPanel } from './ControlPanel'
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

  return (
    <div className="viewer">
      <div className="viewer-topbar">
        <span className="viewer-title">DicomDrift</span>
      </div>

      <ThreeCanvas onReady={onReady} />

      <ControlPanel onResetView={onResetView} onLoadNew={onLoadNew} />

      <div className="viewer-hint">
        {isTouchDevice ? t('hintTouch') : t('hintMouse')}
        {' · '}
        {t('hintReset')}
      </div>
    </div>
  )
}
