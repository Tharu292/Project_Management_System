package com.researchpms.backend.shared.common;

/** The requested item does not exist (HTTP 404). The message is shown to the client. */
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}

}
