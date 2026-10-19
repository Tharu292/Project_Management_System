package com.researchpms.backend.shared.admin.dto;

import com.researchpms.backend.shared.security.ValidPassword;
import com.researchpms.backend.shared.user.StaffEmailPolicy;
import com.researchpms.backend.shared.user.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * What an administrator submits to create a staff account. Account type,
 * system role and enabled status are not part of the request; the server
 * decides them. Values are normalised on arrival, so validation sees what
 * will be stored.
 */
public record CreateStaffRequest(

		@NotBlank @Size(max = 100) String firstName,

		@NotBlank @Size(max = 100) String lastName,

		@NotBlank @Size(max = 254) @Pattern(regexp = StaffEmailPolicy.PATTERN,
				message = StaffEmailPolicy.MESSAGE) String email,

		@NotBlank @Size(max = 30) String staffId,

		@ValidPassword String password,

		@NotBlank String confirmPassword) {

	public CreateStaffRequest {
		firstName = firstName == null ? null : firstName.trim();
		lastName = lastName == null ? null : lastName.trim();
		email = User.normalizeEmail(email);
		staffId = staffId == null ? null : staffId.trim();
	}

	/** Keeps the passwords out of logs if a request object is ever printed. */
	@Override
	public String toString() {
		return "CreateStaffRequest[email=" + email + ", staffId=" + staffId + "]";
	}

}
