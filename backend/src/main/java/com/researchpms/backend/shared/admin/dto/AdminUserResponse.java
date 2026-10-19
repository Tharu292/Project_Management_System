package com.researchpms.backend.shared.admin.dto;

import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.time.Instant;
import java.util.UUID;

/**
 * An account as an administrator sees it: the ordinary safe user fields plus
 * whether the account is enabled, whether its owner has yet to replace the
 * password they were given, and when it was created. Never a password,
 * and no project information.
 */
public record AdminUserResponse(UUID id, String firstName, String lastName, String email, AccountType accountType,
		SystemRole systemRole, String registrationNumber, String staffId, boolean enabled,
		boolean mustChangePassword, Instant createdAt) {

	public static AdminUserResponse from(User user) {
		return new AdminUserResponse(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(),
				user.getAccountType(), user.getSystemRole(), user.getRegistrationNumber(), user.getStaffId(),
				user.isEnabled(), user.isMustChangePassword(), user.getCreatedAt());
	}

}
