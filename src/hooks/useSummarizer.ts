import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkerRequest, WorkerResponse } from '../workers/summarizer.worker'

export type SummarizerStatus = 'idle' | 'loading' | 'ready' | 'summarizing' | 'error'

export interface UseSummarizerResult {
  status: SummarizerStatus
  progress: number
  summary: string | null
  error: string | null
  summarize: (text: string) => void
}

export function useSummarizer(): UseSummarizerResult {
  const [status, setStatus] = useState<SummarizerStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const pendingTextRef = useRef<string | null>(null)

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      const worker = new Worker(new URL('../workers/summarizer.worker.ts', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data
        if (message.status === 'progress') {
          const percent = extractProgressPercent(message.data)
          if (percent !== null) setProgress((prev) => Math.max(prev, percent))
        } else if (message.status === 'ready') {
          const pending = pendingTextRef.current
          if (pending !== null) {
            pendingTextRef.current = null
            setStatus('summarizing')
            sendToWorker(worker, { type: 'summarize', text: pending })
          } else {
            setStatus('ready')
          }
        } else if (message.status === 'complete') {
          setSummary(message.summary)
          setStatus('ready')
        } else if (message.status === 'error') {
          setError(message.message)
          setStatus('error')
        }
      }
      worker.onerror = () => {
        workerRef.current?.terminate()
        workerRef.current = null
        setError('The summarizer worker crashed unexpectedly.')
        setStatus('error')
      }
      workerRef.current = worker
    }
    return workerRef.current
  }, [])

  const summarize = useCallback(
    (text: string) => {
      setError(null)
      setSummary(null)
      const worker = getWorker()

      if (status === 'idle' || status === 'error') {
        pendingTextRef.current = text
        setProgress(0)
        setStatus('loading')
        sendToWorker(worker, { type: 'load' })
        return
      }

      setStatus('summarizing')
      sendToWorker(worker, { type: 'summarize', text })
    },
    [getWorker, status],
  )

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  return { status, progress, summary, error, summarize }
}

function sendToWorker(worker: Worker, message: WorkerRequest): void {
  worker.postMessage(message)
}

function extractProgressPercent(data: unknown): number | null {
  if (
    typeof data === 'object' &&
    data !== null &&
    'progress' in data &&
    typeof (data as { progress: unknown }).progress === 'number'
  ) {
    return Math.round((data as { progress: number }).progress)
  }
  return null
}
