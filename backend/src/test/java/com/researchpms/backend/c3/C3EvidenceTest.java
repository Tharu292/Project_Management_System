package com.researchpms.backend.c3;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.c3.evidence.CollaborationEvidenceQueryService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Module 4: students record their own evidence, supervisors verify it, and nothing here is a mark. */
class C3EvidenceTest extends C3TestSupport {

	@Autowired
	private CollaborationEvidenceQueryService queryService;

	private String evidenceUrl() {
		return "/api/v1/c3/projects/" + project.getId() + "/evidence";
	}

	private String pastMeeting() throws Exception {
		return idOf(postAs(student, "/api/v1/c3/projects/" + project.getId() + "/meetings", """
				{"title": "Design review", "scheduledAt": "%s"}
				""".formatted(Instant.now().minus(2, ChronoUnit.DAYS))));
	}

	private static String evidence(String title, LocalDate on, String type, String activityId) {
		return """
				{"title": "%s", "description": "What I did", "occurredOn": "%s", "activityType": %s, "activityId": %s}
				""".formatted(title, on, type == null ? "null" : "\"" + type + "\"",
				activityId == null ? "null" : "\"" + activityId + "\"");
	}

	@Test
	void studentRecordsLinkedEvidenceAndSupervisorVerifiesIt() throws Exception {
		String meeting = pastMeeting();
		String id = idOf(postAs(student, evidenceUrl(), evidence("Presented the design", LocalDate.now(), "MEETING", meeting))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.student.id").value(student.getId().toString()))
			.andExpect(jsonPath("$.activity.type").value("MEETING"))
			.andExpect(jsonPath("$.activity.title").value("Design review"))
			.andExpect(jsonPath("$.verified").value(false)));

		postAs(coSupervisor, "/api/v1/c3/evidence/" + id + "/verify", "").andExpect(status().isOk())
			.andExpect(jsonPath("$.verified").value(true))
			.andExpect(jsonPath("$.verifiedBy.id").value(coSupervisor.getId().toString()));
		postAs(supervisor, "/api/v1/c3/evidence/" + id + "/verify", "").andExpect(status().isConflict());
	}

	@Test
	void timelineIsNewestFirstAndReadableByEveryMemberIncludingEvaluators() throws Exception {
		postAs(student, evidenceUrl(), evidence("Older", LocalDate.now().minusDays(10), null, null));
		postAs(secondStudent, evidenceUrl(), evidence("Newer", LocalDate.now(), "OTHER", null));
		for (var user : new com.researchpms.backend.shared.user.User[] { student, supervisor, evaluator }) {
			getAs(user, evidenceUrl()).andExpect(status().isOk())
				.andExpect(jsonPath("$[*].title", contains("Newer", "Older")));
		}
		// The response carries evidence and verification only: no mark, grade or score field.
		getAs(evaluator, evidenceUrl()).andExpect(jsonPath("$[0].mark").doesNotExist())
			.andExpect(jsonPath("$[0].grade").doesNotExist())
			.andExpect(jsonPath("$[0].score").doesNotExist());
	}

	@Test
	void onlyStudentsRecordAndOnlySupervisorsVerify() throws Exception {
		String body = evidence("x", LocalDate.now(), null, null);
		expectForbidden(postAs(supervisor, evidenceUrl(), body));
		expectForbidden(postAs(evaluator, evidenceUrl(), body));
		String id = idOf(postAs(student, evidenceUrl(), body));
		expectForbidden(postAs(student, "/api/v1/c3/evidence/" + id + "/verify", ""));
		expectForbidden(postAs(secondStudent, "/api/v1/c3/evidence/" + id + "/verify", ""));
		expectForbidden(postAs(evaluator, "/api/v1/c3/evidence/" + id + "/verify", ""));
	}

	@Test
	void outsidersHaveNoAccess() throws Exception {
		String id = idOf(postAs(student, evidenceUrl(), evidence("x", LocalDate.now(), null, null)));
		expectForbidden(getAs(outsider, evidenceUrl()));
		expectForbidden(postAs(outsider, evidenceUrl(), evidence("x", LocalDate.now(), null, null)));
		expectForbidden(postAs(outsider, "/api/v1/c3/evidence/" + id + "/verify", ""));
		expectUnauthorized(getAs(null, evidenceUrl()));
	}

	@Test
	void linksMustPointToAnActivityOfTheSameProject() throws Exception {
		String foreignMeeting = idOf(postAs(outsider, "/api/v1/c3/projects/" + otherProject.getId() + "/meetings", """
				{"title": "Other team", "scheduledAt": "%s"}
				""".formatted(Instant.now().minus(1, ChronoUnit.DAYS))));
		expectFieldError(postAs(student, evidenceUrl(), evidence("x", LocalDate.now(), "MEETING", foreignMeeting)),
				"activityId");
		expectFieldError(postAs(student, evidenceUrl(), evidence("x", LocalDate.now(), "MEETING", UUID.randomUUID().toString())),
				"activityId");
		expectFieldError(postAs(student, evidenceUrl(), evidence("x", LocalDate.now(), "RESOURCE", null)), "activityId");
		expectFieldError(postAs(student, evidenceUrl(), evidence("x", LocalDate.now(), "OTHER", pastMeeting())),
				"activityId");
	}

	@Test
	void validatesInput() throws Exception {
		expectFieldError(postAs(student, evidenceUrl(), "{\"title\": \"x\"}"), "occurredOn");
		expectFieldError(postAs(student, evidenceUrl(), evidence(" ", LocalDate.now(), null, null)), "title");
		expectFieldError(postAs(student, evidenceUrl(), evidence("x", LocalDate.now().plusDays(5), null, null)),
				"occurredOn");
		postAs(supervisor, "/api/v1/c3/evidence/" + UUID.randomUUID() + "/verify", "").andExpect(status().isNotFound());
	}

	@Test
	void queryServiceReturnsOnlyVerifiedEvidenceInThePeriod() throws Exception {
		String verified = idOf(postAs(student, evidenceUrl(), evidence("Verified", LocalDate.now().minusDays(3), null, null)));
		postAs(student, evidenceUrl(), evidence("Unverified", LocalDate.now().minusDays(2), null, null));
		String outside = idOf(postAs(student, evidenceUrl(), evidence("Too old", LocalDate.now().minusDays(60), null, null)));
		postAs(supervisor, "/api/v1/c3/evidence/" + verified + "/verify", "").andExpect(status().isOk());
		postAs(supervisor, "/api/v1/c3/evidence/" + outside + "/verify", "").andExpect(status().isOk());

		var records = queryService.recordsFor(project.getId(), LocalDate.now().minusDays(30), LocalDate.now());
		assertThat(records).extracting(CollaborationEvidenceQueryService.CollaborationRecord::title)
			.containsExactly("Verified");
		assertThat(records.get(0).studentId()).isEqualTo(student.getId());
		assertThat(records.get(0).externalId()).isEqualTo("c3-evidence:" + verified);
		getAs(student, evidenceUrl()).andExpect(jsonPath("$", hasSize(3)));
	}

}
