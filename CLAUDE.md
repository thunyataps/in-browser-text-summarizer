# In-browser Text Summarizer

Client-side-only text summarizer. AI inference runs entirely in the browser via
Transformers.js — no backend, no API keys, no user data ever leaves the device.
Portfolio project.

Full design/spec: `docs/superpowers/specs/2026-08-18-in-browser-text-summarizer-design.md`
— read it before making architectural changes. Key decisions and their reasoning
live there; don't re-litigate them without checking it first.

## Locked-in decisions (do not silently change)

- **Model**: `Xenova/distilbart-cnn-6-6`, quantized `q8`. Chosen over t5-small
  (worse summaries) and bart-large-cnn (too heavy for browser). Don't swap models
  without updating the spec.
- **Backend**: try WebGPU, fall back to WASM automatically. Not a user-facing
  toggle.
- **Model load timing**: lazy — starts on first "Summarize" click, not on page
  mount.
- **Long input**: truncate + warn. Chunking multiple passes is explicitly
  out-of-scope for v1 — don't add it without a new design discussion.
- **Inference location**: must run in a Web Worker (`src/workers/summarizer.worker.ts`).
  Never run the pipeline on the main thread — that reintroduces UI freeze, which
  is the exact thing the worker exists to avoid.
- **Model caching**: rely on Transformers.js's built-in Cache API/IndexedDB
  caching. Don't hand-roll caching logic.
- **Deploy target**: Vercel (static SPA).

## Stack

Vite + React + TypeScript + Tailwind CSS + Transformers.js (`@huggingface/transformers`).

## Structure

```
src/
  components/   # TextInput, SummarizeButton, LoadingProgress, SummaryOutput, StatsBar, ErrorBanner
  hooks/        # useSummarizer.ts — the ONLY thing that talks to the worker
  workers/      # summarizer.worker.ts — owns the pipeline singleton
                # pipelineManager.ts — loads the Transformers.js pipeline, WebGPU->WASM fallback
  utils/        # textStats.ts, textLimits.ts — pure functions, unit tested
                # browserSupport.ts — feature-detects Web Workers/WebAssembly support
```

Components must never touch `postMessage` directly — always go through
`useSummarizer`.

## Testing

Vitest for `utils/` (pure functions) and `useSummarizer` (mocked worker, state
transitions). No E2E test that runs the real model — too slow for CI, verify
manually.

## Current status

Implementation complete: all 10 planned tasks are done, individually reviewed,
and merged, plus a post-merge whole-branch review cleanup pass. Automated tests
(Vitest) and the production build (`npm run build`) pass.

Not yet done: manual browser QA. The automated suite mocks the worker and the
Transformers.js pipeline, so a human still needs to verify in a real browser
before shipping/deploying — actual model download and caching, WASM inference,
WebGPU inference (where supported), and a cross-browser check (Chrome, Edge,
Firefox, Safari).
