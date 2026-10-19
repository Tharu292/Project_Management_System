import type { InputHTMLAttributes } from 'react'

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  id: string
  label: string
  hint?: string
  error?: string
}

/** A labelled input whose hint and error are announced with the field. */
export default function FormField({ id, label, hint, error, ...inputProps }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 ' +
          'focus:outline-2 focus:outline-offset-1 focus:outline-indigo-600 disabled:bg-slate-100 ' +
          (error ? 'border-red-500' : 'border-slate-300')
        }
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
