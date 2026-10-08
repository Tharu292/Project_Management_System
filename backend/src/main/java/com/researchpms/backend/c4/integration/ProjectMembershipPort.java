package com.researchpms.backend.c4.integration;

import com.researchpms.backend.shared.project.ProjectRole;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * What Component 4 needs to know about project groups. Groups, and the
 * supervisor, co-supervisor and evaluator assignments, are owned by the shared
 * project membership; Component 4 only reads them.
 */
public interface ProjectMembershipPort {

	/** The active roles a user holds in a project; empty when they are not a member or the project does not exist. */
	Set<ProjectRole> activeRoles(UUID userId, UUID projectId);

	/** True when the user is a student account with an active STUDENT membership in the project. */
	boolean isActiveStudent(UUID userId, UUID projectId);

	/** The active students of a project group, in a stable order. */
	List<UUID> activeStudentIds(UUID projectId);

}
