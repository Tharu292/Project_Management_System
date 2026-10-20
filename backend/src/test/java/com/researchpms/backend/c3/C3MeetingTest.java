package com.researchpms.backend.c3;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Module 2: the supervision team schedules meetings, records minutes once, and reads the history. */
class C3MeetingTest extends C3TestSupport {

	private String meetingsUrl() {
		return "/api/v1/c3/projects/" + project.getId() + "/meetings";
	}

	private static String meeting(String title, Instant at) {
		return """
				{"title": "%s", "scheduledAt": "%s", "durationMinutes": 30,
				 "location": "https://meet.example/abc", "agenda": "Progress review"}
				""".formatted(title, at);
	}

	@Test
	void scheduleRecordMinutesAndReadHistoryNewestFirst() throws Exception {
		Instant lastWeek = Instant.now().minus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
		Instant nextWeek = Instant.now().plus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
		String past = idOf(postAs(student, meetingsUrl(), meeting("Kick-off", lastWeek)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.minutes").doesNotExist()));
		postAs(supervisor, meetingsUrl(), meeting("Progress review", nextWeek)).andExpect(status().isCreated());

		putAs(supervisor, "/api/v1/c3/meetings/" + past + "/minutes", """
				{"minutes": "Agreed on the dataset and the evaluation plan."}
				""").andExpect(status().isOk())
			.andExpect(jsonPath("$.minutes").value("Agreed on the dataset and the evaluation plan."))
			.andExpect(jsonPath("$.minutesRecordedBy.id").value(supervisor.getId().toString()));

		getAs(coSupervisor, meetingsUrl()).andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].title").value("Progress review"))
			.andExpect(jsonPath("$[1].minutes").value("Agreed on the dataset and the evaluation plan."));
	}

	@Test
	void minutesAreRecordedOnceAndOnlyAfterTheMeetingStarts() throws Exception {
		String future = idOf(postAs(student, meetingsUrl(), meeting("Later", Instant.now().plus(1, ChronoUnit.DAYS))));
		expectFieldError(putAs(student, "/api/v1/c3/meetings/" + future + "/minutes", "{\"minutes\": \"too early\"}"),
				"minutes");

		String past = idOf(postAs(student, meetingsUrl(), meeting("Earlier", Instant.now().minus(1, ChronoUnit.HOURS))));
		putAs(student, "/api/v1/c3/meetings/" + past + "/minutes", "{\"minutes\": \"first\"}").andExpect(status().isOk());
		putAs(supervisor, "/api/v1/c3/meetings/" + past + "/minutes", "{\"minutes\": \"second\"}")
			.andExpect(status().isConflict());
	}

	@Test
	void evaluatorsAndOutsidersHaveNoAccess() throws Exception {
		String past = idOf(postAs(student, meetingsUrl(), meeting("Earlier", Instant.now().minus(1, ChronoUnit.HOURS))));
		for (var user : new com.researchpms.backend.shared.user.User[] { evaluator, outsider }) {
			expectForbidden(getAs(user, meetingsUrl()));
			expectForbidden(postAs(user, meetingsUrl(), meeting("x", Instant.now())));
			expectForbidden(putAs(user, "/api/v1/c3/meetings/" + past + "/minutes", "{\"minutes\": \"m\"}"));
		}
		expectUnauthorized(getAs(null, meetingsUrl()));
	}

	@Test
	void validatesInput() throws Exception {
		expectFieldError(postAs(student, meetingsUrl(), "{\"title\": \"t\"}"), "scheduledAt");
		expectFieldError(postAs(student, meetingsUrl(), """
				{"title": " ", "scheduledAt": "2026-10-01T10:00:00Z"}
				"""), "title");
		expectFieldError(postAs(student, meetingsUrl(), """
				{"title": "t", "scheduledAt": "2026-10-01T10:00:00Z", "durationMinutes": 0}
				"""), "durationMinutes");
		putAs(student, "/api/v1/c3/meetings/" + UUID.randomUUID() + "/minutes", "{\"minutes\": \"m\"}")
			.andExpect(status().isNotFound());
	}

}
