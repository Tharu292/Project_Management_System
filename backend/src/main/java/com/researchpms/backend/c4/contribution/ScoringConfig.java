package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One version of the Contribution Indicator weights. A version is never
 * edited once used: changing the weights means adding a new version, so every
 * stored result can still be traced to the weights that produced it.
 */
@Entity
@Table(name = "c4_scoring_config")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ScoringConfig extends BaseEntity {

	@Column(name = "version", nullable = false, updatable = false)
	private int version;

	@Column(name = "development_weight", nullable = false, precision = 5, scale = 4)
	private BigDecimal developmentWeight;

	@Column(name = "task_weight", nullable = false, precision = 5, scale = 4)
	private BigDecimal taskWeight;

	@Column(name = "collaboration_weight", nullable = false, precision = 5, scale = 4)
	private BigDecimal collaborationWeight;

	/**
	 * JSON with two objects. {@code METRIC_WEIGHTS}: the share of the whole
	 * indicator each {@link EvidenceType} carries; the metrics of a category add
	 * up to that category's weight. {@code PULL_REQUEST_STATE_MULTIPLIERS}: how
	 * much a pull request counts in each {@link PullRequestState}.
	 */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "metric_weights", nullable = false)
	private String metricWeights;

	@Setter
	@Column(name = "active", nullable = false)
	private boolean active;

	@Column(name = "note", length = 500)
	private String note;

	@Column(name = "created_by")
	private UUID createdBy;

	public ScoringConfig(int version, BigDecimal developmentWeight, BigDecimal taskWeight,
			BigDecimal collaborationWeight, String metricWeights, String note, UUID createdBy) {
		this.version = version;
		this.developmentWeight = developmentWeight;
		this.taskWeight = taskWeight;
		this.collaborationWeight = collaborationWeight;
		this.metricWeights = metricWeights;
		this.note = note;
		this.createdBy = createdBy;
	}

	public BigDecimal weightOf(ContributionCategory category) {
		return switch (category) {
			case DEVELOPMENT -> developmentWeight;
			case TASK_COMPLETION -> taskWeight;
			case COLLABORATION -> collaborationWeight;
		};
	}

}
