import { useTranslation } from 'react-i18next'
import { VIEW_ORIENTATIONS } from '../viewer/arcballControls'
import { LayerConfigurator } from './LayerConfigurator'
import './ControlPanel.css'

interface Props {
  onResetView: () => void
  onSetView: (name: string) => void
  onLoadNew: () => void
}

export function ControlPanel({ onResetView, onSetView, onLoadNew }: Props) {
  const { t } = useTranslation('viewer')

  return (
    <div className="control-panel glass">
      <LayerConfigurator />

      <div className="cp-divider" />

      <div className="cp-views">
        <span className="cp-views-label">{t('view', { defaultValue: 'View' })}</span>
        <div className="cp-views-grid">
          {Object.entries(VIEW_ORIENTATIONS).map(([key, view]) => (
            <button
              key={key}
              className="cp-view-btn"
              onClick={() => onSetView(key)}
              title={view.label}
              aria-label={view.label}
            >
              {view.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-actions">
        <button className="cp-action-btn" onClick={onResetView}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {t('resetView')}
        </button>
        <button className="cp-action-btn cp-action-btn--muted" onClick={onLoadNew}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {t('loadNewData')}
        </button>
      </div>
    </div>
  )
}
