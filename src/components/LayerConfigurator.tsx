import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, PRESET_LAYERS, type LayerConfig } from '../stores/useAppStore'
import { generateMesh } from '../pipeline/pipeline'
import { VolumeHistogram } from './VolumeHistogram'
import './LayerConfigurator.css'

let idCounter = 0
function nextId() {
  return `layer_${++idCounter}`
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

interface LayerCardProps {
  config: LayerConfig
  hasGenerated: boolean
  onRegenerate: (config: LayerConfig) => void
  onRemove: (id: string) => void
}

function LayerCard({ config, hasGenerated, onRegenerate, onRemove }: LayerCardProps) {
  const { t } = useTranslation('viewer')
  const [expanded, setExpanded] = useState(true)
  const [lastFingerprint, setLastFingerprint] = useState('')
  const updateConfig = useAppStore((s) => s.updateLayerConfig)
  const updateVisibility = useAppStore((s) => s.updateLayerVisibility)
  const layers = useAppStore((s) => s.layers)

  const isVisible = layers[config.id]?.visible ?? true
  const currentFingerprint = `${config.threshold}:${config.opacity}:${config.smoothing}:${config.resolution}:${config.color}`
  const isDirty = hasGenerated && lastFingerprint !== '' && currentFingerprint !== lastFingerprint

  // Track the fingerprint when first generated externally
  if (hasGenerated && lastFingerprint === '') {
    // Use setTimeout to avoid state update during render
    setTimeout(() => setLastFingerprint(currentFingerprint), 0)
  }

  const handleGenerate = () => {
    setLastFingerprint(currentFingerprint)
    onRegenerate(config)
  }

  return (
    <div className={`lc-card ${config.generating ? 'lc-card--generating' : ''}`}>
      <div className="lc-card-header">
        <button className="lc-expand" onClick={() => setExpanded(!expanded)}>
          <ChevronIcon expanded={expanded} />
        </button>

        <button
          className="lc-color-swatch"
          style={{ background: config.color }}
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'color'
            input.value = config.color
            input.addEventListener('input', (e) => {
              updateConfig(config.id, { color: (e.target as HTMLInputElement).value })
            })
            input.click()
          }}
        />

        <span className="lc-card-name" onClick={() => setExpanded(!expanded)}>
          {config.name}
        </span>

        {hasGenerated && (
          <button
            className={`lc-eye ${!isVisible ? 'lc-eye--hidden' : ''}`}
            onClick={() => updateVisibility(config.id, !isVisible)}
            title={isVisible ? 'Hide' : 'Show'}
          >
            <EyeIcon open={isVisible} />
          </button>
        )}

        <button
          className="lc-remove"
          onClick={() => onRemove(config.id)}
          title="Remove layer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="lc-card-body">
          <div className="lc-param">
            <div className="lc-param-header">
              <span className="lc-param-label">{t('threshold')}</span>
              <span className="lc-param-value-inline">
                <input
                  type="number"
                  className="lc-num-input"
                  value={config.threshold}
                  min={-1024}
                  max={3071}
                  step={10}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v)) updateConfig(config.id, { threshold: Math.max(-1024, Math.min(3071, v)) })
                  }}
                />
                <span className="lc-unit">HU</span>
              </span>
            </div>
            <VolumeHistogram
              threshold={config.threshold}
              onThresholdChange={(v) => updateConfig(config.id, { threshold: v })}
            />
          </div>

          <div className="lc-param">
            <span className="lc-param-label">{t('opacity')}</span>
            <div className="lc-param-control">
              <input
                type="range"
                min="0.02"
                max="1"
                step="0.01"
                value={config.opacity}
                onChange={(e) => {
                  const opacity = parseFloat(e.target.value)
                  updateConfig(config.id, { opacity })
                  const { layers: l, updateLayerOpacity } = useAppStore.getState()
                  if (l[config.id]) updateLayerOpacity(config.id, opacity)
                }}
                className="lc-slider"
              />
              <input
                type="number"
                className="lc-num-input lc-num-input--small"
                value={Math.round(config.opacity * 100)}
                min={2}
                max={100}
                step={1}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) {
                    const opacity = Math.max(0.02, Math.min(1, v / 100))
                    updateConfig(config.id, { opacity })
                    const { layers: l, updateLayerOpacity } = useAppStore.getState()
                    if (l[config.id]) updateLayerOpacity(config.id, opacity)
                  }
                }}
              />
              <span className="lc-unit">%</span>
            </div>
          </div>

          <div className="lc-param">
            <span className="lc-param-label">{t('smoothing')}</span>
            <div className="lc-param-control">
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={config.smoothing}
                onChange={(e) => updateConfig(config.id, { smoothing: parseInt(e.target.value) })}
                className="lc-slider"
              />
              <input
                type="number"
                className="lc-num-input lc-num-input--small"
                value={config.smoothing}
                min={0}
                max={20}
                step={1}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) updateConfig(config.id, { smoothing: Math.max(0, Math.min(20, v)) })
                }}
              />
            </div>
          </div>

          <label className="lc-toggle">
            <input
              type="checkbox"
              checked={config.invertNormals}
              onChange={(e) => updateConfig(config.id, { invertNormals: e.target.checked })}
            />
            <span className="lc-toggle-label">Invert normals</span>
          </label>

          <button
            className={`lc-generate ${isDirty ? 'lc-generate--dirty' : ''}`}
            onClick={handleGenerate}
            disabled={config.generating}
          >
            {config.generating ? (
              <span className="lc-spinner" />
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                {hasGenerated ? t('reprocess') : 'Generate'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export function LayerConfigurator() {
  const { t } = useTranslation('viewer')
  const configs = useAppStore((s) => s.layerConfigs)
  const volumeMeta = useAppStore((s) => s.volumeMeta)
  const layers = useAppStore((s) => s.layers)
  const updateConfig = useAppStore((s) => s.updateLayerConfig)
  const addConfig = useAppStore((s) => s.addLayerConfig)
  const removeConfigStore = useAppStore((s) => s.removeLayerConfig)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const regenerateLayer = useCallback(async (config: LayerConfig) => {
    if (!volumeMeta || config.generating) return

    updateConfig(config.id, { generating: true })

    try {
      const mesh = await generateMesh(
        volumeMeta.volume,
        volumeMeta.dimensions,
        volumeMeta.spacing,
        config.threshold,
        config.resolution,
        config.smoothing,
        config.invertNormals,
      )

      if (mesh.indices.length > 50) {
        useAppStore.getState().setLayer(config.id, {
          vertices: mesh.vertices,
          indices: mesh.indices,
          color: config.color,
          opacity: config.opacity,
          visible: true,
        })
      }
    } catch (err) {
      console.warn(`Layer "${config.name}" generation failed:`, err)
    }

    updateConfig(config.id, { generating: false })
  }, [volumeMeta, updateConfig])

  const addPreset = (key: string) => {
    const preset = PRESET_LAYERS[key]
    if (!preset) return
    const id = nextId()
    addConfig({ ...preset, id, generating: false })
    setAddMenuOpen(false)
  }

  const removeLayerFull = (id: string) => {
    removeConfigStore(id)
    useAppStore.getState().removeLayer(id)
  }

  return (
    <div className="layer-configurator">
      <div className="lc-section-header">
        <h3 className="lc-title">{t('layers')}</h3>
        <div className="lc-add-wrap">
          <button
            className="lc-add-btn"
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            title="Add layer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {addMenuOpen && (
            <div className="lc-add-menu glass">
              {Object.entries(PRESET_LAYERS).map(([key, preset]) => (
                <button
                  key={key}
                  className="lc-add-option"
                  onClick={() => addPreset(key)}
                >
                  <span className="lc-add-option-dot" style={{ background: preset.color }} />
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lc-cards">
        {configs.map((config) => (
          <LayerCard
            key={config.id}
            config={config}
            hasGenerated={!!layers[config.id]}
            onRegenerate={regenerateLayer}
            onRemove={removeLayerFull}
          />
        ))}
      </div>
    </div>
  )
}
