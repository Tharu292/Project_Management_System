package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** OWNER ONLY. The 1-5 value for one week. Teammates only ever see the rolling {@link WellbeingSummary}. */
@Entity
@Table(name = "c4_wb_score")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class WellbeingScore extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "reflection_id", nullable = false, updatable = false)
	private Reflection reflection;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "prediction_id", nullable = false, updatable = false)
	private EmotionPrediction prediction;

	@Column(name = "mapping_version", nullable = false, updatable = false)
	private int mappingVersion;

	@Column(name = "score", nullable = false, updatable = false, precision = 3, scale = 2)
	private BigDecimal score;

	WellbeingScore(Reflection reflection, EmotionPrediction prediction, int mappingVersion, BigDecimal score) {
		this.reflection = reflection;
		this.prediction = prediction;
		this.mappingVersion = mappingVersion;
		this.score = score;
	}

}
