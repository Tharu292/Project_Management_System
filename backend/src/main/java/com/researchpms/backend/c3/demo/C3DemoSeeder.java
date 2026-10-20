package com.researchpms.backend.c3.demo;

import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectMember;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.project.ProjectRepository;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.security.PasswordPolicy;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * DEVELOPMENT ONLY: creates one demo project with a demo student and a demo
 * supervisor, so the Component 3 modules can be shown on a fresh local database.
 *
 * <ul>
 * <li>Runs only when {@code app.c3.demo-seed.enabled=true} (for example the
 * environment variable {@code APP_C3_DEMOSEED_ENABLED=true}); it is off by
 * default and is not a Flyway migration, so it never reaches another database.</li>
 * <li>The demo password is never in the code: it comes from the environment
 * variable {@code C3_DEMO_PASSWORD} and is hashed with the application's own
 * BCrypt encoder. Without it, nothing is created.</li>
 * <li>It only inserts. An account, project or membership that already exists is
 * left exactly as it is (its password included); nothing is updated or deleted.
 * If anything conflicts with existing data, the whole seed is rolled back and the
 * application starts normally.</li>
 * </ul>
 *
 * See docs/c3/demo-setup.md.
 */
@Component
@ConditionalOnProperty(name = "app.c3.demo-seed.enabled", havingValue = "true")
public class C3DemoSeeder implements ApplicationRunner {

	public static final String PROJECT_CODE = "C3-DEMO";

	public static final String PROJECT_TITLE = "Research Intelligence & Collaboration Ecosystem (demo)";

	public static final String STUDENT_EMAIL = "it99990001@my.sliit.lk";

	public static final String STUDENT_REGISTRATION_NUMBER = "IT99990001";

	public static final String SUPERVISOR_EMAIL = "c3.demo.supervisor@sliit.lk";

	public static final String SUPERVISOR_STAFF_ID = "C3-DEMO-SUP";

	private static final Logger log = LoggerFactory.getLogger(C3DemoSeeder.class);

	private final UserRepository users;

	private final ProjectRepository projects;

	private final ProjectMemberRepository members;

	private final PasswordEncoder passwordEncoder;

	private final TransactionTemplate transaction;

	private final String demoPassword;

	public C3DemoSeeder(UserRepository users, ProjectRepository projects, ProjectMemberRepository members,
			PasswordEncoder passwordEncoder, TransactionTemplate transaction,
			@Value("${C3_DEMO_PASSWORD:}") String demoPassword) {
		this.users = users;
		this.projects = projects;
		this.members = members;
		this.passwordEncoder = passwordEncoder;
		this.transaction = transaction;
		this.demoPassword = demoPassword;
	}

	@Override
	public void run(ApplicationArguments args) {
		seed();
	}

	/** Returns what was created, for the log and for tests; never throws. */
	public List<String> seed() {
		if (demoPassword == null || demoPassword.isBlank()) {
			log.warn("C3 demo seed is enabled but C3_DEMO_PASSWORD is not set; no demo data was created.");
			return List.of();
		}
		if (!PasswordPolicy.isAcceptable(demoPassword)) {
			log.warn("C3 demo seed: C3_DEMO_PASSWORD does not meet the password policy "
					+ "(8+ characters, a letter and a digit, at most 72 bytes); no demo data was created.");
			return List.of();
		}
		try {
			List<String> created = transaction.execute(status -> insertMissing());
			log.info("C3 demo seed finished. Created: {}", created.isEmpty() ? "nothing (all demo data existed)" : created);
			return created;
		}
		catch (DataAccessException ex) {
			// A unique email, registration number, staff id or project code already belongs to someone else.
			log.warn("C3 demo seed rolled back because it conflicts with existing data; nothing was changed. ({})",
					ex.getClass().getSimpleName());
			return List.of();
		}
	}

	private List<String> insertMissing() {
		List<String> created = new ArrayList<>();
		User student = users.findByEmail(STUDENT_EMAIL).orElseGet(() -> {
			User user = new User("Demo", "Student", STUDENT_EMAIL, passwordEncoder.encode(demoPassword),
					AccountType.STUDENT);
			user.setRegistrationNumber(STUDENT_REGISTRATION_NUMBER);
			created.add("student account");
			return users.saveAndFlush(user);
		});
		User supervisor = users.findByEmail(SUPERVISOR_EMAIL).orElseGet(() -> {
			User user = new User("Demo", "Supervisor", SUPERVISOR_EMAIL, passwordEncoder.encode(demoPassword),
					AccountType.STAFF);
			user.setStaffId(SUPERVISOR_STAFF_ID);
			created.add("supervisor account");
			return users.saveAndFlush(user);
		});
		Project project = projects.findByProjectCode(PROJECT_CODE).orElseGet(() -> {
			created.add("project " + PROJECT_CODE);
			return projects.saveAndFlush(new Project(PROJECT_CODE, PROJECT_TITLE));
		});
		addMembership(student, project, ProjectRole.STUDENT, created);
		addMembership(supervisor, project, ProjectRole.SUPERVISOR, created);
		return created;
	}

	/** Adds the membership only if no row exists for it; an inactive row stays inactive. */
	private void addMembership(User user, Project project, ProjectRole role, List<String> created) {
		if (members.findByUserIdAndProjectIdAndProjectRole(user.getId(), project.getId(), role).isEmpty()) {
			members.saveAndFlush(new ProjectMember(user, project, role));
			created.add(role.name().toLowerCase() + " membership");
		}
	}

}
