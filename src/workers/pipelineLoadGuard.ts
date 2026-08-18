export const WEBGPU_STALL_TIMEOUT_MS = 15_000

/**
 * Guards a pipeline load against a stalled WebGPU backend (e.g. a GPU driver
 * that never resolves or rejects). Resets an inactivity timer on every
 * progress event, so a slow-but-progressing download is never mistaken for
 * a stall — only silence for `stallTimeoutMs` triggers the timeout.
 */
export function loadWithStallGuard<T>(
  loader: (onProgress: (data: unknown) => void) => Promise<T>,
  onProgress: (data: unknown) => void,
  stallTimeoutMs: number = WEBGPU_STALL_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        reject(new Error(`Pipeline load stalled: no progress for ${stallTimeoutMs}ms`))
      }, stallTimeoutMs)
    }

    resetTimer()

    loader((data) => {
      resetTimer()
      onProgress(data)
    }).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
