package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.c4.wellbeing.WellbeingStatus;
import com.researchpms.backend.c4.wellbeing.WellbeingTrend;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.user.User;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

/**
 * Wellbeing: three summary values for opted-in teammates, everything else for
 * the owner alone, and nothing at all for staff, administrators or other groups.
 */
class C4WellbeingPrivacyTest extends C4TestSupport {

	private static final String[] PRIVATE_TEXT = { "PRIVATE-TEXT", "PRIVATE-EMOTION", "PRIVATE-RECOMMENDATION",
			"PRIVATE-WARNING" };

	private UUID reflectionOfB;

	/** Student B has every kind of wellbeing data, and has opted in to sharing the summary. */
	@BeforeEach
	void giveStudentBWellbeingData() {
		reflectionOfB = wellbeing.reflection(studentB.getId(), group1.getId(), 40, "PRIVATE-TEXT");
		wellbeing.predictionAndScore(reflectionOfB, "PRIVATE-EMOTION", "2.00");
		wellbeing.recommendation(studentB.getId(), group1.getId(), "PRIVATE-RECOMMENDATION");
		wellbeing.warning(studentB.getId(), group1.getId(), "PRIVATE-WARNING");
		wellbeing.optIn(studentB.getId(), group1.getId());
		wellbeing.summary(studentB.getId(), group1.getId(), WellbeingStatus.DOING_OKAY, "3.40",
				WellbeingTrend.IMPROVING);
	}

	private String[] privateEndpoints() {
		return new String[] { mine(group1) + "/reflections", mine(group1) + "/reflections/" + reflectionOfB,
				mine(group1) + "/wellbeing", mine(group1) + "/recommendations", mine(group1) + "/warnings" };
	}

	private String[] everyWellbeingEndpoint() {
		String[] privateOnes = privateEndpoints();
		String[] all = new String[privateOnes.length + 1];
		all[0] = g(group1) + "/wellbeing-summary";
		System.arraycopy(privateOnes, 0, all, 1, privateOnes.length);
		return all;
	}

	private static Map<String, Object> entryFor(String body, User student) {
		List<Map<String, Object>> entries = JsonPath.read(body, "$[?(@.studentId == '" + student.getId() + "')]");
		assertThat(entries).as("one entry per student").hasSize(1);
		return entries.get(0);
	}

	// ---- group-visible summary ----

	@Test
	void teammateSeesStatusScoreAndTrendOfAStudentWhoOptedIn() throws Exception {
		String body = body(getAs(studentA, g(group1) + "/wellbeing-summary").andExpect(status().isOk()));

		Map<String, Object> entry = entryFor(body, studentB);
		assertThat(entry).containsEntry("available", true)
			.containsEntry("status", "DOING_OKAY")
			.containsEntry("trend", "IMPROVING");
		assertThat(((Number) entry.get("score")).doubleValue()).isEqualTo(3.4);
		// The student sees their own shared summary in the same list.
		assertThat(entryFor(body(getAs(studentB, g(group1) + "/wellbeing-summary")), studentB)).containsEntry("available",
				true);
	}

	@Test
	void theGroupSummaryCarriesExactlyThreeValuesAndNothingPrivate() throws Exception {
		String body = body(getAs(studentA, g(group1) + "/wellbeing-summary").andExpect(status().isOk()));

		List<Map<String, Object>> entries = JsonPath.read(body, "$[*]");
		assertThat(entries).isNotEmpty();
		for (Map<String, Object> entry : entries) {
			assertThat(entry.keySet()).containsExactlyInAnyOrder("studentId", "available", "status", "score", "trend");
		}
		assertThat(body).doesNotContain(PRIVATE_TEXT)
			.doesNotContainIgnoringCase("week")
			.doesNotContainIgnoringCase("count")
			.doesNotContainIgnoringCase("updated")
			.doesNotContainIgnoringCase("created")
			.doesNotContain("2.00");
	}

	@Test
	void sharingIsOffByDefault() throws Exception {
		// Student A has a summary but never opted in.
		wellbeing.summary(studentA.getId(), group1.getId(), WellbeingStatus.DOING_WELL, "4.60", WellbeingTrend.STABLE);

		for (User viewer : new User[] { studentB, studentA }) {
			String body = body(getAs(viewer, g(group1) + "/wellbeing-summary").andExpect(status().isOk()));

			assertThat(entryFor(body, studentA)).containsEntry("available", false)
				.containsEntry("status", null)
				.containsEntry("score", null)
				.containsEntry("trend", null);
			assertThat(body).doesNotContain("DOING_WELL").doesNotContain("4.6");
		}
	}

	@Test
	void withdrawingStopsSharingImmediately() throws Exception {
		assertThat(entryFor(body(getAs(studentA, g(group1) + "/wellbeing-summary")), studentB)).containsEntry("available",
				true);

		wellbeing.optInThenWithdraw(studentB.getId(), group1.getId());

		String body = body(getAs(studentA, g(group1) + "/wellbeing-summary").andExpect(status().isOk()));
		assertThat(entryFor(body, studentB)).containsEntry("available", false).containsEntry("status", null);
		assertThat(body).doesNotContain("DOING_OKAY").doesNotContain("3.4").doesNotContain("IMPROVING");
	}

	@Test
	void hiddenMissingAndInsufficientHistorySummariesLookExactlyTheSame() throws Exception {
		User neverOptedIn = member(SharedTestData.student(), group1, ProjectRole.STUDENT);
		wellbeing.summary(neverOptedIn.getId(), group1.getId(), WellbeingStatus.DOING_WELL, "4.80",
				WellbeingTrend.STABLE);
		User withdrew = member(SharedTestData.student(), group1, ProjectRole.STUDENT);
		wellbeing.summary(withdrew.getId(), group1.getId(), WellbeingStatus.COULD_BE_BETTER, "1.90",
				WellbeingTrend.DECLINING);
		wellbeing.optInThenWithdraw(withdrew.getId(), group1.getId());
		User notEnoughHistory = member(SharedTestData.student(), group1, ProjectRole.STUDENT);
		wellbeing.optIn(notEnoughHistory.getId(), group1.getId());
		wellbeing.reflection(notEnoughHistory.getId(), group1.getId(), 40, "PRIVATE-TEXT");
		User neverReflected = member(SharedTestData.student(), group1, ProjectRole.STUDENT);

		String body = body(getAs(studentA, g(group1) + "/wellbeing-summary").andExpect(status().isOk()));

		Map<String, Object> reference = entryFor(body, neverReflected);
		reference.remove("studentId");
		assertThat(reference).containsEntry("available", false);
		for (User student : new User[] { neverOptedIn, withdrew, notEnoughHistory, flaggedStudent }) {
			Map<String, Object> entry = entryFor(body, student);
			entry.remove("studentId");
			assertThat(entry).as("indistinguishable from a student with no data").isEqualTo(reference);
		}
		assertThat(body).doesNotContain("4.8").doesNotContain("1.9").doesNotContain("COULD_BE_BETTER");
	}

	@Test
	void studentsOfOtherGroupsCannotSeeTheSummary() throws Exception {
		String body = body(getAs(studentC, g(group1) + "/wellbeing-summary").andExpect(status().isForbidden()));

		assertThat(body).doesNotContain("DOING_OKAY").doesNotContain(studentB.getId().toString());
		// Group 2's own summary does not list anyone from group 1.
		assertThat(body(getAs(studentC, g(group2) + "/wellbeing-summary").andExpect(status().isOk())))
			.doesNotContain(studentB.getId().toString());
	}

	// ---- owner-only data ----

	@Test
	void theOwnerSeesTheirOwnPrivateData() throws Exception {
		getAs(studentB, mine(group1) + "/reflections").andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(reflectionOfB.toString()))
			.andExpect(jsonPath("$[0].progressFeeling").value("feeling PRIVATE-TEXT"));
		getAs(studentB, mine(group1) + "/reflections/" + reflectionOfB).andExpect(status().isOk())
			.andExpect(jsonPath("$.workDone").value("work PRIVATE-TEXT"));
		getAs(studentB, mine(group1) + "/wellbeing").andExpect(status().isOk())
			.andExpect(jsonPath("$[0].predictedLabel").value("PRIVATE-EMOTION"))
			.andExpect(jsonPath("$[0].score").value(2.00))
			.andExpect(jsonPath("$[0].decisionMargin").value(0.42));
		getAs(studentB, mine(group1) + "/recommendations").andExpect(status().isOk())
			.andExpect(jsonPath("$[0].message").value("PRIVATE-RECOMMENDATION"));
		getAs(studentB, mine(group1) + "/warnings").andExpect(status().isOk())
			.andExpect(jsonPath("$[0].message").value("PRIVATE-WARNING"));
	}

	@Test
	void aTeammateCannotReachAnotherStudentsPrivateData() throws Exception {
		// Asking by the other student's record id is answered as "not found".
		String byId = body(getAs(studentA, mine(group1) + "/reflections/" + reflectionOfB)
			.andExpect(status().isNotFound()));
		assertThat(byId).doesNotContain(PRIVATE_TEXT);

		// The teammate's own lists are their own: empty, with nothing of student B's in them.
		for (String path : new String[] { mine(group1) + "/reflections", mine(group1) + "/wellbeing",
				mine(group1) + "/recommendations", mine(group1) + "/warnings" }) {
			getAs(studentA, path).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
		}
	}

	@Test
	void aStudentsOwnDataInOneGroupIsNotReachableThroughAnotherGroup() throws Exception {
		// Student B is not a member of group 2, so nothing of theirs can be read through it.
		for (String path : new String[] { mine(group2) + "/reflections", mine(group2) + "/reflections/" + reflectionOfB,
				mine(group2) + "/wellbeing", mine(group2) + "/recommendations", mine(group2) + "/warnings",
				g(group2) + "/wellbeing-summary" }) {
			getAs(studentB, path).andExpect(status().isForbidden());
		}
	}

	// ---- everyone who must see nothing ----

	@Test
	void supervisorsCoSupervisorsAndEvaluatorsCannotAccessAnyWellbeingInformation() throws Exception {
		for (User staff : new User[] { supervisor, coSupervisor, evaluator, secondEvaluator, conflictedStaff }) {
			for (String path : everyWellbeingEndpoint()) {
				String body = body(getAs(staff, path).andExpect(status().isForbidden()));

				assertThat(body).as(path)
					.doesNotContain(PRIVATE_TEXT)
					.doesNotContain("DOING_OKAY")
					.doesNotContain("IMPROVING");
			}
		}
	}

	@Test
	void administratorsCannotAccessAnyWellbeingInformation() throws Exception {
		for (User administrator : new User[] { admin, adminWithStrayMembership }) {
			for (String path : everyWellbeingEndpoint()) {
				String body = body(getAs(administrator, path).andExpect(status().isForbidden()));

				assertThat(body).as(path).doesNotContain(PRIVATE_TEXT).doesNotContain("DOING_OKAY");
			}
		}
	}

	@Test
	void otherGroupsRemovedMembersFlaggedAndSignedOutCallersAreRefusedEveryWellbeingEndpoint() throws Exception {
		for (String path : everyWellbeingEndpoint()) {
			for (User refused : new User[] { studentC, removedStudent, flaggedStudent }) {
				assertThat(body(getAs(refused, path).andExpect(status().isForbidden()))).as(path)
					.doesNotContain(PRIVATE_TEXT)
					.doesNotContain("DOING_OKAY");
			}
			getAs(null, path).andExpect(status().isUnauthorized());
		}
	}

	@Test
	void aStaffAccountHoldingAStudentMembershipIsStillRefused() throws Exception {
		// A data error: a lecturer given the STUDENT project role. It must not open wellbeing data.
		User lecturer = member(SharedTestData.staff(), group1, ProjectRole.STUDENT);

		for (String path : everyWellbeingEndpoint()) {
			getAs(lecturer, path).andExpect(status().isForbidden());
		}
		// Nor is such an account listed as a student of the group.
		assertThat(body(getAs(studentA, g(group1) + "/wellbeing-summary")))
			.doesNotContain(lecturer.getId().toString());
	}

	@Test
	void wellbeingResponsesAreNeverCached() throws Exception {
		for (String path : new String[] { g(group1) + "/wellbeing-summary", mine(group1) + "/reflections" }) {
			getAs(studentB, path).andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
		}
	}

}
