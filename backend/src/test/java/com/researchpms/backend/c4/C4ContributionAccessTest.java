package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.c4.wellbeing.WellbeingStatus;
import com.researchpms.backend.c4.wellbeing.WellbeingTrend;
import com.researchpms.backend.shared.user.User;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Progress and contribution: visible inside the group and to its assigned staff, and to nobody else. */
class C4ContributionAccessTest extends C4TestSupport {

	private static final String CHANGE_REQUIRED = "You must change your password before continuing.";

	@Test
	void sameGroupStudentsSeeOneAnothersContribution() throws Exception {
		snapshot(group1, studentB, "63.33");

		String body = body(getAs(studentA, g(group1) + "/contribution").andExpect(status().isOk()));

		List<String> ids = JsonPath.read(body, "$[*].studentId");
		assertThat(ids).contains(studentA.getId().toString(), studentB.getId().toString())
			.doesNotContain(studentC.getId().toString(), removedStudent.getId().toString());
		List<Number> indicator = JsonPath.read(body, "$[?(@.studentId == '" + studentB.getId() + "')].indicator");
		assertThat(indicator.get(0).doubleValue()).isEqualTo(63.33);
		List<Boolean> partial = JsonPath.read(body, "$[?(@.studentId == '" + studentB.getId() + "')].partial");
		assertThat(partial).containsExactly(true);
		// A teammate with nothing calculated yet is listed, without a score rather than with a zero.
		List<Object> own = JsonPath.read(body, "$[?(@.studentId == '" + studentA.getId() + "')].indicator");
		assertThat(own).containsExactly((Object) null);

		getAs(studentA, g(group1) + "/students/" + studentB.getId() + "/contribution").andExpect(status().isOk())
			.andExpect(jsonPath("$[0].studentId").value(studentB.getId().toString()))
			.andExpect(jsonPath("$[0].developmentScore").value(70.00))
			.andExpect(jsonPath("$[0].taskScore").isEmpty())
			.andExpect(jsonPath("$[0].collaborationScore").value(50.00));
	}

	@Test
	void studentCannotSeeAnotherGroupsContribution() throws Exception {
		snapshot(group2, studentC, "88.25");

		getAs(studentA, g(group2) + "/contribution").andExpect(status().isForbidden());
		getAs(studentA, g(group2) + "/students/" + studentC.getId() + "/contribution")
			.andExpect(status().isForbidden());
		// Naming a student of another group through one's own group does not work either.
		String viaOwnGroup = body(getAs(studentA, g(group1) + "/students/" + studentC.getId() + "/contribution")
			.andExpect(status().isNotFound()));
		assertThat(viaOwnGroup).doesNotContain("88.25");
		getAs(studentA, "/projects/" + UUID.randomUUID() + "/contribution").andExpect(status().isForbidden());
	}

	@Test
	void assignedStaffSeeTheirGroupsOnly() throws Exception {
		snapshot(group1, studentB, "63.33");
		snapshot(group2, studentC, "88.25");

		for (User staff : new User[] { supervisor, coSupervisor, evaluator, secondEvaluator }) {
			getAs(staff, g(group1) + "/contribution").andExpect(status().isOk());
			getAs(staff, g(group1) + "/students/" + studentB.getId() + "/contribution").andExpect(status().isOk());
		}
		// Supervising group 1 and evaluating group 2 are two separate, allowed assignments.
		getAs(supervisor, g(group2) + "/contribution").andExpect(status().isOk());
		for (User notAssigned : new User[] { coSupervisor, evaluator, secondEvaluator }) {
			getAs(notAssigned, g(group2) + "/contribution").andExpect(status().isForbidden());
			getAs(notAssigned, g(group2) + "/students/" + studentC.getId() + "/contribution")
				.andExpect(status().isForbidden());
		}
	}

	@Test
	void administratorsRemovedMembersAndSignedOutVisitorsSeeNothing() throws Exception {
		snapshot(group1, studentB, "63.33");
		String[] paths = { g(group1) + "/contribution", g(group1) + "/students/" + studentB.getId() + "/contribution",
				g(group1) + "/students/" + studentB.getId() + "/evidence" };

		for (String path : paths) {
			for (User refused : new User[] { admin, adminWithStrayMembership, removedStudent, studentC }) {
				assertThat(body(getAs(refused, path).andExpect(status().isForbidden()))).doesNotContain("63.33");
			}
			getAs(flaggedStudent, path).andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value(CHANGE_REQUIRED));
			getAs(null, path).andExpect(status().isUnauthorized());
		}
	}

	@Test
	void itemisedEvidenceIsForAssignedStaffAndTheStudentItIsAbout() throws Exception {
		String evidenceOfB = g(group1) + "/students/" + studentB.getId() + "/evidence";

		for (User allowed : new User[] { studentB, supervisor, coSupervisor, evaluator }) {
			getAs(allowed, evidenceOfB).andExpect(status().isOk());
		}
		getAs(studentA, evidenceOfB).andExpect(status().isForbidden());
		getAs(supervisor, g(group1) + "/students/" + studentC.getId() + "/evidence").andExpect(status().isNotFound());
		getAs(supervisor, g(group1) + "/students/" + supervisor.getId() + "/evidence")
			.andExpect(status().isNotFound());
	}

	@Test
	void onlySupervisorsAndCoSupervisorsMayStartAnEvidenceCollection() throws Exception {
		postAs(supervisor, g(group1) + "/evidence/sync").andExpect(status().isOk());
		postAs(coSupervisor, g(group1) + "/evidence/sync").andExpect(status().isOk());

		for (User refused : new User[] { evaluator, studentA, admin, adminWithStrayMembership, removedStudent }) {
			postAs(refused, g(group1) + "/evidence/sync").andExpect(status().isForbidden());
		}
		// Evaluating a group does not make someone its supervisor.
		postAs(supervisor, g(group2) + "/evidence/sync").andExpect(status().isForbidden());
	}

	@Test
	void contributionResponsesNeverCarryWellbeingOrMarks() throws Exception {
		snapshot(group1, studentB, "63.33");
		UUID reflection = wellbeing.reflection(studentB.getId(), group1.getId(), 40, "PRIVATE-TEXT");
		wellbeing.predictionAndScore(reflection, "PRIVATE-EMOTION", "2.00");
		wellbeing.recommendation(studentB.getId(), group1.getId(), "PRIVATE-RECOMMENDATION");
		wellbeing.warning(studentB.getId(), group1.getId(), "PRIVATE-WARNING");
		wellbeing.optIn(studentB.getId(), group1.getId());
		wellbeing.summary(studentB.getId(), group1.getId(), WellbeingStatus.COULD_BE_BETTER, "2.00",
				WellbeingTrend.DECLINING);
		supervisorMarks.submitted(group1.getId(), studentB.getId(), supervisorEntry, supervisor.getId(), "71.00",
				"PRIVATE-FEEDBACK");

		for (User caller : new User[] { studentA, studentB, supervisor, coSupervisor, evaluator }) {
			for (String path : new String[] { g(group1) + "/contribution",
					g(group1) + "/students/" + studentB.getId() + "/contribution" }) {
				String body = body(getAs(caller, path).andExpect(status().isOk()));

				assertThat(body).doesNotContain("PRIVATE-")
					.doesNotContain("COULD_BE_BETTER")
					.doesNotContain("DECLINING")
					.doesNotContain("71.0");
				List<Map<String, Object>> rows = JsonPath.read(body, "$[*]");
				for (Map<String, Object> row : rows) {
					assertThat(row.keySet()).containsExactlyInAnyOrder("studentId", "available", "indicator",
							"developmentScore", "taskScore", "collaborationScore", "partial", "periodStart",
							"periodEnd");
				}
			}
		}
	}

	@Test
	void aContributionIndicatorNeverCreatesAnAssessmentRecord() throws Exception {
		long supervisorBefore = supervisorMarks.count();
		long evaluatorBefore = evaluatorMarks.count();

		snapshot(group1, studentA, "40.00");
		snapshot(group1, studentB, "95.00");
		getAs(supervisor, g(group1) + "/contribution").andExpect(status().isOk());
		getAs(evaluator, g(group1) + "/students/" + studentB.getId() + "/contribution").andExpect(status().isOk());

		assertThat(supervisorMarks.count()).isEqualTo(supervisorBefore);
		assertThat(evaluatorMarks.count()).isEqualTo(evaluatorBefore);
		getAs(supervisor, g(group1) + "/assessment/supervisor/marks").andExpect(status().isOk())
			.andExpect(jsonPath("$").isEmpty());
		getAs(evaluator, g(group1) + "/assessment/evaluator/marks").andExpect(status().isOk())
			.andExpect(jsonPath("$").isEmpty());
		getAs(studentB, mine(group1) + "/assessment").andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

}
