package com.researchpms.backend.shared.user;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Email arguments must already be normalised with {@link User#normalizeEmail(String)}.
 *
 * <p>
 * Code that changes an existing user must load it through {@link UserLocks},
 * never through {@code findById}: two requests that each read a row, change
 * it and save it would otherwise overwrite each other's columns.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

	boolean existsByRegistrationNumber(String registrationNumber);

	boolean existsByStaffId(String staffId);

	/** Counts disabled accounts too. */
	boolean existsBySystemRole(SystemRole systemRole);

	/**
	 * Takes the row lock (SELECT ... FOR UPDATE) and waits for any other holder.
	 * Call it through {@link UserLocks#lock(UUID)}, which also guarantees that
	 * the returned state was read after the lock was taken.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from User u where u.id = :id")
	Optional<User> findByIdForUpdate(@Param("id") UUID id);

	/** Oldest first; the id breaks ties so the order is always the same. */
	List<User> findAllByOrderByCreatedAtAscIdAsc();

}
