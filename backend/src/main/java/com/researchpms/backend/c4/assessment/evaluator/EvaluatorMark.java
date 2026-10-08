package com.researchpms.backend.c4.assessment.evaluator;

import com.researchpms.backend.c4.assessment.AssessmentConfigEntry;
import com.researchpms.backend.c4.assessment.AssessmentMark;
import com.researchpms.backend.c4.assessment.AssessmentSide;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * EVALUATOR SIDE. A record written by an evaluator assigned to the project.
 * Package-private so that no code outside this package, and in particular
 * nothing on the supervisor side, can read one.
 */
@Entity
@Table(name = "c4_assessment_evaluator_mark")
class EvaluatorMark extends AssessmentMark {

	protected EvaluatorMark() {
	}

	EvaluatorMark(UUID projectId, UUID studentId, AssessmentConfigEntry configEntry, UUID assessorId) {
		super(AssessmentSide.EVALUATOR, projectId, studentId, configEntry, assessorId);
	}

}
