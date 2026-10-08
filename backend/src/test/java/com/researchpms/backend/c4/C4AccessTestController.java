package com.researchpms.backend.c4;

import com.researchpms.backend.c4.assessment.ReleasedMarkResponse;
import com.researchpms.backend.c4.assessment.evaluator.EvaluatorMarkResponse;
import com.researchpms.backend.c4.assessment.evaluator.EvaluatorMarkService;
import com.researchpms.backend.c4.assessment.released.StudentAssessmentService;
import com.researchpms.backend.c4.assessment.supervisor.SupervisorMarkResponse;
import com.researchpms.backend.c4.assessment.supervisor.SupervisorMarkService;
import com.researchpms.backend.c4.contribution.ContributionAccessService;
import com.researchpms.backend.c4.wellbeing.GroupWellbeingSummaryService;
import com.researchpms.backend.c4.wellbeing.PrivateWellbeingService;
import com.researchpms.backend.c4.wellbeing.dto.GroupWellbeingSummaryResponse;
import com.researchpms.backend.c4.wellbeing.dto.MyRecommendationResponse;
import com.researchpms.backend.c4.wellbeing.dto.MyReflectionResponse;
import com.researchpms.backend.c4.wellbeing.dto.MyWarningResponse;
import com.researchpms.backend.c4.wellbeing.dto.MyWeeklyWellbeingResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only endpoints that call the Component 4 services exactly as real
 * controllers will, so the authorization rules can be proved over HTTP before
 * any feature exists. Lives under src/test, so it is never part of the real
 * application.
 */
@RestController
@RequestMapping("/api/test/c4")
class C4AccessTestController {

	record MarkEdit(BigDecimal markPercent, String feedback) {
	}

	private final ContributionAccessService contributionAccess;

	private final GroupWellbeingSummaryService groupWellbeing;

	private final PrivateWellbeingService privateWellbeing;

	private final SupervisorMarkService supervisorMarks;

	private final EvaluatorMarkService evaluatorMarks;

	private final StudentAssessmentService studentAssessment;

	C4AccessTestController(ContributionAccessService contributionAccess,
			GroupWellbeingSummaryService groupWellbeing, PrivateWellbeingService privateWellbeing,
			SupervisorMarkService supervisorMarks, EvaluatorMarkService evaluatorMarks,
			StudentAssessmentService studentAssessment) {
		this.contributionAccess = contributionAccess;
		this.groupWellbeing = groupWellbeing;
		this.privateWellbeing = privateWellbeing;
		this.supervisorMarks = supervisorMarks;
		this.evaluatorMarks = evaluatorMarks;
		this.studentAssessment = studentAssessment;
	}

	// ---- contribution: the views have real endpoints now; these two have none yet ----

	@GetMapping("/projects/{projectId}/students/{studentId}/evidence")
	String evidence(@PathVariable UUID projectId, @PathVariable UUID studentId) {
		contributionAccess.requireEvidenceDetail(projectId, studentId);
		return "ok";
	}

	@PostMapping("/projects/{projectId}/evidence/sync")
	String sync(@PathVariable UUID projectId) {
		contributionAccess.requireSyncPermission(projectId);
		return "ok";
	}

	// ---- wellbeing ----

	@GetMapping("/projects/{projectId}/wellbeing-summary")
	List<GroupWellbeingSummaryResponse> wellbeingSummary(@PathVariable UUID projectId) {
		return groupWellbeing.groupSummary(projectId);
	}

	@GetMapping("/me/projects/{projectId}/reflections")
	List<MyReflectionResponse> myReflections(@PathVariable UUID projectId) {
		return privateWellbeing.myReflections(projectId);
	}

	@GetMapping("/me/projects/{projectId}/reflections/{reflectionId}")
	MyReflectionResponse myReflection(@PathVariable UUID projectId, @PathVariable UUID reflectionId) {
		return privateWellbeing.myReflection(projectId, reflectionId);
	}

	@GetMapping("/me/projects/{projectId}/wellbeing")
	List<MyWeeklyWellbeingResponse> myWellbeing(@PathVariable UUID projectId) {
		return privateWellbeing.myWeeklyWellbeing(projectId);
	}

	@GetMapping("/me/projects/{projectId}/recommendations")
	List<MyRecommendationResponse> myRecommendations(@PathVariable UUID projectId) {
		return privateWellbeing.myRecommendations(projectId);
	}

	@GetMapping("/me/projects/{projectId}/warnings")
	List<MyWarningResponse> myWarnings(@PathVariable UUID projectId) {
		return privateWellbeing.myWarnings(projectId);
	}

	// ---- assessment ----

	@GetMapping("/projects/{projectId}/assessment/supervisor/marks")
	List<SupervisorMarkResponse> supervisorMarks(@PathVariable UUID projectId) {
		return supervisorMarks.myRecords(projectId);
	}

	@GetMapping("/projects/{projectId}/assessment/supervisor/marks/{markId}")
	SupervisorMarkResponse supervisorMark(@PathVariable UUID projectId, @PathVariable UUID markId) {
		return supervisorMarks.myRecord(projectId, markId);
	}

	@PutMapping("/projects/{projectId}/assessment/supervisor/marks/{markId}")
	SupervisorMarkResponse editSupervisorMark(@PathVariable UUID projectId, @PathVariable UUID markId,
			@RequestBody MarkEdit edit) {
		return supervisorMarks.updateMyDraft(projectId, markId, edit.markPercent(), edit.feedback());
	}

	@GetMapping("/projects/{projectId}/assessment/evaluator/marks")
	List<EvaluatorMarkResponse> evaluatorMarks(@PathVariable UUID projectId) {
		return evaluatorMarks.myRecords(projectId);
	}

	@GetMapping("/projects/{projectId}/assessment/evaluator/marks/{markId}")
	EvaluatorMarkResponse evaluatorMark(@PathVariable UUID projectId, @PathVariable UUID markId) {
		return evaluatorMarks.myRecord(projectId, markId);
	}

	@PutMapping("/projects/{projectId}/assessment/evaluator/marks/{markId}")
	EvaluatorMarkResponse editEvaluatorMark(@PathVariable UUID projectId, @PathVariable UUID markId,
			@RequestBody MarkEdit edit) {
		return evaluatorMarks.updateMyDraft(projectId, markId, edit.markPercent(), edit.feedback());
	}

	@GetMapping("/me/projects/{projectId}/assessment")
	List<ReleasedMarkResponse> myReleasedMarks(@PathVariable UUID projectId) {
		return studentAssessment.myReleasedMarks(projectId);
	}

}
