package com.researchpms.backend.shared.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.admin.AdminBootstrap;
import com.researchpms.backend.shared.admin.BootstrapAdminProperties;
import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectMember;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.project.ProjectRepository;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * The first-login password change and the token invalidation that goes with
 * it. Every credential here is fake. Each test is rolled back.
 */
class PasswordChangeTest extends AuthApiTestSupport {

	private static final String ME = "/api/v1/auth/me";

	private static final String CHANGE_PASSWORD = "/api/v1/auth/change-password";

	private static final String ADMIN_USERS = "/api/v1/admin/users";

	private static final String NEW_PASSWORD = "An0therPassw0rd";

	private static final String CHANGE_REQUIRED = "You must change your password before continuing.";

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ProjectMemberRepository memberRepository;

	/** A staff account as an administrator leaves it: the password is not yet the owner's own. */
	private User newStaff;

	private String newStaffToken;

	private Project project;

	@BeforeEach
	void setUp() throws Exception {
		User staff = SharedTestData.staff();
		staff.setMustChangePassword(true);
		newStaff = saveWithPassword(staff);
		project = projectRepository.saveAndFlush(SharedTestData.project());
		memberRepository.saveAndFlush(new ProjectMember(newStaff, project, ProjectRole.SUPERVISOR));
		newStaffToken = accessTokenFor(newStaff);
	}

	private ResultActions send(MockHttpServletRequestBuilder request, String token, String json) throws Exception {
		if (token != null) {
			request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
		}
		if (json != null) {
			request.contentType(MediaType.APPLICATION_JSON).content(json);
		}
		return mockMvc.perform(request);
	}

	private static String changeJson(String currentPassword, String newPassword, String confirmPassword) {
		return """
				{"currentPassword": "%s", "newPassword": "%s", "confirmPassword": "%s"}
				""".formatted(currentPassword, newPassword, confirmPassword);
	}

	private ResultActions changePassword(String token, String currentPassword, String newPassword,
			String confirmPassword) throws Exception {
		return send(post(CHANGE_PASSWORD), token, changeJson(currentPassword, newPassword, confirmPassword));
	}

	private String memberEndpoint() {
		return "/api/test/projects/" + project.getId() + "/member";
	}

	private User reloaded(User user) {
		return userRepository.findById(user.getId()).orElseThrow();
	}

	private static void expectChangeRequired(ResultActions result) throws Exception {
		result.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.message").value(CHANGE_REQUIRED))
			.andExpect(jsonPath("$.email").doesNotExist())
			.andExpect(jsonPath("$[0]").doesNotExist());
	}

	private void expectNothingChanged(User user, int securityVersion, boolean mustChangePassword) {
		User saved = reloaded(user);
		assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isTrue();
		assertThat(saved.getSecurityVersion()).isEqualTo(securityVersion);
		assertThat(saved.isMustChangePassword()).isEqualTo(mustChangePassword);
	}

	// ---- who must change their password ----

	@Test
	void selfRegisteredStudentIsNotAskedToChangeTheirPassword() throws Exception {
		String id = SharedTestData.unique();
		String email = "it" + id + "@my.sliit.lk";
		postJson("/api/v1/auth/register/student", """
				{"firstName": "New", "lastName": "Student", "email": "%s", "registrationNumber": "IT%s",
				 "password": "%s", "confirmPassword": "%s"}
				""".formatted(email, id, PASSWORD, PASSWORD)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.mustChangePassword").value(false));

		String body = login(email, PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.mustChangePassword").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String token = JsonPath.read(body, "$.accessToken");

		send(get(ME), token, null).andExpect(status().isOk()).andExpect(jsonPath("$.mustChangePassword").value(false));
		// Reaches the controller: an unknown URL is a 404, not a 403.
		send(get("/api/v1/anything"), token, null).andExpect(status().isNotFound());
		assertThat(userRepository.findByEmail(email).orElseThrow().isMustChangePassword()).isFalse();
	}

	@Test
	void staffCreatedByAnAdministratorMustChangeTheirPassword() throws Exception {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		String adminToken = accessTokenFor(saveWithPassword(admin));
		String id = SharedTestData.unique();
		String email = "new." + id + "@sliit.lk";

		send(post(ADMIN_USERS + "/staff"), adminToken, """
				{"firstName": "New", "lastName": "Lecturer", "email": "%s", "staffId": "STF-%s",
				 "password": "%s", "confirmPassword": "%s", "mustChangePassword": false}
				""".formatted(email, id, PASSWORD, PASSWORD)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.mustChangePassword").value(true));
		assertThat(userRepository.findByEmail(email).orElseThrow().isMustChangePassword()).isTrue();

		String body = login(email, PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.mustChangePassword").value(true))
			.andReturn()
			.getResponse()
			.getContentAsString();
		expectChangeRequired(send(get("/api/v1/anything"), JsonPath.read(body, "$.accessToken"), null));
	}

	// ---- what a user who must change their password can reach ----

	@Test
	void loginAndMeTellTheClientThatAChangeIsRequired() throws Exception {
		login(newStaff.getEmail(), PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andExpect(jsonPath("$.user.mustChangePassword").value(true));

		send(get(ME), newStaffToken, null).andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(newStaff.getId().toString()))
			.andExpect(jsonPath("$.mustChangePassword").value(true))
			.andExpect(jsonPath("$.securityVersion").doesNotExist())
			.andExpect(content().string(not(containsString("$2"))));
	}

	@Test
	void everyOtherProtectedApiIsBlockedUntilThePasswordIsChanged() throws Exception {
		// A real project permission does not help: the user is a supervisor of this project.
		expectChangeRequired(send(get(memberEndpoint()), newStaffToken, null));
		expectChangeRequired(send(get("/api/test/projects/" + project.getId() + "/supervision"), newStaffToken, null));
		expectChangeRequired(send(get("/api/v1/anything"), newStaffToken, null));
		expectChangeRequired(send(get("/"), newStaffToken, null));
		// Only the exact method and path are open.
		expectChangeRequired(send(post(ME), newStaffToken, "{}"));
		expectChangeRequired(send(get(CHANGE_PASSWORD), newStaffToken, null));
		expectChangeRequired(send(get(ME + "/anything"), newStaffToken, null));
		expectChangeRequired(send(get(ADMIN_USERS), newStaffToken, null));
	}

	@Test
	void administratorWhoMustChangeTheirPasswordCannotAdministerYet() throws Exception {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		admin.setMustChangePassword(true);
		saveWithPassword(admin);
		String token = accessTokenFor(admin);
		String staffJson = """
				{"firstName": "New", "lastName": "Lecturer", "email": "new.%s@sliit.lk", "staffId": "STF-1",
				 "password": "%s", "confirmPassword": "%s"}
				""".formatted(SharedTestData.unique(), PASSWORD, PASSWORD);

		send(get(ME), token, null).andExpect(status().isOk())
			.andExpect(jsonPath("$.systemRole").value("ADMIN"))
			.andExpect(jsonPath("$.mustChangePassword").value(true));
		expectChangeRequired(send(get(ADMIN_USERS), token, null));
		expectChangeRequired(send(get(ADMIN_USERS + "/" + newStaff.getId()), token, null));
		expectChangeRequired(send(post(ADMIN_USERS + "/staff"), token, staffJson));
		expectChangeRequired(
				send(patch(ADMIN_USERS + "/" + newStaff.getId() + "/enabled"), token, "{\"enabled\": false}"));
		expectChangeRequired(send(get("/api/test/projects/" + project.getId() + "/member-or-admin"), token, null));
		assertThat(reloaded(newStaff).isEnabled()).isTrue();

		changePassword(token, PASSWORD, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

		send(get(ADMIN_USERS), accessTokenFor(admin, NEW_PASSWORD), null).andExpect(status().isOk());
	}

	@Test
	void bootstrapAdministratorMustChangeThePasswordBeforeAdministering() throws Exception {
		String email = "admin." + SharedTestData.unique() + "@sliit.lk";
		BootstrapAdminProperties properties = new BootstrapAdminProperties(email, PASSWORD, "System", "Administrator",
				null);
		assertThat(new AdminBootstrap(properties, userRepository, passwordEncoder).provision())
			.isEqualTo(AdminBootstrap.Outcome.CREATED);

		String body = login(email, PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.systemRole").value("ADMIN"))
			.andExpect(jsonPath("$.user.mustChangePassword").value(true))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String firstToken = JsonPath.read(body, "$.accessToken");
		send(get(ME), firstToken, null).andExpect(status().isOk());
		expectChangeRequired(send(get(ADMIN_USERS), firstToken, null));

		changePassword(firstToken, PASSWORD, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

		send(get(ME), firstToken, null).andExpect(status().isUnauthorized());
		send(get(ADMIN_USERS), firstToken, null).andExpect(status().isUnauthorized());
		login(email, PASSWORD).andExpect(status().isUnauthorized());
		body = login(email, NEW_PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.mustChangePassword").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();
		send(get(ADMIN_USERS), JsonPath.read(body, "$.accessToken"), null).andExpect(status().isOk());

		// Running the bootstrap again neither resets the password nor asks for another change.
		assertThat(new AdminBootstrap(properties, userRepository, passwordEncoder).provision())
			.isEqualTo(AdminBootstrap.Outcome.ADMIN_EXISTS);
		User admin = userRepository.findByEmail(email).orElseThrow();
		assertThat(admin.isMustChangePassword()).isFalse();
		assertThat(passwordEncoder.matches(NEW_PASSWORD, admin.getPasswordHash())).isTrue();
	}

	@Test
	void onlyTheExactTwoRequestsAreOpenWhileAChangeIsRequired() throws Exception {
		expectChangeRequired(send(get(ME + "/"), newStaffToken, null));
		expectChangeRequired(send(post(CHANGE_PASSWORD + "/"), newStaffToken, "{}"));
		expectChangeRequired(send(put(CHANGE_PASSWORD), newStaffToken, "{}"));
		expectChangeRequired(send(delete(ME), newStaffToken, null));
		expectChangeRequired(send(get("/api/v1/auth"), newStaffToken, null));
		expectChangeRequired(send(get("/api/v1/auth/ME"), newStaffToken, null));
		send(head(ME), newStaffToken, null).andExpect(status().isForbidden());
	}

	@Test
	void restrictionAppliesAtOnceToATokenIssuedBeforeTheFlagWasSet() throws Exception {
		User student = saveWithPassword(SharedTestData.student());
		String token = accessTokenFor(student);
		send(get("/api/v1/anything"), token, null).andExpect(status().isNotFound());

		student.setMustChangePassword(true);
		userRepository.saveAndFlush(student);

		expectChangeRequired(send(get("/api/v1/anything"), token, null));
		send(get(ME), token, null).andExpect(status().isOk()).andExpect(jsonPath("$.mustChangePassword").value(true));
	}

	@Test
	void publicEndpointsStayOpenWhileAChangeIsRequired() throws Exception {
		send(post("/api/v1/auth/login"), newStaffToken, """
				{"email": "%s", "password": "%s"}
				""".formatted(newStaff.getEmail(), PASSWORD)).andExpect(status().isOk());

		String id = SharedTestData.unique();
		send(post("/api/v1/auth/register/student"), newStaffToken, """
				{"firstName": "New", "lastName": "Student", "email": "it%s@my.sliit.lk", "registrationNumber": "IT%s",
				 "password": "%s", "confirmPassword": "%s"}
				""".formatted(id, id, PASSWORD, PASSWORD)).andExpect(status().isCreated());
	}

	// ---- changing the password ----

	@Test
	void changePasswordRequiresAToken() throws Exception {
		changePassword(null, PASSWORD, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
		changePassword("not-a-jwt", PASSWORD, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());

		expectNothingChanged(newStaff, 0, true);
	}

	@Test
	void wrongCurrentPasswordIsRejected() throws Exception {
		changePassword(newStaffToken, PASSWORD + "x", NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.currentPassword").value("Current password is incorrect."))
			.andExpect(content().string(not(containsString(NEW_PASSWORD))));

		expectNothingChanged(newStaff, 0, true);
		send(get(ME), newStaffToken, null).andExpect(status().isOk());
	}

	@Test
	void confirmationMismatchIsRejected() throws Exception {
		changePassword(newStaffToken, PASSWORD, NEW_PASSWORD, NEW_PASSWORD + "x").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.confirmPassword").value("Passwords do not match."));

		expectNothingChanged(newStaff, 0, true);
	}

	@Test
	void reusingTheCurrentPasswordIsRejected() throws Exception {
		changePassword(newStaffToken, PASSWORD, PASSWORD, PASSWORD).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.newPassword")
				.value("New password must be different from the current password."));

		expectNothingChanged(newStaff, 0, true);
		expectChangeRequired(send(get(memberEndpoint()), newStaffToken, null));
	}

	@Test
	void newPasswordMustSatisfyThePasswordPolicy() throws Exception {
		for (String weak : new String[] { "Ab1", "onlyletters", "1234567890" }) {
			changePassword(newStaffToken, PASSWORD, weak, weak).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.newPassword").exists());
		}
		send(post(CHANGE_PASSWORD), newStaffToken, "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.currentPassword").exists())
			.andExpect(jsonPath("$.fieldErrors.newPassword").exists())
			.andExpect(jsonPath("$.fieldErrors.confirmPassword").exists());

		expectNothingChanged(newStaff, 0, true);
	}

	@Test
	void successfulChangeStoresTheNewHashClearsTheFlagAndIssuesNoToken() throws Exception {
		String oldHash = newStaff.getPasswordHash();

		changePassword(newStaffToken, PASSWORD, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent())
			.andExpect(content().string(""));

		User saved = reloaded(newStaff);
		assertThat(saved.isMustChangePassword()).isFalse();
		assertThat(saved.getSecurityVersion()).isEqualTo(1);
		assertThat(saved.getPasswordHash()).isNotEqualTo(oldHash).isNotEqualTo(NEW_PASSWORD).startsWith("$2");
		assertThat(passwordEncoder.matches(NEW_PASSWORD, saved.getPasswordHash())).isTrue();
		assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isFalse();
	}

	@Test
	void afterTheChangeTheUserLogsInAgainAndIsNoLongerRestricted() throws Exception {
		changePassword(newStaffToken, PASSWORD, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

		login(newStaff.getEmail(), PASSWORD).andExpect(status().isUnauthorized());
		login(newStaff.getEmail(), NEW_PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.mustChangePassword").value(false));

		String newToken = accessTokenFor(newStaff, NEW_PASSWORD);
		send(get(ME), newToken, null).andExpect(status().isOk())
			.andExpect(jsonPath("$.mustChangePassword").value(false));
		send(get(memberEndpoint()), newToken, null).andExpect(status().isOk());
	}

	@Test
	void tokensIssuedBeforeAPasswordChangeStopWorking() throws Exception {
		String secondOldToken = accessTokenFor(newStaff);

		changePassword(newStaffToken, PASSWORD, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

		for (String oldToken : new String[] { newStaffToken, secondOldToken }) {
			send(get(ME), oldToken, null).andExpect(status().isUnauthorized());
			send(get(memberEndpoint()), oldToken, null).andExpect(status().isUnauthorized());
			changePassword(oldToken, NEW_PASSWORD, PASSWORD, PASSWORD).andExpect(status().isUnauthorized());
		}
		assertThat(passwordEncoder.matches(NEW_PASSWORD, reloaded(newStaff).getPasswordHash())).isTrue();
	}

	@Test
	void anyUserMayChangeTheirOwnPasswordAndOnlyTheirOwn() throws Exception {
		User student = saveWithPassword(SharedTestData.student());
		String studentToken = accessTokenFor(student);

		// Fields naming another account are ignored: the caller is always the token's owner.
		send(post(CHANGE_PASSWORD), studentToken, """
				{"currentPassword": "%s", "newPassword": "%s", "confirmPassword": "%s",
				 "userId": "%s", "email": "%s", "mustChangePassword": true, "securityVersion": 0}
				""".formatted(PASSWORD, NEW_PASSWORD, NEW_PASSWORD, newStaff.getId(), newStaff.getEmail()))
			.andExpect(status().isNoContent());

		assertThat(passwordEncoder.matches(NEW_PASSWORD, reloaded(student).getPasswordHash())).isTrue();
		assertThat(reloaded(student).isMustChangePassword()).isFalse();
		assertThat(reloaded(student).getSecurityVersion()).isEqualTo(1);
		send(get(ME), studentToken, null).andExpect(status().isUnauthorized());
		expectNothingChanged(newStaff, 0, true);
		send(get(ME), newStaffToken, null).andExpect(status().isOk());
	}

	// ---- token security version ----

	@Test
	void disablingAnAccountInvalidatesItsTokensEvenAfterItIsReEnabled() throws Exception {
		User student = saveWithPassword(SharedTestData.student());
		String token = accessTokenFor(student);
		send(get(ME), token, null).andExpect(status().isOk());

		student.setEnabled(false);
		userRepository.saveAndFlush(student);
		send(get(ME), token, null).andExpect(status().isUnauthorized());

		student.setEnabled(true);
		userRepository.saveAndFlush(student);
		send(get(ME), token, null).andExpect(status().isUnauthorized());
		assertThat(reloaded(student).getSecurityVersion()).isEqualTo(1);

		send(get(ME), accessTokenFor(student), null).andExpect(status().isOk());
	}

	@Test
	void securityVersionOnlyMovesWhenTokensMustBeInvalidated() {
		User student = saveWithPassword(SharedTestData.student());
		assertThat(student.getSecurityVersion()).isZero();

		student.setEnabled(true);
		student.setMustChangePassword(true);
		student.setFirstName("Renamed");
		assertThat(student.getSecurityVersion()).isZero();

		student.setEnabled(false);
		student.setEnabled(false);
		assertThat(student.getSecurityVersion()).isEqualTo(1);

		student.setEnabled(true);
		assertThat(student.getSecurityVersion()).isEqualTo(1);

		student.changePassword(passwordEncoder.encode(NEW_PASSWORD));
		assertThat(student.getSecurityVersion()).isEqualTo(2);
		assertThat(userRepository.saveAndFlush(student).getSecurityVersion()).isEqualTo(2);
	}

	@Test
	void unknownUserIdInTheBodyNeverSelectsAnotherAccount() throws Exception {
		send(post(CHANGE_PASSWORD), newStaffToken, """
				{"currentPassword": "%s", "newPassword": "%s", "confirmPassword": "%s", "userId": "%s"}
				""".formatted(PASSWORD, NEW_PASSWORD, NEW_PASSWORD, UUID.randomUUID())).andExpect(status().isNoContent());

		assertThat(passwordEncoder.matches(NEW_PASSWORD, reloaded(newStaff).getPasswordHash())).isTrue();
	}

}
