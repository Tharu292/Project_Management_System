import { useEffect, useId, useRef, type ReactNode } from 'react'
import Alert from './Alert'
import { actionButtonClass, secondaryButtonClass } from './AppShell'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  busyLabel: string
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before an action that changes someone's account. Escape and Cancel both back out. */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Start on the safe choice, and give focus back to where it was afterwards.
  useEffect(() => {
    const previouslyFocused = document.activeElement
    cancelRef.current?.focus()
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-600">{children}</div>
        {error && (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={actionButtonClass}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
