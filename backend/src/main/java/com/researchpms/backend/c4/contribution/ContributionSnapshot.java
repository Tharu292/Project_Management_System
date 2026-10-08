package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A stored Contribution Indicator for one student over one period. A null
 * score means "no evidence was available", which is not the same as zero.
 * The indicator supports an evaluation; it is never a mark and nothing turns
 * it into one.
 */
@Entity
@Table(name = "c4_contribution_snapshot")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ContributionSnapshot extends BaseEntity {

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "student_id", nullable = false, updatable = false)
	private UUID studentId;

	@Column(name = "period_start", nullable = false, updatable = false)
	private LocalDate periodStart;

	@Column(name = "period_end", nullable = false, updatable = false)
	private LocalDate periodEnd;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "scoring_config_id", nullable = false, updatable = false)
	private ScoringConfig scoringConfig;

	/** JSON: per metric, its {@link MetricState}, raw count and normalised score. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "metrics", nullable = false, updatable = false)
	private String metrics;

	@Column(name = "development_score", precision = 5, scale = 2, updatable = false)
	private BigDecimal developmentScore;

	@Column(name = "task_score", precision = 5, scale = 2, updatable = false)
	private BigDecimal taskScore;

	@Column(name = "collaboration_score", precision = 5, scale = 2, updatable = false)
	private BigDecimal collaborationScore;

	@Column(name = "indicator", precision = 5, scale = 2, updatable = false)
	private BigDecimal indicator;

	/** JSON: which sources were available, and which were not. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "coverage", nullable = false, updatable = false)
	private String coverage;

	/** True when at least one source was unavailable. */
	@Column(name = "partial", nullable = false, updatable = false)
	private boolean partial;

	@Column(name = "computed_at", nullable = false, updatable = false)
	private Instant computedAt;

	public ContributionSnapshot(UUID projectId, UUID studentId, LocalDate periodStart, LocalDate periodEnd,
			ScoringConfig scoringConfig, String metrics, BigDecimal developmentScore, BigDecimal taskScore,
			BigDecimal collaborationScore, BigDecimal indicator, String coverage, boolean partial,
			Instant computedAt) {
		this.projectId = projectId;
		this.studentId = studentId;
		this.periodStart = periodStart;
		this.periodEnd = periodEnd;
		this.scoringConfig = scoringConfig;
		this.metrics = metrics;
		this.developmentScore = developmentScore;
		this.taskScore = taskScore;
		this.collaborationScore = collaborationScore;
		this.indicator = indicator;
		this.coverage = coverage;
		this.partial = partial;
		this.computedAt = computedAt;
	}

}
