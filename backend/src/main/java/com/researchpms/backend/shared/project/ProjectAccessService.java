package com.researchpms.backend.shared.project;

import com.researchpms.backend.shared.security.CurrentUserService;
import com.researchpms.backend.shared.user.SystemRole;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/**
 * How every component decides whether a user may act on a project. Access
 * comes only from active {@link ProjectMember} rows; a user may hold several
 * roles in one project, so always ask about a role rather than "the" role.
 *
 * <p>
 * The {@code require...} methods fail with a 403 (or a 401 when nobody is
 * signed in). A project that does not exist is treated like one the user is
 * not a member of, so callers cannot probe for project ids.
 *
 * <p>
 * The system ADMIN role is never a bypass: an admin without an active
 * membership fails every member and role check, exactly like any other
 * non-member. {@link #requireMemberOrAdmin(UUID)} is the single, explicit
 * exception, reserved for administrative operations.
 */
@Service
public class ProjectAccessService {

	private final ProjectMemberRepository memberRepository;

	private final CurrentUserService currentUserService;

	public ProjectAccessService(ProjectMemberRepository memberRepository, CurrentUserService currentUserService) {
		this.memberRepository = memberRepository;
		this.currentUserService = currentUserService;
	}

	/** The active roles a user holds in a project; empty when they are not a member. */
	public Set<ProjectRole> getRoles(UUID userId, UUID projectId) {
		Set<ProjectRole> roles = EnumSet.noneOf(ProjectRole.class);
		for (ProjectMember member : memberRepository.findByUserIdAndProjectIdAndActiveTrue(userId, projectId)) {
			roles.add(member.getProjectRole());
		}
		return roles;
	}

	public boolean isMember(UUID userId, UUID projectId) {
		return memberRepository.existsByUserIdAndProjectIdAndActiveTrue(userId, projectId);
	}

	public boolean hasRole(UUID userId, UUID projectId, ProjectRole role) {
		return memberRepository.existsByUserIdAndProjectIdAndProjectRoleAndActiveTrue(userId, projectId, role);
	}

	public Set<ProjectRole> getCurrentUserRoles(UUID projectId) {
		return getRoles(currentUserService.getCurrentUserId(), projectId);
	}

	public boolean isCurrentUserMember(UUID projectId) {
		return isMember(currentUserService.getCurrentUserId(), projectId);
	}

	public boolean currentUserHasRole(UUID projectId, ProjectRole role) {
		return hasRole(currentUserService.getCurrentUserId(), projectId, role);
	}

	public boolean currentUserHasAnyRole(UUID projectId, ProjectRole... roles) {
		Set<ProjectRole> held = getCurrentUserRoles(projectId);
		return Arrays.stream(roles).anyMatch(held::contains);
	}

	public boolean isCurrentUserAdmin() {
		return currentUserService.getCurrentSystemRole() == SystemRole.ADMIN;
	}

	public void requireMember(UUID projectId) {
		require(isCurrentUserMember(projectId));
	}

	public void requireRole(UUID projectId, ProjectRole role) {
		require(currentUserHasRole(projectId, role));
	}

	public void requireAnyRole(UUID projectId, ProjectRole... roles) {
		require(currentUserHasAnyRole(projectId, roles));
	}

	/**
	 * Explicit opt-in for administrative operations only. This is the one check
	 * that lets a non-member ADMIN through; it must not guard ordinary or
	 * sensitive project data, which use {@link #requireMember} or a role check.
	 */
	public void requireMemberOrAdmin(UUID projectId) {
		require(isCurrentUserAdmin() || isCurrentUserMember(projectId));
	}

	/** For system-level administrative operations that are not about one project's data. */
	public void requireAdmin() {
		require(isCurrentUserAdmin());
	}

	private static void require(boolean allowed) {
		if (!allowed) {
			throw new AccessDeniedException("Project access denied.");
		}
	}

}
