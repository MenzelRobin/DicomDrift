import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import './VolumeHistogram.css'

const BINS = 256
const HU_MIN = -1024
const HU_MAX = 3071
const BIN_WIDTH = (HU_MAX - HU_MIN) / BINS

interface Props {
  threshold: number
  onThresholdChange: (value: number) => void
}

interface HistogramData {
  counts: Float32Array
  peaks: number[]
  suggestedThresholds: { label: string; value: number }[]
}

function computeHistogram(volume: Int16Array): HistogramData {
  const counts = new Float32Array(BINS)

  for (let i = 0; i < volume.length; i++) {
    const bin = Math.floor((volume[i] - HU_MIN) / BIN_WIDTH)
    if (bin >= 0 && bin < BINS) counts[bin]++
  }

  // Log scale for display
  const logCounts = new Float32Array(BINS)
  for (let i = 0; i < BINS; i++) {
    logCounts[i] = counts[i] > 0 ? Math.log(counts[i] + 1) : 0
  }

  // Smooth histogram for peak detection (gaussian-ish)
  const smoothed = new Float32Array(BINS)
  const kernel = 5
  for (let i = 0; i < BINS; i++) {
    let sum = 0
    let weight = 0
    for (let k = -kernel; k <= kernel; k++) {
      const j = i + k
      if (j >= 0 && j < BINS) {
        const w = Math.exp(-(k * k) / (2 * kernel))
        sum += logCounts[j] * w
        weight += w
      }
    }
    smoothed[i] = sum / weight
  }

  // Find peaks (local maxima in smoothed histogram)
  const peaks: number[] = []
  for (let i = 3; i < BINS - 3; i++) {
    if (
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1] &&
      smoothed[i] > smoothed[i - 2] &&
      smoothed[i] > smoothed[i + 2] &&
      counts[i] > volume.length * 0.001 // minimum significance
    ) {
      peaks.push(i)
    }
  }

  // Find optimal thresholds by looking for valleys in specific HU regions
  // Each preset scans a region of the histogram for the best separation point
  const presets = [
    { label: 'Bone', searchMin: 80, searchMax: 400, fallback: 200 },
    { label: 'Soft Tissue', searchMin: -250, searchMax: 50, fallback: -100 },
    { label: 'Skin', searchMin: -600, searchMax: -150, fallback: -400 },
  ]

  const suggestedThresholds: { label: string; value: number }[] = []

  for (const preset of presets) {
    const binMin = Math.max(0, Math.floor((preset.searchMin - HU_MIN) / BIN_WIDTH))
    const binMax = Math.min(BINS - 1, Math.floor((preset.searchMax - HU_MIN) / BIN_WIDTH))

    // Find the deepest valley in this region
    let minVal = Infinity
    let minBin = -1
    for (let i = binMin; i <= binMax; i++) {
      if (smoothed[i] < minVal) {
        minVal = smoothed[i]
        minBin = i
      }
    }

    const hu = minBin >= 0
      ? Math.round((HU_MIN + minBin * BIN_WIDTH) / 10) * 10
      : preset.fallback

    suggestedThresholds.push({ label: preset.label, value: hu })
  }

  return { counts: logCounts, peaks, suggestedThresholds }
}

export function VolumeHistogram({ threshold, onThresholdChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const volumeMeta = useAppStore((s) => s.volumeMeta)
  const isDragging = useRef(false)

  const histData = useMemo(() => {
    if (!volumeMeta) return null
    return computeHistogram(volumeMeta.volume)
  }, [volumeMeta])

  const huToX = useCallback((hu: number, width: number) => {
    return ((hu - HU_MIN) / (HU_MAX - HU_MIN)) * width
  }, [])

  const xToHu = useCallback((x: number, width: number) => {
    return Math.round((x / width) * (HU_MAX - HU_MIN) + HU_MIN)
  }, [])

  // Draw histogram
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !histData) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height

    ctx.clearRect(0, 0, w, h)

    // Find max for normalization
    let max = 0
    for (let i = 0; i < BINS; i++) {
      if (histData.counts[i] > max) max = histData.counts[i]
    }
    if (max === 0) return

    // Draw bars
    const barW = w / BINS
    for (let i = 0; i < BINS; i++) {
      const barH = (histData.counts[i] / max) * (h - 2)
      const hu = HU_MIN + i * BIN_WIDTH
      const isAboveThreshold = hu >= threshold

      ctx.fillStyle = isAboveThreshold
        ? 'rgba(85, 102, 238, 0.5)'
        : 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(i * barW, h - barH, barW + 0.5, barH)
    }

    // Draw threshold line
    const tx = huToX(threshold, w)
    ctx.strokeStyle = '#5566ee'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(tx, 0)
    ctx.lineTo(tx, h)
    ctx.stroke()

    // Draw threshold value label
    ctx.fillStyle = '#5566ee'
    ctx.font = '9px system-ui'
    ctx.textAlign = tx > w / 2 ? 'right' : 'left'
    ctx.fillText(`${threshold} HU`, tx + (tx > w / 2 ? -4 : 4), 10)

  }, [histData, threshold, huToX])

  const handlePointer = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const hu = xToHu(x, rect.width)
    const clamped = Math.max(HU_MIN, Math.min(HU_MAX, Math.round(hu / 10) * 10))
    onThresholdChange(clamped)
  }, [xToHu, onThresholdChange])

  if (!histData) return null

  return (
    <div className="vh-container">
      <canvas
        ref={canvasRef}
        className="vh-canvas"
        onPointerDown={(e) => {
          isDragging.current = true
          ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
          handlePointer(e)
        }}
        onPointerMove={(e) => {
          if (isDragging.current) handlePointer(e)
        }}
        onPointerUp={() => { isDragging.current = false }}
      />
      <div className="vh-suggestions">
        {histData.suggestedThresholds.map((s) => (
          <button
            key={s.value}
            className={`vh-suggest-btn ${threshold === s.value ? 'vh-suggest-btn--active' : ''}`}
            onClick={() => onThresholdChange(s.value)}
            title={`${s.value} HU`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
