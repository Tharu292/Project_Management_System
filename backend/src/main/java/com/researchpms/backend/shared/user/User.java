package com.researchpms.backend.shared.user;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A person who can sign in. Shared by all components; component-specific
 * data about a person belongs in that component's own tables.
 */
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {

	@NotBlank
	@Size(max = 100)
	@Setter
	@Column(name = "first_name", nullable = false, length = 100)
	private String firstName;

	@NotBlank
	@Size(max = 100)
	@Setter
	@Column(name = "last_name", nullable = false, length = 100)
	private String lastName;

	/** Login identifier. Always stored trimmed and lower-cased. */
	@NotBlank
	@Email
	@Size(max = 254)
	@Column(name = "email", nullable = false, unique = true, length = 254)
	private String email;

	/** BCrypt hash. Never a plain password, and never returned by an API. */
	@NotBlank
	@Size(max = 100)
	@Setter
	@Column(name = "password_hash", nullable = false, length = 100)
	private String passwordHash;

	/** Fixed when the account is created. */
	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "account_type", nullable = false, updatable = false, length = 20)
	private AccountType accountType;

	@NotNull
	@Setter
	@Enumerated(EnumType.STRING)
	@Column(name = "system_role", nullable = false, length = 20)
	private SystemRole systemRole = SystemRole.USER;

	/** Student registration number, stored upper-cased. Null for staff. */
	@Size(max = 20)
	@Column(name = "registration_number", unique = true, length = 20)
	private String registrationNumber;

	/** Optional staff identifier. Null when not supplied. */
	@Size(max = 30)
	@Column(name = "staff_id", unique = true, length = 30)
	private String staffId;

	@Setter
	@Column(name = "enabled", nullable = false)
	private boolean enabled = true;

	public User(String firstName, String lastName, String email, String passwordHash, AccountType accountType) {
		this.firstName = firstName;
		this.lastName = lastName;
		setEmail(email);
		this.passwordHash = passwordHash;
		this.accountType = accountType;
	}

	public void setEmail(String email) {
		this.email = normalizeEmail(email);
	}

	public void setRegistrationNumber(String registrationNumber) {
		String trimmed = trimToNull(registrationNumber);
		this.registrationNumber = trimmed == null ? null : trimmed.toUpperCase(Locale.ROOT);
	}

	public void setStaffId(String staffId) {
		this.staffId = trimToNull(staffId);
	}

	/** The single place that defines how an email is normalised before storage or lookup. */
	public static String normalizeEmail(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}

	private static String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}

}
