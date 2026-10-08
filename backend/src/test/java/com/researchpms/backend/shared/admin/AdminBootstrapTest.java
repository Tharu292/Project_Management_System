package com.researchpms.backend.shared.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.admin.AdminBootstrap.Outcome;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs the bootstrap directly with hand-made configuration, as a restart would.
 * Each test is rolled back, so no administrator is left in the test database.
 * Every credential here is fake.
 */
@SpringBootTest
@Transactional
class AdminBootstrapTest {

	private static final String PASSWORD = "Bootstrap-Passw0rd";

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private AdminBootstrap startupBootstrap;

	private String email;

	private String staffId;

	@BeforeEach
	void uniqueValues() {
		String id = SharedTestData.unique();
		email = "admin." + id + "@sliit.lk";
		staffId = "ADM-" + id;
	}

	private Outcome provision(String email, String password, String staffId) {
		BootstrapAdminProperties properties = new BootstrapAdminProperties(email, password, "System", "Administrator",
				staffId);
		return new AdminBootstrap(properties, userRepository, passwordEncoder).provision();
	}

	private List<User> admins() {
		return userRepository.findAll().stream().filter(user -> user.getSystemRole() == SystemRole.ADMIN).toList();
	}

	private User savedAdmin(boolean enabled) {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		admin.setEnabled(enabled);
		return userRepository.saveAndFlush(admin);
	}

	@Test
	void withoutConfigurationNoAdminIsCreated() {
		assertThat(provision(null, null, null)).isEqualTo(Outcome.NOT_CONFIGURED);
		assertThat(provision("", "  ", "")).isEqualTo(Outcome.NOT_CONFIGURED);
		assertThat(admins()).isEmpty();
	}

	@Test
	void theApplicationsOwnBootstrapIsNotConfiguredDuringTests() {
		assertThat(startupBootstrap.provision()).isEqualTo(Outcome.NOT_CONFIGURED);
		assertThat(admins()).isEmpty();
	}

	@Test
	void validConfigurationCreatesOneEnabledStaffAdmin() {
		assertThat(provision("  " + email.toUpperCase() + " ", PASSWORD, " " + staffId + " "))
			.isEqualTo(Outcome.CREATED);

		assertThat(admins()).hasSize(1);
		User admin = userRepository.findByEmail(email).orElseThrow();
		assertThat(admin.getAccountType()).isEqualTo(AccountType.STAFF);
		assertThat(admin.getSystemRole()).isEqualTo(SystemRole.ADMIN);
		assertThat(admin.isEnabled()).isTrue();
		assertThat(admin.isMustChangePassword()).isTrue();
		assertThat(admin.getSecurityVersion()).isZero();
		assertThat(admin.getStaffId()).isEqualTo(staffId);
		assertThat(admin.getRegistrationNumber()).isNull();
		assertThat(admin.getFirstName()).isEqualTo("System");
	}

	@Test
	void passwordIsStoredOnlyAsABcryptHash() {
		provision(email, PASSWORD, staffId);

		String hash = userRepository.findByEmail(email).orElseThrow().getPasswordHash();
		assertThat(hash).isNotEqualTo(PASSWORD).doesNotContain(PASSWORD).startsWith("$2");
		assertThat(passwordEncoder.matches(PASSWORD, hash)).isTrue();
	}

	@Test
	void staffIdIsOptional() {
		assertThat(provision(email, PASSWORD, null)).isEqualTo(Outcome.CREATED);
		assertThat(userRepository.findByEmail(email).orElseThrow().getStaffId()).isNull();
	}

	@Test
	void runningAgainDoesNotCreateASecondAdmin() {
		assertThat(provision(email, PASSWORD, staffId)).isEqualTo(Outcome.CREATED);

		assertThat(provision(email, PASSWORD, staffId)).isEqualTo(Outcome.ADMIN_EXISTS);
		assertThat(provision("another." + SharedTestData.unique() + "@sliit.lk", PASSWORD, null))
			.isEqualTo(Outcome.ADMIN_EXISTS);
		assertThat(admins()).hasSize(1);
	}

	@Test
	void anExistingAdminIsNeverOverwritten() {
		User existing = savedAdmin(true);
		String originalHash = existing.getPasswordHash();
		String originalEmail = existing.getEmail();

		assertThat(provision(originalEmail, PASSWORD, staffId)).isEqualTo(Outcome.ADMIN_EXISTS);

		User unchanged = userRepository.findById(existing.getId()).orElseThrow();
		assertThat(unchanged.isMustChangePassword()).isFalse();
		assertThat(unchanged.getPasswordHash()).isEqualTo(originalHash);
		assertThat(unchanged.getEmail()).isEqualTo(originalEmail);
		assertThat(unchanged.getStaffId()).isNull();
		assertThat(admins()).hasSize(1);
	}

	@Test
	void aDisabledAdminIsNotReplaced() {
		User disabled = savedAdmin(false);

		assertThat(provision(email, PASSWORD, staffId)).isEqualTo(Outcome.ADMIN_EXISTS);

		assertThat(admins()).extracting(User::getId).containsExactly(disabled.getId());
		assertThat(userRepository.findById(disabled.getId()).orElseThrow().isEnabled()).isFalse();
		assertThat(userRepository.existsByEmail(email)).isFalse();
	}

	@Test
	void anExistingNormalUserWithTheBootstrapEmailIsNotPromoted() {
		User lecturer = userRepository.saveAndFlush(SharedTestData.staff());
		String originalHash = lecturer.getPasswordHash();

		assertThat(provision(lecturer.getEmail(), PASSWORD, staffId)).isEqualTo(Outcome.CONFLICT);

		User unchanged = userRepository.findById(lecturer.getId()).orElseThrow();
		assertThat(unchanged.getSystemRole()).isEqualTo(SystemRole.USER);
		assertThat(unchanged.getPasswordHash()).isEqualTo(originalHash);
		assertThat(admins()).isEmpty();
	}

	@Test
	void aStaffIdThatIsAlreadyUsedFailsSafely() {
		User lecturer = SharedTestData.staff();
		lecturer.setStaffId(staffId);
		userRepository.saveAndFlush(lecturer);

		assertThat(provision(email, PASSWORD, staffId)).isEqualTo(Outcome.CONFLICT);

		assertThat(admins()).isEmpty();
		assertThat(userRepository.existsByEmail(email)).isFalse();
	}

	@Test
	void emailOutsideTheStaffDomainFailsSafely() {
		String id = SharedTestData.unique();
		for (String rejected : new String[] { "admin" + id + "@my.sliit.lk", "admin" + id + "@gmail.com",
				"admin" + id + "@sliit.lk.fake.com", "admin" + id + "@fake-sliit.lk", "not-an-email" }) {
			assertThat(provision(rejected, PASSWORD, null)).as(rejected).isEqualTo(Outcome.INVALID_CONFIGURATION);
		}
		assertThat(admins()).isEmpty();
	}

	@Test
	void passwordThatBreaksThePolicyFailsSafely() {
		for (String weak : new String[] { "Ab1", "onlyletters", "1234567890", "Passw0rd" + "a".repeat(65),
				"Passw0rd" + "\u00e9".repeat(33) }) {
			assertThat(provision(email, weak, null)).as("weak password").isEqualTo(Outcome.INVALID_CONFIGURATION);
		}
		assertThat(admins()).isEmpty();
	}

	@Test
	void halfConfiguredBootstrapFailsSafely() {
		assertThat(provision(email, null, null)).isEqualTo(Outcome.INVALID_CONFIGURATION);
		assertThat(provision(null, PASSWORD, null)).isEqualTo(Outcome.INVALID_CONFIGURATION);
		assertThat(provision(email, PASSWORD, "S".repeat(31))).isEqualTo(Outcome.INVALID_CONFIGURATION);
		assertThat(admins()).isEmpty();
	}

	@Test
	void configurationNeverPrintsThePassword() {
		BootstrapAdminProperties properties = new BootstrapAdminProperties(email, PASSWORD, "System", "Administrator",
				staffId);

		assertThat(properties.toString()).doesNotContain(PASSWORD).doesNotContain(email);
	}

}
