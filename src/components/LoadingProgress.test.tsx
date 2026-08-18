import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingProgress } from './LoadingProgress'

describe('LoadingProgress', () => {
  it('shows the percentage', () => {
    render(<LoadingProgress percent={42} />)
    expect(screen.getByText('Downloading the summarizer model... 42%')).toBeInTheDocument()
  })

  it('clamps values above 100', () => {
    render(<LoadingProgress percent={150} />)
    expect(screen.getByText('Downloading the summarizer model... 100%')).toBeInTheDocument()
  })

  it('clamps negative values to 0', () => {
    render(<LoadingProgress percent={-5} />)
    expect(screen.getByText('Downloading the summarizer model... 0%')).toBeInTheDocument()
  })
})
