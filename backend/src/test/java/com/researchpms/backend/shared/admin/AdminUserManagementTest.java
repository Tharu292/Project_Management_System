package com.researchpms.backend.shared.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.auth.AuthApiTestSupport;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.security.AuthenticatedUser;
import com.researchpms.backend.shared.security.PasswordChangeRequiredException;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Every credential here is fake. Each test is rolled back. */
class AdminUserManagementTest extends AuthApiTestSupport {

	private static final String USERS = "/api/v1/admin/users";

	private static final String STAFF = USERS + "/staff";

	@Autowired
	private ProjectMemberRepository memberRepository;

	@Autowired
	private AdminUserService adminUserService;

	private User admin;

	private User student;

	private User lecturer;

	private String adminToken;

	private String id;

	@BeforeEach
	void setUp() throws Exception {
		User newAdmin = SharedTestData.staff();
		newAdmin.setSystemRole(SystemRole.ADMIN);
		admin = saveWithPassword(newAdmin);
		student = saveWithPassword(SharedTestData.student());
		lecturer = saveWithPassword(SharedTestData.staff());
		adminToken = accessTokenFor(admin);
		id = SharedTestData.unique();
	}

	@AfterEach
	void signOut() {
		SecurityContextHolder.clearContext();
	}

	private static void signInAs(User user) {
		AuthenticatedUser principal = AuthenticatedUser.from(user);
		SecurityContextHolder.getContext()
			.setAuthentication(
					UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));
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

	private String staffJson(String email, String staffId, String password, String confirmPassword) {
		return """
				{
				  "firstName": "New",
				  "lastName": "Lecturer",
				  "email": "%s",
				  "staffId": "%s",
				  "password": "%s",
				  "confirmPassword": "%s"
				}
				""".formatted(email, staffId, password, confirmPassword);
	}

	private String validStaffJson() {
		return staffJson("new." + id + "@sliit.lk", "STF-" + id, PASSWORD, PASSWORD);
	}

	private ResultActions createStaff(String json) throws Exception {
		return send(post(STAFF), adminToken, json);
	}

	private ResultActions setEnabled(String token, UUID userId, String json) throws Exception {
		return send(patch(USERS + "/" + userId + "/enabled"), token, json);
	}

	private static void expectForbidden(ResultActions result) throws Exception {
		result.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.email").doesNotExist())
			.andExpect(jsonPath("$[0]").doesNotExist());
	}

	// ---- create staff ----

	@Test
	void adminCreatesAnOrdinaryEnabledStaffAccount() throws Exception {
		String email = "new." + id + "@sliit.lk";

		createStaff(staffJson("  " + email.toUpperCase() + " ", " STF-" + id + " ", PASSWORD, PASSWORD))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNotEmpty())
			.andExpect(jsonPath("$.firstName").value("New"))
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.accountType").value("STAFF"))
			.andExpect(jsonPath("$.systemRole").value("USER"))
			.andExpect(jsonPath("$.staffId").value("STF-" + id))
			.andExpect(jsonPath("$.registrationNumber").isEmpty())
			.andExpect(jsonPath("$.enabled").value(true))
			.andExpect(jsonPath("$.mustChangePassword").value(true))
			.andExpect(jsonPath("$.securityVersion").doesNotExist())
			.andExpect(jsonPath("$.createdAt").isNotEmpty());

		User saved = userRepository.findByEmail(email).orElseThrow();
		assertThat(saved.getAccountType()).isEqualTo(AccountType.STAFF);
		assertThat(saved.getSystemRole()).isEqualTo(SystemRole.USER);
		assertThat(saved.isEnabled()).isTrue();
		assertThat(saved.isMustChangePassword()).isTrue();
		assertThat(memberRepository.findByUserIdAndActiveTrue(saved.getId())).isEmpty();
	}

	@Test
	void staffPasswordIsStoredOnlyAsABcryptHashAndNeverReturned() throws Exception {
		createStaff(validStaffJson()).andExpect(status().isCreated())
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.passwordHash").doesNotExist())
			.andExpect(content().string(not(containsString(PASSWORD))))
			.andExpect(content().string(not(containsString("$2"))));

		String hash = userRepository.findByEmail("new." + id + "@sliit.lk").orElseThrow().getPasswordHash();
		assertThat(hash).isNotEqualTo(PASSWORD).startsWith("$2");
		assertThat(passwordEncoder.matches(PASSWORD, hash)).isTrue();
	}

	@Test
	void newStaffAccountCanLogInThroughTheSharedLogin() throws Exception {
		createStaff(validStaffJson()).andExpect(status().isCreated());

		login("new." + id + "@sliit.lk", PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.user.accountType").value("STAFF"))
			.andExpect(jsonPath("$.user.systemRole").value("USER"))
			.andExpect(jsonPath("$.user.mustChangePassword").value(true));
	}

	@Test
	void clientCannotChooseAccountTypeSystemRoleEnabledOrProjectRole() throws Exception {
		String email = "new." + id + "@sliit.lk";
		createStaff("""
				{
				  "firstName": "New", "lastName": "Lecturer", "email": "%s", "staffId": "STF-%s",
				  "password": "%s", "confirmPassword": "%s",
				  "accountType": "STUDENT", "systemRole": "ADMIN", "enabled": false,
				  "projectRole": "SUPERVISOR", "projectId": "%s", "passwordHash": "x"
				}
				""".formatted(email, id, PASSWORD, PASSWORD, UUID.randomUUID())).andExpect(status().isCreated())
			.andExpect(jsonPath("$.systemRole").value("USER"));

		User saved = userRepository.findByEmail(email).orElseThrow();
		assertThat(saved.getAccountType()).isEqualTo(AccountType.STAFF);
		assertThat(saved.getSystemRole()).isEqualTo(SystemRole.USER);
		assertThat(saved.isEnabled()).isTrue();
		assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isTrue();
		assertThat(memberRepository.findByUserIdAndActiveTrue(saved.getId())).isEmpty();
	}

	@Test
	void studentAndOtherDomainsAreRejectedForStaff() throws Exception {
		String[] rejected = { "new." + id + "@my.sliit.lk", "new." + id + "@gmail.com",
				"new." + id + "@sliit.lk.fake.com", "new." + id + "@fake-sliit.lk", "new." + id + "@x.com@sliit.lk" };
		for (String email : rejected) {
			createStaff(staffJson(email, "STF-" + id, PASSWORD, PASSWORD)).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.email").value("Staff email must use the @sliit.lk domain."));
		}
		assertThat(userRepository.existsByStaffId("STF-" + id)).isFalse();
	}

	@Test
	void duplicateEmailIsRejected() throws Exception {
		createStaff(staffJson(lecturer.getEmail().toUpperCase(), "STF-" + id, PASSWORD, PASSWORD))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.message").value("An account with this email already exists."))
			.andExpect(content().string(not(containsString("uq_users"))));
	}

	@Test
	void duplicateStaffIdIsRejected() throws Exception {
		createStaff(validStaffJson()).andExpect(status().isCreated());

		createStaff(staffJson("other." + id + "@sliit.lk", "STF-" + id, PASSWORD, PASSWORD))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.message").value("An account with this staff ID already exists."))
			.andExpect(content().string(not(containsString("uq_users"))));
	}

	@Test
	void passwordMismatchIsRejected() throws Exception {
		createStaff(staffJson("new." + id + "@sliit.lk", "STF-" + id, PASSWORD, PASSWORD + "x"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.confirmPassword").value("Passwords do not match."));
		assertThat(userRepository.existsByEmail("new." + id + "@sliit.lk")).isFalse();
	}

	@Test
	void passwordPolicyAppliesToStaff() throws Exception {
		for (String weak : new String[] { "Ab1", "onlyletters", "1234567890" }) {
			createStaff(staffJson("new." + id + "@sliit.lk", "STF-" + id, weak, weak))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.password").exists());
		}
	}

	@Test
	void missingFieldsAreRejected() throws Exception {
		createStaff("{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.firstName").exists())
			.andExpect(jsonPath("$.fieldErrors.lastName").exists())
			.andExpect(jsonPath("$.fieldErrors.email").exists())
			.andExpect(jsonPath("$.fieldErrors.staffId").exists())
			.andExpect(jsonPath("$.fieldErrors.password").exists());
	}

	// ---- list and get ----

	@Test
	void adminListsUsersOldestFirstWithoutPasswordData() throws Exception {
		String body = send(get(USERS), adminToken, null).andExpect(status().isOk())
			.andExpect(content().string(not(containsString("password"))))
			.andExpect(content().string(not(containsString("$2"))))
			.andReturn()
			.getResponse()
			.getContentAsString();

		List<String> ids = JsonPath.read(body, "$[*].id");
		assertThat(ids).containsSubsequence(admin.getId().toString(), student.getId().toString(),
				lecturer.getId().toString());
		List<Boolean> enabled = JsonPath.read(body, "$[?(@.id == '" + student.getId() + "')].enabled");
		assertThat(enabled).containsExactly(true);
	}

	@Test
	void adminGetsASingleUser() throws Exception {
		send(get(USERS + "/" + student.getId()), adminToken, null).andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(student.getId().toString()))
			.andExpect(jsonPath("$.email").value(student.getEmail()))
			.andExpect(jsonPath("$.accountType").value("STUDENT"))
			.andExpect(jsonPath("$.systemRole").value("USER"))
			.andExpect(jsonPath("$.registrationNumber").value(student.getRegistrationNumber()))
			.andExpect(jsonPath("$.enabled").value(true))
			.andExpect(jsonPath("$.mustChangePassword").value(false))
			.andExpect(jsonPath("$.passwordHash").doesNotExist())
			.andExpect(content().string(not(containsString(student.getPasswordHash()))));
	}

	@Test
	void unknownUserIsNotFound() throws Exception {
		send(get(USERS + "/" + UUID.randomUUID()), adminToken, null).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.message").value("User not found."));
		setEnabled(adminToken, UUID.randomUUID(), "{\"enabled\": false}").andExpect(status().isNotFound());
	}

	@Test
	void malformedUserIdIsABadRequest() throws Exception {
		send(get(USERS + "/not-a-uuid"), adminToken, null).andExpect(status().isBadRequest())
			.andExpect(content().string(not(containsString("Exception"))));
	}

	// ---- enable / disable ----

	@Test
	void adminDisablesAndReEnablesAUser() throws Exception {
		setEnabled(adminToken, lecturer.getId(), "{\"enabled\": false}").andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(lecturer.getId().toString()))
			.andExpect(jsonPath("$.enabled").value(false));
		assertThat(userRepository.findById(lecturer.getId()).orElseThrow().isEnabled()).isFalse();
		login(lecturer.getEmail(), PASSWORD).andExpect(status().isUnauthorized());

		setEnabled(adminToken, lecturer.getId(), "{\"enabled\": false}").andExpect(status().isOk())
			.andExpect(jsonPath("$.enabled").value(false));

		setEnabled(adminToken, lecturer.getId(), "{\"enabled\": true}").andExpect(status().isOk())
			.andExpect(jsonPath("$.enabled").value(true));
		login(lecturer.getEmail(), PASSWORD).andExpect(status().isOk());
	}

	@Test
	void disabledUsersExistingTokenStopsWorkingAndStaysDeadWhenReEnabled() throws Exception {
		String studentToken = accessTokenFor(student);
		send(get("/api/v1/auth/me"), studentToken, null).andExpect(status().isOk());

		setEnabled(adminToken, student.getId(), "{\"enabled\": false}").andExpect(status().isOk());
		send(get("/api/v1/auth/me"), studentToken, null).andExpect(status().isUnauthorized());

		setEnabled(adminToken, student.getId(), "{\"enabled\": true}").andExpect(status().isOk());
		send(get("/api/v1/auth/me"), studentToken, null).andExpect(status().isUnauthorized());

		send(get("/api/v1/auth/me"), accessTokenFor(student), null).andExpect(status().isOk());
		send(get(USERS), adminToken, null).andExpect(status().isOk());
	}

	@Test
	void enablingOrRepeatingAStateDoesNotInvalidateTokens() throws Exception {
		String lecturerToken = accessTokenFor(lecturer);

		setEnabled(adminToken, lecturer.getId(), "{\"enabled\": true}").andExpect(status().isOk());

		send(get("/api/v1/auth/me"), lecturerToken, null).andExpect(status().isOk());
		assertThat(userRepository.findById(lecturer.getId()).orElseThrow().getSecurityVersion()).isZero();
	}

	@Test
	void enabledEndpointChangesNothingButTheEnabledFlag() throws Exception {
		setEnabled(adminToken, lecturer.getId(), """
				{"enabled": false, "systemRole": "ADMIN", "accountType": "STUDENT", "projectRole": "SUPERVISOR"}
				""").andExpect(status().isOk()).andExpect(jsonPath("$.systemRole").value("USER"));

		User saved = userRepository.findById(lecturer.getId()).orElseThrow();
		assertThat(saved.isEnabled()).isFalse();
		assertThat(saved.isMustChangePassword()).isFalse();
		assertThat(saved.getSystemRole()).isEqualTo(SystemRole.USER);
		assertThat(saved.getAccountType()).isEqualTo(AccountType.STAFF);
		assertThat(memberRepository.findByUserIdAndActiveTrue(saved.getId())).isEmpty();
	}

	@Test
	void enabledValueIsRequired() throws Exception {
		setEnabled(adminToken, lecturer.getId(), "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.enabled").exists());
		assertThat(userRepository.findById(lecturer.getId()).orElseThrow().isEnabled()).isTrue();
	}

	@Test
	void adminAccountsCannotBeDisabledIncludingOnesOwn() throws Exception {
		User otherAdmin = SharedTestData.staff();
		otherAdmin.setSystemRole(SystemRole.ADMIN);
		saveWithPassword(otherAdmin);

		for (UUID target : new UUID[] { otherAdmin.getId(), admin.getId() }) {
			setEnabled(adminToken, target, "{\"enabled\": false}").andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message")
					.value("Administrator accounts cannot be enabled or disabled through this operation."));
			assertThat(userRepository.findById(target).orElseThrow().isEnabled()).isTrue();
		}
		send(get(USERS), adminToken, null).andExpect(status().isOk());
	}

	// ---- authorization ----

	@Test
	void everyAdminEndpointRequiresAToken() throws Exception {
		send(post(STAFF), null, validStaffJson()).andExpect(status().isUnauthorized());
		send(get(USERS), null, null).andExpect(status().isUnauthorized());
		send(get(USERS + "/" + student.getId()), null, null).andExpect(status().isUnauthorized());
		setEnabled(null, student.getId(), "{\"enabled\": false}").andExpect(status().isUnauthorized());
		setEnabled("not-a-jwt", student.getId(), "{\"enabled\": false}").andExpect(status().isUnauthorized());

		assertThat(userRepository.existsByEmail("new." + id + "@sliit.lk")).isFalse();
		assertThat(userRepository.findById(student.getId()).orElseThrow().isEnabled()).isTrue();
	}

	@Test
	void studentAndStaffUsersAreForbiddenFromEveryAdminEndpoint() throws Exception {
		for (User caller : new User[] { student, lecturer }) {
			String token = accessTokenFor(caller);
			expectForbidden(send(post(STAFF), token, validStaffJson()));
			expectForbidden(send(get(USERS), token, null));
			expectForbidden(send(get(USERS + "/" + admin.getId()), token, null));
			expectForbidden(send(get(USERS + "/" + UUID.randomUUID()), token, null));
			expectForbidden(setEnabled(token, student.getId(), "{\"enabled\": false}"));
			expectForbidden(setEnabled(token, admin.getId(), "{\"enabled\": false}"));
		}

		assertThat(userRepository.existsByEmail("new." + id + "@sliit.lk")).isFalse();
		assertThat(userRepository.findById(student.getId()).orElseThrow().isEnabled()).isTrue();
		assertThat(userRepository.findById(admin.getId()).orElseThrow().isEnabled()).isTrue();
	}

	@Test
	void nonAdminIsForbiddenBeforeTheRequestIsValidated() throws Exception {
		String token = accessTokenFor(lecturer);

		expectForbidden(send(post(STAFF), token, "{}"));
		expectForbidden(send(post(STAFF), token, "{ not json"));
		expectForbidden(send(get(USERS + "/not-a-uuid"), token, null));
		expectForbidden(send(get("/api/v1/admin/anything-else"), token, null));
	}

	@Test
	void thereIsStillNoPublicStaffOrAdminRegistration() throws Exception {
		postJson("/api/v1/auth/register/staff", validStaffJson()).andExpect(status().isUnauthorized());
		postJson("/api/v1/auth/register/admin", validStaffJson()).andExpect(status().isUnauthorized());
		postJson(STAFF, validStaffJson()).andExpect(status().isUnauthorized());
		assertThat(userRepository.existsByEmail("new." + id + "@sliit.lk")).isFalse();
	}

	// ---- the service on its own, as if reached without the HTTP rules ----

	@Test
	void serviceRefusesAnAdministratorWhoMustStillChangeTheirPassword() {
		admin.setMustChangePassword(true);
		signInAs(userRepository.saveAndFlush(admin));

		assertThatThrownBy(adminUserService::listUsers).isInstanceOf(PasswordChangeRequiredException.class);
		assertThatThrownBy(() -> adminUserService.getUser(student.getId()))
			.isInstanceOf(PasswordChangeRequiredException.class);
		assertThatThrownBy(() -> adminUserService.setEnabled(student.getId(), false))
			.isInstanceOf(PasswordChangeRequiredException.class);
		assertThat(userRepository.findById(student.getId()).orElseThrow().isEnabled()).isTrue();
	}

	@Test
	void serviceRefusesNonAdministratorsAndAllowsAnAdministrator() {
		signInAs(lecturer);
		assertThatThrownBy(adminUserService::listUsers).isInstanceOf(AccessDeniedException.class)
			.isNotInstanceOf(PasswordChangeRequiredException.class);

		signInAs(admin);
		assertThat(adminUserService.getUser(student.getId()).id()).isEqualTo(student.getId());
		assertThat(adminUserService.setEnabled(student.getId(), false).enabled()).isFalse();
	}

}
