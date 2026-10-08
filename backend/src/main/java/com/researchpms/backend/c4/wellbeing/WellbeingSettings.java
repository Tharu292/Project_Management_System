package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Configuration, not student data: one version of the status bands, the trend
 * thresholds, and how many weeks a group-visible summary covers and needs.
 * No version exists until the values have been approved.
 */
@Entity
@Table(name = "c4_wb_settings")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class WellbeingSettings extends BaseEntity {

	@Column(name = "version", nullable = false, updatable = false)
	private int version;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "status_bands", nullable = false, updatable = false)
	private String statusBands;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "trend_params", nullable = false, updatable = false)
	private String trendParams;

	@Column(name = "summary_window_weeks", nullable = false, updatable = false)
	private int summaryWindowWeeks;

	@Column(name = "summary_min_reflections", nullable = false, updatable = false)
	private int summaryMinReflections;

	@Setter
	@Column(name = "active", nullable = false)
	private boolean active;

	WellbeingSettings(int version, String statusBands, String trendParams, int summaryWindowWeeks,
			int summaryMinReflections) {
		this.version = version;
		this.statusBands = statusBands;
		this.trendParams = trendParams;
		this.summaryWindowWeeks = summaryWindowWeeks;
		this.summaryMinReflections = summaryMinReflections;
	}

}
