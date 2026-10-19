package com.researchpms.backend.shared.security;

import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * The signed-in user as Spring Security sees it: a snapshot of the
 * {@link User} row taken when the request was authenticated.
 */
public final class AuthenticatedUser implements UserDetails, CredentialsContainer {

	public static final String PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";

	private final UUID id;

	private final String email;

	private final AccountType accountType;

	private final SystemRole systemRole;

	private final boolean enabled;

	private final boolean mustChangePassword;

	private final int securityVersion;

	private String passwordHash;

	private AuthenticatedUser(User user) {
		this.id = user.getId();
		this.email = user.getEmail();
		this.accountType = user.getAccountType();
		this.systemRole = user.getSystemRole();
		this.enabled = user.isEnabled();
		this.mustChangePassword = user.isMustChangePassword();
		this.securityVersion = user.getSecurityVersion();
		this.passwordHash = user.getPasswordHash();
	}

	public static AuthenticatedUser from(User user) {
		return new AuthenticatedUser(user);
	}

	public UUID getId() {
		return id;
	}

	public AccountType getAccountType() {
		return accountType;
	}

	public SystemRole getSystemRole() {
		return systemRole;
	}

	public boolean isMustChangePassword() {
		return mustChangePassword;
	}

	/** The user's security version when this snapshot was taken. */
	public int getSecurityVersion() {
		return securityVersion;
	}

	/**
	 * ROLE_USER or ROLE_ADMIN, or only {@link #PASSWORD_CHANGE_REQUIRED} while the
	 * user must change their password: without a role they fail every rule in
	 * SecurityConfig except the two endpoints open to any signed-in user.
	 * Project roles are not authorities; they are checked per project.
	 */
	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		if (mustChangePassword) {
			return List.of(new SimpleGrantedAuthority(PASSWORD_CHANGE_REQUIRED));
		}
		return List.of(new SimpleGrantedAuthority("ROLE_" + systemRole.name()));
	}

	@Override
	public String getPassword() {
		return passwordHash;
	}

	@Override
	public String getUsername() {
		return email;
	}

	@Override
	public boolean isEnabled() {
		return enabled;
	}

	@Override
	public void eraseCredentials() {
		passwordHash = null;
	}

}
