/// <reference lib="webworker" />

import { getSummarizerPipeline, runSummary } from './pipelineManager'
import { getTranslatorPipeline, runTranslation } from './translationManager'
import { isThaiText } from '../utils/languageDetect'

export type WorkerRequest = { type: 'load' } | { type: 'summarize'; text: string }

export type WorkerResponse =
  | { status: 'progress'; data: unknown }
  | { status: 'ready' }
  | { status: 'complete'; summary: string }
  | { status: 'error'; message: string }

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  if (message.type === 'load') {
    try {
      await getSummarizerPipeline((data) => postResponse({ status: 'progress', data }))
      postResponse({ status: 'ready' })
    } catch (error) {
      postResponse({ status: 'error', message: toErrorMessage(error) })
    }
    return
  }

  if (message.type === 'summarize') {
    try {
      const translator = await getTranslatorPipeline((data) =>
        postResponse({ status: 'progress', data }),
      )

      const englishInput = isThaiText(message.text)
        ? await runTranslation(translator, message.text, 'th', 'en')
        : message.text

      const summarizer = await getSummarizerPipeline((data) =>
        postResponse({ status: 'progress', data }),
      )
      const englishSummary = await runSummary(summarizer, englishInput)
      console.info('[summarizer.worker] English summary:', englishSummary)

      const thaiSummary = await runTranslation(translator, englishSummary, 'en', 'th')

      postResponse({ status: 'complete', summary: thaiSummary })
    } catch (error) {
      postResponse({ status: 'error', message: toErrorMessage(error) })
    }
  }
}

function postResponse(response: WorkerResponse): void {
  self.postMessage(response)
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error while summarizing.'
}
