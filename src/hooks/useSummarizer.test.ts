import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSummarizer } from './useSummarizer'
import type { WorkerResponse } from '../workers/summarizer.worker'

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()

  emit(response: WorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>)
  }
}

let lastWorker: FakeWorker

beforeEach(() => {
  lastWorker = new FakeWorker()
  vi.stubGlobal(
    'Worker',
    vi.fn(function () {
      lastWorker = new FakeWorker()
      return lastWorker
    }),
  )
})

describe('useSummarizer', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useSummarizer())
    expect(result.current.status).toBe('idle')
  })

  it('loads the model then summarizes on first call', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('some long article'))
    expect(result.current.status).toBe('loading')
    expect(lastWorker.postMessage).toHaveBeenCalledWith({ type: 'load' })

    act(() => lastWorker.emit({ status: 'ready' }))
    expect(result.current.status).toBe('summarizing')
    expect(lastWorker.postMessage).toHaveBeenCalledWith({
      type: 'summarize',
      text: 'some long article',
    })

    act(() => lastWorker.emit({ status: 'complete', summary: 'a summary' }))
    expect(result.current.status).toBe('ready')
    expect(result.current.summary).toBe('a summary')
  })

  it('reuses the ready worker on subsequent calls without reloading', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('first text'))
    act(() => lastWorker.emit({ status: 'ready' }))
    act(() => lastWorker.emit({ status: 'complete', summary: 'first summary' }))

    lastWorker.postMessage.mockClear()
    act(() => result.current.summarize('second text'))

    expect(result.current.status).toBe('summarizing')
    expect(lastWorker.postMessage).toHaveBeenCalledWith({
      type: 'summarize',
      text: 'second text',
    })
    expect(lastWorker.postMessage).not.toHaveBeenCalledWith({ type: 'load' })
  })

  it('tracks progress percentage during load', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('text'))
    act(() => lastWorker.emit({ status: 'progress', data: { progress: 42.7 } }))

    expect(result.current.progress).toBe(43)
  })

  it('surfaces errors and reloads on retry', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('text'))
    act(() => lastWorker.emit({ status: 'error', message: 'network failed' }))

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('network failed')

    act(() => result.current.summarize('text'))
    expect(result.current.status).toBe('loading')
    expect(result.current.error).toBeNull()
  })

  it('does not let progress decrease when a later event reports a lower percent', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('text'))
    act(() => lastWorker.emit({ status: 'progress', data: { progress: 80 } }))
    expect(result.current.progress).toBe(80)

    act(() => lastWorker.emit({ status: 'progress', data: { progress: 10 } }))
    expect(result.current.progress).toBe(80)
  })

  it('respawns a fresh worker on retry after a worker crash instead of reusing the dead one', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('text'))
    const crashedWorker = lastWorker
    expect(global.Worker).toHaveBeenCalledTimes(1)

    act(() => crashedWorker.onerror?.())
    expect(result.current.status).toBe('error')
    expect(crashedWorker.terminate).toHaveBeenCalled()

    act(() => result.current.summarize('text'))

    expect(global.Worker).toHaveBeenCalledTimes(2)
    expect(lastWorker).not.toBe(crashedWorker)
    expect(result.current.status).toBe('loading')
  })
})
