type PrivacyVariant = 'private-wellbeing' | 'group-wellbeing'

const NOTICES: Record<PrivacyVariant, { title: string; lines: string[] }> = {
  'private-wellbeing': {
    title: 'Private to you',
    lines: [
      'Your reflections, predicted emotions, recommendations and warnings are visible only to you.',
      'Supervisors, co-supervisors, evaluators, administrators and other students cannot see them.',
      'They never affect your Contribution Indicator, your marks or any evaluation.',
    ],
  },
  'group-wellbeing': {
    title: 'Shared only by choice',
    lines: [
      'A teammate appears here only if they chose to share their wellbeing summary. Sharing is off by default.',
      'Only three things are ever shared: status, score and trend. Reflections and everything else stay private.',
      'Staff and administrators cannot see this page. The score is an experimental, reflection-based indicator, not a diagnosis.',
    ],
  },
}

/** States, in plain words, who can and cannot see the wellbeing information on a page. */
export default function PrivacyNotice({ variant }: { variant: PrivacyVariant }) {
  const notice = NOTICES[variant]
  return (
    <aside
      aria-label="Privacy"
      className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
    >
      <p className="font-semibold">{notice.title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {notice.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  )
}
