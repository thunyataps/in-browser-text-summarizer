import { useEffect, useRef, useState } from 'react'

interface SummaryOutputProps {
  summary: string
}

type CopyState = 'idle' | 'copied' | 'failed'

export function SummaryOutput({ summary }: SummaryOutputProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCopyState('idle')
  }, [summary])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    }
  }, [])

  function scheduleReset() {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopyState('idle'), 2000)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summary)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    scheduleReset()
  }

  const label = copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Summary</h2>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {label}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-800">{summary}</p>
    </div>
  )
}
