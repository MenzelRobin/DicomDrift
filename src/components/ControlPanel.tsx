import { useTranslation } from 'react-i18next'
import { useAppStore } from '../stores/useAppStore'
import './ControlPanel.css'

interface Props {
  onResetView: () => void
  onLoadNew: () => void
}

export function ControlPanel({ onResetView, onLoadNew }: Props) {
  const { t } = useTranslation('viewer')
  const layers = useAppStore((s) => s.layers)
  const updateVisibility = useAppStore((s) => s.updateLayerVisibility)
  const updateOpacity = useAppStore((s) => s.updateLayerOpacity)

  const layerEntries = Object.entries(layers)

  return (
    <div className="control-panel glass">
      <div className="panel-section">
        <h3 className="panel-title">{t('layers')}</h3>
        {layerEntries.map(([name, layer]) => (
          <div key={name} className="layer-row">
            <button
              className={`layer-toggle ${layer.visible ? 'layer-toggle--active' : ''}`}
              onClick={() => updateVisibility(name, !layer.visible)}
            >
              <span
                className="layer-dot"
                style={{ background: layer.visible ? layer.color : 'transparent', borderColor: layer.color }}
              />
              <span className="layer-name">{name}</span>
            </button>
            {layer.opacity < 0.98 && (
              <div className="opacity-row">
                <label className="opacity-label" htmlFor={`opacity-${name}`}>{t('opacity')}</label>
                <input
                  id={`opacity-${name}`}
                  type="range"
                  min="0.02"
                  max="1"
                  step="0.01"
                  value={layer.opacity}
                  onChange={(e) => updateOpacity(name, parseFloat(e.target.value))}
                  className="opacity-slider"
                  aria-label={`${t('opacity')} ${name}`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="panel-section panel-actions">
        <button className="btn btn-panel" onClick={onResetView}>
          {t('resetView')}
        </button>
        <button className="btn btn-panel btn-panel--muted" onClick={onLoadNew}>
          {t('loadNewData')}
        </button>
      </div>
    </div>
  )
}
