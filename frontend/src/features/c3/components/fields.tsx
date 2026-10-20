import type { SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// Multi-line text and drop-down fields that look and behave like the shared FormField:
// a visible label, and a hint and error announced with the field.

const controlClass =
  'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-indigo-600 disabled:bg-slate-100 '

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
}

function HintAndError({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  )
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {
  id: string
  label: string
  hint?: string
  error?: string
}

export function TextAreaField({ id, label, hint, error, rows = 4, ...props }: TextAreaFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClass + (error ? 'border-red-500' : 'border-slate-300')}
        {...props}
      />
      <HintAndError id={id} hint={hint} error={error} />
    </div>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  id: string
  label: string
  options: { value: string; label: string }[]
  hint?: string
  error?: string
}

export function SelectField({ id, label, options, hint, error, ...props }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClass + (error ? 'border-red-500' : 'border-slate-300')}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <HintAndError id={id} hint={hint} error={error} />
    </div>
  )
}
