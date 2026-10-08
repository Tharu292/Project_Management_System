package com.researchpms.backend.c4.assessment;

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

/**
 * One assessed item of a marking structure, and the side that marks it. Its
 * weight stays empty until the official value is known; nothing here supplies one.
 */
@Entity
@Table(name = "c4_assessment_config_entry")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AssessmentConfigEntry extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "config_id", nullable = false, updatable = false)
	private AssessmentConfig config;

	@Column(name = "code", nullable = false, updatable = false, length = 50)
	private String code;

	@Column(name = "name", nullable = false, length = 150)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(name = "side", nullable = false, updatable = false, length = 20)
	private AssessmentSide side;

	@Column(name = "weight_percent", precision = 5, scale = 2)
	private BigDecimal weightPercent;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	public AssessmentConfigEntry(AssessmentConfig config, String code, String name, AssessmentSide side,
			BigDecimal weightPercent, int displayOrder) {
		this.config = config;
		this.code = code;
		this.name = name;
		this.side = side;
		this.weightPercent = weightPercent;
		this.displayOrder = displayOrder;
	}

}
