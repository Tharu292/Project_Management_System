package com.researchpms.backend.shared.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Supplied through the BOOTSTRAP_ADMIN_* environment variables. Email and
 * password are required to provision the first administrator; when both are
 * blank, nothing is provisioned.
 */
@ConfigurationProperties(prefix = "app.bootstrap.admin")
public record BootstrapAdminProperties(String email, String password, String firstName, String lastName,
		String staffId) {

	/** True when neither email nor password was supplied. */
	public boolean isAbsent() {
		return isBlank(email) && isBlank(password);
	}

	static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

	/** Keeps the password out of logs if this object is ever printed. */
	@Override
	public String toString() {
		return "BootstrapAdminProperties[configured=" + !isAbsent() + "]";
	}

}
