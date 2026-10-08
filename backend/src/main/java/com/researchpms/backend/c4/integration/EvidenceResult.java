package com.researchpms.backend.c4.integration;

import java.util.List;

/**
 * The answer of another component to a request for evidence. "Unavailable"
 * (the component is not connected, or could not answer) is a different thing
 * from "available, and there is nothing": only the second is a verified zero.
 */
public record EvidenceResult<T>(boolean available, List<T> items, String unavailableReason) {

	public static <T> EvidenceResult<T> of(List<T> items) {
		return new EvidenceResult<>(true, List.copyOf(items), null);
	}

	public static <T> EvidenceResult<T> unavailable(String reason) {
		return new EvidenceResult<>(false, List.of(), reason);
	}

}
