package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * The only wellbeing data a teammate can ever be shown, and only while its
 * owner has opted in: a rolling status, score and trend. It holds nothing
 * that tells when, or how often, the student reflected, and no weekly value,
 * emotion or text.
 */
@Entity
@Table(name = "c4_wb_summary")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class WellbeingSummary extends BaseEntity {

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 20)
	private WellbeingStatus status;

	@Column(name = "score", nullable = false, precision = 3, scale = 2)
	private BigDecimal score;

	@Enumerated(EnumType.STRING)
	@Column(name = "trend", nullable = false, length = 20)
	private WellbeingTrend trend;

	WellbeingSummary(UUID studentId, UUID projectId, WellbeingStatus status, BigDecimal score, WellbeingTrend trend) {
		this.studentId = studentId;
		this.projectId = projectId;
		update(status, score, trend);
	}

	void update(WellbeingStatus status, BigDecimal score, WellbeingTrend trend) {
		this.status = status;
		this.score = score;
		this.trend = trend;
	}

}
