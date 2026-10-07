package com.researchpms.backend.shared.common;

import java.time.Instant;
import java.util.Map;

/**
 * The body of every error response. {@code fieldErrors} maps a request field
 * to its problem and is empty unless the request failed validation.
 */
public record ApiError(Instant timestamp, int status, String error, String message, String path,
		Map<String, String> fieldErrors) {
}
