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
- **Output language**: English only. Previously the English summary was
  translated back to Thai (`en`→`th`) as a second pipeline stage; this was
  removed because the en→th leg introduced mistranslated/garbled words even
  with beam search + repetition guards. Rather than continue chasing
  translation-quality fixes, the summary is now returned in English
  unconditionally, regardless of input language. Don't reintroduce an
  en→th output stage without a new design discussion.
- **Translation model**: `Xenova/m2m100_418M`, quantized `q8`, kept *only*
  for th→en input pre-translation (see input language handling below) — not
  used for output anymore. Loaded lazily and only when Thai input is
  detected; English input never touches the translator. Adds ~630MB to the
  download when it does load (checked before choosing: no lightweight
  Thai→English-only model exists in the Transformers.js ecosystem). Chosen
  over `nllb-200-distilled-600M` (~850MB, heavier) for size.
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
- **`runSummary()`'s `min_new_tokens: 60`**: raised from 30 after confirming
  (2026-08-19) that the WebGPU backend emits a premature EOS token around
  ~55-60 generated tokens on some inputs, cutting summaries off mid-sentence
  — a quantization/numerics artifact specific to WebGPU (identical input run
  locally through Node/WASM generates the full sentence every time, at any
  `max_new_tokens` cap, since it doesn't hit a cap at all — it stops
  naturally and correctly well under 150 tokens). `min_new_tokens` blocks
  the EOS logit until the floor is reached, which sidesteps the bad EOS
  prediction rather than fixing it at the source. Raising `max_new_tokens`
  alone (150→220) did **not** fix this — verify that any future tuning here
  is confirmed against the WebGPU backend specifically (check the console
  log line `[pipelineManager] Loaded summarization pipeline on backend:
  webgpu` vs `wasm`), not just a local Node/WASM test.
- **Decoding strategy**: both use `num_beams: 4` (beam search, still fully
  local/in-browser — no external API). Added because greedy decoding
  (the implicit default) produced confidently-wrong word choices even after
  the repetition-loop bug was fixed (e.g. "Lion" mistranslated as "เลีย"/lick)
  — a known weakness of greedy decoding, not something a repetition penalty
  fixes. Costs more compute per request than greedy; if load time becomes a
  complaint, lower before removing (e.g. `num_beams: 2`) rather than
  reverting to greedy outright.
- **Input language handling**: accepts both English and Thai input. The
  summarizer (`distilbart-cnn-6-6`) is English-only; feeding it Thai
  directly caused hallucinated/garbled output (confirmed in testing).
  `src/utils/languageDetect.ts`'s `isThaiText()` (Thai Unicode block ratio,
  15% threshold of non-whitespace chars) detects Thai input in
  `summarizer.worker.ts`'s `summarize` handler; if detected, the input is
  pre-translated th→en via the `m2m100` translator *before* summarization.
  Output is always the English summary (see output language above) — there
  is no en→th leg anymore. The translator is only loaded when Thai input is
  detected, lazily inside the `summarize` handler, never during the initial
  `load` warm-up.
- **Backend**: not a user-facing toggle either way.
  - **Summarizer** (`pipelineManager.ts`): **WASM only**, no WebGPU attempt.
    Confirmed (2026-08-19) that the WebGPU device silently ignores/mishandles
    `min_new_tokens`/`max_new_tokens` for this model — generation stopped at
    the same premature point regardless of what those params were set to,
    while the identical input on WASM completed correctly every time. Since
    generate-param correctness can't be trusted on WebGPU for this model,
    WASM is used unconditionally rather than attempted-then-verified. Don't
    reintroduce a WebGPU attempt here without confirming the underlying
    transformers.js issue is fixed.
  - **Translator** (`translationManager.ts`): still tries WebGPU, falls back
    to WASM. The WebGPU attempt is wrapped in a stall guard
    (`src/workers/pipelineLoadGuard.ts`, 15s of no progress event) that
    forces the WASM fallback — added after a WebGPU load hung long enough to
    freeze the whole machine (likely GPU driver/VRAM pressure from loading
    two large quantized models back-to-back, not just a tab freeze). A
    slow-but-progressing download is never mistaken for a stall since any
    progress event resets the timer. Hasn't shown the same premature-EOS
    symptom as the summarizer, but hasn't been stress-tested for it either —
    if garbled/truncated th→en translations show up, check this first.
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
