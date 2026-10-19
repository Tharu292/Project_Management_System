package com.researchpms.backend.shared.auth;

import com.researchpms.backend.shared.auth.dto.ChangePasswordRequest;
import com.researchpms.backend.shared.auth.dto.LoginRequest;
import com.researchpms.backend.shared.auth.dto.LoginResponse;
import com.researchpms.backend.shared.auth.dto.StudentRegistrationRequest;
import com.researchpms.backend.shared.auth.dto.UserResponse;
import com.researchpms.backend.shared.common.ApiExceptionHandler;
import com.researchpms.backend.shared.common.DuplicateResourceException;
import com.researchpms.backend.shared.common.InvalidRequestException;
import com.researchpms.backend.shared.security.AuthenticatedUser;
import com.researchpms.backend.shared.security.CurrentUserService;
import com.researchpms.backend.shared.security.JwtService;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	private final AuthenticationManager authenticationManager;

	private final JwtService jwtService;

	private final CurrentUserService currentUserService;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
			AuthenticationManager authenticationManager, JwtService jwtService,
			CurrentUserService currentUserService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
		this.jwtService = jwtService;
		this.currentUserService = currentUserService;
	}

	/** Creates a student account only. It does not add the student to any project. */
	public UserResponse registerStudent(StudentRegistrationRequest request) {
		if (!request.password().equals(request.confirmPassword())) {
			throw new InvalidRequestException("confirmPassword", "Passwords do not match.");
		}
		if (userRepository.existsByEmail(request.email())) {
			throw new DuplicateResourceException("An account with this email already exists.");
		}
		if (userRepository.existsByRegistrationNumber(request.registrationNumber())) {
			throw new DuplicateResourceException("An account with this registration number already exists.");
		}

		User user = new User(request.firstName(), request.lastName(), request.email(),
				passwordEncoder.encode(request.password()), AccountType.STUDENT);
		user.setRegistrationNumber(request.registrationNumber());
		user.setSystemRole(SystemRole.USER);
		user.setEnabled(true);
		try {
			return UserResponse.from(userRepository.saveAndFlush(user));
		}
		catch (DataIntegrityViolationException ex) {
			// Two identical registrations arrived together; the unique constraints caught the second.
			throw new DuplicateResourceException("An account with this email or registration number already exists.");
		}
	}

	/** One login for students, staff and admins. Every failure looks the same to the caller. */
	public LoginResponse login(LoginRequest request) {
		Authentication authentication;
		try {
			authentication = authenticationManager.authenticate(UsernamePasswordAuthenticationToken
				.unauthenticated(User.normalizeEmail(request.email()), request.password()));
		}
		catch (AuthenticationException ex) {
			throw new BadCredentialsException(ApiExceptionHandler.INVALID_CREDENTIALS);
		}
		AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
		User user = userRepository.findById(principal.getId())
			// The password was checked against an older row: it was changed, or the account disabled, meanwhile.
			.filter(current -> current.getSecurityVersion() == principal.getSecurityVersion())
			.orElseThrow(() -> new BadCredentialsException(ApiExceptionHandler.INVALID_CREDENTIALS));
		return LoginResponse.bearer(jwtService.generateToken(user), jwtService.getExpiresInSeconds(),
				UserResponse.from(user));
	}

	/**
	 * Changes the signed-in user's own password. The new hash, the cleared
	 * first-login flag and the raised security version are written together, so
	 * every token issued before the change stops working, including the one
	 * used for this request. No new token is issued; the user logs in again.
	 * The user's row is locked for the whole operation.
	 */
	@Transactional
	public void changePassword(ChangePasswordRequest request) {
		// Locked before anything is read, so a concurrent enable/disable cannot be overwritten.
		User user = currentUserService.getCurrentUserForUpdate();
		if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
			throw new InvalidRequestException("currentPassword", "Current password is incorrect.");
		}
		if (!request.newPassword().equals(request.confirmPassword())) {
			throw new InvalidRequestException("confirmPassword", "Passwords do not match.");
		}
		if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
			throw new InvalidRequestException("newPassword",
					"New password must be different from the current password.");
		}
		user.changePassword(passwordEncoder.encode(request.newPassword()));
		userRepository.saveAndFlush(user);
	}

}
