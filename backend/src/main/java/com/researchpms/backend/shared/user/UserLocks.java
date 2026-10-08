package com.researchpms.backend.shared.user;

import jakarta.persistence.EntityManager;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one way to load a user that is about to be changed. The row stays
 * locked until the surrounding transaction ends, so a password change and an
 * administrator's enable/disable of the same account run one after the other
 * and the second always sees what the first wrote.
 */
@Component
public class UserLocks {

	private final UserRepository userRepository;

	private final EntityManager entityManager;

	public UserLocks(UserRepository userRepository, EntityManager entityManager) {
		this.userRepository = userRepository;
		this.entityManager = entityManager;
	}

	/**
	 * Must be called inside a transaction, before anything about the user is
	 * read or decided. Unsaved changes to that user made earlier in the same
	 * transaction are discarded.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public Optional<User> lock(UUID userId) {
		Optional<User> user = userRepository.findByIdForUpdate(userId);
		// If this user was already loaded earlier in the transaction, the query hands back that
		// older copy. Re-reading it now, with the lock held, replaces it with the current row.
		user.ifPresent(entityManager::refresh);
		return user;
	}

}
