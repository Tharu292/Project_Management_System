package com.researchpms.backend.c4.contribution;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContributionSnapshotRepository extends JpaRepository<ContributionSnapshot, UUID> {

	/** Newest first. */
	List<ContributionSnapshot> findByProjectIdOrderByPeriodEndDescComputedAtDesc(UUID projectId);

	/** Newest first. */
	List<ContributionSnapshot> findByProjectIdAndStudentIdOrderByPeriodEndDescComputedAtDesc(UUID projectId,
			UUID studentId);

}
