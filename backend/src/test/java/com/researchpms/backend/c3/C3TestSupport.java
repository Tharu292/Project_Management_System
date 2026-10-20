package com.researchpms.backend.c3;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.auth.AuthApiTestSupport;
import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectMember;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.project.ProjectRepository;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.user.User;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * One project with a member for every role, plus an outsider, all with real,
 * signed-in accounts. Requests go through the real security filter chain.
 */
public abstract class C3TestSupport extends AuthApiTestSupport {

	@Autowired
	protected ProjectRepository projectRepository;

	@Autowired
	protected ProjectMemberRepository memberRepository;

	protected Project project;

	protected Project otherProject;

	protected User student;

	protected User secondStudent;

	protected User supervisor;

	protected User coSupervisor;

	protected User evaluator;

	protected User outsider;

	private final Map<UUID, String> tokens = new HashMap<>();

	@BeforeEach
	void setUpProject() {
		student = saveWithPassword(SharedTestData.student());
		secondStudent = saveWithPassword(SharedTestData.student());
		supervisor = saveWithPassword(SharedTestData.staff());
		coSupervisor = saveWithPassword(SharedTestData.staff());
		evaluator = saveWithPassword(SharedTestData.staff());
		outsider = saveWithPassword(SharedTestData.student());
		project = projectRepository.saveAndFlush(SharedTestData.project());
		otherProject = projectRepository.saveAndFlush(SharedTestData.project());
		join(student, project, ProjectRole.STUDENT);
		join(secondStudent, project, ProjectRole.STUDENT);
		join(supervisor, project, ProjectRole.SUPERVISOR);
		join(coSupervisor, project, ProjectRole.CO_SUPERVISOR);
		join(evaluator, project, ProjectRole.EVALUATOR);
		join(outsider, otherProject, ProjectRole.STUDENT);
	}

	protected void join(User user, Project target, ProjectRole role) {
		memberRepository.saveAndFlush(new ProjectMember(user, target, role));
	}

	private String token(User user) throws Exception {
		String token = tokens.get(user.getId());
		if (token == null) {
			token = accessTokenFor(user);
			tokens.put(user.getId(), token);
		}
		return token;
	}

	private ResultActions as(User user, MockHttpServletRequestBuilder request) throws Exception {
		if (user != null) {
			request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(user));
		}
		return mockMvc.perform(request);
	}

	protected ResultActions getAs(User user, String url) throws Exception {
		return as(user, get(url));
	}

	/** GET with one query parameter, passed as a real parameter rather than written into the URL. */
	protected ResultActions getAs(User user, String url, String param, String value) throws Exception {
		return as(user, get(url).param(param, value));
	}

	protected ResultActions postAs(User user, String url, String json) throws Exception {
		return as(user, post(url).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	protected ResultActions putAs(User user, String url, String json) throws Exception {
		return as(user, put(url).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	protected static String idOf(ResultActions result) throws Exception {
		return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
	}

	protected static void expectForbidden(ResultActions result) throws Exception {
		result.andExpect(status().isForbidden()).andExpect(jsonPath("$.status").value(403));
	}

	protected static void expectUnauthorized(ResultActions result) throws Exception {
		result.andExpect(status().isUnauthorized()).andExpect(jsonPath("$.status").value(401));
	}

	protected static void expectFieldError(ResultActions result, String field) throws Exception {
		result.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors." + field).exists());
	}

}
