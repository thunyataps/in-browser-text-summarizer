import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('shows the message and calls onRetry when clicked', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn()
    render(<ErrorBanner message="Model failed to load." onRetry={handleRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Model failed to load.')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(handleRetry).toHaveBeenCalledOnce()
  })
})
