import { Navigate, Route, Routes } from 'react-router'
import { RESEARCH_WORKSPACE_PATH } from './paths'
import ProjectModulePage from './workspace/ProjectModulePage'
import WorkspaceHomePage from './workspace/WorkspaceHomePage'

/**
 * The Research Workspace, mounted under /research inside ProtectedRoute. What a
 * user may see in a project is decided by the backend on every request; these
 * pages only offer what the user's project roles allow.
 */
export default function C3Routes() {
  return (
    <Routes>
      <Route index element={<WorkspaceHomePage />} />
      <Route path="projects/:projectId/:module" element={<ProjectModulePage />} />
      <Route path="*" element={<Navigate to={RESEARCH_WORKSPACE_PATH} replace />} />
    </Routes>
  )
}
