package com.researchpms.backend.c4.contribution.dto;

import com.researchpms.backend.c4.contribution.ContributionSnapshot;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One student's Contribution Indicator as the group and its assigned staff
 * see it. A null score means no evidence was available; {@code partial} means
 * some of it was missing. It deliberately has no wellbeing and no marking
 * information, and it is not a mark.
 */
public record ContributionSummaryResponse(UUID studentId, boolean available, BigDecimal indicator,
		BigDecimal developmentScore, BigDecimal taskScore, BigDecimal collaborationScore, boolean partial,
		LocalDate periodStart, LocalDate periodEnd) {

	public static ContributionSummaryResponse from(ContributionSnapshot snapshot) {
		return new ContributionSummaryResponse(snapshot.getStudentId(), true, snapshot.getIndicator(),
				snapshot.getDevelopmentScore(), snapshot.getTaskScore(), snapshot.getCollaborationScore(),
				snapshot.isPartial(), snapshot.getPeriodStart(), snapshot.getPeriodEnd());
	}

	/** A group member for whom nothing has been calculated yet. */
	public static ContributionSummaryResponse notCalculated(UUID studentId) {
		return new ContributionSummaryResponse(studentId, false, null, null, null, null, false, null, null);
	}

}
