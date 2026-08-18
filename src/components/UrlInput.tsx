import { useState } from 'react'

interface UrlInputProps {
  onArticleFetched: (text: string) => void
}

export function UrlInput({ onArticleFetched }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleFetch() {
    if (url.trim() === '') return
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch(`/api/fetch-article?url=${encodeURIComponent(url.trim())}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch the article')
      }
      onArticleFetched(data.text)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch the article')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          className="flex-1 rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Paste an article URL..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-label="Article URL"
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={status === 'loading' || url.trim() === ''}
          className="shrink-0 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? 'Fetching...' : 'Fetch article'}
        </button>
      </div>
      {status === 'error' && error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
