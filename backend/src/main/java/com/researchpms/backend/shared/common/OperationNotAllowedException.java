package com.researchpms.backend.shared.common;

/**
 * The caller is allowed to use the endpoint, but not on this particular
 * target (HTTP 403). The message is shown to the client.
 */
public class OperationNotAllowedException extends RuntimeException {

	public OperationNotAllowedException(String message) {
		super(message);
	}

}
