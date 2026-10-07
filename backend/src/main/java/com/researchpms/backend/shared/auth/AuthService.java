package com.researchpms.backend.shared.auth;

import com.researchpms.backend.shared.auth.dto.LoginRequest;
import com.researchpms.backend.shared.auth.dto.LoginResponse;
import com.researchpms.backend.shared.auth.dto.StudentRegistrationRequest;
import com.researchpms.backend.shared.auth.dto.UserResponse;
import com.researchpms.backend.shared.common.ApiExceptionHandler;
import com.researchpms.backend.shared.common.DuplicateResourceException;
import com.researchpms.backend.shared.common.InvalidRequestException;
import com.researchpms.backend.shared.security.AuthenticatedUser;
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

@Service
public class AuthService {

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	private final AuthenticationManager authenticationManager;

	private final JwtService jwtService;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
			AuthenticationManager authenticationManager, JwtService jwtService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
		this.jwtService = jwtService;
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
			.orElseThrow(() -> new BadCredentialsException(ApiExceptionHandler.INVALID_CREDENTIALS));
		return LoginResponse.bearer(jwtService.generateToken(user), jwtService.getExpiresInSeconds(),
				UserResponse.from(user));
	}

}
