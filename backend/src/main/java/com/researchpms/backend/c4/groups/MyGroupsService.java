package com.researchpms.backend.c4.groups;

import com.researchpms.backend.c4.access.C4Caller;
import com.researchpms.backend.c4.integration.ProjectMembershipPort;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.security.CurrentUserService;
import com.researchpms.backend.shared.security.PasswordChangeRequiredException;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Which project groups the signed-in user may open in Component 4. The user
 * is always the caller: there is no way to ask about anyone else. A group is
 * listed only when the user holds a role there that fits their account, so an
 * administrator, who holds none, gets an empty list.
 */
@Service
public class MyGroupsService {

	private final CurrentUserService currentUserService;

	private final ProjectMembershipPort membership;

	public MyGroupsService(CurrentUserService currentUserService, ProjectMembershipPort membership) {
		this.currentUserService = currentUserService;
		this.membership = membership;
	}

	/** Fails with a 401 when nobody is signed in, and with a 403 while the password must still be changed. */
	public List<MyGroupResponse> myGroups() {
		if (currentUserService.isPasswordChangeRequired()) {
			throw new PasswordChangeRequiredException();
		}
		UUID userId = currentUserService.getCurrentUserId();
		AccountType accountType = currentUserService.getCurrentAccountType();
		SystemRole systemRole = currentUserService.getCurrentSystemRole();
		return membership.activeMemberships(userId).stream().map(group -> {
			List<ProjectRole> roles = new C4Caller(userId, accountType, systemRole, group.roles()).effectiveRoles();
			return new MyGroupResponse(group.projectId(), group.projectCode(), group.title(), group.status(), roles);
		}).filter(group -> !group.roles().isEmpty()).toList();
	}

}
