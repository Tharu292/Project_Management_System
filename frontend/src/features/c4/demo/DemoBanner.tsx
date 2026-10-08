import { DEMO_BANNER_TEXT } from './demoMode'

/** Shown on every Component 4 page for as long as demonstration mode is on. It cannot be dismissed. */
export default function DemoBanner() {
  return (
    <p
      role="status"
      className="mb-6 rounded-lg border-2 border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-900"
    >
      {DEMO_BANNER_TEXT}
    </p>
  )
}
