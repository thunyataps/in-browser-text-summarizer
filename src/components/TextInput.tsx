import { getTextStats } from '../utils/textStats'

interface TextInputProps {
  value: string
  onChange: (text: string) => void
}

export function TextInput({ value, onChange }: TextInputProps) {
  const stats = getTextStats(value)

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-48 w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        placeholder="Paste or type an article to summarize..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Article text"
      />
      <p className="text-xs text-slate-500">
        {stats.words} words · {stats.chars} characters
      </p>
    </div>
  )
}
