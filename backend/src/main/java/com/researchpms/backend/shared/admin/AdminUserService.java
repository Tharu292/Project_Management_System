package com.researchpms.backend.shared.admin;

import com.researchpms.backend.shared.admin.dto.AdminUserResponse;
import com.researchpms.backend.shared.admin.dto.CreateStaffRequest;
import com.researchpms.backend.shared.common.DuplicateResourceException;
import com.researchpms.backend.shared.common.InvalidRequestException;
import com.researchpms.backend.shared.common.OperationNotAllowedException;
import com.researchpms.backend.shared.common.ResourceNotFoundException;
import com.researchpms.backend.shared.project.ProjectAccessService;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserLocks;
import com.researchpms.backend.shared.user.UserRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Account administration. Every method requires a system ADMIN. It manages
 * shared accounts only: it never touches system roles, project memberships
 * or project roles.
 */
@Service
public class AdminUserService {

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	private final ProjectAccessService projectAccess;

	private final UserLocks userLocks;

	public AdminUserService(UserRepository userRepository, PasswordEncoder passwordEncoder,
			ProjectAccessService projectAccess, UserLocks userLocks) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.projectAccess = projectAccess;
		this.userLocks = userLocks;
	}

	/** Creates an ordinary staff account. It is not a supervisor or evaluator of anything until added to a project. */
	@Transactional
	public AdminUserResponse createStaff(CreateStaffRequest request) {
		projectAccess.requireAdmin();
		if (!request.password().equals(request.confirmPassword())) {
			throw new InvalidRequestException("confirmPassword", "Passwords do not match.");
		}
		if (userRepository.existsByEmail(request.email())) {
			throw new DuplicateResourceException("An account with this email already exists.");
		}
		if (userRepository.existsByStaffId(request.staffId())) {
			throw new DuplicateResourceException("An account with this staff ID already exists.");
		}

		User user = new User(request.firstName(), request.lastName(), request.email(),
				passwordEncoder.encode(request.password()), AccountType.STAFF);
		user.setStaffId(request.staffId());
		user.setSystemRole(SystemRole.USER);
		user.setEnabled(true);
		// The administrator knows this password, so the staff member must replace it at first login.
		user.setMustChangePassword(true);
		return AdminUserResponse.from(userRepository.saveAndFlush(user));
	}

	@Transactional(readOnly = true)
	public List<AdminUserResponse> listUsers() {
		projectAccess.requireAdmin();
		return userRepository.findAllByOrderByCreatedAtAscIdAsc().stream().map(AdminUserResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public AdminUserResponse getUser(UUID userId) {
		projectAccess.requireAdmin();
		return AdminUserResponse.from(find(userId));
	}

	/**
	 * Enables or disables an ordinary account. A disabled user cannot log in,
	 * and any token they already hold stops working for good: re-enabling the
	 * account does not revive it, the user logs in again. Administrator
	 * accounts cannot be changed here. The user's row is locked for the whole
	 * operation, so it cannot overwrite, or be overwritten by, a password
	 * change happening at the same moment.
	 */
	@Transactional
	public AdminUserResponse setEnabled(UUID userId, boolean enabled) {
		projectAccess.requireAdmin();
		User user = userLocks.lock(userId).orElseThrow(() -> new ResourceNotFoundException("User not found."));
		if (user.getSystemRole() == SystemRole.ADMIN) {
			throw new OperationNotAllowedException(
					"Administrator accounts cannot be enabled or disabled through this operation.");
		}
		user.setEnabled(enabled);
		return AdminUserResponse.from(userRepository.saveAndFlush(user));
	}

	private User find(UUID userId) {
		return userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found."));
	}

}
