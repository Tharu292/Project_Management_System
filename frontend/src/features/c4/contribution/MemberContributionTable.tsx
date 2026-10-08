import { Link } from 'react-router'
import { linkClass } from '../../../components/AuthLayout'
import type { MemberContribution } from '../api/types'
import CoverageBadge from '../components/CoverageBadge'
import { sectionPath } from '../paths'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  EVIDENCE_UNAVAILABLE,
  NOT_CALCULATED,
  categoryScore,
  formatScore,
  unavailableSourceNames,
} from './contributionText'

const headerCell = 'px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase'
const cell = 'px-3 py-3 align-top text-sm text-slate-800'

function Score({ value }: { value: number | null }) {
  return value === null ? (
    <span className="text-slate-500">{EVIDENCE_UNAVAILABLE}</span>
  ) : (
    <span className="font-medium">{formatScore(value)}</span>
  )
}

/**
 * The figures behind the comparison chart. Members stay in the order the
 * backend lists them (by name): the table does not rank anyone.
 */
export default function MemberContributionTable({ projectId, members }: { projectId: string; members: MemberContribution[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <caption className="sr-only">Contribution Indicators and category scores of each group member</caption>
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className={headerCell}>
              Student
            </th>
            <th scope="col" className={headerCell}>
              Indicator
            </th>
            {CATEGORY_ORDER.map((category) => (
              <th key={category} scope="col" className={headerCell}>
                {CATEGORY_LABELS[category]}
              </th>
            ))}
            <th scope="col" className={headerCell}>
              Evidence
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {members.map((member) => {
            const snapshot = member.snapshot
            return (
              <tr key={member.studentId}>
                <th scope="row" className={`${cell} text-left font-normal`}>
                  <Link
                    to={sectionPath(projectId, `contribution/${member.studentId}`)}
                    aria-label={`Contribution details of ${member.displayName}`}
                    className={linkClass}
                  >
                    {member.displayName}
                  </Link>
                </th>
                {snapshot === null ? (
                  <td colSpan={CATEGORY_ORDER.length + 2} className={`${cell} text-slate-500`}>
                    {NOT_CALCULATED}
                  </td>
                ) : (
                  <>
                    <td className={cell}>
                      <Score value={snapshot.indicator} />
                    </td>
                    {CATEGORY_ORDER.map((category) => (
                      <td key={category} className={cell}>
                        <Score value={categoryScore(snapshot, category)} />
                      </td>
                    ))}
                    <td className={cell}>
                      <CoverageBadge partial={snapshot.partial} unavailableSources={unavailableSourceNames(snapshot)} />
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
