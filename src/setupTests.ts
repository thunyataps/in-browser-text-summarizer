import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not implement Web Workers. Provide a minimal stub so the test
// environment reflects a "supported browser" baseline (Worker + WebAssembly
// both defined). Tests that need custom worker behavior stub this further
// with vi.stubGlobal('Worker', ...).
if (typeof globalThis.Worker === 'undefined') {
  class WorkerStub {
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    constructor(_url: string | URL, _options?: WorkerOptions) {}
    postMessage(): void {}
    terminate(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean {
      return false
    }
  }
  globalThis.Worker = WorkerStub as unknown as typeof Worker
}

afterEach(() => cleanup())
