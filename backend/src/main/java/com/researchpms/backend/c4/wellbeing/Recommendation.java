package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** OWNER ONLY. A supportive suggestion produced by a transparent rule, shown to the student alone. */
@Entity
@Table(name = "c4_wb_recommendation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Recommendation extends BaseEntity {

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "iso_year", nullable = false, updatable = false)
	private int isoYear;

	@Column(name = "iso_week", nullable = false, updatable = false)
	private int isoWeek;

	@Column(name = "rule_code", nullable = false, updatable = false, length = 50)
	private String ruleCode;

	@Column(name = "message", nullable = false, updatable = false, length = 1000)
	private String message;

	/** JSON: why the rule fired. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "inputs", updatable = false)
	private String inputs;

	Recommendation(UUID studentId, UUID projectId, int isoYear, int isoWeek, String ruleCode, String message,
			String inputs) {
		this.studentId = studentId;
		this.projectId = projectId;
		this.isoYear = isoYear;
		this.isoWeek = isoWeek;
		this.ruleCode = ruleCode;
		this.message = message;
		this.inputs = inputs;
	}

}
