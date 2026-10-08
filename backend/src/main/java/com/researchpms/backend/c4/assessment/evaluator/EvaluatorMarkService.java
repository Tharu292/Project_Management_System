package com.researchpms.backend.c4.assessment.evaluator;

import com.researchpms.backend.c4.access.C4AccessService;
import com.researchpms.backend.c4.access.C4Caller;
import com.researchpms.backend.c4.assessment.AssessmentMark;
import com.researchpms.backend.c4.assessment.ReleasedMarkResponse;
import com.researchpms.backend.shared.common.InvalidRequestException;
import com.researchpms.backend.shared.common.OperationNotAllowedException;
import com.researchpms.backend.shared.common.ResourceNotFoundException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * EVALUATOR SIDE of marking. Open to the evaluators assigned to the project,
 * each of whom sees and edits only the records they wrote themselves.
 * Supervisors, co-supervisors, students and administrators are refused. This
 * class cannot reach supervisor-side records at all.
 */
@Service
public class EvaluatorMarkService {

	private final C4AccessService access;

	private final EvaluatorMarkRepository markRepository;

	EvaluatorMarkService(C4AccessService access, EvaluatorMarkRepository markRepository) {
		this.access = access;
		this.markRepository = markRepository;
	}

	@Transactional(readOnly = true)
	public List<EvaluatorMarkResponse> myRecords(UUID projectId) {
		UUID assessor = requireEvaluatorSide(projectId);
		return markRepository.findByProjectIdAndAssessorIdOrderByCreatedAtAsc(projectId, assessor)
			.stream()
			.map(EvaluatorMarkResponse::from)
			.toList();
	}

	@Transactional(readOnly = true)
	public EvaluatorMarkResponse myRecord(UUID projectId, UUID markId) {
		return EvaluatorMarkResponse.from(findOwn(projectId, markId, requireEvaluatorSide(projectId)));
	}

	/** Changes the assessor's own draft. A submitted record is locked. */
	@Transactional
	public EvaluatorMarkResponse updateMyDraft(UUID projectId, UUID markId, BigDecimal markPercent, String feedback) {
		EvaluatorMark mark = findOwn(projectId, markId, requireEvaluatorSide(projectId));
		if (!mark.isDraft()) {
			throw new OperationNotAllowedException("Submitted marks are locked and cannot be changed.");
		}
		if (!AssessmentMark.isValidPercent(markPercent)) {
			throw new InvalidRequestException("markPercent", "A mark is a percentage between 0 and 100.");
		}
		mark.updateDraft(markPercent, feedback);
		return EvaluatorMarkResponse.from(markRepository.saveAndFlush(mark));
	}

	/** The evaluator-side marks released to the signed-in student. Unreleased records are never returned. */
	@Transactional(readOnly = true)
	public List<ReleasedMarkResponse> releasedForCurrentStudent(UUID projectId) {
		C4Caller caller = access.caller(projectId);
		if (!caller.isStudentMember()) {
			throw C4AccessService.denied();
		}
		return markRepository
			.findByProjectIdAndStudentIdAndReleasedAtIsNotNullOrderByReleasedAtAsc(projectId, caller.userId())
			.stream()
			.map(ReleasedMarkResponse::from)
			.toList();
	}

	/** Returns the assessor's id. Someone who also supervises or co-supervises this project is refused. */
	private UUID requireEvaluatorSide(UUID projectId) {
		C4Caller caller = access.caller(projectId);
		if (!caller.isEvaluator() || caller.hasAssessmentConflict()) {
			throw C4AccessService.denied();
		}
		return caller.userId();
	}

	/** Another assessor's record is answered as "not found", exactly like one that does not exist. */
	private EvaluatorMark findOwn(UUID projectId, UUID markId, UUID assessorId) {
		return markRepository.findByIdAndProjectIdAndAssessorId(markId, projectId, assessorId)
			.orElseThrow(() -> new ResourceNotFoundException("Assessment record not found."));
	}

}
