# In-browser Text Summarizer

Text summarizer with Thai output. AI inference (summarization + translation)
runs entirely in the browser via Transformers.js — no API keys, no inference
data ever leaves the device. A minimal Vercel serverless function exists only
to fetch article text from a user-pasted URL (server-side, to avoid CORS) —
it never touches the AI pipeline. Portfolio project.

Full design/spec: `docs/superpowers/specs/2026-08-18-in-browser-text-summarizer-design.md`
— read it before making architectural changes. Key decisions and their reasoning
live there; don't re-litigate them without checking it first.

## Locked-in decisions (do not silently change)

- **Summarization model**: `Xenova/distilbart-cnn-6-6`, quantized `q8`. Chosen
  over t5-small (worse summaries) and bart-large-cnn (too heavy for browser).
  Don't swap without updating the spec.
- **Translation model**: `Xenova/m2m100_418M`, quantized `q8`. English summary
  is translated to Thai (`src_lang: 'en'`, `tgt_lang: 'th'`) as a second
  pipeline stage in the same worker — this is the only viable Xenova-converted
  model with real Thai support; smaller options don't exist. Adds ~630MB to
  the download (checked before choosing: no lightweight English→Thai model
  exists in the Transformers.js ecosystem). Chosen over
  `nllb-200-distilled-600M` (~850MB, heavier) for size. Being multilingual,
  it's also reused bidirectionally for Thai-language *input* — see input
  language handling below.
- **Generation params (repetition guard)**: both `runSummary()` and
  `runTranslation()` (`src/workers/pipelineManager.ts`,
  `translationManager.ts`) pass `no_repeat_ngram_size: 3`; `runTranslation()`
  also caps `max_new_tokens: 256`. Added after m2m100 degenerated into an
  unbounded single-character repetition loop (`runTranslation()` originally
  had zero generation constraints — no length cap, no repeat guard). Don't
  strip these. Deliberately does **not** use `repetition_penalty` — tried
  `1.3`, it globally penalizes reusing recently-generated tokens, which
  broke *legitimate* repetition (e.g. "Lion" needing to recur across a
  story) and produced wrong-word mistranslations. `no_repeat_ngram_size`
  alone blocks verbatim n-gram loops (the actual bug) without penalizing
  isolated word reuse — don't reintroduce `repetition_penalty` without
  testing translation quality on multi-sentence input first.
- **Input language handling**: the summarizer (`distilbart-cnn-6-6`) is
  English-only; feeding it Thai directly caused hallucinated/garbled output
  (confirmed in testing). `src/utils/languageDetect.ts`'s `isThaiText()`
  (Thai Unicode block ratio, 15% threshold of non-whitespace chars) detects
  Thai input in `summarizer.worker.ts`'s `summarize` handler; if detected,
  the input is pre-translated th→en via the already-loaded `m2m100`
  translator *before* summarization, then the English summary is translated
  en→th as before. No new model is loaded for this — same translator, both
  directions. This means the translator now sometimes loads before the
  summarizer within the `summarize` handler (order depends on input
  language), though it's still loaded lazily on-demand inside that handler,
  never during the initial `load` warm-up.
- **Backend**: try WebGPU, fall back to WASM automatically for both models.
  Not a user-facing toggle. The WebGPU attempt is wrapped in a stall guard
  (`src/workers/pipelineLoadGuard.ts`, 15s of no progress event) that forces
  the WASM fallback — added after a WebGPU load hung long enough to freeze
  the whole machine (likely GPU driver/VRAM pressure from loading two large
  quantized models back-to-back, not just a tab freeze). A slow-but-progressing
  download is never mistaken for a stall since any progress event resets the
  timer.
- **Model load timing**: lazy — starts on first "Summarize" click, not on page
  mount. Translator loads on-demand inside the `summarize` handler, not during
  the initial `load` warm-up (which only loads the summarizer).
- **Long input**: truncate + warn. Chunking multiple passes is explicitly
  out-of-scope for v1 — don't add it without a new design discussion.
- **Inference location**: must run in a Web Worker (`src/workers/summarizer.worker.ts`).
  Never run either pipeline on the main thread — that reintroduces UI freeze,
  which is the exact thing the worker exists to avoid.
- **Model caching**: rely on Transformers.js's built-in Cache API/IndexedDB
  caching. Don't hand-roll caching logic.
- **URL-fetch backend**: `api/fetch-article.ts` is a Vercel serverless
  function, the ONLY backend code in this project. It fetches a user-supplied
  URL server-side (to avoid browser CORS) and extracts readable article text
  with `@mozilla/readability` + `linkedom` — **not** `jsdom`: jsdom's
  `html-encoding-sniffer` dependency requires an ESM-only package via
  CommonJS `require()`, which crashes (`ERR_REQUIRE_ESM`) once Vercel bundles
  the function as CJS for production. This broke in production while working
  fine under local `vercel dev` — don't reintroduce jsdom here without solving
  that bundling incompatibility first. Has basic SSRF protection (blocks
  loopback/private/link-local IPs, incl. cloud metadata endpoints) — keep it
  when touching this file. It only returns extracted text to the frontend; it
  never calls or knows about the AI pipeline.
- **Deploy target**: Vercel. No longer a pure static SPA — has one serverless
  function (`api/fetch-article.ts`). `vercel.json`'s `framework: "vite"` still
  applies; Vercel auto-detects `api/*.ts` as functions.

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
