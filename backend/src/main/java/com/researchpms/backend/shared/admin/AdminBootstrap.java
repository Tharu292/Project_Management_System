package com.researchpms.backend.shared.admin;

import com.researchpms.backend.shared.security.PasswordPolicy;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.StaffEmailPolicy;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Provisions the first administrator at startup, once, with a password that
 * must be changed at first login. It only ever inserts a
 * new account: it never changes, promotes or replaces an existing one, and it
 * does nothing as soon as any administrator exists (enabled or not). Problems
 * are logged without the email, password or any other configured value, and
 * never stop the application from starting.
 */
@Component
@EnableConfigurationProperties(BootstrapAdminProperties.class)
public class AdminBootstrap implements ApplicationRunner {

	public enum Outcome {

		/** An administrator already exists; nothing was done. */
		ADMIN_EXISTS,
		/** No bootstrap email and password were supplied; nothing was done. */
		NOT_CONFIGURED,
		/** The supplied configuration is incomplete or breaks an account rule. */
		INVALID_CONFIGURATION,
		/** The email or staff id already belongs to an existing account. */
		CONFLICT,
		CREATED

	}

	private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

	private static final int MAX_NAME_LENGTH = 100;

	private static final int MAX_STAFF_ID_LENGTH = 30;

	private final BootstrapAdminProperties properties;

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	public AdminBootstrap(BootstrapAdminProperties properties, UserRepository userRepository,
			PasswordEncoder passwordEncoder) {
		this.properties = properties;
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Override
	public void run(ApplicationArguments args) {
		provision();
	}

	public Outcome provision() {
		if (userRepository.existsBySystemRole(SystemRole.ADMIN)) {
			log.info("Bootstrap administrator: an administrator already exists; skipping provisioning.");
			return Outcome.ADMIN_EXISTS;
		}
		if (properties.isAbsent()) {
			log.info("Bootstrap administrator: not configured; no administrator was provisioned.");
			return Outcome.NOT_CONFIGURED;
		}

		String email = User.normalizeEmail(properties.email());
		String staffId = BootstrapAdminProperties.isBlank(properties.staffId()) ? null : properties.staffId().trim();
		String problem = configurationProblem(email, staffId);
		if (problem != null) {
			log.error("Bootstrap administrator: {} No administrator was provisioned.", problem);
			return Outcome.INVALID_CONFIGURATION;
		}
		if (userRepository.existsByEmail(email)) {
			log.error("Bootstrap administrator: the configured email already belongs to an account. "
					+ "Existing accounts are never promoted; no administrator was provisioned.");
			return Outcome.CONFLICT;
		}
		if (staffId != null && userRepository.existsByStaffId(staffId)) {
			log.error("Bootstrap administrator: the configured staff ID already belongs to an account. "
					+ "No administrator was provisioned.");
			return Outcome.CONFLICT;
		}

		User admin = new User(properties.firstName().trim(), properties.lastName().trim(), email,
				passwordEncoder.encode(properties.password()), AccountType.STAFF);
		admin.setSystemRole(SystemRole.ADMIN);
		admin.setStaffId(staffId);
		admin.setEnabled(true);
		// The password came from configuration, so its owner must replace it at first login.
		admin.setMustChangePassword(true);
		try {
			userRepository.saveAndFlush(admin);
		}
		catch (DataIntegrityViolationException ex) {
			// Another instance created a matching account at the same moment.
			log.error("Bootstrap administrator: the account could not be created because it conflicts "
					+ "with an existing account. No administrator was provisioned.");
			return Outcome.CONFLICT;
		}
		log.info("Bootstrap administrator provisioned.");
		return Outcome.CREATED;
	}

	/** A description that is safe to log (it never contains a configured value), or null when valid. */
	private String configurationProblem(String email, String staffId) {
		if (BootstrapAdminProperties.isBlank(email) || BootstrapAdminProperties.isBlank(properties.password())) {
			return "both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.";
		}
		if (!StaffEmailPolicy.isStaffEmail(email)) {
			return "BOOTSTRAP_ADMIN_EMAIL must be an @" + StaffEmailPolicy.DOMAIN + " address.";
		}
		if (!PasswordPolicy.fitsHashLimit(properties.password())) {
			return "BOOTSTRAP_ADMIN_PASSWORD is longer than " + PasswordPolicy.MAX_BYTES + " bytes.";
		}
		if (!PasswordPolicy.isAcceptable(properties.password())) {
			return "BOOTSTRAP_ADMIN_PASSWORD does not satisfy the password policy.";
		}
		if (!isValidName(properties.firstName()) || !isValidName(properties.lastName())) {
			return "BOOTSTRAP_ADMIN_FIRST_NAME and BOOTSTRAP_ADMIN_LAST_NAME must be 1 to " + MAX_NAME_LENGTH
					+ " characters.";
		}
		if (staffId != null && staffId.length() > MAX_STAFF_ID_LENGTH) {
			return "BOOTSTRAP_ADMIN_STAFF_ID must be at most " + MAX_STAFF_ID_LENGTH + " characters.";
		}
		return null;
	}

	private static boolean isValidName(String name) {
		return !BootstrapAdminProperties.isBlank(name) && name.trim().length() <= MAX_NAME_LENGTH;
	}

}
