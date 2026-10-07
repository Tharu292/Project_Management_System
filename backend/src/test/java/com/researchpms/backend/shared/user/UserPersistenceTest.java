package com.researchpms.backend.shared.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.shared.SharedTestData;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/** Each test runs in a transaction that is rolled back, so no rows are left behind. */
@SpringBootTest
@Transactional
class UserPersistenceTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private EntityManager entityManager;

	@Test
	void savingGeneratesUuidAndTimestamps() {
		User saved = userRepository.saveAndFlush(SharedTestData.student());

		assertThat(saved.getId()).isNotNull();
		assertThat(saved.getCreatedAt()).isNotNull();
		assertThat(saved.getUpdatedAt()).isNotNull();
	}

	@Test
	void accountTypeSystemRoleAndDefaultsAreStoredAndReloaded() {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		User savedStudent = userRepository.saveAndFlush(SharedTestData.student());
		User savedAdmin = userRepository.saveAndFlush(admin);
		entityManager.clear();

		User student = userRepository.findById(savedStudent.getId()).orElseThrow();
		assertThat(student.getAccountType()).isEqualTo(AccountType.STUDENT);
		assertThat(student.getSystemRole()).isEqualTo(SystemRole.USER);
		assertThat(student.isEnabled()).isTrue();

		User reloadedAdmin = userRepository.findById(savedAdmin.getId()).orElseThrow();
		assertThat(reloadedAdmin.getAccountType()).isEqualTo(AccountType.STAFF);
		assertThat(reloadedAdmin.getSystemRole()).isEqualTo(SystemRole.ADMIN);
	}

	@Test
	void emailIsNormalisedAndFoundByNormalisedValue() {
		String suffix = SharedTestData.unique();
		User user = new User("Test", "Student", "  IT" + suffix + "@My.SLIIT.lk ", SharedTestData.PASSWORD_HASH,
				AccountType.STUDENT);
		userRepository.saveAndFlush(user);

		String expected = "it" + suffix + "@my.sliit.lk";
		assertThat(user.getEmail()).isEqualTo(expected);
		assertThat(userRepository.findByEmail(expected)).contains(user);
		assertThat(userRepository.existsByEmail(expected)).isTrue();
	}

	@Test
	void duplicateEmailIsRejected() {
		User first = userRepository.saveAndFlush(SharedTestData.staff());
		User second = SharedTestData.staff();
		second.setEmail(first.getEmail().toUpperCase());

		assertThatThrownBy(() -> userRepository.saveAndFlush(second))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void registrationNumberIsUpperCasedAndUnique() {
		User first = SharedTestData.student();
		first.setRegistrationNumber(" it" + SharedTestData.unique() + " ");
		userRepository.saveAndFlush(first);
		assertThat(first.getRegistrationNumber()).startsWith("IT").doesNotContain(" ");
		assertThat(userRepository.existsByRegistrationNumber(first.getRegistrationNumber())).isTrue();

		User second = SharedTestData.student();
		second.setRegistrationNumber(first.getRegistrationNumber().toLowerCase());

		assertThatThrownBy(() -> userRepository.saveAndFlush(second))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void severalUsersMayHaveNoRegistrationNumberAndNoStaffId() {
		User first = userRepository.saveAndFlush(SharedTestData.staff());
		User second = userRepository.saveAndFlush(SharedTestData.staff());

		assertThat(first.getStaffId()).isNull();
		assertThat(second.getStaffId()).isNull();
		assertThat(first.getRegistrationNumber()).isNull();
		assertThat(second.getRegistrationNumber()).isNull();
	}

	@Test
	void staffIdIsUniqueWhenPresent() {
		String staffId = "STF-" + SharedTestData.unique();
		User first = SharedTestData.staff();
		first.setStaffId(staffId);
		userRepository.saveAndFlush(first);
		assertThat(userRepository.existsByStaffId(staffId)).isTrue();

		User second = SharedTestData.staff();
		second.setStaffId(staffId);

		assertThatThrownBy(() -> userRepository.saveAndFlush(second))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

}
