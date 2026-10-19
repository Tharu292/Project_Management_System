package com.researchpms.backend.shared.auth.dto;

import com.researchpms.backend.shared.security.ValidPassword;
import com.researchpms.backend.shared.security.WithinPasswordLimit;
import jakarta.validation.constraints.NotBlank;

/** What a signed-in user submits to replace their own password. */
public record ChangePasswordRequest(

		@NotBlank @WithinPasswordLimit String currentPassword,

		@ValidPassword String newPassword,

		@NotBlank String confirmPassword) {

	/** Keeps the passwords out of logs if a request object is ever printed. */
	@Override
	public String toString() {
		return "ChangePasswordRequest[]";
	}

}
