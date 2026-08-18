# In-browser Text Summarizer — Design

Date: 2026-08-18
Status: Approved

## Overview

Web app that summarizes long text entirely client-side. AI model inference runs
in the user's browser via Transformers.js (WASM/WebGPU). No backend server, no
API costs, no user data ever leaves the browser. Built as a portfolio project.

## Tech Stack

- Vite + React + TypeScript
- Transformers.js (`@huggingface/transformers`) for in-browser model inference
- Tailwind CSS for styling
- Deploy target: **Vercel** (static SPA, no backend)

## Model

**Xenova/distilbart-cnn-6-6**, quantized (`dtype: 'q8'`), ~150MB.

Reasoning:
- Trained specifically for summarization (CNN/DailyMail), unlike general-purpose
  models (e.g. t5-small) that need prompt-engineering and give weaker summaries.
- Much lighter/faster than `bart-large-cnn` (~230MB+) while keeping good quality —
  right tradeoff for browser inference.
- Well-supported in Transformers.js with existing ONNX conversions.

Max input: ~1024 tokens (~700-800 English words). Longer text is **truncated with
a warning** (not chunked) — v1 scope, keeps chunk/merge complexity out.

## Backend selection (WASM/WebGPU)

Try `device: 'webgpu'` first; on failure, catch and fall back to `'wasm'`
transparently (no user-facing error — this is expected on unsupported browsers
like Safari/Firefox). Log which backend was selected for debugging.

## Model loading timing

**Lazy**: model download starts only on the user's first "Summarize" click, not
on page load. Avoids wasting bandwidth for visitors who never use the feature.

## Model caching

Handled automatically by Transformers.js via the browser Cache API/IndexedDB —
no custom caching code needed. Repeat visits skip the download.

## Architecture

All inference runs in a **Web Worker** (`summarizer.worker.ts`) that owns a
singleton pipeline instance. The main thread never blocks during model load or
inference.

Worker protocol (typed postMessage):
- `{type: 'load'}` → worker responds with `progress` events (from Transformers.js
  `progress_callback`), then `ready`
- `{type: 'summarize', text}` → worker responds with `complete` (+ summary) or
  `error` (+ message)

`useSummarizer` hook is the only place components talk to the worker — components
never touch postMessage directly. It exposes:
`{status, progress, summary, error, summarize(text)}`.

## File structure

```
src/
  components/
    TextInput.tsx        # paste/type article + live original word/char count
    SummarizeButton.tsx  # disabled while loading/summarizing
    LoadingProgress.tsx  # % progress bar during first-time model download
    SummaryOutput.tsx    # summary text + copy button
    StatsBar.tsx         # original vs summary word/char count, compression %
    ErrorBanner.tsx       # unsupported browser / load failure + retry
  hooks/
    useSummarizer.ts      # wraps worker communication, exposes app state
  workers/
    summarizer.worker.ts  # owns pipeline singleton, runs inference
  utils/
    textStats.ts           # word/char counting, compression % calc
    textLimits.ts           # truncate text exceeding token limit + warning text
  App.tsx
  main.tsx
```

## Data flow

1. User types/pastes text → `TextInput` shows live count (no model needed).
2. Click Summarize → `useSummarizer.summarize(text)`.
   - If no worker/pipeline yet: spawn worker, send `load`, relay `progress`
     events until `ready`.
   - Text is truncated via `textLimits.ts` (with UI warning) before sending if
     over the token budget.
3. Send `summarize` with the (possibly truncated) text → worker runs pipeline →
   `complete` with summary text.
4. `StatsBar` computes original vs. summary stats.
5. Any failure (unsupported browser, load failure, inference crash) surfaces as
   an `error` status → `ErrorBanner` with a retry action.

## Error handling

| Case | Handling |
|---|---|
| Browser lacks Web Worker / WASM support | Feature-detect on mount (`typeof Worker`, `WebAssembly`) → show `ErrorBanner` immediately, disable Summarize |
| WebGPU unsupported | Caught in worker, silently falls back to WASM (not an error — just logged) |
| Model download fails (network) | Worker sends `error` status + message → `ErrorBanner` with a "Retry" button that respawns the worker |
| Empty/too-short input | Validated client-side; Summarize button disabled when text is empty |
| Input exceeds token limit | Pre-truncated by `textLimits.ts`; shown as a non-blocking yellow warning, not an error |
| Worker throws during inference | try/catch around the pipeline call inside the worker; error is returned, not left to crash silently |

## Testing

Portfolio-scope — cover logic that can actually break, skip heavy/slow coverage:

- **Unit (Vitest)**: `textStats.ts`, `textLimits.ts` — pure functions, edge cases
  (empty string, unicode, exact truncation boundary).
- **Component (React Testing Library)**: `useSummarizer` with a mocked worker,
  asserting state transitions (idle → loading → ready → summarizing →
  complete/error).
- No E2E test that runs the real model (too slow/heavy for CI) — verified
  manually during development instead.

## Out of scope (v1)

- Chunking long documents into multiple summarization passes
- Multiple model choices / model switcher UI
- Any server-side component
