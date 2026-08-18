import { describe, it, expect, vi, beforeEach } from 'vitest'

const pipelineMock = vi.fn()

vi.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
}))

import { getSummarizerPipeline, runSummary, resetPipelineForTesting } from './pipelineManager'

describe('pipelineManager', () => {
  beforeEach(() => {
    pipelineMock.mockReset()
    resetPipelineForTesting()
  })

  it('loads the pipeline with webgpu device first', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenCalledWith(
      'summarization',
      'Xenova/distilbart-cnn-6-6',
      expect.objectContaining({ device: 'webgpu' }),
    )
  })

  it('falls back to wasm when the webgpu load fails', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockRejectedValueOnce(new Error('no webgpu'))
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenNthCalledWith(
      2,
      'summarization',
      'Xenova/distilbart-cnn-6-6',
      expect.objectContaining({ device: 'wasm' }),
    )
  })

  it('caches the pipeline after the first successful load', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})
    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenCalledTimes(1)
  })

  it('runSummary returns the trimmed summary text', async () => {
    const fakeSummarizer = vi.fn().mockResolvedValue([{ summary_text: '  a short summary  ' }])

    const result = await runSummary(fakeSummarizer, 'long text')

    expect(result).toBe('a short summary')
    expect(fakeSummarizer).toHaveBeenCalledWith('long text', expect.any(Object))
  })
})
