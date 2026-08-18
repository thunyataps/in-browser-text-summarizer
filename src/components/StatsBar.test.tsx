import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatsBar } from './StatsBar'

describe('StatsBar', () => {
  it('shows original, summary, and reduction stats', () => {
    render(
      <StatsBar original={'word '.repeat(100).trim()} summary={'word '.repeat(30).trim()} />,
    )

    expect(screen.getByText('100 words')).toBeInTheDocument()
    expect(screen.getByText('30 words')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })
})
