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
