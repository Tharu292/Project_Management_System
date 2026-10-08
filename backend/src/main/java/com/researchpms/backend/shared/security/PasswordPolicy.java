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

	public static final String TOO_LONG_MESSAGE = "Password is too long. The limit is " + MAX_BYTES
			+ " bytes; accented and non-Latin characters count as more than one.";

	public static boolean isAcceptable(String password) {
		return password != null && password.length() >= MIN_LENGTH && fitsHashLimit(password)
				&& password.chars().anyMatch(Character::isLetter) && password.chars().anyMatch(Character::isDigit);
	}

	/**
	 * Whether BCrypt can hash the whole password. Measured in UTF-8 bytes, not
	 * characters. No stored password is longer, so a longer one can never be
	 * correct and is refused before it reaches the encoder.
	 */
	public static boolean fitsHashLimit(String password) {
		return password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
	}

	@Override
	public boolean isValid(String password, ConstraintValidatorContext context) {
		if (password != null && !fitsHashLimit(password)) {
			context.disableDefaultConstraintViolation();
			context.buildConstraintViolationWithTemplate(TOO_LONG_MESSAGE).addConstraintViolation();
			return false;
		}
		return isAcceptable(password);
	}

}
