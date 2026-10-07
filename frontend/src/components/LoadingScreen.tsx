export default function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-svh items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 text-slate-600">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
        />
        <span>Checking your session…</span>
      </div>
    </div>
  )
}
