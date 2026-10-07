package com.researchpms.backend.shared.auth;

import com.researchpms.backend.shared.auth.dto.LoginRequest;
import com.researchpms.backend.shared.auth.dto.LoginResponse;
import com.researchpms.backend.shared.auth.dto.StudentRegistrationRequest;
import com.researchpms.backend.shared.auth.dto.UserResponse;
import com.researchpms.backend.shared.security.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Staff and admin accounts are not created here; only students may self-register. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

	private final AuthService authService;

	private final CurrentUserService currentUserService;

	public AuthController(AuthService authService, CurrentUserService currentUserService) {
		this.authService = authService;
		this.currentUserService = currentUserService;
	}

	@PostMapping("/register/student")
	@ResponseStatus(HttpStatus.CREATED)
	public UserResponse registerStudent(@Valid @RequestBody StudentRegistrationRequest request) {
		return authService.registerStudent(request);
	}

	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request) {
		return authService.login(request);
	}

	@GetMapping("/me")
	public UserResponse me() {
		return UserResponse.from(currentUserService.getCurrentUser());
	}

}
