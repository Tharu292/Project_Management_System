package com.researchpms.backend.c3.research;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** A request the ML service refused, or could not answer. Messages are client-safe. */
public class MlServiceException extends RuntimeException {

	private final HttpStatus status;

	private final Map<String, String> fieldErrors;

	public MlServiceException(HttpStatus status, String message, Map<String, String> fieldErrors) {
		super(message);
		this.status = status;
		this.fieldErrors = Map.copyOf(fieldErrors);
	}

	public static MlServiceException unavailable() {
		return new MlServiceException(HttpStatus.SERVICE_UNAVAILABLE,
				"The research intelligence service is unavailable. Please try again later.", Map.of());
	}

	public HttpStatus getStatus() {
		return status;
	}

	public Map<String, String> getFieldErrors() {
		return fieldErrors;
	}

}
