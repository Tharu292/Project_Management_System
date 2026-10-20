package com.researchpms.backend.c3.evidence;

import com.researchpms.backend.shared.common.BaseEntity;
import com.researchpms.backend.shared.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One piece of evidence of a student's work, optionally linked to a meeting,
 * conversation or resource of the same project, and its verification by a
 * supervisor. It carries no mark or grade: assessment belongs to Component 4.
 */
@Entity
@Table(name = "c3_evidence")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvidenceItem extends BaseEntity {

	public enum ActivityType {
		MEETING, CONVERSATION, RESOURCE, OTHER
	}

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "student_id", nullable = false, updatable = false)
	private User student;

	@Column(name = "title", nullable = false, length = 200)
	private String title;

	@Column(name = "description")
	private String description;

	@Column(name = "occurred_on", nullable = false)
	private LocalDate occurredOn;

	@Enumerated(EnumType.STRING)
	@Column(name = "activity_type", nullable = false, length = 20)
	private ActivityType activityType;

	@Column(name = "activity_id")
	private UUID activityId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "verified_by")
	private User verifiedBy;

	@Column(name = "verified_at")
	private Instant verifiedAt;

	public EvidenceItem(UUID projectId, User student, String title, String description, LocalDate occurredOn,
			ActivityType activityType, UUID activityId) {
		this.projectId = projectId;
		this.student = student;
		this.title = title;
		this.description = description;
		this.occurredOn = occurredOn;
		this.activityType = activityType;
		this.activityId = activityId;
	}

	public boolean isVerified() {
		return verifiedAt != null;
	}

	public void verify(User supervisor, Instant at) {
		this.verifiedBy = supervisor;
		this.verifiedAt = at;
	}

}
