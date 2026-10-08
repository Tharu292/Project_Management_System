package com.researchpms.backend.c4.assessment;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One version of the marking structure. None is defined in code: the stages,
 * components and percentages are entered as configuration once the official
 * structure has been approved.
 */
@Entity
@Table(name = "c4_assessment_config")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AssessmentConfig extends BaseEntity {

	@Column(name = "version", nullable = false, updatable = false)
	private int version;

	@Setter
	@Column(name = "active", nullable = false)
	private boolean active;

	@Column(name = "note", length = 500)
	private String note;

	@Column(name = "created_by")
	private UUID createdBy;

	public AssessmentConfig(int version, String note, UUID createdBy) {
		this.version = version;
		this.note = note;
		this.createdBy = createdBy;
	}

}
