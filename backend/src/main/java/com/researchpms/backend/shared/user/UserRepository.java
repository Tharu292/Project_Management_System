package com.researchpms.backend.shared.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Email arguments must already be normalised with {@link User#normalizeEmail(String)}. */
public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

	boolean existsByRegistrationNumber(String registrationNumber);

	boolean existsByStaffId(String staffId);

}
