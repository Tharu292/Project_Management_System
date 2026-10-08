import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info'

const TONE_CLASSES: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
}

/** An inline message. Errors interrupt a screen reader; everything else is announced politely. */
export default function Alert({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}
    >
      {children}
    </div>
  )
}
