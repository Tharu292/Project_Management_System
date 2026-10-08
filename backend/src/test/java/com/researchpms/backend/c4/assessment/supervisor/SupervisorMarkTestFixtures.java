package com.researchpms.backend.c4.assessment.supervisor;

import com.researchpms.backend.c4.assessment.AssessmentConfigEntry;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Test-only. Creates supervisor-side records directly; the entity is package-private. */
@Component
public class SupervisorMarkTestFixtures {

	private final SupervisorMarkRepository marks;

	SupervisorMarkTestFixtures(SupervisorMarkRepository marks) {
		this.marks = marks;
	}

	public UUID draft(UUID projectId, UUID studentId, AssessmentConfigEntry entry, UUID assessorId, String percent,
			String feedback) {
		return marks.saveAndFlush(newMark(projectId, studentId, entry, assessorId, percent, feedback)).getId();
	}

	public UUID submitted(UUID projectId, UUID studentId, AssessmentConfigEntry entry, UUID assessorId,
			String percent, String feedback) {
		SupervisorMark mark = newMark(projectId, studentId, entry, assessorId, percent, feedback);
		mark.submit(Instant.now());
		return marks.saveAndFlush(mark).getId();
	}

	public UUID released(UUID projectId, UUID studentId, AssessmentConfigEntry entry, UUID assessorId, String percent,
			String feedback) {
		SupervisorMark mark = newMark(projectId, studentId, entry, assessorId, percent, feedback);
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

	private static SupervisorMark newMark(UUID projectId, UUID studentId, AssessmentConfigEntry entry,
			UUID assessorId, String percent, String feedback) {
		SupervisorMark mark = new SupervisorMark(projectId, studentId, entry, assessorId);
		mark.updateDraft(percent == null ? null : new BigDecimal(percent), feedback);
		return mark;
	}

}
