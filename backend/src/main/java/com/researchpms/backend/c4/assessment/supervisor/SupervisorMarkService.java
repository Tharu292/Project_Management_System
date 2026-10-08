package com.researchpms.backend.c4.assessment.supervisor;

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
 * SUPERVISOR SIDE of marking. Open to the supervisors and co-supervisors of
 * the project, each of whom sees and edits only the records they wrote
 * themselves. Whether a supervisor and a co-supervisor may see each other's
 * records is an open policy decision; until it is made, they may not.
 * Evaluators, students and administrators are refused. This class cannot
 * reach evaluator-side records at all.
 */
@Service
public class SupervisorMarkService {

	private final C4AccessService access;

	private final SupervisorMarkRepository markRepository;

	SupervisorMarkService(C4AccessService access, SupervisorMarkRepository markRepository) {
		this.access = access;
		this.markRepository = markRepository;
	}

	@Transactional(readOnly = true)
	public List<SupervisorMarkResponse> myRecords(UUID projectId) {
		UUID assessor = requireSupervisorSide(projectId);
		return markRepository.findByProjectIdAndAssessorIdOrderByCreatedAtAsc(projectId, assessor)
			.stream()
			.map(SupervisorMarkResponse::from)
			.toList();
	}

	@Transactional(readOnly = true)
	public SupervisorMarkResponse myRecord(UUID projectId, UUID markId) {
		return SupervisorMarkResponse.from(findOwn(projectId, markId, requireSupervisorSide(projectId)));
	}

	/** Changes the assessor's own draft. A submitted record is locked. */
	@Transactional
	public SupervisorMarkResponse updateMyDraft(UUID projectId, UUID markId, BigDecimal markPercent,
			String feedback) {
		SupervisorMark mark = findOwn(projectId, markId, requireSupervisorSide(projectId));
		if (!mark.isDraft()) {
			throw new OperationNotAllowedException("Submitted marks are locked and cannot be changed.");
		}
		if (!AssessmentMark.isValidPercent(markPercent)) {
			throw new InvalidRequestException("markPercent", "A mark is a percentage between 0 and 100.");
		}
		mark.updateDraft(markPercent, feedback);
		return SupervisorMarkResponse.from(markRepository.saveAndFlush(mark));
	}

	/** The supervisor-side marks released to the signed-in student. Unreleased records are never returned. */
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

	/** Returns the assessor's id. Someone who also evaluates this project is refused. */
	private UUID requireSupervisorSide(UUID projectId) {
		C4Caller caller = access.caller(projectId);
		if (!caller.isSupervising() || caller.hasAssessmentConflict()) {
			throw C4AccessService.denied();
		}
		return caller.userId();
	}

	/** Another assessor's record is answered as "not found", exactly like one that does not exist. */
	private SupervisorMark findOwn(UUID projectId, UUID markId, UUID assessorId) {
		return markRepository.findByIdAndProjectIdAndAssessorId(markId, projectId, assessorId)
			.orElseThrow(() -> new ResourceNotFoundException("Assessment record not found."));
	}

}
