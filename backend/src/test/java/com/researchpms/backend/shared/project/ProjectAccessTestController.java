package com.researchpms.backend.shared.project;

import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only endpoints showing how a component guards a project resource.
 * Lives under src/test, so it is never part of the real application.
 */
@RestController
@RequestMapping("/api/test/projects/{projectId}")
class ProjectAccessTestController {

	private final ProjectAccessService projectAccess;

	ProjectAccessTestController(ProjectAccessService projectAccess) {
		this.projectAccess = projectAccess;
	}

	@GetMapping("/member")
	Set<ProjectRole> memberOnly(@PathVariable UUID projectId) {
		projectAccess.requireMember(projectId);
		return projectAccess.getCurrentUserRoles(projectId);
	}

	@GetMapping("/supervision")
	String supervisorsOnly(@PathVariable UUID projectId) {
		projectAccess.requireAnyRole(projectId, ProjectRole.SUPERVISOR, ProjectRole.CO_SUPERVISOR);
		return "ok";
	}

	@GetMapping("/member-or-admin")
	String memberOrAdmin(@PathVariable UUID projectId) {
		projectAccess.requireMemberOrAdmin(projectId);
		return "ok";
	}

}
