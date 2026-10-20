package com.researchpms.backend.c3.meeting;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MeetingRepository extends JpaRepository<Meeting, UUID> {

	List<Meeting> findByProjectIdOrderByScheduledAtDesc(UUID projectId);

	boolean existsByIdAndProjectId(UUID id, UUID projectId);

	/** Locked, so two people recording minutes at the same moment cannot both succeed. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select m from Meeting m where m.id = :id")
	Optional<Meeting> findForUpdate(@Param("id") UUID id);

}
