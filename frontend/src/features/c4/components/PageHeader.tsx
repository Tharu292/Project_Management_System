import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Small facts shown under the title, for example a code or role badges. */
  meta?: ReactNode
  /** Buttons or links placed beside the title. */
  actions?: ReactNode
}

/** The heading of a Component 4 page. Every page has exactly one. */
export default function PageHeader({ title, subtitle, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold break-words text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
