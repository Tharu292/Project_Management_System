import { useState, type InputHTMLAttributes } from 'react'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'type'> {
  id: string
  label: string
  hint?: string
  error?: string
}

/**
 * A labelled password input with a show/hide control. Showing the password
 * only changes how this input is drawn; the value is never copied anywhere.
 */
export default function PasswordField({ id, label, hint, error, disabled, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={
            'block w-full rounded-lg border bg-white py-2 pr-16 pl-3 text-slate-900 placeholder:text-slate-400 ' +
            'focus:outline-2 focus:outline-offset-1 focus:outline-indigo-600 disabled:bg-slate-100 ' +
            (error ? 'border-red-500' : 'border-slate-300')
          }
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          disabled={disabled}
          className={
            'absolute inset-y-0 right-0 rounded-r-lg px-3 text-sm font-semibold text-indigo-700 hover:text-indigo-900 ' +
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 ' +
            'disabled:cursor-not-allowed disabled:text-slate-400'
          }
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
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
