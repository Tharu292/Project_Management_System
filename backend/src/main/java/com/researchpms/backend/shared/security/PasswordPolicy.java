package com.researchpms.backend.shared.security;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;

/**
 * The single definition of an acceptable new password (prototype policy):
 * at least 8 characters, at most 72 bytes, with at least one letter and one digit.
 */
public class PasswordPolicy implements ConstraintValidator<ValidPassword, String> {

	public static final int MIN_LENGTH = 8;

	/** BCrypt only uses the first 72 bytes of a password, so longer ones are refused. */
	public static final int MAX_BYTES = 72;

	public static final String MESSAGE = "Password must be at least " + MIN_LENGTH
			+ " characters and contain at least one letter and one digit.";

	public static boolean isAcceptable(String password) {
		return password != null && password.length() >= MIN_LENGTH
				&& password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES
				&& password.chars().anyMatch(Character::isLetter) && password.chars().anyMatch(Character::isDigit);
	}

	@Override
	public boolean isValid(String password, ConstraintValidatorContext context) {
		return isAcceptable(password);
	}

}
