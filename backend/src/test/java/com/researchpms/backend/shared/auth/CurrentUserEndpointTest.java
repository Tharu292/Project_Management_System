package com.researchpms.backend.shared.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.security.CurrentUserService;
import com.researchpms.backend.shared.security.TestTokens;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.AuthenticationException;
import org.springframework.test.web.servlet.ResultActions;

class CurrentUserEndpointTest extends AuthApiTestSupport {

	private static final String ME = "/api/v1/auth/me";

	@Value("${app.security.jwt.secret}")
	private String secret;

	@Autowired
	private CurrentUserService currentUserService;

	private ResultActions getWithToken(String url, String token) throws Exception {
		return mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private static void expectUnauthorized(ResultActions result) throws Exception {
		result.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.status").value(401))
			.andExpect(jsonPath("$.message").value("Authentication is required."))
			.andExpect(jsonPath("$.email").doesNotExist());
	}

	@Test
	void meWithoutTokenIsUnauthorized() throws Exception {
		expectUnauthorized(mockMvc.perform(get(ME)));
	}

	@Test
	void meWithValidTokenReturnsTheCurrentUser() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		getWithToken(ME, accessTokenFor(student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(student.getId().toString()))
			.andExpect(jsonPath("$.firstName").value("Test"))
			.andExpect(jsonPath("$.lastName").value("Student"))
			.andExpect(jsonPath("$.email").value(student.getEmail()))
			.andExpect(jsonPath("$.accountType").value("STUDENT"))
			.andExpect(jsonPath("$.systemRole").value("USER"))
			.andExpect(jsonPath("$.registrationNumber").value(student.getRegistrationNumber()))
			.andExpect(jsonPath("$.staffId").isEmpty())
			.andExpect(jsonPath("$.mustChangePassword").value(false));
	}

	@Test
	void meNeverExposesThePasswordHashOrProjectMemberships() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		getWithToken(ME, accessTokenFor(student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.passwordHash").doesNotExist())
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.projects").doesNotExist())
			.andExpect(jsonPath("$.securityVersion").doesNotExist())
			.andExpect(content().string(not(containsString(student.getPasswordHash()))))
			.andExpect(content().string(not(containsString("$2"))));
	}

	@Test
	void invalidTokensCannotAccessMe() throws Exception {
		User student = saveWithPassword(SharedTestData.student());
		String valid = accessTokenFor(student);

		expectUnauthorized(getWithToken(ME, "not-a-jwt"));
		expectUnauthorized(getWithToken(ME, TestTokens.expired(secret, student.getId())));
		expectUnauthorized(getWithToken(ME, TestTokens.unsigned(student.getId())));
		expectUnauthorized(getWithToken(ME, TestTokens.signed(secret, student.getId(), Instant.now().plusSeconds(600))));
		expectUnauthorized(getWithToken(ME, TestTokens.withSecurityVersion(secret, student.getId(), 1)));
		expectUnauthorized(getWithToken(ME, TestTokens.withSecurityVersion(secret, student.getId(), -1)));
		getWithToken(ME, TestTokens.withSecurityVersion(secret, student.getId(), 0)).andExpect(status().isOk());
		expectUnauthorized(getWithToken(ME, valid.substring(0, valid.length() - 4) + "AAAA"));
		expectUnauthorized(getWithToken(ME, TestTokens.withSubjectReplaced(valid, student.getId(), UUID.randomUUID())));
		expectUnauthorized(mockMvc.perform(get(ME).header(HttpHeaders.AUTHORIZATION, "Basic " + valid)));
		expectUnauthorized(mockMvc.perform(get(ME).header(HttpHeaders.AUTHORIZATION, valid)));
	}

	@Test
	void tokenStopsWorkingWhenTheUserIsDisabledOrDeleted() throws Exception {
		User student = saveWithPassword(SharedTestData.student());
		String token = accessTokenFor(student);
		getWithToken(ME, token).andExpect(status().isOk());

		student.setEnabled(false);
		userRepository.saveAndFlush(student);
		expectUnauthorized(getWithToken(ME, token));

		userRepository.delete(student);
		userRepository.flush();
		expectUnauthorized(getWithToken(ME, token));
	}

	@Test
	void otherEndpointsAreProtectedByDefault() throws Exception {
		expectUnauthorized(mockMvc.perform(get("/api/v1/anything")));
		expectUnauthorized(mockMvc.perform(get("/api/v1/auth/login")));
		expectUnauthorized(mockMvc.perform(get("/")));
	}

	@Test
	void unknownEndpointIsNotFoundOnceAuthenticated() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		getWithToken("/api/v1/anything", accessTokenFor(student)).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404));
	}

	@Test
	void everySystemRoleHasNormalAccessAndOnlyAPendingPasswordChangeRemovesIt() throws Exception {
		for (SystemRole role : SystemRole.values()) {
			User user = SharedTestData.staff();
			user.setSystemRole(role);
			saveWithPassword(user);
			// Past the security rules: an unknown URL is a 404, not a 403.
			getWithToken("/api/v1/anything", accessTokenFor(user)).andExpect(status().isNotFound());

			user.setMustChangePassword(true);
			userRepository.saveAndFlush(user);
			getWithToken("/api/v1/anything", accessTokenFor(user)).andExpect(status().isForbidden());
			getWithToken(ME, accessTokenFor(user)).andExpect(status().isOk())
				.andExpect(jsonPath("$.systemRole").value(role.name()));
		}
	}

	@Test
	void viteDevServerOriginMayCallTheApi() throws Exception {
		mockMvc
			.perform(options(ME).header(HttpHeaders.ORIGIN, "http://localhost:5173")
				.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
				.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization"))
			.andExpect(status().isOk())
			.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"));

		mockMvc
			.perform(options(ME).header(HttpHeaders.ORIGIN, "http://evil.example")
				.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
			.andExpect(status().isForbidden());
	}

	@Test
	void currentUserServiceReportsNobodyOutsideAnAuthenticatedRequest() {
		assertThat(currentUserService.isAuthenticated()).isFalse();
		assertThatThrownBy(currentUserService::getCurrentUserId).isInstanceOf(AuthenticationException.class);
		assertThatThrownBy(currentUserService::getCurrentUser).isInstanceOf(AuthenticationException.class);
	}

}
