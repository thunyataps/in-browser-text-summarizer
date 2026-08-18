import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import App from './App'
import * as useSummarizerModule from './hooks/useSummarizer'

describe('App', () => {
  it('renders the title', () => {
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'idle',
      progress: 0,
      summary: null,
      error: null,
      summarize: vi.fn(),
    })
    render(<App />)
    expect(screen.getByText('In-browser Text Summarizer')).toBeInTheDocument()
  })

  it('runs the full flow from typing to viewing a summary', async () => {
    const summarize = vi.fn()
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'ready',
      progress: 0,
      summary: 'A short summary.',
      error: null,
      summarize,
    })

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Article text'), 'a long article body')
    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(summarize).toHaveBeenCalled()
    expect(screen.getByText('A short summary.')).toBeInTheDocument()
  })

  it('shows the error banner and retries on click', async () => {
    const summarize = vi.fn()
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'error',
      progress: 0,
      summary: null,
      error: 'Failed to load the model.',
      summarize,
    })

    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load the model.')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(summarize).toHaveBeenCalled()
  })

  it('shows a warning when the browser is unsupported and blocks the form', () => {
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'idle',
      progress: 0,
      summary: null,
      error: null,
      summarize: vi.fn(),
    })
    vi.stubGlobal('Worker', undefined)

    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Your browser doesn't support the features this app needs",
    )
    expect(screen.queryByLabelText('Article text')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
