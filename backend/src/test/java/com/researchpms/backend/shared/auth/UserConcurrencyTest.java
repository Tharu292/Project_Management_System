package com.researchpms.backend.shared.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.admin.AdminUserService;
import com.researchpms.backend.shared.auth.dto.ChangePasswordRequest;
import com.researchpms.backend.shared.security.AuthenticatedUser;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserLocks;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A password change and an administrator's enable/disable of the same account,
 * at the same moment. Unlike the other tests these run without a surrounding
 * transaction: each operation commits on its own thread and connection, as two
 * real requests would, and the accounts created here are deleted afterwards.
 *
 * <p>
 * The "held lock" tests are deterministic. The test itself takes the row lock
 * and performs the first operation without committing, starts the real second
 * operation on another thread, checks that it is waiting, and only then
 * commits. The second operation therefore always runs against a row that
 * changed after its request began. The "race" tests start two real operations
 * together several times and accept either order, but never a mixed result.
 *
 * <p>
 * Every credential here is fake.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class UserConcurrencyTest extends AuthApiTestSupport {

	private static final String ME = "/api/v1/auth/me";

	private static final String NEW_PASSWORD = "An0therPassw0rd";

	private static final int RACE_ROUNDS = 6;

	@Autowired
	private AuthService authService;

	@Autowired
	private AdminUserService adminUserService;

	@Autowired
	private UserLocks userLocks;

	@Autowired
	private PlatformTransactionManager transactionManager;

	private final ExecutorService workers = Executors.newFixedThreadPool(2);

	private final List<UUID> createdUserIds = new ArrayList<>();

	@AfterEach
	void deleteCreatedAccounts() {
		workers.shutdownNow();
		userRepository.deleteAllById(createdUserIds);
	}

	// ---- helpers ----

	/** A committed staff account that has just been given its initial password. */
	private User newStaff() {
		User staff = SharedTestData.staff();
		staff.setMustChangePassword(true);
		User saved = saveWithPassword(staff);
		createdUserIds.add(saved.getId());
		return saved;
	}

	private User reloaded(User user) {
		return userRepository.findById(user.getId()).orElseThrow();
	}

	/** Runs the action on a worker thread as if the given user had just been authenticated. */
	private <T> Future<T> submitAs(User caller, CountDownLatch start, Callable<T> action) {
		AuthenticatedUser principal = AuthenticatedUser.from(caller);
		return workers.submit(() -> {
			SecurityContextHolder.getContext()
				.setAuthentication(
						UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));
			try {
				start.await();
				return action.call();
			}
			finally {
				SecurityContextHolder.clearContext();
			}
		});
	}

	/** The real password change, called as the account's owner with a token issued for the given snapshot. */
	private Future<Void> changePassword(User snapshot, String newPassword, CountDownLatch start) {
		return submitAs(snapshot, start, () -> {
			authService.changePassword(new ChangePasswordRequest(PASSWORD, newPassword, newPassword));
			return null;
		});
	}

	/** The real enable/disable, called as an administrator. The administrator needs no row of its own. */
	private Future<Void> setEnabled(User target, boolean enabled, CountDownLatch start) {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		ReflectionTestUtils.setField(admin, "id", UUID.randomUUID());
		return submitAs(admin, start, () -> {
			adminUserService.setEnabled(target.getId(), enabled);
			return null;
		});
	}

	private static CountDownLatch started() {
		return new CountDownLatch(0);
	}

	/**
	 * Locks the user's row, applies the first operation without committing,
	 * starts the second and proves it is waiting for the lock, then commits.
	 */
	private <T> Future<T> whileTheRowIsLocked(User user, Consumer<User> firstOperation,
			Callable<Future<T>> secondOperation) {
		return new TransactionTemplate(transactionManager).execute(status -> {
			User locked = userLocks.lock(user.getId()).orElseThrow();
			firstOperation.accept(locked);
			userRepository.saveAndFlush(locked);
			try {
				Future<T> second = secondOperation.call();
				assertThatThrownBy(() -> second.get(1, TimeUnit.SECONDS)).isInstanceOf(TimeoutException.class);
				return second;
			}
			catch (Exception ex) {
				throw new IllegalStateException(ex);
			}
		});
	}

	private static boolean succeeded(Future<?> operation) throws Exception {
		try {
			operation.get(20, TimeUnit.SECONDS);
			return true;
		}
		catch (ExecutionException ex) {
			assertThat(ex.getCause()).isInstanceOf(AuthenticationException.class);
			return false;
		}
	}

	private void expectTokenRefused(String token) throws Exception {
		mockMvc.perform(get(ME).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isUnauthorized());
	}

	private boolean passwordIs(User user, String password) {
		return passwordEncoder.matches(password, reloaded(user).getPasswordHash());
	}

	// ---- held lock: the second operation always starts before the first commits ----

	@Test
	void disableWaitingBehindAPasswordChangeDoesNotRestoreTheOldPassword() throws Exception {
		User staff = newStaff();
		String oldToken = accessTokenFor(staff);
		String newHash = passwordEncoder.encode(NEW_PASSWORD);

		Future<Void> disable = whileTheRowIsLocked(staff, locked -> locked.changePassword(newHash),
				() -> setEnabled(staff, false, started()));

		assertThat(succeeded(disable)).isTrue();
		User saved = reloaded(staff);
		assertThat(saved.isEnabled()).isFalse();
		assertThat(saved.getPasswordHash()).isEqualTo(newHash);
		assertThat(saved.isMustChangePassword()).isFalse();
		assertThat(saved.getSecurityVersion()).isEqualTo(2);

		// Re-enabling brings back neither the old password nor the old token.
		assertThat(succeeded(setEnabled(staff, true, started()))).isTrue();
		expectTokenRefused(oldToken);
		login(staff.getEmail(), PASSWORD).andExpect(status().isUnauthorized());
		login(staff.getEmail(), NEW_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void passwordChangeWaitingBehindADisableDoesNotUndoTheDisable() throws Exception {
		User staff = newStaff();
		String oldToken = accessTokenFor(staff);

		Future<Void> change = whileTheRowIsLocked(staff, locked -> locked.setEnabled(false),
				() -> changePassword(staff, NEW_PASSWORD, started()));

		// Its token was invalidated while it waited, so the change is refused like any other stale request.
		assertThat(succeeded(change)).isFalse();
		User saved = reloaded(staff);
		assertThat(saved.isEnabled()).isFalse();
		assertThat(saved.isMustChangePassword()).isTrue();
		assertThat(saved.getSecurityVersion()).isEqualTo(1);
		assertThat(passwordIs(staff, PASSWORD)).isTrue();
		login(staff.getEmail(), PASSWORD).andExpect(status().isUnauthorized());

		assertThat(succeeded(setEnabled(staff, true, started()))).isTrue();
		expectTokenRefused(oldToken);
		assertThat(reloaded(staff).getSecurityVersion()).isEqualTo(1);
	}

	@Test
	void enableWaitingBehindAPasswordChangeKeepsTheNewPassword() throws Exception {
		User staff = newStaff();
		String oldToken = accessTokenFor(staff);
		String newHash = passwordEncoder.encode(NEW_PASSWORD);

		Future<Void> enable = whileTheRowIsLocked(staff, locked -> locked.changePassword(newHash),
				() -> setEnabled(staff, true, started()));

		assertThat(succeeded(enable)).isTrue();
		User saved = reloaded(staff);
		assertThat(saved.isEnabled()).isTrue();
		assertThat(saved.getPasswordHash()).isEqualTo(newHash);
		assertThat(saved.isMustChangePassword()).isFalse();
		assertThat(saved.getSecurityVersion()).isEqualTo(1);
		expectTokenRefused(oldToken);
	}

	@Test
	void secondPasswordChangeWaitingBehindTheFirstIsRefused() throws Exception {
		User staff = newStaff();
		String oldToken = accessTokenFor(staff);
		String firstHash = passwordEncoder.encode(NEW_PASSWORD);

		Future<Void> second = whileTheRowIsLocked(staff, locked -> locked.changePassword(firstHash),
				() -> changePassword(staff, "Y3tAnotherPassword", started()));

		assertThat(succeeded(second)).isFalse();
		User saved = reloaded(staff);
		assertThat(saved.getPasswordHash()).isEqualTo(firstHash);
		assertThat(saved.getSecurityVersion()).isEqualTo(1);
		expectTokenRefused(oldToken);
	}

	// ---- races: two real operations started together, in whichever order the database picks ----

	@Test
	void passwordChangeRacingADisableLeavesOneConsistentOutcome() throws Exception {
		for (int round = 0; round < RACE_ROUNDS; round++) {
			User staff = newStaff();
			String oldToken = accessTokenFor(staff);
			CountDownLatch start = new CountDownLatch(1);
			Future<Void> change = changePassword(staff, NEW_PASSWORD, start);
			Future<Void> disable = setEnabled(staff, false, start);

			start.countDown();
			boolean changed = succeeded(change);
			assertThat(succeeded(disable)).isTrue();

			User saved = reloaded(staff);
			assertThat(saved.isEnabled()).as("round %d: the disable is never undone", round).isFalse();
			if (changed) {
				assertThat(passwordIs(staff, NEW_PASSWORD)).as("round %d", round).isTrue();
				assertThat(saved.isMustChangePassword()).as("round %d", round).isFalse();
				assertThat(saved.getSecurityVersion()).as("round %d", round).isEqualTo(2);
			}
			else {
				assertThat(passwordIs(staff, PASSWORD)).as("round %d", round).isTrue();
				assertThat(saved.isMustChangePassword()).as("round %d", round).isTrue();
				assertThat(saved.getSecurityVersion()).as("round %d", round).isEqualTo(1);
			}

			assertThat(succeeded(setEnabled(staff, true, started()))).isTrue();
			expectTokenRefused(oldToken);
			login(staff.getEmail(), changed ? PASSWORD : NEW_PASSWORD).andExpect(status().isUnauthorized());
			login(staff.getEmail(), changed ? NEW_PASSWORD : PASSWORD).andExpect(status().isOk());
		}
	}

	@Test
	void passwordChangeRacingAnEnableAlwaysKeepsTheNewPassword() throws Exception {
		for (int round = 0; round < RACE_ROUNDS; round++) {
			User staff = newStaff();
			String oldToken = accessTokenFor(staff);
			CountDownLatch start = new CountDownLatch(1);
			Future<Void> change = changePassword(staff, NEW_PASSWORD, start);
			Future<Void> enable = setEnabled(staff, true, start);

			start.countDown();
			assertThat(succeeded(change)).as("round %d", round).isTrue();
			assertThat(succeeded(enable)).as("round %d", round).isTrue();

			User saved = reloaded(staff);
			assertThat(saved.isEnabled()).as("round %d", round).isTrue();
			assertThat(passwordIs(staff, NEW_PASSWORD)).as("round %d", round).isTrue();
			assertThat(saved.isMustChangePassword()).as("round %d", round).isFalse();
			assertThat(saved.getSecurityVersion()).as("round %d", round).isEqualTo(1);
			expectTokenRefused(oldToken);
			login(staff.getEmail(), PASSWORD).andExpect(status().isUnauthorized());
		}
	}

	@Test
	void twoPasswordChangesWithTheSameTokenCannotBothSucceed() throws Exception {
		for (int round = 0; round < RACE_ROUNDS; round++) {
			User staff = newStaff();
			String oldToken = accessTokenFor(staff);
			String otherPassword = "Y3tAnotherPassword";
			CountDownLatch start = new CountDownLatch(1);
			Future<Void> first = changePassword(staff, NEW_PASSWORD, start);
			Future<Void> second = changePassword(staff, otherPassword, start);

			start.countDown();
			boolean firstWon = succeeded(first);
			boolean secondWon = succeeded(second);

			assertThat(firstWon).as("round %d: exactly one change succeeds", round).isNotEqualTo(secondWon);
			assertThat(passwordIs(staff, firstWon ? NEW_PASSWORD : otherPassword)).as("round %d", round).isTrue();
			assertThat(reloaded(staff).getSecurityVersion()).as("round %d", round).isEqualTo(1);
			expectTokenRefused(oldToken);
		}
	}

}
