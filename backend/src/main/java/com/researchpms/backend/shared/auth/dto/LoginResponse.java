package com.researchpms.backend.shared.auth.dto;

/** {@code expiresIn} is the access token lifetime in seconds. */
public record LoginResponse(String accessToken, String tokenType, long expiresIn, UserResponse user) {

	public static LoginResponse bearer(String accessToken, long expiresIn, UserResponse user) {
		return new LoginResponse(accessToken, "Bearer", expiresIn, user);
	}

}
