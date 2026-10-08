import type { MemberContribution } from '../api/types'
import { EVIDENCE_UNAVAILABLE, NOT_CALCULATED, formatScore } from './contributionText'

/**
 * One horizontal bar per member, on the fixed 0 to 100 scale. A bar is drawn
 * only for a stored indicator. An indicator resting on partial evidence is
 * drawn dashed and lighter and is labelled, so it is not read as equal to a
 * complete one. The member table below the chart carries the same figures.
 */
export default function TeamComparisonChart({ members }: { members: MemberContribution[] }) {
  return (
    <figure aria-labelledby="comparison-caption" className="rounded-xl border border-slate-200 bg-white p-4">
      <figcaption id="comparison-caption" className="text-base font-semibold text-slate-900">
        Contribution Indicators in this group
      </figcaption>
      <p className="mt-1 text-xs text-slate-500">Scale 0 to 100. The table below gives the same figures.</p>
      <ul className="mt-4 space-y-3">
        {members.map((member) => {
          const indicator = member.snapshot?.indicator ?? null
          const partial = member.snapshot?.partial === true
          return (
            <li key={member.studentId} className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_minmax(0,1fr)_9rem] sm:items-center sm:gap-3">
              <span className="truncate text-sm font-medium text-slate-900">{member.displayName}</span>
              {indicator === null ? (
                <span className="text-sm text-slate-500 sm:col-span-2">
                  {member.calculated ? EVIDENCE_UNAVAILABLE : NOT_CALCULATED}
                </span>
              ) : (
                <>
                  <svg
                    viewBox="0 0 100 10"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`${member.displayName}: ${formatScore(indicator)} out of 100${partial ? ', based on partial evidence' : ''}`}
                    className="h-4 w-full"
                  >
                    <rect x="0" y="0" width="100" height="10" className="fill-slate-100" />
                    <rect
                      x="0"
                      y="0"
                      width={Math.max(0, Math.min(100, indicator))}
                      height="10"
                      className={partial ? 'fill-indigo-200 stroke-indigo-600' : 'fill-indigo-600'}
                      strokeWidth={partial ? 1 : 0}
                      strokeDasharray={partial ? '2 1.5' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <span className="text-sm text-slate-900">
                    <span className="font-semibold">{formatScore(indicator)}</span>
                    {partial && <span className="ml-1 text-xs text-amber-900">partial evidence</span>}
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
