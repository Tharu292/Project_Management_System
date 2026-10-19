package com.researchpms.backend.shared.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

/** No request here carries a token, which also proves registration is public. */
class StudentRegistrationTest extends AuthApiTestSupport {

	private static final String URL = "/api/v1/auth/register/student";

	@Autowired
	private ProjectMemberRepository memberRepository;

	private String id;

	private String email;

	@BeforeEach
	void uniqueStudent() {
		id = SharedTestData.unique();
		email = "it" + id + "@my.sliit.lk";
	}

	private ResultActions register(String email, String registrationNumber, String password, String confirmPassword)
			throws Exception {
		return postJson(URL, """
				{
				  "firstName": "Test",
				  "lastName": "Student",
				  "email": "%s",
				  "registrationNumber": "%s",
				  "password": "%s",
				  "confirmPassword": "%s"
				}
				""".formatted(email, registrationNumber, password, confirmPassword));
	}

	private ResultActions register(String email) throws Exception {
		return register(email, "IT" + id, PASSWORD, PASSWORD);
	}

	@Test
	void validStudentRegistrationCreatesAStudentUser() throws Exception {
		register(email).andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNotEmpty())
			.andExpect(jsonPath("$.firstName").value("Test"))
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.accountType").value("STUDENT"))
			.andExpect(jsonPath("$.systemRole").value("USER"))
			.andExpect(jsonPath("$.registrationNumber").value("IT" + id.toUpperCase()))
			.andExpect(jsonPath("$.staffId").isEmpty());

		User saved = userRepository.findByEmail(email).orElseThrow();
		assertThat(saved.getAccountType()).isEqualTo(AccountType.STUDENT);
		assertThat(saved.getSystemRole()).isEqualTo(SystemRole.USER);
		assertThat(saved.isEnabled()).isTrue();
	}

	@Test
	void emailAndRegistrationNumberAreNormalised() throws Exception {
		register("  IT" + id.toUpperCase() + "@My.SLIIT.lk ", " it" + id + " ", PASSWORD, PASSWORD)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.registrationNumber").value("IT" + id.toUpperCase()));

		User saved = userRepository.findByEmail(email).orElseThrow();
		assertThat(saved.getRegistrationNumber()).isEqualTo("IT" + id.toUpperCase());
	}

	@Test
	void passwordIsStoredOnlyAsABcryptHashAndNeverReturned() throws Exception {
		register(email).andExpect(status().isCreated())
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.passwordHash").doesNotExist())
			.andExpect(content().string(not(containsString(PASSWORD))));

		String hash = userRepository.findByEmail(email).orElseThrow().getPasswordHash();
		assertThat(hash).isNotEqualTo(PASSWORD).doesNotContain(PASSWORD).startsWith("$2");
		assertThat(passwordEncoder.matches(PASSWORD, hash)).isTrue();
	}

	@Test
	void clientCannotChooseAccountTypeSystemRoleOrEnabled() throws Exception {
		postJson(URL, """
				{
				  "firstName": "Test", "lastName": "Student", "email": "%s", "registrationNumber": "IT%s",
				  "password": "%s", "confirmPassword": "%s",
				  "accountType": "STAFF", "systemRole": "ADMIN", "enabled": false, "projectRole": "SUPERVISOR"
				}
				""".formatted(email, id, PASSWORD, PASSWORD)).andExpect(status().isCreated());

		User saved = userRepository.findByEmail(email).orElseThrow();
		assertThat(saved.getAccountType()).isEqualTo(AccountType.STUDENT);
		assertThat(saved.getSystemRole()).isEqualTo(SystemRole.USER);
		assertThat(saved.isEnabled()).isTrue();
	}

	@Test
	void registrationDoesNotCreateAProjectMembership() throws Exception {
		long before = memberRepository.count();
		register(email).andExpect(status().isCreated());

		User saved = userRepository.findByEmail(email).orElseThrow();
		assertThat(memberRepository.count()).isEqualTo(before);
		assertThat(memberRepository.findByUserIdAndActiveTrue(saved.getId())).isEmpty();
	}

	@Test
	void duplicateEmailIsRejectedWithoutDatabaseDetails() throws Exception {
		register(email).andExpect(status().isCreated());

		register(email.toUpperCase(), "IT" + SharedTestData.unique(), PASSWORD, PASSWORD)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.status").value(409))
			.andExpect(jsonPath("$.message").value("An account with this email already exists."))
			.andExpect(content().string(not(containsString("uq_users"))))
			.andExpect(content().string(not(containsString("Exception"))));
	}

	@Test
	void duplicateRegistrationNumberIsRejected() throws Exception {
		register(email).andExpect(status().isCreated());

		register("it" + SharedTestData.unique() + "@my.sliit.lk", "it" + id, PASSWORD, PASSWORD)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.message").value("An account with this registration number already exists."))
			.andExpect(content().string(not(containsString("uq_users"))));
	}

	@Test
	void emailOutsideTheStudentDomainIsRejected() throws Exception {
		for (String rejected : new String[] { "it" + id + "@gmail.com", "it" + id + "@outlook.com" }) {
			register(rejected).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.email").exists());
		}
	}

	@Test
	void staffDomainIsRejectedByStudentRegistration() throws Exception {
		register("it" + id + "@sliit.lk").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.email").exists());
	}

	@Test
	void deceptiveDomainsAreRejected() throws Exception {
		String[] deceptive = { "it" + id + "@my.sliit.lk.fake.com", "it" + id + "@fake-my.sliit.lk",
				"it" + id + "@fake.com@my.sliit.lk", "it" + id + "@mysliit.lk", "it" + id + "@my.sliit.lk.",
				"@my.sliit.lk" };
		for (String rejected : deceptive) {
			register(rejected).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.email").exists());
		}
		assertThat(userRepository.existsByRegistrationNumber("IT" + id.toUpperCase())).isFalse();
	}

	@Test
	void passwordMismatchIsRejected() throws Exception {
		register(email, "IT" + id, PASSWORD, PASSWORD + "x").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.confirmPassword").value("Passwords do not match."));
		assertThat(userRepository.existsByEmail(email)).isFalse();
	}

	@Test
	void weakPasswordsAreRejected() throws Exception {
		for (String weak : new String[] { "Ab1", "onlyletters", "1234567890" }) {
			register(email, "IT" + id, weak, weak).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.password").exists())
				.andExpect(content().string(not(containsString(weak))));
		}
	}

	@Test
	void missingFieldsAreRejected() throws Exception {
		postJson(URL, "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value("Validation failed."))
			.andExpect(jsonPath("$.fieldErrors.firstName").exists())
			.andExpect(jsonPath("$.fieldErrors.lastName").exists())
			.andExpect(jsonPath("$.fieldErrors.email").exists())
			.andExpect(jsonPath("$.fieldErrors.registrationNumber").exists())
			.andExpect(jsonPath("$.fieldErrors.password").exists());
	}

	@Test
	void malformedJsonIsRejectedWithoutParserDetails() throws Exception {
		postJson(URL, "{ not json").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value("Malformed request body."))
			.andExpect(content().string(not(containsString("jackson"))));
	}

	@Test
	void thereIsNoPublicStaffRegistration() throws Exception {
		postJson("/api/v1/auth/register/staff", "{}").andExpect(status().isUnauthorized());
	}

}
