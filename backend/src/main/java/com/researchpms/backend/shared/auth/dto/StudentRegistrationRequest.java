package com.researchpms.backend.shared.auth.dto;

import com.researchpms.backend.shared.security.ValidPassword;
import com.researchpms.backend.shared.user.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/**
 * What a student submits to create an account. Account type, system role and
 * enabled status are not part of the request; the server decides them.
 * Values are normalised on arrival, so validation sees what will be stored.
 */
public record StudentRegistrationRequest(

		@NotBlank @Size(max = 100) String firstName,

		@NotBlank @Size(max = 100) String lastName,

		@NotBlank @Size(max = 254) @Pattern(regexp = STUDENT_EMAIL_PATTERN,
				message = "Email must be a @" + STUDENT_EMAIL_DOMAIN + " student address.") String email,

		@NotBlank @Size(max = 20) @Pattern(regexp = "^[A-Z0-9]*$",
				message = "Registration number may contain only letters and digits.") String registrationNumber,

		@ValidPassword String password,

		@NotBlank String confirmPassword) {

	/** The only domain allowed to self-register. */
	public static final String STUDENT_EMAIL_DOMAIN = "my.sliit.lk";

	/** Matches the whole address, so "x@my.sliit.lk.fake.com" and "x@sliit.lk" are refused. */
	static final String STUDENT_EMAIL_PATTERN = "^[a-z0-9._%+-]+@my\\.sliit\\.lk$";

	public StudentRegistrationRequest {
		firstName = firstName == null ? null : firstName.trim();
		lastName = lastName == null ? null : lastName.trim();
		email = User.normalizeEmail(email);
		registrationNumber = registrationNumber == null ? null : registrationNumber.trim().toUpperCase(Locale.ROOT);
	}

	/** Keeps the passwords out of logs if a request object is ever printed. */
	@Override
	public String toString() {
		return "StudentRegistrationRequest[email=" + email + ", registrationNumber=" + registrationNumber + "]";
	}

}
