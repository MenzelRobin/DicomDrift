import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Landing.css'

interface Props {
  onFilesSelected: (files: File[]) => void
  onModelLoaded: (file: File) => void
}

export function Landing({ onFilesSelected, onModelLoaded }: Props) {
  const { t } = useTranslation('landing')
  const { t: tc } = useTranslation('common')
  const folderInputRef = useRef<HTMLInputElement>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => {
        const name = f.name.toLowerCase()
        return (
          !name.endsWith('.jpg') &&
          !name.endsWith('.jpeg') &&
          !name.endsWith('.png') &&
          !name.startsWith('.')
        )
      })
      if (fileArray.length === 0) {
        alert(tc('errorNoDicom'))
        return
      }
      onFilesSelected(fileArray)
    },
    [onFilesSelected, tc],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  return (
    <div className="landing">
      <div className="landing-content">
        <header className="landing-header">
          <h1>{t('title')}</h1>
          <p className="subtitle">{t('subtitle')}</p>
        </header>

        <div
          className={`dropzone glass ${isDragOver ? 'dropzone--active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => folderInputRef.current?.click()}
        >
          <div className="dropzone-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="dropzone-text">{t('dropzone')}</p>
          <p className="dropzone-hint">{t('dropzoneHint')}</p>
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is not in the type defs
            webkitdirectory=""
            directory=""
            multiple
            hidden
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        <div className="landing-actions">
          <button
            className="btn btn-secondary glass"
            onClick={() => modelInputRef.current?.click()}
          >
            {t('loadSaved')}
          </button>
          <input
            ref={modelInputRef}
            type="file"
            accept=".dicomdrift"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onModelLoaded(file)
            }}
          />
        </div>

        <div className="landing-privacy glass">
          <h3>{t('privacyTitle')}</h3>
          <p>{t('privacyText')}</p>
        </div>

        <div className="landing-steps">
          <h3>{t('howItWorks')}</h3>
          <ol>
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
          </ol>
        </div>

        <p className="landing-formats">{t('supportedFormats')}</p>
      </div>
    </div>
  )
}
