package com.researchpms.backend.shared.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.admin.AdminBootstrap;
import com.researchpms.backend.shared.admin.BootstrapAdminProperties;
import com.researchpms.backend.shared.security.PasswordPolicy;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * BCrypt hashes at most 72 bytes of a password. Every place that accepts a
 * password refuses a longer one with a 400, measured in UTF-8 bytes rather
 * than characters, and never with a 500. Every credential here is fake.
 */
class PasswordLengthTest extends AuthApiTestSupport {

	private static final String TOO_LONG = PasswordPolicy.TOO_LONG_MESSAGE;

	/** 72 ASCII characters = 72 bytes: the longest password allowed. */
	private static final String ASCII_AT_LIMIT = "Passw0rd" + "a".repeat(64);

	/** 73 ASCII characters = 73 bytes. */
	private static final String ASCII_OVER_LIMIT = ASCII_AT_LIMIT + "a";

	/** 40 characters but 72 bytes: each "é" is two bytes. */
	private static final String MULTIBYTE_AT_LIMIT = "Passw0rd" + "é".repeat(32);

	/** Only 41 characters, well under any character limit, but 73 bytes. */
	private static final String MULTIBYTE_OVER_LIMIT = MULTIBYTE_AT_LIMIT + "a";

	/** 19 characters but 76 bytes: each emoji is four bytes (and two Java chars). */
	private static final String EMOJI_OVER_LIMIT = "Passw0rd" + "🔒".repeat(17);

	private static final String[] OVER_LIMIT = { ASCII_OVER_LIMIT, MULTIBYTE_OVER_LIMIT, EMOJI_OVER_LIMIT };

	private static final String[] AT_LIMIT = { ASCII_AT_LIMIT, MULTIBYTE_AT_LIMIT };

	private ResultActions postAs(String token, String url, String json) throws Exception {
		return mockMvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private static String registrationJson(String id, String password) {
		return """
				{"firstName": "New", "lastName": "Student", "email": "it%s@my.sliit.lk", "registrationNumber": "IT%s",
				 "password": "%s", "confirmPassword": "%s"}
				""".formatted(id, id, password, password);
	}

	private static void expectTooLong(ResultActions result, String field) throws Exception {
		result.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.status").value(400))
			.andExpect(jsonPath("$.fieldErrors." + field).value(TOO_LONG))
			.andExpect(content().string(not(containsString("Exception"))))
			.andExpect(content().string(not(containsString("Passw0rd"))));
	}

	@Test
	void theSamplesAreTheSizesTheyClaimToBe() {
		assertThat(ASCII_AT_LIMIT.getBytes(StandardCharsets.UTF_8)).hasSize(72);
		assertThat(ASCII_OVER_LIMIT.getBytes(StandardCharsets.UTF_8)).hasSize(73);
		assertThat(MULTIBYTE_AT_LIMIT.getBytes(StandardCharsets.UTF_8)).hasSize(72);
		assertThat(MULTIBYTE_AT_LIMIT).hasSize(40);
		assertThat(MULTIBYTE_OVER_LIMIT.getBytes(StandardCharsets.UTF_8)).hasSize(73);
		assertThat(MULTIBYTE_OVER_LIMIT).hasSize(41);
		assertThat(EMOJI_OVER_LIMIT.getBytes(StandardCharsets.UTF_8)).hasSize(76);

		for (String password : AT_LIMIT) {
			assertThat(PasswordPolicy.fitsHashLimit(password)).isTrue();
			assertThat(PasswordPolicy.isAcceptable(password)).isTrue();
		}
		for (String password : OVER_LIMIT) {
			assertThat(PasswordPolicy.fitsHashLimit(password)).isFalse();
			assertThat(PasswordPolicy.isAcceptable(password)).isFalse();
		}
	}

	@Test
	void registrationRefusesAnOverlongPassword() throws Exception {
		for (String password : OVER_LIMIT) {
			String id = SharedTestData.unique();
			expectTooLong(postJson("/api/v1/auth/register/student", registrationJson(id, password)), "password");
			assertThat(userRepository.existsByEmail("it" + id + "@my.sliit.lk")).isFalse();
		}
	}

	@Test
	void passwordOfExactlyTheLimitCanRegisterAndLogIn() throws Exception {
		for (String password : AT_LIMIT) {
			String id = SharedTestData.unique();
			String email = "it" + id + "@my.sliit.lk";
			postJson("/api/v1/auth/register/student", registrationJson(id, password)).andExpect(status().isCreated());

			login(email, password).andExpect(status().isOk());
			// One byte shorter is a different password, not a truncated match.
			login(email, password.substring(0, password.length() - 1)).andExpect(status().isUnauthorized());
		}
	}

	@Test
	void loginRefusesAnOverlongPasswordBeforeLookingAtAnyAccount() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		for (String password : OVER_LIMIT) {
			expectTooLong(login(student.getEmail(), password), "password");
			expectTooLong(login("nobody." + SharedTestData.unique() + "@my.sliit.lk", password), "password");
		}
		login(student.getEmail(), PASSWORD).andExpect(status().isOk());
	}

	@Test
	void loginDoesNotAcceptAnOverlongPasswordThatStartsWithTheRealOne() throws Exception {
		String id = SharedTestData.unique();
		String email = "it" + id + "@my.sliit.lk";
		postJson("/api/v1/auth/register/student", registrationJson(id, ASCII_AT_LIMIT)).andExpect(status().isCreated());

		// BCrypt alone would ignore everything after byte 72 and call this a match.
		expectTooLong(login(email, ASCII_AT_LIMIT + "anything"), "password");
	}

	@Test
	void changePasswordRefusesAnOverlongCurrentOrNewPassword() throws Exception {
		User student = saveWithPassword(SharedTestData.student());
		String token = accessTokenFor(student);
		String url = "/api/v1/auth/change-password";

		for (String password : OVER_LIMIT) {
			expectTooLong(postAs(token, url, """
					{"currentPassword": "%s", "newPassword": "An0therPassw0rd", "confirmPassword": "An0therPassw0rd"}
					""".formatted(password)), "currentPassword");
			expectTooLong(postAs(token, url, """
					{"currentPassword": "%s", "newPassword": "%s", "confirmPassword": "%s"}
					""".formatted(PASSWORD, password, password)), "newPassword");
		}

		User saved = userRepository.findById(student.getId()).orElseThrow();
		assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isTrue();
		assertThat(saved.getSecurityVersion()).isZero();
	}

	@Test
	void changePasswordAcceptsANewPasswordOfExactlyTheLimit() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		postAs(accessTokenFor(student), "/api/v1/auth/change-password", """
				{"currentPassword": "%s", "newPassword": "%s", "confirmPassword": "%s"}
				""".formatted(PASSWORD, MULTIBYTE_AT_LIMIT, MULTIBYTE_AT_LIMIT)).andExpect(status().isNoContent());

		login(student.getEmail(), MULTIBYTE_AT_LIMIT).andExpect(status().isOk());
	}

	@Test
	void staffCreationRefusesAnOverlongPassword() throws Exception {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		String adminToken = accessTokenFor(saveWithPassword(admin));

		for (String password : OVER_LIMIT) {
			String id = SharedTestData.unique();
			expectTooLong(postAs(adminToken, "/api/v1/admin/users/staff", """
					{"firstName": "New", "lastName": "Lecturer", "email": "new.%s@sliit.lk", "staffId": "STF-%s",
					 "password": "%s", "confirmPassword": "%s"}
					""".formatted(id, id, password, password)), "password");
			assertThat(userRepository.existsByEmail("new." + id + "@sliit.lk")).isFalse();
		}
	}

	@Test
	void bootstrapRefusesAnOverlongPassword() {
		for (String password : OVER_LIMIT) {
			String email = "admin." + SharedTestData.unique() + "@sliit.lk";
			BootstrapAdminProperties properties = new BootstrapAdminProperties(email, password, "System",
					"Administrator", null);

			assertThat(new AdminBootstrap(properties, userRepository, passwordEncoder).provision())
				.isEqualTo(AdminBootstrap.Outcome.INVALID_CONFIGURATION);
			assertThat(userRepository.existsByEmail(email)).isFalse();
		}
	}

}
