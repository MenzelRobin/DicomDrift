import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Landing } from '../Landing'
import '../../i18n'

describe('Landing', () => {
  it('renders the title', () => {
    render(<Landing onFilesSelected={() => {}} />)
    expect(screen.getByText('DicomDrift')).toBeInTheDocument()
  })

  it('renders the drop zone', () => {
    render(<Landing onFilesSelected={() => {}} />)
    expect(screen.getByText(/drop dicom folder/i)).toBeInTheDocument()
  })

  it('renders the privacy notice', () => {
    render(<Landing onFilesSelected={() => {}} />)
    expect(screen.getByText(/your data stays private/i)).toBeInTheDocument()
  })

  it('renders the load saved model button', () => {
    render(<Landing onFilesSelected={() => {}} />)
    expect(screen.getByText(/load saved model/i)).toBeInTheDocument()
  })
})
