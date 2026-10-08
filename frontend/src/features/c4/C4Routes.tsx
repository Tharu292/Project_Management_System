import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { homePathFor, isAdmin } from '../../auth/landing'
import AppShell, { secondaryButtonClass } from '../../components/AppShell'
import StateBlock from './components/StateBlock'
import ContributionDashboardPage from './contribution/ContributionDashboardPage'
import StudentContributionPage from './contribution/StudentContributionPage'
import DemoBanner from './demo/DemoBanner'
import { isDemoMode } from './demo/demoMode'
import GroupLayout from './groups/GroupLayout'
import GroupOverviewPage from './groups/GroupOverviewPage'
import { MyGroupsProvider } from './groups/MyGroupsProvider'
import MyGroupsPage from './groups/MyGroupsPage'
import SectionRoute from './groups/SectionRoute'
import { GROUP_SECTIONS, type GroupSection } from './groups/groupAccess'
import { GROUPS_PATH } from './paths'
import TeamProgressPage from './progress/TeamProgressPage'

/** The pages that exist so far, by section path. A section without one shows "not available yet". */
const SECTION_PAGES: Record<string, ReactNode> = {
  contribution: <ContributionDashboardPage />,
  progress: <TeamProgressPage />,
}

const CONTRIBUTION_SECTION = GROUP_SECTIONS.find((section) => section.path === 'contribution') as GroupSection

/**
 * Every Component 4 page, mounted under /groups inside ProtectedRoute, which
 * has already dealt with signed-out users and users who must change their
 * password. Administrators have no project groups and are sent to their own
 * start page. Everything here is a convenience for the user: the backend
 * decides what each request may see.
 */
export default function C4Routes() {
  const { user } = useAuth()

  if (user === null) {
    return null
  }
  if (isAdmin(user)) {
    return <Navigate to={homePathFor(user)} replace />
  }

  return (
    <MyGroupsProvider>
      <AppShell>
        {import.meta.env.DEV && isDemoMode() && <DemoBanner />}
        <Routes>
          <Route index element={<MyGroupsPage />} />
          <Route path=":groupId" element={<GroupLayout />}>
            <Route index element={<GroupOverviewPage />} />
            {GROUP_SECTIONS.map((section) => (
              <Route
                key={section.path}
                path={section.path}
                element={<SectionRoute section={section}>{SECTION_PAGES[section.path]}</SectionRoute>}
              />
            ))}
            <Route
              path="contribution/:studentId"
              element={
                <SectionRoute section={CONTRIBUTION_SECTION}>
                  <StudentContributionPage />
                </SectionRoute>
              }
            />
            <Route
              path="*"
              element={
                <StateBlock
                  kind="unavailable"
                  title="There is no such section"
                  action={
                    <Link to={GROUPS_PATH} className={secondaryButtonClass}>
                      Back to my groups
                    </Link>
                  }
                />
              }
            />
          </Route>
        </Routes>
      </AppShell>
    </MyGroupsProvider>
  )
}
