package com.researchpms.backend.shared;

import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.User;
import java.util.UUID;

/** Builds valid, unsaved entities with unique values for persistence tests. */
public final class SharedTestData {

	/** Shaped like a BCrypt hash; no real password is involved in these tests. */
	public static final String PASSWORD_HASH = "$2a$10$" + "x".repeat(53);

	private SharedTestData() {
	}

	public static String unique() {
		return UUID.randomUUID().toString().substring(0, 8);
	}

	public static User student() {
		String id = unique();
		User user = new User("Test", "Student", "it" + id + "@my.sliit.lk", PASSWORD_HASH, AccountType.STUDENT);
		user.setRegistrationNumber("IT" + id);
		return user;
	}

	public static User staff() {
		return new User("Test", "Lecturer", "lecturer." + unique() + "@sliit.lk", PASSWORD_HASH, AccountType.STAFF);
	}

	public static Project project() {
		return new Project("PRJ-" + unique(), "Test research project");
	}

}
