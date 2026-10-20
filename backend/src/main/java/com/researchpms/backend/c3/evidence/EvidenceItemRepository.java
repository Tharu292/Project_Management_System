package com.researchpms.backend.c3.evidence;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EvidenceItemRepository extends JpaRepository<EvidenceItem, UUID> {

	List<EvidenceItem> findByProjectIdOrderByOccurredOnDescCreatedAtDesc(UUID projectId);

	List<EvidenceItem> findByProjectIdAndVerifiedAtIsNotNullAndOccurredOnBetweenOrderByOccurredOnAsc(UUID projectId,
			LocalDate from, LocalDate to);

	/** Locked, so two supervisors verifying at the same moment cannot both succeed. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select e from EvidenceItem e where e.id = :id")
	Optional<EvidenceItem> findForUpdate(@Param("id") UUID id);

}
