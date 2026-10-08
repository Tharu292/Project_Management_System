package com.researchpms.backend.shared.security;

import org.springframework.security.access.AccessDeniedException;

/**
 * The caller is signed in but must change their password before using
 * anything else (HTTP 403). The message is shown to the client.
 */
public class PasswordChangeRequiredException extends AccessDeniedException {

	public static final String MESSAGE = "You must change your password before continuing.";

	public PasswordChangeRequiredException() {
		super(MESSAGE);
	}

}
