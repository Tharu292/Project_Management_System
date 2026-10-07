package com.researchpms.backend.shared.auth.dto;

import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.util.UUID;

/** The client-safe view of a user. Deliberately has no password or project information. */
public record UserResponse(UUID id, String firstName, String lastName, String email, AccountType accountType,
		SystemRole systemRole, String registrationNumber, String staffId) {

	public static UserResponse from(User user) {
		return new UserResponse(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(),
				user.getAccountType(), user.getSystemRole(), user.getRegistrationNumber(), user.getStaffId());
	}

}
