/// <reference lib="webworker" />

import { getSummarizerPipeline, runSummary } from './pipelineManager'

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
      const summarizer = await getSummarizerPipeline((data) =>
        postResponse({ status: 'progress', data }),
      )
      const summary = await runSummary(summarizer, message.text)
      postResponse({ status: 'complete', summary })
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
