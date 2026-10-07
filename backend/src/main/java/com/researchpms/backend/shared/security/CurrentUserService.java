package com.researchpms.backend.shared.security;

import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import java.util.UUID;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * How every component finds out who is calling. Components must use this
 * instead of reading the Authorization header or parsing tokens themselves.
 * Methods other than {@link #isAuthenticated()} fail with a 401 when nobody is signed in.
 */
@Service
public class CurrentUserService {

	private final UserRepository userRepository;

	public CurrentUserService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	public boolean isAuthenticated() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		return authentication != null && authentication.isAuthenticated()
				&& authentication.getPrincipal() instanceof AuthenticatedUser;
	}

	public UUID getCurrentUserId() {
		return principal().getId();
	}

	/** The current user's row, freshly loaded. */
	public User getCurrentUser() {
		return userRepository.findById(getCurrentUserId())
			.orElseThrow(() -> new AuthenticationCredentialsNotFoundException("The signed-in user no longer exists."));
	}

	public AccountType getCurrentAccountType() {
		return principal().getAccountType();
	}

	public SystemRole getCurrentSystemRole() {
		return principal().getSystemRole();
	}

	private AuthenticatedUser principal() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.isAuthenticated()
				&& authentication.getPrincipal() instanceof AuthenticatedUser user) {
			return user;
		}
		throw new AuthenticationCredentialsNotFoundException("No authenticated user.");
	}

}
