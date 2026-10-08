package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * OWNER ONLY. Whether a student has chosen to show their summary to their
 * group. Private is the default: without a row, or until the student opts in
 * after reading the notice, nothing is shared. Sharing can be withdrawn at
 * any time and stops immediately.
 */
@Entity
@Table(name = "c4_wb_sharing_preference")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class SharingPreference extends BaseEntity {

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "shared", nullable = false)
	private boolean shared = false;

	@Column(name = "notice_version", length = 20)
	private String noticeVersion;

	@Column(name = "acknowledged_at")
	private Instant acknowledgedAt;

	SharingPreference(UUID studentId, UUID projectId) {
		this.studentId = studentId;
		this.projectId = projectId;
	}

	/** Records which wording of the notice the student agreed to, and switches sharing on. */
	void optIn(String noticeVersion, Instant acknowledgedAt) {
		if (noticeVersion == null || noticeVersion.isBlank() || acknowledgedAt == null) {
			throw new IllegalArgumentException("Sharing needs an acknowledged notice.");
		}
		this.noticeVersion = noticeVersion;
		this.acknowledgedAt = acknowledgedAt;
		this.shared = true;
	}

	void withdraw() {
		this.shared = false;
	}

}
