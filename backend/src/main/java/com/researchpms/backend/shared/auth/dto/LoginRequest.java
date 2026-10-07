package com.researchpms.backend.shared.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 128) String password) {

	/** Keeps the password out of logs if a request object is ever printed. */
	@Override
	public String toString() {
		return "LoginRequest[email=" + email + "]";
	}

}
