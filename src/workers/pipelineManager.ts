import { pipeline } from '@huggingface/transformers'

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
  return pipelinePromise
}

async function loadPipeline(onProgress: (data: unknown) => void): Promise<SummarizerPipeline> {
  try {
    return (await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
      dtype: 'q8',
      device: 'webgpu',
      progress_callback: onProgress,
    })) as unknown as SummarizerPipeline
  } catch {
    return (await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: onProgress,
    })) as unknown as SummarizerPipeline
  }
}

export async function runSummary(summarizer: SummarizerPipeline, text: string): Promise<string> {
  const output = await summarizer(text, { max_new_tokens: 150, min_new_tokens: 30 })
  return output[0].summary_text.trim()
}

export function resetPipelineForTesting(): void {
  pipelinePromise = null
}
