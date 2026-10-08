package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.shared.user.User;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

/**
 * Marking: the supervisor side and the evaluator side never see each other's
 * records, each assessor works only on their own, and students see only what
 * has been released. Every mark here is made up for the test.
 */
class C4AssessmentIsolationTest extends C4TestSupport {

	private static final String EDIT = "{\"markPercent\": 55.50, \"feedback\": \"edited\"}";

	private String supervisorSide;

	private String evaluatorSide;

	private UUID supervisorDraft;

	private UUID supervisorSubmitted;

	private UUID evaluatorDraft;

	private UUID evaluatorSubmitted;

	@BeforeEach
	void giveEachSideRecords() {
		supervisorSide = g(group1) + "/assessment/supervisor/marks";
		evaluatorSide = g(group1) + "/assessment/evaluator/marks";
		supervisorDraft = supervisorMarks.draft(group1.getId(), studentA.getId(), supervisorEntry, supervisor.getId(),
				"61.37", "SUPERVISOR-DRAFT-FEEDBACK");
		supervisorSubmitted = supervisorMarks.submitted(group1.getId(), studentB.getId(), supervisorEntry,
				supervisor.getId(), "72.48", "SUPERVISOR-SUBMITTED-FEEDBACK");
		evaluatorDraft = evaluatorMarks.draft(group1.getId(), studentA.getId(), evaluatorEntry, evaluator.getId(),
				"64.19", "EVALUATOR-DRAFT-FEEDBACK");
		evaluatorSubmitted = evaluatorMarks.submitted(group1.getId(), studentB.getId(), evaluatorEntry,
				evaluator.getId(), "83.17", "EVALUATOR-SUBMITTED-FEEDBACK");
	}

	// ---- an assessor's own records ----

	@Test
	void assessorsSeeTheirOwnRecords() throws Exception {
		String supervisorBody = body(getAs(supervisor, supervisorSide).andExpect(status().isOk()));
		List<String> supervisorIds = JsonPath.read(supervisorBody, "$[*].id");
		assertThat(supervisorIds).containsExactlyInAnyOrder(supervisorDraft.toString(),
				supervisorSubmitted.toString());
		getAs(supervisor, supervisorSide + "/" + supervisorSubmitted).andExpect(status().isOk())
			.andExpect(jsonPath("$.markPercent").value(72.48))
			.andExpect(jsonPath("$.status").value("SUBMITTED"))
			.andExpect(jsonPath("$.entryCode").value("TEST-SUPERVISOR"));

		String evaluatorBody = body(getAs(evaluator, evaluatorSide).andExpect(status().isOk()));
		List<String> evaluatorIds = JsonPath.read(evaluatorBody, "$[*].id");
		assertThat(evaluatorIds).containsExactlyInAnyOrder(evaluatorDraft.toString(), evaluatorSubmitted.toString());
		getAs(evaluator, evaluatorSide + "/" + evaluatorDraft).andExpect(status().isOk())
			.andExpect(jsonPath("$.markPercent").value(64.19))
			.andExpect(jsonPath("$.status").value("DRAFT"));
	}

	// ---- the two sides ----

	@Test
	void supervisorsAndCoSupervisorsCannotRetrieveEvaluatorMarks() throws Exception {
		for (User supervising : new User[] { supervisor, coSupervisor }) {
			for (String path : new String[] { evaluatorSide, evaluatorSide + "/" + evaluatorDraft,
					evaluatorSide + "/" + evaluatorSubmitted }) {
				String body = body(getAs(supervising, path).andExpect(status().isForbidden()));
				assertThat(body).doesNotContain("EVALUATOR-").doesNotContain("83.17").doesNotContain("64.19");
			}
			putAs(supervising, evaluatorSide + "/" + evaluatorDraft, EDIT).andExpect(status().isForbidden());

			// Their own side never carries an evaluator's record either.
			String ownSide = body(getAs(supervising, supervisorSide).andExpect(status().isOk()));
			assertThat(ownSide).doesNotContain("EVALUATOR-")
				.doesNotContain(evaluatorDraft.toString())
				.doesNotContain(evaluatorSubmitted.toString());
			// An evaluator record id used on the supervisor side is simply not found.
			getAs(supervising, supervisorSide + "/" + evaluatorSubmitted).andExpect(status().isNotFound());
		}
		assertThat(evaluatorMarks.storedPercent(evaluatorDraft)).isEqualByComparingTo("64.19");
	}

	@Test
	void evaluatorsCannotRetrieveSupervisorMarks() throws Exception {
		for (User evaluating : new User[] { evaluator, secondEvaluator }) {
			for (String path : new String[] { supervisorSide, supervisorSide + "/" + supervisorDraft,
					supervisorSide + "/" + supervisorSubmitted }) {
				String body = body(getAs(evaluating, path).andExpect(status().isForbidden()));
				assertThat(body).doesNotContain("SUPERVISOR-").doesNotContain("72.48").doesNotContain("61.37");
			}
			putAs(evaluating, supervisorSide + "/" + supervisorDraft, EDIT).andExpect(status().isForbidden());

			String ownSide = body(getAs(evaluating, evaluatorSide).andExpect(status().isOk()));
			assertThat(ownSide).doesNotContain("SUPERVISOR-")
				.doesNotContain(supervisorDraft.toString())
				.doesNotContain(supervisorSubmitted.toString());
			getAs(evaluating, evaluatorSide + "/" + supervisorSubmitted).andExpect(status().isNotFound());
		}
		assertThat(supervisorMarks.storedPercent(supervisorDraft)).isEqualByComparingTo("61.37");
	}

	@Test
	void theTwoSidesAnswerWithDifferentRecordsAndNeverACombinedView() throws Exception {
		String supervisorBody = body(getAs(supervisor, supervisorSide).andExpect(status().isOk()));
		String evaluatorBody = body(getAs(evaluator, evaluatorSide).andExpect(status().isOk()));

		assertThat(supervisorBody).contains("SUPERVISOR-DRAFT-FEEDBACK").doesNotContain("EVALUATOR-");
		assertThat(evaluatorBody).contains("EVALUATOR-DRAFT-FEEDBACK").doesNotContain("SUPERVISOR-");
		for (String body : new String[] { supervisorBody, evaluatorBody }) {
			List<Map<String, Object>> records = JsonPath.read(body, "$[*]");
			for (Map<String, Object> record : records) {
				// No total, no final grade, no assessor of the other side.
				assertThat(record.keySet()).containsExactlyInAnyOrder("id", "projectId", "studentId", "entryCode",
						"entryName", "markPercent", "feedback", "status", "submittedAt", "releasedAt");
			}
		}
	}

	// ---- one assessor and another ----

	@Test
	void assessorsCannotSeeOrModifyAnotherAssessorsRecords() throws Exception {
		// Co-supervisor and supervisor: whether they share records is undecided, so they do not.
		getAs(coSupervisor, supervisorSide).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
		getAs(coSupervisor, supervisorSide + "/" + supervisorDraft).andExpect(status().isNotFound());
		putAs(coSupervisor, supervisorSide + "/" + supervisorDraft, EDIT).andExpect(status().isNotFound());

		// Two evaluators of the same group mark independently.
		getAs(secondEvaluator, evaluatorSide).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
		getAs(secondEvaluator, evaluatorSide + "/" + evaluatorDraft).andExpect(status().isNotFound());
		putAs(secondEvaluator, evaluatorSide + "/" + evaluatorDraft, EDIT).andExpect(status().isNotFound());

		assertThat(supervisorMarks.storedPercent(supervisorDraft)).isEqualByComparingTo("61.37");
		assertThat(evaluatorMarks.storedPercent(evaluatorDraft)).isEqualByComparingTo("64.19");
	}

	@Test
	void anAssessorCanEditTheirOwnDraft() throws Exception {
		putAs(supervisor, supervisorSide + "/" + supervisorDraft, EDIT).andExpect(status().isOk())
			.andExpect(jsonPath("$.markPercent").value(55.50))
			.andExpect(jsonPath("$.feedback").value("edited"))
			.andExpect(jsonPath("$.status").value("DRAFT"));
		putAs(evaluator, evaluatorSide + "/" + evaluatorDraft, EDIT).andExpect(status().isOk())
			.andExpect(jsonPath("$.markPercent").value(55.50));

		assertThat(supervisorMarks.storedPercent(supervisorDraft)).isEqualByComparingTo("55.50");
		assertThat(evaluatorMarks.storedPercent(evaluatorDraft)).isEqualByComparingTo("55.50");
	}

	@Test
	void aSubmittedRecordIsLockedEvenForItsOwnAssessor() throws Exception {
		putAs(supervisor, supervisorSide + "/" + supervisorSubmitted, EDIT).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.message").value("Submitted marks are locked and cannot be changed."));
		putAs(evaluator, evaluatorSide + "/" + evaluatorSubmitted, EDIT).andExpect(status().isForbidden());

		assertThat(supervisorMarks.storedPercent(supervisorSubmitted)).isEqualByComparingTo("72.48");
		assertThat(evaluatorMarks.storedPercent(evaluatorSubmitted)).isEqualByComparingTo("83.17");
	}

	@Test
	void aMarkOutsideZeroToOneHundredIsRejected() throws Exception {
		for (String invalid : new String[] { "100.01", "-1", "250" }) {
			putAs(supervisor, supervisorSide + "/" + supervisorDraft, "{\"markPercent\": " + invalid + "}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.markPercent").exists());
		}
		assertThat(supervisorMarks.storedPercent(supervisorDraft)).isEqualByComparingTo("61.37");
	}

	// ---- students ----

	@Test
	void studentsCannotRetrieveUnreleasedMarksOrFeedback() throws Exception {
		// Student B has a submitted but unreleased record on each side; student A has drafts.
		for (User student : new User[] { studentA, studentB }) {
			String body = body(getAs(student, mine(group1) + "/assessment").andExpect(status().isOk()));

			assertThat(body).isEqualTo("[]");
		}
	}

	@Test
	void aStudentSeesOnlyTheirOwnReleasedMarks() throws Exception {
		supervisorMarks.released(group1.getId(), studentA.getId(), supervisorEntry, coSupervisor.getId(), "66.00",
				"RELEASED-SUPERVISOR-FEEDBACK");
		evaluatorMarks.released(group1.getId(), studentA.getId(), evaluatorEntry, secondEvaluator.getId(), "77.00",
				"RELEASED-EVALUATOR-FEEDBACK");

		String body = body(getAs(studentA, mine(group1) + "/assessment").andExpect(status().isOk()));

		List<Map<String, Object>> released = JsonPath.read(body, "$[*]");
		assertThat(released).hasSize(2);
		assertThat(body).contains("RELEASED-SUPERVISOR-FEEDBACK", "RELEASED-EVALUATOR-FEEDBACK")
			.doesNotContain("DRAFT-FEEDBACK")
			.doesNotContain("SUBMITTED-FEEDBACK")
			.doesNotContain("61.37")
			.doesNotContain("64.19")
			// A released mark does not name its assessor.
			.doesNotContain(coSupervisor.getId().toString())
			.doesNotContain(secondEvaluator.getId().toString());
		for (Map<String, Object> mark : released) {
			assertThat(mark.keySet()).containsExactlyInAnyOrder("side", "entryCode", "entryName", "markPercent",
					"feedback", "releasedAt");
		}
		// A teammate sees none of it.
		assertThat(body(getAs(studentB, mine(group1) + "/assessment").andExpect(status().isOk()))).isEqualTo("[]");
	}

	@Test
	void studentsCannotUseTheAssessorEndpoints() throws Exception {
		for (User student : new User[] { studentA, studentB, studentC }) {
			for (String path : new String[] { supervisorSide, supervisorSide + "/" + supervisorSubmitted, evaluatorSide,
					evaluatorSide + "/" + evaluatorSubmitted }) {
				assertThat(body(getAs(student, path).andExpect(status().isForbidden()))).doesNotContain("FEEDBACK");
			}
			putAs(student, supervisorSide + "/" + supervisorDraft, EDIT).andExpect(status().isForbidden());
			putAs(student, evaluatorSide + "/" + evaluatorDraft, EDIT).andExpect(status().isForbidden());
		}
		assertThat(supervisorMarks.storedPercent(supervisorDraft)).isEqualByComparingTo("61.37");
	}

	// ---- everyone else ----

	@Test
	void administratorsGetNoAccessToEitherSide() throws Exception {
		for (User administrator : new User[] { admin, adminWithStrayMembership }) {
			for (String path : new String[] { supervisorSide, supervisorSide + "/" + supervisorSubmitted, evaluatorSide,
					evaluatorSide + "/" + evaluatorSubmitted, mine(group1) + "/assessment" }) {
				assertThat(body(getAs(administrator, path).andExpect(status().isForbidden())))
					.doesNotContain("FEEDBACK");
			}
			putAs(administrator, supervisorSide + "/" + supervisorDraft, EDIT).andExpect(status().isForbidden());
		}
	}

	@Test
	void someoneWronglyHoldingBothSidesInOneProjectIsRefusedBoth() throws Exception {
		UUID theirs = supervisorMarks.draft(group1.getId(), studentA.getId(), supervisorEntry, conflictedStaff.getId(),
				"50.00", "CONFLICT-FEEDBACK");

		for (String path : new String[] { supervisorSide, supervisorSide + "/" + theirs, evaluatorSide,
				evaluatorSide + "/" + evaluatorSubmitted }) {
			assertThat(body(getAs(conflictedStaff, path).andExpect(status().isForbidden()))).doesNotContain("FEEDBACK");
		}
		putAs(conflictedStaff, supervisorSide + "/" + theirs, EDIT).andExpect(status().isForbidden());
	}

	@Test
	void crossProjectAccessIsDenied() throws Exception {
		String group2Supervisor = g(group2) + "/assessment/supervisor/marks";
		String group2Evaluator = g(group2) + "/assessment/evaluator/marks";

		// Staff of group 1 only.
		for (User staff : new User[] { coSupervisor, evaluator, secondEvaluator }) {
			getAs(staff, group2Supervisor).andExpect(status().isForbidden());
			getAs(staff, group2Evaluator).andExpect(status().isForbidden());
		}
		// The supervisor of group 1 evaluates group 2: evaluator side there, and nothing more.
		getAs(supervisor, group2Evaluator).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
		getAs(supervisor, group2Supervisor).andExpect(status().isForbidden());
		// A record of group 1 cannot be fetched through group 2, even by its own assessor.
		getAs(supervisor, group2Evaluator + "/" + supervisorSubmitted).andExpect(status().isNotFound());
		getAs(evaluator, group2Evaluator + "/" + evaluatorSubmitted).andExpect(status().isForbidden());
		// A student of group 2 cannot read group 1's released marks.
		getAs(studentC, mine(group1) + "/assessment").andExpect(status().isForbidden());
	}

	@Test
	void signedOutAndFlaggedCallersAreRefused() throws Exception {
		for (String path : new String[] { supervisorSide, evaluatorSide, mine(group1) + "/assessment" }) {
			getAs(null, path).andExpect(status().isUnauthorized());
			getAs(flaggedStudent, path).andExpect(status().isForbidden());
			getAs(removedStudent, path).andExpect(status().isForbidden());
		}
	}

	@Test
	void assessmentResponsesAreNeverCached() throws Exception {
		getAs(supervisor, supervisorSide).andExpect(status().isOk())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
		getAs(evaluator, evaluatorSide).andExpect(status().isOk())
			.andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
	}

}
