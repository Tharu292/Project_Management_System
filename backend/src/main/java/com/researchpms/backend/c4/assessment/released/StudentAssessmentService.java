package com.researchpms.backend.c4.assessment.released;

import com.researchpms.backend.c4.assessment.ReleasedMarkResponse;
import com.researchpms.backend.c4.assessment.evaluator.EvaluatorMarkService;
import com.researchpms.backend.c4.assessment.supervisor.SupervisorMarkService;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * What a student may see of their own assessment: released marks and
 * feedback, and nothing else. It adds nothing up: there is no total and no
 * final grade until the official marking structure and release policy exist.
 */
@Service
public class StudentAssessmentService {

	private final SupervisorMarkService supervisorMarks;

	private final EvaluatorMarkService evaluatorMarks;

	public StudentAssessmentService(SupervisorMarkService supervisorMarks, EvaluatorMarkService evaluatorMarks) {
		this.supervisorMarks = supervisorMarks;
		this.evaluatorMarks = evaluatorMarks;
	}

	public List<ReleasedMarkResponse> myReleasedMarks(UUID projectId) {
		List<ReleasedMarkResponse> released = new ArrayList<>(supervisorMarks.releasedForCurrentStudent(projectId));
		released.addAll(evaluatorMarks.releasedForCurrentStudent(projectId));
		return released;
	}

}
