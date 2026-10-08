interface CoverageBadgeProps {
  /** True when at least one evidence source was unavailable. */
  partial: boolean
  /** The sources that could not be read, named in plain words. */
  unavailableSources?: string[]
}

/**
 * Says whether a figure rests on all of its evidence or only part of it. The
 * meaning is carried by the words, not by the colour.
 */
export default function CoverageBadge({ partial, unavailableSources = [] }: CoverageBadgeProps) {
  if (!partial) {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        Complete evidence
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
        Partial evidence
      </span>
      {unavailableSources.length > 0 && (
        <span className="text-xs text-slate-600">Unavailable: {unavailableSources.join(', ')}</span>
      )}
    </span>
  )
}
