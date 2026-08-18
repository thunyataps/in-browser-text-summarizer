import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SummaryOutput } from './SummaryOutput'

describe('SummaryOutput', () => {
  it('shows the summary text', () => {
    render(<SummaryOutput summary="A short summary." />)
    expect(screen.getByText('A short summary.')).toBeInTheDocument()
  })

  it('copies the summary to the clipboard and shows feedback', async () => {
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    render(<SummaryOutput summary="A short summary." />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeTextSpy).toHaveBeenCalledWith('A short summary.')
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })
})
