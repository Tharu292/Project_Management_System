package com.researchpms.backend.c3.meeting;

import com.researchpms.backend.shared.common.BaseEntity;
import com.researchpms.backend.shared.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A supervision meeting of a project and, once it has taken place, its minutes. */
@Entity
@Table(name = "c3_meeting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Meeting extends BaseEntity {

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "title", nullable = false, length = 200)
	private String title;

	@Column(name = "scheduled_at", nullable = false)
	private Instant scheduledAt;

	@Column(name = "duration_minutes")
	private Integer durationMinutes;

	@Column(name = "location", length = 500)
	private String location;

	@Column(name = "agenda")
	private String agenda;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "created_by", nullable = false, updatable = false)
	private User createdBy;

	@Column(name = "minutes")
	private String minutes;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "minutes_recorded_by")
	private User minutesRecordedBy;

	@Column(name = "minutes_recorded_at")
	private Instant minutesRecordedAt;

	public Meeting(UUID projectId, String title, Instant scheduledAt, Integer durationMinutes, String location,
			String agenda, User createdBy) {
		this.projectId = projectId;
		this.title = title;
		this.scheduledAt = scheduledAt;
		this.durationMinutes = durationMinutes;
		this.location = location;
		this.agenda = agenda;
		this.createdBy = createdBy;
	}

	public boolean hasMinutes() {
		return minutes != null;
	}

	public void recordMinutes(String minutes, User recordedBy, Instant recordedAt) {
		this.minutes = minutes;
		this.minutesRecordedBy = recordedBy;
		this.minutesRecordedAt = recordedAt;
	}

}
