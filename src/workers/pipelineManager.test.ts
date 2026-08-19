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

  it('loads the pipeline with wasm device', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenCalledWith(
      'summarization',
      'Xenova/distilbart-cnn-6-6',
      expect.objectContaining({ device: 'wasm', dtype: 'q8' }),
    )
  })

  it('caches the pipeline after the first successful load', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})
    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenCalledTimes(1)
  })

  it('retries on the next call after a failed load', async () => {
    pipelineMock.mockRejectedValueOnce(new Error('no wasm'))

    await expect(getSummarizerPipeline(() => {})).rejects.toThrow('no wasm')

    const fakePipeline = vi.fn()
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    const result = await getSummarizerPipeline(() => {})

    expect(result).toBe(fakePipeline)
    expect(pipelineMock).toHaveBeenCalledTimes(2)
  })

  it('runSummary returns the trimmed summary text', async () => {
    const fakeSummarizer = vi.fn().mockResolvedValue([{ summary_text: '  a short summary  ' }])

    const result = await runSummary(fakeSummarizer, 'long text')

    expect(result).toBe('a short summary')
    expect(fakeSummarizer).toHaveBeenCalledWith('long text', expect.any(Object))
  })
})
