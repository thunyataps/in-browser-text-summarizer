interface SummarizeButtonProps {
  onClick: () => void
  disabled: boolean
  label: string
}

export function SummarizeButton({ onClick, disabled, label }: SummarizeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}
