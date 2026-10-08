package com.researchpms.backend.shared.admin;

import com.researchpms.backend.shared.admin.dto.AdminUserResponse;
import com.researchpms.backend.shared.admin.dto.CreateStaffRequest;
import com.researchpms.backend.shared.admin.dto.UpdateEnabledRequest;
import com.researchpms.backend.shared.common.DuplicateResourceException;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** ADMIN only: enforced for the whole /api/v1/admin/** path in SecurityConfig and again in the service. */
@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {

	private final AdminUserService adminUserService;

	public AdminUserController(AdminUserService adminUserService) {
		this.adminUserService = adminUserService;
	}

	@PostMapping("/staff")
	@ResponseStatus(HttpStatus.CREATED)
	public AdminUserResponse createStaff(@Valid @RequestBody CreateStaffRequest request) {
		try {
			return adminUserService.createStaff(request);
		}
		catch (DataIntegrityViolationException ex) {
			// Two identical requests arrived together; the unique constraints caught the second.
			throw new DuplicateResourceException("An account with this email or staff ID already exists.");
		}
	}

	@GetMapping
	public List<AdminUserResponse> listUsers() {
		return adminUserService.listUsers();
	}

	@GetMapping("/{userId}")
	public AdminUserResponse getUser(@PathVariable UUID userId) {
		return adminUserService.getUser(userId);
	}

	@PatchMapping("/{userId}/enabled")
	public AdminUserResponse setEnabled(@PathVariable UUID userId, @Valid @RequestBody UpdateEnabledRequest request) {
		return adminUserService.setEnabled(userId, request.enabled());
	}

}
