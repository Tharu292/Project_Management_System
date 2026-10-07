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

	private final UUID id;

	private final String email;

	private final AccountType accountType;

	private final SystemRole systemRole;

	private final boolean enabled;

	private String passwordHash;

	private AuthenticatedUser(User user) {
		this.id = user.getId();
		this.email = user.getEmail();
		this.accountType = user.getAccountType();
		this.systemRole = user.getSystemRole();
		this.enabled = user.isEnabled();
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

	/** ROLE_USER or ROLE_ADMIN. Project roles are not authorities; they are checked per project. */
	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
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
