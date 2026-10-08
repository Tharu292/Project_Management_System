package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.user.User;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Team progress through the real endpoint. No task management component is
 * connected, so the truthful answer for everyone allowed to ask is "unavailable".
 */
class C4ProgressApiTest extends C4TestSupport {

	private ResultActions progress(User caller, Project project) throws Exception {
		return as(caller, get("/api/v1/c4/projects/" + project.getId() + "/progress"));
	}

	@Test
	void membersAndAssignedStaffAreToldThatTaskDataIsNotConnected() throws Exception {
		for (User allowed : new User[] { studentA, studentB, supervisor, coSupervisor, evaluator }) {
			String body = body(progress(allowed, group1).andExpect(status().isOk()));

			Map<String, Object> response = JsonPath.read(body, "$");
			assertThat(response.keySet()).containsExactlyInAnyOrder("available", "unavailableReason", "overall",
					"members");
			assertThat(response).containsEntry("available", false)
				.containsEntry("unavailableReason", "TASKS_NOT_CONNECTED")
				.containsEntry("overall", null);
			// No figure of any kind stands in for the missing data.
			progress(allowed, group1).andExpect(jsonPath("$.members").isEmpty());
			assertThat(body).doesNotContain("\"assigned\"").doesNotContain("\"completed\"");
		}
	}

	@Test
	void progressFollowsTheSameAccessRulesAsContribution() throws Exception {
		// The supervisor of group 1 evaluates group 2, so may see both.
		progress(supervisor, group2).andExpect(status().isOk());
		for (User refused : new User[] { studentC, admin, adminWithStrayMembership, removedStudent }) {
			progress(refused, group1).andExpect(status().isForbidden());
		}
		for (User notAssigned : new User[] { studentA, coSupervisor, evaluator }) {
			progress(notAssigned, group2).andExpect(status().isForbidden());
		}
		as(studentA, get("/api/v1/c4/projects/" + UUID.randomUUID() + "/progress")).andExpect(status().isForbidden());
		progress(flaggedStudent, group1).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.message").value("You must change your password before continuing."));
		progress(null, group1).andExpect(status().isUnauthorized());
	}

	@Test
	void progressIsReadOnly() throws Exception {
		as(supervisor, post("/api/v1/c4/projects/" + group1.getId() + "/progress"))
			.andExpect(status().isMethodNotAllowed());
	}

}
