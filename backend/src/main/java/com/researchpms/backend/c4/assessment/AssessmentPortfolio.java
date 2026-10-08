package com.researchpms.backend.c4.assessment;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A generated summary of one student's contribution evidence, for the
 * assessors of the project. It is built from contribution evidence only: it
 * never contains wellbeing information, and it contains no marks.
 */
@Entity
@Table(name = "c4_assessment_portfolio")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AssessmentPortfolio extends BaseEntity {

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@Column(name = "config_entry_id", updatable = false)
	private UUID configEntryId;

	/** The Contribution Indicator snapshot this portfolio summarises, when there is one. */
	@Column(name = "snapshot_id", updatable = false)
	private UUID snapshotId;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "content", nullable = false, updatable = false)
	private String content;

	/** JSON: links from each summarised item back to its source. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "source_refs", nullable = false, updatable = false)
	private String sourceRefs;

	@Column(name = "generated_by", nullable = false, updatable = false)
	private UUID generatedBy;

	@Column(name = "generated_at", nullable = false, updatable = false)
	private Instant generatedAt;

	public AssessmentPortfolio(UUID projectId, UUID studentId, UUID configEntryId, UUID snapshotId, String content,
			String sourceRefs, UUID generatedBy, Instant generatedAt) {
		this.projectId = projectId;
		this.studentId = studentId;
		this.configEntryId = configEntryId;
		this.snapshotId = snapshotId;
		this.content = content;
		this.sourceRefs = sourceRefs;
		this.generatedBy = generatedBy;
		this.generatedAt = generatedAt;
	}

}
