package com.researchpms.backend.shared.project;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.auth.AuthApiTestSupport;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.ResultActions;

/** Project checks through the real filter chain: login, bearer token, then a guarded endpoint. */
class ProjectAccessHttpTest extends AuthApiTestSupport {

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ProjectMemberRepository memberRepository;

	private User student;

	private User lecturer;

	private User outsider;

	private Project project;

	@BeforeEach
	void setUp() {
		student = saveWithPassword(SharedTestData.student());
		lecturer = saveWithPassword(SharedTestData.staff());
		outsider = saveWithPassword(SharedTestData.student());
		project = projectRepository.saveAndFlush(SharedTestData.project());
		memberRepository.saveAndFlush(new ProjectMember(student, project, ProjectRole.STUDENT));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.SUPERVISOR));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.EVALUATOR));
	}

	private ResultActions getAs(User user, String endpoint, UUID projectId) throws Exception {
		return mockMvc.perform(get("/api/test/projects/" + projectId + "/" + endpoint)
			.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessTokenFor(user)));
	}

	private static void expectForbidden(ResultActions result) throws Exception {
		result.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.message").value("You do not have permission to do this."))
			.andExpect(content().string(not(containsString("Exception"))));
	}

	@Test
	void guardedEndpointWithoutTokenIsUnauthorized() throws Exception {
		mockMvc.perform(get("/api/test/projects/" + project.getId() + "/member"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.status").value(401));
	}

	@Test
	void memberIsAllowedAndSeesOnlyTheirOwnRoles() throws Exception {
		getAs(student, "member", project.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$", containsInAnyOrder("STUDENT")));
		getAs(lecturer, "member", project.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$", containsInAnyOrder("SUPERVISOR", "EVALUATOR")));
	}

	@Test
	void nonMemberIsForbidden() throws Exception {
		expectForbidden(getAs(outsider, "member", project.getId()));
	}

	@Test
	void unknownProjectIsForbiddenLikeANonMemberProject() throws Exception {
		expectForbidden(getAs(student, "member", UUID.randomUUID()));
	}

	@Test
	void memberWithoutTheRequiredRoleIsForbidden() throws Exception {
		expectForbidden(getAs(student, "supervision", project.getId()));
		getAs(lecturer, "supervision", project.getId()).andExpect(status().isOk());
	}

	@Test
	void removedMemberLosesAccessImmediately() throws Exception {
		getAs(student, "member", project.getId()).andExpect(status().isOk());

		ProjectMember membership = memberRepository
			.findByUserIdAndProjectIdAndProjectRole(student.getId(), project.getId(), ProjectRole.STUDENT)
			.orElseThrow();
		membership.setActive(false);
		memberRepository.saveAndFlush(membership);

		expectForbidden(getAs(student, "member", project.getId()));
	}

	@Test
	void adminIsOnlyLetInWhereTheEndpointAllowsAdmins() throws Exception {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		saveWithPassword(admin);

		expectForbidden(getAs(admin, "member", project.getId()));
		expectForbidden(getAs(admin, "supervision", project.getId()));
		getAs(admin, "member-or-admin", project.getId()).andExpect(status().isOk());
		expectForbidden(getAs(outsider, "member-or-admin", project.getId()));
	}

}
