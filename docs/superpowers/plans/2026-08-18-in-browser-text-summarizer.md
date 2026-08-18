# In-browser Text Summarizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side-only text summarizer web app where AI inference runs entirely in the browser via Transformers.js — no backend, no API keys, no user data leaves the device.

**Architecture:** A React SPA where all model inference happens inside a Web Worker (never the main thread). A single `useSummarizer` hook is the only bridge between React components and the worker's postMessage protocol. Pure logic (text stats, truncation, pipeline loading/fallback) is factored into small testable modules separate from the worker/component glue that can't be meaningfully unit tested.

**Tech Stack:** Vite + React + TypeScript + Tailwind CSS v4 + Transformers.js (`@huggingface/transformers`) + Vitest + React Testing Library.

## Global Constraints

- Model: `Xenova/distilbart-cnn-6-6`, quantized `dtype: 'q8'`. Do not swap models.
- Backend: try `device: 'webgpu'` first, catch failure and fall back to `device: 'wasm'`. Never a user-facing toggle.
- Model load timing: lazy — starts only on the user's first "Summarize" click, never on page mount.
- Long input (over ~750 words): truncate + show a non-blocking warning. Do NOT implement chunking — out of scope for v1.
- All inference must run inside a Web Worker (`src/workers/summarizer.worker.ts`). Never call the pipeline from the main thread.
- Model caching relies entirely on Transformers.js's built-in Cache API/IndexedDB support. Do not write custom caching code.
- Deploy target: Vercel, static SPA, no backend/serverless functions.
- Full spec: `docs/superpowers/specs/2026-08-18-in-browser-text-summarizer-design.md`.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json` (+ scaffold-generated tsconfig files), `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/index.css`, `src/setupTests.ts`, `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working Vite + React + TS + Tailwind v4 + Vitest + React Testing Library project. `npm run dev`, `npm run build`, and `npm test` all succeed. Later tasks assume these scripts exist.

- [ ] **Step 1: Scaffold Vite react-ts template into a temp dir, then merge into the project root**

The project root already has `.git`, `CLAUDE.md`, and `docs/` — scaffolding into a temp subdir and copying avoids the "directory not empty" prompt.

```bash
npm create vite@latest .tmp-scaffold -- --template react-ts
cp -R .tmp-scaffold/. .
rm -rf .tmp-scaffold
```

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install @huggingface/transformers
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Wire Tailwind v4 and Vitest into `vite.config.ts`**

Replace the file contents with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
```

- [ ] **Step 4: Add the test setup file**

Create `src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Replace `src/index.css` with the Tailwind v4 import**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Replace `src/App.tsx` with a minimal placeholder**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <h1 className="p-4 text-2xl font-bold">In-browser Text Summarizer</h1>
    </div>
  )
}

export default App
```

- [ ] **Step 7: Confirm `src/main.tsx` imports the stylesheet**

Ensure `src/main.tsx` contains (the Vite scaffold generates this already; adjust only if missing):

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Add a `test` script to `package.json`**

In the `"scripts"` section, add:

```json
"test": "vitest run"
```

- [ ] **Step 9: Write a smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('In-browser Text Summarizer')).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Run the test suite and the build to confirm the scaffold works**

Run: `npm test`
Expected: 1 test file, 1 test, PASS

Run: `npm run build`
Expected: build succeeds with no TypeScript errors

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest project"
```

---

### Task 2: Text Stats Utility

**Files:**
- Create: `src/utils/textStats.ts`
- Test: `src/utils/textStats.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `TextStats` type (`{ words: number; chars: number }`), `countWords(text: string): number`, `countChars(text: string): number`, `getTextStats(text: string): TextStats`, `compressionPercent(original: TextStats, summary: TextStats): number`. Consumed by `TextInput`, `StatsBar` (Task 6) and `App` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `src/utils/textStats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { countWords, countChars, getTextStats, compressionPercent } from './textStats'

describe('countWords', () => {
  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('returns 0 for whitespace-only text', () => {
    expect(countWords('   \n  ')).toBe(0)
  })

  it('counts simple words', () => {
    expect(countWords('hello world')).toBe(2)
  })

  it('collapses repeated whitespace and newlines', () => {
    expect(countWords('hello   world\nfoo')).toBe(3)
  })
})

describe('countChars', () => {
  it('returns 0 for an empty string', () => {
    expect(countChars('')).toBe(0)
  })

  it('counts characters including spaces', () => {
    expect(countChars('hello')).toBe(5)
  })
})

describe('getTextStats', () => {
  it('combines word and char counts', () => {
    expect(getTextStats('hello world')).toEqual({ words: 2, chars: 11 })
  })
})

describe('compressionPercent', () => {
  it('returns the percentage reduction in word count', () => {
    expect(compressionPercent({ words: 100, chars: 500 }, { words: 30, chars: 150 })).toBe(70)
  })

  it('returns 0 when the original has no words', () => {
    expect(compressionPercent({ words: 0, chars: 0 }, { words: 0, chars: 0 })).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/textStats.test.ts`
Expected: FAIL with "Cannot find module './textStats'"

- [ ] **Step 3: Implement `textStats.ts`**

Create `src/utils/textStats.ts`:

```ts
export interface TextStats {
  words: number
  chars: number
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}

export function countChars(text: string): number {
  return text.length
}

export function getTextStats(text: string): TextStats {
  return { words: countWords(text), chars: countChars(text) }
}

export function compressionPercent(original: TextStats, summary: TextStats): number {
  if (original.words === 0) return 0
  const reduction = 1 - summary.words / original.words
  return Math.round(reduction * 100)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/textStats.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/textStats.ts src/utils/textStats.test.ts
git commit -m "feat: add text stats utility"
```

---

### Task 3: Text Limits Utility

**Files:**
- Create: `src/utils/textLimits.ts`
- Test: `src/utils/textLimits.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `MAX_INPUT_WORDS` constant, `truncateToLimit(text: string, maxWords?: number): { text: string; wasTruncated: boolean }`. Consumed by `App` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `src/utils/textLimits.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { truncateToLimit, MAX_INPUT_WORDS } from './textLimits'

describe('truncateToLimit', () => {
  it('leaves short text unchanged', () => {
    const result = truncateToLimit('hello world')
    expect(result).toEqual({ text: 'hello world', wasTruncated: false })
  })

  it('leaves empty text unchanged', () => {
    expect(truncateToLimit('')).toEqual({ text: '', wasTruncated: false })
  })

  it('does not truncate text exactly at the limit', () => {
    const text = Array.from({ length: 5 }, (_, i) => `word${i}`).join(' ')
    const result = truncateToLimit(text, 5)
    expect(result).toEqual({ text, wasTruncated: false })
  })

  it('truncates text over the limit to exactly maxWords words', () => {
    const text = Array.from({ length: 10 }, (_, i) => `word${i}`).join(' ')
    const result = truncateToLimit(text, 5)
    expect(result.wasTruncated).toBe(true)
    expect(result.text).toBe('word0 word1 word2 word3 word4')
  })

  it('defaults to MAX_INPUT_WORDS when no limit is given', () => {
    const text = Array.from({ length: MAX_INPUT_WORDS + 10 }, (_, i) => `w${i}`).join(' ')
    const result = truncateToLimit(text)
    expect(result.wasTruncated).toBe(true)
    expect(result.text.split(' ')).toHaveLength(MAX_INPUT_WORDS)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/textLimits.test.ts`
Expected: FAIL with "Cannot find module './textLimits'"

- [ ] **Step 3: Implement `textLimits.ts`**

Create `src/utils/textLimits.ts`:

```ts
export const MAX_INPUT_WORDS = 750

export function truncateToLimit(
  text: string,
  maxWords: number = MAX_INPUT_WORDS,
): { text: string; wasTruncated: boolean } {
  const trimmed = text.trim()
  if (trimmed === '') return { text, wasTruncated: false }

  const words = trimmed.split(/\s+/)
  if (words.length <= maxWords) return { text, wasTruncated: false }

  return { text: words.slice(0, maxWords).join(' '), wasTruncated: true }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/textLimits.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/textLimits.ts src/utils/textLimits.test.ts
git commit -m "feat: add text truncation utility"
```

---

### Task 4: Pipeline Manager and Summarizer Worker

**Files:**
- Create: `src/workers/pipelineManager.ts`
- Test: `src/workers/pipelineManager.test.ts`
- Create: `src/workers/summarizer.worker.ts`

**Interfaces:**
- Consumes: `@huggingface/transformers`'s `pipeline()` function
- Produces: `SummarizerPipeline` type, `getSummarizerPipeline(onProgress): Promise<SummarizerPipeline>`, `runSummary(summarizer, text): Promise<string>`, `resetPipelineForTesting(): void` (all from `pipelineManager.ts`); `WorkerRequest`, `WorkerResponse` types and the worker entry point itself (from `summarizer.worker.ts`). Consumed by `useSummarizer` (Task 5).

`summarizer.worker.ts` is a thin postMessage adapter around `pipelineManager.ts` and is not unit tested — it can't run outside a real Worker/browser context. Its correctness is verified manually in Task 9's manual QA step. All branching logic (device fallback, error surfacing) lives in `pipelineManager.ts`, which is fully unit tested below.

- [ ] **Step 1: Write the failing tests for `pipelineManager.ts`**

Create `src/workers/pipelineManager.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const pipelineMock = vi.fn()

vi.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
}))

import { getSummarizerPipeline, runSummary, resetPipelineForTesting } from './pipelineManager'

describe('pipelineManager', () => {
  beforeEach(() => {
    pipelineMock.mockReset()
    resetPipelineForTesting()
  })

  it('loads the pipeline with webgpu device first', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenCalledWith(
      'summarization',
      'Xenova/distilbart-cnn-6-6',
      expect.objectContaining({ device: 'webgpu' }),
    )
  })

  it('falls back to wasm when the webgpu load fails', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockRejectedValueOnce(new Error('no webgpu'))
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenNthCalledWith(
      2,
      'summarization',
      'Xenova/distilbart-cnn-6-6',
      expect.objectContaining({ device: 'wasm' }),
    )
  })

  it('caches the pipeline after the first successful load', async () => {
    const fakePipeline = vi.fn()
    pipelineMock.mockResolvedValueOnce(fakePipeline)

    await getSummarizerPipeline(() => {})
    await getSummarizerPipeline(() => {})

    expect(pipelineMock).toHaveBeenCalledTimes(1)
  })

  it('runSummary returns the trimmed summary text', async () => {
    const fakeSummarizer = vi.fn().mockResolvedValue([{ summary_text: '  a short summary  ' }])

    const result = await runSummary(fakeSummarizer, 'long text')

    expect(result).toBe('a short summary')
    expect(fakeSummarizer).toHaveBeenCalledWith('long text', expect.any(Object))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/workers/pipelineManager.test.ts`
Expected: FAIL with "Cannot find module './pipelineManager'"

- [ ] **Step 3: Implement `pipelineManager.ts`**

Create `src/workers/pipelineManager.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/workers/pipelineManager.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Implement the worker entry point**

Create `src/workers/summarizer.worker.ts`:

```ts
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
```

- [ ] **Step 6: Run the full test suite and the build to confirm nothing broke**

Run: `npm test`
Expected: all tests PASS

Run: `npm run build`
Expected: build succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/workers
git commit -m "feat: add summarizer pipeline manager and worker"
```

---

### Task 5: `useSummarizer` Hook

**Files:**
- Create: `src/hooks/useSummarizer.ts`
- Test: `src/hooks/useSummarizer.test.ts`

**Interfaces:**
- Consumes: `WorkerRequest`, `WorkerResponse` types from `../workers/summarizer.worker` (Task 4)
- Produces: `SummarizerStatus` type (`'idle' | 'loading' | 'ready' | 'summarizing' | 'error'`), `useSummarizer(): { status, progress, summary, error, summarize(text: string): void }`. Consumed by `App` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useSummarizer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSummarizer } from './useSummarizer'
import type { WorkerResponse } from '../workers/summarizer.worker'

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()

  emit(response: WorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>)
  }
}

let lastWorker: FakeWorker

beforeEach(() => {
  lastWorker = new FakeWorker()
  vi.stubGlobal(
    'Worker',
    vi.fn(() => lastWorker),
  )
})

describe('useSummarizer', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useSummarizer())
    expect(result.current.status).toBe('idle')
  })

  it('loads the model then summarizes on first call', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('some long article'))
    expect(result.current.status).toBe('loading')
    expect(lastWorker.postMessage).toHaveBeenCalledWith({ type: 'load' })

    act(() => lastWorker.emit({ status: 'ready' }))
    expect(result.current.status).toBe('summarizing')
    expect(lastWorker.postMessage).toHaveBeenCalledWith({
      type: 'summarize',
      text: 'some long article',
    })

    act(() => lastWorker.emit({ status: 'complete', summary: 'a summary' }))
    expect(result.current.status).toBe('ready')
    expect(result.current.summary).toBe('a summary')
  })

  it('reuses the ready worker on subsequent calls without reloading', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('first text'))
    act(() => lastWorker.emit({ status: 'ready' }))
    act(() => lastWorker.emit({ status: 'complete', summary: 'first summary' }))

    lastWorker.postMessage.mockClear()
    act(() => result.current.summarize('second text'))

    expect(result.current.status).toBe('summarizing')
    expect(lastWorker.postMessage).toHaveBeenCalledWith({
      type: 'summarize',
      text: 'second text',
    })
    expect(lastWorker.postMessage).not.toHaveBeenCalledWith({ type: 'load' })
  })

  it('tracks progress percentage during load', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('text'))
    act(() => lastWorker.emit({ status: 'progress', data: { progress: 42.7 } }))

    expect(result.current.progress).toBe(43)
  })

  it('surfaces errors and reloads on retry', () => {
    const { result } = renderHook(() => useSummarizer())

    act(() => result.current.summarize('text'))
    act(() => lastWorker.emit({ status: 'error', message: 'network failed' }))

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('network failed')

    act(() => result.current.summarize('text'))
    expect(result.current.status).toBe('loading')
    expect(result.current.error).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/useSummarizer.test.ts`
Expected: FAIL with "Cannot find module './useSummarizer'"

- [ ] **Step 3: Implement `useSummarizer.ts`**

Create `src/hooks/useSummarizer.ts`:

```ts
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
          if (percent !== null) setProgress(percent)
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/useSummarizer.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks
git commit -m "feat: add useSummarizer hook"
```

---

### Task 6: `TextInput` and `StatsBar` Components

**Files:**
- Create: `src/components/TextInput.tsx`
- Test: `src/components/TextInput.test.tsx`
- Create: `src/components/StatsBar.tsx`
- Test: `src/components/StatsBar.test.tsx`

**Interfaces:**
- Consumes: `getTextStats`, `compressionPercent` from `../utils/textStats` (Task 2)
- Produces: `TextInput({ value: string; onChange: (text: string) => void })`, `StatsBar({ original: string; summary: string })`. Consumed by `App` (Task 9).

- [ ] **Step 1: Write the failing test for `TextInput`**

Create `src/components/TextInput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TextInput } from './TextInput'

describe('TextInput', () => {
  it('shows live word and character counts', () => {
    const { rerender } = render(<TextInput value="" onChange={vi.fn()} />)
    expect(screen.getByText('0 words · 0 characters')).toBeInTheDocument()

    rerender(<TextInput value="hello world" onChange={vi.fn()} />)
    expect(screen.getByText('2 words · 11 characters')).toBeInTheDocument()
  })

  it('calls onChange when the user types', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<TextInput value="" onChange={handleChange} />)

    await user.type(screen.getByLabelText('Article text'), 'hi')
    expect(handleChange).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/TextInput.test.tsx`
Expected: FAIL with "Cannot find module './TextInput'"

- [ ] **Step 3: Implement `TextInput.tsx`**

Create `src/components/TextInput.tsx`:

```tsx
import { getTextStats } from '../utils/textStats'

interface TextInputProps {
  value: string
  onChange: (text: string) => void
}

export function TextInput({ value, onChange }: TextInputProps) {
  const stats = getTextStats(value)

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-48 w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        placeholder="Paste or type an article to summarize..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Article text"
      />
      <p className="text-xs text-slate-500">
        {stats.words} words · {stats.chars} characters
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/TextInput.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 5: Write the failing test for `StatsBar`**

Create `src/components/StatsBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatsBar } from './StatsBar'

describe('StatsBar', () => {
  it('shows original, summary, and reduction stats', () => {
    render(
      <StatsBar original={'word '.repeat(100).trim()} summary={'word '.repeat(30).trim()} />,
    )

    expect(screen.getByText('100 words')).toBeInTheDocument()
    expect(screen.getByText('30 words')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/components/StatsBar.test.tsx`
Expected: FAIL with "Cannot find module './StatsBar'"

- [ ] **Step 7: Implement `StatsBar.tsx`**

Create `src/components/StatsBar.tsx`:

```tsx
import { getTextStats, compressionPercent } from '../utils/textStats'

interface StatsBarProps {
  original: string
  summary: string
}

export function StatsBar({ original, summary }: StatsBarProps) {
  const originalStats = getTextStats(original)
  const summaryStats = getTextStats(summary)
  const reduction = compressionPercent(originalStats, summaryStats)

  return (
    <dl className="grid grid-cols-3 gap-4 rounded-lg bg-slate-100 p-3 text-sm">
      <div>
        <dt className="text-slate-500">Original</dt>
        <dd className="font-medium">{originalStats.words} words</dd>
      </div>
      <div>
        <dt className="text-slate-500">Summary</dt>
        <dd className="font-medium">{summaryStats.words} words</dd>
      </div>
      <div>
        <dt className="text-slate-500">Reduction</dt>
        <dd className="font-medium">{reduction}%</dd>
      </div>
    </dl>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/StatsBar.test.tsx`
Expected: PASS, 1 test

- [ ] **Step 9: Commit**

```bash
git add src/components/TextInput.tsx src/components/TextInput.test.tsx src/components/StatsBar.tsx src/components/StatsBar.test.tsx
git commit -m "feat: add TextInput and StatsBar components"
```

---

### Task 7: `LoadingProgress` and `ErrorBanner` Components

**Files:**
- Create: `src/components/LoadingProgress.tsx`
- Test: `src/components/LoadingProgress.test.tsx`
- Create: `src/components/ErrorBanner.tsx`
- Test: `src/components/ErrorBanner.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `LoadingProgress({ percent: number })`, `ErrorBanner({ message: string; onRetry: () => void })`. Consumed by `App` (Task 9).

- [ ] **Step 1: Write the failing test for `LoadingProgress`**

Create `src/components/LoadingProgress.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingProgress } from './LoadingProgress'

describe('LoadingProgress', () => {
  it('shows the percentage', () => {
    render(<LoadingProgress percent={42} />)
    expect(screen.getByText('Downloading the summarizer model... 42%')).toBeInTheDocument()
  })

  it('clamps values above 100', () => {
    render(<LoadingProgress percent={150} />)
    expect(screen.getByText('Downloading the summarizer model... 100%')).toBeInTheDocument()
  })

  it('clamps negative values to 0', () => {
    render(<LoadingProgress percent={-5} />)
    expect(screen.getByText('Downloading the summarizer model... 0%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/LoadingProgress.test.tsx`
Expected: FAIL with "Cannot find module './LoadingProgress'"

- [ ] **Step 3: Implement `LoadingProgress.tsx`**

Create `src/components/LoadingProgress.tsx`:

```tsx
interface LoadingProgressProps {
  percent: number
}

export function LoadingProgress({ percent }: LoadingProgressProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <div className="flex flex-col gap-1" role="status" aria-live="polite">
      <p className="text-sm text-slate-600">Downloading the summarizer model... {clamped}%</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-700 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/LoadingProgress.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Write the failing test for `ErrorBanner`**

Create `src/components/ErrorBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('shows the message and calls onRetry when clicked', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn()
    render(<ErrorBanner message="Model failed to load." onRetry={handleRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Model failed to load.')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(handleRetry).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/components/ErrorBanner.test.tsx`
Expected: FAIL with "Cannot find module './ErrorBanner'"

- [ ] **Step 7: Implement `ErrorBanner.tsx`**

Create `src/components/ErrorBanner.tsx`:

```tsx
interface ErrorBannerProps {
  message: string
  onRetry: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      role="alert"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-md border border-red-400 px-3 py-1 font-medium hover:bg-red-100"
      >
        Retry
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/ErrorBanner.test.tsx`
Expected: PASS, 1 test

- [ ] **Step 9: Commit**

```bash
git add src/components/LoadingProgress.tsx src/components/LoadingProgress.test.tsx src/components/ErrorBanner.tsx src/components/ErrorBanner.test.tsx
git commit -m "feat: add LoadingProgress and ErrorBanner components"
```

---

### Task 8: `SummarizeButton` and `SummaryOutput` Components

**Files:**
- Create: `src/components/SummarizeButton.tsx`
- Test: `src/components/SummarizeButton.test.tsx`
- Create: `src/components/SummaryOutput.tsx`
- Test: `src/components/SummaryOutput.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `SummarizeButton({ onClick: () => void; disabled: boolean; label: string })`, `SummaryOutput({ summary: string })`. Consumed by `App` (Task 9).

- [ ] **Step 1: Write the failing test for `SummarizeButton`**

Create `src/components/SummarizeButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SummarizeButton } from './SummarizeButton'

describe('SummarizeButton', () => {
  it('calls onClick when enabled and clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<SummarizeButton onClick={handleClick} disabled={false} label="Summarize" />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled and unclickable when disabled is true', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<SummarizeButton onClick={handleClick} disabled label="Summarizing..." />)

    const button = screen.getByRole('button', { name: 'Summarizing...' })
    expect(button).toBeDisabled()

    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/SummarizeButton.test.tsx`
Expected: FAIL with "Cannot find module './SummarizeButton'"

- [ ] **Step 3: Implement `SummarizeButton.tsx`**

Create `src/components/SummarizeButton.tsx`:

```tsx
interface SummarizeButtonProps {
  onClick: () => void
  disabled: boolean
  label: string
}

export function SummarizeButton({ onClick, disabled, label }: SummarizeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/SummarizeButton.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 5: Write the failing test for `SummaryOutput`**

Create `src/components/SummaryOutput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SummaryOutput } from './SummaryOutput'

describe('SummaryOutput', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('shows the summary text', () => {
    render(<SummaryOutput summary="A short summary." />)
    expect(screen.getByText('A short summary.')).toBeInTheDocument()
  })

  it('copies the summary to the clipboard and shows feedback', async () => {
    const user = userEvent.setup()
    render(<SummaryOutput summary="A short summary." />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('A short summary.')
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/components/SummaryOutput.test.tsx`
Expected: FAIL with "Cannot find module './SummaryOutput'"

- [ ] **Step 7: Implement `SummaryOutput.tsx`**

Create `src/components/SummaryOutput.tsx`:

```tsx
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
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/SummaryOutput.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 9: Commit**

```bash
git add src/components/SummarizeButton.tsx src/components/SummarizeButton.test.tsx src/components/SummaryOutput.tsx src/components/SummaryOutput.test.tsx
git commit -m "feat: add SummarizeButton and SummaryOutput components"
```

---

### Task 9: Browser Support Check and Full App Wiring

**Files:**
- Create: `src/utils/browserSupport.ts`
- Test: `src/utils/browserSupport.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `truncateToLimit` (Task 3), `useSummarizer` (Task 5), `TextInput`/`StatsBar` (Task 6), `LoadingProgress`/`ErrorBanner` (Task 7), `SummarizeButton`/`SummaryOutput` (Task 8)
- Produces: `isBrowserSupported(): boolean`; the fully wired `App` component (final deliverable)

- [ ] **Step 1: Write the failing test for `isBrowserSupported`**

Create `src/utils/browserSupport.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isBrowserSupported } from './browserSupport'

describe('isBrowserSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when Worker and WebAssembly are defined', () => {
    expect(isBrowserSupported()).toBe(true)
  })

  it('returns false when Worker is missing', () => {
    vi.stubGlobal('Worker', undefined)
    expect(isBrowserSupported()).toBe(false)
  })

  it('returns false when WebAssembly is missing', () => {
    vi.stubGlobal('WebAssembly', undefined)
    expect(isBrowserSupported()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/browserSupport.test.ts`
Expected: FAIL with "Cannot find module './browserSupport'"

- [ ] **Step 3: Implement `browserSupport.ts`**

Create `src/utils/browserSupport.ts`:

```ts
export function isBrowserSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/browserSupport.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Wire everything together in `App.tsx`**

Replace `src/App.tsx` with:

```tsx
import { useState } from 'react'
import { TextInput } from './components/TextInput'
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
          <StatsBar original={limitedText} summary={summary} />
        </>
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 6: Replace `App.test.tsx` with integration tests**

Replace `src/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import App from './App'
import * as useSummarizerModule from './hooks/useSummarizer'

describe('App', () => {
  it('renders the title', () => {
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'idle',
      progress: 0,
      summary: null,
      error: null,
      summarize: vi.fn(),
    })
    render(<App />)
    expect(screen.getByText('In-browser Text Summarizer')).toBeInTheDocument()
  })

  it('runs the full flow from typing to viewing a summary', async () => {
    const summarize = vi.fn()
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'ready',
      progress: 0,
      summary: 'A short summary.',
      error: null,
      summarize,
    })

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Article text'), 'a long article body')
    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(summarize).toHaveBeenCalled()
    expect(screen.getByText('A short summary.')).toBeInTheDocument()
  })

  it('shows the error banner and retries on click', async () => {
    const summarize = vi.fn()
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'error',
      progress: 0,
      summary: null,
      error: 'Failed to load the model.',
      summarize,
    })

    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load the model.')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(summarize).toHaveBeenCalled()
  })

  it('shows a warning when the browser is unsupported and blocks the form', () => {
    vi.spyOn(useSummarizerModule, 'useSummarizer').mockReturnValue({
      status: 'idle',
      progress: 0,
      summary: null,
      error: null,
      summarize: vi.fn(),
    })
    vi.stubGlobal('Worker', undefined)

    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Your browser doesn't support the features this app needs",
    )
    expect(screen.queryByLabelText('Article text')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 7: Run the full test suite and the build**

Run: `npm test`
Expected: all tests PASS

Run: `npm run build`
Expected: build succeeds with no TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/utils/browserSupport.ts src/utils/browserSupport.test.ts
git commit -m "feat: wire full app flow with browser support check"
```

- [ ] **Step 9: Manual QA in a real browser (not automated — required before calling this task done)**

Run: `npm run dev`, open the printed local URL in Chrome.

1. Paste a real multi-paragraph article (a few hundred words) into the textarea and confirm the live word/char count updates as you type.
2. Click "Summarize". Confirm the button shows "Loading model...", a progress bar appears, and the percentage increases toward 100 (check the Network tab — you should see `.onnx`/model files downloading, roughly 150MB total).
3. Confirm the button then flips to "Summarizing...", and shortly after a summary appears with a working "Copy" button and correct stats in the `StatsBar`.
4. Reload the page and summarize again — confirm the model does NOT re-download (Network tab should show cache hits / no large downloads), and the summary appears noticeably faster.
5. Paste a very long piece of text (2000+ words) and confirm the "only the first part will be summarized" warning appears.
6. Open the app in Firefox (or Safari) and repeat step 2 — confirm it still works via the WASM fallback (check the console/log for which device was selected).
7. Note any issues found; fix before considering the app complete.

---

### Task 10: README and Deploy Verification

**Files:**
- Modify: `README.md`
- Create: `vercel.json` (optional, for explicit framework detection)

**Interfaces:**
- Consumes: nothing
- Produces: final documentation and a verified production build

- [ ] **Step 1: Replace `README.md`**

Replace the scaffold-generated `README.md` with:

```markdown
# In-browser Text Summarizer

A web app that summarizes long text — entirely in your browser. The AI model
downloads once and runs locally via WebAssembly/WebGPU. No backend server, no
API keys, no cost per request, and your text never leaves your device.

![screenshot placeholder](./docs/screenshot.png)

## How it works

This app uses [Transformers.js](https://huggingface.co/docs/transformers.js)
to run a real summarization model (`Xenova/distilbart-cnn-6-6`, a distilled
BART model fine-tuned on CNN/DailyMail) directly in the browser:

- The model is compiled to run via **WebGPU** when available, and falls back
  to **WebAssembly (WASM)** automatically on browsers without WebGPU support
  (e.g. Safari, older Firefox).
- All inference runs inside a **Web Worker**, so the page never freezes while
  the model is loading or summarizing.
- The model (~150MB, quantized) is downloaded once on first use and cached by
  the browser (Cache API/IndexedDB), so repeat visits are fast.

### Why this model?

`distilbart-cnn-6-6` was chosen over larger alternatives (`bart-large-cnn`)
because it's ~3x smaller and faster while still producing strong summaries —
a better fit for a one-time in-browser download. It was chosen over smaller
general-purpose models (`t5-small`) because it's trained specifically for
summarization and produces noticeably better output.

### Limitations

- Input is capped at ~750 words per request; longer text is truncated (with a
  warning) rather than summarized in chunks.
- First use requires downloading ~150MB — best on a decent connection.
- Summary quality depends on the source text; very technical or list-heavy
  text summarizes less well than prose articles.

## Running locally

```bash
npm install
npm run dev
```

Open the printed local URL. The model downloads on your first click of
"Summarize".

## Running tests

```bash
npm test
```

## Building for production

```bash
npm run build
npm run preview   # serve the production build locally
```

## Deploying

This is a static SPA — deploy the `dist/` folder anywhere that serves static
files. On [Vercel](https://vercel.com):

1. Import this repository in the Vercel dashboard (or run `vercel` from the
   project root).
2. Framework preset: **Vite** (auto-detected). Build command: `npm run build`.
   Output directory: `dist`.
3. Deploy — no environment variables or backend configuration needed.

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS v4
- Transformers.js (`@huggingface/transformers`)
- Vitest + React Testing Library
```

- [ ] **Step 2: Add a `vercel.json` for explicit framework detection**

Create `vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

- [ ] **Step 3: Verify the production build one more time**

Run: `npm run build`
Expected: build succeeds, `dist/` is created

Run: `npm run preview`
Expected: server starts; open the printed URL and confirm the app loads (model-loading flow already verified manually in Task 9)

- [ ] **Step 4: Commit**

```bash
git add README.md vercel.json
git commit -m "docs: add README with usage, model rationale, and deploy instructions"
```
