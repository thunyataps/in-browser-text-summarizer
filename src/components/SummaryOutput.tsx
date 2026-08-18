import { useState } from 'react'

interface SummaryOutputProps {
  summary: string
}

export function SummaryOutput({ summary }: SummaryOutputProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Summary</h2>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-800">{summary}</p>
    </div>
  )
}
