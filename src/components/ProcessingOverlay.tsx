import { useTranslation } from 'react-i18next'
import { useAppStore } from '../stores/useAppStore'
import './ProcessingOverlay.css'

export function ProcessingOverlay() {
  const { t } = useTranslation('processing')
  const progress = useAppStore((s) => s.progress)

  if (!progress) return null

  const stepLabel = (() => {
    switch (progress.step) {
      case 'parsingDicom':
        return t('parsingDicom')
      case 'buildingVolume':
        return t('buildingVolume')
      case 'generatingMesh':
        return t('generatingMesh')
      case 'smoothingMesh':
        return t('smoothingMesh')
      default:
        return t('almostDone')
    }
  })()

  return (
    <div className="processing-overlay">
      <div className="processing-card glass">
        <h2>{t('title')}</h2>
        <p className="processing-step">{stepLabel}</p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="progress-percent">{progress.percent}%</p>
      </div>
    </div>
  )
}
