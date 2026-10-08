import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: ReactNode
  /** A short clarification under the value. */
  hint?: ReactNode
}

/** One labelled figure or fact. The label is announced with the value. */
export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div role="group" aria-label={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 text-lg font-semibold break-words text-slate-900">{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
