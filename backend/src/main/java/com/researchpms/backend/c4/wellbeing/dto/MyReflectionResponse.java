package com.researchpms.backend.c4.wellbeing.dto;

import java.time.Instant;
import java.util.UUID;

/** OWNER ONLY. A student's own weekly reflection. */
public record MyReflectionResponse(UUID id, int isoYear, int isoWeek, String workDone, String challenges,
		String nextSteps, String progressFeeling, Instant submittedAt, Instant updatedAt) {

	/** Keeps the answers out of logs if this object is ever printed. */
	@Override
	public String toString() {
		return "MyReflectionResponse[id=" + id + "]";
	}

}
