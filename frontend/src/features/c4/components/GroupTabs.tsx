import { NavLink } from 'react-router'

export interface GroupTab {
  to: string
  label: string
  /** True when the tab should only be marked current on its exact path. */
  end?: boolean
}

/**
 * The section menu of one group. It is given only the sections the user may
 * open, so a section that is not for them is simply not there.
 */
export default function GroupTabs({ tabs }: { tabs: GroupTab[] }) {
  return (
    <nav aria-label="Group sections" className="border-b border-slate-200">
      <ul className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.to} className="shrink-0">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                'block border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap focus-visible:outline-2 ' +
                'focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 ' +
                (isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900')
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
