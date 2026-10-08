package com.researchpms.backend.c4.assessment;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

/**
 * What a supervisor-side and an evaluator-side record have in common. The two
 * are separate entities in separate tables; this class only saves repeating
 * their shape and their rules. A record belongs to the one assessor who wrote
 * it, can be changed only while it is a draft, and is entered by a person: no
 * code creates a mark from a Contribution Indicator or computes a grade.
 */
@MappedSuperclass
@Getter
public abstract class AssessmentMark extends BaseEntity {

	private static final BigDecimal MAX_PERCENT = BigDecimal.valueOf(100);

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "config_entry_id", nullable = false, updatable = false)
	private AssessmentConfigEntry configEntry;

	@Enumerated(EnumType.STRING)
	@Column(name = "side", nullable = false, updatable = false, length = 20)
	private AssessmentSide side;

	@Column(name = "assessor_id", nullable = false, updatable = false)
	private UUID assessorId;

	/** A percentage of this entry; empty while the assessor is still drafting. */
	@Column(name = "mark_percent", precision = 5, scale = 2)
	private BigDecimal markPercent;

	@Column(name = "feedback", columnDefinition = "text")
	private String feedback;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 20)
	private MarkStatus status = MarkStatus.DRAFT;

	@Column(name = "submitted_at")
	private Instant submittedAt;

	@Column(name = "released_at")
	private Instant releasedAt;

	protected AssessmentMark() {
	}

	protected AssessmentMark(AssessmentSide side, UUID projectId, UUID studentId, AssessmentConfigEntry configEntry,
			UUID assessorId) {
		if (configEntry.getSide() != side) {
			throw new IllegalArgumentException("This entry is marked by the other side.");
		}
		this.side = side;
		this.projectId = projectId;
		this.studentId = studentId;
		this.configEntry = configEntry;
		this.assessorId = assessorId;
	}

	public boolean isDraft() {
		return status == MarkStatus.DRAFT;
	}

	public boolean isReleased() {
		return releasedAt != null;
	}

	public static boolean isValidPercent(BigDecimal percent) {
		return percent == null || (percent.signum() >= 0 && percent.compareTo(MAX_PERCENT) <= 0);
	}

	public void updateDraft(BigDecimal markPercent, String feedback) {
		requireDraft();
		if (!isValidPercent(markPercent)) {
			throw new IllegalArgumentException("A mark is a percentage between 0 and 100.");
		}
		this.markPercent = markPercent;
		this.feedback = feedback;
	}

	public void submit(Instant when) {
		requireDraft();
		if (markPercent == null) {
			throw new IllegalStateException("A mark must be entered before it is submitted.");
		}
		this.status = MarkStatus.SUBMITTED;
		this.submittedAt = when;
	}

	/** Makes a submitted record visible to the student. Who may do this, and when, is not yet decided. */
	public void release(Instant when) {
		if (status != MarkStatus.SUBMITTED) {
			throw new IllegalStateException("Only a submitted mark can be released.");
		}
		this.releasedAt = when;
	}

	private void requireDraft() {
		if (!isDraft()) {
			throw new IllegalStateException("A submitted mark is locked.");
		}
	}

}
