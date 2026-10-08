package com.researchpms.backend.c4.access;

import com.researchpms.backend.c4.integration.ProjectMembershipPort;
import com.researchpms.backend.shared.common.ResourceNotFoundException;
import com.researchpms.backend.shared.security.CurrentUserService;
import com.researchpms.backend.shared.security.PasswordChangeRequiredException;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/**
 * The starting point of every Component 4 permission check: who is calling,
 * and what they are in the requested project. The contribution, wellbeing and
 * assessment modules each build their own rules on top of it. A project that
 * does not exist looks exactly like one the caller does not belong to.
 */
@Service
public class C4AccessService {

	private final CurrentUserService currentUserService;

	private final ProjectMembershipPort membership;

	public C4AccessService(CurrentUserService currentUserService, ProjectMembershipPort membership) {
		this.currentUserService = currentUserService;
		this.membership = membership;
	}

	/** Fails with a 401 when nobody is signed in, and with a 403 while the password must still be changed. */
	public C4Caller caller(UUID projectId) {
		if (currentUserService.isPasswordChangeRequired()) {
			throw new PasswordChangeRequiredException();
		}
		UUID userId = currentUserService.getCurrentUserId();
		return new C4Caller(userId, currentUserService.getCurrentAccountType(), currentUserService.getCurrentSystemRole(),
				membership.activeRoles(userId, projectId));
	}

	/** The student a request names must be an active student of the same project (HTTP 404 otherwise). */
	public void requireStudentOfProject(UUID projectId, UUID studentId) {
		if (!membership.isActiveStudent(studentId, projectId)) {
			throw new ResourceNotFoundException("Student not found in this project.");
		}
	}

	/** One message for every refusal, so a response never explains what the caller is missing. */
	public static AccessDeniedException denied() {
		return new AccessDeniedException("Project access denied.");
	}

}
