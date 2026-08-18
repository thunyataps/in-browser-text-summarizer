import { pipeline } from '@huggingface/transformers'
import { loadWithStallGuard } from './pipelineLoadGuard'

export type TranslatorPipeline = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<Array<{ translation_text: string }>>

let translatorPromise: Promise<TranslatorPipeline> | null = null

export async function getTranslatorPipeline(
  onProgress: (data: unknown) => void,
): Promise<TranslatorPipeline> {
  if (!translatorPromise) {
    translatorPromise = loadTranslator(onProgress)
  }
  try {
    return await translatorPromise
  } catch (error) {
    translatorPromise = null
    throw error
  }
}

async function loadTranslator(onProgress: (data: unknown) => void): Promise<TranslatorPipeline> {
  try {
    const translator = (await loadWithStallGuard(
      (progress) =>
        pipeline('translation', 'Xenova/m2m100_418M', {
          dtype: 'q8',
          device: 'webgpu',
          progress_callback: progress,
        }),
      onProgress,
    )) as unknown as TranslatorPipeline
    console.info('[translationManager] Loaded translation pipeline on backend: webgpu')
    return translator
  } catch (error) {
    console.warn('[translationManager] WebGPU backend failed, falling back to wasm:', error)
    const translator = (await pipeline('translation', 'Xenova/m2m100_418M', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: onProgress,
    })) as unknown as TranslatorPipeline
    console.info('[translationManager] Loaded translation pipeline on backend: wasm')
    return translator
  }
}

export async function runTranslation(
  translator: TranslatorPipeline,
  text: string,
  srcLang: string = 'en',
  tgtLang: string = 'th',
): Promise<string> {
  const output = await translator(text, {
    src_lang: srcLang,
    tgt_lang: tgtLang,
    max_new_tokens: 256,
    repetition_penalty: 1.3,
    no_repeat_ngram_size: 3,
  })
  return output[0].translation_text.trim()
}

export function resetTranslatorForTesting(): void {
  translatorPromise = null
}
