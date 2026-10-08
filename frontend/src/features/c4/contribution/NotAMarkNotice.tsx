/** Shown on every contribution page. The wording is deliberate: an indicator supports a judgement, it is not one. */
export default function NotAMarkNotice() {
  return (
    <aside
      aria-label="About the Contribution Indicator"
      className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
    >
      <p className="font-semibold text-slate-900">A Contribution Indicator is not an academic mark</p>
      <p className="mt-1">
        It summarises recorded evidence of contribution relative to the team, to support discussion and assessment.
        It never becomes a mark automatically, and assessment decisions remain with academic staff.
      </p>
    </aside>
  )
}
