package com.researchpms.backend.c4.assessment;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A released mark as the student it is about sees it. It never represents an
 * unreleased record, and it does not name the assessor.
 */
public record ReleasedMarkResponse(AssessmentSide side, String entryCode, String entryName, BigDecimal markPercent,
		String feedback, Instant releasedAt) {

	public static ReleasedMarkResponse from(AssessmentMark mark) {
		return new ReleasedMarkResponse(mark.getSide(), mark.getConfigEntry().getCode(),
				mark.getConfigEntry().getName(), mark.getMarkPercent(), mark.getFeedback(), mark.getReleasedAt());
	}

}
