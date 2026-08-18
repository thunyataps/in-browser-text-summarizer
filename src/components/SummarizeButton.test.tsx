import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SummarizeButton } from './SummarizeButton'

describe('SummarizeButton', () => {
  it('calls onClick when enabled and clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<SummarizeButton onClick={handleClick} disabled={false} label="Summarize" />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled and unclickable when disabled is true', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<SummarizeButton onClick={handleClick} disabled label="Summarizing..." />)

    const button = screen.getByRole('button', { name: 'Summarizing...' })
    expect(button).toBeDisabled()

    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })
})
