package com.researchpms.backend.shared.common;

/** Something with the same unique value already exists (HTTP 409). The message is shown to the client. */
public class DuplicateResourceException extends RuntimeException {

	public DuplicateResourceException(String message) {
		super(message);
	}

}
