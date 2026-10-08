package com.researchpms.backend.c4.assessment.evaluator;

import com.researchpms.backend.c4.assessment.MarkStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** EVALUATOR SIDE. An evaluator's record as that evaluator sees it. Never sent to a supervisor or co-supervisor. */
public record EvaluatorMarkResponse(UUID id, UUID projectId, UUID studentId, String entryCode, String entryName,
		BigDecimal markPercent, String feedback, MarkStatus status, Instant submittedAt, Instant releasedAt) {

	static EvaluatorMarkResponse from(EvaluatorMark mark) {
		return new EvaluatorMarkResponse(mark.getId(), mark.getProjectId(), mark.getStudentId(),
				mark.getConfigEntry().getCode(), mark.getConfigEntry().getName(), mark.getMarkPercent(),
				mark.getFeedback(), mark.getStatus(), mark.getSubmittedAt(), mark.getReleasedAt());
	}

}
