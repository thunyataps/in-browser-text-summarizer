import { pipeline } from '@huggingface/transformers'
import { loadWithStallGuard } from './pipelineLoadGuard'

export type SummarizerPipeline = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<Array<{ summary_text: string }>>

let pipelinePromise: Promise<SummarizerPipeline> | null = null

export async function getSummarizerPipeline(
  onProgress: (data: unknown) => void,
): Promise<SummarizerPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = loadPipeline(onProgress)
  }
  try {
    return await pipelinePromise
  } catch (error) {
    pipelinePromise = null
    throw error
  }
}

async function loadPipeline(onProgress: (data: unknown) => void): Promise<SummarizerPipeline> {
  try {
    const summarizer = (await loadWithStallGuard(
      (progress) =>
        pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
          dtype: 'q8',
          device: 'webgpu',
          progress_callback: progress,
        }),
      onProgress,
    )) as unknown as SummarizerPipeline
    console.info('[pipelineManager] Loaded summarization pipeline on backend: webgpu')
    return summarizer
  } catch (error) {
    console.warn('[pipelineManager] WebGPU backend failed, falling back to wasm:', error)
    const summarizer = (await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: onProgress,
    })) as unknown as SummarizerPipeline
    console.info('[pipelineManager] Loaded summarization pipeline on backend: wasm')
    return summarizer
  }
}

export async function runSummary(summarizer: SummarizerPipeline, text: string): Promise<string> {
  const output = await summarizer(text, {
    max_new_tokens: 220,
    min_new_tokens: 60,
    no_repeat_ngram_size: 3,
    num_beams: 4,
  })
  return output[0].summary_text.trim()
}

export function resetPipelineForTesting(): void {
  pipelinePromise = null
}
