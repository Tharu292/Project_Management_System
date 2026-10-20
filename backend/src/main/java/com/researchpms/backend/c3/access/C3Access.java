package com.researchpms.backend.c3.access;

import com.researchpms.backend.shared.project.ProjectAccessService;
import com.researchpms.backend.shared.project.ProjectRole;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Who may do what in Component 3, expressed through the shared
 * {@link ProjectAccessService}. Access comes only from active project
 * memberships; the system ADMIN role is not a bypass.
 *
 * <ul>
 * <li>The supervision team (student, supervisor, co-supervisor) works with
 * conversations and meetings, and adds knowledge resources.</li>
 * <li>Every project member, evaluators included, may read the knowledge
 * repository and the evidence timeline.</li>
 * <li>Students add their own evidence; supervisors and co-supervisors verify it.</li>
 * </ul>
 */
@Service
public class C3Access {

	private static final ProjectRole[] SUPERVISION_TEAM = { ProjectRole.STUDENT, ProjectRole.SUPERVISOR,
			ProjectRole.CO_SUPERVISOR };

	private static final ProjectRole[] SUPERVISORS = { ProjectRole.SUPERVISOR, ProjectRole.CO_SUPERVISOR };

	private final ProjectAccessService projectAccess;

	public C3Access(ProjectAccessService projectAccess) {
		this.projectAccess = projectAccess;
	}

	public void requireMember(UUID projectId) {
		projectAccess.requireMember(projectId);
	}

	public void requireSupervisionTeam(UUID projectId) {
		projectAccess.requireAnyRole(projectId, SUPERVISION_TEAM);
	}

	public void requireStudent(UUID projectId) {
		projectAccess.requireRole(projectId, ProjectRole.STUDENT);
	}

	public void requireSupervisor(UUID projectId) {
		projectAccess.requireAnyRole(projectId, SUPERVISORS);
	}

}
