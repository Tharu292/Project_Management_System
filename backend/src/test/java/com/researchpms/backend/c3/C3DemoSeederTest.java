package com.researchpms.backend.c3;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.c3.demo.C3DemoSeeder;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.auth.AuthApiTestSupport;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.project.ProjectRepository;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.transaction.support.TransactionTemplate;

/** The development-only demo seed: off by default, insert-only, and never touches existing records. */
class C3DemoSeederTest extends AuthApiTestSupport {

	/** Test-only value; it protects nothing. */
	private static final String DEMO_PASSWORD = "Demo-Passw0rd-for-tests";

	@Autowired
	private ApplicationContext context;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ProjectMemberRepository memberRepository;

	@Autowired
	private TransactionTemplate transactionTemplate;

	private C3DemoSeeder seeder(String password) {
		return new C3DemoSeeder(userRepository, projectRepository, memberRepository, passwordEncoder,
				transactionTemplate, password);
	}

	@Test
	void isOffByDefault() {
		assertThat(context.getBeanProvider(C3DemoSeeder.class).getIfAvailable()).isNull();
	}

	@Test
	void createsTheDemoProjectOnceAndTheAccountsCanSignIn() throws Exception {
		assertThat(seeder(DEMO_PASSWORD).seed()).containsExactly("student account", "supervisor account",
				"project C3-DEMO", "student membership", "supervisor membership");
		assertThat(seeder(DEMO_PASSWORD).seed()).isEmpty();

		var project = projectRepository.findByProjectCode(C3DemoSeeder.PROJECT_CODE).orElseThrow();
		User student = userRepository.findByEmail(C3DemoSeeder.STUDENT_EMAIL).orElseThrow();
		User supervisor = userRepository.findByEmail(C3DemoSeeder.SUPERVISOR_EMAIL).orElseThrow();
		assertThat(student.getAccountType()).isEqualTo(AccountType.STUDENT);
		assertThat(supervisor.getAccountType()).isEqualTo(AccountType.STAFF);
		assertThat(memberRepository.findByUserIdAndProjectIdAndActiveTrue(student.getId(), project.getId()))
			.extracting(m -> m.getProjectRole()).containsExactly(ProjectRole.STUDENT);
		assertThat(memberRepository.findByUserIdAndProjectIdAndActiveTrue(supervisor.getId(), project.getId()))
			.extracting(m -> m.getProjectRole()).containsExactly(ProjectRole.SUPERVISOR);
		assertThat(student.getPasswordHash()).isNotEqualTo(DEMO_PASSWORD).startsWith("$2");

		login(C3DemoSeeder.STUDENT_EMAIL, DEMO_PASSWORD).andExpect(status().isOk());
		login(C3DemoSeeder.SUPERVISOR_EMAIL, DEMO_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void neverChangesAnAccountThatAlreadyExists() {
		User existing = new User("Real", "Person", C3DemoSeeder.STUDENT_EMAIL, SharedTestData.PASSWORD_HASH,
				AccountType.STUDENT);
		existing.setRegistrationNumber(C3DemoSeeder.STUDENT_REGISTRATION_NUMBER);
		existing = userRepository.saveAndFlush(existing);

		assertThat(seeder(DEMO_PASSWORD).seed()).doesNotContain("student account");

		User after = userRepository.findById(existing.getId()).orElseThrow();
		assertThat(after.getPasswordHash()).isEqualTo(SharedTestData.PASSWORD_HASH);
		assertThat(after.getFirstName()).isEqualTo("Real");
	}

	@Test
	void createsNothingWithoutAValidPassword() {
		assertThat(seeder("").seed()).isEmpty();
		assertThat(seeder("short1").seed()).isEmpty();
		assertThat(projectRepository.existsByProjectCode(C3DemoSeeder.PROJECT_CODE)).isFalse();
		assertThat(userRepository.existsByEmail(C3DemoSeeder.STUDENT_EMAIL)).isFalse();
	}

	@Test
	void rollsBackWhenItConflictsWithSomeoneElsesRecord() {
		// Another person already has the demo registration number, under a different email.
		User other = SharedTestData.student();
		other.setRegistrationNumber(C3DemoSeeder.STUDENT_REGISTRATION_NUMBER);
		userRepository.saveAndFlush(other);

		assertThat(seeder(DEMO_PASSWORD).seed()).isEmpty();
	}

}
