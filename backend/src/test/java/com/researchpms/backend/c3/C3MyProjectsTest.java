package com.researchpms.backend.c3;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.shared.project.ProjectRole;
import org.junit.jupiter.api.Test;

class C3MyProjectsTest extends C3TestSupport {

	private static final String URL = "/api/v1/c3/me/projects";

	@Test
	void listsOnlyTheCallersProjectsWithTheirRoles() throws Exception {
		getAs(student, URL).andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].projectId").value(project.getId().toString()))
			.andExpect(jsonPath("$[0].roles", containsInAnyOrder("STUDENT")));
		getAs(outsider, URL).andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].projectId").value(otherProject.getId().toString()));
	}

	@Test
	void severalRolesInOneProjectAreGrouped() throws Exception {
		join(supervisor, otherProject, ProjectRole.EVALUATOR);
		join(supervisor, project, ProjectRole.EVALUATOR);
		getAs(supervisor, URL).andExpect(jsonPath("$", hasSize(2)));
		getAs(supervisor, URL).andExpect(
				jsonPath("$[?(@.projectId == '" + project.getId() + "')].roles[*]", containsInAnyOrder("SUPERVISOR", "EVALUATOR")));
	}

	@Test
	void requiresSignIn() throws Exception {
		expectUnauthorized(getAs(null, URL));
	}

}
