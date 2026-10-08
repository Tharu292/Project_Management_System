package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** OWNER ONLY. One student's weekly answers. Never logged, exported or shown to anyone else. */
@Entity
@Table(name = "c4_wb_reflection")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Reflection extends BaseEntity {

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "iso_year", nullable = false, updatable = false)
	private int isoYear;

	@Column(name = "iso_week", nullable = false, updatable = false)
	private int isoWeek;

	@Column(name = "work_done", nullable = false, columnDefinition = "text")
	private String workDone;

	@Column(name = "challenges", nullable = false, columnDefinition = "text")
	private String challenges;

	@Column(name = "next_steps", nullable = false, columnDefinition = "text")
	private String nextSteps;

	@Column(name = "progress_feeling", nullable = false, columnDefinition = "text")
	private String progressFeeling;

	Reflection(UUID studentId, UUID projectId, int isoYear, int isoWeek, String workDone, String challenges,
			String nextSteps, String progressFeeling) {
		this.studentId = studentId;
		this.projectId = projectId;
		this.isoYear = isoYear;
		this.isoWeek = isoWeek;
		this.workDone = workDone;
		this.challenges = challenges;
		this.nextSteps = nextSteps;
		this.progressFeeling = progressFeeling;
	}

	/** Keeps the answers out of logs if this object is ever printed. */
	@Override
	public String toString() {
		return "Reflection[id=" + getId() + "]";
	}

}
