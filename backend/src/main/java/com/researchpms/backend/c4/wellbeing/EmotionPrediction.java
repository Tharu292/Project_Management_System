package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** OWNER ONLY. What one version of the model said about one reflection. */
@Entity
@Table(name = "c4_wb_emotion_prediction")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class EmotionPrediction extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "reflection_id", nullable = false, updatable = false)
	private Reflection reflection;

	@Column(name = "model_version", nullable = false, updatable = false, length = 50)
	private String modelVersion;

	/** Which set of labels the model was trained on. */
	@Column(name = "label_scheme", nullable = false, updatable = false, length = 30)
	private String labelScheme;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 20)
	private PredictionStatus status = PredictionStatus.PENDING;

	@Column(name = "predicted_label", length = 50)
	private String predictedLabel;

	/** JSON: the model's decision score per label. These are not probabilities. */
	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "decision_scores")
	private String decisionScores;

	/** The gap between the two highest decision scores. */
	@Column(name = "margin", precision = 8, scale = 4)
	private BigDecimal margin;

	EmotionPrediction(Reflection reflection, String modelVersion, String labelScheme) {
		this.reflection = reflection;
		this.modelVersion = modelVersion;
		this.labelScheme = labelScheme;
	}

	void complete(String predictedLabel, String decisionScores, BigDecimal margin) {
		this.status = PredictionStatus.DONE;
		this.predictedLabel = predictedLabel;
		this.decisionScores = decisionScores;
		this.margin = margin;
	}

	void fail() {
		this.status = PredictionStatus.FAILED;
	}

}
