package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One piece of contribution evidence, traceable to its source. The same
 * external item is stored once per project, so it cannot be counted twice.
 */
@Entity
@Table(name = "c4_contribution_evidence")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ContributionEvidence extends BaseEntity {

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	/** Null when the activity could not be matched to a student of the project. */
	@Column(name = "student_id", updatable = false)
	private UUID studentId;

	@Enumerated(EnumType.STRING)
	@Column(name = "source", nullable = false, updatable = false, length = 30)
	private EvidenceSource source;

	@Enumerated(EnumType.STRING)
	@Column(name = "evidence_type", nullable = false, updatable = false, length = 30)
	private EvidenceType evidenceType;

	@Column(name = "external_id", nullable = false, updatable = false, length = 200)
	private String externalId;

	@Column(name = "source_url", length = 500)
	private String sourceUrl;

	/** Pull requests only, and always set for them. */
	@Enumerated(EnumType.STRING)
	@Column(name = "state", length = 20)
	private PullRequestState state;

	@Column(name = "occurred_at", nullable = false, updatable = false)
	private Instant occurredAt;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "metadata")
	private String metadata;

	@Column(name = "sync_run_id", updatable = false)
	private UUID syncRunId;

	public ContributionEvidence(UUID projectId, UUID studentId, EvidenceSource source, EvidenceType evidenceType,
			String externalId, String sourceUrl, PullRequestState state, Instant occurredAt, UUID syncRunId) {
		if ((evidenceType == EvidenceType.PULL_REQUEST) != (state != null)) {
			throw new IllegalArgumentException("A pull request needs a state, and nothing else may have one.");
		}
		this.projectId = projectId;
		this.studentId = studentId;
		this.source = source;
		this.evidenceType = evidenceType;
		this.externalId = externalId;
		this.sourceUrl = sourceUrl;
		this.state = state;
		this.occurredAt = occurredAt;
		this.syncRunId = syncRunId;
	}

	/**
	 * A pull request stays one row for its whole life. When it is merged or
	 * closed, this row is updated instead of a second one being added, so the
	 * pull request is counted once, in its latest state.
	 */
	public void updatePullRequestState(PullRequestState state) {
		if (evidenceType != EvidenceType.PULL_REQUEST) {
			throw new IllegalStateException("Only a pull request has a state.");
		}
		if (state == null) {
			throw new IllegalArgumentException("A pull request always has a state.");
		}
		this.state = state;
	}

}
