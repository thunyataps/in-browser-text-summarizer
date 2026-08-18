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
