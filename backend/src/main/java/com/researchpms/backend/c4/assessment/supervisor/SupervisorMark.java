package com.researchpms.backend.c4.assessment.supervisor;

import com.researchpms.backend.c4.assessment.AssessmentConfigEntry;
import com.researchpms.backend.c4.assessment.AssessmentMark;
import com.researchpms.backend.c4.assessment.AssessmentSide;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * SUPERVISOR SIDE. A record written by a supervisor or co-supervisor of the
 * project. Package-private so that no code outside this package, and in
 * particular nothing on the evaluator side, can read one.
 */
@Entity
@Table(name = "c4_assessment_supervisor_mark")
class SupervisorMark extends AssessmentMark {

	protected SupervisorMark() {
	}

	SupervisorMark(UUID projectId, UUID studentId, AssessmentConfigEntry configEntry, UUID assessorId) {
		super(AssessmentSide.SUPERVISOR, projectId, studentId, configEntry, assessorId);
	}

}
