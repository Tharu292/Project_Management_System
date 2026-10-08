package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.c4.wellbeing.WellbeingStatus;
import com.researchpms.backend.c4.wellbeing.WellbeingTrend;
import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.user.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Contribution through the real, read-only endpoints: visible inside the group
 * and to its assigned staff, and to nobody else. Every snapshot here is made
 * up for the test; nothing in the application calculates one yet.
 */
class C4ContributionAccessTest extends C4TestSupport {

	private static final String CHANGE_REQUIRED = "You must change your password before continuing.";

	private static final String REAL = "/api/v1/c4/projects/";

	private ResultActions group(User caller, Project project) throws Exception {
		return as(caller, get(REAL + project.getId() + "/contribution"));
	}

	private ResultActions student(User caller, Project project, UUID studentId) throws Exception {
		return as(caller, get(REAL + project.getId() + "/students/" + studentId + "/contribution"));
	}

	private static Map<String, Object> member(String body, User student) {
		List<Map<String, Object>> members = JsonPath.read(body,
				"$.members[?(@.studentId == '" + student.getId() + "')]");
		assertThat(members).as("one entry per student").hasSize(1);
		return members.get(0);
	}

	// ---- what the group sees ----

	@Test
	void sameGroupStudentsSeeOneAnothersIndicatorCategoriesAndAggregateCounts() throws Exception {
		snapshot(group1, studentB, "63.33");

		String body = body(group(studentA, group1).andExpect(status().isOk()));

		List<String> ids = JsonPath.read(body, "$.members[*].studentId");
		assertThat(ids).contains(studentA.getId().toString(), studentB.getId().toString())
			.doesNotContain(studentC.getId().toString(), removedStudent.getId().toString());
		Map<String, Object> teammate = member(body, studentB);
		assertThat(teammate).containsEntry("calculated", true)
			.containsEntry("displayName", studentB.getFirstName() + " " + studentB.getLastName());
		String ofB = "$.members[?(@.studentId == '" + studentB.getId() + "')].snapshot";
		assertThat(JsonPath.<List<Number>>read(body, ofB + ".indicator").get(0).doubleValue()).isEqualTo(63.33);
		assertThat(JsonPath.<List<Number>>read(body, ofB + ".developmentScore").get(0).doubleValue()).isEqualTo(70.0);
		assertThat(JsonPath.<List<Object>>read(body, ofB + ".taskScore")).containsExactly((Object) null);
		assertThat(JsonPath.<List<Number>>read(body, ofB + ".metrics.COMMIT.count")).containsExactly(7);
		assertThat(JsonPath.<List<Number>>read(body, ofB + ".pullRequestStates.MERGED")).containsExactly(2);
		assertThat(JsonPath.<List<Number>>read(body, ofB + ".pullRequestStates.OPEN")).containsExactly(1);
	}

	@Test
	void aStudentWithNothingCalculatedIsListedWithoutAnyNumber() throws Exception {
		snapshot(group1, studentB, "63.33");

		Map<String, Object> own = member(body(group(studentA, group1).andExpect(status().isOk())), studentA);

		assertThat(own).containsEntry("calculated", false).containsEntry("snapshot", null);
		assertThat(own.keySet()).containsExactlyInAnyOrder("studentId", "displayName", "calculated", "snapshot");
	}

	@Test
	void theWeightsAndMultipliersComeFromTheStoredConfiguration() throws Exception {
		group(studentA, group1).andExpect(status().isOk())
			.andExpect(jsonPath("$.scoringConfig.version").value(1))
			.andExpect(jsonPath("$.scoringConfig.categoryWeights.DEVELOPMENT").value(0.4))
			.andExpect(jsonPath("$.scoringConfig.categoryWeights.TASK_COMPLETION").value(0.4))
			.andExpect(jsonPath("$.scoringConfig.categoryWeights.COLLABORATION").value(0.2))
			.andExpect(jsonPath("$.scoringConfig.metricWeights.COMMIT").value(0.30))
			.andExpect(jsonPath("$.scoringConfig.metricWeights.PULL_REQUEST").value(0.10))
			.andExpect(jsonPath("$.scoringConfig.metricWeights.COMPLETED_TASK").value(0.40))
			.andExpect(jsonPath("$.scoringConfig.metricWeights.ISSUE_COMMENT").value(0.10))
			.andExpect(jsonPath("$.scoringConfig.metricWeights.PULL_REQUEST_REVIEW").value(0.10))
			.andExpect(jsonPath("$.scoringConfig.pullRequestStateMultipliers.MERGED").value(1.0))
			.andExpect(jsonPath("$.scoringConfig.pullRequestStateMultipliers.OPEN").value(0.6))
			.andExpect(jsonPath("$.scoringConfig.pullRequestStateMultipliers.CLOSED_UNMERGED").value(0.3))
			.andExpect(jsonPath("$.scoringConfig.provisional[0]").value("PULL_REQUEST_STATE_MULTIPLIERS"));
	}

	@Test
	void aSnapshotKeepsItsVersionsPeriodTimeCoverageAndPartialStatus() throws Exception {
		snapshot(group1, studentB, "63.33");

		student(studentA, group1, studentB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.studentId").value(studentB.getId().toString()))
			.andExpect(jsonPath("$.calculated").value(true))
			.andExpect(jsonPath("$.latest.schemaVersion").value(1))
			.andExpect(jsonPath("$.latest.scoringConfigVersion").value(1))
			.andExpect(jsonPath("$.latest.periodStart").value("2026-09-01"))
			.andExpect(jsonPath("$.latest.periodEnd").value("2026-09-30"))
			.andExpect(jsonPath("$.latest.computedAt").isNotEmpty())
			.andExpect(jsonPath("$.latest.partial").value(true))
			.andExpect(jsonPath("$.latest.unavailableSources[0]").value("TASKS"))
			.andExpect(jsonPath("$.latest.coverage.GITHUB.status").value("AVAILABLE"))
			.andExpect(jsonPath("$.latest.coverage.TASKS.status").value("UNAVAILABLE"))
			.andExpect(jsonPath("$.latest.coverage.TASKS.reason").value("TASKS_NOT_CONNECTED"));
	}

	@Test
	void verifiedZeroAndUnavailableEvidenceStayDifferentInTheResponse() throws Exception {
		snapshot(group1, studentB, "63.33");

		student(supervisor, group1, studentB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.latest.metrics.ISSUE_COMMENT.state").value("VERIFIED_ZERO"))
			.andExpect(jsonPath("$.latest.metrics.ISSUE_COMMENT.count").value(0))
			.andExpect(jsonPath("$.latest.metrics.ISSUE_COMMENT.normalised").value(0))
			.andExpect(jsonPath("$.latest.metrics.COMPLETED_TASK.state").value("UNAVAILABLE"))
			.andExpect(jsonPath("$.latest.metrics.COMPLETED_TASK.count").isEmpty())
			.andExpect(jsonPath("$.latest.metrics.COMPLETED_TASK.normalised").isEmpty())
			.andExpect(jsonPath("$.latest.metrics.COMPLETED_TASK.reason").value("TASKS_NOT_CONNECTED"))
			.andExpect(jsonPath("$.latest.taskScore").isEmpty());
	}

	@Test
	void historyHoldsOnlyStoredSnapshotsNewestFirst() throws Exception {
		student(studentA, group1, studentB.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.calculated").value(false))
			.andExpect(jsonPath("$.latest").isEmpty())
			.andExpect(jsonPath("$.history").isEmpty());

		snapshot(group1, studentB, "40.00", LocalDate.of(2026, 9, 14), PARTIAL_METRICS, PARTIAL_COVERAGE, true);
		snapshot(group1, studentB, "55.00", LocalDate.of(2026, 9, 21), PARTIAL_METRICS, PARTIAL_COVERAGE, true);
		snapshot(group1, studentB, "63.33", LocalDate.of(2026, 9, 28), PARTIAL_METRICS, PARTIAL_COVERAGE, true);

		String body = body(student(studentA, group1, studentB.getId()).andExpect(status().isOk()));

		List<String> ends = JsonPath.read(body, "$.history[*].periodEnd");
		assertThat(ends).containsExactly("2026-09-28", "2026-09-21", "2026-09-14");
		// Cumulative snapshots: each starts at the project start.
		List<String> starts = JsonPath.read(body, "$.history[*].periodStart");
		assertThat(starts).containsOnly("2026-09-01");
		assertThat(JsonPath.<String>read(body, "$.latest.periodEnd")).isEqualTo("2026-09-28");
		// The group view shows the newest one.
		String ofB = "$.members[?(@.studentId == '" + studentB.getId() + "')].snapshot.periodEnd";
		assertThat(JsonPath.<List<String>>read(body(group(studentA, group1)), ofB)).containsExactly("2026-09-28");
	}

	// ---- who may see it ----

	@Test
	void studentCannotSeeAnotherGroupsContribution() throws Exception {
		snapshot(group2, studentC, "88.25");

		group(studentA, group2).andExpect(status().isForbidden());
		student(studentA, group2, studentC.getId()).andExpect(status().isForbidden());
		// Naming a student of another group through one's own group does not work either.
		String viaOwnGroup = body(student(studentA, group1, studentC.getId()).andExpect(status().isNotFound()));
		assertThat(viaOwnGroup).doesNotContain("88.25").doesNotContain("displayName").doesNotContain("snapshot");
		as(studentA, get(REAL + UUID.randomUUID() + "/contribution")).andExpect(status().isForbidden());
		as(studentA, get(REAL + "not-a-uuid/contribution")).andExpect(status().isBadRequest());
	}

	@Test
	void assignedStaffSeeTheirGroupsOnly() throws Exception {
		snapshot(group1, studentB, "63.33");
		snapshot(group2, studentC, "88.25");

		for (User staff : new User[] { supervisor, coSupervisor, evaluator, secondEvaluator }) {
			group(staff, group1).andExpect(status().isOk());
			student(staff, group1, studentB.getId()).andExpect(status().isOk());
		}
		// Supervising group 1 and evaluating group 2 are two separate, allowed assignments.
		group(supervisor, group2).andExpect(status().isOk());
		for (User notAssigned : new User[] { coSupervisor, evaluator, secondEvaluator }) {
			group(notAssigned, group2).andExpect(status().isForbidden());
			student(notAssigned, group2, studentC.getId()).andExpect(status().isForbidden());
		}
		// A staff member is not a student of the group, so cannot be named as one.
		student(supervisor, group1, supervisor.getId()).andExpect(status().isNotFound());
	}

	@Test
	void administratorsRemovedMembersAndSignedOutVisitorsSeeNothing() throws Exception {
		snapshot(group1, studentB, "63.33");

		for (User refused : new User[] { admin, adminWithStrayMembership, removedStudent, studentC }) {
			assertThat(body(group(refused, group1).andExpect(status().isForbidden()))).doesNotContain("63.33")
				.doesNotContain(studentB.getLastName());
			student(refused, group1, studentB.getId()).andExpect(status().isForbidden());
		}
		group(flaggedStudent, group1).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.message").value(CHANGE_REQUIRED));
		group(null, group1).andExpect(status().isUnauthorized());
		student(null, group1, studentB.getId()).andExpect(status().isUnauthorized());
	}

	@Test
	void theEndpointsAreReadOnly() throws Exception {
		long before = snapshotRepository.count();
		String groupUrl = REAL + group1.getId() + "/contribution";
		String studentUrl = REAL + group1.getId() + "/students/" + studentB.getId() + "/contribution";

		for (String url : new String[] { groupUrl, studentUrl }) {
			as(supervisor, post(url)).andExpect(status().isMethodNotAllowed());
			as(supervisor, put(url)).andExpect(status().isMethodNotAllowed());
			as(supervisor, delete(url)).andExpect(status().isMethodNotAllowed());
		}
		group(supervisor, group1).andExpect(status().isOk());
		student(supervisor, group1, studentB.getId()).andExpect(status().isOk());

		// Reading never calculates or stores a snapshot.
		assertThat(snapshotRepository.count()).isEqualTo(before);
	}

	// ---- what never appears ----

	@Test
	void theDisplayNameIsTheOnlyPersonalDetail() throws Exception {
		snapshot(group1, studentB, "63.33");

		for (User caller : new User[] { studentA, supervisor, evaluator }) {
			for (String body : new String[] { body(group(caller, group1).andExpect(status().isOk())),
					body(student(caller, group1, studentB.getId()).andExpect(status().isOk())) }) {
				for (User person : new User[] { studentA, studentB, flaggedStudent }) {
					assertThat(body).doesNotContain(person.getEmail())
						.doesNotContain(person.getRegistrationNumber())
						.doesNotContain("@");
				}
				assertThat(body).doesNotContainIgnoringCase("email")
					.doesNotContainIgnoringCase("registrationNumber")
					.doesNotContainIgnoringCase("accountType")
					.doesNotContainIgnoringCase("password");
			}
		}
	}

	@Test
	void responsesCarryExactlyTheDocumentedFields() throws Exception {
		snapshot(group1, studentB, "63.33");

		String groupBody = body(group(studentA, group1).andExpect(status().isOk()));
		assertThat(JsonPath.<Map<String, Object>>read(groupBody, "$").keySet())
			.containsExactlyInAnyOrder("scoringConfig", "members");
		assertThat(JsonPath.<Map<String, Object>>read(groupBody, "$.scoringConfig").keySet()).containsExactlyInAnyOrder(
				"version", "categoryWeights", "metricWeights", "pullRequestStateMultipliers", "provisional");
		List<Map<String, Object>> snapshots = JsonPath.read(groupBody,
				"$.members[?(@.studentId == '" + studentB.getId() + "')].snapshot");
		assertThat(snapshots.get(0).keySet()).containsExactlyInAnyOrder("schemaVersion", "scoringConfigVersion",
				"periodStart", "periodEnd", "computedAt", "indicator", "developmentScore", "taskScore",
				"collaborationScore", "partial", "metrics", "pullRequestStates", "coverage", "unavailableSources");

		String studentBody = body(student(studentA, group1, studentB.getId()).andExpect(status().isOk()));
		assertThat(JsonPath.<Map<String, Object>>read(studentBody, "$").keySet()).containsExactlyInAnyOrder(
				"scoringConfig", "studentId", "displayName", "calculated", "latest", "history");
		assertThat(JsonPath.<Map<String, Object>>read(studentBody, "$.latest.metrics.COMMIT").keySet())
			.containsExactlyInAnyOrder("state", "count", "normalised", "reason");
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
		supervisorMarks.submitted(group1.getId(), studentB.getId(), supervisorEntry, supervisor.getId(), "71.37",
				"PRIVATE-FEEDBACK");

		for (User caller : new User[] { studentA, studentB, supervisor, coSupervisor, evaluator }) {
			for (String body : new String[] { body(group(caller, group1).andExpect(status().isOk())),
					body(student(caller, group1, studentB.getId()).andExpect(status().isOk())) }) {
				assertThat(body).doesNotContain("PRIVATE-")
					.doesNotContain("COULD_BE_BETTER")
					.doesNotContain("DECLINING")
					.doesNotContain("71.37")
					.doesNotContainIgnoringCase("wellbeing")
					.doesNotContainIgnoringCase("reflection")
					.doesNotContainIgnoringCase("emotion")
					.doesNotContainIgnoringCase("markPercent")
					.doesNotContainIgnoringCase("feedback")
					.doesNotContainIgnoringCase("grade");
			}
		}
	}

	@Test
	void aContributionIndicatorNeverCreatesAnAssessmentRecord() throws Exception {
		long supervisorBefore = supervisorMarks.count();
		long evaluatorBefore = evaluatorMarks.count();

		snapshot(group1, studentA, "40.00");
		snapshot(group1, studentB, "95.00");
		group(supervisor, group1).andExpect(status().isOk());
		student(evaluator, group1, studentB.getId()).andExpect(status().isOk());

		assertThat(supervisorMarks.count()).isEqualTo(supervisorBefore);
		assertThat(evaluatorMarks.count()).isEqualTo(evaluatorBefore);
		getAs(supervisor, g(group1) + "/assessment/supervisor/marks").andExpect(status().isOk())
			.andExpect(jsonPath("$").isEmpty());
		getAs(evaluator, g(group1) + "/assessment/evaluator/marks").andExpect(status().isOk())
			.andExpect(jsonPath("$").isEmpty());
		getAs(studentB, mine(group1) + "/assessment").andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

	// ---- stored data that cannot be read ----

	@Test
	void aMalformedStoredSnapshotGivesASafeErrorAndNoPartialData() throws Exception {
		snapshot(group1, studentA, "40.00");
		snapshot(group1, studentB, "63.33", LocalDate.of(2026, 9, 30), "{\"schemaVersion\": 1, \"metrics\": {}}",
				PARTIAL_COVERAGE, true);

		for (ResultActions result : new ResultActions[] { group(supervisor, group1),
				student(supervisor, group1, studentB.getId()) }) {
			String body = body(result.andExpect(status().isInternalServerError()));

			assertThat(JsonPath.<String>read(body, "$.message")).isEqualTo("An unexpected error occurred.");
			assertThat(body).doesNotContain("63.33")
				.doesNotContain("40.0")
				.doesNotContain("schemaVersion")
				.doesNotContain("Exception")
				.doesNotContain(studentB.getLastName());
		}
		// A student whose own snapshot is sound is unaffected when asked for on their own.
		student(supervisor, group1, studentA.getId()).andExpect(status().isOk());
	}

	@Test
	void aSnapshotInAnUnknownSchemaVersionIsNotShown() throws Exception {
		snapshot(group1, studentB, "63.33", LocalDate.of(2026, 9, 30),
				PARTIAL_METRICS.replace("\"schemaVersion\": 1", "\"schemaVersion\": 2"), PARTIAL_COVERAGE, true);

		assertThat(body(group(studentA, group1).andExpect(status().isInternalServerError()))).doesNotContain("63.33");
	}

	// ---- itemised evidence and collection: no production endpoints yet, rules proved through test-only ones ----

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

}
