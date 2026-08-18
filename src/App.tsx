import { useState } from 'react'
import { TextInput } from './components/TextInput'
import { UrlInput } from './components/UrlInput'
import { SummarizeButton } from './components/SummarizeButton'
import { LoadingProgress } from './components/LoadingProgress'
import { ErrorBanner } from './components/ErrorBanner'
import { SummaryOutput } from './components/SummaryOutput'
import { StatsBar } from './components/StatsBar'
import { useSummarizer } from './hooks/useSummarizer'
import { truncateToLimit } from './utils/textLimits'
import { isBrowserSupported } from './utils/browserSupport'

function App() {
  const [text, setText] = useState('')
  const [submittedText, setSubmittedText] = useState('')
  const { status, progress, summary, error, summarize } = useSummarizer()

  if (!isBrowserSupported()) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <ErrorBanner
          message="Your browser doesn't support the features this app needs (Web Workers and WebAssembly). Try a recent version of Chrome, Edge, or Firefox."
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  const { text: limitedText, wasTruncated } = truncateToLimit(text)
  const isBusy = status === 'loading' || status === 'summarizing'

  function handleSummarize() {
    setSubmittedText(limitedText)
    summarize(limitedText)
  }

  const buttonLabel =
    status === 'loading' ? 'Loading model...' : status === 'summarizing' ? 'Summarizing...' : 'Summarize'

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">In-browser Text Summarizer</h1>
        <p className="text-sm text-slate-500">
          Runs entirely in your browser. Nothing you type ever leaves this page.
        </p>
      </header>

      <UrlInput onArticleFetched={setText} />

      <TextInput value={text} onChange={setText} />

      {wasTruncated && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          Your text is long — only the first part will be summarized.
        </p>
      )}

      <SummarizeButton
        onClick={handleSummarize}
        disabled={isBusy || limitedText.trim() === ''}
        label={buttonLabel}
      />

      {status === 'loading' && <LoadingProgress percent={progress} />}
      {status === 'error' && error && <ErrorBanner message={error} onRetry={handleSummarize} />}
      {summary && (
        <>
          <SummaryOutput summary={summary} />
          <StatsBar original={submittedText} summary={summary} />
        </>
      )}
    </div>
  )
}

export default App
