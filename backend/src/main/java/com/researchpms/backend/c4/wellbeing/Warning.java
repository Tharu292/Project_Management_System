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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** OWNER ONLY. An early warning for the student alone. Nobody else is alerted. */
@Entity
@Table(name = "c4_wb_warning")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Warning extends BaseEntity {

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "rule_code", nullable = false, updatable = false, length = 50)
	private String ruleCode;

	@Column(name = "message", nullable = false, updatable = false, length = 1000)
	private String message;

	/** JSON: why the rule fired. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "reason", updatable = false)
	private String reason;

	@Column(name = "raised_at", nullable = false, updatable = false)
	private Instant raisedAt;

	@Column(name = "read_at")
	private Instant readAt;

	Warning(UUID studentId, UUID projectId, String ruleCode, String message, String reason, Instant raisedAt) {
		this.studentId = studentId;
		this.projectId = projectId;
		this.ruleCode = ruleCode;
		this.message = message;
		this.reason = reason;
		this.raisedAt = raisedAt;
	}

	void markRead(Instant when) {
		if (readAt == null) {
			readAt = when;
		}
	}

}
