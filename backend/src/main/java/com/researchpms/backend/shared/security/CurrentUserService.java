package com.researchpms.backend.shared.security;

import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserLocks;
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

	private final UserLocks userLocks;

	public CurrentUserService(UserRepository userRepository, UserLocks userLocks) {
		this.userRepository = userRepository;
		this.userLocks = userLocks;
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

	/**
	 * The current user's row, locked for the rest of the transaction, for code
	 * that is about to change the caller's own account. Fails with a 401 if the
	 * account was disabled or its tokens were invalidated after this request
	 * was authenticated, for example by a change that held the lock just before.
	 */
	public User getCurrentUserForUpdate() {
		AuthenticatedUser caller = principal();
		return userLocks.lock(caller.getId())
			.filter(User::isEnabled)
			.filter(user -> user.getSecurityVersion() == caller.getSecurityVersion())
			.orElseThrow(() -> new AuthenticationCredentialsNotFoundException(
					"The signed-in user's token is no longer valid."));
	}

	/**
	 * True while the caller may only read their own details and change their
	 * password. Such a caller must not be given any other access.
	 */
	public boolean isPasswordChangeRequired() {
		return principal().isMustChangePassword();
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
