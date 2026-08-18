export function isBrowserSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined'
}
