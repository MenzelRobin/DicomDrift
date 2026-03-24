import { useTranslation } from 'react-i18next'
import type { SeriesInfo } from '../types/dicom'
import './SeriesSelector.css'

interface Props {
  seriesList: SeriesInfo[]
  onSelect: (seriesUID: string) => void
  onCancel: () => void
}

export function SeriesSelector({ seriesList, onSelect, onCancel }: Props) {
  const { t } = useTranslation('processing')

  return (
    <div className="series-overlay">
      <div className="series-card glass">
        <h2>{t('seriesSelection')}</h2>
        <div className="series-list">
          {seriesList.map((series) => (
            <button
              key={series.seriesInstanceUID}
              className="series-item glass"
              onClick={() => onSelect(series.seriesInstanceUID)}
            >
              <div className="series-info">
                <span className="series-description">
                  {series.seriesDescription || series.modality || 'Unknown'}
                </span>
                <span className="series-meta">
                  {t('seriesSlices', { count: series.sliceCount })}
                  {' · '}
                  {series.rows}×{series.columns}
                  {series.modality && ` · ${series.modality}`}
                </span>
              </div>
              <span className="series-select-label">{t('seriesSelect')}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-cancel" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
