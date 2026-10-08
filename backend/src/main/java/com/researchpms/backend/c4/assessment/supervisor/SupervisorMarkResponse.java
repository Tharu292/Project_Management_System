package com.researchpms.backend.c4.assessment.supervisor;

import com.researchpms.backend.c4.assessment.MarkStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** SUPERVISOR SIDE. A supervisor-side record as its own assessor sees it. Never sent to an evaluator. */
public record SupervisorMarkResponse(UUID id, UUID projectId, UUID studentId, String entryCode, String entryName,
		BigDecimal markPercent, String feedback, MarkStatus status, Instant submittedAt, Instant releasedAt) {

	static SupervisorMarkResponse from(SupervisorMark mark) {
		return new SupervisorMarkResponse(mark.getId(), mark.getProjectId(), mark.getStudentId(),
				mark.getConfigEntry().getCode(), mark.getConfigEntry().getName(), mark.getMarkPercent(),
				mark.getFeedback(), mark.getStatus(), mark.getSubmittedAt(), mark.getReleasedAt());
	}

}
