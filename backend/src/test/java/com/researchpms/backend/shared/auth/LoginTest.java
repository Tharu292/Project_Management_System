package com.researchpms.backend.shared.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

/** No request here carries a token, which also proves login is public. */
class LoginTest extends AuthApiTestSupport {

	private static final String GENERIC_FAILURE = "Invalid email or password.";

	private static void expectGenericFailure(ResultActions result) throws Exception {
		result.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.status").value(401))
			.andExpect(jsonPath("$.message").value(GENERIC_FAILURE))
			.andExpect(jsonPath("$.accessToken").doesNotExist());
	}

	@Test
	void validStudentLoginReturnsATokenAndTheUser() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		login(student.getEmail(), PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andExpect(jsonPath("$.tokenType").value("Bearer"))
			.andExpect(jsonPath("$.expiresIn").value(3600))
			.andExpect(jsonPath("$.user.id").value(student.getId().toString()))
			.andExpect(jsonPath("$.user.email").value(student.getEmail()))
			.andExpect(jsonPath("$.user.accountType").value("STUDENT"))
			.andExpect(jsonPath("$.user.systemRole").value("USER"))
			.andExpect(jsonPath("$.user.mustChangePassword").value(false))
			.andExpect(jsonPath("$.user.securityVersion").doesNotExist())
			.andExpect(jsonPath("$.user.passwordHash").doesNotExist())
			.andExpect(content().string(not(containsString(student.getPasswordHash()))))
			.andExpect(content().string(not(containsString(PASSWORD))));
	}

	@Test
	void wrongPasswordFailsGenerically() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		expectGenericFailure(login(student.getEmail(), PASSWORD + "x"));
	}

	@Test
	void unknownEmailFailsExactlyLikeAWrongPassword() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		expectGenericFailure(login("it" + SharedTestData.unique() + "@my.sliit.lk", PASSWORD));

		String unknown = login("nobody." + SharedTestData.unique() + "@my.sliit.lk", PASSWORD).andReturn()
			.getResponse()
			.getContentAsString();
		String wrongPassword = login(student.getEmail(), "Wr0ngPassword").andReturn()
			.getResponse()
			.getContentAsString();
		assertThat(withoutTimestamp(unknown)).isEqualTo(withoutTimestamp(wrongPassword));
	}

	@Test
	void disabledUserCannotLogIn() throws Exception {
		User student = SharedTestData.student();
		student.setEnabled(false);
		saveWithPassword(student);

		expectGenericFailure(login(student.getEmail(), PASSWORD));
	}

	@Test
	void emailIsNormalisedBeforeLookup() throws Exception {
		User student = saveWithPassword(SharedTestData.student());

		login("  " + student.getEmail().toUpperCase() + " ", PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.id").value(student.getId().toString()));
	}

	@Test
	void staffAndAdminUseTheSameLoginEndpoint() throws Exception {
		User staff = saveWithPassword(SharedTestData.staff());
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		saveWithPassword(admin);

		login(staff.getEmail(), PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.accountType").value("STAFF"))
			.andExpect(jsonPath("$.user.systemRole").value("USER"));
		login(admin.getEmail(), PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.systemRole").value("ADMIN"));
	}

	@Test
	void blankCredentialsAreAnInvalidRequest() throws Exception {
		login("", "").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.email").exists())
			.andExpect(jsonPath("$.fieldErrors.password").exists());
	}

	private static String withoutTimestamp(String json) {
		return json.replaceAll("\"timestamp\":\"[^\"]*\"", "");
	}

}
