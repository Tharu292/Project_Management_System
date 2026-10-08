package com.researchpms.backend.c4.groups;

import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.project.ProjectStatus;
import java.util.List;
import java.util.UUID;

/**
 * One project group the signed-in user belongs to, with the roles that count
 * for them there. It carries only what navigation needs: nothing about other
 * members, and no contribution, wellbeing or assessment information.
 */
public record MyGroupResponse(UUID projectId, String projectCode, String title, ProjectStatus status,
		List<ProjectRole> roles) {
}
