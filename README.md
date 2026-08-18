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
