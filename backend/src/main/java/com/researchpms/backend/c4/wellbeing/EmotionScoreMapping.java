package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Configuration, not student data: the 1-5 value one emotion label maps to in
 * one version of the mapping, and why. No mapping exists until one is approved.
 */
@Entity
@Table(name = "c4_emotion_score_mapping")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class EmotionScoreMapping extends BaseEntity {

	@Column(name = "mapping_version", nullable = false, updatable = false)
	private int mappingVersion;

	@Column(name = "label_scheme", nullable = false, updatable = false, length = 30)
	private String labelScheme;

	@Column(name = "emotion_label", nullable = false, updatable = false, length = 50)
	private String emotionLabel;

	@Column(name = "score", nullable = false, updatable = false)
	private int score;

	@Column(name = "rationale", nullable = false, updatable = false, length = 500)
	private String rationale;

	EmotionScoreMapping(int mappingVersion, String labelScheme, String emotionLabel, int score, String rationale) {
		this.mappingVersion = mappingVersion;
		this.labelScheme = labelScheme;
		this.emotionLabel = emotionLabel;
		this.score = score;
		this.rationale = rationale;
	}

}
