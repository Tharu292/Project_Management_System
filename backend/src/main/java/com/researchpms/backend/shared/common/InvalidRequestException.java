package com.researchpms.backend.shared.common;

/**
 * A request field failed a rule that bean validation cannot express (HTTP 400).
 * The message is shown to the client.
 */
public class InvalidRequestException extends RuntimeException {

	private final String field;

	public InvalidRequestException(String field, String message) {
		super(message);
		this.field = field;
	}

	public String getField() {
		return field;
	}

}
