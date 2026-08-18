import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TextInput } from './TextInput'

describe('TextInput', () => {
  it('shows live word and character counts', () => {
    const { rerender } = render(<TextInput value="" onChange={vi.fn()} />)
    expect(screen.getByText('0 words · 0 characters')).toBeInTheDocument()

    rerender(<TextInput value="hello world" onChange={vi.fn()} />)
    expect(screen.getByText('2 words · 11 characters')).toBeInTheDocument()
  })

  it('calls onChange when the user types', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<TextInput value="" onChange={handleChange} />)

    await user.type(screen.getByLabelText('Article text'), 'hi')
    expect(handleChange).toHaveBeenCalled()
  })
})
