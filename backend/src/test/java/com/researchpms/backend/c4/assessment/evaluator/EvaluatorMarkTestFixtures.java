package com.researchpms.backend.c4.assessment.evaluator;

import com.researchpms.backend.c4.assessment.AssessmentConfigEntry;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Test-only. Creates evaluator-side records directly; the entity is package-private. */
@Component
public class EvaluatorMarkTestFixtures {

	private final EvaluatorMarkRepository marks;

	EvaluatorMarkTestFixtures(EvaluatorMarkRepository marks) {
		this.marks = marks;
	}

	public UUID draft(UUID projectId, UUID studentId, AssessmentConfigEntry entry, UUID assessorId, String percent,
			String feedback) {
		return marks.saveAndFlush(newMark(projectId, studentId, entry, assessorId, percent, feedback)).getId();
	}

	public UUID submitted(UUID projectId, UUID studentId, AssessmentConfigEntry entry, UUID assessorId,
			String percent, String feedback) {
		EvaluatorMark mark = newMark(projectId, studentId, entry, assessorId, percent, feedback);
		mark.submit(Instant.now());
		return marks.saveAndFlush(mark).getId();
	}

	public UUID released(UUID projectId, UUID studentId, AssessmentConfigEntry entry, UUID assessorId, String percent,
			String feedback) {
		EvaluatorMark mark = newMark(projectId, studentId, entry, assessorId, percent, feedback);
		mark.submit(Instant.now());
		mark.release(Instant.now());
		return marks.saveAndFlush(mark).getId();
	}

	public BigDecimal storedPercent(UUID markId) {
		return marks.findById(markId).orElseThrow().getMarkPercent();
	}

	public long count() {
		return marks.count();
	}

	private static EvaluatorMark newMark(UUID projectId, UUID studentId, AssessmentConfigEntry entry, UUID assessorId,
			String percent, String feedback) {
		EvaluatorMark mark = new EvaluatorMark(projectId, studentId, entry, assessorId);
		mark.updateDraft(percent == null ? null : new BigDecimal(percent), feedback);
		return mark;
	}

}
